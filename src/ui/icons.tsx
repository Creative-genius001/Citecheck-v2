/**
 * Inline SVG icons: 24 × 24 viewBox, stroked with currentColor, decorative (aria-hidden).
 */

import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  stroke?: number;
  className?: string;
}

function Icon({ size = 18, stroke = 2, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ flex: 'none' }}
    >
      {children}
    </svg>
  );
}

/** "C" arc with a check-dot: the CiteCheck mark. */
export const LogoMark = (p: IconProps) => (
  <Icon size={20} stroke={2.4} {...p}>
    <path d="M17 7.2A6.6 6.6 0 1 0 17 16.8" />
    <circle cx="18.6" cy="12" r="1.7" fill="currentColor" stroke="none" />
  </Icon>
);
export const DocumentIcon = (p: IconProps) => (
  <Icon size={20} stroke={1.8} {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
);
export const ArrowRight = (p: IconProps) => (
  <Icon size={18} stroke={2.2} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);
export const ChevronUp = (p: IconProps) => (
  <Icon size={18} {...p}>
    <path d="M6 15l6-6 6 6" />
  </Icon>
);
export const ChevronDown = (p: IconProps) => (
  <Icon size={18} {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);
export const Check = (p: IconProps) => (
  <Icon size={14} stroke={2.4} {...p}>
    <path d="M5 12l5 5L20 7" />
  </Icon>
);
export const Warning = (p: IconProps) => (
  <Icon size={14} {...p}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17.5v.01" />
  </Icon>
);
export const Shield = (p: IconProps) => (
  <Icon size={15} stroke={1.8} {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
  </Icon>
);
export const Info = (p: IconProps) => (
  <Icon size={16} stroke={1.8} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.01" />
  </Icon>
);
export const Alert = (p: IconProps) => (
  <Icon size={18} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6M12 16.5v.01" />
  </Icon>
);
export const Retry = (p: IconProps) => (
  <Icon size={16} {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
  </Icon>
);
export const Clipboard = (p: IconProps) => (
  <Icon size={15} stroke={1.8} {...p}>
    <path d="M9 4h6v3H9z" />
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
  </Icon>
);
