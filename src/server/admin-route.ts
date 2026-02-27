import { NextResponse } from "next/server";

function isPlaceholder(value: string) {
  return value.startsWith("placeholder-") || value === "placeholder-service-role";
}

export function hasServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return key.length > 0 && !isPlaceholder(key);
}

export function adminError(
  status: number,
  errorCode: string,
  errorMessage: string,
  hint: string,
  stackSource?: unknown,
) {
  const isDev = process.env.NODE_ENV !== "production";
  const stack = isDev && stackSource instanceof Error ? stackSource.stack : undefined;

  return NextResponse.json(
    {
      ok: false,
      error_code: errorCode,
      error_message: errorMessage,
      hint,
      stack,
      error: `: . `,
    },
    { status },
  );
}

export function mapSimError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown simulation error";

  if (message === "Forbidden") {
    return {
      status: 403,
      code: "FORBIDDEN",
      message,
      hint: "Доступ только для admin role.",
    };
  }

  if (message.toLowerCase().includes("missing tables")) {
    return {
      status: 409,
      code: "MISSING_TABLES",
      message,
      hint: "Открой Data Health и нажми Fix now.",
    };
  }

  if (message.toLowerCase().includes("devtools disabled")) {
    return {
      status: 403,
      code: "DEVTOOLS_DISABLED",
      message,
      hint: "Включи ADMIN_DEVTOOLS_ENABLED=true или safe mode в system_settings.",
    };
  }

  if (message.toLowerCase().includes("service role")) {
    return {
      status: 500,
      code: "SERVICE_ROLE_MISSING",
      message,
      hint: "Проверь SUPABASE_SERVICE_ROLE_KEY в Vercel env и redeploy.",
    };
  }

  return {
    status: 400,
    code: "SIMULATION_ERROR",
    message,
    hint: "Открой Diagnostics и проверь последние ошибки API.",
  };
}
