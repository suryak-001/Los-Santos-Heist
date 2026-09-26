import io from 'socket.io-client';
import dotenv from 'dotenv';
dotenv.config();

const PORT = 3000;
const URL = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'scarcity123_CHANGE_ME_NOW';

async function testStop() {
    console.log(`Connecting to ${URL}...`);
    const adminSocket = io(URL);
    const playerSocket = io(URL);

    // 1. Login
    await Promise.all([
        new Promise<void>(resolve => {
            adminSocket.on('connect', () => {
                adminSocket.emit('join', { alias: 'admin', password: ADMIN_PASSWORD });
            });
            adminSocket.on('login_response', (res: any) => { if (res.success) resolve(); });
        }),
        new Promise<void>(resolve => {
            playerSocket.on('connect', () => {
                playerSocket.emit('join', { alias: 'TT_BM_1' });
            });
            playerSocket.on('login_response', (res: any) => { if (res.success) resolve(); });
        })
    ]);

    // 2. Start Game
    console.log('Starting Game...');
    adminSocket.emit('start_game');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Stop Game
    console.log('Stopping Game...');
    adminSocket.emit('stop_game');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Verify Phase is ENDED
    let gameState: any;
    adminSocket.on('state_update', (state: any) => { gameState = state; });
    // Trigger update
    adminSocket.emit('admin_set_stage', 1); // Dummy action to get state or wait
    await new Promise(resolve => setTimeout(resolve, 1000));

    // We can just rely on the latest state received
    if (gameState.phase !== 'ENDED') {
        console.error('FAILURE: Game Phase is not ENDED. Current:', gameState.phase);
    } else {
        console.log('SUCCESS: Game Phase is ENDED.');
    }

    // 5. Attempt Trade (Should Fail)
    console.log('Attempting Trade...');
    await new Promise<void>(resolve => {
        playerSocket.on('action_error', (msg: string) => {
            if (msg.includes('NOT ACTIVE') || msg.includes('ENDED')) {
                console.log(`SUCCESS: Trade blocked with message: "${msg}"`);
            } else {
                console.error(`FAILURE: Trade blocked but unexpected message: "${msg}"`);
            }
            resolve();
        });

        // Try to transfer something (even if we don't have it, it should fail on Phase check first?)
        // The phase check is at the top of transferResource.
        playerSocket.emit('transfer_resource', { targetNodeId: '2', tokenId: 'fake-token' });

        // Timeout if no response
        setTimeout(() => {
            console.log("No response received (Might be a failure if error not emitted)");
            resolve();
        }, 2000);
    });

    adminSocket.disconnect();
    playerSocket.disconnect();
    process.exit(0);
}

testStop();
