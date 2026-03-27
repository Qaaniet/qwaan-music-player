import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LibraryView } from "../types";
import { PlusFolderIcon } from "./Icons";

type TopBarProps = {
  view: LibraryView;
  onViewChange: (view: LibraryView) => void;
  onChooseFolder: () => void;
  isScanning: boolean;
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
  onChooseFolder,
  isScanning,
}: TopBarProps) {
  const tabRefs = useRef(new Map<LibraryView, HTMLButtonElement>());
  const navRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  const activeLabel = useMemo(
    () => tabs.find((tab) => tab.id === view)?.label ?? "Music",
    [view],
  );

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
    <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/38">
            Library
          </div>
          <div className="text-[2.45rem] font-semibold tracking-[-0.045em] text-white/94">
            {activeLabel}
          </div>
        </div>

        <div
          ref={navRef}
          className="win-pane-strong relative inline-flex items-center gap-1 rounded-[999px] p-1.5 shadow-[var(--win-shadow-sm)]"
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
              className={`win-tab rounded-[12px] px-4 py-2.5 text-[13px] font-medium ${
                view === tab.id ? "translate-y-[-1px] text-white" : "text-white/56"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <span
            className="absolute bottom-[7px] h-[3px] rounded-full bg-[var(--win-accent-strong)] shadow-[0_0_18px_rgba(var(--win-accent-rgb),0.42)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{
              left: indicator.left,
              width: indicator.width,
              opacity: indicator.opacity,
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onChooseFolder}
        disabled={isScanning}
        className="win-button inline-flex h-11 items-center gap-2 self-start rounded-full px-4 text-[13px] font-medium text-white/88 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <PlusFolderIcon className="h-4 w-4" />
        {isScanning ? "Scanning..." : "Add folder"}
      </button>
    </header>
  );
}
