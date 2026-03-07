use lofty::file::TaggedFileExt;
use lofty::prelude::Accessor;
use lofty::probe::Probe;
use lofty::tag::ItemKey;
use rodio::stream::MixerDeviceSink;
use rodio::{play, DeviceSinkBuilder, Player};
use rusqlite::{params, Connection};
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::thread;
use tauri::{Emitter, State};
use walkdir::WalkDir;

#[derive(serde::Serialize, Clone)]
struct TrackRow {
    file_name: String,
    file_path: String,
    title: String,
    artist: String,
    album_artist: String,
    album: String,
    genre: String,
    year: Option<i32>,
    track_number: Option<i32>,
}

#[derive(serde::Serialize)]
struct ArtistRow {
    name: String,
}

#[derive(serde::Serialize)]
struct AlbumRow {
    name: String,
    album_artist: String,
    year: Option<i32>,
}

#[derive(serde::Serialize, Clone)]
struct ScanProgressPayload {
    total_found: usize,
    processed: usize,
    inserted: usize,
    failed: usize,
    current_file: String,
    completed: bool,
}

#[derive(serde::Serialize, Clone)]
struct PlaybackStatePayload {
    is_playing: bool,
    current_path: String,
    title: String,
    artist: String,
    album: String,
}

#[derive(Default)]
struct PlaybackEngine {
    handle: Option<MixerDeviceSink>,
    player: Option<Player>,
    current_path: String,
    title: String,
    artist: String,
    album: String,
    is_playing: bool,
}

impl PlaybackEngine {
    fn to_payload(&self) -> PlaybackStatePayload {
        PlaybackStatePayload {
            is_playing: self.is_playing,
            current_path: self.current_path.clone(),
            title: self.title.clone(),
            artist: self.artist.clone(),
            album: self.album.clone(),
        }
    }

    fn clear(&mut self) {
        self.handle = None;
        self.player = None;
        self.current_path.clear();
        self.title.clear();
        self.artist.clear();
        self.album.clear();
        self.is_playing = false;
    }
}

fn is_supported_audio_file(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => matches!(
            ext.to_lowercase().as_str(),
            "mp3" | "flac" | "wav" | "ogg" | "m4a"
        ),
        None => false,
    }
}

fn filename_without_extension(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown Title")
        .to_string()
}

fn extract_metadata(path: &Path) -> TrackRow {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown File")
        .to_string();

    let file_path = path.to_string_lossy().to_string();

    let mut title = filename_without_extension(path);
    let mut artist = "Unknown Artist".to_string();
    let mut album_artist = "Unknown Artist".to_string();
    let mut album = "Unknown Album".to_string();
    let mut genre = "Unknown Genre".to_string();
    let mut year: Option<i32> = None;
    let mut track_number: Option<i32> = None;

    let tagged_result = std::panic::catch_unwind(|| Probe::open(path).and_then(|p| p.read()));

    if let Ok(Ok(tagged_file)) = tagged_result {
        if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
            if let Some(v) = tag.title() {
                if !v.trim().is_empty() {
                    title = v.to_string();
                }
            }

            if let Some(v) = tag.artist() {
                if !v.trim().is_empty() {
                    artist = v.to_string();
                }
            }

            album_artist = tag
                .get_string(ItemKey::AlbumArtist)
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| artist.clone());

            if let Some(v) = tag.album() {
                if !v.trim().is_empty() {
                    album = v.to_string();
                }
            }

            if let Some(v) = tag.genre() {
                if !v.trim().is_empty() {
                    genre = v.to_string();
                }
            }

            year = tag
                .get_string(ItemKey::RecordingDate)
                .and_then(|value| value.get(0..4))
                .and_then(|value| value.parse::<i32>().ok())
                .or_else(|| {
                    tag.get_string(ItemKey::Year)
                        .and_then(|value| value.parse::<i32>().ok())
                });

            track_number = tag.track().map(|t| t as i32);
        }
    }

    TrackRow {
        file_name,
        file_path,
        title,
        artist,
        album_artist,
        album,
        genre,
        year,
        track_number,
    }
}

fn get_database_path() -> Result<PathBuf, String> {
    let base = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Could not find LOCALAPPDATA".to_string())?;

    let mut path = PathBuf::from(base);
    path.push("QwaanMusicPlayer");

    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;

    path.push("music_library.db");
    Ok(path)
}

