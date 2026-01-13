import { tool } from "@langchain/core/tools";
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
    return data.results;
  },
  {
    name: "search_web",
    description: "search the web for a specified query string",
    schema: z.object({
      query: z.string().describe("Search terms to look for"),
    }),
  },
);

export async function chat() {
  const llm = new ChatOllama({
    model: "qwen3:8b",
  });

  const agent = createAgent({
    model: llm,
    tools: [searchWeb],
    systemPrompt: new SystemMessage(
      "You have access to a tool that seaches the web." +
        "Use the tool to help answer user queries.",
    ),
  });

  for await (const chunk of await agent.stream(
    {
      messages: [
        {
          role: "user",
          content: "help me search for popular typescript runtimes",
        },
      ],
    },
    { streamMode: "updates" },
  )) {
    const [step, content] = Object.entries(chunk)[0];
    console.log(`step: ${step}`);
    console.log(`content: ${JSON.stringify(content, null, 2)}`);
  }
}
