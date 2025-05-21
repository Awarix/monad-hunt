import React from 'react';
import { Position } from '@/types'; 
import { GRID_SIZE } from '@/lib/constants'; 
import { CommonChestIcon, RareChestIcon, EpicChestIcon } from '@/components/icons'; // Import chest icons

interface GridProps {
  playerPosition: Position;
  moveHistory: Position[];
  // Add function to determine if a cell is tappable based on playerPosition
  isCellTappable: (cellPos: Position) => boolean;
  // Add callback for handling taps
  onCellTap: (cellPos: Position) => void;
  isLoading: boolean; // Add isLoading prop
  isGameOver: boolean;
  revealedTreasure?: { x: number; y: number; rarity: string } | null; // New prop
}

const Grid: React.FC<GridProps> = ({ playerPosition, moveHistory, isCellTappable, onCellTap, isLoading, isGameOver, revealedTreasure }) => {
  const cells = [];
  const pathSet = new Set(moveHistory.map(pos => `${pos.x}-${pos.y}`));

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const currentPos = { x, y };
      const isPlayer = playerPosition.x === x && playerPosition.y === y;
      const isPath = pathSet.has(`${x}-${y}`);
      // const isStart = START_POSITION.x === x && START_POSITION.y === y;
      const tappable = isCellTappable(currentPos);
      const isInteractable = !isLoading && !isGameOver && tappable;

      let cellClasses = "w-full h-full border border-black/50 flex items-center justify-center transition-colors duration-150 rounded-sm realtive"; // Added relative for treasure positioning
      
      // Determine if the current cell is the treasure cell and game is over
      const isTreasureCell = isGameOver && revealedTreasure && revealedTreasure.x === x && revealedTreasure.y === y;

      if (isPlayer && !isTreasureCell) { // Don't show player if treasure is on the same spot and revealed
        cellClasses += " bg-transparent"; // Player icon is distinct
      } else if (isPath && !isTreasureCell) {
        cellClasses += " bg-[var(--theme-grid-path-bg)] opacity-70"; // Path cells
      } else if (!isTreasureCell) {
        cellClasses += " bg-[var(--theme-grid-cell-bg)]"; // Default empty cell (teal-100)
      }

      if (isInteractable && !isTreasureCell) {
        // Apply a distinct background and ring for interactable cells, with a hover effect for desktop
        cellClasses += " cursor-pointer bg-amber-200 ring-2 ring-[var(--theme-border-color)] hover:bg-amber-300"; 
      } else if (tappable && !isPlayer && !isTreasureCell) { 
         cellClasses += " opacity-50"; // Adjacent, not interactable (e.g. part of path already)
      }

      cells.push(
        <div
          key={`${x}-${y}`}
          className={cellClasses}
          onClick={() => isInteractable && !isTreasureCell && onCellTap(currentPos)} // Prevent click on revealed treasure cell
          style={isTreasureCell ? { backgroundColor: 'rgba(var(--treasure-reveal-bg-color, 255 237 111), 0.3)' } : {}} // Optional: Highlight treasure cell background
        >
          {isPlayer && !isTreasureCell && (
            <div className="w-6 h-6 bg-[var(--theme-grid-player-bg)] rounded-full border-[3px] border-black shadow-md flex items-center justify-center z-10">
              {/* Optional inner detail for player icon */}
              {/* <div className=\"w-2 h-2 bg-black/50 rounded-full\"></div> */}
            </div>
          )}
          {isTreasureCell && (
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
              {revealedTreasure?.rarity === 'COMMON' && <CommonChestIcon className="w-full h-full p-0.5" />}
              {revealedTreasure?.rarity === 'RARE' && <RareChestIcon className="w-full h-full p-0.5" />}
              {revealedTreasure?.rarity === 'EPIC' && <EpicChestIcon className="w-full h-full p-0.5" />}
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <div className="relative w-screen max-w-3xl aspect-square shadow-xl bg-[var(--theme-card-bg)] rounded-2xl border-4 border-[var(--theme-border-color)] p-2 md:p-3">
      <div 
        className={`grid grid-cols-10 grid-rows-10 gap-0.5 w-full h-full ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
        {cells}
      </div>
      {isLoading && (
        <div className="absolute inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center rounded-xl">
            <p className="text-[var(--theme-text-primary)] text-lg font-semibold animate-pulse">Processing Move...</p>
        </div>
      )}
    </div>
  );
};

export default Grid; 