import { NextRequest } from 'next/server';
import { poller } from '@/lib/poller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const onUpdate = (updates: any[]) => {
        if (updates.length === 0) return;
        const message = `data: ${JSON.stringify(updates)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      const unsubscribe = poller.subscribe(onUpdate);

      // Send initial heartbeat
      controller.enqueue(encoder.encode(`: heartbeat\n\n`));

      const heartbeatInterval = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 30000);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        unsubscribe();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

