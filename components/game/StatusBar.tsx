import React from 'react';
import TurnTimer from './TurnTimer';
import { HuntState, HuntLock } from '@prisma/client';
import type { HuntLock as PrismaHuntLock } from '@prisma/client'; 
import { shortenAddress } from '@/lib/utils';

const redGlowStyle = { textShadow: `0 0 4px #FF4444, 0 0 6px rgba(255, 68, 68, 0.6)` };
const greenGlowStyle = { textShadow: `0 0 4px #44FF44, 0 0 6px rgba(68, 255, 68, 0.6)` };

interface StatusBarProps {
  status: HuntState;
  currentLock: { huntId: string; playerFid: number; expiresAt: Date } | null;
  userFid: number | undefined;
  lastMoveUserId: number | undefined;
  txStatus: 'idle' | 'submitting' | 'confirming' | 'updating_db' | 'error' | 'success';
  txError: string | null;
  lastTxHash: `0x${string}` | undefined;
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
        if (currentLock.playerFid === userFid && new Date(currentLock.expiresAt) > new Date()) {
            return "Your Turn! Make a move.";
        } else {
            return `Locked by FID ${currentLock.playerFid}. Waiting for move...`;
        }
    } else {
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
  lastTxHash
}) => {
  const statusMessage = getStatusMessage(status, currentLock, userFid, lastMoveUserId);
  const txMessage = getTxStatusMessage(txStatus, txError);

  const isMyLockedTurn = currentLock && currentLock.playerFid === userFid && new Date(currentLock.expiresAt) > new Date();

  // Updated Button style based on STYLES.md (consistent with HuntsListPage)
  // Consider creating a reusable Button component later
  const claimButtonStyle = `
    px-5 py-2.5 rounded-lg border border-[var(--color-highlight)] 
    bg-purple-800/60 hover:bg-purple-700/80 
    text-white font-semibold text-sm 
    backdrop-blur-sm shadow-md 
    transition-all duration-200 ease-in-out 
    focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-800/60 disabled:shadow-none disabled:border-purple-800/50
  `;

  const textStyle = "text-sm text-[var(--color-text-body)] opacity-80 text-center";

  return (
    <div className="w-full max-w-md mt-4 p-3 bg-gray-800 rounded-lg shadow-md text-center">
        {/* Display Tx Status OR Hunt Status */} 
        {txMessage ? (
            <p className={`text-sm ${txStatus === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                {txMessage}
                {txStatus === 'confirming' && lastTxHash && (
                    <a 
                        href={`https://testnet.monadexplorer.com/tx/${lastTxHash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-400 hover:underline text-xs"
                    >
                        (View Tx)
                    </a>
                )}
             </p>
        ) : (
             <p className="text-sm text-gray-300">{statusMessage}</p>
        )}
      
      {/* Show Timer only if it's my locked turn and no tx is in progress */}
      {isMyLockedTurn && txStatus === 'idle' && currentLock && (
        <TurnTimer expiresAt={currentLock.expiresAt} />
      )}
    </div>
  );
};

export default StatusBar; 