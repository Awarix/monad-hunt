import React from 'react';
import { Position } from '@/types'; 
import { GRID_SIZE, START_POSITION } from '@/lib/constants'; 

interface CellProps {
  isPlayer: boolean;
  isPath: boolean;
  isStart: boolean;
  isTappable: boolean; 
  onTap: () => void; 
}

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
      // const isStart = START_POSITION.x === x && START_POSITION.y === y;
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