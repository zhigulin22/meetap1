export class ApiClientError extends Error {
  status: number;
  code?: string;
  hint?: string;
  endpoint: string;

  constructor(params: { message: string; status: number; endpoint: string; code?: string; hint?: string }) {
    super(params.message);
    this.name = "ApiClientError";
    this.status = params.status;
    this.endpoint = params.endpoint;
    this.code = params.code;
    this.hint = params.hint;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, endpoint: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new ApiClientError({
          message: `[TIMEOUT] ${endpoint}: Сервер занят, попробуй повторить запрос`,
          status: 504,
          endpoint,
          code: "TIMEOUT",
          hint: "Если повторяется — открой Diagnostics и проверь нагрузку/API",
        }),
      );
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const endpoint = url;
  const timeoutMs = init?.method && init.method.toUpperCase() !== "GET" ? 8_000 : 5_000;

  const fetchPromise = fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(init?.headers || {}),
    },
  });

  const res = await withTimeout(fetchPromise, timeoutMs, endpoint);

  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    const code = typeof err?.code === "string" ? err.code : "UNKNOWN";
    const hint = typeof err?.hint === "string" ? err.hint : undefined;
    const endpointFromServer = typeof err?.endpoint === "string" && err.endpoint ? err.endpoint : endpoint;
    const message = typeof err?.error === "string" ? err.error : "Request failed";
    const composed = `[${code}] ${endpointFromServer}: ${message}${hint ? ` | hint: ${hint}` : ""}`;
    throw new ApiClientError({ message: composed, status: res.status, endpoint: endpointFromServer, code, hint });
  }

  return res.json();
}
