import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
});

export function IconSound({ on, size, ...p }: P & { on: boolean }) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      {on ? (
        <>
          <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
          <path d="M18 6.5a7.6 7.6 0 0 1 0 11" />
        </>
      ) : (
        <path d="M16 9.5l5 5M21 9.5l-5 5" />
      )}
    </svg>
  );
}

export function IconLock({ size = 8, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth={1} aria-hidden {...p}>
      <rect x="1.2" y="3.6" width="5.6" height="3.8" rx="0.6" />
      <path d="M2.4 3.6V2.5a1.6 1.6 0 0 1 3.2 0v1.1" />
    </svg>
  );
}

export function IconMore({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="6" cy="12" r="0.9" fill="currentColor" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
      <circle cx="18" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function IconClose({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconRead({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 5.5h6a2 2 0 0 1 2 2V19a1.6 1.6 0 0 0-1.6-1.6H4z" />
      <path d="M20 5.5h-6a2 2 0 0 0-2 2V19a1.6 1.6 0 0 1 1.6-1.6H20z" />
    </svg>
  );
}

export function IconShare({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="17.5" cy="6" r="2.2" />
      <circle cx="17.5" cy="18" r="2.2" />
      <path d="M8 11l7.6-4M8 13l7.6 4" />
    </svg>
  );
}

export function IconArrow({ size, dir = "right", ...p }: P & { dir?: "right" | "left" | "up" | "down" }) {
  const rot = { right: 0, down: 90, left: 180, up: 270 }[dir];
  return (
    <svg {...base(size)} {...p} style={{ transform: `rotate(${rot}deg)`, ...p.style }}>
      <path d="M4 12h15M14 7l5 5-5 5" />
    </svg>
  );
}

export function IconQuestion({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2.9-1.2 1.8v.4" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconWhy({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

export function IconZoom({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5M8 10.5h5M10.5 8v5" />
    </svg>
  );
}

export function IconPlay({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M8 5.5v13l10.5-6.5z" />
    </svg>
  );
}

export function IconUpload({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9" />
      <path d="M4.5 15v4.5h15V15" />
    </svg>
  );
}

export function IconCamera({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M4 8h3.5l1.5-2.5h6L16.5 8H20v11H4z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

export function IconBranch({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <circle cx="7" cy="5.5" r="1.8" />
      <circle cx="7" cy="18.5" r="1.8" />
      <circle cx="17" cy="9" r="1.8" />
      <path d="M7 7.3v9.4M17 10.8c0 4-10 2.5-10 6" />
    </svg>
  );
}

export function IconDownload({ size, ...p }: P) {
  return (
    <svg {...base(size)} {...p}>
      <path d="M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5" />
      <path d="M4.5 19.5h15" />
    </svg>
  );
}
