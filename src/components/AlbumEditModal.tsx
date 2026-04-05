import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useState } from "react";
import type {
  AlbumArtCandidate,
  AlbumSummary,
  SaveAlbumMetadataPayload,
  SaveAlbumMetadataResult,
} from "../types";

const albumArtSearchCache = new Map<string, Promise<AlbumArtCandidate[]>>();

type AlbumEditModalProps = {
  album: AlbumSummary;
  topInset: number;
  bottomInset: number;
  onClose: () => void;
  onSave: (payload: SaveAlbumMetadataPayload) => Promise<SaveAlbumMetadataResult>;
};

type EditableTrackState = {
  file_path: string;
  title: string;
  artist: string;
  track_number: string;
};

type LocalArtworkSelection = {
  path: string;
  fileName: string;
  width: number;
  height: number;
  warning: string;
};

function toInputValue(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildInitialTracks(album: AlbumSummary): EditableTrackState[] {
  return album.tracks.map((track) => ({
    file_path: track.file_path,
    title: track.title,
    artist: track.artist,
    track_number: toInputValue(track.track_number),
  }));
}

function isRemoteImageSource(value: string) {
  return /^https?:\/\//i.test(value);
}

function toArtworkPreviewSrc(source: string) {
  return isRemoteImageSource(source) ? source : convertFileSrc(source);
}

function buildPreviewUrl(album: AlbumSummary, selectedArtworkSource: string | null) {
  if (selectedArtworkSource) {
    return toArtworkPreviewSrc(selectedArtworkSource);
  }

  return album.artworkPath ? convertFileSrc(album.artworkPath) : null;
}

function createAlbumArtCacheKey(albumArtist: string, albumTitle: string) {
  return `${albumArtist.trim().toLowerCase()}::${albumTitle.trim().toLowerCase()}`;
}

function fetchAlbumArtCandidates(albumArtist: string, albumTitle: string) {
  const cacheKey = createAlbumArtCacheKey(albumArtist, albumTitle);
  const existing = albumArtSearchCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const request = invoke<AlbumArtCandidate[]>("search_album_art", {
    albumArtist,
    albumTitle,
  })
    .then((results) => results)
    .catch((error) => {
      albumArtSearchCache.delete(cacheKey);
      throw error;
    });

  albumArtSearchCache.set(cacheKey, request);
  return request;
}

function formatResolution(candidate: Pick<AlbumArtCandidate, "width" | "height">) {
  return `${candidate.width}×${candidate.height}`;
}

function formatFileSize(bytes: number) {
  if (!bytes) {
    return "Unknown size";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Field({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "text" | "numeric";
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-[var(--win-text-tertiary)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        className="win-field h-10 w-full rounded-[4px] px-3.5 text-[12.5px] text-[var(--win-text)] outline-none"
      />
    </label>
  );
}

function extractFileName(path: string) {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function inspectLocalArtwork(path: string) {
  return new Promise<LocalArtworkSelection>((resolve, reject) => {
    const image = new Image();
    const src = convertFileSrc(path);

    image.onload = () => {
      const width = image.naturalWidth || 0;
      const height = image.naturalHeight || 0;

      if (width <= 0 || height <= 0) {
        reject(new Error("The selected file could not be read as an image."));
        return;
      }

      resolve({
        path,
        fileName: extractFileName(path),
        width,
        height,
        warning:
          width < 300 || height < 300
            ? "This image is smaller than 300×300 and may look soft as album art."
            : "",
      });
    };

    image.onerror = () => {
      reject(new Error("The selected file is not a supported image or is corrupted."));
    };

    image.src = src;
  });
}

function AlbumArtPickerModal({
  albumArtist,
  albumTitle,
  currentPreviewUrl,
  selectedArtworkSource,
  selectedLocalArtwork,
  onClose,
  onSelect,
  onSelectLocalFile,
}: {
  albumArtist: string;
  albumTitle: string;
  currentPreviewUrl: string | null;
  selectedArtworkSource: string | null;
  selectedLocalArtwork: LocalArtworkSelection | null;
  onClose: () => void;
  onSelect: (imageSource: string, localArtwork?: LocalArtworkSelection | null) => void;
  onSelectLocalFile: (selection: LocalArtworkSelection) => void;
}) {
  const [candidates, setCandidates] = useState<AlbumArtCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingSelectionSource, setPendingSelectionSource] = useState<string | null>(selectedArtworkSource);
  const [pendingLocalArtwork, setPendingLocalArtwork] =
    useState<LocalArtworkSelection | null>(selectedLocalArtwork);
  const [brokenPreviewUrls, setBrokenPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadCandidates() {
      setIsLoading(true);
      setError("");
      setBrokenPreviewUrls([]);

      try {
        const results = await fetchAlbumArtCandidates(albumArtist, albumTitle);

        if (!cancelled) {
          setCandidates(results);
        }
      } catch (loadError) {
        if (!cancelled) {
          setCandidates([]);
          setError(String(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCandidates();

    return () => {
      cancelled = true;
    };
  }, [albumArtist, albumTitle]);

  useEffect(() => {
    setPendingSelectionSource(selectedArtworkSource);
    setPendingLocalArtwork(selectedLocalArtwork);
  }, [selectedArtworkSource, selectedLocalArtwork]);

  const visibleCandidates = useMemo(
    () =>
      candidates.filter(
        (candidate) => !brokenPreviewUrls.includes(candidate.preview_url),
      ),
    [brokenPreviewUrls, candidates],
  );

  const selectedCandidate = useMemo(
    () =>
      visibleCandidates.find((candidate) => candidate.image_url === pendingSelectionSource) ??
      candidates.find((candidate) => candidate.image_url === pendingSelectionSource) ??
      null,
    [candidates, pendingSelectionSource, visibleCandidates],
  );

  const previewImageUrl = pendingLocalArtwork
    ? toArtworkPreviewSrc(pendingLocalArtwork.path)
    : selectedCandidate?.preview_url ?? currentPreviewUrl;

  async function handleSelectFromFile() {
    setError("");

    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Images",
            extensions: ["jpg", "jpeg", "png", "webp"],
          },
        ],
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      const localArtwork = await inspectLocalArtwork(selected);
      setPendingSelectionSource(localArtwork.path);
      setPendingLocalArtwork(localArtwork);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/62 p-5 backdrop-blur-md">
      <div className="win-pane-strong win-modal-entry flex max-h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-[8px] border border-[var(--win-border)] shadow-[var(--win-shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[var(--win-border)] px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--win-text-tertiary)]">Cover art</div>
            <div className="mt-1 text-[15px] font-semibold text-[var(--win-text)]">
              {albumTitle} • {albumArtist}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="win-button inline-flex h-8 items-center rounded-[4px] px-4 text-[12px] font-medium text-[var(--win-text-secondary)] hover:text-[var(--win-text)]"
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-5 overflow-hidden px-5 py-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--win-text-tertiary)]">Preview</div>
              <button
                type="button"
                onClick={() => void handleSelectFromFile()}
                className="win-button inline-flex h-8 items-center rounded-[4px] px-4 text-[12px] font-medium text-[var(--win-text-secondary)] hover:text-[var(--win-text)]"
              >
                Select from File
              </button>
            </div>
            <div className="relative aspect-square overflow-hidden rounded-[4px] border border-[var(--win-border)] bg-black/20">
              {previewImageUrl ? (
                <img
                  src={previewImageUrl}
                  alt={`${albumTitle} cover preview`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-5 text-center text-[12.5px] text-white/44">
                  No cover selected
                </div>
              )}
            </div>
            {pendingLocalArtwork ? (
              <div className="win-pane rounded-[6px] border-[rgba(var(--win-accent-rgb),0.16)] bg-[rgba(var(--win-accent-rgb),0.08)] px-4 py-3 text-[12px] text-[var(--win-text-secondary)]">
                <div className="font-medium text-[var(--win-text)]">{pendingLocalArtwork.fileName}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--win-text-tertiary)]">
                  <span>Local file</span>
                  <span>{pendingLocalArtwork.width}×{pendingLocalArtwork.height}</span>
                </div>
                {pendingLocalArtwork.warning ? (
                  <div className="mt-2 text-[12px] leading-5 text-amber-200/90">
                    {pendingLocalArtwork.warning}
                  </div>
                ) : null}
              </div>
            ) : selectedCandidate ? (
              <div className="win-pane rounded-[6px] border-[rgba(var(--win-accent-rgb),0.16)] bg-[rgba(var(--win-accent-rgb),0.08)] px-4 py-3 text-[12px] text-[var(--win-text-secondary)]">
                <div className="font-medium text-[var(--win-text)]">{selectedCandidate.label}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--win-text-tertiary)]">
                  <span>{selectedCandidate.source}</span>
                  <span>{formatResolution(selectedCandidate)}</span>
                  <span>{formatFileSize(selectedCandidate.file_size_bytes)}</span>
                </div>
              </div>
            ) : (
              <p className="text-[12px] leading-5 text-[var(--win-text-secondary)]">
                Browse results, select the best cover, then apply it. The original image URL is saved so the final embedded art stays high quality.
              </p>
            )}
          </div>

          <div className="min-h-0 space-y-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--win-text-tertiary)]">Search results</div>
              <div className="flex items-center gap-3">
                <div className="text-[12px] text-[var(--win-text-secondary)]">
                  {isLoading ? "Searching…" : `${visibleCandidates.length} curated results`}
                </div>
                <button
                  type="button"
                  onClick={() => void handleSelectFromFile()}
                  className="win-button inline-flex h-8 items-center rounded-[4px] px-4 text-[12px] font-medium text-[var(--win-text-secondary)] hover:text-[var(--win-text)]"
                >
                  Choose Image
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-[16px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-[12.5px] text-rose-200">
                Couldn&apos;t load album art results. {error}
              </div>
            ) : null}

            {!isLoading && visibleCandidates.length === 0 && !error ? (
              <div className="rounded-[6px] border border-[var(--win-border)] bg-[var(--win-input)] px-4 py-5 text-[12px] leading-5 text-[var(--win-text-secondary)]">
                No strong album-cover matches were found for this search. Try updating the album title or artist, then search again for a more precise result set.
              </div>
            ) : null}

            <div className="grid max-h-[66vh] grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-4 overflow-y-auto pr-1">
              {visibleCandidates.map((candidate) => {
                const isSelected = pendingSelectionSource === candidate.image_url;

                return (
                  <button
                    key={candidate.image_url}
                    type="button"
                    onClick={() => {
                      setPendingSelectionSource(candidate.image_url);
                      setPendingLocalArtwork(null);
                    }}
                    className={`group overflow-hidden rounded-[4px] border text-left transition ${
                      isSelected
                        ? "border-[rgba(var(--win-accent-rgb),0.5)] bg-[rgba(var(--win-accent-rgb),0.08)] shadow-[inset_2px_0_0_var(--win-accent)]"
                        : "border-[var(--win-border)] bg-[var(--win-input)] hover:border-[var(--win-border-strong)] hover:bg-[var(--win-input-hover)]"
                    }`}
                  >
                    <div className="relative aspect-square overflow-hidden bg-black/20">
                      <img
                        src={candidate.preview_url}
                        alt={candidate.label}
                        loading="lazy"
                        onError={() =>
                          setBrokenPreviewUrls((current) =>
                            current.includes(candidate.preview_url)
                              ? current
                              : [...current, candidate.preview_url],
                          )
                        }
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03] group-hover:brightness-105"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-2.5 py-2 text-[10px] uppercase tracking-[0.16em] text-white/78">
                        {formatResolution(candidate)}
                      </div>
                    </div>
                    <div className="space-y-1 px-3 py-3">
                      <div className="line-clamp-2 text-[12px] font-medium text-[var(--win-text)]">
                        {candidate.label}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--win-text-tertiary)]">
                        <span>{candidate.source}</span>
                        <span>{Math.round(candidate.score)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[var(--win-border)] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="win-button inline-flex h-8 items-center rounded-[4px] px-4 text-[12px] font-medium text-[var(--win-text-secondary)] hover:text-[var(--win-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedCandidate && !pendingLocalArtwork}
                onClick={() => {
                  if (pendingLocalArtwork) {
                    onSelectLocalFile(pendingLocalArtwork);
                    onSelect(pendingLocalArtwork.path, pendingLocalArtwork);
                    return;
                  }

                  if (selectedCandidate) {
                    onSelect(selectedCandidate.image_url, null);
                  }
                }}
                className="win-button-primary inline-flex h-8 items-center rounded-[4px] px-4 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Use selected cover
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlbumEditModal({
  album,
  topInset,
  bottomInset,
  onClose,
  onSave,
}: AlbumEditModalProps) {
  const [albumTitle, setAlbumTitle] = useState(album.name);
  const [albumArtist, setAlbumArtist] = useState(album.artist);
  const [genre, setGenre] = useState(album.genre ?? "");
  const [year, setYear] = useState(toInputValue(album.year));
  const [tracks, setTracks] = useState<EditableTrackState[]>(() => buildInitialTracks(album));
  const [selectedArtworkSource, setSelectedArtworkSource] = useState<string | null>(null);
  const [selectedLocalArtwork, setSelectedLocalArtwork] =
    useState<LocalArtworkSelection | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [artPickerOpen, setArtPickerOpen] = useState(false);

  useEffect(() => {
    setAlbumTitle(album.name);
    setAlbumArtist(album.artist);
    setGenre(album.genre ?? "");
    setYear(toInputValue(album.year));
    setTracks(buildInitialTracks(album));
    setSelectedArtworkSource(null);
    setSelectedLocalArtwork(null);
    setSaveError("");
    setArtPickerOpen(false);
  }, [album]);

  const previewUrl = useMemo(
    () => buildPreviewUrl(album, selectedArtworkSource),
    [album, selectedArtworkSource],
  );

  async function handleSave() {
    setIsSaving(true);
    setSaveError("");

    try {
      await onSave({
        album_title: albumTitle.trim() || album.name,
        album_artist: albumArtist.trim() || album.artist,
        genre: normalizeOptionalText(genre),
        year: normalizeOptionalNumber(year),
        artwork_url: selectedArtworkSource,
        tracks: tracks.map((track) => ({
          file_path: track.file_path,
          title: track.title.trim(),
          artist: track.artist.trim(),
          genre: null,
          year: null,
          track_number: normalizeOptionalNumber(track.track_number),
        })),
      });

      onClose();
    } catch (error) {
      setSaveError(String(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-x-0 z-[85] flex items-stretch justify-center bg-black/40 p-4 backdrop-blur-[2px] md:p-5"
      style={{
        top: `${topInset}px`,
        bottom: `${bottomInset}px`,
      }}
    >
      <div className="win-pane-strong win-modal-entry relative flex h-full max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-[8px] border border-[var(--win-border)] shadow-[var(--win-shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[var(--win-border)] px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--win-text-tertiary)]">Edit info</div>
            <div className="mt-1 text-[16px] font-semibold text-[var(--win-text)]">Edit album info</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="win-button inline-flex h-8 items-center rounded-[4px] px-4 text-[12px] font-medium text-[var(--win-text-secondary)] hover:text-[var(--win-text)]"
          >
            Cancel
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_272px]">
            <div className="space-y-5">
              <div className="win-pane rounded-[18px] p-4">
                <div className="text-[12px] font-semibold text-white/88">Album details</div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Album title" value={albumTitle} onChange={setAlbumTitle} />
                  <Field label="Album artist" value={albumArtist} onChange={setAlbumArtist} />
                  <Field label="Genre" value={genre} onChange={setGenre} />
                  <Field label="Year" value={year} onChange={setYear} inputMode="numeric" />
                </div>
              </div>

              <div className="win-pane rounded-[18px] p-4">
                <div className="text-[12px] font-semibold text-white/88">Track list</div>
                <div className="mt-1 text-[12px] text-white/46">
                  Edit track numbers, titles, and contributing artists.
                </div>

                <div className="mt-4 grid grid-cols-[62px_minmax(0,2.2fr)_minmax(0,1.5fr)] gap-3 px-1 text-[10.5px] uppercase tracking-[0.16em] text-white/34">
                  <div>Track</div>
                  <div>Title</div>
                  <div>Artist</div>
                </div>

                <div className="mt-3 space-y-2">
                  {tracks.map((track, index) => (
                    <div
                      key={track.file_path}
                      className="grid grid-cols-[62px_minmax(0,2.2fr)_minmax(0,1.5fr)] gap-3"
                    >
                      <input
                        value={track.track_number}
                        onChange={(event) =>
                          setTracks((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, track_number: event.target.value }
                                : item,
                            ),
                          )
                        }
                        inputMode="numeric"
                        className="win-field h-10 rounded-[12px] px-3 text-[13px] text-white outline-none"
                      />
                      <input
                        value={track.title}
                        onChange={(event) =>
                          setTracks((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, title: event.target.value } : item,
                            ),
                          )
                        }
                        className="win-field h-10 rounded-[12px] px-3 text-[13px] text-white outline-none"
                      />
                      <input
                        value={track.artist}
                        onChange={(event) =>
                          setTracks((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, artist: event.target.value } : item,
                            ),
                          )
                        }
                        className="win-field h-10 rounded-[12px] px-3 text-[13px] text-white outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="win-pane rounded-[18px] p-4">
                <div className="text-[12px] font-semibold text-white/88">Album cover</div>
                <button
                  type="button"
                  onClick={() => setArtPickerOpen(true)}
                  className="group mt-4 block w-full text-left"
                >
                  <div className="relative aspect-square overflow-hidden rounded-[18px] border border-white/10 bg-black/18 transition group-hover:border-white/16">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={`${albumTitle} cover`}
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.01] group-hover:brightness-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-6 text-center text-[12.5px] text-white/44">
                        Click to search for album art
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 to-transparent px-4 py-4 text-[12.5px] font-medium text-white/92">
                      {selectedArtworkSource ? "New cover selected" : "Change cover"}
                    </div>
                  </div>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setArtPickerOpen(true)}
                    className="win-button inline-flex h-9 items-center rounded-[12px] px-4 text-[12px] font-medium text-white/84 hover:text-white"
                  >
                    Change cover
                  </button>
                  <button
                    type="button"
                    onClick={() => setArtPickerOpen(true)}
                    className="win-button inline-flex h-9 items-center rounded-[12px] px-4 text-[12px] font-medium text-white/84 hover:text-white"
                  >
                    Update online
                  </button>
                </div>
              </div>

              {selectedLocalArtwork ? (
                <div className="win-pane rounded-[16px] border-[rgba(var(--win-accent-rgb),0.16)] bg-[rgba(var(--win-accent-rgb),0.08)] px-4 py-3">
                  <div className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-white/52">
                    Selected file
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-white/92">
                    {selectedLocalArtwork.fileName}
                  </div>
                  <div className="mt-1 text-[12px] text-white/52">
                    {selectedLocalArtwork.width}×{selectedLocalArtwork.height}
                  </div>
                  {selectedLocalArtwork.warning ? (
                    <div className="mt-2 text-[12px] leading-5 text-amber-200/90">
                      {selectedLocalArtwork.warning}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/6 bg-[rgba(0,0,0,0.08)] px-5 py-4">
          <div className="min-h-[20px] text-[12.5px] text-rose-200">{saveError}</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="win-button inline-flex h-10 items-center rounded-[12px] px-4 text-[12px] font-medium text-white/82 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="win-button-primary inline-flex h-10 items-center rounded-[12px] px-4 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        {artPickerOpen ? (
          <AlbumArtPickerModal
            albumArtist={albumArtist.trim() || album.artist}
            albumTitle={albumTitle.trim() || album.name}
            currentPreviewUrl={previewUrl}
            selectedArtworkSource={selectedArtworkSource}
            selectedLocalArtwork={selectedLocalArtwork}
            onClose={() => setArtPickerOpen(false)}
            onSelect={(imageSource, localArtwork) => {
              setSelectedArtworkSource(imageSource);
              setSelectedLocalArtwork(localArtwork ?? null);
              setSaveError("");
              setArtPickerOpen(false);
            }}
            onSelectLocalFile={(selection) => {
              setSelectedLocalArtwork(selection);
              setSelectedArtworkSource(selection.path);
              setArtPickerOpen(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
