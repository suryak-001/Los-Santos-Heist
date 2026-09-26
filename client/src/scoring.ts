import type { GameState } from './types/game';

// Mirrors GameManager.completionBonusAt on the server: 1,000 for completing in
// minute 0, minus 50 per whole minute of play (paused time excluded), floor 200.
export function completionBonusAt(state: GameState, time: number): number {
    const { startTime, paused, pausedAt } = state;
    if (!startTime) return 1000;
    const pausedMs = (state.totalPausedMs ?? 0) + (paused && pausedAt ? time - pausedAt : 0);
    const minutes = Math.floor(Math.max(0, time - startTime - pausedMs) / 60000);
    return Math.max(200, 1000 - 50 * minutes);
}
