import type { CSSProperties } from 'react';
const paths = {
  play: 'm9 5 11 7-11 7Z', pause: 'M8 5v14M16 5v14', next: 'm5 5 10 7-10 7ZM19 5v14',
  previous: 'm19 5-10 7 10 7ZM5 5v14', search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  arrow: 'M4 12h16m-6-6 6 6-6 6', close: 'm6 6 12 12M6 18 18 6', volume: 'm11 5-6 4H2v6h3l6 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  mute: 'm11 5-6 4H2v6h3l6 4Zm6 4 6 6m-6 0 6-6', queue: 'M4 6h16M4 12h16M4 18h10m4-3 4 3-4 3',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5', heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  repeat: 'm17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3',
  back: 'M20 12H4m6-6-6 6 6 6', sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  leaf: 'M20 3C6 1 1 9 5 16s17 6 15-13ZM4 21 15 10', moon: 'M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z',
  check: 'm5 12 4 4L19 6', music: 'M9 18V5l12-2v13M9 8l12-2M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3m12-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={name === 'play' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
