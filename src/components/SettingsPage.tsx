import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppPreferences } from "../lib/personalization";
import { ChevronDownIcon, PlusFolderIcon, SettingsIcon } from "./Icons";

export type SettingsPanelId =
  | "appearance"
  | "playback"
  | "visualization"
  | "audio"
  | "layout"
  | "library"
  | "library-locations"
  | "library-refresh"
  | "profiles"
  | "advanced"
  | "personalization-hub"
  | "about";

export type SettingsPanelState = Record<SettingsPanelId, boolean>;

type SettingsPageProps = {
  preferences: AppPreferences;
  activeAccent: string;
  currentVolume: number;
  currentShuffleEnabled: boolean;
  currentRepeatEnabled: boolean;
  libraryLocations: string[];
  isScanning: boolean;
  onUpdateAppearance: (patch: Partial<AppPreferences["appearance"]>) => void;
  onUpdatePlayback: (patch: Partial<AppPreferences["playback"]>) => void;
  onUpdateAudio: (patch: Partial<AppPreferences["audio"]>) => void;
  onUpdateLibrary: (patch: Partial<AppPreferences["library"]>) => void;
  onUpdateAdvanced: (patch: Partial<AppPreferences["advanced"]>) => void;
  onSelectLayoutPreset: (presetId: string) => void;
  onResetAppearance: () => void;
  onResetPlayback: () => void;
  onResetAudio: () => void;
  onResetAdvanced: () => void;
  onAddFolder: () => void;
  onRefreshLibrary: () => void;
  onCreateProfile: () => void;
  onApplyProfile: (profileId: string) => void;
  onDuplicateProfile: (profileId: string) => void;
  onDeleteProfile: (profileId: string) => void;
  onRenameProfile: (profileId: string, name: string) => void;
  onSaveCurrentToProfile: (profileId: string) => void;
  panelState: SettingsPanelState;
  onTogglePanel: (panelId: SettingsPanelId) => void;
};

function ExpandablePanel({
  panelId,
  title,
  subtitle,
  isOpen,
  onToggle,
  actions,
  children,
}: {
  panelId: SettingsPanelId;
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: (panelId: SettingsPanelId) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useLayoutEffect(() => {
    setContentHeight(contentRef.current?.scrollHeight ?? 0);
  }, [children, isOpen]);

  return (
    <section className="win-pane win-card-hover overflow-hidden rounded-[18px]">
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-[var(--win-pane-hover)]/40">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => onToggle(panelId)}
          className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
        >
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[var(--win-text)]">{title}</div>
            {subtitle ? <div className="mt-1 text-[11.5px] text-[var(--win-text-secondary)]">{subtitle}</div> : null}
          </div>
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 text-[var(--win-text-secondary)] transition-transform duration-300 ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          />
        </button>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ maxHeight: isOpen ? contentHeight + 1 : 0, opacity: isOpen ? 1 : 0 }}
      >
        <div ref={contentRef} className="border-t border-[var(--win-border)] px-5 py-4">
          {children}
        </div>
      </div>
    </section>
  );
}

function Toggle({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
        checked
          ? "border-[rgba(var(--win-accent-rgb),0.32)] bg-[linear-gradient(180deg,rgba(var(--win-accent-rgb),0.22),rgba(var(--win-accent-rgb),0.12))]"
          : "border-[var(--win-border)] bg-[var(--win-input)]"
      }`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-[var(--win-text)] shadow-[0_4px_10px_rgba(0,0,0,0.22)] transition-transform ${
          checked ? "translate-x-[1.45rem]" : "translate-x-[0.3rem]"
        }`}
      />
    </button>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-[13px] font-semibold text-[var(--win-text)]">{title}</div>
        <div className="mt-1 text-[12px] leading-5 text-[var(--win-text-secondary)]">{description}</div>
      </div>
      {action}
    </div>
  );
}

