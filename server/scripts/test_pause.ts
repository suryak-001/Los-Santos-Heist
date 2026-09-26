import * as dotenv from 'dotenv';
dotenv.config();

import io from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

async function testPause() {
    console.log('[TEST] Connecting Admin...');
    const adminSocket = io(SERVER_URL);

    // 1. Setup Admin & Start Game
    await new Promise<void>(resolve => {
        adminSocket.on('connect', () => {
            const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'scarcity123_CHANGE_ME_NOW';
            adminSocket.emit('join', { alias: 'admin', password: ADMIN_PASSWORD });
        });
        adminSocket.on('login_response', (res: any) => {
            if (res.success) {
                console.log('[TEST] Admin Logged In. Starting Game...');
                adminSocket.emit('start_game');
                // Give it a moment to start
                setTimeout(() => {
                    adminSocket.emit('pause_game');
                    console.log('[TEST] Game PAUSED.');
                    resolve();
                }, 1000);
            }
        });
    });

    // 2. Setup Player 1
    console.log('[TEST] Connecting Player 1...');
    const p1Socket = io(SERVER_URL);

    await new Promise<void>(resolve => {
        p1Socket.on('connect', () => {
            p1Socket.emit('join', { alias: 'TT_BM_1' });
        });
        p1Socket.on('login_response', (res: any) => {
            if (res.success) {
                console.log('[TEST] Player 1 Logged In.');

                // 3. Try Chat while Paused
                console.log('[TEST] P1 Attempting Chat (Should Fail)...');
                p1Socket.emit('chat_message', { receiverId: 'any', message: 'Hello' });
            }
        });

        p1Socket.on('action_error', (msg: string) => {
            console.log(`[TEST] ✅ Received Expected Error: "${msg}"`);

            // 4. Resume Game
            console.log('[TEST] Resuming Game...');
            adminSocket.emit('resume_game');

            setTimeout(() => {
                // 5. Try Chat again
                console.log('[TEST] P1 Attempting Chat (Should Succeed)...');
                p1Socket.emit('chat_message', { receiverId: adminSocket.id, message: 'Hello World' });
            }, 1000);
        });

        p1Socket.on('chat_message_received', (msg: any) => {
            if (msg.message === 'Hello World') {
                console.log('[TEST] ✅ Chat Received (Resume Works!)');
                p1Socket.disconnect();
                adminSocket.disconnect();
                process.exit(0);
            }
        });
    });
}

testPause();
