import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import { ArrowRight, Lock, UserRound } from 'lucide-react';

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
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

                {/* BRANDING */}
                <div className="hud-panel hud-panel-accent p-8 md:p-12 flex flex-col justify-center animate-fade-up">
                    <h1 className="text-6xl lg:text-8xl font-display tracking-tight leading-[0.9] mb-6 vi-gradient">
                        LOS<br />SANTOS
                    </h1>
                    <span className="block h-1.5 w-32 rounded-full bg-gradient-to-r from-heist-sun via-heist-pink to-heist-violet mb-6"></span>
                    <div className="space-y-2 text-heist-light font-mono text-sm uppercase tracking-widest">
                        <p className="animate-fade-up stagger-2">THE CITY IS OPEN.</p>
                        <p className="animate-fade-up stagger-3">PLAN THE JOB. MOVE THE LOOT.</p>
                        <p className="animate-fade-up stagger-4 text-heist-pink">EVERY MINUTE COSTS YOU.</p>
                    </div>
                    <div className="mt-12 md:mt-24 text-[10px] text-heist-grey/60 font-mono">
                        GRAND MANAGER // LOS SANTOS
                    </div>
                </div>

                {/* LOGIN FORM */}
                <div className="hud-panel p-8 md:p-12 flex flex-col justify-center items-center animate-fade-up stagger-2">
                    <form onSubmit={joinGame} className="w-full max-w-sm space-y-8">
                        <div className="space-y-2">
                            <label htmlFor="alias-input" className="block hud-label text-heist-light mb-2">
                                Crew ID
                            </label>
                            <div className="relative group">
                                <UserRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-heist-grey transition-colors group-focus-within:text-heist-sun pointer-events-none" />
                                <input
                                    id="alias-input"
                                    type="text"
                                    value={alias}
                                    onChange={(e) => setAlias(e.target.value)}
                                    placeholder="TT_BM_X"
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="w-full rounded-xl bg-black/40 border border-white/15 p-4 pl-12 text-lg text-heist-white font-mono tracking-wider placeholder-heist-grey/40 transition-all duration-200 hover:border-white/30 focus:outline-none focus:border-heist-sun focus:bg-black/60 focus:shadow-[0_0_0_4px_rgba(255,177,61,0.15),0_0_15px_rgba(255,177,61,0.35)]"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {alias.toLowerCase() === 'admin' && (
                            <div className="space-y-2 animate-slide-up">
                                <label htmlFor="password-input" className="block hud-label text-heist-pink mb-2">
                                    Security Clearance
                                </label>
                                <div className="relative group">
                                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-heist-pink/70 pointer-events-none" />
                                    <input
                                        id="password-input"
                                        type="password"
                                        className="w-full rounded-xl bg-black/40 border border-heist-pink/60 p-4 pl-12 text-lg font-bold text-heist-white placeholder-heist-pink/30 transition-all duration-200 focus:outline-none focus:border-heist-pink focus:shadow-glow-pink"
                                        placeholder="PASSWORD"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div role="alert" className="rounded-xl bg-heist-pink/15 border border-heist-pink/60 p-4 text-heist-light font-bold text-xs uppercase tracking-widest text-center animate-slide-up">
                                ERROR: {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!alias.trim()}
                            className="btn-sunset w-full py-4 text-base flex items-center justify-center gap-3 group"
                        >
                            START THE JOB
                            <ArrowRight size={18} className="transition-transform duration-200 group-enabled:group-hover:translate-x-1" />
                        </button>
                    </form>

                    <div className="md:hidden text-center mt-8 text-xs font-mono text-heist-grey/60">
                        GRAND MANAGER // LOS SANTOS
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Lobby;
