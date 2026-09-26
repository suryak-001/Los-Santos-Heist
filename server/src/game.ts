import { leaderboardManager } from './leaderboard';
import { GameState, Player, ResourceType, NodeId, ResourceToken, RaidState } from './types/game';
import { NODES } from './topology';
import { PrismaClient } from '@prisma/client';
import fs from 'fs-extra';
import path from 'node:path';

const prisma = new PrismaClient();

// Tests point this elsewhere so they don't overwrite the saved game
const STATE_PATH = process.env.GAME_STATE_PATH || path.join(__dirname, '../gameState.json');
const RESOURCE_TYPES: ResourceType[] = ['Trishula', 'Gandiva', 'Vajra', 'Brahmastra'];
const RAID_TARGETS = 3;
const NO_RAID = (): RaidState => ({ done: false, time: null, districts: [], seized: [] });

export class GameManager {
    private state: GameState;

    constructor() {
        this.state = {
            phase: 'LOBBY',
            stage: 1,
            paused: false,
            pausedAt: null,
            totalPausedMs: 0,
            config: {
                totalResources: null,
                resourcesPerPlayer: 3
            },
            players: {},
            messages: [],
            startTime: null,
            transactions: [], // LOG
            facilitations: [], // Track facilitations
            currentSessionId: null,
            raid: NO_RAID(),
            lottery: {
                candidates: [],
                winner: null,
                isRolling: false,
                roundTitle: 'General Sacrifice',
                pastWinners: []
            },
            timer: {
                endTime: null,
                remainingWhenPaused: null,
                isRunning: false,
                durationMinutes: 10 // Default 10 minutes
            }
        };
    }

    public getState(): GameState {
        return this.state;
    }

    // --- PERSISTENCE ---
    private async saveState() {
        try {
            // We exclude 'messages' or keep them? User said "should not be lost".
            // We'll save the whole state except maybe 'players[].id' socket mapping if we want to force reconnect?
            // Actually, preserving socket IDs is fine, logic handles reclamation.
            await fs.writeJSON(STATE_PATH, this.state, { spaces: 2 });
        } catch (error) {
            console.error('[GAME] Failed to save state:', error);
        }
    }

    public async init() {
        try {
            if (await fs.pathExists(STATE_PATH)) {
                const savedState = await fs.readJSON(STATE_PATH);

                // Merge logic: ensure structure compatibility
                // We keep 'paused' state? Yes.
                // We restart 'phase' if needed? User wants persistence.

                // IMPORTANT: Reset online status on reload since sockets are disconnected
                Object.values(savedState.players as Record<string, Player>).forEach(p => {
                    p.online = false;
                });

                this.state = { ...this.state, ...savedState };
                console.log('[GAME] State loaded from persistence.');
            }
        } catch (error) {
            console.error('[GAME] Failed to load state:', error);
        }
    }

    // --- CONFIGURATION ---
    public updateConfig(config: Partial<import('./types/game').GameConfig>) {
        if (this.state.phase === 'ACTIVE') return; // Lock config during game
        this.state.config = { ...this.state.config, ...config };
        this.saveState();
    }

