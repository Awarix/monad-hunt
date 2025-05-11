import React from 'react';

interface Position { x: number; y: number; }
interface OgGridProps {
  path: Position[];
  treasure: Position;
  treasureType: string;
}

const GRID_SIZE = 10;
const CELL_SIZE = 48;
const GRID_WIDTH = GRID_SIZE * CELL_SIZE;
const GRID_HEIGHT = GRID_SIZE * CELL_SIZE;

const treasureColors: Record<string, string> = {
  EPIC: '#a21caf',
  RARE: '#2563eb',
  COMMON: '#0ea5e9',
};

export default function OgGrid({ path, treasure, treasureType }: OgGridProps) {
  // Build a set for fast path lookup
  const pathSet = new Set(path.map(pos => `${pos.x},${pos.y}`));
  const treasureColor = treasureColors[treasureType] || '#0ea5e9';

  return (
    <svg
      width={GRID_WIDTH}
      height={GRID_HEIGHT}
      style={{ display: 'block', borderRadius: 20, background: '#e0f2fe', boxShadow: '2px 2px 0 #000' }}
    >
      {/* Draw grid */}
      {[...Array(GRID_SIZE)].map((_, y) =>
        [...Array(GRID_SIZE)].map((_, x) => {
          const isPath = pathSet.has(`${x},${y}`);
          const isTreasure = treasure.x === x && treasure.y === y;
          return (
            <g key={`${x},${y}`}>
              <rect
                x={x * CELL_SIZE}
                y={y * CELL_SIZE}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={8}
                ry={8}
                fill={isPath ? '#fde68a' : '#fff'}
                stroke="#000"
                strokeWidth={4}
                opacity={isPath ? 0.85 : 1}
              />
              {isTreasure && (
                <g>
                  <circle
                    cx={x * CELL_SIZE + CELL_SIZE / 2}
                    cy={y * CELL_SIZE + CELL_SIZE / 2}
                    r={CELL_SIZE / 3}
                    fill={treasureColor}
                    stroke="#000"
                    strokeWidth={4}
                  />
                  <text
                    x={x * CELL_SIZE + CELL_SIZE / 2}
                    y={y * CELL_SIZE + CELL_SIZE / 2 + 8}
                    textAnchor="middle"
                    fontSize={CELL_SIZE / 2.2}
                    fontWeight="bold"
                    fill="#fff"
                    stroke="#000"
                    strokeWidth={2}
                    style={{ fontFamily: 'Geist, sans-serif' }}
                  >
                    $
                  </text>
                </g>
              )}
            </g>
          );
        })
      )}
      {/* Optionally, draw a polyline for the path */}
      {path.length > 1 && (
        <polyline
          points={path.map(pos => `${pos.x * CELL_SIZE + CELL_SIZE / 2},${pos.y * CELL_SIZE + CELL_SIZE / 2}`).join(' ')}
          fill="none"
          stroke="#000"
          strokeWidth={6}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.7}
        />
      )}
    </svg>
  );
} 