class ApiError extends Error {
  status?: number;
  code?: string;
  hint?: string;
}

function mapStatusToMessage(status: number, serverMessage?: string) {
  if (serverMessage && typeof serverMessage === "string") {
    const unsafe = serverMessage.includes("http") || serverMessage.includes("/") || serverMessage.length > 160;
    if (!unsafe) return serverMessage;
  }
  if (status === 400) return "Неверный запрос. Проверьте поля.";
  if (status === 401) return "Нужно войти в аккаунт.";
  if (status === 403) return "Нет доступа к действию.";
  if (status === 404) return "Данные не найдены.";
  if (status === 408 || status === 504) return "Сервер не отвечает. Повторите через пару секунд.";
  if (status === 429) return "Слишком много запросов. Повторите позже.";
  if (status >= 500) return "Сервер временно недоступен. Повторите.";
  return "Что-то пошло не так. Повторите.";
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body instanceof FormData ? {} : { "content-type": "application/json" }),
        ...(init?.headers || {}),
      },
    });
  } catch {
    const err = new ApiError("Нет соединения. Проверьте сеть.");
    err.code = "NETWORK";
    throw err;
  }

  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await res.json().catch(() => ({})) : {};
    const err = new ApiError(mapStatusToMessage(res.status, payload?.error || payload?.message));
    err.status = res.status;
    err.code = payload?.code ?? payload?.error_code;
    err.hint = payload?.hint;
    throw err;
  }

  return res.json();
}
