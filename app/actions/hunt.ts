'use server';

import { PrismaClient, HuntState, TreasureType, Move, HuntLock, Prisma, User } from '@prisma/client';
import type { LockUpdatePayload, HuntUpdatePayload, Position } from '@/types';
import { 
    generateHint, 
    generateReachableTreasurePosition
    /* createNewHunt, processPlayerMove */ 
} from '@/lib/game-logic';
import { START_POSITION, MAX_STEPS } from '@/lib/constants';
import { broadcastHuntUpdate, broadcastHuntsListUpdate } from '@/lib/hunt-broadcaster';
// --- Onchain Integration Imports ---
import { ethers } from 'ethers';
import { 
    treasureHuntManagerContract, 
    provider, // Import provider for transaction watching
    treasureHuntManagerContractProvider, // Import provider instance for event parsing
    huntMapNFTContractProvider // Need provider instance for hasMinted check
} from '@/lib/ethers';
import { pinata, getIpfsUrl, PINATA_GATEWAY_URL } from '@/lib/pinata'; // Added Pinata imports
// ---------------------------------

const prisma = new PrismaClient();

// --- Types for Return Values (Consider moving to types/index.ts if reused) ---
export interface ListedHunt {
  id: string;
  name: string | null;
  state: HuntState;
  treasureType: TreasureType;
  moveCount: number;
  lock: { playerFid: number; expiresAt: Date } | null;
}

export interface HuntDetails {
  id: string;
  name: string | null;
  treasureType: TreasureType;
  treasurePositionX: number;
  treasurePositionY: number;
  maxSteps: number;
  state: HuntState;
  createdAt: Date;
  endedAt: Date | null;
  lastMoveUserId: number | null;
  onchainHuntId?: string | null;
  moves: Move[];
  lock: HuntLock | null;
}

export interface ClaimResult {
  success: boolean;
  lock?: HuntLock;
  error?: string;
}

export interface SubmitResult {
  success: boolean;
  updatedHunt?: HuntDetails;
  error?: string;
}

// Define return type for reveal action
export interface RevealResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

// Define return type for claim NFT action
export interface ClaimNftResult {
  success: boolean;
  tokenUri?: string; // Will now be an IPFS URI
  error?: string;
}

// --- Server Actions --- 

/**
 * Creates a new hunt initiated by a user, storing it in the DB and onchain.
 */
export async function createHunt(creatorFid: number, creatorDisplayName: string): Promise<{ huntId: string } | { error: string }> {
  // --- Onchain Integration: Generate Salt & Hash ---
  let salt: string | undefined;
  let treasureLocationHash: string | undefined;
  // ---------------------------------------------
  let newHuntDbId: string | undefined; // CUID from DB
  let numericOnchainHuntIdForCreation: bigint | undefined;

  try {
    const treasurePosition = generateReachableTreasurePosition();
    const treasureTypes = ['COMMON', 'RARE', 'EPIC'] as const;
    const selectedTreasureTypeString = treasureTypes[Math.floor(Math.random() * treasureTypes.length)];
    const treasureTypePrismaEnum = TreasureType[selectedTreasureTypeString];

    if (!treasureTypePrismaEnum) {
        throw new Error(`Invalid treasure type generated: ${selectedTreasureTypeString}`);
    }

    // --- Onchain Integration: Generate Salt & Hash ---
    salt = ethers.hexlify(ethers.randomBytes(32));
    treasureLocationHash = ethers.solidityPackedKeccak256(
        ["uint8", "uint8", "bytes32"],
        [treasurePosition.x, treasurePosition.y, salt]
    );
    // --- [DEBUG LOGGING START - createHunt] ---
    console.log('[createHunt DEBUG] Generated Treasure Position:', treasurePosition);
    console.log('[createHunt DEBUG] Generated Treasure Type:', selectedTreasureTypeString);
    console.log('[createHunt DEBUG] Generated Salt:', salt);
    console.log('[createHunt DEBUG] Calculated treasureLocationHash (for contract):', treasureLocationHash);
    // --- [DEBUG LOGGING END - createHunt] ---

    const newHuntDBRecord = await prisma.hunt.create({
      data: {
        name: `${creatorDisplayName}`,
        treasureType: treasureTypePrismaEnum,
        treasurePositionX: treasurePosition.x,
        treasurePositionY: treasurePosition.y,
        maxSteps: MAX_STEPS,
        state: HuntState.PENDING_CREATION,
        creatorFid: creatorFid,
        salt: salt, // Store the exact salt used for the hash
        // onchainHuntId will be added after successful contract call
      },
    });

    newHuntDbId = newHuntDBRecord.id; // This is the CUID
    numericOnchainHuntIdForCreation = BigInt(ethers.id(newHuntDbId)); // Derive numeric ID from CUID

    // --- [DEBUG LOGGING START - createHunt IDs] ---
    console.log(`[createHunt DEBUG] DB CUID (newHuntDbId): ${newHuntDbId}`);
    console.log(`[createHunt DEBUG] Derived Numeric ID for onchain (numericOnchainHuntIdForCreation): ${numericOnchainHuntIdForCreation.toString()}`);
    // --- [DEBUG LOGGING END - createHunt IDs] ---

    console.log(`Calling TreasureHuntManager.createHunt for numericHuntId: ${numericOnchainHuntIdForCreation}...`);
    let treasureTypeContractUint: number;
    switch (selectedTreasureTypeString) {
        case 'COMMON': treasureTypeContractUint = 0; break;
        case 'RARE':   treasureTypeContractUint = 1; break;
        case 'EPIC':   treasureTypeContractUint = 2; break;
        default: throw new Error(`Unknown treasure type for contract: ${selectedTreasureTypeString}`);
    }

    const tx = await treasureHuntManagerContract.createHunt(
        numericOnchainHuntIdForCreation,
        treasureTypeContractUint, 
        MAX_STEPS,
        treasureLocationHash // The pre-calculated hash
    );

    console.log(`Transaction submitted: ${tx.hash}, waiting for confirmation...`);
    const receipt = await tx.wait(); 
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

    const savedOnchainHuntIdString = numericOnchainHuntIdForCreation.toString();
    await prisma.hunt.update({
        where: { id: newHuntDbId },
        data: { 
            state: HuntState.ACTIVE, 
            onchainHuntId: savedOnchainHuntIdString // Store the string representation of the numeric ID
        }, 
    });
    // --- [DEBUG LOGGING START - createHunt DB Save] ---
    console.log(`[createHunt DEBUG] Hunt ID ${newHuntDbId} successfully created onchain. Saved onchainHuntId to DB: '${savedOnchainHuntIdString}'`);
    // --- [DEBUG LOGGING END - createHunt DB Save] ---
    
    await broadcastHuntsListUpdate();
    return { huntId: newHuntDbId };

  } catch (error) {
    console.error("[createHunt ERROR] Error creating hunt:", error);
    if (newHuntDbId) {
        console.error(`[createHunt ERROR] Failed to complete onchain creation for DB Hunt ID (CUID): ${newHuntDbId}. Numeric ID used: ${numericOnchainHuntIdForCreation?.toString()}`);
        await prisma.hunt.update({
            where: { id: newHuntDbId },
            data: { state: HuntState.FAILED_CREATION },
        });
    }
    return { error: error instanceof Error ? error.message : "An unknown error occurred during hunt creation." };
  }
}

