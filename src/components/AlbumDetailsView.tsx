import { convertFileSrc } from "@tauri-apps/api/core";
import { memo, useMemo, useState } from "react";
import type {
  AlbumSummary,
  PlaybackStatePayload,
  SaveAlbumMetadataPayload,
  SaveAlbumMetadataResult,
  TrackRow,
} from "../types";
import { AlbumEditModal } from "./AlbumEditModal";
import { PlayIcon } from "./Icons";

type AlbumDetailsViewProps = {
  album: AlbumSummary;
  playback: PlaybackStatePayload;
  topInset: number;
  bottomInset: number;
  onBack: () => void;
  onOpenArtist: (artist: string) => void;
  onPlayTrack: (track: TrackRow, queue: TrackRow[]) => void;
  onShuffleAlbum: (album: AlbumSummary) => void;
  onSaveMetadata: (payload: SaveAlbumMetadataPayload) => Promise<SaveAlbumMetadataResult>;
};

function coverStyle(seed: string) {
  const gradients = [
    "from-amber-500 via-rose-500 to-fuchsia-500",
    "from-cyan-500 via-blue-600 to-indigo-700",
    "from-emerald-400 via-teal-500 to-cyan-700",
    "from-orange-500 via-red-500 to-pink-600",
    "from-stone-500 via-zinc-800 to-black",
    "from-lime-400 via-green-500 to-emerald-700",
  ];

  const index = Math.abs(
    [...seed].reduce((total, char) => total + char.charCodeAt(0), 0),
  ) % gradients.length;

  return gradients[index];
}

function formatTrackCount(count: number) {
  return `${count} ${count === 1 ? "song" : "songs"}`;
}

const AlbumCover = memo(function AlbumCover({
  album,
}: {
  album: AlbumSummary;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const artworkUrl = album.artworkPath && !imageFailed ? convertFileSrc(album.artworkPath) : null;

  if (artworkUrl) {
    return (
      <img
        src={artworkUrl}
        alt={`${album.name} cover`}
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  return <div className={`absolute inset-0 bg-gradient-to-br ${coverStyle(album.key)}`} />;
});

export function AlbumDetailsView({
  album,
  playback,
  topInset,
  bottomInset,
  onBack,
  onOpenArtist,
  onPlayTrack,
  onShuffleAlbum,
  onSaveMetadata,
}: AlbumDetailsViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const albumGenre = useMemo(() => {
    const genres = [...new Set(album.tracks.map((track) => track.genre).filter(Boolean))];
    return genres[0] ?? "Unknown genre";
  }, [album.tracks]);

  return (
    <div className="relative min-h-full space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[13px] text-white/56 transition hover:text-white/88"
      >
        <span aria-hidden="true">←</span>
        Back to albums
      </button>

      <section className="win-pane rounded-[24px] px-6 py-7">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end">
          <div className="relative h-[220px] w-[220px] shrink-0 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] shadow-[0_18px_34px_rgba(0,0,0,0.22)]">
            <AlbumCover album={album} />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.48),rgba(0,0,0,0.08))]" />
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Album</div>
              <h2 className="text-[2.7rem] font-semibold tracking-[-0.04em] text-white/96">{album.name}</h2>
              <button
                type="button"
                onClick={() => onOpenArtist(album.artist)}
                className="text-[18px] text-white/72 transition hover:text-[var(--win-accent-strong)] hover:underline hover:decoration-[rgba(var(--win-accent-rgb),0.42)] hover:underline-offset-4"
              >
                {album.artist}
              </button>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-white/50">
                <span>{album.year ?? "Unknown year"}</span>
                <span className="text-white/24">•</span>
                <span>{albumGenre}</span>
                <span className="text-zinc-700">•</span>
                <span>{formatTrackCount(album.tracks.length)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const leadTrack = album.tracks[0];
                  if (leadTrack) {
                    onPlayTrack(leadTrack, album.tracks);
                  }
                }}
                className="win-button-primary inline-flex h-11 items-center gap-2 rounded-[14px] px-5 text-[13px] font-semibold"
              >
                <PlayIcon className="ml-0.5 h-4 w-4" />
                Play all
              </button>
              <button
                type="button"
                onClick={() => onShuffleAlbum(album)}
                className="win-button inline-flex h-11 items-center rounded-[14px] px-5 text-[13px] font-medium"
              >
                Shuffle and play
              </button>
              <button
                type="button"
                disabled
                className="win-button inline-flex h-11 items-center rounded-[14px] px-5 text-[13px] font-medium text-white/36"
              >
                Add to
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="win-button inline-flex h-11 items-center rounded-[14px] px-5 text-[13px] font-medium text-white/80"
              >
                Edit info
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="win-pane overflow-hidden rounded-[22px]">
        <div className="grid grid-cols-[72px_minmax(0,2.2fr)_minmax(0,1.3fr)_90px_120px_90px] gap-4 border-b border-white/8 px-6 py-4 text-[11px] uppercase tracking-[0.18em] text-white/40">
          <div>#</div>
          <div>Title</div>
          <div>Artist</div>
          <div>Year</div>
          <div>Genre</div>
          <div className="text-right">Duration</div>
        </div>

        <div className="divide-y divide-white/6">
          {album.tracks.map((track) => {
            const isCurrent = playback.current_path === track.file_path;

            return (
              <button
                key={track.file_path}
                type="button"
                onClick={() => onPlayTrack(track, album.tracks)}
                className={`grid w-full grid-cols-[72px_minmax(0,2.2fr)_minmax(0,1.3fr)_90px_120px_90px] gap-4 px-6 py-3.5 text-left transition ${
                  isCurrent
                    ? "bg-[rgba(127,179,255,0.14)]"
                    : "bg-transparent hover:bg-white/[0.05]"
                }`}
              >
                <div className="text-[13px] text-white/42">{track.track_number ?? "—"}</div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-white/92">{track.title}</div>
                </div>
                <div className="truncate text-[13px] text-white/72">{track.artist}</div>
                <div className="text-[13px] text-white/42">{track.year ?? "—"}</div>
                <div className="truncate text-[13px] text-white/42">{track.genre || "—"}</div>
                <div className="text-right text-[13px] text-white/42">--:--</div>
              </button>
            );
          })}
        </div>
      </section>

      {isEditing ? (
        <AlbumEditModal
          album={album}
          topInset={topInset}
          bottomInset={bottomInset}
          onClose={() => setIsEditing(false)}
          onSave={onSaveMetadata}
        />
      ) : null}
    </div>
  );
}
