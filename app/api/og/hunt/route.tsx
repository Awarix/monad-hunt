import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { START_POSITION, GRID_SIZE } from '@/lib/constants';
import type { Position } from '@/types';

export const runtime = 'edge'; // Use edge runtime for Vercel OG

// Helper function to parse path string
function parsePath(pathStr: string | null): Position[] {
    if (!pathStr) return [START_POSITION];
    try {
        const coords = pathStr.split(';').map(pair => {
            const [x, y] = pair.split(',').map(Number);
            if (isNaN(x) || isNaN(y)) throw new Error('Invalid coordinate pair');
            return { x, y };
        });
        // Validate coordinates are within grid bounds if needed
        return coords.every(p => p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE) ? coords : [START_POSITION];
    } catch (e) {
        console.error("Error parsing path string:", e);
        return [START_POSITION]; // Default to start position on error
    }
}

// Helper function to parse player FIDs string
function parsePlayers(playersStr: string | null): string[] {
    if (!playersStr) return [];
    return playersStr.split(',').filter(fid => fid.trim() !== '' && !isNaN(Number(fid)));
}


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // --- Get Parameters ---
  const huntId = searchParams.get('huntId') || 'Unknown Hunt';
  const outcome = searchParams.get('outcome') || 'UNKNOWN'; // WON, LOST
  const treasureType = searchParams.get('treasureType') || 'UNKNOWN'; // COMMON, RARE, EPIC - Renamed from 'treasure' for clarity
  const pathStr = searchParams.get('path');
  const playerFidsStr = searchParams.get('players'); // Renamed from 'playersStr' for consistency
  // const treasureX = searchParams.get('treasureX'); // For future: to mark treasure location
  // const treasureY = searchParams.get('treasureY');

  const path = parsePath(pathStr);
  const playerFids = parsePlayers(playerFidsStr);

  // --- Comic Book Theme Colors ---
  const themePageBg = '#FDE047'; // Vivid Yellow (Tailwind yellow-400)
  const themeCardBg = '#FFFFFF';       // White
  const themeBorderColor = '#000000';   // Black
  const themeTextPrimary = '#000000';   // Black
  const themeTextSecondary = '#374151'; // Cool Gray 700 (for slightly less prominent text)
  const themeGridBorderColor = '#000000'; // Black for grid lines
  const themeGridCellBg = '#F3F4F6';    // Cool Gray 100 (very light gray for empty cells)
  const themeGridPathBg = '#FDBA74';    // Orange 300 (for path cells)
  const themeGridPlayerBg = '#EF4444';  // Red 500 (for player marker, strong contrast)
  const themeAccentWin = '#10B981';     // Emerald 500 (for WIN text)
  const themeAccentLose = '#F43F5E';    // Rose 500 (for LOSE text)
  const themeAccentTreasureEpic = '#8B5CF6'; // Violet 500 (EPIC)
  const themeAccentTreasureRare = '#3B82F6'; // Blue 500 (RARE)
  const themeAccentTreasureCommon = '#6B7280'; // Gray 500 (COMMON)

  const outcomeDisplayColor = outcome === 'WON' ? themeAccentWin : themeAccentLose;
  const treasureDisplayColor = 
      treasureType === 'EPIC' ? themeAccentTreasureEpic :
      treasureType === 'RARE' ? themeAccentTreasureRare : themeAccentTreasureCommon;

  const cellSize = 32; // Adjusted cell size for a 10x10 grid within typical OG image dimensions
  const gridBorderWidth = 2;
  const outerBorderWidth = 4;
  const gridDimension = GRID_SIZE * cellSize + (GRID_SIZE + 1) * gridBorderWidth; // accounts for cell borders
  const cardPadding = 24;

  // Font: Stick with Geist Mono for now, ensure it's available.
  const fontFamily = '"Geist Mono", monospace';

  return new ImageResponse(
    (
      <div // Overall container (page background)
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: themePageBg,
          fontFamily: fontFamily,
          padding: '10px', // Reduced padding for smaller screen
        }}
      >
        <div // Main content card
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: themeCardBg,
            border: `${outerBorderWidth}px solid ${themeBorderColor}`,
            borderRadius: '16px',
            padding: `${cardPadding}px`,
            width: 'calc(100% - 20px)', // Use most of the available width
            maxWidth: '400px', // Max width for the card on small OG image
            boxShadow: `6px 6px 0px ${themeBorderColor}` // Slightly reduced shadow for mobile
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '15px', color: themeTextPrimary }}>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 5px 0', letterSpacing: '-0.025em', textAlign: 'center' }}>Treasure Map</h1>
            <p style={{ fontSize: '14px', color: themeTextSecondary, margin: 0 }}>ID: {huntId}</p>
          </div>
          
          {/* Container for Grid and Info Panel - now vertical */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
            {/* Grid Area (adjust width to fit card) */}
            <div 
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`,
                    gridTemplateRows: `repeat(${GRID_SIZE}, ${cellSize}px)`,
                    gap: `${gridBorderWidth}px`,
                    border: `${gridBorderWidth}px solid ${themeGridBorderColor}`,
                    backgroundColor: themeGridBorderColor,
                    padding: `${gridBorderWidth}px`,
                    // width: `${gridDimension}px`, // Grid dimension will be constrained by parent
                    // height: `${gridDimension}px`,
                    marginBottom: '20px' // Space before info panel
                }}
            >
                {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
                    const x = index % GRID_SIZE;
                    const y = Math.floor(index / GRID_SIZE);
                    const isPlayer = path.length > 0 && path[path.length - 1].x === x && path[path.length - 1].y === y;
                    const isPath = path.some(p => p.x === x && p.y === y);
                    
                    let cellBgColor = themeGridCellBg;
                    if (isPath) cellBgColor = themeGridPathBg;
                    if (isPlayer) cellBgColor = themeGridPlayerBg;

                    return (
                        <div 
                            key={`cell-${x}-${y}`} 
                            style={{
                                width: `${cellSize}px`,
                                height: `${cellSize}px`,
                                backgroundColor: cellBgColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                        </div>
                    );
                })}
            </div>

            {/* Info Area (full width, below grid) */}
            <div style={{ display: 'flex', flexDirection: 'column', color: themeTextPrimary, width: '100%' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0', borderBottom: `2px solid ${themeBorderColor}`, paddingBottom: '4px' }}>Details</h2>
                <p style={{ fontSize: '15px', margin: '0 0 5px 0' }}>Outcome: <span style={{ color: outcomeDisplayColor, fontWeight: 'bold' }}>{outcome}</span></p>
                <p style={{ fontSize: '15px', margin: '0 0 12px 0' }}>Treasure: <span style={{ color: treasureDisplayColor, fontWeight: 'bold' }}>{treasureType}</span></p>
                
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 6px 0', borderBottom: `2px solid ${themeBorderColor}`, paddingBottom: '3px' }}>Participants</h3>
                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '150px', overflowY: 'auto' }}>
                    {playerFids.length > 0 ? (
                         playerFids.map((fid) => <p key={fid} style={{ fontSize: '13px', margin: '2px 0', color: themeTextSecondary }}>FID: {fid}</p>)
                    ) : (
                         <p style={{ fontSize: '13px', color: themeTextSecondary }}>No participants.</p>
                    )}
                </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 425,
      height: 900,
      fonts: [
        // Optional: Load custom Geist font
      ],
    },
  );
} 