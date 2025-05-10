import React from 'react';
import { Position } from '@/types'; 
import { GRID_SIZE } from '@/lib/constants'; 

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

      let cellClasses = "w-full h-full border border-black/50 flex items-center justify-center transition-colors duration-150 rounded-sm"; // Base for all cells, slightly rounded
      
      if (isPlayer) {
        cellClasses += " bg-transparent"; // Player icon is distinct
      } else if (isPath) {
        cellClasses += " bg-[var(--theme-grid-path-bg)] opacity-70"; // Path cells
      } else {
        cellClasses += " bg-[var(--theme-grid-cell-bg)]"; // Default empty cell (teal-100)
      }

      if (isInteractable) {
        // Always show ring for interactable cells, keep hover for background change
        cellClasses += " cursor-pointer ring-2 ring-yellow-500 ring-inset hover:bg-yellow-300"; 
      } else if (tappable && !isPlayer) { 
         cellClasses += " opacity-50"; // Adjacent, not interactable (e.g. part of path already)
      }

      cells.push(
        <div
          key={`${x}-${y}`}
          className={cellClasses}
          onClick={() => isInteractable && onCellTap(currentPos)}
        >
          {isPlayer && (
            <div className="w-6 h-6 bg-[var(--theme-grid-player-bg)] rounded-full border-[3px] border-black shadow-md flex items-center justify-center">
              {/* Optional inner detail for player icon */}
              {/* <div className=\"w-2 h-2 bg-black/50 rounded-full\"></div> */}
            </div>
          )}
          {/* Path Trajectory Lines - Draw line from this cell to next in path */} 
          {/* {isPath && moveHistory.length > 1 && (() => {
            const currentMoveIndex = moveHistory.findIndex(p => p.x === x && p.y === y);
            if (currentMoveIndex !== -1 && currentMoveIndex < moveHistory.length - 1) {
              const nextMove = moveHistory[currentMoveIndex + 1];
              const pathLineColor = "var(--theme-button-secondary-bg)"; // Teal
              const strokeWidth = "3"; // Should match player border width somewhat

              // Calculate line endpoints relative to the cell (0,0 to cellWidth, cellHeight)
              // Line starts at center of current cell, goes to center of next cell
              const lineX1 = "50%";
              const lineY1 = "50%";
              const lineX2 = `${(nextMove.x - x) * 100 + 50}%`;
              const lineY2 = `${(nextMove.y - y) * 100 + 50}%`;
              
              return (
                <svg 
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  style={{ overflow: 'visible' }} // Allow lines to draw outside cell bounds if needed
                >
                  <line 
                    x1={lineX1} y1={lineY1} 
                    x2={lineX2} y2={lineY2} 
                    stroke={pathLineColor} 
                    strokeWidth={strokeWidth} 
                    strokeLinecap="round"
                  />
                </svg>
              );
            }
            return null;
          })()} */}
        </div>
      );
    }
  }

  return (
    <div className="relative w-full max-w-3xl aspect-square shadow-xl bg-[var(--theme-card-bg)] rounded-2xl border-4 border-[var(--theme-border-color)] p-2 md:p-3">
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