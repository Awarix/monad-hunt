// app/og/route.tsx
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { OgImageElement, OgImageProps, TreasureType } from '@/components/game/OgImage'; // Or your corrected path
import { getGeistMonoSemiBoldFont } from '@/lib/fonts'; // Import the new font loader

export const runtime = 'edge'; // Or 'nodejs'

const DEFAULT_OG_PROPS: OgImageProps = {
  huntId: '0',
  treasureType: 'common',
  moves: 0,
  maxMoves: 10,
  adventurers: 'Unknown',
  found: false,
  path: '0,0',
  treasureX: 0,
  treasureY: 0,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const safeParseInt = (val: string | null, fallback: number) =>
      isNaN(parseInt(val || '')) ? fallback : parseInt(val || '', 10);
    
    const props: OgImageProps = {
      huntId: searchParams.get('huntId') || DEFAULT_OG_PROPS.huntId,
      treasureType: (searchParams.get('treasureType') as TreasureType) || DEFAULT_OG_PROPS.treasureType,
      moves: safeParseInt(searchParams.get('moves'), DEFAULT_OG_PROPS.moves),
      maxMoves: safeParseInt(searchParams.get('maxMoves'), DEFAULT_OG_PROPS.maxMoves),
      adventurers: searchParams.get('adventurers') || DEFAULT_OG_PROPS.adventurers,
      found: searchParams.get('found') === 'true' || DEFAULT_OG_PROPS.found,
      path: searchParams.get('path') || DEFAULT_OG_PROPS.path,
      treasureX: safeParseInt(searchParams.get('treasureX'), DEFAULT_OG_PROPS.treasureX),
      treasureY: safeParseInt(searchParams.get('treasureY'), DEFAULT_OG_PROPS.treasureY),
    };

    const validTreasureTypes: TreasureType[] = ['common', 'rare', 'epic'];
    if (!validTreasureTypes.includes(props.treasureType)) {
      props.treasureType = DEFAULT_OG_PROPS.treasureType;
    }

    const geistMonoSemiBold = await getGeistMonoSemiBoldFont();
    console.log('OG props:', props);

    return new ImageResponse(
      (
        <OgImageElement {...props} />
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Geist Mono', // This name will be used in `fontFamily` CSS
            data: geistMonoSemiBold,
            style: 'normal',
            weight: 600, // SemiBold is typically 600. Adjust if needed.
          },
        ],
      }
    );
  } catch (e: unknown) {
    const err = e as Error;
    console.error(`Failed to generate OG Image: ${err.message}`, err);
    return new Response(`Failed to generate OG image: ${err.message}`, { status: 500 });
  }
}