"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  deleteConversation,
  getConversations,
} from "@/app/actions/conversations";
import { Brand } from "@/components/brand";
import { ModeToggle } from "@/components/mode-toggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { toast } from "sonner";
import type { Conversation } from "@/db/schema";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isPending, startTransition] = useTransition();

  // Load conversations on mount and when pathname changes (to catch new conversations)
  useEffect(() => {
    async function loadConversations() {
      try {
        const data = await getConversations();
        setConversations(data);
      } catch (error) {
        console.error("Failed to load conversations:", error);
      }
    }

    loadConversations();
  }, [pathname]);

  const handleDelete = async (id: string) => {
    startTransition(async () => {
      try {
        await deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        toast.success("Conversation deleted");

        // If we're currently viewing the deleted conversation, redirect to home
        if (pathname === `/conversation/${id}`) {
          router.push("/");
        }
      } catch (error) {
        console.error("Failed to delete conversation:", error);
        toast.error("Failed to delete conversation");
      }
    });
  };

  // Extract conversation ID from pathname
  const currentConversationId = pathname.startsWith("/conversation/")
    ? pathname.split("/")[2]
    : null;

  return (
    <Sidebar>
      <SidebarHeader className="flex items-center justify-center">
        <Brand />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/">
                <MessageSquarePlus className="size-4" />
                New Chat
              </Link>
            </Button>
          </SidebarGroupContent>
        </SidebarGroup>

        {conversations.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Conversations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {conversations.map((conversation) => (
                  <SidebarMenuItem key={conversation.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={currentConversationId === conversation.id}
                    >
                      <Link href={`/conversation/${conversation.id}`}>
                        <span className="truncate">
                          {conversation.title || "Untitled"}
                        </span>
                      </Link>
                    </SidebarMenuButton>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <SidebarMenuAction showOnHover>
                          <Trash2 className="size-4" />
                          <span className="sr-only">Delete conversation</span>
                        </SidebarMenuAction>
                      </AlertDialogTrigger>
                      <AlertDialogContent size="sm">
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete conversation?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this conversation and
                            all its messages. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => handleDelete(conversation.id)}
                            disabled={isPending}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <ModeToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
