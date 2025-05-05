/**
 * Shortens an Ethereum address for display.
 * e.g., 0x1234567890abcdef... -> 0x1234...cdef
 */
export function shortenAddress(address: string | `0x${string}` | undefined, chars = 4): string {
  if (!address) return "";
  if (address.length < chars * 2 + 2) { // Ensure address is long enough
    return address; 
  }
  const prefix = address.substring(0, chars + 2); // Include "0x"
  const suffix = address.substring(address.length - chars);
  return `${prefix}...${suffix}`;
} 