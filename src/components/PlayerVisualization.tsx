import { memo, useMemo } from "react";
import { useAudioVisualization } from "../lib/audioVisualization";
import type { VisualizerMode } from "../lib/personalization";

type PlayerVisualizationProps = {
  trackPath: string | null;
  isPlaying: boolean;
  playbackPosition: number;
  playbackDuration: number;
  enabled: boolean;
  mode: VisualizerMode;
  compact?: boolean;
};

function BarsVisualization({ bars }: { bars: number[] }) {
  return (
    <div className="flex h-full items-end justify-center gap-1.5">
      {bars.map((value, index) => (
        <span
          key={`bar-${index}`}
          className="block w-[5px] rounded-full bg-[linear-gradient(180deg,var(--win-accent-strong),rgba(var(--win-accent-rgb),0.28))] shadow-[0_0_18px_rgba(var(--win-accent-rgb),0.22)]"
          style={{
            height: `${18 + value * 58}%`,
            opacity: 0.3 + value * 0.7,
            transform: `scaleY(${0.72 + value * 0.5})`,
          }}
        />
      ))}
    </div>
  );
}

function WaveVisualization({ wave }: { wave: number[] }) {
  const path = useMemo(() => {
    if (wave.length === 0) {
      return "M0,24 L100,24";
    }

    return wave
      .map((value, index) => {
        const x = (index / Math.max(1, wave.length - 1)) * 100;
        const y = 44 - value * 32;
        return `${index === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  }, [wave]);

  return (
    <svg viewBox="0 0 100 48" preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="player-wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(var(--win-accent-soft-rgb),0.3)" />
          <stop offset="55%" stopColor="var(--win-accent-strong)" />
          <stop offset="100%" stopColor="rgba(var(--win-accent-rgb),0.55)" />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
        stroke="url(#player-wave-gradient)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-[0_0_16px_rgba(var(--win-accent-rgb),0.24)]"
      />
    </svg>
  );
}

function GlowVisualization({
  energy,
  low,
  mid,
  high,
}: {
  energy: number;
  low: number;
  mid: number;
  high: number;
}) {
  return (
    <div className="relative h-full w-full">
      <div
        className="absolute left-[12%] top-[18%] h-16 w-16 rounded-full bg-[radial-gradient(circle,rgba(var(--win-accent-rgb),0.38),transparent_72%)] blur-xl"
        style={{
          opacity: 0.16 + low * 0.55,
          transform: `scale(${0.8 + low * 0.5})`,
        }}
      />
      <div
        className="absolute left-1/2 top-[8%] h-20 w-20 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(var(--win-accent-strong-rgb),0.42),transparent_74%)] blur-[18px]"
        style={{
          opacity: 0.18 + energy * 0.6,
          transform: `translateX(-50%) scale(${0.82 + energy * 0.48})`,
        }}
      />
      <div
        className="absolute right-[14%] top-[22%] h-14 w-14 rounded-full bg-[radial-gradient(circle,rgba(var(--win-accent-soft-rgb),0.34),transparent_72%)] blur-xl"
        style={{
          opacity: 0.14 + high * 0.48,
          transform: `scale(${0.78 + high * 0.46})`,
        }}
      />
      <div
        className="absolute inset-x-[20%] bottom-[16%] h-3 rounded-full bg-[linear-gradient(90deg,rgba(var(--win-accent-rgb),0.14),rgba(var(--win-accent-strong-rgb),0.68),rgba(var(--win-accent-soft-rgb),0.14))] blur-[2px]"
        style={{
          opacity: 0.18 + mid * 0.55,
          transform: `scaleX(${0.7 + mid * 0.42})`,
        }}
      />
    </div>
  );
}

export const PlayerVisualization = memo(function PlayerVisualization({
  trackPath,
  isPlaying,
  playbackPosition,
  playbackDuration,
  enabled,
  mode,
  compact = false,
}: PlayerVisualizationProps) {
  const frame = useAudioVisualization({
    trackPath,
    isPlaying,
    playbackPosition,
    playbackDuration,
    enabled,
    mode,
    sampleCount: compact ? 18 : 28,
  });

  if (!enabled) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-x-[18%] bottom-1 top-2 overflow-hidden rounded-[26px]">
      <div className="absolute inset-0 rounded-[26px] bg-[linear-gradient(180deg,rgba(var(--win-accent-rgb),0.08),rgba(var(--win-accent-rgb),0.02))] opacity-70" />
      <div className="absolute inset-[1px] rounded-[25px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.005))]" />
      <div className="absolute inset-x-6 bottom-3 top-3">
        <div
          className={`h-full w-full transition-opacity duration-300 ${
            compact ? "opacity-78" : "opacity-100"
          }`}
        >
          {mode === "bars" ? (
            <BarsVisualization bars={frame.bars} />
          ) : mode === "wave" ? (
            <WaveVisualization wave={frame.wave} />
          ) : (
            <GlowVisualization
              energy={frame.energy}
              low={frame.low}
              mid={frame.mid}
              high={frame.high}
            />
          )}
        </div>
      </div>
    </div>
  );
});
