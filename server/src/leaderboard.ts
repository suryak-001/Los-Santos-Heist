import { PrismaClient } from '@prisma/client';

export interface LeaderboardEntry {
    id?: string; // Optional for input, required for output if fully typed
    name: string;
    rank: number;
    score: number;
    country?: string;
    status?: string;
}

export interface LeaderboardState {
    round: number;
    entries: LeaderboardEntry[];
}

const prisma = new PrismaClient();
const LEADERBOARD_ID = 1; // Single global leaderboard for now

export class LeaderboardManager {
    private state: LeaderboardState;

    constructor() {
        this.state = {
            round: 1,
            entries: []
        };
    }

    public async init() {
        await this.load();
    }

    private async load() {
        try {
            // Find or create the leaderboard
            let lb = await prisma.leaderboard.findUnique({
                where: { id: LEADERBOARD_ID },
                include: { entries: true }
            });

            if (!lb) {
                // Initialize default
                lb = await prisma.leaderboard.create({
                    data: {
                        id: LEADERBOARD_ID,
                        round: 1
                    },
                    include: { entries: true }
                });
            }

            // Map DB entries to partial state
            const entries: LeaderboardEntry[] = lb.entries.map((e: { id: string; name: string; rank: number; score: number; country: string | null; status: string | null; }) => ({
                id: e.id,
                name: e.name,
                rank: e.rank,
                score: e.score,
                country: e.country || undefined,
                status: e.status || undefined
            }));

            // Sort just in case DB doesn't ensure order
            entries.sort((a, b) => a.rank - b.rank);

            this.state = {
                round: lb.round,
                entries
            };

            console.log('[LEADERBOARD] Loaded from DB');

        } catch (error) {
            console.error('[LEADERBOARD] Failed to load:', error);
        }
    }

    private async save() {
        try {
            // We do a transaction: Update Leaderboard meta, Delete old entries, Create new entries
            // This is simple but effective for full state sync
            await prisma.$transaction(async (tx) => {
                // 1. Update Round
                await tx.leaderboard.upsert({
                    where: { id: LEADERBOARD_ID },
                    update: { round: this.state.round },
                    create: { id: LEADERBOARD_ID, round: this.state.round }
                });

                // 2. Delete all existing entries
                await tx.leaderboardEntry.deleteMany({
                    where: { leaderboardId: LEADERBOARD_ID }
                });

                // 3. Insert new entries
                if (this.state.entries.length > 0) {
                    await tx.leaderboardEntry.createMany({
                        data: this.state.entries.map(e => ({
                            leaderboardId: LEADERBOARD_ID,
                            name: e.name,
                            rank: e.rank,
                            score: e.score,
                            country: e.country,
                            status: e.status
                        }))
                    });
                }
            });
            // console.log('[LEADERBOARD] Saved to DB'); 
        } catch (error) {
            console.error('[LEADERBOARD] Failed to save:', error);
        }
    }

    public getState(): LeaderboardState {
        return this.state;
    }

    public async updateState(newState: LeaderboardState) {
        // Validation Logic
        const validatedEntries = newState.entries.map(entry => {
            // 1. Name: Alphabets only (and spaces usually? User said "Names should be alphabets")
            // Strict interpretation: /^[A-Za-z]+$/ or allow spaces? "John Doe" is standard.
            // Let's allow spaces but restrict to letters.
            let validName = entry.name.replaceAll(/[^a-zA-Z\s]/g, '');
            if (validName.trim().length === 0) validName = "Unknown"; // Fallback

            // 2. Country/Nodes: Alphanumeric
            // The field is `country` in interface, mapped to `nodeId` often.
            let validCountry = entry.country ? entry.country.replaceAll(/[^a-zA-Z0-9\s]/g, '') : undefined;

            // 3. Status: ACTIVE, ELIMINATED, COMPLETED
            // "rest should show active, eliminated status"
            let validStatus = entry.status ? entry.status.toUpperCase() : 'ACTIVE';
            const ALLOWED_STATUSES = ['ACTIVE', 'ELIMINATED', 'COMPLETED'];

            if (!ALLOWED_STATUSES.includes(validStatus)) {
                // Fallback to ACTIVE if unknown status is provided
                validStatus = 'ACTIVE';
            }

            return {
                ...entry,
                name: validName,
                country: validCountry,
                status: validStatus
            };
        });

        this.state = {
            round: newState.round,
            entries: validatedEntries
        };

        // Fire and forget with validated data
        return this.state;
    }
}

export const leaderboardManager = new LeaderboardManager();
