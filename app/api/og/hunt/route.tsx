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
  const treasureType = searchParams.get('treasure') || 'UNKNOWN'; // COMMON, RARE, EPIC
  const pathStr = searchParams.get('path');
  const playersStr = searchParams.get('players');

  const path = parsePath(pathStr);
  const playerFids = parsePlayers(playersStr);

  // --- Styling & Content ---
  const outcomeColor = outcome === 'WON' ? 'text-green-400' : 'text-red-400';
  const treasureColor = 
      treasureType === 'EPIC' ? 'text-purple-400' : 
      treasureType === 'RARE' ? 'text-blue-400' : 'text-gray-400';

  const cellSize = 40; // Size of each logical grid cell for positioning
  const gridWidth = GRID_SIZE * cellSize;
  const gridHeight = GRID_SIZE * cellSize;
  const padding = 40;

  // TODO: Refine OG Image styles (fonts, layout, path visualization, responsiveness?)

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#111',
          color: '#eee',
          fontFamily: '"Geist Mono", monospace', // Ensure Geist font is loaded or fallback
          padding: `${padding}px`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '5px' }}>Treasure Hunt Map</h1>
          <p style={{ fontSize: '18px', color: '#aaa' }}>Hunt ID: {huntId}</p>
        </div>
        
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Grid Area Container */}
            <div 
                style={{
                    display: 'flex',
                    width: `${gridWidth}px`,
                    height: `${gridHeight}px`,
                    border: '1px solid #444',
                    position: 'relative',
                    backgroundColor: '#1a1a1a'
                }}
            >
                {/* Grid Lines (drawn manually with absolute divs) */}
                {/* Vertical Lines */}
                {Array.from({ length: GRID_SIZE - 1 }).map((_, i) => (
                    <div key={`vline-${i}`} style={{
                        position: 'absolute',
                        left: `${(i + 1) * cellSize}px`,
                        top: 0,
                        width: '1px',
                        height: '100%',
                        backgroundColor: '#333',
                    }} />
                ))}
                {/* Horizontal Lines */}
                {Array.from({ length: GRID_SIZE - 1 }).map((_, i) => (
                    <div key={`hline-${i}`} style={{
                        position: 'absolute',
                        left: 0,
                        top: `${(i + 1) * cellSize}px`,
                        width: '100%',
                        height: '1px',
                        backgroundColor: '#333',
                    }} />
                ))}
                
                {/* Render Path (using absolute positioning within the container) */}
                {path.map((pos, index) => {
                    const isStart = index === 0;
                    const isEnd = index === path.length - 1;
                    const nextPos = path[index + 1];

                    return (
                        <div key={`point-${index}`} style={{ position: 'absolute', left: `${pos.x * cellSize}px`, top: `${pos.y * cellSize}px`, width: `${cellSize}px`, height: `${cellSize}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {/* Dot for the position */}
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isStart ? '#4ade80' : isEnd ? (outcome === 'WON' ? '#facc15' : '#f87171') : '#60a5fa' }}></div>
                            
                            {/* Line to next position */}
                            {nextPos && (
                                <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }} >
                                     <line 
                                        x1={cellSize / 2} 
                                        y1={cellSize / 2} 
                                        x2={(nextPos.x - pos.x + 0.5) * cellSize} 
                                        y2={(nextPos.y - pos.y + 0.5) * cellSize} 
                                        stroke="#60a5fa" 
                                        strokeWidth="2"
                                    />
                                </svg>
                            )}
                             {/* Display move number (optional) */}
                             {/* <span style={{ position: 'absolute', top: -15, fontSize: '10px', color: '#aaa' }}>{index}</span> */}
                        </div>
                    );
                })}
            </div>

             {/* Info Area */}
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '30px', maxWidth: '200px' }}>
                <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Hunt Details</h2>
                <p style={{ fontSize: '18px', marginBottom: '5px' }}>Outcome: <span className={outcomeColor}>{outcome}</span></p>
                <p style={{ fontSize: '18px', marginBottom: '15px' }}>Treasure: <span className={treasureColor}>{treasureType}</span></p>
                
                <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Participants (FID)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '300px', overflowY: 'auto' }}>
                    {playerFids.length > 0 ? (
                         playerFids.map((fid) => <p key={fid} style={{ fontSize: '14px', margin: '2px 0' }}>{fid}</p>)
                    ) : (
                         <p style={{ fontSize: '14px', color: '#888' }}>No participants found.</p>
                    )}
                </div>
            </div>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 500,
      // TODO: Add custom fonts if needed
      // fonts: [
      //   {
      //     name: 'Geist',
      //     data: fontData,
      //     style: 'normal',
      //   },
      // ],
    },
  );
} 