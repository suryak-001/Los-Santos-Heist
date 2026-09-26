
import io from 'socket.io-client';
import dotenv from 'dotenv';
dotenv.config();

const PORT = 3000;
const URL = `http://localhost:${PORT}`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'scarcity123_CHANGE_ME_NOW';
// We need to wait for sufficient players to join to test distribution.
// So this script will spawn 12 players.

const PLAYERS_TO_SPAWN = 12;

async function testEconomy() {
    console.log(`Connecting Admin to ${URL}...`);
    const adminSocket = io(URL);

    await new Promise<void>((resolve) => {
        adminSocket.on('connect', () => {
            adminSocket.emit('join', { alias: 'admin', password: ADMIN_PASSWORD });
        });
        adminSocket.on('login_response', (res: any) => { if (res.success) resolve(); });
    });

    // Reset Game First
    console.log('Resetting Game...');
    adminSocket.emit('reset_game');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Spawn Players
    const playerSockets: any[] = [];
    console.log(`Spawning ${PLAYERS_TO_SPAWN} players...`);

    for (let i = 1; i <= PLAYERS_TO_SPAWN; i++) {
        const s = io(URL);
        playerSockets.push(s);
        s.emit('join', { alias: `TT_BM_${i}` });
        // We don't wait for login response for speed, just stagger slightly
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Wait for all to join
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start Game (Triggers Distribution)
    // We expect config to be default or we can set it via Admin if we implemented that.
    // Assuming default config (3 items per player -> 36 total).
    console.log('Starting Game...');
    adminSocket.emit('start_game');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Analyze State
    let gameState: any;
    adminSocket.on('state_update', (state: any) => { gameState = state; });
    adminSocket.emit('admin_trigger_state_update'); // Force update

    // Wait for state
    let retries = 0;
    while (!gameState && retries < 20) {
        console.log(`Waiting for state... ${retries}/20`);
        adminSocket.emit('admin_trigger_state_update');
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
    }

    if (!gameState) {
        console.error("Failed to get game state");
        process.exit(1);
    }

    // Verification Logic
    const players = Object.values(gameState.players).filter((p: any) => p.nodeId);
    console.log(`Analyzing ${players.length} players...`);

    let minItems = 999;
    let maxItems = 0;
    let solvable = true;
    let totalSupply = 0;

    // Check Needs vs Haves
    const totalNeeds: Record<string, number> = { Cash: 0, Artwork: 0, Gold: 0, Diamonds: 0 };
    const totalHaves: Record<string, number> = { Cash: 0, Artwork: 0, Gold: 0, Diamonds: 0 };

    players.forEach((p: any) => {
        const count = p.inventory.length;
        if (count < minItems) minItems = count;
        if (count > maxItems) maxItems = count;

        // Count Inventory
        p.inventory.forEach((t: any) => {
            totalHaves[t.type]++;
            totalSupply++;
        });

        // Count Needs
        for (const [type, num] of Object.entries(p.contract)) {
            totalNeeds[type] += (num as number);
        }

        if (count < 2) {
            console.error(`FAILURE: Player ${p.alias} has only ${count} items!`);
        }
    });

    console.log(`Min Items: ${minItems}`);
    console.log(`Max Items: ${maxItems}`);
    console.log(`Total Supply: ${totalSupply}`);

    // Check Solvability
    for (const type of ['Cash', 'Artwork', 'Gold', 'Diamonds']) {
        if (totalHaves[type] < totalNeeds[type]) {
            console.error(`FAILURE LIMIT: ${type} - Need ${totalNeeds[type]}, Have ${totalHaves[type]}`);
            solvable = false;
        } else {
            console.log(`OK: ${type} - Need ${totalNeeds[type]}, Have ${totalHaves[type]}`);
        }
    }

    if (minItems >= 2) {
        console.log('SUCCESS: All players have at least 2 items.');
    } else {
        console.error('FAILURE: Minimum item constraint violated.');
    }

    // Check Outlier Bias (if extra items exist)
    // We need to know who is outlier. The state has nodeId, but logic uses static NODES.
    // We can't easily check "Outlier" role here without importing NODES or inferring.
    // Skipping role check for automated test simplicity, relying on unit logic.

    playerSockets.forEach(s => s.disconnect());
    adminSocket.disconnect();
    process.exit(0);
}

testEconomy();
