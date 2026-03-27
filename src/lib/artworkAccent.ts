const accentCache = new Map<string, string>();

type HslColor = {
  h: number;
  s: number;
  l: number;
};

function fallbackAccentFromKey(key: string) {
  const value = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hue = value % 360;
  return `hsl(${hue} 72% 60%)`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
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

function hslToRgb({ h, s, l }: HslColor) {
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

function normalizeAccent(hsl: HslColor) {
  const usableSaturation = clamp(hsl.s, 0.44, 0.82);
  const usableLightness = clamp(hsl.l, 0.40, 0.62);
  return {
    h: hsl.h,
    s: usableSaturation,
    l: usableLightness,
  };
}

export async function extractAccentFromArtwork(imageSrc: string, cacheKey: string) {
  const cached = accentCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const image = new Image();
  image.decoding = "async";
  image.src = imageSrc;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Artwork load failed"));
  });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    const fallback = fallbackAccentFromKey(cacheKey);
    accentCache.set(cacheKey, fallback);
    return fallback;
  }

  const width = 36;
  const height = 36;
  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  const buckets = new Map<number, { weight: number; red: number; green: number; blue: number }>();
  let fallbackWeight = 0;
  let fallbackRed = 0;
  let fallbackGreen = 0;
  let fallbackBlue = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;
    if (alpha < 0.65) {
      continue;
    }

    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const hsl = rgbToHsl(red, green, blue);
    const chromaWeight = hsl.s * alpha;
    const luminanceDistance = 1 - Math.abs(hsl.l - 0.52);
    const candidateWeight = chromaWeight * Math.max(0.2, luminanceDistance);

    fallbackRed += red * candidateWeight;
    fallbackGreen += green * candidateWeight;
    fallbackBlue += blue * candidateWeight;
    fallbackWeight += candidateWeight;

    if (hsl.s < 0.14 || hsl.l < 0.12 || hsl.l > 0.88) {
      continue;
    }

    const bucketKey = Math.round(hsl.h / 18) * 18;
    const bucket = buckets.get(bucketKey) ?? {
      weight: 0,
      red: 0,
      green: 0,
      blue: 0,
    };

    bucket.weight += candidateWeight;
    bucket.red += red * candidateWeight;
    bucket.green += green * candidateWeight;
    bucket.blue += blue * candidateWeight;
    buckets.set(bucketKey, bucket);
  }

  let chosenHex = fallbackAccentFromKey(cacheKey);

  if (buckets.size > 0) {
    const bestBucket = [...buckets.values()].sort((left, right) => right.weight - left.weight)[0];
    const baseHsl = rgbToHsl(
      bestBucket.red / bestBucket.weight,
      bestBucket.green / bestBucket.weight,
      bestBucket.blue / bestBucket.weight,
    );
    const normalized = normalizeAccent(baseHsl);
    const rgb = hslToRgb(normalized);
    chosenHex = rgbToHex(rgb.r, rgb.g, rgb.b);
  } else if (fallbackWeight > 0) {
    const fallbackHsl = rgbToHsl(
      fallbackRed / fallbackWeight,
      fallbackGreen / fallbackWeight,
      fallbackBlue / fallbackWeight,
    );
    const normalized = normalizeAccent({
      h: fallbackHsl.h,
      s: Math.max(0.48, fallbackHsl.s),
      l: clamp(fallbackHsl.l, 0.42, 0.6),
    });
    const rgb = hslToRgb(normalized);
    chosenHex = rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  accentCache.set(cacheKey, chosenHex);
  return chosenHex;
}
