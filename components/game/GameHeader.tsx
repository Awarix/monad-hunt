import React, { ReactNode } from 'react';

// --- Reusable IconButton Component --- 
// (Keep this definition here or move to a shared UI components directory)
interface IconButtonProps {
  onClick?: () => void;
  children: ReactNode;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}

// Uses styles consistent with STYLES.md Buttons & Interactive Elements
const IconButton: React.FC<IconButtonProps> = ({ onClick, children, ariaLabel, className = '', disabled = false }) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel}
    disabled={disabled}
    className={`p-2 rounded-full bg-purple-800/60 hover:bg-purple-700/80 text-cyan-300 hover:text-cyan-100 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 backdrop-blur-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-800/60 ${className}`}
  >
    {children}
  </button>
);


interface GameHeaderProps {
  movesCount: number;
  maxMoves: number;
  onInfoClick: () => void;
}

const GameHeader: React.FC<GameHeaderProps> = ({ movesCount, maxMoves, onInfoClick }) => {
  // Glow style for header text (consistent with STYLES.md)
  const headerGlowStyle = {
    textShadow: `0 0 5px var(--color-text-header), 0 0 8px rgba(62, 206, 206, 0.5)`,
  };

  return (
    // Header container styling based on STYLES.md and reference
    <header className="w-full p-2 flex justify-between items-center bg-black/30 backdrop-blur-sm border-b border-purple-800/50 flex-shrink-0 space-x-2">
      <IconButton onClick={onInfoClick} ariaLabel="Show Hints">
        {/* Info Icon SVG */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </IconButton>
      {/* Title styled according to STYLES.md */}
      <h1 
        className="flex-1 text-base md:text-lg font-bold text-[var(--color-text-header)] tracking-widest uppercase text-center truncate px-1"
        style={headerGlowStyle}
      >
        TREASURE HUNT
      </h1>
      {/* Moves Counter styled according to STYLES.md */}
      <div 
        className="text-sm md:text-base font-semibold text-cyan-200 w-24 text-right shrink-0"
        style={{ textShadow: '0 0 3px rgba(62, 206, 206, 0.4)' }} // Subtle glow for secondary text
      >
        Moves: {movesCount}/{maxMoves}
      </div>
    </header>
  );
};

export default GameHeader; 