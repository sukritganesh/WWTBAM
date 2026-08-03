import type { MusicScene } from '../audio/types';
import { currentQuestion, type GameRunState } from '../game';
import type { ScreenId } from './types';

const OUTRO_SCREENS: readonly ScreenId[] = ['game', 'results', 'review', 'statistics'];

export function musicSceneForApp(
  screen: ScreenId,
  game: GameRunState | null,
): MusicScene {
  if (game?.terminalOutcome && OUTRO_SCREENS.includes(screen)) return 'outro';
  if (screen !== 'game' || !game) return 'intro';

  const pauseLikeOverlay =
    game.overlay?.kind === 'pause' ||
    game.overlay?.kind === 'help' ||
    (game.overlay?.kind === 'walk-away-confirmation' &&
      game.overlay.returnTo === 'pause');
  if (pauseLikeOverlay) return 'pause';

  const level = currentQuestion(game).level;
  if (level <= 5) return 'level-1';
  if (level <= 10) return 'level-2';
  return 'level-3';
}
