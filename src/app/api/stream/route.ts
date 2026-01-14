import { NextResponse } from "next/server";
import { chat, type StreamEvent } from "@/lib/chat";

export async function POST(request: Request) {
  const { userInput } = await request.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      await chat(userInput, (event: StreamEvent) => {
        // Use newline-delimited JSON for easier parsing
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      });

      controller.close();
    },
  });
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