fn init_database(conn: &Connection) -> Result<(), String> {
    conn.execute("DROP TABLE IF EXISTS tracks", [])
        .map_err(|e| e.to_string())?;

    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            album_artist TEXT NOT NULL,
            album TEXT NOT NULL,
            genre TEXT NOT NULL,
            year INTEGER,
            track_number INTEGER
        )
        "#,
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn start_scan(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let root = PathBuf::from(&path);

    if !root.exists() {
        return Err("Folder does not exist".into());
    }

    thread::spawn(move || {
        let audio_files: Vec<PathBuf> = WalkDir::new(&root)
            .into_iter()
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.into_path())
            .filter(|path| path.is_file() && is_supported_audio_file(path))
            .collect();

        let total_found = audio_files.len();

        let db_path = match get_database_path() {
            Ok(path) => path,
            Err(err) => {
                let _ = app.emit(
                    "scan-progress",
                    ScanProgressPayload {
                        total_found: 0,
                        processed: 0,
                        inserted: 0,
                        failed: 1,
                        current_file: err,
                        completed: true,
                    },
                );
                return;
            }
        };

        let mut conn = match Connection::open(db_path) {
            Ok(conn) => conn,
            Err(err) => {
                let _ = app.emit(
                    "scan-progress",
                    ScanProgressPayload {
                        total_found,
                        processed: 0,
                        inserted: 0,
                        failed: 1,
                        current_file: format!("DB open error: {}", err),
                        completed: true,
                    },
                );
                return;
            }
        };

        if let Err(err) = init_database(&conn) {
            let _ = app.emit(
                "scan-progress",
                ScanProgressPayload {
                    total_found,
                    processed: 0,
                    inserted: 0,
                    failed: 1,
                    current_file: format!("DB init error: {}", err),
                    completed: true,
                },
            );
            return;
        }

        let mut processed = 0usize;
        let mut inserted = 0usize;
        let mut failed = 0usize;
        let chunk_size = 50;

        for chunk in audio_files.chunks(chunk_size) {
            let mut tracks: Vec<TrackRow> = Vec::new();
            let mut last_file = String::new();

            for path in chunk {
                last_file = path.to_string_lossy().to_string();

                let result = std::panic::catch_unwind(|| extract_metadata(path));
                match result {
                    Ok(track) => tracks.push(track),
                    Err(_) => failed += 1,
                }

                processed += 1;
            }

            let tx = match conn.transaction() {
                Ok(tx) => tx,
                Err(err) => {
                    let _ = app.emit(
                        "scan-progress",
                        ScanProgressPayload {
                            total_found,
                            processed,
                            inserted,
                            failed: failed + 1,
                            current_file: format!("Transaction error: {}", err),
                            completed: true,
                        },
                    );
                    return;
                }
            };

            {
                let mut stmt = match tx.prepare(
                    r#"
                    INSERT OR REPLACE INTO tracks
                    (file_name, file_path, title, artist, album_artist, album, genre, year, track_number)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                    "#,
                ) {
                    Ok(stmt) => stmt,
                    Err(err) => {
                        let _ = app.emit(
                            "scan-progress",
                            ScanProgressPayload {
                                total_found,
                                processed,
                                inserted,
                                failed: failed + 1,
                                current_file: format!("Prepare error: {}", err),
                                completed: true,
                            },
                        );
                        return;
                    }
                };

                for track in tracks {
                    match stmt.execute(params![
                        track.file_name,
                        track.file_path,
                        track.title,
                        track.artist,
                        track.album_artist,
                        track.album,
                        track.genre,
                        track.year,
                        track.track_number
                    ]) {
                        Ok(_) => inserted += 1,
                        Err(_) => failed += 1,
                    }
                }
            }

            if let Err(err) = tx.commit() {
                let _ = app.emit(
                    "scan-progress",
                    ScanProgressPayload {
                        total_found,
                        processed,
                        inserted,
                        failed: failed + 1,
                        current_file: format!("Commit error: {}", err),
                        completed: true,
                    },
                );
                return;
            }

            let _ = app.emit(
                "scan-progress",
                ScanProgressPayload {
                    total_found,
                    processed,
                    inserted,
                    failed,
                    current_file: last_file,
                    completed: false,
                },
            );
        }

        let _ = app.emit(
            "scan-progress",
            ScanProgressPayload {
                total_found,
                processed,
                inserted,
                failed,
                current_file: "Scan complete".to_string(),
                completed: true,
            },
        );
    });

    Ok(())
}

