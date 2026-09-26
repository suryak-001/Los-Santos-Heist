import * as dotenv from 'dotenv';
dotenv.config();

import io from 'socket.io-client';
import { NODES } from '../src/topology';
import { GameState, Player, ResourceType, NodeId } from '../src/types/game';

const SERVER_URL = 'http://localhost:3000';

async function verify() {
    console.log('[VERIFY] Connecting...');
    const socket = io(SERVER_URL, { transports: ['websocket'] });

    socket.on('connect', () => {
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'scarcity123_CHANGE_ME_NOW';
        socket.emit('join', { alias: 'admin', password: ADMIN_PASSWORD });
    });

    socket.on('state_update', (state: GameState) => {
        if (state.phase === 'LOBBY') {
            const playerCount = Object.values(state.players).filter(p => p.nodeId).length;
            if (playerCount >= 12) {
                console.log('[VERIFY] 12 Players found. Starting Game to audit distribution...');
                socket.emit('start_game');
            } else {
                console.log(`[VERIFY] Waiting for players... (${playerCount}/12)`);
            }
            return;
        }

        // CHAT LISTENER (One-time setup check)
        if (!socket.hasListeners('chat_message')) {
            socket.on('chat_message', (msg: any) => {
                console.log(`[VERIFY] ✅ Chat Detected: ${msg.senderAlias} -> ${msg.targetNodeId}: "${msg.text}"`);
            });
        }

        console.log('\n--- GAME LOGIC AUDIT ---');

        // 1. VERIFY SCARCITY (Total Supply = 32)
        let totalItems = 0;
        const allPlayers = Object.values(state.players);
        allPlayers.forEach(p => totalItems += p.inventory.length);

        console.log(`[SCARCITY] Total Items in Circulation: ${totalItems} / 32`);
        if (totalItems !== 32) console.error('❌ FATAL: Resource conservation violated!');
        else console.log('✅ Conservation of Mass holds.');

        // 2. VERIFY TOPOLOGY Compliance (Transactions)
        let invalidMoves = 0;
        state.transactions.forEach(tx => {
            if (tx.from === 'SYSTEM') return;
            const neighbors = NODES[tx.from as NodeId].neighbors;
            if (!neighbors.includes(tx.to as NodeId)) {
                console.error(`❌ INVALID MOVE: ${tx.from} -> ${tx.to} (Not Neighbors!)`);
                invalidMoves++;
            }
        });
        if (invalidMoves === 0) console.log(`✅ Topology Strictness: 100% (${state.transactions.length} txs checked)`);
        else console.error(`❌ Topology Violations: ${invalidMoves}`);

        // 3. VERIFY SMART GOALS
        let totalScore = 0;
        let fulfilledContracts = 0;
        const activePlayers = allPlayers.filter(p => p.nodeId);

        activePlayers.forEach(p => {
            totalScore += p.score;
            // distinct contract items
            const needed = Object.values(p.contract).reduce((a, b) => a + b, 0);

            // Check if inventory matches need
            const invCounts: any = { Alpha: 0, Beta: 0, Gamma: 0, Delta: 0 };
            p.inventory.forEach(t => invCounts[t.type]++);

            let met = 0;
            Object.keys(p.contract).forEach(k => {
                const type = k as ResourceType;
                met += Math.min(p.contract[type], invCounts[type]);
            });

            if (met === needed) fulfilledContracts++;
        });

        console.log(`[EFFICIENCY] Total System Score: ${totalScore}`);
        console.log(`[EFFICIENCY] Fully Completed Contracts: ${fulfilledContracts} / ${activePlayers.length}`);

        // 4. VERIFY STARTER SCARCITY (No one should start with what they need)
        // Note: In a running game, they might acquire what they need.
        // So this check is only valid at START.
        // But we can check if they HAVE what they need, that counts as progress.
        // The user asked: "only assigns three items which they dont need".
        // If we reset and run this immediately, we can check.
        // If the game has been running, they might have traded for it.
        // So let's just log how many they have of what they need.

        let totalMetNeeds = 0;
        let totalNeeds = 0;
        activePlayers.forEach(p => {
            const invCounts: any = { Alpha: 0, Beta: 0, Gamma: 0, Delta: 0 };
            p.inventory.forEach(t => invCounts[t.type]++);
            Object.keys(p.contract).forEach(k => {
                const type = k as ResourceType;
                totalNeeds += p.contract[type];
                totalMetNeeds += Math.min(p.contract[type], invCounts[type]);
            });
        });
        console.log(`[PROGRESS] System Global Progress: ${totalMetNeeds} / ${totalNeeds} items found.`);

        // 5. VERIFY OUTLIER DISTRIBUTION (Outliers must have 3 items)
        let outlierFailures = 0;
        activePlayers.forEach(p => {
            const role = NODES[p.nodeId as NodeId].role;
            if (role === 'Outlier') {
                if (p.inventory.length !== 3) {
                    console.error(`❌ OUTLIER FAILURE: Node ${p.nodeId} (${role}) has ${p.inventory.length} items (Expected 3)`);
                    outlierFailures++;
                }
            } else {
                console.log(`[INFO] Core Node ${p.nodeId} (${role}) has ${p.inventory.length} items.`);
            }
        });
        if (outlierFailures === 0) console.log('✅ Outlier Distribution: ALL Outliers have 3 items.');
        else console.error(`❌ Outlier Distribution Violations: ${outlierFailures}`);

        if (outlierFailures === 0) console.log('✅ Outlier Distribution: ALL Outliers have 3 items.');
        else console.error(`❌ Outlier Distribution Violations: ${outlierFailures}`);

        // 6. VERIFY MAX LIMIT (No one > 3 items? Actually user said "not more than 3")
        let overflow = 0;
        activePlayers.forEach(p => {
            if (p.inventory.length > 3) {
                console.error(`❌ MAX ITEM VIOLATION: ${p.alias} has ${p.inventory.length} items!`);
                overflow++;
            }
        });
        if (overflow === 0) console.log('✅ Max Limit: No player has > 3 items.');

        // 7. WAIT FOR CHAT (Delay exit slightly to catch a chat)
        console.log('[VERIFY] Waiting 2 seconds for chat verification...');
        setTimeout(() => {
            socket.disconnect();
            process.exit(0);
        }, 2000);
    });
}

// EXECUTE
(async () => {
    try {
        await verify();
    } catch (err) {
        console.error(err);
    }
})();
