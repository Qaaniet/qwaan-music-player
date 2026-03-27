import { getCurrentWindow } from "@tauri-apps/api/window";
import { type ReactNode, useEffect, useState } from "react";

function MinimizeGlyph() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M1.5 5.25h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function MaximizeGlyph({ maximized }: { maximized: boolean }) {
  return maximized ? (
    <svg viewBox="0 0 10 10" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M3 2.2h4.2v4.2H3z" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path d="M2 3.3V7.8h4.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ) : (
    <svg viewBox="0 0 10 10" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M2.1 2.1h5.8v5.8H2.1z" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M2.1 2.1 7.9 7.9M7.9 2.1 2.1 7.9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function ChromeButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tauri-drag-region="false"
      onMouseDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={() => {
        void onClick().catch((error) => {
          console.error(`[WindowChrome] ${label} failed`, error);
        });
      }}
      className={`group inline-flex h-10 w-12 items-center justify-center rounded-[10px] transition-colors duration-150 ${
        danger
          ? "text-white/78 hover:bg-[#c42b1c] hover:text-white active:bg-[#a52417]"
          : "text-white/74 hover:bg-white/[0.075] hover:text-white active:bg-white/[0.12]"
      }`}
    >
      <span className="translate-y-[0.5px]">{children}</span>
    </button>
  );
}

export function WindowChrome() {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const syncState = async () => {
      const maximized = await appWindow.isMaximized();
      if (mounted) {
        setIsMaximized(maximized);
      }
    };

    void syncState().catch((error) => {
      console.error("[WindowChrome] Failed to sync maximized state", error);
    });

    const unlistenResizePromise = appWindow.onResized(() => {
      void syncState().catch((error) => {
        console.error("[WindowChrome] Failed to sync maximized state after resize", error);
      });
    });

    return () => {
      mounted = false;
      void unlistenResizePromise.then((unlisten) => unlisten());
    };
  }, [appWindow]);

  const handleToggleMaximize = async () => {
    await appWindow.toggleMaximize();
    const maximized = await appWindow.isMaximized();
    setIsMaximized(maximized);
  };

  const handleMinimize = async () => {
    await appWindow.minimize();
  };

  const handleClose = async () => {
    await appWindow.close();
  };

  return (
    <header className="win-app-shell relative z-[80] h-12 select-none border-b border-white/10 bg-[rgba(10,14,22,0.72)] backdrop-blur-xl">
      <div className="flex h-full items-center justify-between">
      <div
        data-tauri-drag-region
        onDoubleClick={() => {
          void handleToggleMaximize().catch((error) => {
            console.error("[WindowChrome] Toggle maximize failed", error);
          });
        }}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 select-none"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[9px] bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(var(--win-accent-rgb),0.9))] text-[11px] font-semibold text-[#09111d] shadow-[0_12px_24px_rgba(var(--win-accent-rgb),0.18)]">
          Q
        </div>
        <div className="truncate text-[12.5px] font-medium tracking-[-0.01em] text-white/84">
          Qwaan Music Player
        </div>
      </div>

      <div data-tauri-drag-region="false" className="flex h-full items-stretch">
        <ChromeButton label="Minimize" onClick={handleMinimize}>
          <MinimizeGlyph />
        </ChromeButton>
        <ChromeButton
          label={isMaximized ? "Restore down" : "Maximize"}
          onClick={handleToggleMaximize}
        >
          <MaximizeGlyph maximized={isMaximized} />
        </ChromeButton>
        <ChromeButton label="Close" danger onClick={handleClose}>
          <CloseGlyph />
        </ChromeButton>
      </div>
      </div>
    </header>
  );
}
