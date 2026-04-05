export type TrackRow = {
  file_name: string;
  file_path: string;
  artwork_path: string | null;
  title: string;
  artist: string;
  album_artist: string;
  album: string;
  genre: string;
  year: number | null;
  track_number: number | null;
};

export type ArtistRow = {
  name: string;
  image_path: string | null;
};

export type AlbumRow = {
  name: string;
  album_artist: string;
  year: number | null;
};

export type ScanProgressPayload = {
  total_found: number;
  processed: number;
  inserted: number;
  failed: number;
  current_file: string;
  completed: boolean;
};

export type PlaybackStatePayload = {
  is_playing: boolean;
  ended: boolean;
  current_path: string;
  title: string;
  artist: string;
  album: string;
  position_secs: number;
  duration_secs: number;
  volume: number;
};

export type PersistedPlaybackSession = {
  current_path: string;
  title: string;
  artist: string;
  album: string;
  position_secs: number;
  volume: number;
  was_playing: boolean;
  shuffle_enabled: boolean;
  repeat_enabled: boolean;
  view: LibraryView;
  queue_paths: string[];
  current_index: number | null;
};

export type LibraryView = "songs" | "albums" | "artists" | "genres";

export type AppPage = "home" | "library" | "settings";

export type AlbumSummary = {
  key: string;
  name: string;
  artist: string;
  artworkPath: string | null;
  year: number | null;
  genre: string;
  trackCount: number;
  tracks: TrackRow[];
};

export type AlbumArtCandidate = {
  image_url: string;
  preview_url: string;
  label: string;
  source: string;
  width: number;
  height: number;
  file_size_bytes: number;
  score: number;
};

export type EditableTrackInput = {
  file_path: string;
  title: string;
  artist: string;
  genre: string | null;
  year: number | null;
  track_number: number | null;
};

export type SaveAlbumMetadataPayload = {
  album_title: string;
  album_artist: string;
  genre: string | null;
  year: number | null;
  artwork_url: string | null;
  tracks: EditableTrackInput[];
};

export type SaveAlbumMetadataResult = {
  updated_album_key: string;
  updated_files: string[];
  failed_files: string[];
};

export type GenreSummary = {
  name: string;
  trackCount: number;
  albumCount: number;
  artistCount: number;
  tracks: TrackRow[];
  albums: AlbumSummary[];
};

export type UserProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  background_type: string;
  background_url: string | null;
  theme: string;
  accent_color: string;
  level: number;
  xp: number;
  created_at: number;
};

export type ListeningEvent = {
  id: string;
  track_id: string;
  artist_id: string;
  album_id: string;
  genre: string;
  duration_played: number;
  completed: boolean;
  timestamp: number;
  playback_source: string;
  skipped: boolean;
};

export type TimeSlicePoint = {
  label: string;
  seconds: number;
};

export type GenreStat = {
  genre: string;
  seconds: number;
  percentage: number;
};

export type RankedItem = {
  id: string;
  title: string;
  subtitle: string;
  artwork_path: string | null;
  plays: number;
  seconds: number;
};

export type AggregatedStats = {
  total_listening_time: number;
  today_listening_time: number;
  last_7_days_listening_time: number;
  last_30_days_listening_time: number;
  daily_listening_time: TimeSlicePoint[];
  weekly_listening_time: TimeSlicePoint[];
  genre_breakdown: GenreStat[];
  top_tracks: RankedItem[];
  top_artists: RankedItem[];
  top_albums: RankedItem[];
  listening_streak: number;
  longest_session: number;
  most_active_time_of_day: string;
  repeat_counts: Record<string, number>;
  average_session_length: number;
  new_artists_this_week: number;
  new_tracks_this_week: number;
  week_over_week_change: number;
  insight: string;
};

export type UserAchievement = {
  achievement_id: string;
  progress: number;
  unlocked: boolean;
  unlocked_at: number | null;
};

export type FavoriteItem = {
  kind: string;
  item_key: string;
  title: string;
  subtitle: string;
  artwork_path: string | null;
  pinned_at: number;
};

export type ActivityFeedItem = {
  id: string;
  message: string;
  timestamp: number;
};

export type HomeDataPayload = {
  profile: UserProfile;
  stats: AggregatedStats;
  achievements: UserAchievement[];
  featured_achievements: UserAchievement[];
  upcoming_achievements: UserAchievement[];
  favorites: FavoriteItem[];
  recent_activity: ActivityFeedItem[];
};

export type SaveProfilePayload = {
  username: string;
  avatar_url: string | null;
  background_type: string;
  background_url: string | null;
  theme: string;
  accent_color: string;
};

export type FavoriteMutationPayload = {
  kind: string;
  item_key: string;
  title: string;
  subtitle: string;
  artwork_path: string | null;
  pinned: boolean;
};
