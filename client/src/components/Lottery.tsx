import React, { useEffect, useState, useRef } from 'react';
import type { GameState } from '../types/game';

interface LotteryProps {
    gameState: GameState | null;
}

const Lottery: React.FC<LotteryProps> = ({ gameState }) => {
    const [animatedName, setAnimatedName] = useState<string>('');
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        if (gameState?.lottery?.isRolling) {
            const souls = gameState.lottery.candidates;
            if (souls.length > 0) {
                let lastUpdate = 0;
                const animate = (time: number) => {
                    if (time - lastUpdate > 50) {
                        const randomName = souls[Math.floor(Math.random() * souls.length)];
                        setAnimatedName(randomName);
                        lastUpdate = time;
                    }
                    animationRef.current = requestAnimationFrame(animate);
                };
                animationRef.current = requestAnimationFrame(animate);
            }
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        }

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [gameState?.lottery?.isRolling, gameState?.lottery?.candidates]);

    if (!gameState) return <div className="min-h-[400px] flex items-center justify-center font-display tracking-widest animate-pulse text-gray-500">LOADING DRAW...</div>;
    if (!gameState.lottery) return <div className="min-h-[400px] flex items-center justify-center font-display tracking-widest text-red-500">DRAW NOT READY (Missing State)</div>;

    const { winner, isRolling, candidates } = gameState.lottery;
    const displayCandidate = isRolling ? animatedName : (winner || "AWAITING DRAW");

    const getTextClasses = () => {
        if (isRolling) return 'text-white blur-sm scale-110 skew-x-6 heist-title';
        if (winner) return 'text-red-600 scale-125 drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]';
        return 'text-gray-500';
    };

    const getStatusText = () => {
        if (isRolling) return "FATE IS SEALING...";
        if (winner) return "CHOSEN ONE";
        return `${candidates.length} SOULS IN POOL`;
    };

    return (
        <div className="min-h-full flex flex-col items-center justify-center relative overflow-hidden py-12">
            {/* BACKGROUND EFFECTS */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at center, #330000 0%, #000000 70%)' }}></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 animate-pulse"></div>

            <div className="text-gray-500 font-mono text-xs uppercase tracking-[0.5em] mb-2">{gameState.lottery.roundTitle || 'THE DRAW'}</div>
            <h2 className="text-red-600 text-2xl md:text-3xl font-bold tracking-[1em] mb-8 animate-pulse">
                THE DRAW
            </h2>

            {/* MAIN DISPLAY */}
            <div className="z-10 relative">
                <div className={`border-y-2 border-red-900/50 py-12 px-8 min-w-[300px] md:min-w-[500px] text-center bg-black/50 backdrop-blur-sm transition-all duration-300 ${isRolling ? 'border-white shadow-[0_0_30px_rgba(255,0,0,0.5)]' : 'border-gray-500/20'}`}>

                    {/* CANDIDATE NAME */}
                    <div className={`text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none transition-all duration-100 ${getTextClasses()}`}>
                        {displayCandidate}
                    </div>

                    {/* SUBTEXT */}
                    <div className="mt-6 text-xs font-mono text-gray-500/50 tracking-[0.5em] uppercase h-6">
                        {getStatusText()}
                    </div>
                </div>

                {winner && !isRolling && (
                    <div className="absolute inset-0 pointer-events-none flex justify-center items-center">
                        <div className="w-full h-[1px] bg-red-600 absolute top-0 animate-ping"></div>
                        <div className="w-full h-[1px] bg-red-600 absolute bottom-0 animate-ping"></div>
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className="absolute bottom-12 text-[10px] text-gray-500/30 font-mono tracking-widest">
                LOS SANTOS LOTTERY
            </div>
        </div>
    );
};

export default Lottery;
