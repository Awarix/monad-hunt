'use client'; 

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFarcaster } from "@/components/providers/FarcasterProvider";
import { listHunts, createHunt, ListedHunt } from '@/app/actions/hunt'; 
import type { HuntsListUpdatePayload } from '@/types';
import {  TreasureType } from '@prisma/client'; 

const headerGlowStyle = {
    textShadow: `0 0 8px var(--color-text-header), 0 0 12px rgba(62, 206, 206, 0.6)`,
};
const redGlowStyle = {
    textShadow: `0 0 4px #FF4444, 0 0 6px rgba(255, 68, 68, 0.6)`,
};

// --- Helper Function for Rarity Styles ---
const getRarityStyles = (treasureType: TreasureType): { 
  textClass: string; 
  glowStyle?: React.CSSProperties; 
  buttonBorderStyle: string; 
  buttonHoverBg?: string; 
  buttonFocusRing: string;
} => {
  switch (treasureType) {
    case TreasureType.RARE:
      return { 
        textClass: 'text-sky-400',
        glowStyle: { textShadow: '0 0 8px #38BDF8' },
        buttonBorderStyle: 'border-sky-400', 
        buttonHoverBg: 'hover:bg-sky-700/30', 
        buttonFocusRing: 'focus:ring-sky-400'
      };
    case TreasureType.EPIC:
      return { 
        textClass: 'text-fuchsia-500',
        glowStyle: { textShadow: '0 0 10px #D946EF' },
        buttonBorderStyle: 'border-fuchsia-500', 
        buttonHoverBg: 'hover:bg-fuchsia-700/30', 
        buttonFocusRing: 'focus:ring-fuchsia-500' 
      };
    case TreasureType.COMMON:
    default:
      return { 
        textClass: 'text-gray-300',
        glowStyle: undefined,
        buttonBorderStyle: 'border-gray-400', 
        buttonHoverBg: 'hover:bg-gray-700/30', 
        buttonFocusRing: 'focus:ring-gray-400'
      }; 
  }
};

