'use client'; // This component uses context, so it must be a client component

import React from 'react';
import { WagmiProvider } from 'wagmi';
import { config } from '@/lib/wagmi'; // Import the config we just created

// Required for React 19 and Wagmi compatibility
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; 

// Create a react-query client
const queryClient = new QueryClient(); 

// Renamed from Providers
export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}> 
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
} 