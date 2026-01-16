import { tool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOllama } from "@langchain/ollama";
import { createAgent, SystemMessage, summarizationMiddleware } from "langchain";
import { z } from "zod";
import { fetchURLContents } from "@/lib/fetchURLContents";

interface SearchResult {
  url: string;
  title: string;
  content: string;
  score: number;
}

const searchWeb = tool(
  async ({ query }: { query: string }) => {
    const response = await fetch(
      `http://localhost:8080/search?q=${query}&format=json`,
    );
    const data = await response.json();
    const plainTextResults = data.results
      .map((result: SearchResult) => {
        console.log(
          `result: ${result.title}: ${result.content}\n[score: ${result.score}] [source: ${result.url}]`,
        );
        return `${result.title}: ${result.content}\n[score: ${result.score}] [source: ${result.url}]`;
      })
      .join("\n\n");
    return plainTextResults;
  },
  {
    name: "search_web",
    description: "search the web for a specified query string",
    schema: z.object({
      query: z.string().describe("Search terms to look for"),
    }),
  },
);

const fetchPageContents = tool(
  async ({ url }: { url: string }) => {
    const contents = await fetchURLContents(url);
    return contents;
  },
  {
    name: "fetch_page_contents",
    description: "fetch the contents of a web page",
    schema: z.object({ url: z.string().describe("The URL to fetch") }),
  },
);

// TODO: https://docs.langchain.com/oss/javascript/langchain/short-term-memory#in-production
const checkpointer = new MemorySaver();

// Singleton agent instance
let agentInstance: ReturnType<typeof createAgent> | null = null;

export function getAgent() {
  if (!agentInstance) {
    const llm = new ChatOllama({
      model: "qwen3:8b",
    });

    agentInstance = createAgent({
      model: llm,
      tools: [searchWeb, fetchPageContents],
      middleware: [
        summarizationMiddleware({
          model: llm,
          trigger: { tokens: 4000 },
          keep: { messages: 10 },
        }),
      ],
      checkpointer,
      systemPrompt: new SystemMessage(
        `You are a helpful web search assistant. Always respond in English, regardless of the language used in search results or user queries.
You have access to a tool that searches the web, and a tool that fetches the contents of a web page.
Create optimized search queries from the user's input and use them with the search_web tool to get the best results.
Use the fetch_page_contents tool to fetch the contents of a web page from the results of the search_web tool if the user's query is about the content of a web page.
Review the results and provide a concise summary of the information found in English. Include sources and links if available.`,
      ),
    });
  }
  return agentInstance;
}
