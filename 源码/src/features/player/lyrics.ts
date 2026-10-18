/** Public lyric timestamps and formatTime input are milliseconds. */
export interface LyricLine {
  timeMs: number;
  text: string;
}

/** Parse line-synced LRC. Consumers must render text, never raw HTML. */
export function parseLrc(source: string): LyricLine[] {
  const offsetTags = [...source.matchAll(/\[offset\s*:\s*([+-]?\d+)\s*\]/gi)];
  const offset = Number(offsetTags.at(-1)?.[1] ?? 0) / 1000;
  const lines: Array<LyricLine & { order: number }> = [];
  let order = 0;
  for (const raw of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const tags = [...raw.matchAll(/\[(\d+):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g)];
    if (!tags.length) continue;
    const text = raw.replace(/\[\d+:[0-5]?\d(?:[.:]\d{1,3})?\]/g, '').trim();
    for (const tag of tags) {
      const fraction = tag[3] ? Number('0.' + tag[3]) : 0;
      // Positive LRC offset advances display: 10s + offset 1000 appears at 9s.
      const time = Number(tag[1]) * 60 + Number(tag[2]) + fraction - offset;
      if (Number.isFinite(time)) lines.push({ timeMs: Math.round(Math.max(0, time) * 1000), text, order: order++ });
    }
  }
  lines.sort((a, b) => a.timeMs - b.timeMs || a.order - b.order);
  const result: LyricLine[] = [];
  for (const line of lines) {
    const previous = result.at(-1);
    if (previous?.timeMs === line.timeMs) {
      if (line.text && !previous.text.split('\n').includes(line.text)) {
        previous.text = previous.text ? previous.text + '\n' + line.text : line.text;
      }
    } else result.push({ timeMs: line.timeMs, text: line.text });
  }
  return result;
}

/** Returns -1 before the first timestamp or for invalid playback time. */
export function findActiveLyricIndex(lines: readonly LyricLine[], time: number): number {
  if (!Number.isFinite(time) || time < 0) return -1;
  let low = 0;
  let high = lines.length - 1;
  let active = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].timeMs <= time) { active = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return active;
}

export function formatTime(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '0:00';
  const whole = Math.floor(milliseconds / 1000);
  return String(Math.floor(whole / 60)) + ':' + String(whole % 60).padStart(2, '0');
}
