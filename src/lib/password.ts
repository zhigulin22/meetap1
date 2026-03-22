import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const ITERATIONS = 120_000;
const KEYLEN = 32;
const DIGEST = "sha256";

function derive(password: string, salt: Buffer) {
  return pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = derive(password, salt);
  return `pbkdf2$${ITERATIONS}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string) {
  try {
    const [scheme, iterRaw, saltHex, hashHex] = storedHash.split("$");
    if (scheme !== "pbkdf2") return false;
    const iterations = Number(iterRaw);
    if (!Number.isFinite(iterations) || iterations < 10_000) return false;

    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = pbkdf2Sync(password, salt, iterations, expected.length, DIGEST);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
