import type { SVGProps } from 'react';

export type IconName =
  | 'cursor'
  | 'trend'
  | 'hline'
  | 'vline'
  | 'rect'
  | 'fib'
  | 'measure'
  | 'text'
  | 'magnet'
  | 'undo'
  | 'redo'
  | 'trash'
  | 'search'
  | 'chevronDown'
  | 'check'
  | 'close'
  | 'sun'
  | 'moon'
  | 'dots'
  | 'panel'
  | 'info'
  | 'bell'
  | 'candle'
  | 'fx'
  | 'fit'
  | 'plus'
  | 'lock';

const PATHS: Record<IconName, string> = {
  cursor: 'M4 3l13 8-6 1.6L8.4 19z',
  trend: 'M4 17L20 5M16 5h4v4',
  hline: 'M3 12h18M6 9v6M18 9v6',
  vline: 'M12 3v18M9 6h6M9 18h6',
  rect: 'M4 6h16v12H4z',
  fib: 'M4 6h16M4 10.5h16M4 15h16M4 19.5h16',
  measure: 'M4 15l11-11 5 5-11 11zM9 6l1.5 1.5M12 9l1.5 1.5',
  text: 'M5 6h14M12 6v13M9 19h6',
  magnet: 'M6 4v8a6 6 0 0012 0V4h-4v8a2 2 0 01-4 0V4z',
  undo: 'M9 7H5V3M5 7a8 8 0 1115 5',
  redo: 'M15 7h4V3M19 7A8 8 0 104 12',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  chevronDown: 'M6 9l6 6 6-6',
  check: 'M5 12l5 5 9-10',
  close: 'M6 6l12 12M18 6L6 18',
  sun: 'M12 7a5 5 0 100 10 5 5 0 000-10zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19',
  moon: 'M20 14a8 8 0 11-9.9-9.9A7 7 0 0020 14z',
  dots: 'M6 12h.01M12 12h.01M18 12h.01',
  panel: 'M3 5h18v14H3zM15 5v14',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 8h.01',
  bell: 'M6 8a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 004 0',
  candle: 'M7 4v4M7 16v4M5 8h4v8H5zM17 3v5M17 15v6M15 8h4v7h-4z',
  fx: 'M4 18c4 0 4-12 8-12 2 0 3 1 3 2M3 10h9M13 18l6-6M19 18l-6-6',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  plus: 'M12 5v14M5 12h14',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3',
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="brand-mark">
      <rect x="1" y="1" width="22" height="22" rx="5.5" fill="#111a26" stroke="#2b3a4d" />
      <path d="M6 17V9M10 17V6M14 17v-5M18 17v-8" stroke="#7aa2ff" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}