// --- Style Constants ---

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

  // --- Tailwind Style Constants (Based on STYLES.md and reference) --- 
  const cardBaseStyle = "rounded-lg bg-black/30 border border-purple-800/50 shadow-2xl shadow-purple-500/20 backdrop-blur-md p-4 flex flex-col justify-between hover:border-purple-600/80 transition-colors duration-200"; // Updated card style
  
  // Updated Button style based on STYLES.md (similar to IconButton/FooterButton principles)
  const createButtonStyle = `
    px-5 py-2.5 rounded-lg border border-[var(--color-highlight)] 
    bg-purple-800/60 hover:bg-purple-700/80 
    text-white font-semibold text-sm 
    backdrop-blur-sm shadow-md 
    transition-all duration-200 ease-in-out 
    focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-800/60 disabled:shadow-none disabled:border-purple-800/50
  `;

  // Updated Join/View Button style (using Accent color)
  const joinViewButtonStyle = `
    px-4 py-2 rounded-lg border border-[var(--color-accent)] 
    bg-cyan-700/40 hover:bg-cyan-600/60 
    text-cyan-100 font-semibold text-xs 
    backdrop-blur-sm shadow-md shadow-cyan-500/30 
    transition-all duration-200 ease-in-out 
    focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-opacity-75
  `;
  const disabledJoinViewButtonStyle = `
    px-4 py-2 rounded-lg border border-gray-600 
    bg-gray-800/40 
    text-gray-500 font-semibold text-xs 
    opacity-60 cursor-not-allowed backdrop-blur-sm shadow-none
  `;

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
      <div className="flex items-center justify-center min-h-screen p-4 text-center text-[var(--color-text-body)]">
        <p className={farcasterError ? "text-red-400" : "opacity-80"} style={farcasterError ? redGlowStyle : {}}>
            {farcasterError ? `Farcaster Error: ${farcasterError}` : "Loading Farcaster Context..."}
        </p>
      </div>
    );
  }

  return (
    // Main page container - remove max-w, adjust padding
    <div className="container mx-auto p-4 sm:p-6 md:p-8"> 
      <h1 
        className="text-3xl sm:text-4xl font-bold mb-8 text-center text-[var(--color-text-header)] uppercase tracking-widest" // Add uppercase/tracking
        style={headerGlowStyle}
      >
          Active Hunts
      </h1>

      {/* Create Button Area */}
      <div className="mb-10 text-center">
        <button 
          onClick={handleCreateHunt}
          disabled={isCreating || !frameContext?.user?.fid}
          className={createButtonStyle} // Apply updated style
        >
          {isCreating ? "Creating..." : "Create New Hunt"}
        </button>
        {!frameContext?.user?.fid && 
            <p className="text-sm text-red-400 mt-3" style={redGlowStyle}>
                Connect with Farcaster to create a hunt.
            </p>}
      </div>

      {/* Loading/Error Messages Area: Apply consistent styling */} 
      {isLoading && 
        <p className="text-center text-[var(--color-text-body)] opacity-70 mb-6 animate-pulse">
            Loading hunts...
        </p>
      }
      {error && 
        <p className="text-red-300 text-center mb-6 p-3 rounded-lg bg-red-900/40 border border-red-700/60 backdrop-blur-sm text-sm" style={redGlowStyle}>
            Error: {error}
        </p>
      }
      {sseError && 
        <p className="text-yellow-300 bg-yellow-900/40 border border-yellow-700/60 backdrop-blur-sm p-3 rounded-lg text-center text-sm mb-6">
            Warning: {sseError}
        </p>
      }

      {/* Hunts List */} 
      {!isLoading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {hunts.length > 0 ? (
            hunts.map((hunt) => {
              const isLockActive = hunt.lock && new Date(hunt.lock.expiresAt) > new Date();
              const rarityStyles = getRarityStyles(hunt.treasureType);

              return (
                <div key={hunt.id} className={cardBaseStyle}> {/* Apply updated card style */} 
                  <div className="mb-4"> {/* Content wrapper - added margin bottom */} 
                    <h2 
                        className="text-xl font-semibold mb-3 text-[var(--color-text-header)] truncate uppercase tracking-wider" // Add uppercase/tracking
                        style={headerGlowStyle}
                    >
                        {hunt.name || `Hunt ${hunt.id.substring(0, 6)}`}
                    </h2>
                    <p className="text-sm text-gray-300 mb-1"> {/* Lighter text for labels */}
                        Treasure: <span className={rarityStyles.textClass}>{hunt.treasureType.toLowerCase()}</span>
                    </p>
                    <p className="text-sm text-gray-300 mb-2"> {/* Lighter text for labels */}
                        Moves Made: <span className="font-medium text-white">{hunt.moveCount}</span>
                    </p>
                    {/* Status Text: Refined styles */} 
                    {isLockActive ? (
                      <p className="text-yellow-400 text-xs mt-2 opacity-90">
                        Locked by FID {hunt.lock?.playerFid}
                      </p>
                    ) : (
                      <p className="text-green-400 text-xs mt-2" style={redGlowStyle}>
                        Ready to Join
                      </p>
                    )}
                  </div>

                  <Link href={`/hunt/${hunt.id}`}
                    className={`mt-auto text-center ${isLockActive ? disabledJoinViewButtonStyle : joinViewButtonStyle}`} // Apply updated styles & mt-auto
                    aria-disabled={isLockActive ? "true" : undefined}
                    onClick={(e) => { if (isLockActive) e.preventDefault(); }} // Prevent click if disabled
                  >
                    {isLockActive ? "Locked" : "View / Join"}
                  </Link>
                </div>
              );
            })
          ) : (
            <p className="col-span-full text-center text-[var(--color-text-body)] opacity-60 mt-6">
                No active hunts found. Why not create one?
            </p>
          )}
        </div>
      )}
    </div>
  );
} 