use lofty::config::{ParseOptions, WriteOptions};
use lofty::file::{AudioFile, BoundTaggedFile, TaggedFileExt};
use lofty::prelude::Accessor;
use lofty::probe::Probe;
use lofty::picture::{Picture, PictureType};
use lofty::tag::ItemKey;
use reqwest::blocking::Client;
use rodio::Decoder;
use rodio::stream::MixerDeviceSink;
use rodio::{DeviceSinkBuilder, Player, Source};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::collections::hash_map::DefaultHasher;
use std::fs::{File, OpenOptions};
use std::io::{BufReader, Cursor};
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager, State};
use walkdir::WalkDir;

#[derive(serde::Serialize, Clone)]
struct TrackRow {
    file_name: String,
    file_path: String,
    artwork_path: Option<String>,
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
    image_path: Option<String>,
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
    ended: bool,
    current_path: String,
    title: String,
    artist: String,
    album: String,
    position_secs: f64,
    duration_secs: f64,
    volume: f32,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct PersistedPlaybackSession {
    current_path: String,
    title: String,
    artist: String,
    album: String,
    position_secs: f64,
    volume: f32,
    was_playing: bool,
    shuffle_enabled: bool,
    repeat_enabled: bool,
    view: String,
    queue_paths: Vec<String>,
    current_index: Option<usize>,
}

#[derive(serde::Deserialize)]
struct RestorePlaybackSessionPayload {
    current_path: String,
    title: String,
    artist: String,
    album: String,
    position_secs: f64,
    volume: f32,
    resume_playback: bool,
}

#[derive(serde::Serialize, Clone)]
struct ArtistImagePayload {
    name: String,
    image_path: String,
}

#[derive(serde::Serialize)]
struct AlbumArtCandidate {
    image_url: String,
    label: String,
    source: String,
}

#[derive(serde::Deserialize)]
struct EditableTrackPayload {
    file_path: String,
    title: String,
    artist: String,
    genre: String,
    year: Option<i32>,
    track_number: Option<i32>,
}

#[derive(serde::Deserialize)]
struct SaveAlbumMetadataPayload {
    album_title: String,
    album_artist: String,
    genre: String,
    year: Option<i32>,
    artwork_url: Option<String>,
    tracks: Vec<EditableTrackPayload>,
}

#[derive(serde::Serialize)]
struct SaveAlbumMetadataResult {
    updated_album_key: String,
    updated_files: usize,
    failed_files: Vec<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct UserProfilePayload {
    id: String,
    username: String,
    avatar_url: Option<String>,
    background_type: String,
    background_url: Option<String>,
    theme: String,
    accent_color: String,
    level: i32,
    xp: i32,
    created_at: i64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct ListeningEventPayload {
    id: String,
    track_id: String,
    artist_id: String,
    album_id: String,
    genre: String,
    duration_played: i64,
    completed: bool,
    timestamp: i64,
    playback_source: String,
    skipped: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct TimeSlicePoint {
    label: String,
    seconds: i64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct GenreStat {
    genre: String,
    seconds: i64,
    percentage: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct RankedItem {
    id: String,
    title: String,
    subtitle: String,
    artwork_path: Option<String>,
    plays: i64,
    seconds: i64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct AggregatedStatsPayload {
    total_listening_time: i64,
    today_listening_time: i64,
    last_7_days_listening_time: i64,
    last_30_days_listening_time: i64,
    daily_listening_time: Vec<TimeSlicePoint>,
    weekly_listening_time: Vec<TimeSlicePoint>,
    genre_breakdown: Vec<GenreStat>,
    top_tracks: Vec<RankedItem>,
    top_artists: Vec<RankedItem>,
    top_albums: Vec<RankedItem>,
    listening_streak: i64,
    longest_session: i64,
    most_active_time_of_day: String,
    repeat_counts: BTreeMap<String, i64>,
    average_session_length: i64,
    new_artists_this_week: i64,
    new_tracks_this_week: i64,
    week_over_week_change: f64,
    insight: String,
}

#[derive(serde::Serialize, Clone)]
struct AchievementPayload {
    id: String,
    name: String,
    description: String,
    icon: String,
    category: String,
    requirement_type: String,
    requirement_value: i64,
    xp_reward: i32,
}

#[derive(serde::Serialize, Clone)]
struct UserAchievementPayload {
    achievement_id: String,
    progress: i64,
    unlocked: bool,
    unlocked_at: Option<i64>,
}

#[derive(serde::Serialize, Clone)]
struct FavoriteItemPayload {
    kind: String,
    item_key: String,
    title: String,
    subtitle: String,
    artwork_path: Option<String>,
    pinned_at: i64,
}

#[derive(serde::Serialize, Clone)]
struct ActivityFeedItem {
    id: String,
    message: String,
    timestamp: i64,
}

#[derive(serde::Serialize)]
struct HomeDataPayload {
    profile: UserProfilePayload,
    stats: AggregatedStatsPayload,
    achievements: Vec<UserAchievementPayload>,
    featured_achievements: Vec<UserAchievementPayload>,
    upcoming_achievements: Vec<UserAchievementPayload>,
    favorites: Vec<FavoriteItemPayload>,
    recent_activity: Vec<ActivityFeedItem>,
}

#[derive(serde::Deserialize)]
struct SaveProfilePayload {
    username: String,
    avatar_url: Option<String>,
    background_type: String,
    background_url: Option<String>,
    theme: String,
    accent_color: String,
}

#[derive(serde::Deserialize)]
struct FavoriteMutationPayload {
    kind: String,
    item_key: String,
    title: String,
    subtitle: String,
    artwork_path: Option<String>,
    pinned: bool,
}

struct PlaybackEngine {
    handle: Option<MixerDeviceSink>,
    player: Option<Player>,
    current_path: String,
    title: String,
    artist: String,
    album: String,
    duration_secs: f64,
    volume: f32,
}

struct ArtistImageSyncState(Mutex<bool>);

#[derive(serde::Deserialize)]
struct AudioDbSearchResponse {
    artists: Option<Vec<AudioDbArtist>>,
}

#[derive(serde::Deserialize)]
struct AudioDbArtist {
    #[serde(rename = "strArtist")]
    artist_name: Option<String>,
    #[serde(rename = "strArtistThumb")]
    artist_thumb: Option<String>,
    #[serde(rename = "strArtistFanart")]
    artist_fanart: Option<String>,
}

#[derive(serde::Deserialize)]
struct AudioDbAlbumSearchResponse {
    album: Option<Vec<AudioDbAlbum>>,
}

#[derive(serde::Deserialize)]
struct AudioDbAlbum {
    #[serde(rename = "strAlbum")]
    album_name: Option<String>,
    #[serde(rename = "strArtist")]
    artist_name: Option<String>,
    #[serde(rename = "strAlbumThumb")]
    album_thumb: Option<String>,
    #[serde(rename = "strAlbumThumbHQ")]
    album_thumb_hq: Option<String>,
    #[serde(rename = "strAlbumCDart")]
    album_cdart: Option<String>,
}

impl Default for PlaybackEngine {
    fn default() -> Self {
        Self {
            handle: None,
            player: None,
            current_path: String::new(),
            title: String::new(),
            artist: String::new(),
            album: String::new(),
            duration_secs: 0.0,
            volume: 1.0,
        }
    }
}

impl Default for PersistedPlaybackSession {
    fn default() -> Self {
        Self {
            current_path: String::new(),
            title: String::new(),
            artist: String::new(),
            album: String::new(),
            position_secs: 0.0,
            volume: 1.0,
            was_playing: false,
            shuffle_enabled: false,
            repeat_enabled: false,
            view: "albums".to_string(),
            queue_paths: Vec::new(),
            current_index: None,
        }
    }
}

impl PlaybackEngine {
    fn ended(&self) -> bool {
        !self.current_path.is_empty()
            && self.player.as_ref().map(|player| player.empty()).unwrap_or(false)
    }

    fn to_payload(&self) -> PlaybackStatePayload {
        let ended = self.ended();
        PlaybackStatePayload {
            is_playing: self
                .player
                .as_ref()
                .map(|player| !player.is_paused() && !ended)
                .unwrap_or(false),
            ended,
            current_path: self.current_path.clone(),
            title: self.title.clone(),
            artist: self.artist.clone(),
            album: self.album.clone(),
            position_secs: self
                .player
                .as_ref()
                .map(|player| player.get_pos().as_secs_f64())
                .unwrap_or(0.0),
            duration_secs: self.duration_secs,
            volume: self.volume,
        }
    }

    fn clear(&mut self) {
        if let Some(player) = self.player.take() {
            player.stop();
        }
        self.handle = None;
        self.current_path.clear();
        self.title.clear();
        self.artist.clear();
        self.album.clear();
        self.duration_secs = 0.0;
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

fn artwork_extension(data: &[u8]) -> &'static str {
    if data.starts_with(&[0x89, b'P', b'N', b'G']) {
        "png"
    } else if data.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "jpg"
    } else if data.starts_with(b"GIF87a") || data.starts_with(b"GIF89a") {
        "gif"
    } else if data.len() > 12 && &data[0..4] == b"RIFF" && &data[8..12] == b"WEBP" {
        "webp"
    } else {
        "img"
    }
}

fn normalize_artist_key(value: &str) -> String {
    value.trim().to_lowercase()
}

fn ensure_artist_image_table(conn: &Connection) -> Result<(), String> {
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS artist_images (
            artist_key TEXT PRIMARY KEY,
            artist_name TEXT NOT NULL,
            image_path TEXT,
            source_url TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        "#,
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_artist_images_status ON artist_images (status)",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn save_artwork(path: &Path, album_artist: &str, album: &str, artwork_dir: &Path, data: &[u8]) -> Option<String> {
    if data.is_empty() {
        return None;
    }

    let mut hasher = DefaultHasher::new();
    path.to_string_lossy().hash(&mut hasher);
    album_artist.hash(&mut hasher);
    album.hash(&mut hasher);
    let file_name = format!("{:x}.{}", hasher.finish(), artwork_extension(data));
    let destination = artwork_dir.join(file_name);

    if std::fs::write(&destination, data).is_ok() {
        return Some(destination.to_string_lossy().to_string());
    }

    None
}

fn get_artist_images_dir() -> Result<PathBuf, String> {
    let mut path = get_app_data_dir()?;
    path.push("artist-images");
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

fn save_artist_image(artist_name: &str, artist_key: &str, artist_images_dir: &Path, data: &[u8]) -> Option<String> {
    if data.is_empty() {
        return None;
    }

    let mut hasher = DefaultHasher::new();
    artist_key.hash(&mut hasher);
    artist_name.hash(&mut hasher);
    let file_name = format!("{:x}.{}", hasher.finish(), artwork_extension(data));
    let destination = artist_images_dir.join(file_name);

    if std::fs::write(&destination, data).is_ok() {
        return Some(destination.to_string_lossy().to_string());
    }

    None
}

fn pick_artist_image_url(artist_name: &str, client: &Client) -> Option<String> {
    let encoded = urlencoding::encode(artist_name);
    let url = format!(
        "https://www.theaudiodb.com/api/v1/json/2/search.php?s={}",
        encoded
    );
    let response = client.get(url).send().ok()?;
    let payload: AudioDbSearchResponse = response.json().ok()?;
    let normalized = normalize_artist_key(artist_name);

    let best_match = payload
        .artists?
        .into_iter()
        .find(|artist| normalize_artist_key(artist.artist_name.as_deref().unwrap_or("")) == normalized)?;

    best_match
        .artist_thumb
        .filter(|value| !value.trim().is_empty())
        .or_else(|| best_match.artist_fanart.filter(|value| !value.trim().is_empty()))
}

fn fetch_artist_image_bytes(artist_name: &str, client: &Client) -> Option<(String, Vec<u8>)> {
    let image_url = pick_artist_image_url(artist_name, client)?;
    let response = client.get(&image_url).send().ok()?;
    let bytes = response.bytes().ok()?;
    Some((image_url, bytes.to_vec()))
}

fn set_artist_image_status(
    conn: &Connection,
    artist_name: &str,
    artist_key: &str,
    image_path: Option<&str>,
    source_url: Option<&str>,
    status: &str,
) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO artist_images (artist_key, artist_name, image_path, source_url, status, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
        ON CONFLICT(artist_key) DO UPDATE SET
            artist_name = excluded.artist_name,
            image_path = excluded.image_path,
            source_url = excluded.source_url,
            status = excluded.status,
            updated_at = CURRENT_TIMESTAMP
        "#,
        params![artist_key, artist_name, image_path, source_url, status],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn fetch_missing_artist_images(app: tauri::AppHandle) -> Result<(), String> {
    let db_path = get_database_path()?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    ensure_artist_image_table(&conn)?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT DISTINCT t.album_artist
            FROM tracks t
            LEFT JOIN artist_images ai ON ai.artist_key = lower(trim(t.album_artist))
            WHERE TRIM(t.album_artist) <> ''
              AND (ai.artist_key IS NULL)
            ORDER BY t.album_artist COLLATE NOCASE ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    let mut artists_to_fetch = Vec::new();
    for row in rows {
        artists_to_fetch.push(row.map_err(|e| e.to_string())?);
    }

    if artists_to_fetch.is_empty() {
        return Ok(());
    }

    let artist_images_dir = get_artist_images_dir()?;
    let client = Client::builder()
        .user_agent("qwaan-music-player/0.1.0")
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    for artist_name in artists_to_fetch {
        let artist_key = normalize_artist_key(&artist_name);
        let _ = set_artist_image_status(&conn, &artist_name, &artist_key, None, None, "pending");

        match fetch_artist_image_bytes(&artist_name, &client) {
            Some((source_url, bytes)) => {
                if let Some(saved_path) =
                    save_artist_image(&artist_name, &artist_key, &artist_images_dir, &bytes)
                {
                    set_artist_image_status(
                        &conn,
                        &artist_name,
                        &artist_key,
                        Some(&saved_path),
                        Some(&source_url),
                        "ready",
                    )?;

                    let _ = app.emit(
                        "artist-image-updated",
                        ArtistImagePayload {
                            name: artist_name.clone(),
                            image_path: saved_path,
                        },
                    );
                } else {
                    let _ =
                        set_artist_image_status(&conn, &artist_name, &artist_key, None, Some(&source_url), "missing");
                }
            }
            None => {
                let _ = set_artist_image_status(&conn, &artist_name, &artist_key, None, None, "missing");
            }
        }

        thread::sleep(Duration::from_millis(120));
    }

    Ok(())
}

fn upsert_track(conn: &Connection, track: TrackRow) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT OR REPLACE INTO tracks
        (file_name, file_path, artwork_path, title, artist, album_artist, album, genre, year, track_number)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        "#,
        params![
            track.file_name,
            track.file_path,
            track.artwork_path,
            track.title,
            track.artist,
            track.album_artist,
            track.album,
            track.genre,
            track.year,
            track.track_number
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn search_album_art_candidates(artist_name: &str, album_name: &str) -> Result<Vec<AlbumArtCandidate>, String> {
    let client = Client::builder()
        .user_agent("qwaan-music-player/0.1.0")
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let artist_encoded = urlencoding::encode(artist_name);
    let album_encoded = urlencoding::encode(album_name);

    let exact_url = format!(
        "https://www.theaudiodb.com/api/v1/json/123/searchalbum.php?s={}&a={}",
        artist_encoded, album_encoded
    );
    let artist_url = format!(
        "https://www.theaudiodb.com/api/v1/json/123/searchalbum.php?s={}",
        artist_encoded
    );

    let mut candidates = Vec::new();

    for (request_url, exact_match_only) in [(exact_url, true), (artist_url, false)] {
        let response = client.get(&request_url).send().map_err(|e| e.to_string())?;
        let payload: AudioDbAlbumSearchResponse = response.json().map_err(|e| e.to_string())?;

        for album in payload.album.unwrap_or_default() {
            let candidate_album_name = album.album_name.unwrap_or_default();
            let candidate_artist_name = album.artist_name.unwrap_or_default();

            if exact_match_only
                && normalize_artist_key(&candidate_album_name) != normalize_artist_key(album_name)
            {
                continue;
            }

            if !exact_match_only
                && !normalize_artist_key(&candidate_album_name).contains(&normalize_artist_key(album_name))
            {
                continue;
            }

            for image_url in [album.album_thumb_hq, album.album_thumb, album.album_cdart] {
                if let Some(image_url) = image_url.filter(|value| !value.trim().is_empty()) {
                    if candidates.iter().any(|candidate: &AlbumArtCandidate| candidate.image_url == image_url) {
                        continue;
                    }

                    candidates.push(AlbumArtCandidate {
                        image_url: image_url.clone(),
                        label: format!("{} • {}", candidate_artist_name, candidate_album_name),
                        source: "TheAudioDB".to_string(),
                    });
                }
            }
        }
    }

    Ok(candidates)
}

fn download_cover_art(image_url: &str) -> Result<Vec<u8>, String> {
    let client = Client::builder()
        .user_agent("qwaan-music-player/0.1.0")
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    client
        .get(image_url)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|e| e.to_string())?
        .bytes()
        .map(|bytes| bytes.to_vec())
        .map_err(|e| e.to_string())
}

fn preferred_edit_tag_type(path: &Path, tagged_file: &impl TaggedFileExt) -> Option<lofty::tag::TagType> {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default()
        .to_lowercase();

    let preferred = match extension.as_str() {
        "mp3" => lofty::tag::TagType::Id3v2,
        "m4a" => lofty::tag::TagType::Mp4Ilst,
        "flac" => lofty::tag::TagType::VorbisComments,
        "ogg" => lofty::tag::TagType::VorbisComments,
        _ => tagged_file.primary_tag_type(),
    };

    if tagged_file.tag_support(preferred).is_writable() {
        Some(preferred)
    } else if tagged_file.tag_support(tagged_file.primary_tag_type()).is_writable() {
        Some(tagged_file.primary_tag_type())
    } else {
        None
    }
}

fn apply_common_tag_fields(
    tag: &mut lofty::tag::Tag,
    album_title: &str,
    album_artist: &str,
    default_genre: &str,
    default_year: Option<i32>,
    track: &EditableTrackPayload,
    cover_art: Option<&[u8]>,
) -> Result<(), String> {
    tag.set_album(album_title.to_string());
    tag.insert_text(ItemKey::AlbumArtist, album_artist.to_string());
    tag.set_title(track.title.clone());
    tag.set_artist(track.artist.clone());

    if !track.genre.trim().is_empty() {
        tag.set_genre(track.genre.clone());
    } else if !default_genre.trim().is_empty() {
        tag.set_genre(default_genre.to_string());
    } else {
        tag.remove_genre();
    }

    let effective_year = track.year.or(default_year);
    if let Some(year) = effective_year {
        tag.insert_text(ItemKey::RecordingDate, year.to_string());
        tag.insert_text(ItemKey::Year, year.to_string());
    } else {
        tag.remove_key(ItemKey::RecordingDate);
        tag.remove_key(ItemKey::Year);
    }

    if let Some(track_number) = track.track_number {
        tag.set_track(track_number.max(0) as u32);
    } else {
        tag.remove_track();
    }

    if let Some(cover_art) = cover_art {
        let mut picture = Picture::from_reader(&mut Cursor::new(cover_art))
            .map_err(|e| e.to_string())?;
        picture.set_pic_type(PictureType::CoverFront);
        tag.remove_picture_type(PictureType::CoverFront);
        tag.push_picture(picture);
    }

    Ok(())
}

fn save_metadata_to_track(
    track: &EditableTrackPayload,
    payload: &SaveAlbumMetadataPayload,
    cover_art: Option<&[u8]>,
) -> Result<(), String> {
    let path = PathBuf::from(&track.file_path);
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .open(&path)
        .map_err(|e| format!("Failed to open {}: {}", track.file_path, e))?;

    let mut tagged_file = BoundTaggedFile::read_from(file, ParseOptions::new())
        .map_err(|e| format!("Failed to read tags for {}: {}", track.file_path, e))?;

    let tag_type = preferred_edit_tag_type(&path, &tagged_file)
        .ok_or_else(|| format!("No writable tag type for {}", track.file_path))?;

    if tagged_file.tag_mut(tag_type).is_none() {
        tagged_file.insert_tag(lofty::tag::Tag::new(tag_type));
    }

    let tag = tagged_file
        .tag_mut(tag_type)
        .ok_or_else(|| format!("Failed to access writable tag for {}", track.file_path))?;

    apply_common_tag_fields(
        tag,
        &payload.album_title,
        &payload.album_artist,
        &payload.genre,
        payload.year,
        track,
        cover_art,
    )?;

    tagged_file
        .save(WriteOptions::default())
        .map_err(|e| format!("Failed to save {}: {}", track.file_path, e))?;

    Ok(())
}

fn refresh_saved_tracks_in_db(file_paths: &[String]) -> Result<(), String> {
    let db_path = get_database_path()?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    let artwork_dir = get_artwork_dir()?;

    for file_path in file_paths {
        let path = PathBuf::from(file_path);
        if !path.exists() {
            continue;
        }

        let track = extract_metadata(&path, &artwork_dir);
        upsert_track(&conn, track)?;
    }

    Ok(())
}

fn extract_metadata(path: &Path, artwork_dir: &Path) -> TrackRow {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown File")
        .to_string();

    let file_path = path.to_string_lossy().to_string();

    let mut artwork_path: Option<String> = None;
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

            if let Some(picture) = tag.pictures().first() {
                artwork_path = save_artwork(
                    path,
                    &album_artist,
                    &album,
                    artwork_dir,
                    picture.data(),
                );
            }
        }
    }

    TrackRow {
        file_name,
        file_path,
        artwork_path,
        title,
        artist,
        album_artist,
        album,
        genre,
        year,
        track_number,
    }
}

fn fallback_duration_secs(path: &Path) -> f64 {
    let tagged_result = std::panic::catch_unwind(|| Probe::open(path).and_then(|p| p.read()));

    if let Ok(Ok(tagged_file)) = tagged_result {
        return tagged_file.properties().duration().as_secs_f64();
    }

    0.0
}

fn get_app_data_dir() -> Result<PathBuf, String> {
    let base = std::env::var("LOCALAPPDATA")
        .map_err(|_| "Could not find LOCALAPPDATA".to_string())?;

    let mut path = PathBuf::from(base);
    path.push("QwaanMusicPlayer");

    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;

    Ok(path)
}

fn get_database_path() -> Result<PathBuf, String> {
    let mut path = get_app_data_dir()?;

    path.push("music_library.db");
    Ok(path)
}

fn get_playback_session_path() -> Result<PathBuf, String> {
    let mut path = get_app_data_dir()?;
    path.push("playback_session.json");
    Ok(path)
}

fn get_artwork_dir() -> Result<PathBuf, String> {
    let mut path = get_app_data_dir()?;
    path.push("artwork");
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

fn read_playback_session() -> Result<PersistedPlaybackSession, String> {
    let path = get_playback_session_path()?;

    if !path.exists() {
        return Ok(PersistedPlaybackSession::default());
    }

    let contents = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&contents).map_err(|e| e.to_string())
}

fn write_playback_session(session: &PersistedPlaybackSession) -> Result<(), String> {
    let path = get_playback_session_path()?;
    let temp_path = path.with_extension("json.tmp");
    let contents = serde_json::to_vec_pretty(session).map_err(|e| e.to_string())?;

    std::fs::write(&temp_path, contents).map_err(|e| e.to_string())?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    std::fs::rename(&temp_path, &path).map_err(|e| e.to_string())?;

    Ok(())
}

fn current_timestamp_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn start_of_day(timestamp: i64) -> i64 {
    timestamp - (timestamp.rem_euclid(86_400))
}

fn day_label(timestamp: i64) -> String {
    let day_index = start_of_day(timestamp) / 86_400;
    let names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let index = day_index.rem_euclid(7) as usize;
    names[index].to_string()
}

fn time_of_day_label(hour: i64) -> String {
    match hour {
        5..=11 => "Morning".to_string(),
        12..=16 => "Afternoon".to_string(),
        17..=21 => "Evening".to_string(),
        _ => "Night".to_string(),
    }
}

fn ensure_home_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS user_profile (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            avatar_url TEXT,
            background_type TEXT NOT NULL,
            background_url TEXT,
            theme TEXT NOT NULL,
            accent_color TEXT NOT NULL,
            level INTEGER NOT NULL DEFAULT 1,
            xp INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS listening_events (
            id TEXT PRIMARY KEY,
            track_id TEXT NOT NULL,
            artist_id TEXT NOT NULL,
            album_id TEXT NOT NULL,
            genre TEXT NOT NULL,
            duration_played INTEGER NOT NULL,
            completed INTEGER NOT NULL,
            timestamp INTEGER NOT NULL,
            playback_source TEXT NOT NULL,
            skipped INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_listening_events_timestamp ON listening_events (timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_listening_events_track ON listening_events (track_id);
        CREATE INDEX IF NOT EXISTS idx_listening_events_artist ON listening_events (artist_id);
        CREATE INDEX IF NOT EXISTS idx_listening_events_album ON listening_events (album_id);

        CREATE TABLE IF NOT EXISTS aggregated_stats_cache (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            payload TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_achievements (
            achievement_id TEXT PRIMARY KEY,
            progress INTEGER NOT NULL DEFAULT 0,
            unlocked INTEGER NOT NULL DEFAULT 0,
            unlocked_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS favorites (
            kind TEXT NOT NULL,
            item_key TEXT NOT NULL,
            title TEXT NOT NULL,
            subtitle TEXT NOT NULL,
            artwork_path TEXT,
            pinned_at INTEGER NOT NULL,
            PRIMARY KEY (kind, item_key)
        );
        "#,
    )
    .map_err(|e| e.to_string())?;

    let existing_profile = conn
        .query_row("SELECT id FROM user_profile LIMIT 1", [], |row| row.get::<_, String>(0))
        .optional()
        .map_err(|e| e.to_string())?;

    if existing_profile.is_none() {
        let now = current_timestamp_secs();
        conn.execute(
            r#"
            INSERT INTO user_profile
                (id, username, avatar_url, background_type, background_url, theme, accent_color, level, xp, created_at, updated_at)
            VALUES
                ('default', 'Listener', NULL, 'image', NULL, 'dark', '#7fb3ff', 1, 0, ?1, ?1)
            "#,
            params![now],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn achievement_catalog() -> Vec<AchievementPayload> {
    vec![
        AchievementPayload { id: "hours-25".into(), name: "25 Hours Listened".into(), description: "Spend 25 hours with your library.".into(), icon: "clock".into(), category: "time".into(), requirement_type: "hours".into(), requirement_value: 25, xp_reward: 120 },
        AchievementPayload { id: "hours-100".into(), name: "100 Hours Club".into(), description: "Reach 100 hours of playback.".into(), icon: "spark".into(), category: "time".into(), requirement_type: "hours".into(), requirement_value: 100, xp_reward: 400 },
        AchievementPayload { id: "streak-7".into(), name: "7 Day Streak".into(), description: "Listen 7 days in a row.".into(), icon: "flame".into(), category: "streak".into(), requirement_type: "streak".into(), requirement_value: 7, xp_reward: 160 },
        AchievementPayload { id: "streak-30".into(), name: "30 Day Listener".into(), description: "Keep your listening streak alive for 30 days.".into(), icon: "medal".into(), category: "streak".into(), requirement_type: "streak".into(), requirement_value: 30, xp_reward: 420 },
        AchievementPayload { id: "repeat-10".into(), name: "Repeat Master".into(), description: "Replay the same track 10 times.".into(), icon: "repeat".into(), category: "behavior".into(), requirement_type: "repeat_track".into(), requirement_value: 10, xp_reward: 180 },
        AchievementPayload { id: "artists-25".into(), name: "Explorer".into(), description: "Discover 25 unique artists.".into(), icon: "compass".into(), category: "discovery".into(), requirement_type: "unique_artists".into(), requirement_value: 25, xp_reward: 220 },
        AchievementPayload { id: "genre-rock-20".into(), name: "Rock Loyalist".into(), description: "Spend 20 hours listening to Rock.".into(), icon: "bolt".into(), category: "genre".into(), requirement_type: "genre_hours:rock".into(), requirement_value: 20, xp_reward: 160 },
    ]
}

fn compute_level_from_xp(xp: i32) -> i32 {
    let normalized = (xp.max(0) as f64) / 120.0;
    normalized.sqrt().floor() as i32 + 1
}

fn get_user_profile(conn: &Connection) -> Result<UserProfilePayload, String> {
    ensure_home_tables(conn)?;
    conn.query_row(
        r#"
        SELECT id, username, avatar_url, background_type, background_url, theme, accent_color, level, xp, created_at
        FROM user_profile
        ORDER BY created_at ASC
        LIMIT 1
        "#,
        [],
        |row| {
            Ok(UserProfilePayload {
                id: row.get(0)?,
                username: row.get(1)?,
                avatar_url: row.get(2)?,
                background_type: row.get(3)?,
                background_url: row.get(4)?,
                theme: row.get(5)?,
                accent_color: row.get(6)?,
                level: row.get(7)?,
                xp: row.get(8)?,
                created_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

fn build_ranked_tracks(conn: &Connection) -> Result<Vec<RankedItem>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
                e.track_id,
                COALESCE(t.title, e.track_id) AS title,
                COALESCE(t.artist, '') AS artist,
                t.artwork_path,
                COUNT(*) AS plays,
                SUM(e.duration_played) AS seconds
            FROM listening_events e
            LEFT JOIN tracks t ON t.file_path = e.track_id
            GROUP BY e.track_id
            ORDER BY plays DESC, seconds DESC, title COLLATE NOCASE ASC
            LIMIT 8
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(RankedItem {
                id: row.get(0)?,
                title: row.get(1)?,
                subtitle: row.get(2)?,
                artwork_path: row.get(3)?,
                plays: row.get(4)?,
                seconds: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| e.to_string())?);
    }
    Ok(items)
}

fn build_ranked_dimension(conn: &Connection, dimension: &str) -> Result<Vec<RankedItem>, String> {
    let (select_expr, title_expr, subtitle_expr, join_clause) = match dimension {
        "artist" => (
            "e.artist_id",
            "e.artist_id",
            "COUNT(DISTINCT e.album_id)",
            "LEFT JOIN tracks t ON t.album_artist = e.artist_id",
        ),
        _ => (
            "e.album_id",
            "e.album_id",
            "e.artist_id",
            "LEFT JOIN tracks t ON t.album = e.album_id AND t.album_artist = e.artist_id",
        ),
    };

    let query = format!(
        r#"
        SELECT
            {select_expr} AS id,
            {title_expr} AS title,
            {subtitle_expr} AS subtitle,
            MIN(t.artwork_path) AS artwork_path,
            COUNT(*) AS plays,
            SUM(e.duration_played) AS seconds
        FROM listening_events e
        {join_clause}
        GROUP BY id, title, subtitle
        ORDER BY plays DESC, seconds DESC, title COLLATE NOCASE ASC
        LIMIT 8
        "#
    );

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let subtitle: String = row.get(2)?;
            Ok(RankedItem {
                id: row.get(0)?,
                title: row.get(1)?,
                subtitle,
                artwork_path: row.get(3)?,
                plays: row.get(4)?,
                seconds: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| e.to_string())?);
    }
    Ok(items)
}

fn compute_aggregated_stats(conn: &Connection) -> Result<AggregatedStatsPayload, String> {
    ensure_home_tables(conn)?;
    let now = current_timestamp_secs();
    let today_start = start_of_day(now);
    let seven_days_start = today_start - (6 * 86_400);
    let thirty_days_start = today_start - (29 * 86_400);
    let previous_week_start = seven_days_start - (7 * 86_400);

    let mut stmt = conn
        .prepare(
            r#"
            SELECT track_id, artist_id, album_id, genre, duration_played, completed, timestamp, skipped
            FROM listening_events
            ORDER BY timestamp ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut total = 0_i64;
    let mut today_total = 0_i64;
    let mut last_7_total = 0_i64;
    let mut last_30_total = 0_i64;
    let mut previous_week_total = 0_i64;
    let mut daily_map: BTreeMap<i64, i64> = BTreeMap::new();
    let mut weekly_map: BTreeMap<i64, i64> = BTreeMap::new();
    let mut genre_map: HashMap<String, i64> = HashMap::new();
    let mut listened_days: HashSet<i64> = HashSet::new();
    let mut hour_map: HashMap<i64, i64> = HashMap::new();
    let mut repeat_counts: HashMap<String, i64> = HashMap::new();
    let mut first_artist_seen: HashMap<String, i64> = HashMap::new();
    let mut first_track_seen: HashMap<String, i64> = HashMap::new();
    let mut longest_session = 0_i64;
    let mut session_total = 0_i64;
    let mut session_count = 0_i64;
    let mut last_timestamp: Option<i64> = None;
    let mut current_session = 0_i64;

    for row in rows {
        let (track_id, artist_id, _album_id, genre, duration_played, _completed, timestamp, _skipped) =
            row.map_err(|e| e.to_string())?;

        total += duration_played;
        if timestamp >= today_start {
            today_total += duration_played;
        }
        if timestamp >= seven_days_start {
            last_7_total += duration_played;
        }
        if timestamp >= thirty_days_start {
            last_30_total += duration_played;
        }
        if timestamp >= previous_week_start && timestamp < seven_days_start {
            previous_week_total += duration_played;
        }

        *daily_map.entry(start_of_day(timestamp)).or_insert(0) += duration_played;
        *weekly_map.entry(start_of_day(timestamp - ((timestamp / 86_400) % 7) * 86_400)).or_insert(0) += duration_played;
        *genre_map.entry(if genre.trim().is_empty() { "Unknown".into() } else { genre.clone() }).or_insert(0) += duration_played;
        listened_days.insert(start_of_day(timestamp));
        *hour_map.entry((timestamp / 3_600).rem_euclid(24)).or_insert(0) += duration_played;
        *repeat_counts.entry(track_id.clone()).or_insert(0) += 1;
        first_artist_seen.entry(artist_id).or_insert(timestamp);
        first_track_seen.entry(track_id).or_insert(timestamp);

        if let Some(previous) = last_timestamp {
            if timestamp - previous <= 1_800 {
                current_session += duration_played;
            } else {
                longest_session = longest_session.max(current_session);
                session_total += current_session;
                session_count += 1;
                current_session = duration_played;
            }
        } else {
            current_session = duration_played;
        }
        last_timestamp = Some(timestamp);
    }

    if current_session > 0 {
        longest_session = longest_session.max(current_session);
        session_total += current_session;
        session_count += 1;
    }

    let mut daily_listening_time = Vec::new();
    for offset in (0..7).rev() {
        let day = today_start - (offset * 86_400);
        daily_listening_time.push(TimeSlicePoint {
            label: day_label(day),
            seconds: *daily_map.get(&day).unwrap_or(&0),
        });
    }

    let mut weekly_listening_time = Vec::new();
    for (index, (_week, seconds)) in weekly_map.iter().rev().take(6).enumerate() {
        weekly_listening_time.push(TimeSlicePoint {
            label: format!("W{}", 6 - index),
            seconds: *seconds,
        });
    }
    weekly_listening_time.reverse();

    let genre_breakdown: Vec<GenreStat> = {
        let mut genres: Vec<(String, i64)> = genre_map.into_iter().collect();
        genres.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
        let total_seconds = total.max(1) as f64;
        genres
            .into_iter()
            .take(8)
            .map(|(genre, seconds)| GenreStat {
                genre,
                seconds,
                percentage: (seconds as f64 / total_seconds) * 100.0,
            })
            .collect()
    };

    let top_tracks = build_ranked_tracks(conn)?;
    let top_artists = build_ranked_dimension(conn, "artist")?;
    let top_albums = build_ranked_dimension(conn, "album")?;

    let mut streak = 0_i64;
    let mut cursor = today_start;
    while listened_days.contains(&cursor) {
        streak += 1;
        cursor -= 86_400;
    }

    let most_active_time_of_day = hour_map
        .into_iter()
        .max_by_key(|(_, seconds)| *seconds)
        .map(|(hour, _)| time_of_day_label(hour))
        .unwrap_or_else(|| "Evening".to_string());

    let new_artists_this_week = first_artist_seen
        .values()
        .filter(|timestamp| **timestamp >= seven_days_start)
        .count() as i64;
    let new_tracks_this_week = first_track_seen
        .values()
        .filter(|timestamp| **timestamp >= seven_days_start)
        .count() as i64;

    let average_session_length = if session_count > 0 {
        session_total / session_count
    } else {
        0
    };

    let week_over_week_change = if previous_week_total > 0 {
        ((last_7_total - previous_week_total) as f64 / previous_week_total as f64) * 100.0
    } else if last_7_total > 0 {
        100.0
    } else {
        0.0
    };

    let top_genre_label = genre_breakdown
        .first()
        .map(|genre| genre.genre.clone())
        .unwrap_or_else(|| "your library".to_string());
    let insight = if total == 0 {
        "Start listening to build your personal listening story.".to_string()
    } else {
        format!(
            "You leaned into {} recently, with {} total hours listened.",
            top_genre_label,
            total / 3_600
        )
    };

    Ok(AggregatedStatsPayload {
        total_listening_time: total,
        today_listening_time: today_total,
        last_7_days_listening_time: last_7_total,
        last_30_days_listening_time: last_30_total,
        daily_listening_time,
        weekly_listening_time,
        genre_breakdown,
        top_tracks,
        top_artists,
        top_albums,
        listening_streak: streak,
        longest_session,
        most_active_time_of_day,
        repeat_counts: repeat_counts.into_iter().collect(),
        average_session_length,
        new_artists_this_week,
        new_tracks_this_week,
        week_over_week_change,
        insight,
    })
}

fn store_stats_cache(conn: &Connection, stats: &AggregatedStatsPayload) -> Result<(), String> {
    let payload = serde_json::to_string(stats).map_err(|e| e.to_string())?;
    conn.execute(
        r#"
        INSERT INTO aggregated_stats_cache (id, payload, updated_at)
        VALUES (1, ?1, ?2)
        ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
        "#,
        params![payload, current_timestamp_secs()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn load_cached_stats(conn: &Connection) -> Result<Option<AggregatedStatsPayload>, String> {
    let payload: Option<String> = conn
        .query_row(
            "SELECT payload FROM aggregated_stats_cache WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    payload
        .map(|value| serde_json::from_str(&value).map_err(|e| e.to_string()))
        .transpose()
}

fn evaluate_achievements(
    conn: &Connection,
    stats: &AggregatedStatsPayload,
) -> Result<Vec<UserAchievementPayload>, String> {
    ensure_home_tables(conn)?;
    let catalog = achievement_catalog();
    let now = current_timestamp_secs();
    let max_repeat = stats.repeat_counts.values().copied().max().unwrap_or(0);
    let unique_artists = conn
        .query_row(
            "SELECT COUNT(DISTINCT artist_id) FROM listening_events",
            [],
            |row| row.get::<_, i64>(0),
        )
        .unwrap_or(0);
    let genre_hours_lookup: HashMap<String, i64> = stats
        .genre_breakdown
        .iter()
        .map(|genre| (genre.genre.to_lowercase(), genre.seconds / 3_600))
        .collect();
    let catalog_rewards: HashMap<String, i32> = catalog
        .iter()
        .map(|achievement| (achievement.id.clone(), achievement.xp_reward))
        .collect();

    let mut results = Vec::new();
    for achievement in catalog {
        let progress = match achievement.requirement_type.as_str() {
            "hours" => stats.total_listening_time / 3_600,
            "streak" => stats.listening_streak,
            "repeat_track" => max_repeat,
            "unique_artists" => unique_artists,
            requirement if requirement.starts_with("genre_hours:") => {
                let genre = requirement.trim_start_matches("genre_hours:");
                *genre_hours_lookup.get(genre).unwrap_or(&0)
            }
            _ => 0,
        };

        let achievement_id = achievement.id.clone();
        let existing: Option<(i64, i64, Option<i64>)> = conn
            .query_row(
                "SELECT progress, unlocked, unlocked_at FROM user_achievements WHERE achievement_id = ?1",
                params![achievement_id.clone()],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;

        let unlocked = progress >= achievement.requirement_value;
        let unlocked_at = if unlocked {
            existing
                .as_ref()
                .and_then(|(_, existing_unlocked, timestamp)| if *existing_unlocked == 1 { *timestamp } else { None })
                .or(Some(now))
        } else {
            None
        };

        conn.execute(
            r#"
            INSERT INTO user_achievements (achievement_id, progress, unlocked, unlocked_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(achievement_id) DO UPDATE SET
                progress = excluded.progress,
                unlocked = excluded.unlocked,
                unlocked_at = COALESCE(user_achievements.unlocked_at, excluded.unlocked_at)
            "#,
            params![achievement_id.clone(), progress, if unlocked { 1 } else { 0 }, unlocked_at],
        )
        .map_err(|e| e.to_string())?;

        results.push(UserAchievementPayload {
            achievement_id: achievement_id,
            progress,
            unlocked,
            unlocked_at,
        });
    }

    let achievement_reward_xp: i32 = results
        .iter()
        .filter(|achievement| achievement.unlocked)
        .map(|achievement| *catalog_rewards.get(&achievement.achievement_id).unwrap_or(&0))
        .sum();
    let listening_xp = (stats.total_listening_time / 60).min(i32::MAX as i64) as i32;
    let total_xp = listening_xp + achievement_reward_xp;
    let level = compute_level_from_xp(total_xp);

    conn.execute(
        "UPDATE user_profile SET xp = ?1, level = ?2, updated_at = ?3 WHERE id = 'default'",
        params![total_xp, level, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(results)
}

fn build_recent_activity(
    stats: &AggregatedStatsPayload,
    achievements: &[UserAchievementPayload],
) -> Vec<ActivityFeedItem> {
    let mut items = Vec::new();
    let now = current_timestamp_secs();

    if stats.new_artists_this_week > 0 {
        items.push(ActivityFeedItem {
            id: "discoveries".to_string(),
            message: format!("You discovered {} new artists this week.", stats.new_artists_this_week),
            timestamp: now,
        });
    }

    if stats.listening_streak > 0 {
        items.push(ActivityFeedItem {
            id: "streak".to_string(),
            message: format!("You are on a {} day listening streak.", stats.listening_streak),
            timestamp: now - 1,
        });
    }

    if stats.longest_session > 0 {
        items.push(ActivityFeedItem {
            id: "session".to_string(),
            message: format!("Your longest session lasted {} minutes.", stats.longest_session / 60),
            timestamp: now - 2,
        });
    }

    for achievement in achievements.iter().filter(|item| item.unlocked).take(3) {
        items.push(ActivityFeedItem {
            id: format!("achievement-{}", achievement.achievement_id),
            message: format!("Unlocked achievement: {}", achievement.achievement_id),
            timestamp: achievement.unlocked_at.unwrap_or(now),
        });
    }

    items.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    items.truncate(6);
    items
}

fn recalculate_home_state(conn: &Connection) -> Result<(AggregatedStatsPayload, Vec<UserAchievementPayload>, UserProfilePayload), String> {
    let stats = compute_aggregated_stats(conn)?;
    store_stats_cache(conn, &stats)?;
    let achievements = evaluate_achievements(conn, &stats)?;
    let profile = get_user_profile(conn)?;
    Ok((stats, achievements, profile))
}

fn load_favorites(conn: &Connection) -> Result<Vec<FavoriteItemPayload>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT kind, item_key, title, subtitle, artwork_path, pinned_at FROM favorites ORDER BY pinned_at DESC LIMIT 12",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(FavoriteItemPayload {
                kind: row.get(0)?,
                item_key: row.get(1)?,
                title: row.get(2)?,
                subtitle: row.get(3)?,
                artwork_path: row.get(4)?,
                pinned_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut favorites = Vec::new();
    for row in rows {
        favorites.push(row.map_err(|e| e.to_string())?);
    }
    Ok(favorites)
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
            artwork_path TEXT,
            year INTEGER,
            track_number INTEGER
        )
        "#,
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_tracks_album_artist ON tracks (album_artist)",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_tracks_album_artist_album ON tracks (album_artist, album)",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_tracks_file_path ON tracks (file_path)",
        [],
    )
    .map_err(|e| e.to_string())?;

    ensure_artist_image_table(conn)?;
    ensure_home_tables(conn)?;

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

        let artwork_dir = match get_artwork_dir() {
            Ok(path) => path,
            Err(err) => {
                let _ = app.emit(
                    "scan-progress",
                    ScanProgressPayload {
                        total_found,
                        processed: 0,
                        inserted: 0,
                        failed: 1,
                        current_file: format!("Artwork dir error: {}", err),
                        completed: true,
                    },
                );
                return;
            }
        };

        if artwork_dir.exists() {
            let _ = std::fs::remove_dir_all(&artwork_dir);
            let _ = std::fs::create_dir_all(&artwork_dir);
        }

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

                let result = std::panic::catch_unwind(|| extract_metadata(path, &artwork_dir));
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
                    (file_name, file_path, artwork_path, title, artist, album_artist, album, genre, year, track_number)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
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
                        track.artwork_path,
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

    let query = if limit > 0 {
        r#"
        SELECT file_name, file_path, artwork_path, title, artist, album_artist, album, genre, year, track_number
        FROM tracks
        WHERE (?1 = '' OR album_artist = ?1)
          AND (?2 = '' OR album = ?2)
        ORDER BY album_artist ASC, album ASC, track_number ASC, title ASC
        LIMIT ?3
        "#
    } else {
        r#"
        SELECT file_name, file_path, artwork_path, title, artist, album_artist, album, genre, year, track_number
        FROM tracks
        WHERE (?1 = '' OR album_artist = ?1)
          AND (?2 = '' OR album = ?2)
        ORDER BY album_artist ASC, album ASC, track_number ASC, title ASC
        "#
    };

    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;

    let mut tracks = Vec::new();

    if limit > 0 {
        let rows = stmt
            .query_map(params![artist_filter, album_filter, limit], |row| {
                Ok(TrackRow {
                    file_name: row.get(0)?,
                    file_path: row.get(1)?,
                    artwork_path: row.get(2)?,
                    title: row.get(3)?,
                    artist: row.get(4)?,
                    album_artist: row.get(5)?,
                    album: row.get(6)?,
                    genre: row.get(7)?,
                    year: row.get(8)?,
                    track_number: row.get(9)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            tracks.push(row.map_err(|e| e.to_string())?);
        }
    } else {
        let rows = stmt
            .query_map(params![artist_filter, album_filter], |row| {
                Ok(TrackRow {
                    file_name: row.get(0)?,
                    file_path: row.get(1)?,
                    artwork_path: row.get(2)?,
                    title: row.get(3)?,
                    artist: row.get(4)?,
                    album_artist: row.get(5)?,
                    album: row.get(6)?,
                    genre: row.get(7)?,
                    year: row.get(8)?,
                    track_number: row.get(9)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            tracks.push(row.map_err(|e| e.to_string())?);
        }
    }

    Ok(tracks)
}

#[tauri::command]
fn load_artists() -> Result<Vec<ArtistRow>, String> {
    let db_path = get_database_path()?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    ensure_artist_image_table(&conn)?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT DISTINCT t.album_artist, ai.image_path
            FROM tracks t
            LEFT JOIN artist_images ai
              ON ai.artist_key = lower(trim(t.album_artist))
             AND ai.status = 'ready'
            WHERE TRIM(t.album_artist) <> ''
            ORDER BY t.album_artist COLLATE NOCASE ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ArtistRow {
                name: row.get(0)?,
                image_path: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut artists = Vec::new();

    for row in rows {
        artists.push(row.map_err(|e| e.to_string())?);
    }

    Ok(artists)
}

#[tauri::command]
fn sync_artist_images(
    app: tauri::AppHandle,
    sync_state: State<ArtistImageSyncState>,
) -> Result<(), String> {
    {
        let mut is_running = sync_state
            .0
            .lock()
            .map_err(|_| "Artist image sync lock failed".to_string())?;

        if *is_running {
            return Ok(());
        }

        *is_running = true;
    }

    let app_handle = app.clone();

    thread::spawn(move || {
        let _ = fetch_missing_artist_images(app_handle.clone());

        if let Ok(mut is_running) = app_handle.state::<ArtistImageSyncState>().0.lock() {
            *is_running = false;
        }
    });

    Ok(())
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
fn search_album_art(
    album_artist: String,
    album_title: String,
) -> Result<Vec<AlbumArtCandidate>, String> {
    search_album_art_candidates(&album_artist, &album_title)
}

#[tauri::command]
fn save_album_metadata(
    payload: SaveAlbumMetadataPayload,
) -> Result<SaveAlbumMetadataResult, String> {
    if payload.tracks.is_empty() {
        return Err("No tracks provided for album save.".to_string());
    }

    let cover_art = payload
        .artwork_url
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(download_cover_art)
        .transpose()?;

    let mut failed_files = Vec::new();
    let mut updated_files = 0usize;
    let mut updated_paths = Vec::new();

    for track in &payload.tracks {
        match save_metadata_to_track(track, &payload, cover_art.as_deref()) {
            Ok(()) => {
                updated_files += 1;
                updated_paths.push(track.file_path.clone());
            }
            Err(error) => failed_files.push(error),
        }
    }

    if !updated_paths.is_empty() {
        refresh_saved_tracks_in_db(&updated_paths)?;
    }

    Ok(SaveAlbumMetadataResult {
        updated_album_key: format!("{}__{}", payload.album_artist, payload.album_title),
        updated_files,
        failed_files,
    })
}

#[tauri::command]
fn load_home_data() -> Result<HomeDataPayload, String> {
    let db_path = get_database_path()?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    ensure_home_tables(&conn)?;

    let stats = match load_cached_stats(&conn)? {
        Some(stats) => stats,
        None => {
            let stats = compute_aggregated_stats(&conn)?;
            store_stats_cache(&conn, &stats)?;
            stats
        }
    };

    let achievements = evaluate_achievements(&conn, &stats)?;
    let profile = get_user_profile(&conn)?;
    let favorites = load_favorites(&conn)?;
    let recent_activity = build_recent_activity(&stats, &achievements);
    let mut featured_achievements: Vec<UserAchievementPayload> = achievements
        .iter()
        .filter(|item| item.unlocked)
        .cloned()
        .collect();
    featured_achievements.sort_by(|a, b| b.unlocked_at.cmp(&a.unlocked_at));
    featured_achievements.truncate(6);

    let mut upcoming_achievements: Vec<UserAchievementPayload> = achievements
        .iter()
        .filter(|item| !item.unlocked)
        .cloned()
        .collect();
    upcoming_achievements.sort_by(|a, b| b.progress.cmp(&a.progress));
    upcoming_achievements.truncate(6);

    Ok(HomeDataPayload {
        profile,
        stats,
        achievements,
        featured_achievements,
        upcoming_achievements,
        favorites,
        recent_activity,
    })
}

#[tauri::command]
fn save_user_profile(payload: SaveProfilePayload) -> Result<UserProfilePayload, String> {
    let db_path = get_database_path()?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    ensure_home_tables(&conn)?;
    let now = current_timestamp_secs();
    conn.execute(
        r#"
        UPDATE user_profile
        SET username = ?1,
            avatar_url = ?2,
            background_type = ?3,
            background_url = ?4,
            theme = ?5,
            accent_color = ?6,
            updated_at = ?7
        WHERE id = 'default'
        "#,
        params![
            payload.username.trim(),
            payload.avatar_url,
            payload.background_type,
            payload.background_url,
            payload.theme,
            payload.accent_color,
            now
        ],
    )
    .map_err(|e| e.to_string())?;
    get_user_profile(&conn)
}

#[tauri::command]
fn set_favorite(payload: FavoriteMutationPayload) -> Result<Vec<FavoriteItemPayload>, String> {
    let db_path = get_database_path()?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    ensure_home_tables(&conn)?;
    if payload.pinned {
        conn.execute(
            r#"
            INSERT INTO favorites (kind, item_key, title, subtitle, artwork_path, pinned_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(kind, item_key) DO UPDATE SET
                title = excluded.title,
                subtitle = excluded.subtitle,
                artwork_path = excluded.artwork_path,
                pinned_at = excluded.pinned_at
            "#,
            params![
                payload.kind,
                payload.item_key,
                payload.title,
                payload.subtitle,
                payload.artwork_path,
                current_timestamp_secs()
            ],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "DELETE FROM favorites WHERE kind = ?1 AND item_key = ?2",
            params![payload.kind, payload.item_key],
        )
        .map_err(|e| e.to_string())?;
    }

    load_favorites(&conn)
}

#[tauri::command]
fn record_listening_events(events: Vec<ListeningEventPayload>) -> Result<HomeDataPayload, String> {
    let db_path = get_database_path()?;
    let mut conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    ensure_home_tables(&conn)?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for event in events {
        tx.execute(
            r#"
            INSERT INTO listening_events
                (id, track_id, artist_id, album_id, genre, duration_played, completed, timestamp, playback_source, skipped)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
                track_id = excluded.track_id,
                artist_id = excluded.artist_id,
                album_id = excluded.album_id,
                genre = excluded.genre,
                duration_played = excluded.duration_played,
                completed = excluded.completed,
                timestamp = excluded.timestamp,
                playback_source = excluded.playback_source,
                skipped = excluded.skipped
            "#,
            params![
                event.id,
                event.track_id,
                event.artist_id,
                event.album_id,
                event.genre,
                event.duration_played,
                if event.completed { 1 } else { 0 },
                event.timestamp,
                event.playback_source,
                if event.skipped { 1 } else { 0 }
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;

    let (stats, achievements, profile) = recalculate_home_state(&conn)?;
    let favorites = load_favorites(&conn)?;
    let recent_activity = build_recent_activity(&stats, &achievements);
    let mut featured_achievements: Vec<UserAchievementPayload> = achievements
        .iter()
        .filter(|item| item.unlocked)
        .cloned()
        .collect();
    featured_achievements.sort_by(|a, b| b.unlocked_at.cmp(&a.unlocked_at));
    featured_achievements.truncate(6);

    let mut upcoming_achievements: Vec<UserAchievementPayload> = achievements
        .iter()
        .filter(|item| !item.unlocked)
        .cloned()
        .collect();
    upcoming_achievements.sort_by(|a, b| b.progress.cmp(&a.progress));
    upcoming_achievements.truncate(6);

    Ok(HomeDataPayload {
        profile,
        stats,
        achievements,
        featured_achievements,
        upcoming_achievements,
        favorites,
        recent_activity,
    })
}

#[tauri::command]
fn play_track(
    playback: State<Mutex<PlaybackEngine>>,
    path: String,
    title: String,
    artist: String,
    album: String,
) -> Result<PlaybackStatePayload, String> {
    let path_buf = PathBuf::from(&path);
    let file = File::open(&path_buf).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);
    let decoder = Decoder::try_from(reader)
        .map_err(|e| format!("Failed to decode audio file: {}", e))?;
    let mut duration_secs = decoder
        .total_duration()
        .map(|duration| duration.as_secs_f64())
        .unwrap_or(0.0);

    if duration_secs <= 0.0 {
        duration_secs = fallback_duration_secs(&path_buf);
    }

    let handle = DeviceSinkBuilder::open_default_sink()
        .map_err(|e| format!("Failed to open audio output: {}", e))?;

    let player = Player::connect_new(handle.mixer());
    player.append(decoder);

    let mut state = playback.lock().map_err(|_| "Playback lock failed".to_string())?;
    let volume = if state.volume <= 0.0 { 1.0 } else { state.volume };

    state.clear();
    state.handle = Some(handle);
    state.player = Some(player);
    state.current_path = path;
    state.title = title;
    state.artist = artist;
    state.album = album;
    state.duration_secs = duration_secs;
    state.volume = volume;

    if let Some(player) = state.player.as_ref() {
        player.set_volume(volume);
        player.play();
    }

    Ok(state.to_payload())
}

#[tauri::command]
fn toggle_playback(
    playback: State<Mutex<PlaybackEngine>>,
) -> Result<PlaybackStatePayload, String> {
    let state = playback.lock().map_err(|_| "Playback lock failed".to_string())?;

    let player = match state.player.as_ref() {
        Some(player) => player,
        None => return Ok(state.to_payload()),
    };

    if player.is_paused() {
        player.play();
    } else {
        player.pause();
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

#[tauri::command]
fn load_persisted_session() -> Result<PersistedPlaybackSession, String> {
    read_playback_session()
}

#[tauri::command]
fn save_persisted_session(session: PersistedPlaybackSession) -> Result<(), String> {
    write_playback_session(&session)
}

#[tauri::command]
fn set_playback_volume(
    playback: State<Mutex<PlaybackEngine>>,
    volume: f32,
) -> Result<PlaybackStatePayload, String> {
    let mut state = playback.lock().map_err(|_| "Playback lock failed".to_string())?;
    let clamped = volume.clamp(0.0, 1.0);
    state.volume = clamped;

    if let Some(player) = state.player.as_ref() {
        player.set_volume(clamped);
    }

    Ok(state.to_payload())
}

#[tauri::command]
fn restore_persisted_playback(
    playback: State<Mutex<PlaybackEngine>>,
    payload: RestorePlaybackSessionPayload,
) -> Result<PlaybackStatePayload, String> {
    if payload.current_path.trim().is_empty() {
        let mut state = playback.lock().map_err(|_| "Playback lock failed".to_string())?;
        state.volume = payload.volume.clamp(0.0, 1.0);
        return Ok(state.to_payload());
    }

    let path_buf = PathBuf::from(&payload.current_path);

    if !path_buf.exists() {
        return Err("Saved track could not be found.".to_string());
    }

    let file = File::open(&path_buf).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);
    let decoder = Decoder::try_from(reader)
        .map_err(|e| format!("Failed to decode audio file: {}", e))?;
    let mut duration_secs = decoder
        .total_duration()
        .map(|duration| duration.as_secs_f64())
        .unwrap_or(0.0);

    if duration_secs <= 0.0 {
        duration_secs = fallback_duration_secs(&path_buf);
    }

    let handle = DeviceSinkBuilder::open_default_sink()
        .map_err(|e| format!("Failed to open audio output: {}", e))?;

    let player = Player::connect_new(handle.mixer());
    player.append(decoder);

    let restore_position = payload.position_secs.clamp(0.0, duration_secs.max(0.0));
    if restore_position > 0.0 {
        player
            .try_seek(Duration::from_secs_f64(restore_position))
            .map_err(|e| format!("Seek failed: {}", e))?;
    }

    let volume = payload.volume.clamp(0.0, 1.0);
    player.set_volume(volume);

    if payload.resume_playback {
        player.play();
    } else {
        player.pause();
    }

    let mut state = playback.lock().map_err(|_| "Playback lock failed".to_string())?;
    state.clear();
    state.handle = Some(handle);
    state.player = Some(player);
    state.current_path = payload.current_path;
    state.title = payload.title;
    state.artist = payload.artist;
    state.album = payload.album;
    state.duration_secs = duration_secs;
    state.volume = volume;

    Ok(state.to_payload())
}

#[tauri::command]
fn seek_playback(
    playback: State<Mutex<PlaybackEngine>>,
    position_secs: f64,
) -> Result<PlaybackStatePayload, String> {
    let state = playback.lock().map_err(|_| "Playback lock failed".to_string())?;
    let player = match state.player.as_ref() {
        Some(player) => player,
        None => return Ok(state.to_payload()),
    };

    let position = Duration::from_secs_f64(position_secs.max(0.0));
    player
        .try_seek(position)
        .map_err(|e| format!("Seek failed: {}", e))?;

    Ok(state.to_payload())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(PlaybackEngine::default()))
        .manage(ArtistImageSyncState(Mutex::new(false)))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            start_scan,
            load_tracks,
            load_artists,
            load_albums,
            sync_artist_images,
            search_album_art,
            save_album_metadata,
            load_home_data,
            save_user_profile,
            set_favorite,
            record_listening_events,
            play_track,
            toggle_playback,
            stop_playback,
            get_playback_state,
            load_persisted_session,
            save_persisted_session,
            set_playback_volume,
            restore_persisted_playback,
            seek_playback
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