    // --- AUTHENTICATION ---
    public addPlayer(id: string, alias: string, password?: string): { success: boolean, player?: Player, error?: string } {
        // ... (Existing logic) ...
        // We'll inject saveState() calls at return points where state changes

        // ADMIN
        if (alias.toLowerCase() === 'admin') {
            // ...
            // this.state.players[id] = admin; (Lines 71)
            // return ...
        }

        // ...

        // EXISTING PLAYER FIX 
        // ...
        // this.state.players[id] = existingOwner; (Line 102)
        // this.saveState(); // Add this
        // return ...

        // NEW PLAYER
        // ...
        // this.state.players[id] = player; (Line 124)
        // this.saveState(); // Add this
        // return ...

        // RE-IMPLEMENTING addPlayer to include saveState() properly:

        // ADMIN
        if (alias.toLowerCase() === 'admin') {
            const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'scarcity123_CHANGE_ME_NOW';
            if (password !== ADMIN_PASSWORD) return { success: false, error: 'Invalid Password' };
            const admin: Player = {
                id, alias: 'admin', nodeId: null,
                inventory: [],
                contract: { Trishula: 0, Gandiva: 0, Vajra: 0, Brahmastra: 0 },
                score: 0,
                isReady: false,
                online: true,
                completionTime: null,
                completionBonus: null,
                facilitationCount: 0,
                facilitatedTransfers: []
            };
            this.state.players[id] = admin;
            this.saveState();
            return { success: true, player: admin };
        }

        const regex = /^TT_BM_(\d+)$/i;
        const match = regex.exec(alias);
        if (!match) return { success: false, error: 'Invalid Format. Use TT_BM_[NodeID] (e.g., TT_BM_5)' };

        const nodeId = match[1] as NodeId;
        if (!NODES[nodeId]) return { success: false, error: `Node ${nodeId} does not exist.` };

        const existingOwner = Object.values(this.state.players).find(p => p.nodeId === nodeId);

        if (existingOwner) {
            if (existingOwner.id === id) return { success: true, player: existingOwner };

            delete this.state.players[existingOwner.id];
            existingOwner.id = id;
            existingOwner.online = true;
            this.state.players[id] = existingOwner;

            console.log(`[GAME] Session Reclaimed: ${alias} (${id})`);
            this.saveState();
            return { success: true, player: existingOwner };
        }

        const player: Player = {
            id,
            alias: alias.toUpperCase(),
            nodeId,
            inventory: [],
            contract: { Trishula: 0, Gandiva: 0, Vajra: 0, Brahmastra: 0 },
            score: 0,
            isReady: false,
            online: true,
            completionTime: null,
            completionBonus: null,
            facilitationCount: 0,
            facilitatedTransfers: []
        };

        this.state.players[id] = player;
        this.saveState();
        return { success: true, player };
    }

    public removePlayer(id: string) {
        if (this.state.players[id]) {
            this.state.players[id].online = false;
            this.saveState();
        }
    }

    public kickPlayer(id: string) {
        if (this.state.players[id]) {
            delete this.state.players[id];
            this.saveState();
        }
    }

    // --- GAME START ---
    public async startGame() {
        if (this.state.phase === 'ACTIVE') return;

        this.state.phase = 'ACTIVE';
        this.state.startTime = Date.now();
        this.state.paused = false;
        this.state.pausedAt = null;
        this.state.totalPausedMs = 0;
        this.state.raid = NO_RAID();
        this.distributeEconomy();
        this.saveState();

        // PERSISTENCE (DB) ... (Existing DB logic check: can it run if game persisted?)
        // If we load from file, we might already have session ID?
        // We should skip creating NEW session if one exists? 
        // Actually this.startGame only called if phase != ACTIVE.
        // If we load state and phase is ACTIVE, this won't be called. Correct.

        // ... (Keep existing DB log logic)
        try {
            const session = await prisma.gameSession.create({
                data: {
                    startTime: new Date(),
                    status: 'ACTIVE'
                }
            });
            this.state.currentSessionId = session.id;
            console.log(`[DB] Game Session Started: ${session.id}`);

            // Log initial players
            const participants = Object.values(this.state.players).filter(p => p.nodeId);
            for (const p of participants) {
                const dbPlayer = await prisma.player.create({
                    data: {
                        alias: p.alias,
                        nodeId: Number(p.nodeId),
                        gameSessionId: session.id
                    }
                });
                // Update in-memory player with DB ID for future reference
                if (this.state.players[p.id]) {
                    this.state.players[p.id].dbId = dbPlayer.id;
                }
            }

        } catch (error) {
            console.error('[DB] Failed to start session:', error);
        }
    }

    // ... (distributeEconomy no changes needed if called by startGame)

    public setStage(stage: 1 | 2) {
        this.state.stage = stage;
        this.saveState();
    }

