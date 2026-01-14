"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { conversations, type NewTurn, turns } from "@/db/schema";

export async function getConversations() {
  return db.query.conversations.findMany({
    orderBy: [desc(conversations.updatedAt)],
  });
}

export async function getConversation(id: string) {
  return db.query.conversations.findFirst({
    where: eq(conversations.id, id),
    with: {
      turns: {
        orderBy: [turns.createdAt],
      },
    },
  });
}

export async function createConversation() {
  const [conversation] = await db
    .insert(conversations)
    .values({})
    .returning({ id: conversations.id });

  revalidatePath("/");
  return conversation;
}

export async function addTurn(
  conversationId: string,
  data: Omit<NewTurn, "id" | "conversationId" | "createdAt">,
) {
  // Insert the turn
  const [turn] = await db
    .insert(turns)
    .values({
      conversationId,
      ...data,
    })
    .returning();

  // Check if this is the first user turn to set the title
  if (data.role === "user") {
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (conversation && !conversation.title) {
      // Set title from first ~50 chars of user message
      const title =
        data.content.length > 50
          ? `${data.content.slice(0, 47)}...`
          : data.content;

      await db
        .update(conversations)
        .set({ title, updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    } else {
      // Just update the timestamp
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));
    }
  } else {
    // Update timestamp for assistant turns too
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  revalidatePath("/");
  revalidatePath(`/conversation/${conversationId}`);

  return turn;
}

export async function deleteConversation(id: string) {
  await db.delete(conversations).where(eq(conversations.id, id));
  revalidatePath("/");
}

export async function updateConversationSummary(id: string, summary: string) {
  await db
    .update(conversations)
    .set({ summary, updatedAt: new Date() })
    .where(eq(conversations.id, id));
}

// Type for the full conversation with turns
export type ConversationWithTurns = NonNullable<
  Awaited<ReturnType<typeof getConversation>>
>;
