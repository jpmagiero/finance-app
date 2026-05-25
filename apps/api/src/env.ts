import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().default("file:./data/app.sqlite"),
});

export const env = envSchema.parse(process.env);
