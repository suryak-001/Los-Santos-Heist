import React from 'react';
import { Socket } from 'socket.io-client';

interface HubProps {
    socket: Socket;
    onNavigate: (path: string) => void;
}

const Hub: React.FC<HubProps> = ({ onNavigate }) => {
    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
        e.preventDefault();
        onNavigate(path);
    };

    return (
        <div className="min-h-full flex flex-col items-center justify-center py-20 text-center space-y-8">
            <div className="space-y-2">
                <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-yellow-600 tracking-tighter" style={{ fontFamily: 'Impact, sans-serif' }}>
                    LOKAH DOMINION
                </h1>
                <p className="text-gray-500 font-mono text-xs uppercase tracking-[0.5em]">
                    PUBLIC ACCESS TERMINAL
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full px-8">
                <a href="/leaderboard" onClick={(e) => handleLinkClick(e, '/leaderboard')} className="group p-8 border border-white/10 bg-black/40 hover:bg-white/5 hover:border-yellow-500/50 transition-all rounded flex flex-col items-center gap-4">
                    <div className="p-4 bg-yellow-500/10 rounded-full group-hover:scale-110 transition-transform">
                        <span className="text-2xl">🏆</span>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-widest group-hover:text-yellow-400">LEADERBOARD</h2>
                    <p className="text-xs text-gray-500 font-mono">View current rankings and status</p>
                </a>

                <a href="/lottery" onClick={(e) => handleLinkClick(e, '/lottery')} className="group p-8 border border-white/10 bg-black/40 hover:bg-white/5 hover:border-red-500/50 transition-all rounded flex flex-col items-center gap-4">
                    <div className="p-4 bg-red-500/10 rounded-full group-hover:scale-110 transition-transform">
                        <span className="text-2xl">💎</span>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-widest group-hover:text-red-400">LOTTERY</h2>
                    <p className="text-xs text-gray-500 font-mono">The Sacrifice ritual status</p>
                </a>

                <a href="/timer" onClick={(e) => handleLinkClick(e, '/timer')} className="group p-8 border border-white/10 bg-black/40 hover:bg-white/5 hover:border-green-500/50 transition-all rounded flex flex-col items-center gap-4">
                    <div className="p-4 bg-green-500/10 rounded-full group-hover:scale-110 transition-transform">
                        <span className="text-2xl">⏱</span>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-widest group-hover:text-green-400">TIMER</h2>
                    <p className="text-xs text-gray-500 font-mono">Doomsday Clock display</p>
                </a>
            </div>

            <div className="text-xs text-gray-600 font-mono pt-12">
                SYSTEM STATUS: ONLINE // SECURE CONNECTION
            </div>
        </div>
    );
};

export default Hub;
