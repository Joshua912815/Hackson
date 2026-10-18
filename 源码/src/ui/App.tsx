import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { MusicPlayer, type PlayerSnapshot } from '../features/player/player.ts';
import { findActiveLyricIndex, formatTime } from '../features/player/lyrics.ts';
import { demoService } from '../services/music/demo.ts';
import { HttpMusicService } from '../services/music/http.ts';
import type { MusicSource, MusicService, Mood, Track, Playlist, Lyrics } from '../services/music/types.ts';
import { Icon, type IconName } from './Icon.tsx';

const onlineService = new HttpMusicService();
const serviceFor = (source: MusicSource): MusicService => source === 'demo' ? demoService : onlineService;
// This instance lives outside page components: navigation never creates a second audio.
const player = new MusicPlayer({ resolveSource: (track, signal) => serviceFor(track.source).playback(track, signal) });
const moods: Array<{ id: Mood; label: string; note: string; icon: IconName }> = [
  { id: 'calm', label: '想静一静', note: '给思绪留白', icon: 'leaf' },
  { id: 'energy', label: '需要一点能量', note: '捡起小小的光', icon: 'sun' },
  { id: 'comfort', label: '想被接住', note: '此刻，有音乐陪你', icon: 'moon' },
];
type View = { kind: 'discover' } | { kind: 'search'; query: string } | { kind: 'playlist'; id: string };
type Content = { tracks: Track[]; playlists: Playlist[]; title: string; description: string; total: number; cursor: string | null };
const empty: Content = { tracks: [], playlists: [], title: '', description: '', total: 0, cursor: null };
function Cover({ url, title, className = '' }: { url: string | null; title: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return url && !broken ? <img className={'cover ' + className} src={url} alt={title + '封面'} onError={() => setBroken(true)} /> : <span className={'cover fallback ' + className} role="img" aria-label={title + '暂无封面'}><Icon name="music" size={36} /></span>;
}
function IconButton({ name, label, onClick, disabled, active, className = '' }: { name: IconName; label: string; onClick: () => void; disabled?: boolean; active?: boolean; className?: string }) {
  return <button className={'icon-button ' + (active ? 'active ' : '') + className} type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon name={name} /></button>;
}
function Dialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = ref.current!;
    root.querySelector<HTMLElement>('button')?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); }
      if (e.key !== 'Tab') return;
      const list = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href], [tabindex="0"]')];
      const first = list[0], last = list.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => { document.body.style.overflow = bodyOverflow; document.removeEventListener('keydown', handler); previous?.focus(); };
  }, []);
  return <div className="dialog-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} className={'dialog ' + (wide ? 'wide' : '')} role="dialog" aria-modal="true" aria-label={title}><div className="dialog-heading"><h2>{title}</h2><IconButton name="close" label="关闭弹窗" onClick={onClose} /></div>{children}</div></div>;
}
function TrackRows({ tracks, snapshot, onPlay, saved, onSave }: { tracks: readonly Track[]; snapshot: PlayerSnapshot; onPlay: (index: number) => void; saved: Set<string>; onSave: (t: Track) => void }) {
  return <div className="track-list">{tracks.map((t, i) => {
    const current = snapshot.track?.source === t.source && snapshot.track.id === t.id;
    return <div key={t.source + t.id} className={'track-row ' + (current ? 'current' : '')}>
      <button className="track-main" onClick={() => onPlay(i)} aria-label={'播放 ' + t.title}>
        <span className="track-number">{current && snapshot.status === 'playing' ? <span className="equalizer"><i /><i /><i /></span> : String(i + 1).padStart(2, '0')}</span>
        <Cover url={t.coverUrl} title={t.title} /><span className="track-copy"><strong>{t.title}</strong><small>{t.artists.join(' / ')} {t.availability === 'preview' ? '· 试听' : t.availability === 'unavailable' ? '· 暂不可播放' : ''}</small></span>
      </button><span className="track-album">{t.album}</span><span className="track-time">{formatTime(t.durationMs)}</span>
      <IconButton name="heart" label={(saved.has(t.source + t.id) ? '取消收藏 ' : '收藏 ') + t.title} active={saved.has(t.source + t.id)} onClick={() => onSave(t)} />
      <IconButton name={current && snapshot.status === 'playing' ? 'pause' : 'play'} label={(current && snapshot.status === 'playing' ? '暂停 ' : '播放 ') + t.title} onClick={() => current ? void player.toggle() : onPlay(i)} />
    </div>;
  })}</div>;
}
function PlayerBar({ snapshot: s, onImmersive, onQueue, dark }: { snapshot: PlayerSnapshot; onImmersive: () => void; onQueue: () => void; dark: boolean }) {
  const t = s.track;
  const playing = s.status === 'playing' || s.status === 'buffering';
  return <footer className={'player-bar ' + (dark ? 'dark' : '')} aria-label="音乐播放器">
    <div className="now-playing"><button className="now-cover" onClick={onImmersive} disabled={!t} aria-label="进入沉浸播放"><Cover url={t?.coverUrl || null} title={t?.title || '待播放'} /></button><div><strong>{t?.title || '留一首歌给此刻'}</strong><small>{t ? t.artists.join(' / ') : '选一种心情，开始聆听'}{t?.source === 'demo' ? ' · 原创演示' : ''}{s.playbackKind === 'preview' ? ' · 试听片段' : ''}</small></div></div>
    <div className="transport"><div className="transport-buttons">
      <IconButton name="repeat" label={'循环：' + ({ off: '关闭', all: '列表循环', one: '单曲循环' }[s.repeat])} active={s.repeat !== 'off'} onClick={() => player.setRepeat(s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off')} /><span className="repeat-one">{s.repeat === 'one' ? '1' : ''}</span>
      <IconButton name="previous" label="上一首" disabled={!t} onClick={() => void player.previous()} />
      <IconButton name={playing ? 'pause' : 'play'} label={playing ? '暂停播放' : '开始播放'} disabled={!t} className="main-play" onClick={() => void player.toggle()} />
      <IconButton name="next" label="下一首" disabled={!t || (s.index === s.queue.length - 1 && s.repeat !== 'all')} onClick={() => void player.next()} />
      <span className="transport-status" aria-live="polite">{s.status === 'loading' || s.status === 'buffering' ? '加载中' : ''}</span>
    </div><div className="timeline"><time>{formatTime(s.currentTime)}</time><input type="range" min={s.startTime} max={Math.max(s.duration, s.startTime + 1)} value={s.currentTime} step="100" disabled={!t || s.status === 'loading'} aria-label="播放进度" onChange={e => player.seek(Number(e.target.value))} style={{ '--progress': ((s.currentTime - s.startTime) / Math.max(1, s.duration - s.startTime) * 100) + '%' } as React.CSSProperties} /><time>{formatTime(s.duration)}</time></div></div>
    <div className="player-extras"><div className="volume"><IconButton name={s.muted || s.volume === 0 ? 'mute' : 'volume'} label={s.muted ? '取消静音' : '静音'} onClick={() => player.setMuted(!s.muted)} /><input type="range" min="0" max="1" step=".01" value={s.muted ? 0 : s.volume} aria-label="音量" onChange={e => { player.setMuted(false); player.setVolume(Number(e.target.value)); }} /></div><IconButton name="queue" label="打开播放队列" onClick={onQueue} /><IconButton name="expand" label="沉浸模式" disabled={!t} onClick={onImmersive} /></div>
  </footer>;
}
function Immersive({ snapshot: s, onBack, backRef }: { snapshot: PlayerSnapshot; onBack: () => void; backRef: RefObject<HTMLButtonElement | null> }) {
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [following, setFollowing] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const active = lyrics ? findActiveLyricIndex(lyrics.lines, s.currentTime) : -1;
  const t = s.track;
  useEffect(() => {
    if (!t) return;
    const ctrl = new AbortController();
    setLyrics(null); setError(''); setFollowing(true);
    serviceFor(t.source).lyrics(t, ctrl.signal).then(value => { if (!ctrl.signal.aborted) setLyrics(value); }).catch(e => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : '歌词加载失败。'); });
    return () => ctrl.abort();
  }, [t?.id, t?.source, retry]);
  useEffect(() => {
    if (!following) return;
    const root = scroller.current;
    const line = root?.querySelector<HTMLElement>('[data-current="true"]');
    if (root && line) root.scrollTo({ top: line.offsetTop - root.offsetTop - root.clientHeight / 2 + line.clientHeight / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [active, following, lyrics]);
  useEffect(() => { backRef.current?.focus(); }, []);
  if (!t) return null;
  return <main className="immersive" style={{ '--art': 'url("' + (t.coverUrl || '/covers/slow.svg') + '")' } as React.CSSProperties}>
    <div className="ambient" /><div className="immersive-top"><button ref={backRef} className="text-button" onClick={onBack}><Icon name="back" />返回发现</button><span>此刻 · JUST BE HERE</span><span className="source-pill">{t.source === 'demo' ? '原创演示' : '网易云在线'}</span></div>
    <div className="immersive-body"><section className="album-stage"><div className="sleeve"><Cover url={t.coverUrl} title={t.title} /><div className="record-disc"><span /></div></div><div className="album-meta"><span className="eyebrow">NOW PLAYING / 此刻正在听</span><h1>{t.title}</h1><p>{t.artists.join(' / ')} <span>— {t.album}</span></p></div></section>
    <section className="lyric-stage" aria-label={t.source === 'demo' ? '同步聆听文字' : '歌词'}>
      <div className="lyric-heading"><span className="eyebrow">{t.source === 'demo' ? '同步聆听文字 · 原创器乐，无人声' : 'LYRICS / 同步歌词'}</span><span className="lyric-dot" /></div>
      {error ? <div className="lyric-message"><p>{error}</p><button className="text-button" onClick={() => setRetry(n => n + 1)}>重新加载歌词</button></div> : !lyrics ? <div className="lyric-message">正在寻找这一首的文字…</div> : lyrics.kind === 'none' ? <div className="lyric-message"><h2>让旋律说话。</h2><p>这首歌暂时没有歌词，专心听就好。</p></div> : lyrics.kind === 'plain' ? <div className="plain-lyrics">{lyrics.plainText || lyrics.lines.map(l => l.text).join('\n')}</div> :
      <div ref={scroller} className="lyrics" tabIndex={0} aria-label="可滚动歌词，点击句子跳转播放" onWheel={() => setFollowing(false)} onTouchStart={() => setFollowing(false)} onPointerDown={() => setFollowing(false)} onKeyDown={e => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) setFollowing(false); }}>
        <div className="lyric-space" />{lyrics.lines.map((line, i) => <button key={i + ':' + line.timeMs} data-current={i === active} className={'lyric-line ' + (i === active ? 'is-current' : '')} onClick={() => { player.seek(line.timeMs); setFollowing(true); }}>{line.text || '♪'}</button>)}<div className="lyric-space" />
      </div>}
      {!following && lyrics?.kind === 'synced' && <button className="follow-button" onClick={() => setFollowing(true)}>回到当前句 <Icon name="arrow" size={16} /></button>}
      <p className="listening-note">不急着到下一刻，先好好听这一刻。</p>
    </section></div>
  </main>;
}
export function App() {
  const s = useSyncExternalStore(player.subscribe, player.getSnapshot);
  const [source, setSource] = useState<MusicSource>('demo');
  const [mood, setMood] = useState<Mood>('calm');
  const [view, setView] = useState<View>({ kind: 'discover' });
  const [query, setQuery] = useState('');
  const [content, setContent] = useState<Content>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [paging, setPaging] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [dialog, setDialog] = useState<'queue' | 'about' | 'saved' | null>(null);
  const [favorites, setFavorites] = useState<Track[]>(() => { try { const v = JSON.parse(localStorage.getItem('hackson-saved') || '[]'); return Array.isArray(v) ? v.filter(t => t && typeof t.id === 'string' && typeof t.title === 'string' && Array.isArray(t.artists) && ['demo', 'netease'].includes(t.source)).slice(0, 200) : []; } catch { return []; } });
  const [notice, setNotice] = useState('');
  const backRef = useRef<HTMLButtonElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const saved = new Set(favorites.map(t => t.source + t.id));
  const svc = serviceFor(source);
  useEffect(() => {
    const ctrl = new AbortController(); ++generation.current;
    setLoading(true); setError(''); setContent(empty); setPaging(false);
    const task = view.kind === 'search' ? svc.search(view.query, undefined, ctrl.signal).then(v => ({ ...empty, tracks: v.tracks, total: v.total, cursor: v.nextCursor, title: '搜索「' + view.query + '」', description: '从旋律里，找到你的答案。' })) :
      view.kind === 'playlist' ? svc.playlist(view.id, undefined, ctrl.signal).then(v => ({ ...empty, tracks: v.tracks, cursor: v.nextCursor, total: v.playlist.trackCount, title: v.playlist.title, description: v.playlist.description })) :
      svc.discover(mood, ctrl.signal).then(v => ({ ...empty, ...v, total: v.tracks.length, title: '为这一刻，选一首', description: moods.find(m => m.id === mood)!.note }));
    task.then(v => { if (!ctrl.signal.aborted) setContent(v); }).catch(e => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : '加载失败，请重试。'); }).finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [source, mood, view, retry]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 3000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && immersive && !dialog) { setImmersive(false); setTimeout(() => enterRef.current?.focus(), 0); }
      if (e.code === 'Space' && e.target === document.body && !dialog) { e.preventDefault(); void player.toggle(); }
    };
    document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler);
  }, [immersive, dialog]);
  useEffect(() => { document.documentElement.style.colorScheme = immersive ? 'dark' : 'light'; return () => { document.documentElement.style.colorScheme = 'light'; }; }, [immersive]);
  const save = (t: Track) => {
    const exists = saved.has(t.source + t.id);
    const next = exists ? favorites.filter(x => x.source !== t.source || x.id !== t.id) : [...favorites, t].slice(-200);
    setFavorites(next);
    try { localStorage.setItem('hackson-saved', JSON.stringify(next)); setNotice(exists ? '已移出心动收藏' : '已加入心动收藏'); }
    catch { setNotice('已收藏到本次会话，浏览器无法保存到本地。'); }
  };
  const loadMore = async () => {
    if (!content.cursor || paging) return;
    const gen = generation.current; setPaging(true);
    try {
      const v = view.kind === 'search' ? await svc.search(view.query, content.cursor) : view.kind === 'playlist' ? await svc.playlist(view.id, content.cursor) : null;
      if (v && gen === generation.current) setContent(c => ({ ...c, tracks: [...c.tracks, ...v.tracks.filter(t => !c.tracks.some(x => x.source === t.source && x.id === t.id))], cursor: v.nextCursor }));
    } catch (e) { if (gen === generation.current) setNotice(e instanceof Error ? e.message : '加载下一页失败。'); }
    finally { if (gen === generation.current) setPaging(false); }
  };
  const closeImmersive = () => { setImmersive(false); setTimeout(() => enterRef.current?.focus(), 0); };
  return <div className={'app ' + (immersive ? 'immersive-open' : '')}>
    {!immersive ? <>
      <header className="site-header"><button className="brand" onClick={() => setView({ kind: 'discover' })} aria-label="此刻，返回首页"><img src="/covers/mark.svg" alt="" /><span>此刻<small>MUSIC FOR YOUR MOOD</small></span></button><nav aria-label="主导航"><button className={view.kind === 'discover' ? 'selected' : ''} onClick={() => setView({ kind: 'discover' })}>发现此刻</button><button onClick={() => setDialog('saved')}>心动收藏<span className="nav-count">{favorites.length || ''}</span></button></nav><div className="header-right"><div className="source-control"><label htmlFor="source">音乐来源</label><select id="source" aria-label="音乐来源" value={source} onChange={e => { setSource(e.target.value as MusicSource); setView({ kind: 'discover' }); }}><option value="demo">原创演示</option><option value="netease">网易云在线</option></select></div><button className="about-button" onClick={() => setDialog('about')} aria-label="关于此刻">此</button></div></header>
      <main className="discovery">
        {view.kind === 'discover' ? <section className="hero"><div className="hero-copy"><span className="eyebrow"><span className="little-line" /> 给情绪一个安放的地方</span><h1>把心情，<br />交给<span className="serif">一首歌。</span></h1><p>不用解释今天的你。<br />选一种心情，让旋律陪你待一会儿。</p><button ref={enterRef} className="primary-button" onClick={() => { if (content.tracks.length) { void player.setQueue(content.tracks); setImmersive(true); } }} disabled={loading || !content.tracks.length}>开始这一刻 <Icon name="arrow" size={18} /></button><span className="hero-footnote">{source === 'demo' ? '原创合成器乐 · 48 秒的情绪留白' : '网易云在线 · 播放以实际权限为准'}</span></div><div className="hero-art" aria-hidden="true"><span className="art-orbit" /><div className="art-card art-back"><img src="/covers/light.svg" alt="" /></div><div className="art-card art-front"><img src="/covers/slow.svg" alt="" /><div className="art-caption"><span>THE SLOW MOMENTS</span><span>VOL. 01</span></div></div><span className="art-label"><i /> THIS MOMENT IS YOURS</span><div className="floating-note"><Icon name="music" size={19} /><span>让心情，有处可去<small>A LITTLE SPACE FOR YOU</small></span></div></div><span className="hero-index">01 / YOUR MOMENT</span></section> : <div className="back-row"><button className="text-button" onClick={() => setView({ kind: 'discover' })}><Icon name="back" size={18} />返回发现</button><span>{source === 'demo' ? '原创演示曲库' : '网易云在线'}</span></div>}
        <section className="mood-section"><div className="mood-intro"><span className="eyebrow">HOW ARE YOU FEELING?</span><h2>此刻，是什么心情？</h2></div><div className="mood-options" aria-label="选择心情">{moods.map(m => <button key={m.id} aria-pressed={mood === m.id} className={'mood ' + (mood === m.id ? 'chosen' : '')} onClick={() => { setMood(m.id); setView({ kind: 'discover' }); }}><Icon name={m.icon} size={19} /><span>{m.label}</span>{mood === m.id && <span className="mood-check"><Icon name="check" size={12} /></span>}</button>)}</div></section>
        <div className="content-top"><div><span className="eyebrow">{view.kind === 'discover' ? 'CURATED FOR THIS MOMENT' : 'FIND YOUR SOUND'}</span><h2>{content.title || (view.kind === 'search' ? '寻找旋律中…' : '为这一刻，选一首')}</h2></div><form className="search" role="search" onSubmit={e => { e.preventDefault(); if (query.trim()) setView({ kind: 'search', query: query.trim() }); }}><Icon name="search" size={18} /><input aria-label="搜索歌曲或歌手" maxLength={100} placeholder="搜索一首歌、一种心情" value={query} onChange={e => setQuery(e.target.value)} /><button type="submit" aria-label="提交搜索" disabled={!query.trim()}><Icon name="arrow" size={17} /></button></form></div>
        <div className="mode-note"><span className="status-dot" />{source === 'demo' ? '演示模式 · 3 首本站原创合成器乐；按心情编排，不使用在线推荐。' : '在线模式 · 数据由网易云服务提供；不可用内容将明确提示。'}</div>
        {loading ? <div className="loading-state" role="status"><span className="loading-disc" /><p>正在为此刻寻找旋律…</p></div> : error ? <div className="empty-state" role="alert"><Icon name="music" size={30} /><h3>旋律还没连接上</h3><p>{error}</p><button className="primary-button" onClick={() => setRetry(n => n + 1)}>重新连接 <Icon name="arrow" size={16} /></button>{source === 'netease' && <button className="text-button" onClick={() => { setSource('demo'); setView({ kind: 'discover' }); }}>切换到原创演示</button>}</div> : <>
          {content.playlists.length > 0 && <div className="playlist-grid">{content.playlists.map((p, i) => <button key={p.id} className="playlist-card" onClick={() => setView({ kind: 'playlist', id: p.id })}><div className="playlist-art"><Cover url={p.coverUrl} title={p.title} /><span className="playlist-badge">MOOD / 0{i + 1}</span><span className="playlist-arrow"><Icon name="arrow" size={23} /></span></div><div className="playlist-caption"><div><h3>{p.title}</h3><p>{p.description}</p></div><span>{String(p.trackCount).padStart(2, '0')} 首</span></div></button>)}</div>}
          <section className="songs-section"><div className="songs-heading"><div><h3>{view.kind === 'discover' ? '听见此刻' : content.title}</h3><p>{content.description}{view.kind !== 'discover' ? ' · 共 ' + content.total + ' 首' : ''}</p></div><button className="text-button" disabled={!content.tracks.length} onClick={() => void player.setQueue(content.tracks)}><Icon name="play" size={15} />播放全部</button></div>
          {content.tracks.length ? <TrackRows tracks={content.tracks} snapshot={s} saved={saved} onSave={save} onPlay={i => void player.setQueue(content.tracks, i)} /> : <div className="empty-state"><h3>还没有找到这段旋律</h3><p>{source === 'demo' ? '演示曲库可搜索：慢慢来、把光留住、先深呼吸。' : '换一个歌名或歌手试试。'}</p></div>}
          {content.cursor && <button className="load-more" disabled={paging} onClick={() => void loadMore()}>{paging ? '加载中…' : '再找一些旋律'}</button>}</section>
        </>}
        <div className="page-footer"><span>此刻 <span className="footer-slash">/</span> 让音乐接住每一种心情。</span><button onClick={() => setDialog('about')}>关于这场声音实验 <Icon name="arrow" size={14} /></button></div>
      </main>
    </> : <Immersive snapshot={s} onBack={closeImmersive} backRef={backRef} />}
    {s.error && <div className={'play-error ' + (immersive ? 'on-dark' : '')} role="alert"><span>{s.error.message}</span><button onClick={() => void player.retry()}>重试</button></div>}
    <PlayerBar snapshot={s} dark={immersive} onQueue={() => setDialog('queue')} onImmersive={() => { if (s.track) setImmersive(true); }} />
    {notice && <div className="toast" role="status">{notice}</div>}
    {dialog === 'queue' && <Dialog title={'播放队列 · ' + s.queue.length + ' 首'} onClose={() => setDialog(null)} wide>{s.queue.length ? <TrackRows tracks={s.queue} snapshot={s} saved={saved} onSave={save} onPlay={i => void player.select(i)} /> : <div className="empty-state"><p>从发现页选一首歌，队列就从这里开始。</p></div>}</Dialog>}
    {dialog === 'saved' && <Dialog title={'心动收藏 · ' + favorites.length + ' 首'} onClose={() => setDialog(null)} wide>{favorites.length ? <TrackRows tracks={favorites} snapshot={s} saved={saved} onSave={save} onPlay={i => void player.setQueue(favorites, i)} /> : <div className="empty-state"><Icon name="heart" size={30} /><p>点击歌曲旁的爱心，收藏属于你的旋律。</p><small>收藏保存在当前浏览器。</small></div>}</Dialog>}
    {dialog === 'about' && <Dialog title="此刻，给情绪一个安放的地方" onClose={() => setDialog(null)}><div className="about-copy"><span className="eyebrow">EE HACKATHON 2026 / 创意文娱</span><p>有时候，我们需要的不是更多选项，而是一首刚好接住心情的歌。</p><p>「此刻」从心情出发，把选择音乐、真实播放和沉浸聆听连在一起，回应本次关键词 <strong>情绪价值</strong>。</p><p>原创演示模式使用本站算法合成的 3 段器乐和原创同步聆听文字；没有人声，文字不是演唱歌词。封面为原创 SVG。网易云在线模式须连接独立后端，以实际资源和播放权限为准。</p><p className="muted">这是陪伴与表达的小工具。收藏只保存在当前浏览器；空格可播放/暂停，Esc 可退出沉浸模式。</p></div></Dialog>}
  </div>;
}
