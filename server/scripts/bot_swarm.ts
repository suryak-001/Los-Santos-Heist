import * as dotenv from 'dotenv';
dotenv.config();

import io from 'socket.io-client';
import { NODES, NodeId } from '../src/topology';
import { GameState } from '../src/types/game';

// CONFIG
const SERVER_URL = 'http://localhost:3000';
const NUM_BOTS = 12;
const ACTIVITY_INTERVAL_MS = 800; // FAST: Action every 0.8s per bot
const CHANCE_TO_TRANSFER = 1.0; // Always transfer if surplus

// STATE
let gameState: GameState | null = null;
let gameActive = false;
let connectedBots = 0;

// HELPERS
const getRandomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function startSwarm() {
    console.log(`[SWARM] Launching ${NUM_BOTS} bots targeting ${SERVER_URL}...`);

    // Create a special admin socket to start the game
    const adminSocket = io(SERVER_URL, { transports: ['websocket'], forceNew: true });

    adminSocket.on('connect', () => {
        console.log('[ADMIN] Connected for swarm control');
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'scarcity123_CHANGE_ME_NOW';
        adminSocket.emit('join', { alias: 'admin', password: ADMIN_PASSWORD });
    });

    for (let i = 1; i <= NUM_BOTS; i++) {
        const nodeId = i.toString() as NodeId;
        const alias = `TT_BM_${nodeId}`;

        const socket = io(SERVER_URL, {
            transports: ['websocket'],
            forceNew: true
        });

        const bot = { socket, id: nodeId, alias };


        // Events
        socket.on('connect', () => {
            console.log(`[${alias}] Connected! logging in...`);
            socket.emit('join', { alias });
        });

        socket.on('login_response', (res: { success: boolean; error?: string }) => {
            if (res.success) {
                console.log(`[${alias}] Login Success!`);
                connectedBots++;

                // Check if all bots are connected to start the game
                if (connectedBots === NUM_BOTS) {
                    console.log('[SWARM] All bots connected. Initiating game start...');
                    setTimeout(() => {
                        adminSocket.emit('start_game');
                    }, 1000);
                }
            } else {
                console.error(`[${alias}] Login Failed: ${res.error}`);
            }
        });

        socket.on('state_update', (state: GameState) => {
            gameState = state;
            if (state.phase === 'ACTIVE' && !gameActive) {
                console.log(`[SWARM] GAME STARTED! Unleashing chaos...`);
                gameActive = true;
                startBotLoop(bot);
            }
        });

        socket.on('error', (err: any) => console.error(`[${alias}] Socket Error:`, err));

        // Stagger connections slightly
        await sleep(200);
    }
}

async function startBotLoop(bot: { socket: any; id: NodeId; alias: string }) {
    // Each bot runs its own infinite loop
    while (true) {
        if (!gameActive || !gameState) {
            await sleep(1000);
            continue;
        }

        // Random delay to simulate human timing
        await sleep(Math.random() * ACTIVITY_INTERVAL_MS + 1000);

        const myPlayer = Object.values(gameState.players).find(p => p.alias === bot.alias);
        if (!myPlayer) continue;

        // DECISION: Transfer or Chat?
        const neighbors = NODES[bot.id].neighbors;
        const targetId = getRandomElement(neighbors);

        // SMART DECISION LOGIC
        // 1. Calculate Needs vs Surplus
        // We know what we need from our contract.
        // We know what we have in inventory.

        // Count Inventory
        const inventoryCounts: Record<string, number> = { Alpha: 0, Beta: 0, Gamma: 0, Delta: 0 };
        myPlayer.inventory.forEach(t => inventoryCounts[t.type]++);

        // Identify Surplus Items (Items we have more of than our contract requires)
        const surplusTokens = myPlayer.inventory.filter(t => {
            const needed = myPlayer.contract[t.type as keyof typeof myPlayer.contract] || 0;
            const have = inventoryCounts[t.type];
            // If we have more than needed, this token is a candidate for transfer.
            // Simple heuristic warning: this might pick a token we "need" if we have 2 and need 1.
            // Better: only consider it surplus if we have > needed. 
            return have > needed;
        });

        if (bot.id === '1') {
            console.log(`[TT_BM_1 DEBUG] Inv: ${JSON.stringify(inventoryCounts)} | Contract: ${JSON.stringify(myPlayer.contract)} | Surplus: ${surplusTokens.length}`);
        }

        // 2. Transfer Surplus Action
        if (surplusTokens.length > 0) {
            // ALWAYS transfer surplus to maximize flow
            const token = getRandomElement(surplusTokens);
            const transferTargetId = getRandomElement(neighbors);

            console.log(`[${bot.alias}] [SMART] Transferring SURPLUS ${token.type} to Neighbor ${transferTargetId}...`);
            bot.socket.emit('transfer_resource', {
                targetNodeId: transferTargetId,
                tokenId: token.id
            });
        } else {
            // NO SURPLUS CASE
            // To prevent deadlock (everyone hoarding), sometimes trade a needed item (Liquidity Provision)
            if (myPlayer.inventory.length > 0 && Math.random() < 0.2) {
                const token = getRandomElement(myPlayer.inventory);
                const transferTargetId = getRandomElement(neighbors);

                console.log(`[${bot.alias}] [LIQUIDITY] trading ${token.type} (risk) to Neighbor ${transferTargetId}...`);
                bot.socket.emit('transfer_resource', {
                    targetNodeId: transferTargetId,
                    tokenId: token.id
                });
            } else {
                if (bot.id === '1' && Math.random() < 0.1) console.log(`[${bot.alias}] HODLing (No Surplus & No Risk)`);
            }

            // 2. Chat (if no surplus or didn't transfer)
            const msgs = [
                `Hey Node ${targetId}, need any resources?`,
                `I am low on Alpha!`,
                `Trust protocol engaged.`,
                `Sending supplies your way.`,
                `Node ${bot.id} standing by.`
            ];
            const msg = getRandomElement(msgs);
            bot.socket.emit('chat_message', {
                targetNodeId: targetId,
                text: msg
            });
        }
    }
}

// EXECUTE
// EXECUTE
(async () => {
    try {
        await startSwarm();
    } catch (err) {
        console.error(err);
    }
})();
