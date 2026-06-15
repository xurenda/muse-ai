import { z } from "zod";

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
  }),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const registerRequestSchema = loginRequestSchema;

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
