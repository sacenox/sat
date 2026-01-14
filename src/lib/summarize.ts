import { ChatOllama } from "@langchain/ollama";
import {
  getConversation,
  updateConversationSummary,
} from "@/app/actions/conversations";
import type { Turn } from "@/db/schema";
import type { ChatHistory, ChatHistoryTurn, ToolCallData } from "@/lib/chat";

const TOKEN_THRESHOLD = 24000; // ~75% of qwen3:8b's 32k context
const MESSAGES_TO_KEEP = 10;

export interface SummarizeResult {
  history: ChatHistory;
  summarizedCount: number; // Number of messages that were summarized (0 if none)
}

/**
 * Fetches conversation history and summarizes older messages if needed.
 * Returns the history ready to be passed to the chat function.
 */
export async function summarizeIfNeeded(
  conversationId: string,
): Promise<SummarizeResult> {
  const conversation = await getConversation(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const turns = conversation.turns;
  const estimatedTokens = estimateTokens(turns);

  if (estimatedTokens > TOKEN_THRESHOLD && turns.length > MESSAGES_TO_KEEP) {
    const toSummarize = turns.slice(0, -MESSAGES_TO_KEEP);
    const toKeep = turns.slice(-MESSAGES_TO_KEEP);

    const summaryText = await generateSummary(
      conversation.summary,
      toSummarize,
    );

    await updateConversationSummary(conversationId, summaryText);

    return {
      history: {
        summary: summaryText,
        turns: toKeep.map(turnToHistoryTurn),
      },
      summarizedCount: toSummarize.length,
    };
  }

  return {
    history: {
      summary: conversation.summary ?? undefined,
      turns: turns.map(turnToHistoryTurn),
    },
    summarizedCount: 0,
  };
}

/**
 * Rough token estimation: ~4 characters per token
 */
function estimateTokens(turns: Turn[]): number {
  return turns.reduce((sum, t) => sum + t.content.length / 4, 0);
}

/**
 * Convert a DB turn to a ChatHistoryTurn for the chat function
 */
function turnToHistoryTurn(turn: Turn): ChatHistoryTurn {
  return {
    role: turn.role,
    content: turn.content,
    toolCalls: turn.toolCalls as ToolCallData[] | undefined,
  };
}

/**
 * Generate a summary of older messages using the LLM
 */
async function generateSummary(
  existingSummary: string | null,
  turns: Turn[],
): Promise<string> {
  const llm = new ChatOllama({ model: "qwen3:8b" });

  const conversationText = turns
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n");

  const prompt = `Summarize this conversation concisely, preserving key facts, decisions, and context. Focus on information that would be useful for continuing the conversation.
${existingSummary ? `\nPrevious summary to incorporate:\n${existingSummary}\n` : ""}
Conversation to summarize:
${conversationText}

Summary:`;

  const response = await llm.invoke(prompt);
  return typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
}