/**
 * Lists active hunts, including their current lock status.
 */
export async function listHunts(): Promise<ListedHunt[]> {
  try {
    const hunts = await prisma.hunt.findMany({
      where: {
        state: HuntState.ACTIVE, // Only show active hunts for joining
      },
      include: {
        lock: true, // Include lock information
        _count: {
          select: { moves: true }, // Count the number of moves
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Map to the simplified ListedHunt type
    return hunts.map(hunt => ({
      id: hunt.id,
      name: hunt.name,
      state: hunt.state,
      treasureType: hunt.treasureType,
      moveCount: hunt._count.moves,
      lock: hunt.lock ? { playerFid: hunt.lock.playerFid, expiresAt: hunt.lock.expiresAt } : null,
    }));
  } catch (error) {
    console.error("Error listing hunts:", error);
    return []; 
  }
}

/**
 * Gets the full details for a specific hunt, including all moves and lock status.
 */
export async function getHuntDetails(huntId: string): Promise<HuntDetails | null> {
  try {
    const huntDetails: HuntDetails | null = await prisma.hunt.findUnique({
      where: { id: huntId },
      include: {
        moves: {
          orderBy: {
            moveNumber: 'asc',
          },
        },
        lock: true,
      },
    });

    return huntDetails;
  } catch (error) {
    console.error(`Error fetching hunt details for ${huntId}:`, error);
    return null;
  }
}

/**
 * Attempts to claim the next turn for a specific hunt.
 */
export async function claimHuntTurn(huntId: string, claimerFid: number): Promise<ClaimResult> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const hunt = await tx.hunt.findUnique({
        where: { id: huntId },
        include: { lock: true }, 
      });

      // Initial Validation
      if (!hunt) return { success: false, error: "Hunt not found." };
      if (hunt.state !== HuntState.ACTIVE) return { success: false, error: "Hunt is not active." };

      // --- Explicit Expired Lock Check --- 
      let lockExpiredAndRemoved = false;
      if (hunt.lock && hunt.lock.expiresAt <= new Date()) {
        console.log(`Detected expired lock for hunt ${huntId}. Deleting...`);
        await tx.huntLock.delete({ where: { huntId: hunt.id } });
        const nullLockPayload: LockUpdatePayload = { type: 'lock_update', lock: null };
        await broadcastHuntUpdate(huntId, nullLockPayload);
        await broadcastHuntsListUpdate(); 
        lockExpiredAndRemoved = true;
      }
      // ------------------------------------

      // Validation Checks (using potentially updated hunt state if refreshed)
      if (hunt.lastMoveUserId === claimerFid) return { success: false, error: "You made the last move." };
      
      // Check for *active* lock only after potentially removing expired one
      if (!lockExpiredAndRemoved && hunt.lock) { 
        // If we didn't just remove an expired lock, and a lock still exists, it must be active.
        return { success: false, error: `Hunt locked by FID ${hunt.lock.playerFid} until ${hunt.lock.expiresAt.toLocaleTimeString()}` };
      }

      // 3. Create the new lock
      const lockDurationSeconds = 75;
      const expiresAt = new Date(Date.now() + lockDurationSeconds * 1000);
      const newLock = await tx.huntLock.create({
        data: {
          huntId: huntId,
          playerFid: claimerFid,
          expiresAt: expiresAt,
        },
      });

      console.log(`Turn claimed for hunt ${huntId} by FID ${claimerFid}, expires ${expiresAt.toISOString()}`);
      
      // Construct the typed payload for lock update
      const lockPayload: LockUpdatePayload = { type: 'lock_update', lock: newLock };
      await broadcastHuntUpdate(huntId, lockPayload);
      
      // List update broadcast remains the same (its payload is constructed in the broadcaster)
      await broadcastHuntsListUpdate();

      return { success: true, lock: newLock };
    });

    return result;

  } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { 
          console.warn(`Claim turn race condition likely for hunt ${huntId} by FID ${claimerFid}`);
          return { success: false, error: "Failed to claim turn, likely due to a race condition. Please try again." };
      }
    console.error(`Error claiming turn for hunt ${huntId} by FID ${claimerFid}:`, error);
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred claiming turn." };
  }
}

