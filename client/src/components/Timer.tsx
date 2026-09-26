import React, { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import type { GameState } from '../types/game';

interface TimerProps {
    socket: Socket;
    gameState: GameState | null;
}

const Timer: React.FC<TimerProps> = ({ gameState }) => {
    const [timeRemaining, setTimeRemaining] = useState<number>(0);

    // Countdown logic (Local high-frequency update for smooth visual)
    useEffect(() => {
        const interval = setInterval(() => {
            if (gameState?.timer?.isRunning && gameState?.timer?.endTime) {
                const remaining = Math.max(0, gameState.timer.endTime - Date.now());
                setTimeRemaining(remaining);
            } else if (gameState?.timer?.remainingWhenPaused) {
                setTimeRemaining(gameState.timer.remainingWhenPaused);
            } else {
                setTimeRemaining(0);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [gameState?.timer?.isRunning, gameState?.timer?.endTime, gameState?.timer?.remainingWhenPaused]);

    const formatTime = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    if (!gameState) {
        return (
            <div className="min-h-[400px] flex items-center justify-center font-mono animate-pulse text-gray-500">
                LOADING TIMER...
            </div>
        );
    }

    if (!gameState.timer) {
        return (
            <div className="min-h-[400px] flex items-center justify-center font-mono text-red-500">
                TIMER SYSTEM OFFLINE
            </div>
        );
    }

    const isExpired = timeRemaining === 0 && gameState.timer.isRunning;

    return (
        <div className="min-h-full flex flex-col items-center justify-center relative overflow-hidden py-12">
            {/* BACKGROUND EFFECTS */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at center, #3d1250 0%, transparent 70%)' }}></div>

            {/* TIMER DISPLAY */}
            <div className="z-10 relative">
                <div className={`border-4 py-16 px-16 min-w-[300px] md:min-w-[400px] text-center bg-black/50 backdrop-blur-sm transition-all duration-300 ${isExpired
                    ? 'border-red-600 shadow-[0_0_50px_rgba(255,0,0,0.8)] animate-pulse'
                    : gameState.timer.isRunning
                        ? 'border-heist-pink shadow-[0_0_40px_rgba(255,45,138,0.45)]'
                        : gameState?.timer?.remainingWhenPaused
                            ? 'border-heist-sun/60'
                            : 'border-gray-500/20'
                    }`}>
                    {/* TIME */}
                    <div className={`text-8xl md:text-9xl font-black font-mono leading-none transition-all duration-300 ${isExpired
                        ? 'text-red-500 scale-110'
                        : gameState.timer.isRunning || gameState?.timer?.remainingWhenPaused
                            ? 'text-white'
                            : 'text-gray-500'
                        }`}>
                        {gameState.timer.isRunning || gameState?.timer?.remainingWhenPaused ? formatTime(timeRemaining) : '--:--'}
                    </div>

                    {/* STATUS */}
                    <div className="mt-8 text-xs font-mono text-gray-500/50 tracking-[0.5em] uppercase h-6">
                        {isExpired
                            ? '⚠ TIME EXPIRED ⚠'
                            : gameState.timer.isRunning
                                ? 'COUNTING DOWN...'
                                : gameState?.timer?.remainingWhenPaused
                                    ? 'TIMER PAUSED'
                                    : 'TIMER IDLE'}
                    </div>
                </div>

                {/* PULSE EFFECT ON EXPIRY */}
                {isExpired && (
                    <div className="absolute inset-0 pointer-events-none flex justify-center items-center">
                        <div className="w-full h-[2px] bg-red-500 absolute top-0 animate-ping"></div>
                        <div className="w-full h-[2px] bg-red-500 absolute bottom-0 animate-ping"></div>
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className="absolute bottom-12 text-[10px] text-heist-light/50 font-mono tracking-widest">
                HEIST CLOCK
            </div>
        </div>
    );
};

export default Timer;
