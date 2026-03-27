import { convertFileSrc } from "@tauri-apps/api/core";
import { memo, useMemo, useState } from "react";
import type { AlbumSummary, ArtistRow, TrackRow } from "../types";
import { AlbumGrid } from "./AlbumGrid";
import { PlayIcon } from "./Icons";

type ArtistDetailsViewProps = {
  artist: ArtistRow;
  albums: AlbumSummary[];
  currentAlbumKey: string;
  onBack: () => void;
  onOpenAlbum: (album: AlbumSummary) => void;
  onPlayAlbum: (track: TrackRow, queue: TrackRow[]) => void;
  onShuffleArtist: (albums: AlbumSummary[]) => void;
};

function artistGradient(name: string) {
  const tones = [
    "from-sky-500 to-blue-800",
    "from-fuchsia-500 to-rose-700",
    "from-emerald-500 to-teal-800",
    "from-orange-500 to-red-700",
    "from-violet-500 to-indigo-800",
  ];

  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length;
  return tones[index];
}

const ArtistHeroImage = memo(function ArtistHeroImage({
  artist,
}: {
  artist: ArtistRow;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = artist.image_path && !imageFailed ? convertFileSrc(artist.image_path) : null;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${artist.name} artist`}
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${artistGradient(artist.name)}`}>
      <div className="absolute inset-x-4 bottom-4 text-6xl font-semibold text-white/88">
        {artist.name.charAt(0).toUpperCase()}
      </div>
    </div>
  );
});

export function ArtistDetailsView({
  artist,
  albums,
  currentAlbumKey,
  onBack,
  onOpenAlbum,
  onPlayAlbum,
  onShuffleArtist,
}: ArtistDetailsViewProps) {
  const summaryGenre = useMemo(() => {
    const genres = [...new Set(albums.map((album) => album.genre).filter(Boolean))];
    return genres[0] ?? "Unknown genre";
  }, [albums]);

  const songCount = useMemo(
    () => albums.reduce((total, album) => total + album.trackCount, 0),
    [albums],
  );

  return (
    <div className="space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[13px] text-white/56 transition hover:text-white/88"
      >
        <span aria-hidden="true">←</span>
        Back to artists
      </button>

      <section className="win-pane rounded-[24px] px-6 py-7">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end">
          <div className="relative h-[220px] w-[220px] shrink-0 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] shadow-[0_18px_34px_rgba(0,0,0,0.22)]">
            <ArtistHeroImage artist={artist} />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.48),rgba(0,0,0,0.08))]" />
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Artist</div>
              <h2 className="text-[2.7rem] font-semibold tracking-[-0.04em] text-white/96">{artist.name}</h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-white/50">
                <span>{albums.length} {albums.length === 1 ? "album" : "albums"}</span>
                <span className="text-white/24">•</span>
                <span>{songCount} {songCount === 1 ? "song" : "songs"}</span>
                <span className="text-zinc-700">•</span>
                <span>{summaryGenre}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const firstAlbum = albums[0];
                  const leadTrack = firstAlbum?.tracks[0];
                  if (leadTrack) {
                    onPlayAlbum(leadTrack, firstAlbum.tracks);
                  }
                }}
                className="win-button-primary inline-flex h-11 items-center gap-2 rounded-[14px] px-5 text-[13px] font-semibold"
              >
                <PlayIcon className="ml-0.5 h-4 w-4" />
                Play all
              </button>
              <button
                type="button"
                onClick={() => onShuffleArtist(albums)}
                className="win-button inline-flex h-11 items-center rounded-[14px] px-5 text-[13px] font-medium"
              >
                Shuffle and play
              </button>
              <button
                type="button"
                disabled
                className="win-button inline-flex h-11 items-center rounded-[14px] px-5 text-[13px] font-medium text-white/36"
              >
                Add to
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">In your library</div>
        <AlbumGrid
          sections={[["", albums]]}
          currentAlbumKey={currentAlbumKey}
          onOpenAlbum={onOpenAlbum}
          onPlayAlbum={onPlayAlbum}
        />
      </section>
    </div>
  );
}
