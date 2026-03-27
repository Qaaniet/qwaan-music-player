import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import type {
  AlbumArtCandidate,
  AlbumSummary,
  SaveAlbumMetadataPayload,
  SaveAlbumMetadataResult,
} from "../types";

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

function buildPreviewUrl(album: AlbumSummary, selectedArtworkUrl: string | null) {
  if (selectedArtworkUrl) {
    return selectedArtworkUrl;
  }

  return album.artworkPath ? convertFileSrc(album.artworkPath) : null;
}

function AlbumArtPickerModal({
  albumArtist,
  albumTitle,
  currentPreviewUrl,
  selectedArtworkUrl,
  onClose,
  onSelect,
}: {
  albumArtist: string;
  albumTitle: string;
  currentPreviewUrl: string | null;
  selectedArtworkUrl: string | null;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
}) {
  const [candidates, setCandidates] = useState<AlbumArtCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCandidates() {
      setIsLoading(true);
      setError("");

      try {
        const results = await invoke<AlbumArtCandidate[]>("search_album_art", {
          albumArtist,
          albumTitle,
        });

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

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/62 p-5 backdrop-blur-md">
      <div className="win-pane-strong win-modal-entry flex max-h-[86vh] w-full max-w-6xl flex-col overflow-hidden rounded-[1.8rem] border border-white/12 bg-[rgba(18,22,28,0.9)] shadow-[var(--win-shadow-lg)]">
        <div className="flex items-center justify-between border-b border-white/6 px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Cover art</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {albumTitle} • {albumArtist}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/6 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-hidden px-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Preview</div>
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              {currentPreviewUrl ? (
                <img
                  src={selectedArtworkUrl ?? currentPreviewUrl}
                  alt={`${albumTitle} cover preview`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-center text-sm text-zinc-500">
                  No cover selected
                </div>
              )}
            </div>
            <p className="text-sm text-zinc-500">
              Choose a result and it will be downloaded and embedded into the album files when you save.
            </p>
          </div>

          <div className="min-h-0 space-y-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Search results</div>
              {isLoading ? <div className="text-sm text-zinc-500">Searching…</div> : null}
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                Couldn&apos;t load album art results. {error}
              </div>
            ) : null}

            {!isLoading && candidates.length === 0 && !error ? (
              <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-5 text-sm text-zinc-400">
                No cover art candidates were found for this album yet.
              </div>
            ) : null}

            <div className="grid max-h-[66vh] grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-4 overflow-y-auto pr-1">
              {candidates.map((candidate) => {
                const isSelected = selectedArtworkUrl === candidate.image_url;

                return (
                  <button
                    key={candidate.image_url}
                    type="button"
                    onClick={() => onSelect(candidate.image_url)}
                    className={`overflow-hidden rounded-2xl border text-left transition ${
                      isSelected
                        ? "border-emerald-400/80 bg-emerald-400/10"
                        : "border-white/8 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="aspect-square bg-black/20">
                      <img
                        src={candidate.image_url}
                        alt={candidate.label}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="space-y-1 px-3 py-3">
                      <div className="line-clamp-2 text-sm font-medium text-white">
                        {candidate.label}
                      </div>
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        {candidate.source}
                      </div>
                    </div>
                  </button>
                );
              })}
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
  const [selectedArtworkUrl, setSelectedArtworkUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [artPickerOpen, setArtPickerOpen] = useState(false);

  useEffect(() => {
    setAlbumTitle(album.name);
    setAlbumArtist(album.artist);
    setGenre(album.genre ?? "");
    setYear(toInputValue(album.year));
    setTracks(buildInitialTracks(album));
    setSelectedArtworkUrl(null);
    setSaveError("");
    setArtPickerOpen(false);
  }, [album]);

  const previewUrl = useMemo(
    () => buildPreviewUrl(album, selectedArtworkUrl),
    [album, selectedArtworkUrl],
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
        artwork_url: selectedArtworkUrl,
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
      className="fixed inset-x-0 z-[85] flex items-stretch justify-center bg-black/62 p-4 backdrop-blur-md md:p-5"
      style={{
        top: `${topInset}px`,
        bottom: `${bottomInset}px`,
      }}
    >
      <div className="win-pane-strong win-modal-entry relative flex h-full max-h-full w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-white/12 bg-[rgba(18,22,28,0.92)] shadow-[var(--win-shadow-lg)]">
        <div className="flex items-center justify-between border-b border-white/6 px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Edit info</div>
            <div className="mt-1 text-lg font-semibold text-white">{album.name}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/6 hover:text-white"
          >
            Cancel
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-6 overflow-hidden px-6 py-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => setArtPickerOpen(true)}
              className="group block w-full text-left"
            >
              <div className="relative aspect-square overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04] transition group-hover:border-white/20">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`${albumTitle} cover`}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.01] group-hover:brightness-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">
                    Click to search for album art
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/72 to-transparent px-4 py-4 text-sm text-white">
                  {selectedArtworkUrl ? "New cover selected" : "Change cover"}
                </div>
              </div>
            </button>

            <div className="win-pane rounded-[1.5rem] p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Album details</div>
              <div className="mt-4 space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm text-zinc-400">Album title</span>
                  <input
                    value={albumTitle}
                    onChange={(event) => setAlbumTitle(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm text-zinc-400">Album artist</span>
                  <input
                    value={albumArtist}
                    onChange={(event) => setAlbumArtist(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm text-zinc-400">Genre</span>
                    <input
                      value={genre}
                      onChange={(event) => setGenre(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm text-zinc-400">Year</span>
                    <input
                      value={year}
                      onChange={(event) => setYear(event.target.value)}
                      inputMode="numeric"
                      className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="win-pane flex min-h-0 flex-col overflow-hidden rounded-[1.5rem]">
            <div className="grid grid-cols-[90px_minmax(0,2.6fr)_minmax(0,1.6fr)] gap-4 border-b border-white/6 px-5 py-4 text-xs uppercase tracking-[0.22em] text-zinc-500">
              <div>Track #</div>
              <div>Title</div>
              <div>Artist</div>
            </div>

            <div className="min-h-0 overflow-y-auto">
              {tracks.map((track, index) => (
                <div
                  key={track.file_path}
                  className="grid grid-cols-[90px_minmax(0,2.6fr)_minmax(0,1.6fr)] gap-4 border-b border-white/6 px-5 py-3 last:border-b-0"
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
                    className="rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-sm text-white outline-none transition focus:border-white/20"
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
                    className="rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-sm text-white outline-none transition focus:border-white/20"
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
                    className="rounded-lg border border-white/10 bg-[#1c1c1c] px-3 py-2 text-sm text-white outline-none transition focus:border-white/20"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/6 px-6 py-4">
          <div className="min-h-[20px] text-sm text-rose-200">{saveError}</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-zinc-300 transition hover:bg-white/6 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
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
            selectedArtworkUrl={selectedArtworkUrl}
            onClose={() => setArtPickerOpen(false)}
            onSelect={(imageUrl) => {
              setSelectedArtworkUrl(imageUrl);
              setArtPickerOpen(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
