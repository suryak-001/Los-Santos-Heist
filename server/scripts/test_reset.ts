import * as dotenv from 'dotenv';
dotenv.config();

import io from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

async function resetGame() {
    console.log('[TEST] Connecting as Admin...');
    const socket = io(SERVER_URL, { transports: ['websocket'] });

    socket.on('connect', () => {
        console.log('[TEST] Connected. Logging in...');
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'scarcity123_CHANGE_ME_NOW';
        socket.emit('join', { alias: 'admin', password: ADMIN_PASSWORD });
    });

    socket.on('login_response', (res: { success: boolean; error?: string }) => {
        if (res.success) {
            console.log('[TEST] Login Success! Requesting Reset...');
            socket.emit('reset_game');
        } else {
            console.error('[TEST] Login Failed:', res.error);
            process.exit(1);
        }
    });

    socket.on('admin_msg', (msg: string) => {
        console.log('[TEST] Admin Message:', msg);
        if (msg.includes('Reset Successful')) {
            console.log('[TEST] Reset Verified!');
            socket.disconnect();
            process.exit(0);
        }
    });
}

// EXECUTE
(async () => {
    try {
        await resetGame();
    } catch (err) {
        console.error(err);
    }
})();
