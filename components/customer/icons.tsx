import type { SVGProps } from "react";

/**
 * One icon family for the customer surface: 24px grid, 1.6 stroke,
 * round caps/joins, inherits `currentColor`. Keep additions in this style.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </Base>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 21s6.5-5.7 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.3 6.5 11 6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </Base>
  );
}

export function PassIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M7 14.5h5" />
    </Base>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.4 2.4 0 1 1 3.3 2.2c-.8.4-1.4.9-1.4 1.9" />
      <path d="M12 16.4h.01" />
    </Base>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </Base>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m9 5 7 7-7 7" />
    </Base>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m15 5-7 7 7 7" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Base>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5 19 6v6c0 4.4-3 7.6-7 8.5-4-.9-7-4.1-7-8.5V6l7-2.5Z" />
      <path d="m9 12 2 2 4-4.5" />
    </Base>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Base>
  );
}

export function LocateIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v3M12 18v3M21 12h-3M6 12H3" />
    </Base>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Base>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4 2.5 20h19L12 4Z" />
      <path d="M12 10v4.5M12 17.5h.01" />
    </Base>
  );
}

export function WalletAddIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17a2 2 0 0 1 2 2v1" />
      <path d="M3.5 9.5h13A2 2 0 0 1 18.5 11.5v6A2 2 0 0 1 16.5 19.5h-10A2 2 0 0 1 4.5 17.5V8" />
      <path d="M20 13.5h-3M18.5 12v3" />
    </Base>
  );
}
