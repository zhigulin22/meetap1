export async function track(event_name: string, properties: Record<string, unknown> = {}, path?: string) {
  if (!event_name) return;

  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ event_name, properties, path }),
    });
  } catch {
    // do not break UX for analytics transport errors
  }
}
