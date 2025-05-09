import React, { ReactNode } from 'react';
import Link from 'next/link';

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
    className={`p-2 rounded-lg bg-[var(--theme-button-secondary-bg)] text-[var(--theme-button-secondary-text)] border-2 border-[var(--theme-border-color)] hover:scale-105 transition-transform shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-button-secondary-bg)]/70 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 ${className}`}
  >
    {children}
  </button>
);


interface GameHeaderProps {
  movesCount: number;
  maxMoves: number;
  onInfoClick: () => void;
  // Add huntId for back link if needed, or rely on router
}

const GameHeader: React.FC<GameHeaderProps> = ({ movesCount, maxMoves, onInfoClick }) => {
  // Glow style for header text (consistent with STYLES.md)
  // const headerGlowStyle = { ... }; // Removed old glow style

  return (
    <header className="w-full p-3 flex justify-between items-center bg-[var(--theme-card-bg)] border-b-4 border-[var(--theme-border-color)] shadow-lg flex-shrink-0 space-x-2 md:space-x-3">
      {/* Back Button */} 
      <Link href="/hunts" className="flex-shrink-0">
        <IconButton ariaLabel="Back to Hunts List" className="">
            {/* Back Arrow SVG Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
        </IconButton>
      </Link>

      {/* Info/Hints Button */}
      <IconButton onClick={onInfoClick} ariaLabel="Show Hints" className="flex-shrink-0">
        {/* Info Icon SVG */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </IconButton>
      {/* Title styled according to STYLES.md */}
      <h1 
        className="flex-1 text-lg md:text-xl font-bold text-[var(--theme-text-primary)] tracking-wider uppercase text-center truncate px-1"
        // style={headerGlowStyle} // Removed glow style
      >
        TREASURE HUNT
      </h1>
      {/* Moves Counter styled according to STYLES.md */}
      <div 
        className="text-sm md:text-base font-semibold text-[var(--theme-text-secondary)] w-28 text-right shrink-0"
        // style={{ textShadow: '0 0 3px rgba(62, 206, 206, 0.4)' }} // Removed old text shadow
      >
        Moves: {movesCount}/{maxMoves}
      </div>
    </header>
  );
};

export default GameHeader; 