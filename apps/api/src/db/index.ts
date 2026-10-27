import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "../env";
import * as schema from "./schema";

const databasePath = env.DATABASE_URL.startsWith("file:")
  ? env.DATABASE_URL.replace("file:", "")
  : env.DATABASE_URL;

const sqlite = new Database(databasePath);
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, {
  schema,
});

export function closeDatabase() {
  sqlite.close();
}
