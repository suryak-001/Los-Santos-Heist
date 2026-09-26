import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import type { GameState, ResourceType, NodeId, ResourceToken } from '../types/game';
import { NODES } from '../topology';
import { Copy, AlertCircle, Paperclip, X, Crosshair, Search, MessageCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Tutorial from './Tutorial';

interface DashboardProps {
    socket: Socket;
    gameState: GameState;
    myId: string;
}

const RESOURCE_TYPES: ResourceType[] = ['Trishula', 'Gandiva', 'Vajra', 'Brahmastra'];

const getMythicalIcon = (type: string) => {
    switch (type) {
        case 'Trishula': return '🔱';
        case 'Gandiva': return '🏹';
        case 'Vajra': return '⚡';
        case 'Brahmastra': return '☄️';
        default: return '❓';
    }
};

const getMythicalColor = (type: string) => {
    switch (type) {
        case 'Trishula': return 'text-red-500';
        case 'Gandiva': return 'text-yellow-500';
        case 'Vajra': return 'text-cyan-400';
        case 'Brahmastra': return 'text-purple-500';
        default: return 'text-gray-500';
    }
};

const Dashboard: React.FC<DashboardProps> = ({ socket, gameState, myId }) => {
    const me = gameState.players[myId];
    const myNode = me?.nodeId ? NODES[me.nodeId] : null;

    const [selectedNeighbor, setSelectedNeighbor] = useState<NodeId | null>(null);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // --- MOBILE STATE ---
    const [showInventoryModal, setShowInventoryModal] = useState(false);
    const [pendingAttachment, setPendingAttachment] = useState<ResourceToken | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showMobileChat, setShowMobileChat] = useState(false);

    // --- TUTORIAL STATE ---
    const [showTutorial, setShowTutorial] = useState(true);

    // --- COMPLETION MODAL STATE ---
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const hasShownCompletionRef = useRef(false);

    // Watch for completion
    useEffect(() => {
        if (me?.completionTime && !hasShownCompletionRef.current) {
            setShowCompletionModal(true);
            hasShownCompletionRef.current = true;
            // Also trigger some confetti if we had that lib, but sticking to basic modal for now
        }
    }, [me?.completionTime]);

    // --- MOBILE DETECTION ---
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- UNREAD TRACKING ---
    const [unreadCounts, setUnreadCounts] = useState<Partial<Record<NodeId, number>>>({});
    const [lastReadTimestamps, setLastReadTimestamps] = useState<Partial<Record<NodeId, number>>>({});

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
                toast.success(`⚔️ PHASE 1 STARTED\nTrade with your neighbors!`, {
                    duration: 3000,
                    position: 'top-right',
                });
            } else if (gameState.stage === 2) {
                toast.success(`🌍 PHASE 2 STARTED\nYou can now trade with EVERYONE globally!`, {
                    duration: 3000,
                    position: 'top-right',
                });
            }
            prevStageRef.current = gameState.stage;
        }
    }, [gameState.stage]);

    // Track unread messages
    useEffect(() => {
        const newUnreadCounts: Partial<Record<NodeId, number>> = {};

        Object.keys(NODES).forEach((nodeId) => {
            const nId = nodeId as NodeId;
            if (nId === me?.nodeId) return;

            const lastRead = lastReadTimestamps[nId] || 0;
            const nodeMessages = messages.filter(
                (m) => (m.senderId === me?.id && m.receiverId === gameState.players[Object.keys(gameState.players).find(k => gameState.players[k].nodeId === nId) || '']?.id) ||
                    (m.receiverId === me?.id && m.senderId === gameState.players[Object.keys(gameState.players).find(k => gameState.players[k].nodeId === nId) || '']?.id)
            );

            const unreadCount = nodeMessages.filter((m) => {
                const msgTime = new Date(m.timestamp).getTime();
                return msgTime > lastRead && m.senderId !== me?.id;
            }).length;

            if (unreadCount > 0) {
                newUnreadCounts[nId] = unreadCount;
            }
        });

        setUnreadCounts(newUnreadCounts);
    }, [messages, me?.id, me?.nodeId, lastReadTimestamps, gameState.players]);

    // Clear unread when opening chat
    useEffect(() => {
        if (selectedNeighbor) {
            setLastReadTimestamps(prev => ({
                ...prev,
                [selectedNeighbor]: Date.now(),
            }));
        }
    }, [selectedNeighbor]);

    // Toast for received resources
    const prevInventoryLength = useRef(me?.inventory.length || 0);
    useEffect(() => {
        if (me && me.inventory.length > prevInventoryLength.current) {
            const newItem = me.inventory.at(-1);
            if (newItem) {
                toast.success(String.raw`📥 ITEM RECEIVED\n${newItem.type}`, {
                    duration: 3000,
                    position: 'top-right',
                });
            }
        }
        prevInventoryLength.current = me?.inventory.length || 0;
    }, [me, me?.inventory]);

    if (!me || !myNode) return <div className="p-10 text-center text-myth-grey font-mono animate-pulse">INITIALIZING MYTH_CORE...</div>;

    const sendMessage = () => {
        if (!selectedNeighbor) return;
        const target = Object.values(gameState.players).find(p => p.nodeId === selectedNeighbor);
        if (!target) return;

        if (pendingAttachment) {
            socket.emit('transfer_resource', {
                targetNodeId: selectedNeighbor,
                tokenId: pendingAttachment.id
            });
            toast.success(String.raw`📤 ITEM SENT\n${pendingAttachment.type} to COUNTRY ${selectedNeighbor}`, {
                duration: 3000,
                position: 'top-right',
            });
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
        if (confirm(`SACRIFICE ${token.type} (${token.id}) to COUNTRY ${targetNodeId}?`)) {
            socket.emit('transfer_resource', {
                targetNodeId: targetNodeId,
                tokenId: token.id
            });
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    // --- DERIVED STATE ---
    const myCounts: Record<ResourceType, number> = { Trishula: 0, Gandiva: 0, Vajra: 0, Brahmastra: 0 };
    me.inventory.forEach(t => myCounts[t.type]++);
    const isContractMet = RESOURCE_TYPES.every(r => myCounts[r] >= me.contract[r]);

    // Determines which nodes are visible in the map
    const visibleNodes = (gameState.stage === 2
        ? Object.values(gameState.players).filter(p => p.nodeId && p.id !== me.id).map(p => p.nodeId!)
        : myNode.neighbors
    ).filter(nId => {
        if (!searchQuery) return true;
        const neighbor = Object.values(gameState.players).find(p => p.nodeId === nId);
        const alias = neighbor?.alias?.toLowerCase() || '';
        const id = nId.toLowerCase();
        const query = searchQuery.toLowerCase();
        return id.includes(query) || alias.includes(query);
    });

    return (
        <div className="h-screen lokah-bg text-myth-white font-sans p-4 lg:p-8 flex flex-col gap-px border border-myth-grey/40 overflow-hidden">

            {/* HEADER */}
            <header className="swiss-grid mb-4 border-b-0 shrink-0">
                <div className="col-span-12 lg:col-span-8 glass-dark border-b-0 border-r border-myth-grey">
                    <h1 className="text-4xl lg:text-6xl font-serif font-black uppercase tracking-tighter leading-none glitch-text cursor-default transition-colors hover:text-myth-gold">
                        COUNTRY <span className="text-myth-red">{me.nodeId}</span>
                        <div className="flex items-center justify-between mt-2">
                            <span className="block text-sm lg:text-base font-bold text-myth-grey tracking-widest">
                                {me.alias}
                            </span>
                            <button
                                onClick={() => {
                                    if (confirm("DISCONNECT FROM LOKAH?")) {
                                        localStorage.removeItem('player_alias');
                                        globalThis.location.reload();
                                    }
                                }}
                                className="text-[10px] bg-myth-red/20 hover:bg-myth-red text-myth-red hover:text-white px-2 py-1 uppercase font-bold tracking-widest transition-colors border border-myth-red/50"
                            >
                                Logout
                            </button>
                        </div>
                    </h1>
                </div>
                <div className="col-span-12 lg:col-span-4 glass-dark border-b lg:border-l border-myth-grey flex flex-col justify-center p-6">
                    <span className="text-xs uppercase tracking-widest text-myth-grey">Phase</span>
                    <span className="text-3xl font-black font-serif text-myth-gold">{gameState.stage}</span>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-0 min-h-0">

                {/* LEFT COLUMN: INVENTORY & CONTRACT */}
                <aside className="col-span-1 lg:col-span-4 flex flex-col gap-2 lg:gap-0 lg:border-r border-myth-grey overflow-y-auto">

                    {/* CONTRACT */}
                    <div id="contract-section" className="glass-dark border-b-0 mb-2 lg:mb-8 p-3 lg:p-6 shrink-0">
                        <h2 className="text-xs uppercase tracking-widest text-myth-red mb-2 font-bold flex items-center gap-2">
                            <Crosshair size={14} /> Sacred Contract
                        </h2>
                        <p className="text-[10px] text-myth-grey/70 uppercase tracking-wide mb-4">What you have to collect</p>

                        {Object.values(me.contract).reduce((a, b) => a + b, 0) === 0 ? (
                            <div className="text-myth-grey text-sm font-mono uppercase">Awaiting Prophecy...</div>
                        ) : (
                            <div className="space-y-4">
                                {RESOURCE_TYPES.map(r => {
                                    const needed = me.contract[r];
                                    if (needed === 0) return null;
                                    const current = myCounts[r];
                                    const met = current >= needed;
                                    return (
                                        <div key={r} className={`flex justify-between items-center p-2 lg:p-3 border ${met ? 'border-myth-white bg-myth-white/5' : 'border-myth-grey/30 bg-myth-dark'}`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl lg:text-2xl">{getMythicalIcon(r)}</span>
                                                <span className={`text-xs lg:text-sm font-bold uppercase ${met ? 'text-myth-white' : 'text-myth-grey'}`}>{r}</span>
                                            </div>
                                            <div className={`font-mono text-lg lg:text-xl ${met ? 'text-green-400' : 'text-myth-grey'}`}>
                                                {current}/{needed}
                                            </div>
                                        </div>
                                    );
                                })}
                                {isContractMet && (
                                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500 text-green-500 text-center font-bold uppercase text-xs tracking-widest animate-pulse">
                                        Ascension Ready
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* INVENTORY */}
                    <div id="inventory-section" className="bg-myth-black p-3 lg:p-6 flex-1 min-h-[150px] lg:min-h-[200px]">
                        <h2 className="text-xs uppercase tracking-widest text-myth-grey mb-3 lg:mb-6 font-bold flex items-center gap-2">
                            <Copy size={14} /> Artifacts
                        </h2>
                        <div className="grid grid-cols-4 lg:grid-cols-3 gap-2">
                            {me.inventory.length === 0 && (
                                <div className="col-span-3 text-center py-10 text-myth-grey/30 font-mono text-xs">VOID</div>
                            )}
                            {me.inventory.map((token) => (
                                <button
                                    type="button"
                                    key={token.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, token)}
                                    className="aspect-square bg-myth-dark border border-myth-grey hover:bg-myth-grey/20 transition-colors flex flex-col items-center justify-center group relative overflow-hidden"
                                >
                                    <span className="text-3xl relative z-10 group-hover:scale-110 transition-transform">{getMythicalIcon(token.type)}</span>
                                    <span className="text-[10px] font-bold text-myth-white uppercase mt-1">{token.type}</span>
                                    <span className="text-[7px] font-mono text-myth-grey uppercase">{token.id.split('-')[1]}</span>
                                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${getMythicalColor(token.type).replace('text-', 'bg-')}`}></div>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* RIGHT COLUMN: PREDICTIONS / COMMS */}
                <main className="col-span-1 lg:col-span-8 flex flex-col h-full min-h-0">

                    {/* NEIGHBOR SELECTION (LOKAH MAP) */}
                    <div id="lokah-map-section" className="p-6 border-b border-myth-grey flex flex-col shrink-0">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xs uppercase tracking-widest text-myth-grey font-bold flex items-center gap-2">
                                Lokah Map
                            </h2>
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-myth-grey" size={12} />
                                <input
                                    type="text"
                                    placeholder="SEARCH COUNTRY..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-myth-dark border border-myth-grey text-xs p-1 pl-8 text-myth-white placeholder-myth-grey/50 font-mono uppercase focus:outline-none focus:border-myth-gold w-32 focus:w-48 transition-all"
                                />
                            </div>
                        </div>

                        <div className="overflow-y-auto pr-2 grid grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-max max-h-[400px] lg:max-h-[350px] scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
                            {visibleNodes.length === 0 ? (
                                <div className="col-span-full py-8 text-center text-myth-grey/50 font-mono text-xs">
                                    NO COUNTRIES FOUND // RANGE SCAN EMPTY
                                </div>
                            ) : (
                                visibleNodes.map(nId => {
                                    const neighbor = Object.values(gameState.players).find(p => p.nodeId === nId);
                                    const isSelected = selectedNeighbor === nId;
                                    const unreadCount = unreadCounts[nId] || 0;
                                    return (
                                        <button
                                            key={nId}
                                            onClick={() => {
                                                setSelectedNeighbor(isSelected ? null : nId);
                                                // Auto-open chat on mobile when selecting a node
                                                if (!isSelected && isMobile) {
                                                    setShowMobileChat(true);
                                                }
                                            }}
                                            onDrop={(e) => handleDrop(e, nId)}
                                            onDragOver={(e) => e.preventDefault()}
                                            className={`
                                                h-24 lg:h-20 w-full border-2 flex flex-col items-center justify-center transition-all duration-300 relative touch-target
                                                ${isSelected
                                                    ? 'bg-myth-gold/90 text-myth-black border-myth-gold shadow-[0_0_15px_rgba(255,215,0,0.5)]'
                                                    : 'glass-dark text-myth-grey hover:border-myth-gold hover:text-myth-gold hover:shadow-[0_0_10px_rgba(255,215,0,0.2)]'
                                                }
                                            `}
                                        >
                                            <div className={`font-serif text-base lg:text-lg font-black uppercase ${!isSelected && 'group-hover:animate-pulse'}`}>
                                                COUNTRY {nId}
                                            </div>
                                            <div className={`text-[9px] uppercase font-bold tracking-widest ${isSelected ? 'text-myth-black' : 'text-myth-grey/50'}`}>
                                                {neighbor?.alias || 'OFFLINE'}
                                            </div>
                                            {neighbor?.online && (
                                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_cyan]"></div>
                                            )}
                                            {unreadCount > 0 && (
                                                <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                                                    {unreadCount}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* CHAT TERMINAL */}
                    {selectedNeighbor && !isMobile ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 bg-myth-dark border-b border-myth-grey text-xs font-mono text-myth-grey uppercase flex justify-between shrink-0">
                                <span>SECURE_LINK // COUNTRY_{selectedNeighbor}</span>
                                <span>{gameState.players[Object.keys(gameState.players).find(k => gameState.players[k].nodeId === selectedNeighbor) || '']?.online ? 'ONLINE' : 'OFFLINE'}</span>
                            </div>

                            <ul className="flex-1 overflow-y-auto p-6 space-y-4" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, selectedNeighbor)}>
                                {relevantMessages.map((msg, idx) => {
                                    const isMe = msg.senderId === me.id;
                                    return (
                                        <li key={`${msg.timestamp}-${idx}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-4 border ${isMe ? 'bg-myth-white text-myth-black border-myth-white' : 'bg-black text-myth-white border-myth-grey'}`}>
                                                <p className="text-sm font-bold leading-relaxed">
                                                    {msg.message.startsWith('SYSTEM_TRANSFER|') ? (() => {
                                                        const [, type, id] = msg.message.split('|');
                                                        return (
                                                            <span>
                                                                <span className={isMe ? 'text-myth-red' : 'text-green-400'}>⚡ {isMe ? 'TRANSMITTED' : 'RECEIVED'}</span>
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
                                <div className="p-4 bg-myth-dark border-t border-myth-grey flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-4">
                                        <span className="text-2xl">{getMythicalIcon(pendingAttachment.type)}</span>
                                        <div className="text-xs uppercase">
                                            <span className="block text-myth-grey">Attaching Artifact</span>
                                            <span className="font-bold text-myth-white">{pendingAttachment.type}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setPendingAttachment(null)}>
                                        <X className="text-myth-grey hover:text-myth-white" />
                                    </button>
                                </div>
                            )}

                            {/* INPUT */}
                            <div className="p-6 border-t border-myth-grey bg-myth-black flex gap-0 shrink-0">
                                <button
                                    onClick={() => setShowInventoryModal(true)}
                                    className="p-4 border-2 border-r-0 border-myth-grey hover:bg-myth-grey/20 text-myth-grey transition-colors"
                                >
                                    <Paperclip size={20} />
                                </button>
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                    placeholder="TRANSMIT MESSAGE..."
                                    className="flex-1 bg-myth-black border-2 border-myth-grey p-4 text-myth-white placeholder-myth-grey/50 font-mono focus:outline-none focus:border-myth-white transition-colors uppercase"
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!chatInput.trim() && !pendingAttachment}
                                    className="p-4 border-2 border-l-0 border-myth-grey bg-myth-white text-myth-black hover:bg-myth-light disabled:opacity-50 disabled:cursor-not-allowed font-bold uppercase transition-colors"
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
                                className="w-full max-w-sm py-6 px-8 bg-myth-gold text-myth-black border-2 border-myth-gold hover:bg-myth-white font-black uppercase text-lg tracking-widest transition-colors"
                            >
                                OPEN CHAT
                                <div className="text-xs mt-2 font-mono opacity-75">COUNTRY {selectedNeighbor}</div>
                            </button>
                            {selectedNeighbor && (unreadCounts[selectedNeighbor] ?? 0) > 0 && (
                                <div className="text-sm text-myth-red font-bold uppercase animate-pulse">
                                    {unreadCounts[selectedNeighbor]} New Message{(unreadCounts[selectedNeighbor] ?? 0) === 1 ? '' : 's'}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-myth-grey/30 min-h-0">
                            <AlertCircle size={64} strokeWidth={1} />
                            <p className="mt-4 font-mono text-sm uppercase tracking-widest">Select Country to Establish Link</p>
                        </div>
                    )}
                </main>
            </div>

            {/* ATTACHMENT MODAL */}
            {showInventoryModal && (
                <div className="fixed inset-0 z-[60] bg-myth-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-myth-dark border border-myth-grey p-8 w-full max-w-lg shadow-2xl">
                        <div className="flex justify-between items-center mb-8 border-b border-myth-grey pb-4">
                            <h3 className="text-xl font-black uppercase text-myth-white">Select Artifact</h3>
                            <button onClick={() => setShowInventoryModal(false)} className="text-myth-grey hover:text-myth-white"><X size={24} /></button>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            {me.inventory.length === 0 ? (
                                <div className="col-span-4 text-center py-12 text-myth-grey font-mono">ARTIFACT STORAGE EMPTY</div>
                            ) : (
                                me.inventory.map(token => (
                                    <button
                                        key={token.id}
                                        onClick={() => {
                                            setPendingAttachment(token);
                                            setShowInventoryModal(false);
                                        }}
                                        className="aspect-square bg-myth-black border border-myth-grey hover:border-myth-white flex flex-col items-center justify-center transition-all group touch-target"
                                    >
                                        <span className="text-3xl group-hover:scale-110 transition-transform">{getMythicalIcon(token.type)}</span>
                                        <span className="text-[9px] font-mono text-myth-grey uppercase mt-2">{token.id.split('-')[1]}</span>
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
                    className="fixed top-4 right-4 z-40 w-16 h-16 bg-myth-gold text-myth-black rounded-full shadow-[0_0_20px_rgba(255,215,0,0.5)] hover:scale-110 active:scale-95 transition-transform flex items-center justify-center font-black border-2 border-myth-gold"
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
                <div className="fixed inset-0 z-50 bg-myth-black flex flex-col">
                    {/* MOBILE CHAT HEADER */}
                    <div className="shrink-0 p-4 bg-myth-dark border-b border-myth-grey flex justify-between items-center">
                        <div className="flex-1">
                            <div className="text-xs font-mono text-myth-grey uppercase">Secure Link</div>
                            <div className="text-lg font-black text-myth-white uppercase">COUNTRY {selectedNeighbor}</div>
                            <div className="text-[10px] text-myth-grey font-mono">
                                {gameState.players[Object.keys(gameState.players).find(k => gameState.players[k].nodeId === selectedNeighbor) || '']?.online ? '● ONLINE' : '○ OFFLINE'}
                            </div>
                        </div>
                        <button
                            onClick={() => setShowMobileChat(false)}
                            className="p-3 border border-myth-grey hover:border-myth-white hover:bg-myth-grey/20 transition-colors touch-target"
                        >
                            <X className="text-myth-white" size={24} />
                        </button>
                    </div>

                    {/* MOBILE CHAT MESSAGES - with proper scrolling */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {relevantMessages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-myth-grey/50 text-sm font-mono uppercase">
                                No messages yet
                            </div>
                        ) : (
                            relevantMessages.map((msg, idx) => {
                                const isMe = msg.senderId === me.id;
                                return (
                                    <div key={`${msg.timestamp}-${idx}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-3 border ${isMe ? 'bg-myth-white text-myth-black border-myth-white' : 'bg-myth-dark text-myth-white border-myth-grey'}`}>
                                            <p className="text-sm font-bold leading-relaxed break-words">
                                                {msg.message.startsWith('SYSTEM_TRANSFER|') ? (() => {
                                                    const [, type, id] = msg.message.split('|');
                                                    return (
                                                        <span>
                                                            <span className={isMe ? 'text-myth-red' : 'text-green-400'}>⚡ {isMe ? 'SENT' : 'RECEIVED'}</span>
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
                        <div className="shrink-0 p-3 bg-myth-dark border-t border-myth-grey flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{getMythicalIcon(pendingAttachment.type)}</span>
                                <div className="text-xs uppercase">
                                    <span className="block text-myth-grey">Attaching</span>
                                    <span className="font-bold text-myth-white">{pendingAttachment.type}</span>
                                </div>
                            </div>
                            <button onClick={() => setPendingAttachment(null)} className="p-2 hover:bg-myth-grey/20 transition-colors touch-target">
                                <X className="text-myth-grey hover:text-myth-white" size={20} />
                            </button>
                        </div>
                    )}

                    {/* MOBILE CHAT INPUT */}
                    <div className="shrink-0 p-4 border-t border-myth-grey bg-myth-black safe-area-bottom">
                        <div className="flex gap-2 mb-3">
                            <button
                                onClick={() => setShowInventoryModal(true)}
                                className="px-4 py-3 border-2 border-myth-grey hover:bg-myth-grey/20 text-myth-grey transition-colors touch-target flex items-center gap-2"
                            >
                                <Paperclip size={18} />
                                <span className="text-xs font-bold uppercase">Attach</span>
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                placeholder="TYPE MESSAGE..."
                                className="flex-1 bg-myth-dark border-2 border-myth-grey p-3 text-myth-white placeholder-myth-grey/50 font-mono focus:outline-none focus:border-myth-gold transition-colors text-sm"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!chatInput.trim() && !pendingAttachment}
                                className="px-6 py-3 border-2 border-myth-gold bg-myth-gold text-myth-black hover:bg-myth-white disabled:opacity-50 disabled:cursor-not-allowed font-black uppercase text-sm transition-colors touch-target"
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
                        background: '#0a0a0a',
                        color: '#fff',
                        border: '2px solid #555',
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        fontWeight: 'bold',
                    },
                    success: {
                        iconTheme: {
                            primary: '#FFD700',
                            secondary: '#0a0a0a',
                        },
                    },
                }}
            />



            {/* COMPLETION MODAL */}
            {showCompletionModal && (
                <div className="fixed inset-0 z-[100] bg-myth-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-500">
                    <div className="bg-myth-dark border-2 border-myth-gold p-8 max-w-lg w-full shadow-[0_0_50px_rgba(255,215,0,0.2)] text-center relative overflow-hidden">

                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-myth-gold to-transparent"></div>
                        <div className="absolute -top-20 -right-20 w-40 h-40 bg-myth-gold/10 rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-myth-gold/10 rounded-full blur-3xl"></div>

                        <div className="relative z-10">
                            <div className="mb-6 inline-block p-4 rounded-full bg-myth-gold/10 border border-myth-gold/30">
                                <span className="text-6xl">🏆</span>
                            </div>

                            <h2 className="text-3xl lg:text-4xl font-black uppercase text-myth-gold mb-2 tracking-tighter glitch-text">
                                Contract Fulfilled
                            </h2>
                            <p className="text-myth-grey font-mono text-sm uppercase tracking-widest mb-8">
                                Zero-Sum Ascension Achieved
                            </p>

                            <div className="bg-black/50 border border-myth-grey/50 p-6 mb-8">
                                <span className="block text-xs text-myth-grey uppercase mb-2">Completion Time</span>
                                <span className="text-2xl font-mono text-white font-bold">
                                    {me.completionTime ? new Date(me.completionTime).toLocaleTimeString() : '--:--:--'}
                                </span>
                            </div>

                            <button
                                onClick={() => setShowCompletionModal(false)}
                                className="w-full py-4 bg-myth-gold text-myth-black font-black uppercase text-lg tracking-widest hover:bg-white hover:scale-105 transition-all duration-300 shadow-lg"
                            >
                                Continue To Observe
                            </button>
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
