import { cookies } from "next/headers";

export function getCurrentUserId() {
  return cookies().get("meetap_user_id")?.value ?? null;
}

export function requireUserId() {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}
