import { z } from "zod";
import { api } from "@/lib/api-client";

export async function adminApi<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const data = await api<unknown>(url, init);
  return schema.parse(data);
}
