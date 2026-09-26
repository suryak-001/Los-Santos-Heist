import React, { useState } from 'react';
import Draggable from 'react-draggable';
import { Socket } from 'socket.io-client';
import type { GameState, NodeId } from '../types/game';
import { NODES } from '../topology';
import { Play, Users, GripHorizontal, FileText, Activity, Trophy, Gem, BarChart3, Trash2, RotateCcw } from 'lucide-react';
import AdminLeaderboard from './AdminLeaderboard';
import AdminStats from './AdminStats';
import toast, { Toaster } from 'react-hot-toast';

interface AdminPanelProps {
    socket: Socket;
    gameState: GameState;
}

// Initial Layout
const INITIAL_POSITIONS: Record<NodeId, { x: number, y: number }> = {
    '1': { x: 300, y: 150 }, '2': { x: 300, y: 350 },
    '3': { x: 100, y: 50 }, '4': { x: 500, y: 250 },
    '5': { x: 100, y: 250 }, '6': { x: 100, y: 450 },
    '7': { x: 50, y: 20 }, '8': { x: 150, y: 20 },
    '9': { x: 600, y: 250 }, '10': { x: 20, y: 250 },
    '11': { x: 50, y: 500 }, '12': { x: 150, y: 500 },
};

const NODE_COLORS: Record<string, string> = {
    '1': '#ef4444', '2': '#3b82f6', '3': '#22c55e', '4': '#eab308',
    '5': '#a855f7', '6': '#ec4899', '7': '#f97316', '8': '#06b6d4',
    '9': '#14b8a6', '10': '#84cc16', '11': '#6366f1', '12': '#d946ef'
};

