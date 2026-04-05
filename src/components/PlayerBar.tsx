import { convertFileSrc } from "@tauri-apps/api/core";
import {
  type ChangeEvent,
  type ReactNode,
  type WheelEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { VisualizerMode } from "../lib/personalization";
import type { PlaybackStatePayload } from "../types";
import { PlayerVisualization } from "./PlayerVisualization";
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  RepeatIcon,
  ShuffleIcon,
  SpeakerIcon,
  StopIcon,
} from "./Icons";

type PlayerBarProps = {
  playback: PlaybackStatePayload;
  artworkPath: string | null;
  trackPath: string | null;
  status: string;
  repeatEnabled: boolean;
  shuffleEnabled: boolean;
  visualizationEnabled: boolean;
  visualizerMode: VisualizerMode;
  onTogglePlayback: () => void;
  onStopPlayback: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  onSeek: (position: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleRepeat: () => void;
  onToggleShuffle: () => void;
};

function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "00:00";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function clampVolume(volume: number) {
  return Math.min(1, Math.max(0.01, volume));
}

function placeholderGradient(seed: string) {
  const tones = [
    "from-zinc-700 via-zinc-500 to-zinc-800",
    "from-cyan-700 via-blue-600 to-indigo-800",
    "from-rose-700 via-fuchsia-600 to-zinc-900",
  ];
  const index = Math.abs([...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % tones.length;
  return tones[index];
}

function GhostControl({
  label,
  children,
  disabled,
  active,
  hidden,
  onClick,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  active?: boolean;
  hidden?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-[4px] transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border border-[var(--win-border-strong)] bg-[linear-gradient(180deg,rgba(var(--win-accent-rgb),0.18),rgba(var(--win-accent-rgb),0.1))] text-[var(--win-text)] shadow-[0_14px_26px_rgba(5,8,13,0.16)]"
          : "text-[var(--win-text-secondary)] hover:bg-[var(--win-pane-hover)] hover:text-[var(--win-text)]"
      } ${hidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      {children}
    </button>
  );
}

function ArtworkThumb({
  artworkPath,
  seed,
}: {
  artworkPath: string | null;
  seed: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [artworkPath]);

  if (artworkPath && !imageFailed) {
    return (
      <img
        src={convertFileSrc(artworkPath)}
        alt=""
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="h-full w-full object-cover"
      />
    );
  }

  return <div className={`h-full w-full bg-gradient-to-br ${placeholderGradient(seed)}`} />;
}

export function PlayerBar({
  playback,
  artworkPath,
  trackPath,
  status,
  repeatEnabled,
  shuffleEnabled,
  visualizationEnabled,
  visualizerMode,
  onTogglePlayback,
  onStopPlayback,
  onNextTrack,
  onPreviousTrack,
  onSeek,
  onVolumeChange,
  onToggleRepeat,
  onToggleShuffle,
}: PlayerBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [barWidth, setBarWidth] = useState(1280);
  const duration =
    Number.isFinite(playback.duration_secs) && playback.duration_secs > 0
      ? playback.duration_secs
      : 0;
  const position = Math.min(playback.position_secs, duration || playback.position_secs);
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;
  const canSeek = Boolean(playback.current_path) && duration > 0;
  const progressBackground =
    duration > 0
      ? `linear-gradient(to right, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.88) ${progressPercent}%, rgba(255,255,255,0.08) ${progressPercent}%, rgba(255,255,255,0.08) 100%)`
      : "rgba(255,255,255,0.08)";
  const volumeValue = Math.max(1, Math.round(playback.volume * 100));
  const hideShuffle = barWidth < 1060;
  const hideRepeat = barWidth < 980;
  const hideVolume = barWidth < 860;

  useLayoutEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth) {
        setBarWidth(nextWidth);
      }
    });

    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  function handleVolumeWheel(event: WheelEvent<HTMLDivElement>) {
    if (!playback.current_path) {
      return;
    }

    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.02 : -0.02;
    onVolumeChange(clampVolume(playback.volume + delta));
  }

  return (
      <footer className="win-app-shell mx-3 mb-3 rounded-[8px] border border-[var(--win-border)] shadow-[var(--win-shadow-sm)]">
      <div className="flex items-center gap-3 px-4 pt-3 text-[12px] text-[var(--win-text-tertiary)]">
        <span className="w-10 text-right">{formatTime(position)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0.1)}
          step={0.1}
          value={duration > 0 ? position : 0}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onSeek(Number(event.target.value))}
          disabled={!canSeek}
          aria-label="Playback progress"
          title={
            playback.current_path && !canSeek
              ? "Seeking becomes available once track duration is known."
              : undefined
          }
          className={`h-1.5 w-full appearance-none rounded-full accent-white ${
            canSeek ? "cursor-pointer" : "cursor-default opacity-40"
          }`}
          style={{ background: progressBackground }}
        />
        <span className="w-10">{formatTime(duration)}</span>
      </div>

      <div ref={rootRef} className="relative h-[92px] overflow-hidden px-4 py-4">
        <PlayerVisualization
          trackPath={trackPath}
          isPlaying={playback.is_playing}
          playbackPosition={position}
          playbackDuration={duration}
          enabled={visualizationEnabled && Boolean(trackPath)}
          mode={visualizerMode}
          compact={barWidth < 1160}
        />

        <div className="absolute inset-y-0 left-4 flex max-w-[44%] min-w-0 items-center gap-3 pr-4">
          <div className="win-pane-strong h-14 w-14 shrink-0 overflow-hidden rounded-[4px] bg-[var(--win-input)] shadow-[var(--win-shadow-sm)]">
            <ArtworkThumb artworkPath={artworkPath} seed={playback.album || playback.title || "Now Playing"} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--win-text)]">
              {playback.title || "Nothing playing"}
            </div>
            <div className="truncate text-[12px] leading-5 text-[var(--win-text-secondary)]">
              {[playback.artist, playback.album].filter(Boolean).join(" • ") || status}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto flex items-center justify-center gap-3">
            <GhostControl
              label="Shuffle"
              active={shuffleEnabled}
              hidden={hideShuffle}
              disabled={!playback.current_path}
              onClick={onToggleShuffle}
            >
              <ShuffleIcon className="h-4 w-4" />
            </GhostControl>
            <GhostControl
              label="Previous"
              disabled={!playback.current_path}
              onClick={onPreviousTrack}
            >
              <PreviousIcon className="h-4 w-4" />
            </GhostControl>
            <button
              type="button"
              onClick={onTogglePlayback}
              disabled={!playback.current_path}
              aria-label={playback.is_playing ? "Pause" : "Play"}
              className="win-button-primary inline-flex h-12 w-12 items-center justify-center rounded-[4px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {playback.is_playing ? (
              <PauseIcon className="h-6 w-6" />
              ) : (
                <PlayIcon className="ml-1 h-6 w-6" />
              )}
            </button>
            <GhostControl
              label="Next"
              disabled={!playback.current_path}
              onClick={onNextTrack}
            >
              <NextIcon className="h-4 w-4" />
            </GhostControl>
            <GhostControl
              label="Stop"
              disabled={!playback.current_path}
              onClick={onStopPlayback}
            >
              <StopIcon className="h-4 w-4" />
            </GhostControl>
            <GhostControl
              label="Repeat queue"
              active={repeatEnabled}
              hidden={hideRepeat}
              disabled={!playback.current_path}
              onClick={onToggleRepeat}
            >
              <RepeatIcon className="h-4 w-4" />
            </GhostControl>
          </div>
        </div>

        <div className="absolute inset-y-0 right-4 flex items-center">
          <div
            className={`flex-col items-end gap-1.5 text-[var(--win-text-secondary)] transition ${
              hideVolume ? "pointer-events-none opacity-0" : "flex opacity-100"
            }`}
            onWheel={handleVolumeWheel}
          >
            <div className="text-[11px] font-medium tracking-[0.18em] text-[var(--win-text-tertiary)]">{volumeValue}</div>
            <div className="flex items-center gap-3">
              <SpeakerIcon className="h-4 w-4 text-[var(--win-text-secondary)]" />
              <input
                type="range"
                min={0.01}
                max={1}
                step={0.01}
                value={clampVolume(playback.volume)}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onVolumeChange(clampVolume(Number(event.target.value)))
                }
                className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-[color-mix(in_srgb,var(--win-text)_12%,transparent)] accent-[var(--win-accent-strong)]"
              />
            </div>
          </div>
          {hideVolume ? (
            <div className="text-[13px] text-[var(--win-text-tertiary)]">{volumeValue}</div>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
