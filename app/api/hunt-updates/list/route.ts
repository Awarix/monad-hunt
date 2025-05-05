import { NextResponse } from 'next/server';
import type { HuntsListUpdatePayload } from '@/types';

export const dynamic = 'force-dynamic';

// Environment variable check
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error("FATAL: Missing Upstash Redis environment variables.");
}
const HUNTS_LIST_CHANNEL = 'hunts_list'; 

export async function GET() {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Runtime check
  if (!redisUrl || !redisToken) {
    console.error('SSE List Error: Redis configuration missing during GET request');
    return new NextResponse('Server configuration error', { status: 500 });
  }
  const abortController = new AbortController();
  let upstreamResponse: Response | null = null;

  try {
    const subscribeUrl = `${redisUrl}/subscribe/${HUNTS_LIST_CHANNEL}`;
    console.log(`SSE List: Connecting to Upstash subscribe endpoint: ${subscribeUrl}`);
    upstreamResponse = await fetch(subscribeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${redisToken}`,
        'Cache-Control': 'no-cache', 
        'Accept': 'text/event-stream'
      },
      signal: abortController.signal,
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      console.error(
        `SSE List: Upstash subscribe endpoint returned error ${upstreamResponse.status}: ${errorText}`
      );
      return new NextResponse(
        `Failed to connect to upstream event source: ${errorText}`,
        { status: upstreamResponse.status }
      );
    }
    
    if (!upstreamResponse.body) {
        console.error('SSE List: Upstash subscribe endpoint response body is null');
        return new NextResponse('Upstream event source provided no body', { status: 500 });
    }
    // Transform stream to process and forward messages
    const textDecoder = new TextDecoder();
    const textEncoder = new TextEncoder();

    // --- Type Guard --- 
    const isHuntsListUpdatePayload = (obj: unknown): obj is HuntsListUpdatePayload => {
      // Explicitly check for non-null first
      return obj !== null && typeof obj === 'object' && 'type' in obj && obj.type === 'list_update' 
             && 'timestamp' in obj && typeof obj.timestamp === 'number';
    };
    // -----------------

    const transformStream = new TransformStream({
      start(controller: TransformStreamDefaultController) {
        console.log("SSE List: Sending open event to client");
        controller.enqueue(textEncoder.encode("event: open\ndata: Connection established for list updates\n\n"));
      },
      transform(chunk: Uint8Array, controller: TransformStreamDefaultController) {
        const rawMessage = textDecoder.decode(chunk);
        console.log("SSE List: Received raw data from Upstash: ", rawMessage);

        const lines = rawMessage.trim().split('\n');
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            const dataContent = line.substring(5).trim();
            const parts = dataContent.split(',');
            // Expecting format: {type},{channel},{jsonPayload}
            if (parts.length >= 3 && (parts[0] === 'message') && parts[1] === HUNTS_LIST_CHANNEL) {
                const jsonPayload = parts.slice(2).join(',');
                try {
                  // Parse and validate
                  const parsedPayload = JSON.parse(jsonPayload); 
                  if(isHuntsListUpdatePayload(parsedPayload)) {
                    // Forward original stringified payload
                    const clientSseMessage = `data: ${jsonPayload}\n\n`;
                    console.log("SSE List: Forwarding validated message to client: ", clientSseMessage);
                    controller.enqueue(textEncoder.encode(clientSseMessage));
                  } else {
                      console.warn("SSE List: Parsed JSON payload does not match expected HuntsListUpdatePayload structure: ", parsedPayload);
                  }
                } catch (e: unknown) {
                    console.error("SSE List: Failed to parse JSON payload: ", jsonPayload, e instanceof Error ? e.message : e);
                }
            } else if (parts[0] === 'subscribe') {
                 console.log("SSE List: Received subscribe confirmation: ", dataContent);
            } else {
                 console.warn("SSE List: Received unexpected data format: ", line);
            }
          } else if (line.trim() !== '') {
               console.warn("SSE List: Received non-data line: ", line);
          }
        });
      }
    });

    const clientStream = upstreamResponse.body.pipeThrough(transformStream);

    return new NextResponse(clientStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    // Check if it's an AbortError (needs casting or specific check)
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    if (isAbortError) {
      console.log('SSE List: Fetch to Upstash was aborted (client disconnected).');
      return new NextResponse(null, { status: 204 }); 
    } else {
      console.error('SSE List: Error establishing connection to Upstash:', error);
      return new NextResponse('Failed to connect to event source', { status: 500 });
    }
  }
} 