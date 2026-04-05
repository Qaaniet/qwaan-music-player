import type { ReactNode } from "react";
import {
  HomeIcon,
  LibraryIcon,
  MenuIcon,
  PlaylistIcon,
  QueueIcon,
  SearchIcon,
  SettingsIcon,
} from "./Icons";

type SidebarProps = {
  isOpen: boolean;
  searchTerm: string;
  currentPage: "home" | "library" | "settings";
  onSearchTermChange: (value: string) => void;
  onToggle: () => void;
  onOpenHome: () => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
};

const primaryItems = [
  { label: "Home", icon: HomeIcon },
  { label: "Music library", icon: LibraryIcon },
];

const secondaryItems = [
  { label: "Play queue", icon: QueueIcon },
  { label: "Playlists", icon: PlaylistIcon },
];

function SidebarButton({
  label,
  active,
  collapsed,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full items-center gap-2 rounded-[4px] border px-2.5 py-2 text-[12px] transition ${
        active
          ? "border-[var(--win-border-strong)] bg-[var(--win-pane-hover)] text-[var(--win-text)]"
          : "border-transparent text-[var(--win-text-secondary)] hover:border-[var(--win-border)] hover:bg-[var(--win-pane-hover)] hover:text-[var(--win-text)]"
      } ${collapsed ? "justify-center px-2" : ""}`}
      title={collapsed ? label : undefined}
    >
      {active ? (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--win-accent)]" />
      ) : null}
      {children}
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

export function Sidebar({
  isOpen,
  searchTerm,
  currentPage,
  onSearchTermChange,
  onToggle,
  onOpenHome,
  onOpenLibrary,
  onOpenSettings,
}: SidebarProps) {
  return (
    <aside
      className={`win-glass m-3 mr-0 flex h-[calc(100%-1.5rem)] min-h-0 flex-col rounded-[8px] border border-[var(--win-border)] px-2 py-3 shadow-[var(--win-shadow-sm)] transition-all duration-300 ${
        isOpen ? "w-[14.5rem]" : "w-[3.6rem]"
      }`}
    >
      <div className={`mb-4 flex items-center ${isOpen ? "justify-between gap-2" : "flex-col gap-3"}`}>
        <button
          type="button"
          onClick={onToggle}
          className="win-button inline-flex h-8 w-8 items-center justify-center rounded-[4px] text-[var(--win-text-secondary)] hover:text-[var(--win-text)]"
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        {isOpen && (
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(var(--win-accent-rgb),0.76))] text-[10px] font-semibold text-[#07111c]">
              Q
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11.5px] font-medium text-[var(--win-text)]">Media Player</p>
            </div>
          </div>
        )}
      </div>

      <div className={`${isOpen ? "win-pane mb-4 rounded-[6px] p-2" : "mb-3"}`}>
        {isOpen ? (
          <label className="relative block">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--win-text-tertiary)]" />
            <input
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search"
              className="win-field h-8 w-full rounded-[4px] pl-10 pr-4 text-[12px] outline-none"
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="win-button inline-flex h-8 w-full items-center justify-center rounded-[4px] text-[var(--win-text-secondary)] hover:text-[var(--win-text)]"
            aria-label="Open search"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="win-pane space-y-1 rounded-[6px] p-1">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <SidebarButton
              key={item.label}
              label={item.label}
              active={
                (item.label === "Home" && currentPage === "home") ||
                (item.label === "Music library" && currentPage === "library")
              }
              collapsed={!isOpen}
              onClick={item.label === "Home" ? onOpenHome : onOpenLibrary}
            >
              <Icon className="h-4 w-4 shrink-0" />
            </SidebarButton>
          );
        })}
      </nav>

      <div className="my-4 border-t border-[var(--win-border)]" />

      <nav className="win-pane space-y-1 rounded-[6px] p-1">
        {secondaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <SidebarButton key={item.label} label={item.label} collapsed={!isOpen}>
              <Icon className="h-4 w-4 shrink-0" />
            </SidebarButton>
          );
        })}
      </nav>

      <div className="mt-auto pt-6">
        <div className={isOpen ? "win-pane rounded-[6px] p-1" : ""}>
          <SidebarButton
            label="Settings"
            collapsed={!isOpen}
            active={currentPage === "settings"}
            onClick={onOpenSettings}
          >
            <SettingsIcon className="h-4 w-4 shrink-0" />
          </SidebarButton>
        </div>
      </div>
    </aside>
  );
}
