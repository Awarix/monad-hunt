import type { Position } from '../types';

export const GRID_SIZE: number = 10;
export const MAX_STEPS: number = 10;

// Calculate starting position (center of the grid)
// Note: Using Math.floor ensures integer coordinates for 0-based indexing.
const startCoord = Math.floor((GRID_SIZE - 1) / 2);
export const START_POSITION: Position = { x: startCoord, y: startCoord }; 