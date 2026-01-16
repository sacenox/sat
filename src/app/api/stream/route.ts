import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { type Turn, type TurnWithToolCalls, turns } from "@/db/schema";
import { chat, type StreamEvent } from "@/lib/chat";

export async function POST(request: Request) {
  const { userInput, conversationId } = await request.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let history: Turn[] | undefined;

      if (conversationId) {
        history = await db.query.turns.findMany({
          where: eq(turns.conversationId, conversationId),
          orderBy: [asc(turns.createdAt)],
        });
      }

      await chat(
        userInput,
        (event: StreamEvent) => {
          // Use newline-delimited JSON for easier parsing
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        },
        history as TurnWithToolCalls[],
        conversationId,
      );

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
