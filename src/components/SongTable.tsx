import type { PlaybackStatePayload, TrackRow } from "../types";
import { PlayIcon } from "./Icons";

type SongTableProps = {
  tracks: TrackRow[];
  playback: PlaybackStatePayload;
  onPlayTrack: (track: TrackRow) => void;
};

export function SongTable({ tracks, playback, onPlayTrack }: SongTableProps) {
  return (
    <div className="win-pane overflow-hidden rounded-[22px]">
      <div className="grid grid-cols-[72px_72px_minmax(0,1.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_110px] gap-3 border-b border-white/8 px-6 py-4 text-[11px] uppercase tracking-[0.18em] text-white/42">
        <div>Play</div>
        <div>#</div>
        <div>Title</div>
        <div>Artist</div>
        <div>Album</div>
        <div>Year</div>
      </div>

      <div className="divide-y divide-white/6">
        {tracks.map((track) => {
          const isCurrent = playback.current_path === track.file_path;

          return (
            <button
              key={track.file_path}
              type="button"
              onClick={() => onPlayTrack(track)}
              className={`grid w-full grid-cols-[72px_72px_minmax(0,1.8fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_110px] gap-3 px-6 py-4 text-left transition ${
                isCurrent
                  ? "bg-[rgba(127,179,255,0.14)]"
                  : "bg-transparent hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/88 transition">
                  <PlayIcon className="ml-0.5 h-4 w-4" />
                </span>
              </div>
              <div className="flex items-center text-[13px] text-white/42">{track.track_number ?? "—"}</div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-white/92">{track.title}</div>
                <div className="truncate text-[11px] text-white/48">{track.genre}</div>
              </div>
              <div className="truncate text-[13px] text-white/72">{track.artist}</div>
              <div className="truncate text-[13px] text-white/56">{track.album}</div>
              <div className="text-[13px] text-white/42">{track.year ?? "—"}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