function SelectRow({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="win-surface-muted flex flex-wrap items-start justify-between gap-4 rounded-[18px] px-4 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[var(--win-text)]">{label}</div>
        <div className="mt-1 max-w-2xl text-[12px] leading-5 text-[var(--win-text-secondary)]">{description}</div>
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="win-field win-select h-10 min-w-[12rem] px-3 pr-9 text-[12px] outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SliderRow({
  label,
  description,
  min,
  max,
  step,
  value,
  displayValue,
  onChange,
}: {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  displayValue: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="win-surface-muted rounded-[18px] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-[var(--win-text)]">{label}</div>
          <div className="mt-1 text-[12px] leading-5 text-[var(--win-text-secondary)]">{description}</div>
        </div>
        <div className="text-[12px] font-medium text-[var(--win-text-secondary)]">{displayValue}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[color-mix(in_srgb,var(--win-text)_12%,transparent)] accent-[var(--win-accent-strong)]"
      />
    </div>
  );
}

function OptionPills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
            value === option.value
              ? "border-[rgba(var(--win-accent-rgb),0.3)] bg-[rgba(var(--win-accent-rgb),0.18)] text-[var(--win-text)]"
              : "border-[var(--win-border)] bg-[var(--win-input)] text-[var(--win-text-secondary)] hover:bg-[var(--win-input-hover)] hover:text-[var(--win-text)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FolderList({ folders }: { folders: string[] }) {
  if (folders.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-[var(--win-border)] bg-[var(--win-input)] px-4 py-5 text-[12px] text-[var(--win-text-secondary)]">
        No library folders added yet. Add a folder to start building your music library.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {folders.map((folder) => (
        <div key={folder} className="rounded-[18px] border border-[var(--win-border)] bg-[var(--win-input)] px-4 py-3 text-[12px] text-[var(--win-text)]">
          <div className="truncate">{folder}</div>
        </div>
      ))}
    </div>
  );
}

