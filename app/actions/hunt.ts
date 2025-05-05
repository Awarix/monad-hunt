'use server';

import { PrismaClient, HuntState, TreasureType, Move, HuntLock, Prisma } from '@prisma/client';
import type { LockUpdatePayload, HuntUpdatePayload, Position } from '@/types';
import { generateHint, /* createNewHunt, processPlayerMove */ } from '@/lib/game-logic';
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
  tokenUri?: string; // URL for the Vercel OG Image
  error?: string;
}

// --- Server Actions --- 

/**
 * Creates a new hunt initiated by a user, storing it in the DB and onchain.
 */
export async function createHunt(creatorFid: number): Promise<{ huntId: string } | { error: string }> {
  // --- Onchain Integration: Generate Salt & Hash ---
  let salt: string | undefined;
  let treasureLocationHash: string | undefined;
  // ---------------------------------------------
  let newHuntId: string | undefined;

  try {
    // Correct function name from game-logic was renamed/refactored, need to adapt
    // For now, let's mock the structure needed for salt/hash generation
    // TODO: Review lib/game-logic.ts and adapt hunt creation if needed
    const huntBaseData = {
        treasurePosition: { 
            x: Math.floor(Math.random() * 10), // Placeholder generation
            y: Math.floor(Math.random() * 10)  // Placeholder generation
        },
        treasureType: ['COMMON', 'RARE', 'EPIC'][Math.floor(Math.random() * 3)]
    };
    // const huntBaseData = generateHuntData('temp', 'temp', creatorFid.toString()); // Old call

    if (!huntBaseData) {
        throw new Error("Failed to generate hunt base data.");
    }
    const treasureTypePrismaEnum = TreasureType[huntBaseData.treasureType as keyof typeof TreasureType];
    if (!treasureTypePrismaEnum) {
        throw new Error(`Invalid treasure type generated: ${huntBaseData.treasureType}`);
    }

    // --- Onchain Integration: Generate Salt & Hash ---
    // TODO: The salt MUST be saved to the database for the revealTreasure function to work.
    // Add a `salt` field (String @db.VarChar(66)) to the Hunt model in schema.prisma and run migration.
    salt = ethers.hexlify(ethers.randomBytes(32));
    treasureLocationHash = ethers.solidityPackedKeccak256(
        ["uint8", "uint8", "bytes32"],
        [huntBaseData.treasurePosition.x, huntBaseData.treasurePosition.y, salt]
    );
    console.log(`Generated Salt: ${salt}`); // Log for temporary debugging, remove later
    console.log(`Generated Hash: ${treasureLocationHash}`);
    // ---------------------------------------------

    const newHunt = await prisma.hunt.create({
      data: {
        name: `Hunt created by ${creatorFid}`,
        treasureType: treasureTypePrismaEnum,
        treasurePositionX: huntBaseData.treasurePosition.x,
        treasurePositionY: huntBaseData.treasurePosition.y,
        maxSteps: MAX_STEPS,
        state: HuntState.ACTIVE,
        creatorFid: creatorFid, // Store the FID of the user creating the hunt
        // TODO: Add migration for `creatorFid` field (`npx dotenv -e ../.env -- npx prisma migrate dev --name add_hunt_creator_fid`)
        // TODO: Add migration and uncomment `salt` storage (`npx dotenv -e ../.env -- npx prisma migrate dev --name add_hunt_salt`)
        salt: salt,
      },
    });

    newHuntId = newHunt.id;
    console.log(`Hunt created in DB with ID: ${newHunt.id}`);

    // --- Onchain Integration: Call Contract ---
    console.log(`Calling TreasureHuntManager.createHunt for DB Hunt ID: ${newHunt.id}...`);
    // Map treasure type string to uint8 for the contract
    let treasureTypeContractUint: number;
    switch (huntBaseData.treasureType) {
        case 'COMMON': treasureTypeContractUint = 0; break;
        case 'RARE':   treasureTypeContractUint = 1; break;
        case 'EPIC':   treasureTypeContractUint = 2; break;
        default: throw new Error(`Unknown treasure type for contract: ${huntBaseData.treasureType}`);
    }

    const tx = await treasureHuntManagerContract.createHunt(
        newHunt.id, // Use the DB Hunt ID
        treasureTypeContractUint, // Pass the mapped uint8
        MAX_STEPS,
        treasureLocationHash
    );

    console.log(`Transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait(); // Wait for transaction confirmation
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    // -----------------------------------------

    // --- Broadcast List Update --- 
    await broadcastHuntsListUpdate();
    // ---------------------------

    return { huntId: newHunt.id };

  } catch (error) {
    console.error("Error creating hunt:", error);
    // --- Onchain Integration: Error Handling --- 
    // If the contract call failed after DB creation, we might want to mark the DB entry as failed
    // or attempt to delete it. For now, just log and return error.
    if (newHuntId) {
        console.error(`Failed to complete onchain creation for DB Hunt ID: ${newHuntId}. DB entry might be orphaned.`);
        // Optional: await prisma.hunt.update({ where: { id: newHuntId }, data: { state: HuntState.FAILED } });
    }
    // -----------------------------------------
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
    // 1. Validate Lock (still important to ensure user had permission when initiating tx)
    const lock = await prisma.huntLock.findUnique({ where: { huntId } });
    // Find hunt details needed for validation/update
    const hunt = await prisma.hunt.findUnique({ 
        where: { id: huntId }, 
        select: { state: true, id: true } // Select only needed fields
    }); 

    if (!hunt) return { success: false, error: "Hunt not found." };
    // We check ACTIVE state here, but the contract is the source of truth after tx
    if (hunt.state !== HuntState.ACTIVE) return { success: false, error: "Hunt is already finished (according to DB)." }; 
    if (!lock) return { success: false, error: "You do not have the lock for this hunt." };
    if (lock.playerFid !== submitterFid) return { success: false, error: `Lock held by FID ${lock.playerFid}, not you (${submitterFid}).` };
    if (lock.expiresAt < new Date()) {
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
                        if (parsedLog.args && 
                            parsedLog.args.huntId === huntId && 
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
        const currentHunt = await tx.hunt.findUnique({ 
            where: { id: huntId },
            // Select fields needed AND the moves relation for previous position
            select: { 
                treasurePositionX: true, 
                treasurePositionY: true, 
                maxSteps: true,
                moves: { 
                    orderBy: { moveNumber: 'desc' }, // Get most recent first
                    take: 1 // Only need the very last one
                }
            } 
        });
        if (!currentHunt) {
            throw new Error("Failed to fetch current hunt data for processing.");
        }

        // Fetch latest onchain state post-transaction
        const onchainHuntDetails = await treasureHuntManagerContractProvider.getHuntDetails(huntId);
        const isOnchainActive = await treasureHuntManagerContractProvider.isHuntActive(huntId);

        if (!onchainHuntDetails) {
            throw new Error("Failed to fetch hunt details from contract after move.");
        }

        // Use event data if available and valid, otherwise fall back to contract state
        const finalX = moveDataFromEvent ? moveDataFromEvent.newX : Number(onchainHuntDetails.currentX);
        const finalY = moveDataFromEvent ? moveDataFromEvent.newY : Number(onchainHuntDetails.currentY);
        const finalMoveNumber = moveDataFromEvent ? moveDataFromEvent.moveNumber : Number(onchainHuntDetails.movesMade);

        // Determine previous position for hint generation (Fix #1)
        const previousMove = currentHunt.moves[0]; // Since we ordered desc and took 1
        const previousPosition: Position = previousMove 
            ? { x: previousMove.positionX, y: previousMove.positionY } 
            : START_POSITION; // Fallback for the very first move
        const currentPosition: Position = { x: finalX, y: finalY };
        const treasurePosition: Position = { x: currentHunt.treasurePositionX, y: currentHunt.treasurePositionY };

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
        const treasureFoundThisMove = finalX === currentHunt.treasurePositionX && finalY === currentHunt.treasurePositionY;

        if (treasureFoundThisMove) {
            finalDbState = HuntState.WON;
            console.log(`Treasure found on move ${finalMoveNumber}! State set to WON.`);
        } else if (!isOnchainActive) {
            // If treasure not found this move AND hunt is inactive onchain (likely max steps reached)
            finalDbState = HuntState.LOST;
            console.log(`Hunt inactive onchain and treasure not found. State set to LOST.`);
        } else if (finalMoveNumber >= currentHunt.maxSteps) {
            // Belt-and-suspenders check: if DB move number reaches max steps, mark as LOST
            // This handles cases where isOnchainActive might lag slightly or has different logic
             finalDbState = HuntState.LOST;
             console.log(`Max steps (${currentHunt.maxSteps}) reached. State set to LOST.`);
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

        // Update the Hunt record
        await tx.hunt.update({
            where: { id: huntId },
            data: {
                lastMoveUserId: submitterFid,
                state: finalDbState,
                endedAt: !isOnchainActive ? new Date() : null,
            },
        });
        console.log(`Updated Hunt record state to ${finalDbState}`);

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
                state: true,
                treasureType: true,
            },
        });

        if (!hunt) {
            return { success: false, error: "Hunt not found." };
        }

        if (hunt.state !== HuntState.WON && hunt.state !== HuntState.LOST) {
            return { success: false, error: "Hunt is not yet completed." };
        }

        // 2. Check Participation
        const participation = await prisma.move.findFirst({
            where: { huntId: huntId, userId: callerFid },
            select: { id: true },
        });

        if (!participation) {
            return { success: false, error: "You were not a participant in this hunt." };
        }

        // 3. Check if Already Minted Onchain
        try {
            const alreadyMinted = await huntMapNFTContractProvider.hasMinted(huntId, callerWalletAddress);
            if (alreadyMinted) {
                return { success: false, error: "You have already minted an NFT for this hunt." };
            }
        } catch (contractError) {
            console.error(`Error checking mint status for hunt ${huntId}, address ${callerWalletAddress}:`, contractError);
            return { success: false, error: "Could not verify mint status onchain." };
        }

        // 4. Fetch Data for OG Image
        // Fetch all moves for the path
        const moves = await prisma.move.findMany({
            where: { huntId: huntId },
            orderBy: { moveNumber: 'asc' },
            select: { positionX: true, positionY: true },
        });
        // Ensure start position is included if not explicitly stored as move 0
        const pathCoordinates = [
             START_POSITION, // Assuming START_POSITION is {x: 4, y: 4}
             ...moves.map(m => ({ x: m.positionX, y: m.positionY }))
        ];
        const pathString = pathCoordinates.map(p => `${p.x},${p.y}`).join(';');

        // Fetch distinct participant FIDs
        const distinctParticipants = await prisma.move.groupBy({
            by: ['userId'],
            where: { huntId: huntId },
            _count: {
                 userId: true, // Count is just to make groupBy work
            },
        });
        const playerFids = distinctParticipants.map(p => p.userId).join(',');

        // Determine outcome string
        const outcome = hunt.state === HuntState.WON ? 'WON' : 'LOST';

        // 5. Construct Vercel OG Image URL
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
             console.error("NEXT_PUBLIC_APP_URL environment variable is not set.");
             return { success: false, error: "Server configuration error: App URL not set." };
        }

        const ogUrlParams = new URLSearchParams({
            huntId: hunt.id,
            outcome: outcome,
            treasure: hunt.treasureType,
            path: pathString,
            players: playerFids,
        });

        const tokenUri = `${appUrl}/api/og/hunt?${ogUrlParams.toString()}`;
        console.log(`Generated tokenUri for hunt ${huntId}: ${tokenUri}`);

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
    huntId: string,
    callerFid: number
): Promise<RevealResult> {
    console.log(`revealHuntTreasure called for hunt ${huntId} by FID ${callerFid}`);

    try {
        // 1. Fetch Hunt Data
        // Select fields needed for the contract call and creator check
        const hunt = await prisma.hunt.findUnique({
            where: { id: huntId },
            select: {
                id: true,
                treasurePositionX: true,
                treasurePositionY: true,
                // Salt is now directly selected
                salt: true,
                // creatorFid is now directly selected
                creatorFid: true,
            },
        });

        if (!hunt) {
            return { success: false, error: "Hunt not found." };
        }

        // 2. Authorize Caller
        // Check participation
        const participation = await prisma.move.findFirst({
            where: {
                huntId: huntId,
                userId: callerFid,
            },
            select: { id: true }, // Only need to know if one exists
        });
        const isParticipant = !!participation;

        // Check creator status (Fix #2 - Type error fix)
        const creatorFidFromDb: number | null | undefined = hunt.creatorFid;
        const isCreator = creatorFidFromDb ? creatorFidFromDb === callerFid : false;

        if (!isParticipant && !isCreator) {
            return { success: false, error: "Not authorized to reveal treasure for this hunt." };
        }
        
        // Optional: Check if hunt is already revealed onchain? 
        // ... (code omitted for brevity) ...

        // 3. Call Contract
        console.log(`Calling TreasureHuntManager.revealTreasure for hunt ${huntId}...`);
        const tx = await treasureHuntManagerContract.revealTreasure(
            hunt.id,
            hunt.treasurePositionX,
            hunt.treasurePositionY,
            hunt.salt // Use the retrieved salt (currently placeholder or actual if migration done)
        );

        console.log(`Reveal transaction submitted: ${tx.hash}`);

        // 4. Wait & Confirm
        const receipt = await tx.wait(1); // Wait for 1 confirmation

        if (!receipt || receipt.status !== 1) {
             console.error(`Reveal transaction failed or receipt not found: ${tx.hash}`, receipt);
             return { success: false, error: "Onchain transaction failed during reveal.", transactionHash: tx.hash };
        }

        console.log(`Reveal transaction confirmed: ${tx.hash} in block ${receipt.blockNumber}`);

        return { success: true, transactionHash: tx.hash };

    } catch (error) {
        console.error(`Error revealing treasure for hunt ${huntId} by FID ${callerFid}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "An unknown error occurred revealing treasure." };
    }
} 