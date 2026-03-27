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
      className={`flex w-full items-center gap-2.5 rounded-[16px] border px-3 py-2.5 text-[13px] transition ${
        active
          ? "border-[rgba(255,255,255,0.14)] bg-[linear-gradient(180deg,rgba(var(--win-accent-rgb),0.16),rgba(var(--win-accent-rgb),0.08))] text-white shadow-[0_14px_26px_rgba(5,8,13,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-transparent text-[var(--win-text-secondary)] hover:border-white/10 hover:bg-white/[0.07] hover:text-white"
      } ${collapsed ? "justify-center px-2" : ""}`}
      title={collapsed ? label : undefined}
    >
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
      className={`win-glass m-3 mr-0 flex h-[calc(100%-1.5rem)] min-h-0 flex-col rounded-[28px] border border-white/10 px-3 py-4 shadow-[var(--win-shadow-md)] transition-all duration-300 ${
        isOpen ? "w-[12rem]" : "w-[5.25rem]"
      }`}
    >
      <div className={`mb-5 flex items-center ${isOpen ? "justify-between gap-2.5" : "flex-col gap-4"}`}>
        <button
          type="button"
          onClick={onToggle}
          className="win-button inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--win-text-secondary)] hover:text-white"
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        {isOpen && (
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(var(--win-accent-rgb),0.88))] text-[11px] font-semibold text-[#07111c] shadow-[0_14px_28px_rgba(var(--win-accent-rgb),0.22)]">
              Q
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-white/88">Media Player</p>
            </div>
          </div>
        )}
      </div>

      <div className={`${isOpen ? "win-pane mb-5 rounded-[20px] p-2.5" : "mb-4"}`}>
        {isOpen ? (
          <label className="relative block">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--win-text-tertiary)]" />
            <input
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search"
              className="win-field h-10 w-full pl-10 pr-4 text-[13px] outline-none"
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="win-button inline-flex h-11 w-full items-center justify-center rounded-[18px] text-[var(--win-text-secondary)] hover:text-white"
            aria-label="Open search"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="win-pane space-y-1.5 rounded-[22px] p-1.5">
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

      <div className="my-5 border-t border-white/8" />

      <nav className="win-pane space-y-1.5 rounded-[22px] p-1.5">
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
        <div className={isOpen ? "win-pane rounded-[22px] p-1.5" : ""}>
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
