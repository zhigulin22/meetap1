import { createHash } from "crypto";

export function buildTelegramCode(token: string) {
  const digest = createHash("sha256").update(`meetap:${token}`).digest("hex");
  const num = Number.parseInt(digest.slice(0, 12), 16) % 1_000_000;
  return String(num).padStart(6, "0");
}
