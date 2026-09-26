import React, { useState, useMemo } from 'react';
import type { GameState, Player, Facilitation, Transaction } from '../types/game';
import { Trophy, Clock, Users, TrendingUp, X, ArrowUpDown } from 'lucide-react';

interface AdminStatsProps {
    gameState: GameState;
}

type SortField = 'alias' | 'score' | 'completionTime' | 'facilitationCount';
type SortOrder = 'asc' | 'desc';

const AdminStats: React.FC<AdminStatsProps> = ({ gameState }) => {
    const [sortField, setSortField] = useState<SortField>('score');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

    // Force update every second
    const [currentTime, setCurrentTime] = useState(0);

    React.useEffect(() => {
        setCurrentTime(Date.now());
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Get all active players (non-admin)
    const players = useMemo(() => {
        return Object.values(gameState.players)
            .filter(p => p.alias !== 'admin' && p.nodeId)
            .sort((a, b) => {
                let comparison = 0;

                switch (sortField) {
                    case 'alias':
                        comparison = a.alias.localeCompare(b.alias);
                        break;
                    case 'score':
                        comparison = (a.score || 0) - (b.score || 0);
                        break;
                    case 'completionTime': {
                        const aTime = a.completionTime || Number.MAX_SAFE_INTEGER;
                        const bTime = b.completionTime || Number.MAX_SAFE_INTEGER;
                        comparison = aTime - bTime;
                        break;
                    }
                    case 'facilitationCount':
                        comparison = (a.facilitationCount || 0) - (b.facilitationCount || 0);
                        break;
                }

                return sortOrder === 'asc' ? comparison : -comparison;
            });
    }, [gameState.players, sortField, sortOrder]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder(field === 'completionTime' ? 'asc' : 'desc');
        }
    };

    const formatTime = (timestamp: number | null) => {
        if (!timestamp || !gameState.startTime) return 'N/A';
        const elapsed = timestamp - gameState.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    };

    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString();
    };

    // Get facilitations for a specific player
    const getPlayerFacilitations = (playerId: string): Facilitation[] => {
        return gameState.facilitations.filter(f => f.facilitatorId === playerId);
    };

    // Get transactions for a specific player
    const getPlayerTransactions = (nodeId: string): Transaction[] => {
        return gameState.transactions.filter(t => t.from === nodeId || t.to === nodeId);
    };

    // Get trading partners for a player
    const getTradingPartners = (nodeId: string): string[] => {
        const partners = new Set<string>();
        gameState.transactions.forEach(t => {
            if (t.from === nodeId) partners.add(t.to);
            if (t.to === nodeId) partners.add(t.from);
        });
        partners.delete('SYSTEM');
        return Array.from(partners);
    };

    return (
        <div className="h-full flex flex-col">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-myth-dark border-b border-myth-grey">
                <div className="flex items-center gap-3">
                    <Trophy className="text-myth-gold" size={24} />
                    <div>
                        <div className="text-xs text-myth-grey uppercase">Total Players</div>
                        <div className="text-2xl font-bold text-myth-white">{players.length}</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <TrendingUp className="text-green-400" size={24} />
                    <div>
                        <div className="text-xs text-myth-grey uppercase">Completed</div>
                        <div className="text-2xl font-bold text-myth-white">
                            {players.filter(p => p.completionTime).length}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Users className="text-blue-400" size={24} />
                    <div>
                        <div className="text-xs text-myth-grey uppercase">Facilitations</div>
                        <div className="text-2xl font-bold text-myth-white">
                            {gameState.facilitations.filter(f => f.helpedContractCompletion).length}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Clock className="text-purple-400" size={24} />
                    <div>
                        <div className="text-xs text-myth-grey uppercase">Stage</div>
                        <div className="text-2xl font-bold text-myth-white">{gameState.stage}</div>
                    </div>
                </div>
            </div>

            {/* Player Table */}
            <div className="flex-1 overflow-auto p-4">
                <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-myth-dark">
                        <tr className="border-b-2 border-myth-gold">
                            <th className="text-left p-3 text-xs uppercase text-myth-grey font-bold">Rank</th>
                            <th
                                className="text-left p-3 text-xs uppercase text-myth-grey font-bold cursor-pointer hover:text-myth-gold transition-colors"
                                onClick={() => toggleSort('alias')}
                            >
                                <div className="flex items-center gap-2">
                                    Player <ArrowUpDown size={12} />
                                </div>
                            </th>
                            <th
                                className="text-right p-3 text-xs uppercase text-myth-grey font-bold cursor-pointer hover:text-myth-gold transition-colors"
                                onClick={() => toggleSort('score')}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    Score <ArrowUpDown size={12} />
                                </div>
                            </th>
                            <th
                                className="text-right p-3 text-xs uppercase text-myth-grey font-bold cursor-pointer hover:text-myth-gold transition-colors"
                                onClick={() => toggleSort('completionTime')}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    Time <ArrowUpDown size={12} />
                                </div>
                            </th>
                            <th
                                className="text-right p-3 text-xs uppercase text-myth-grey font-bold cursor-pointer hover:text-myth-gold transition-colors"
                                onClick={() => toggleSort('facilitationCount')}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    Facilitations <ArrowUpDown size={12} />
                                </div>
                            </th>
                            <th className="text-center p-3 text-xs uppercase text-myth-grey font-bold">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {players.map((player, index) => (
                            <tr
                                key={player.id}
                                className="border-b border-myth-grey/30 hover:bg-myth-grey/10 cursor-pointer transition-colors"
                                onClick={() => setSelectedPlayer(player)}
                            >
                                <td className="p-3 text-myth-white font-mono">{index + 1}</td>
                                <td className="p-3 text-myth-white font-bold">{player.alias}</td>
                                <td className="p-3 text-right text-myth-gold font-bold text-lg">{player.score}</td>
                                <td className="p-3 text-right text-myth-white font-mono text-sm">
                                    {player.completionTime
                                        ? formatTime(player.completionTime)
                                        : gameState.startTime
                                            ? <span className="text-yellow-500 animate-pulse">{formatTime(currentTime)}</span>
                                            : <span className="text-gray-600">--:--</span>
                                    }
                                </td>
                                <td className="p-3 text-right text-green-400 font-bold">
                                    {player.facilitationCount || 0}
                                </td>
                                <td className="p-3 text-center">
                                    {player.completionTime ? (
                                        <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                                            COMPLETE
                                        </span>
                                    ) : (
                                        gameState.startTime
                                            ? <span className="px-2 py-1 bg-yellow-600 text-white text-xs font-bold rounded animate-pulse">RUNNING</span>
                                            : <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs font-bold rounded">WAITING</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Detailed Player Modal */}
            {selectedPlayer && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-myth-black border-2 border-myth-gold w-full max-w-4xl max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-myth-grey flex justify-between items-center bg-myth-dark">
                            <div>
                                <h2 className="text-2xl font-black text-myth-white">{selectedPlayer.alias}</h2>
                                <div className="text-sm text-myth-grey">Country {selectedPlayer.nodeId} Analytics</div>
                            </div>
                            <button
                                onClick={() => setSelectedPlayer(null)}
                                className="p-2 hover:bg-myth-grey/20 transition-colors"
                            >
                                <X className="text-myth-grey" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-4 space-y-4">
                            {/* Stats Summary */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-3 border border-myth-grey bg-myth-dark">
                                    <div className="text-xs text-myth-grey uppercase">Final Score</div>
                                    <div className="text-3xl font-black text-myth-gold">{selectedPlayer.score}</div>
                                </div>
                                <div className="p-3 border border-myth-grey bg-myth-dark">
                                    <div className="text-xs text-myth-grey uppercase">Completion Time</div>
                                    <div className="text-xl font-bold text-myth-white">
                                        {selectedPlayer.completionTime
                                            ? formatTime(selectedPlayer.completionTime)
                                            : gameState.startTime
                                                ? <span className="text-yellow-500">{formatTime(currentTime)} (Running)</span>
                                                : 'Pending Start'
                                        }
                                    </div>
                                </div>
                                <div className="p-3 border border-myth-grey bg-myth-dark">
                                    <div className="text-xs text-myth-grey uppercase">Facilitations</div>
                                    <div className="text-3xl font-black text-green-400">{selectedPlayer.facilitationCount || 0}</div>
                                </div>
                            </div>

                            {/* Facilitations */}
                            {getPlayerFacilitations(selectedPlayer.nodeId!).length > 0 && (
                                <div>
                                    <h3 className="text-sm uppercase font-bold text-myth-gold mb-2">Facilitations Made</h3>
                                    <div className="space-y-2">
                                        {getPlayerFacilitations(selectedPlayer.nodeId!).map(f => (
                                            <div key={f.id} className="p-3 border border-myth-grey bg-myth-dark/50">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="text-myth-white font-mono text-sm">
                                                            Country {f.fromNodeId} → <span className="text-myth-gold">Country {f.facilitatorId}</span> → Country {f.toNodeId}
                                                        </div>
                                                        <div className="text-xs text-myth-grey mt-1">
                                                            {f.tokenType} ({f.tokenId})
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-myth-grey">{formatTimestamp(f.timestamp)}</div>
                                                        {f.helpedContractCompletion && (
                                                            <div className="text-xs text-green-400 mt-1 font-bold">+100 pts</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Transactions */}
                            <div>
                                <h3 className="text-sm uppercase font-bold text-myth-gold mb-2">Transaction History</h3>
                                <div className="space-y-1 max-h-64 overflow-auto">
                                    {getPlayerTransactions(selectedPlayer.nodeId!).map(t => (
                                        <div key={t.id} className="p-2 border border-myth-grey/30 bg-myth-dark/30 text-xs">
                                            <span className="text-myth-white font-mono">
                                                {t.from === selectedPlayer.nodeId ? (
                                                    <span className="text-red-400">SENT</span>
                                                ) : (
                                                    <span className="text-green-400">RECEIVED</span>
                                                )}
                                            </span>
                                            <span className="text-myth-grey mx-2">•</span>
                                            <span className="text-myth-white">{t.type}</span>
                                            <span className="text-myth-grey mx-2">•</span>
                                            <span className="text-myth-grey">
                                                {t.from === selectedPlayer.nodeId ? `To Country ${t.to}` : `From Country ${t.from}`}
                                            </span>
                                            <span className="text-myth-grey mx-2">•</span>
                                            <span className="text-myth-grey text-[10px]">{formatTimestamp(t.timestamp)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Trading Partners */}
                            <div>
                                <h3 className="text-sm uppercase font-bold text-myth-gold mb-2">Trading Partners</h3>
                                <div className="flex flex-wrap gap-2">
                                    {getTradingPartners(selectedPlayer.nodeId!).map(partnerId => (
                                        <div key={partnerId} className="px-3 py-1 border border-myth-grey bg-myth-dark text-myth-white font-mono text-sm">
                                            Country {partnerId}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminStats;
