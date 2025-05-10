'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useFarcaster } from "@/components/providers/FarcasterProvider";
import { useAccount, useReadContract } from 'wagmi'; // Import Wagmi hooks
import HuntMapNFTABI from '@/lib/abi/HuntMapNFTABI.json'; // ABI for the NFT contract
import { getUserHuntHistory, UserHuntHistoryEntry } from '@/app/actions/hunt'; 
import { HuntState, TreasureType } from '@prisma/client'; 

// Helper function for Rarity Styles (adapted for new theme)
const getRarityStyles = (treasureType: TreasureType): { textClass: string; } => {
  switch (treasureType) {
    case TreasureType.RARE: return { textClass: 'text-blue-600 font-semibold' };
    case TreasureType.EPIC: return { textClass: 'text-purple-600 font-semibold' };
    case TreasureType.COMMON: default: return { textClass: 'text-lightblue-600 font-semibold' }; 
  }
};

// Component to render mint status for a single hunt
const MintStatus: React.FC<{ hunt: UserHuntHistoryEntry; connectedAddress?: `0x${string}` }> = ({ hunt, connectedAddress }) => {
    const nftContractAddress = process.env.NEXT_PUBLIC_HUNT_MAP_NFT_ADDRESS as `0x${string}` | undefined;
    const isEnded = hunt.state === HuntState.WON || hunt.state === HuntState.LOST;
    const secondaryButtonStyle = `font-bold py-2 px-4 rounded-full border-4 border-[var(--theme-border-color)] text-[var(--theme-button-secondary-text)] bg-[var(--theme-button-secondary-bg)] hover:scale-105 transition-transform shadow-sm text-sm disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100`;


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
            staleTime: 300_000, 
        },
    });

    if (!isEnded) return null; 
    if (isLoading) return <span className="text-xs text-orange-600 italic">Checking...</span>;
    if (error) return <span className="text-xs text-red-600 italic">Error</span>;
    if (hasMinted === true) return <span className="text-xs text-green-600 font-semibold">NFT Minted</span>;
    
    return (
        <button className={secondaryButtonStyle}>
            <Link href={`/hunt/${hunt.id}`} className="text-sm text-teal-600 hover:text-teal-700 font-semibold hover:underline">
                Mint on Hunt Page
            </Link>
        </button>
    );
};

export default function HistoryPage() {
  const [history, setHistory] = useState<UserHuntHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isLoaded: isFarcasterLoaded, frameContext } = useFarcaster();
  const { address: connectedAddress } = useAccount(); 

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
        setError("Please connect with Farcaster to view your hunt history.");
        setIsLoading(false);
    }
  }, [isFarcasterLoaded, userFid]);

  // Styles for new theme
  const pageContainerStyle = "bg-[var(--theme-card-bg)] rounded-2xl shadow-xl p-6 md:p-8 border-4 border-[var(--theme-border-color)] max-w-4xl mx-auto my-8";
  const cardBaseStyle = "bg-[var(--theme-secondary-card-bg)] rounded-xl p-4 border-4 border-[var(--theme-border-color)] flex flex-col sm:flex-row justify-between items-center gap-3 hover:shadow-lg transition-shadow duration-200";
  const linkStyle = "text-teal-600 hover:text-teal-700 font-semibold transition-colors duration-200";
  
  if (!isFarcasterLoaded || (!userFid && !error)) {
    return <div className={`${pageContainerStyle} text-center`}><p className="text-[var(--theme-text-secondary)]">Loading User Data...</p></div>;
  }

  return (
    <div className={pageContainerStyle}>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <h1 
            className="text-3xl sm:text-4xl font-bold text-[var(--theme-text-primary)] uppercase tracking-wider text-center sm:text-left"
          >
              Your Hunt History
          </h1>
          <Link href="/hunts" className={linkStyle}>
                &larr; Back to Active Hunts
           </Link>
      </div>

      {isLoading && <p className="text-center text-[var(--theme-text-secondary)] py-8">Loading history...</p>}
      
      {error && <p className="text-center text-red-600 font-semibold py-8">Error: {error}</p>}

      {!isLoading && !error && history.length === 0 && (
        <p className="text-center text-[var(--theme-text-secondary)] py-8">You havent participated in any hunts yet.</p>
      )}

      {!isLoading && !error && history.length > 0 && (
        <div className="space-y-6">
          {history.map(hunt => {
            const rarityStyle = getRarityStyles(hunt.treasureType);
            const isEnded = hunt.state === HuntState.WON || hunt.state === HuntState.LOST;
            return (
              <div key={hunt.id} className={cardBaseStyle}>
                <div className="flex-grow pr-4">
                   <Link href={`/hunt/${hunt.id}`} className="hover:underline">
                       <h2 className="text-xl font-bold text-[var(--theme-text-primary)] mb-2 truncate hover:text-teal-700">
                           {hunt.name || `Hunt ${hunt.id.substring(0, 6)}...`}
                       </h2>
                   </Link>
                   <div className="space-y-1 text-sm font-semibold">
                        <p className="text-[var(--theme-text-primary)]">
                            Treasure: <span className={rarityStyle.textClass}>{hunt.treasureType}</span>
                        </p>
                        <p className="text-[var(--theme-text-primary)]">
                            Status: <span className={`font-semibold ${isEnded ? (hunt.outcome === 'WON' ? 'text-green-600' : 'text-red-600') : 'text-green-600'}`}>
                                {isEnded ? hunt.outcome : hunt.state}
                            </span>
                        </p>
                        <p className="text-[var(--theme-text-primary)]">
                            Moves: <span className="font-semibold text-[var(--theme-text-secondary)]">{hunt.moveCount}</span>
                        </p>
                   </div>
                </div>
                <div className="flex-shrink-0 mt-3 sm:mt-0">
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