    public transferResource(senderId: string, targetNodeId: NodeId, tokenId: string): { success: boolean, msg?: string } {
        // ... (Existing checks)
        if (this.state.phase !== 'ACTIVE') return { success: false, msg: 'Game is NOT ACTIVE.' };
        if (this.state.paused) return { success: false, msg: 'Game is PAUSED.' };
        const sender = this.state.players[senderId];
        if (!sender?.nodeId) return { success: false, msg: 'Not logged in' };

        if (this.state.stage === 1) {
            if (!NODES[sender.nodeId].neighbors.includes(targetNodeId)) {
                return { success: false, msg: 'Target is not a neighbor (Phase 1 Restriction)' };
            }
        } else if (sender.nodeId === targetNodeId) {
            return { success: false, msg: 'Cannot transfer to self' };
        }

        const target = Object.values(this.state.players).find(p => p.nodeId === targetNodeId);
        if (!target) return { success: false, msg: 'Target node empty' };

        const tokenIndex = sender.inventory.findIndex(t => t.id === tokenId);
        if (tokenIndex === -1) return { success: false, msg: 'Token not found' };

        const [token] = sender.inventory.splice(tokenIndex, 1);

        const targetHeldBefore = token.history.includes(target.alias);

        token.history.push(target.alias);
        target.inventory.push(token);

        const paidFixers = this.settleFixersCut(token, sender, target, targetHeldBefore);
        paidFixers.forEach(f => f.score = this.calculateScore(f));

        // Completion first, so a fresh completion scores with its time bonus
        this.updateCompletion(sender);
        this.updateCompletion(target);
        sender.score = this.calculateScore(sender);
        target.score = this.calculateScore(target);

        // PERSISTENCE (Update Player Stats)
        this.persistPlayerStats([sender, target, ...paidFixers]);

        this.state.transactions.push({
            id: Math.random().toString(36).substring(2, 11),
            timestamp: Date.now(),
            tokenId: token.id,
            from: sender.nodeId,
            to: targetNodeId,
            type: token.type
        });

        const transferMsg: import('./types/game').ChatMessage = {
            senderId: sender.id,
            senderAlias: sender.alias,
            receiverId: target.id,
            message: `SYSTEM_TRANSFER|${token.type}|${token.id}`,
            timestamp: Date.now()
        };

        this.state.messages.push(transferMsg);

        // PERSISTENCE (DB Transaction Log)
        this.persistTransaction(sender, targetNodeId, token);

        // SAVE STATE
        this.saveState();

        // SYNC LEADERBOARD? We should update Leaderboard with new scores?
        // LeaderboardManager updates entries based on current players if needed?
        // Actually LeaderboardManager usually holds its own state. 
        // We should explicitly update it here or let it be separate?
        // "Leadearboard also should be updated" suggests we should sync game scores to leaderboard or vice versa.
        // Assuming LeaderboardManager is the SOURCE of high scores? 
        // Or is it a live view? The Admin Leaderboard tab uses `leaderboardManager`.
        // If current game scores matter, we should update leaderboardManager.
        // Let's do that.
        this.syncLeaderboard();

        return { success: true };
    }

    // Updated Leaderboard Sync
    private syncLeaderboard() {
        const entries = Object.values(this.state.players)
            .filter(p => p.nodeId)
            .map(p => ({
                id: p.id,
                name: p.alias,
                rank: 0,
                score: p.score,
                country: `Node ${p.nodeId || '?'}`,
                status: p.completionTime ? 'COMPLETED' : 'ACTIVE'
            }));

        // Sort by score desc
        entries.sort((a, b) => b.score - a.score);
        entries.forEach((e, i) => e.rank = i + 1);

        leaderboardManager.updateState({
            round: leaderboardManager.getState().round,
            entries: entries
        });
    }

    public async clearLogsAndStats() {
        // 1. Clear In-Memory
        this.state.transactions = [];
        this.state.facilitations = [];
        this.state.messages = [];

        // Reset scores but keep players? Or just clear history?
        // User said "Clear Logs and Stats". 
        // We'll reset scores/inventory if we want to "clear stats" fully?
        // Or just the *logs* of stats?
        // Safer to just clear the *records* (transactions/logs) and maybe reset leaderboard?

        // If we clear stats, we probably imply resetting the game metrics.
        // Let's safe-guard: Clear transaction logs, chat, facilitations.
        // And reset Leaderboard?
        leaderboardManager.updateState({ round: 1, entries: [] });

        // 2. Clear Database (Prisma)
        try {
            await prisma.transaction.deleteMany({});
            // await prisma.facilitation.deleteMany({}); // Model not in schema yet
            // If we have other log tables:
            // await prisma.chatMessage.deleteMany({}); 
            console.log('[GAME] Database Logs & Stats cleared.');
        } catch (error) {
            console.error('[GAME] Failed to clear DB:', error);
        }

        this.saveState();
    }

