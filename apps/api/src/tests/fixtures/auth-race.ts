// Runs in its own process/thread pool. Never imports the personal database.
import assert from "node:assert/strict";
import { createHook } from "node:async_hooks";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const directory = await mkdtemp(join(tmpdir(), "finance-auth-race-"));
process.env.DATABASE_URL = `file:${join(directory, "test.sqlite")}`;
const { db, closeDatabase } = await import("../../db");
const { households, sessions, users } = await import("../../db/schema");
const { provisionUser, login, changePassword } = await import("../../services/auth-service");
const password = "Synthetic-Old-Password-123!";
const newPassword = "Synthetic-New-Password-123!";
const mode = process.argv[2];
let hook: ReturnType<typeof createHook> | undefined;
try {
  migrate(db, { migrationsFolder: fileURLToPath(new URL("../../../drizzle", import.meta.url)) });
  db.insert(households).values({ id: "home", name: "Synthetic house" }).run();
  const account = {
    email: "race@example.invalid",
    name: "Synthetic User",
    password,
    householdId: "home",
    role: "owner" as const,
  };
  await provisionUser(account);
  const initial = await login(account.email, password);
  if (mode === "change-password") {
    let jobs = 0;
    let started: () => void = () => {
      throw new Error("Missing barrier");
    };
    const hashingNewPassword = new Promise<void>((resolve) => {
      started = resolve;
    });
    hook = createHook({
      init(_id, type) {
        if (type === "SCRYPTREQUEST" && ++jobs === 2) started();
      },
    }).enable();
    const reset = changePassword(initial.identity, password, newPassword);
    // The new hash is queued ahead of the stale login's verification.
    await hashingNewPassword;
    const stale = login(account.email, password);
    const rejection = assert.rejects(stale, { statusCode: 401 });
    await reset;
    await rejection;
  } else if (mode === "provision") {
    let started: () => void = () => {
      throw new Error("Missing barrier");
    };
    const hashingNewPassword = new Promise<void>((resolve) => {
      started = resolve;
    });
    hook = createHook({
      init(_id, type) {
        if (type === "SCRYPTREQUEST") started();
      },
    }).enable();
    const reset = provisionUser({ ...account, password: newPassword });
    await hashingNewPassword;
    const stale = login(account.email, password);
    const rejection = assert.rejects(stale, { statusCode: 401 });
    await reset;
    await rejection;
  } else if (mode === "deactivate") {
    const stale = login(account.email, password);
    const rejection = assert.rejects(stale, { statusCode: 401 });
    db.update(users).set({ isActive: false }).run();
    await rejection;
    assert.equal(db.select().from(sessions).all().length, 1); // Only the pre-existing session.
    console.log("Race regression passed: inactive user cannot create a session.");
    process.exitCode = 0;
  } else {
    throw new Error("Unknown race scenario");
  }
  if (mode !== "deactivate") {
    assert.equal(
      db.select().from(sessions).all().length,
      0,
      "No stale session may survive the reset",
    );
    const current = await login(account.email, newPassword);
    assert.equal(current.identity.email, account.email);
    console.log(`Race regression passed: ${mode}`);
  }
} finally {
  hook?.disable();
  closeDatabase();
  await rm(directory, { recursive: true, force: true });
}
