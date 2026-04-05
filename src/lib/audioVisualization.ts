import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { VisualizerMode } from "./personalization";

type DecodedTrackData = {
  duration: number;
  sampleRate: number;
  monoData: Float32Array;
};

type VisualizationFrame = {
  bars: number[];
  wave: number[];
  energy: number;
  low: number;
  mid: number;
  high: number;
};

type UseAudioVisualizationOptions = {
  trackPath: string | null;
  playbackPosition: number;
  playbackDuration: number;
  isPlaying: boolean;
  enabled: boolean;
  mode: VisualizerMode;
  sampleCount?: number;
};

const decodedTrackCache = new Map<string, Promise<DecodedTrackData>>();
let sharedAudioContext: AudioContext | null = null;

function createEmptyFrame(barsCount: number, waveCount: number): VisualizationFrame {
  return {
    bars: new Array(barsCount).fill(0),
    wave: new Array(waveCount).fill(0.5),
    energy: 0,
    low: 0,
    mid: 0,
    high: 0,
  };
}

function getAudioContext() {
  if (!sharedAudioContext) {
    const Context = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

    if (!Context) {
      throw new Error("Web Audio API is not available.");
    }

    sharedAudioContext = new Context();
  }

  return sharedAudioContext;
}

async function decodeTrack(trackPath: string): Promise<DecodedTrackData> {
  const cached = decodedTrackCache.get(trackPath);
  if (cached) {
    return cached;
  }

  const request = fetch(convertFileSrc(trackPath))
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch track for visualization: ${response.status}`);
      }
      return response.arrayBuffer();
    })
    .then(async (buffer) => {
      const audioContext = getAudioContext();
      const decoded = await audioContext.decodeAudioData(buffer.slice(0));
      const channelCount = decoded.numberOfChannels;
      const length = decoded.length;
      const monoData = new Float32Array(length);

      for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        const channel = decoded.getChannelData(channelIndex);
        for (let sampleIndex = 0; sampleIndex < length; sampleIndex += 1) {
          monoData[sampleIndex] += channel[sampleIndex] / channelCount;
        }
      }

      return {
        duration: decoded.duration,
        sampleRate: decoded.sampleRate,
        monoData,
      };
    })
    .catch((error) => {
      decodedTrackCache.delete(trackPath);
      throw error;
    });

  decodedTrackCache.set(trackPath, request);
  return request;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function computeWaveSamples(
  track: DecodedTrackData,
  centerSample: number,
  count: number,
): number[] {
  const stride = Math.max(1, Math.floor(track.sampleRate / 220));
  const start = centerSample - Math.floor((count * stride) / 2);
  const wave = new Array(count).fill(0.5);

  for (let index = 0; index < count; index += 1) {
    const sampleIndex = clamp(start + index * stride, 0, track.monoData.length - 1);
    const amplitude = track.monoData[sampleIndex] ?? 0;
    wave[index] = clamp(0.5 + amplitude * 0.82, 0.08, 0.92);
  }

  return wave;
}

function computeBarSamples(
  track: DecodedTrackData,
  centerSample: number,
  count: number,
): { bars: number[]; low: number; mid: number; high: number; energy: number } {
  const bars = new Array(count).fill(0);
  const analysisWindow = Math.max(1024, Math.floor(track.sampleRate * 0.11));
  const start = clamp(centerSample - Math.floor(analysisWindow / 2), 0, track.monoData.length - 1);
  const end = clamp(start + analysisWindow, start + 1, track.monoData.length);
  const bucketSize = Math.max(12, Math.floor((end - start) / count));

  let totalEnergy = 0;

  for (let barIndex = 0; barIndex < count; barIndex += 1) {
    const barStart = clamp(start + barIndex * bucketSize, 0, end - 1);
    const barEnd = clamp(barStart + bucketSize, barStart + 1, end);
    let sum = 0;
    let weightedMotion = 0;

    for (let sampleIndex = barStart + 1; sampleIndex < barEnd; sampleIndex += 1) {
      const current = track.monoData[sampleIndex] ?? 0;
      const previous = track.monoData[sampleIndex - 1] ?? 0;
      sum += Math.abs(current);
      weightedMotion += Math.abs(current - previous) * (1 + barIndex / count);
    }

    const average = sum / Math.max(1, barEnd - barStart);
    const motion = weightedMotion / Math.max(1, barEnd - barStart);
    const normalized = clamp(average * 1.85 + motion * 1.3, 0, 1);
    bars[barIndex] = normalized;
    totalEnergy += normalized;
  }

  const thirds = Math.max(1, Math.floor(count / 3));
  const averageRange = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

  return {
    bars,
    low: averageRange(bars.slice(0, thirds)),
    mid: averageRange(bars.slice(thirds, thirds * 2)),
    high: averageRange(bars.slice(thirds * 2)),
    energy: totalEnergy / Math.max(1, count),
  };
}

function computeVisualizationFrame(
  track: DecodedTrackData,
  playbackTime: number,
  barsCount: number,
  waveCount: number,
): VisualizationFrame {
  const clampedTime = clamp(playbackTime, 0, Math.max(track.duration, 0));
  const centerSample = clamp(
    Math.floor(clampedTime * track.sampleRate),
    0,
    Math.max(0, track.monoData.length - 1),
  );
  const barsData = computeBarSamples(track, centerSample, barsCount);

  return {
    bars: barsData.bars,
    wave: computeWaveSamples(track, centerSample, waveCount),
    energy: barsData.energy,
    low: barsData.low,
    mid: barsData.mid,
    high: barsData.high,
  };
}

export function useAudioVisualization({
  trackPath,
  playbackPosition,
  playbackDuration,
  isPlaying,
  enabled,
  mode,
  sampleCount = 28,
}: UseAudioVisualizationOptions) {
  const wavePointCount = useMemo(() => Math.max(48, sampleCount * 2), [sampleCount]);
  const [frame, setFrame] = useState<VisualizationFrame>(() =>
    createEmptyFrame(sampleCount, wavePointCount),
  );
  const decodedTrackRef = useRef<DecodedTrackData | null>(null);
  const syncRef = useRef({
    position: playbackPosition,
    timestamp: performance.now(),
  });
  const rafRef = useRef<number | null>(null);
  const frameRef = useRef(frame);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    syncRef.current = {
      position: playbackPosition,
      timestamp: performance.now(),
    };
  }, [isPlaying, playbackPosition, playbackDuration, trackPath]);

  useEffect(() => {
    let cancelled = false;

    if (!trackPath || !enabled) {
      decodedTrackRef.current = null;
      setFrame(createEmptyFrame(sampleCount, wavePointCount));
      return;
    }

    void decodeTrack(trackPath)
      .then((decodedTrack) => {
        if (!cancelled) {
          decodedTrackRef.current = decodedTrack;
        }
      })
      .catch(() => {
        if (!cancelled) {
          decodedTrackRef.current = null;
          setFrame(createEmptyFrame(sampleCount, wavePointCount));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, sampleCount, trackPath, wavePointCount]);

  useEffect(() => {
    if (!enabled) {
      setFrame(createEmptyFrame(sampleCount, wavePointCount));
      return;
    }

    const animate = () => {
      const decodedTrack = decodedTrackRef.current;
      const previous = frameRef.current;

      if (!decodedTrack || !trackPath) {
        const settled = {
          bars: previous.bars.map((value) => lerp(value, 0, 0.12)),
          wave: previous.wave.map((value) => lerp(value, 0.5, 0.12)),
          energy: lerp(previous.energy, 0, 0.12),
          low: lerp(previous.low, 0, 0.12),
          mid: lerp(previous.mid, 0, 0.12),
          high: lerp(previous.high, 0, 0.12),
        };
        frameRef.current = settled;
        setFrame(settled);
        rafRef.current = window.requestAnimationFrame(animate);
        return;
      }

      const now = performance.now();
      const estimatedPosition = isPlaying
        ? syncRef.current.position + (now - syncRef.current.timestamp) / 1000
        : playbackPosition;
      const liveFrame = computeVisualizationFrame(
        decodedTrack,
        estimatedPosition,
        sampleCount,
        wavePointCount,
      );
      const smoothing = isPlaying ? 0.18 : 0.1;
      const nextFrame: VisualizationFrame = {
        bars: previous.bars.map((value, index) =>
          lerp(value, isPlaying ? liveFrame.bars[index] ?? 0 : 0, smoothing),
        ),
        wave: previous.wave.map((value, index) =>
          lerp(value, isPlaying ? liveFrame.wave[index] ?? 0.5 : 0.5, smoothing),
        ),
        energy: lerp(previous.energy, isPlaying ? liveFrame.energy : 0, smoothing),
        low: lerp(previous.low, isPlaying ? liveFrame.low : 0, smoothing),
        mid: lerp(previous.mid, isPlaying ? liveFrame.mid : 0, smoothing),
        high: lerp(previous.high, isPlaying ? liveFrame.high : 0, smoothing),
      };

      frameRef.current = nextFrame;
      setFrame(nextFrame);
      rafRef.current = window.requestAnimationFrame(animate);
    };

    rafRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, isPlaying, mode, playbackPosition, sampleCount, trackPath, wavePointCount]);

  return frame;
}
