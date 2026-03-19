import { fail, ok } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { runEventsImport } from "@/server/events-import";
import { busyResponse, withConcurrencyLimit } from "@/server/runtime-guard";

function canRunCron(req: Request) {
  const env = getServerEnv();
  const vercelCron = req.headers.get("x-vercel-cron");
  if (vercelCron === "1") return true;

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return Boolean(env.CRON_SECRET && token && token === env.CRON_SECRET);
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (!canRunCron(req)) {
    return fail("Unauthorized cron request", 401, {
      code: "UNAUTHORIZED",
      endpoint: "/api/cron/import-events",
      hint: "Use x-vercel-cron header or Bearer CRON_SECRET",
    });
  }

  try {
    const result = await withConcurrencyLimit("cron:import-events", 1, async () =>
      runEventsImport({
        actorUserId: null,
        daysAhead: 45,
        sourceName: "kudago_timepad",
      }),
    );

    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BUSY:")) {
      return busyResponse("/api/cron/import-events");
    }

    return fail(error instanceof Error ? error.message : "Import cron failed", 500, {
      code: "DB",
      endpoint: "/api/cron/import-events",
      hint: "Проверь env и доступ к Supabase",
    });
  }
}