/**
 * Validates a move submitted via an onchain transaction, waits for confirmation,
 * and updates the database state accordingly.
 */
export async function submitMove(
    huntId: string,
    submitterFid: number,
    submitterWalletAddress: string, // Address from useAccount() on frontend
    transactionHash: string // Hash of the makeMove transaction submitted by the user
): Promise<SubmitResult> {
  console.log(`submitMove called for hunt ${huntId} by FID ${submitterFid}, address: ${submitterWalletAddress}, txHash: ${transactionHash}`);

  try {
    // 1. Validate Lock & Fetch Onchain ID
    const huntLock = await prisma.huntLock.findUnique({ where: { huntId } });
    const huntData = await prisma.hunt.findUnique({
        where: { id: huntId }, // huntId is CUID
        select: { state: true, id: true, onchainHuntId: true } // Fetch onchainHuntId
    });

    if (!huntData) return { success: false, error: "Hunt not found." };
    if (!huntData.onchainHuntId) {
        console.error(`submitMove: Hunt ${huntId} (CUID) is missing its onchainHuntId.`);
        return { success: false, error: "Hunt's onchain identifier is missing. Cannot process move." };
    }
    const numericOnchainHuntId = BigInt(huntData.onchainHuntId); // For contract calls and event comparison

    // We check ACTIVE state here from DB, but the contract is the ultimate source of truth after tx
    if (huntData.state !== HuntState.ACTIVE) return { success: false, error: "Hunt is already finished (according to DB)." };
    if (!huntLock) return { success: false, error: "You do not have the lock for this hunt." };
    if (huntLock.playerFid !== submitterFid) return { success: false, error: `Lock held by FID ${huntLock.playerFid}, not you (${submitterFid}).` };
    if (huntLock.expiresAt < new Date()) {
        // NOTE: Even if lock expired *after* tx submission but *before* this check,
        // the onchain transaction might still succeed if it was mined quickly.
        // The contract's `makeMove` does NOT check the off-chain lock.
        // We keep this check primarily to prevent users calling this *after* lock expiry.
        return { success: false, error: "Your lock has expired." };
    }

    // 2. Wait for Transaction Confirmation
    console.log(`Waiting for transaction confirmation: ${transactionHash}...`);
    const receipt = await provider.waitForTransaction(transactionHash, 1, 120000); // Wait for 1 confirmation, timeout 120s

    if (!receipt) {
        // This should ideally not happen with waitForTransaction unless timeout occurs
        console.error(`Transaction receipt not found after timeout for ${transactionHash}`);
        return { success: false, error: "Transaction confirmation timed out." };
    }

    if (receipt.status !== 1) {
        console.error(`Transaction failed: ${transactionHash}`, receipt);
        // TODO: Should we delete the lock here if the onchain tx failed?
        // Probably not, as the user might want to retry with more gas etc.
        return { success: false, error: "Onchain transaction failed." };
    }
    console.log(`Transaction confirmed: ${transactionHash} in block ${receipt.blockNumber}`);

    // 3. Verify Onchain Event and Extract Data (Recommended)
    let moveDataFromEvent: { newX: number; newY: number; moveNumber: number } | null = null;
    try {
        const iface = treasureHuntManagerContractProvider.interface; // Use interface from provider contract
        for (const log of receipt.logs) {
             // Check if the log is from our contract
             if (log.address.toLowerCase() === treasureHuntManagerContractProvider.target.toString().toLowerCase()) {
                try {
                    const parsedLog = iface.parseLog(log);
                    if (parsedLog && parsedLog.name === 'MoveMade') {
                        // Ensure args exist and have expected types/names based on ABI
                        // Compare event player address with the address passed from frontend
                        // Compare numeric onchainHuntId with the one from the event
                        if (parsedLog.args &&
                            parsedLog.args.huntId === numericOnchainHuntId && 
                            parsedLog.args.player.toLowerCase() === submitterWalletAddress.toLowerCase()
                        ) { 
                            moveDataFromEvent = {
                                newX: Number(parsedLog.args.newX), // Convert BigInt/Number as needed
                                newY: Number(parsedLog.args.newY),
                                moveNumber: Number(parsedLog.args.moveNumber)
                            };
                            console.log('Parsed MoveMade event:', moveDataFromEvent);
                            break;
                        }
                    }
                } catch {}
            }
        }
        if (!moveDataFromEvent) {
             console.warn(`Could not find or parse valid MoveMade event for hunt ${huntId} / player ${submitterWalletAddress} in tx ${transactionHash}`);
             // Decide whether to proceed without event verification or return error
             // For now, let's proceed but log heavily. Alternatively: return { success: false, error: "Could not verify move via event logs." };
        }
    } catch (eventError) {
        console.error("Error parsing event logs:", eventError);
        // Decide how critical event parsing is. Proceeding without it for now.
    }

    // 4. Update Database State within a Transaction
    const result = await prisma.$transaction(async (tx) => {
        // Fetch latest hunt data *needed for hint generation or state check*
        // Also fetch previous moves to determine the last position for hint generation
        // We select more fields now for potential NFT metadata generation
        const currentHuntForTx = await tx.hunt.findUnique({
            where: { id: huntId },
            select: {
                id: true, // For OG image params if needed directly
                name: true, // For NFT metadata
                treasurePositionX: true,
                treasurePositionY: true,
                maxSteps: true,
                treasureType: true,
                nftImageIpfsCid: true, // Check if already generated
                nftMetadataIpfsCid: true, // Check if already generated
                moves: { // For previous position and potentially for full path if needed later
                    orderBy: { moveNumber: 'desc' },
                    take: 1 // Only need the very last one for hint
                }
            }
        });
        if (!currentHuntForTx) {
            throw new Error("Failed to fetch current hunt data for processing.");
        }

        // Fetch latest onchain state post-transaction
        // Use numericOnchainHuntId for contract calls
        const onchainHuntDetails = await treasureHuntManagerContractProvider.getHuntDetails(numericOnchainHuntId);
        const isOnchainActive = await treasureHuntManagerContractProvider.isHuntActive(numericOnchainHuntId);

        if (!onchainHuntDetails) {
            throw new Error("Failed to fetch hunt details from contract after move.");
        }

        // Use event data if available and valid, otherwise fall back to contract state
        const finalX = moveDataFromEvent ? moveDataFromEvent.newX : Number(onchainHuntDetails.currentX);
        const finalY = moveDataFromEvent ? moveDataFromEvent.newY : Number(onchainHuntDetails.currentY);
        const finalMoveNumber = moveDataFromEvent ? moveDataFromEvent.moveNumber : Number(onchainHuntDetails.movesMade);

        // Determine previous position for hint generation (Fix #1)
        const previousMove = currentHuntForTx.moves[0]; // Since we ordered desc and took 1
        const previousPosition: Position = previousMove 
            ? { x: previousMove.positionX, y: previousMove.positionY } 
            : START_POSITION; // Fallback for the very first move
        const currentPosition: Position = { x: finalX, y: finalY };
        const treasurePosition: Position = { x: currentHuntForTx.treasurePositionX, y: currentHuntForTx.treasurePositionY };

        // Generate Hint using the correct helper function
        const hintGenerated = generateHint(
            currentPosition,
            previousPosition,
            treasurePosition,
            finalMoveNumber
        );
        console.log(`Generated hint for move ${finalMoveNumber}: ${hintGenerated}`);

        // Determine final DB state based on move result and contract state (Fix #4)
        let finalDbState: HuntState = HuntState.ACTIVE;
        const treasureFoundThisMove = finalX === currentHuntForTx.treasurePositionX && finalY === currentHuntForTx.treasurePositionY;

        if (treasureFoundThisMove) {
            finalDbState = HuntState.WON;
            console.log(`Treasure found on move ${finalMoveNumber}! State set to WON.`);
        } else if (!isOnchainActive) {
            // If treasure not found this move AND hunt is inactive onchain (likely max steps reached)
            finalDbState = HuntState.LOST;
            console.log(`Hunt inactive onchain and treasure not found. State set to LOST.`);
        } else if (finalMoveNumber >= currentHuntForTx.maxSteps) {
            // Belt-and-suspenders check: if DB move number reaches max steps, mark as LOST
            // This handles cases where isOnchainActive might lag slightly or has different logic
             finalDbState = HuntState.LOST;
             console.log(`Max steps (${currentHuntForTx.maxSteps}) reached. State set to LOST.`);
        }

        // Create the Move record based on verified data
        await tx.move.create({
            data: {
                huntId: huntId,
                userId: submitterFid,
                moveNumber: finalMoveNumber,
                positionX: finalX,
                positionY: finalY,
                hintGenerated: hintGenerated, // Use generated hint
                transactionHash: transactionHash, 
            },
        });
        console.log(`Created Move record for move ${finalMoveNumber}`);

        let newNftImageCid: string | null = null;
        let newNftMetadataCid: string | null = null;

        // If the hunt has ended (WON or LOST) and NFT CIDs are not yet generated
        if ((finalDbState === HuntState.WON || finalDbState === HuntState.LOST) && !currentHuntForTx.nftImageIpfsCid && !currentHuntForTx.nftMetadataIpfsCid) {
            console.log(`Hunt ${huntId} ended with state ${finalDbState}. Attempting to generate NFT assets...`);
            try {
                // Fetch all moves for the path and count, and participant FIDs
                const allMovesForNft = await tx.move.findMany({
                    where: { huntId: huntId },
                    orderBy: { moveNumber: 'asc' },
                    select: { positionX: true, positionY: true, userId: true },
                });

                const totalMovesMadeForNft = allMovesForNft.length;
                const pathCoordinates = [
                    START_POSITION,
                    ...allMovesForNft.map(m => ({ x: m.positionX, y: m.positionY }))
                ];
                const pathString = pathCoordinates.map(p => `${p.x},${p.y}`).join(';');

                const participantFids = [...new Set(allMovesForNft.map(m => m.userId))];
                let adventurersString = 'Explorers';
                if (participantFids.length > 0) {
                    const users = await tx.user.findMany({
                        where: { fid: { in: participantFids } },
                        select: { fid: true, username: true, displayName: true },
                    });
                    const userMap = new Map(users.map(u => [u.fid, u]));
                    adventurersString = participantFids.map(fid => {
                        const user = userMap.get(fid);
                        return user?.displayName || user?.username || `FID: ${fid.toString()}`;
                    }).join(', ');
                }
                
                const appUrl = process.env.NEXT_PUBLIC_APP_URL;
                if (!appUrl) {
                    console.error("[NFT Generation] NEXT_PUBLIC_APP_URL is not set. Cannot fetch OG image.");
                    throw new Error("Server configuration error: App URL not set for NFT generation.");
                }

                const ogUrlParams = new URLSearchParams({
                    huntId: currentHuntForTx.id,
                    treasureType: currentHuntForTx.treasureType,
                    moves: totalMovesMadeForNft.toString(),
                    maxMoves: currentHuntForTx.maxSteps.toString(),
                    adventurers: adventurersString,
                    found: (finalDbState === HuntState.WON).toString(),
                    path: pathString,
                    treasureX: currentHuntForTx.treasurePositionX.toString(),
                    treasureY: currentHuntForTx.treasurePositionY.toString(),
                });
                const ogImageUrl = `${appUrl}/og?${ogUrlParams.toString()}`;
                console.log(`[NFT Generation] Fetching OG image from: ${ogImageUrl}`);

                const imageResponse = await fetch(ogImageUrl);
                if (!imageResponse.ok) {
                    throw new Error(`Failed to fetch OG image: ${imageResponse.status} ${imageResponse.statusText}`);
                }
                const imageBuffer = await imageResponse.arrayBuffer();
                
                // Pin image to Pinata
                const imageContentType = imageResponse.headers.get('content-type') || 'image/png';
                const imageBlob = new Blob([imageBuffer], { type: imageContentType });
                const imageName = `hunt-${huntId}-og-image.png`;
                const imageFile = new File([imageBlob], imageName, { type: imageContentType });
                const imagePinResult = await pinata.upload.public.file(imageFile);
                newNftImageCid = imagePinResult.cid;
                console.log(`[NFT Generation] Pinned image to IPFS. CID: ${newNftImageCid}`);

                // Construct NFT Metadata
                const nftMetadata = {
                    name: `Treasure Hunt Map - ${currentHuntForTx.name || `Hunt #${currentHuntForTx.id.substring(0,6)}`}`,
                    description: `A unique map NFT for the Treasure Hunt titled "${currentHuntForTx.name || 'Untitled Hunt'}" (ID: ${currentHuntForTx.id}). This map commemorates the adventure. Outcome: ${finalDbState === HuntState.WON ? 'Treasure Found!' : 'Treasure Not Found'}. Participants: ${adventurersString}.`,
                    image: getIpfsUrl(newNftImageCid), // Uses ipfs://<CID> or your gateway
                    attributes: [
                        { trait_type: "Hunt ID", value: currentHuntForTx.id },
                        { trait_type: "Treasure Type", value: currentHuntForTx.treasureType },
                        { trait_type: "Outcome", value: finalDbState },
                        { trait_type: "Moves Made", value: totalMovesMadeForNft.toString() },
                        { trait_type: "Max Moves", value: currentHuntForTx.maxSteps.toString() },
                        { trait_type: "Participants", value: participantFids.length.toString() },
                    ],
                };

                // Pin metadata to Pinata
                const metadataJsonString = JSON.stringify(nftMetadata);
                const metadataBlob = new Blob([metadataJsonString], { type: 'application/json' });
                const metadataName = `hunt-${huntId}-metadata.json`;
                const metadataFile = new File([metadataBlob], metadataName, { type: 'application/json' });
                const metadataPinResult = await pinata.upload.public.file(metadataFile);
                newNftMetadataCid = metadataPinResult.cid;
                console.log(`[NFT Generation] Pinned metadata to IPFS. CID: ${newNftMetadataCid}`);

            } catch (nftError) {
                console.error(`[NFT Generation] Error generating or pinning NFT assets for hunt ${huntId}:`, nftError);
                // Do not throw here to allow the rest of the submitMove to complete.
                // CIDs will remain null in the DB, can be retried later or handled manually.
            }
        }

        // Update the Hunt record
        const updateData: Prisma.HuntUpdateInput = {
            lastMoveUserId: submitterFid,
            state: finalDbState,
            endedAt: (finalDbState === HuntState.WON || finalDbState === HuntState.LOST) ? new Date() : null,
        };

        if (newNftImageCid) {
            updateData.nftImageIpfsCid = newNftImageCid;
        }
        if (newNftMetadataCid) {
            updateData.nftMetadataIpfsCid = newNftMetadataCid;
        }

        await tx.hunt.update({
            where: { id: huntId },
            data: updateData,
        });
        console.log(`Updated Hunt record state to ${finalDbState} and potentially NFT CIDs.`);

        // If hunt is WON, create UserTreasure records for all participants
        if (finalDbState === HuntState.WON) {
            const participants = await tx.move.groupBy({
                by: ['userId'],
                where: { huntId: huntId },
                _count: { userId: true }, // Just to make groupBy work, we only need distinct userIds
            });

            const userTreasureCreateData = participants.map(p => ({
                userId: p.userId,
                huntId: huntId,
                treasureType: currentHuntForTx.treasureType, // Fetched earlier
            }));

            if (userTreasureCreateData.length > 0) {
                try {
                    await tx.userTreasure.createMany({
                        data: userTreasureCreateData,
                        skipDuplicates: true, // In case this logic runs multiple times, though transaction should prevent it
                    });
                    console.log(`Created ${userTreasureCreateData.length} UserTreasure records for hunt ${huntId}.`);
                } catch (userTreasureError) {
                    // Log the error but don't necessarily throw, 
                    // as the main hunt/move logic might be more critical to complete.
                    // The transaction will roll back if this is a critical DB error.
                    console.error(`Error creating UserTreasure records for hunt ${huntId}:`, userTreasureError);
                    // Optionally, re-throw if UserTreasure creation is absolutely critical for the transaction to succeed
                    // throw new Error("Failed to create UserTreasure records."); 
                }
            }
        }

        // Delete the lock now that the move is confirmed onchain and DB updated
        await tx.huntLock.delete({ where: { huntId } });
        console.log(`Deleted HuntLock for hunt ${huntId}`);

        // Fetch final details for broadcasting
        const finalDetailsForBroadcast = await tx.hunt.findUnique({
            where: { id: huntId },
            include: {
                moves: { orderBy: { moveNumber: 'asc' } },
                lock: true, // Lock should be null here
            },
        });

        if (!finalDetailsForBroadcast) {
             throw new Error("Failed to fetch final hunt details after DB update.");
        }

        return finalDetailsForBroadcast; 
    }); // End Prisma Transaction

    // 5. Broadcast Updates
    const lockUpdatePayload: LockUpdatePayload = { type: 'lock_update', lock: null }; // Broadcast lock removal
    await broadcastHuntUpdate(huntId, lockUpdatePayload);
    
    const huntUpdatePayload: HuntUpdatePayload = { type: 'hunt_update', details: result };
    await broadcastHuntUpdate(huntId, huntUpdatePayload);

    await broadcastHuntsListUpdate();

    return { success: true, updatedHunt: result };

  } catch (error) {
    console.error(`Error submitting move for hunt ${huntId} by FID ${submitterFid} (tx: ${transactionHash}):`, error);
    // Avoid deleting lock here, let user retry or handle manually
    return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred processing the move." };
  }
}

