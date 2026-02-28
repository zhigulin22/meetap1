import { failAdmin } from "@/lib/http";
import { AdminAccessError } from "@/server/admin";

export function adminRouteError(endpoint: string, error: unknown) {
  if (error instanceof AdminAccessError) {
    const status = error.code === "UNAUTHORIZED" ? 401 : error.code === "FORBIDDEN" ? 403 : error.code === "MISSING_ENV" ? 500 : 500;
    return failAdmin(endpoint, error.message, status, { code: error.code, hint: error.hint });
  }

  if (error instanceof Error) {
    return failAdmin(endpoint, error.message, 500, {
      code: error.message.toLowerCase().includes("rls") ? "RLS" : "DB",
      hint: "Проверь server logs и подключение к Supabase SERVICE_ROLE",
    });
  }

  return failAdmin(endpoint, "Unknown server error", 500, {
    code: "UNKNOWN",
    hint: "Проверь server logs",
  });
}
