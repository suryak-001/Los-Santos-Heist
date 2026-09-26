// Round 2 rule checks, run against GameManager directly (no sockets).
// Usage: GAME_STATE_PATH=/tmp/x.json DATABASE_URL=... npx ts-node scripts/test_round2.ts
import assert from 'node:assert/strict';
import { GameManager } from '../src/game';
import { Player, ResourceType, NodeId, ResourceToken } from '../src/types/game';

const EMPTY: Record<ResourceType, number> = { Cash: 0, Artwork: 0, Gold: 0, Diamonds: 0 };

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
    try {
        await fn();
        passed++;
        console.log(`  ok   ${name}`);
    } catch (err) {
        console.error(`  FAIL ${name}`);
        throw err;
    }
}

// A started 12-player game with every contract and inventory emptied,
// so each test sets up exactly the items it needs.
async function freshGame() {
    const game = new GameManager();
    for (let n = 1; n <= 12; n++) game.addPlayer(`sock${n}`, `TT_BM_${n}`);
    await game.startGame();
    const players = game.getState().players;
    Object.values(players).forEach(p => {
        p.inventory = [];
        p.contract = { ...EMPTY };
        p.score = 0;
        p.completionTime = null;
        p.completionBonus = null;
    });
    const byNode = (n: number): Player => players[`sock${n}`];
    let seq = 0;
    const give = (n: number, type: ResourceType): ResourceToken => {
        const token: ResourceToken = { id: `${type}-T${seq++}`, type, history: ['SYSTEM', byNode(n).alias], transit: [], paidFixers: [] };
        byNode(n).inventory.push(token);
        return token;
    };
    const send = (from: number, to: number, token: ResourceToken) => {
        const res = game.transferResource(`sock${from}`, String(to) as NodeId, token.id);
        assert.ok(res.success, `transfer ${from} -> ${to} failed: ${res.msg}`);
    };
    // Pretend the game started this long ago
    const rewind = (ms: number) => { game.getState().startTime = Date.now() - ms; };
    return { game, byNode, give, send, rewind };
}

