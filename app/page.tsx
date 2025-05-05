'use client'; // Still need client component for Link/Image?

import Link from 'next/link';
import Image from 'next/image';
// Removed useEffect, useRouter, useAccount, ConnectWalletButton

export default function HomePage() {
  // Removed router and account hooks
  // Removed useEffect for redirection

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
      <Image 
        src="/logo200.png" 
        alt="Treasure Hunt Logo"
        width={150}
        height={150}
        className="mb-8 rounded-full shadow-lg shadow-blue-500/30"
      />
      <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center font-mono">Welcome to Treasure Hunt!</h1>
      <p className="text-lg md:text-xl text-gray-300 mb-10 text-center max-w-xl">
        Join collaborative hunts on Monad Testnet. Make moves, follow hints, and mint your map NFT.
      </p>

      {/* Button to navigate to the hunts list */}
      <Link href="/hunts">
        <button
          type="button"
          className="mt-6 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          View Active Hunts
        </button>
      </Link>
    </div>
  );
}
