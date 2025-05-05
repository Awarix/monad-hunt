import { NextRequest, NextResponse } from 'next/server';
import type { HuntChannelPayload, LockUpdatePayload, HuntUpdatePayload } from '@/types';

export const dynamic = 'force-dynamic';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error("FATAL: Missing Upstash Redis environment variables.");
}

export async function GET(
  _request: NextRequest, 
  { params }: { params: Promise<{ huntId: string }> } 
) {
  const { huntId } = await params; 
  const channelName = `hunt:${huntId}`;

  if (!huntId) {
    return new NextResponse('Missing huntId', { status: 400 });
  }
  
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.error('SSE Error: Redis configuration missing during GET request');
      return new NextResponse('Server configuration error', { status: 500 });
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  const abortController = new AbortController();
  let upstreamResponse: Response | null = null;

  try {
    const subscribeUrl = `${redisUrl}/subscribe/${channelName}`;
    console.log(`SSE: Connecting to Upstash subscribe endpoint: ${subscribeUrl}`);

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
        `SSE: Upstash subscribe endpoint returned error ${upstreamResponse.status}: ${errorText}`
      );
      return new NextResponse(
        `Failed to connect to upstream event source: ${errorText}`,
        { status: upstreamResponse.status }
      );
    }

    if (!upstreamResponse.body) {
        console.error('SSE: Upstash subscribe endpoint response body is null');
        return new NextResponse('Upstream event source provided no body', { status: 500 });
    }

    const textDecoder = new TextDecoder();
    const textEncoder = new TextEncoder();

    // --- Type Guard Functions --- 
    const isLockUpdatePayload = (obj: unknown): obj is LockUpdatePayload => {
        return obj !== null && typeof obj === 'object' && 'type' in obj && obj.type === 'lock_update' 
               && ('lock' in obj) && (obj.lock === null || (typeof obj.lock === 'object' && obj.lock !== null && 'huntId' in obj.lock && typeof obj.lock.huntId === 'string')); // More thorough check
    };

    const isHuntUpdatePayload = (obj: unknown): obj is HuntUpdatePayload => {
         return obj !== null && typeof obj === 'object' && 'type' in obj && obj.type === 'hunt_update' 
               && 'details' in obj && typeof obj.details === 'object' && obj.details !== null && 'id' in obj.details && typeof obj.details.id === 'string'; 
    };

    const isHuntChannelPayload = (obj: unknown): obj is HuntChannelPayload => {
        return isLockUpdatePayload(obj) || isHuntUpdatePayload(obj);
    };
    // ---------------------------

    const transformStream = new TransformStream({
      start(controller: TransformStreamDefaultController) {
        console.log("SSE: Sending open event to client");
        controller.enqueue(textEncoder.encode("event: open\ndata: Connection established\n\n"));
      },
      transform(chunk: Uint8Array, controller: TransformStreamDefaultController) {
        const rawMessage = textDecoder.decode(chunk);
        console.log("SSE: Received raw data from Upstash: ", rawMessage);

        const lines = rawMessage.trim().split('\n');
        lines.forEach((line: string) => {
          if (line.startsWith('data: ')) {
            const dataContent = line.substring(5).trim();
            const parts = dataContent.split(',');
            // Expecting format: {type},{channel},{jsonPayload}
            if (parts.length >= 3 && (parts[0] === 'message' || parts[0] === 'pmessage') && parts[1] === channelName) {
                // The actual JSON payload starts after the first two commas
                const jsonPayload = parts.slice(2).join(',');
                try {
                  // Parse the JSON payload
                  const parsedPayload = JSON.parse(jsonPayload);

                  // Validate the parsed payload against the expected type
                  if (isHuntChannelPayload(parsedPayload)) {
                    // Payload is valid, format as standard SSE message for the client
                    // We forward the already stringified jsonPayload as it came from the broadcaster
                    const clientSseMessage = `data: ${jsonPayload}\n\n`;
                    console.log("SSE: Forwarding validated message to client: ", clientSseMessage);
                    controller.enqueue(textEncoder.encode(clientSseMessage));
                  } else {
                      console.warn("SSE: Parsed JSON payload does not match expected HuntChannelPayload structure: ", parsedPayload);
                  }
                } catch (e: unknown) {
                    console.error("SSE: Failed to parse JSON payload from Upstash message: ", jsonPayload, e instanceof Error ? e.message : e);
                }
            } else if (parts[0] === 'subscribe') {
                 console.log("SSE: Received subscribe confirmation from Upstash: ", dataContent);
                 // Optionally notify client? Usually not needed.
            } else {
                 console.warn("SSE: Received unexpected data format from Upstash: ", line);
            }
          } else if (line.trim() !== '') {
               console.warn("SSE: Received non-data line from Upstash: ", line);
          }
        });
      }
    });

    // Pipe the response body from Upstash through our transformer
    const clientStream = upstreamResponse.body.pipeThrough(transformStream);

    // Return the transformed stream to the Next.js client
    return new NextResponse(clientStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    // Handle fetch errors (network, DNS, etc.) or AbortError
    // Check if it's an AbortError (needs casting or specific check)
    const isAbortError = error instanceof Error && error.name === 'AbortError'; 
    if (isAbortError) {
      console.log('SSE: Fetch to Upstash was aborted (client disconnected).');
      // No response needed, the connection is already closed client-side
      // Ensure upstreamResponse reader is cancelled if applicable (fetch abort should handle it)
       return new NextResponse(null, { status: 204 }); // Or just let the default handling occur
    } else {
      console.error('SSE: Error establishing connection to Upstash subscribe endpoint:', error);
      return new NextResponse('Failed to connect to event source', { status: 500 });
    }
  }

  // This part should ideally not be reached if stream is setup
  // But as a safety net, ensure cleanup if something went wrong before returning stream
  // Note: The `cancel` method of the ReadableStream passed to NextResponse handles cleanup
  // when the *client* connection closes. We primarily need to ensure the fetch aborts.

  // The setup of the response stream includes implicit cleanup via fetch abort
  // No explicit cleanup block needed here usually.
} 