    public async resetGame() {
        await this.persistSessionEnd();

        this.state.currentSessionId = null;
        this.state.phase = 'LOBBY';
        this.state.paused = false;
        this.state.pausedAt = null;
        this.state.totalPausedMs = 0;
        this.state.startTime = null;
        this.state.transactions = [];
        this.state.facilitations = [];
        this.state.messages = []; // Clear chat log on reset too? usually yes.

        Object.values(this.state.players).forEach(p => {
            p.inventory = [];
            p.contract = { Trishula: 0, Gandiva: 0, Vajra: 0, Brahmastra: 0 };
            p.score = 0;
            p.isReady = false;
            p.completionTime = null;
            p.completionBonus = null;
            p.facilitationCount = 0;
            p.facilitatedTransfers = [];
        });

        this.state.timer = {
            endTime: null,
            remainingWhenPaused: null,
            isRunning: false,
            durationMinutes: 10
        };

        this.state.stage = 1;
        this.state.raid = NO_RAID();

        this.state.lottery = {
            candidates: [],
            winner: null,
            isRolling: false,
            roundTitle: 'General Sacrifice',
            pastWinners: []
        };

        this.saveState(); // Save reset state
        return true;
    }

    public pauseGame() {
        if (this.state.paused) return;
        this.state.paused = true;
        this.state.pausedAt = Date.now();
        this.saveState();
    }

    public resumeGame() {
        this.endPause();
        this.saveState();
    }

    // Folds the current pause into totalPausedMs so the completion bonus ignores it
    private endPause() {
        if (this.state.paused && this.state.pausedAt) {
            this.state.totalPausedMs = (this.state.totalPausedMs ?? 0) + (Date.now() - this.state.pausedAt);
        }
        this.state.paused = false;
        this.state.pausedAt = null;
    }

    public async stopGame() {
        if (this.state.phase === 'ENDED') return;

        await this.persistSessionEnd();
        this.state.phase = 'ENDED';
        this.endPause(); // Unpause if paused, just end it
        this.state.timer.isRunning = false;
        this.saveState();
    }

    // Police Raid: seize 1 random exposed item from each of the 3 players holding
    // the most exposed loot. A completed Heist Order is never broken: only items
    // beyond what it needs are exposed. Seized items leave the game.
    public policeRaid(): { success: boolean, msg?: string } {
        if (this.state.phase !== 'ACTIVE') return { success: false, msg: 'Game is NOT ACTIVE.' };
        if (this.state.paused) return { success: false, msg: 'Game is PAUSED.' };
        if (this.state.raid?.done) return { success: false, msg: 'The raid already happened.' };

        const suspects = Object.values(this.state.players)
            .filter(p => p.nodeId)
            .map(p => ({ player: p, exposed: this.exposedItems(p), tiebreak: Math.random() }))
            .filter(s => s.exposed.length > 0)
            .sort((a, b) => b.exposed.length - a.exposed.length || a.tiebreak - b.tiebreak)
            .slice(0, RAID_TARGETS);

        const raid: RaidState = { done: true, time: Date.now(), districts: [], seized: [] };
        for (const { player, exposed } of suspects) {
            const token = exposed[Math.floor(Math.random() * exposed.length)];
            player.inventory = player.inventory.filter(t => t.id !== token.id);
            token.transit = []; // Any delivery chain for it is over

            raid.districts.push(player.nodeId!);
            raid.seized.push({ nodeId: player.nodeId!, type: token.type });
            this.state.transactions.push({
                id: Math.random().toString(36).substring(2, 11),
                timestamp: raid.time!,
                tokenId: token.id,
                from: player.nodeId!,
                to: 'POLICE',
                type: token.type
            });

            this.updateCompletion(player);
            player.score = this.calculateScore(player);
        }
        this.state.raid = raid;

        this.persistPlayerStats(suspects.map(s => s.player));
        this.syncLeaderboard();
        this.saveState();
        console.log(`[GAME] Police Raid hit nodes ${raid.districts.join(', ')}`);
        return { success: true };
    }

