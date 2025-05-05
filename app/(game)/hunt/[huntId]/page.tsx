'use client'; 

import Link from 'next/link';
import React, { useState, useEffect, useCallback } from 'react'; 
import { useParams } from 'next/navigation'; 
import { useFarcaster } from "@/components/providers/FarcasterProvider"; 
// --- Wagmi Imports ---
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import TreasureHuntManagerABI from '@/lib/abi/TreasureHuntManagerABI.json'; // Use path alias to copied ABI
// -------------------

import Grid from '@/components/game/Grid';
import GameHeader from '@/components/game/GameHeader';
import GameFooter from '@/components/game/GameFooter'; 
import HintPanel from '@/components/game/HintPanel'; 
import StatusBar from '@/components/game/StatusBar'; 
import type { Direction, FarcasterUser, HuntChannelPayload, Position } from '@/types'; 
import { saveUserAction } from "@/app/actions/user"; 
import { 
    getHuntDetails, 
    claimHuntTurn, 
    submitMove, 
    HuntDetails, 
    SubmitResult 
} from '@/app/actions/hunt';
import { HuntState } from '@prisma/client'; 
import { START_POSITION, GRID_SIZE } from '@/lib/constants'; 

const accentGlowStyle = {
  textShadow: `0 0 4px var(--color-accent), 0 0 6px rgba(62, 206, 206, 0.6)`,
};
const redGlowStyle = {
    textShadow: `0 0 4px #FF4444, 0 0 6px rgba(255, 68, 68, 0.6)`,
};

// Get contract address from environment variable
const managerContractAddress = process.env.NEXT_PUBLIC_TREASURE_HUNT_MANAGER_ADDRESS as `0x${string}` | undefined;

