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

    // --- LEADERBOARD EVENTS ---
    socket.on('get_leaderboard', () => {
        socket.emit('leaderboard_update', leaderboardManager.getState());
    });

    socket.on('update_leaderboard', (newState: LeaderboardState) => {
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

    socket.on('start_game', async () => {
        await game.startGame();
        broadcastState();
        socket.emit('admin_msg', 'Game STARTED');
    });

    socket.on('reset_game', async () => {
        await game.resetGame();
        broadcastState();
        socket.emit('admin_msg', 'Game Data Reset');
    });



    socket.on('admin_clear_data', async () => {
        await game.clearLogsAndStats();
        broadcastState();
        io.emit('leaderboard_update', leaderboardManager.getState());
        socket.emit('admin_msg', 'Logs & Stats Cleared (DB + Local)');
    });

    socket.on('pause_game', () => {
        game.pauseGame();
        broadcastState();
        socket.emit('admin_msg', 'Game PAUSED');
    });

    socket.on('resume_game', () => {
        game.resumeGame();
        broadcastState();
        socket.emit('admin_msg', 'Game RESUMED');
    });

    socket.on('stop_game', async () => {
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
    socket.on('admin_update_config', (config) => {
        game.updateConfig(config);
        broadcastState();
    });

    socket.on('admin_set_stage', (stage) => {
        game.setStage(stage);
        broadcastState();
    });

    // --- LOTTERY ---
    socket.on('admin_update_lottery', (candidates: string[]) => {
        game.updateLotteryCandidates(candidates);
        broadcastState();
    });

    socket.on('admin_trigger_lottery', () => {
        game.startLotteryRoll(() => {
            broadcastState();
        });
    });

    socket.on('admin_repopulate_lottery', () => {
        game.repopulateLottery();
        io.emit('state_update', game.getState());
        socket.emit('admin_msg', 'Lottery Pool Repopulated from Leaderboard');
    });

    socket.on('admin_reset_lottery_round', (roundTitle: string) => {
        game.resetLotteryRound(roundTitle);
        io.emit('state_update', game.getState());
        socket.emit('admin_msg', `Lottery Round Reset: ${roundTitle}`);
    });

    socket.on('admin_set_rigged_winner', (winner) => {
        game.setRiggedWinner(winner);
        socket.emit('admin_msg', winner ? `Next Winner Rigged: ${winner}` : 'Rigging Cleared');
        // Do NOT broadcast to everyone
    });

    socket.on('admin_revive_victim', (name) => {
        game.reviveVictim(name);
        broadcastState();
        socket.emit('admin_msg', `Revived Victim: ${name}`);
    });

    // --- TIMER CONTROLS ---
    socket.on('admin_timer_set', (minutes) => {
        game.setTimer(minutes);
        broadcastState();
    });

    socket.on('admin_timer_start', () => {
        game.startTimer();
        broadcastState();
    });

    socket.on('admin_timer_stop', () => {
        game.stopTimer();
        broadcastState();
    });

    socket.on('admin_timer_pause', () => {
        game.pauseTimer();
        broadcastState();
    });

    socket.on('admin_timer_resume', () => {
        game.resumeTimer();
        broadcastState();
    });

    socket.on('admin_timer_reset', () => {
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
    socket.on('admin_kick_player', (targetPlayerId: string) => {
        const players = game.getState().players;
        const admin = players[socket.id];

        // Verify admin permission
        if (!admin || admin.alias !== 'admin') {
            socket.emit('action_error', 'Unauthorized: Admin access required');
            return;
        }

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
