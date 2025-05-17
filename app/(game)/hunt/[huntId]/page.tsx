'use client'; 

import Link from 'next/link';
import React, { useState, useEffect, useCallback, useMemo } from 'react'; 
import { useParams } from 'next/navigation'; 
import { useFarcaster } from "@/components/providers/FarcasterProvider"; 
// --- Wagmi Imports ---
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useSwitchChain } from 'wagmi';
import TreasureHuntManagerABI from '@/lib/abi/TreasureHuntManagerABI.json'; // Use path alias to copied ABI
import HuntMapNFTABI from '@/lib/abi/HuntMapNFTABI.json'; // ABI for the NFT contract
import { ethers } from 'ethers';
import { monadTestnet } from '@/lib/chains'; // Import monadTestnet chain definition
// -------------------

import Grid from '@/components/game/Grid';
import GameHeader from '@/components/game/GameHeader';
import HintPanel from '@/components/game/HintPanel'; 
import StatusBar from '@/components/game/StatusBar'; 
import type { FarcasterUser, HuntChannelPayload, Position } from '@/types'; 
import { saveUserAction } from "@/app/actions/user"; 
import { 
    getHuntDetails, 
    submitMove, 
    HuntDetails, 
    SubmitResult,
    claimNft,
    revealHuntTreasure,
    claimHuntTurn
} from '@/app/actions/hunt';
import { HuntState } from '@prisma/client'; 
import { START_POSITION, GRID_SIZE } from '@/lib/constants'; 
import Image from 'next/image';

// Get contract address from environment variable
const managerContractAddress = process.env.NEXT_PUBLIC_TREASURE_HUNT_MANAGER_ADDRESS as `0x${string}` | undefined;
const nftContractAddress = process.env.NEXT_PUBLIC_HUNT_MAP_NFT_ADDRESS as `0x${string}` | undefined;
// Get block explorer URL from environment variable
const blockExplorerUrl = process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || "https://testnet.monadexplorer.com/"; // Updated fallback

