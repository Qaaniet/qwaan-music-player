import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { AlbumGrid } from "./components/AlbumGrid";
import { AlbumDetailsView } from "./components/AlbumDetailsView";
import { ArtistDetailsView } from "./components/ArtistDetailsView";
import { ArtistGrid } from "./components/ArtistGrid";
import { GenreDetailsView } from "./components/GenreDetailsView";
import { GenreGrid } from "./components/GenreGrid";
import { HomePage, type HomeWidgetId } from "./components/HomePage";
import { PlayerBar } from "./components/PlayerBar";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
import { SongTable } from "./components/SongTable";
import { StickySectionNav } from "./components/StickySectionNav";
import { TopBar } from "./components/TopBar";
import { WindowChrome } from "./components/WindowChrome";
import { extractAccentFromArtwork } from "./lib/artworkAccent";
import {
  buildAlbumSummaries,
  buildGenreSummaries,
  filterGenres,
  filterAlbums,
  filterArtists,
  filterTracks,
  groupAlbumsByInitial,
  groupArtistsByInitial,
  groupGenresByInitial,
  sortAlbums,
  sortTracks,
} from "./lib/library";
import {
  type AppPreferences,
  createDefaultPreferences,
  createProfileFromCurrent,
  getDensityScale,
  getMotionDuration,
  hexToRgbString,
  loadPreferences,
  mixHexColors,
  savePreferences,
  withIntensity,
} from "./lib/personalization";
import { normalizeGenre } from "./lib/genres";
import type {
  AlbumRow,
  AlbumSummary,
  AppPage,
  ArtistRow,
  FavoriteMutationPayload,
  HomeDataPayload,
  LibraryView,
  ListeningEvent,
  PlaybackStatePayload,
  PersistedPlaybackSession,
  SaveAlbumMetadataPayload,
  SaveAlbumMetadataResult,
  SaveProfilePayload,
  ScanProgressPayload,
  TrackRow,
  UserProfile,
} from "./types";
import "./App.css";

type ArtistImagePayload = {
  name: string;
  image_path: string;
};

type LibraryReturnTarget = {
  view: "albums" | "artists";
  section: string;
};

type NavigationSnapshot = {
  page: AppPage;
  view: LibraryView;
  selectedAlbumKey: string | null;
  selectedArtistDetailsName: string | null;
  selectedGenreDetailsName: string | null;
};

type ActiveListeningSession = {
  eventId: string;
  trackPath: string;
  artistId: string;
  albumId: string;
  genre: string;
  startPosition: number;
  maxPosition: number;
  durationHint: number;
};

const DEFAULT_HOME_WIDGET_ORDER: HomeWidgetId[] = [
  "profile",
  "stats",
  "achievements",
  "favorites",
  "activity",
];

