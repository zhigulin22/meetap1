import { createHash } from "crypto";

export function buildTelegramCode(token: string) {
  const normalized = token.trim();
  const hash = createHash("sha256").update(normalized).digest("hex");
  const base10 = parseInt(hash.slice(0, 12), 16);
  const code = (base10 % 1_000_000).toString().padStart(6, "0");
  return code;
}
