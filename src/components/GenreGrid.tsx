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
      className="group win-pane flex h-[140px] w-[184px] flex-col justify-between rounded-[6px] px-4 py-4 text-center transition hover:border-[var(--win-border-strong)] hover:bg-[var(--win-pane-hover)] hover:shadow-[var(--win-shadow-sm)]"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center px-2">
        <div className="line-clamp-2 overflow-hidden text-[13px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--win-text)]">
          {genre.name}
        </div>
      </div>
      <div className="border-t border-[var(--win-border)] pt-3 text-[11.5px] leading-5 text-[var(--win-text-secondary)]">
        <div className="truncate">{genre.trackCount} {genre.trackCount === 1 ? "song" : "songs"}</div>
        <div className="truncate">{genre.albumCount} {genre.albumCount === 1 ? "album" : "albums"}</div>
      </div>
    </button>
  );
});

export const GenreGrid = memo(function GenreGrid({
  sections,
  onSelectGenre,
}: GenreGridProps) {
  return (
    <div className="space-y-7">
      {sections.map(([section, genres]) => (
        <section key={section} className="space-y-2.5">
          <div className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--win-text-secondary)]">{section}</div>
          <div className="grid grid-cols-[repeat(auto-fill,184px)] justify-start gap-x-4 gap-y-5">
            {genres.map((genre) => (
              <GenreCard key={genre.name} genre={genre} onSelectGenre={onSelectGenre} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});
