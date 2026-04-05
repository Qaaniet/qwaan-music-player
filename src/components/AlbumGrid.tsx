import { convertFileSrc } from "@tauri-apps/api/core";
import { memo, useState } from "react";
import type { AlbumSummary, TrackRow } from "../types";
import { PlayIcon } from "./Icons";

function coverStyle(seed: string) {
  const gradients = [
    "from-slate-500 via-slate-400 to-slate-700",
    "from-sky-500 via-blue-500 to-indigo-700",
    "from-emerald-500 via-teal-400 to-cyan-700",
    "from-amber-500 via-orange-500 to-rose-600",
    "from-zinc-500 via-zinc-700 to-zinc-900",
    "from-violet-500 via-fuchsia-500 to-indigo-700",
  ];

  const index = Math.abs(
    [...seed].reduce((total, char) => total + char.charCodeAt(0), 0),
  ) % gradients.length;

  return gradients[index];
}

type AlbumGridProps = {
  sections: Array<[string, AlbumSummary[]]>;
  currentAlbumKey: string;
  onOpenAlbum: (album: AlbumSummary) => void;
  onOpenArtist: (artist: string) => void;
  onPlayAlbum: (track: TrackRow, queue: TrackRow[]) => void;
  onRegisterSectionRef?: (section: string, element: HTMLElement | null) => void;
};

const AlbumCover = memo(function AlbumCover({
  album,
}: {
  album: AlbumSummary;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const artworkUrl = album.artworkPath && !imageFailed ? convertFileSrc(album.artworkPath) : null;

  if (artworkUrl) {
    return (
      <img
        src={artworkUrl}
        alt={`${album.name} cover`}
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-[1.03] group-hover:brightness-105"
      />
    );
  }

  return (
    <div
      className={`absolute inset-0 bg-gradient-to-br ${coverStyle(album.key)}`}
    />
  );
});

const AlbumCard = memo(function AlbumCard({
  album,
  isCurrent,
  onOpenAlbum,
  onOpenArtist,
  onPlayAlbum,
}: {
  album: AlbumSummary;
  isCurrent: boolean;
  onOpenAlbum: (album: AlbumSummary) => void;
  onOpenArtist: (artist: string) => void;
  onPlayAlbum: (track: TrackRow, queue: TrackRow[]) => void;
}) {
  const leadTrack = album.tracks[0];

  return (
    <article
      data-library-item="album"
      data-library-item-key={album.key}
      data-library-section={album.name.trim().charAt(0).toUpperCase().match(/^[A-Z]$/) ? album.name.trim().charAt(0).toUpperCase() : "&"}
      className="group flex w-[164px] flex-col gap-2.5"
      style={{ contentVisibility: "auto", containIntrinsicSize: "250px" }}
    >
      <div
        className={`relative h-[164px] w-[164px] overflow-hidden rounded-[4px] border transition-all duration-200 ${
          isCurrent
            ? "border-[rgba(var(--win-accent-rgb),0.32)] shadow-[inset_3px_0_0_var(--win-accent)]"
            : "border-[var(--win-border)] hover:border-[var(--win-border-strong)] hover:bg-[var(--win-pane-hover)] hover:shadow-[var(--win-shadow-sm)]"
        }`}
      >
        <button
          type="button"
          onClick={() => onOpenAlbum(album)}
          aria-label={`Open ${album.name}`}
          className="absolute inset-0 z-10"
        />
        <AlbumCover album={album} />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.42),rgba(0,0,0,0.04))]" />
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-transparent transition-opacity duration-200 group-hover:bg-[rgba(0,0,0,0.18)]">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (leadTrack) {
                onPlayAlbum(leadTrack, album.tracks);
              }
            }}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[4px] border border-[var(--win-border-strong)] bg-[rgba(249,249,249,0.92)] text-[#101722] opacity-0 shadow-[var(--win-shadow-sm)] transition duration-200 group-hover:opacity-100"
          >
            <PlayIcon className="ml-0.5 h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-[58px] flex-col justify-start px-0.5 pb-1">
        <div className="line-clamp-2 text-[13px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--win-text)]">
          {album.name}
        </div>
        <button
          type="button"
          onClick={() => onOpenArtist(album.artist)}
          className="mt-0.5 truncate text-left text-[12px] leading-5 text-[var(--win-text-secondary)] transition hover:text-[var(--win-accent-strong)]"
        >
          {album.artist}
        </button>
      </div>
    </article>
  );
});

export const AlbumGrid = memo(function AlbumGrid({
  sections,
  currentAlbumKey,
  onOpenAlbum,
  onOpenArtist,
  onPlayAlbum,
  onRegisterSectionRef,
}: AlbumGridProps) {
  return (
    <div className="space-y-7">
      {sections.map(([section, albums]) => (
        <section
          key={section}
          ref={(element) => onRegisterSectionRef?.(section, element)}
          data-library-section={section}
          className="space-y-2.5"
          style={{ contentVisibility: "auto", containIntrinsicSize: "720px" }}
        >
          {section ? (
            <div className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--win-text-secondary)]">{section}</div>
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fill,164px)] justify-start gap-x-5 gap-y-7">
            {albums.map((album) => {
              return (
                <AlbumCard
                  key={album.key}
                  album={album}
                  isCurrent={currentAlbumKey === album.key}
                  onOpenAlbum={onOpenAlbum}
                  onOpenArtist={onOpenArtist}
                  onPlayAlbum={onPlayAlbum}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
});
