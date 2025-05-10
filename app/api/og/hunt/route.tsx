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
  const huntId = searchParams.get('huntId') || 'Test Hunt';

  // Simplified theme for debugging
  const themePageBg = '#FDE047'; // Yellow
  const themeTextPrimary = '#000000'; // Black
  const fontFamily = 'monospace';

  return new ImageResponse(
    (
      <div // Overall container
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: themePageBg,
          fontFamily: fontFamily,
          padding: '20px',
        }}
      >
        <p style={{ fontSize: '30px', color: themeTextPrimary }}>
          Hunt ID: {huntId}
        </p>
        <p style={{ fontSize: '20px', color: themeTextPrimary, marginTop: '10px' }}>
          Testing OG Image...
        </p>
        <p style={{ fontSize: '16px', color: themeTextPrimary, marginTop: '10px' }}>
          Dimensions: 425x900
        </p>
      </div>
    ),
    {
      width: 425,
      height: 900,
      // Fonts array can be added later if custom fonts are confirmed to work
    },
  );
} 