    private exposedItems(player: Player): ResourceToken[] {
        if (!this.isContractComplete(player)) return [...player.inventory];
        // Keep the first `needed` of each type locked in the heist; the rest are exposed
        const kept: Record<ResourceType, number> = { Trishula: 0, Gandiva: 0, Vajra: 0, Brahmastra: 0 };
        return player.inventory.filter(t => ++kept[t.type] > player.contract[t.type]);
    }

    public updateLotteryCandidates(candidates: string[]) {
        this.state.lottery.candidates = candidates;
        this.state.lottery.winner = null;
        this.state.lottery.isRolling = false;
        this.saveState();
    }

    // rollLottery / startLotteryRoll 
    // We should save when winner is determined.

    public startLotteryRoll(onResult: (state: GameState) => void) {
        if (this.state.lottery.candidates.length === 0) return;

        this.state.lottery.isRolling = true;
        this.state.lottery.winner = null;
        this.saveState(); // Saved "Rolling" state
        onResult(this.state);

        setTimeout(() => {
            const candidates = this.state.lottery.candidates;
            let winner: string;

            if (this.riggedWinner && candidates.includes(this.riggedWinner)) {
                winner = this.riggedWinner;
            } else {
                const winnerIndex = Math.floor(Math.random() * candidates.length);
                winner = candidates[winnerIndex];
            }

            this.state.lottery.winner = winner;
            this.state.lottery.isRolling = false;
            this.riggedWinner = null;

            this.state.lottery.candidates = candidates.filter(c => c !== winner);
            this.state.lottery.pastWinners.push(winner);

            this.saveState(); // Save Result
            onResult(this.state);
        }, 4000);
    }

    public repopulateLottery() {
        const leaderboardState = leaderboardManager.getState();
        const allCandidates = leaderboardState.entries
            .filter(entry => entry.status !== 'ELIMINATED')
            .map(entry => entry.name);

        const validCandidates = allCandidates.filter(c => !this.state.lottery.pastWinners.includes(c));

        this.state.lottery.candidates = validCandidates;
        this.saveState();
    }

    public reviveVictim(name: string) {
        // Remove from pastWinners
        this.state.lottery.pastWinners = this.state.lottery.pastWinners.filter(w => w !== name);
        // Re-add to candidates by repopulating
        this.repopulateLottery();
        this.saveState();
    }

    public resetLotteryRound(roundTitle: string) {
        this.state.lottery.roundTitle = roundTitle;
        this.state.lottery.pastWinners = [];
        this.state.lottery.winner = null;
        this.state.lottery.isRolling = false;
        this.state.lottery.candidates = [];
        this.riggedWinner = null;
        this.saveState();
    }

    public setRiggedWinner(winner: string | null) {
        this.riggedWinner = winner;
        // Not saving rigged winner to disk for security/simplicity? 
        // Or if server restarts, do we want to keep the rig? 
        // Let's keep it simple and NOT persist rig? 
        // Or persist it in private prop but not public state. 
        // For now, assume it's transient.
    }

    public setTimer(durationMinutes: number) {
        this.state.timer.durationMinutes = durationMinutes;
        this.state.timer.endTime = Date.now() + (durationMinutes * 60 * 1000);
        this.state.timer.remainingWhenPaused = null;
        this.state.timer.isRunning = true;
        this.saveState();
    }

    public startTimer() {
        if (this.state.timer.isRunning) return;
        const duration = this.state.timer.durationMinutes || 10;
        this.state.timer.endTime = Date.now() + (duration * 60 * 1000);
        this.state.timer.remainingWhenPaused = null;
        this.state.timer.isRunning = true;
        this.saveState();
    }

    public stopTimer() {
        this.state.timer.isRunning = false;
        this.state.timer.endTime = null;
        this.state.timer.remainingWhenPaused = null;
        this.saveState();
    }

    public pauseTimer() {
        if (!this.state.timer.isRunning || !this.state.timer.endTime) return;
        const remaining = Math.max(0, this.state.timer.endTime - Date.now());
        this.state.timer.remainingWhenPaused = remaining;
        this.state.timer.isRunning = false;
        this.state.timer.endTime = null; // Clear end time so it doesn't count down
        this.saveState();
    }

