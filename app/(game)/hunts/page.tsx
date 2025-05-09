'use client'; 

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFarcaster } from "@/components/providers/FarcasterProvider";
import { listHunts, createHunt, ListedHunt } from '@/app/actions/hunt'; 
import type { HuntsListUpdatePayload } from '@/types';
import { TreasureType, HuntState } from '@prisma/client';
import { MAX_STEPS } from '@/lib/constants';

// Remove old glow styles
// const headerGlowStyle = { ... };
// const redGlowStyle = { ... };

// --- Helper Function for Rarity Styles (adjust for new theme if needed, or simplify) ---
const getRarityStyles = (treasureType: TreasureType): { 
  textClass: string; 
  // glowStyle?: React.CSSProperties; // Remove glow
  // buttonBorderStyle: string; 
  // buttonHoverBg?: string; 
  // buttonFocusRing: string;
} => {
  switch (treasureType) {
    case TreasureType.RARE:
      return { 
        textClass: 'text-blue-600 font-semibold', // Example: Keep color distinction, remove glow
      };
    case TreasureType.EPIC:
      return { 
        textClass: 'text-purple-600 font-semibold',
      }; 
    case TreasureType.COMMON:
    default:
      return { 
        textClass: 'text-[var(--theme-text-secondary)]',
      }; 
  }
};

// --- Style Constants (Removed old ones) ---

// Updated Card Style based on STYLES.md
// const glassCardStyle = `
//   rounded-lg bg-white/5 backdrop-blur-md 
//   border border-purple-700/50 
//   shadow-lg shadow-purple-500/20 
//   p-5 flex flex-col justify-between 
// `;

// Updated Title Style
// const cardTitleStyle = "text-lg font-bold uppercase text-white mb-3 truncate tracking-wide"; 
// const cardTitleGlow = { textShadow: '0 0 6px rgba(255, 255, 255, 0.4)' }; 

// // Detail Row Styles
// const cardDetailRowStyle = "flex justify-between items-center text-sm mb-4";
// const cardDetailItemStyle = "text-gray-300";
// // Updated Status Style
// const statusReadyStyle = "text-green-500 font-medium";

// // Updated Button Style (Large Pill) - Kept as is for now
// const ctaButtonStyle = `
//   px-8 py-2.5 rounded-full border-2 font-medium text-white text-center w-full
//   transition-all duration-200 ease-in-out transform hover:scale-[1.03] 
//   focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50
// `; 
// const disabledCtaButtonStyle = `
//   opacity-50 cursor-not-allowed border-gray-600 text-gray-500
// `;

