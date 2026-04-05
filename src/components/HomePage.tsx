import { convertFileSrc } from "@tauri-apps/api/core";
import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import type {
  ActivityFeedItem,
  FavoriteItem,
  FavoriteMutationPayload,
  GenreStat,
  HomeDataPayload,
  RankedItem,
  SaveProfilePayload,
  TimeSlicePoint,
  TrackRow,
} from "../types";

export type HomeWidgetId = "profile" | "stats" | "achievements" | "favorites" | "activity";

type HomePageProps = {
  data: HomeDataPayload | null;
  currentTrack: TrackRow | null;
  widgetOrder: HomeWidgetId[];
  onMoveWidget: (widgetId: HomeWidgetId, direction: -1 | 1) => void;
  onSaveProfile: (payload: SaveProfilePayload) => void;
  onToggleFavorite: (payload: FavoriteMutationPayload) => void;
  onPlayTrack: (track: TrackRow, queue?: TrackRow[]) => void;
};

function formatHours(seconds: number) {
  return `${(seconds / 3600).toFixed(seconds >= 36000 ? 0 : 1)}h`;
}

function formatMinutes(seconds: number) {
  if (seconds <= 0) {
    return "0m";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function createFallbackAchievements() {
  return [
    { achievement_id: "hours-25", progress: 0, unlocked: false, unlocked_at: null },
    { achievement_id: "hours-100", progress: 0, unlocked: false, unlocked_at: null },
    { achievement_id: "streak-7", progress: 0, unlocked: false, unlocked_at: null },
    { achievement_id: "streak-30", progress: 0, unlocked: false, unlocked_at: null },
    { achievement_id: "repeat-10", progress: 0, unlocked: false, unlocked_at: null },
    { achievement_id: "artists-25", progress: 0, unlocked: false, unlocked_at: null },
    { achievement_id: "genre-rock-20", progress: 0, unlocked: false, unlocked_at: null },
  ];
}

function createFallbackSlices(): TimeSlicePoint[] {
  return [
    { label: "Mon", seconds: 0 },
    { label: "Tue", seconds: 0 },
    { label: "Wed", seconds: 0 },
    { label: "Thu", seconds: 0 },
    { label: "Fri", seconds: 0 },
    { label: "Sat", seconds: 0 },
    { label: "Sun", seconds: 0 },
  ];
}

function createFallbackGenres(): GenreStat[] {
  return [
    { genre: "Hip Hop", seconds: 0, percentage: 0 },
    { genre: "R&B", seconds: 0, percentage: 0 },
    { genre: "Alternative Rock", seconds: 0, percentage: 0 },
  ];
}

function createFallbackHomeData(): HomeDataPayload {
  const achievements = createFallbackAchievements();
  return {
    profile: {
      id: "default",
      username: "Listener",
      avatar_url: null,
      background_type: "image",
      background_url: null,
      theme: "dark",
      accent_color: "#7fb3ff",
      level: 1,
      xp: 0,
      created_at: 0,
    },
    stats: {
      total_listening_time: 0,
      today_listening_time: 0,
      last_7_days_listening_time: 0,
      last_30_days_listening_time: 0,
      daily_listening_time: createFallbackSlices(),
      weekly_listening_time: createFallbackSlices(),
      genre_breakdown: createFallbackGenres(),
      top_tracks: [],
      top_artists: [],
      top_albums: [],
      listening_streak: 0,
      longest_session: 0,
      most_active_time_of_day: "Evening",
      repeat_counts: {},
      average_session_length: 0,
      new_artists_this_week: 0,
      new_tracks_this_week: 0,
      week_over_week_change: 0,
      insight: "Your listening identity will build itself as you play music.",
    },
    achievements,
    featured_achievements: [],
    upcoming_achievements: achievements,
    favorites: [],
    recent_activity: [
      {
        id: "welcome",
        message: "Start listening to unlock achievements, build streaks, and shape your dashboard.",
        timestamp: Math.floor(Date.now() / 1000),
      },
    ],
  };
}

function Artwork({
  src,
  label,
}: {
  src: string | null;
  label: string;
}) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(var(--win-accent-rgb),0.35),rgba(255,255,255,0.05))] text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">
        {label.slice(0, 2)}
      </div>
    );
  }

  return <img src={convertFileSrc(src)} alt="" className="h-full w-full object-cover" />;
}

