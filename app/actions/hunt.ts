'use server';

import { PrismaClient, HuntState, TreasureType, Move, HuntLock, Prisma } from '@prisma/client';
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
import { pinata, getIpfsUrl } from '@/lib/pinata'; // Added Pinata imports
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
  nftImageIpfsCid?: string | null; // Added for return type
  nftMetadataIpfsCid?: string | null; // Added for return type
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
    submitterWalletAddress: string,
    transactionHash: string
): Promise<SubmitResult> {
    console.log(`submitMove called for hunt ${huntId} by FID ${submitterFid}, address: ${submitterWalletAddress}, txHash: ${transactionHash}`);

    let initialHuntDataForNftGeneration: {
        id: string;
        name: string | null;
        treasureType: TreasureType;
        treasurePositionX: number;
        treasurePositionY: number;
        maxSteps: number;
        state: HuntState; // This will be the newly updated state (WON/LOST)
        nftImageIpfsCid: string | null;
        nftMetadataIpfsCid: string | null;
    } | null = null;

    try {
        const huntLock = await prisma.huntLock.findUnique({ where: { huntId } });
        const huntDataForValidation = await prisma.hunt.findUnique({
            where: { id: huntId },
            select: { state: true, id: true, onchainHuntId: true, nftImageIpfsCid: true, nftMetadataIpfsCid: true }
        });

        if (!huntDataForValidation) return { success: false, error: "Hunt not found." };
        if (!huntDataForValidation.onchainHuntId) {
            console.error(`submitMove: Hunt ${huntId} (CUID) is missing its onchainHuntId.`);
            return { success: false, error: "Hunt's onchain identifier is missing. Cannot process move." };
        }
        const numericOnchainHuntId = BigInt(huntDataForValidation.onchainHuntId);

        if (huntDataForValidation.state !== HuntState.ACTIVE) return { success: false, error: "Hunt is already finished (according to DB)." };
        if (!huntLock) return { success: false, error: "You do not have the lock for this hunt." };
        if (huntLock.playerFid !== submitterFid) return { success: false, error: `Lock held by FID ${huntLock.playerFid}, not you (${submitterFid}).` };
        if (huntLock.expiresAt < new Date()) return { success: false, error: "Your lock has expired." };

        console.log(`Waiting for transaction confirmation: ${transactionHash}...`);
        const receipt = await provider.waitForTransaction(transactionHash, 1, 120000);

        if (!receipt || receipt.status !== 1) {
            console.error(`Transaction failed or receipt not found for ${transactionHash}`, receipt);
            return { success: false, error: receipt ? "Onchain transaction failed." : "Transaction confirmation timed out." };
        }
        console.log(`Transaction confirmed: ${transactionHash} in block ${receipt.blockNumber}`);

        let moveDataFromEvent: { newX: number; newY: number; moveNumber: number } | null = null;
        try {
            const iface = treasureHuntManagerContractProvider.interface;
            for (const log of receipt.logs) {
                if (log.address.toLowerCase() === treasureHuntManagerContractProvider.target.toString().toLowerCase()) {
                    try {
                        const parsedLog = iface.parseLog(log);
                        if (parsedLog && parsedLog.name === 'MoveMade' && parsedLog.args.huntId === numericOnchainHuntId && parsedLog.args.player.toLowerCase() === submitterWalletAddress.toLowerCase()) {
                            moveDataFromEvent = {
                                newX: Number(parsedLog.args.newX),
                                newY: Number(parsedLog.args.newY),
                                moveNumber: Number(parsedLog.args.moveNumber)
                            };
                            console.log('Parsed MoveMade event:', moveDataFromEvent);
                            break;
                        }
                    } catch { /* ignore parsing errors for unrelated logs */ }
                }
            }
            if (!moveDataFromEvent) console.warn(`Could not find or parse valid MoveMade event for hunt ${huntId} in tx ${transactionHash}`);
        } catch (eventError) {
            console.error("Error parsing event logs:", eventError);
        }

        // ****** Main Transaction START ******
        const transactionResult = await prisma.$transaction(async (tx) => {
            const currentHuntForTx = await tx.hunt.findUnique({
                where: { id: huntId },
                select: {
                    id: true, name: true, treasurePositionX: true, treasurePositionY: true,
                    maxSteps: true, treasureType: true, state: true, // Keep state for final check
                    moves: { orderBy: { moveNumber: 'desc' }, take: 1 }
                }
            });
            if (!currentHuntForTx) throw new Error("Failed to fetch current hunt data for processing.");

            const onchainHuntDetails = await treasureHuntManagerContractProvider.getHuntDetails(numericOnchainHuntId);
            const isOnchainActive = await treasureHuntManagerContractProvider.isHuntActive(numericOnchainHuntId);
            if (!onchainHuntDetails) throw new Error("Failed to fetch hunt details from contract after move.");

            const finalX = moveDataFromEvent ? moveDataFromEvent.newX : Number(onchainHuntDetails.currentX);
            const finalY = moveDataFromEvent ? moveDataFromEvent.newY : Number(onchainHuntDetails.currentY);
            const finalMoveNumber = moveDataFromEvent ? moveDataFromEvent.moveNumber : Number(onchainHuntDetails.movesMade);

            const previousMove = currentHuntForTx.moves[0];
            const previousPosition: Position = previousMove ? { x: previousMove.positionX, y: previousMove.positionY } : START_POSITION;
            const currentPosition: Position = { x: finalX, y: finalY };
            const treasurePosition: Position = { x: currentHuntForTx.treasurePositionX, y: currentHuntForTx.treasurePositionY };
            const hintGenerated = generateHint(currentPosition, previousPosition, treasurePosition, finalMoveNumber);

            let finalDbState: HuntState = HuntState.ACTIVE;
            const treasureFoundThisMove = finalX === currentHuntForTx.treasurePositionX && finalY === currentHuntForTx.treasurePositionY;

            if (treasureFoundThisMove) {
                finalDbState = HuntState.WON;
            } else if (!isOnchainActive || finalMoveNumber >= currentHuntForTx.maxSteps) {
                finalDbState = HuntState.LOST;
            }
            console.log(`Determined finalDbState: ${finalDbState}`);


            await tx.move.create({
                data: {
                    huntId: huntId, userId: submitterFid, moveNumber: finalMoveNumber,
                    positionX: finalX, positionY: finalY, hintGenerated: hintGenerated, transactionHash: transactionHash,
                },
            });
            console.log(`Created Move record for move ${finalMoveNumber}`);

            const huntUpdateData: Prisma.HuntUpdateInput = {
                lastMoveUserId: submitterFid,
                state: finalDbState,
                endedAt: (finalDbState === HuntState.WON || finalDbState === HuntState.LOST) ? new Date() : null,
            };
            const updatedHuntInTx = await tx.hunt.update({ where: { id: huntId }, data: huntUpdateData });
            console.log(`Updated Hunt record state to ${finalDbState}.`);

            if (finalDbState === HuntState.WON) {
                const participants = await tx.move.groupBy({
                    by: ['userId'], where: { huntId: huntId }, _count: { userId: true },
                });
                const userTreasureCreateData = participants.map(p => ({
                    userId: p.userId, huntId: huntId, treasureType: currentHuntForTx.treasureType,
                }));
                if (userTreasureCreateData.length > 0) {
                    await tx.userTreasure.createMany({ data: userTreasureCreateData, skipDuplicates: true });
                    console.log(`Created ${userTreasureCreateData.length} UserTreasure records.`);
                }
            }

            await tx.huntLock.delete({ where: { huntId } });
            console.log(`Deleted HuntLock for hunt ${huntId}`);

            // Return data needed for NFT generation if hunt ended, and for broadcast
            return {
                ...updatedHuntInTx, // This now contains the updated state
                treasurePositionX: currentHuntForTx.treasurePositionX, // Add these back as they are not in updatedHuntInTx by default
                treasurePositionY: currentHuntForTx.treasurePositionY,
                // CIDs will be null/undefined here initially
                nftImageIpfsCid: huntDataForValidation.nftImageIpfsCid, 
                nftMetadataIpfsCid: huntDataForValidation.nftMetadataIpfsCid,
                moves: await tx.move.findMany({ where: { huntId: huntId }, orderBy: { moveNumber: 'asc' } }), // For broadcast
                lock: null // Lock is deleted
            };
        });
        // ****** Main Transaction END ******

        initialHuntDataForNftGeneration = { // Prepare data for potential NFT generation step
            id: transactionResult.id,
            name: transactionResult.name,
            treasureType: transactionResult.treasureType,
            treasurePositionX: transactionResult.treasurePositionX,
            treasurePositionY: transactionResult.treasurePositionY,
            maxSteps: transactionResult.maxSteps,
            state: transactionResult.state,
            nftImageIpfsCid: transactionResult.nftImageIpfsCid, // Pass existing CIDs
            nftMetadataIpfsCid: transactionResult.nftMetadataIpfsCid
        };
        
        // Broadcast update with hunt details from the transaction
        // Ensure transactionResult has all fields for HuntDetails. If not, fetch them.
        // For HuntDetails, we need: id, name, treasureType, treasurePositionX, treasurePositionY, maxSteps, state, createdAt, endedAt, lastMoveUserId, onchainHuntId, nftImageIpfsCid, nftMetadataIpfsCid, moves, lock
        
        // Re-fetch full details for broadcast to ensure consistency, as transactionResult might be partial
        const completeHuntDetailsForBroadcast = await prisma.hunt.findUnique({
            where: { id: huntId },
            include: {
                moves: { orderBy: { moveNumber: 'asc' } },
                lock: true, // Should be null now
            }
        });

        if (!completeHuntDetailsForBroadcast) {
            // This should not happen if the transaction succeeded
            console.error("Failed to fetch complete hunt details post-transaction for broadcast.");
            // Fallback to transactionResult, though it might miss some associations for HuntDetails type
             const huntUpdatePayload: HuntUpdatePayload = { type: 'hunt_update', details: transactionResult as unknown as HuntDetails };
             await broadcastHuntUpdate(huntId, huntUpdatePayload);
        } else {
            const huntUpdatePayload: HuntUpdatePayload = { type: 'hunt_update', details: completeHuntDetailsForBroadcast };
            await broadcastHuntUpdate(huntId, huntUpdatePayload);
        }


        const lockUpdatePayload: LockUpdatePayload = { type: 'lock_update', lock: null };
        await broadcastHuntUpdate(huntId, lockUpdatePayload); // Ensure lock removal is broadcasted
        await broadcastHuntsListUpdate();

        let finalHuntToReturn: HuntDetails = completeHuntDetailsForBroadcast || transactionResult as unknown as HuntDetails;


        // ****** Post-Transaction NFT Generation START ******
        if (initialHuntDataForNftGeneration && (initialHuntDataForNftGeneration.state === HuntState.WON || initialHuntDataForNftGeneration.state === HuntState.LOST) && !initialHuntDataForNftGeneration.nftImageIpfsCid && !initialHuntDataForNftGeneration.nftMetadataIpfsCid) {
            console.log(`Hunt ${huntId} ended. Attempting to generate NFT assets post-transaction...`);
            let newNftImageCid: string | null = null;
            let newNftMetadataCid: string | null = null;

            try {
                const allMovesForNft = await prisma.move.findMany({ // Fetch outside transaction
                    where: { huntId: huntId },
                    orderBy: { moveNumber: 'asc' },
                    select: { positionX: true, positionY: true, userId: true },
                });

                const totalMovesMadeForNft = allMovesForNft.length;
                const pathCoordinates = [START_POSITION, ...allMovesForNft.map(m => ({ x: m.positionX, y: m.positionY }))];
                const pathString = pathCoordinates.map(p => `${p.x},${p.y}`).join(';');

                const participantFids = [...new Set(allMovesForNft.map(m => m.userId))];
                let adventurersString = 'Explorers';
                if (participantFids.length > 0) {
                    const users = await prisma.user.findMany({ where: { fid: { in: participantFids } }, select: { fid: true, username: true, displayName: true } });
                    const userMap = new Map(users.map(u => [u.fid, u]));
                    adventurersString = participantFids.map(fid => userMap.get(fid)?.displayName || userMap.get(fid)?.username || `FID: ${fid.toString()}`).join(', ');
                }

                const appUrl = process.env.NEXT_PUBLIC_APP_URL;
                if (!appUrl) throw new Error("Server configuration error: App URL not set for NFT generation.");

                const ogUrlParams = new URLSearchParams({
                    huntId: initialHuntDataForNftGeneration.id,
                    treasureType: initialHuntDataForNftGeneration.treasureType,
                    moves: totalMovesMadeForNft.toString(),
                    maxMoves: initialHuntDataForNftGeneration.maxSteps.toString(),
                    adventurers: adventurersString,
                    found: (initialHuntDataForNftGeneration.state === HuntState.WON).toString(),
                    path: pathString,
                    treasureX: initialHuntDataForNftGeneration.treasurePositionX.toString(),
                    treasureY: initialHuntDataForNftGeneration.treasurePositionY.toString(),
                });
                const ogImageUrl = `${appUrl}/og?${ogUrlParams.toString()}`;
                console.log(`[NFT Generation Post-Tx] Fetching OG image from: ${ogImageUrl}`);

                const imageResponse = await fetch(ogImageUrl);
                if (!imageResponse.ok) throw new Error(`Failed to fetch OG image: ${imageResponse.status} ${imageResponse.statusText}`);
                const imageBuffer = await imageResponse.arrayBuffer();
                const imageContentType = imageResponse.headers.get('content-type') || 'image/png';
                const imageBlob = new Blob([imageBuffer], { type: imageContentType });
                const imageName = `hunt-${huntId}-og-image.png`;
                const imageFile = new File([imageBlob], imageName, { type: imageContentType });
                const imagePinResult = await pinata.upload.public.file(imageFile);
                newNftImageCid = imagePinResult.cid;
                console.log(`[NFT Generation Post-Tx] Pinned image to IPFS. CID: ${newNftImageCid}`);

                const nftMetadata = {
                    name: `Treasure Hunt Map - ${initialHuntDataForNftGeneration.name || `Hunt #${initialHuntDataForNftGeneration.id.substring(0, 6)}`}`,
                    description: `A unique map NFT for the Treasure Hunt titled "${initialHuntDataForNftGeneration.name || 'Untitled Hunt'}" (ID: ${initialHuntDataForNftGeneration.id}). Outcome: ${initialHuntDataForNftGeneration.state === HuntState.WON ? 'Treasure Found!' : 'Treasure Not Found'}. Participants: ${adventurersString}.`,
                    image: getIpfsUrl(newNftImageCid),
                    attributes: [
                        { trait_type: "Hunt ID", value: initialHuntDataForNftGeneration.id },
                        { trait_type: "Treasure Type", value: initialHuntDataForNftGeneration.treasureType },
                        { trait_type: "Outcome", value: initialHuntDataForNftGeneration.state },
                        { trait_type: "Moves Made", value: totalMovesMadeForNft.toString() },
                        { trait_type: "Max Moves", value: initialHuntDataForNftGeneration.maxSteps.toString() },
                        { trait_type: "Participants", value: participantFids.length.toString() },
                    ],
                };
                const metadataJsonString = JSON.stringify(nftMetadata);
                const metadataBlob = new Blob([metadataJsonString], { type: 'application/json' });
                const metadataName = `hunt-${huntId}-metadata.json`;
                const metadataFile = new File([metadataBlob], metadataName, { type: 'application/json' });
                const metadataPinResult = await pinata.upload.public.file(metadataFile);
                newNftMetadataCid = metadataPinResult.cid;
                console.log(`[NFT Generation Post-Tx] Pinned metadata to IPFS. CID: ${newNftMetadataCid}`);

                // If CIDs were generated, update the hunt record in a new DB call
                if (newNftImageCid && newNftMetadataCid) {
                    const updatedHuntWithCids = await prisma.hunt.update({
                        where: { id: huntId },
                        data: {
                            nftImageIpfsCid: newNftImageCid,
                            nftMetadataIpfsCid: newNftMetadataCid,
                        },
                        include: { // Include relations for the final returned object
                            moves: { orderBy: { moveNumber: 'asc' } },
                            lock: true, // Should be null
                        }
                    });
                    console.log(`[NFT Generation Post-Tx] Successfully saved NFT CIDs to DB for hunt ${huntId}.`);
                    finalHuntToReturn = updatedHuntWithCids; // Update the object to be returned

                    // Optionally, broadcast another update if CIDs are critical for immediate UI
                    const finalHuntUpdateWithCids: HuntUpdatePayload = { type: 'hunt_update', details: updatedHuntWithCids };
                    await broadcastHuntUpdate(huntId, finalHuntUpdateWithCids);
                }
            } catch (nftError) {
                console.error(`[NFT Generation Post-Tx] Error generating or pinning NFT assets for hunt ${huntId}:`, nftError);
                // Don't let NFT errors fail the entire submitMove if the main transaction was successful.
            }
        }
         // ****** Post-Transaction NFT Generation END ******

        return { success: true, updatedHunt: finalHuntToReturn };

    } catch (error) {
        console.error(`Error submitting move for hunt ${huntId} by FID ${submitterFid} (tx: ${transactionHash}):`, error);
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