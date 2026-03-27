import type { AlbumSummary, GenreSummary, PlaybackStatePayload, TrackRow } from "../types";
import { AlbumGrid } from "./AlbumGrid";
import { PlayIcon } from "./Icons";
import { SongTable } from "./SongTable";

type GenreDetailsViewProps = {
  genre: GenreSummary;
  playback: PlaybackStatePayload;
  currentAlbumKey: string;
  onBack: () => void;
  onOpenAlbum: (album: AlbumSummary) => void;
  onPlayTrack: (track: TrackRow, queue?: TrackRow[]) => void;
};

export function GenreDetailsView({
  genre,
  playback,
  currentAlbumKey,
  onBack,
  onOpenAlbum,
  onPlayTrack,
}: GenreDetailsViewProps) {
  return (
    <div className="space-y-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[13px] text-white/56 transition hover:text-white/88"
      >
        <span aria-hidden="true">←</span>
        Back to genres
      </button>

      <section className="win-pane rounded-[24px] px-6 py-7">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Genre</div>
            <h2 className="text-[2.7rem] font-semibold tracking-[-0.04em] text-white/96">{genre.name}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-white/50">
              <span>{genre.trackCount} {genre.trackCount === 1 ? "song" : "songs"}</span>
              <span className="text-white/24">•</span>
              <span>{genre.albumCount} {genre.albumCount === 1 ? "album" : "albums"}</span>
              <span className="text-zinc-700">•</span>
              <span>{genre.artistCount} {genre.artistCount === 1 ? "artist" : "artists"}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const leadTrack = genre.tracks[0];
              if (leadTrack) {
                onPlayTrack(leadTrack, genre.tracks);
              }
            }}
            className="win-button-primary inline-flex h-11 items-center gap-2 rounded-[14px] px-5 text-[13px] font-semibold"
          >
            <PlayIcon className="ml-0.5 h-4 w-4" />
            Play genre
          </button>
        </div>
      </section>

      {genre.albums.length > 0 ? (
        <section className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Albums</div>
          <AlbumGrid
            sections={[["", genre.albums]]}
            currentAlbumKey={currentAlbumKey}
            onOpenAlbum={onOpenAlbum}
            onPlayAlbum={(track, queue) => onPlayTrack(track, queue)}
          />
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Songs</div>
        <SongTable
          tracks={genre.tracks}
          playback={playback}
          onPlayTrack={(track) => onPlayTrack(track, genre.tracks)}
        />
      </section>
    </div>
  );
}
