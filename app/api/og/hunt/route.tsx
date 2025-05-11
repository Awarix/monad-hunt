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

import { ImageResponse } from 'next/og';
// App router includes @vercel/og.
// No need to install it.
 
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
 
    // ?title=<title>
    const hasTitle = searchParams.has('title');
    const title = hasTitle
      ? searchParams.get('title')?.slice(0, 100)
      : 'My default title';
 
    return new ImageResponse(
      (
        <div
          style={{
            backgroundColor: 'black',
            backgroundSize: '150px 150px',
            height: '100%',
            width: '100%',
            display: 'flex',
            textAlign: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            flexWrap: 'nowrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              justifyItems: 'center',
            }}
          >
            <img
              alt="Vercel"
              height={200}
              src="data:image/svg+xml,%3Csvg width='116' height='100' fill='white' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M57.5 0L115 100H0L57.5 0z' /%3E%3C/svg%3E"
              style={{ margin: '0 30px' }}
              width={232}
            />
          </div>
          <div
            style={{
              fontSize: 60,
              fontStyle: 'normal',
              letterSpacing: '-0.025em',
              color: 'white',
              marginTop: 30,
              padding: '0 120px',
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {title}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch {
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}