import React from 'react';
import TurnTimer from './TurnTimer';
import { HuntState } from '@prisma/client';

interface StatusBarProps {
  status: HuntState;
  currentLock: { huntId: string; playerFid: number; expiresAt: Date } | null;
  userFid: number | undefined;
  lastMoveUserId: number | undefined;
  txStatus: 'idle' | 'submitting' | 'confirming' | 'updating_db' | 'error' | 'success';
  txError: string | null;
  lastTxHash: `0x${string}` | undefined;
  blockExplorerUrl: string;
}

const getStatusMessage = (
    status: HuntState, 
    currentLock: StatusBarProps['currentLock'], 
    userFid: number | undefined,
    lastMoveUserId: number | undefined
) => {
    if (status === HuntState.WON) return "Hunt Complete: Treasure Found! 🎉";
    if (status === HuntState.LOST) return "Hunt Complete: Max moves reached.";

    if (currentLock) {
        const isLockCurrentlyActive = new Date(currentLock.expiresAt) > new Date();
        if (currentLock.playerFid === userFid) { // It's my lock
            if (isLockCurrentlyActive) {
                return "Your Turn! Make a move."; // My active lock
            } else {
                return "Your lock expired! Ready to join."; // My expired lock
            }
        } else { // It's someone else's lock
            if (isLockCurrentlyActive) {
                return `Locked by FID ${currentLock.playerFid}. Waiting for move...`; // Other's active lock
            } else {
                // Other's lock is also expired
                return `Lock by FID ${currentLock.playerFid} expired. Ready to join.`;
            }
        }
    } else { // No lock object
        if (userFid === lastMoveUserId) {
            return "You made the last move. Waiting for others...";
        } else {
            return "Hunt active. Claim the turn!";
        }
    }
};

const getTxStatusMessage = (txStatus: StatusBarProps['txStatus'], txError: string | null) => {
    switch (txStatus) {
        case 'submitting': return "Submitting transaction via wallet...";
        case 'confirming': return "Confirming transaction onchain...";
        case 'updating_db': return "Processing confirmed transaction...";
        case 'error': return `Error: ${txError || 'Unknown transaction error'}`;
        case 'success': return "Move successful!";
        case 'idle':
        default: return null; // No message when idle
    }
};

const StatusBar: React.FC<StatusBarProps> = ({
  status,
  currentLock,
  userFid,
  lastMoveUserId,
  txStatus,
  txError,
  lastTxHash,
  blockExplorerUrl
}) => {
  const statusMessage = getStatusMessage(status, currentLock, userFid, lastMoveUserId);
  const txMessage = getTxStatusMessage(txStatus, txError);

  const isMyLockedTurn = currentLock && currentLock.playerFid === userFid && new Date(currentLock.expiresAt).getTime() > new Date().getTime();

  console.log('[StatusBar Debug] isMyLockedTurn:', isMyLockedTurn, 'txStatus:', txStatus, 'currentLock:', currentLock, 'userFid:', userFid, 'currentLock?.expiresAt type:', typeof currentLock?.expiresAt, 'isDate:', currentLock?.expiresAt instanceof Date);

//   const claimButtonStyle = `
//     px-5 py-2.5 rounded-lg border border-[var(--color-highlight)] 
//     bg-purple-800/60 hover:bg-purple-700/80 
//     text-white font-semibold text-sm 
//     backdrop-blur-sm shadow-md 
//     transition-all duration-200 ease-in-out 
//     focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 
//     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-800/60 disabled:shadow-none disabled:border-purple-800/50
//   `;

//   const textStyle = "text-sm text-[var(--color-text-body)] opacity-80 text-center";

  return (
    <div className="w-full max-w-lg mx-auto mt-4 p-4 bg-[var(--theme-secondary-card-bg)] rounded-xl border-4 border-[var(--theme-border-color)] shadow-lg text-center">
        {/* Display Tx Status OR Hunt Status */} 
        {txMessage ? (
            <p className={`text-base font-semibold ${txStatus === 'error' ? 'text-red-600' : 'text-orange-600'}`}>
                {txMessage}
                {(txStatus === 'confirming' || txStatus === 'submitting') && lastTxHash && (
                    <a 
                        href={`${blockExplorerUrl}/tx/${lastTxHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-teal-600 hover:text-teal-700 font-semibold text-xs"
                    >
                        (View Tx)
                    </a>
                )}
             </p>
        ) : (
             <p className="text-base text-[var(--theme-text-secondary)] font-semibold">{statusMessage}</p>
        )}
      
      {/* Show Timer only if it's my locked turn and no tx is in progress */}
      {isMyLockedTurn && txStatus === 'idle' && currentLock && currentLock.expiresAt && (
        <TurnTimer expiresAt={currentLock.expiresAt} />
      )}
    </div>
  );
};

export default StatusBar; 