async function main() {
    console.log("Fixer's Cut");

    await check('chain 9 -> 4 -> 1 -> 5 -> 10 pays exactly the 3 middlemen', async () => {
        const { game, byNode, give, send } = await freshGame();
        byNode(10).contract.Gold = 1;
        const t = give(9, 'Gold');
        send(9, 4, t); send(4, 1, t); send(1, 5, t); send(5, 10, t);
        for (const n of [4, 1, 5]) assert.equal(byNode(n).facilitationCount, 1, `node ${n}`);
        for (const n of [9, 10]) assert.equal(byNode(n).facilitationCount, 0, `node ${n}`);
        assert.equal(game.getState().facilitations.length, 3);
        assert.equal(byNode(4).score - game.calculateScore({ ...byNode(4), facilitationCount: 0 }), 100);
        assert.deepEqual(t.transit, []);
    });

    await check('bouncing an item between two players pays nothing', async () => {
        const { byNode, give, send } = await freshGame();
        byNode(3).contract.Artwork = 1;
        const t = give(3, 'Artwork');
        send(3, 7, t); send(7, 3, t); send(3, 7, t); send(7, 3, t);
        assert.equal(byNode(7).facilitationCount, 0);
        assert.equal(byNode(3).facilitationCount, 0);
    });

    await check('a fixer is paid at most once per item', async () => {
        const { byNode, give, send } = await freshGame();
        byNode(1).contract.Cash = 1;
        byNode(8).contract.Cash = 1;
        const t = give(7, 'Cash');
        send(7, 3, t); send(3, 1, t);           // 3 relays to 1: paid
        byNode(1).contract.Cash = 0;        // 1 no longer needs it
        send(1, 3, t); send(3, 8, t);           // 3 relays again to 8: not paid twice
        assert.equal(byNode(3).facilitationCount, 1);
    });

    await check('relaying also pays in Open City', async () => {
        const { game, byNode, give, send } = await freshGame();
        game.setStage(2);
        byNode(12).contract.Diamonds = 1;
        const t = give(7, 'Diamonds');
        send(7, 1, t); send(1, 12, t);
        assert.equal(byNode(1).facilitationCount, 1);
    });

    console.log('\nTime Is Money');
    const MIN = 60_000;

    await check('completing during minute 6 locks in a 700 bonus', async () => {
        const { byNode, give, send, rewind } = await freshGame();
        byNode(3).contract.Gold = 1;
        byNode(3).contract.Artwork = 1;
        give(3, 'Artwork');
        rewind(6.5 * MIN);
        send(7, 3, give(7, 'Gold'));
        assert.equal(byNode(3).completionBonus, 700);
        assert.equal(byNode(3).score, 200 + 700);
    });

    await check('bonus steps down 50 per minute with a floor of 200', async () => {
        const { game, rewind } = await freshGame();
        const now = Date.now();
        const at = (m: number) => { rewind(m * MIN); return game.completionBonusAt(now); };
        assert.equal(at(0), 1000);
        assert.equal(at(3.99), 850);
        assert.equal(at(4), 800);
        assert.equal(at(12), 400);
        assert.equal(at(16), 200);
        assert.equal(at(40), 200);
    });

    await check('paused time does not count against the bonus', async () => {
        const { game, byNode, give, send, rewind } = await freshGame();
        byNode(3).contract.Gold = 1;
        rewind(8.5 * MIN);
        game.getState().totalPausedMs = 2 * MIN;
        send(7, 3, give(7, 'Gold'));
        assert.equal(byNode(3).completionBonus, 700);
    });

    await check('a pause after completing does not raise the locked bonus', async () => {
        const { game, byNode, give, send, rewind } = await freshGame();
        byNode(3).contract.Gold = 1;
        rewind(6.5 * MIN);
        send(7, 3, give(7, 'Gold'));
        game.pauseGame();
        game.getState().pausedAt = Date.now() - 5 * MIN;
        game.resumeGame();
        assert.equal(game.calculateScore(byNode(3)), 100 + 700);
    });

    await check('handing away a needed item drops the bonus; re-completing uses the new time', async () => {
        const { byNode, give, send, rewind } = await freshGame();
        byNode(3).contract.Gold = 1;
        byNode(7).contract.Cash = 1;
        give(7, 'Cash');
        const t = give(3, 'Gold');
        rewind(2.5 * MIN);
        send(7, 3, give(7, 'Artwork'));          // 3 is complete at minute 2
        assert.equal(byNode(3).completionBonus, 900);
        send(3, 7, t);                           // hands the needed Gold away
        assert.equal(byNode(3).completionTime, null);
        assert.equal(byNode(3).completionBonus, null);
        assert.equal(byNode(3).score, 0);
        rewind(9.5 * MIN);
        send(7, 3, t);                           // gets it back at minute 9
        assert.equal(byNode(3).completionBonus, 550);
        assert.equal(byNode(3).score, 100 + 550);
    });

    console.log('\nPolice Raid');

    await check('seizes exactly 3 items from the 3 most exposed players, once', async () => {
        const { game, byNode, give } = await freshGame();
        Object.values(game.getState().players).forEach(p => { if (p.nodeId) p.contract.Diamonds = 1; });
        for (let i = 0; i < 5; i++) give(1, 'Gold');
        for (let i = 0; i < 4; i++) give(2, 'Gold');
        for (let i = 0; i < 3; i++) give(3, 'Gold');
        give(4, 'Gold'); give(5, 'Gold');
        const before = Object.values(game.getState().players).reduce((n, p) => n + p.inventory.length, 0);

        assert.ok(game.policeRaid().success);
        const after = Object.values(game.getState().players).reduce((n, p) => n + p.inventory.length, 0);
        assert.equal(before - after, 3);
        assert.deepEqual(game.getState().raid.districts, ['1', '2', '3']);
        assert.equal(byNode(1).inventory.length, 4);
        assert.equal(game.getState().transactions.filter(t => t.to === 'POLICE').length, 3);

        assert.equal(game.policeRaid().success, false);
        const again = Object.values(game.getState().players).reduce((n, p) => n + p.inventory.length, 0);
        assert.equal(again, after);
    });

    await check("never takes a completed player's needed items", async () => {
        const { game, byNode, give, send } = await freshGame();
        Object.values(game.getState().players).forEach(p => { if (p.nodeId) p.contract.Diamonds = 1; });
        // Node 1 is complete and holds 5 items, only 2 of them spare
        byNode(1).contract = { Cash: 0, Artwork: 1, Gold: 2, Diamonds: 0 };
        give(1, 'Gold'); give(1, 'Gold'); give(1, 'Artwork'); give(1, 'Cash');
        send(3, 1, give(3, 'Cash'));
        assert.ok(byNode(1).completionTime);
        // Three incomplete players hold 1 item each, so node 1 (2 exposed) is ranked first
        give(7, 'Gold'); give(8, 'Gold'); give(9, 'Gold');

        assert.ok(game.policeRaid().success);
        assert.equal(game.getState().raid.districts[0], '1');
        assert.equal(byNode(1).inventory.filter(t => t.type === 'Cash').length, 1);
        assert.equal(byNode(1).inventory.filter(t => t.type === 'Gold').length, 2);
        assert.ok(byNode(1).completionTime, 'still complete');
    });

    await check('players with nothing exposed are skipped; reset clears the raid', async () => {
        const { game, byNode, give } = await freshGame();
        Object.values(game.getState().players).forEach(p => { if (p.nodeId) p.contract.Diamonds = 1; });
        give(7, 'Gold');
        assert.ok(game.policeRaid().success);
        assert.deepEqual(game.getState().raid.districts, ['7']);
        assert.equal(byNode(7).inventory.length, 0);
        await game.resetGame();
        assert.equal(game.getState().raid.done, false);
        assert.equal(game.getState().totalPausedMs, 0);
    });

    await check('the raid is refused while paused or before the game starts', async () => {
        const { game } = await freshGame();
        game.pauseGame();
        assert.equal(game.policeRaid().success, false);
        await game.resetGame();
        assert.equal(game.policeRaid().success, false);
    });

    console.log(`\n${passed} checks passed`);
}

main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
