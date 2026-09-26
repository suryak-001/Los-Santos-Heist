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
        <div className="min-h-screen lokah-bg flex items-center justify-center p-4">
            <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-0 border border-myth-grey/40">

                {/* BRANDING */}
                <div className="glass-dark p-12 flex flex-col justify-center border-b md:border-b-0 md:border-r border-myth-grey/40">
                    <h1 className="text-6xl lg:text-8xl font-black tracking-tighter leading-none mb-6 text-myth-white">
                        SCARCITY
                        <span className="block h-4 w-32 bg-myth-red mt-4"></span>
                    </h1>
                    <div className="space-y-2 text-myth-grey font-mono text-sm uppercase tracking-widest">
                        <p>PROTOCOL INITIATED.</p>
                        <p>RESOURCE SCARCITY: CRITICAL.</p>
                        <p>TRUST IS YOUR ONLY CURRENCY.</p>
                    </div>
                    <div className="mt-24 text-[10px] text-myth-grey/30 font-mono">
                        SYS.VER.2.0.4 // MYTH_CORE
                    </div>
                </div>

                {/* LOGIN FORM */}
                <div className="glass-dark p-12 flex flex-col justify-center items-center">
                    <form onSubmit={joinGame} className="w-full max-w-sm space-y-8">
                        <div className="space-y-2">
                            <label htmlFor="alias-input" className="block text-xs font-bold text-myth-white uppercase tracking-widest mb-2">
                                Identity Verification
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-myth-grey animate-pulse">|</span>
                                <input
                                    id="alias-input"
                                    type="text"
                                    value={alias}
                                    onChange={(e) => setAlias(e.target.value)}
                                    placeholder="TT_BM_X"
                                    className="w-full bg-myth-black border border-myth-grey p-4 pl-8 text-myth-white font-mono placeholder-myth-grey/30 focus:border-myth-red focus:outline-none transition-colors"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {alias.toLowerCase() === 'admin' && (
                            <div className="space-y-2 animate-fade-in">
                                <label htmlFor="password-input" className="block text-xs font-bold uppercase tracking-widest text-myth-red mb-2">
                                    Security Clearance
                                </label>
                                <input
                                    id="password-input"
                                    type="password"
                                    className="w-full bg-myth-black border-2 border-myth-red p-4 text-xl font-bold text-myth-white placeholder-red-900 focus:outline-none focus:border-myth-red transition-colors rounded-none"
                                    placeholder="PASSWORD"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        )}

                        {error && (
                            <div className="bg-myth-red p-4 text-white font-bold text-xs uppercase tracking-widest text-center">
                                ERROR: {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!alias.trim()}
                            className="w-full bg-myth-white text-myth-black font-black uppercase tracking-widest py-4 hover:bg-myth-grey transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ENTER LOKAH
                        </button>
                    </form>

                    <div className="lg:hidden text-center mt-8 text-xs font-mono text-myth-grey/50">
                        SYS.VER.2.0.4 // MYTH_CORE
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Lobby;
