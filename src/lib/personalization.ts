export type ThemeMode = "dark" | "light" | "auto";
export type AccentMode = "album" | "manual" | "blend";
export type DensityMode = "compact" | "comfortable" | "spacious";
export type MaterialMode = "mica" | "acrylic" | "solid";
export type AnimationIntensity = "minimal" | "balanced" | "fluid";
export type AlbumArtMode = "floating" | "classic" | "full-bleed" | "vinyl";
export type LayoutMode =
  | "full-library"
  | "minimal-player"
  | "sidebar-focused"
  | "album-centric"
  | "compact-desktop";
export type VisualizerMode = "bars" | "wave" | "glow";
export type EqualizerPreset = "Flat" | "Focus" | "Gym" | "Late Night" | "Chill";

export type AppearanceSettings = {
  themeMode: ThemeMode;
  darkModeBias: boolean;
  accentMode: AccentMode;
  manualAccent: string;
  blendAmount: number;
  accentIntensity: number;
  density: DensityMode;
  material: MaterialMode;
  blurStrength: number;
  transparency: number;
  panelTransparency: number;
  albumArtMode: AlbumArtMode;
  fontScale: number;
  motionIntensity: AnimationIntensity;
  lofiOverlay: boolean;
  timeOfDayTheme: boolean;
};

export type PlaybackCustomizationSettings = {
  resumeLastSession: boolean;
  showResumePrompt: boolean;
  crossfadeEnabled: boolean;
  crossfadeSeconds: number;
  smoothProgress: boolean;
  visualizationEnabled: boolean;
  visualizerMode: VisualizerMode;
};

export type AudioCustomizationSettings = {
  equalizerPreset: EqualizerPreset;
  customEqBands: number[];
  outputMemoryEnabled: boolean;
};

export type LayoutPreset = {
  id: string;
  name: string;
  mode: LayoutMode;
  sidebarCollapsed: boolean;
  showQueuePanel: boolean;
  showVisualizer: boolean;
  showArtistInfo: boolean;
  showLyrics: boolean;
};

export type LayoutCustomizationSettings = {
  activePresetId: string;
  activeMode: LayoutMode;
  presets: LayoutPreset[];
};

export type LibraryCustomizationSettings = {
  pinnedGenres: string[];
  pinnedArtists: string[];
  showFavoritesFirst: boolean;
  browseByMood: boolean;
  lookUpMissingInfoOnline: boolean;
};

export type AdvancedCustomizationSettings = {
  commandPaletteEnabled: boolean;
  shortcutSystemEnabled: boolean;
  debugLayoutMetrics: boolean;
};