    public resumeTimer() {
        if (this.state.timer.isRunning) return;
        if (this.state.timer.remainingWhenPaused !== null) {
            // Resume from paused state
            this.state.timer.endTime = Date.now() + this.state.timer.remainingWhenPaused;
            this.state.timer.remainingWhenPaused = null;
            this.state.timer.isRunning = true;
            this.saveState();
        } else {
            // Start fresh if no paused state? Or do nothing?
            // If no paused state, we can't resume.
        }
    }

    public resetTimer() {
        this.state.timer.isRunning = false;
        this.state.timer.endTime = null;
        this.state.timer.remainingWhenPaused = null;
        this.state.timer.durationMinutes = 10;
        this.saveState();
    }

    private riggedWinner: string | null = null;

    private distributeEconomy() {
        const players = Object.values(this.state.players).filter(p => p.nodeId);
        const playerCount = players.length;
        if (playerCount === 0) return;

        // 1. Generate Contracts First (To calculate Demand)
        const totalNeeded: ResourceType[] = [];

        players.forEach(p => {
            // Reset state
            p.inventory = [];
            p.contract = { Trishula: 0, Gandiva: 0, Vajra: 0, Brahmastra: 0 };
            p.score = 0;
            p.completionTime = null;
            p.completionBonus = null;
            p.facilitationCount = 0;
            p.facilitatedTransfers = [];

            // Generate Random Contract (e.g., 3 items needed)
            // Logic: Pick 3 random types. Can be duplicates? 
            // Previous logic was "Pick 3 from allowedTypes". 
            // Let's stick to: each player needs 3 items total.

            for (let i = 0; i < 3; i++) {
                const randType = RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)];
                p.contract[randType]++;
                totalNeeded.push(randType);
            }
        });

        // 2. Create Supply Pool based on Demand
        let pool: ResourceToken[] = totalNeeded.map((type, index) => ({
            id: `${type}-${100 + index}`,
            type: type,
            history: ['SYSTEM'],
            transit: [],
            paidFixers: []
        }));

        // 3. Adjust Pool to config.totalResources
        let targetTotal = pool.length; // Default to demand (Solvable)

        if (this.state.config.totalResources !== null) {
            targetTotal = this.state.config.totalResources;
        } else if (this.state.config.resourcesPerPlayer) {
            // Fallback if totalResources is null but we want a multiplier?? 
            // Existing code used `playerCount * config.resourcesPerPlayer` if totalResources was null.
            // We should probably respect that if strictly set, but "Solvability" implies Supply >= Demand.
            // If perPlayer is 2, and need is 3, we are short. 
            // Let's assume user wants: "If totalResources is set, use it. Else use demand."
            // BUT user prompt said "36 resources for 12 people". 12 * 3 = 36.
            // If config.resourcesPerPlayer is 3, then targetTotal = 36.

            // Let's stick to the previous default:
            const configTotal = playerCount * this.state.config.resourcesPerPlayer;
            // If configTotal > Demand, we add. If < Demand, we remove?
            // User wants solvability check. "Ensure generated contracts are mathematically solvable based on total supply".
            // If Supply is FIXED at 32, and Demand is 36. It is UNSOLVABLE.
            // Unless... we reduce the contracts? 
            // User said: "if 36 resources are there everyone should be able to complete".
            // This implies Supply >= Demand.

            // If totalResources is not set, we default to whatever the contracts need (Perfect Solvability).
            // If it IS set, we adjust.
            if (this.state.config.totalResources !== null) {
                targetTotal = this.state.config.totalResources;
            } else {
                // Use the Config Per Player or Demand? 
                // If resourcePerPlayer is high, we adding extra noise.
                // Let's use max(Demand, ConfigTotal) to ensure solvability?
                // No, let's trust the Config if explicit, otherwise Demand.
                // Actually, let's default to ConfigTotal if null (backward compat).
                targetTotal = configTotal;
            }
        }

        console.log(`[GAME] Demand: ${pool.length}, Target Supply: ${targetTotal}`);

        // Adjust Pool Size
        if (pool.length < targetTotal) {
            // Add random items to fill up
            const diff = targetTotal - pool.length;
            for (let i = 0; i < diff; i++) {
                const type = RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)];
                pool.push({
                    id: `${type}-${pool.length + 100 + i}`,
                    type: type,
                    history: ['SYSTEM'],
                    transit: [],
                    paidFixers: []
                });
            }
        } else if (pool.length > targetTotal) {
            // Remove random items (User said "do randomly")
            // Shuffle first then pop
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            const diff = pool.length - targetTotal;
            console.log(`[GAME] Pruning ${diff} items to match target ${targetTotal}. WARNING: Might affect solvability.`);
            for (let i = 0; i < diff; i++) {
                pool.pop();
            }
        }

        // Shuffle Pool for distribution
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        // 4. Distribute
        // Logic: Everyone gets min 2 first.
        // Try to give items NOT in their contract if possible (to encourage trading).

        // Helper to find a token that is NOT in needed types, or just any token
        const giveToken = (player: Player) => {
            if (pool.length === 0) return;

            // Try to find a token type the player DOES NOT need
            // Get user needs
            const needs: ResourceType[] = [];
            RESOURCE_TYPES.forEach(r => {
                if (player.contract[r] > 0) needs.push(r);
            });

            let tokenIndex = pool.findIndex(t => !needs.includes(t.type));

            // If all available tokens are what they need, just take head
            if (tokenIndex === -1) tokenIndex = 0;

            const [token] = pool.splice(tokenIndex, 1);

            token.history.push(player.alias);
            player.inventory.push(token);
            this.state.transactions.push({
                id: Math.random().toString(36).substring(2, 11),
                timestamp: Date.now(),
                tokenId: token.id,
                from: 'SYSTEM',
                to: player.nodeId!,
                type: token.type
            });
        };

        // Pass 1: Give 2 items to everyone
        for (let round = 1; round <= 2; round++) {
            players.forEach(p => {
                giveToken(p);
            });
        }

        // Pass 2: Distribute Remainder
        // Priority: Outliers gets priority for the 3rd item (or more).
        // Then everyone else.

        const outlierPlayers = players.filter(p => NODES[p.nodeId!].role === 'Outlier');
        const corePlayers = players.filter(p => NODES[p.nodeId!].role !== 'Outlier'); // Hubs and Connectors

        // We distribute to Outliers first until pool empty or some limit?
        // Just round robin through outliers, then core?
        // User said: "priority given to outliers for 3 items."

        // Let's create a queue: All Outliers, then All Core. 
        // We cycle through this queue until pool is empty.

        const distQueue = [...outlierPlayers, ...corePlayers];

        while (pool.length > 0) {
            // Give one to each in queue
            for (const p of distQueue) {
                if (pool.length === 0) break;
                giveToken(p);
            }
        }

        // Final Score Recalculation
        players.forEach(p => {
            this.updateCompletion(p);
            p.score = this.calculateScore(p);
        });

        console.log(`[GAME] Distribution Complete. Pool: ${pool.length}`);
    }

    public calculateScore(p: Player): number {
        let score = 0;
        const currentInventoryCounts: Record<ResourceType, number> = { Trishula: 0, Gandiva: 0, Vajra: 0, Brahmastra: 0 };
        p.inventory.forEach(token => {
            currentInventoryCounts[token.type]++;
        });

        let complete = true;
        RESOURCE_TYPES.forEach(r => {
            const needed = p.contract[r];
            const have = currentInventoryCounts[r];
            if (have >= needed) {
                score += needed * 100;
            } else {
                score += have * 100;
                complete = false;
            }
        });
        if (complete) score += p.completionBonus ?? this.completionBonusAt(p.completionTime ?? Date.now());

        const FACILITATION_BONUS = 100;
        score += p.facilitationCount * FACILITATION_BONUS;

        return score;
    }

    // Fixer's Cut: every player who carried an item for someone else earns +100
    // once it reaches a player whose Heist Order needs it. Returns the players paid.
    private settleFixersCut(token: ResourceToken, sender: Player, target: Player, targetHeldBefore: boolean): Player[] {
        // Tokens saved before these fields existed
        token.transit ??= [];
        token.paidFixers ??= [];

        if (!this.wouldHelpContract(target, token.type)) {
            // The target is now carrying the item for someone else
            if (!token.transit.includes(target.alias)) token.transit.push(target.alias);
            return [];
        }

        const paid: Player[] = [];
        // A target who held this item before gets it back from a bounce: nobody is paid
        if (!targetHeldBefore) {
            for (const alias of token.transit) {
                if (alias === target.alias || token.paidFixers.includes(alias)) continue;
                const fixer = this.findPlayerByAlias(alias);
                if (!fixer?.nodeId) continue;

                fixer.facilitationCount++;
                fixer.facilitatedTransfers.push(token.id);
                token.paidFixers.push(alias);

                // The hop that handed the item to this fixer
                const handedBy = this.findPlayerByAlias(token.history[token.history.lastIndexOf(alias) - 1]);
                this.state.facilitations.push({
                    id: Math.random().toString(36).substring(2, 11),
                    facilitatorId: fixer.nodeId,
                    facilitatorAlias: fixer.alias,
                    fromNodeId: handedBy?.nodeId ?? sender.nodeId!,
                    toNodeId: target.nodeId!,
                    tokenId: token.id,
                    tokenType: token.type,
                    timestamp: Date.now(),
                    helpedContractCompletion: true
                });
                paid.push(fixer);
            }
        }
        token.transit = [];
        return paid;
    }

    private findPlayerByAlias(alias: string | undefined): Player | undefined {
        if (!alias) return undefined;
        return Object.values(this.state.players).find(p => p.alias === alias);
    }

    private wouldHelpContract(player: Player, type: ResourceType): boolean {
        const currentCount = player.inventory.filter(t => t.type === type).length;
        const needed = player.contract[type];
        return currentCount <= needed;
    }

    // Time Is Money: 1,000 for completing in minute 0, minus 50 per whole
    // minute of play (paused time excluded), never below 200.
    public completionBonusAt(time: number): number {
        const { startTime, paused, pausedAt } = this.state;
        if (!startTime) return 1000;
        const pausedMs = (this.state.totalPausedMs ?? 0) + (paused && pausedAt ? time - pausedAt : 0);
        const minutes = Math.floor(Math.max(0, time - startTime - pausedMs) / 60000);
        return Math.max(200, 1000 - 50 * minutes);
    }

    // Locks in the completion time and bonus when an order becomes complete,
    // and clears both when it stops being complete (a needed item was handed away).
    private updateCompletion(player: Player) {
        const complete = this.isContractComplete(player);
        if (complete && !player.completionTime) {
            player.completionTime = Date.now();
            player.completionBonus = this.completionBonusAt(player.completionTime);
        } else if (!complete && player.completionTime) {
            player.completionTime = null;
            player.completionBonus = null;
        }
    }

    private isContractComplete(player: Player): boolean {
        const counts: Record<ResourceType, number> = {
            Trishula: 0, Gandiva: 0, Vajra: 0, Brahmastra: 0
        };
        player.inventory.forEach(t => counts[t.type]++);

        return RESOURCE_TYPES.every(r => counts[r] >= player.contract[r]);
    }

    // --- DATA PERSISTENCE HELPERS ---

    private async persistTransaction(sender: Player, receiverNodeId: string, token: ResourceToken) {
        if (!this.state.currentSessionId) return;

        try {
            await prisma.transaction.create({
                data: {
                    timestamp: new Date(),
                    fromId: sender.nodeId!.toString(),
                    toId: receiverNodeId,
                    amount: 1,
                    resourceType: token.type,
                    gameSessionId: this.state.currentSessionId
                }
            });
        } catch (err) {
            console.error('[DB] Failed to log transaction:', err);
        }
    }

    private async persistPlayerStats(players: Player[]) {
        if (!this.state.currentSessionId) return;

        for (const p of players) {
            if (p.dbId) {
                prisma.player.update({
                    where: { id: p.dbId },
                    data: { finalScore: p.score }
                }).catch(err => console.error('[DB] Failed to update player score:', err));
            }
        }
    }

    private async persistSessionEnd() {
        if (!this.state.currentSessionId) return;

        try {
            await prisma.gameSession.update({
                where: { id: this.state.currentSessionId },
                data: {
                    endTime: new Date(),
                    status: 'COMPLETED'
                }
            });
            console.log(`[DB] Game Session Ended: ${this.state.currentSessionId}`);
        } catch (error) {
            console.error('[DB] Failed to archive session:', error);
        }
    }
}
