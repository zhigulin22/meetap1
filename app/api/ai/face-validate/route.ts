import { NextRequest } from "next/server";
import { faceValidateSchema } from "@/lib/schemas";
import { fail, ok } from "@/lib/http";
import { validateFaces } from "@/server/ai";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = faceValidateSchema.safeParse(body);
  if (!parsed.success) {
    return fail(parsed.error.message, 422);
  }

  const result = await Promise.race([
    validateFaces(parsed.data),
    new Promise<{ faces_count: number; confidence: number; ok: boolean; reason: string }>((resolve) =>
      setTimeout(
        () => resolve({ faces_count: 0, confidence: 0, ok: false, reason: "AI timeout" }),
        12_000,
      ),
    ),
  ]);

  return ok(result);
}
