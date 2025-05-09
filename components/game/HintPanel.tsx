import React, { ReactNode } from 'react';
import HintDisplay from './HintDisplay'; // Assuming HintDisplay is in the same folder

// --- Reusable IconButton Component --- 
// (Consider moving to a shared UI location)
interface IconButtonProps {
    onClick?: () => void;
    children: ReactNode;
    ariaLabel: string;
    className?: string;
    disabled?: boolean;
}
// Consistent with STYLES.md
const IconButton: React.FC<IconButtonProps> = ({ onClick, children, ariaLabel, className = '', disabled = false }) => (
    <button
        onClick={onClick}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`p-2 rounded-lg bg-[var(--theme-button-secondary-bg)] text-[var(--theme-button-secondary-text)] border-2 border-[var(--theme-border-color)] hover:scale-105 transition-transform shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-button-secondary-bg)]/70 disabled:opacity-70 disabled:cursor-not-allowed ${className}`}
    >
        {children}
    </button>
);

interface HintPanelProps {
  hints: string[];
  isOpen: boolean;
  onClose: () => void;
}

// Glow style for header (consistent with STYLES.md)
// const headerGlowStyle = { ... }; // Removed old glow style

const HintPanel: React.FC<HintPanelProps> = ({ hints, isOpen, onClose }) => {
  return (
    // Fly-out panel container styled according to STYLES.md
    <aside 
        className={`
          absolute z-40 top-0 left-0 h-full 
          transition-transform duration-300 ease-in-out 
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
          bg-[var(--theme-card-bg)] w-72 max-w-[85%] p-4 
          border-r-4 border-[var(--theme-border-color)] 
          shadow-2xl flex flex-col
        `}
    >
      {/* Panel Header */}
      <div className='flex justify-between items-center mb-3 pb-3 flex-shrink-0 border-b-2 border-[var(--theme-border-color)]/50'>
        {/* Title styling */}
        <h2 
            className="text-xl font-bold text-[var(--theme-text-primary)] uppercase tracking-wide"
            // style={headerGlowStyle} // Removed glow
        >
            Hint History
        </h2>
        {/* Close button */}
        <IconButton onClick={onClose} ariaLabel="Close Hints">
            {/* Close SVG Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </IconButton>
      </div>
      {/* Scrollable hint list area */}
      <div className='overflow-y-auto flex-grow pr-2 -mr-2'> {/* Padding compensation for scrollbar */}
        {/* HintDisplay component renders individual hints (styled separately) */}
        <HintDisplay hints={hints} /> 
      </div>
    </aside>
  );
};

export default HintPanel; 