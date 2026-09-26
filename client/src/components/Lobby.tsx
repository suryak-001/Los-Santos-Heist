import React, { useState } from 'react';
import { Socket } from 'socket.io-client';

interface LobbyProps {
    socket: Socket;
}

const Lobby: React.FC<LobbyProps> = ({ socket }) => {
    const [alias, setAlias] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    React.useEffect(() => {
        socket.on('login_error', (msg: string) => {
            setError(msg);
            setTimeout(() => setError(''), 3000);
        });
        return () => { socket.off('login_error'); }
    }, [socket]);

    const joinGame = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (alias.trim()) {
            socket.emit('join', { alias, password });
        }
    };

    return (
        <div className="min-h-screen city-bg flex items-center justify-center p-4">
            <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-0 border border-heist-grey/40">

                {/* BRANDING */}
                <div className="glass-dark p-12 flex flex-col justify-center border-b md:border-b-0 md:border-r border-heist-grey/40">
                    <h1 className="text-6xl lg:text-8xl font-display tracking-tight leading-[0.9] mb-6 vi-gradient">
                        LOS<br />SANTOS
                    </h1>
                    <span className="block h-2 w-32 bg-gradient-to-r from-heist-sun via-heist-pink to-heist-violet mb-6"></span>
                    <div className="space-y-2 text-heist-light font-mono text-sm uppercase tracking-widest">
                        <p>THE CITY IS OPEN.</p>
                        <p>PLAN THE JOB. MOVE THE LOOT.</p>
                        <p className="text-heist-pink">EVERY MINUTE COSTS YOU.</p>
                    </div>
                    <div className="mt-24 text-[10px] text-heist-grey/60 font-mono">
                        GRAND MANAGER // LOS SANTOS
                    </div>
                </div>

                {/* LOGIN FORM */}
                <div className="glass-dark p-12 flex flex-col justify-center items-center">
                    <form onSubmit={joinGame} className="w-full max-w-sm space-y-8">
                        <div className="space-y-2">
                            <label htmlFor="alias-input" className="block text-xs font-bold text-heist-white uppercase tracking-widest mb-2">
                                Crew ID
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-heist-grey animate-pulse">|</span>
                                <input
                                    id="alias-input"
                                    type="text"
                                    value={alias}
                                    onChange={(e) => setAlias(e.target.value)}
                                    placeholder="TT_BM_X"
                                    className="w-full bg-heist-black border border-heist-grey p-4 pl-8 text-heist-white font-mono placeholder-heist-grey/30 focus:border-heist-pink focus:outline-none transition-colors"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {alias.toLowerCase() === 'admin' && (
                            <div className="space-y-2 animate-fade-in">
                                <label htmlFor="password-input" className="block text-xs font-bold uppercase tracking-widest text-heist-pink mb-2">
                                    Security Clearance
                                </label>
                                <input
                                    id="password-input"
                                    type="password"
                                    className="w-full bg-heist-black border-2 border-heist-pink p-4 text-xl font-bold text-heist-white placeholder-red-900 focus:outline-none focus:border-heist-pink transition-colors rounded-none"
                                    placeholder="PASSWORD"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        )}

                        {error && (
                            <div className="bg-heist-pink p-4 text-white font-bold text-xs uppercase tracking-widest text-center">
                                ERROR: {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!alias.trim()}
                            className="w-full bg-heist-pink text-white font-display text-lg uppercase tracking-wide py-4 hover:bg-heist-sun hover:text-heist-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            START THE JOB
                        </button>
                    </form>

                    <div className="lg:hidden text-center mt-8 text-xs font-mono text-heist-grey/60">
                        GRAND MANAGER // LOS SANTOS
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Lobby;
