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
        className={`p-1.5 rounded-full bg-purple-800/60 hover:bg-purple-700/80 text-cyan-300 hover:text-cyan-100 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 backdrop-blur-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
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
const headerGlowStyle = {
    textShadow: `0 0 5px var(--color-text-header), 0 0 8px rgba(62, 206, 206, 0.5)`,
};

const HintPanel: React.FC<HintPanelProps> = ({ hints, isOpen, onClose }) => {
  return (
    // Fly-out panel container styled according to STYLES.md
    <aside 
        className={`
          absolute z-40 top-0 left-0 h-full 
          transition-transform duration-300 ease-in-out 
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
          bg-gradient-to-b from-purple-900/95 to-indigo-950/95 
          backdrop-blur-lg w-64 max-w-[80%] p-4 
          border-r border-purple-800/50 
          shadow-xl shadow-black/30 flex flex-col
        `}
    >
      {/* Panel Header */}
      <div className='flex justify-between items-center mb-4 flex-shrink-0 border-b border-purple-800/50 pb-2'>
        {/* Title styling */}
        <h2 
            className="text-lg font-semibold text-[var(--color-text-header)]"
            style={headerGlowStyle}
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