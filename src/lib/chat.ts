import {
  AIMessage,
  AIMessageChunk,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { concat } from "@langchain/core/utils/stream";
import { ChatOllama } from "@langchain/ollama";
import { createAgent, SystemMessage } from "langchain";
import { z } from "zod";

// Relevant documentation:
//
// https://v03.api.js.langchain.com/classes/_langchain_ollama.ChatOllama.html
// https://docs.langchain.com/oss/javascript/integrations/chat/ollama

const searchWeb = tool(
  async ({ query }: { query: string }) => {
    console.log(`searching for ${query}`);

    const response = await fetch(
      `http://localhost:8080/search?q=${query}&format=json`,
    );
    const data = await response.json();
    // TODO: create a plain text version of the results for the llm
    return JSON.stringify(data.results ?? [], null, 2);
  },
  {
    name: "search_web",
    description: "search the web for a specified query string",
    schema: z.object({
      query: z.string().describe("Search terms to look for"),
    }),
  },
);

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

export async function chat(
  userInput: string,
  onEvent: (event: StreamEvent) => void,
) {
  const llm = new ChatOllama({
    model: "qwen3:8b",
  });

  const agent = createAgent({
    model: llm,
    tools: [searchWeb],
    systemPrompt: new SystemMessage(
      "You area helpful web search assistant." +
        "You have access to a tool that searches the web." +
        "Create optimized search queries from the user's input, use them with the search_web tool to get the best results." +
        "Review the results and provide a concise summary of the information found. Including sources and links if available." +
        "Use plain text for the response to the user, without any markdown formatting.",
    ),
  });

  // Stream both modes: "messages" for tokens, "updates" for tool calls/results
  const stream = await agent.stream(
    {
      messages: [
        {
          role: "user",
          content: userInput,
        },
      ],
    },
    { streamMode: ["messages", "updates"] },
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

        // Stream reasoning tokens immediately
        const reasoning = message.additional_kwargs?.reasoning_content;
        if (typeof reasoning === "string" && reasoning) {
          onEvent({ type: "reasoning", content: reasoning });
        }

        // Aggregate for tool call detection within messages mode
        aggregatedAiChunk =
          aggregatedAiChunk === undefined
            ? message
            : concat(aggregatedAiChunk, message);
      }
    }

    // Handle state updates from "updates" mode (tool calls and results)
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
