'use client'; // Still need client component for Link/Image?

import Link from 'next/link';
import Image from 'next/image';
// Removed useEffect, useRouter, useAccount, ConnectWalletButton

// Define TreasureType if not already globally available or imported
type TreasureType = 'common' | 'rare' | 'epic';

interface OgImageData {
  huntId: string;
  treasureType: TreasureType;
  moves: number;
  maxMoves: number;
  adventurers: string; // Comma-separated
  found: boolean;
  path: string; // Semicolon-separated coordinates, e.g., "0,0;1,0;1,1"
  treasureX: number;
  treasureY: number;
}

const MOCK_OG_DATA: OgImageData = {
  huntId: 'og-test-123',
  treasureType: 'epic',
  moves: 7,
  maxMoves: 10,
  adventurers: 'Gandalf,Frodo,Samwise',
  found: true,
  path: '4,4;4,5;5,5;5,6;6,6;6,7;7,7', // Example path starting near center
  treasureX: 7,
  treasureY: 7,
};

export default function HomePage() {
  // Removed router and account hooks
  // Removed useEffect for redirection

  const handleTestOgImage = () => {
    const params = new URLSearchParams();
    Object.entries(MOCK_OG_DATA).forEach(([key, value]) => {
      params.append(key, String(value));
    });
    window.open(`/api/og/hunt?${params.toString()}`, '_blank');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Image 
        src="/logo200.png" 
        alt="Treasure Hunt Logo"
        width={150}
        height={150}
        className="mb-8 rounded-full shadow-lg shadow-black/30"
      />
      <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center font-mono text-[var(--theme-text-primary)]">
        Welcome to Treasure Hunt!
      </h1>
      <p className="text-lg md:text-xl text-[var(--theme-text-secondary)] mb-10 text-center max-w-xl">
        Join collaborative hunts on Monad Testnet. Make moves, follow hints, and mint your map NFT.
      </p>

      {/* Button to navigate to the hunts list */}
      <Link href="/hunts">
        <button
          type="button"
          className="mt-6 px-8 py-3 bg-[var(--theme-button-primary-bg)] text-[var(--theme-button-primary-text)] font-bold rounded-full border-4 border-[var(--theme-border-color)] hover:scale-105 transition-transform shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--theme-button-primary-bg)]"
        >
          View Active Hunts
        </button>
      </Link>

      {/* Test OG Image Button */}
      <button
        type="button"
        onClick={handleTestOgImage}
        className="mt-6 px-8 py-3 bg-teal-500 text-white font-bold rounded-full border-4 border-black hover:bg-teal-600 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
      >
        Test OG Image
      </button>
    </div>
  );
}
