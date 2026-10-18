import type { MusicService, Track, Playlist, Discovery, Lyrics, Playback, PlaylistPage, TrackPage } from './types.ts';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('音乐服务返回格式不正确。'); return v as Obj; };
const str = (v: unknown): string => { if (typeof v !== 'string') throw new Error('音乐服务缺少必要文字。'); return v; };
const num = (v: unknown): number => { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error('音乐服务的时间或数量无效。'); return v; };
const arr = <T>(v: unknown, map: (item: unknown) => T): T[] => { if (!Array.isArray(v)) throw new Error('音乐服务缺少必要列表。'); return v.map(map); };
const nullable = (v: unknown) => v === null ? null : str(v);
function track(v: unknown): Track {
  const t = obj(v);
  if (t.source !== 'netease' || !['unknown', 'full', 'preview', 'unavailable'].includes(String(t.availability))) throw new Error('在线曲目来源或状态无效。');
  return { id: str(t.id), source: 'netease', title: str(t.title), artists: arr(t.artists, str), album: str(t.album), durationMs: num(t.durationMs), coverUrl: nullable(t.coverUrl), availability: t.availability as Track['availability'], ...(typeof t.reason === 'string' ? { reason: t.reason } : {}) };
}
function playlist(v: unknown): Playlist {
  const p = obj(v);
  if (p.source !== 'netease') throw new Error('在线歌单来源无效。');
  return { id: str(p.id), source: 'netease', title: str(p.title), description: str(p.description), coverUrl: nullable(p.coverUrl), trackCount: num(p.trackCount) };
}
const messages: Record<number, string> = {
  400: '搜索条件无效，请修改后重试。', 401: '在线服务需要登录，请联系服务端负责人配置会话。', 403: '该内容需要额外权限，当前无法访问。',
  404: '没有找到这项音乐内容。', 429: '请求较多，请稍后再试。', 502: '上游音乐服务暂时不可用，请重试。', 503: '在线服务尚未配置完成。可主动切换到原创演示模式。',
};
export class HttpMusicService implements MusicService {
  readonly source = 'netease' as const;
  private readonly request: typeof fetch;
  constructor(request: typeof fetch = fetch) { this.request = request; }
  private async get(path: string, signal?: AbortSignal): Promise<Obj> {
    const timeout = AbortSignal.timeout(12000);
    try {
      const res = await this.request('/api' + path, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(messages[res.status] || '在线音乐服务出现错误，请稍后重试。');
      return obj(await res.json());
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (timeout.aborted) throw new Error('在线服务响应超时，请重试。');
      if (error instanceof TypeError) throw new Error('未连接到在线服务，请检查服务端是否在 3001 端口启动。');
      if (error instanceof SyntaxError) throw new Error('在线服务尚未就绪，请检查 /api 代理和服务端。');
      throw error;
    }
  }
  async discover(mood?: string, signal?: AbortSignal): Promise<Discovery> {
    const v = await this.get('/discovery' + (mood ? '?mood=' + encodeURIComponent(mood) : ''), signal);
    return { playlists: arr(v.playlists, playlist), tracks: arr(v.tracks, track) };
  }
  async search(query: string, cursor?: string, signal?: AbortSignal): Promise<TrackPage> {
    const params = new URLSearchParams({ q: query });
    if (cursor) params.set('cursor', cursor);
    const v = await this.get('/search?' + params, signal);
    return { tracks: arr(v.tracks, track), total: num(v.total), nextCursor: nullable(v.nextCursor) };
  }
  async playlist(id: string, cursor?: string, signal?: AbortSignal): Promise<PlaylistPage> {
    const v = await this.get('/playlists/' + encodeURIComponent(id) + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''), signal);
    return { playlist: playlist(v.playlist), tracks: arr(v.tracks, track), nextCursor: nullable(v.nextCursor) };
  }
  async playback(t: Track, signal?: AbortSignal): Promise<Playback> {
    const v = await this.get('/tracks/' + encodeURIComponent(t.id) + '/playback', signal);
    if (!['full', 'preview', 'unavailable'].includes(String(v.kind))) throw new Error('播放类型无效。');
    const result: Playback = { kind: v.kind as Playback['kind'], url: nullable(v.url), ...(typeof v.reason === 'string' ? { reason: v.reason } : {}) };
    if (v.kind === 'preview') { result.previewStartMs = num(v.previewStartMs); result.previewEndMs = num(v.previewEndMs); }
    return result;
  }
  async lyrics(t: Track, signal?: AbortSignal): Promise<Lyrics> {
    const v = await this.get('/tracks/' + encodeURIComponent(t.id) + '/lyrics', signal);
    if (!['synced', 'plain', 'none'].includes(String(v.kind))) throw new Error('歌词类型无效。');
    const lines = arr(v.lines, line => { const l = obj(line); return { timeMs: num(l.timeMs), text: str(l.text) }; }).sort((a, b) => a.timeMs - b.timeMs);
    return { kind: v.kind as Lyrics['kind'], lines, ...(typeof v.plainText === 'string' ? { plainText: v.plainText } : {}) };
  }
}