export function SettingsPage({
  preferences,
  activeAccent,
  currentVolume,
  currentShuffleEnabled,
  currentRepeatEnabled,
  libraryLocations,
  isScanning,
  onUpdateAppearance,
  onUpdatePlayback,
  onUpdateAudio,
  onUpdateLibrary,
  onUpdateAdvanced,
  onSelectLayoutPreset,
  onResetAppearance,
  onResetPlayback,
  onResetAudio,
  onResetAdvanced,
  onAddFolder,
  onRefreshLibrary,
  onCreateProfile,
  onApplyProfile,
  onDuplicateProfile,
  onDeleteProfile,
  onRenameProfile,
  onSaveCurrentToProfile,
  panelState,
  onTogglePanel,
}: SettingsPageProps) {
  const logoTileStyle = useMemo<CSSProperties>(
    () => ({
      background: `linear-gradient(135deg, ${activeAccent}, rgba(var(--win-accent-rgb), 0.54))`,
    }),
    [activeAccent],
  );
  const activeProfile = preferences.profiles.find((profile) => profile.id === preferences.activeProfileId) ?? null;

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-[var(--win-text-tertiary)]">Personalization System</div>
        <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-[var(--win-text)]">Settings</h1>
        <p className="max-w-3xl text-[12.5px] leading-5 text-[var(--win-text-secondary)]">
          Shape the player&apos;s visual identity, playback behavior, profiles, and layout system without losing the calm Windows 11 design language.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,0.95fr)]">
        <div className="space-y-4">
          <ExpandablePanel
            panelId="appearance"
            title="Appearance"
            subtitle="Theme, accent, density, material, and visual identity."
            isOpen={panelState.appearance}
            onToggle={onTogglePanel}
            actions={<button type="button" onClick={onResetAppearance} className="win-button inline-flex h-8 items-center rounded-[12px] px-3 text-[12px] font-medium text-white/78 hover:text-white">Reset</button>}
          >
            <SectionHeader title="Theme foundation" description="Appearance settings are applied live to the shell, panes, and player surface." />
            <div className="space-y-3">
              <SelectRow
                label="Theme mode"
                description="Choose a fixed theme or let the player adapt automatically."
                value={preferences.appearance.themeMode}
                options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "auto", label: "Automatic" }]}
                onChange={(value) => onUpdateAppearance({ themeMode: value as AppPreferences["appearance"]["themeMode"] })}
              />

              <div className="rounded-[18px] bg-white/[0.03] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[13px] font-medium text-white/90">Accent behavior</div>
                    <div className="mt-1 text-[12px] leading-5 text-white/50">
                      Use the current album art, lock a manual accent, or blend both for a more curated result.
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-[14px] border border-white/10 shadow-[0_10px_24px_rgba(0,0,0,0.18)]" style={{ background: activeAccent }} />
                </div>
                <div className="mt-3">
                  <OptionPills
                    value={preferences.appearance.accentMode}
                    options={[{ value: "album", label: "Album-derived" }, { value: "manual", label: "Manual lock" }, { value: "blend", label: "Blend" }]}
                    onChange={(value) => onUpdateAppearance({ accentMode: value })}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="text-[12px] text-white/52">Manual accent</label>
                  <input
                    type="color"
                    value={preferences.appearance.manualAccent}
                    onChange={(event) => onUpdateAppearance({ manualAccent: event.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-[12px] border border-white/10 bg-transparent"
                  />
                </div>
              </div>

              <SliderRow label="Accent intensity" description="Push the accent toward a calmer surface tint or a more vivid premium highlight." min={0.2} max={1} step={0.05} value={preferences.appearance.accentIntensity} displayValue={`${Math.round(preferences.appearance.accentIntensity * 100)}%`} onChange={(value) => onUpdateAppearance({ accentIntensity: value })} />
              <SliderRow label="Blend balance" description="When blending is enabled, choose how strongly the manual accent influences the album-derived color." min={0} max={1} step={0.05} value={preferences.appearance.blendAmount} displayValue={`${Math.round(preferences.appearance.blendAmount * 100)}% manual`} onChange={(value) => onUpdateAppearance({ blendAmount: value })} />
              <SelectRow label="Density" description="Controls spacing rhythm and overall information density across the app." value={preferences.appearance.density} options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }, { value: "spacious", label: "Spacious" }]} onChange={(value) => onUpdateAppearance({ density: value as AppPreferences["appearance"]["density"] })} />
              <SelectRow label="Material" description="Adjust the Windows 11-style shell treatment for calmer Mica, brighter Acrylic, or a more solid surface." value={preferences.appearance.material} options={[{ value: "mica", label: "Mica" }, { value: "acrylic", label: "Acrylic" }, { value: "solid", label: "Solid" }]} onChange={(value) => onUpdateAppearance({ material: value as AppPreferences["appearance"]["material"] })} />
              <SliderRow label="Blur strength" description="Fine tune the softness of shell translucency and layered surfaces." min={0} max={1} step={0.05} value={preferences.appearance.blurStrength} displayValue={`${Math.round(preferences.appearance.blurStrength * 100)}%`} onChange={(value) => onUpdateAppearance({ blurStrength: value })} />
              <SliderRow label="Transparency" description="Controls how much underlying color and light bleed into the app shell." min={0} max={1} step={0.05} value={preferences.appearance.transparency} displayValue={`${Math.round(preferences.appearance.transparency * 100)}%`} onChange={(value) => onUpdateAppearance({ transparency: value })} />
              <SliderRow label="Panel transparency" description="Adjust the translucency of cards, grouped panes, and settings surfaces." min={0} max={1} step={0.05} value={preferences.appearance.panelTransparency} displayValue={`${Math.round(preferences.appearance.panelTransparency * 100)}%`} onChange={(value) => onUpdateAppearance({ panelTransparency: value })} />
              <SelectRow label="Album art presentation" description="Choose the visual character of artwork treatments for playback and library surfaces." value={preferences.appearance.albumArtMode} options={[{ value: "floating", label: "Floating card" }, { value: "classic", label: "Classic media panel" }, { value: "full-bleed", label: "Full bleed" }, { value: "vinyl", label: "Vinyl-inspired" }]} onChange={(value) => onUpdateAppearance({ albumArtMode: value as AppPreferences["appearance"]["albumArtMode"] })} />
              <SelectRow label="Motion intensity" description="Choose how much movement the interface uses in transitions and feedback." value={preferences.appearance.motionIntensity} options={[{ value: "minimal", label: "Minimal" }, { value: "balanced", label: "Balanced" }, { value: "fluid", label: "Fluid" }]} onChange={(value) => onUpdateAppearance({ motionIntensity: value as AppPreferences["appearance"]["motionIntensity"] })} />
              <SliderRow label="Typography scale" description="Adjust type scale to favor compact browsing or a more lounge-like reading experience." min={0.9} max={1.1} step={0.02} value={preferences.appearance.fontScale} displayValue={`${Math.round(preferences.appearance.fontScale * 100)}%`} onChange={(value) => onUpdateAppearance({ fontScale: value })} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Lofi ambiance layer</div><div className="mt-1 text-[12px] leading-5 text-white/50">Adds a restrained warmth and analog haze over the Windows-like baseline.</div></div><Toggle checked={preferences.appearance.lofiOverlay} onClick={() => onUpdateAppearance({ lofiOverlay: !preferences.appearance.lofiOverlay })} /></div></div>
                <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Time-of-day adaptation</div><div className="mt-1 text-[12px] leading-5 text-white/50">Lets the shell react more softly between daytime and evening sessions.</div></div><Toggle checked={preferences.appearance.timeOfDayTheme} onClick={() => onUpdateAppearance({ timeOfDayTheme: !preferences.appearance.timeOfDayTheme })} /></div></div>
              </div>
            </div>
          </ExpandablePanel>

          <ExpandablePanel panelId="playback" title="Playback" subtitle="Resume behavior, crossfade, and session continuity." isOpen={panelState.playback} onToggle={onTogglePanel} actions={<button type="button" onClick={onResetPlayback} className="win-button inline-flex h-8 items-center rounded-[12px] px-3 text-[12px] font-medium text-white/78 hover:text-white">Reset</button>}>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Resume last session</div><div className="mt-1 text-[12px] leading-5 text-white/50">Restore playback context, queue, and playback settings after reopening the app.</div></div><Toggle checked={preferences.playback.resumeLastSession} onClick={() => onUpdatePlayback({ resumeLastSession: !preferences.playback.resumeLastSession })} /></div></div>
                <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Show resume prompt</div><div className="mt-1 text-[12px] leading-5 text-white/50">Surfaces a subtle in-app reminder when a previous session is restored.</div></div><Toggle checked={preferences.playback.showResumePrompt} onClick={() => onUpdatePlayback({ showResumePrompt: !preferences.playback.showResumePrompt })} /></div></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Crossfade</div><div className="mt-1 text-[12px] leading-5 text-white/50">Smooths track transitions for a calmer premium listening flow.</div></div><Toggle checked={preferences.playback.crossfadeEnabled} onClick={() => onUpdatePlayback({ crossfadeEnabled: !preferences.playback.crossfadeEnabled })} /></div></div>
                <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Smooth progress motion</div><div className="mt-1 text-[12px] leading-5 text-white/50">Keeps seek and progress feedback feeling softer and more premium.</div></div><Toggle checked={preferences.playback.smoothProgress} onClick={() => onUpdatePlayback({ smoothProgress: !preferences.playback.smoothProgress })} /></div></div>
              </div>
              <SliderRow label="Crossfade duration" description="Target fade length between tracks. The structure is ready even before engine-level fading is expanded." min={0} max={12} step={1} value={preferences.playback.crossfadeSeconds} displayValue={`${preferences.playback.crossfadeSeconds}s`} onChange={(value) => onUpdatePlayback({ crossfadeSeconds: value })} />
            </div>
          </ExpandablePanel>

          <ExpandablePanel panelId="visualization" title="Audio Visualization" subtitle="Live playback motion inside the bottom player." isOpen={panelState.visualization} onToggle={onTogglePanel}>
            <div className="space-y-3">
              <div className="rounded-[18px] bg-white/[0.03] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-medium text-white/90">Enable player visualization</div>
                    <div className="mt-1 text-[12px] leading-5 text-white/50">
                      Adds a refined, real-time visual layer to the bottom player that reacts to the music without crowding the transport controls.
                    </div>
                  </div>
                  <Toggle
                    checked={preferences.playback.visualizationEnabled}
                    onClick={() =>
                      onUpdatePlayback({
                        visualizationEnabled: !preferences.playback.visualizationEnabled,
                      })
                    }
                  />
                </div>
              </div>

              <SelectRow
                label="Visualization style"
                description="Choose the motion language that best fits your listening setup."
                value={preferences.playback.visualizerMode}
                options={[
                  { value: "bars", label: "Bars" },
                  { value: "wave", label: "Wave" },
                  { value: "glow", label: "Glow / Pulse" },
                ]}
                onChange={(value) =>
                  onUpdatePlayback({
                    visualizerMode: value as AppPreferences["playback"]["visualizerMode"],
                  })
                }
              />

              <div className="grid gap-3 lg:grid-cols-3">
                {[
                  {
                    id: "bars",
                    title: "Bars",
                    description: "Tight, vertical motion with a crisp studio feel.",
                  },
                  {
                    id: "wave",
                    title: "Wave",
                    description: "A fluid line treatment for a softer ambient player surface.",
                  },
                  {
                    id: "glow",
                    title: "Glow / Pulse",
                    description: "Atmospheric reactive light for a calmer premium mood.",
                  },
                ].map((style) => {
                  const isActive = preferences.playback.visualizerMode === style.id;

                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() =>
                        onUpdatePlayback({
                          visualizerMode: style.id as AppPreferences["playback"]["visualizerMode"],
                        })
                      }
                      className={`rounded-[20px] border px-4 py-4 text-left transition ${
                        isActive
                          ? "border-[rgba(127,179,255,0.26)] bg-[rgba(127,179,255,0.14)] text-white"
                          : "border-white/8 bg-white/[0.03] text-white/74 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[13px] font-semibold">{style.title}</div>
                        {isActive ? (
                          <div className="rounded-full border border-[rgba(127,179,255,0.28)] bg-[rgba(127,179,255,0.18)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/80">
                            Active
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2 text-[12px] leading-5 text-white/50">{style.description}</div>
                      <div className="mt-4 h-16 rounded-[16px] border border-white/8 bg-[linear-gradient(180deg,rgba(var(--win-accent-rgb),0.12),rgba(255,255,255,0.02))]">
                        <div className="flex h-full items-center justify-center">
                          {style.id === "bars" ? (
                            <div className="flex items-end gap-1.5">
                              {[0.35, 0.62, 0.88, 0.58, 0.42].map((value, index) => (
                                <span
                                  key={`${style.id}-${index}`}
                                  className="block w-1.5 rounded-full bg-[linear-gradient(180deg,var(--win-accent-strong),rgba(var(--win-accent-rgb),0.24))]"
                                  style={{ height: `${18 + value * 24}px`, opacity: 0.44 + value * 0.42 }}
                                />
                              ))}
                            </div>
                          ) : style.id === "wave" ? (
                            <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-10 w-[80%]">
                              <path
                                d="M0,15 C10,10 20,7 30,13 C40,19 50,23 60,15 C70,7 82,8 100,14"
                                fill="none"
                                stroke="var(--win-accent-strong)"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                              />
                            </svg>
                          ) : (
                            <div className="relative h-10 w-[72%]">
                              <div className="absolute left-[8%] top-1 h-5 w-5 rounded-full bg-[radial-gradient(circle,rgba(var(--win-accent-rgb),0.42),transparent_72%)] blur-md" />
                              <div className="absolute left-1/2 top-0 h-8 w-8 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(var(--win-accent-strong-rgb),0.46),transparent_74%)] blur-md" />
                              <div className="absolute right-[12%] top-2 h-4 w-4 rounded-full bg-[radial-gradient(circle,rgba(var(--win-accent-soft-rgb),0.34),transparent_72%)] blur-md" />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-[18px] bg-white/[0.03] px-4 py-3 text-[12px] leading-6 text-white/50">
                More controls like intensity, color strategy, and alternative motion profiles can be added here later without changing the player architecture.
              </div>
            </div>
          </ExpandablePanel>

          <ExpandablePanel panelId="audio" title="Audio" subtitle="Equalizer, output memory, and transition shaping." isOpen={panelState.audio} onToggle={onTogglePanel} actions={<button type="button" onClick={onResetAudio} className="win-button inline-flex h-8 items-center rounded-[12px] px-3 text-[12px] font-medium text-white/78 hover:text-white">Reset</button>}>
            <div className="space-y-3">
              <SelectRow label="Equalizer preset" description="Set the current sonic character. This lays the groundwork for the advanced EQ surface." value={preferences.audio.equalizerPreset} options={[{ value: "Flat", label: "Flat" }, { value: "Focus", label: "Focus" }, { value: "Gym", label: "Gym" }, { value: "Late Night", label: "Late Night" }, { value: "Chill", label: "Chill" }]} onChange={(value) => onUpdateAudio({ equalizerPreset: value as AppPreferences["audio"]["equalizerPreset"] })} />
              <div className="rounded-[18px] bg-white/[0.03] px-4 py-3">
                <div className="text-[13px] font-medium text-white/90">EQ preview bands</div>
                <div className="mt-1 text-[12px] leading-5 text-white/50">These bands establish the data shape for custom preset editing and future device-aware audio memory.</div>
                <div className="mt-4 grid grid-cols-5 gap-3">
                  {preferences.audio.customEqBands.map((band, index) => (
                    <label key={`band-${index}`} className="flex flex-col items-center gap-2">
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={1}
                        value={band}
                        onChange={(event) => {
                          const nextBands = [...preferences.audio.customEqBands];
                          nextBands[index] = Number(event.target.value);
                          onUpdateAudio({ customEqBands: nextBands });
                        }}
                        className="h-28 w-2 cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--win-accent-strong)] [writing-mode:bt-lr] sm:h-32"
                        style={{ writingMode: "vertical-lr" }}
                      />
                      <span className="text-[11px] text-white/44">{index + 1}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Per-device memory</div><div className="mt-1 text-[12px] leading-5 text-white/50">Preserve audio preferences per output device when that engine layer is extended.</div></div><Toggle checked={preferences.audio.outputMemoryEnabled} onClick={() => onUpdateAudio({ outputMemoryEnabled: !preferences.audio.outputMemoryEnabled })} /></div></div>
            </div>
          </ExpandablePanel>

          <ExpandablePanel panelId="layout" title="Layout" subtitle="Preset-driven layout modes with room for dockable future modules." isOpen={panelState.layout} onToggle={onTogglePanel}>
            <div className="space-y-3">
              <SectionHeader title="Layout presets" description="Choose the current workspace personality. These presets provide the sync-ready structure for richer dockable layouts later." />
              <div className="grid gap-3 lg:grid-cols-2">
                {preferences.layout.presets.map((preset) => {
                  const isActive = preferences.layout.activePresetId === preset.id;
                  return (
                    <button key={preset.id} type="button" onClick={() => onSelectLayoutPreset(preset.id)} className={`rounded-[18px] border px-4 py-4 text-left transition ${isActive ? "border-[rgba(127,179,255,0.26)] bg-[rgba(127,179,255,0.14)] text-white" : "border-white/8 bg-white/[0.03] text-white/74 hover:bg-white/[0.05] hover:text-white"}`}>
                      <div className="text-[13px] font-semibold">{preset.name}</div>
                      <div className="mt-1 text-[12px] text-white/50">{preset.mode.replace("-", " ")}</div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/42">
                        {preset.sidebarCollapsed ? <span>Collapsed sidebar</span> : <span>Expanded sidebar</span>}
                        {preset.showVisualizer ? <span>Visualizer</span> : null}
                        {preset.showArtistInfo ? <span>Artist info</span> : null}
                        {preset.showLyrics ? <span>Lyrics</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </ExpandablePanel>

          <ExpandablePanel panelId="library" title="Library" subtitle="Folders, refresh behavior, and personal curation." isOpen={panelState.library} onToggle={onTogglePanel}>
            <div className="space-y-3">
              <ExpandablePanel panelId="library-locations" title="Music Library Locations" subtitle={`${libraryLocations.length} folder${libraryLocations.length === 1 ? "" : "s"} added`} isOpen={panelState["library-locations"]} onToggle={onTogglePanel} actions={<button type="button" onClick={(event) => { event.stopPropagation(); onAddFolder(); }} className="win-button inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-[12px] font-medium text-white/88 hover:text-white"><PlusFolderIcon className="h-4 w-4" />Add Folder</button>}>
                <FolderList folders={libraryLocations} />
              </ExpandablePanel>
              <ExpandablePanel panelId="library-refresh" title="Refresh Library" subtitle="Reload the indexed library from current local data." isOpen={panelState["library-refresh"]} onToggle={onTogglePanel}>
                <div className="rounded-[18px] bg-white/[0.03] px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[13px] font-medium text-white/90">Refresh your library</div>
                      <div className="mt-1 max-w-2xl text-[12px] leading-5 text-white/50">Rebuild grouped browsing data, cover references, and library surfaces without interrupting your current session.</div>
                    </div>
                    <button type="button" onClick={onRefreshLibrary} disabled={isScanning} className="win-button inline-flex h-10 items-center rounded-[12px] px-4 text-[12px] font-medium text-white/88 hover:text-white disabled:cursor-not-allowed disabled:opacity-55">{isScanning ? "Refreshing..." : "Refresh now"}</button>
                  </div>
                </div>
              </ExpandablePanel>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Show favorites first</div><div className="mt-1 text-[12px] leading-5 text-white/50">Reserve room for a richer pinned and favorite-first library flow.</div></div><Toggle checked={preferences.library.showFavoritesFirst} onClick={() => onUpdateLibrary({ showFavoritesFirst: !preferences.library.showFavoritesFirst })} /></div></div>
                <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Mood-like organization</div><div className="mt-1 text-[12px] leading-5 text-white/50">Prepares the library model for richer personal labels and mood-driven organization.</div></div><Toggle checked={preferences.library.browseByMood} onClick={() => onUpdateLibrary({ browseByMood: !preferences.library.browseByMood })} /></div></div>
              </div>
              <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Look for missing info online</div><div className="mt-1 text-[12px] leading-5 text-white/50">Lets the library enhancement pipeline search for missing metadata and imagery where available.</div></div><Toggle checked={preferences.library.lookUpMissingInfoOnline} onClick={() => onUpdateLibrary({ lookUpMissingInfoOnline: !preferences.library.lookUpMissingInfoOnline })} /></div></div>
            </div>
          </ExpandablePanel>

          <ExpandablePanel panelId="profiles" title="Profiles" subtitle="Save complete listening personalities like Focus, Gym, and Late Night." isOpen={panelState.profiles} onToggle={onTogglePanel}>
            <SectionHeader title="Listening profiles" description="Profiles capture appearance, playback, EQ, layout, and transport preferences so the player can feel purpose-built for each mood." action={<button type="button" onClick={onCreateProfile} className="win-button-primary inline-flex h-9 items-center rounded-[12px] px-4 text-[12px] font-semibold">New profile</button>} />
            <div className="space-y-3">
              {preferences.profiles.map((profile) => {
                const isActive = profile.id === preferences.activeProfileId;
                return (
                  <div key={profile.id} className={`rounded-[20px] border px-4 py-4 ${isActive ? "border-[rgba(127,179,255,0.26)] bg-[rgba(127,179,255,0.12)]" : "border-white/8 bg-white/[0.03]"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <input value={profile.name} onChange={(event) => onRenameProfile(profile.id, event.target.value)} className="w-full bg-transparent text-[14px] font-semibold text-white/92 outline-none" />
                        <div className="mt-1 text-[12px] leading-5 text-white/50">{profile.description}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/44">
                          <span>{profile.appearance.material}</span>
                          <span>{profile.appearance.density}</span>
                          <span>{profile.audio.equalizerPreset}</span>
                          <span>{profile.playback.visualizerMode}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => onApplyProfile(profile.id)} className={`inline-flex h-9 items-center rounded-[12px] px-3 text-[12px] font-medium ${isActive ? "win-button-primary" : "win-button"}`}>{isActive ? "Active" : "Apply"}</button>
                        <button type="button" onClick={() => onSaveCurrentToProfile(profile.id)} className="win-button inline-flex h-9 items-center rounded-[12px] px-3 text-[12px] font-medium text-white/78 hover:text-white">Save current</button>
                        <button type="button" onClick={() => onDuplicateProfile(profile.id)} className="win-button inline-flex h-9 items-center rounded-[12px] px-3 text-[12px] font-medium text-white/78 hover:text-white">Duplicate</button>
                        {preferences.profiles.length > 1 ? <button type="button" onClick={() => onDeleteProfile(profile.id)} className="win-button inline-flex h-9 items-center rounded-[12px] px-3 text-[12px] font-medium text-white/68 hover:text-white">Delete</button> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ExpandablePanel>

          <ExpandablePanel panelId="advanced" title="Advanced" subtitle="Power-user controls and sync-ready platform plumbing." isOpen={panelState.advanced} onToggle={onTogglePanel} actions={<button type="button" onClick={onResetAdvanced} className="win-button inline-flex h-8 items-center rounded-[12px] px-3 text-[12px] font-medium text-white/78 hover:text-white">Reset</button>}>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Command palette</div><div className="mt-1 text-[12px] leading-5 text-white/50">Enables the structure for a premium quick action launcher and future power workflows.</div></div><Toggle checked={preferences.advanced.commandPaletteEnabled} onClick={() => onUpdateAdvanced({ commandPaletteEnabled: !preferences.advanced.commandPaletteEnabled })} /></div></div>
                <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Shortcut system</div><div className="mt-1 text-[12px] leading-5 text-white/50">Keeps keyboard customization ready for a future configurable shortcut layer.</div></div><Toggle checked={preferences.advanced.shortcutSystemEnabled} onClick={() => onUpdateAdvanced({ shortcutSystemEnabled: !preferences.advanced.shortcutSystemEnabled })} /></div></div>
              </div>
              <div className="rounded-[18px] bg-white/[0.03] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="text-[13px] font-medium text-white/90">Layout metrics overlay</div><div className="mt-1 text-[12px] leading-5 text-white/50">Developer-facing layout diagnostics for future drag, dock, and resize systems.</div></div><Toggle checked={preferences.advanced.debugLayoutMetrics} onClick={() => onUpdateAdvanced({ debugLayoutMetrics: !preferences.advanced.debugLayoutMetrics })} /></div></div>
            </div>
          </ExpandablePanel>
        </div>

        <div className="space-y-4">
          <div className="win-pane rounded-[24px] px-5 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] text-[13px] font-semibold text-[#09111d] shadow-[0_10px_24px_rgba(72,123,209,0.26)]" style={logoTileStyle}>Q</div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-white/92">Current identity</div>
                <div className="mt-1 text-[12px] text-white/46">{activeProfile?.name ?? "Custom setup"} • Accent {activeAccent}</div>
              </div>
            </div>
            <div className="mt-4 rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium text-white/90">Live preview</div>
                  <div className="mt-1 text-[12px] text-white/46">Material, accent, and motion settings are applied live across the app shell.</div>
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-8 rounded-[12px] border border-white/8 bg-white/[0.06]" />
                  <div className="h-8 w-8 rounded-[12px] border border-white/8" style={{ background: activeAccent }} />
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3"><div className="text-[12px] font-medium text-white/84">Volume memory</div><div className="mt-1 text-[12px] text-white/48">{Math.round(currentVolume * 100)}%</div></div>
                <div className="rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3"><div className="text-[12px] font-medium text-white/84">Transport memory</div><div className="mt-1 text-[12px] text-white/48">Shuffle {currentShuffleEnabled ? "on" : "off"} • Repeat {currentRepeatEnabled ? "on" : "off"}</div></div>
                <div className="rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3"><div className="text-[12px] font-medium text-white/84">Layout preset</div><div className="mt-1 text-[12px] text-white/48">{preferences.layout.presets.find((preset) => preset.id === preferences.layout.activePresetId)?.name ?? "Custom"}</div></div>
              </div>
            </div>
          </div>

          <ExpandablePanel panelId="personalization-hub" title="Personalization hub" subtitle="A snapshot of the premium direction this foundation unlocks." isOpen={panelState["personalization-hub"]} onToggle={onTogglePanel}>
            <div className="space-y-3">
              {[
                "Dynamic accent generation from album art with manual and blended override modes",
                "Reliable session continuity and profile-driven playback personalities",
                "Preset-ready layout system structured for dockable panels and future sync",
                "Advanced audio and visual modules staged behind a consistent settings architecture",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[18px] bg-white/[0.03] px-4 py-3">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--win-accent)]" />
                  <div className="text-[12px] leading-6 text-white/54">{item}</div>
                </div>
              ))}
            </div>
          </ExpandablePanel>

          <ExpandablePanel panelId="about" title="About" subtitle="App identity and placeholder product information." isOpen={panelState.about} onToggle={onTogglePanel}>
            <div className="space-y-3 rounded-[18px] bg-white/[0.03] px-4 py-4 text-[12px] leading-6 text-white/56">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/[0.05] text-white/72"><SettingsIcon className="h-4 w-4" /></div>
                <div>
                  <div className="text-[13px] font-medium text-white/88">Qwaan Music Player</div>
                  <div className="text-[12px] text-white/44">Premium Windows 11 media experience</div>
                </div>
              </div>
              <p>Version: Placeholder 1.0.0</p>
              <p>Developer: Placeholder Studio</p>
              <p>License: Placeholder information ready for release packaging.</p>
            </div>
          </ExpandablePanel>
        </div>
      </div>
    </div>
  );
}
