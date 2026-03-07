import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import "./App.css";

type TrackRow = {
  file_name: string;
  file_path: string;
  title: string;
  artist: string;
  album_artist: string;
  album: string;
  genre: string;
  year: number | null;
  track_number: number | null;
};

type ArtistRow = {
  name: string;
};

type AlbumRow = {
  name: string;
  album_artist: string;
  year: number | null;
};

type ScanProgressPayload = {
  total_found: number;
  processed: number;
  inserted: number;
  failed: number;
  current_file: string;
  completed: boolean;
};

type PlaybackStatePayload = {
  is_playing: boolean;
  current_path: string;
  title: string;
  artist: string;
  album: string;
};

function App() {
  const [folderPath, setFolderPath] = useState("");
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [selectedArtist, setSelectedArtist] = useState("");
  const [selectedAlbum, setSelectedAlbum] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgressPayload | null>(null);
  const [playback, setPlayback] = useState<PlaybackStatePayload>({
    is_playing: false,
    current_path: "",
    title: "",
    artist: "",
    album: "",
  });
  const reloadCounter = useRef(0);

  async function loadTracks(limit = 500, artist = "", album = "") {
    const rows = await invoke<TrackRow[]>("load_tracks", {
      limit,
      artist: artist || null,
      album: album || null,
    });

    setTracks(rows);
    return rows;
  }

  async function loadArtists() {
    const rows = await invoke<ArtistRow[]>("load_artists");
    setArtists(rows);
    return rows;
  }

  async function loadAlbums(artist = "") {
    const rows = await invoke<AlbumRow[]>("load_albums", {
      artist: artist || null,
    });

    setAlbums(rows);
    return rows;
  }

  async function refreshLibraryView(artist = "", album = "") {
    await Promise.all([
      loadArtists(),
      loadAlbums(artist),
      loadTracks(500, artist, album),
    ]);
  }

  async function refreshPlaybackState() {
    const state = await invoke<PlaybackStatePayload>("get_playback_state");
    setPlayback(state);
  }

  useEffect(() => {
    refreshLibraryView()
      .then(() => {
        setStatus("Library loaded.");
      })
      .catch(() => {
        setStatus("No existing library found yet. Scan a folder to begin.");
      });

    refreshPlaybackState().catch(() => {
      // ignore startup playback errors
    });
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<ScanProgressPayload>(
        "scan-progress",
        async (event) => {
          const payload = event.payload;
          setProgress(payload);

          if (payload.completed) {
            await refreshLibraryView(selectedArtist, selectedAlbum);
            setStatus(
              `Done. Processed ${payload.processed}/${payload.total_found}, inserted ${payload.inserted}, failed ${payload.failed}.`
            );
            setIsScanning(false);
            return;
          }

          setStatus(
            `Scanning... ${payload.processed}/${payload.total_found} processed, ${payload.inserted} inserted, ${payload.failed} failed.`
          );

          reloadCounter.current += 1;

          if (reloadCounter.current % 3 === 0) {
            await refreshLibraryView(selectedArtist, selectedAlbum);
          }
        }
      );
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [selectedArtist, selectedAlbum]);

  useEffect(() => {
    loadAlbums(selectedArtist);
    loadTracks(500, selectedArtist, selectedAlbum);
  }, [selectedArtist, selectedAlbum]);

  async function chooseFolderAndScan() {
    try {
      setStatus("Choosing folder...");

      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (!selected || Array.isArray(selected)) {
        setStatus("Folder selection cancelled.");
        return;
      }

      setFolderPath(selected);
      setSelectedArtist("");
      setSelectedAlbum("");
      setTracks([]);
      setArtists([]);
      setAlbums([]);
      setProgress({
        total_found: 0,
        processed: 0,
        inserted: 0,
        failed: 0,
        current_file: "",
        completed: false,
      });
      reloadCounter.current = 0;
      setIsScanning(true);
      setStatus("Starting background scan...");

      await invoke("start_scan", { path: selected });
    } catch (error) {
      console.error(error);
      setStatus(`Error: ${String(error)}`);
      setIsScanning(false);
    }
  }

  async function handlePlayTrack(track: TrackRow) {
    try {
      const state = await invoke<PlaybackStatePayload>("play_track", {
        path: track.file_path,
        title: track.title,
        artist: track.artist,
        album: track.album,
      });

      setPlayback(state);
      setStatus(`Playing: ${track.title}`);
    } catch (error) {
      console.error(error);
      setStatus(`Playback error: ${String(error)}`);
    }
  }

  async function handleTogglePlayback() {
    try {
      const state = await invoke<PlaybackStatePayload>("toggle_playback");
      setPlayback(state);
    } catch (error) {
      console.error(error);
      setStatus(`Playback error: ${String(error)}`);
    }
  }

  async function handleStopPlayback() {
    try {
      const state = await invoke<PlaybackStatePayload>("stop_playback");
      setPlayback(state);
    } catch (error) {
      console.error(error);
      setStatus(`Playback error: ${String(error)}`);
    }
  }

  const percent =
    progress && progress.total_found > 0
      ? Math.round((progress.processed / progress.total_found) * 100)
      : 0;

  return (
    <div className="app-shell">
      <div className="app">
        <header className="topbar">
          <div>
            <h1>Qwaan Music Player</h1>
            <p className="subtle">Local-first music library for Windows</p>
          </div>

          <div className="topbar-actions">
            <button onClick={chooseFolderAndScan} disabled={isScanning}>
              {isScanning ? "Scanning..." : "Choose Folder & Scan"}
            </button>
          </div>
        </header>

        <div className="status-block">
          <p>
            <strong>Status:</strong> {status}
          </p>
          <p>
            <strong>Folder:</strong> {folderPath || "No folder selected this session"}
          </p>
          <p>
            <strong>Selected:</strong> {selectedArtist || "All Album Artists"} /{" "}
            {selectedAlbum || "All Albums"}
          </p>
        </div>

        {progress && (
          <div className="scan-panel">
            <div className="progress-meta">
              <div>
                <strong>Processed:</strong> {progress.processed} / {progress.total_found}
              </div>
              <div>
                <strong>Inserted:</strong> {progress.inserted}
              </div>
              <div>
                <strong>Failed:</strong> {progress.failed}
              </div>
              <div>
                <strong>Progress:</strong> {percent}%
              </div>
            </div>

            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>

            <p className="current-file">
              <strong>Current file:</strong> {progress.current_file || "Waiting..."}
            </p>
          </div>
        )}

        <div className="library-layout">
          <section className="panel list-panel">
            <div className="panel-header">
              <h2>Album Artists</h2>
              <button
                className={!selectedArtist ? "small-button active" : "small-button"}
                onClick={() => {
                  setSelectedArtist("");
                  setSelectedAlbum("");
                }}
              >
                All Album Artists
              </button>
            </div>

            <div className="list-scroll">
              {artists.map((artist) => (
                <button
                  key={artist.name}
                  className={selectedArtist === artist.name ? "list-item active" : "list-item"}
                  onClick={() => {
                    setSelectedArtist(artist.name);
                    setSelectedAlbum("");
                  }}
                >
                  {artist.name}
                </button>
              ))}
            </div>
          </section>

          <section className="panel list-panel">
            <div className="panel-header">
              <h2>Albums</h2>
              <button
                className={!selectedAlbum ? "small-button active" : "small-button"}
                onClick={() => setSelectedAlbum("")}
              >
                All Albums
              </button>
            </div>

            <div className="list-scroll">
              {albums.map((album) => (
                <button
                  key={`${album.album_artist}__${album.name}`}
                  className={selectedAlbum === album.name ? "list-item active" : "list-item"}
                  onClick={() => setSelectedAlbum(album.name)}
                >
                  <span className="primary">{album.name}</span>
                  <span className="secondary">
                    {album.album_artist}
                    {album.year ? ` • ${album.year}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel track-panel">
            <div className="panel-header">
              <h2>Tracks</h2>
              <span className="track-count">{tracks.length} shown</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Play</th>
                    <th>Track</th>
                    <th>Title</th>
                    <th>Artist</th>
                    <th>Album</th>
                    <th>Genre</th>
                    <th>Year</th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((track) => {
                    const isCurrent = playback.current_path === track.file_path;

                    return (
                      <tr
                        key={track.file_path}
                        className={isCurrent ? "track-row current-track" : "track-row"}
                      >
                        <td>
                          <button
                            className="play-cell-button"
                            onClick={() => handlePlayTrack(track)}
                            title={`Play ${track.title}`}
                          >
                            ▶
                          </button>
                        </td>
                        <td>{track.track_number ?? ""}</td>
                        <td
                          className="clickable-title"
                          onClick={() => handlePlayTrack(track)}
                        >
                          {track.title}
                        </td>
                        <td>{track.artist}</td>
                        <td>{track.album}</td>
                        <td>{track.genre}</td>
                        <td>{track.year ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <footer className="player-bar">
        <div className="player-meta">
          <div className="player-title">
            {playback.title || "Nothing playing"}
          </div>
          <div className="player-subtitle">
            {playback.artist || "—"}
            {playback.album ? ` • ${playback.album}` : ""}
          </div>
        </div>

        <div className="player-controls">
          <button
            onClick={handleTogglePlayback}
            disabled={!playback.current_path}
          >
            {playback.is_playing ? "Pause" : "Play"}
          </button>
          <button
            onClick={handleStopPlayback}
            disabled={!playback.current_path}
          >
            Stop
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;