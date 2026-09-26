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

            <h2 className="text-4xl font-black tracking-tighter leading-none mb-4 glitch-text text-white/50">
                LEADERBOARD
                <span className="block h-1 w-full bg-gray-500/50 mt-2"></span>
            </h2>
            <div className="text-red-500 font-black text-6xl md:text-8xl uppercase tracking-widest animate-pulse mt-4">
                ROUND {state.round}
            </div>

            {/* TABLE */}
            <div className="w-full max-w-4xl glass-dark border border-white/10 p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] mt-8 bg-black/40 backdrop-blur">
                <div className="grid grid-cols-12 gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 border-b border-white/10 pb-4">
                    <div className="col-span-2 text-center">Rank</div>
                    <div className="col-span-6">Identity</div>
                    <div className="col-span-4 text-right">Status</div>
                </div>

                <div className="space-y-4">
                    {sortedEntries.map((entry) => (
                        <div
                            key={entry.id}
                            className={`grid grid-cols-12 gap-4 items-center p-4 border border-white/5 transition-all duration-300 hover:bg-white/5 hover:border-yellow-500/30 hover:shadow-[0_0_15px_rgba(255,215,0,0.1)] group ${entry.rank === 1 ? 'bg-yellow-500/10 border-yellow-500/50' : ''}`}
                        >
                            <div className="col-span-2 text-center font-serif text-3xl font-black text-gray-500 group-hover:text-white transition-colors">
                                {entry.rank < 10 ? `0${entry.rank}` : entry.rank}
                            </div>
                            <div className="col-span-6">
                                <div className="text-xl font-bold font-serif group-hover:text-yellow-400 transition-colors">{entry.name}</div>
                                {entry.country && <div className="text-[10px] uppercase tracking-widest text-gray-500">{entry.country}</div>}
                            </div>
                            <div className="col-span-4 text-right">
                                <span className={`text-xs font-mono px-2 py-1 border ${entry.status === 'ELIMINATED' ? 'border-red-500 text-red-500 bg-red-900/20' : 'border-yellow-500 text-yellow-500 bg-yellow-900/20'}`}>
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

            <div className="mt-16 text-xs font-mono text-gray-500/30 text-center">
                SYS.VER.2.0.4 // MYTH_CORE // PUBLIC_ACCESS
            </div>
        </div>
    );
};

export default Leaderboard;
