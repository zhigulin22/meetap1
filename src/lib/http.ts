import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "MISSING_ENV"
  | "RLS"
  | "DB"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "UNKNOWN"
  | "SERVICE_ROLE_FAILED"
  | "TIMEOUT"
  | "TELEGRAM";

type FailMeta = {
  code?: ApiErrorCode;
  hint?: string;
  endpoint?: string;
  details?: Record<string, unknown>;
};

function codeFromStatus(status: number, message: string): ApiErrorCode {
  const m = message.toLowerCase();
  if (m.includes("missing_env") || m.includes("service_role") || m.includes("service role")) return "MISSING_ENV";
  if (m.includes("rls")) return "RLS";
  if (status === 403) return "FORBIDDEN";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 429) return "RATE_LIMIT";
  if (status === 422) return "VALIDATION";
  if (status >= 500) return "DB";
  return "UNKNOWN";
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, meta?: FailMeta) {
  const code = meta?.code ?? codeFromStatus(status, message);
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code,
      hint: meta?.hint ?? null,
      endpoint: meta?.endpoint ?? null,
      ...(meta?.details ? { details: meta.details } : {}),
    },
    { status },
  );
}

export function failAdmin(endpoint: string, message: string, status = 400, meta?: Omit<FailMeta, "endpoint">) {
  return fail(message, status, { ...meta, endpoint });
}
