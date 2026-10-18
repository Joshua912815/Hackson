import type { MusicService, Track, Mood, Lyrics, Playlist } from './types.ts';

export const demoTracks: Track[] = [
  { id: 'slow', source: 'demo', title: '慢慢来', artists: ['此刻声音实验室'], album: '给今天留一点空白', durationMs: 48000, coverUrl: '/covers/slow.svg', availability: 'full' },
  { id: 'light', source: 'demo', title: '把光留住', artists: ['此刻声音实验室'], album: '小小的晴天', durationMs: 48000, coverUrl: '/covers/light.svg', availability: 'full' },
  { id: 'breathe', source: 'demo', title: '先深呼吸', artists: ['此刻声音实验室'], album: '让思绪靠岸', durationMs: 48000, coverUrl: '/covers/breathe.svg', availability: 'full' },
];
const collections: Playlist[] = [
  { id: 'calm', source: 'demo', title: '允许自己，慢一点', description: '给拥挤的大脑，一小片安静。', coverUrl: '/covers/slow.svg', trackCount: 3 },
  { id: 'energy', source: 'demo', title: '捡起今天的好心情', description: '不用满格，也能重新出发。', coverUrl: '/covers/light.svg', trackCount: 3 },
  { id: 'comfort', source: 'demo', title: '世界很吵，先抱抱你', description: '没有标准答案，此刻只需听。', coverUrl: '/covers/breathe.svg', trackCount: 3 },
];
const words: Record<string, string[]> = {
  slow: ['先把忙碌放在门外', '这一刻，不需要赶路', '允许自己，慢一点', '让心事在旋律里舒展', '你已经做得很好了', '留一点空白给今天', '不着急，我们慢慢来', '此刻，就在这里'],
  light: ['今天也有值得收藏的小事', '一束光，一次微笑', '不必等到万事俱备', '先为自己按下播放', '把小小的勇气捡起来', '给平凡的一天加点亮色', '好心情，可以从此刻开始', '把这束光留住'],
  breathe: ['如果世界有一点太吵', '就先听见自己的呼吸', '吸气，给心留一点位置', '呼气，把紧绷慢慢放下', '不必急着回答所有问题', '你可以在这里停靠', '让旋律陪你待一会儿', '下一步，等准备好再走'],
};
function check(signal?: AbortSignal) { signal?.throwIfAborted(); }
function ordered(mood: Mood = 'calm') {
  const first = { calm: 'slow', energy: 'light', comfort: 'breathe' }[mood];
  return [...demoTracks].sort((a, b) => Number(b.id === first) - Number(a.id === first));
}
export const demoService: MusicService = {
  source: 'demo',
  async discover(mood, signal) { check(signal); return { playlists: [...collections], tracks: ordered(mood) }; },
  async search(query, _cursor, signal) {
    check(signal);
    const q = query.trim().toLowerCase();
    const tracks = demoTracks.filter(t => [t.title, t.album, ...t.artists, ...(words[t.id] || [])].join(' ').toLowerCase().includes(q));
    return { tracks, total: tracks.length, nextCursor: null };
  },
  async playlist(id, _cursor, signal) {
    check(signal);
    const playlist = collections.find(p => p.id === id);
    if (!playlist) throw new Error('没有找到这张歌单。');
    return { playlist, tracks: ordered(id as Mood), nextCursor: null };
  },
  async playback(track, signal) {
    check(signal);
    return demoTracks.some(t => t.id === track.id) ? { kind: 'full', url: '/audio/' + track.id + '.wav' } : { kind: 'unavailable', url: null, reason: '演示曲目不存在。' };
  },
  async lyrics(track, signal): Promise<Lyrics> {
    check(signal);
    return { kind: 'synced', lines: (words[track.id] || []).map((text, i) => ({ timeMs: i * 6000, text })) };
  },
};
