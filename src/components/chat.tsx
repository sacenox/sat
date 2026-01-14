"use client";

import {
  Bot,
  ChevronRight,
  Loader2,
  Search,
  SendHorizontal,
  User,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "pending" | "complete";
  result?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  toolCalls?: ToolCall[];
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedInput = input.trim();
      if (!trimmedInput || isStreaming) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmedInput,
      };

      const assistantMessageId = crypto.randomUUID();

      setInput("");
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      textareaRef.current?.focus();

      let assistantContent = "";
      let assistantReasoning = "";
      const toolCallsMap = new Map<string, ToolCall>();

      const updateAssistantMessage = () => {
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === assistantMessageId);
          const newMessage: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: assistantContent,
            reasoning: assistantReasoning || undefined,
            toolCalls:
              toolCallsMap.size > 0
                ? Array.from(toolCallsMap.values())
                : undefined,
          };

          if (existing) {
            return prev.map((m) =>
              m.id === assistantMessageId ? newMessage : m,
            );
          }
          return [...prev, newMessage];
        });
      };

      try {
        const response = await fetch("/api/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userInput: trimmedInput }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse newline-delimited JSON events
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const event = JSON.parse(line);

              switch (event.type) {
                case "token":
                  // Accumulate content tokens
                  assistantContent += event.content;
                  break;
                case "reasoning":
                  // Accumulate reasoning tokens
                  assistantReasoning += event.content;
                  break;
                case "tool_call":
                  toolCallsMap.set(event.id, {
                    id: event.id,
                    name: event.name,
                    args: event.args,
                    status: "pending",
                  });
                  break;
                case "tool_result": {
                  const existing = toolCallsMap.get(event.id);
                  if (existing) {
                    toolCallsMap.set(event.id, {
                      ...existing,
                      status: "complete",
                      result: event.result,
                    });
                  }
                  break;
                }
              }
            } catch {
              // Ignore parse errors for partial chunks
            }
          }

          // Update UI after processing each chunk for real-time feedback
          if (assistantContent || assistantReasoning || toolCallsMap.size > 0) {
            updateAssistantMessage();
          }
        }

        // Finalize: ensure assistant message exists even if empty
        setMessages((prev) => {
          const hasAssistant = prev.some((m) => m.id === assistantMessageId);
          if (!hasAssistant) {
            return [
              ...prev,
              {
                id: assistantMessageId,
                role: "assistant",
                content: "I apologize, I could not respond.",
              },
            ];
          }
          return prev;
        });
      } catch (error) {
        console.error("Stream error:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content:
              "Sorry, there was an error processing your request. Please try again.",
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [input, isStreaming],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit],
  );

  return (
    <div className="flex flex-1 flex-col">
      {/* Messages area */}
      <ScrollArea className="flex-1 p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-[60vh] items-center justify-center">
              <div className="text-center">
                <Bot className="text-muted-foreground mx-auto size-12" />
                <h2 className="mt-4 text-xl font-semibold">
                  How can I help you today?
                </h2>
                <p className="text-muted-foreground mt-2">
                  Ask me anything and I'll search the web for answers.
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}

          {isStreaming && !messages.some((m) => m.role === "assistant") && (
            <div className="flex gap-3">
              <Avatar>
                <AvatarFallback>
                  <Bot className="size-4" />
                </AvatarFallback>
              </Avatar>
              <Card size="sm" className="max-w-[80%]">
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-muted-foreground text-sm">
                      Thinking...
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-border bg-background/95 supports-backdrop-filter:bg-background/60 border-t p-4 backdrop-blur">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          <div className="bg-muted/50 relative flex items-end gap-2 rounded-2xl p-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              className="min-h-[44px] flex-1 resize-none border-0 bg-transparent focus-visible:ring-0"
              disabled={isStreaming}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isStreaming}
              className="shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizontal className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-center text-xs">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar className={cn(isUser && "bg-primary text-primary-foreground")}>
        <AvatarFallback
          className={cn(isUser && "bg-primary text-primary-foreground")}
        >
          {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>

      {isUser ? (
        <Card
          size="sm"
          className="bg-primary text-primary-foreground max-w-[80%]"
        >
          <CardContent>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </CardContent>
        </Card>
      ) : (
        <Card size="sm" className="max-w-[80%]">
          {/* Reasoning section */}
          {message.reasoning && (
            <CardContent>
              <Collapsible defaultOpen>
                <div className="border-muted-foreground/20 bg-muted/30 rounded-lg border p-2">
                  <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-xs transition-colors [&[data-state=open]>svg:first-child]:rotate-90">
                    <ChevronRight className="size-3 transition-transform" />
                    <span>Thinking...</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-xs">
                      {message.reasoning}
                    </p>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </CardContent>
          )}

          {/* Tool calls section */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <CardContent className="space-y-1">
              {message.toolCalls.map((tc) => (
                <ToolCallBubble key={tc.id} toolCall={tc} />
              ))}
            </CardContent>
          )}

          {/* Main content */}
          {message.content && (
            <CardContent>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function ToolCallBubble({ toolCall }: { toolCall: ToolCall }) {
  const isSearch = toolCall.name === "search_web";

  return (
    <Collapsible>
      <Card size="sm" className="border-blue-500/20 bg-blue-500/5">
        <CardContent>
          <div className="flex items-center gap-2">
            {toolCall.status === "pending" ? (
              <Loader2 className="size-3 animate-spin text-blue-500" />
            ) : isSearch ? (
              <Search className="size-3 text-blue-500" />
            ) : (
              <Wrench className="size-3 text-blue-500" />
            )}
            <span className="text-xs font-medium">
              {isSearch ? "Searching" : toolCall.name}
              {isSearch &&
                typeof toolCall.args.query === "string" &&
                toolCall.args.query && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    for "{toolCall.args.query}"
                  </span>
                )}
            </span>
            {toolCall.status === "complete" && (
              <span className="text-muted-foreground text-xs">✓</span>
            )}
          </div>

          {toolCall.result && (
            <>
              <CollapsibleTrigger className="text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 text-xs transition-colors [&[data-state=open]>svg:first-child]:rotate-90">
                <ChevronRight className="size-3 transition-transform" />
                <span>View results</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="mt-2 max-h-48">
                  <pre className="bg-muted/50 rounded p-2 text-xs">
                    {toolCall.result.length > 2000
                      ? `${toolCall.result.slice(0, 2000)}...`
                      : toolCall.result}
                  </pre>
                </ScrollArea>
              </CollapsibleContent>
            </>
          )}
        </CardContent>
      </Card>
    </Collapsible>
  );
}
