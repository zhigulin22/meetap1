import { z } from "zod";

const phoneRegex = /^\+?[1-9]\d{9,14}$/;

export const startVerificationSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(10)
    .max(20)
    .refine((v) => phoneRegex.test(v.replace(/[\s()-]/g, "")), {
      message: "Неверный формат номера. Пример: +79990000000",
    })
    .transform((v) => {
      const normalized = v.replace(/[\s()-]/g, "");
      return normalized.startsWith("+") ? normalized : `+${normalized}`;
    }),
});

export const completeRegistrationSchema = z.object({
  token: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Код должен состоять из 6 цифр"),
  name: z.string().min(2).max(40).optional(),
});

export const createDailyDuoSchema = z.object({
  caption: z.string().max(140).optional(),
});

export const icebreakerSchema = z.object({
  user1: z.object({
    id: z.string().uuid(),
    name: z.string(),
    interests: z.array(z.string()),
  }),
  user2: z.object({
    id: z.string().uuid(),
    name: z.string(),
    interests: z.array(z.string()),
  }),
  context: z.string().max(500).optional(),
});

export const faceValidateSchema = z
  .object({
    imageUrl: z.string().url().optional(),
    base64: z.string().min(50).optional(),
  })
  .refine((v) => Boolean(v.imageUrl || v.base64), {
    message: "Передай imageUrl или base64",
  });
