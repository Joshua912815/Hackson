import type { Track, Playback } from '../../services/music/types.ts';
/** Create once above page routing. All snapshot times use milliseconds. */
export type ResolveSource = (track: Track, signal: AbortSignal) => Promise<Playback>;
export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error';
export type RepeatMode = 'off' | 'all' | 'one';
export interface PlayerError {
  code: 'unavailable' | 'source' | 'playback' | 'interaction';
  message: string;
}
export interface PlayerSnapshot {
  readonly queue: readonly Readonly<Track>[];
  readonly index: number;
  readonly track: Readonly<Track> | null;
  readonly playbackKind: Playback['kind'] | null;
  readonly status: PlayerStatus;
  readonly currentTime: number;
  readonly startTime: number;
  readonly duration: number;
  readonly volume: number;
  readonly muted: boolean;
  readonly repeat: RepeatMode;
  readonly error: Readonly<PlayerError> | null;
}

export type AudioPort = Pick<HTMLAudioElement,
  'src' | 'currentTime' | 'duration' | 'volume' | 'muted' | 'paused' | 'error' |
  'play' | 'pause' | 'load' | 'removeAttribute' | 'addEventListener' | 'removeEventListener'>;

const finiteDuration = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

export class MusicPlayer {
  private readonly audio: AudioPort;
  private readonly resolveSource: ResolveSource;
  private readonly listeners = new Set<() => void>();
  private readonly handlers = new Map<string, EventListener>();
  private controller: AbortController | null = null;
  private requestId = 0;
  private playId = 0;
  private sourceReady = false;
  private wantsPlayback = false;
  private rangeStart = 0;
  private rangeEnd = 0;
  private disposed = false;
  private snapshot: PlayerSnapshot;

  constructor(options: { audio?: AudioPort; resolveSource: ResolveSource }) {
    this.audio = options.audio ?? new Audio();
    this.resolveSource = options.resolveSource;
    this.snapshot = Object.freeze({
      queue: Object.freeze([]), index: -1, track: null, playbackKind: null, status: 'idle', currentTime: 0, startTime: 0,
      duration: 0, volume: this.audio.volume, muted: this.audio.muted, repeat: 'off', error: null,
    });
    this.on('loadedmetadata', () => this.updateTimeline());
    this.on('durationchange', () => this.updateTimeline());
    this.on('timeupdate', () => this.updateTimeline());
    this.on('playing', () => {
      if (!this.sourceReady) return;
      if (!this.wantsPlayback) { this.audio.pause(); return; }
      this.update({ status: 'playing', error: null });
    });
    this.on('pause', () => {
      if (this.sourceReady && this.snapshot.status !== 'error' && this.snapshot.status !== 'ended') {
        this.update({ status: 'paused' });
      }
    });
    this.on('waiting', () => {
      if (this.sourceReady && this.wantsPlayback) this.update({ status: 'buffering' });
    });
    this.on('ended', () => { void this.onEnded(); });
    this.on('error', () => {
      if (!this.sourceReady) return;
      const code = this.audio.error?.code;
      this.fail('playback', code === 4 ? '浏览器不支持此音频，或播放资源不可用。' : '音频加载失败，请重试或选择其他歌曲。');
    });
    this.on('volumechange', () => this.update({ volume: this.audio.volume, muted: this.audio.muted }));
  }

  /** Stable callbacks can be passed directly to React useSyncExternalStore. */
  getSnapshot = (): PlayerSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async setQueue(tracks: readonly Track[], index = 0, autoplay = true): Promise<void> {
    if (this.disposed) return;
    if (tracks.length && (!Number.isInteger(index) || index < 0 || index >= tracks.length)) {
      throw new RangeError('播放索引超出队列范围');
    }
    if (tracks.some(track => !track.id || !track.title)) throw new TypeError('曲目必须包含 id 和 title');
    const queue = Object.freeze(tracks.map(track => Object.freeze({ ...track })));
    this.cancelSource();
    this.update({ queue, index: -1, track: null, currentTime: 0, startTime: 0, duration: 0, playbackKind: null, status: 'idle', error: null });
    if (queue.length) await this.select(index, autoplay);
  }

