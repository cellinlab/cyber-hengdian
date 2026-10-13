import type { CSSProperties } from 'react';
export type IconName =
  | 'plus'
  | 'play'
  | 'pause'
  | 'camera'
  | 'cube'
  | 'move'
  | 'rotate'
  | 'scale'
  | 'undo'
  | 'redo'
  | 'download'
  | 'upload'
  | 'link'
  | 'close'
  | 'copy'
  | 'trash'
  | 'lock'
  | 'unlock'
  | 'note'
  | 'chevron'
  | 'check'
  | 'film'
  | 'layers'
  | 'key'
  | 'folder';
const paths: Record<IconName, string> = {
  plus: 'M12 5v14M5 12h14',
  play: 'm8 5 11 7-11 7Z',
  pause: 'M8 5v14M16 5v14',
  camera: 'M4 7h4l2-3h4l2 3h4v13H4ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  cube: 'm12 3 9 5v9l-9 5-9-5V8Zm0 10 9-5M12 13 3 8m9 5v9',
  move: 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
  rotate: 'M20 10a8 8 0 1 0-1 7M20 3v7h-7',
  scale: 'M4 14v6h6M14 4h6v6M4 20l6-6m10-10-6 6',
  undo: 'M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12',
  redo: 'm16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  link: 'm9 15 6-6M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
  close: 'm6 6 12 12M6 18 18 6',
  copy: 'M8 8h13v13H8ZM3 16V3h13',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  lock: 'M6 10h12v11H6Zm3 0V6a3 3 0 0 1 6 0v4',
  unlock: 'M6 10h12v11H6Zm3 0V6a3 3 0 0 1 6 0',
  note: 'M4 3h16v14l-5 4H4Zm4 5h8M8 12h6',
  chevron: 'm9 5 7 7-7 7',
  check: 'm5 12 4 4L19 6',
  film: 'M3 4h18v16H3Zm4 0v16M17 4v16M3 8h4M3 16h4m10-8h4m-4 8h4',
  layers: 'm12 3 10 6-10 6L2 9Zm-9 11 9 6 9-6',
  key: 'm12 4 8 8-8 8-8-8Z',
  folder: 'M3 5h7l2 3h9v12H3Z',
};
export function Icon({
  name,
  size = 16,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
