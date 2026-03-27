import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon } from "./Icons";

type StickySectionNavProps = {
  currentSection: string;
  availableSections: string[];
  onJumpToSection: (section: string) => void;
};

const allSections = ["&", ...Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))];

export function StickySectionNav({
  currentSection,
  availableSections,
  onJumpToSection,
}: StickySectionNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const availableSet = useMemo(() => new Set(availableSections), [availableSections]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    function handlePointerDown(event: MouseEvent) {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className="relative flex w-fit items-center">
      <div ref={popoverRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className="win-pane-strong inline-flex min-w-14 items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-white/88 shadow-[var(--win-shadow-sm)] hover:text-white"
        >
          <span className="min-w-4 text-base font-semibold text-white">{currentSection}</span>
          <ChevronDownIcon className={`h-4 w-4 text-white/44 transition ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen ? (
          <div className="fixed inset-x-0 top-[7rem] bottom-[6.1rem] z-[65] flex items-center justify-center bg-[rgba(10,13,18,0.42)] backdrop-blur-[14px]">
            <div className="win-pane-strong win-overlay-entry w-full max-w-[22rem] rounded-[28px] bg-[rgba(27,31,36,0.94)] p-5 shadow-[var(--win-shadow-lg)]">
              <div className="grid grid-cols-6 gap-2.5">
                {allSections.map((section) => {
                  const enabled = availableSet.has(section);

                  return (
                    <button
                      key={section}
                      type="button"
                      disabled={!enabled}
                      onClick={() => {
                        if (!enabled) {
                          return;
                        }

                        onJumpToSection(section);
                        setIsOpen(false);
                      }}
                      className={`inline-flex h-11 items-center justify-center rounded-[14px] text-[13px] font-medium transition ${
                        currentSection === section
                          ? "bg-[rgba(127,179,255,0.92)] text-[#101722]"
                          : enabled
                            ? "bg-white/[0.04] text-white/82 hover:bg-white/[0.08] hover:text-white"
                            : "cursor-not-allowed bg-white/[0.02] text-white/28"
                      }`}
                    >
                      {section}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
