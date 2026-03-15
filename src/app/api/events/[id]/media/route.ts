import { fail, ok } from "@/lib/http";
import { requireUserId } from "@/server/auth";
import { uploadEventImage } from "@/server/event-media";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = requireUserId();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const makePrimary = formData.get("makePrimary");

    if (!file) {
      return fail("Файл не выбран", 422);
    }

    const media = await uploadEventImage({
      eventId: params.id,
      file,
      userId,
      makePrimary: makePrimary !== "false",
    });

    return ok({ id: media.id, url: media.url });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось загрузить файл", 500);
  }
}

