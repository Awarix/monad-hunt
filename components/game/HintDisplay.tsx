import React from 'react';

interface HintDisplayProps {
  hints: string[];
}

const HintDisplay: React.FC<HintDisplayProps> = ({ hints }) => {
  return (
    <div className="h-full">
      {hints.length === 0 ? (
        <p 
          className="text-sm text-purple-300 opacity-80 italic px-1 pt-2"
        >
          Make your first move to get a hint.
        </p>
      ) : (
        <ul className="space-y-2 text-sm list-none p-0 m-0">
          {hints.map((hint, index) => (
            <li key={index}>
              <div
                className={`
                  p-2 rounded 
                  bg-purple-900/60 
                  border-l-2 
                  ${index === 0 ? 'border-cyan-400 bg-purple-800/70' : 'border-purple-600'} 
                  text-cyan-200 text-xs
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