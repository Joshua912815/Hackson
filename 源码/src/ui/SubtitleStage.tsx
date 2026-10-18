import { useEffect, useState, type CSSProperties } from 'react';
import type { MusicPlayer, PlayerSnapshot } from '../features/player/player.ts';
import type { Lyrics, Mood } from '../services/music/types.ts';
import { demoBpm, stageMoods, subtitleFrame } from '../features/player/stage.ts';

export function SubtitleStage({ player, snapshot: s, lyrics, mood, onMood, onList }: {
  player: MusicPlayer; snapshot: PlayerSnapshot; lyrics: Lyrics; mood: Mood;
  onMood: (mood: Mood) => void; onList: () => void;
}) {
  const [clock, setClock] = useState(s.currentTime);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    let id = 0, last = 0;
    const tick = (now: number) => {
      if (now - last > 32) { setClock(player.getCurrentTime()); last = now; }
      if (!reduced && s.status === 'playing') id = requestAnimationFrame(tick);
    };
    setClock(player.getCurrentTime());
    if (!reduced && s.status === 'playing') id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [player, s.status, s.track?.id, s.track?.source, s.currentTime, reduced]);
  const bpm = s.track?.source === 'demo' ? demoBpm(s.track.id) : undefined;
  const frame = subtitleFrame(lyrics.lines, clock, s.duration, bpm);
  const theme = stageMoods[mood];
  return <section className={'subtitle-theatre mood-' + mood + (reduced ? ' reduced' : '')} aria-label="情绪字幕演出" style={{ '--stage-accent': theme.color, '--beat': reduced ? 0 : frame?.beat || 0 } as CSSProperties}>
    <div className="stage-orb orb-one" /><div className="stage-orb orb-two" /><div className="stage-grid" />
    <div className="stage-topline"><span>此刻 / EMOTION IN MOTION</span><span>{s.track?.source === 'demo' ? '原创器乐 × 聆听文字' : '音乐 × 动态歌词'}</span></div>
    <div className="stage-mood-controls" aria-label="字幕情绪风格">{(Object.keys(stageMoods) as Mood[]).map(id => <button key={id} aria-pressed={mood === id} onClick={() => onMood(id)}>{stageMoods[id].label}</button>)}</div>
    <div className="stage-watermark" aria-hidden="true">{theme.word}</div>
    {frame ? <div key={frame.index + ':' + s.track?.source + ':' + s.track?.id} className={'subtitle-scene layout-' + frame.layout} style={{ '--elapsed': frame.elapsedMs + 'ms', '--scene-progress': frame.progress } as CSSProperties}>
      <span className="scene-number" aria-hidden="true">{String(frame.index + 1).padStart(2, '0')} <i /> {String(lyrics.lines.length).padStart(2, '0')}</span>
      <div className="scene-kicker" aria-hidden="true">{theme.english}</div>
      <h2 className="stage-text" aria-label={frame.text}>{Array.from(frame.text).map((char, index) => <span key={index} className={'stage-char ' + (index >= frame.accentStart ? 'accent-char' : '')} aria-hidden="true" style={{ '--char-index': index } as CSSProperties}>{char === ' ' ? '\u00a0' : char}</span>)}</h2>
      <div className="scene-rule" aria-hidden="true"><i /></div>
      <p className="scene-next"><span>接下来</span>{frame.nextText}</p>
    </div> : <div className="subtitle-scene"><h2 className="stage-waiting">让心情，慢慢入场。</h2></div>}
    <div className="stage-bottomline"><div className="beat-mark" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map(i => <i key={i} style={{ height: (8 + (i % 3) * 7) + 'px' }} />)}</div><span>{reduced ? '已减少动态效果' : bpm ? '随原创节拍编排' : '随歌词时间编排'} · {theme.label}</span><button onClick={onList}>查看全部文字 ↗</button></div>
  </section>;
}
