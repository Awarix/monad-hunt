// components/OgImageElement.tsx
import React from 'react';
import { CommonChestIcon, RareChestIcon, EpicChestIcon } from '../icons';
import { TreasureRarity } from '@/types'; // Assuming TreasureRarity will be added to types/index.ts

export interface OgImageProps {
  huntId: string;
  treasureType: TreasureRarity;
  moves: number;
  maxMoves: number;
  adventurers: string;
  found: boolean;
  path: string;
  treasureX: number;
  treasureY: number;
}

// Helper to parse path string into coordinates
const parsePathCoordinates = (pathString: string) => {
    try {
      return pathString.split(';')
        .map(coord => coord.split(',').map(Number))
        .filter(coord => coord.length === 2 && !isNaN(coord[0]) && !isNaN(coord[1]));
    } catch {
      console.error('Invalid path string:', pathString);
      return [];
    }
  };

const getTreasureChestIcon = (rarity: TreasureRarity | undefined) => {
  const iconProps = { width: "80%", height: "80%" };
  switch (rarity) {
    case 'COMMON':
      return <CommonChestIcon {...iconProps} />;
    case 'RARE':
      return <RareChestIcon {...iconProps} />;
    case 'EPIC':
      return <EpicChestIcon {...iconProps} />;
    default:
      // Return a default or placeholder icon if rarity is undefined or not matched
      return <CommonChestIcon {...iconProps} />;
  }
};

export const OgImageElement: React.FC<OgImageProps> = ({
  huntId,
  treasureType,
  moves,
  maxMoves,
  adventurers,
  found,
  path,
  treasureX,
  treasureY
}) => {
  const pathCoordinates = parsePathCoordinates(path);
  const gridSize = 10; // Grid size for rendering
  const cellSize = 35; // Cell size in pixels for the OG image
  const gridWidth = gridSize * cellSize;
  const gridHeight = gridSize * cellSize;

  // Create a 2D array to track which cells are in the path
  const gridMap = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
  pathCoordinates.forEach(([x, y]) => {
    if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
      gridMap[y][x] = true;
    }
  });

  const treasureColor = treasureType === 'COMMON' ? '#74d4ff' : // yellow-400
                      treasureType === 'RARE' ? '#0ea5e9' :   // sky-500
                      '#f59e0b'; // amber-500

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0b100', 
        padding: '40px',
        fontFamily: '"Geist Mono"',// Use the font name specified in ImageResponse
        border: '10px solid black',
        // borderRadius: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: 'white',
          padding: '30px',
          border: '4px solid black',
          borderRadius: '15px',
        }}
      >
        <h1 style={{ fontSize: 48, fontWeight: 'bold', marginBottom: 5, color: '#374151' /* gray-700 */ }}>
          Hunt #{huntId}
        </h1>
        <div
            style={{
               display: 'flex',
                fontSize: 36,
                fontWeight: 'bold',
                color: found ? '#10b981' : '#ef4444',
                marginBottom: 20,
            }}
            >
          {found ? 'Treasure Found!' : 'Treasure Not Found'}
        </div>

        <div style={{ display: 'flex',   gap: '30px',}}>
          {/* Grid SVG */}
          <div style={{ display: 'flex', flexDirection: 'column', border: '4px solid black', borderRadius: '8px',}}>
            <svg width={gridWidth} height={gridHeight} style={{ backgroundColor: 'white' }}>
          {Array(gridSize + 1).fill(0).flatMap((_, i) => ([
                <line
                    key={`h-line-${i}`}
                    x1={0}
                    y1={i * cellSize}
                    x2={gridWidth}
                    y2={i * cellSize}
                    stroke="black"
                    strokeWidth="1"
                />,
                <line
                    key={`v-line-${i}`}
                    x1={i * cellSize}
                    y1={0}
                    x2={i * cellSize}
                    y2={gridHeight}
                    stroke="black"
                    strokeWidth="1"
                />
                ]))}

                    {gridMap.flatMap((row, y) =>
                    row.map((isPath, x) => {
                        if (!isPath) return null;
                        return (
                        <rect
                            key={`path-${x}-${y}`}
                            x={x * cellSize}
                            y={y * cellSize}
                            width={cellSize}
                            height={cellSize}
                            fill="#5eead4"
                            stroke="black"
                            strokeWidth="1"
                        />
                        );
                    }).filter(Boolean)
                    )}
            {/* Path lines connecting centers */}
            {pathCoordinates.length > 1 && (
              <polyline
                points={pathCoordinates.map(([x, y]) =>
                  `${x * cellSize + cellSize/2},${y * cellSize + cellSize/2}`
                ).join(' ')}
                fill="none" stroke="black" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,4"
              />
            )}
            {/* Treasure location */}
            {treasureX >= 0 && treasureX < gridSize && treasureY >= 0 && treasureY < gridSize && (
            //   <g transform={`translate(${treasureX * cellSize + cellSize/3 - 9}, ${treasureY * cellSize + cellSize/3 - 9})`}>
            <div style={{display: 'flex', transform: `translate(${treasureX * cellSize + cellSize/3 - 9}px, ${treasureY * cellSize + cellSize/3 - 9}px)`}}>
                {getTreasureChestIcon(treasureType)}
            </div>
            )}
            </svg>
        </div>

          {/* Info Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ border: '2px solid black', borderRadius: '8px', padding: '10px', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 'bold', fontSize: 20, marginBottom: '5px', color: '#4b5563', display: 'flex', /* gray-600 */ }}>Adventurers</div>
              <div style={{ fontSize: 18, color: '#1f2937' /* gray-800 */, wordBreak: 'break-word', display: 'flex', textWrap: 'wrap', width: '500px'}}>{adventurers}</div>
            </div>
            <div style={{ border: '2px solid black', borderRadius: '8px', padding: '10px', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column'  }}>
              <div style={{ fontWeight: 'bold', fontSize: 20, marginBottom: '5px', color: '#4b5563', display: 'flex', }}>Treasure</div>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: treasureColor, display: 'flex', }}>
                {treasureType.charAt(0).toUpperCase() + treasureType.slice(1)}
              </div>
            </div>
            <div style={{ border: '2px solid black', borderRadius: '8px', padding: '10px', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column'  }}>
              <div style={{ fontWeight: 'bold', fontSize: 20, marginBottom: '5px', color: '#4b5563',display: 'flex', }}>Moves</div>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: '#1f2937', display: 'flex', }}>
                {moves} / {maxMoves}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};