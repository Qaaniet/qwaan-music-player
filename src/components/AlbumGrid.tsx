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
  onPlayAlbum,
}: {
  album: AlbumSummary;
  isCurrent: boolean;
  onOpenAlbum: (album: AlbumSummary) => void;
  onPlayAlbum: (track: TrackRow, queue: TrackRow[]) => void;
}) {
  const leadTrack = album.tracks[0];

  return (
    <article
      data-library-item="album"
      data-library-item-key={album.key}
      data-library-section={album.name.trim().charAt(0).toUpperCase().match(/^[A-Z]$/) ? album.name.trim().charAt(0).toUpperCase() : "&"}
      className="group w-[168px] space-y-2.5"
      style={{ contentVisibility: "auto", containIntrinsicSize: "250px" }}
    >
      <div
        className={`relative h-[168px] w-[168px] overflow-hidden rounded-[18px] border transition-all duration-200 ${
          isCurrent
            ? "border-[rgba(127,179,255,0.42)] shadow-[0_0_0_1px_rgba(127,179,255,0.18),0_16px_32px_rgba(0,0,0,0.18)]"
            : "border-white/8 hover:border-white/14 hover:bg-white/[0.02] hover:shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
        }`}
      >
        <button
          type="button"
          onClick={() => onOpenAlbum(album)}
          aria-label={`Open ${album.name}`}
          className="absolute inset-0 z-10"
        />
        <AlbumCover album={album} />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(7,9,12,0.72),rgba(7,9,12,0.08))]" />
        <div className="absolute inset-x-2.5 bottom-2.5">
          <div className="line-clamp-2 text-[14px] font-semibold leading-tight text-white/96">
            {album.name}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[rgba(8,10,14,0)] transition-opacity duration-200 group-hover:bg-[rgba(8,10,14,0.22)]">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (leadTrack) {
                onPlayAlbum(leadTrack, album.tracks);
              }
            }}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[rgba(241,244,250,0.92)] text-[#101722] opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.24)] transition duration-200 group-hover:opacity-100"
          >
            <PlayIcon className="ml-0.5 h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <div className="h-[52px] space-y-0.5">
        <div className="line-clamp-2 text-[14px] font-semibold leading-snug text-white/94">
          {album.name}
        </div>
        <div className="truncate text-[12px] text-white/56">{album.artist}</div>
      </div>
    </article>
  );
});

export const AlbumGrid = memo(function AlbumGrid({
  sections,
  currentAlbumKey,
  onOpenAlbum,
  onPlayAlbum,
  onRegisterSectionRef,
}: AlbumGridProps) {
  return (
    <div className="space-y-8">
      {sections.map(([section, albums]) => (
        <section
          key={section}
          ref={(element) => onRegisterSectionRef?.(section, element)}
          data-library-section={section}
          className="space-y-3"
          style={{ contentVisibility: "auto", containIntrinsicSize: "720px" }}
        >
          {section ? (
            <div className="text-[28px] font-semibold tracking-[-0.03em] text-white/76">{section}</div>
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fill,168px)] justify-start gap-x-5 gap-y-8">
            {albums.map((album) => {
              return (
                <AlbumCard
                  key={album.key}
                  album={album}
                  isCurrent={currentAlbumKey === album.key}
                  onOpenAlbum={onOpenAlbum}
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
