import { notFound } from "next/navigation";
import { getConversation } from "@/app/actions/conversations";
import { Chat } from "@/components/chat";

interface ConversationPageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({
  params,
}: ConversationPageProps) {
  const { id } = await params;

  // Verify the conversation exists
  const conversation = await getConversation(id);
  if (!conversation) {
    notFound();
  }

  return <Chat conversationId={id} />;
}
