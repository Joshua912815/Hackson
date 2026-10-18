import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { demoService } from '../src/services/music/demo.ts';
import { HttpMusicService } from '../src/services/music/http.ts';

test('三种心情顺序不同，搜索与歌单不会制造曲目', async () => {
  const calm = await demoService.discover('calm');
  const energy = await demoService.discover('energy');
  const comfort = await demoService.discover('comfort');
  assert.equal(calm.tracks[0].id, 'slow');
  assert.equal(energy.tracks[0].id, 'light');
  assert.equal(comfort.tracks[0].id, 'breathe');
  assert.equal((await demoService.search('光')).tracks[0].id, 'light');
  assert.equal((await demoService.search('不存在的歌')).tracks.length, 0);
  await assert.rejects(demoService.playlist('missing'), /没有找到/);
});
test('每首演示音频实际存在且为 48 秒 WAV，聆听文字落在音频范围内', async () => {
  const { tracks } = await demoService.discover();
  for (const track of tracks) {
    const playback = await demoService.playback(track);
    const wav = await readFile(new URL('../public' + playback.url, import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal((wav.length - 44) / wav.readUInt32LE(28) * 1000, track.durationMs);
    const lyrics = await demoService.lyrics(track);
    assert.equal(lyrics.lines.length, 8);
    assert.ok(lyrics.lines.every(l => l.timeMs >= 0 && l.timeMs < track.durationMs));
    const cover = await readFile(new URL('../public' + track.coverUrl, import.meta.url), 'utf8');
    assert.ok(cover.startsWith('<svg'));
  }
});
test('HTTP 请求编码搜索关键词，校验曲目数据与时间类型', async () => {
  let called;
  const t = { id: '1', source: 'netease', title: '真实标题', artists: ['歌手'], album: '专辑', durationMs: 30000, coverUrl: null, availability: 'unknown' };
  const service = new HttpMusicService(async url => { called = url; return Response.json({ tracks: [t], total: 1, nextCursor: null }); });
  assert.equal((await service.search('A&B')).tracks[0].id, '1');
  assert.equal(called, '/api/search?q=A%26B');
  const broken = new HttpMusicService(async () => Response.json({ tracks: [{ ...t, durationMs: '30' }], total: 1, nextCursor: null }));
  await assert.rejects(broken.search('x'), /时间或数量无效/);
});
test('在线失败明确报错，不回退示例或暴露上游响应正文', async () => {
  const service = new HttpMusicService(async () => new Response('private upstream detail', { status: 401 }));
  await assert.rejects(service.discover(), error => error.message.includes('需要登录') && !error.message.includes('private'));
  const malformed = new HttpMusicService(async () => new Response('<html>wrong proxy</html>'));
  await assert.rejects(malformed.discover(), /尚未就绪/);
});
test('取消请求保留取消状态，歌词按毫秒排序', async () => {
  const ctrl = new AbortController(); ctrl.abort();
  await assert.rejects(demoService.discover('calm', ctrl.signal), error => error.name === 'AbortError');
  const service = new HttpMusicService(async () => Response.json({ kind: 'synced', lines: [{ timeMs: 2000, text: '后' }, { timeMs: 0, text: '先' }] }));
  assert.deepEqual((await service.lyrics({ id: '1' })).lines.map(l => l.timeMs), [0, 2000]);
});
