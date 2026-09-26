import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import type { LeaderboardState } from '../types/game';

// Podium: gold, cyan and purple badges, each card tinted to match
const RANK_STYLES: Record<number, { card: string; badge: string; name: string }> = {
    1: {
        card: 'bg-gradient-to-r from-heist-gold/15 via-gray-900/60 to-gray-900/60 border-heist-gold/60 shadow-glow-gold',
        badge: 'bg-gradient-to-br from-heist-gold via-heist-sun to-heist-orange text-heist-black shadow-glow-gold',
        name: 'text-heist-gold',
    },
    2: {
        card: 'bg-gradient-to-r from-heist-cyan/10 via-gray-900/60 to-gray-900/60 border-heist-cyan/40 hover:shadow-glow-cyan',
        badge: 'bg-gradient-to-br from-heist-cyan to-heist-teal/70 text-heist-black shadow-glow-cyan',
        name: 'text-heist-cyan',
    },
    3: {
        card: 'bg-gradient-to-r from-heist-purple/10 via-gray-900/60 to-gray-900/60 border-heist-purple/40 hover:shadow-glow-purple',
        badge: 'bg-gradient-to-br from-heist-purple to-heist-violet text-white shadow-glow-purple',
        name: 'text-heist-purple',
    },
};

interface LeaderboardProps {
    socket: Socket;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ socket }) => {
    const [state, setState] = useState<LeaderboardState | null>(null);

    useEffect(() => {
        socket.emit('get_leaderboard');

        const onUpdate = (newState: LeaderboardState) => {
            setState(newState);
        };

        socket.on('leaderboard_update', onUpdate);
        return () => {
            socket.off('leaderboard_update', onUpdate);
        };
    }, [socket]);

    if (!state) return <div className="min-h-[400px] flex items-center justify-center font-mono animate-pulse text-heist-grey">LOADING DATA...</div>;

    // Sort entries by rank
    const sortedEntries = [...state.entries].sort((a, b) => a.rank - b.rank);

    return (
        <div className="min-h-full flex flex-col items-center py-12 px-4">

            <h2 className="text-4xl font-display tracking-tight leading-none mb-4 heist-title text-heist-light animate-fade-up">
                LEADERBOARD
                <span className="block h-1 w-full rounded-full bg-gradient-to-r from-heist-sun via-heist-pink to-heist-violet mt-2"></span>
            </h2>
            <div className="font-display vi-gradient vi-gradient-animated text-6xl md:text-8xl uppercase tracking-wide mt-4 animate-fade-up stagger-1">
                ROUND {state.round}
            </div>

            <div className="w-full max-w-4xl mt-10">
                <div className="hidden sm:grid grid-cols-12 gap-4 px-5 hud-label text-heist-grey mb-3">
                    <div className="col-span-2">Rank</div>
                    <div className="col-span-5">Crew</div>
                    <div className="col-span-2 text-right">Score</div>
                    <div className="col-span-3 text-right">Status</div>
                </div>

                <ol className="space-y-3">
                    {sortedEntries.map((entry, i) => {
                        const podium = RANK_STYLES[entry.rank];
                        return (
                            <li
                                key={entry.id}
                                className={`group grid grid-cols-12 gap-3 sm:gap-4 items-center p-3 sm:p-4 rounded-2xl border backdrop-blur-md shadow-hud transition-all duration-300 hover:-translate-y-0.5 animate-fade-up ${podium?.card ?? 'bg-gray-900/60 border-white/10 hover:border-heist-pink/40 hover:shadow-glow-pink'}`}
                                style={{ animationDelay: `${120 + i * 60}ms` }}
                            >
                                <div className="col-span-3 sm:col-span-2">
                                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center font-mono text-xl sm:text-2xl font-extrabold tabular transition-transform duration-300 group-hover:scale-105 ${podium?.badge ?? 'bg-white/5 border border-white/10 text-heist-grey group-hover:text-heist-light'}`}>
                                        {entry.rank < 10 ? `0${entry.rank}` : entry.rank}
                                    </div>
                                </div>
                                <div className="col-span-9 sm:col-span-5 min-w-0">
                                    <div className={`text-lg sm:text-xl font-bold font-mono truncate transition-colors ${podium ? podium.name : 'text-heist-light group-hover:text-heist-sun'}`}>{entry.name}</div>
                                    {entry.country && <div className="text-[10px] uppercase tracking-widest text-heist-pink">{entry.country}</div>}
                                </div>
                                <div className="col-span-6 sm:col-span-2 sm:text-right font-mono tabular text-2xl font-extrabold text-heist-money">
                                    {entry.score}
                                </div>
                                <div className="col-span-6 sm:col-span-3 text-right">
                                    <span className={`inline-block rounded-full text-[10px] sm:text-xs font-mono font-bold px-3 py-1 border ${entry.status === 'ELIMINATED' ? 'border-red-500/60 text-red-400 bg-red-900/20' : entry.status === 'COMPLETED' ? 'border-heist-money/60 text-heist-money bg-heist-money/10' : 'border-heist-sun/60 text-heist-sun bg-heist-sun/10'}`}>
                                        {entry.status || 'ACTIVE'}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ol>

                {sortedEntries.length === 0 && (
                    <div className="hud-panel text-center py-12 text-heist-grey font-mono text-sm">
                        NO DATA AVAILABLE // AWAITING UPDATE
                    </div>
                )}
            </div>

            <div className="mt-16 text-xs font-mono text-heist-light/40 text-center">
                GRAND MANAGER // LOS SANTOS
            </div>
        </div>
    );
};

export default Leaderboard;
