import { useLayoutEffect, useRef, useState } from "react";
import type { LibraryView } from "../types";

type TopBarProps = {
  view: LibraryView;
  onViewChange: (view: LibraryView) => void;
};

const tabs: Array<{ id: LibraryView; label: string }> = [
  { id: "songs", label: "Songs" },
  { id: "albums", label: "Albums" },
  { id: "artists", label: "Artists" },
  { id: "genres", label: "Genres" },
];

export function TopBar({
  view,
  onViewChange,
}: TopBarProps) {
  const tabRefs = useRef(new Map<LibraryView, HTMLButtonElement>());
  const navRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  useLayoutEffect(() => {
    const activeTab = tabRefs.current.get(view);
    const nav = navRef.current;

    if (!activeTab || !nav) {
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();

    setIndicator({
      left: tabRect.left - navRect.left + (tabRect.width - 18) / 2,
      width: 18,
      opacity: 1,
    });
  }, [view]);

  return (
    <header className="flex items-end">
      <div
        ref={navRef}
        className="relative inline-flex items-center gap-4 border-b border-[var(--win-border)] pb-1.5"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) {
                tabRefs.current.set(tab.id, element);
              } else {
                tabRefs.current.delete(tab.id);
              }
            }}
            type="button"
            onClick={() => onViewChange(tab.id)}
            className={`win-tab px-0 py-1 text-[12px] font-medium tracking-[0.01em] ${
              view === tab.id ? "text-[var(--win-text)]" : "text-[var(--win-text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}

        <span
          className="absolute bottom-[-2px] h-[2px] rounded-full bg-[var(--win-accent)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            left: indicator.left,
            width: indicator.width,
            opacity: indicator.opacity,
          }}
        />
      </div>
    </header>
  );
}
