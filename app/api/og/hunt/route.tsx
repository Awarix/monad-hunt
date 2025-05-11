import { ImageResponse } from 'next/og';

// Define types
type TreasureType = 'common' | 'rare' | 'epic';
type PathSegment = [number, number]; // [x, y]

// Helper function to parse path string "x1,y1;x2,y2;..."
const parsePath = (pathString: string | null): PathSegment[] => {
  if (!pathString) return [];
  try {
    return pathString.split(';').map(segment => {
      const parts = segment.split(',').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[0], parts[1]] as PathSegment;
      }
      return [-1, -1] as PathSegment; // Indicate invalid segment
    }).filter(segment => segment[0] !== -1); // Filter out invalid segments
  } catch {
    return [];
  }
};

// Component for the Treasure Icon
// Note: React.FC and React imports are not strictly necessary here as ImageResponse processes plain JSX.
const TreasureIcon = ({ type, x, y, cellSize, treasureColors }: { type: TreasureType, x: number, y: number, cellSize: number, treasureColors: Record<TreasureType, string> }) => {
  const iconSize = cellSize * 0.6;
  const centerX = x * cellSize + cellSize / 2;
  const centerY = y * cellSize + cellSize / 2;
  const fillColor = treasureColors[type] || treasureColors.common;

  // Common stroke style for treasure icons
  const strokeStyle = {
    stroke: "#000000",
    strokeWidth: 1,
  };

  if (type === 'common') {
    return <circle cx={centerX} cy={centerY} r={iconSize / 2} fill={fillColor} {...strokeStyle} />;
  } else if (type === 'rare') {
    return <polygon points={`${centerX},${centerY - iconSize / 2} ${centerX + iconSize / 2},${centerY} ${centerX},${centerY + iconSize / 2} ${centerX - iconSize / 2},${centerY}`} fill={fillColor} {...strokeStyle} />;
  } else if (type === 'epic') {
    // Star shape for Epic
    let points = [];
    const outerRadius = iconSize / 2;
    const innerRadius = iconSize / 4;
    for (let i = 0; i < 5; i++) {
      points.push(`${centerX + outerRadius * Math.cos(Math.PI / 2 + (i * 2 * Math.PI / 5))},${centerY - outerRadius * Math.sin(Math.PI / 2 + (i * 2 * Math.PI / 5))}`);
      points.push(`${centerX + innerRadius * Math.cos(Math.PI / 2 + ((i + 0.5) * 2 * Math.PI / 5))},${centerY - innerRadius * Math.sin(Math.PI / 2 + ((i + 0.5) * 2 * Math.PI / 5))}`);
    }
    return <polygon points={points.join(' ')} fill={fillColor} {...strokeStyle} />;
  }
  return null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse parameters from URL
    const huntId = searchParams.get('huntId') || 'N/A';
    const moves = parseInt(searchParams.get('moves') || '0', 10);
    const maxMoves = parseInt(searchParams.get('maxMoves') || '10', 10);
    const treasureType = (searchParams.get('treasureType')?.toLowerCase() || 'common') as TreasureType;
    const adventurers = (searchParams.get('adventurers') || 'Unknown Adventurers').split(',');
    const found = searchParams.get('found') === 'true';
    const pathString = searchParams.get('path');
    const treasureX = parseInt(searchParams.get('treasureX') || '-1', 10);
    const treasureY = parseInt(searchParams.get('treasureY') || '-1', 10);

    const parsedPath = parsePath(pathString);

    // OG Image dimensions
    const imageWidth = 1200;
    const imageHeight = 630;

    // Grid and cell dimensions (from mockup)
    const gridSize = 10;
    const cellSize = 40; // SVG cell size
    const svgWidth = gridSize * cellSize;
    const svgHeight = gridSize * cellSize;

    // Colors (from mockup and comic theme)
    const bgColor = '#FDE68A'; // amber-200 from mockup
    const borderColor = '#000000';
    const textColor = '#000000';
    const cardBgColor = '#FFFFFF';
    const statusFoundColor = '#16A34A'; // green-600 (slightly darker than green-700 for better contrast if needed)
    const statusNotFoundColor = '#DC2626'; // red-600
    
    const treasureColors: Record<TreasureType, string> = {
      common: '#6B7280', // gray-500
      rare: '#3B82F6',   // blue-500
      epic: '#EAB308',   // yellow-500
    };
    const pathCellFill = '#93C5FD'; // blue-300 for path

    // Comic style text shadow
    const comicTextShadow = '2px 2px 0 #FFFFFF, 3px 3px 0 #000000';

    return new ImageResponse(
      (
        <div // Outermost container
          style={{
            width: '100%',
            height: '100%',
            background: bgColor,
            border: `8px solid ${borderColor}`,
            borderRadius: '24px', // Corresponds to rounded-xl
            display: 'flex',
            flexDirection: 'column',
            padding: '32px', // p-8
            fontFamily: 'Geist, sans-serif',
            boxSizing: 'border-box',
            alignItems: 'center', // Center content vertically if less than full height
            justifyContent: 'space-between', // Distribute space for header, grid, footer
          }}
        >
          {/* Header Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', borderBottom: `4px solid ${borderColor}`, paddingBottom: '12px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: '36px', fontWeight: 800, color: textColor, textTransform: 'uppercase', letterSpacing: '0.025em', textShadow: comicTextShadow }}>
                Hunt #{huntId}
                </div>
            </div>
            <div style={{ fontSize: '30px', fontWeight: 800, color: found ? statusFoundColor : statusNotFoundColor, textTransform: 'uppercase', letterSpacing: '0.025em', textShadow: comicTextShadow, textAlign: 'right' }}>
              {found ? 'Treasure Found!' : 'Treasure Not Found'}
            </div>
          </div>

          {/* Grid Section */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, width: '100%', marginBottom: '24px' }}>
            <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ border: `4px solid ${borderColor}`, background: cardBgColor, borderRadius: '16px' }}>
              {/* Grid Lines */}
              {[...Array(gridSize)].map((_, rowIndex) =>
                [...Array(gridSize)].map((_, colIndex) => (
                  <rect
                    key={`cell-${rowIndex}-${colIndex}`}
                    x={colIndex * cellSize}
                    y={rowIndex * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={cardBgColor} // white
                    stroke={borderColor}
                    strokeWidth="2px" // Thicker for comic style
                  />
                ))
              )}
              {/* Path */}
              {parsedPath.map(([x, y], index) => (
                <rect
                  key={`path-${index}`}
                  x={x * cellSize}
                  y={y * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill={pathCellFill}
                  opacity={0.75}
                  rx="4px" // Slightly rounded path cells
                  ry="4px"
                />
              ))}
              {/* Treasure Location */}
              {treasureX >= 0 && treasureX < gridSize && treasureY >= 0 && treasureY < gridSize && (
                <TreasureIcon type={treasureType} x={treasureX} y={treasureY} cellSize={cellSize} treasureColors={treasureColors} />
              )}
            </svg>
          </div>

          {/* Info Section */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', borderTop: `4px solid ${borderColor}`, paddingTop: '12px', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '20px', color: textColor, fontWeight: 600}}>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, marginRight: '8px' }}>Adventurers:</span>
                <span style={{ fontWeight: 400 }}>{adventurers.join(', ')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '20px', color: textColor, fontWeight: 600}}>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, marginRight: '8px' }}>Treasure:</span>
                    <span style={{ fontWeight: 800, textTransform: 'uppercase', color: treasureColors[treasureType] || treasureColors.common }}>
                    {treasureType}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, marginRight: '8px' }}>Moves:</span>
                    <span style={{ fontWeight: 400 }}>{moves}/{maxMoves}</span>
                </div>
            </div>
          </div>
        </div>
      ),
      {
        width: imageWidth,
        height: imageHeight,
        // You can include font fetching logic here if 'Geist' is not automatically available
        // For example, by fetching the font file and passing it in the `fonts` option.
        // However, since Geist is Vercel's own font, it's often handled well by default.
      }
    );
  } catch (e: any) {
    console.error('Failed to generate OG image:', e);
    return new Response(`Failed to generate the image: ${e.message}`, {
      status: 500,
    });
  }
}