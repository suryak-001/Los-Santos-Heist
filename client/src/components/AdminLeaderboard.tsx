import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import type { LeaderboardState, LeaderboardEntry } from '../types/game';
import { Plus, Trash2, Save, ArrowUp, ArrowDown } from 'lucide-react';

interface AdminLeaderboardProps {
    socket: Socket;
}

const AdminLeaderboard: React.FC<AdminLeaderboardProps> = ({ socket }) => {
    const [state, setState] = useState<LeaderboardState>({ round: 1, entries: [] });
    const [newEntry, setNewEntry] = useState<Partial<LeaderboardEntry>>({ name: '', country: '', status: 'ACTIVE' });

    useEffect(() => {
        socket.emit('get_leaderboard');
        const onUpdate = (newState: LeaderboardState) => setState(newState);
        socket.on('leaderboard_update', onUpdate);
        return () => { socket.off('leaderboard_update', onUpdate); };
    }, [socket]);

    const handleSave = () => {
        // Re-calculate ranks based on order
        const updatedEntries = state.entries.map((e, index) => ({
            ...e,
            rank: index + 1
        }));
        const newState = { ...state, entries: updatedEntries };
        socket.emit('update_leaderboard', newState);
    };

    const addEntry = () => {
        if (!newEntry.name) return;
        const entry: LeaderboardEntry = {
            id: Date.now().toString(),
            name: newEntry.name,
            rank: state.entries.length + 1,
            score: 0,
            country: newEntry.country || 'UNKNOWN',
            status: newEntry.status || 'ACTIVE'
        };
        setState(prev => ({ ...prev, entries: [...prev.entries, entry] }));
        setNewEntry({ name: '', country: '', status: 'ACTIVE' });
    };

    const removeEntry = (id: string) => {
        setState(prev => ({
            ...prev,
            entries: prev.entries.filter(e => e.id !== id)
        }));
    };

    const moveEntry = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === state.entries.length - 1) return;

        const newEntries = [...state.entries];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // Swap
        [newEntries[index], newEntries[targetIndex]] = [newEntries[targetIndex], newEntries[index]];

        setState(prev => ({ ...prev, entries: newEntries }));
    };

    return (
        <div className="space-y-8 p-6 glass-panel">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-myth-white uppercase">Leaderboard Manager</h2>
                <div className="flex gap-4 items-center">
                    <label htmlFor="round-input" className="text-xs font-bold text-myth-grey">CURRENT ROUND</label>
                    <input
                        id="round-input"
                        type="number"
                        value={state.round}
                        onChange={(e) => setState(prev => ({ ...prev, round: Number.parseInt(e.target.value) || 1 }))}
                        className="bg-myth-black border border-myth-grey w-16 p-2 text-center font-mono"
                    />
                    <button onClick={handleSave} className="btn-primary flex items-center gap-2">
                        <Save size={16} /> SAVE CHANGES
                    </button>
                </div>
            </div>

            {/* ADD NEW */}
            <div className="grid grid-cols-12 gap-2 bg-myth-dark p-4 border border-myth-grey/30">
                <div className="col-span-4">
                    <input
                        placeholder="PLAYER NAME"
                        value={newEntry.name}
                        onChange={e => setNewEntry(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-myth-black border border-myth-grey p-2 text-sm"
                    />
                </div>
                <div className="col-span-3">
                    <input
                        placeholder="COUNTRY / NODE"
                        value={newEntry.country}
                        onChange={e => setNewEntry(prev => ({ ...prev, country: e.target.value }))}
                        className="w-full bg-myth-black border border-myth-grey p-2 text-sm"
                    />
                </div>
                <div className="col-span-3">
                    <select
                        value={newEntry.status}
                        onChange={e => setNewEntry(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full bg-myth-black border border-myth-grey p-2 text-sm text-myth-white"
                    >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="ELIMINATED">ELIMINATED</option>
                        <option value="WINNER">WINNER</option>
                    </select>
                </div>
                <div className="col-span-2">
                    <button onClick={addEntry} className="w-full bg-myth-gold text-myth-black font-bold p-2 text-sm hover:bg-white transition-colors flex justify-center items-center gap-1">
                        <Plus size={14} /> ADD
                    </button>
                </div>
            </div>

            {/* LIST */}
            <div className="space-y-2">
                {state.entries.map((entry, index) => (
                    <div key={entry.id} className="grid grid-cols-12 gap-2 items-center bg-myth-black/50 p-3 border border-myth-grey/20">
                        <div className="col-span-1 text-center font-mono text-myth-grey">#{index + 1}</div>
                        <div className="col-span-4 font-bold">{entry.name}</div>
                        <div className="col-span-3 text-sm text-myth-grey">{entry.country}</div>
                        <div className="col-span-2">
                            <button
                                onClick={() => {
                                    const newStatus = entry.status === 'ELIMINATED' ? 'ACTIVE' : 'ELIMINATED';

                                    // 1. Update status
                                    let updatedEntries = state.entries.map(e =>
                                        e.id === entry.id ? { ...e, status: newStatus } : e
                                    );

                                    // 2. Sort: Active/Winner first, Eliminated last
                                    updatedEntries.sort((a, b) => {
                                        const isElimA = a.status === 'ELIMINATED';
                                        const isElimB = b.status === 'ELIMINATED';
                                        if (isElimA === isElimB) return 0;
                                        return isElimA ? 1 : -1;
                                    });

                                    // 3. Re-assign Ranks immediately
                                    updatedEntries = updatedEntries.map((e, idx) => ({
                                        ...e,
                                        rank: idx + 1
                                    }));

                                    // 4. Update State & Auto-Save
                                    const newState = { ...state, entries: updatedEntries };
                                    setState(newState);
                                    socket.emit('update_leaderboard', newState);
                                }}
                                className={`text-xs font-mono px-2 py-1 border ${entry.status === 'ELIMINATED'
                                    ? 'border-myth-red text-myth-red hover:bg-myth-red/10'
                                    : 'border-myth-gold text-myth-gold hover:bg-myth-gold/10'
                                    }`}
                            >
                                {entry.status || 'ACTIVE'}
                            </button>
                        </div>
                        <div className="col-span-2 flex justify-end gap-1">
                            <button onClick={() => moveEntry(index, 'up')} className="p-1 hover:text-myth-gold" disabled={index === 0}><ArrowUp size={14} /></button>
                            <button onClick={() => moveEntry(index, 'down')} className="p-1 hover:text-myth-gold" disabled={index === state.entries.length - 1}><ArrowDown size={14} /></button>
                            <button onClick={() => removeEntry(entry.id)} className="p-1 hover:text-myth-red ml-2"><Trash2 size={14} /></button>
                        </div>
                    </div>
                ))}
            </div>

            {state.entries.length === 0 && (
                <div className="text-center text-myth-grey font-mono py-8">NO ENTRIES. ADD PLAYERS ABOVE.</div>
            )}
        </div>
    );
};

export default AdminLeaderboard;