export default function HuntPage() {
  const params = useParams<{ huntId: string }>(); 
  const huntId = params.huntId; 
  const { isLoaded: isFarcasterLoaded, frameContext, error: providerError } = useFarcaster(); 
  // --- Wagmi Account Hook ---
  const { address: connectedAddress, isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitchingChain, error: switchChainError } = useSwitchChain();
  // -------------------------

  // --- State Management: Use the Hunt object --- 
  const [huntDetails, setHuntDetails] = useState<HuntDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null); 
  const [currentUser, setCurrentUser] = useState<FarcasterUser | null>(null); 
  const [txStatus, setTxStatus] = useState<'idle' | 'submitting' | 'confirming' | 'updating_db' | 'error' | 'success'>('idle'); 
  const [txError, setTxError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isHintPanelOpen, setIsHintPanelOpen] = useState(false);
  // --- Claim Turn State ---
  const [isClaimingTurn, setIsClaimingTurn] = useState(false);
  const [claimTurnError, setClaimTurnError] = useState<string | null>(null);

  // --- Wagmi Status Logging ---
  useEffect(() => {
    console.log('[Wagmi Account Status] isConnected:', isConnected, 'Address:', connectedAddress);
  }, [isConnected, connectedAddress]);

  // --- Logging for isConnected and currentUser ---
  useEffect(() => {
    console.log('[Debug ClaimTurn] isConnected changed:', isConnected);
  }, [isConnected]);

  useEffect(() => {
    console.log('[Debug ClaimTurn] currentUser changed:', currentUser ? currentUser.fid : 'null');
  }, [currentUser]);
  // ---------------------------------------------

  // --- Move Transaction Wagmi Hooks ---
  const {
      data: makeMoveTxHash,
      error: makeMoveError,
      writeContractAsync
  } = useWriteContract();

  const {
      data: receipt,
      isLoading: isConfirming,
      isSuccess: isConfirmed,
      error: confirmationError
  } = useWaitForTransactionReceipt({
      hash: makeMoveTxHash,
      confirmations: 1,
  });
  const [pendingMovePosition, setPendingMovePosition] = useState<Position | null>(null);
  // ---------------------------

  // --- Derived hunt state (needed for hooks below) ---
  const isHuntActive = huntDetails?.state === HuntState.ACTIVE;
  const isHuntEnded = huntDetails?.state === HuntState.WON || huntDetails?.state === HuntState.LOST;
  // ---------------------------------------------------

  // --- Derived onchainHuntId for frontend contract calls ---
  const numericOnchainHuntIdForFrontend = useMemo(() => {
    if (huntDetails?.onchainHuntId) {
      try {
        return BigInt(huntDetails.onchainHuntId);
      } catch (e) {
        console.error("Failed to convert huntDetails.onchainHuntId to BigInt:", huntDetails.onchainHuntId, e);
        return null;
      }
    }
    return null;
  }, [huntDetails?.onchainHuntId]);
  // -----------------------------------------------------

  // --- NFT Minting State & Hooks ---
  const [claimNftStatus, setClaimNftStatus] = useState<
      'idle' | 'checking_eligibility' | 'eligible' | 'not_eligible' | 'already_minted' | 
      'fetching_uri' | 'ready_to_mint' | 'submitting_mint' | 'confirming_mint' | 'minted' | 'error' | 'fetching_metadata_image'
  >('idle');
  const [claimNftError, setClaimNftError] = useState<string | null>(null);
  const [tokenUri, setTokenUri] = useState<string | null>(null);
  const [nftImageUrl, setNftImageUrl] = useState<string | null>(null);

  // Read hook to check if user has already minted
  const { data: hasMintedData, isLoading: isLoadingHasMinted, error: hasMintedError, refetch: refetchHasMinted } = useReadContract({
      address: nftContractAddress,
      abi: HuntMapNFTABI.abi,
      functionName: 'hasMinted',
      // Args now depend on numericOnchainHuntIdForFrontend and connectedAddress
      args: numericOnchainHuntIdForFrontend && connectedAddress ? [numericOnchainHuntIdForFrontend, connectedAddress] : undefined,
      query: {
          // Enable only if all required params for args are available and hunt is ended
          enabled: !!nftContractAddress && !!numericOnchainHuntIdForFrontend && !!connectedAddress && isHuntEnded,
      },
  });

  // Write hook for the mint function
  const { 
      data: mintSubmitTxHash, // Hash after submitting to wallet
      error: mintSubmitError, 
      writeContractAsync: mintNftAsync 
  } = useWriteContract();

  // Hook to wait for mint transaction confirmation
  const { 
      data: mintReceipt, 
      isLoading: isConfirmingMint, 
      isSuccess: isMintConfirmed, 
      error: mintConfirmationError 
  } = useWaitForTransactionReceipt({ 
      hash: mintSubmitTxHash,
      confirmations: 1,
  });
  // -------------------------------

  // --- Reveal Treasure State ---
  const [revealStatus, setRevealStatus] = useState<'idle' | 'submitting' | 'confirming' | 'revealed' | 'error'>('idle');
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealTxHash, setRevealTxHash] = useState<`0x${string}` | undefined>(undefined);
  // ---------------------------


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
        setHuntDetails(details as HuntDetails);
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
    const eventSource = new EventSource(`/api/hunt-updates/${huntId}`);

    eventSource.onopen = () => {
        console.log(`SSE: Connection opened for hunt ${huntId}`);
    };

    eventSource.onerror = (error) => {
        console.error('SSE: Error', error);
    };

    eventSource.addEventListener('message', (event: MessageEvent) => {
        console.log('SSE: Message received', event.data);
        try {
            const parsedData = JSON.parse(event.data);

            if (parsedData && typeof parsedData === 'object' && parsedData.type) {
                const payload = parsedData as HuntChannelPayload; 

                if (payload.type === 'hunt_update') {
                    const updatedDetailsPartial = payload.details as Partial<HuntDetails> | null;
                    console.log('SSE: Applying hunt update', updatedDetailsPartial);

                    if (updatedDetailsPartial && updatedDetailsPartial.id === huntId) {
                        setHuntDetails(prevDetails => {
                            if (!prevDetails) {
                                // This case should ideally not happen if we have details to update for the current huntId
                                // but if it does, we can only set if the partial is a full object (less likely now)
                                // For safety, and given sanitization, it's better to ensure full objects or handle null.
                                // Since updatedDetailsPartial can be null OR partial, we must be careful.
                                // If prevDetails is null, and updatedDetailsPartial is also null, result is null.
                                // If prevDetails is null, and updatedDetailsPartial is partial, this is tricky.
                                // Let's assume for now that an update for *our* huntId means we should have *some* prevDetails.
                                console.warn("SSE hunt_update: prevDetails is null, but received update for current huntId. This is unexpected.");
                                // Attempt to set if it looks like a full object, otherwise null to be safe.
                                // This might need more robust handling if full objects are expected after null state.
                                return updatedDetailsPartial as HuntDetails; // Risky cast, relies on update being full
                            }
                            // If updatedDetailsPartial is null, it means the hunt details were cleared (e.g. deleted - less likely for 'hunt_update')
                            // or the sanitizer returned null for some reason. In this case, we'd set to null.
                            if (updatedDetailsPartial === null) return null;

                            // Merge partial update with previous full details
                            return { ...prevDetails, ...updatedDetailsPartial };
                        });
                    } else if (updatedDetailsPartial) {
                         console.log(`SSE: Received hunt_update for a different huntId (${updatedDetailsPartial.id}). Current is ${huntId}. Ignoring.`);
                    } else {
                        // updatedDetailsPartial is null, and it's not for our huntId (or id is missing)
                        // This could happen if a generic null update was broadcast and we are not filtering by ID before this point.
                        // If it was meant for our hunt (e.g. lock removed, resulting in details becoming null due to sanitization rule),
                        // we might want to set our local huntDetails to null if the ID matched.
                        // For now, if ID doesn't match or is missing, and details are null, do nothing.
                        console.log('SSE: Received null hunt_update details, possibly for another hunt or no ID. Ignoring.');
                    }
                } else if (payload.type === 'lock_update') {
                    console.log("SSE: Applying lock update");
                    const newLock = payload.lock;
                    if (newLock && typeof newLock.expiresAt === 'string') {
                        // Ensure expiresAt is a Date object
                        (newLock).expiresAt = new Date(newLock.expiresAt);
                    }
                    setHuntDetails(prev => {
                      if (!prev) return { lock: newLock } as HuntDetails;
                        return { ...prev, lock: newLock };
                    });
                } else {
                    console.warn("SSE: Received known payload object but unknown type");
                }
            } else {
                 console.warn("SSE: Received message does not match expected payload structure");
            }
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

  }, [huntId]); // Removed loadHuntData from here unless strictly necessary for SSE re-init

  // --- Derived State --- 
  const lastMove = huntDetails?.moves?.[huntDetails.moves.length - 1];
  const currentPosition = useMemo(() => {
    return lastMove 
            ? { x: lastMove.positionX, y: lastMove.positionY }
            : START_POSITION;
  }, [lastMove]); 
  const hints = huntDetails?.moves?.map(move => move.hintGenerated) || [];
  const lastMoveUserId = huntDetails?.lastMoveUserId;
  // const currentLock = huntDetails?.lock;
  const userFid = currentUser?.fid;

  // const canUserClaimTurn = 
  //   isHuntActive && 
  //   userFid && 
  //   userFid !== lastMoveUserId && 
  //   (!currentLock || new Date() > new Date(currentLock.expiresAt)); // Lock doesn't exist or is expired

  const userFidForLockCheck = currentUser?.fid; // Use a local var for clarity in logs
  const currentLockForCheck = huntDetails?.lock;
  const isHuntActiveForLockCheck = huntDetails?.state === HuntState.ACTIVE;

  console.log('[doesUserHoldActiveLock Calculation Inputs]', {
    isHuntActiveForLockCheck,
    userFidForLockCheck,
    currentLockExists: !!currentLockForCheck,
    currentLockPlayerFid: currentLockForCheck?.playerFid,
    currentLockExpiresAt: currentLockForCheck?.expiresAt,
    isLockTimeValid: currentLockForCheck?.expiresAt ? new Date() < new Date(currentLockForCheck.expiresAt) : undefined,
  });

  const doesUserHoldActiveLock = 
    isHuntActiveForLockCheck && 
    userFidForLockCheck && 
    currentLockForCheck && 
    currentLockForCheck.playerFid === userFidForLockCheck && 
    (currentLockForCheck.expiresAt && new Date() < new Date(currentLockForCheck.expiresAt));

  console.log('[doesUserHoldActiveLock Calculation Result]', doesUserHoldActiveLock);

  // Log when doesUserHoldActiveLock changes, to see what StatusBar would receive
  useEffect(() => {
    console.log('[StatusBar Prop Effect] doesUserHoldActiveLock value changed to:', doesUserHoldActiveLock);
  }, [doesUserHoldActiveLock]);

  const canAttemptMove = useMemo(() => {
    const result = (() => {
        if (!huntDetails || !currentUser || huntDetails.state !== HuntState.ACTIVE) return false;
        const currentLock = huntDetails.lock;
        // --- DEBUG LOGGING ---
        console.log('[canAttemptMove Check]', {
            huntId: huntDetails?.id,
            userId: currentUser?.fid,
            huntState: huntDetails?.state,
            lockExists: !!currentLock,
            lockPlayerFid: currentLock?.playerFid,
            lockExpiresAt: currentLock?.expiresAt,
            isCurrentUserLockHolder: currentLock?.playerFid === currentUser?.fid,
            isLockActive: currentLock ? new Date(currentLock.expiresAt) > new Date() : false,
            now: new Date()
        });
        // --- END DEBUG LOGGING ---
        if (currentLock && currentLock.playerFid === currentUser.fid && new Date(currentLock.expiresAt) > new Date()) {
            return true;
        }
        return false;
    })();
    console.log('[Debug ClaimTurn] canAttemptMove recalculated:', result, { huntId: huntDetails?.id, userId: currentUser?.fid, lockPlayerFid: huntDetails?.lock?.playerFid });
    return result;
  }, [huntDetails, currentUser]);

  const canClaimTurn = useMemo(() => {
    const result = (() => {
      if (!huntDetails || !currentUser || huntDetails.state !== HuntState.ACTIVE) {
        console.log('[canClaimTurn Internal] Bailing: Invalid huntDetails, currentUser, or hunt state', { huntDetailsExists: !!huntDetails, currentUserExists: !!currentUser, state: huntDetails?.state });
        return false;
      }

      const currentLock = huntDetails.lock;
      const lastMoveFid = huntDetails.lastMoveUserId;
      const localCurrentUserFid = currentUser.fid;

      console.log('[canClaimTurn Internal] Values:', {
        huntId: huntDetails.id,
        localCurrentUserFid,
        lastMoveFid,
        lockExists: !!currentLock,
        lockPlayerFid: currentLock?.playerFid,
        lockExpiresAt: currentLock?.expiresAt?.toISOString(),
      });

      // Scenario 1: No lock exists
      if (!currentLock) {
        const can = lastMoveFid !== localCurrentUserFid;
        console.log('[canClaimTurn Internal] No lock. Can claim if not last mover.', { lastMoveFid, localCurrentUserFid, can });
        return can;
      }

      // Scenario 2: Lock exists
      const lockExpiresDate = new Date(currentLock.expiresAt);
      const nowDate = new Date();
      const isLockExpired = nowDate >= lockExpiresDate;
      
      console.log('[canClaimTurn Internal] Lock exists.', {
        lockPlayerFid: currentLock.playerFid,
        localCurrentUserFid,
        isMyLock: currentLock.playerFid === localCurrentUserFid,
        lockExpiresAtISO: lockExpiresDate.toISOString(),
        nowDateISO: nowDate.toISOString(),
        isLockExpired
      });

      if (isLockExpired) {
        console.log('[canClaimTurn Internal] Lock expired. Allowing claim attempt.');
        return true; 
      } else {
        console.log('[canClaimTurn Internal] Active lock exists. Disallowing claim.');
        return false;
      }
    })();
    console.log('[Debug ClaimTurn] canClaimTurn recalculated:', result, { huntId: huntDetails?.id, userId: currentUser?.fid, lastMoveUserId: huntDetails?.lastMoveUserId, lockPlayerFid: huntDetails?.lock?.playerFid });
    return result;
  }, [huntDetails, currentUser]);

  // --- Action Handlers --- 
  const handleClaimTurn = async () => {
    // Reset previous transaction status if it was success
    if (txStatus === 'success') {
      setTxStatus('idle');
      setTxError(null);
    }

    if (!huntId || !currentUser?.fid) {
      setClaimTurnError("Cannot claim turn: missing hunt ID or user information.");
      return;
    }
    setIsClaimingTurn(true);
    setClaimTurnError(null);
    try {
      const result = await claimHuntTurn(huntId, currentUser.fid);
      if (result.error) {
        setClaimTurnError(result.error);
        // SSE should update the lock status, so no direct state update here for huntDetails.lock
      } else {
        // Lock successfully claimed. SSE will deliver the lock update to all clients, 
        // including this one, which will then update huntDetails.lock and trigger timer in StatusBar.
        console.log("Claim turn action successful, expecting SSE update. Lock details from action:", result.lock);
      }
    } catch (error) {
      console.error("Error claiming turn:", error);
      setClaimTurnError( "An unexpected error occurred while claiming turn.");
      console.log('[Debug ClaimTurn] claimTurnError:', claimTurnError);
    } finally {
      setIsClaimingTurn(false);
    }
  };

  // --- New Move Handling Logic --- 

  const initiateMoveTransaction = useCallback(async (targetX: number, targetY: number) => {
    if (!huntId || !writeContractAsync || !doesUserHoldActiveLock || !isConnected) {
        console.error("Pre-flight check failed: Missing huntId, writeContractAsync, lock, or connection.", { huntId, writeFn: !!writeContractAsync, lock: doesUserHoldActiveLock, connected: isConnected });
        setTxError("Cannot initiate move. Ensure you hold the lock and your wallet is connected.");
        setTxStatus('error');
        return;
    }
    if (!managerContractAddress) {
        console.error("Pre-flight check failed: managerContractAddress is missing. Check env var NEXT_PUBLIC_TREASURE_HUNT_MANAGER_ADDRESS.");
        setTxError("Configuration error: Contract address is missing.");
        setTxStatus('error');
        return;
    }
    if (!TreasureHuntManagerABI?.abi) {
        console.error("Pre-flight check failed: TreasureHuntManagerABI.abi is missing or invalid. Check ABI import.");
        setTxError("Configuration error: Contract ABI is missing.");
        setTxStatus('error');
        return;
    }

    if (txStatus === 'submitting' || txStatus === 'confirming' || txStatus === 'updating_db') {
        console.warn("Move already in progress.");
        return;
    }

    console.log(`Initiating move transaction for hunt ${huntId} to (${targetX}, ${targetY})`);
    setTxStatus('submitting');
    setTxError(null);
    setPendingMovePosition({ x: targetX, y: targetY }); // Store the intended position
    setLastTxHash(undefined); // Clear previous hash

    try {
      // Convert string huntId to a BigInt representation (e.g., by hashing)
      const numericHuntId = BigInt(ethers.id(huntId));

      // <<< Add final check log for address and ABI object >>>
      console.log("[Move Initiation] Attempting writeContractAsync with:");
      console.log("  Address:", managerContractAddress);
      console.log("  ABI Exists:", !!TreasureHuntManagerABI?.abi);
      console.log("  Function Name:", 'makeMove');
      console.log("  Args:", [numericHuntId, targetX, targetY]);
      // <<< End check log >>>

      const hash = await writeContractAsync({
        address: managerContractAddress,
        abi: TreasureHuntManagerABI.abi,
        functionName: 'makeMove',
        args: [numericHuntId, targetX, targetY], // Use numericHuntId
      });
      console.log("[Move Initiation] writeContractAsync awaited. Raw hash:", hash);

      if (hash) {
        console.log("[Move Initiation] Hash is truthy. Calling setLastTxHash...");
        setLastTxHash(hash);
        console.log("[Move Initiation] setLastTxHash seemingly called with:", hash);
        // Status remains 'submitting', will change to 'confirming' via the useWaitForTransactionReceipt hook effect
      } else {
        console.error("[Move Initiation] writeContractAsync resolved but hash is undefined/null.");
        setTxError("Failed to get transaction hash from wallet after signing.");
        setTxStatus('error');
        setPendingMovePosition(null); // Clear pending move
      }
    } catch (err: unknown) {
      console.error("[Move Initiation] Error caught during writeContractAsync:", err);
      // <<< Simplify error handling >>>
      setTxError(err instanceof Error ? err.message : "An unknown error occurred during transaction submission.");
      setTxStatus('error');
      setPendingMovePosition(null); // Clear pending move on error
    }
    // No finally block needed here, status updates handled by hooks/catch
  }, [
      huntId,
      writeContractAsync,
      doesUserHoldActiveLock,
      isConnected,
      txStatus // Include txStatus to prevent race conditions
  ]);

  // Effect to handle transaction confirmation and backend update
  useEffect(() => {
      console.log('[Confirmation Effect] Running. lastTxHash:', lastTxHash, 'isConfirming:', isConfirming, 'isConfirmed:', isConfirmed, 'pendingMovePos:', pendingMovePosition, 'txStatus:', txStatus);
      if (!pendingMovePosition || !lastTxHash) {
          console.log('[Confirmation Effect] Bailing: no pending move or no lastTxHash.');
          return; // Only run if a move was initiated and hash was obtained
      }

      // If confirming, just update status (only if needed)
      if (isConfirming && txStatus !== 'confirming') {
          console.log(`Transaction ${lastTxHash} is confirming...`);
          setTxStatus('confirming');
          // No return, let logic continue in case confirmation happens fast
      }

      // If confirmed, process *ONCE* by checking txStatus
      if (isConfirmed && receipt && txStatus === 'confirming') {
          console.log(`Transaction ${lastTxHash} confirmed! Receipt:`, receipt);
          if (receipt.status === 'success') {
              console.log("Calling backend submitMove action (once)...");
              setTxStatus('updating_db'); // Indicate backend update is starting

              if (!userFid || !connectedAddress || !pendingMovePosition) {
                   console.error("Missing user FID, address, or pending move position for backend call.");
                   setTxError("Internal error: Missing required data to finalize move.");
                   setTxStatus('error');
                   setPendingMovePosition(null); // Clear pending move
                   // No return needed here, state change triggers re-render
              } else {
                  // Call backend only if data is present
                  submitMove(
                      huntId as string,
                      userFid,
                      connectedAddress,
                      receipt.transactionHash
                   )
                      .then((result: SubmitResult) => {
                          if (result.success) {
                              console.log("Backend submitMove successful.");
                              setTxStatus('success'); // Move to success state
                          } else {
                              console.error("Backend submitMove failed:", result.error);
                              setTxError(result.error || "Backend failed to process the move after confirmation.");
                              setTxStatus('error');
                          }
                      })
                      .catch(err => {
                          console.error("Error calling backend submitMove:", err);
                          setTxError(err instanceof Error ? err.message : "An error occurred updating the backend.");
                          setTxStatus('error');
                      })
                      .finally(() => {
                          // Always clear pending position after backend attempt
                          setPendingMovePosition(null);
                      });
              }
          } else { // Transaction reverted
              console.error(`Transaction ${lastTxHash} reverted. Receipt:`, receipt);
              setTxError("Transaction failed on-chain (reverted).");
              setTxStatus('error');
              setPendingMovePosition(null); // Clear pending move
          }
      // Handle confirmation error (only set state if not already in error)
      } else if (confirmationError && txStatus !== 'error') {
          console.error(`Error waiting for transaction ${lastTxHash} confirmation:`, confirmationError);
          setTxError("Failed to confirm transaction.");
          setTxStatus('error');
          setPendingMovePosition(null);
      // Handle initial submission error (only set state if not already in error)
      } else if (makeMoveError && !lastTxHash && txStatus !== 'error') {
          console.error("Initial transaction submission error (from makeMoveError):", makeMoveError);
          setTxError("Failed to submit transaction to wallet.");
          setTxStatus('error'); // Already set in initiateMoveTransaction's catch, but safe fallback
          setPendingMovePosition(null);
      }

  }, [
      isConfirming,
      isConfirmed,
      receipt,
      confirmationError,
      makeMoveError,
      lastTxHash,
      huntId,
      pendingMovePosition,
      // submitMove, // Server action, stable reference
      connectedAddress,
      txStatus,
      userFid
  ]);

    // handleClaimNft is now also called automatically by the eligibility useEffect
  const handleClaimNft = useCallback(async () => {
    if (!huntId || !userFid || !connectedAddress) {
      // This check is important, especially if called automatically
      console.warn("handleClaimNft pre-flight check failed: Missing user, hunt, or connection details.");
      // Avoid setting error status here if it's an auto-call and details just aren't ready yet.
      // The calling effect should manage its own state progression if this is a transient issue.
      // If it's a persistent issue, error will be set by the calling context or user trying manually.
      return;
    }
    // Prevent re-entry if already fetching or beyond
    if (claimNftStatus === 'fetching_uri' || claimNftStatus === 'fetching_metadata_image' || claimNftStatus === 'ready_to_mint' || claimNftStatus === 'submitting_mint' || claimNftStatus === 'confirming_mint' || claimNftStatus === 'minted') {
        console.log("handleClaimNft: Already processing or completed fetching URI/minting. Current status:", claimNftStatus);
        return;
    }

    console.log("Calling backend claimNft action (invoked by eligibility check or manually)...");
    setClaimNftStatus('fetching_uri');
    setClaimNftError(null);
    setTokenUri(null);
    setNftImageUrl(null);

    try {
      // Ensure claimNft is imported from '@/app/actions/hunt'
      const result = await claimNft(huntId, userFid, connectedAddress);

      if (result.success && result.tokenUri) {
        console.log("Successfully fetched metadata tokenURI:", result.tokenUri);
        setTokenUri(result.tokenUri);
        setClaimNftStatus('fetching_metadata_image');

        // Now fetch the metadata content to get the actual image URL
        try {
          const metadataResponse = await fetch(result.tokenUri);
          if (!metadataResponse.ok) {
            throw new Error(`Failed to fetch metadata: ${metadataResponse.status}`);
          }
          const metadataJson = await metadataResponse.json();
          if (metadataJson.image) {
            console.log("Successfully fetched image URL from metadata:", metadataJson.image);
            setNftImageUrl(metadataJson.image);
            setClaimNftStatus('ready_to_mint');
          } else {
            throw new Error("Image URL missing in metadata");
          }
        } catch (fetchMetaErr: unknown) {
          console.error("Error fetching or parsing metadata for image URL:", fetchMetaErr);
          setClaimNftError(`Failed to load NFT image from metadata: ${fetchMetaErr instanceof Error ? fetchMetaErr.message : String(fetchMetaErr)}`);
          setClaimNftStatus('error');
        }
      } else {
        console.error("Backend claimNft failed:", result.error);
        setClaimNftError(result.error || "Failed to prepare NFT claim.");
        setClaimNftStatus('error');
        // If backend failed, maybe re-check eligibility?
        refetchHasMinted(); 
      }
    } catch (err: unknown) {
      console.error("Error calling claimNft action:", err);
      setClaimNftError(err instanceof Error ? err.message : "An unknown error occurred.");
      setClaimNftStatus('error');
    }
  }, [huntId, userFid, connectedAddress, refetchHasMinted, claimNftStatus]);

  // --- NFT Eligibility Check Effect ---
  useEffect(() => {
      if (isHuntEnded && userFid && connectedAddress && huntDetails?.moves && !isLoadingHasMinted) {
          // Only proceed if we are in a state where an auto-claim attempt makes sense
          if (claimNftStatus !== 'idle' && claimNftStatus !== 'checking_eligibility' && claimNftStatus !== 'error') {
            // If we're already fetching, ready, minting, minted, or in an error state from a PREVIOUS attempt, don't re-trigger.
            // Error state here implies an error from the auto-fetch itself, or a subsequent step.
            // User might need to manually retry or refresh if there was an error.
            // However, if claimNftStatus is 'error' and claimNftError is null, it might be okay to retry.
            // For now, let's be conservative: only auto-initiate if clearly in an initial phase.
            return;
          }

          console.log("Checking NFT eligibility for auto-claim...");
          // Temporarily set to checking_eligibility if it was idle, to show some UI feedback
          if (claimNftStatus === 'idle') {
            setClaimNftStatus('checking_eligibility');
          }
          setClaimNftError(null); // Clear previous errors before auto-attempt

          // 1. Check participation
          const didParticipate = huntDetails.moves.some(move => move.userId === userFid);
          if (!didParticipate) {
              console.log("User did not participate.");
              setClaimNftStatus('not_eligible');
              return;
          }

          // 2. Check onchain mint status (using data from useReadContract)
          if (hasMintedError) {
              console.error("Error checking hasMinted status:", hasMintedError);
              setClaimNftStatus('error');
              const errorMsg = hasMintedError instanceof Error ? hasMintedError.message : String(hasMintedError);
              setClaimNftError(errorMsg);
              return;
          }

          if (hasMintedData === true) {
              console.log("User has already minted.");
              setClaimNftStatus('already_minted');
              return;
          }

          // If participated and hasn't minted, and we're in a state to auto-claim:
          console.log("User is eligible, automatically calling handleClaimNft(). Current status:", claimNftStatus);
          // Directly call handleClaimNft instead of setting to 'eligible' and waiting for a button click
          handleClaimNft();

      } else if (isHuntEnded && userFid && connectedAddress && isLoadingHasMinted && claimNftStatus === 'idle') {
          // Still waiting for the read hook result, ensure 'checking_eligibility' is shown
          setClaimNftStatus('checking_eligibility');
      } else if (!isHuntEnded && claimNftStatus !== 'idle') {
           // Reset if hunt becomes active again (edge case?)
           setClaimNftStatus('idle');
           setTokenUri(null); // Clear token URI if hunt is no longer ended
           setClaimNftError(null);
      }
  }, [
      isHuntEnded,
      userFid,
      connectedAddress,
      huntDetails?.moves,
      isLoadingHasMinted,
      hasMintedData,
      hasMintedError,
      claimNftStatus, // Added to allow reaction to status changes for auto-claim logic
      handleClaimNft // Added because it's called in the effect
  ]);
  // ----------------------------------

  // --- Backend Action Call: Claim NFT to get URI ---


  // --- Wagmi Transaction Call: Mint NFT ---
  const handleMintNft = useCallback(async () => {
    if (!tokenUri || !mintNftAsync || !nftContractAddress) {
        setClaimNftError("Missing token URI or mint function/address.");
        setClaimNftStatus('error');
        return;
    }
    if (claimNftStatus === 'submitting_mint' || claimNftStatus === 'confirming_mint') {
        console.warn("Mint already in progress.");
        return;
    }

    // Ensure numericOnchainHuntIdForFrontend and connectedAddress are available
    if (!numericOnchainHuntIdForFrontend) {
        setClaimNftError("Cannot mint NFT: Onchain hunt identifier is missing or invalid.");
        setClaimNftStatus('error');
        return;
    }
    if (!connectedAddress) {
        setClaimNftError("Cannot mint NFT: Wallet address is not available.");
        setClaimNftStatus('error');
        return;
    }

    console.log("Initiating mint transaction with URI:", tokenUri, "for onchainHuntId:", numericOnchainHuntIdForFrontend.toString());
    setClaimNftStatus('submitting_mint');
    setClaimNftError(null);

    try {
        const hash = await mintNftAsync({
            address: nftContractAddress,
            abi: HuntMapNFTABI.abi,
            functionName: 'mint',
            args: [connectedAddress, numericOnchainHuntIdForFrontend, tokenUri], // Corrected args: _to, _huntId, _tokenURI
        });
        console.log("Mint transaction submitted to wallet, hash:", hash);
        // Status moves to 'confirming_mint' via effect below
    } catch {
        console.error("Error submitting mint transaction to wallet:");
        const errorMsg = "Failed to submit mint transaction via wallet."
        setClaimNftError(errorMsg);
        setClaimNftStatus('error'); 
        // Reset to allow retry? Maybe back to 'ready_to_mint' or 'eligible'?
        setClaimNftStatus('eligible'); // Go back to eligible state on wallet error
    }
  }, [tokenUri, mintNftAsync, nftContractAddress, claimNftStatus, numericOnchainHuntIdForFrontend, connectedAddress]);

  // --- Effect to handle Mint Transaction Confirmation ---
  useEffect(() => {
    if (!mintSubmitTxHash) return; // Only run if mint was submitted

    if (isConfirmingMint) {
        console.log(`Mint transaction ${mintSubmitTxHash} is confirming...`);
        setClaimNftStatus('confirming_mint');
        return;
    }

    if (isMintConfirmed && mintReceipt) {
        console.log(`Mint transaction ${mintSubmitTxHash} confirmed! Receipt:`, mintReceipt);
        if (mintReceipt.status === 'success') {
            setClaimNftStatus('minted');
            setClaimNftError(null);
            // No need to clear mintTxHash immediately, keep it for display
            // Trigger re-check of hasMinted status
            refetchHasMinted(); 
        } else {
            console.error(`Mint transaction ${mintSubmitTxHash} reverted. Receipt:`, mintReceipt);
            setClaimNftError("Mint transaction failed on-chain (reverted).");
            setClaimNftStatus('error');
        }
        return; // Exit after handling confirmation
    }

    if (mintConfirmationError) {
        console.error(`Error waiting for mint transaction ${mintSubmitTxHash} confirmation:`, mintConfirmationError);
        const errorMsg = "Failed to confirm mint transaction.";
        setClaimNftError(errorMsg);
        setClaimNftStatus('error');
        return; // Exit after handling error
    }

    // Handle the case where the wallet submission itself failed earlier
    if (mintSubmitError && !mintSubmitTxHash) { 
        console.error("Initial mint submission error (from mintSubmitError):", mintSubmitError);
        const errorMsg = "Mint transaction submission failed."
         if (claimNftStatus !== 'error') { // Avoid overwriting
            setClaimNftError(errorMsg);
            setClaimNftStatus('error');
         }
        return;
    }

  }, [
      isConfirmingMint,
      isMintConfirmed,
      mintReceipt,
      mintConfirmationError,
      mintSubmitError,
      mintSubmitTxHash,
      refetchHasMinted,
      claimNftStatus // Added missing dependency (Fix #10)
  ]);

  // --- Add helper function for Grid --- 
  const isCellTappable = useCallback((cellPos: Position): boolean => {
    if (!doesUserHoldActiveLock) return false;
    
    const dx = Math.abs(cellPos.x - currentPosition.x);
    const dy = Math.abs(cellPos.y - currentPosition.y);
    
    // Check if it's exactly one step away horizontally or vertically
    const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    
    const isInBounds = cellPos.x >= 0 && cellPos.x < GRID_SIZE && cellPos.y >= 0 && cellPos.y < GRID_SIZE;
    
    return isAdjacent && isInBounds;
  }, [doesUserHoldActiveLock, currentPosition]);
  // --------------------------------

  // --- Grid Interaction ---
  const handleGridCellClick = ({ x, y }: Position) => {
    const cellPos = { x, y };
    if (!isCellTappable(cellPos)) {
        console.warn(`handleGridCellClick called for non-tappable cell: (${x}, ${y})`);
        return;
    }
    console.log(`Grid cell tapped: (${x}, ${y})`);
    // No need to check doesUserHoldActiveLock again, isCellTappable handles it
    initiateMoveTransaction(x, y);
  };

  // --- Hint Panel Toggle --- 
  const toggleHintPanel = useCallback(() => {
      setIsHintPanelOpen(prev => !prev);
  }, []);

  // --- Backend Action Call: Reveal Treasure ---
  const handleRevealTreasure = useCallback(async () => {
      if (!huntId || !userFid) {
          setRevealError("Missing hunt ID or user FID.");
          setRevealStatus('error');
          return;
      }
      if (revealStatus === 'submitting' || revealStatus === 'confirming') {
          console.warn("Reveal already in progress.");
          return;
      }

      console.log("Calling backend revealHuntTreasure action...");
      setRevealStatus('submitting'); 
      setRevealError(null);
      setRevealTxHash(undefined);

      try {
          const result = await revealHuntTreasure(huntId, userFid);

          if (result.success && result.transactionHash) {
              console.log("Reveal transaction submitted/confirmed:", result.transactionHash);
              setRevealTxHash(result.transactionHash as `0x${string}`);
              setRevealStatus('revealed'); 
          } else {
              console.error("Backend revealHuntTreasure failed:", result.error);
              setRevealError(result.error || "Failed to reveal treasure.");
              setRevealStatus('error');
          }
      } catch (err) {
          console.error("Error calling revealHuntTreasure action:", err);
          setRevealError(err instanceof Error ? err.message : "An unknown error occurred.");
          setRevealStatus('error');
      }
  }, [huntId, userFid, revealStatus]);
  // -----------------------------------------

  // --- Loading and Error States --- 
  if (!isFarcasterLoaded) {
      return <div className="container mx-auto p-4 text-center text-[var(--theme-text-primary)]"><p>Loading Farcaster Context...</p></div>;
  }
  if (!currentUser && !pageError && !providerError) { 
      return <div className="container mx-auto p-4 text-center text-[var(--theme-text-primary)]"><p>Verifying User...</p></div>;
  }
  if (pageError || providerError) {
     return (
        <div className="container mx-auto p-4 text-center">
            <p className="text-red-600 font-bold text-xl mb-2">Error:</p>
            <p className="text-[var(--theme-text-secondary)] opacity-90 mt-1">{pageError || providerError}</p>
            <Link 
                href="/hunts" 
                className="mt-6 inline-block font-semibold py-2.5 px-6 rounded-full border-4 border-[var(--theme-border-color)] text-[var(--theme-button-secondary-text)] bg-[var(--theme-button-secondary-bg)] hover:scale-105 transition-transform shadow-sm"
            >
                &larr; Back to Hunts List
            </Link>
        </div>
    );
  }
   if (!huntDetails) {
       return <div className="container mx-auto p-4 text-center text-[var(--theme-text-primary)]"><p>Loading Hunt Data...</p></div>;
  }
  // -------------------------------

  // Show loading indicator if essential data isn't ready
  if (isLoading || !isFarcasterLoaded) { 
    return <div className="flex justify-center items-center h-screen text-[var(--theme-text-primary)]">Loading game...</div>;
  }

   // --- Determine display elements based on state ---
  const showProcessingMove = txStatus === 'submitting' || txStatus === 'confirming' || txStatus === 'updating_db';
  // const allowGridInteraction = doesUserHoldActiveLock && !showProcessingMove && txStatus !== 'error'; 

  // Base styles for new theme buttons
  const baseButtonStyle = "font-bold py-2.5 px-6 rounded-full border-4 border-[var(--theme-border-color)] text-[var(--theme-button-primary-text)] hover:scale-105 transition-transform shadow-sm disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100";
  // const primaryButtonBg = "bg-[var(--theme-button-primary-bg)]";
  const secondaryButtonBg = "bg-[var(--theme-button-secondary-bg)]"; // For things like "Switch Network"
  const greenButtonBg = "bg-green-500 hover:bg-green-600"; // Keep for specific semantic colors if needed
  const indigoButtonBg = "bg-indigo-500 hover:bg-indigo-600"; // Keep for specific semantic colors if needed
  // const cyanButtonBg = "bg-cyan-500 hover:bg-cyan-600"; 

  // --- Network Check --- 
  if (isConnected && chainId !== monadTestnet.id) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-[var(--theme-card-bg)] p-8 rounded-2xl shadow-xl text-center border-4 border-[var(--theme-border-color)]">
          <h2 className="text-2xl font-bold mb-4 text-red-600">Incorrect Network</h2>
          <p className="mb-6 text-[var(--theme-text-secondary)]">Please switch your wallet to the Monad Testnet to play.</p>
          {switchChain ? (
            <button
              onClick={() => switchChain({ chainId: monadTestnet.id })}
              className={`${baseButtonStyle} ${secondaryButtonBg}`}
              disabled={isSwitchingChain} 
            >
              {isSwitchingChain ? 'Switching Network...' : 'Switch to Monad Testnet'}
            </button>
          ) : (
            <p className="text-[var(--theme-text-secondary)]">Your wallet does not support programmatic chain switching. Please switch manually.</p>
          )}
          {switchChainError && (
            <p className="mt-2 text-sm text-red-600">Error switching network: {switchChainError.message}</p>
          )}
        </div>
      </div>
    );
  }
  // ---------------------

  return (
    <div className="flex flex-col min-h-screen text-[var(--theme-text-primary)] font-sans overflow-hidden">
      
      {/* Render Header */} 
      {huntDetails && (
          <div className="p-(4px 16px) md:p-6">
            <GameHeader 
              movesCount={huntDetails.moves.length}
              maxMoves={huntDetails.maxSteps}
              onInfoClick={toggleHintPanel}
            />
          </div>
      )}

      {/* Render Status Bar */} 
      {huntDetails && (
        <div className="p-(4px 16px) md:p-6">
          <StatusBar 
            status={huntDetails.state}
            currentLock={huntDetails.lock ?? null}
            userFid={userFid}
            lastMoveUserId={lastMoveUserId ?? undefined}
            txStatus={txStatus}
            txError={txError}
            lastTxHash={lastTxHash}
            blockExplorerUrl={blockExplorerUrl}
          />
        </div>
      )}

      {/* Main Content Area (Grid) */} 
      <main className="flex-grow flex items-center justify-center py-3 px-1 sm:px-2 overflow-hidden relative">
        {/* Transaction Overlay */} 
        {showProcessingMove && (
            <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col justify-center items-center z-20 rounded-lg backdrop-blur-sm">
              <p className="text-lg font-semibold animate-pulse mb-2">
                {txStatus === 'submitting' && "Waiting for Wallet..."}
                {txStatus === 'confirming' && "Confirming Transaction..."}
                {txStatus === 'updating_db' && "Updating Game State..."}
              </p>
              {lastTxHash && (
                  <a
                    // Use env var for explorer URL
                    href={`${blockExplorerUrl}/tx/${lastTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline mt-1 opacity-80"
                  >
                    View on Explorer
                  </a>
              )}
               {/* Simple spinner */}
               <div className="mt-4 w-8 h-8 border-4 border-t-accent border-gray-600 rounded-full animate-spin"></div>
            </div>
        )}
        {/* Grid itself */} 
        <div className={`relative ${!doesUserHoldActiveLock ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Grid
                playerPosition={currentPosition}
                moveHistory={huntDetails.moves.map(m => ({ x: m.positionX, y: m.positionY }))}
                isCellTappable={isCellTappable}
                onCellTap={handleGridCellClick}
                isLoading={txStatus === 'submitting' || txStatus === 'confirming' || txStatus === 'updating_db'}
                isGameOver={!isHuntActive}
            />
        </div>
      </main>
      
      {/* Render Footer */} 
      {/* <GameFooter /> */}

      {/* Render Hint Panel (Overlay) */} 
      {huntDetails && (
          <HintPanel 
            hints={hints}
            isOpen={isHintPanelOpen}
            onClose={toggleHintPanel}
          />
      )}

      {/* --- NFT Claim Section --- */} 
      {isHuntEnded && (
        <div className="w-full max-w-lg mx-auto mt-8 mb-6 p-6 bg-[var(--theme-card-bg)] rounded-2xl border-4 border-[var(--theme-border-color)] shadow-xl text-center">
          <h3 className="text-2xl font-bold mb-6 text-[var(--theme-text-primary)] uppercase tracking-wider">Hunt Complete!</h3>
          
          {/* Display NFT Image if nftImageUrl is available */} 
          {nftImageUrl && (claimNftStatus === 'ready_to_mint' || claimNftStatus === 'submitting_mint' || claimNftStatus === 'confirming_mint' || claimNftStatus === 'minted') && (
            <div className="my-4 p-3 bg-black/30 rounded-md border border-purple-600/50">
              <Image 
                src={nftImageUrl}
                alt={claimNftStatus === 'minted' ? "Minted Hunt Map NFT" : "Hunt Map NFT Preview"} 
                width={400} 
                height={210} 
                className={`w-full max-w-sm mx-auto rounded-md border-2 ${claimNftStatus === 'minted' ? 'border-green-500' : 'border-purple-500'} shadow-xl mb-3`}
                priority
                unoptimized
              />
            </div>
          )}

          {/* Eligibility Loading */} 
          {claimNftStatus === 'checking_eligibility' && <p className="text-sm text-yellow-400 animate-pulse">Checking NFT eligibility...</p>}
          {claimNftStatus === 'fetching_metadata_image' && <p className="text-sm text-yellow-400 animate-pulse">Loading NFT image preview...</p>}

          {/* Not Eligible */} 
          {claimNftStatus === 'not_eligible' && <p className="text-sm text-gray-400">You did not participate in this hunt, or are otherwise not eligible to claim an NFT.</p>}
          
          {/* Already Minted (checks hasMintedData directly now) */} 
          {hasMintedData === true && (
            <div>
                <p className="text-sm text-green-400">You have already minted the NFT for this hunt!</p>
            </div>
          )}

          {/* Fetching URI state - this will show up automatically after eligibility passes */} 
          {claimNftStatus === 'fetching_uri' && <p className="text-sm text-yellow-400 animate-pulse">Preparing NFT details (fetching metadata link)...</p>}

          {/* Ready to Mint - Show Mint Button (only if not already minted and URI is ready) */} 
          {claimNftStatus === 'ready_to_mint' && tokenUri && nftImageUrl && hasMintedData === false && (
              <button 
                  onClick={handleMintNft}
                  disabled={isSwitchingChain || chainId !== monadTestnet.id || !isConnected}
                  className={`${baseButtonStyle} ${greenButtonBg}`}
              >
                  Mint Your NFT Map!
              </button>
          )}

          {/* Minting Transaction Status */} 
          {(claimNftStatus === 'submitting_mint' || claimNftStatus === 'confirming_mint') && (
             <div className="mt-2">
                <p className="text-sm text-yellow-400 animate-pulse">
                    {claimNftStatus === 'submitting_mint' ? 'Waiting for wallet approval...' : 'Confirming mint transaction onchain...'}
                </p>
                {mintSubmitTxHash && (
                    <a 
                        href={`${blockExplorerUrl}tx/${mintSubmitTxHash}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline mt-1"
                    >
                        View Transaction
                    </a>
                )}
             </div>
          )}

          {/* Minted Successfully */} 
          {claimNftStatus === 'minted' && mintReceipt?.transactionHash && (
            <div className="mt-3">
                <p className="text-sm text-green-400">NFT minted successfully!</p>
                <a 
                    href={`${blockExplorerUrl}tx/${mintReceipt.transactionHash}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline mt-1"
                >
                    View Mint Transaction
                </a>
            </div>
          )}

          {/* Error Display */} 
          {claimNftStatus === 'error' && claimNftError && (
            <p className="text-sm text-red-400 mt-2">Error: {claimNftError}</p>
          )}
          
          {/* Network Switch Prompt if needed during NFT claim/mint process */} 
          {(isHuntEnded && (claimNftStatus === 'eligible' || claimNftStatus === 'ready_to_mint')) && isConnected && chainId !== monadTestnet.id && (
             <p className="mt-2 text-sm text-orange-500">
                 Please switch to Monad Testnet to mint your NFT.
                 <button 
                     onClick={() => switchChain({ chainId: monadTestnet.id })}
                     className={`ml-2 px-3 py-1.5 text-xs rounded-md border-2 border-[var(--theme-border-color)] ${secondaryButtonBg} text-[var(--theme-button-secondary-text)] font-semibold`}
                     disabled={isSwitchingChain}
                 >
                     {isSwitchingChain ? 'Switching...' : 'Switch Network'}
                 </button>
             </p>
          )}
          {switchChainError && <p className="text-xs text-red-400 mt-1">Error switching network: {switchChainError.message}</p>}

          {/* --- Reveal Treasure Section (within Hunt Ended block) --- */} 
          <div className="mt-8 border-t-2 border-[var(--color-accent)]/30 pt-6">
              {/* Show reveal button if user participated/created AND treasure not yet revealed AND hunt is ended */} 
              {isHuntEnded && 
               (huntDetails?.moves.some(m => m.userId === userFid)) && 
               revealStatus !== 'revealed' && 
               huntDetails?.state !== HuntState.PENDING_CREATION && 
               huntDetails?.state !== HuntState.FAILED_CREATION && (
                 <button
                    onClick={handleRevealTreasure}
                    disabled={revealStatus === 'submitting' || revealStatus === 'confirming' || !isConnected || (isConnected && chainId !== monadTestnet.id) }
                    className={`${baseButtonStyle} ${indigoButtonBg}`}
                 >
                    {revealStatus === 'submitting' || revealStatus === 'confirming' ? 'Revealing...' : 'Reveal Treasure Location'}
                 </button>
              )}

              {/* Reveal Status Messages */} 
              {(revealStatus === 'submitting' || revealStatus === 'confirming') && (
                 <p className="text-xs text-yellow-400 animate-pulse mt-2">Submitting reveal transaction...</p>
              )}
              {revealStatus === 'revealed' && revealTxHash && (
                 <div>
                     <p className="text-xs text-green-400 mt-2">Treasure location revealed onchain!</p>
                      <a 
                        href={`${blockExplorerUrl}tx/${revealTxHash}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline mt-1"
                    >
                        View Reveal Transaction
                    </a>
                 </div>
              )}
               {revealStatus === 'error' && revealError && ( // Corrected to use revealError for reveal issues
                 <p className="text-xs text-red-400 mt-2">Reveal Error: {revealError}</p>
              )}
              {/* Network Switch for Reveal if needed */} 
              {isHuntEnded && (revealStatus === 'idle' || revealStatus === 'error') && isConnected && chainId !== monadTestnet.id && 
               (huntDetails?.moves.some(m => m.userId === userFid)) && 
                revealStatus !== 'idle' && (
                 <p className="mt-2 text-sm text-orange-500">
                     Please switch to Monad Testnet to reveal treasure.
                     <button 
                         onClick={() => switchChain({ chainId: monadTestnet.id })}
                         className={`ml-2 px-3 py-1.5 text-xs rounded-md border-2 border-[var(--theme-border-color)] ${secondaryButtonBg} text-[var(--theme-button-secondary-text)] font-semibold`}
                         disabled={isSwitchingChain}
                     >
                         {isSwitchingChain ? 'Switching...' : 'Switch Network'}
                     </button>
                 </p>
              )}
          </div>
           {/* --- End Reveal Treasure Section --- */} 
        </div>
      )}
      {/* --- End NFT Claim Section --- */} 

      {isHuntActive && (
        <div className="p-(4px 16px) md:p-6">
          <div className="w-full max-w-md mx-auto mt-6 mb-8 p-6 bg-[var(--theme-card-bg)] rounded-xl border-4 border-[var(--theme-border-color)] shadow-xl flex flex-col items-center relative z-10">
              {!canAttemptMove && canClaimTurn && (
                  <button
                      onClick={handleClaimTurn}
                      disabled={isClaimingTurn || !isConnected || !currentUser}
                      className={`${baseButtonStyle} ${greenButtonBg}`}
                  >
                      {/* {console.log('[Debug ClaimTurn] Claim Button Rendered. Disabled Status:', { isClaimingTurn, notIsConnected: !isConnected, notCurrentUser: !currentUser, combined: isClaimingTurn || !isConnected || !currentUser })} */}
                      {isClaimingTurn ? 'Claiming...' : 'Claim Turn'}
                  </button>
              )}
              {/* {claimTurnError && <p className="mt-2 text-sm text-red-600 font-semibold">{claimTurnError}</p>} */}

              {canAttemptMove && (
                   <p className="text-lg text-[var(--theme-text-primary)] font-semibold">
                      Your turn! Select an adjacent cell.
                  </p>
              )}
          </div>
        </div>
      )}

    </div>
  );
} 