import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import type { LeaderboardState } from '../types/game';

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

    if (!state) return <div className="min-h-[400px] flex items-center justify-center font-mono animate-pulse text-gray-500">LOADING DATA...</div>;

    // Sort entries by rank
    const sortedEntries = [...state.entries].sort((a, b) => a.rank - b.rank);

    return (
        <div className="min-h-full flex flex-col items-center py-12">

            <h2 className="text-4xl font-display tracking-tight leading-none mb-4 heist-title text-heist-light">
                LEADERBOARD
                <span className="block h-1 w-full bg-gradient-to-r from-heist-sun via-heist-pink to-heist-violet mt-2"></span>
            </h2>
            <div className="font-display vi-gradient text-6xl md:text-8xl uppercase tracking-wide mt-4">
                ROUND {state.round}
            </div>

            {/* TABLE */}
            <div className="w-full max-w-4xl glass-dark border border-white/10 p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] mt-8 bg-black/40 backdrop-blur">
                <div className="grid grid-cols-12 gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 border-b border-white/10 pb-4">
                    <div className="col-span-2 text-center">Rank</div>
                    <div className="col-span-5">Crew</div>
                    <div className="col-span-2 text-right">Score</div>
                    <div className="col-span-3 text-right">Status</div>
                </div>

                <div className="space-y-4">
                    {sortedEntries.map((entry) => (
                        <div
                            key={entry.id}
                            className={`grid grid-cols-12 gap-4 items-center p-4 border border-white/5 transition-all duration-300 hover:bg-white/5 hover:border-heist-pink/40 hover:shadow-[0_0_15px_rgba(255,45,138,0.15)] group ${entry.rank === 1 ? 'bg-heist-sun/10 border-heist-sun/60' : ''}`}
                        >
                            <div className={`col-span-2 text-center font-display text-3xl transition-colors ${entry.rank === 1 ? 'text-heist-sun' : 'text-gray-400 group-hover:text-white'}`}>
                                {entry.rank < 10 ? `0${entry.rank}` : entry.rank}
                            </div>
                            <div className="col-span-5">
                                <div className="text-xl font-bold font-mono group-hover:text-heist-sun transition-colors">{entry.name}</div>
                                {entry.country && <div className="text-[10px] uppercase tracking-widest text-heist-pink">{entry.country}</div>}
                            </div>
                            <div className="col-span-2 text-right font-mono text-2xl font-bold text-white">
                                {entry.score}
                            </div>
                            <div className="col-span-3 text-right">
                                <span className={`text-xs font-mono px-2 py-1 border ${entry.status === 'ELIMINATED' ? 'border-red-500 text-red-500 bg-red-900/20' : entry.status === 'COMPLETED' ? 'border-heist-teal text-heist-teal bg-heist-teal/10' : 'border-heist-sun text-heist-sun bg-heist-sun/10'}`}>
                                    {entry.status || 'ACTIVE'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {sortedEntries.length === 0 && (
                    <div className="text-center py-12 text-gray-500 font-mono text-sm">
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
