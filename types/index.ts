import type { HuntLock as PrismaHuntLock } from '@prisma/client';
import type { HuntDetails as ActionHuntDetails } from '@/app/actions/hunt'; // Import existing detail type

export type Position = {
  x: number;
  y: number;
};

export type GameState = 'lobby' | 'playing' | 'won' | 'lost';

export type Direction = 'up' | 'down' | 'left' | 'right';

// Add FarcasterUser type back
export type FarcasterUser = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

// Basic structure for a Hunt. This will likely expand.
export type Hunt = {
  id: string; // Unique identifier for the hunt
  name: string; // User-friendly name (optional, could be generated)
  players: string[]; // Array of player identifiers (e.g., Farcaster FIDs)
  moves: Position[]; // History of positions visited
  hints: string[]; // History of hints received
  currentPosition: Position;
  treasurePosition: Position; // Only stored backend/server-side initially
  stepsRemaining: number;
  maxSteps: number;
  state: GameState;
  createdAt: number; // Timestamp
  treasureType: string;
  // Maybe add treasureType later? ('common', 'rare', 'epic')
};

// --- SSE Payload Types --- 

/**
 * Payload sent when a hunt's lock status changes.
 */
export interface LockUpdatePayload {
  type: 'lock_update';
  // Use the Prisma generated type or null if lock is removed
  lock: PrismaHuntLock | null; 
}

/**
 * Payload sent when a hunt's state is fully updated (e.g., after a move).
 */
export interface HuntUpdatePayload {
  type: 'hunt_update';
  // Reuse the detailed type defined in Server Actions
  details: ActionHuntDetails; 
}

/**
 * Union type for messages broadcast on a specific hunt channel (`hunt:{huntId}`).
 */
export type HuntChannelPayload = LockUpdatePayload | HuntUpdatePayload;

/**
 * Payload sent as a notification that the list of hunts has changed.
 */
export interface HuntsListUpdatePayload {
  type: 'list_update'; // Add type for consistency, even if simple
  timestamp: number; 
} 