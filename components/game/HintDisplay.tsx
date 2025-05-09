import React from 'react';

interface HintDisplayProps {
  hints: string[];
}

const HintDisplay: React.FC<HintDisplayProps> = ({ hints }) => {
  return (
    <div className="h-full">
      {hints.length === 0 ? (
        <p 
          className="text-sm text-[var(--theme-text-secondary)] italic px-1 pt-2"
        >
          Make your first move to get a hint.
        </p>
      ) : (
        <ul className="space-y-2.5 text-sm list-none p-0 m-0">
          {hints.map((hint, index) => (
            <li key={index}>
              <div
                className={`
                  p-2.5 rounded-md 
                  bg-gray-100 
                  border-l-4 
                  ${index === hints.length - 1 ? 'border-[var(--theme-button-primary-bg)] shadow-md' : 'border-gray-300'} 
                  text-[var(--theme-text-secondary)] text-sm
                `}
              >
                {hint}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default HintDisplay; 