#[tauri::command]
fn load_tracks(
    limit: i32,
    artist: Option<String>,
    album: Option<String>,
) -> Result<Vec<TrackRow>, String> {
    let db_path = get_database_path()?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let artist_filter = artist.unwrap_or_default();
    let album_filter = album.unwrap_or_default();

    let mut stmt = conn
        .prepare(
            r#"
            SELECT file_name, file_path, title, artist, album_artist, album, genre, year, track_number
            FROM tracks
            WHERE (?1 = '' OR album_artist = ?1)
              AND (?2 = '' OR album = ?2)
            ORDER BY album_artist ASC, album ASC, track_number ASC, title ASC
            LIMIT ?3
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![artist_filter, album_filter, limit], |row| {
            Ok(TrackRow {
                file_name: row.get(0)?,
                file_path: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                album_artist: row.get(4)?,
                album: row.get(5)?,
                genre: row.get(6)?,
                year: row.get(7)?,
                track_number: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tracks = Vec::new();

    for row in rows {
        tracks.push(row.map_err(|e| e.to_string())?);
    }

    Ok(tracks)
}

#[tauri::command]
fn load_artists() -> Result<Vec<ArtistRow>, String> {
    let db_path = get_database_path()?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT DISTINCT album_artist
            FROM tracks
            WHERE TRIM(album_artist) <> ''
            ORDER BY album_artist COLLATE NOCASE ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| Ok(ArtistRow { name: row.get(0)? }))
        .map_err(|e| e.to_string())?;

    let mut artists = Vec::new();

    for row in rows {
        artists.push(row.map_err(|e| e.to_string())?);
    }

    Ok(artists)
}

#[tauri::command]
fn load_albums(artist: Option<String>) -> Result<Vec<AlbumRow>, String> {
    let db_path = get_database_path()?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let artist_filter = artist.unwrap_or_default();

    let mut stmt = conn
        .prepare(
            r#"
            SELECT album, album_artist, MIN(year) as year
            FROM tracks
            WHERE TRIM(album) <> ''
              AND (?1 = '' OR album_artist = ?1)
            GROUP BY album, album_artist
            ORDER BY album_artist COLLATE NOCASE ASC, album COLLATE NOCASE ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![artist_filter], |row| {
            Ok(AlbumRow {
                name: row.get(0)?,
                album_artist: row.get(1)?,
                year: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut albums = Vec::new();

    for row in rows {
        albums.push(row.map_err(|e| e.to_string())?);
    }

    Ok(albums)
}

#[tauri::command]
fn play_track(
    playback: State<Mutex<PlaybackEngine>>,
    path: String,
    title: String,
    artist: String,
    album: String,
) -> Result<PlaybackStatePayload, String> {
    let file = File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);

    let handle = DeviceSinkBuilder::open_default_sink()
        .map_err(|e| format!("Failed to open audio output: {}", e))?;

    let player = play(&handle.mixer(), reader)
        .map_err(|e| format!("Failed to start playback: {}", e))?;

    let mut state = playback.lock().map_err(|_| "Playback lock failed".to_string())?;

    state.handle = Some(handle);
    state.player = Some(player);
    state.current_path = path;
    state.title = title;
    state.artist = artist;
    state.album = album;
    state.is_playing = true;

    Ok(state.to_payload())
}

#[tauri::command]
fn toggle_playback(
    playback: State<Mutex<PlaybackEngine>>,
) -> Result<PlaybackStatePayload, String> {
    let mut state = playback.lock().map_err(|_| "Playback lock failed".to_string())?;

    let player = match state.player.as_ref() {
        Some(player) => player,
        None => return Ok(state.to_payload()),
    };

    if state.is_playing {
        player.pause();
        state.is_playing = false;
    } else {
        player.play();
        state.is_playing = true;
    }

    Ok(state.to_payload())
}

#[tauri::command]
fn stop_playback(
    playback: State<Mutex<PlaybackEngine>>,
) -> Result<PlaybackStatePayload, String> {
    let mut state = playback.lock().map_err(|_| "Playback lock failed".to_string())?;
    state.clear();
    Ok(state.to_payload())
}

#[tauri::command]
fn get_playback_state(
    playback: State<Mutex<PlaybackEngine>>,
) -> Result<PlaybackStatePayload, String> {
    let state = playback.lock().map_err(|_| "Playback lock failed".to_string())?;
    Ok(state.to_payload())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(PlaybackEngine::default()))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            start_scan,
            load_tracks,
            load_artists,
            load_albums,
            play_track,
            toggle_playback,
            stop_playback,
            get_playback_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}