export default function HuntsListPage() {
  const [hunts, setHunts] = useState<ListedHunt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [sseError, setSseError] = useState<string | null>(null);

  const { isLoaded: isFarcasterLoaded, frameContext, error: farcasterError } = useFarcaster();
  const router = useRouter();

  // --- New Theme Style Constants --- 
  const pageContainerStyle = "bg-[var(--theme-card-bg)] rounded-2xl shadow-xl p-6 md:p-8 border-4 border-[var(--theme-border-color)] max-w-4xl mx-auto my-8";
  const cardBaseStyle = "bg-[var(--theme-secondary-card-bg)] rounded-xl p-4 border-4 border-[var(--theme-border-color)] flex flex-col sm:flex-row items-center justify-between gap-4";
  
  const primaryButtonStyle = `font-bold py-2.5 px-6 rounded-full border-4 border-[var(--theme-border-color)] text-[var(--theme-button-primary-text)] bg-[var(--theme-button-primary-bg)] hover:scale-105 transition-transform shadow-sm disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100`;
  const secondaryButtonStyle = `font-bold py-2 px-4 rounded-full border-4 border-[var(--theme-border-color)] text-[var(--theme-button-secondary-text)] bg-[var(--theme-button-secondary-bg)] hover:scale-105 transition-transform shadow-sm text-sm disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100`;
  const linkStyle = "text-teal-600 hover:text-teal-700 font-semibold transition-colors duration-200";

  // --- Data Fetching --- 
  const loadHunts = useCallback(async () => {
    console.log("Attempting to fetch hunts list...");
    try {
      const fetchedHunts = await listHunts();
      setHunts(fetchedHunts);
      setError(null); 
    } catch (err) {
      console.error("Failed to fetch hunts:", err);
      setError(err instanceof Error ? err.message : "Failed to load hunts.");
    } finally {
      if (isLoading) setIsLoading(false);
    }
  }, [isLoading]); 

  // Initial load and Farcaster check
  useEffect(() => {
    if (isFarcasterLoaded) {
      loadHunts();
    }
  }, [isFarcasterLoaded, loadHunts]);

  // --- SSE Connection for List Updates --- 
  useEffect(() => {
    console.log("SSE List: Setting up EventSource...");
    setSseError(null);
    const eventSource = new EventSource('/api/hunt-updates/list');

    eventSource.onopen = () => {
        console.log("SSE List: Connection opened.");
        setSseError(null);
    };

    eventSource.onerror = (error) => {
        console.error('SSE List: Error', error);
        setSseError("Real-time connection error for list updates.");
    };

    eventSource.addEventListener('message', (event: MessageEvent) => {
        console.log('SSE List: Update message received', event.data);
        try {
          // Parse and optionally validate the incoming notification
          const parsedData = JSON.parse(event.data);
          if (parsedData && typeof parsedData === 'object' && parsedData.type === 'list_update') {
            // Basic validation passed
            const payload = parsedData as HuntsListUpdatePayload;
            console.log('SSE List: Received valid list update notification, timestamp:', payload.timestamp);
            // Re-fetch the entire list on any valid update message
            loadHunts();
          } else {
            console.warn("SSE List: Received message does not match expected structure. Re-fetching anyway.", parsedData);
            // Still re-fetch even if payload is unexpected, just in case
            loadHunts();
          }
        } catch (err) {
            console.error("SSE List: Failed to parse message data. Re-fetching anyway.", err);
             // Still re-fetch on parse error
            loadHunts();
        }
    });

    eventSource.addEventListener('open', (event: MessageEvent) => {
        console.log('SSE List: Server confirmation:', event.data);
    });

    return () => {
        console.log("SSE List: Closing connection.");
        eventSource.close();
    };
  }, [loadHunts]); // Depend on the stable loadHunts callback


  // --- Create Hunt Handler --- 
  const handleCreateHunt = async () => {
    if (!frameContext?.user?.fid) {
      setError("Farcaster user not identified. Cannot create hunt.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const result = await createHunt(frameContext.user.fid);
      if ('huntId' in result) {
        console.log(`Hunt created successfully: ${result.huntId}`);
        // Navigate to the new hunt page
        router.push(`/hunt/${result.huntId}`);
      } else {
        throw new Error(result.error || "Failed to create hunt.");
      }
    } catch (err) {
      console.error("Error creating hunt:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Farcaster loading/error state
  if (!isFarcasterLoaded || farcasterError) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 text-center text-[var(--theme-text-primary)]">
        <p className={farcasterError ? "text-red-600 font-semibold" : "opacity-80"}>
            {farcasterError ? `Farcaster Error: ${farcasterError}` : "Loading Farcaster Context..."}
        </p>
      </div>
    );
  }

  return (
    <div className={pageContainerStyle}> 
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8 gap-4">
        <h1 
          className="text-3xl sm:text-4xl font-bold text-[var(--theme-text-primary)] uppercase tracking-wider text-center sm:text-left"
          // style={headerGlowStyle} // Removed glow
        >
          Active Hunts
        </h1>
        <div className="flex items-center space-x-4">
            <Link href="/history" className={linkStyle}>
                My Hunt History
            </Link>
            <button 
              onClick={handleCreateHunt}
              disabled={isCreating || !frameContext?.user?.fid}
              className={`${primaryButtonStyle}`}
            >
              {isCreating ? "Creating..." : "Create New Hunt"}
            </button>
        </div>
      </div>

      {isLoading && <p className="text-center text-[var(--theme-text-secondary)] py-8">Loading hunts...</p>}
      {error && <p className="text-center text-red-600 font-semibold py-8">Error: {error}</p>}
      {sseError && <p className="text-center text-orange-600 font-semibold py-4">Notice: {sseError}</p>}

      {!isLoading && !error && hunts.length === 0 && (
        <p className="text-center text-[var(--theme-text-secondary)] py-8">No active hunts available. Why not create one?</p>
      )}

      {!isLoading && !error && hunts.length > 0 && (
        <div className="space-y-6">
          {hunts.map(hunt => {
            const rarityStyle = getRarityStyles(hunt.treasureType);
            const canJoin = hunt.state === HuntState.ACTIVE && (!hunt.lock || new Date(hunt.lock.expiresAt) < new Date());
            const isLockedByOther = hunt.lock && new Date(hunt.lock.expiresAt) >= new Date();

            return (
              <div key={hunt.id} className={cardBaseStyle}>
                <div className="flex-grow">
                  <h2 className="text-xl font-bold text-[var(--theme-text-primary)] uppercase truncate">
                    {hunt.name || `Hunt ${hunt.id.substring(0,6)}...`}
                  </h2>
                  <p className={`text-sm ${rarityStyle.textClass} mb-1`}>
                    Treasure: {hunt.treasureType}
                  </p>
                  <p className="text-xs text-[var(--theme-text-secondary)]">
                    <span className="font-semibold">Moves: {hunt.moveCount} / {MAX_STEPS}</span>
                    {isLockedByOther && hunt.lock && (
                        <span className="ml-2 text-orange-600 font-semibold">Status: Locked by FID {hunt.lock.playerFid}</span>
                    )}
                    {!isLockedByOther && hunt.lock && (
                        <span className="ml-2 text-green-600 font-semibold">Status: Lock Expired - Ready</span>
                    )}
                    {canJoin && (
                        <span className="ml-2 text-green-600 font-semibold">Status: Ready to Join</span>
                    )}
                  </p>
                </div>
                <div className="flex-shrink-0 mt-3 sm:mt-0">
                  <Link href={`/hunt/${hunt.id}`}>
                    <button 
                        className={`${secondaryButtonStyle}`}
                        disabled={!canJoin && !isLockedByOther} // Simplification, actual join logic on hunt page
                    >
                        {canJoin ? 'Join Hunt' : isLockedByOther ? 'View Locked' : 'View Details'}
                    </button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 