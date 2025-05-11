// import { ImageResponse } from '@vercel/og';
// import { NextRequest } from 'next/server';
// // import { START_POSITION, GRID_SIZE } from '@/lib/constants';
// // import type { Position } from '@/types';

// export const runtime = 'edge'; // Use edge runtime for Vercel OG

// // // Helper function to parse path string
// // function parsePath(pathStr: string | null): Position[] {
// //     if (!pathStr) return [START_POSITION];
// //     try {
// //         const coords = pathStr.split(';').map(pair => {
// //             const [x, y] = pair.split(',').map(Number);
// //             if (isNaN(x) || isNaN(y)) throw new Error('Invalid coordinate pair');
// //             return { x, y };
// //         });
// //         // Validate coordinates are within grid bounds if needed
// //         return coords.every(p => p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE) ? coords : [START_POSITION];
// //     } catch (e) {
// //         console.error("Error parsing path string:", e);
// //         return [START_POSITION]; // Default to start position on error
// //     }
// // }

// // // Helper function to parse player FIDs string
// // function parsePlayers(playersStr: string | null): string[] {
// //     if (!playersStr) return [];
// //     return playersStr.split(',').filter(fid => fid.trim() !== '' && !isNaN(Number(fid)));
// // }


// export async function GET(req: NextRequest) {
//   const { searchParams } = new URL(req.url);
//   const huntId = searchParams.get('huntId') || 'Test Hunt';

//   // Simplified theme for debugging
//   const themePageBg = '#FDE047'; // Yellow
//   const themeTextPrimary = '#000000'; // Black
//   const fontFamily = 'monospace';

//   return new ImageResponse(
//     (
//       <div // Overall container
//         style={{
//           height: '100%',
//           width: '100%',
//           display: 'flex',
//           flexDirection: 'column',
//           alignItems: 'center',
//           justifyContent: 'center',
//           backgroundColor: themePageBg,
//           fontFamily: fontFamily,
//           padding: '20px',
//         }}
//       >
//         <p style={{ fontSize: '30px', color: themeTextPrimary }}>
//           Hunt ID: {huntId}
//         </p>
//         <p style={{ fontSize: '20px', color: themeTextPrimary, marginTop: '10px' }}>
//           Testing OG Image...
//         </p>
//         <p style={{ fontSize: '16px', color: themeTextPrimary, marginTop: '10px' }}>
//           Dimensions: 425x900
//         </p>
//       </div>
//     ),
//     {
//       width: 425,
//       height: 900,
//       // Fonts array can be added later if custom fonts are confirmed to work
//     },
//   );
// } 

// app/api/og/game-result/route.tsx
import { geistMono } from '@/app/layout';
import { geistSans } from '@/app/layout';
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Define cell types
type CellType = 'empty' | 'hint' | 'treasure';

// Example grid data (10x10) - In a real app, you'd pass this via query params
const exampleGridData: CellType[][] = Array(10).fill(null).map((_, r) =>
  Array(10).fill(null).map((_, c) => {
    // Example hints
    if ((r === 4 && c === 4) || (r === 4 && c === 5) || (r === 5 && c === 4) || (r === 5 && c === 5) || (r === 3 && c === 6) || (r === 6 && c === 3) ) {
      return 'hint';
    }
    // Example treasure
    if (r === 5 && c === 7) {
      return 'treasure';
    }
    return 'empty';
  })
);

// Function to get styles for each cell type
const getCellStyles = (type: CellType) => {
  const baseStyle = {
    width: 48, // Cell size
    height: 48, // Cell size
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #C8B785', // Cell border color
    borderRadius: 8, // Rounded corners for cells
  };

  switch (type) {
    case 'hint':
      return { ...baseStyle, backgroundColor: '#FADADD' }; // Light pink
    case 'treasure':
      return { ...baseStyle, backgroundColor: '#EFF2D3' }; // Same as empty for treasure cell, circle is drawn inside
    case 'empty':
    default:
      return { ...baseStyle, backgroundColor: '#EFF2D3' }; // Pale greenish-yellow
  }
};

export async function GET(req: NextRequest) {
  try {
     //   const { searchParams } = new URL(req.url);
      //   const huntId = searchParams.get('huntId') || 'Test Hunt';
    // const gridDataParam = searchParams.get('grid');
    // const gridData = gridDataParam ? JSON.parse(gridDataParam) : exampleGridData;
    const gridData = exampleGridData; // Using example for simplicity

    // Load font
    // const interRegular = await fetch(
    //   new URL('../../../../assets/fonts/Inter-Regular.ttf', import.meta.url)
    // ).then((res) => res.arrayBuffer());
    // const interBold = await fetch(
    //   new URL('../../../../assets/fonts/Inter-Bold.ttf', import.meta.url)
    // ).then((res) => res.arrayBuffer());
    
    // Ensure you have these fonts in your project at the specified path,
    // e.g., public/fonts/Inter-Regular.ttf and public/fonts/Inter-Bold.ttf
    // Or adjust the path:
    // new URL('/fonts/Inter-Regular.ttf', 'https://your-domain.com') for publicly hosted fonts
    // For local dev, often new URL('../../../../public/fonts/Inter-Regular.ttf', import.meta.url)
    // Using a placeholder if fonts aren't set up yet to avoid build errors,
    // but Vercel OG needs real font data. For testing, you can temporarily remove custom fonts.

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
            backgroundColor: '#FDE68A', // Outer gold background
            fontFamily: '"Inter", sans-serif',
            padding: 40, // Overall padding
          }}
        >
          <div // Main content container with rounded corners (like the screenshot's outer frame)
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FEF3C7', // Lighter yellow/cream for content area
              borderRadius: 20, // Rounded corners for the main content box
              padding: 20, // Padding inside the content box
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              width: 'auto', // Auto width based on content
              height: 'auto', // Auto height based on content
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 24px',
                backgroundColor: '#BAE6FD', // Light blue
                border: '3px solid black',
                borderRadius: 12,
                marginBottom: 20,
                fontSize: 36,
                fontWeight: 700, // Bold
                color: '#1F2937', // Dark Gray
              }}
            >
              Hunt Complete: Treasure Found!
              <span style={{ marginLeft: 12, fontSize: 38 }}>🥕</span>
            </div>

            {/* Grid Area */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 15, // Padding around the grid cells
                backgroundColor: '#FDF2C7', // Grid area background (slightly different from outer)
                borderRadius: 16,
                // To make the grid itself have a subtle border if desired:
                // border: '1px solid #E5E7EB',
                gap: 6, // Gap between rows
              }}
            >
              {gridData.map((row, rowIndex) => (
                <div
                  key={`row-${rowIndex}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 6, // Gap between cells in a row
                  }}
                >
                  {row.map((cellType, colIndex) => (
                    <div
                      key={`cell-${rowIndex}-${colIndex}`}
                      style={getCellStyles(cellType)}
                    >
                      {cellType === 'treasure' && (
                        <div // Treasure Circle
                          style={{
                            width: 32,
                            height: 32,
                            backgroundColor: '#FACC15', // Gold
                            borderRadius: '50%',
                            border: '3px solid #D97706', // Darker Gold/Orange border
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        // You can enable emojis if needed, though basic ones might work without it.
        // emoji: 'twemoji',
      }
    );
  } catch (e: any) {
    console.error(`Failed to generate OG Image: ${e.message}`);
    return new Response(`Failed to generate OG Image: ${e.message}`, {
      status: 500,
    });
  }
}