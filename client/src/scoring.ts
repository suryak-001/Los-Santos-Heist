import type { GameState } from './types/game';

export const BONUS_START = 1000;
export const BONUS_STEP = 50;
export const BONUS_FLOOR = 200;

// Play time so far, paused time excluded
function playedMs(state: GameState, time: number): number {
    const { startTime, paused, pausedAt } = state;
    if (!startTime) return 0;
    const pausedMs = (state.totalPausedMs ?? 0) + (paused && pausedAt ? time - pausedAt : 0);
    return Math.max(0, time - startTime - pausedMs);
}

// Mirrors GameManager.completionBonusAt on the server: 1,000 for completing in
// minute 0, minus 50 per whole minute of play (paused time excluded), floor 200.
export function completionBonusAt(state: GameState, time: number): number {
    const minutes = Math.floor(playedMs(state, time) / 60000);
    return Math.max(BONUS_FLOOR, BONUS_START - BONUS_STEP * minutes);
}

// Time until the bonus next drops by 50, or null once it has hit the floor
export function msUntilBonusDrop(state: GameState, time: number): number | null {
    if (completionBonusAt(state, time) <= BONUS_FLOOR) return null;
    return 60000 - (playedMs(state, time) % 60000);
}