/**
 * Verifies eligibility and generates the tokenURI (Vercel OG Image URL) for a participant
 * to mint their Hunt Map NFT.
 */
export async function claimNft(
    huntId: string,
    callerFid: number,
    callerWalletAddress: string
): Promise<ClaimNftResult> {
    console.log(`claimNft called for hunt ${huntId} by FID ${callerFid}, address: ${callerWalletAddress}`);

    try {
        // 1. Fetch Hunt Data & Check Completion Status
        const hunt = await prisma.hunt.findUnique({
            where: { id: huntId },
            select: {
                id: true,
                name: true, // For logging or if needed in future metadata checks
                state: true,
                onchainHuntId: true,
                nftMetadataIpfsCid: true, // <<< Crucial for IPFS based tokenURI
                // Fields below are no longer strictly needed here if CIDs exist, but good for context/validation
                treasureType: true,
                maxSteps: true,
                treasurePositionX: true,
                treasurePositionY: true,
            },
        });

        if (!hunt) {
            return { success: false, error: "Hunt not found." };
        }
        if (!hunt.onchainHuntId) {
            console.error(`claimNft: Hunt ${hunt.name || hunt.id} (CUID) is missing its onchainHuntId.`);
            return { success: false, error: "Hunt's onchain identifier is missing. Cannot claim NFT." };
        }

        if (hunt.state !== HuntState.WON && hunt.state !== HuntState.LOST) {
            return { success: false, error: "Hunt is not yet completed." };
        }

        // <<< New Check for nftMetadataIpfsCid >>>
        if (!hunt.nftMetadataIpfsCid) {
            console.warn(`claimNft: Hunt ${hunt.name || hunt.id} is completed but missing nftMetadataIpfsCid.`);
            return { 
                success: false, 
                error: "NFT metadata is not yet available for this hunt. It might still be processing. Please try again shortly." 
            };
        }

        // 2. Check Participation (remains the same)
        const participation = await prisma.move.findFirst({
            where: { huntId: huntId, userId: callerFid },
            select: { id: true },
        });

        if (!participation) {
            return { success: false, error: "You were not a participant in this hunt." };
        }

        // 3. Check if Already Minted Onchain (remains the same)
        const numericOnchainHuntId = BigInt(hunt.onchainHuntId);
        try {
            const alreadyMinted = await huntMapNFTContractProvider.hasMinted(numericOnchainHuntId, callerWalletAddress);
            if (alreadyMinted) {
                return { success: false, error: "You have already minted an NFT for this hunt." };
            }
        } catch (contractError) {
            console.error(`Error checking mint status for hunt ${hunt.name || hunt.id}, address ${callerWalletAddress}:`, contractError);
            return { success: false, error: "Could not verify mint status onchain." };
        }

        // 4. Construct IPFS tokenUri from stored CID
        const tokenUri = getIpfsUrl(hunt.nftMetadataIpfsCid);
        if (!tokenUri) {
            // This should ideally not happen if nftMetadataIpfsCid check passed, but as a safeguard
            console.error(`claimNft: Failed to construct tokenUri for hunt ${hunt.name || hunt.id} even though CID exists.`);
            return { success: false, error: "Failed to construct NFT metadata URI." };
        }

        console.log(`Generated IPFS tokenUri for hunt ${hunt.name || hunt.id}: ${tokenUri}`);
        return { success: true, tokenUri: tokenUri };

    } catch (error) {
        console.error(`Error generating NFT token URI for hunt ${huntId} by FID ${callerFid}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred preparing NFT claim." };
    }
}

/**
 * Allows an authorized user (participant or creator) to reveal the treasure location onchain
 * after a hunt has ended.
 */
export async function revealHuntTreasure(
    huntIdCUID: string, 
    callerFid: number
): Promise<RevealResult> {
    console.log(`[revealHuntTreasure Action] Called for CUID: ${huntIdCUID} by FID ${callerFid}`);

    try {
        const hunt = await prisma.hunt.findUnique({
            where: { id: huntIdCUID }, 
            select: {
                id: true, 
                treasurePositionX: true,
                treasurePositionY: true,
                salt: true,
                creatorFid: true,
                onchainHuntId: true 
            },
        });

        if (!hunt) {
            console.error(`[revealHuntTreasure ERROR] Hunt not found in DB for CUID: ${huntIdCUID}`);
            return { success: false, error: "Hunt not found in DB." };
        }
        console.log('[revealHuntTreasure DEBUG] Fetched Hunt Data from DB:', JSON.stringify(hunt, null, 2));

        if (!hunt.salt) {
            console.error(`[revealHuntTreasure ERROR] Hunt ${huntIdCUID} is missing its salt in DB.`);
            return { success: false, error: "Hunt's salt is missing. Cannot reveal treasure." };
        }
        if (!hunt.onchainHuntId) {
            console.error(`[revealHuntTreasure ERROR] Hunt ${huntIdCUID} is missing its onchainHuntId in DB.`);
            return { success: false, error: "Hunt's onchain identifier is missing. Cannot reveal treasure." };
        }
        
        let numericOnchainHuntIdFromDB: bigint;
        try {
            numericOnchainHuntIdFromDB = BigInt(hunt.onchainHuntId);
        } catch (e) {
            console.error(`[revealHuntTreasure ERROR] Failed to convert stored onchainHuntId ('${hunt.onchainHuntId}') to BigInt for CUID ${huntIdCUID}.`, e);
            return { success: false, error: "Stored onchain identifier is invalid." };
        }
        console.log(`[revealHuntTreasure DEBUG] Converted onchainHuntId to BigInt: ${numericOnchainHuntIdFromDB.toString()}`);

        const dbTreasureX = hunt.treasurePositionX;
        const dbTreasureY = hunt.treasurePositionY;
        const dbSalt = hunt.salt;

        const recalculatedCommitment = ethers.solidityPackedKeccak256(
            ["uint8", "uint8", "bytes32"],
            [dbTreasureX, dbTreasureY, dbSalt]
        );
        console.log('[revealHuntTreasure DEBUG] Recalculated commitment hash using DB values:', recalculatedCommitment);
        console.log('[revealHuntTreasure DEBUG] Values used for recalculation: X=', dbTreasureX, 'Y=', dbTreasureY, 'Salt=', dbSalt);

        // <<< DEBUGGING: Call the new getter function >>>
        let storedHashFromContract: string | undefined;
        try {
            console.log(`[revealHuntTreasure DEBUG] Calling contract.getStoredTreasureLocationHash(${numericOnchainHuntIdFromDB.toString()})...`);
            storedHashFromContract = await treasureHuntManagerContractProvider.getStoredTreasureLocationHash(numericOnchainHuntIdFromDB);
            console.log('[revealHuntTreasure DEBUG] Hash FROM CONTRACT using getter:', storedHashFromContract);

            if (recalculatedCommitment.toLowerCase() !== storedHashFromContract?.toLowerCase()) {
                console.error('[revealHuntTreasure CRITICAL MISMATCH!] Recalculated hash does NOT match hash from contract getter!');
                console.error(`  Recalculated: ${recalculatedCommitment}`);
                console.error(`  From Contract: ${storedHashFromContract}`);
            } else {
                console.log('[revealHuntTreasure DEBUG] Hashes MATCH between recalculated and contract getter. Proceeding to reveal.');
            }
        } catch (getterError: unknown) {
            console.error('[revealHuntTreasure ERROR] Failed to call getStoredTreasureLocationHash on contract:', getterError);
            // Log message if it's an Error instance
            if (getterError instanceof Error) {
                console.error('[revealHuntTreasure ERROR] Getter error message:', getterError.message);
                // Optionally, return specific error: 
                // return { success: false, error: `Failed to query contract for stored hash: ${getterError.message}` };
            } else {
                console.error('[revealHuntTreasure ERROR] Getter error was not an Error instance.');
            }
        }
        // <<< END DEBUGGING >>>

        const participation = await prisma.move.findFirst({
            where: { huntId: huntIdCUID, userId: callerFid },
            select: { id: true },
        });
        const isParticipant = !!participation;
        const creatorFidFromDb: number | null | undefined = hunt.creatorFid;
        const isCreator = creatorFidFromDb ? creatorFidFromDb === callerFid : false;

        if (!isParticipant && !isCreator) {
            console.warn(`[revealHuntTreasure WARN] FID ${callerFid} is not participant or creator for hunt CUID ${huntIdCUID}.`);
            return { success: false, error: "Not authorized to reveal treasure for this hunt." };
        }
        
        console.log(`[revealHuntTreasure INFO] Attempting to call contract.revealTreasure for numeric onchainHuntId: ${numericOnchainHuntIdFromDB.toString()}...`);
        // Use the main treasureHuntManagerContract (with signer) for the state-changing transaction
        const tx = await treasureHuntManagerContract.revealTreasure(
            numericOnchainHuntIdFromDB, 
            dbTreasureX,
            dbTreasureY,
            dbSalt 
        );

        console.log(`[revealHuntTreasure INFO] Reveal transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait(1);

        if (!receipt || receipt.status !== 1) {
             console.error(`[revealHuntTreasure ERROR] Reveal transaction failed or receipt not found. TxHash: ${tx.hash}`, receipt);
             return { success: false, error: "Onchain transaction failed during reveal.", transactionHash: tx.hash };
        }
        console.log(`[revealHuntTreasure INFO] Reveal transaction confirmed: ${tx.hash} in block ${receipt.blockNumber}`);
        return { success: true, transactionHash: tx.hash };

    } catch (error) {
        console.error(`[revealHuntTreasure ERROR] General error for CUID ${huntIdCUID} by FID ${callerFid}:`, error);
        
        // Check for Ethers-like error structure with a 'reason'
        // This is a common pattern but not strictly typed without importing Ethers error types
        // if (typeof error === 'object' && error !== null && 'reason' in error && typeof (error as any).reason === 'string') {
        //     const revertReason = (error as any).reason as string;
        //     console.error(`[revealHuntTreasure ERROR] Revert Reason: ${revertReason}`);
        //     return { success: false, error: `Onchain error: ${revertReason}` };
        // } 
        // // Fallback to standard Error message
        // else if (error instanceof Error) {
        //     return { success: false, error: error.message };
        // }
        // Ultimate fallback
        return { success: false, error: "An unknown error occurred revealing treasure." };
    }
} 

// --- New Server Action for Hunt History ---

/**
 * Represents a hunt entry in the user's history.
 */
export interface UserHuntHistoryEntry extends ListedHunt { // Reuse ListedHunt structure
    outcome?: 'WON' | 'LOST'; // Add outcome for ended hunts
    onchainHuntId?: string | null; // Include for potential future use (like linking mint check)
}

/**
 * Fetches all hunts a specific user has participated in.
 */
export async function getUserHuntHistory(userFid: number): Promise<UserHuntHistoryEntry[]> {
    console.log(`getUserHuntHistory called for FID: ${userFid}`);
    try {
        const hunts = await prisma.hunt.findMany({
            where: {
                // Find hunts where there is at least one move by the user
                moves: {
                    some: {
                        userId: userFid,
                    },
                },
            },
            include: {
                lock: true, // Include lock for active hunts
                _count: {
                    select: { moves: true }, // Count moves
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Map to the history entry type
        return hunts.map(hunt => ({
            id: hunt.id,
            name: hunt.name,
            state: hunt.state,
            treasureType: hunt.treasureType,
            moveCount: hunt._count.moves,
            lock: hunt.lock ? { playerFid: hunt.lock.playerFid, expiresAt: hunt.lock.expiresAt } : null,
            // Determine outcome based on state
            outcome: hunt.state === HuntState.WON ? 'WON' : hunt.state === HuntState.LOST ? 'LOST' : undefined,
            onchainHuntId: hunt.onchainHuntId, // Pass along the onchain ID
        }));

    } catch (error) {
        console.error(`Error fetching hunt history for FID ${userFid}:`, error);
        return []; // Return empty array on error
    }
}

// --- End New Server Action --- 

// --- Admin Actions ---
/**
 * [ADMIN ACTION] Deletes all hunts, moves, and locks from the database.
 * USE WITH EXTREME CAUTION - THIS IS A DESTRUCTIVE OPERATION.
 */
export async function admin_deleteAllHunts(): Promise<{ success: boolean; message: string; error?: string }> {
  console.warn("[ADMIN ACTION] Attempting to delete all hunt data...");
  try {
    // Delete in order to respect foreign key constraints
    const deletedMoves = await prisma.move.deleteMany({});
    console.log(`[ADMIN ACTION] Deleted ${deletedMoves.count} moves.`);

    const deletedLocks = await prisma.huntLock.deleteMany({});
    console.log(`[ADMIN ACTION] Deleted ${deletedLocks.count} hunt locks.`);

    const deletedHunts = await prisma.hunt.deleteMany({});
    console.log(`[ADMIN ACTION] Deleted ${deletedHunts.count} hunts.`);

    // After deleting, broadcast that the list has changed (it will be empty)
    await broadcastHuntsListUpdate();
    
    const successMsg = `Successfully deleted all data: ${deletedHunts.count} hunts, ${deletedMoves.count} moves, ${deletedLocks.count} locks.`;
    console.log(`[ADMIN ACTION] ${successMsg}`);
    return { success: true, message: successMsg };

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "An unknown error occurred during deletion.";
    console.error("[ADMIN ACTION] Error deleting all hunt data:", errorMsg);
    return { success: false, message: "Failed to delete all hunt data.", error: errorMsg };
  }
} 