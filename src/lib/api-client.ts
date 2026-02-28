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

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    const code = typeof err?.code === "string" ? err.code : "UNKNOWN";
    const hint = typeof err?.hint === "string" ? err.hint : undefined;
    const endpoint = typeof err?.endpoint === "string" && err.endpoint ? err.endpoint : url;
    const message = typeof err?.error === "string" ? err.error : "Request failed";
    const composed = `[${code}] ${endpoint}: ${message}${hint ? ` | hint: ${hint}` : ""}`;
    throw new ApiClientError({ message: composed, status: res.status, endpoint, code, hint });
  }

  return res.json();
}
