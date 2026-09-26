// Round 2 rule checks, run against GameManager directly (no sockets).
// Usage: GAME_STATE_PATH=/tmp/x.json DATABASE_URL=... npx ts-node scripts/test_round2.ts
import assert from 'node:assert/strict';
import { GameManager } from '../src/game';
import { Player, ResourceType, NodeId, ResourceToken } from '../src/types/game';

const EMPTY: Record<ResourceType, number> = { Trishula: 0, Gandiva: 0, Vajra: 0, Brahmastra: 0 };

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
    return { game, byNode, give, send };
}

async function main() {
    console.log("Fixer's Cut");

    await check('chain 9 -> 4 -> 1 -> 5 -> 10 pays exactly the 3 middlemen', async () => {
        const { game, byNode, give, send } = await freshGame();
        byNode(10).contract.Vajra = 1;
        const t = give(9, 'Vajra');
        send(9, 4, t); send(4, 1, t); send(1, 5, t); send(5, 10, t);
        for (const n of [4, 1, 5]) assert.equal(byNode(n).facilitationCount, 1, `node ${n}`);
        for (const n of [9, 10]) assert.equal(byNode(n).facilitationCount, 0, `node ${n}`);
        assert.equal(game.getState().facilitations.length, 3);
        assert.equal(byNode(4).score - game.calculateScore({ ...byNode(4), facilitationCount: 0 }), 100);
        assert.deepEqual(t.transit, []);
    });

    await check('bouncing an item between two players pays nothing', async () => {
        const { byNode, give, send } = await freshGame();
        byNode(3).contract.Gandiva = 1;
        const t = give(3, 'Gandiva');
        send(3, 7, t); send(7, 3, t); send(3, 7, t); send(7, 3, t);
        assert.equal(byNode(7).facilitationCount, 0);
        assert.equal(byNode(3).facilitationCount, 0);
    });

    await check('a fixer is paid at most once per item', async () => {
        const { byNode, give, send } = await freshGame();
        byNode(1).contract.Trishula = 1;
        byNode(8).contract.Trishula = 1;
        const t = give(7, 'Trishula');
        send(7, 3, t); send(3, 1, t);           // 3 relays to 1: paid
        byNode(1).contract.Trishula = 0;        // 1 no longer needs it
        send(1, 3, t); send(3, 8, t);           // 3 relays again to 8: not paid twice
        assert.equal(byNode(3).facilitationCount, 1);
    });

    await check('relaying also pays in Open City', async () => {
        const { game, byNode, give, send } = await freshGame();
        game.setStage(2);
        byNode(12).contract.Brahmastra = 1;
        const t = give(7, 'Brahmastra');
        send(7, 1, t); send(1, 12, t);
        assert.equal(byNode(1).facilitationCount, 1);
    });

    console.log(`\n${passed} checks passed`);
}

main().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
