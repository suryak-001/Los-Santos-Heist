import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import type { GameState, ResourceType, NodeId, ResourceToken } from '../types/game';
import { NODES, formatDistricts } from '../topology';
import { Copy, AlertCircle, Paperclip, X, Crosshair, MessageCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Tutorial from './Tutorial';
import CityMap from './CityMap';
import { completionBonusAt } from '../scoring';

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

// Hover tint behind each loot tile
const getLootTint = (type: string) => {
    switch (type) {
        case 'Cash': return 'bg-[#3DDC84]';
        case 'Artwork': return 'bg-[#A855F7]';
        case 'Gold': return 'bg-[#FFD400]';
        case 'Diamonds': return 'bg-[#22D3EE]';
        default: return 'bg-gray-500';
    }
};

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
    const [raidFlash, setRaidFlash] = useState(false);
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        const onRaid = ({ districts, seized }: { districts: NodeId[]; seized: { nodeId: NodeId; type: ResourceType }[] }) => {
            setRaidFlash(true);
            clearTimeout(timeout);
            timeout = setTimeout(() => setRaidFlash(false), 3000);
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

    return (
        <div className="min-h-screen lg:h-screen city-bg text-heist-white font-sans p-4 lg:p-8 flex flex-col gap-px border border-heist-grey/40 lg:overflow-hidden">

            {/* HEADER */}
            <header className="swiss-grid mb-4 border-b-0 shrink-0">
                <div className="col-span-12 lg:col-span-8 glass-dark border-b-0 border-r border-heist-grey">
                    <h1 className="text-3xl lg:text-5xl font-display uppercase tracking-tight leading-none cursor-default">
                        <span className="vi-gradient">{myNode.label}</span>
                        <div className="flex items-center justify-between mt-2">
                            <span className="block text-sm lg:text-base font-bold text-heist-grey tracking-widest">
                                {me.alias}
                            </span>
                            <button
                                onClick={() => {
                                    if (confirm("LEAVE THE JOB?")) {
                                        localStorage.removeItem('player_alias');
                                        globalThis.location.reload();
                                    }
                                }}
                                className="text-[10px] bg-heist-pink/20 hover:bg-heist-pink text-heist-pink hover:text-white px-2 py-1 uppercase font-bold tracking-widest transition-colors border border-heist-pink/50"
                            >
                                Logout
                            </button>
                        </div>
                    </h1>
                </div>
                <div className="col-span-12 lg:col-span-4 glass-dark border-b lg:border-l border-heist-grey flex flex-col justify-center p-6">
                    <span className="text-xs uppercase tracking-widest text-heist-grey">Phase {gameState.stage}</span>
                    <span className="text-3xl font-display text-heist-sun heist-title uppercase">{gameState.stage === 2 ? 'Open City' : 'Turf War'}</span>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-0 min-h-0">

                {/* LEFT COLUMN: INVENTORY & CONTRACT */}
                <aside className="col-span-1 lg:col-span-4 flex flex-col gap-2 lg:gap-0 lg:border-r border-heist-grey lg:overflow-y-auto">

                    {/* CONTRACT */}
                    <div id="contract-section" className="glass-dark border-b-0 mb-2 lg:mb-8 p-3 lg:p-6 shrink-0">
                        <h2 className="text-xs uppercase tracking-widest text-heist-pink mb-2 font-bold flex items-center gap-2">
                            <Crosshair size={14} /> Heist Order
                        </h2>
                        <p className="text-[10px] text-heist-grey/70 uppercase tracking-wide mb-4">What you have to collect</p>

                        {Object.values(me.contract).reduce((a, b) => a + b, 0) === 0 ? (
                            <div className="text-heist-grey text-sm font-mono uppercase">Awaiting the briefing...</div>
                        ) : (
                            <div className="space-y-4">
                                {RESOURCE_TYPES.map(r => {
                                    const needed = me.contract[r];
                                    if (needed === 0) return null;
                                    const current = myCounts[r];
                                    const met = current >= needed;
                                    return (
                                        <div key={r} className={`flex justify-between items-center p-2 lg:p-3 border ${met ? 'border-heist-white bg-heist-white/5' : 'border-heist-grey/30 bg-heist-dark'}`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl lg:text-2xl">{getLootIcon(r)}</span>
                                                <span className={`text-xs lg:text-sm font-bold uppercase ${met ? 'text-heist-white' : 'text-heist-grey'}`}>{r}</span>
                                            </div>
                                            <div className={`font-mono text-lg lg:text-xl ${met ? 'text-green-400' : 'text-heist-grey'}`}>
                                                {current}/{needed}
                                            </div>
                                        </div>
                                    );
                                })}
                                {isContractMet && (
                                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500 text-green-500 text-center font-bold uppercase text-xs tracking-widest animate-pulse">
                                        Ready: Mission Passed
                                    </div>
                                )}
                                {me.completionBonus !== null ? (
                                    <div className="text-xs font-mono uppercase text-heist-sun">
                                        Bonus locked in: {me.completionBonus}
                                    </div>
                                ) : gameState.phase === 'ACTIVE' && (
                                    <div className="text-xs font-mono uppercase text-heist-grey">
                                        Mission Passed bonus right now: <span className="text-heist-sun font-bold">{completionBonusAt(gameState, now)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* INVENTORY */}
                    <div id="inventory-section" className="bg-heist-black p-3 lg:p-6 flex-1 min-h-[150px] lg:min-h-[200px]">
                        <h2 className="text-xs uppercase tracking-widest text-heist-grey mb-3 lg:mb-6 font-bold flex items-center gap-2">
                            <Copy size={14} /> Loot
                        </h2>
                        <div className="grid grid-cols-4 lg:grid-cols-3 gap-2">
                            {me.inventory.length === 0 && (
                                <div className="col-span-3 text-center py-10 text-heist-grey/50 font-mono text-xs">EMPTY</div>
                            )}
                            {me.inventory.map((token) => (
                                <button
                                    type="button"
                                    key={token.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, token)}
                                    className="aspect-square bg-heist-dark border border-heist-grey hover:bg-heist-grey/20 transition-colors flex flex-col items-center justify-center group relative overflow-hidden"
                                >
                                    <span className="text-3xl relative z-10 group-hover:scale-110 transition-transform">{getLootIcon(token.type)}</span>
                                    <span className="text-[10px] font-bold text-heist-white uppercase mt-1">{token.type}</span>
                                    <span className="text-[7px] font-mono text-heist-grey uppercase">{token.id.split('-')[1]}</span>
                                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity ${getLootTint(token.type)}`}></div>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* RIGHT COLUMN: PREDICTIONS / COMMS */}
                <main className="col-span-1 lg:col-span-8 flex flex-col xl:flex-row h-full min-h-0 bg-heist-black/85">

                    {/* CITY MAP */}
                    <div id="city-map-section" className="p-4 lg:p-6 border-b xl:border-b-0 xl:border-r border-heist-grey flex flex-col shrink-0 xl:w-[55%] xl:justify-center">
                        <div className="flex justify-between items-center mb-3 gap-4">
                            <h2 className="text-xs uppercase tracking-widest text-heist-grey font-bold flex items-center gap-2">
                                Los Santos
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
                        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                            <div className="p-4 bg-heist-dark border-b border-heist-grey text-xs font-mono text-heist-grey uppercase flex justify-between shrink-0">
                                <span>PHONE // {NODES[selectedNeighbor].label}</span>
                                <span>{gameState.players[Object.keys(gameState.players).find(k => gameState.players[k].nodeId === selectedNeighbor) || '']?.online ? 'ONLINE' : 'OFFLINE'}</span>
                            </div>

                            <ul className="flex-1 overflow-y-auto p-6 space-y-4" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, selectedNeighbor)}>
                                {relevantMessages.map((msg, idx) => {
                                    const isMe = msg.senderId === me.id;
                                    return (
                                        <li key={`${msg.timestamp}-${idx}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-4 border ${isMe ? 'bg-heist-white text-heist-black border-heist-white' : 'bg-black text-heist-white border-heist-grey'}`}>
                                                <p className="text-sm font-bold leading-relaxed">
                                                    {msg.message.startsWith('SYSTEM_TRANSFER|') ? (() => {
                                                        const [, type, id] = msg.message.split('|');
                                                        return (
                                                            <span>
                                                                <span className={isMe ? 'text-heist-pink' : 'text-green-400'}>{isMe ? '📤 HANDED OVER' : '📥 RECEIVED'}</span>
                                                                <br />
                                                                <span className="opacity-75">{type} [{id}]</span>
                                                            </span>
                                                        );
                                                    })() : msg.message}
                                                </p>
                                                <span className="block text-[9px] font-mono mt-2 opacity-50 uppercase">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                        </li>
                                    );
                                })}
                                <div ref={chatEndRef}></div>
                            </ul>

                            {/* PENDING ATTACHMENT */}
                            {pendingAttachment && (
                                <div className="p-4 bg-heist-dark border-t border-heist-grey flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl">{getLootIcon(pendingAttachment.type)}</span>
                                        <div className="text-xs uppercase">
                                            <span className="block text-heist-grey">Attaching Loot</span>
                                            <span className="font-bold text-heist-white">{pendingAttachment.type}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setPendingAttachment(null)}>
                                        <X className="text-heist-grey hover:text-heist-white" />
                                    </button>
                                </div>
                            )}

                            {/* INPUT */}
                            <div className="p-6 border-t border-heist-grey bg-heist-black flex gap-0 shrink-0">
                                <button
                                    onClick={openAttach}
                                    aria-disabled={!selectedCanReceive}
                                    title={selectedCanReceive ? 'Attach loot' : OUT_OF_TURF}
                                    className={`p-4 border-2 border-r-0 border-heist-grey text-heist-grey transition-colors ${selectedCanReceive ? 'hover:bg-heist-grey/20' : 'opacity-30 cursor-not-allowed'}`}
                                >
                                    <Paperclip size={20} />
                                </button>
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                    placeholder="TYPE A MESSAGE..."
                                    className="flex-1 bg-heist-black border-2 border-heist-grey p-4 text-heist-white placeholder-heist-grey/50 font-mono focus:outline-none focus:border-heist-white transition-colors uppercase"
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!chatInput.trim() && !pendingAttachment}
                                    className="p-4 border-2 border-l-0 border-heist-grey bg-heist-white text-heist-black hover:bg-heist-light disabled:opacity-50 disabled:cursor-not-allowed font-bold uppercase transition-colors"
                                >
                                    SEND
                                </button>
                            </div>
                        </div>
                    ) : selectedNeighbor && isMobile ? (
                        /* MOBILE CHAT BUTTON */
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                            <button
                                onClick={() => setShowMobileChat(true)}
                                className="w-full max-w-sm py-6 px-8 bg-heist-sun text-heist-black border-2 border-heist-sun hover:bg-heist-white font-black uppercase text-lg tracking-widest transition-colors"
                            >
                                OPEN CHAT
                                <div className="text-xs mt-2 font-mono opacity-75">{NODES[selectedNeighbor].label}</div>
                            </button>
                            {selectedNeighbor && (unreadCounts[selectedNeighbor] ?? 0) > 0 && (
                                <div className="text-sm text-heist-pink font-bold uppercase animate-pulse">
                                    {unreadCounts[selectedNeighbor]} New Message{(unreadCounts[selectedNeighbor] ?? 0) === 1 ? '' : 's'}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="hidden md:flex flex-1 min-w-0 flex-col items-center justify-center text-heist-grey min-h-0">
                            <AlertCircle size={64} strokeWidth={1} />
                            <p className="mt-4 font-mono text-sm uppercase tracking-widest text-center px-4">Pick a district on the map to call them</p>
                        </div>
                    )}
                </main>
            </div>

            {/* ATTACHMENT MODAL */}
            {showInventoryModal && (
                <div className="fixed inset-0 z-[60] bg-heist-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-heist-dark border border-heist-grey p-8 w-full max-w-lg shadow-2xl">
                        <div className="flex justify-between items-center mb-8 border-b border-heist-grey pb-4">
                            <h3 className="text-xl font-black uppercase text-heist-white">Select Loot</h3>
                            <button onClick={() => setShowInventoryModal(false)} className="text-heist-grey hover:text-heist-white"><X size={24} /></button>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            {me.inventory.length === 0 ? (
                                <div className="col-span-4 text-center py-12 text-heist-grey font-mono">NO LOOT</div>
                            ) : (
                                me.inventory.map(token => (
                                    <button
                                        key={token.id}
                                        onClick={() => {
                                            setPendingAttachment(token);
                                            setShowInventoryModal(false);
                                        }}
                                        className="aspect-square bg-heist-black border border-heist-grey hover:border-heist-white flex flex-col items-center justify-center transition-all group touch-target"
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
                    className="fixed bottom-6 right-4 z-40 w-16 h-16 bg-heist-sun text-heist-black rounded-full shadow-[0_0_20px_rgba(255,215,0,0.5)] hover:scale-110 active:scale-95 transition-transform flex items-center justify-center font-black border-2 border-heist-sun"
                >
                    <MessageCircle size={28} />
                    {(unreadCounts[selectedNeighbor] ?? 0) > 0 && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                            {unreadCounts[selectedNeighbor]}
                        </div>
                    )}
                </button>
            )}

            {/* MOBILE CHAT FULLSCREEN MODAL */}
            {showMobileChat && isMobile && selectedNeighbor && (
                <div className="fixed inset-0 z-50 bg-heist-black flex flex-col">
                    {/* MOBILE CHAT HEADER */}
                    <div className="shrink-0 p-4 bg-heist-dark border-b border-heist-grey flex justify-between items-center">
                        <div className="flex-1">
                            <div className="text-xs font-mono text-heist-grey uppercase">Phone</div>
                            <div className="text-lg font-black text-heist-white uppercase">{NODES[selectedNeighbor].label}</div>
                            <div className="text-[10px] text-heist-grey font-mono">
                                {gameState.players[Object.keys(gameState.players).find(k => gameState.players[k].nodeId === selectedNeighbor) || '']?.online ? '● ONLINE' : '○ OFFLINE'}
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                markRead(selectedNeighbor);
                                setShowMobileChat(false);
                            }}
                            className="p-3 border border-heist-grey hover:border-heist-white hover:bg-heist-grey/20 transition-colors touch-target"
                        >
                            <X className="text-heist-white" size={24} />
                        </button>
                    </div>

                    {/* MOBILE CHAT MESSAGES - with proper scrolling */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {relevantMessages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-heist-grey/50 text-sm font-mono uppercase">
                                No messages yet
                            </div>
                        ) : (
                            relevantMessages.map((msg, idx) => {
                                const isMe = msg.senderId === me.id;
                                return (
                                    <div key={`${msg.timestamp}-${idx}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 border ${isMe ? 'bg-heist-white text-heist-black border-heist-white' : 'bg-heist-dark text-heist-white border-heist-grey'}`}>
                                            <p className="text-sm font-bold leading-relaxed break-words">
                                                {msg.message.startsWith('SYSTEM_TRANSFER|') ? (() => {
                                                    const [, type, id] = msg.message.split('|');
                                                    return (
                                                        <span>
                                                            <span className={isMe ? 'text-heist-pink' : 'text-green-400'}>{isMe ? '📤 HANDED OVER' : '📥 RECEIVED'}</span>
                                                            <br />
                                                            <span className="opacity-75 text-xs">{type} [{id}]</span>
                                                        </span>
                                                    );
                                                })() : msg.message}
                                            </p>
                                            <span className="block text-[8px] font-mono mt-1 opacity-50 uppercase">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={chatEndRef}></div>
                    </div>

                    {/* PENDING ATTACHMENT - Mobile */}
                    {pendingAttachment && (
                        <div className="shrink-0 p-3 bg-heist-dark border-t border-heist-grey flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{getLootIcon(pendingAttachment.type)}</span>
                                <div className="text-xs uppercase">
                                    <span className="block text-heist-grey">Attaching</span>
                                    <span className="font-bold text-heist-white">{pendingAttachment.type}</span>
                                </div>
                            </div>
                            <button onClick={() => setPendingAttachment(null)} className="p-2 hover:bg-heist-grey/20 transition-colors touch-target">
                                <X className="text-heist-grey hover:text-heist-white" size={20} />
                            </button>
                        </div>
                    )}

                    {/* MOBILE CHAT INPUT */}
                    <div className="shrink-0 p-4 border-t border-heist-grey bg-heist-black safe-area-bottom">
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={openAttach}
                                aria-disabled={!selectedCanReceive}
                                className={`px-4 py-3 border-2 border-heist-grey text-heist-grey transition-colors touch-target flex items-center gap-2 ${selectedCanReceive ? 'hover:bg-heist-grey/20' : 'opacity-30'}`}
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
                                className="flex-1 bg-heist-dark border-2 border-heist-grey p-3 text-heist-white placeholder-heist-grey/50 font-mono focus:outline-none focus:border-heist-sun transition-colors text-sm"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!chatInput.trim() && !pendingAttachment}
                                className="px-6 py-3 border-2 border-heist-sun bg-heist-sun text-heist-black hover:bg-heist-white disabled:opacity-50 disabled:cursor-not-allowed font-black uppercase text-sm transition-colors touch-target"
                            >
                                SEND
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST NOTIFICATIONS */}
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#160c28',
                        color: '#fff',
                        border: '2px solid #ff2d8a',
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        fontWeight: 'bold',
                    },
                    success: {
                        iconTheme: {
                            primary: '#ffb13d',
                            secondary: '#160c28',
                        },
                    },
                }}
            />



            {/* COMPLETION MODAL */}
            {showCompletionModal && (
                <div className="fixed inset-0 z-[100] bg-heist-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-500">
                    <div className="bg-heist-dark border-2 border-heist-sun p-8 max-w-lg w-full shadow-[0_0_50px_rgba(255,45,138,0.35)] text-center relative overflow-hidden">

                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-heist-sun to-transparent"></div>
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-heist-sun/10 rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-heist-sun/10 rounded-full blur-3xl"></div>

                        <div className="relative z-10">
                            <div className="mb-6 inline-block p-4 rounded-full bg-heist-sun/10 border border-heist-sun/30">
                                <span className="text-6xl">💰</span>
                            </div>

                            <h2 className="text-4xl lg:text-5xl font-display uppercase mb-2 tracking-tight vi-gradient">
                                Mission Passed
                            </h2>
                            <p className="text-heist-grey font-mono text-sm uppercase tracking-widest mb-8">
                                +{me.completionBonus ?? 0} bonus earned. Keep fixing for others.
                            </p>

                            <div className="bg-black/50 border border-heist-grey/50 p-6 mb-8 grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-xs text-heist-grey uppercase mb-2">Completion Time</span>
                                    <span className="text-2xl font-mono text-white font-bold">
                                        {me.completionTime ? new Date(me.completionTime).toLocaleTimeString() : '--:--:--'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs text-heist-grey uppercase mb-2">Bonus Earned</span>
                                    <span className="text-2xl font-mono text-heist-sun font-bold">
                                        +{me.completionBonus ?? 0}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => setDismissedCompletion(me.completionTime)}
                                className="w-full py-4 bg-heist-sun text-heist-black font-black uppercase text-lg tracking-widest hover:bg-white hover:scale-105 transition-all duration-300 shadow-lg"
                            >
                                Back to the city
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* POLICE RAID FLASH */}
            {raidFlash && (
                <div className="fixed inset-0 z-[200] raid-flash flex items-center justify-center pointer-events-none" role="alert">
                    <div className="text-6xl lg:text-9xl font-black text-white tracking-tighter drop-shadow-[0_6px_0_rgba(0,0,0,0.9)]">
                        LSPD RAID
                    </div>
                </div>
            )}

            {/* TUTORIAL */}
            {showTutorial && <Tutorial onComplete={() => setShowTutorial(false)} />}
        </div>
    );
};

export default Dashboard;
