import React, { useState, useEffect, useCallback } from 'react';

interface TurnTimerProps {
  expiresAt: Date | null;
  onExpire?: () => void; 
}

const formatTime = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return '00:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const accentGlowStyle = {
  textShadow: `0 0 4px var(--color-accent), 0 0 6px rgba(62, 206, 206, 0.6)`,
};
const redGlowStyle = {
    textShadow: `0 0 4px #FF4444, 0 0 6px rgba(255, 68, 68, 0.6)`,
};

const TurnTimer: React.FC<TurnTimerProps> = ({ expiresAt, onExpire }) => {
  // Use useCallback for calculateRemainingSeconds to stabilize dependency array
  const calculateRemainingSeconds = useCallback((): number => {
    if (!expiresAt) return 0;
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    // Subtract 1 second (1000 ms) for a small display buffer, ensuring client calls onExpire near actual expiry
    const displayDiff = diff - (1 * 1000); 
    return Math.max(0, Math.floor(displayDiff / 1000)); // Ensure non-negative
  }, [expiresAt]);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(calculateRemainingSeconds);
  const [isExpired, setIsExpired] = useState<boolean>(remainingSeconds <= 0);

  useEffect(() => {
    // Reset state if expiresAt changes
    const initialSeconds = calculateRemainingSeconds();
    setRemainingSeconds(initialSeconds);
    setIsExpired(initialSeconds <= 0);

    if (!expiresAt || initialSeconds <= 0) {
      return; // Don't start interval if already expired or no expiry
    }

    const intervalId = setInterval(() => {
      const secondsLeft = calculateRemainingSeconds();
      setRemainingSeconds(secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(intervalId);
        setIsExpired(true);
        if (onExpire) {
          console.log("Timer expired, calling onExpire callback.");
          onExpire();
        }
      }
    }, 1000);

    return () => clearInterval(intervalId);

  }, [expiresAt, onExpire, calculateRemainingSeconds]); 

  console.log('[TurnTimer Debug] expiresAt:', expiresAt, 'remainingSeconds:', remainingSeconds, 'isExpired:', isExpired);

  if (!expiresAt) {
    return null; 
  }

  // Base container style: padding, rounded corners, subtle background/border for floating effect
  const containerClasses = `
    text-center p-3 rounded-lg 
    bg-[rgba(0,0,0,0.2)] 
    border border-[rgba(138,43,226,0.3)] /* Faint purple border */
    shadow-md shadow-[rgba(0,0,0,0.3)] /* Drop shadow */
  `;

  return (
    <div className={containerClasses}>
      {isExpired ? (
         <p 
            className="font-semibold text-red-400"
            style={redGlowStyle} 
        >
            Lock Expired!
        </p>
      ) : (
         <p 
            className="font-semibold text-[var(--color-accent)] text-lg" 
            style={accentGlowStyle} 
        >
            Time: {formatTime(remainingSeconds)}
        </p>
      )}
       <p className="text-xs text-[var(--color-text-body)] opacity-60 mt-1">
         Expires: {expiresAt.toLocaleTimeString()}
        </p>
    </div>
  );
};

export default TurnTimer; 