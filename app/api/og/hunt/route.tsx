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
          padding: '20px', // Some padding for the page itself
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
            width: 'auto', // Adjust as needed, maybe fixed width
            minWidth: '700px', // Ensure enough space for grid and info
            boxShadow: `8px 8px 0px ${themeBorderColor}` // Comic-style shadow
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px', color: themeTextPrimary }}>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 5px 0', letterSpacing: '-0.025em' }}>Treasure Hunt Map</h1>
            <p style={{ fontSize: '16px', color: themeTextSecondary, margin: 0 }}>Hunt ID: {huntId}</p>
          </div>
          
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Grid Area */}
            <div 
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`,
                    gridTemplateRows: `repeat(${GRID_SIZE}, ${cellSize}px)`,
                    gap: `${gridBorderWidth}px`, // This creates the grid lines effectively
                    border: `${gridBorderWidth}px solid ${themeGridBorderColor}`,
                    backgroundColor: themeGridBorderColor, // Background for the gap, makes lines look solid
                    padding: `${gridBorderWidth}px`, // Padding to make outer border of grid distinct
                    width: `${gridDimension}px`,
                    height: `${gridDimension}px`,
                }}
            >
                {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
                    const x = index % GRID_SIZE;
                    const y = Math.floor(index / GRID_SIZE);
                    const isPlayer = path.length > 0 && path[path.length - 1].x === x && path[path.length - 1].y === y;
                    const isPath = path.some(p => p.x === x && p.y === y);
                    // TODO: Add isTreasureLocation if coordinates are passed

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
                                // border: `1px solid ${themeGridBorderColor}` // Individual cell border if gap isn't used
                            }}
                        >
                           {/* Can add icons here for player/treasure if needed instead of just bg color */}
                        </div>
                    );
                })}
            </div>

            {/* Info Area */}
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '24px', color: themeTextPrimary, flexShrink: 0, width: '220px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 10px 0', borderBottom: `2px solid ${themeBorderColor}`, paddingBottom: '5px' }}>Hunt Details</h2>
                <p style={{ fontSize: '16px', margin: '0 0 5px 0' }}>Outcome: <span style={{ color: outcomeDisplayColor, fontWeight: 'bold' }}>{outcome}</span></p>
                <p style={{ fontSize: '16px', margin: '0 0 15px 0' }}>Treasure: <span style={{ color: treasureDisplayColor, fontWeight: 'bold' }}>{treasureType}</span></p>
                
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0', borderBottom: `2px solid ${themeBorderColor}`, paddingBottom: '5px' }}>Participants</h3>
                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '180px', overflowY: 'auto' }}>
                    {playerFids.length > 0 ? (
                         playerFids.map((fid) => <p key={fid} style={{ fontSize: '14px', margin: '2px 0', color: themeTextSecondary }}>FID: {fid}</p>)
                    ) : (
                         <p style={{ fontSize: '14px', color: themeTextSecondary }}>No participants recorded.</p>
                    )}
                </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 450, // Adjusted height slightly
      fonts: [
        // Optional: Load custom Geist font if needed and available as data
        // {
        //   name: 'Geist',
        //   data: Buffer.from(await fetch(new URL('@/assets/fonts/Geist-Regular.otf', import.meta.url)).then(res => res.arrayBuffer())),
        //   weight: 400,
        //   style: 'normal',
        // },
        // {
        //   name: 'Geist Mono',
        //   data: Buffer.from(await fetch(new URL('@/assets/fonts/GeistMono-Regular.otf', import.meta.url)).then(res => res.arrayBuffer())),
        //   weight: 400,
        //   style: 'normal',
        // },
      ],
    },
  );
} 