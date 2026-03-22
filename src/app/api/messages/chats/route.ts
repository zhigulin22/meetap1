import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { supabaseAdmin } from "@/supabase/admin";

type MessageRow = {
  id: string;
  from_user_id: string;
  to_user_id: string | null;
  content: string;
  created_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId();
    const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

    const { data: rows, error } = await supabaseAdmin
      .from("messages")
      .select("id,from_user_id,to_user_id,content,created_at")
      .not("to_user_id", "is", null)
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      return fail(error.message, 500);
    }

    const chatsMap = new Map<
      string,
      {
        peerId: string;
        lastMessage: string;
        lastMessageAt: string;
        lastMessageFromMe: boolean;
        messagesCount: number;
      }
    >();

    for (const row of (rows ?? []) as MessageRow[]) {
      if (!row.to_user_id) continue;
      const peerId = row.from_user_id === userId ? row.to_user_id : row.from_user_id;
      const existing = chatsMap.get(peerId);

      if (!existing) {
        chatsMap.set(peerId, {
          peerId,
          lastMessage: row.content,
          lastMessageAt: row.created_at,
          lastMessageFromMe: row.from_user_id === userId,
          messagesCount: 1,
        });
        continue;
      }

      existing.messagesCount += 1;
    }

    const peerIds = [...chatsMap.keys()];
    if (!peerIds.length) {
      return ok({ items: [] });
    }

    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id,name,avatar_url")
      .in("id", peerIds);

    if (usersError) {
      return fail(usersError.message, 500);
    }

    const peers = (users ?? []) as Array<{
      id: string;
      name: string;
      avatar_url: string | null;
    }>;
    const userMap = new Map(peers.map((u) => [u.id, u]));

    let items = peerIds
      .map((peerId) => {
        const chat = chatsMap.get(peerId);
        const peer = userMap.get(peerId);
        if (!chat || !peer) return null;

        return {
          user_id: peerId,
          name: peer.name,
          avatar_url: peer.avatar_url,
          last_message: chat.lastMessage,
          last_message_at: chat.lastMessageAt,
          last_message_from_me: chat.lastMessageFromMe,
          messages_count: chat.messagesCount,
        };
      })
      .filter(Boolean) as Array<{
      user_id: string;
      name: string;
      avatar_url: string | null;
      last_message: string;
      last_message_at: string;
      last_message_from_me: boolean;
      messages_count: number;
    }>;

    if (q) {
      items = items.filter(
        (x) =>
          x.name.toLowerCase().includes(q) ||
          x.last_message.toLowerCase().includes(q),
      );
    }

    items.sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at));

    return ok({ items });
  } catch {
    return fail("Unauthorized", 401);
  }
}