function WidgetShell({
  title,
  subtitle,
  children,
  onMoveUp,
  onMoveDown,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <section className="win-pane-strong win-card-hover rounded-[8px] px-5 py-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold text-[var(--win-text)]">{title}</div>
          <div className="mt-1 text-[11.5px] text-[var(--win-text-secondary)]">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onMoveUp} className="win-button inline-flex h-8 items-center rounded-[4px] px-3 text-[12px] text-[var(--win-text-secondary)] hover:text-[var(--win-text)]">
            Up
          </button>
          <button type="button" onClick={onMoveDown} className="win-button inline-flex h-8 items-center rounded-[4px] px-3 text-[12px] text-[var(--win-text-secondary)] hover:text-[var(--win-text)]">
            Down
          </button>
        </div>
      </div>
      {children}
    </section>
  );
}

function RankedList({
  items,
  kind,
  favorites,
  onToggleFavorite,
  onPlayTrack,
}: {
  items: RankedItem[];
  kind: "track" | "artist" | "album";
  favorites: FavoriteItem[];
  onToggleFavorite: (payload: FavoriteMutationPayload) => void;
  onPlayTrack: (track: TrackRow, queue?: TrackRow[]) => void;
}) {
  const favoriteKeys = useMemo(
    () => new Set(favorites.filter((item) => item.kind === kind).map((item) => item.item_key)),
    [favorites, kind],
  );

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const pinned = favoriteKeys.has(item.id);
        const canPlay = kind === "track";
        return (
          <div key={`${kind}-${item.id}`} className="flex items-center gap-3 rounded-[6px] bg-[var(--win-input)] px-3 py-3">
            <div className="w-5 text-[11px] text-[var(--win-text-tertiary)]">{index + 1}</div>
            <div className="h-12 w-12 overflow-hidden rounded-[4px] border border-[var(--win-border)] bg-[var(--win-pane)]">
              <Artwork src={item.artwork_path} label={item.title} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium text-[var(--win-text)]">{item.title}</div>
              <div className="mt-1 truncate text-[11.5px] text-[var(--win-text-secondary)]">
                {item.subtitle} • {item.plays} plays • {formatMinutes(item.seconds)}
              </div>
            </div>
            {canPlay ? (
              <button
                type="button"
                onClick={() => onPlayTrack({
                  file_name: item.title,
                  file_path: item.id,
                  artwork_path: item.artwork_path,
                  title: item.title,
                  artist: item.subtitle,
                  album_artist: item.subtitle,
                  album: "",
                  genre: "",
                  year: null,
                  track_number: null,
                })}
                className="win-button inline-flex h-8 items-center rounded-[4px] px-3 text-[12px] text-[var(--win-text-secondary)] hover:text-[var(--win-text)]"
              >
                Play
              </button>
            ) : null}
            <button
              type="button"
              onClick={() =>
                onToggleFavorite({
                  kind,
                  item_key: item.id,
                  title: item.title,
                  subtitle: item.subtitle,
                  artwork_path: item.artwork_path,
                  pinned: !pinned,
                })}
              className={`inline-flex h-8 items-center rounded-[12px] px-3 text-[12px] ${
                pinned ? "win-button-primary" : "win-button text-[var(--win-text-secondary)] hover:text-[var(--win-text)]"
              }`}
            >
              {pinned ? "Pinned" : "Pin"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function HomePage({
  data,
  currentTrack,
  widgetOrder,
  onMoveWidget,
  onSaveProfile,
  onToggleFavorite,
  onPlayTrack,
}: HomePageProps) {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<SaveProfilePayload | null>(null);
  const resolvedData = data ?? createFallbackHomeData();

  const beginEditProfile = () => {
    setProfileDraft({
      username: resolvedData.profile.username,
      avatar_url: resolvedData.profile.avatar_url,
      background_type: resolvedData.profile.background_type,
      background_url: resolvedData.profile.background_url,
      theme: resolvedData.profile.theme,
      accent_color: resolvedData.profile.accent_color,
    });
    setIsEditingProfile(true);
  };

  const widgetContent: Record<HomeWidgetId, React.ReactNode> = {
    profile: (
      <WidgetShell
        title="Profile"
        subtitle="A Steam-style identity card powered by your listening history."
        onMoveUp={() => onMoveWidget("profile", -1)}
        onMoveDown={() => onMoveWidget("profile", 1)}
      >
        <div
          className="relative overflow-hidden rounded-[24px] border border-white/8 p-5"
          style={{
            background: resolvedData.profile.background_url
              ? `linear-gradient(180deg, rgba(12,14,18,0.28), rgba(12,14,18,0.76)), url(${resolvedData.profile.background_url}) center/cover`
              : `linear-gradient(135deg, ${resolvedData.profile.accent_color}, rgba(var(--win-accent-rgb),0.38))`,
          } as CSSProperties}
        >
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.08]">
                {resolvedData.profile.avatar_url ? (
                  <img src={resolvedData.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[1.6rem] font-semibold text-white/82">
                    {resolvedData.profile.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <div className="text-[1.8rem] font-semibold tracking-[-0.04em] text-white/95">
                  {resolvedData.profile.username}
                </div>
                <div className="mt-1 text-[13px] text-white/62">
                  Level {resolvedData.profile.level} • {resolvedData.profile.xp} XP • {formatHours(resolvedData.stats.total_listening_time)} listened
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(resolvedData.featured_achievements.length > 0
                    ? resolvedData.featured_achievements
                    : resolvedData.upcoming_achievements
                  ).slice(0, 4).map((achievement) => (
                    <div key={achievement.achievement_id} className="rounded-full bg-white/[0.12] px-3 py-1 text-[11px] text-white/82">
                      {achievement.achievement_id}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={beginEditProfile}
              className="win-button inline-flex h-10 items-center rounded-[14px] px-4 text-[12px] font-medium text-white/88 hover:text-white"
            >
              Customize profile
            </button>
          </div>

          {isEditingProfile && profileDraft ? (
            <div className="mt-5 rounded-[20px] border border-white/10 bg-[rgba(12,14,18,0.58)] p-4 backdrop-blur-xl">
              <div className="grid gap-3 md:grid-cols-2">
                <input value={profileDraft.username} onChange={(event) => setProfileDraft({ ...profileDraft, username: event.target.value })} placeholder="Username" className="win-field h-11 px-4 text-[13px] outline-none" />
                <input value={profileDraft.avatar_url ?? ""} onChange={(event) => setProfileDraft({ ...profileDraft, avatar_url: event.target.value || null })} placeholder="Avatar URL" className="win-field h-11 px-4 text-[13px] outline-none" />
                <input value={profileDraft.background_url ?? ""} onChange={(event) => setProfileDraft({ ...profileDraft, background_url: event.target.value || null })} placeholder="Background URL" className="win-field h-11 px-4 text-[13px] outline-none md:col-span-2" />
                <select value={profileDraft.background_type} onChange={(event) => setProfileDraft({ ...profileDraft, background_type: event.target.value })} className="win-field h-11 px-4 text-[13px] outline-none">
                  <option value="image">Image</option>
                  <option value="gif">GIF</option>
                  <option value="video">Video</option>
                </select>
                <input type="color" value={profileDraft.accent_color} onChange={(event) => setProfileDraft({ ...profileDraft, accent_color: event.target.value })} className="h-11 w-full cursor-pointer rounded-[14px] border border-white/10 bg-transparent" />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditingProfile(false)} className="win-button inline-flex h-10 items-center rounded-[14px] px-4 text-[12px] text-white/78 hover:text-white">Cancel</button>
                <button type="button" onClick={() => { onSaveProfile(profileDraft); setIsEditingProfile(false); }} className="win-button-primary inline-flex h-10 items-center rounded-[14px] px-4 text-[12px] font-semibold">Save profile</button>
              </div>
            </div>
          ) : null}
        </div>
      </WidgetShell>
    ),

    stats: (
      <WidgetShell title="Stats Dashboard" subtitle="Continuous listening analytics inspired by weekly music summaries." onMoveUp={() => onMoveWidget("stats", -1)} onMoveDown={() => onMoveWidget("stats", 1)}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[20px] bg-white/[0.03] px-4 py-4">
            <div className="text-[12px] text-white/46">Total listening time</div>
            <div className="mt-2 text-[1.8rem] font-semibold tracking-[-0.04em] text-white/94">{formatHours(resolvedData.stats.total_listening_time)}</div>
          </div>
          <div className="rounded-[20px] bg-white/[0.03] px-4 py-4">
            <div className="text-[12px] text-white/46">Listening streak</div>
            <div className="mt-2 text-[1.8rem] font-semibold tracking-[-0.04em] text-white/94">{resolvedData.stats.listening_streak} days</div>
          </div>
          <div className="rounded-[20px] bg-white/[0.03] px-4 py-4">
            <div className="text-[12px] text-white/46">Longest session</div>
            <div className="mt-2 text-[1.8rem] font-semibold tracking-[-0.04em] text-white/94">{formatMinutes(resolvedData.stats.longest_session)}</div>
          </div>
          <div className="rounded-[20px] bg-white/[0.03] px-4 py-4">
            <div className="text-[12px] text-white/46">Most active time</div>
            <div className="mt-2 text-[1.8rem] font-semibold tracking-[-0.04em] text-white/94">{resolvedData.stats.most_active_time_of_day}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-[20px] bg-white/[0.03] px-4 py-4">
            <div className="text-[13px] font-medium text-white/90">Weekly activity</div>
            <div className="mt-4 flex h-40 items-end gap-2">
              {resolvedData.stats.daily_listening_time.map((point) => {
                const maxSeconds = Math.max(...resolvedData.stats.daily_listening_time.map((item) => item.seconds), 1);
                const height = Math.max(10, (point.seconds / maxSeconds) * 120);
                return (
                  <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                    <div className="w-full rounded-t-[14px] bg-[linear-gradient(180deg,rgba(var(--win-accent-rgb),0.92),rgba(var(--win-accent-rgb),0.22))]" style={{ height }} />
                    <div className="text-[11px] text-white/42">{point.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[20px] bg-white/[0.03] px-4 py-4">
            <div className="text-[13px] font-medium text-white/90">Genre breakdown</div>
            <div className="mt-4 space-y-3">
              {resolvedData.stats.genre_breakdown.slice(0, 5).map((genre) => (
                <div key={genre.genre}>
                  <div className="mb-1 flex items-center justify-between text-[12px] text-white/60">
                    <span>{genre.genre}</span>
                    <span>{genre.percentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,rgba(var(--win-accent-rgb),0.96),rgba(var(--win-accent-rgb),0.45))]" style={{ width: `${genre.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[20px] bg-white/[0.03] px-4 py-4 text-[13px] text-white/68">
          {resolvedData.stats.insight}
        </div>
      </WidgetShell>
    ),

    achievements: (
      <WidgetShell title="Achievements" subtitle="Progression tracking with XP and upcoming milestones." onMoveUp={() => onMoveWidget("achievements", -1)} onMoveDown={() => onMoveWidget("achievements", 1)}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[20px] bg-white/[0.03] px-4 py-4">
            <div className="text-[13px] font-medium text-white/90">Recently unlocked</div>
            <div className="mt-3 space-y-2">
              {resolvedData.featured_achievements.length > 0 ? resolvedData.featured_achievements.map((achievement) => (
                <div key={achievement.achievement_id} className="rounded-[16px] bg-white/[0.03] px-3 py-3 text-[12px] text-white/76">
                  <div className="font-medium text-white/90">{achievement.achievement_id}</div>
                  <div className="mt-1 text-white/46">Unlocked {achievement.unlocked_at ? new Date(achievement.unlocked_at * 1000).toLocaleDateString() : "recently"}</div>
                </div>
              )) : <div className="text-[12px] text-white/46">Your first achievements will appear here as you listen.</div>}
            </div>
          </div>

          <div className="rounded-[20px] bg-white/[0.03] px-4 py-4">
            <div className="text-[13px] font-medium text-white/90">Upcoming</div>
            <div className="mt-3 space-y-2">
              {resolvedData.upcoming_achievements.map((achievement) => (
                <div key={achievement.achievement_id} className="rounded-[16px] bg-white/[0.03] px-3 py-3">
                  <div className="flex items-center justify-between gap-3 text-[12px] text-white/76">
                    <span>{achievement.achievement_id}</span>
                    <span>{achievement.progress}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,rgba(var(--win-accent-rgb),0.96),rgba(var(--win-accent-rgb),0.42))]" style={{ width: `${Math.min(100, achievement.progress)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </WidgetShell>
    ),

    favorites: (
      <WidgetShell title="Favorites & Highlights" subtitle="Pinned items, top tracks, and curated listening shortcuts." onMoveUp={() => onMoveWidget("favorites", -1)} onMoveDown={() => onMoveWidget("favorites", 1)}>
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <div className="mb-3 text-[13px] font-medium text-white/88">Most played songs</div>
            <RankedList items={resolvedData.stats.top_tracks.slice(0, 5)} kind="track" favorites={resolvedData.favorites} onToggleFavorite={onToggleFavorite} onPlayTrack={onPlayTrack} />
          </div>
          <div>
            <div className="mb-3 text-[13px] font-medium text-white/88">Pinned collection</div>
            <div className="space-y-2">
              {resolvedData.favorites.length > 0 ? resolvedData.favorites.map((item) => (
                <div key={`${item.kind}-${item.item_key}`} className="flex items-center gap-3 rounded-[18px] bg-white/[0.03] px-3 py-3">
                  <div className="h-12 w-12 overflow-hidden rounded-[14px] border border-white/8 bg-white/[0.04]">
                    <Artwork src={item.artwork_path} label={item.title} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-white/90">{item.title}</div>
                    <div className="mt-1 truncate text-[12px] text-white/48">{item.subtitle}</div>
                  </div>
                  <button type="button" onClick={() => onToggleFavorite({ ...item, pinned: false })} className="win-button inline-flex h-8 items-center rounded-[12px] px-3 text-[12px] text-white/78 hover:text-white">Unpin</button>
                </div>
              )) : <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-[12px] text-white/46">Pin tracks, albums, and artists from your highlights to build a personal shelf.</div>}
            </div>
          </div>
        </div>
      </WidgetShell>
    ),

    activity: (
      <WidgetShell title="Activity Feed" subtitle="Fresh insights from your listening behavior and progression." onMoveUp={() => onMoveWidget("activity", -1)} onMoveDown={() => onMoveWidget("activity", 1)}>
        <div className="space-y-2">
          {resolvedData.recent_activity.map((entry: ActivityFeedItem) => (
            <div key={entry.id} className="flex items-start gap-3 rounded-[18px] bg-white/[0.03] px-4 py-3">
              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--win-accent)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-white/84">{entry.message}</div>
                <div className="mt-1 text-[11px] text-white/42">{new Date(entry.timestamp * 1000).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </WidgetShell>
    ),
  };

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/42">Personal Dashboard</div>
        <h1 className="text-[2.5rem] font-semibold tracking-[-0.04em] text-white/94">Home</h1>
        <p className="max-w-3xl text-[13px] leading-6 text-white/54">
          A living snapshot of your listening identity, progression, favorites, and evolving habits.
        </p>
      </header>

      {currentTrack ? (
        <div className="win-pane rounded-[22px] px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13px] font-medium text-white/88">Now shaping your dashboard</div>
              <div className="mt-1 text-[12px] text-white/48">
                Current session: {currentTrack.title} • {currentTrack.artist}
              </div>
            </div>
            <div className="text-[12px] text-white/42">Live tracking active</div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {widgetOrder.map((widgetId) => (
          <div key={widgetId}>{widgetContent[widgetId]}</div>
        ))}
      </div>
    </div>
  );
}
