import type { Position, Direction, Hunt, GameState } from '@/types';
import { GRID_SIZE, MAX_STEPS, START_POSITION } from './constants';

/**
 * Calculates the Manhattan distance between two positions.
 */
export const calculateDistance = (pos1: Position, pos2: Position): number => {
  return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
};

/**
 * Checks if a given position is within the grid boundaries.
 */
export const isPositionValid = (pos: Position): boolean => {
  return pos.x >= 0 && pos.x < GRID_SIZE && pos.y >= 0 && pos.y < GRID_SIZE;
};

/**
 * Calculates the next position based on the current position and direction.
 * Does not perform bounds checking.
 */
export const calculateNextPosition = (currentPos: Position, direction: Direction): Position => {
  const newPos = { ...currentPos };
  switch (direction) {
    case 'up': newPos.y -= 1; break;
    case 'down': newPos.y += 1; break;
    case 'left': newPos.x -= 1; break;
    case 'right': newPos.x += 1; break;
  }
  return newPos;
};

/**
 * Generates a direction hint (e.g., North, South-East) from player to treasure.
 */
export const getDirectionHint = (player: Position, treasure: Position): string => {
  const dx = treasure.x - player.x;
  const dy = treasure.y - player.y;

  if (dx === 0 && dy === 0) return ""; // Should not happen during active play

  let vertical = "";
  let horizontal = "";

  if (dy < 0) vertical = "North";
  if (dy > 0) vertical = "South";
  if (dx < 0) horizontal = "West";
  if (dx > 0) horizontal = "East";

  if (vertical && horizontal) return `${vertical}-${horizontal}`;
  return vertical || horizontal;
};

/**
 * Generates a combined hint string based on distance change and direction.
 */
export const generateHint = (
    currentPos: Position,
    previousPos: Position,
    treasurePos: Position,
    moveNumber: number
): string => {
  const currentDistance = calculateDistance(currentPos, treasurePos);
  const previousDistance = calculateDistance(previousPos, treasurePos);
  const directionHint = getDirectionHint(currentPos, treasurePos);

  let distanceFeedback = "";
  let emoji = "";

  if (currentDistance < previousDistance) {
    distanceFeedback = "Warmer";
    emoji = "🔥";
  } else if (currentDistance > previousDistance) {
    distanceFeedback = "Colder";
    emoji = "🧊";
  } else {
    distanceFeedback = "Same distance";
    emoji = "🤔";
  }

  return `${moveNumber}: ${emoji} ${distanceFeedback}. Direction: 🧭 ${directionHint}.`;
};

/**
 * Checks if the player has found the treasure.
 */
export const checkWinCondition = (playerPos: Position, treasurePos: Position): boolean => {
  return playerPos.x === treasurePos.x && playerPos.y === treasurePos.y;
};


/**
 * Generates a random treasure position that is reachable within MAX_STEPS
 * and not the same as the START_POSITION.
 */
export const generateReachableTreasurePosition = (): Position => {
  let pos: Position;
  let distance: number;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
    distance = calculateDistance(START_POSITION, pos);
  // Ensure treasure is not at start, is reachable within max steps (Manhattan distance),
  // and respects parity (optional but good for simple grids): if MAX_STEPS is even,
  // distance must be even; if MAX_STEPS is odd, distance must be odd.
  } while (
    (pos.x === START_POSITION.x && pos.y === START_POSITION.y) ||
    distance === 0 ||
    distance > MAX_STEPS ||
    (MAX_STEPS % 2 !== distance % 2)
  );
  return pos;
};

/**
 * Creates a new Hunt object with initial state.
 * Requires a unique ID and name.
 */
export const createNewHunt = (id: string, name: string, creatorId: string): Hunt => {
    const treasurePosition = generateReachableTreasurePosition();
    const initialState: GameState = 'playing'; // Start directly in 'playing' state for MVP

    // Randomly assign treasure type
    const treasureTypes = ['COMMON', 'RARE', 'EPIC']; // Use uppercase strings directly
    const selectedTreasureType = treasureTypes[Math.floor(Math.random() * treasureTypes.length)];

    return {
        id,
        name,
        players: [creatorId], // Start with the creator
        moves: [START_POSITION], // Initial position is the first move
        hints: [], // No hints initially
        currentPosition: START_POSITION,
        treasurePosition, // Generated, kept server-side
        stepsRemaining: MAX_STEPS,
        maxSteps: MAX_STEPS,
        state: initialState,
        createdAt: Date.now(),
        treasureType: selectedTreasureType, // Assign directly, already uppercase
    };
};


/**
 * Processes a player's move, updates the hunt state, and returns the new state.
 */
export const processPlayerMove = (currentHunt: Hunt, direction: Direction, playerId: string): Hunt => {
  if (currentHunt.state !== 'playing') {
    console.warn('Move attempted on non-playing hunt state:', currentHunt.state);
    return currentHunt; // No changes if game is not active
  }

  const currentPosition = currentHunt.currentPosition;
  const nextPosition = calculateNextPosition(currentPosition, direction);

  // 1. Validate Move
  if (!isPositionValid(nextPosition)) {
    console.log('Invalid move: out of bounds');
    // Optionally return the current state with an added error hint/message?
    // For now, just return the unchanged state.
    return {
        ...currentHunt,
        hints: [...currentHunt.hints, `Move ${currentHunt.moves.length}: 🚧 Move out of bounds! Try again.`]
        // Note: We don't decrement steps for an invalid move
    };
  }

  // 2. Update State (Valid Move)
  const newStepsRemaining = currentHunt.stepsRemaining - 1;
  const newMoveHistory = [...currentHunt.moves, nextPosition];
  const moveNumber = newMoveHistory.length -1; // -1 because history includes START_POSITION

  // 3. Generate Hint
  const hint = generateHint(nextPosition, currentPosition, currentHunt.treasurePosition, moveNumber);
  const newHints = [...currentHunt.hints, hint];

  // 4. Check Win/Loss Conditions
  let newGameState: GameState = currentHunt.state;
  const won = checkWinCondition(nextPosition, currentHunt.treasurePosition);

  if (won) {
    newGameState = 'won';
  } else if (newStepsRemaining <= 0) {
    newGameState = 'lost';
  }

  // 5. Add player to list if not already present (for joining players)
  const newPlayers = currentHunt.players.includes(playerId) ? currentHunt.players : [...currentHunt.players, playerId];

  // 6. Return updated Hunt state
  return {
    ...currentHunt,
    players: newPlayers,
    currentPosition: nextPosition,
    moves: newMoveHistory,
    hints: newHints,
    stepsRemaining: newStepsRemaining,
    state: newGameState,
  };
}; 