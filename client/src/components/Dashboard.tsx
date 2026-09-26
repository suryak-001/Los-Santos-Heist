import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import type { GameState, ResourceType, NodeId, ResourceToken, ChatMessage } from '../types/game';
import { NODES, formatDistricts } from '../topology';
import { Copy, Paperclip, X, Crosshair, MessageCircle, ScrollText, Briefcase, CircleCheck, Send, LogOut, Siren, PhoneCall, MapPin } from 'lucide-react';
import toast, { Toaster, ToastBar, type Toast } from 'react-hot-toast';
import Tutorial from './Tutorial';
import CityMap from './CityMap';
import BonusCountdown from './BonusCountdown';

interface DashboardProps {
    socket: Socket;
    gameState: GameState;
    myId: string;
}

const RESOURCE_TYPES: ResourceType[] = ['Cash', 'Artwork', 'Gold', 'Diamonds'];

const getLootIcon = (type: string) => {
    switch (type) {
        case 'Cash': return '💵';
        case 'Artwork': return '🖼️';
        case 'Gold': return '🪙';
        case 'Diamonds': return '💎';
        default: return '❓';
    }
};

// Hover tint and glow for each loot tile
const getLootTint = (type: string) => {
    switch (type) {
        case 'Cash': return 'bg-heist-money';
        case 'Artwork': return 'bg-heist-purple';
        case 'Gold': return 'bg-heist-gold';
        case 'Diamonds': return 'bg-heist-cyan';
        default: return 'bg-gray-500';
    }
};

const getLootGlow = (type: string) => {
    switch (type) {
        case 'Cash': return 'hover:border-heist-money/70 hover:shadow-glow-money';
        case 'Artwork': return 'hover:border-heist-purple/70 hover:shadow-glow-purple';
        case 'Gold': return 'hover:border-heist-gold/70 hover:shadow-glow-gold';
        case 'Diamonds': return 'hover:border-heist-cyan/70 hover:shadow-glow-cyan';
        default: return 'hover:border-white/40';
    }
};

// How long the raid overlay stays up: 3s of strobe, then the fade out (index.css)
const RAID_OVERLAY_MS = 3750;

// Toasts slide up and fade in from below (keyframes in index.css)
const TOAST_ENTER = 'toast-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both';
const TOAST_EXIT = 'toast-out 0.25s ease-in forwards';

