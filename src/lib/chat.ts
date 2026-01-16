import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import type { TurnWithToolCalls } from "@/db/schema";
import { getAgent } from "@/lib/agent";

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "reasoning"; content: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      args: Record<string, unknown>;
    }
  | { type: "tool_result"; id: string; result: string };

function historyToMessages(history: TurnWithToolCalls[]): BaseMessage[] {
  const messages: BaseMessage[] = [];

  for (const turn of history) {
    if (turn.role === "user") {
      messages.push(new HumanMessage(turn.content));
    } else {
      if (turn.toolCalls?.length) {
        messages.push(
          new AIMessage({
            content: turn.content,
            tool_calls: turn.toolCalls.map((tc) => ({
              id: tc.id,
              name: tc.name,
              args: tc.args,
            })),
          }),
        );
        // Add corresponding ToolMessages
        for (const tc of turn.toolCalls) {
          if (tc.result) {
            messages.push(
              new ToolMessage({
                tool_call_id: tc.id,
                content: tc.result,
              }),
            );
          }
        }
      } else {
        messages.push(new AIMessage(turn.content));
      }
    }
  }

  return messages;
}

export async function chat(
  userInput: string,
  onEvent: (event: StreamEvent) => void,
  history?: TurnWithToolCalls[],
  conversationId?: string,
) {
  const agent = getAgent();
  const threadId = conversationId ?? "default";
  const config = { configurable: { thread_id: threadId } };

  // Check if this thread has existing state in the checkpointer
  // If not, we need to populate it from PostgreSQL history
  if (history && history.length > 0) {
    try {
      const existingState = (await agent.getState(config)) as {
        values?: { messages?: unknown[] };
      } | null;
      const stateValues = existingState?.values;

      // If no messages in checkpointer state, populate from DB history
      const hasMessages =
        stateValues?.messages &&
        Array.isArray(stateValues.messages) &&
        stateValues.messages.length > 0;

      if (!hasMessages) {
        const historyMessages = historyToMessages(history);
        // Use updateState to populate the checkpointer
        await agent.updateState(config, { messages: historyMessages });
      }
    } catch (error) {
      console.error("[chat] Error checking/populating state:", error);
    }
  }

  // Stream with just the new user message
  const stream = await agent.stream(
    {
      messages: [{ role: "user", content: userInput }],
    },
    { ...config, streamMode: ["messages", "updates"] },
  );

  // Track emitted tool calls to avoid duplicates
  const emittedToolCallIds = new Set<string>();
  let aggregatedAiChunk: AIMessageChunk | undefined;

  for await (const [mode, chunk] of stream) {
    // Handle token-by-token streaming from "messages" mode
    if (mode === "messages") {
      const [message, _metadata] = chunk as [unknown, unknown];

      if (message instanceof AIMessageChunk) {
        // Stream content tokens immediately
        if (typeof message.content === "string" && message.content) {
          onEvent({ type: "token", content: message.content });
        }

        // Aggregate for tool call detection within messages mode
        aggregatedAiChunk =
          aggregatedAiChunk === undefined
            ? message
            : concat(aggregatedAiChunk, message);
      }
    }

    // Handle state updates from "updates" mode (tool calls and reasoning)
    if (mode === "updates") {
      const update = chunk as Record<string, { messages?: unknown[] }>;

      for (const [_node, state] of Object.entries(update)) {
        if (!state.messages) continue;

        for (const msg of state.messages) {
          // Handle AI messages with tool calls
          if (AIMessage.isInstance(msg)) {
            if (msg.tool_calls) {
              for (const tc of msg.tool_calls) {
                if (tc.id && tc.name && !emittedToolCallIds.has(tc.id)) {
                  emittedToolCallIds.add(tc.id);
                  onEvent({
                    type: "tool_call",
                    id: tc.id,
                    name: tc.name,
                    args: tc.args ?? {},
                  });
                }
              }
            }

            // Handle reasoning from updates
            const reasoning = msg.additional_kwargs?.reasoning_content;
            if (typeof reasoning === "string" && reasoning) {
              onEvent({ type: "reasoning", content: reasoning });
            }
          }

          // Handle tool results
          if (ToolMessage.isInstance(msg)) {
            onEvent({
              type: "tool_result",
              id: msg.tool_call_id,
              result:
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content),
            });
          }
        }
      }
    }
  }
}