export default function HuntPage() {
  const params = useParams<{ huntId: string }>(); 
  const huntId = params.huntId; 
  const { isLoaded: isFarcasterLoaded, frameContext, error: providerError } = useFarcaster(); 
  // --- Wagmi Account Hook ---
  const { address: connectedAddress, isConnected } = useAccount();
  // -------------------------

  // --- State Management: Use the Hunt object --- 
  const [huntDetails, setHuntDetails] = useState<HuntDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null); 
  const [currentUser, setCurrentUser] = useState<FarcasterUser | null>(null); 
  const [isClaimingTurn, setIsClaimingTurn] = useState(false);
  // Rename/reuse for transaction state
  const [txStatus, setTxStatus] = useState<'idle' | 'submitting' | 'confirming' | 'updating_db' | 'error' | 'success'>('idle'); 
  const [txError, setTxError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [sseError, setSseError] = useState<string | null>(null); 
  const [isHintPanelOpen, setIsHintPanelOpen] = useState(false); 

  // --- Wagmi Contract Hooks ---
  const { 
      data: makeMoveTxHash, // Hash returned immediately after submitting tx
      error: makeMoveError,
      isPending: isSubmittingToWallet, // True when user is prompted by wallet
      writeContractAsync // Function to call the contract write
  } = useWriteContract(); 

  const { 
      data: receipt, // Transaction receipt
      isLoading: isConfirming, // True while waiting for confirmation
      isSuccess: isConfirmed, 
      error: confirmationError 
  } = useWaitForTransactionReceipt({ 
      hash: makeMoveTxHash, // Watch the hash from writeContract
      confirmations: 1, // Wait for 1 confirmation
  });
  // ---------------------------

console.log(sseError, isSubmittingToWallet,isLoading);

  // --- Farcaster User Handling --- 
  useEffect(() => {
    if (isFarcasterLoaded && frameContext) {
        const userFromContext = frameContext.user;

        if (userFromContext && typeof userFromContext.fid === 'number') {
            const verifiedUser: FarcasterUser = {
                fid: userFromContext.fid,
                username: userFromContext.username,
                displayName: userFromContext.displayName,
                pfpUrl: userFromContext.pfpUrl,
            };
            console.log("Setting current user and calling save action:", verifiedUser);
            setCurrentUser(verifiedUser);

            // Call Server Action to save/update user
            saveUserAction(verifiedUser)
                .then(result => {
                    if (result.success) {
                        console.log(`User save action successful for FID: ${verifiedUser.fid}, DB ID: ${result.userId}`);
                    } else {
                        console.error(`User save action failed for FID: ${verifiedUser.fid}:`, result.error);
                        setPageError(result.error || "Failed to save user data via action.");
                    }
                })
                .catch(err => {
                    console.error("Error calling saveUserAction:", err);
                    setPageError("An error occurred while trying to save user data.");
                });
        } else {
            console.log("No valid user found in Farcaster context.");
            setCurrentUser(null); 
            setPageError("Could not identify Farcaster user.");
        }
    } else if (isFarcasterLoaded && providerError) {
        console.error("Farcaster provider error:", providerError);
        setPageError(`Farcaster Provider Error: ${providerError}`);
        setCurrentUser(null);
    }
  }, [isFarcasterLoaded, frameContext, providerError]);

  // --- Fetch Hunt Data --- 
  const loadHuntData = useCallback(async () => {
    if (!huntId) return;
    setIsLoading(true);
    setPageError(null);
    try {
      const details = await getHuntDetails(huntId);
      if (details) {
        setHuntDetails(details);
      } else {
        setPageError(`Hunt with ID ${huntId} not found.`);
        setHuntDetails(null);
      }
    } catch (err) {
      console.error("Error fetching hunt details:", err);
      setPageError(err instanceof Error ? err.message : "Failed to load hunt data.");
      setHuntDetails(null);
    } finally {
      setIsLoading(false);
    }
  }, [huntId]);

  useEffect(() => {
    loadHuntData();
  }, [loadHuntData]); // Depend only on the stable callback

  // --- SSE Connection --- 
  useEffect(() => {
    if (!huntId) return;

    console.log(`SSE: Attempting to connect for hunt ${huntId}`);
    setSseError(null);
    const eventSource = new EventSource(`/api/hunt-updates/${huntId}`);

    eventSource.onopen = () => {
        console.log(`SSE: Connection opened for hunt ${huntId}`);
        setSseError(null);
    };

    eventSource.onerror = (error) => {
        console.error('SSE: Error', error);
        setSseError("Real-time connection error. Updates may be delayed.");
    };

    eventSource.addEventListener('message', (event: MessageEvent) => {
        console.log('SSE: Message received', event.data);
        try {
            const parsedData = JSON.parse(event.data);

            if (parsedData && typeof parsedData === 'object' && parsedData.type) {
                const payload = parsedData as HuntChannelPayload; 

                if (payload.type === 'hunt_update') {
                    console.log("SSE: Applying full hunt update");
                    setHuntDetails(payload.details); 
                } else if (payload.type === 'lock_update') {
                    console.log("SSE: Applying lock update");
                    setHuntDetails(prev => prev ? { ...prev, lock: payload.lock } : null);
                } else {
                    console.warn("SSE: Received known payload object but unknown type");
                }
            } else {
                 console.warn("SSE: Received message does not match expected payload structure");
            }
            setSseError(null);
        } catch (err) {
            console.error("SSE: Failed to parse message data", err);
        }
    });
    
    eventSource.addEventListener('open', (event: MessageEvent) => {
        console.log('SSE: Server confirmation received:', event.data);
    });

    return () => {
        console.log(`SSE: Closing connection for hunt ${huntId}`);
        eventSource.close();
    };

  }, [huntId]);

  // --- Derived State --- 
  const lastMove = huntDetails?.moves?.[huntDetails.moves.length - 1];
  const currentPosition = lastMove 
                          ? { x: lastMove.positionX, y: lastMove.positionY }
                          : START_POSITION; // <-- Use START_POSITION as fallback
  const hints = huntDetails?.moves?.map(move => move.hintGenerated) || [];
  const lastMoveUserId = huntDetails?.lastMoveUserId;
  const currentLock = huntDetails?.lock;
  const isHuntActive = huntDetails?.state === HuntState.ACTIVE;
  const userFid = currentUser?.fid;

  const canUserClaimTurn = 
    isHuntActive && 
    userFid && 
    userFid !== lastMoveUserId && 
    (!currentLock || new Date() > new Date(currentLock.expiresAt)); // Lock doesn't exist or is expired

  const doesUserHoldActiveLock = 
    isHuntActive && 
    userFid && 
    currentLock && 
    currentLock.playerFid === userFid && 
    new Date() < new Date(currentLock.expiresAt);

  // --- Action Handlers --- 
  const handleClaimTurn = useCallback(async () => {
    if (!huntId || !userFid || !canUserClaimTurn) return;

    setIsClaimingTurn(true);
    setPageError(null);
    try {
      const result = await claimHuntTurn(huntId, userFid);
      if (!result.success) {
        setPageError(result.error || "Failed to claim turn.");
      }
    } catch (err) {
      console.error("Error claiming turn:", err);
      setPageError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsClaimingTurn(false);
    }
  }, [huntId, userFid, canUserClaimTurn]);

  // --- New Move Handling Logic --- 

  const initiateMoveTransaction = useCallback(async (targetX: number, targetY: number) => {
    if (!huntId || !managerContractAddress || !writeContractAsync) {
        console.error("Missing huntId, contract address, or write function");
        setTxStatus('error');
        setTxError("Configuration error, cannot submit transaction.");
        return;
    }
    if (!doesUserHoldActiveLock) {
        console.warn("Attempted move without active lock."); // Should be prevented by UI
        return;
    }

    setTxStatus('submitting');
    setTxError(null);
    setLastTxHash(undefined);

    try {
        console.log(`Initiating makeMove transaction for hunt ${huntId} to (${targetX}, ${targetY})`);
        const hash = await writeContractAsync({ 
            address: managerContractAddress,
            abi: TreasureHuntManagerABI.abi,
            functionName: 'makeMove', 
            args: [huntId, targetX, targetY],
        });
        console.log("Transaction submitted to wallet, hash:", hash);
        setLastTxHash(hash); // Store hash to trigger useWaitForTransactionReceipt
        setTxStatus('confirming'); // Move to confirming state
    } catch (err: any) {
        console.error("Error submitting transaction to wallet:", err);
        setTxStatus('error');
        setTxError(`Wallet Error: ${err.shortMessage || err.message}`);
        setLastTxHash(undefined);
    }
  }, [huntId, writeContractAsync, doesUserHoldActiveLock]);

  // Effect to call backend action after confirmation
  useEffect(() => {
    if (isConfirmed && receipt && lastTxHash === receipt.transactionHash && txStatus === 'confirming') {
        console.log(`Transaction ${receipt.transactionHash} confirmed.`);
        setTxStatus('updating_db');
        setTxError(null);

        if (!userFid || !connectedAddress) {
            console.error("Missing user FID or address after confirmation.");
            setTxStatus('error');
            setTxError("Internal error: User details missing.");
            return;
        }

        console.log(`Calling backend submitMove for hunt ${huntId}, tx: ${receipt.transactionHash}`);
        submitMove(huntId, userFid, connectedAddress, receipt.transactionHash)
            .then(result => {
                if (result.success) {
                    console.log("Backend submitMove successful.");
                    setTxStatus('success'); // Or idle?
                    // UI should update via SSE broadcast from backend
                } else {
                    console.error("Backend submitMove failed:", result.error);
                    setTxStatus('error');
                    setTxError(`Backend Error: ${result.error}`);
                }
            })
            .catch(err => {
                console.error("Error calling backend submitMove:", err);
                setTxStatus('error');
                setTxError(`Backend Call Error: ${err.message}`);
            });
    }
  }, [isConfirmed, receipt, lastTxHash, txStatus, huntId, userFid, connectedAddress]);
  
  // Handle direct transaction error from useWriteContract
  useEffect(() => {
    if (makeMoveError) {
      console.error("makeMove transaction error:", makeMoveError);
      setTxStatus('error');
      setTxError(`Transaction Error: ${makeMoveError.message}`);
      setLastTxHash(undefined);
    }
  }, [makeMoveError]);

  // Handle confirmation error from useWaitForTransactionReceipt
  useEffect(() => {
    if (confirmationError) {
        console.error("Transaction confirmation error:", confirmationError);
        setTxStatus('error');
        setTxError(`Confirmation Error: ${confirmationError.message}`);
        // Keep lastTxHash so user might see the failed tx on explorer?
    }
  }, [confirmationError]);

  // --- New functions for Grid tap interaction ---
  const isCellTappable = useCallback((cellPos: Position): boolean => {
    if (!doesUserHoldActiveLock) return false;

    const dx = Math.abs(cellPos.x - currentPosition.x);
    const dy = Math.abs(cellPos.y - currentPosition.y);

    // Check if it's exactly one step away horizontally or vertically, but not the same cell
    const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    
    const isInBounds = cellPos.x >= 0 && cellPos.x < GRID_SIZE && cellPos.y >= 0 && cellPos.y < GRID_SIZE;

    return isAdjacent && isInBounds;
  }, [doesUserHoldActiveLock, currentPosition]);

  const onCellTap = useCallback((tappedPos: Position) => {
    if (!isCellTappable(tappedPos)) return; 
    if (txStatus === 'submitting' || txStatus === 'confirming' || txStatus === 'updating_db') {
        console.log("Move already in progress, ignoring tap.");
        return;
    }

    console.log("Cell tapped:", tappedPos);
    initiateMoveTransaction(tappedPos.x, tappedPos.y);
    
    // Removed direction calculation and call to old handleMove

  }, [isCellTappable, initiateMoveTransaction, txStatus]); 

  // --- Hint Panel Toggle --- 
  const toggleHintPanel = useCallback(() => {
      setIsHintPanelOpen(prev => !prev);
  }, []);

  // --- Loading and Error States --- 
  if (!isFarcasterLoaded) {
      // Apply base text color
      return <div className="container mx-auto p-4 text-center text-[var(--color-text-body)]"><p>Loading Farcaster Context...</p></div>;
  }
  if (!currentUser && !pageError && !providerError) { 
      // Apply base text color
      return <div className="container mx-auto p-4 text-center text-[var(--color-text-body)]"><p>Verifying User...</p></div>;
  }
  if (pageError || providerError) {
     // Style error message
     return (
        <div className="container mx-auto p-4 text-center">
            <p className="text-red-400 font-semibold text-lg" style={redGlowStyle}>Error:</p>
            <p className="text-[var(--color-text-body)] opacity-90 mt-1">{pageError || providerError}</p>
            {/* Style link */}
            <Link 
                href="/hunts" 
                className="text-[var(--color-accent)] hover:text-[var(--color-highlight)] transition-colors duration-200 mt-4 block"
                style={accentGlowStyle}
            >
                &larr; Back to Hunts List
            </Link>
        </div>
    );
  }
   if (!huntDetails) {
      // Apply base text color
       return <div className="container mx-auto p-4 text-center text-[var(--color-text-body)]"><p>Loading Hunt Data...</p></div>;
  }
  // -------------------------------

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-black text-white font-sans overflow-hidden">
      
      {/* Render Header */} 
      {huntDetails && (
          <GameHeader 
            movesCount={huntDetails.moves.length}
            maxMoves={huntDetails.maxSteps}
            onInfoClick={toggleHintPanel}
          />
      )}

      {/* Render Status Bar */} 
      {huntDetails && (
          <StatusBar 
            huntState={huntDetails.state}
            currentLock={huntDetails.lock ?? null}
            canUserClaimTurn={!!( 
                isHuntActive && 
                userFid && 
                userFid !== lastMoveUserId && 
                (!huntDetails.lock || new Date() > new Date(huntDetails.lock.expiresAt))
            )}
            userFid={userFid}
            lastMoveUserId={lastMoveUserId}
            isClaimingTurn={isClaimingTurn}
            onClaimTurn={handleClaimTurn}
            txStatus={txStatus}
            txError={txError}
            lastTxHash={lastTxHash}
          />
      )}

      {/* Main Content Area (Grid) */} 
      <main className="flex-grow flex items-center justify-center p-3 overflow-hidden relative">
        {huntDetails && (
            <div className="w-full max-w-md relative"> 
                <Grid 
                    playerPosition={currentPosition} 
                    moveHistory={huntDetails.moves.map(m => ({ x: m.positionX, y: m.positionY }))} 
                    isCellTappable={isCellTappable}
                    onCellTap={onCellTap}
                    isLoading={txStatus === 'submitting' || txStatus === 'confirming' || txStatus === 'updating_db'}
                />
                {/* TODO: Add game end overlay here if needed, styled like reference */} 
            </div>
        )}
         {!huntDetails && isLoading && <p>Loading Grid...</p>} {/* Placeholder while loading */}
      </main>
      
      {/* Render Footer */} 
      <GameFooter />

      {/* Render Hint Panel (Overlay) */} 
      {huntDetails && (
          <HintPanel 
            hints={hints}
            isOpen={isHintPanelOpen}
            onClose={toggleHintPanel}
          />
      )}

    </div>
  );
} 