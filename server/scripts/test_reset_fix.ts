import io from "socket.io-client";
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'scarcity123_CHANGE_ME_NOW';

async function testReset() {
    console.log(`Connecting to ${URL}...`);
    const adminSocket = io(URL);

    await new Promise<void>((resolve) => {
        adminSocket.on('connect', () => {
            console.log('Admin connected:', adminSocket.id);
            resolve();
        });
    });

    // Login as Admin
    console.log("Logging in as Admin...");
    adminSocket.emit('join', { alias: 'admin', password: ADMIN_PASSWORD });

    await new Promise<void>(resolve => setTimeout(resolve, 1000));

    // Set Stage to 2
    console.log("Setting Stage to 2...");
    adminSocket.emit('admin_set_stage', 2);

    await new Promise<void>(resolve => setTimeout(resolve, 1000));

    // Verify Stage is 2
    // We need to listen to state updates
    let currentState: any = {};
    adminSocket.on('state_update', (state: any) => {
        currentState = state;
    });

    // Wait for update
    await new Promise<void>(resolve => setTimeout(resolve, 1000));

    if (currentState.stage === 2) {
        console.log("SUCCESS: Stage set to 2.");
    } else {
        console.error("FAILURE: Stage not set to 2. Current:", currentState.stage);
        process.exit(1);
    }

    // Reset Game
    console.log("Resetting Game...");
    adminSocket.emit('reset_game');

    await new Promise<void>(resolve => setTimeout(resolve, 1000));

    // Verify Stage is 1
    if (currentState.stage === 1) {
        console.log("SUCCESS: Game reset. Stage is back to 1.");
    } else {
        console.error("FAILURE: Game reset but Stage is " + currentState.stage);
        process.exit(1);
    }

    adminSocket.disconnect();
    process.exit(0);
}

testReset().catch(console.error);
