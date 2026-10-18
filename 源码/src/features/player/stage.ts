import type { LyricLine, Mood } from '../../services/music/types.ts';
import { findActiveLyricIndex } from './lyrics.ts';

export interface SubtitleFrame {
  index: number;
  text: string;
  nextText: string;
  elapsedMs: number;
  durationMs: number;
  progress: number;
  beat: number;
  accentStart: number;
  layout: 'opening' | 'statement' | 'vertical' | 'closing';
}
/** Scenes follow the audio clock, including pauses, backward seeks and track changes. */
export function subtitleFrame(lines: readonly LyricLine[], currentMs: number, durationMs: number, bpm?: number): SubtitleFrame | null {
  const index = findActiveLyricIndex(lines, currentMs);
  if (index < 0) return null;
  const line = lines[index];
  const end = lines[index + 1]?.timeMs ?? Math.max(line.timeMs + 1000, durationMs);
  const span = Math.max(1, end - line.timeMs);
  const elapsed = Math.max(0, currentMs - line.timeMs);
  const count = Array.from(line.text).length;
  const beatPosition = bpm && bpm > 0 ? currentMs / 60000 * bpm : 0;
  return {
    index, text: line.text || '♪', nextText: lines[index + 1]?.text || '让这一刻，再停留一会儿。',
    elapsedMs: elapsed, durationMs: span, progress: Math.min(1, elapsed / span),
    beat: bpm && bpm > 0 ? Math.max(0, 1 - (beatPosition % 1) * 3) : 0,
    accentStart: Math.max(0, count - Math.min(4, Math.ceil(count * .4))),
    layout: index === 0 ? 'opening' : index === lines.length - 1 ? 'closing' : index % 3 === 2 ? 'vertical' : 'statement',
  };
}
export const stageMoods: Record<Mood, { label: string; english: string; color: string; word: string }> = {
  calm: { label: '留白', english: 'SLOW DOWN', color: '#c9d9b4', word: '慢' },
  energy: { label: '微光', english: 'FIND YOUR LIGHT', color: '#f3bd79', word: '光' },
  comfort: { label: '接住', english: 'YOU ARE HERE', color: '#b4d9da', word: '息' },
};
export function demoBpm(id: string): number | undefined {
  return ({ slow: 48, light: 80, breathe: 40 } as Record<string, number>)[id];
}
