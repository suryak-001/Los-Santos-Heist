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
                    return (
                        <line
                            key={`${a}-${b}`}
                            x1={NODE_POSITIONS[a].x} y1={NODE_POSITIONS[a].y}
                            x2={NODE_POSITIONS[b].x} y2={NODE_POSITIONS[b].y}
                            className={mine ? 'stroke-myth-gold' : 'stroke-myth-grey/40'}
                            strokeWidth={mine ? 5 : 3}
                            strokeLinecap="round"
                            strokeDasharray={mine ? undefined : '10 8'}
                        />
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
                    ? 'bg-myth-gold text-myth-black border-myth-gold'
                    : isSelected
                        ? 'bg-myth-white text-myth-black border-myth-white'
                        : deliverable
                            ? 'bg-myth-black/85 text-myth-white border-myth-red shadow-[0_0_14px_var(--glow)]'
                            : 'bg-myth-black/70 text-myth-grey border-myth-grey/40 opacity-70 hover:opacity-100';

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
                        className={`absolute -translate-x-1/2 -translate-y-1/2 w-[17%] min-h-[2.75rem] px-1 py-1 border-2 rounded-md flex flex-col items-center justify-center leading-tight transition-all disabled:cursor-default enabled:hover:scale-105 ${tone} ${isSelected && !isMine ? 'ring-2 ring-offset-2 ring-offset-myth-black ring-myth-white' : ''}`}
                        style={{ left: pct(pos.x, MAP_WIDTH), top: pct(pos.y, MAP_HEIGHT) }}
                    >
                        <span className="font-serif text-[9px] sm:text-[11px] lg:text-xs uppercase break-words text-center">
                            {node.label}
                        </span>
                        <span className="hidden sm:block text-[8px] lg:text-[9px] font-mono opacity-70">
                            {isMine ? 'YOU' : occupant?.alias ?? 'VACANT'}
                        </span>

                        {occupant?.online && !isMine && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_cyan]" />
                        )}
                        {unread > 0 && (
                            <span className="absolute -top-2 -left-2 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
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
