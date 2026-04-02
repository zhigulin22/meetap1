import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{9,14}$/, "Неверный формат номера");

export const startVerificationSchema = z.object({
  phone: phoneSchema,
});

export const completeRegistrationSchema = z.object({
  token: z.string().uuid("Некорректный verification token"),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Код должен состоять из 6 цифр"),
  name: z.string().trim().min(2).max(80).optional(),
});

export const icebreakerSchema = z.object({
  user1: z.object({
    name: z.string().trim().min(1).max(120),
    interests: z.array(z.string().trim().min(1).max(80)).default([]),
  }),
  user2: z.object({
    name: z.string().trim().min(1).max(120),
    interests: z.array(z.string().trim().min(1).max(80)).default([]),
  }),
  context: z.string().trim().max(500).optional(),
});

export const faceValidateSchema = z
  .object({
    imageUrl: z.string().url().optional(),
    base64: z.string().min(50).optional(),
  })
  .refine((v) => Boolean(v.imageUrl || v.base64), {
    message: "Передай imageUrl или base64",
  });
