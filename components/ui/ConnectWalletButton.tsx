'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { shortenAddress } from '@/lib/utils'; // Assuming a utility function exists

export function ConnectWalletButton() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Get the Farcaster connector specifically
  // Ensure '@farcaster/frame-wagmi-connector' exports `farcasterFrame` connector instance
  // const farcasterConnector = connectors.find(c => c.id === 'farcasterFrame'); // Adjust ID if necessary
  // For simplicity, we assume the first connector is the Farcaster one as configured
  const connector = connectors[0]; 

  if (isConnected) {
    return (
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-400">{shortenAddress(address)}</span>
        <button 
          onClick={() => disconnect()} 
          className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={isConnecting || !connector}
      onClick={() => connect({ connector })}
      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}

// --- Helper Function (add to lib/utils.ts if not existing) ---
/*
export function shortenAddress(address: string | undefined, chars = 4): string {
  if (!address) return "";
  const prefix = address.substring(0, chars + 2); // Include "0x"
  const suffix = address.substring(address.length - chars);
  return `${prefix}...${suffix}`;
}
*/ 