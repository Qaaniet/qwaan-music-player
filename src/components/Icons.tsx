import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </BaseIcon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
    </BaseIcon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </BaseIcon>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3v13" />
      <path d="M12 8c2.4-.7 4.8-1.1 7-1.2v10.3c-2.2 0-4.6.4-7 1.2" />
      <path d="M12 8c-2.4-.7-4.8-1.1-7-1.2v10.3c2.2 0 4.6.4 7 1.2" />
    </BaseIcon>
  );
}

export function QueueIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h10" />
      <path d="M4 12h10" />
      <path d="M4 17h6" />
      <path d="m17 16 3-2-3-2v4Z" />
    </BaseIcon>
  );
}

export function PlaylistIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h12" />
      <path d="M4 12h12" />
      <path d="M4 17h8" />
      <path d="M19 16a2 2 0 1 1-2-2c1.1 0 2 .9 2 2Z" />
    </BaseIcon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="m4.9 4.9 2.1 2.1" />
      <path d="m17 17 2.1 2.1" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="m4.9 19.1 2.1-2.1" />
      <path d="M17 7l2.1-2.1" />
      <circle cx="12" cy="12" r="3.5" />
    </BaseIcon>
  );
}

export function PlusFolderIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 7h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M17 12v6" />
      <path d="M14 15h6" />
    </BaseIcon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m9 7 8 5-8 5Z" fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 7v10" />
      <path d="M15 7v10" />
    </BaseIcon>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function PreviousIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 7v10" />
      <path d="m18 7-7 5 7 5V7Z" fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function NextIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M17 7v10" />
      <path d="m6 17 7-5-7-5v10Z" fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function ShuffleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h3l10 10h3" />
      <path d="m17 7 3 3-3 3" />
      <path d="M4 17h3l3-3" />
      <path d="m17 14 3 3-3 3" />
    </BaseIcon>
  );
}

export function RepeatIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M17 6h3v3" />
      <path d="M4 12a6 6 0 0 1 6-6h10" />
      <path d="M7 18H4v-3" />
      <path d="M20 12a6 6 0 0 1-6 6H4" />
    </BaseIcon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </BaseIcon>
  );
}

export function SpeakerIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 10h4l5-4v12l-5-4H5Z" />
      <path d="M18 9a4 4 0 0 1 0 6" />
    </BaseIcon>
  );
}
