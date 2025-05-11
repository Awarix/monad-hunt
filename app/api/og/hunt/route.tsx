import { ImageResponse } from 'next/og';
import OgGrid from './OgGrid';

function parsePath(pathStr: string | null): { x: number; y: number }[] {
  if (!pathStr) return [ { x: 4, y: 4 } ];
  try {
    return pathStr.split(';').map(pair => {
      const [x, y] = pair.split(',').map(Number);
      return { x, y };
    });
  } catch {
    return [ { x: 4, y: 4 } ];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const huntId = searchParams.get('huntId') || '13';
    const moves = Number(searchParams.get('moves')) || 7;
    const maxMoves = Number(searchParams.get('maxMoves')) || 10;
    const treasureType = searchParams.get('treasureType') || 'EPIC';
    const adventurers = (searchParams.get('adventurers') || 'bob.eth,yaix,someboy,lucas.eth').split(',');
    const found = searchParams.get('found') === 'true';
    const path = parsePath(searchParams.get('path'));
    const treasureX = Number(searchParams.get('treasureX')) || 7;
    const treasureY = Number(searchParams.get('treasureY')) || 7;
    const treasure = { x: treasureX, y: treasureY };

    const themePageBg = '#FDE047'; // Amber
    const themeCardBg = '#fff';
    const themeBorder = '#000';
    const themeText = '#000';
    const themeSecondary = '#e0f2fe';

    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            background: themePageBg,
            border: `8px solid ${themeBorder}`,
            borderRadius: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Geist, sans-serif',
            boxSizing: 'border-box',
            padding: 40,
          }}
        >
          {/* Header and Treasure Found Label in a flex column */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              textAlign: 'left',
              fontSize: 44,
              fontWeight: 800,
              color: themeText,
              letterSpacing: 2,
              marginBottom: 12,
              textTransform: 'uppercase',
              textShadow: '2px 2px 0 #fff, 4px 4px 0 #000',
            }}>
              Hunt #{huntId}
            </div>
            <div style={{
              textAlign: 'left',
              fontSize: 36,
              fontWeight: 700,
              color: themeText,
              marginBottom: 18,
              textShadow: '2px 2px 0 #fff, 4px 4px 0 #000',
            }}>
              {found ? 'Treasure Found!' : 'Treasure Not Found'}
            </div>
          </div>
          {/* Grid */}
          <div style={{
            background: themeCardBg,
            border: `6px solid ${themeBorder}`,
            borderRadius: 32,
            boxShadow: '4px 4px 0 #000',
            margin: '0 auto',
            marginBottom: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 480,
            height: 480,
          }}>
            {/* SVG Grid */}
            {/*  Server Component in OG */}
            <OgGrid path={path} treasure={treasure} treasureType={treasureType} />
          </div>
          {/* Info Section */}
          <div style={{
            width: '100%',
            background: themeSecondary,
            border: `4px solid ${themeBorder}`,
            borderRadius: 24,
            padding: 24,
            marginTop: 8,
            boxShadow: '2px 2px 0 #000',
            fontSize: 32,
            color: themeText,
            fontWeight: 600,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div>
              <span style={{ fontWeight: 700 }}>Adventurers:</span> {adventurers.join(', ')}
            </div>
            <div>
              <span style={{ fontWeight: 700 }}>Treasure:</span> <span style={{ color: '#a21caf', fontWeight: 800 }}>{treasureType}</span>
            </div>
            <div>
              <span style={{ fontWeight: 700 }}>Moves:</span> {moves} / {maxMoves}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (e) {
    return new Response(`Failed to generate the image: ${e}`, {
      status: 500,
    });
  }
}