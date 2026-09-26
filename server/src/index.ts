import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameManager } from './game';
import { leaderboardManager, LeaderboardState } from './leaderboard';

import path from 'node:path';

// Initial Load
leaderboardManager.init().catch(err => console.error("Leaderboard Init Failed:", err));

const app = express();
app.use(cors());

// Serve Client Static Files
// Note: dist structure is dist/src/index.js, so we need to go up 3 levels to reach root, then client/dist
const clientDist = path.join(__dirname, '../../../client/dist');
app.use(express.static(clientDist));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const game = new GameManager();
// Initialize Game State (Persistence)
game.init().catch(err => console.error("Game Init Failed:", err));
const PORT = process.env.PORT || 3000;

// Catch-all for SPA
app.get('*', (req, res) => {
    // If request asks for a file that exists, it would have been handled by static
    // If not, serve index.html
    if (req.path.startsWith('/socket.io')) return; // let socket.io handle this
    res.sendFile(path.join(clientDist, 'index.html'));
});

const broadcastState = () => {
    io.emit('state_update', game.getState());
};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.emit('state_update', game.getState());

    // Admin-only events are rejected unless this socket is logged in as admin.
    const isAdmin = () => game.getState().players[socket.id]?.alias === 'admin';
    // Payloads are untyped, the same as with socket.on.
    const onAdmin = (event: string, handler: (...args: any[]) => void) => {
        socket.on(event, (...args: any[]) => {
            if (!isAdmin()) {
                socket.emit('action_error', 'Unauthorized: Admin access required');
                return;
            }
            handler(...args);
        });
    };

    // --- LEADERBOARD EVENTS ---
    socket.on('get_leaderboard', () => {
        socket.emit('leaderboard_update', leaderboardManager.getState());
    });

    onAdmin('update_leaderboard', (newState: LeaderboardState) => {
        leaderboardManager.updateState(newState);
        io.emit('leaderboard_update', leaderboardManager.getState());
    });


    socket.on('join', ({ alias, password }) => {
        const result = game.addPlayer(socket.id, alias, password);
        if (result.success) {
            socket.emit('login_response', { success: true, player: result.player });
            broadcastState();
        } else {
            socket.emit('login_error', result.error);
            socket.emit('login_response', { success: false, error: result.error });
        }
    });

    onAdmin('start_game', async () => {
        await game.startGame();
        broadcastState();
        socket.emit('admin_msg', 'Game STARTED');
    });

    onAdmin('reset_game', async () => {
        await game.resetGame();
        broadcastState();
        socket.emit('admin_msg', 'Game Data Reset');
    });



    onAdmin('admin_clear_data', async () => {
        await game.clearLogsAndStats();
        broadcastState();
        io.emit('leaderboard_update', leaderboardManager.getState());
        socket.emit('admin_msg', 'Logs & Stats Cleared (DB + Local)');
    });

    onAdmin('pause_game', () => {
        game.pauseGame();
        broadcastState();
        socket.emit('admin_msg', 'Game PAUSED');
    });

    onAdmin('resume_game', () => {
        game.resumeGame();
        broadcastState();
        socket.emit('admin_msg', 'Game RESUMED');
    });

    onAdmin('stop_game', async () => {
        await game.stopGame();
        broadcastState();
        socket.emit('admin_msg', 'Game STOPPED (ENDED)');
    });

    // --- TRUST ECONOMY ---
    socket.on('transfer_resource', ({ targetNodeId, tokenId }) => {
        const res = game.transferResource(socket.id, targetNodeId, tokenId);
        if (res.success) {
            broadcastState(); // This will now include the new chat message in state.messages
        } else {
            socket.emit('action_error', res.msg);
        }
    });

    // --- CONFIG ---
    onAdmin('admin_update_config', (config) => {
        game.updateConfig(config);
        broadcastState();
    });

    onAdmin('admin_set_stage', (stage) => {
        game.setStage(stage);
        broadcastState();
    });

    // --- LOTTERY ---
    onAdmin('admin_update_lottery', (candidates: string[]) => {
        game.updateLotteryCandidates(candidates);
        broadcastState();
    });

    onAdmin('admin_trigger_lottery', () => {
        game.startLotteryRoll(() => {
            broadcastState();
        });
    });

    onAdmin('admin_repopulate_lottery', () => {
        game.repopulateLottery();
        io.emit('state_update', game.getState());
        socket.emit('admin_msg', 'Lottery Pool Repopulated from Leaderboard');
    });

    onAdmin('admin_reset_lottery_round', (roundTitle: string) => {
        game.resetLotteryRound(roundTitle);
        io.emit('state_update', game.getState());
        socket.emit('admin_msg', `Lottery Round Reset: ${roundTitle}`);
    });

    onAdmin('admin_set_rigged_winner', (winner) => {
        game.setRiggedWinner(winner);
        socket.emit('admin_msg', winner ? `Next Winner Rigged: ${winner}` : 'Rigging Cleared');
        // Do NOT broadcast to everyone
    });

    onAdmin('admin_revive_victim', (name) => {
        game.reviveVictim(name);
        broadcastState();
        socket.emit('admin_msg', `Revived Victim: ${name}`);
    });

    // --- TIMER CONTROLS ---
    onAdmin('admin_timer_set', (minutes) => {
        game.setTimer(minutes);
        broadcastState();
    });

    onAdmin('admin_timer_start', () => {
        game.startTimer();
        broadcastState();
    });

    onAdmin('admin_timer_stop', () => {
        game.stopTimer();
        broadcastState();
    });

    onAdmin('admin_timer_pause', () => {
        game.pauseTimer();
        broadcastState();
    });

    onAdmin('admin_timer_resume', () => {
        game.resumeTimer();
        broadcastState();
    });

    onAdmin('admin_timer_reset', () => {
        game.resetTimer();
        broadcastState();
    });

    socket.on('chat_message', ({ receiverId, message }) => {
        const players = game.getState().players;
        const sender = players[socket.id];
        const receiver = Object.values(players).find(p => p.id === receiverId); // ID based now

        if (sender && receiver) {
            // CHECK PAUSE
            if (game.getState().paused) {
                socket.emit('action_error', 'Game is PAUSED. Chat disabled.');
                return;
            }

            const chatMsg = {
                senderId: sender.id,
                senderAlias: sender.alias,
                receiverId: receiver.id,
                message: message,
                timestamp: Date.now()
            };

            // PERSISTENCE
            game.getState().messages.push(chatMsg);

            // EMIT (Optimized: Broadcast state might be too heavy? 
            // The client now listens to 'state_update' for messages too if we changed Dashboard logic.
            // But let's keep specific events for real-time smoothness if desired, 
            // OR just rely on state_update if we want single source of truth.)

            // Let's keep specific event for instant feedback but ALSO valid state.
            io.to(receiver.id).emit('chat_message_received', chatMsg);
            socket.emit('chat_message_received', chatMsg); // Echo back to sender

            // FIX LATENCY: Use broadcastState to ensure message history in state is synced immediately
            broadcastState();
        }
    });

    // --- ADMIN KICK PLAYER ---
    onAdmin('admin_kick_player', (targetPlayerId: string) => {
        const players = game.getState().players;
        const admin = players[socket.id];

        // Find target player and socket
        const targetPlayer = players[targetPlayerId];
        if (!targetPlayer) {
            socket.emit('action_error', 'Player not found');
            return;
        }

        const targetSocket = io.sockets.sockets.get(targetPlayerId);
        if (targetSocket) {
            // Notify the kicked player
            targetSocket.emit('kicked', { message: 'You have been removed from the session by admin' });

            // Force disconnect
            targetSocket.disconnect(true);

            // Confirm to admin
            socket.emit('admin_msg', `Player ${targetPlayer.alias} has been kicked and disconnected`);
            console.log(`[ADMIN] ${admin.alias} kicked player ${targetPlayer.alias} (${targetPlayerId})`);
        } else {
            // Even if socket is gone, ensure they are removed from state
            socket.emit('admin_msg', `Player ${targetPlayer.alias} removed from state (Socket not found)`);
        }

        // FULL REMOVAL
        game.kickPlayer(targetPlayerId);

        broadcastState();
    });

    socket.on('disconnect', () => {
        game.removePlayer(socket.id);
        broadcastState();
    });
});

server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