// One chat bubble; loot handovers show up as SYSTEM_TRANSFER|type|id
const ChatBubble: React.FC<{ msg: ChatMessage; isMe: boolean; compact?: boolean }> = ({ msg, isMe, compact }) => (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-slide-up`}>
        <div className={`${compact ? 'max-w-[85%] p-3' : 'max-w-[75%] px-4 py-3'} rounded-2xl border shadow-lg ${isMe
            ? 'bg-heist-light text-heist-black border-heist-light rounded-br-md'
            : 'bg-white/[0.06] text-heist-white border-white/10 rounded-bl-md backdrop-blur-sm'}`}
        >
            <p className="text-sm font-bold leading-relaxed break-words">
                {msg.message.startsWith('SYSTEM_TRANSFER|') ? (() => {
                    const [, type, id] = msg.message.split('|');
                    return (
                        <span>
                            <span className={isMe ? 'text-heist-pink' : 'text-heist-money'}>{isMe ? '📤 HANDED OVER' : '📥 RECEIVED'}</span>
                            <br />
                            <span className={`opacity-75 font-mono ${compact ? 'text-xs' : ''}`}>{type} [{id}]</span>
                        </span>
                    );
                })() : msg.message}
            </p>
            <span className="block text-[9px] font-mono tabular mt-1.5 opacity-50 uppercase">{new Date(msg.timestamp).toLocaleTimeString()}</span>
        </div>
    </div>
);

const Dashboard: React.FC<DashboardProps> = ({ socket, gameState, myId }) => {
    const me = gameState.players[myId];
    const myNode = me?.nodeId ? NODES[me.nodeId] : null;

    const [selectedNeighbor, setSelectedNeighbor] = useState<NodeId | null>(null);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // --- MOBILE STATE ---
    const [showInventoryModal, setShowInventoryModal] = useState(false);
    const [pendingAttachment, setPendingAttachment] = useState<ResourceToken | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showMobileChat, setShowMobileChat] = useState(false);

    // --- TUTORIAL STATE ---
    const [showTutorial, setShowTutorial] = useState(true);

    // --- COMPLETION MODAL ---
    // Shown once per completion: a later re-completion has a new completionTime.
    const [dismissedCompletion, setDismissedCompletion] = useState<number | null>(null);
    const showCompletionModal = !!me?.completionTime && me.completionTime !== dismissedCompletion;

    // --- POLICE RAID ---
    // Counts raids so a second raid restarts the overlay; 0 = hidden
    const [raidFlash, setRaidFlash] = useState(0);
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        const onRaid = ({ districts, seized }: { districts: NodeId[]; seized: { nodeId: NodeId; type: ResourceType }[] }) => {
            setRaidFlash(n => n + 1);
            clearTimeout(timeout);
            timeout = setTimeout(() => setRaidFlash(0), RAID_OVERLAY_MS);
            const mine = seized.find(s => s.nodeId === me?.nodeId);
            if (mine) {
                toast.error(`🚨 LSPD seized your ${mine.type}`, { duration: 6000 });
            } else {
                toast(`🚨 Raid hit ${formatDistricts(districts)}`, { duration: 6000 });
            }
        };
        socket.on('police_raid', onRaid);
        return () => {
            socket.off('police_raid', onRaid);
            clearTimeout(timeout);
        };
    }, [socket, me?.nodeId]);

    // Server rejections (wrong turf, paused game, ...)
    useEffect(() => {
        const onError = (msg: string) => {
            pendingSends.current.clear();
            toast.error(msg);
        };
        socket.on('action_error', onError);
        return () => { socket.off('action_error', onError); };
    }, [socket]);

    // Ticks every second for the live completion bonus
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // --- MOBILE DETECTION ---
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- UNREAD TRACKING ---
    const [lastReadTimestamps, setLastReadTimestamps] = useState<Partial<Record<NodeId, number>>>({});
    const markRead = (...nodeIds: (NodeId | null)[]) => setLastReadTimestamps(prev => {
        const next = { ...prev };
        nodeIds.forEach(nId => { if (nId) next[nId] = Date.now(); });
        return next;
    });

    // --- CHAT PERSISTENCE ---
    const messages = React.useMemo(() => gameState.messages || [], [gameState.messages]);

    const activeNeighbor = selectedNeighbor ? Object.values(gameState.players).find(p => p.nodeId === selectedNeighbor) : null;
    const relevantMessages = selectedNeighbor ? messages.filter(m =>
        (m.senderId === me.id && activeNeighbor?.id && m.receiverId === activeNeighbor.id) ||
        (m.senderId === activeNeighbor?.id && m.receiverId === me.id)
    ) : [];

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, selectedNeighbor]);

    // Track previous stage to detect phase changes
    const prevStageRef = useRef<number>(gameState.stage);
    useEffect(() => {
        if (prevStageRef.current !== gameState.stage) {
            if (gameState.stage === 1) {
                toast.success(`🔫 TURF WAR\nCall anyone, hand loot only to neighbours`, {
                    duration: 3000,
                    position: 'top-right',
                });
            } else if (gameState.stage === 2) {
                toast.success(`🌆 OPEN CITY\nHand loot to anyone`, {
                    duration: 3000,
                    position: 'top-right',
                });
            }
            prevStageRef.current = gameState.stage;
        }
    }, [gameState.stage]);

    // Unread messages per district. The chat currently on screen never counts as unread.
    const viewingNode = selectedNeighbor && (!isMobile || showMobileChat) ? selectedNeighbor : null;
    const unreadCounts = React.useMemo(() => {
        const counts: Partial<Record<NodeId, number>> = {};
        (Object.keys(NODES) as NodeId[]).forEach(nId => {
            if (nId === me?.nodeId || nId === viewingNode) return;
            const other = Object.values(gameState.players).find(p => p.nodeId === nId);
            if (!other) return;
            const lastRead = lastReadTimestamps[nId] || 0;
            const unread = messages.filter(m => m.senderId === other.id && m.receiverId === me?.id && m.timestamp > lastRead).length;
            if (unread > 0) counts[nId] = unread;
        });
        return counts;
    }, [messages, me?.id, me?.nodeId, lastReadTimestamps, gameState.players, viewingNode]);

    // Items handed over, keyed by token id. The success toast waits until the
    // server confirms by removing the item from our inventory.
    const pendingSends = useRef(new Map<string, { type: string; to: NodeId }>());
    useEffect(() => {
        if (!me) return;
        pendingSends.current.forEach((send, tokenId) => {
            if (!me.inventory.some(t => t.id === tokenId)) {
                toast.success(`📤 LOOT HANDED OVER\n${send.type} to ${NODES[send.to].label}`, { duration: 3000, position: 'top-right' });
                pendingSends.current.delete(tokenId);
            }
        });
    }, [me, me?.inventory]);

    // Toast for received resources
    const prevInventoryLength = useRef(me?.inventory.length || 0);
    useEffect(() => {
        if (me && me.inventory.length > prevInventoryLength.current) {
            const newItem = me.inventory.at(-1);
            if (newItem) {
                toast.success(`📥 LOOT RECEIVED\n${newItem.type}`, {
                    duration: 3000,
                    position: 'top-right',
                });
            }
        }
        prevInventoryLength.current = me?.inventory.length || 0;
    }, [me, me?.inventory]);

    if (!me || !myNode) return <div className="p-10 text-center text-heist-grey font-mono animate-pulse">LOADING LOS SANTOS...</div>;

    // Turf War: loot goes only to direct neighbours. Open City: to anyone.
    const canHandTo = (nodeId: NodeId) =>
        nodeId !== me.nodeId && (gameState.stage === 2 || myNode.neighbors.includes(nodeId));
    const OUT_OF_TURF = 'Out of your turf. Hand it to a neighbour to pass it on.';

    const handOver = (token: ResourceToken, targetNodeId: NodeId) => {
        pendingSends.current.set(token.id, { type: token.type, to: targetNodeId });
        socket.emit('transfer_resource', { targetNodeId, tokenId: token.id });
    };

    const openAttach = () => {
        if (selectedNeighbor && !canHandTo(selectedNeighbor)) {
            toast.error(OUT_OF_TURF);
            return;
        }
        setShowInventoryModal(true);
    };

    const sendMessage = () => {
        if (!selectedNeighbor) return;
        const target = Object.values(gameState.players).find(p => p.nodeId === selectedNeighbor);
        if (!target) return;

        if (pendingAttachment) {
            if (!canHandTo(selectedNeighbor)) {
                toast.error(OUT_OF_TURF);
                return;
            }
            handOver(pendingAttachment, selectedNeighbor);
            setPendingAttachment(null);
        }

        if (chatInput.trim()) {
            socket.emit('chat_message', {
                receiverId: target.id,
                message: chatInput.trim()
            });
            setChatInput('');
        }
    };

    const handleDragStart = (e: React.DragEvent, token: ResourceToken) => {
        e.dataTransfer.setData('token', JSON.stringify(token));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetNodeId: NodeId) => {
        e.preventDefault();
        const tokenData = e.dataTransfer.getData('token');
        if (!tokenData) return;
        const token: ResourceToken = JSON.parse(tokenData);
        if (!canHandTo(targetNodeId)) {
            toast.error(OUT_OF_TURF);
            return;
        }
        if (confirm(`Hand ${token.type} to ${NODES[targetNodeId].label}?`)) {
            handOver(token, targetNodeId);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    // --- DERIVED STATE ---
    const myCounts: Record<ResourceType, number> = { Cash: 0, Artwork: 0, Gold: 0, Diamonds: 0 };
    me.inventory.forEach(t => myCounts[t.type]++);
    const isContractMet = RESOURCE_TYPES.every(r => myCounts[r] >= me.contract[r]);

    const selectedCanReceive = selectedNeighbor ? canHandTo(selectedNeighbor) : false;

    const contractTotal = Object.values(me.contract).reduce((a, b) => a + b, 0);
    const selectedPlayer = selectedNeighbor ? Object.values(gameState.players).find(p => p.nodeId === selectedNeighbor) : undefined;

    return (
        <div className="min-h-screen lg:h-screen text-heist-white font-sans p-3 lg:p-6 flex flex-col gap-3 lg:gap-4 lg:overflow-hidden">

            {/* HEADER */}
            <header className="flex flex-col lg:flex-row gap-3 lg:gap-4 shrink-0">
                <div className="hud-panel hud-panel-accent flex-1 px-5 py-4 lg:px-6 animate-fade-up">
                    <h1 className="text-3xl lg:text-5xl font-display uppercase tracking-tight leading-none cursor-default">
                        <span className="vi-gradient">{myNode.label}</span>
                    </h1>
                    <div className="flex items-center justify-between mt-3 gap-3">
                        <span className="flex items-center gap-2 text-sm lg:text-base font-mono font-bold text-heist-grey tracking-widest">
                            <MapPin size={14} className="text-heist-sun" /> {me.alias}
                        </span>
                        <button
                            onClick={() => {
                                if (confirm("LEAVE THE JOB?")) {
                                    localStorage.removeItem('player_alias');
                                    globalThis.location.reload();
                                }
                            }}
                            className="flex items-center gap-1.5 rounded-full text-[10px] bg-heist-pink/10 hover:bg-heist-pink text-heist-pink hover:text-white px-3 py-1.5 uppercase font-bold tracking-widest transition-colors border border-heist-pink/40"
                        >
                            <LogOut size={12} /> Logout
                        </button>
                    </div>
                </div>
                <div className="hud-panel lg:w-80 px-5 py-4 lg:px-6 flex lg:flex-col items-center lg:items-start justify-between lg:justify-center gap-1 animate-fade-up stagger-1">
                    <span className="hud-label text-heist-grey font-mono">Phase {gameState.stage}</span>
                    <span className={`text-2xl lg:text-3xl font-display heist-title uppercase ${gameState.stage === 2 ? 'text-heist-cyan' : 'text-heist-sun'}`}>{gameState.stage === 2 ? 'Open City' : 'Turf War'}</span>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 min-h-0">

                {/* LEFT COLUMN: INVENTORY & CONTRACT */}
                <aside className="col-span-1 lg:col-span-4 flex flex-col gap-3 lg:gap-4 lg:overflow-y-auto lg:pr-1 min-h-0">

                    {/* CONTRACT */}
                    <div id="contract-section" className="hud-panel hud-panel-accent p-4 lg:p-5 shrink-0 animate-fade-up stagger-2">
                        <h2 className="hud-label text-heist-pink flex items-center gap-2">
                            <Crosshair size={14} /> Heist Order
                        </h2>
                        <p className="text-[10px] text-heist-grey/70 uppercase tracking-wide mt-1 mb-4">What you have to collect</p>

                        {contractTotal === 0 ? (
                            <div className="flex flex-col items-center text-center py-6 gap-3">
                                <div className="relative">
                                    <span className="absolute inset-0 rounded-full bg-heist-pink/20 animate-ping" aria-hidden="true" />
                                    <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-heist-pink/25 to-heist-violet/25 border border-heist-pink/40 flex items-center justify-center">
                                        <ScrollText size={24} className="text-heist-pink" />
                                    </div>
                                </div>
                                <div className="text-heist-light text-sm font-mono uppercase tracking-widest">Awaiting the briefing...</div>
                                <div className="text-[10px] text-heist-grey uppercase tracking-wide">Your order arrives when the job starts</div>
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                {RESOURCE_TYPES.map(r => {
                                    const needed = me.contract[r];
                                    if (needed === 0) return null;
                                    const current = myCounts[r];
                                    const met = current >= needed;
                                    return (
                                        <div key={r} className={`relative overflow-hidden rounded-xl p-2.5 lg:p-3 border transition-colors duration-300 ${met ? 'border-heist-money/60 bg-heist-money/10 shadow-glow-money' : 'border-white/10 bg-black/30'}`}>
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xl lg:text-2xl">{getLootIcon(r)}</span>
                                                    <span className={`text-xs lg:text-sm font-bold uppercase ${met ? 'text-heist-white' : 'text-heist-grey'}`}>{r}</span>
                                                </div>
                                                <div className={`flex items-center gap-2 font-mono tabular text-lg lg:text-xl font-bold ${met ? 'text-heist-money' : 'text-heist-grey'}`}>
                                                    {met && <CircleCheck size={16} />}
                                                    {current}/{needed}
                                                </div>
                                            </div>
                                            <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-[width] duration-500 ease-out ${met ? 'bg-heist-money' : getLootTint(r)}`}
                                                    style={{ width: `${Math.min(1, current / needed) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {isContractMet && (
                                    <div className="mt-3 rounded-xl p-3 bg-heist-money/10 border border-heist-money text-heist-money text-center font-bold uppercase text-xs tracking-widest animate-pulse shadow-glow-money">
                                        Ready: Mission Passed
                                    </div>
                                )}
                                {me.completionBonus !== null ? (
                                    <div className="mt-3 rounded-xl border border-heist-money/40 bg-heist-money/10 px-3 py-2 text-xs font-mono uppercase text-heist-light flex justify-between">
                                        Bonus locked in <span className="text-heist-money font-extrabold tabular">+{me.completionBonus}</span>
                                    </div>
                                ) : gameState.phase === 'ACTIVE' && (
                                    <BonusCountdown gameState={gameState} now={now} />
                                )}
                            </div>
                        )}
                    </div>

                    {/* INVENTORY */}
                    <div id="inventory-section" className="hud-panel p-4 lg:p-5 flex-1 min-h-[150px] lg:min-h-[200px] animate-fade-up stagger-3">
                        <h2 className="hud-label text-heist-grey mb-3 lg:mb-4 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2"><Copy size={14} /> Loot</span>
                            <span className="font-mono tabular text-heist-light rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{me.inventory.length}</span>
                        </h2>
                        {me.inventory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center gap-3 py-8 rounded-xl border border-dashed border-white/15 bg-black/20">
                                <Briefcase size={32} strokeWidth={1.5} className="text-heist-grey/70 animate-float" />
                                <div>
                                    <div className="text-heist-grey font-mono text-xs uppercase tracking-[0.3em]">Empty</div>
                                    <div className="text-[10px] text-heist-grey/60 uppercase tracking-wide mt-1">Loot handed to you lands here</div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 lg:grid-cols-3 gap-2">
                                {me.inventory.map((token) => (
                                    <button
                                        type="button"
                                        key={token.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, token)}
                                        className={`aspect-square rounded-xl bg-black/35 border border-white/10 transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-grab active:cursor-grabbing flex flex-col items-center justify-center group relative overflow-hidden animate-slide-up ${getLootGlow(token.type)}`}
                                    >
                                        <span className="text-3xl relative z-10 group-hover:scale-110 transition-transform duration-200">{getLootIcon(token.type)}</span>
                                        <span className="relative z-10 text-[10px] font-bold text-heist-white uppercase mt-1">{token.type}</span>
                                        <span className="relative z-10 text-[8px] font-mono text-heist-grey uppercase">{token.id.split('-')[1]}</span>
                                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity ${getLootTint(token.type)}`}></div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

                {/* RIGHT COLUMN: MAP / COMMS */}
                <main className="col-span-1 lg:col-span-8 flex flex-col xl:flex-row gap-3 lg:gap-4 h-full min-h-0">

                    {/* CITY MAP */}
                    <div id="city-map-section" className="hud-panel p-4 lg:p-5 flex flex-col shrink-0 xl:w-[55%] xl:justify-center animate-fade-up stagger-3">
                        <div className="flex justify-between items-center mb-3 gap-4">
                            <h2 className="hud-label text-heist-grey flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-heist-money shadow-glow-money animate-pulse" /> Los Santos
                            </h2>
                            <span className="text-[10px] uppercase tracking-widest text-heist-grey text-right">
                                {gameState.stage === 2 ? 'Hand loot to anyone' : 'Call anyone · hand loot to glowing districts'}
                            </span>
                        </div>

                        {/* Stacked (below xl): capped by screen height so the chat keeps room */}
                        <div className="max-w-[min(48rem,50vh)] xl:max-w-none w-full mx-auto">
                            <CityMap
                                gameState={gameState}
                                me={me}
                                selected={selectedNeighbor}
                                unreadCounts={unreadCounts}
                                canHandTo={canHandTo}
                                onSelect={(nId) => {
                                    const isSelected = selectedNeighbor === nId;
                                    markRead(selectedNeighbor, nId);
                                    setSelectedNeighbor(isSelected ? null : nId);
                                    // Auto-open chat on mobile when selecting a district
                                    if (!isSelected && isMobile) setShowMobileChat(true);
                                }}
                                onDropToken={handleDrop}
                            />
                        </div>
                    </div>

                    {/* CHAT TERMINAL */}
                    {selectedNeighbor && !isMobile ? (
                        <div key={selectedNeighbor} className="hud-panel flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden animate-fade-up">
                            <div className="px-5 py-3.5 border-b border-white/10 bg-white/[0.03] flex justify-between items-center gap-3 shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-heist-pink to-heist-violet flex items-center justify-center">
                                        <PhoneCall size={16} className="text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold uppercase truncate">{NODES[selectedNeighbor].label}</div>
                                        <div className="text-[10px] font-mono text-heist-grey uppercase truncate">{selectedPlayer?.alias ?? 'Vacant'}</div>
                                    </div>
                                </div>
                                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono font-bold uppercase border ${selectedPlayer?.online ? 'text-heist-cyan border-heist-cyan/40 bg-heist-cyan/10' : 'text-heist-grey border-white/10 bg-white/5'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${selectedPlayer?.online ? 'bg-heist-cyan shadow-glow-cyan' : 'bg-heist-grey'}`} />
                                    {selectedPlayer?.online ? 'Online' : 'Offline'}
                                </span>
                            </div>

                            <ul className="flex-1 overflow-y-auto p-5 space-y-3" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, selectedNeighbor)}>
                                {relevantMessages.length === 0 && (
                                    <li className="h-full flex flex-col items-center justify-center gap-2 text-heist-grey/70 text-xs font-mono uppercase tracking-widest">
                                        <MessageCircle size={28} strokeWidth={1.5} />
                                        No messages yet
                                    </li>
                                )}
                                {relevantMessages.map((msg, idx) => (
                                    <li key={`${msg.timestamp}-${idx}`}>
                                        <ChatBubble msg={msg} isMe={msg.senderId === me.id} />
                                    </li>
                                ))}
                                <div ref={chatEndRef}></div>
                            </ul>

                            {/* PENDING ATTACHMENT */}
                            {pendingAttachment && (
                                <div className="mx-4 mb-2 px-4 py-3 rounded-xl bg-heist-sun/10 border border-heist-sun/40 flex items-center justify-between shrink-0 animate-slide-up">
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl">{getLootIcon(pendingAttachment.type)}</span>
                                        <div className="text-xs uppercase">
                                            <span className="block text-heist-grey">Attaching Loot</span>
                                            <span className="font-bold text-heist-white">{pendingAttachment.type}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setPendingAttachment(null)} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
                                        <X className="text-heist-grey hover:text-heist-white" />
                                    </button>
                                </div>
                            )}

                            {/* INPUT */}
                            <div className="p-4 border-t border-white/10 bg-black/20 shrink-0">
                                <div className="flex items-stretch gap-2 rounded-xl border border-white/15 bg-black/40 p-1.5 transition-all focus-within:border-heist-sun/70 focus-within:shadow-[0_0_15px_rgba(255,177,61,0.25)]">
                                    <button
                                        onClick={openAttach}
                                        aria-disabled={!selectedCanReceive}
                                        title={selectedCanReceive ? 'Attach loot' : OUT_OF_TURF}
                                        className={`px-3 rounded-lg text-heist-grey transition-colors ${selectedCanReceive ? 'hover:bg-white/10 hover:text-heist-white' : 'opacity-30 cursor-not-allowed'}`}
                                    >
                                        <Paperclip size={20} />
                                    </button>
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                        placeholder="TYPE A MESSAGE..."
                                        className="flex-1 min-w-0 bg-transparent px-2 py-2.5 text-heist-white placeholder-heist-grey/50 font-mono focus:outline-none uppercase"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={!chatInput.trim() && !pendingAttachment}
                                        className="btn-sunset px-4 text-xs flex items-center gap-2 !tracking-widest"
                                    >
                                        <Send size={14} /> SEND
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : selectedNeighbor && isMobile ? (
                        /* MOBILE CHAT BUTTON */
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                            <button
                                onClick={() => setShowMobileChat(true)}
                                className="btn-sunset w-full max-w-sm py-5 px-8 text-lg"
                            >
                                OPEN CHAT
                                <div className="text-xs mt-1 font-mono opacity-75">{NODES[selectedNeighbor].label}</div>
                            </button>
                            {selectedNeighbor && (unreadCounts[selectedNeighbor] ?? 0) > 0 && (
                                <div className="text-sm text-heist-pink font-bold uppercase animate-pulse">
                                    {unreadCounts[selectedNeighbor]} New Message{(unreadCounts[selectedNeighbor] ?? 0) === 1 ? '' : 's'}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="hud-panel hidden md:flex flex-1 min-w-0 flex-col items-center justify-center gap-4 text-heist-grey min-h-0 p-6 animate-fade-up stagger-4">
                            <div className="relative">
                                <span className="absolute inset-0 rounded-full border border-heist-cyan/40 animate-district-ping" aria-hidden="true" />
                                <div className="relative w-20 h-20 rounded-full bg-heist-cyan/10 border border-heist-cyan/30 flex items-center justify-center">
                                    <PhoneCall size={32} strokeWidth={1.5} className="text-heist-cyan" />
                                </div>
                            </div>
                            <p className="font-mono text-sm uppercase tracking-widest text-center px-4">Pick a district on the map to call them</p>
                        </div>
                    )}
                </main>
            </div>

            {/* ATTACHMENT MODAL */}
            {showInventoryModal && (
                <div className="fixed inset-0 z-[60] bg-heist-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="hud-panel hud-panel-accent p-6 lg:p-8 w-full max-w-lg animate-slide-up">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <h3 className="text-xl font-black uppercase text-heist-white">Select Loot</h3>
                            <button onClick={() => setShowInventoryModal(false)} className="p-1 rounded-lg text-heist-grey hover:text-heist-white hover:bg-white/10 transition-colors"><X size={24} /></button>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            {me.inventory.length === 0 ? (
                                <div className="col-span-4 flex flex-col items-center gap-2 py-12 text-heist-grey font-mono text-xs uppercase tracking-widest">
                                    <Briefcase size={28} strokeWidth={1.5} /> No loot
                                </div>
                            ) : (
                                me.inventory.map(token => (
                                    <button
                                        key={token.id}
                                        onClick={() => {
                                            setPendingAttachment(token);
                                            setShowInventoryModal(false);
                                        }}
                                        className={`aspect-square rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-center transition-all duration-200 hover:-translate-y-0.5 group touch-target ${getLootGlow(token.type)}`}
                                    >
                                        <span className="text-3xl group-hover:scale-110 transition-transform">{getLootIcon(token.type)}</span>
                                        <span className="text-[9px] font-mono text-heist-grey uppercase mt-2">{token.id.split('-')[1]}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* FLOATING MOBILE CHAT BUTTON */}
            {isMobile && selectedNeighbor && !showMobileChat && (
                <button
                    onClick={() => setShowMobileChat(true)}
                    className="fixed bottom-6 right-4 z-40 w-16 h-16 bg-gradient-to-br from-heist-sun to-heist-pink text-heist-black rounded-full shadow-glow-pink hover:scale-110 active:scale-95 transition-transform flex items-center justify-center animate-slide-up"
                >
                    <MessageCircle size={28} />
                    {(unreadCounts[selectedNeighbor] ?? 0) > 0 && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-heist-pink text-white text-xs font-mono font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-heist-black">
                            {unreadCounts[selectedNeighbor]}
                        </div>
                    )}
                </button>
            )}

            {/* MOBILE CHAT FULLSCREEN MODAL */}
            {showMobileChat && isMobile && selectedNeighbor && (
                <div className="fixed inset-0 z-50 bg-heist-black/95 backdrop-blur-md flex flex-col animate-slide-up">
                    {/* MOBILE CHAT HEADER */}
                    <div className="shrink-0 p-4 bg-white/[0.03] border-b border-white/10 flex justify-between items-center gap-3">
                        <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-heist-pink to-heist-violet flex items-center justify-center">
                            <PhoneCall size={18} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-lg font-black text-heist-white uppercase truncate">{NODES[selectedNeighbor].label}</div>
                            <div className={`text-[10px] font-mono ${selectedPlayer?.online ? 'text-heist-cyan' : 'text-heist-grey'}`}>
                                {selectedPlayer?.online ? '● ONLINE' : '○ OFFLINE'} · {selectedPlayer?.alias ?? 'VACANT'}
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                markRead(selectedNeighbor);
                                setShowMobileChat(false);
                            }}
                            className="p-3 rounded-xl border border-white/15 hover:border-white/40 hover:bg-white/10 transition-colors touch-target"
                        >
                            <X className="text-heist-white" size={24} />
                        </button>
                    </div>

                    {/* MOBILE CHAT MESSAGES - with proper scrolling */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {relevantMessages.length === 0 ? (
                            <div className="flex flex-col gap-2 items-center justify-center h-full text-heist-grey/60 text-sm font-mono uppercase">
                                <MessageCircle size={28} strokeWidth={1.5} />
                                No messages yet
                            </div>
                        ) : (
                            relevantMessages.map((msg, idx) => (
                                <ChatBubble key={`${msg.timestamp}-${idx}`} msg={msg} isMe={msg.senderId === me.id} compact />
                            ))
                        )}
                        <div ref={chatEndRef}></div>
                    </div>

                    {/* PENDING ATTACHMENT - Mobile */}
                    {pendingAttachment && (
                        <div className="shrink-0 mx-4 mb-2 p-3 rounded-xl bg-heist-sun/10 border border-heist-sun/40 flex items-center justify-between animate-slide-up">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{getLootIcon(pendingAttachment.type)}</span>
                                <div className="text-xs uppercase">
                                    <span className="block text-heist-grey">Attaching</span>
                                    <span className="font-bold text-heist-white">{pendingAttachment.type}</span>
                                </div>
                            </div>
                            <button onClick={() => setPendingAttachment(null)} className="p-2 rounded-lg hover:bg-white/10 transition-colors touch-target">
                                <X className="text-heist-grey hover:text-heist-white" size={20} />
                            </button>
                        </div>
                    )}

                    {/* MOBILE CHAT INPUT */}
                    <div className="shrink-0 p-4 border-t border-white/10 bg-black/30 safe-area-bottom">
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={openAttach}
                                aria-disabled={!selectedCanReceive}
                                className={`px-4 py-3 rounded-xl border border-white/15 text-heist-grey transition-colors touch-target flex items-center gap-2 ${selectedCanReceive ? 'hover:bg-white/10' : 'opacity-30'}`}
                            >
                                <Paperclip size={18} />
                                <span className="text-xs font-bold uppercase">Attach</span>
                            </button>
                            {!selectedCanReceive && (
                                <span className="self-center text-[10px] uppercase text-heist-grey">Not your turf: chat only</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                placeholder="TYPE MESSAGE..."
                                className="flex-1 min-w-0 rounded-xl bg-black/40 border border-white/15 p-3 text-heist-white placeholder-heist-grey/50 font-mono focus:outline-none focus:border-heist-sun focus:shadow-[0_0_15px_rgba(255,177,61,0.25)] transition-all text-sm"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!chatInput.trim() && !pendingAttachment}
                                className="btn-sunset px-5 py-3 text-sm touch-target !tracking-widest"
                            >
                                SEND
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST NOTIFICATIONS: slide up and fade in (index.css) */}
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: 'rgba(22, 12, 40, 0.88)',
                        backdropFilter: 'blur(12px)',
                        color: '#fff',
                        border: '1px solid rgba(255, 45, 138, 0.55)',
                        borderRadius: '14px',
                        boxShadow: '0 0 15px rgba(255, 45, 138, 0.35), 0 12px 30px -10px rgba(0, 0, 0, 0.7)',
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        whiteSpace: 'pre-line',
                    },
                    success: {
                        style: {
                            border: '1px solid rgba(61, 220, 132, 0.6)',
                            boxShadow: '0 0 15px rgba(61, 220, 132, 0.3), 0 12px 30px -10px rgba(0, 0, 0, 0.7)',
                        },
                        iconTheme: {
                            primary: '#3DDC84',
                            secondary: '#160c28',
                        },
                    },
                    error: {
                        iconTheme: {
                            primary: '#ff2d8a',
                            secondary: '#160c28',
                        },
                    },
                }}
            >
                {(t: Toast) => (
                    <ToastBar
                        toast={t}
                        style={{ animation: t.visible ? TOAST_ENTER : TOAST_EXIT }}
                    />
                )}
            </Toaster>

            {/* COMPLETION MODAL */}
            {showCompletionModal && (
                <div className="fixed inset-0 z-[100] bg-heist-black/85 backdrop-blur-md flex items-center justify-center p-6">
                    <div className="hud-panel border-heist-money/50 p-8 max-w-lg w-full shadow-[0_0_50px_rgba(61,220,132,0.3)] text-center overflow-hidden animate-fade-up">

                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-heist-money to-transparent"></div>
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-heist-money/15 rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-heist-pink/15 rounded-full blur-3xl"></div>

                        <div className="relative z-10">
                            <div className="mb-6 inline-block p-4 rounded-full bg-heist-money/10 border border-heist-money/30 animate-float">
                                <span className="text-6xl">💰</span>
                            </div>

                            <h2 className="text-4xl lg:text-5xl font-display uppercase mb-2 tracking-tight vi-gradient">
                                Mission Passed
                            </h2>
                            <p className="text-heist-grey font-mono text-sm uppercase tracking-widest mb-8">
                                +{me.completionBonus ?? 0} bonus earned. Keep fixing for others.
                            </p>

                            <div className="rounded-xl bg-black/40 border border-white/10 p-6 mb-8 grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block hud-label text-heist-grey mb-2">Completion Time</span>
                                    <span className="text-2xl font-mono tabular text-white font-bold">
                                        {me.completionTime ? new Date(me.completionTime).toLocaleTimeString() : '--:--:--'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block hud-label text-heist-grey mb-2">Bonus Earned</span>
                                    <span className="text-2xl font-mono tabular text-heist-money font-bold">
                                        +{me.completionBonus ?? 0}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => setDismissedCompletion(me.completionTime)}
                                className="btn-sunset w-full py-4 text-lg"
                            >
                                Back to the city
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* POLICE RAID: full-screen siren strobe for 3s, then a smooth fade out */}
            {raidFlash > 0 && (
                <div key={raidFlash} className="fixed inset-0 z-[200] raid-overlay pointer-events-none flex items-center justify-center overflow-hidden" role="alert">
                    <div className="absolute inset-0 raid-flash" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.65)_100%)]" />
                    <div className="absolute inset-x-0 top-0 h-2 overflow-hidden bg-black/40">
                        <div className="raid-sweep h-full w-1/2 bg-gradient-to-r from-transparent via-white to-transparent" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-2 overflow-hidden bg-black/40">
                        <div className="raid-sweep h-full w-1/2 bg-gradient-to-r from-transparent via-white to-transparent" />
                    </div>
                    <div className="relative text-center px-4 raid-slam">
                        <Siren className="mx-auto mb-4 w-12 h-12 lg:w-20 lg:h-20 text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.9)]" />
                        <div className="text-6xl lg:text-9xl font-display text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.9)]">
                            LSPD RAID
                        </div>
                        <div className="mt-4 font-mono text-xs lg:text-sm font-bold uppercase tracking-[0.4em] text-white/90">
                            Police are seizing loot
                        </div>
                    </div>
                </div>
            )}

            {/* TUTORIAL */}
            {showTutorial && <Tutorial onComplete={() => setShowTutorial(false)} />}
        </div>
    );
};


export default Dashboard;
