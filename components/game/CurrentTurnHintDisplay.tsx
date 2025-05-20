import React from 'react';

interface CurrentTurnHintDisplayProps {
  latestHint: string;
  onShowAllHints: () => void;
}

const CurrentTurnHintDisplay: React.FC<CurrentTurnHintDisplayProps> = ({ latestHint, onShowAllHints }) => {
  return (
    <div className="mt-4 p-4 bg-[var(--theme-card-alt-bg)] border-2 border-[var(--theme-border-color)] rounded-lg shadow-md w-full max-w-md text-center">
      <p className="text-sm text-[var(--theme-text-secondary)] mb-3 whitespace-pre-wrap">
        <strong>Latest Hint:</strong> {latestHint}
      </p>
      <button 
        onClick={onShowAllHints}
        className="px-4 py-2 bg-[var(--theme-button-secondary-bg)] text-[var(--theme-button-secondary-text)] rounded-lg shadow-sm hover:bg-opacity-80 transition-colors border-2 border-[var(--theme-border-color)] font-semibold text-sm"
      >
        Show All Hints
      </button>
    </div>
  );
};

export default CurrentTurnHintDisplay; 