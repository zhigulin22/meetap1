import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/supabase/admin";

const NOTES_KEY = "support_notes_v1";
const TICKETS_KEY = "support_tickets_v1";

export type SupportNote = {
  id: string;
  user_id: string;
  text: string;
  author_id: string;
  author_role: string;
  created_at: string;
  status: "open" | "closed";
};

export type SupportTicket = {
  id: string;
  user_id: string;
  category: string;
  status: "open" | "in_progress" | "resolved";
  assignee: string | null;
  created_at: string;
  updated_at: string;
  internal_note: string | null;
};

async function readSystemSetting<T>(key: string, fallback: T): Promise<T> {
  const q = await supabaseAdmin.from("system_settings").select("value").eq("key", key).maybeSingle();
  if (q.error) return fallback;
  const value = q.data?.value;
  if (value == null) return fallback;
  return value as T;
}

async function writeSystemSetting(key: string, value: unknown, updatedBy: string) {
  await supabaseAdmin
    .from("system_settings")
    .upsert({ key, value, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

export async function listSupportNotes(userId?: string) {
  const notes = await readSystemSetting<SupportNote[]>(NOTES_KEY, []);
  const filtered = userId ? notes.filter((n) => n.user_id === userId) : notes;
  return filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function addSupportNote(input: {
  user_id: string;
  text: string;
  author_id: string;
  author_role: string;
}) {
  const notes = await readSystemSetting<SupportNote[]>(NOTES_KEY, []);
  const created: SupportNote = {
    id: randomUUID(),
    user_id: input.user_id,
    text: input.text,
    author_id: input.author_id,
    author_role: input.author_role,
    created_at: new Date().toISOString(),
    status: "open",
  };
  notes.push(created);
  await writeSystemSetting(NOTES_KEY, notes, input.author_id);
  return created;
}

export async function updateSupportNoteStatus(input: {
  id: string;
  status: "open" | "closed";
  actor_id: string;
}) {
  const notes = await readSystemSetting<SupportNote[]>(NOTES_KEY, []);
  const next = notes.map((n) => (n.id === input.id ? { ...n, status: input.status } : n));
  await writeSystemSetting(NOTES_KEY, next, input.actor_id);
  return next.find((x) => x.id === input.id) ?? null;
}

export async function listSupportTickets(userId?: string) {
  const tickets = await readSystemSetting<SupportTicket[]>(TICKETS_KEY, []);
  const filtered = userId ? tickets.filter((t) => t.user_id === userId) : tickets;
  return filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function createSupportTicket(input: {
  user_id: string;
  category: string;
  assignee?: string | null;
  internal_note?: string | null;
  actor_id: string;
}) {
  const tickets = await readSystemSetting<SupportTicket[]>(TICKETS_KEY, []);
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id: randomUUID(),
    user_id: input.user_id,
    category: input.category,
    status: "open",
    assignee: input.assignee ?? null,
    created_at: now,
    updated_at: now,
    internal_note: input.internal_note ?? null,
  };
  tickets.push(ticket);
  await writeSystemSetting(TICKETS_KEY, tickets, input.actor_id);
  return ticket;
}

export async function updateSupportTicket(input: {
  id: string;
  status?: "open" | "in_progress" | "resolved";
  assignee?: string | null;
  internal_note?: string | null;
  actor_id: string;
}) {
  const tickets = await readSystemSetting<SupportTicket[]>(TICKETS_KEY, []);
  const next = tickets.map((t) =>
    t.id === input.id
      ? {
          ...t,
          status: input.status ?? t.status,
          assignee: input.assignee === undefined ? t.assignee : input.assignee,
          internal_note: input.internal_note === undefined ? t.internal_note : input.internal_note,
          updated_at: new Date().toISOString(),
        }
      : t,
  );
  await writeSystemSetting(TICKETS_KEY, next, input.actor_id);
  return next.find((x) => x.id === input.id) ?? null;
}
