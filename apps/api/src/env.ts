import { z } from "zod";

const envSchema = z.object({
  OPENAPI_SERVER_URL: z.string().min(1).default("/"),
  WEB_ORIGIN: z.string().url().optional(),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().default("file:./data/app.sqlite"),
});

export const env = envSchema.parse(process.env);