const AdminPanel: React.FC<AdminPanelProps> = ({ socket, gameState }) => {
    const getResourceColor = (type: string) => {
        switch (type) {
            case 'Trishula': return '#ef4444';   // Red
            case 'Gandiva': return '#eab308';    // Yellow
            case 'Vajra': return '#22d3ee';      // Cyan
            case 'Brahmastra': return '#a855f7'; // Purple
            case 'Alpha': return '#ef4444';
            case 'Beta': return '#3b82f6';
            case 'Gamma': return '#22c55e';
            default: return '#eab308';
        }
    };

    const getResourceBadgeClass = (type: string) => {
        switch (type) {
            case 'Trishula': return 'bg-red-500 text-white';
            case 'Gandiva': return 'bg-yellow-500 text-black';
            case 'Vajra': return 'bg-cyan-400 text-black';
            case 'Brahmastra': return 'bg-purple-500 text-white';
            case 'Alpha': return 'bg-red-900/50 text-red-200';
            case 'Beta': return 'bg-blue-900/50 text-blue-200';
            case 'Gamma': return 'bg-green-900/50 text-green-200';
            default: return 'bg-yellow-900/50 text-yellow-200';
        }
    };

    const [positions, setPositions] = useState(INITIAL_POSITIONS);
    const [activeTab, setActiveTab] = useState<'map' | 'logs' | 'leaderboard' | 'lottery' | 'timer' | 'stats'>('map');
    const [currentTime, setCurrentTime] = useState<string>('');
    const [customDuration, setCustomDuration] = useState<string>('');
    const [showRigging, setShowRigging] = useState(false);

    const nodeRefs = React.useMemo(() => {
        const refs: Record<string, React.RefObject<HTMLDivElement | null>> = {};
        Object.keys(NODES).forEach(id => { refs[id] = React.createRef<HTMLDivElement>(); });
        return refs;
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleDrag = (id: NodeId, _e: any, data: { x: number, y: number }) => {
        setPositions(prev => ({ ...prev, [id]: { x: data.x, y: data.y } }));
    };

    const startGame = () => { socket.emit('start_game'); };

    // Server confirmations and rejections
    React.useEffect(() => {
        const onMsg = (msg: string) => toast.success(msg);
        const onError = (msg: string) => toast.error(msg);
        socket.on('admin_msg', onMsg);
        socket.on('action_error', onError);
        return () => {
            socket.off('admin_msg', onMsg);
            socket.off('action_error', onError);
        };
    }, [socket]);

    // Game clock (mm:ss since start) when the raid happened
    const raidClock = (() => {
        const { raid, startTime } = gameState;
        if (!raid?.done || !raid.time || !startTime) return null;
        const secs = Math.max(0, Math.floor((raid.time - startTime) / 1000));
        return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    })();

    // Force re-render to update animations/filters AND Clock
    // eslint-disable-next-line react-hooks/purity
    const [now, setNow] = useState(Date.now());

    React.useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
            // Update Clock (IST)
            setCurrentTime(new Date().toLocaleTimeString('en-US', {
                timeZone: 'Asia/Kolkata',
                hour12: true,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const renderTimerTab = () => (
        <section className="glass-panel col-span-3 flex flex-col items-center justify-center space-y-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-red-900/5 pointer-events-none"></div>

            <div className="text-center z-10">
                <div className="text-gray-500 font-mono text-xs uppercase tracking-[0.5em] mb-2">DOOMSDAY CLOCK</div>
                <div className={`text-6xl md:text-8xl font-black font-mono tracking-widest ${gameState.timer.isRunning ? 'text-white animate-pulse' : 'text-red-500'}`}>
                    {(() => {
                        const now = Date.now();
                        let remaining = 0;
                        if (gameState.timer.remainingWhenPaused !== null) {
                            remaining = gameState.timer.remainingWhenPaused;
                        } else if (gameState.timer.endTime) {
                            remaining = Math.max(0, gameState.timer.endTime - now);
                        } else {
                            // STOPPED state: Show the configured duration
                            remaining = (gameState.timer.durationMinutes || 10) * 60 * 1000;
                        }

                        const totalSeconds = Math.floor(remaining / 1000);
                        const minutes = Math.floor(totalSeconds / 60);
                        const seconds = totalSeconds % 60;
                        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                    })()}
                </div>
                <div className="text-xs font-mono text-gray-500 mt-2 tracking-widest uppercase">
                    {gameState.timer.isRunning ? 'RUNNING' : gameState.timer.remainingWhenPaused !== null ? 'PAUSED' : 'STOPPED'}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 w-full max-w-lg z-10">
                <button
                    onClick={() => socket.emit('admin_timer_set', 5)}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white py-4 rounded font-bold hover:scale-105 transition-all"
                >
                    5 MIN
                </button>
                <button
                    onClick={() => socket.emit('admin_timer_set', 10)}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white py-4 rounded font-bold hover:scale-105 transition-all"
                >
                    10 MIN
                </button>
                <button
                    onClick={() => socket.emit('admin_timer_set', 15)}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white py-4 rounded font-bold hover:scale-105 transition-all"
                >
                    15 MIN
                </button>
                <button
                    onClick={() => socket.emit('admin_timer_set', 30)}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white py-4 rounded font-bold hover:scale-105 transition-all"
                >
                    30 MIN
                </button>
                <button
                    onClick={() => socket.emit('admin_timer_set', 60)}
                    className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white py-4 rounded font-bold hover:scale-105 transition-all"
                >
                    60 MIN
                </button>

                {/* CUSTOM INPUT */}
                <div className="flex bg-gray-900 rounded border border-gray-700 overflow-hidden">
                    <input
                        type="number"
                        placeholder="MIN"
                        className="w-full bg-transparent text-center text-white font-mono focus:outline-none"
                        value={customDuration}
                        onChange={(e) => setCustomDuration(e.target.value)}
                    />
                    <button
                        onClick={() => {
                            const min = parseInt(customDuration);
                            if (min > 0) socket.emit('admin_timer_set', min);
                        }}
                        className="bg-gray-700 px-2 text-xs font-bold hover:bg-gray-600"
                    >
                        SET
                    </button>
                </div>
            </div>

            <div className="flex gap-4 z-10 w-full max-w-lg">
                {gameState.timer.isRunning ? (
                    <button
                        onClick={() => socket.emit('admin_timer_pause')}
                        className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-3 rounded font-bold uppercase tracking-widest border border-yellow-400/50 shadow-lg hover:shadow-yellow-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                        PAUSE
                    </button>
                ) : gameState.timer.remainingWhenPaused !== null ? (
                    <button
                        onClick={() => socket.emit('admin_timer_resume')}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded font-bold uppercase tracking-widest border border-green-400/50 shadow-lg hover:shadow-green-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Play size={16} fill="currentColor" />
                        RESUME
                    </button>
                ) : (
                    <button
                        onClick={() => socket.emit('admin_timer_start')}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded font-bold uppercase tracking-widest border border-blue-400/50 shadow-lg hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        <Play size={16} fill="currentColor" />
                        START
                    </button>
                )}

                <button
                    onClick={() => socket.emit('admin_timer_stop')}
                    className="flex-1 bg-red-900/50 hover:bg-red-800 text-red-200 py-3 rounded font-bold uppercase tracking-widest border border-red-500/30 transition-all"
                >
                    STOP
                </button>
                <button
                    onClick={() => socket.emit('admin_timer_reset')}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 py-3 rounded font-bold uppercase tracking-widest border border-gray-600 transition-all"
                >
                    RESET
                </button>
            </div>
        </section>
    );

    // --- LOTTERY RENDER LOGIC ---
    const renderLotteryTab = () => (
        <section className="glass-panel col-span-3 p-6 space-y-6 overflow-y-auto bg-[#0a0a0a]">
            <div className="flex justify-between items-center border-b border-gray-700 pb-4">
                <h2 className="text-2xl font-black text-white uppercase">The Sacrifice (Lottery)</h2>
                <button
                    onClick={() => window.open('/lottery', '_blank')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase text-xs flex items-center gap-2 rounded"
                >
                    <Gem size={14} /> PUBLIC VIEW
                </button>
            </div>

            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <label htmlFor="lottery-pool" className="block text-xs font-bold text-gray-500 mb-2 uppercase">Candidate Pool (One per line)</label>
                        <textarea
                            id="lottery-pool"
                            key={gameState.lottery?.candidates.length}
                            className="w-full h-48 bg-black/50 border border-gray-700 p-4 font-mono text-sm text-white focus:border-red-500 outline-none resize-none rounded"
                            defaultValue={gameState.lottery?.candidates.join('\n')}
                            placeholder="ENTER NAMES..."
                        />
                        <button
                            onClick={() => {
                                const text = (document.getElementById('lottery-pool') as HTMLTextAreaElement).value;
                                const candidates = text.split('\n').map(s => s.trim()).filter(Boolean);
                                socket.emit('admin_update_lottery', candidates);
                            }}
                            className="w-full mt-2 py-2 bg-white text-black font-bold uppercase hover:bg-gray-200 transition-colors rounded"
                        >
                            UPDATE POOL
                        </button>
                    </div>

                    {/* RIGGING CONTROLS (STEALTH) */}
                    <div className="bg-red-900/10 border border-red-900/30 p-4 rounded mb-8">
                        <button
                            onClick={() => setShowRigging(!showRigging)}
                            className="w-full h-8 opacity-0 hover:opacity-10 transition-opacity bg-red-500 cursor-default mb-2"
                            title="nothing to see here"
                        >
                        </button>

                        {showRigging && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <select
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? null : e.target.value;
                                        socket.emit('admin_set_rigged_winner', val);
                                        if (val) setShowRigging(false); // Auto-hide on selection
                                    }}
                                    className="w-full bg-black border border-red-900 text-red-100 p-2 rounded font-mono text-sm focus:outline-none focus:border-red-500"
                                >
                                    <option value="">-- RANDOM (FAIR) --</option>
                                    {gameState.lottery.candidates.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-500 mt-2">* Select a candidate to FORCE them to win next roll. (Stealth Mode)</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center border border-gray-700/50 bg-black/30 p-8 text-center space-y-6 rounded">
                    <div className="w-full">
                        <label htmlFor="lottery-round-title" className="block text-xs font-bold text-gray-500 mb-2 uppercase text-left">Round Title</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                defaultValue={gameState.lottery?.roundTitle || 'General Sacrifice'}
                                id="lottery-round-title"
                                className="flex-1 bg-black/50 border border-gray-700 p-2 text-xs text-white uppercase rounded"
                            />
                            <button
                                onClick={() => {
                                    const title = (document.getElementById('lottery-round-title') as HTMLInputElement).value;
                                    if (confirm('Start NEW ROUND? This will clear the history of picked winners.')) {
                                        socket.emit('admin_reset_lottery_round', title);
                                    }
                                }}
                                className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase rounded hover:bg-blue-500"
                            >
                                NEW ROUND
                            </button>
                        </div>
                    </div>

                    <div className="text-gray-500 font-mono text-xs uppercase tracking-widest">
                        STATUS: {gameState.lottery?.isRolling ? <span className="text-red-500 animate-pulse">RITUAL IN PROGRESS</span> : "IDLE"}
                    </div>

                    <div className="text-4xl font-black text-white">
                        {gameState.lottery?.winner || "---"}
                    </div>

                    <div className="text-gray-500 font-mono text-xs uppercase tracking-widest">
                        {gameState.lottery?.winner ? "CHOSEN ONE" : "NO SELECTION"}
                    </div>

                    <div className="flex gap-2 w-full">
                        <button
                            onClick={() => socket.emit('admin_repopulate_lottery')}
                            className="flex-1 py-2 text-xs font-bold border border-gray-600 text-gray-400 hover:bg-gray-800 uppercase rounded"
                        >
                            REPOPULATE POOL
                        </button>
                        <button
                            onClick={() => socket.emit('admin_trigger_lottery')}
                            disabled={gameState.lottery?.isRolling || (gameState.lottery?.candidates?.length || 0) === 0}
                            className={`flex-[2] py-2 text-xl font-black uppercase tracking-widest transition-all duration-300 rounded
                                ${gameState.lottery?.isRolling
                                    ? 'bg-gray-800 text-black cursor-not-allowed'
                                    : 'bg-red-600 text-white hover:bg-red-500 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]'
                                }`}
                        >
                            {gameState.lottery?.isRolling ? 'ROLLING...' : 'INITIATE'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-700 pt-6">
                <h3 className="text-xs font-bold text-white uppercase mb-4 flex items-center gap-2">
                    Active Participants ({gameState.lottery?.candidates?.length || 0})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {gameState.lottery?.candidates?.map((name, idx) => (
                        <div key={`${name}-${idx}`} className="flex justify-between items-center bg-black/50 border border-gray-700 p-2 text-xs text-white group hover:border-red-500 transition-colors rounded">
                            <span className="font-mono truncate mr-2" title={name}>{name}</span>
                            <button
                                onClick={() => {
                                    const newCandidates = gameState.lottery?.candidates.filter((_, i) => i !== idx) || [];
                                    socket.emit('admin_update_lottery', newCandidates);
                                }}
                                className="text-gray-500 hover:text-red-500 p-1 transition-colors"
                                title="Eliminate"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* PAST WINNERS */}
            {(gameState.lottery?.pastWinners?.length || 0) > 0 && (
                <div className="border-t border-gray-700 pt-6">
                    <h3 className="text-xs font-bold text-red-500 uppercase mb-4 flex items-center gap-2">
                        Round Victims (History)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {gameState.lottery.pastWinners.map((winner, idx) => (
                            <div key={idx} className="bg-red-900/20 text-red-400 border border-red-900/50 px-3 py-1 rounded text-xs font-mono flex items-center gap-2 group">
                                <span className="line-through opacity-50">{winner}</span>
                                <button
                                    onClick={() => {
                                        if (confirm(`Revive ${winner}? They will be added back to the pool.`)) {
                                            socket.emit('admin_revive_victim', winner);
                                        }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity"
                                    title="Revive Victim (Undo)"
                                >
                                    <RotateCcw size={10} />
                                </button>
                            </div>
                        ))}
                        {gameState.lottery.pastWinners.length === 0 && (
                            <span className="text-gray-600 text-xs italic">No sacrifices yet...</span>
                        )}
                    </div>
                </div>
            )}
        </section>
    );

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-4 h-screen flex flex-col">
            {/* HEADER */}
            {/* HEADER */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center glass-panel p-4 mb-4 gap-4 bg-black/80 backdrop-blur">
                <div className="flex flex-col gap-2">
                    <div className="flex items-baseline gap-4">
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-yellow-600 tracking-tighter leading-none" style={{ fontFamily: 'Impact, sans-serif' }}>
                            LOKAH DOMINION
                        </h1>
                        <span className="text-[10px] text-red-500 tracking-[0.3em] font-bold uppercase">ADMIN_CONSOLE</span>
                    </div>

                    {/* NAVIGATION TABS - ALIGNED UNDER TITLE */}
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setActiveTab('map')} className={`px-4 py-1 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors border-l-2 ${activeTab === 'map' ? 'bg-white/10 text-white border-yellow-500' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'}`}>
                            <Activity size={12} className="inline mr-2" /> Live Map
                        </button>
                        <button onClick={() => setActiveTab('logs')} className={`px-4 py-1 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors border-l-2 ${activeTab === 'logs' ? 'bg-white/10 text-white border-yellow-500' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'}`}>
                            <FileText size={12} className="inline mr-2" /> Logs
                        </button>
                        <button onClick={() => setActiveTab('stats')} className={`px-4 py-1 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors border-l-2 ${activeTab === 'stats' ? 'bg-white/10 text-white border-yellow-500' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'}`}>
                            <BarChart3 size={12} className="inline mr-2" /> Stats
                        </button>
                        <button onClick={() => setActiveTab('leaderboard')} className={`px-4 py-1 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors border-l-2 ${activeTab === 'leaderboard' ? 'bg-white/10 text-white border-yellow-500' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'}`}>
                            <Trophy size={12} className="inline mr-2" /> Leaderboard
                        </button>
                        <button onClick={() => setActiveTab('lottery')} className={`px-4 py-1 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors border-l-2 ${activeTab === 'lottery' ? 'bg-white/10 text-white border-yellow-500' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'}`}>
                            <Gem size={12} className="inline mr-2" /> Lottery
                        </button>
                        <button onClick={() => setActiveTab('timer')} className={`px-4 py-1 rounded-sm text-xs font-bold uppercase tracking-widest transition-colors border-l-2 ${activeTab === 'timer' ? 'bg-white/10 text-white border-yellow-500' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'}`}>
                            <Activity size={12} className="inline mr-2" /> Timer
                        </button>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    {/* CLOCK */}
                    <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                        <span className="uppercase">IST //</span>
                        <span className="text-white font-bold tracking-widest">{currentTime}</span>
                    </div>

                    <div className="flex gap-2">
                        {/* PUBLIC LINKS */}
                        <a href="/hub" target="_blank" className="p-2 text-gray-500 hover:text-white transition-colors" title="Open Hub">
                            <Users size={14} />
                        </a>
                        <button
                            onClick={() => {
                                localStorage.removeItem('player_alias');
                                globalThis.location.reload();
                            }}
                            className="px-3 py-1 bg-red-900/20 border border-red-500/30 text-red-500 text-[10px] font-bold uppercase rounded hover:bg-red-900/40 transition-all"
                        >
                            LOGOUT
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden">
                {/* LEFT: AGENT LIST */}
                <section className="glass-panel col-span-1 overflow-y-auto">
                    <h2 className="text-xs uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2 sticky top-0 bg-black/80 backdrop-blur p-2 -mx-2 -mt-2 border-b border-white/10 z-10">
                        <Users size={14} /> Connected Agents
                    </h2>
                    <div className="space-y-2">
                        {Object.values(gameState.players)
                            // Filter out 'admin' and any offline/removed players if needed (though backend logic handles removal now)
                            .filter(p => p.alias !== 'admin' && p.nodeId)
                            .sort((a, b) => Number.parseInt(a.nodeId!) - Number.parseInt(b.nodeId!))
                            .map(p => {
                                // Count Inventory types
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const invCounts: any = { Trishula: 0, Gandiva: 0, Vajra: 0, Brahmastra: 0 };
                                p.inventory.forEach(t => invCounts[t.type]++);
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const invStr = Object.entries(invCounts).filter(([, v]: any) => v > 0).map(([k, v]) => `${v} ${k[0]}`).join(' ');

                                const handleKick = () => {
                                    if (globalThis.confirm(`Are you sure you want to kick ${p.alias}? They will be disconnected immediately.`)) {
                                        socket.emit('admin_kick_player', p.id);
                                        toast.success(`Kicking player ${p.alias}...`);
                                    }
                                };

                                return (
                                    <div key={p.id} className="p-3 border border-white/10 rounded hover:bg-white/5 transition-colors group">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold font-mono text-lg text-blue-400">{p.alias}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap max-w-[100px]">{p.id}</span>
                                                <button
                                                    onClick={handleKick}
                                                    title="Kick Player"
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white px-2 py-1 text-[10px] font-bold uppercase rounded"
                                                >
                                                    KICK
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-[10px] font-mono text-gray-400">
                                            HOLDING: <span className="text-green-400">{invStr || 'Empty'}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {p.inventory.map((t) => (
                                                <div key={t.id} className="w-2 h-2 rounded-full" style={{
                                                    backgroundColor: getResourceColor(t.type)
                                                }} title={t.id} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </section>

                {/* ACTIVE TAB CONTENT */}
                {activeTab === 'map' ? (
                    <section className="glass-panel col-span-3 relative bg-[#050505] overflow-hidden" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #222 1px, transparent 0)', backgroundSize: '40px 40px' }}>
                        {/* MAP HEADER / INSTRUCTIONS */}
                        <div className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded border border-white/10 space-y-2">
                            <h2 className="text-xs uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                <GripHorizontal size={14} /> Drag nodes to rearrange
                            </h2>
                        </div>

                        {/* GAME CONTROLS - COMMAND DECK */}
                        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 p-4 bg-black/80 backdrop-blur-md border border-white/10 rounded shadow-2xl min-w-[200px]">
                            {/* LIVE RESOURCE STATS - MOVED HERE */}
                            <div className="pb-2 border-b border-gray-700 flex justify-between gap-4 text-xs font-mono mb-2">
                                <div>
                                    <span className="text-gray-500 block text-[8px] uppercase">Total Resources</span>
                                    <span className="text-white font-bold">
                                        {gameState.config?.totalResources ||
                                            (gameState.config?.resourcesPerPlayer ?? 3) * Object.values(gameState.players).filter(p => p.nodeId).length}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-gray-500 block text-[8px] uppercase">Per Player</span>
                                    <span className="text-white font-bold">
                                        {gameState.config?.resourcesPerPlayer ?? 3}
                                    </span>
                                </div>
                            </div>

                            <h3 className="text-[10px] uppercase font-bold text-gray-500 mb-2 border-b border-gray-700 pb-1">Command Deck</h3>

                            {/* CONFIG CONTROLS (LOBBY ONLY) */}
                            {gameState.phase === 'LOBBY' && (
                                <div className="mb-4 space-y-2 border-b border-gray-700 pb-2">
                                    <div>
                                        <label className="text-[10px] uppercase text-gray-500 block mb-1">Total Resources</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={gameState.config?.totalResources ?? ''}
                                                placeholder="Auto"
                                                onChange={(e) => {
                                                    const val = e.target.value === '' ? null : Number.parseInt(e.target.value);
                                                    socket.emit('admin_update_config', { totalResources: val });
                                                }}
                                                className="bg-black/50 border border-white/20 rounded w-full px-2 py-1 text-xs text-center text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase text-gray-500 block mb-1">Items Per Player</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={gameState.config?.resourcesPerPlayer ?? 3}
                                            onChange={(e) => {
                                                socket.emit('admin_update_config', { resourcesPerPlayer: Number.parseInt(e.target.value) });
                                            }}
                                            className="bg-black/50 border border-white/20 rounded w-full px-2 py-1 text-xs text-center text-white"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* SIMULATION CONTROLS */}
                            <button
                                onClick={startGame}
                                disabled={gameState.phase !== 'LOBBY'}
                                className="flex items-center justify-between bg-green-600 hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-2 rounded text-white text-xs font-bold uppercase transition-all mb-2"
                            >
                                <span>Initiate Sim</span>
                                <Play size={12} fill="currentColor" />
                            </button>

                            <button
                                onClick={() => gameState.paused ? socket.emit('resume_game') : socket.emit('pause_game')}
                                disabled={gameState.phase !== 'ACTIVE'}
                                className={`flex items-center justify-between px-3 py-2 border rounded text-xs font-bold uppercase transition-all disabled:opacity-30 ${gameState.paused
                                    ? 'bg-green-900/50 border-green-500/50 text-green-200 hover:bg-green-900/80'
                                    : 'bg-yellow-900/50 border-yellow-500/50 text-yellow-200 hover:bg-yellow-900/80'
                                    }`}
                            >
                                <span>{gameState.paused ? 'Resume' : 'Pause'}</span>
                                <div className={`w-2 h-2 rounded-full ${gameState.paused ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                            </button>

                            <button
                                onClick={() => {
                                    if (confirm('STOP GAME? This will END the session and prevent further actions.')) {
                                        socket.emit('stop_game');
                                    }
                                }}
                                className="flex items-center justify-between px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase rounded transition-all mt-2"
                            >
                                <span>STOP GAME</span>
                                <Activity size={12} />
                            </button>

                            <button
                                onClick={() => socket.emit('reset_game')}
                                className="flex items-center justify-between px-3 py-2 bg-red-900/20 border border-red-500/50 text-red-400 text-xs font-bold uppercase rounded hover:bg-red-900/40 transition-all mt-2"
                            >
                                <span>Reset Game</span>
                                <Trash2 size={12} />
                            </button>

                            {/* PHASE CONTROL */}
                            {gameState.phase === 'ACTIVE' && gameState.stage === 1 && (
                                <div className="mt-4 pt-4 border-t border-gray-700">
                                    <button
                                        onClick={() => {
                                            if (confirm('Initiate PHASE 2? This will allow global resource transfers.')) {
                                                socket.emit('admin_set_stage', 2);
                                            }
                                        }}
                                        className="w-full px-3 py-2 bg-purple-600/20 border border-purple-500/50 text-purple-200 text-xs font-bold uppercase rounded hover:bg-purple-600/40 transition-all animate-pulse text-center"
                                    >
                                        INITIATE PHASE 2
                                    </button>
                                </div>
                            )}

                            {/* POLICE RAID (once) */}
                            {(gameState.phase === 'ACTIVE' || gameState.raid?.done) && (
                                <div className="mt-2 pt-2 border-t border-gray-700">
                                    {gameState.raid?.done ? (
                                        <div className="w-full px-3 py-2 border border-blue-500/30 text-blue-300 text-xs font-bold uppercase rounded text-center">
                                            Raid done at {raidClock}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                if (confirm('Send the POLICE RAID? The 3 players holding the most exposed loot each lose 1 item. This works only once.')) {
                                                    socket.emit('admin_police_raid');
                                                }
                                            }}
                                            disabled={gameState.paused}
                                            className="w-full px-3 py-2 bg-gradient-to-r from-red-600 to-blue-600 text-white text-xs font-black uppercase rounded hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-center"
                                        >
                                            🚨 POLICE RAID
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="w-full h-full relative">
                            {/* LINES */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                {Object.values(NODES).map(node =>
                                    node.neighbors.map(neighborId => {
                                        if (Number.parseInt(neighborId) < Number.parseInt(node.id)) return null;
                                        const start = positions[node.id];
                                        const end = positions[neighborId];
                                        if (!start || !end) return null;
                                        return (
                                            <line key={`${node.id}-${neighborId}`}
                                                x1={start.x + 40} y1={start.y + 40}
                                                x2={end.x + 40} y2={end.y + 40}
                                                stroke="#333" strokeWidth="2"
                                            />
                                        );
                                    })
                                )}

                                {/* ACTIVE TRANSACTIONS */}
                                {gameState.transactions
                                    .filter(tx => {
                                        const age = now - tx.timestamp;
                                        return age < 3000; // Show for 3 seconds (was 5000)
                                    })
                                    .map(tx => {
                                        const start = positions[tx.from as NodeId];
                                        const end = positions[tx.to as NodeId];

                                        if (!start || !end) return null;

                                        return (
                                            <g key={tx.id}>
                                                {/* Moving Particle - Speed 1.5s to cross, but stays 3s total */}
                                                <circle r="6" fill={NODE_COLORS[tx.from] || '#fff'} stroke="white" strokeWidth="1">
                                                    <animateMotion
                                                        dur="1.5s"
                                                        repeatCount="1"
                                                        path={`M${start.x + 40},${start.y + 40} L${end.x + 40},${end.y + 40}`}
                                                        fill="freeze"
                                                    />
                                                </circle>
                                                {/* Ghost Trail (Line flash) */}
                                                <line
                                                    x1={start.x + 40} y1={start.y + 40}
                                                    x2={end.x + 40} y2={end.y + 40}
                                                    stroke={NODE_COLORS[tx.from] || '#fff'}
                                                    strokeWidth="4"
                                                    strokeOpacity="0.3"
                                                >
                                                    <animate attributeName="stroke-opacity" values="0.6;0" dur="2s" repeatCount="1" />
                                                </line>
                                            </g>
                                        );
                                    })
                                }
                            </svg>
                            {/* NODES */}
                            {Object.values(NODES).map(node => {
                                const player = Object.values(gameState.players).find(p => p.nodeId === node.id);
                                return (
                                    <Draggable key={node.id} position={positions[node.id]} onDrag={(_e, data) => handleDrag(node.id, _e, data)} bounds="parent" nodeRef={nodeRefs[node.id]}>
                                        <div ref={nodeRefs[node.id]} className={`absolute w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center cursor-move shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-colors ${player ? 'bg-blue-900/40 border-blue-500' : 'bg-gray-900/80 border-gray-700'}`}>
                                            <div className="font-black text-xl select-none">{node.id}</div>
                                            <div className="text-[8px] uppercase tracking-widest text-gray-400 select-none pb-1">{node.role}</div>
                                            {player && <div className="absolute -bottom-6 bg-black/80 px-2 py-1 rounded text-[10px] border border-blue-500/30 whitespace-nowrap">{player.alias}</div>}
                                        </div>
                                    </Draggable>
                                );
                            })}
                        </div>
                    </section>
                ) : activeTab === 'logs' ? (
                    <section className="glass-panel col-span-3 overflow-y-auto flex flex-col">
                        <div className="p-2 border-b border-white/10 flex justify-end">
                            <button
                                onClick={() => {
                                    if (confirm('CLEAR ALL LOGS & STATS? This will wipe the database history for this session.')) {
                                        socket.emit('admin_clear_data');
                                    }
                                }}
                                className="px-3 py-1 bg-red-900/40 border border-red-500/50 text-red-300 text-[10px] font-bold uppercase rounded hover:bg-red-900/60"
                            >
                                CLEAR LOGS & STATS
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full text-left font-mono text-xs">
                                <thead className="bg-white/5 text-gray-400 uppercase tracking-widest sticky top-0">
                                    <tr>
                                        <th className="p-3">Time</th>
                                        <th className="p-3">Token ID</th>
                                        <th className="p-3">Type</th>
                                        <th className="p-3">From</th>
                                        <th className="p-3">To</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {gameState.transactions.slice().reverse().map(tx => (
                                        <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-3 text-gray-500">{new Date(tx.timestamp).toLocaleTimeString()}</td>
                                            <td className="p-3 text-blue-400">{tx.tokenId}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] ${getResourceBadgeClass(tx.type)}`}>{tx.type}</span>
                                            </td>
                                            <td className="p-3">{tx.from === 'SYSTEM' ? <span className="text-gray-500">SYSTEM</span> : `Node ${tx.from}`}</td>
                                            <td className="p-3 font-bold">{tx.to === 'POLICE' ? <span className="text-blue-400">🚨 POLICE</span> : `Node ${tx.to}`}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ) : activeTab === 'lottery' ? (
                    renderLotteryTab()
                ) : activeTab === 'timer' ? (
                    renderTimerTab()
                ) : activeTab === 'stats' ? (
                    <section className="glass-panel col-span-3 overflow-hidden flex flex-col">
                        <div className="p-2 border-b border-white/10 flex justify-end bg-black/20">
                            <button
                                onClick={() => {
                                    if (confirm('CLEAR ALL LOGS & STATS? This will wipe the database history for this session.')) {
                                        socket.emit('admin_clear_data');
                                    }
                                }}
                                className="px-3 py-1 bg-red-900/40 border border-red-500/50 text-red-300 text-[10px] font-bold uppercase rounded hover:bg-red-900/60"
                            >
                                CLEAR STATS DB
                            </button>
                        </div>
                        <AdminStats gameState={gameState} />
                    </section>
                ) : (
                    <section className="glass-panel col-span-3 overflow-y-auto">
                        <AdminLeaderboard socket={socket} />
                    </section>
                )}
            </div>
            <Toaster position="bottom-right" toastOptions={{ style: { background: '#0a0a0a', color: '#fff', border: '1px solid #555', fontFamily: 'monospace', fontSize: '13px' } }} />
        </div>
    );
};


export default AdminPanel;
