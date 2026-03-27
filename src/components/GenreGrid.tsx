import { memo } from "react";
import type { GenreSummary } from "../types";

type GenreGridProps = {
  sections: Array<[string, GenreSummary[]]>;
  onSelectGenre: (genre: string) => void;
};

const GenreCard = memo(function GenreCard({
  genre,
  onSelectGenre,
}: {
  genre: GenreSummary;
  onSelectGenre: (genre: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectGenre(genre.name)}
      className="group win-pane w-[188px] rounded-[20px] p-4 text-left transition hover:border-white/14 hover:bg-white/[0.06] hover:shadow-[0_14px_28px_rgba(0,0,0,0.16)]"
    >
      <div className="text-[16px] font-semibold text-white/94">{genre.name}</div>
      <div className="mt-3 space-y-1 text-[12px] text-white/56">
        <div>{genre.trackCount} {genre.trackCount === 1 ? "song" : "songs"}</div>
        <div>{genre.albumCount} {genre.albumCount === 1 ? "album" : "albums"}</div>
      </div>
    </button>
  );
});

export const GenreGrid = memo(function GenreGrid({
  sections,
  onSelectGenre,
}: GenreGridProps) {
  return (
    <div className="space-y-8">
      {sections.map(([section, genres]) => (
        <section key={section} className="space-y-3">
          <div className="text-[28px] font-semibold tracking-[-0.03em] text-white/76">{section}</div>
          <div className="grid grid-cols-[repeat(auto-fill,188px)] justify-start gap-x-4 gap-y-5">
            {genres.map((genre) => (
              <GenreCard key={genre.name} genre={genre} onSelectGenre={onSelectGenre} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});
