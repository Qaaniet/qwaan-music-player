import type { PlaybackStatePayload, TrackRow } from "../types";
import { PlayIcon } from "./Icons";

type SongTableProps = {
  tracks: TrackRow[];
  playback: PlaybackStatePayload;
  onPlayTrack: (track: TrackRow) => void;
};

export function SongTable({ tracks, playback, onPlayTrack }: SongTableProps) {
  return (
    <div className="win-pane overflow-hidden rounded-[8px]">
      <div className="grid grid-cols-[64px_56px_minmax(0,1.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_92px] gap-3 border-b border-[var(--win-border)] px-5 py-3 text-[11px] uppercase tracking-[0.18em] text-[var(--win-text-tertiary)]">
        <div>Play</div>
        <div>#</div>
        <div>Title</div>
        <div>Artist</div>
        <div>Album</div>
        <div>Year</div>
      </div>

      <div className="divide-y divide-[var(--win-border)]">
        {tracks.map((track) => {
          const isCurrent = playback.current_path === track.file_path;

          return (
            <button
              key={track.file_path}
              type="button"
              onClick={() => onPlayTrack(track)}
              className={`grid w-full grid-cols-[64px_56px_minmax(0,1.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_92px] gap-3 px-5 py-3 text-left transition ${
                isCurrent
                  ? "bg-[rgba(var(--win-accent-rgb),0.12)]"
                  : "bg-transparent hover:bg-[var(--win-pane-hover)]"
              }`}
            >
              <div className="flex items-center">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-[4px] border border-[var(--win-border)] bg-[var(--win-input)] text-[var(--win-text)] transition">
                  <PlayIcon className="ml-0.5 h-4 w-4" />
                </span>
              </div>
              <div className="flex items-center text-[12px] text-[var(--win-text-tertiary)]">{track.track_number ?? "—"}</div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-[var(--win-text)]">{track.title}</div>
                <div className="truncate text-[11.5px] text-[var(--win-text-secondary)]">{track.genre}</div>
              </div>
              <div className="truncate text-[12.5px] text-[var(--win-text-secondary)]">{track.artist}</div>
              <div className="truncate text-[12.5px] text-[var(--win-text-secondary)]">{track.album}</div>
              <div className="text-[12px] text-[var(--win-text-tertiary)]">{track.year ?? "—"}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
