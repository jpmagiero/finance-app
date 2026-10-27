import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

test("readiness rejects an unmigrated database and accepts the migrated schema", async () => {
  const folder = await mkdtemp(join(tmpdir(), "finance-health-"));
  process.env.DATABASE_URL = `file:${join(folder, "test.sqlite")}`;
  const { buildApp } = await import("../app");
  const { db, closeDatabase } = await import("../db");
  const app = await buildApp();
  try {
    assert.equal((await app.inject("/health/")).statusCode, 200);
    assert.equal((await app.inject("/health/ready")).statusCode, 503);
    migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    assert.equal((await app.inject("/health/ready")).statusCode, 200);
  } finally {
    await app.close();
    closeDatabase();
    await rm(folder, { recursive: true, force: true });
  }
});
