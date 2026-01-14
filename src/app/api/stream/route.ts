import { NextResponse } from "next/server";
import { type ChatHistory, chat, type StreamEvent } from "@/lib/chat";
import { summarizeIfNeeded } from "@/lib/summarize";

export async function POST(request: Request) {
  const { userInput, conversationId } = await request.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let history: ChatHistory | undefined;

      if (conversationId) {
        try {
          const result = await summarizeIfNeeded(conversationId);
          history = result.history;

          // Notify client if summarization occurred
          if (result.summarizedCount > 0) {
            controller.enqueue(
              encoder.encode(
                `${JSON.stringify({ type: "summarized", messageCount: result.summarizedCount })}\n`,
              ),
            );
          }
        } catch (error) {
          console.error("Failed to fetch conversation history:", error);
          // Continue without history if fetch fails
        }
      }

      await chat(
        userInput,
        (event: StreamEvent) => {
          // Use newline-delimited JSON for easier parsing
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        },
        history,
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
