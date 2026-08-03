import type { MusicScene } from './types';

const musicAsset = (path: string): string =>
  `${import.meta.env.BASE_URL}audio/music/${path}`;

export const INTRO_MUSIC = musicAsset('intro/menu-intro.mp3');

export const RUN_MUSIC_CATALOG = Object.freeze({
  level1: Object.freeze([
    musicAsset('gameplay/level-1-a.mp3'),
    musicAsset('gameplay/level-1-b.mp3'),
  ]),
  level2: Object.freeze([
    musicAsset('gameplay/level-2-a.mp3'),
    musicAsset('gameplay/level-2-b.mp3'),
    musicAsset('gameplay/level-2-c.mp3'),
  ]),
  level3: Object.freeze([
    musicAsset('gameplay/level-3-a.mp3'),
    musicAsset('gameplay/level-3-b.mp3'),
  ]),
  pause: Object.freeze([
    musicAsset('pause/pause-a.mp3'),
    musicAsset('pause/pause-b.mp3'),
  ]),
  outro: Object.freeze([
    musicAsset('outro/outro-a.mp3'),
    musicAsset('outro/outro-b.mp3'),
  ]),
});

export interface RunMusicPlaylist {
  readonly runId: string;
  readonly level1: string;
  readonly level2: string;
  readonly level3: string;
  readonly pause: string;
  readonly outro: string;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

function selectTrack(
  runId: string,
  group: keyof typeof RUN_MUSIC_CATALOG,
): string {
  const candidates = RUN_MUSIC_CATALOG[group];
  return candidates[stableHash(`${runId}:${group}`) % candidates.length];
}

/**
 * Run IDs contain fresh randomness. Deriving the playlist from that ID gives
 * each run a random-feeling selection while making refresh/resume stable.
 */
export function selectRunMusic(runId: string): RunMusicPlaylist {
  if (!runId.trim()) throw new TypeError('A run ID is required to select music.');
  return Object.freeze({
    runId,
    level1: selectTrack(runId, 'level1'),
    level2: selectTrack(runId, 'level2'),
    level3: selectTrack(runId, 'level3'),
    pause: selectTrack(runId, 'pause'),
    outro: selectTrack(runId, 'outro'),
  });
}

export function musicSourceForScene(
  scene: MusicScene,
  playlist: RunMusicPlaylist | null,
): string | null {
  switch (scene) {
    case 'intro':
      return INTRO_MUSIC;
    case 'level-1':
      return playlist?.level1 ?? null;
    case 'level-2':
      return playlist?.level2 ?? null;
    case 'level-3':
      return playlist?.level3 ?? null;
    case 'pause':
      return playlist?.pause ?? null;
    case 'outro':
      return playlist?.outro ?? null;
    case 'silent':
      return null;
  }
}
