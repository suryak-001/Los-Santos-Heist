import React from 'react';
import type { GameState, NodeId, Player } from '../types/game';
import { NODES, NODE_POSITIONS, MAP_WIDTH, MAP_HEIGHT } from '../topology';

interface CityMapProps {
    gameState: GameState;
    me: Player;
    selected: NodeId | null;
    unreadCounts: Partial<Record<NodeId, number>>;
    canHandTo: (nodeId: NodeId) => boolean;
    onSelect: (nodeId: NodeId) => void;
    onDropToken: (e: React.DragEvent, nodeId: NodeId) => void;
}

// Each road once, as [lower id, higher id]
const ROADS: [NodeId, NodeId][] = Object.values(NODES).flatMap(node =>
    node.neighbors
        .filter(n => Number(n) > Number(node.id))
        .map(n => [node.id, n] as [NodeId, NodeId])
);

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

// The whole city: every district and road. Own district is highlighted, districts
// the player can hand loot to are "deliverable", the rest are dimmed but still
// open for chat.
const CityMap: React.FC<CityMapProps> = ({ gameState, me, selected, unreadCounts, canHandTo, onSelect, onDropToken }) => {
    const playerAt = (nodeId: NodeId) => Object.values(gameState.players).find(p => p.nodeId === nodeId);

    return (
        <div className="relative w-full" style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}>
            <svg
                className="absolute inset-0 w-full h-full"
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                aria-hidden="true"
            >
                {ROADS.map(([a, b]) => {
                    const mine = a === me.nodeId || b === me.nodeId;
                    const line = {
                        x1: NODE_POSITIONS[a].x, y1: NODE_POSITIONS[a].y,
                        x2: NODE_POSITIONS[b].x, y2: NODE_POSITIONS[b].y,
                    };
                    return mine ? (
                        <g key={`${a}-${b}`}>
                            {/* Soft glow under your own roads, with traffic flowing along them */}
                            <line {...line} className="stroke-heist-sun/25" strokeWidth={12} strokeLinecap="round" />
                            <line {...line} className="stroke-heist-sun" strokeWidth={4} strokeLinecap="round" />
                            <line {...line} className="stroke-heist-white/70 animate-road-flow" strokeWidth={2} strokeLinecap="round" strokeDasharray="4 14" />
                        </g>
                    ) : (
                        <line key={`${a}-${b}`} {...line} className="stroke-heist-grey/35" strokeWidth={3} strokeLinecap="round" strokeDasharray="10 8" />
                    );
                })}
            </svg>

            {Object.values(NODES).map(node => {
                const pos = NODE_POSITIONS[node.id];
                const occupant = playerAt(node.id);
                const isMine = node.id === me.nodeId;
                const deliverable = !isMine && canHandTo(node.id);
                const isSelected = selected === node.id;
                const unread = unreadCounts[node.id] ?? 0;

                const tone = isMine
                    ? 'bg-gradient-to-b from-heist-gold to-heist-sun text-heist-black border-heist-gold shadow-glow-gold'
                    : isSelected
                        ? 'bg-heist-white text-heist-black border-heist-white shadow-[0_0_18px_rgba(255,255,255,0.45)]'
                        : deliverable
                            ? 'bg-heist-black/80 backdrop-blur-sm text-heist-white border-heist-pink animate-district-glow'
                            : 'bg-heist-black/70 backdrop-blur-sm text-heist-grey border-white/15 opacity-75 hover:opacity-100 hover:border-white/40';

                return (
                    <button
                        key={node.id}
                        type="button"
                        disabled={isMine || !occupant}
                        onClick={() => onSelect(node.id)}
                        onDragOver={(e) => { if (!isMine) e.preventDefault(); }}
                        onDrop={(e) => onDropToken(e, node.id)}
                        aria-pressed={isSelected}
                        aria-label={`${node.label}${occupant ? `, ${occupant.alias}` : ', vacant'}${deliverable ? ', deliverable' : ''}${unread ? `, ${unread} unread` : ''}`}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 min-w-[13%] max-w-[20%] min-h-[2.75rem] px-1.5 py-1 border-2 rounded-xl flex flex-col items-center justify-center leading-tight transition-[transform,opacity,border-color,background-color] duration-200 ease-out disabled:cursor-default enabled:hover:scale-105 enabled:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heist-cyan ${tone} ${isSelected && !isMine ? 'ring-2 ring-offset-2 ring-offset-heist-black ring-heist-white scale-105' : ''}`}
                        style={{ left: pct(pos.x, MAP_WIDTH), top: pct(pos.y, MAP_HEIGHT) }}
                    >
                        {/* Radar ping: this district can take your loot */}
                        {deliverable && !isSelected && (
                            <span className="absolute inset-0 rounded-xl border-2 border-heist-pink pointer-events-none animate-district-ping" aria-hidden="true" />
                        )}
                        <span className="font-display text-[7px] sm:text-[10px] lg:text-[11px] uppercase break-words text-center tracking-normal sm:tracking-wide">
                            {node.label}
                        </span>
                        <span className="hidden sm:block text-[8px] lg:text-[9px] font-mono tabular opacity-70">
                            {isMine ? 'YOU' : occupant?.alias ?? 'VACANT'}
                        </span>

                        {occupant?.online && !isMine && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-heist-cyan shadow-glow-cyan" />
                        )}
                        {unread > 0 && (
                            <span className="absolute -top-2 -left-2 bg-heist-pink text-white text-[10px] font-mono font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-glow-pink animate-slide-up">
                                {unread}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default CityMap;
