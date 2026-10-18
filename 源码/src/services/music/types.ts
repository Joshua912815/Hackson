export type MusicSource = 'demo' | 'netease';
export type Mood = 'calm' | 'energy' | 'comfort';
export interface Track {
  id: string;
  source: MusicSource;
  title: string;
  artists: string[];
  album: string;
  durationMs: number;
  coverUrl: string | null;
  availability: 'unknown' | 'full' | 'preview' | 'unavailable';
  reason?: string;
}
export interface Playlist {
  id: string;
  source: MusicSource;
  title: string;
  description: string;
  coverUrl: string | null;
  trackCount: number;
}
export interface Playback {
  kind: 'full' | 'preview' | 'unavailable';
  url: string | null;
  previewStartMs?: number;
  previewEndMs?: number;
  expiresAt?: number;
  reason?: string;
}
export interface LyricLine { timeMs: number; text: string; }
export interface Lyrics { kind: 'synced' | 'plain' | 'none'; lines: LyricLine[]; plainText?: string; }
export interface Discovery { playlists: Playlist[]; tracks: Track[]; }
export interface TrackPage { tracks: Track[]; total: number; nextCursor: string | null; }
export interface PlaylistPage { playlist: Playlist; tracks: Track[]; nextCursor: string | null; }
export interface MusicService {
  readonly source: MusicSource;
  discover(mood?: Mood, signal?: AbortSignal): Promise<Discovery>;
  search(query: string, cursor?: string, signal?: AbortSignal): Promise<TrackPage>;
  playlist(id: string, cursor?: string, signal?: AbortSignal): Promise<PlaylistPage>;
  playback(track: Track, signal?: AbortSignal): Promise<Playback>;
  lyrics(track: Track, signal?: AbortSignal): Promise<Lyrics>;
}