function shuffleTracks(tracks: TrackRow[]) {
  const copy = [...tracks];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function App() {
  const [preferences, setPreferences] = useState<AppPreferences>(() => createDefaultPreferences());
  const [resolvedAccent, setResolvedAccent] = useState("#7fb3ff");
  const [page, setPage] = useState<AppPage>("home");
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [homeData, setHomeData] = useState<HomeDataPayload | null>(null);
  const [homeWidgetOrder, setHomeWidgetOrder] = useState<HomeWidgetId[]>(DEFAULT_HOME_WIDGET_ORDER);
  const [status, setStatus] = useState("Ready");
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgressPayload | null>(null);
  const [playback, setPlayback] = useState<PlaybackStatePayload>({
    is_playing: false,
    ended: false,
    current_path: "",
    title: "",
    artist: "",
    album: "",
    position_secs: 0,
    duration_secs: 0,
    volume: 1,
  });
  const [currentQueue, setCurrentQueue] = useState<TrackRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [view, setView] = useState<LibraryView>("albums");
  const [selectedAlbumKey, setSelectedAlbumKey] = useState<string | null>(null);
  const [selectedArtistDetailsName, setSelectedArtistDetailsName] = useState<string | null>(null);
  const [selectedGenreDetailsName, setSelectedGenreDetailsName] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy] = useState<"A-Z" | "Recently added">("A-Z");
  const [selectedGenre] = useState("All genres");
  const reloadCounter = useRef(0);
  const completedTrackRef = useRef("");
  const progressHideTimeoutRef = useRef<number | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const windowChromeRef = useRef<HTMLDivElement | null>(null);
  const topHeaderRef = useRef<HTMLDivElement | null>(null);
  const playerBarRef = useRef<HTMLDivElement | null>(null);
  const libraryReturnSectionsRef = useRef<{
    albums: string;
    artists: string;
  }>({
    albums: "&",
    artists: "&",
  });
  const pendingScrollRestoreRef = useRef<LibraryReturnTarget | null>(null);
  const isRestoringScrollRef = useRef(false);
  const albumSectionRefs = useRef(new Map<string, HTMLElement>());
  const artistSectionRefs = useRef(new Map<string, HTMLElement>());
  const [activeAlbumSection, setActiveAlbumSection] = useState("&");
  const [activeArtistSection, setActiveArtistSection] = useState("&");
  const activeAlbumSectionRef = useRef("&");
  const activeArtistSectionRef = useRef("&");
  const [hiddenLibraryView, setHiddenLibraryView] = useState<"albums" | "artists" | null>(null);
  const [shellInsets, setShellInsets] = useState({ top: 112, bottom: 124 });
  const hasLoadedSessionRef = useRef(false);
  const lastSavedSessionRef = useRef("");
  const playbackRef = useRef(playback);
  const activeListeningSessionRef = useRef<ActiveListeningSession | null>(null);
  const lastNavigationSnapshotRef = useRef<NavigationSnapshot | null>(null);
  const backHistoryRef = useRef<NavigationSnapshot[]>([]);
  const forwardHistoryRef = useRef<NavigationSnapshot[]>([]);
  const suppressHistoryRef = useRef(false);
  const [libraryLocations, setLibraryLocations] = useState<string[]>([]);

  const isAlbumsLibraryView = view === "albums" && !selectedAlbumKey && !selectedArtistDetailsName;
  const isArtistsLibraryView = view === "artists" && !selectedAlbumKey && !selectedArtistDetailsName;

  async function loadTracks(limit: number | null = null, artist = "", album = "") {
    const rows = await invoke<TrackRow[]>("load_tracks", {
      limit: limit ?? 0,
      artist: artist || null,
      album: album || null,
    });

    const normalizedRows = rows.map((row) => ({
      ...row,
      genre: normalizeGenre(row.genre),
    }));

    setTracks(normalizedRows);
    return normalizedRows;
  }

  async function loadArtists() {
    const rows = await invoke<ArtistRow[]>("load_artists");
    setArtists(rows);
    void invoke("sync_artist_images").catch(() => {
      // ignore background image sync errors
    });
    return rows;
  }

  async function loadAlbums(artist = "") {
    const rows = await invoke<AlbumRow[]>("load_albums", {
      artist: artist || null,
    });

    setAlbums(rows);
    return rows;
  }

  async function refreshLibraryView() {
    await Promise.all([
      loadArtists(),
      loadAlbums(),
      loadTracks(null),
    ]);
  }

  async function refreshPlaybackState() {
    const state = await invoke<PlaybackStatePayload>("get_playback_state");
    setPlayback((current) => (
      current.is_playing === state.is_playing &&
      current.ended === state.ended &&
      current.current_path === state.current_path &&
      current.title === state.title &&
      current.artist === state.artist &&
      current.album === state.album &&
      current.position_secs === state.position_secs &&
      current.duration_secs === state.duration_secs &&
      current.volume === state.volume
    ) ? current : state);
    return state;
  }

  const restoreQueueFromSession = useCallback((
    session: PersistedPlaybackSession,
    libraryTracks: TrackRow[],
  ) => {
    const trackByPath = new Map(libraryTracks.map((track) => [track.file_path, track]));
    const restoredQueue = session.queue_paths
      .map((path) => trackByPath.get(path))
      .filter((track): track is TrackRow => Boolean(track));

    const fallbackTrack = trackByPath.get(session.current_path);
    const queue =
      restoredQueue.length > 0
        ? restoredQueue
        : fallbackTrack
          ? [fallbackTrack]
          : [];

    const currentIndex =
      queue.length > 0
        ? Math.max(
            0,
            queue.findIndex((track) => track.file_path === session.current_path),
          )
        : -1;

    return {
      queue,
      currentIndex: queue.length > 0 ? currentIndex : -1,
      currentTrack: currentIndex >= 0 ? queue[currentIndex] : null,
    };
  }, []);

  const persistSessionNow = useCallback(async (session: PersistedPlaybackSession) => {
    const serialized = JSON.stringify(session);

    if (lastSavedSessionRef.current === serialized) {
      return;
    }

    await invoke("save_persisted_session", { session });
    lastSavedSessionRef.current = serialized;
  }, []);

  const registerLibraryLocation = useCallback((path: string) => {
    setLibraryLocations((current) => (
      current.includes(path) ? current : [...current, path]
    ));
  }, []);

  const refreshHomeData = useCallback(async () => {
    const payload = await invoke<HomeDataPayload>("load_home_data");
    setHomeData(payload);
    return payload;
  }, []);

  const moveHomeWidget = useCallback((widgetId: HomeWidgetId, direction: -1 | 1) => {
    setHomeWidgetOrder((current) => {
      const index = current.indexOf(widgetId);
      const targetIndex = index + direction;

      if (index === -1 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  const handleSaveHomeProfile = useCallback(async (payload: SaveProfilePayload) => {
    const profile = await invoke<UserProfile>("save_user_profile", { payload });
    setHomeData((current) => (current ? { ...current, profile } : current));
    setStatus("Profile updated.");
  }, []);

  const handleToggleFavorite = useCallback(async (payload: FavoriteMutationPayload) => {
    const favorites = await invoke<HomeDataPayload["favorites"]>("set_favorite", { payload });
    setHomeData((current) => (current ? { ...current, favorites } : current));
  }, []);

  const applyNavigationSnapshot = useCallback((snapshot: NavigationSnapshot) => {
    suppressHistoryRef.current = true;
    setPage(snapshot.page);
    setView(snapshot.view);
    setSelectedAlbumKey(snapshot.selectedAlbumKey);
    setSelectedArtistDetailsName(snapshot.selectedArtistDetailsName);
    setSelectedGenreDetailsName(snapshot.selectedGenreDetailsName);
  }, []);

  const navigateBack = useCallback(() => {
    const previous = backHistoryRef.current.pop();
    const current = lastNavigationSnapshotRef.current;

    if (!previous || !current) {
      return;
    }

    forwardHistoryRef.current.push(current);
    if (
      previous.page === "library" &&
      !previous.selectedAlbumKey &&
      !previous.selectedArtistDetailsName &&
      (previous.view === "albums" || previous.view === "artists")
    ) {
      pendingScrollRestoreRef.current = {
        view: previous.view,
        section: libraryReturnSectionsRef.current[previous.view],
      };
      setHiddenLibraryView(previous.view);
    }
    applyNavigationSnapshot(previous);
  }, [applyNavigationSnapshot]);

  const navigateForward = useCallback(() => {
    const next = forwardHistoryRef.current.pop();
    const current = lastNavigationSnapshotRef.current;

    if (!next || !current) {
      return;
    }

    backHistoryRef.current.push(current);
    if (
      next.page === "library" &&
      !next.selectedAlbumKey &&
      !next.selectedArtistDetailsName &&
      (next.view === "albums" || next.view === "artists")
    ) {
      pendingScrollRestoreRef.current = {
        view: next.view,
        section: libraryReturnSectionsRef.current[next.view],
      };
      setHiddenLibraryView(next.view);
    }
    applyNavigationSnapshot(next);
  }, [applyNavigationSnapshot]);

  const patchPreferences = useCallback((updater: (current: AppPreferences) => AppPreferences) => {
    setPreferences((current) => updater(current));
  }, []);

  const updateAppearance = useCallback((patch: Partial<AppPreferences["appearance"]>) => {
    patchPreferences((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        ...patch,
      },
    }));
  }, [patchPreferences]);

  const updatePlaybackCustomization = useCallback((patch: Partial<AppPreferences["playback"]>) => {
    patchPreferences((current) => ({
      ...current,
      playback: {
        ...current.playback,
        ...patch,
      },
    }));
  }, [patchPreferences]);

  const updateAudioCustomization = useCallback((patch: Partial<AppPreferences["audio"]>) => {
    patchPreferences((current) => ({
      ...current,
      audio: {
        ...current.audio,
        ...patch,
      },
    }));
  }, [patchPreferences]);

  const updateLayoutCustomization = useCallback((patch: Partial<AppPreferences["layout"]>) => {
    patchPreferences((current) => ({
      ...current,
      layout: {
        ...current.layout,
        ...patch,
      },
    }));
  }, [patchPreferences]);

  const updateLibraryCustomization = useCallback((patch: Partial<AppPreferences["library"]>) => {
    patchPreferences((current) => ({
      ...current,
      library: {
        ...current.library,
        ...patch,
      },
    }));
  }, [patchPreferences]);

  const updateAdvancedCustomization = useCallback((patch: Partial<AppPreferences["advanced"]>) => {
    patchPreferences((current) => ({
      ...current,
      advanced: {
        ...current.advanced,
        ...patch,
      },
    }));
  }, [patchPreferences]);

  const resetAppearance = useCallback(() => {
    updateAppearance(createDefaultPreferences().appearance);
  }, [updateAppearance]);

  const resetPlaybackCustomization = useCallback(() => {
    updatePlaybackCustomization(createDefaultPreferences().playback);
  }, [updatePlaybackCustomization]);

  const resetAudioCustomization = useCallback(() => {
    updateAudioCustomization(createDefaultPreferences().audio);
  }, [updateAudioCustomization]);

  const resetAdvancedCustomization = useCallback(() => {
    updateAdvancedCustomization(createDefaultPreferences().advanced);
  }, [updateAdvancedCustomization]);

  const applyProfile = useCallback(async (profileId: string) => {
    const profile = preferences.profiles.find((item) => item.id === profileId);
    if (!profile) {
      return;
    }

    setPreferences((current) => ({
      ...current,
      activeProfileId: profileId,
      appearance: { ...profile.appearance },
      playback: { ...profile.playback },
      audio: {
        ...profile.audio,
        customEqBands: [...profile.audio.customEqBands],
      },
      layout: {
        ...current.layout,
        activePresetId: profile.layoutPresetId,
        activeMode:
          current.layout.presets.find((preset) => preset.id === profile.layoutPresetId)?.mode ??
          current.layout.activeMode,
      },
    }));

    const matchingPreset = preferences.layout.presets.find((preset) => preset.id === profile.layoutPresetId);
    if (matchingPreset) {
      setSidebarOpen(!matchingPreset.sidebarCollapsed);
    }
    setShuffleEnabled(profile.shuffleEnabled);
    setRepeatEnabled(profile.repeatEnabled);
    try {
      const state = await invoke<PlaybackStatePayload>("set_playback_volume", { volume: profile.volume });
      setPlayback(state);
    } catch {
      // ignore volume restoration errors during profile apply
    }
    setStatus(`Profile applied: ${profile.name}`);
  }, [preferences.profiles]);

  const createProfile = useCallback(() => {
    const nextProfile = createProfileFromCurrent(
      preferences,
      `Custom ${preferences.profiles.length + 1}`,
      playback.volume,
      shuffleEnabled,
      repeatEnabled,
    );

    setPreferences((current) => ({
      ...current,
      activeProfileId: nextProfile.id,
      profiles: [...current.profiles, nextProfile],
    }));
    setStatus(`Created profile: ${nextProfile.name}`);
  }, [playback.volume, preferences, repeatEnabled, shuffleEnabled]);

  const duplicateProfile = useCallback((profileId: string) => {
    const original = preferences.profiles.find((profile) => profile.id === profileId);
    if (!original) {
      return;
    }

    const duplicate = {
      ...original,
      id: `profile-${crypto.randomUUID()}`,
      name: `${original.name} Copy`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPreferences((current) => ({
      ...current,
      activeProfileId: duplicate.id,
      profiles: [...current.profiles, duplicate],
    }));
  }, [preferences.profiles]);

  const deleteProfile = useCallback((profileId: string) => {
    setPreferences((current) => {
      const remaining = current.profiles.filter((profile) => profile.id !== profileId);
      const safeProfiles = remaining.length > 0 ? remaining : current.profiles;
      return {
        ...current,
        activeProfileId: safeProfiles[0]?.id ?? current.activeProfileId,
        profiles: safeProfiles,
      };
    });
  }, []);

  const renameProfile = useCallback((profileId: string, name: string) => {
    setPreferences((current) => ({
      ...current,
      profiles: current.profiles.map((profile) => (
        profile.id === profileId
          ? {
              ...profile,
              name,
              updatedAt: new Date().toISOString(),
            }
          : profile
      )),
    }));
  }, []);

  const saveCurrentToProfile = useCallback((profileId: string) => {
    setPreferences((current) => ({
      ...current,
      profiles: current.profiles.map((profile) => (
        profile.id === profileId
          ? {
              ...profile,
              appearance: { ...current.appearance },
              playback: { ...current.playback },
              audio: {
                ...current.audio,
                customEqBands: [...current.audio.customEqBands],
              },
              layoutPresetId: current.layout.activePresetId,
              volume: playback.volume,
              shuffleEnabled,
              repeatEnabled,
              updatedAt: new Date().toISOString(),
            }
          : profile
      )),
    }));
    setStatus("Saved current setup to profile.");
  }, [playback.volume, repeatEnabled, shuffleEnabled]);

  const updateLayoutPreset = useCallback((presetId: string) => {
    const preset = preferences.layout.presets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setSidebarOpen(!preset.sidebarCollapsed);
    updateLayoutCustomization({
      activePresetId: preset.id,
      activeMode: preset.mode,
    });
  }, [preferences.layout.presets, updateLayoutCustomization]);

  const handleSaveAlbumMetadata = useCallback(async (
    payload: SaveAlbumMetadataPayload,
  ) => {
    const result = await invoke<SaveAlbumMetadataResult>("save_album_metadata", { payload });

    await refreshLibraryView();
    setSelectedAlbumKey(result.updated_album_key);

    if (result.failed_files.length > 0) {
      setStatus(
        `Saved metadata to ${result.updated_files.length} file(s); ${result.failed_files.length} failed.`,
      );
    } else {
      setStatus(`Saved metadata to ${result.updated_files.length} file(s).`);
    }

    return result;
  }, []);

  useEffect(() => {
    try {
      const loadedPreferences = loadPreferences();
      const savedLibraryLocations = window.localStorage.getItem("qwaan.libraryLocations");
      const savedWidgetOrder = window.localStorage.getItem("qwaan.homeWidgetOrder");

      setPreferences(loadedPreferences);
      setResolvedAccent(loadedPreferences.appearance.manualAccent);

      if (savedLibraryLocations) {
        const parsed = JSON.parse(savedLibraryLocations);
        if (Array.isArray(parsed)) {
          setLibraryLocations(parsed.filter((value): value is string => typeof value === "string"));
        }
      }

      if (savedWidgetOrder) {
        const parsed = JSON.parse(savedWidgetOrder);
        if (Array.isArray(parsed)) {
          const nextOrder = parsed.filter((value): value is HomeWidgetId =>
            DEFAULT_HOME_WIDGET_ORDER.includes(value as HomeWidgetId),
          );
          if (nextOrder.length === DEFAULT_HOME_WIDGET_ORDER.length) {
            setHomeWidgetOrder(nextOrder);
          }
        }
      }
    } catch {
      // ignore malformed local settings
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("qwaan.libraryLocations", JSON.stringify(libraryLocations));
  }, [libraryLocations]);

  useEffect(() => {
    window.localStorage.setItem("qwaan.homeWidgetOrder", JSON.stringify(homeWidgetOrder));
  }, [homeWidgetOrder]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const loadedPreferences = loadPreferences();
        setPreferences(loadedPreferences);
        const [session] = await Promise.all([
          invoke<PersistedPlaybackSession>("load_persisted_session"),
          refreshHomeData().catch(() => null),
        ]);

        const [loadedArtists, loadedAlbums, loadedTracks] = await Promise.all([
          loadArtists(),
          loadAlbums(),
          loadTracks(null),
        ]);

        void loadedArtists;
        void loadedAlbums;

        const nextView =
          session.view === "songs" ||
          session.view === "albums" ||
          session.view === "artists" ||
          session.view === "genres"
            ? session.view
            : "albums";

        setView(nextView);
        setShuffleEnabled(Boolean(session.shuffle_enabled));
        setRepeatEnabled(Boolean(session.repeat_enabled));

        const volume = Number.isFinite(session.volume)
          ? Math.min(1, Math.max(0.01, session.volume))
          : 1;
        const volumeState = await invoke<PlaybackStatePayload>("set_playback_volume", { volume });
        setPlayback(volumeState);

        const { queue, currentIndex, currentTrack } = restoreQueueFromSession(session, loadedTracks);
        setCurrentQueue(queue);
        setCurrentIndex(currentIndex);

        if (currentTrack && loadedPreferences.playback.resumeLastSession) {
          try {
            const restored = await invoke<PlaybackStatePayload>("restore_persisted_playback", {
              payload: {
                current_path: currentTrack.file_path,
                title: currentTrack.title,
                artist: currentTrack.artist,
                album: currentTrack.album,
                position_secs: session.position_secs,
                volume,
                resume_playback: false,
              },
            });

            setPlayback(restored);
            setStatus(
              session.was_playing
                ? `Restored ${currentTrack.title} from your previous session.`
                : "Previous session restored.",
            );
          } catch {
            setPlayback((current) => ({
              ...current,
              current_path: "",
              title: "",
              artist: "",
              album: "",
              position_secs: 0,
              duration_secs: 0,
              is_playing: false,
              ended: false,
            }));
            setStatus("Previous track was not available. Library loaded.");
          }
        } else {
          setStatus("Library loaded.");
        }
      } catch {
        try {
          await Promise.all([refreshLibraryView(), refreshHomeData().catch(() => null)]);
          await refreshPlaybackState();
          setStatus("Library loaded.");
        } catch {
          setStatus("No existing library found yet. Scan a folder to begin.");
        }
      } finally {
        hasLoadedSessionRef.current = true;
      }
    };

    void initializeApp();
  }, [refreshHomeData, restoreQueueFromSession]);

  useEffect(() => {
    if (!playback.current_path) {
      completedTrackRef.current = "";
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const state = await refreshPlaybackState();

        if (state.ended && completedTrackRef.current !== state.current_path) {
          completedTrackRef.current = state.current_path;
          await handleNextTrack(true);
        }
      } catch {
        // ignore polling errors
      }
    }, 500);

    return () => window.clearInterval(interval);
  }, [playback.current_path, currentIndex, currentQueue, repeatEnabled]);

  useEffect(() => {
    if (progressHideTimeoutRef.current) {
      window.clearTimeout(progressHideTimeoutRef.current);
      progressHideTimeoutRef.current = null;
    }

    if (!progress?.completed) {
      return;
    }

    progressHideTimeoutRef.current = window.setTimeout(() => {
      setProgress((current) => (current?.completed ? null : current));
      progressHideTimeoutRef.current = null;
    }, 1800);

    return () => {
      if (progressHideTimeoutRef.current) {
        window.clearTimeout(progressHideTimeoutRef.current);
        progressHideTimeoutRef.current = null;
      }
    };
  }, [progress]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<ScanProgressPayload>("scan-progress", async (event) => {
        const payload = event.payload;
        setProgress(payload);

        if (payload.completed) {
          await Promise.all([refreshLibraryView(), refreshHomeData().catch(() => null)]);
          setStatus(
            `Done. Processed ${payload.processed}/${payload.total_found}, inserted ${payload.inserted}, failed ${payload.failed}.`,
          );
          setIsScanning(false);
          return;
        }

        setStatus(
          `Scanning... ${payload.processed}/${payload.total_found} processed, ${payload.inserted} inserted, ${payload.failed} failed.`,
        );

        reloadCounter.current += 1;

        if (reloadCounter.current % 3 === 0) {
          await refreshLibraryView();
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [refreshHomeData]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<ArtistImagePayload>("artist-image-updated", (event) => {
        const payload = event.payload;

        startTransition(() => {
          setArtists((current) =>
            current.map((artist) =>
              artist.name === payload.name
                ? { ...artist, image_path: payload.image_path }
                : artist,
            ),
          );
        });
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

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

      registerLibraryLocation(selected);
      setPage("library");

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

  const handleRefreshLibrary = useCallback(async () => {
    try {
      setStatus("Refreshing library...");
      await Promise.all([refreshLibraryView(), refreshPlaybackState(), refreshHomeData().catch(() => null)]);
      setStatus("Library refreshed.");
    } catch (error) {
      console.error(error);
      setStatus(`Refresh error: ${String(error)}`);
    }
  }, [refreshHomeData]);

  const currentAlbumKey = useMemo(() => {
    if (!playback.current_path) {
      return "";
    }

    const currentTrack = tracks.find((track) => track.file_path === playback.current_path);
    return currentTrack ? `${currentTrack.album_artist}__${currentTrack.album}` : "";
  }, [playback.current_path, tracks]);
  const currentTrack = useMemo(
    () => tracks.find((track) => track.file_path === playback.current_path) ?? null,
    [playback.current_path, tracks],
  );
  const persistedSessionSnapshot = useMemo<PersistedPlaybackSession>(() => ({
    current_path: playback.current_path,
    title: playback.title,
    artist: playback.artist,
    album: playback.album,
    position_secs: playback.position_secs,
    volume: Number.isFinite(playback.volume) ? Math.min(1, Math.max(0.01, playback.volume)) : 1,
    was_playing: playback.is_playing,
    shuffle_enabled: shuffleEnabled,
    repeat_enabled: repeatEnabled,
    view,
    queue_paths: currentQueue.map((track) => track.file_path),
    current_index: currentIndex >= 0 ? currentIndex : null,
  }), [
    playback.current_path,
    playback.title,
    playback.artist,
    playback.album,
    playback.position_secs,
    playback.volume,
    playback.is_playing,
    shuffleEnabled,
    repeatEnabled,
    view,
    currentQueue,
    currentIndex,
  ]);

  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  useEffect(() => {
    const snapshot: NavigationSnapshot = {
      page,
      view,
      selectedAlbumKey,
      selectedArtistDetailsName,
      selectedGenreDetailsName,
    };
    const previous = lastNavigationSnapshotRef.current;

    if (!previous) {
      lastNavigationSnapshotRef.current = snapshot;
      suppressHistoryRef.current = false;
      return;
    }

    const changed =
      previous.page !== snapshot.page ||
      previous.view !== snapshot.view ||
      previous.selectedAlbumKey !== snapshot.selectedAlbumKey ||
      previous.selectedArtistDetailsName !== snapshot.selectedArtistDetailsName ||
      previous.selectedGenreDetailsName !== snapshot.selectedGenreDetailsName;

    if (!changed) {
      suppressHistoryRef.current = false;
      return;
    }

    if (!suppressHistoryRef.current) {
      backHistoryRef.current.push(previous);
      if (backHistoryRef.current.length > 48) {
        backHistoryRef.current.shift();
      }
      forwardHistoryRef.current = [];
    }

    lastNavigationSnapshotRef.current = snapshot;
    suppressHistoryRef.current = false;
  }, [page, selectedAlbumKey, selectedArtistDetailsName, selectedGenreDetailsName, view]);

  const flushListeningSession = useCallback(async (sessionOverride?: ActiveListeningSession | null) => {
    const session = sessionOverride ?? activeListeningSessionRef.current;
    const state = playbackRef.current;

    if (!session) {
      activeListeningSessionRef.current = null;
      return;
    }

    if (!sessionOverride || activeListeningSessionRef.current?.eventId === session.eventId) {
      activeListeningSessionRef.current = null;
    }
    const durationPlayed = Math.max(
      0,
      Math.floor(Math.max(session.maxPosition, state.position_secs) - session.startPosition),
    );

    if (durationPlayed <= 0) {
      return;
    }

    const event: ListeningEvent = {
      id: session.eventId,
      track_id: session.trackPath,
      artist_id: session.artistId,
      album_id: session.albumId,
      genre: session.genre,
      duration_played: durationPlayed,
      completed:
        session.durationHint > 0
          ? durationPlayed >= session.durationHint * 0.5
          : false,
      timestamp: Math.floor(Date.now() / 1000),
      playback_source: "local",
      skipped: durationPlayed < 30,
    };

    try {
      const payload = await invoke<HomeDataPayload>("record_listening_events", {
        events: [event],
      });
      setHomeData(payload);
    } catch {
      // ignore analytics write failures so playback stays uninterrupted
    }
  }, []);

  useEffect(() => {
    if (
      !playback.current_path ||
      !currentTrack ||
      !playback.is_playing
    ) {
      return;
    }

    const session = activeListeningSessionRef.current;
    if (session?.trackPath === currentTrack.file_path) {
      return;
    }

    if (session && session.trackPath !== currentTrack.file_path) {
      void flushListeningSession(session);
    }

    activeListeningSessionRef.current = {
      eventId: `${currentTrack.file_path}::${Date.now()}`,
      trackPath: currentTrack.file_path,
      artistId: currentTrack.album_artist || currentTrack.artist || "Unknown Artist",
      albumId: currentTrack.album ? `${currentTrack.album_artist || currentTrack.artist}__${currentTrack.album}` : "Unknown Album",
      genre: normalizeGenre(currentTrack.genre || "Unknown"),
      startPosition: playback.position_secs,
      maxPosition: playback.position_secs,
      durationHint: playback.duration_secs,
    };
  }, [currentTrack, flushListeningSession, playback.current_path, playback.duration_secs, playback.is_playing, playback.position_secs]);

  useEffect(() => {
    const session = activeListeningSessionRef.current;
    if (!session || session.trackPath !== playback.current_path) {
      return;
    }

    session.maxPosition = Math.max(session.maxPosition, playback.position_secs);
    session.durationHint = Math.max(session.durationHint, playback.duration_secs);
  }, [playback.current_path, playback.duration_secs, playback.position_secs]);

  useEffect(() => {
    const session = activeListeningSessionRef.current;
    if (!session) {
      return;
    }

    const trackChanged = playback.current_path && playback.current_path !== session.trackPath;
    const stoppedPlaying = !playback.is_playing || !playback.current_path;

    if (!trackChanged && !stoppedPlaying) {
      return;
    }

    void flushListeningSession();
  }, [flushListeningSession, playback.current_path, playback.is_playing]);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    let cancelled = false;

    const resolveAccent = async () => {
      const manualAccent = preferences.appearance.manualAccent;

      if (!currentTrack?.artwork_path || preferences.appearance.accentMode === "manual") {
        setResolvedAccent(withIntensity(manualAccent, preferences.appearance.accentIntensity));
        return;
      }

      try {
        const artworkAccent = await extractAccentFromArtwork(
          convertFileSrc(currentTrack.artwork_path),
          currentTrack.artwork_path,
        );

        if (cancelled) {
          return;
        }

        const blended =
          preferences.appearance.accentMode === "blend"
            ? mixHexColors(artworkAccent, manualAccent, preferences.appearance.blendAmount)
            : artworkAccent;

        setResolvedAccent(withIntensity(blended, preferences.appearance.accentIntensity));
      } catch {
        if (!cancelled) {
          setResolvedAccent(withIntensity(manualAccent, preferences.appearance.accentIntensity));
        }
      }
    };

    void resolveAccent();

    return () => {
      cancelled = true;
    };
  }, [
    currentTrack?.artwork_path,
    preferences.appearance.accentIntensity,
    preferences.appearance.accentMode,
    preferences.appearance.blendAmount,
    preferences.appearance.manualAccent,
  ]);

  useEffect(() => {
    const root = document.documentElement;
    const hour = new Date().getHours();
    const autoPrefersLight = hour >= 7 && hour < 18 && !preferences.appearance.darkModeBias;
    const effectiveTheme =
      preferences.appearance.themeMode === "auto"
        ? (preferences.appearance.timeOfDayTheme && autoPrefersLight ? "light" : "dark")
        : preferences.appearance.themeMode;
    const accentStrong = withIntensity(resolvedAccent, Math.min(1, preferences.appearance.accentIntensity + 0.16));
    const densityScale = getDensityScale(preferences.appearance.density);
    const motionDuration = getMotionDuration(preferences.appearance.motionIntensity);
    const accentRgb = hexToRgbString(resolvedAccent);
    const accentStrongRgb = hexToRgbString(accentStrong);
    const blurPx = 14 + preferences.appearance.blurStrength * 20;
    const transparency = preferences.appearance.transparency;
    const panelTransparency = preferences.appearance.panelTransparency;
    const material = preferences.appearance.material;
    const shellBase = effectiveTheme === "light" ? "245, 247, 251" : "25, 28, 33";
    const shellAlpha = material === "solid" ? 0.98 : 0.78 + transparency * 0.16;
    const paneAlpha = material === "solid" ? 0.92 : 0.04 + panelTransparency * 0.08;
    const paneStrongAlpha = material === "solid" ? 0.96 : 0.08 + panelTransparency * 0.1;
    const text = effectiveTheme === "light" ? "22, 26, 31" : "247, 248, 251";
    const textSecondary = effectiveTheme === "light" ? "70, 78, 92" : "221, 225, 233";

    root.dataset.themeMode = effectiveTheme;
    root.style.setProperty("--win-accent", resolvedAccent);
    root.style.setProperty("--win-accent-rgb", accentRgb);
    root.style.setProperty("--win-accent-strong", accentStrong);
    root.style.setProperty("--win-accent-strong-rgb", accentStrongRgb);
    root.style.setProperty("--win-shell", `rgba(${shellBase}, ${shellAlpha.toFixed(3)})`);
    root.style.setProperty("--win-shell-strong", `rgba(${shellBase}, ${(shellAlpha + 0.05).toFixed(3)})`);
    root.style.setProperty("--win-pane", `rgba(255, 255, 255, ${paneAlpha.toFixed(3)})`);
    root.style.setProperty("--win-pane-strong", `rgba(255, 255, 255, ${paneStrongAlpha.toFixed(3)})`);
    root.style.setProperty("--win-pane-hover", `rgba(255, 255, 255, ${(paneStrongAlpha + 0.03).toFixed(3)})`);
    root.style.setProperty("--win-pane-active", `rgba(${accentRgb}, ${(0.12 + preferences.appearance.accentIntensity * 0.12).toFixed(3)})`);
    root.style.setProperty("--win-text", `rgba(${text}, ${effectiveTheme === "light" ? "0.96" : "0.96"})`);
    root.style.setProperty("--win-text-secondary", `rgba(${textSecondary}, ${effectiveTheme === "light" ? "0.78" : "0.70"})`);
    root.style.setProperty("--win-text-tertiary", `rgba(${textSecondary}, ${effectiveTheme === "light" ? "0.58" : "0.50"})`);
    root.style.setProperty("--win-blur-strength", `${blurPx}px`);
    root.style.setProperty("--win-density-scale", densityScale.toString());
    root.style.setProperty("--win-font-scale", preferences.appearance.fontScale.toString());
    root.style.setProperty("--win-motion-duration", `${motionDuration}ms`);
    root.style.setProperty("--win-lofi-opacity", preferences.appearance.lofiOverlay ? "0.18" : "0");
  }, [preferences, resolvedAccent]);

  useEffect(() => {
    if (!hasLoadedSessionRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistSessionNow(persistedSessionSnapshot).catch(() => {
        // ignore persistence errors to avoid interrupting playback
      });
    }, playback.is_playing ? 1500 : 250);

    return () => window.clearTimeout(timeoutId);
  }, [persistSessionNow, persistedSessionSnapshot, playback.is_playing]);

  useEffect(() => {
    if (!hasLoadedSessionRef.current) {
      return;
    }

    const flushSession = () => {
      void flushListeningSession().catch(() => {
        // ignore analytics flush errors on unload
      });
      void persistSessionNow({
        ...persistedSessionSnapshot,
        position_secs: playback.position_secs,
      }).catch(() => {
        // ignore unload persistence errors
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushSession();
      }
    };

    window.addEventListener("beforeunload", flushSession);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("beforeunload", flushSession);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [flushListeningSession, persistSessionNow, persistedSessionSnapshot, playback.position_secs]);

  useEffect(() => {
    const handleMouseNavigation = (event: MouseEvent) => {
      if (event.button === 3) {
        event.preventDefault();
        navigateBack();
      } else if (event.button === 4) {
        event.preventDefault();
        navigateForward();
      }
    };

    window.addEventListener("mouseup", handleMouseNavigation);

    return () => {
      window.removeEventListener("mouseup", handleMouseNavigation);
    };
  }, [navigateBack, navigateForward]);

  const startPlayback = useCallback(async (track: TrackRow, queue: TrackRow[] = [track]) => {
    try {
      const state = await invoke<PlaybackStatePayload>("play_track", {
        path: track.file_path,
        title: track.title,
        artist: track.artist,
        album: track.album,
      });

      const nextQueue = queue.length > 0 ? queue : [track];
      const nextIndex = nextQueue.findIndex((item) => item.file_path === track.file_path);

      setPlayback(state);
      setCurrentQueue(nextQueue);
      setCurrentIndex(nextIndex >= 0 ? nextIndex : 0);
      completedTrackRef.current = "";
      setStatus(`Playing: ${track.title}`);
    } catch (error) {
      console.error(error);
      setStatus(`Playback error: ${String(error)}`);
    }
  }, []);

  const handlePlayTrack = useCallback(async (track: TrackRow, queue?: TrackRow[]) => {
    await startPlayback(track, queue ?? currentQueue ?? [track]);
  }, [currentQueue, startPlayback]);

  async function handleTogglePlayback() {
    try {
      const state = await invoke<PlaybackStatePayload>("toggle_playback");
      setPlayback(state);
      completedTrackRef.current = "";
    } catch (error) {
      console.error(error);
      setStatus(`Playback error: ${String(error)}`);
    }
  }

  async function handleStopPlayback() {
    try {
      const state = await invoke<PlaybackStatePayload>("stop_playback");
      setPlayback(state);
      completedTrackRef.current = "";
    } catch (error) {
      console.error(error);
      setStatus(`Playback error: ${String(error)}`);
    }
  }

  async function handleVolumeChange(volume: number) {
    try {
      const state = await invoke<PlaybackStatePayload>("set_playback_volume", { volume });
      setPlayback(state);
    } catch (error) {
      console.error(error);
      setStatus(`Playback error: ${String(error)}`);
    }
  }

  async function handleSeek(position: number) {
    try {
      const state = await invoke<PlaybackStatePayload>("seek_playback", {
        positionSecs: position,
      });
      setPlayback(state);
      completedTrackRef.current = "";
    } catch (error) {
      console.error(error);
      setStatus(`Playback error: ${String(error)}`);
    }
  }

  const albumSummaries = useMemo(() => buildAlbumSummaries(tracks, albums), [tracks, albums]);
  const filteredTracks = useMemo(
    () => sortTracks(filterTracks(tracks, deferredSearchTerm, selectedGenre), sortBy),
    [tracks, deferredSearchTerm, selectedGenre, sortBy],
  );
  const filteredAlbums = useMemo(
    () => sortAlbums(filterAlbums(albumSummaries, deferredSearchTerm, selectedGenre), sortBy),
    [albumSummaries, deferredSearchTerm, selectedGenre, sortBy],
  );
  const filteredArtists = useMemo(
    () => filterArtists(artists, deferredSearchTerm),
    [artists, deferredSearchTerm],
  );
  const groupedAlbums = useMemo(
    () => groupAlbumsByInitial(filteredAlbums),
    [filteredAlbums],
  );
  const selectedAlbumDetails = useMemo(
    () =>
      selectedAlbumKey
        ? albumSummaries.find((album) => album.key === selectedAlbumKey) ?? null
        : null,
    [albumSummaries, selectedAlbumKey],
  );
  const selectedArtistDetails = useMemo(
    () =>
      selectedArtistDetailsName
        ? artists.find((artist) => artist.name === selectedArtistDetailsName) ?? null
        : null,
    [artists, selectedArtistDetailsName],
  );
  const selectedArtistAlbums = useMemo(
    () =>
      selectedArtistDetails
        ? albumSummaries.filter((album) => album.artist === selectedArtistDetails.name)
        : [],
    [albumSummaries, selectedArtistDetails],
  );
  const groupedArtists = useMemo(
    () => groupArtistsByInitial(filteredArtists),
    [filteredArtists],
  );
  const genreSummaries = useMemo(
    () => buildGenreSummaries(tracks, albumSummaries),
    [tracks, albumSummaries],
  );
  const filteredGenres = useMemo(
    () => filterGenres(genreSummaries, deferredSearchTerm),
    [genreSummaries, deferredSearchTerm],
  );
  const groupedGenres = useMemo(
    () => groupGenresByInitial(filteredGenres),
    [filteredGenres],
  );
  const selectedGenreDetails = useMemo(
    () =>
      selectedGenreDetailsName
        ? genreSummaries.find((genre) => genre.name === selectedGenreDetailsName) ?? null
        : null,
    [genreSummaries, selectedGenreDetailsName],
  );
  const albumSectionLabels = useMemo(
    () => groupedAlbums.map(([section]) => section),
    [groupedAlbums],
  );
  const artistSectionLabels = useMemo(
    () => groupedArtists.map(([section]) => section),
    [groupedArtists],
  );
  const progressPercent =
    progress && progress.total_found > 0
      ? Math.round((progress.processed / progress.total_found) * 100)
      : 0;

  async function handleNextTrack(fromEnded = false) {
    if (!currentQueue.length) {
      return;
    }

    if (shuffleEnabled && currentQueue.length > 1) {
      const candidates = currentQueue.filter(
        (track) => track.file_path !== playback.current_path,
      );
      const randomTrack = candidates[Math.floor(Math.random() * candidates.length)];
      if (randomTrack) {
        await startPlayback(randomTrack, currentQueue);
      }
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex < currentQueue.length) {
      await startPlayback(currentQueue[nextIndex], currentQueue);
      return;
    }

    if (repeatEnabled && currentQueue.length > 0) {
      await startPlayback(currentQueue[0], currentQueue);
      return;
    }

    if (fromEnded) {
      const state = await invoke<PlaybackStatePayload>("stop_playback");
      setPlayback(state);
    }
  }

  async function handlePreviousTrack() {
    if (!playback.current_path || !currentQueue.length) {
      return;
    }

    if (playback.position_secs > 3) {
      await handleSeek(0);
      return;
    }

    if (shuffleEnabled && currentQueue.length > 1) {
      const previousIndex = currentIndex > 0 ? currentIndex - 1 : currentQueue.length - 1;
      await startPlayback(currentQueue[previousIndex], currentQueue);
      return;
    }

    const previousIndex = currentIndex - 1;

    if (previousIndex >= 0) {
      await startPlayback(currentQueue[previousIndex], currentQueue);
      return;
    }

    if (repeatEnabled && currentQueue.length > 0) {
      await startPlayback(currentQueue[currentQueue.length - 1], currentQueue);
    }
  }

  async function handleShuffleAlbum(album: AlbumSummary) {
    const queue = shuffleTracks(album.tracks);
    const firstTrack = queue[0];

    if (firstTrack) {
      await handlePlayTrack(firstTrack, queue);
    }
  }

  async function handleShuffleArtistAlbums(artistAlbums: AlbumSummary[]) {
    const queue = shuffleTracks(artistAlbums.flatMap((album) => album.tracks));
    const firstTrack = queue[0];

    if (firstTrack) {
      await handlePlayTrack(firstTrack, queue);
    }
  }

  const registerAlbumSectionRef = useCallback((section: string, element: HTMLElement | null) => {
    if (element) {
      albumSectionRefs.current.set(section, element);
    } else {
      albumSectionRefs.current.delete(section);
    }
  }, []);

  const registerArtistSectionRef = useCallback((section: string, element: HTMLElement | null) => {
    if (element) {
      artistSectionRefs.current.set(section, element);
    } else {
      artistSectionRefs.current.delete(section);
    }
  }, []);

  const rememberLibrarySection = useCallback((targetView: "albums" | "artists") => {
    libraryReturnSectionsRef.current[targetView] =
      targetView === "albums" ? activeAlbumSectionRef.current : activeArtistSectionRef.current;
  }, []);

  const jumpToSection = useCallback((targetView: "albums" | "artists", section: string) => {
    const container = scrollContainerRef.current;
    const element =
      targetView === "albums"
        ? albumSectionRefs.current.get(section)
        : artistSectionRefs.current.get(section);

    if (!container || !element) {
      return;
    }

    const stickyOffset = 172;
    container.scrollTo({
      top: Math.max(0, element.offsetTop - stickyOffset),
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    if (albumSectionLabels.length > 0) {
      setActiveAlbumSection((current) => {
        const next = albumSectionLabels.includes(current) ? current : albumSectionLabels[0];
        activeAlbumSectionRef.current = next;
        return next;
      });
    }
  }, [albumSectionLabels]);

  useEffect(() => {
    if (artistSectionLabels.length > 0) {
      setActiveArtistSection((current) => {
        const next = artistSectionLabels.includes(current) ? current : artistSectionLabels[0];
        activeArtistSectionRef.current = next;
        return next;
      });
    }
  }, [artistSectionLabels]);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container || (!isAlbumsLibraryView && !isArtistsLibraryView)) {
      return;
    }

    let frameId = 0;
    const stickyOffset = 172;

    const updateActiveSection = () => {
      if (isRestoringScrollRef.current) {
        return;
      }

      const currentScroll = container.scrollTop + stickyOffset;

      if (isAlbumsLibraryView) {
        let nextSection = albumSectionLabels[0] ?? "&";

        for (const section of albumSectionLabels) {
          const element = albumSectionRefs.current.get(section);
          if (!element) {
            continue;
          }

          if (element.offsetTop <= currentScroll) {
            nextSection = section;
          } else {
            break;
          }
        }

        libraryReturnSectionsRef.current.albums = nextSection;
        if (activeAlbumSectionRef.current !== nextSection) {
          activeAlbumSectionRef.current = nextSection;
          setActiveAlbumSection(nextSection);
        }
        return;
      }

      let nextSection = artistSectionLabels[0] ?? "&";

      for (const section of artistSectionLabels) {
        const element = artistSectionRefs.current.get(section);
        if (!element) {
          continue;
        }

        if (element.offsetTop <= currentScroll) {
          nextSection = section;
        } else {
          break;
        }
      }

      libraryReturnSectionsRef.current.artists = nextSection;
      if (activeArtistSectionRef.current !== nextSection) {
        activeArtistSectionRef.current = nextSection;
        setActiveArtistSection(nextSection);
      }
    };

    const handleScroll = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateActiveSection);
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.cancelAnimationFrame(frameId);
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [
    albumSectionLabels,
    artistSectionLabels,
    isAlbumsLibraryView,
    isArtistsLibraryView,
  ]);

  useLayoutEffect(() => {
    const targetRestore = pendingScrollRestoreRef.current;
    const container = scrollContainerRef.current;

    if (!targetRestore || !container) {
      return;
    }

    const canRestore =
      !selectedAlbumKey &&
      !selectedArtistDetailsName &&
      view === targetRestore.view;

    if (!canRestore) {
      return;
    }

    const anchorElement =
      targetRestore.view === "albums"
        ? albumSectionRefs.current.get(targetRestore.section)
        : artistSectionRefs.current.get(targetRestore.section);
    const nextTop = anchorElement ? Math.max(0, anchorElement.offsetTop) : 0;

    isRestoringScrollRef.current = true;
    container.scrollTop = nextTop;
    pendingScrollRestoreRef.current = null;
    setHiddenLibraryView(targetRestore.view);

    const frameId = window.requestAnimationFrame(() => {
      isRestoringScrollRef.current = false;
      setHiddenLibraryView((current) => (current === targetRestore.view ? null : current));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      isRestoringScrollRef.current = false;
    };
  }, [selectedAlbumKey, selectedArtistDetailsName, view, groupedAlbums, groupedArtists]);

  const showStickySectionNav =
    page === "library" &&
    !selectedAlbumKey &&
    !selectedArtistDetailsName &&
    (view === "albums" || view === "artists");
  const currentStickySection = view === "artists" ? activeArtistSection : activeAlbumSection;
  const availableStickySections = view === "artists" ? artistSectionLabels : albumSectionLabels;
  const handleViewChange = useCallback((nextView: LibraryView) => {
    if (isAlbumsLibraryView) {
      rememberLibrarySection("albums");
    } else if (isArtistsLibraryView) {
      rememberLibrarySection("artists");
    }

    setView(nextView);
    setSelectedAlbumKey(null);
    setSelectedArtistDetailsName(null);
    setSelectedGenreDetailsName(null);
    pendingScrollRestoreRef.current =
      nextView === "albums" || nextView === "artists"
        ? {
            view: nextView,
            section: libraryReturnSectionsRef.current[nextView],
          }
        : null;
    setHiddenLibraryView(nextView === "albums" || nextView === "artists" ? nextView : null);
  }, [isAlbumsLibraryView, isArtistsLibraryView, rememberLibrarySection]);

  const handleJumpToStickySection = useCallback((section: string) => {
    if (view === "albums" || view === "artists") {
      jumpToSection(view, section);
    }
  }, [jumpToSection, view]);

  const handleBackFromAlbumDetails = useCallback(() => {
    if (!selectedArtistDetailsName && view === "albums") {
      pendingScrollRestoreRef.current = {
        view: "albums",
        section: libraryReturnSectionsRef.current.albums,
      };
      setHiddenLibraryView("albums");
    }
    setSelectedAlbumKey(null);
  }, [selectedArtistDetailsName, view]);

  const handleBackFromArtistDetails = useCallback(() => {
    pendingScrollRestoreRef.current = {
      view: "artists",
      section: libraryReturnSectionsRef.current.artists,
    };
    setHiddenLibraryView("artists");
    setSelectedArtistDetailsName(null);
  }, []);

  const handleOpenAlbumFromGrid = useCallback((album: AlbumSummary) => {
    rememberLibrarySection("albums");
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    setSelectedAlbumKey(album.key);
  }, [rememberLibrarySection]);

  const handleSelectArtist = useCallback((artist: string) => {
    rememberLibrarySection("artists");
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    setSelectedArtistDetailsName(artist);
    setSelectedAlbumKey(null);
    setSelectedGenreDetailsName(null);
  }, [rememberLibrarySection]);

  const handleOpenAlbumFromArtistDetails = useCallback((album: AlbumSummary) => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    setSelectedAlbumKey(album.key);
  }, []);

  const handleSelectGenre = useCallback((genre: string) => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    setSelectedGenreDetailsName(genre);
    setSelectedAlbumKey(null);
    setSelectedArtistDetailsName(null);
  }, []);

  useEffect(() => {
    if (
      page === "library" &&
      (selectedAlbumKey || selectedArtistDetailsName || selectedGenreDetailsName)
    ) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [page, selectedAlbumKey, selectedArtistDetailsName, selectedGenreDetailsName]);

  useLayoutEffect(() => {
    const updateInsets = () => {
      const chromeRect = windowChromeRef.current?.getBoundingClientRect();
      const headerRect = topHeaderRef.current?.getBoundingClientRect();
      const playerRect = playerBarRef.current?.getBoundingClientRect();

      setShellInsets({
        top: headerRect && headerRect.height > 0
          ? Math.round(headerRect.bottom + 12)
          : chromeRect
            ? Math.round(chromeRect.bottom + 12)
            : 72,
        bottom: playerRect ? Math.round(window.innerHeight - playerRect.top + 12) : 124,
      });
    };

    updateInsets();

    const resizeObserver = new ResizeObserver(() => {
      updateInsets();
    });

    if (windowChromeRef.current) {
      resizeObserver.observe(windowChromeRef.current);
    }
    if (topHeaderRef.current) {
      resizeObserver.observe(topHeaderRef.current);
    }
    if (playerBarRef.current) {
      resizeObserver.observe(playerBarRef.current);
    }

    window.addEventListener("resize", updateInsets);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateInsets);
    };
  }, [page, selectedAlbumKey, selectedArtistDetailsName, selectedGenreDetailsName]);

  return (
    <div className="relative grid h-screen grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-transparent text-white">
      <div ref={windowChromeRef}>
        <WindowChrome />
      </div>

      <div className="grid min-h-0 grid-cols-[auto_minmax(0,1fr)] overflow-hidden px-3 pb-3 pt-3">
        <Sidebar
          isOpen={sidebarOpen}
          searchTerm={searchTerm}
          currentPage={page}
          onSearchTermChange={setSearchTerm}
          onToggle={() => setSidebarOpen((current) => !current)}
          onOpenHome={() => setPage("home")}
          onOpenLibrary={() => setPage("library")}
          onOpenSettings={() => setPage("settings")}
        />

        <main className="relative flex min-h-0 min-w-0 flex-col bg-transparent">
          {progress && (
            <div className="pointer-events-none absolute right-4 top-4 z-20 w-full max-w-sm px-2 md:right-6 md:top-5">
              <div className="win-pane-strong ml-auto rounded-[18px] p-4 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white/92">
                      {progress.completed ? "Scan complete" : "Scanning library"}
                    </div>
                    <div className="mt-1 text-xs win-subtle">
                      {progress.processed}/{progress.total_found} processed
                    </div>
                  </div>
                  <div className="text-xs win-muted">{progressPercent}%</div>
                </div>

                <div className="mt-3 h-1.5 rounded-full bg-white/8">
                  <div
                    className={`h-full rounded-full transition-all ${
                      progress.completed
                        ? "bg-[var(--win-accent-strong)]"
                        : "bg-[linear-gradient(90deg,#7fb3ff,#9bc4ff)]"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs win-subtle">
                  <span>Inserted {progress.inserted}</span>
                  <span>Failed {progress.failed}</span>
                </div>

                <p className="mt-2 truncate text-xs win-muted">
                  {progress.current_file || (progress.completed ? "Ready" : "Waiting...")}
                </p>
              </div>
            </div>
          )}

          <div
            ref={scrollContainerRef}
            className="win-scroll-region relative min-h-0 flex-1 overflow-y-auto px-5 py-0 md:px-7 xl:px-8"
          >
            {page === "library" &&
            !selectedAlbumKey &&
            !selectedArtistDetailsName &&
            !selectedGenreDetailsName ? (
              <div ref={topHeaderRef} className="win-app-shell sticky top-0 z-40 -mx-5 rounded-b-[28px] border-b border-white/10 px-5 pt-5 pb-4 shadow-[var(--win-shadow-sm)] md:-mx-7 md:px-7 xl:-mx-8 xl:px-8">
                <TopBar
                  view={view}
                  onViewChange={handleViewChange}
                  onChooseFolder={chooseFolderAndScan}
                  isScanning={isScanning}
                />
              </div>
            ) : (
              <div ref={topHeaderRef} className="h-0" />
            )}

            <section
              className={`win-content-transition relative z-0 pt-6 pb-10 transition-opacity duration-100 ${
                hiddenLibraryView &&
                ((hiddenLibraryView === "albums" && isAlbumsLibraryView) ||
                  (hiddenLibraryView === "artists" && isArtistsLibraryView))
                  ? "opacity-0"
                  : "opacity-100"
              }`}
            >
              {showStickySectionNav ? (
                <div className="pointer-events-none sticky top-[6.65rem] z-30 mb-3 flex w-fit pb-2">
                  <div className="pointer-events-auto">
                    <StickySectionNav
                      currentSection={currentStickySection}
                      availableSections={availableStickySections}
                      onJumpToSection={handleJumpToStickySection}
                    />
                  </div>
                </div>
              ) : null}

              {page === "home" ? (
                <HomePage
                  data={homeData}
                  currentTrack={currentTrack}
                  widgetOrder={homeWidgetOrder}
                  onMoveWidget={moveHomeWidget}
                  onSaveProfile={(payload) => void handleSaveHomeProfile(payload)}
                  onToggleFavorite={(payload) => void handleToggleFavorite(payload)}
                  onPlayTrack={(track, queue) => void handlePlayTrack(track, queue)}
                />
              ) : page === "settings" ? (
                <SettingsPage
                  preferences={preferences}
                  activeAccent={resolvedAccent}
                  currentVolume={playback.volume}
                  currentShuffleEnabled={shuffleEnabled}
                  currentRepeatEnabled={repeatEnabled}
                  libraryLocations={libraryLocations}
                  isScanning={isScanning}
                  onUpdateAppearance={updateAppearance}
                  onUpdatePlayback={updatePlaybackCustomization}
                  onUpdateAudio={updateAudioCustomization}
                  onUpdateLibrary={updateLibraryCustomization}
                  onUpdateAdvanced={updateAdvancedCustomization}
                  onSelectLayoutPreset={updateLayoutPreset}
                  onResetAppearance={resetAppearance}
                  onResetPlayback={resetPlaybackCustomization}
                  onResetAudio={resetAudioCustomization}
                  onResetAdvanced={resetAdvancedCustomization}
                  onAddFolder={() => void chooseFolderAndScan()}
                  onRefreshLibrary={() => void handleRefreshLibrary()}
                  onCreateProfile={createProfile}
                  onApplyProfile={(profileId) => void applyProfile(profileId)}
                  onDuplicateProfile={duplicateProfile}
                  onDeleteProfile={deleteProfile}
                  onRenameProfile={renameProfile}
                  onSaveCurrentToProfile={saveCurrentToProfile}
                />
              ) : selectedAlbumDetails ? (
                <div className="relative h-full min-h-0">
                  <AlbumDetailsView
                    album={selectedAlbumDetails}
                    playback={playback}
                    topInset={shellInsets.top}
                    bottomInset={shellInsets.bottom}
                    onBack={handleBackFromAlbumDetails}
                    onPlayTrack={handlePlayTrack}
                    onShuffleAlbum={(album) => void handleShuffleAlbum(album)}
                    onSaveMetadata={handleSaveAlbumMetadata}
                  />
                </div>
              ) : selectedArtistDetails ? (
                <ArtistDetailsView
                  artist={selectedArtistDetails}
                  albums={selectedArtistAlbums}
                  currentAlbumKey={currentAlbumKey}
                  onBack={handleBackFromArtistDetails}
                  onOpenAlbum={handleOpenAlbumFromArtistDetails}
                  onPlayAlbum={handlePlayTrack}
                  onShuffleArtist={(albums) => void handleShuffleArtistAlbums(albums)}
                />
              ) : selectedGenreDetails ? (
                <GenreDetailsView
                  genre={selectedGenreDetails}
                  playback={playback}
                  currentAlbumKey={currentAlbumKey}
                  onBack={() => setSelectedGenreDetailsName(null)}
                  onOpenAlbum={handleOpenAlbumFromArtistDetails}
                  onPlayTrack={handlePlayTrack}
                />
              ) : view === "albums" ? (
                <AlbumGrid
                  sections={groupedAlbums}
                  currentAlbumKey={currentAlbumKey}
                  onRegisterSectionRef={registerAlbumSectionRef}
                  onOpenAlbum={handleOpenAlbumFromGrid}
                  onPlayAlbum={handlePlayTrack}
                />
              ) : view === "songs" ? (
                <SongTable
                  tracks={filteredTracks}
                  playback={playback}
                  onPlayTrack={(track) => handlePlayTrack(track, filteredTracks)}
                />
              ) : view === "genres" ? (
                <GenreGrid
                  sections={groupedGenres}
                  onSelectGenre={handleSelectGenre}
                />
              ) : (
                <ArtistGrid
                  sections={groupedArtists}
                  onRegisterSectionRef={registerArtistSectionRef}
                  onSelectArtist={handleSelectArtist}
                />
              )}
            </section>
          </div>
        </main>
      </div>

      <div ref={playerBarRef} className="shrink-0">
        <PlayerBar
          playback={playback}
          artworkPath={currentTrack?.artwork_path ?? null}
          status={status}
          repeatEnabled={repeatEnabled}
          shuffleEnabled={shuffleEnabled}
          onTogglePlayback={handleTogglePlayback}
          onStopPlayback={handleStopPlayback}
          onNextTrack={() => void handleNextTrack()}
          onPreviousTrack={() => void handlePreviousTrack()}
          onSeek={(position) => void handleSeek(position)}
          onVolumeChange={(volume) => void handleVolumeChange(volume)}
          onToggleRepeat={() => setRepeatEnabled((current) => !current)}
          onToggleShuffle={() => setShuffleEnabled((current) => !current)}
        />
      </div>
    </div>
  );
}

export default App;
