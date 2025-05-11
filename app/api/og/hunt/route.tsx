import { ImageResponse } from 'next/og';
import OgGrid from './OgGrid';

// Mock data for now
const mockHuntId = 13;
const mockMoves = 7;
const mockMaxMoves = 10;
const mockTreasureType = 'EPIC';
const mockAdventurers = ['bob.eth', 'yaix', 'someboy', 'lucas.eth'];
const mockFound = true;
const mockPath = [
  { x: 4, y: 4 },
  { x: 4, y: 5 },
  { x: 5, y: 5 },
  { x: 5, y: 6 },
  { x: 6, y: 6 },
  { x: 6, y: 7 },
  { x: 7, y: 7 },
];
const mockTreasure = { x: 7, y: 7 };

const themePageBg = '#FDE047'; // Amber
const themeCardBg = '#fff';
const themeBorder = '#000';
const themeText = '#000';
const themeSecondary = '#e0f2fe';

export async function GET(request: Request) {
  try {
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
          {/* Header */}
          <div style={{
            width: '100%',
            textAlign: 'left',
            fontSize: 44,
            fontWeight: 800,
            color: themeText,
            letterSpacing: 2,
            marginBottom: 12,
            textTransform: 'uppercase',
            textShadow: '2px 2px 0 #fff, 4px 4px 0 #000',
          }}>
            Hunt #{mockHuntId}
          </div>
          {/* Treasure Found Label */}
          <div style={{
            width: '100%',
            textAlign: 'left',
            fontSize: 36,
            fontWeight: 700,
            color: themeText,
            marginBottom: 18,
            textShadow: '2px 2px 0 #fff, 4px 4px 0 #000',
          }}>
            {mockFound ? 'Treasure Found!' : 'Treasure Not Found'}
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
            {/* @ts-ignore Server Component in OG */}
            <OgGrid path={mockPath} treasure={mockTreasure} treasureType={mockTreasureType} />
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
              <span style={{ fontWeight: 700 }}>Adventurers:</span> {mockAdventurers.join(', ')}
            </div>
            <div>
              <span style={{ fontWeight: 700 }}>Treasure:</span> <span style={{ color: '#a21caf', fontWeight: 800 }}>{mockTreasureType}</span>
            </div>
            <div>
              <span style={{ fontWeight: 700 }}>Moves:</span> {mockMoves} / {mockMaxMoves}
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