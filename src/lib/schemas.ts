import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{9,14}$/, "Неверный формат номера");

export const startVerificationSchema = z.object({
  phone: phoneSchema,
});

export const completeRegistrationSchema = z.object({
<<<<<<< HEAD
  token: z.string().uuid("Некорректный verification token"),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Код должен состоять из 6 цифр"),
  name: z.string().trim().min(2).max(80).optional(),
=======
  token: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Код должен состоять из 6 цифр"),
  name: z.string().min(2).max(40).optional(),
  username: z.string().regex(/^[a-z0-9_]{3,30}$/).optional(),
  password: z.string().min(8).max(72).optional(),
});

export const createDailyDuoSchema = z.object({
  caption: z.string().max(140).optional(),
>>>>>>> origin/develop-tema
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
