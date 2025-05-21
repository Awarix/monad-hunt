'use client';

import Link from 'next/link';
import Image from 'next/image';
import React, { useState } from 'react';
import HowToPlayModal from '@/components/game/HowToPlayModal';

export default function HomePage() {
  const [isHowToPlayModalOpen, setIsHowToPlayModalOpen] = useState(false);


  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Image 
        src="/logo.jpg" 
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
      <p className="text-lg md:text-xl text-[var(--theme-text-primary)] mb-10 text-center max-w-xl">
        Im still working on this. But I appreciate that you are here, my dear alfa tester :P
      </p>
      <p className="text-lg md:text-xl text-[var(--theme-text-primary)] mb-10 text-center max-w-xl">
        If you have any feedback, please dm me @frontend. 
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
      <button
        type="button"
        onClick={() => setIsHowToPlayModalOpen(true)}
        className="mt-6 px-8 py-3 bg-[var(--theme-button-primary-bg)] text-[var(--theme-button-primary-text)] font-bold rounded-full border-4 border-[var(--theme-border-color)] hover:scale-105 transition-transform shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--theme-button-primary-bg)]"
      >
        How to Play
      </button>

      {/* Render the modal component */}
      <HowToPlayModal 
        isOpen={isHowToPlayModalOpen} 
        onClose={() => setIsHowToPlayModalOpen(false)} 
      />

    </div>
  );
}
