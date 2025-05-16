"server only";

import { PinataSDK } from "pinata";

const pinataJwt = process.env.PINATA_JWT;
const pinataGatewayUrl = process.env.PINATA_GATEWAY_URL || process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL;

if (!pinataJwt) {
  throw new Error("PINATA_JWT environment variable is not set. Cannot initialize Pinata SDK.");
}

if (!pinataGatewayUrl) {
  console.warn(
    "PINATA_GATEWAY_URL or NEXT_PUBLIC_PINATA_GATEWAY_URL environment variable is not set. " +
    "IPFS URLs in NFT metadata might be incomplete or use a default Pinata gateway."
  );
}

export const pinata = new PinataSDK({
  pinataJwt: pinataJwt,
  pinataGateway: pinataGatewayUrl || undefined, // Use undefined if not set, SDK might default
});

export const PINATA_GATEWAY_URL = pinataGatewayUrl;

// Helper function to construct full IPFS URLs
// Can accept string, null, or undefined for cid.
// Returns string if cid is a valid string, otherwise undefined.
export function getIpfsUrl(cid: string | null | undefined): string | undefined {
  if (!cid) return undefined;
  
  if (PINATA_GATEWAY_URL) {
    // Ensure no double slashes if PINATA_GATEWAY_URL ends with one and /ipfs/ starts with one
    const gatewayBase = PINATA_GATEWAY_URL.endsWith('/') ? PINATA_GATEWAY_URL.slice(0, -1) : PINATA_GATEWAY_URL;
    return `${gatewayBase}/ipfs/${cid}`;
  }
  // Fallback if no custom gateway is set.
  // For maximum compatibility, prefer ipfs:// scheme if no gateway is configured.
  return `ipfs://${cid}`; 
} 