import React, { useEffect, useState, useRef } from 'react';
import { Trophy, Activity, Box, Volume2, VolumeX } from 'lucide-react';
import type { GameState } from '../types/game';
import { formatDistricts } from '../topology';

interface PublicLayoutProps {
    gameState: GameState | null;
    children: React.ReactNode;
    activeTab?: 'hub' | 'leaderboard' | 'lottery' | 'timer';
    onNavigate: (path: string) => void;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ gameState, children, activeTab, onNavigate }) => {
    const [isAudioEnabled, setIsAudioEnabled] = useState(() => {
        if (typeof globalThis.localStorage !== 'undefined') {
            return globalThis.localStorage.getItem('audio_enabled') !== 'false';
        }
        return false;
    });
    const audioContextRef = useRef<AudioContext | null>(null);

    const toggleAudio = () => {
        if (!audioContextRef.current) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const AudioContextClass = globalThis.AudioContext || (globalThis as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
        }

        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }

        const nextState = !isAudioEnabled;
        setIsAudioEnabled(nextState);
        globalThis.localStorage.setItem('audio_enabled', String(nextState));
    };

    // Timer Countdown Logic (Local "now" for smooth ticking)
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Derived State
    let timeRemaining = 0;
    if (gameState?.timer?.isRunning && gameState?.timer?.endTime) {
        timeRemaining = Math.max(0, gameState.timer.endTime - now);
    } else if (gameState?.timer?.remainingWhenPaused) {
        timeRemaining = gameState.timer.remainingWhenPaused;
    }

    // Audio Effects Logic
    useEffect(() => {
        if (!isAudioEnabled || !gameState?.timer?.isRunning || !audioContextRef.current || timeRemaining <= 0) return;

        // Tick Sound (Last 10 seconds)
        if (timeRemaining <= 10000 && timeRemaining > 0) {
            const ctx = audioContextRef.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        }
    }, [now, gameState?.timer?.isRunning, timeRemaining, isAudioEnabled]);

    // "Tringgg" Logic (Trigger once when hitting 0)
    useEffect(() => {
        if (isAudioEnabled && gameState?.timer?.isRunning && timeRemaining === 0 && now > 0 && audioContextRef.current) {
            const ctx = audioContextRef.current;

            // Create a "tringgg" sound using multiple oscillators
            const playTone = (freq: number, delay: number, vol: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
                gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 2);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 2);
            };

            // Harmonic "tring"
            playTone(880, 0, 0.2);   // A5
            playTone(1320, 0.05, 0.15); // E6
            playTone(1760, 0.1, 0.1);  // A6
            playTone(440, 0, 0.1);    // A4 bass
        }
    }, [timeRemaining, gameState?.timer?.isRunning, now, isAudioEnabled]);

    const isTimerRunning = gameState?.timer?.isRunning;
    const isCrisis = timeRemaining <= 10000 && isTimerRunning && timeRemaining > 0;

    const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
        e.preventDefault();
        onNavigate(path);
    };

    return (
        <div className={`min-h-screen city-bg text-white font-sans selection:bg-heist-pink selection:text-white flex flex-col transition-colors duration-500 ${isCrisis ? 'animate-pulse' : ''}`}>
            {/* GLOBAL HEADER */}
            <header className="border-b border-heist-pink/30 bg-heist-black/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between relative">

                    {/* TITLE (LEFT) */}
                    <div className="flex-shrink-0 flex flex-col justify-center cursor-pointer" onClick={() => onNavigate('/hub')}>
                        <h1 className="text-2xl md:text-3xl font-display vi-gradient tracking-tight leading-none">
                            LOS SANTOS
                        </h1>
                        <div className="text-[10px] md:text-xs text-heist-pink tracking-[0.3em] font-bold uppercase">
                            PLAN THE JOB
                        </div>
                    </div>

                    {/* NAVIGATION (RIGHT) */}
                    <div className="flex items-center gap-4">
                        {/* Audio Toggle */}
                        <button
                            onClick={toggleAudio}
                            className={`p-2 rounded-full transition-all duration-300 ${isAudioEnabled ? 'text-heist-sun bg-heist-sun/10' : 'text-gray-500 bg-white/5 hover:bg-white/10'}`}
                            title={isAudioEnabled ? "Disable Audio" : "Enable Audio"}
                        >
                            {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                        </button>

                        <nav className="flex items-center gap-1 md:gap-2 border-l border-white/10 pl-4">
                            <a href="/hub" onClick={(e) => handleLinkClick(e, '/hub')} className={`hidden md:flex items-center gap-2 px-3 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab === 'hub' ? 'bg-heist-pink text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                <Box size={14} /> <span className="hidden lg:inline">Hub</span>
                            </a>
                            <a href="/leaderboard" onClick={(e) => handleLinkClick(e, '/leaderboard')} className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab === 'leaderboard' ? 'bg-heist-pink text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                <Trophy size={14} /> <span className="hidden lg:inline">Leaderboard</span>
                            </a>
                            <a href="/timer" onClick={(e) => handleLinkClick(e, '/timer')} className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-bold uppercase transition-colors ${activeTab === 'timer' ? 'bg-heist-pink text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                <Activity size={14} /> <span className="hidden lg:inline">Timer</span>
                            </a>
                        </nav>
                    </div>
                </div>
            </header>

            {/* RAID REPORT (rest of the game after the raid) */}
            {gameState?.raid?.done && (
                <div className="raid-banner text-white text-center py-2 px-4 font-black uppercase tracking-widest text-xs md:text-sm" role="status">
                    🚨 Raid Report: LSPD raided {formatDistricts(gameState.raid.districts)}
                </div>
            )}

            {/* CONTENT */}
            <main className="flex-1 relative overflow-auto">
                {children}
            </main>
        </div>
    );
};

export default PublicLayout;
