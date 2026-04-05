const themeCache = new Map<string, ArtworkThemePalette>();

type HslColor = {
  h: number;
  s: number;
  l: number;
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type PaletteCandidate = {
  hsl: HslColor;
  rgb: RgbColor;
  score: number;
};

export type ArtworkThemePalette = {
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentGlow: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fallbackAccentFromKey(key: string) {
  const value = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hue = value % 360;
  const rgb = hslToRgb({ h: hue, s: 0.72, l: 0.6 });
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace("#", "").trim();
  const full = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;
  const value = Number.parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHsl(red: number, green: number, blue: number): HslColor {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  if (delta !== 0) {
    switch (max) {
      case r:
        h = 60 * (((g - b) / delta) % 6);
        break;
      case g:
        h = 60 * ((b - r) / delta + 2);
        break;
      default:
        h = 60 * ((r - g) / delta + 4);
        break;
    }
  }

  return {
    h: h < 0 ? h + 360 : h,
    s,
    l,
  };
}

function hslToRgb({ h, s, l }: HslColor): RgbColor {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const huePrime = h / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (huePrime >= 0 && huePrime < 1) {
    r = chroma;
    g = x;
  } else if (huePrime < 2) {
    r = x;
    g = chroma;
  } else if (huePrime < 3) {
    g = chroma;
    b = x;
  } else if (huePrime < 4) {
    g = x;
    b = chroma;
  } else if (huePrime < 5) {
    r = x;
    b = chroma;
  } else {
    r = chroma;
    b = x;
  }

  const match = l - chroma / 2;
  return {
    r: (r + match) * 255,
    g: (g + match) * 255,
    b: (b + match) * 255,
  };
}

function normalizePrimaryAccent(hsl: HslColor): HslColor {
  return {
    h: hsl.h,
    s: clamp(hsl.s, 0.5, 0.86),
    l: clamp(hsl.l, 0.42, 0.6),
  };
}

function createDerivedTone(hsl: HslColor, saturationDelta: number, lightnessDelta: number): string {
  const rgb = hslToRgb({
    h: hsl.h,
    s: clamp(hsl.s + saturationDelta, 0.2, 0.92),
    l: clamp(hsl.l + lightnessDelta, 0.18, 0.78),
  });
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

function chooseFallbackPalette(cacheKey: string): ArtworkThemePalette {
  const accent = fallbackAccentFromKey(cacheKey);
  const rgb = hexToRgb(accent);
  const hsl = normalizePrimaryAccent(rgbToHsl(rgb.r, rgb.g, rgb.b));
  return {
    accent: rgbToHex(...valuesToRgbTuple(hslToRgb(hsl))),
    accentStrong: createDerivedTone(hsl, 0.06, 0.1),
    accentSoft: createDerivedTone(hsl, -0.12, 0.02),
    accentGlow: createDerivedTone(hsl, -0.08, -0.1),
  };
}

function colorDistance(first: HslColor, second: HslColor) {
  const hueDistance = Math.min(
    Math.abs(first.h - second.h),
    360 - Math.abs(first.h - second.h),
  ) / 180;
  return hueDistance + Math.abs(first.s - second.s) + Math.abs(first.l - second.l);
}

function selectThemePalette(candidates: PaletteCandidate[], cacheKey: string): ArtworkThemePalette {
  if (candidates.length === 0) {
    return chooseFallbackPalette(cacheKey);
  }

  const primary = candidates[0];
  const secondary =
    candidates.find((candidate) => colorDistance(primary.hsl, candidate.hsl) > 0.34) ?? primary;
  const chosenPrimary = normalizePrimaryAccent(primary.hsl);
  const chosenSecondary = normalizePrimaryAccent({
    h: secondary.hsl.h,
    s: clamp(secondary.hsl.s, 0.34, 0.72),
    l: clamp(secondary.hsl.l, 0.3, 0.48),
  });

  const accentRgb = hslToRgb(chosenPrimary);
  return {
    accent: rgbToHex(accentRgb.r, accentRgb.g, accentRgb.b),
    accentStrong: createDerivedTone(chosenPrimary, 0.06, 0.12),
    accentSoft: createDerivedTone(chosenPrimary, -0.2, 0.04),
    accentGlow: createDerivedTone(chosenSecondary, -0.08, -0.08),
  };
}

function buildPaletteCandidates(data: Uint8ClampedArray): PaletteCandidate[] {
  const buckets = new Map<number, {
    weight: number;
    red: number;
    green: number;
    blue: number;
    saturation: number;
    lightness: number;
  }>();

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;
    if (alpha < 0.7) {
      continue;
    }

    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const hsl = rgbToHsl(red, green, blue);

    if (hsl.s < 0.16 || hsl.l < 0.08 || hsl.l > 0.92) {
      continue;
    }

    const vibrance = Math.max(0, hsl.s - 0.18);
    const midtonePreference = 1 - Math.abs(hsl.l - 0.5) / 0.5;
    const darknessPenalty = hsl.l < 0.24 ? 0.45 : 1;
    const brightnessPenalty = hsl.l > 0.78 ? 0.65 : 1;
    const weight =
      alpha *
      (0.34 + vibrance * 1.25 + midtonePreference * 0.55) *
      darknessPenalty *
      brightnessPenalty;

    if (weight <= 0.12) {
      continue;
    }

    const bucketKey =
      Math.round(hsl.h / 15) * 15 * 10_000 +
      Math.round(hsl.s * 10) * 100 +
      Math.round(hsl.l * 10);
    const bucket = buckets.get(bucketKey) ?? {
      weight: 0,
      red: 0,
      green: 0,
      blue: 0,
      saturation: 0,
      lightness: 0,
    };

    bucket.weight += weight;
    bucket.red += red * weight;
    bucket.green += green * weight;
    bucket.blue += blue * weight;
    bucket.saturation += hsl.s * weight;
    bucket.lightness += hsl.l * weight;
    buckets.set(bucketKey, bucket);
  }

  return [...buckets.values()]
    .filter((bucket) => bucket.weight > 0)
    .map((bucket) => {
      const rgb = {
        r: bucket.red / bucket.weight,
        g: bucket.green / bucket.weight,
        b: bucket.blue / bucket.weight,
      };
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      const clarityScore =
        clamp((hsl.s - 0.24) / 0.56, 0, 1) * 0.58 +
        clamp(1 - Math.abs(hsl.l - 0.52) / 0.34, 0, 1) * 0.42;
      return {
        hsl,
        rgb,
        score: bucket.weight * (0.65 + clarityScore),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
}

function valuesToRgbTuple(color: RgbColor): [number, number, number] {
  return [color.r, color.g, color.b];
}

export async function extractThemeFromArtwork(
  imageSrc: string,
  cacheKey: string,
): Promise<ArtworkThemePalette> {
  const cached = themeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const image = new Image();
  image.decoding = "async";
  image.crossOrigin = "anonymous";
  image.src = imageSrc;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Artwork load failed"));
  });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    const fallback = chooseFallbackPalette(cacheKey);
    themeCache.set(cacheKey, fallback);
    return fallback;
  }

  const width = 48;
  const height = 48;
  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  const palette = selectThemePalette(buildPaletteCandidates(data), cacheKey);
  themeCache.set(cacheKey, palette);
  return palette;
}

export function blendArtworkTheme(
  artworkTheme: ArtworkThemePalette,
  manualAccent: string,
  blendAmount: number,
): ArtworkThemePalette {
  const manualRgb = hexToRgb(manualAccent);
  const manualHsl = normalizePrimaryAccent(
    rgbToHsl(manualRgb.r, manualRgb.g, manualRgb.b),
  );
  const sourceColors = [
    artworkTheme.accent,
    artworkTheme.accentStrong,
    artworkTheme.accentSoft,
    artworkTheme.accentGlow,
  ];

  const mixed = sourceColors.map((color) => {
    const rgb = hexToRgb(color);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const blend = clamp(blendAmount, 0, 1);
    const hueDelta = ((manualHsl.h - hsl.h + 540) % 360) - 180;
    const mixedHsl = {
      h: (hsl.h + hueDelta * blend + 360) % 360,
      s: clamp(hsl.s + (manualHsl.s - hsl.s) * blend, 0.2, 0.9),
      l: clamp(hsl.l + (manualHsl.l - hsl.l) * blend, 0.18, 0.78),
    };
    const mixedRgb = hslToRgb(mixedHsl);
    return rgbToHex(...valuesToRgbTuple(mixedRgb));
  });

  return {
    accent: mixed[0],
    accentStrong: mixed[1],
    accentSoft: mixed[2],
    accentGlow: mixed[3],
  };
}