  async select(index: number, autoplay = true): Promise<void> {
    if (this.disposed) return;
    if (!Number.isInteger(index) || index < 0 || index >= this.snapshot.queue.length) return;
    this.cancelSource();
    const request = this.requestId;
    const track = this.snapshot.queue[index];
    const controller = new AbortController();
    this.controller = controller;
    this.wantsPlayback = autoplay;
    this.update({ index, track, currentTime: 0, startTime: 0, duration: finiteDuration(track.durationMs), playbackKind: null, status: 'loading', error: null });
    try {
      const source = await this.resolveSource(track, controller.signal);
      if (this.disposed || request !== this.requestId) return;
      const url = source?.url?.trim();
      if (source.kind === 'unavailable' || !url) { this.fail('unavailable', source.reason || '这首歌暂时没有可播放资源，请选择其他歌曲。'); return; }
      const parsed = new URL(url, typeof document === 'undefined' ? 'http://localhost/' : document.baseURI);
      if (!['http:', 'https:', 'blob:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        this.fail('source', '播放地址格式无效。'); return;
      }
      if (source.kind === 'preview') {
        const start = source.previewStartMs;
        const end = source.previewEndMs;
        if (typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
          this.fail('source', '试听时间范围无效。'); return;
        }
        this.rangeStart = start;
        this.rangeEnd = end;
      }
      this.audio.src = url;
      this.sourceReady = true;
      this.audio.load();
      this.update({ status: 'ready', playbackKind: source.kind, startTime: this.rangeStart, currentTime: this.rangeStart, duration: this.rangeEnd || this.snapshot.duration });
      if (this.wantsPlayback) await this.resume();
      else this.update({ status: 'paused' });
    } catch {
      if (!this.disposed && request === this.requestId && !controller.signal.aborted) {
        this.fail('source', '获取播放资源失败，请检查网络后重试。');
      }
    }
  }

  async resume(): Promise<void> {
    if (this.disposed || !this.snapshot.track) return;
    if (this.snapshot.status === 'error') { await this.select(this.snapshot.index, true); return; }
    this.wantsPlayback = true;
    if (!this.sourceReady) {
      if (this.snapshot.status === 'error') await this.select(this.snapshot.index, true);
      return;
    }
    if (this.snapshot.status === 'ended' || this.audio.currentTime * 1000 < this.rangeStart) this.audio.currentTime = this.rangeStart / 1000;
    const request = this.requestId;
    const play = ++this.playId;
    this.update({ error: null });
    try {
      await this.audio.play();
      if (this.disposed || request !== this.requestId || play !== this.playId) {
        if (!this.wantsPlayback) this.audio.pause();
        return;
      }
      if (this.wantsPlayback) this.update({ status: this.audio.paused ? 'paused' : 'playing' });
    } catch (error) {
      if (this.disposed || request !== this.requestId || play !== this.playId || !this.wantsPlayback) return;
      const name = error instanceof Error ? error.name : '';
      if (name === 'NotAllowedError') {
        this.wantsPlayback = false;
        this.update({ status: 'paused', error: { code: 'interaction', message: '请点击播放按钮，允许浏览器播放音乐。' } });
      } else this.fail('playback', '无法播放这首歌，请重试或选择其他歌曲。');
    }
  }

  pause(): void {
    if (this.disposed) return;
    this.wantsPlayback = false;
    ++this.playId;
    this.audio.pause();
    if (this.snapshot.track && this.snapshot.status !== 'error') this.update({ status: 'paused' });
  }

  toggle(): Promise<void> {
    if (this.wantsPlayback) { this.pause(); return Promise.resolve(); }
    return this.resume();
  }

  retry(): Promise<void> { return this.select(this.snapshot.index, true); }

  async next(): Promise<void> {
    if (this.snapshot.index < 0) return;
    if (this.snapshot.index + 1 < this.snapshot.queue.length) await this.select(this.snapshot.index + 1);
    else if (this.snapshot.repeat === 'all') await this.select(0);
  }

  async previous(): Promise<void> {
    if (this.snapshot.index < 0) return;
    if (this.snapshot.currentTime - this.rangeStart > 3000) { this.seek(this.rangeStart); return; }
    if (this.snapshot.index > 0) await this.select(this.snapshot.index - 1);
    else if (this.snapshot.repeat === 'all') await this.select(this.snapshot.queue.length - 1);
    else this.seek(0);
  }

  seek(milliseconds: number): void {
    if (this.disposed || !this.sourceReady || !Number.isFinite(milliseconds) || !this.snapshot.duration) return;
    const time = Math.min(Math.max(this.rangeStart, milliseconds), this.snapshot.duration);
    try {
      this.audio.currentTime = time / 1000;
      this.update({ currentTime: time });
    } catch { /* Metadata may not yet be available; timeupdate will reconcile. */ }
  }

  setVolume(value: number): void {
    if (this.disposed || !Number.isFinite(value)) return;
    this.audio.volume = Math.min(1, Math.max(0, value));
    this.update({ volume: this.audio.volume });
  }
  setMuted(muted: boolean): void {
    if (this.disposed) return;
    this.audio.muted = muted;
    this.update({ muted });
  }
  setRepeat(repeat: RepeatMode): void {
    if (['off', 'all', 'one'].includes(repeat)) this.update({ repeat });
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancelSource();
    this.disposed = true;
    for (const [event, handler] of this.handlers) this.audio.removeEventListener(event, handler);
    this.handlers.clear();
    this.listeners.clear();
  }

  private cancelSource(): void {
    ++this.requestId;
    ++this.playId;
    this.controller?.abort();
    this.controller = null;
    this.sourceReady = false;
    this.rangeStart = 0;
    this.rangeEnd = 0;
    this.wantsPlayback = false;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  private async onEnded(): Promise<void> {
    if (!this.sourceReady || !this.wantsPlayback) return;
    if (this.snapshot.repeat === 'one') { this.audio.currentTime = this.rangeStart / 1000; await this.resume(); }
    else if (this.snapshot.index + 1 < this.snapshot.queue.length || this.snapshot.repeat === 'all') await this.next();
    else { this.wantsPlayback = false; this.update({ status: 'ended', currentTime: this.snapshot.duration }); }
  }

  private updateTimeline(): void {
    if (!this.sourceReady) return;
    const actual = finiteDuration(this.audio.duration * 1000) || finiteDuration(this.snapshot.track?.durationMs);
    const duration = this.rangeEnd ? Math.min(actual || this.rangeEnd, this.rangeEnd) : actual;
    if (this.audio.currentTime * 1000 < this.rangeStart) this.audio.currentTime = this.rangeStart / 1000;
    const time = Number.isFinite(this.audio.currentTime) ? Math.max(0, this.audio.currentTime * 1000) : 0;
    this.update({ duration, currentTime: duration ? Math.min(time, duration) : time });
    if (this.rangeEnd && time >= this.rangeEnd && this.wantsPlayback) {
      this.audio.pause();
      void this.onEnded();
    }
  }
  private fail(code: PlayerError['code'], message: string): void {
    this.wantsPlayback = false;
    ++this.playId;
    this.audio.pause();
    this.update({ status: 'error', error: { code, message } });
  }
  private on(event: string, handler: EventListener): void {
    this.handlers.set(event, handler);
    this.audio.addEventListener(event, handler);
  }
  private update(patch: Partial<PlayerSnapshot>): void {
    if (this.disposed) return;
    if (Object.keys(patch).every(key => Object.is(this.snapshot[key as keyof PlayerSnapshot], patch[key as keyof PlayerSnapshot]))) return;
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch, error: patch.error ? Object.freeze({ ...patch.error }) : patch.error === null ? null : this.snapshot.error });
    for (const listener of this.listeners) listener();
  }
}
