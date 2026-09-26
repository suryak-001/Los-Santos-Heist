export type ResourceType = 'Trishula' | 'Gandiva' | 'Vajra' | 'Brahmastra';

export interface ResourceToken {
  id: string; // e.g., 'Alpha-101'
  type: ResourceType;
  history: string[]; // ['System', 'TT_BM_1', 'TT_BM_3']
  transit: string[]; // Aliases carrying this item for someone else; paid when it reaches a player who needs it
  paidFixers: string[]; // Aliases already paid a Fixer's Cut for this item
}

export type NodeId = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';

// Transaction Log for Admin
export interface Transaction {
  id: string;
  timestamp: number;
  tokenId: string;
  from: string; // Node ID or 'SYSTEM'
  to: string;   // Node ID
  type: ResourceType;
}

//  Facilitation tracking for analytics
export interface Facilitation {
  id: string;
  facilitatorId: NodeId; // Node ID (e.g., '3')
  facilitatorAlias: string; // e.g., 'TT_BM_3'
  fromNodeId: NodeId; // Original sender
  toNodeId: NodeId; // Final receiver
  tokenId: string; // Token that was facilitated
  tokenType: ResourceType;
  timestamp: number;
  helpedContractCompletion: boolean; // Did this help receiver complete?
}

export interface LotteryState {
  candidates: string[];
  winner: string | null;
  isRolling: boolean;
  roundTitle: string;
  pastWinners: string[];
}

export interface TimerState {
  endTime: number | null; // Timestamp when timer expires
  remainingWhenPaused: number | null; // MS remaining when paused
  isRunning: boolean;
  durationMinutes: number; // Selected duration (5, 10, 15, etc)
}

export interface ChatMessage {
  senderId: string;
  senderAlias: string;
  receiverId: string;
  message: string;
  timestamp: number;
}

export interface Player {
  id: string; // Socket ID
  alias: string; // TT_BM_X
  nodeId: NodeId | null;
  inventory: ResourceToken[]; // Changed from count to tokens
  contract: Record<ResourceType, number>; // Goal remains count-based
  score: number;
  isReady: boolean;
  online: boolean;
  completionTime: number | null; // Timestamp when contract completed
  completionBonus: number | null; // Time bonus locked in at completion
  facilitationCount: number; // Count of successful facilitations
  facilitatedTransfers: string[]; // IDs of tokens they facilitated
}

export interface LeaderboardEntry {
  id: string;
  dbId?: string; // Database UUID
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


export interface GameConfig {
  totalResources: number | null; // null = auto-calculate
  resourcesPerPlayer: number;
}

export interface GameState {
  phase: 'LOBBY' | 'ACTIVE' | 'ENDED';
  stage: 1 | 2;
  paused: boolean;
  pausedAt: number | null; // When the current pause started
  totalPausedMs: number; // Paused time excluded from the completion bonus
  config: GameConfig;
  players: Record<string, Player>;
  messages: ChatMessage[];
  startTime: number | null;
  transactions: Transaction[]; // Global history
  lottery: LotteryState;
  facilitations: Facilitation[]; // Track all facilitations for analytics
  timer: TimerState;
  currentSessionId: string | null;
}
