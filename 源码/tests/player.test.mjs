import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MusicPlayer } from '../src/features/player/player.ts';
import { parseLrc, findActiveLyricIndex, formatTime } from '../src/features/player/lyrics.ts';

class FakeAudio extends EventTarget {
  src = ''; currentTime = 0; duration = 48; volume = 1; muted = false; paused = true; error = null;
  playError = null;
  async play() { if (this.playError) throw this.playError; this.paused = false; this.dispatchEvent(new Event('playing')); }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  load() {}
  removeAttribute() { this.src = ''; }
}
const track = id => ({ id, title: id, source: 'demo', artists: ['此刻'], album: '实验', durationMs: 48000, coverUrl: null, availability: 'full' });
const full = { kind: 'full', url: '/audio/test.wav' };
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };

test('LRC 处理多标签、双语、offset 与毫秒边界', () => {
  const lines = parseLrc('[offset:500]\n[00:02.25][00:04]你好\n[00:02.250]Hello\n[00:06.000]\n[ar:ignored]');
  assert.deepEqual(lines, [{ timeMs: 1750, text: '你好\nHello' }, { timeMs: 3500, text: '你好' }, { timeMs: 5500, text: '' }]);
  assert.equal(findActiveLyricIndex(lines, 1749), -1);
  assert.equal(findActiveLyricIndex(lines, 1750), 0);
  assert.equal(findActiveLyricIndex(lines, 99999), 2);
  assert.equal(findActiveLyricIndex(lines, NaN), -1);
  assert.equal(formatTime(65000), '1:05');
});
test('快速换歌时取消旧请求，过期结果不能覆盖当前曲目', async () => {
  const pending = new Map(); const audio = new FakeAudio();
  const player = new MusicPlayer({ audio, resolveSource(t, signal) { const d = deferred(); pending.set(t.id, { ...d, signal }); return d.promise; } });
  const a = player.setQueue([track('a'), track('b')]);
  const b = player.select(1);
  assert.equal(pending.get('a').signal.aborted, true);
  pending.get('b').resolve({ ...full, url: '/b.wav' }); await b;
  pending.get('a').resolve({ ...full, url: '/a.wav' }); await a;
  assert.equal(audio.src, '/b.wav'); assert.equal(player.getSnapshot().track.id, 'b');
  player.dispose();
});
test('资源仍在解析时暂停，资源返回后不能自动播放', async () => {
  const d = deferred(); const audio = new FakeAudio();
  const player = new MusicPlayer({ audio, resolveSource: () => d.promise });
  const load = player.setQueue([track('a')]); player.pause(); d.resolve(full); await load;
  assert.equal(audio.paused, true); assert.equal(player.getSnapshot().status, 'paused');
  player.dispose();
});
test('浏览器阻止自动播放可点击恢复，不谎报播放成功', async () => {
  const audio = new FakeAudio(); audio.playError = new DOMException('blocked', 'NotAllowedError');
  const player = new MusicPlayer({ audio, resolveSource: async () => full });
  await player.setQueue([track('a')]);
  assert.equal(player.getSnapshot().status, 'paused'); assert.equal(player.getSnapshot().error.code, 'interaction');
  audio.playError = null; await player.resume();
  assert.equal(player.getSnapshot().status, 'playing');
  player.dispose();
});
test('不可播放资源明确报错并停留原曲目，不自动换歌', async () => {
  const player = new MusicPlayer({ audio: new FakeAudio(), resolveSource: async () => ({ kind: 'unavailable', url: null, reason: '需要权限' }) });
  await player.setQueue([track('a'), track('b')]);
  assert.equal(player.getSnapshot().status, 'error'); assert.equal(player.getSnapshot().index, 0);
  assert.equal(player.getSnapshot().error.message, '需要权限');
  player.dispose();
});
test('时间只在音频边界转换为秒，队列结束与循环正确', async () => {
  const audio = new FakeAudio(); const player = new MusicPlayer({ audio, resolveSource: async () => full });
  await player.setQueue([track('a')]);
  player.seek(12000); assert.equal(audio.currentTime, 12);
  audio.currentTime = 23.5; audio.dispatchEvent(new Event('timeupdate'));
  assert.equal(player.getSnapshot().currentTime, 23500);
  audio.dispatchEvent(new Event('ended')); assert.equal(player.getSnapshot().status, 'ended');
  await player.resume(); assert.equal(audio.currentTime, 0);
  player.setRepeat('all'); audio.dispatchEvent(new Event('ended'));
  await new Promise(r => setImmediate(r));
  assert.equal(player.getSnapshot().status, 'playing');
  player.dispose(); assert.equal(audio.src, '');
});
test('试听约束跳转范围，到达片段终点即停止', async () => {
  const audio = new FakeAudio(); const player = new MusicPlayer({ audio, resolveSource: async () => ({ kind: 'preview', url: '/clip.wav', previewStartMs: 10000, previewEndMs: 20000 }) });
  await player.setQueue([track('a')]);
  assert.equal(audio.currentTime, 10); player.seek(0); assert.equal(audio.currentTime, 10);
  player.seek(99999); assert.equal(audio.currentTime, 20);
  audio.dispatchEvent(new Event('timeupdate')); assert.equal(player.getSnapshot().status, 'ended');
  assert.equal(audio.paused, true); player.dispose();
});
