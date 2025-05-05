import { http, createConfig } from 'wagmi'
import { farcasterFrame } from '@farcaster/frame-wagmi-connector'
import { monadTestnet } from '@/lib/chains' // Import our custom chain definition

// Get RPC URL from environment variable for transport
const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';

if (!rpcUrl) {
    console.warn('NEXT_PUBLIC_MONAD_RPC_URL is not set, using default Monad Testnet RPC.')
    // Optionally throw error if RPC URL is strictly required
    // throw new Error('NEXT_PUBLIC_MONAD_RPC_URL environment variable is not set.');
}

export const config = createConfig({
  chains: [monadTestnet], // Use our custom chain
  connectors: [
    farcasterFrame(), // Initialize the Farcaster connector
  ],
  transports: {
    // Define transport for our custom chain ID
    [monadTestnet.id]: http(rpcUrl), 
  },
  ssr: true, // Enable SSR support if needed (good practice for Next.js)
}) 