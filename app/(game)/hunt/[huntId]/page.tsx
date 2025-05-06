'use client'; 

import Link from 'next/link';
import React, { useState, useEffect, useCallback, useMemo } from 'react'; 
import { useParams } from 'next/navigation'; 
import { useFarcaster } from "@/components/providers/FarcasterProvider"; 
// --- Wagmi Imports ---
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import TreasureHuntManagerABI from '@/lib/abi/TreasureHuntManagerABI.json'; // Use path alias to copied ABI
import HuntMapNFTABI from '@/lib/abi/HuntMapNFTABI.json'; // ABI for the NFT contract
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

const accentGlowStyle = {
  textShadow: `0 0 4px var(--color-accent), 0 0 6px rgba(62, 206, 206, 0.6)`,
};
const redGlowStyle = {
    textShadow: `0 0 4px #FF4444, 0 0 6px rgba(255, 68, 68, 0.6)`,
};

// Get contract address from environment variable
const managerContractAddress = process.env.NEXT_PUBLIC_TREASURE_HUNT_MANAGER_ADDRESS as `0x${string}` | undefined;
const nftContractAddress = process.env.NEXT_PUBLIC_HUNT_MAP_NFT_ADDRESS as `0x${string}` | undefined;
// Get block explorer URL from environment variable
const blockExplorerUrl = process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || "https://explorer.testnet.monad.xyz"; // Provide fallback

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
  const [txStatus, setTxStatus] = useState<'idle' | 'submitting' | 'confirming' | 'updating_db' | 'error' | 'success'>('idle'); 
  const [txError, setTxError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [isHintPanelOpen, setIsHintPanelOpen] = useState(false);
  // --- Claim Turn State ---
  const [isClaimingTurn, setIsClaimingTurn] = useState(false);
  const [claimTurnError, setClaimTurnError] = useState<string | null>(null);

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

  // --- NFT Minting State & Hooks ---
  const [claimNftStatus, setClaimNftStatus] = useState<
      'idle' | 'checking_eligibility' | 'eligible' | 'not_eligible' | 'already_minted' | 
      'fetching_uri' | 'ready_to_mint' | 'submitting_mint' | 'confirming_mint' | 'minted' | 'error'
  >('idle');
  const [claimNftError, setClaimNftError] = useState<string | null>(null);
  const [tokenUri, setTokenUri] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>(undefined);

  // Read hook to check if user has already minted
  const { data: hasMintedData, isLoading: isLoadingHasMinted, error: hasMintedError, refetch: refetchHasMinted } = useReadContract({
      address: nftContractAddress,
      abi: HuntMapNFTABI.abi,
      functionName: 'hasMinted',
      args: [huntId, connectedAddress!], // Args: huntId, playerAddress
      query: {
          enabled: !!nftContractAddress && !!huntId && !!connectedAddress && !isHuntActive, // Only run if connected and hunt ended
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
                    console.log("SSE: Applying full hunt update");
                    setHuntDetails(payload.details); 
                } else if (payload.type === 'lock_update') {
                    console.log("SSE: Applying lock update");
                    setHuntDetails(prev => {
                        if (!prev) return { lock: payload.lock } as HuntDetails;
                        return { ...prev, lock: payload.lock };
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
  const currentLock = huntDetails?.lock;
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

  const canAttemptMove = useMemo(() => {
    if (!huntDetails || !currentUser || huntDetails.state !== HuntState.ACTIVE) return false;
    // Check if there's an active lock FOR THE CURRENT USER
    const currentLock = huntDetails.lock;
    if (currentLock && currentLock.playerFid === currentUser.fid && new Date(currentLock.expiresAt) > new Date()) {
      return true; // User has the lock and it's active
    }
    return false; // No active lock for the current user
  }, [huntDetails, currentUser]);

  const canClaimTurn = useMemo(() => {
    if (!huntDetails || !currentUser || huntDetails.state !== HuntState.ACTIVE) return false;
    if (huntDetails.lastMoveUserId === currentUser.fid) return false; // Cannot claim if they made the last move
    
    const currentLock = huntDetails.lock;
    if (currentLock && currentLock.playerFid !== currentUser.fid && new Date(currentLock.expiresAt) > new Date()) {
        return false; // Locked by someone else and lock is active
    }
    // Can claim if: no lock, or lock expired (for anyone), or it's our lock but expired.
    if (currentLock && new Date(currentLock.expiresAt) <= new Date()) {
        return true; // Lock expired, anyone eligible can claim
    }
    if (!currentLock) {
        return true; // No lock, anyone eligible can claim
    }
    return false; // Default to false if other conditions for claiming aren't met (e.g. user has an active lock already)
  }, [huntDetails, currentUser]);

  // --- Action Handlers --- 
  const handleClaimTurn = async () => {
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
    } catch (error: any) {
      console.error("Error claiming turn:", error);
      setClaimTurnError(error.message || "An unexpected error occurred while claiming turn.");
    } finally {
      setIsClaimingTurn(false);
    }
  };

  // --- New Move Handling Logic --- 

  const initiateMoveTransaction = useCallback(async (targetX: number, targetY: number) => {
    if (!huntId || !managerContractAddress || !writeContractAsync || !doesUserHoldActiveLock || !isConnected) {
        console.error("Cannot initiate move:", { huntId, managerContractAddress, writeContractAsync: !!writeContractAsync, doesUserHoldActiveLock, isConnected });
        setTxError("Cannot initiate move. Ensure you hold the lock and your wallet is connected.");
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
      const hash = await writeContractAsync({
        address: managerContractAddress,
        abi: TreasureHuntManagerABI.abi,
        functionName: 'makeMove',
        args: [huntId, targetX, targetY],
      });
      console.log("Transaction submitted to wallet, hash:", hash);
      setLastTxHash(hash);
      // Status will change to 'confirming' via the useWaitForTransactionReceipt hook effect
    } catch (err: unknown) {
      console.error("Error submitting transaction to wallet:", err);
      // Simpler error handling (Fix #6d attempt 3)
      let errorMsg = "Failed to submit transaction via wallet.";
      if (err instanceof Error) {
        errorMsg = err.message;
      } else if (typeof err === 'string') {
        errorMsg = err;
      }
      setTxError(errorMsg);
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
      if (!pendingMovePosition || !lastTxHash) return; // Only run if a move was initiated

      if (isConfirming) {
          console.log(`Transaction ${lastTxHash} is confirming...`);
          setTxStatus('confirming');
          return;
      }

      if (isConfirmed && receipt) {
          console.log(`Transaction ${lastTxHash} confirmed! Receipt:`, receipt);
          if (receipt.status === 'success') {
              console.log("Calling backend submitMove action...");
              setTxStatus('updating_db');

              if (!userFid || !connectedAddress || !pendingMovePosition) {
                   console.error("Missing user FID, address, or pending move position for backend call.");
                   setTxError("Internal error: Missing required data to finalize move.");
                   setTxStatus('error');
                   setPendingMovePosition(null);
                   return;
              }

              submitMove(
                  huntId as string,
                  userFid,
                  connectedAddress,
                  receipt.transactionHash // Tx Hash is the 4th arg
               )
                  .then((result: SubmitResult) => {
                      if (result.success) {
                          console.log("Backend submitMove successful.");
                          setTxStatus('success');
                          // Data should refresh via SSE, but could force loadHuntData() if needed
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
                      setPendingMovePosition(null); // Clear pending move after backend attempt
                  });
          } else {
              console.error(`Transaction ${lastTxHash} reverted. Receipt:`, receipt);
              setTxError("Transaction failed on-chain (reverted).");
              setTxStatus('error');
              setPendingMovePosition(null);
          }
          return; // Important: exit after handling confirmation
      }

      if (confirmationError) {
          console.error(`Error waiting for transaction ${lastTxHash} confirmation:`, confirmationError);
         
          setTxStatus('error');
          setPendingMovePosition(null);
          return; // Important: exit after handling error
      }

       // Handle the case where the wallet submission itself failed earlier (makeMoveError)
      if (makeMoveError && !lastTxHash) { // Only if hash wasn't even generated
            console.error("Initial transaction submission error (from makeMoveError):", makeMoveError);
            
            if (txStatus !== 'error') { // Avoid overwriting specific errors from initiateMoveTransaction
                setTxStatus('error');
            }
            setPendingMovePosition(null);
            return;
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
      submitMove,
      // Added missing dependencies (Fix #8)
      connectedAddress, 
      txStatus, 
      userFid
  ]);

  // --- NFT Eligibility Check Effect ---
  useEffect(() => {
      if (isHuntEnded && userFid && connectedAddress && huntDetails?.moves && !isLoadingHasMinted) {
          console.log("Checking NFT eligibility...");
          setClaimNftStatus('checking_eligibility');
          setClaimNftError(null);

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
              // Safely access error message - Attempt 2
              const errorMsg = hasMintedError instanceof Error ? hasMintedError.message : String(hasMintedError);
              setClaimNftError(errorMsg);
              return;
          }

          if (hasMintedData === true) {
              console.log("User has already minted.");
              setClaimNftStatus('already_minted');
              return;
          }

          // If participated and hasn't minted
          console.log("User is eligible to claim NFT.");
          setClaimNftStatus('eligible'); 

      } else if (isHuntEnded && userFid && connectedAddress && isLoadingHasMinted) {
          // Still waiting for the read hook result
          setClaimNftStatus('checking_eligibility');
      } else if (!isHuntEnded) {
           // Reset if hunt becomes active again (edge case?)
           setClaimNftStatus('idle');
      }
      // Add dependencies that trigger re-check
  }, [
      isHuntEnded, 
      userFid, 
      connectedAddress, 
      huntDetails?.moves, 
      isLoadingHasMinted, 
      hasMintedData, 
      hasMintedError
  ]);
  // ----------------------------------

  // --- Backend Action Call: Claim NFT to get URI ---
  const handleClaimNft = useCallback(async () => {
    if (!huntId || !userFid || !connectedAddress) {
      setClaimNftError("Missing user or connection details.");
      setClaimNftStatus('error');
      return;
    }

    console.log("Calling backend claimNft action...");
    setClaimNftStatus('fetching_uri');
    setClaimNftError(null);
    setTokenUri(null);

    try {
      // Ensure claimNft is imported from '@/app/actions/hunt'
      const result = await claimNft(huntId, userFid, connectedAddress);

      if (result.success && result.tokenUri) {
        console.log("Successfully fetched tokenURI:", result.tokenUri);
        setTokenUri(result.tokenUri);
        setClaimNftStatus('ready_to_mint');
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
  }, [huntId, userFid, connectedAddress, refetchHasMinted]);

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

    console.log("Initiating mint transaction with URI:", tokenUri);
    setClaimNftStatus('submitting_mint');
    setClaimNftError(null);
    setMintTxHash(undefined);

    try {
        const hash = await mintNftAsync({
            address: nftContractAddress,
            abi: HuntMapNFTABI.abi,
            functionName: 'mint',
            args: [tokenUri], // Pass the fetched token URI
        });
        console.log("Mint transaction submitted to wallet, hash:", hash);
        setMintTxHash(hash);
        // Status moves to 'confirming_mint' via effect below
    } catch {
        console.error("Error submitting mint transaction to wallet:");
        const errorMsg = "Failed to submit mint transaction via wallet."
        setClaimNftError(errorMsg);
        setClaimNftStatus('error'); 
        // Reset to allow retry? Maybe back to 'ready_to_mint' or 'eligible'?
        setClaimNftStatus('eligible'); // Go back to eligible state on wallet error
    }
  }, [tokenUri, mintNftAsync, nftContractAddress, claimNftStatus]);

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
      setRevealStatus('submitting'); // Using 'submitting' for the backend call duration
      setRevealError(null);
      setRevealTxHash(undefined);

      try {
          const result = await revealHuntTreasure(huntId, userFid);

          if (result.success && result.transactionHash) {
              console.log("Reveal transaction submitted/confirmed:", result.transactionHash);
              setRevealTxHash(result.transactionHash as `0x${string}`);
              setRevealStatus('revealed'); // Consider if backend waits for confirmation
              // If backend *doesn't* wait, we'd need another useWaitForTransactionReceipt hook
              // Assuming for now backend waits, so we go straight to 'revealed'.
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

  // Show loading indicator if essential data isn't ready
  if (isLoading || !isFarcasterLoaded) {
    return <div className="flex justify-center items-center h-screen text-white">Loading game...</div>;
  }

  // Show error if Farcaster failed or hunt data failed to load
  if (pageError) {
    return <div className="flex flex-col justify-center items-center h-screen text-red-400"><p>Error:</p><p>{pageError}</p><Link href="/hunts" className="mt-4 text-accent hover:underline">Back to Hunts</Link></div>;
  }

  // Show message if hunt not found (should be covered by pageError, but as fallback)
  if (!huntDetails) {
    return <div className="flex flex-col justify-center items-center h-screen text-yellow-400"><p>Could not find hunt details for ID: {huntId}</p><Link href="/hunts" className="mt-4 text-accent hover:underline">Back to Hunts</Link></div>;
  }

   // --- Determine display elements based on state ---
  const showProcessingMove = txStatus === 'submitting' || txStatus === 'confirming' || txStatus === 'updating_db';
  const allowGridInteraction = doesUserHoldActiveLock && !showProcessingMove && txStatus !== 'error'; // Allow clicks only if it's user's turn and no tx active/error

  // Style for buttons (reusable)
  const actionButtonStyle = `
    w-full sm:w-auto mt-4 px-6 py-3 rounded-lg font-semibold text-white 
    bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 
    transition duration-150 ease-in-out shadow-md focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75
  `;

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
            status={huntDetails.state}
            currentLock={huntDetails.lock ?? null}
            userFid={userFid}
            lastMoveUserId={lastMoveUserId ?? undefined}
            txStatus={txStatus}
            txError={txError}
            lastTxHash={lastTxHash}
          />
      )}

      {/* Main Content Area (Grid) */} 
      <main className="flex-grow flex items-center justify-center p-3 overflow-hidden relative">
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
        <div className={`relative ${!allowGridInteraction ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Grid
                playerPosition={currentPosition}
                moveHistory={huntDetails.moves.map(m => ({ x: m.positionX, y: m.positionY }))}
                isCellTappable={isCellTappable}
                onCellTap={handleGridCellClick}
                isLoading={showProcessingMove}
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

      {/* Temporary Debug Info */}
      <div className="absolute bottom-2 left-2 bg-gray-800 p-2 rounded text-xs opacity-80 max-w-sm overflow-auto max-h-40 z-50">
        <p>User FID: {userFid ?? 'N/A'}</p>
        <p>Connected Addr: {connectedAddress ?? 'N/A'}</p>
        {/* Ensure playerFid display handles potential null/undefined safely */}
        <p>Lock Holder: {currentLock?.playerFid ?? 'None'}, Expires: {currentLock?.expiresAt ? new Date(currentLock.expiresAt).toLocaleTimeString() : 'N/A'}</p>
        <p>Can Claim: {String(canUserClaimTurn)}</p>
        <p>Holds Lock: {String(doesUserHoldActiveLock)}</p>
      </div>

      {/* --- NFT Claim Section --- */} 
      {isHuntEnded && (
        <div className="w-full max-w-md mx-auto mt-6 mb-4 p-4 bg-gray-800 rounded-lg shadow-lg text-center">
          <h3 className="text-lg font-semibold mb-3 text-cyan-300">Hunt Complete!</h3>
          
          {/* Eligibility Loading */} 
          {claimNftStatus === 'checking_eligibility' && <p className="text-sm text-yellow-400 animate-pulse">Checking NFT eligibility...</p>}

          {/* Not Eligible */} 
          {claimNftStatus === 'not_eligible' && <p className="text-sm text-gray-400">You did not participate in this hunt, so you cannot claim an NFT.</p>}
          
          {/* Already Minted */} 
          {claimNftStatus === 'already_minted' && (
            <div>
                <p className="text-sm text-green-400">You have already minted the NFT for this hunt!</p>
                {/* Optionally link to NFT on marketplace/explorer */} 
            </div>
          )}

          {/* Eligible - Show Claim Button */} 
          {claimNftStatus === 'eligible' && (
              <button 
                  onClick={handleClaimNft}
                  className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                 Claim Hunt Map NFT
              </button>
          )}

          {/* Fetching URI state */} 
          {claimNftStatus === 'fetching_uri' && <p className="text-sm text-yellow-400 animate-pulse">Preparing NFT details...</p>}

          {/* Ready to Mint - Show Mint Button */} 
          {claimNftStatus === 'ready_to_mint' && (
              <button 
                  onClick={handleMintNft}
                  className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        href={`${blockExplorerUrl}/tx/${mintSubmitTxHash}`}
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
           {claimNftStatus === 'minted' && mintTxHash && (
             <div className="mt-3">
                 <p className="text-sm text-green-400">NFT minted successfully!</p>
                 <a 
                     href={`${blockExplorerUrl}/tx/${mintTxHash}`}
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="text-xs text-blue-400 hover:underline mt-1"
                 >
                     View Mint Transaction
                 </a>
                 {/* Optionally add link to view NFT */} 
             </div>
           )}

          {/* Error Display */} 
          {claimNftStatus === 'error' && claimNftError && (
            <p className="text-sm text-red-400 mt-2">Error: {claimNftError}</p>
          )}

          {/* --- Reveal Treasure Section (within Hunt Ended block) --- */} 
          <div className="mt-6 border-t border-gray-700 pt-4">
              {/* For now, show button if user participated/created */} 
              {/* Need creator FID from huntDetails if we check isCreator */} 
              {huntDetails?.moves.some(m => m.userId === userFid) && revealStatus !== 'revealed' && (
                 <button
                    onClick={handleRevealTreasure}
                    disabled={revealStatus === 'submitting' || revealStatus === 'confirming'}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        href={`${blockExplorerUrl}/tx/${revealTxHash}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline mt-1"
                    >
                        View Reveal Transaction
                    </a>
                 </div>
              )}
               {revealStatus === 'error' && revealError && (
                 <p className="text-xs text-red-400 mt-2">Reveal Error: {revealError}</p>
              )}
          </div>
           {/* --- End Reveal Treasure Section --- */} 

        </div>
      )}
      {/* --- End NFT Claim Section --- */}

      {isHuntActive && (
          <div className="mt-6 flex flex-col items-center">
              {!canAttemptMove && canClaimTurn && (
                  <button
                      onClick={handleClaimTurn}
                      disabled={isClaimingTurn || !isConnected || !currentUser}
                      className={actionButtonStyle + ` bg-green-600 hover:bg-green-700 focus:ring-green-400`}
                  >
                      {isClaimingTurn ? 'Claiming...' : 'Claim Turn'}
                  </button>
              )}
              {claimTurnError && <p className="mt-2 text-sm text-red-400" style={redGlowStyle}>{claimTurnError}</p>}

              {canAttemptMove && (
                   <p className="text-lg text-cyan-300 font-semibold animate-pulse" style={accentGlowStyle}>
                      Your turn! Select an adjacent cell.
                  </p>
              )}
          </div>
      )}

    </div>
  );
} 