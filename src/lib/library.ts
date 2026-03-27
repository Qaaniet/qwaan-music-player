import type { AlbumRow, AlbumSummary, ArtistRow, GenreSummary, TrackRow } from "../types";
import { normalizeGenre } from "./genres";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function matchesSearch(values: Array<string | null | undefined>, query: string) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => normalize(value ?? "").includes(normalizedQuery));
}

export function buildAlbumSummaries(tracks: TrackRow[], albums: AlbumRow[]): AlbumSummary[] {
  const grouped = new Map<string, AlbumSummary>();
  const yearLookup = new Map<string, number | null>(
    albums.map((album) => [`${album.album_artist}__${album.name}`, album.year]),
  );

  for (const track of tracks) {
    const key = `${track.album_artist}__${track.album}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.tracks.push(track);
      existing.trackCount += 1;
      if (!existing.artworkPath && track.artwork_path) {
        existing.artworkPath = track.artwork_path;
      }
      continue;
    }

    grouped.set(key, {
      key,
      name: track.album,
      artist: track.album_artist,
      artworkPath: track.artwork_path,
      year: yearLookup.get(key) ?? track.year,
      genre: track.genre,
      trackCount: 1,
      tracks: [track],
    });
  }

  return [...grouped.values()].sort((left, right) => {
    const artistOrder = left.artist.localeCompare(right.artist);
    if (artistOrder !== 0) {
      return artistOrder;
    }

    return left.name.localeCompare(right.name);
  });
}

function groupByInitial<T>(items: T[], pickName: (item: T) => string) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const first = pickName(item).trim().charAt(0).toUpperCase();
    const key = /^[A-Z]$/.test(first) ? first : "&";
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  return [...groups.entries()].sort(([left], [right]) => {
    if (left === "&") {
      return -1;
    }

    if (right === "&") {
      return 1;
    }

    return left.localeCompare(right);
  });
}

export function groupAlbumsByInitial(albums: AlbumSummary[]) {
  return groupByInitial(albums, (album) => album.name);
}

export function groupArtistsByInitial(artists: ArtistRow[]) {
  return groupByInitial(artists, (artist) => artist.name);
}

export function genreOptions(tracks: TrackRow[]) {
  return [...new Set(tracks.map((track) => normalizeGenre(track.genre)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function filterTracks(tracks: TrackRow[], search: string, genre: string) {
  return tracks.filter((track) => {
    const genreMatch = genre === "All genres" || track.genre === genre;
    return (
      genreMatch &&
      matchesSearch(
        [track.title, track.artist, track.album, track.album_artist, track.genre],
        search,
      )
    );
  });
}

export function filterAlbums(albums: AlbumSummary[], search: string, genre: string) {
  return albums.filter((album) => {
    const genreMatch = genre === "All genres" || album.genre === genre;
    return genreMatch && matchesSearch([album.name, album.artist, album.genre], search);
  });
}

export function filterArtists(artists: ArtistRow[], search: string) {
  return artists.filter((artist) => matchesSearch([artist.name], search));
}

export function sortAlbums(albums: AlbumSummary[], order: "A-Z" | "Recently added") {
  if (order === "Recently added") {
    return [...albums].sort((left, right) => right.trackCount - left.trackCount);
  }

  return [...albums].sort((left, right) => left.name.localeCompare(right.name));
}

export function sortTracks(tracks: TrackRow[], order: "A-Z" | "Recently added") {
  if (order === "Recently added") {
    return [...tracks].sort(
      (left, right) => (right.year ?? Number.MIN_SAFE_INTEGER) - (left.year ?? Number.MIN_SAFE_INTEGER),
    );
  }

  return [...tracks].sort((left, right) => left.title.localeCompare(right.title));
}

export function buildGenreSummaries(tracks: TrackRow[], albums: AlbumSummary[]): GenreSummary[] {
  const grouped = new Map<string, GenreSummary>();

  for (const track of tracks) {
    const genre = normalizeGenre(track.genre);
    if (!genre) {
      continue;
    }

    const existing = grouped.get(genre);

    if (existing) {
      existing.tracks.push(track);
      continue;
    }

    grouped.set(genre, {
      name: genre,
      trackCount: 0,
      albumCount: 0,
      artistCount: 0,
      tracks: [track],
      albums: [],
    });
  }

  for (const summary of grouped.values()) {
    summary.trackCount = summary.tracks.length;
    summary.albums = albums.filter((album) => normalizeGenre(album.genre) === summary.name);
    summary.albumCount = summary.albums.length;
    summary.artistCount = new Set(summary.tracks.map((track) => track.artist)).size;
  }

  return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function filterGenres(genres: GenreSummary[], search: string) {
  return genres.filter((genre) => matchesSearch([genre.name], search));
}

export function groupGenresByInitial(genres: GenreSummary[]) {
  return groupByInitial(genres, (genre) => genre.name);
}
