import { Redis } from '@upstash/redis';
import type { HuntChannelPayload, HuntsListUpdatePayload } from '@/types';
import { HuntState } from '@prisma/client'; // Added for type checking in sanitize
import type { HuntDetails } from '@/app/actions/hunt'; // Import HuntDetails type

// Simple in-memory broadcaster
// WARNING: Not suitable for production on serverless environments due to 
// separate memory spaces for different function invocations.
// Consider Redis Pub/Sub or similar for production.

// const emitter = new EventEmitter();

// Increase max listeners if needed, though ideally listeners should be cleaned up properly
// emitter.setMaxListeners(50); 

// --- Helper function to sanitize hunt details for client responses (copied from hunt.ts) ---
// Ideally, this would be in a shared lib/utils, but for now, co-locating for simplicity.
// IMPORTANT: Keep this synchronized with the version in hunt.ts or move to a shared location.
function sanitizeHuntDetailsForClient(details: HuntDetails | null): Partial<HuntDetails> | null {
  if (!details) return null;

  // If the hunt is active, pending, or failed, hide treasure position and salt
  if (details.state === HuntState.ACTIVE ||
      details.state === HuntState.PENDING_CREATION ||
      details.state === HuntState.FAILED_CREATION) {
    const { treasurePositionX, treasurePositionY, salt, ...rest } = details;
    return rest;
  }
  // For completed hunts (WON, LOST), all details can be returned (excluding salt for now)
  const { salt, ...safeDetails } = details;
  return safeDetails;
}
// --- End of copied sanitizeHuntDetailsForClient ---

// --- Upstash Redis Client Initialization ---

// Ensure environment variables are set
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error("Missing Upstash Redis environment variables (UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN)");
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// --- Redis-based Broadcasting Functions ---

/**
 * Broadcasts an update for a specific hunt via Redis Pub/Sub.
 * @param huntId The ID of the hunt to update.
 * @param data The data payload to send (will be JSON stringified).
 */
export const broadcastHuntUpdate = async (huntId: string, data: HuntChannelPayload) => {
  const channel = `hunt:${huntId}`; // Use Redis channel naming convention

  // Sanitize hunt details if the payload is a 'hunt_update'
  let processedData = data;
  if (data.type === 'hunt_update' && data.details) {
    const sanitizedDetails = sanitizeHuntDetailsForClient(data.details as HuntDetails); // Cast to HuntDetails
    processedData = { ...data, details: sanitizedDetails };
    console.log(`Sanitized hunt_update details for channel '${channel}'`);
  }

  const message = JSON.stringify(processedData);
  try {
    console.log(`Broadcasting to Redis channel '${channel}'`, message);
    await redis.publish(channel, message);
  } catch (error) {
    console.error(`Error publishing hunt update to Redis channel '${channel}':`, error);
    // Decide if re-throwing is necessary or just log
  }
};

// export const subscribeToHuntUpdates = (huntId: string, listener: (data: any) => void) => {
//   const eventName = `hunt-${huntId}`;
//   console.log(`Listener subscribing to event '${eventName}'`);
//   emitter.on(eventName, listener);
// };

// export const unsubscribeFromHuntUpdates = (huntId: string, listener: (data: any) => void) => {
//   const eventName = `hunt-${huntId}`;
//   console.log(`Listener unsubscribing from event '${eventName}'`);
//   emitter.off(eventName, listener);
// }; 

// --- Hunts List Broadcaster --- 

const HUNTS_LIST_CHANNEL = 'hunts_list'; // Redis channel name

// Simple broadcast, just notifies that something changed
/**
 * Broadcasts a general update notification for the hunts list via Redis Pub/Sub.
 */
export const broadcastHuntsListUpdate = async () => {
  // Construct the typed payload
  const payload: HuntsListUpdatePayload = { 
    type: 'list_update',
    timestamp: Date.now() 
  };
  const message = JSON.stringify(payload);
  try {
    console.log(`Broadcasting to Redis channel '${HUNTS_LIST_CHANNEL}'`, message);
    await redis.publish(HUNTS_LIST_CHANNEL, message);
  } catch (error) {
    console.error(`Error publishing list update to Redis channel '${HUNTS_LIST_CHANNEL}':`, error);
     // Decide if re-throwing is necessary or just log
  }
};

// export const subscribeToHuntsListUpdates = (listener: (data: any) => void) => {
//   console.log(`Listener subscribing to event '${HUNTS_LIST_EVENT}'`);
//   emitter.on(HUNTS_LIST_EVENT, listener);
// };

// export const unsubscribeFromHuntsListUpdates = (listener: (data: any) => void) => {
//   console.log(`Listener unsubscribing from event '${HUNTS_LIST_EVENT}'`);
//   emitter.off(HUNTS_LIST_EVENT, listener);
// }; 