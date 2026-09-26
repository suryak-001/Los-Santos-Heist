import React from 'react';
import { Timer } from 'lucide-react';
import type { GameState } from '../types/game';
import { completionBonusAt, msUntilBonusDrop, BONUS_START, BONUS_STEP, BONUS_FLOOR } from '../scoring';

interface BonusCountdownProps {
    gameState: GameState;
    now: number;
}

const RING_RADIUS = 18;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// Live Mission Passed bonus: the figure, how much of it is left, and a ring
// counting down to the next -50.
const BonusCountdown: React.FC<BonusCountdownProps> = ({ gameState, now }) => {
    const bonus = completionBonusAt(gameState, now);
    const untilDrop = msUntilBonusDrop(gameState, now);
    const seconds = untilDrop === null ? 0 : Math.ceil(untilDrop / 1000);
    const urgent = untilDrop !== null && seconds <= 10 && !gameState.paused;
    const left = (bonus - BONUS_FLOOR) / (BONUS_START - BONUS_FLOOR);
    const ringFill = untilDrop === null ? 0 : untilDrop / 60000;

    return (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 lg:p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="hud-label text-heist-grey flex items-center gap-1.5">
                        <Timer size={12} /> Mission Passed bonus
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span
                            key={bonus}
                            className="inline-block origin-left font-mono tabular text-3xl lg:text-4xl font-extrabold text-heist-money drop-shadow-[0_0_12px_rgba(61,220,132,0.45)] animate-tick-pop"
                        >
                            {bonus}
                        </span>
                        <span className="font-mono text-[10px] text-heist-grey uppercase">/ {BONUS_START}</span>
                    </div>
                </div>

                {/* Ring: time left until the next drop */}
                <div className="relative w-14 h-14 shrink-0" aria-hidden="true">
                    <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
                        <circle cx="22" cy="22" r={RING_RADIUS} fill="none" strokeWidth="4" className="stroke-white/10" />
                        <circle
                            cx="22" cy="22" r={RING_RADIUS} fill="none" strokeWidth="4" strokeLinecap="round"
                            className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${urgent ? 'stroke-heist-pink' : 'stroke-heist-sun'}`}
                            strokeDasharray={RING_LENGTH}
                            strokeDashoffset={RING_LENGTH * (1 - ringFill)}
                        />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center font-mono tabular text-[11px] font-bold ${urgent ? 'text-heist-pink animate-pulse' : 'text-heist-light'}`}>
                        {untilDrop === null ? '—' : `${seconds}s`}
                    </span>
                </div>
            </div>

            {/* Bar: share of the bonus still on the table (1000 -> 200) */}
            <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-heist-pink via-heist-sun to-heist-money transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.max(0, left) * 100}%` }}
                />
            </div>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-heist-grey">
                {gameState.paused
                    ? 'Clock paused'
                    : untilDrop === null
                        ? `Floor reached: ${BONUS_FLOOR} guaranteed`
                        : <>Drops to <span className="text-heist-light">{bonus - BONUS_STEP}</span> in {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</>}
            </p>
        </div>
    );
};

export default BonusCountdown;
