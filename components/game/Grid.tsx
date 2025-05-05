import React from 'react';
import { Position } from '@/types'; 
import { GRID_SIZE, START_POSITION } from '@/lib/constants'; 
import { Move } from '@prisma/client'; // Import Move type if needed for moveHistory prop

interface CellProps {
  isPlayer: boolean;
  isPath: boolean;
  isStart: boolean;
  isTappable: boolean; 
  onTap: () => void; 
}

const Cell: React.FC<CellProps> = ({ isPlayer, isPath, isStart, isTappable, onTap }) => {
  // Base cell style - Apply styles from reference design
  let cellClasses = `
    rounded border border-purple-700/50 /* Updated border from reference */
    flex items-center justify-center 
    transition-all duration-200 ease-in-out
    aspect-square 
    relative /* Add relative positioning for inner element */
    overflow-hidden /* Hide overflow from inner element */
    group /* Add group for hover effects */
  `;
  let content = null;
  let interactionClasses = '';
  let innerElement = null; 

  let baseBg = 'bg-purple-900/30'; 
  if (isPath) baseBg = 'bg-cyan-900/40'; 
  if (isStart) baseBg = 'bg-blue-700/50'; 

  cellClasses += ` ${baseBg}`;

  // --- Player Specific Styles --- 
  if (isPlayer) {
    // Player cell: Use ring and shadow from reference, remove border glow/pulse if not needed
    cellClasses += ' bg-cyan-400/50 ring-2 ring-cyan-300 shadow-lg shadow-cyan-500/50 scale-110 z-10'; // Added ring, shadow, scale, z-index
    // Remove generic border and shadow if using ring/shadow
    cellClasses = cellClasses.replace('border border-purple-700/50', ''); 
    // Optional: decide if pulse animation is still desired with ring/shadow
    // cellClasses += ' animate-pulse-glow'; // Keep or remove based on visual preference
    content = <span className="text-lg">🚀</span>; 
  } 

  // --- Tappable Indicator (Inner Element) --- 
  if (isTappable) {
    interactionClasses = 'cursor-pointer';
    // Inner glowing square: Persistently visible if tappable, enhanced on hover
    innerElement = (
      <div 
        className={`
          absolute inset-1 rounded 
          bg-purple-700/40 border border-purple-500 
          shadow-[0_0_8px_rgba(168,85,247,0.6),inset_0_0_4px_rgba(168,85,247,0.4)] 
          transition-opacity duration-200 
          group-hover:bg-purple-600/60 /* Enhance background on hover */
          ${isTappable ? 'opacity-100' : 'opacity-0'} /* Persistent visibility */
        `}
      ></div>
    );
  } else {
    interactionClasses = 'cursor-default';
  }

  // --- Start/Path Content (override if needed) --- 
  if (!isPlayer) { // Don't override player content
      // if(isStart) content = <span className="text-xs opacity-70">🏁</span>; // Removed start marker
      // else if(isPath) content = <span className="text-xs opacity-50\">👣</span>; // Keep or remove path marker based on preference
  }

  return (
    <button 
      type="button"
      onClick={isTappable ? onTap : undefined}
      disabled={!isTappable}
      className={`${cellClasses} ${interactionClasses}`}
      aria-label={isTappable ? 'Move here' : undefined}
    >
      {/* Render inner element for tappable glow */} 
      {innerElement}
      {/* Ensure content is above inner element */}
      <div className="relative z-10"> 
        {content}
      </div>
    </button>
  );
};

interface GridProps {
  playerPosition: Position;
  moveHistory: Position[];
  // Add function to determine if a cell is tappable based on playerPosition
  isCellTappable: (cellPos: Position) => boolean;
  // Add callback for handling taps
  onCellTap: (cellPos: Position) => void;
  isLoading: boolean; // Add isLoading prop
  isGameOver: boolean;
}

const Grid: React.FC<GridProps> = ({ playerPosition, moveHistory, isCellTappable, onCellTap, isLoading, isGameOver }) => {
  const cells = [];
  const pathSet = new Set(moveHistory.map(pos => `${pos.x}-${pos.y}`));

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const currentPos = { x, y };
      const isPlayer = playerPosition.x === x && playerPosition.y === y;
      const isPath = pathSet.has(`${x}-${y}`);
      const isStart = START_POSITION.x === x && START_POSITION.y === y;
      const tappable = isCellTappable(currentPos);
      const isInteractable = !isLoading && !isGameOver && tappable;

      let cellClasses = "w-full h-full border border-gray-700 flex items-center justify-center transition-colors duration-200 ";
      
      if (isPlayer) {
        cellClasses += " bg-blue-500/30"; 
      } else if (isPath) {
        cellClasses += " bg-gray-600/30"; 
      }

      if (isInteractable) {
        cellClasses += " cursor-pointer hover:bg-cyan-500/40 ring-2 ring-cyan-400/50 ring-inset"; // Tappable style
      } else if (tappable) {
         cellClasses += " opacity-50"; // Visited adjacent style (non-tappable)
      }

      cells.push(
        <div
          key={`${x}-${y}`}
          className={cellClasses}
          onClick={() => isInteractable && onCellTap(currentPos)}
        >
          {isPlayer && (
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
          )}
          {/* Optionally add move numbers or other indicators */}
        </div>
      );
    }
  }

  return (
    <div className="relative w-full max-w-lg aspect-square shadow-lg bg-gray-800 rounded-lg p-2">
      <div 
        className={`grid grid-cols-10 grid-rows-10 gap-0 w-full h-full ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {cells}
      </div>
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <p className="text-white text-lg font-semibold animate-pulse">Processing Move...</p>
        </div>
      )}
    </div>
  );
};

export default Grid; 