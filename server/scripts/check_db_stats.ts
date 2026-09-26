
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DATABASE STATS ---');

    try {
        const sessionCount = await prisma.gameSession.count();
        const playerCount = await prisma.player.count();
        const txCount = await prisma.transaction.count();

        console.log(`Sessions: ${sessionCount}`);
        console.log(`Players: ${playerCount}`);
        console.log(`Transactions: ${txCount}`);

        if (sessionCount > 0) {
            const lastSession = await prisma.gameSession.findFirst({
                orderBy: { startTime: 'desc' },
                include: { players: true, transactions: { take: 5 } }
            });

            if (lastSession) {
                console.log('\n--- LATEST SESSION ---');
                console.log(`ID: ${lastSession.id}`);
                console.log(`Status: ${lastSession.status}`);
                console.log(`StartTime: ${lastSession.startTime}`);
                console.log(`Player Count: ${lastSession.players.length}`);
                console.log(`Last 5 Transactions:`);
                console.table(lastSession.transactions.map(t => ({
                    id: t.id,
                    from: t.fromId,
                    to: t.toId,
                    type: t.resourceType,
                    time: t.timestamp
                })));
            }
        }
    } catch (error) {
        console.error('Error querying DB:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
