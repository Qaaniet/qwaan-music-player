import { convertFileSrc } from "@tauri-apps/api/core";
import { memo, useState } from "react";
import type { ArtistRow } from "../types";

type ArtistGridProps = {
  sections: Array<[string, ArtistRow[]]>;
  onSelectArtist: (artist: string) => void;
  onRegisterSectionRef?: (section: string, element: HTMLElement | null) => void;
};

function artistGradient(name: string) {
  const tones = [
    "from-sky-500 to-blue-700",
    "from-fuchsia-500 to-rose-700",
    "from-emerald-500 to-teal-700",
    "from-orange-500 to-red-700",
    "from-violet-500 to-indigo-700",
  ];

  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length;
  return tones[index];
}

const ArtistImage = memo(function ArtistImage({
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
        className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:scale-[1.02] group-hover:brightness-105"
      />
    );
  }

  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${artistGradient(artist.name)}`}>
      <div className="absolute inset-x-3 bottom-3 text-4xl font-semibold text-white/85">
        {artist.name.charAt(0).toUpperCase()}
      </div>
    </div>
  );
});

const ArtistCard = memo(function ArtistCard({
  artist,
  onSelectArtist,
}: {
  artist: ArtistRow;
  onSelectArtist: (artist: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectArtist(artist.name)}
      data-library-item="artist"
      data-library-item-key={artist.name}
      data-library-section={artist.name.trim().charAt(0).toUpperCase().match(/^[A-Z]$/) ? artist.name.trim().charAt(0).toUpperCase() : "&"}
      className="group w-[168px] space-y-2.5 text-left"
      style={{ contentVisibility: "auto", containIntrinsicSize: "250px" }}
    >
      <div className="relative h-[168px] w-[168px] overflow-hidden rounded-[18px] border border-white/8 bg-white/[0.03] transition duration-200 hover:border-white/14 hover:shadow-[0_14px_28px_rgba(0,0,0,0.18)]">
        <ArtistImage artist={artist} />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(6,8,12,0.58),rgba(6,8,12,0.08))]" />
      </div>
      <div className="h-[44px] text-[14px] font-semibold text-white/94">
        <div className="line-clamp-2 leading-snug">{artist.name}</div>
      </div>
    </button>
  );
});

export const ArtistGrid = memo(function ArtistGrid({
  sections,
  onSelectArtist,
  onRegisterSectionRef,
}: ArtistGridProps) {
  return (
    <div className="space-y-8">
      {sections.map(([section, artists]) => (
        <section
          key={section}
          ref={(element) => onRegisterSectionRef?.(section, element)}
          data-library-section={section}
          className="space-y-3"
          style={{ contentVisibility: "auto", containIntrinsicSize: "720px" }}
        >
          <div className="text-[28px] font-semibold tracking-[-0.03em] text-white/76">{section}</div>
          <div className="grid grid-cols-[repeat(auto-fill,168px)] justify-start gap-x-5 gap-y-8">
            {artists.map((artist) => (
              <ArtistCard
                key={artist.name}
                artist={artist}
                onSelectArtist={onSelectArtist}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});