export type ListeningProfile = {
  id: string;
  name: string;
  description: string;
  appearance: AppearanceSettings;
  playback: PlaybackCustomizationSettings;
  audio: AudioCustomizationSettings;
  layoutPresetId: string;
  volume: number;
  shuffleEnabled: boolean;
  repeatEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppPreferences = {
  version: 1;
  appearance: AppearanceSettings;
  playback: PlaybackCustomizationSettings;
  audio: AudioCustomizationSettings;
  layout: LayoutCustomizationSettings;
  library: LibraryCustomizationSettings;
  advanced: AdvancedCustomizationSettings;
  activeProfileId: string;
  profiles: ListeningProfile[];
};

const STORAGE_KEY = "qwaan.appPreferences";

export const defaultLayoutPresets: LayoutPreset[] = [
  {
    id: "full-library",
    name: "Full Library",
    mode: "full-library",
    sidebarCollapsed: false,
    showQueuePanel: false,
    showVisualizer: false,
    showArtistInfo: true,
    showLyrics: false,
  },
  {
    id: "focus-mode",
    name: "Focus Mode",
    mode: "minimal-player",
    sidebarCollapsed: true,
    showQueuePanel: false,
    showVisualizer: false,
    showArtistInfo: false,
    showLyrics: false,
  },
  {
    id: "album-stage",
    name: "Album Stage",
    mode: "album-centric",
    sidebarCollapsed: false,
    showQueuePanel: false,
    showVisualizer: true,
    showArtistInfo: true,
    showLyrics: false,
  },
];

export const defaultAppearanceSettings: AppearanceSettings = {
  themeMode: "dark",
  darkModeBias: true,
  accentMode: "album",
  manualAccent: "#7fb3ff",
  blendAmount: 0.45,
  accentIntensity: 0.7,
  density: "comfortable",
  material: "mica",
  blurStrength: 0.72,
  transparency: 0.62,
  panelTransparency: 0.56,
  albumArtMode: "floating",
  fontScale: 1,
  motionIntensity: "balanced",
  lofiOverlay: false,
  timeOfDayTheme: false,
};

export const defaultPlaybackCustomization: PlaybackCustomizationSettings = {
  resumeLastSession: true,
  showResumePrompt: true,
  crossfadeEnabled: false,
  crossfadeSeconds: 4,
  smoothProgress: true,
  visualizationEnabled: true,
  visualizerMode: "wave",
};

export const defaultAudioCustomization: AudioCustomizationSettings = {
  equalizerPreset: "Flat",
  customEqBands: [0, 0, 0, 0, 0],
  outputMemoryEnabled: true,
};

export const defaultLibraryCustomization: LibraryCustomizationSettings = {
  pinnedGenres: [],
  pinnedArtists: [],
  showFavoritesFirst: false,
  browseByMood: false,
  lookUpMissingInfoOnline: true,
};

export const defaultAdvancedCustomization: AdvancedCustomizationSettings = {
  commandPaletteEnabled: true,
  shortcutSystemEnabled: true,
  debugLayoutMetrics: false,
};

function resolveVisualizerMode(
  mode: unknown,
  fallback: VisualizerMode,
): VisualizerMode {
  if (mode === "bars" || mode === "wave" || mode === "glow") {
    return mode;
  }

  if (mode === "immersive") {
    return "glow";
  }

  if (mode === "subtle") {
    return "wave";
  }

  return fallback;
}

function resolveVisualizationEnabled(
  value: unknown,
  legacyMode: unknown,
  fallback: boolean,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (legacyMode === "off") {
    return false;
  }

  return fallback;
}

function createDefaultProfile(id: string, name: string, description: string): ListeningProfile {
  const timestamp = new Date().toISOString();

  return {
    id,
    name,
    description,
    appearance: { ...defaultAppearanceSettings },
    playback: { ...defaultPlaybackCustomization },
    audio: { ...defaultAudioCustomization },
    layoutPresetId: defaultLayoutPresets[0].id,
    volume: 0.72,
    shuffleEnabled: false,
    repeatEnabled: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createDefaultPreferences(): AppPreferences {
  return {
    version: 1,
    appearance: { ...defaultAppearanceSettings },
    playback: { ...defaultPlaybackCustomization },
    audio: { ...defaultAudioCustomization },
    layout: {
      activePresetId: defaultLayoutPresets[0].id,
      activeMode: defaultLayoutPresets[0].mode,
      presets: defaultLayoutPresets.map((preset) => ({ ...preset })),
    },
    library: { ...defaultLibraryCustomization },
    advanced: { ...defaultAdvancedCustomization },
    activeProfileId: "profile-focus",
    profiles: [
      createDefaultProfile("profile-focus", "Focus", "Muted surfaces, calm motion, and a distraction-free layout."),
      {
        ...createDefaultProfile("profile-gym", "Gym", "Stronger accent energy, shuffle-first playback, and vivid motion."),
        appearance: {
          ...defaultAppearanceSettings,
          accentMode: "blend",
          accentIntensity: 0.88,
          motionIntensity: "fluid",
        },
        playback: {
          ...defaultPlaybackCustomization,
          crossfadeEnabled: true,
          crossfadeSeconds: 6,
          visualizerMode: "bars",
        },
        audio: {
          ...defaultAudioCustomization,
          equalizerPreset: "Gym",
        },
        shuffleEnabled: true,
        volume: 0.84,
      },
      {
        ...createDefaultProfile("profile-late-night", "Late Night", "Lower contrast, softer motion, and calmer playback energy."),
        appearance: {
          ...defaultAppearanceSettings,
          accentMode: "manual",
          manualAccent: "#9a8cff",
          accentIntensity: 0.45,
          motionIntensity: "minimal",
          lofiOverlay: true,
        },
        playback: {
          ...defaultPlaybackCustomization,
          visualizationEnabled: false,
          visualizerMode: "glow",
        },
        audio: {
          ...defaultAudioCustomization,
          equalizerPreset: "Late Night",
        },
        volume: 0.52,
      },
    ],
  };
}

function mergePreferences(candidate: unknown): AppPreferences {
  const defaults = createDefaultPreferences();

  if (!candidate || typeof candidate !== "object") {
    return defaults;
  }

  const parsed = candidate as Partial<AppPreferences>;
  const parsedPlayback = parsed.playback;
  const legacyParsedPlayback = parsedPlayback as
    | (Partial<PlaybackCustomizationSettings> & { visualizerMode?: string })
    | undefined;
  const resolvedVisualizerMode = resolveVisualizerMode(
    legacyParsedPlayback?.visualizerMode,
    defaults.playback.visualizerMode,
  );
  const resolvedVisualizationEnabled = resolveVisualizationEnabled(
    legacyParsedPlayback?.visualizationEnabled,
    legacyParsedPlayback?.visualizerMode,
    defaults.playback.visualizationEnabled,
  );

  return {
    ...defaults,
    ...parsed,
    version: 1,
    appearance: {
      ...defaults.appearance,
      ...parsed.appearance,
    },
    playback: {
      ...defaults.playback,
      ...parsedPlayback,
      visualizationEnabled: resolvedVisualizationEnabled,
      visualizerMode: resolvedVisualizerMode,
    },
    audio: {
      ...defaults.audio,
      ...parsed.audio,
      customEqBands: Array.isArray(parsed.audio?.customEqBands)
        ? parsed.audio.customEqBands.slice(0, 5).map((value) => Number(value) || 0)
        : defaults.audio.customEqBands,
    },
    layout: {
      ...defaults.layout,
      ...parsed.layout,
      presets: Array.isArray(parsed.layout?.presets) && parsed.layout.presets.length > 0
        ? parsed.layout.presets.map((preset) => ({
            ...defaultLayoutPresets[0],
            ...preset,
          }))
        : defaults.layout.presets,
    },
    library: {
      ...defaults.library,
      ...parsed.library,
      pinnedGenres: Array.isArray(parsed.library?.pinnedGenres) ? parsed.library.pinnedGenres : [],
      pinnedArtists: Array.isArray(parsed.library?.pinnedArtists) ? parsed.library.pinnedArtists : [],
    },
    advanced: {
      ...defaults.advanced,
      ...parsed.advanced,
    },
    activeProfileId: parsed.activeProfileId ?? defaults.activeProfileId,
    profiles: Array.isArray(parsed.profiles) && parsed.profiles.length > 0
      ? parsed.profiles.map((profile) => ({
          ...createDefaultProfile(profile.id ?? crypto.randomUUID(), profile.name ?? "Profile", profile.description ?? ""),
          ...profile,
          appearance: {
            ...defaults.appearance,
            ...profile.appearance,
          },
          playback: {
            ...defaults.playback,
            ...profile.playback,
            visualizationEnabled: resolveVisualizationEnabled(
              (profile.playback as Partial<PlaybackCustomizationSettings> | undefined)
                ?.visualizationEnabled,
              (profile.playback as Partial<PlaybackCustomizationSettings> & {
                visualizerMode?: string;
              } | undefined)?.visualizerMode,
              defaults.playback.visualizationEnabled,
            ),
            visualizerMode: resolveVisualizerMode(
              (profile.playback as Partial<PlaybackCustomizationSettings> & {
                visualizerMode?: string;
              } | undefined)?.visualizerMode,
              defaults.playback.visualizerMode,
            ),
          },
          audio: {
            ...defaults.audio,
            ...profile.audio,
            customEqBands: Array.isArray(profile.audio?.customEqBands)
              ? profile.audio.customEqBands.slice(0, 5).map((value) => Number(value) || 0)
              : defaults.audio.customEqBands,
          },
        }))
      : defaults.profiles,
  };
}

export function loadPreferences(): AppPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return mergePreferences(raw ? JSON.parse(raw) : undefined);
  } catch {
    return createDefaultPreferences();
  }
}

export function savePreferences(preferences: AppPreferences) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function createProfileFromCurrent(
  preferences: AppPreferences,
  name: string,
  playbackVolume: number,
  shuffleEnabled: boolean,
  repeatEnabled: boolean,
): ListeningProfile {
  const timestamp = new Date().toISOString();

  return {
    id: `profile-${crypto.randomUUID()}`,
    name,
    description: "Custom profile based on your current setup.",
    appearance: { ...preferences.appearance },
    playback: { ...preferences.playback },
    audio: { ...preferences.audio, customEqBands: [...preferences.audio.customEqBands] },
    layoutPresetId: preferences.layout.activePresetId,
    volume: playbackVolume,
    shuffleEnabled,
    repeatEnabled,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function hexToRgb(hex: string) {
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

export function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mixHexColors(first: string, second: string, ratio: number) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  const mix = clamp(ratio, 0, 1);

  return rgbToHex(
    a.r + (b.r - a.r) * mix,
    a.g + (b.g - a.g) * mix,
    a.b + (b.b - a.b) * mix,
  );
}

export function withIntensity(hex: string, intensity: number) {
  return mixHexColors("#7788aa", hex, clamp(intensity, 0, 1));
}

export function hexToRgbString(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

export function getDensityScale(density: DensityMode) {
  switch (density) {
    case "compact":
      return 0.94;
    case "spacious":
      return 1.04;
    default:
      return 1;
  }
}

export function getMotionDuration(intensity: AnimationIntensity) {
  switch (intensity) {
    case "minimal":
      return 120;
    case "fluid":
      return 260;
    default:
      return 180;
  }
}
