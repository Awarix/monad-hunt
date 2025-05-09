'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useFarcaster } from "@/components/providers/FarcasterProvider";
import { useAccount, useReadContract } from 'wagmi'; // Import Wagmi hooks
import HuntMapNFTABI from '@/lib/abi/HuntMapNFTABI.json'; // ABI for the NFT contract
import { admin_deleteAllHunts, getUserHuntHistory, UserHuntHistoryEntry } from '@/app/actions/hunt'; 
import { HuntState, TreasureType } from '@prisma/client'; 

// Helper function for Rarity Styles (copied from hunts/page.tsx - consider refactoring)
const getRarityStyles = (treasureType: TreasureType): { textClass: string; glowStyle?: React.CSSProperties } => {
  switch (treasureType) {
    case TreasureType.RARE: return { textClass: 'text-sky-400', glowStyle: { textShadow: '0 0 8px #38BDF8' } };
    case TreasureType.EPIC: return { textClass: 'text-fuchsia-500', glowStyle: { textShadow: '0 0 10px #D946EF' } };
    case TreasureType.COMMON: default: return { textClass: 'text-gray-300', glowStyle: undefined }; 
  }
};

// Component to render mint status for a single hunt
const MintStatus: React.FC<{ hunt: UserHuntHistoryEntry; connectedAddress?: `0x${string}` }> = ({ hunt, connectedAddress }) => {
    const nftContractAddress = process.env.NEXT_PUBLIC_HUNT_MAP_NFT_ADDRESS as `0x${string}` | undefined;
    const isEnded = hunt.state === HuntState.WON || hunt.state === HuntState.LOST;

    // Derive numeric ID safely
    const numericOnchainHuntId = useMemo(() => {
        if (hunt.onchainHuntId) {
            try { return BigInt(hunt.onchainHuntId); } catch { return null; }
        }
        return null;
    }, [hunt.onchainHuntId]);

    const { data: hasMinted, isLoading, error } = useReadContract({
        address: nftContractAddress,
        abi: HuntMapNFTABI.abi,
        functionName: 'hasMinted',
        args: numericOnchainHuntId && connectedAddress ? [numericOnchainHuntId, connectedAddress] : undefined,
        query: {
            enabled: !!nftContractAddress && !!numericOnchainHuntId && !!connectedAddress && isEnded,
            staleTime: 300_000, // Cache for 5 minutes
        },
    });

    if (!isEnded) return null; // Don't show status for active hunts
    if (isLoading) return <span className="text-xs text-yellow-400 italic">Checking...</span>;
    if (error) return <span className="text-xs text-red-400 italic">Error</span>;
    if (hasMinted === true) return <span className="text-xs text-green-400">NFT Minted</span>;
    
    // If eligible but not minted, provide link to hunt page
    return (
        <Link href={`/hunt/${hunt.id}`} className="text-xs text-cyan-400 hover:underline">
            Claim NFT
        </Link>
    );
};

export default function HistoryPage() {
  const [history, setHistory] = useState<UserHuntHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isLoaded: isFarcasterLoaded, frameContext } = useFarcaster();
  const { address: connectedAddress } = useAccount(); // Get connected wallet address

  const userFid = frameContext?.user?.fid;

  useEffect(() => {
    if (isFarcasterLoaded && userFid) {
      setIsLoading(true);
      getUserHuntHistory(userFid)
        .then(data => {
          setHistory(data);
          setError(null);
        })
        .catch(err => {
          console.error("Failed to fetch hunt history:", err);
          setError(err instanceof Error ? err.message : "Failed to load history.");
        })
        .finally(() => setIsLoading(false));
    } else if (isFarcasterLoaded && !userFid) {
        // Handle case where Farcaster is loaded but no user FID (e.g., not connected)
        setError("Please connect with Farcaster to view your hunt history.");
        setIsLoading(false);
    }
  }, [isFarcasterLoaded, userFid]);

  // Styles
  const headerGlowStyle = { textShadow: `0 0 8px var(--color-text-header), 0 0 12px rgba(62, 206, 206, 0.6)` };
  const cardBaseStyle = "rounded-lg bg-black/30 border border-purple-800/50 shadow-lg shadow-purple-500/20 backdrop-blur-md p-4 mb-4 flex justify-between items-center hover:border-purple-600/80 transition-colors duration-200";

  if (!isFarcasterLoaded || (!userFid && !error)) {
    return <div className="container mx-auto p-4 text-center text-[var(--color-text-body)]"><p>Loading User Data...</p></div>;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8 text-[var(--color-text-body)]">
      <div className="flex justify-between items-center mb-8">
          <h1 
            className="text-3xl sm:text-4xl font-bold text-[var(--color-text-header)] uppercase tracking-widest"
            style={headerGlowStyle}
          >
              Your Hunt History
          </h1>
          <button onClick={() => admin_deleteAllHunts()} className="text-[var(--color-accent)] hover:text-[var(--color-highlight)] transition-colors duration-200">
            Delete All Hunts
          </button>
          <Link href="/hunts" className="text-[var(--color-accent)] hover:text-[var(--color-highlight)] transition-colors duration-200">
                &larr; Back to Active Hunts
           </Link>
      </div>

      {isLoading && <p className="text-center">Loading history...</p>}
      
      {error && <p className="text-center text-red-400">Error: {error}</p>}

      {!isLoading && !error && history.length === 0 && (
        <p className="text-center text-gray-400">You havent participated in any hunts yet.</p>
      )}

      {!isLoading && !error && history.length > 0 && (
        <div className="space-y-4">
          {history.map(hunt => {
            const rarityStyle = getRarityStyles(hunt.treasureType);
            const isEnded = hunt.state === HuntState.WON || hunt.state === HuntState.LOST;
            return (
              <div key={hunt.id} className={cardBaseStyle}>
                {/* Left Side: Hunt Info */}
                <div className="flex-grow pr-4">
                   <Link href={`/hunt/${hunt.id}`} className="hover:underline">
                       <h2 className="text-lg font-semibold text-white mb-1 truncate">{hunt.name || `Hunt ${hunt.id.substring(0, 6)}...`}</h2>
                   </Link>
                   <div className="flex items-center space-x-3 text-sm">
                       <span className={rarityStyle.textClass} style={rarityStyle.glowStyle}>{hunt.treasureType}</span>
                       <span>Moves: {hunt.moveCount}</span>
                       <span className={`font-medium ${isEnded ? (hunt.outcome === 'WON' ? 'text-green-400' : 'text-red-400') : 'text-yellow-400'}`}>
                           {isEnded ? `Outcome: ${hunt.outcome}` : `Status: ${hunt.state}`}
                       </span>
                   </div>
                </div>
                {/* Right Side: NFT Status */}
                <div className="flex-shrink-0">
                  <MintStatus hunt={hunt} connectedAddress={connectedAddress} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 