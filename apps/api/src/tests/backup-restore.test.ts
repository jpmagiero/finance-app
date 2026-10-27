import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createBackup, restoreBackup, verifyBackup } from "../services/backup-service";

async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), "finance-backup-test-"));
  const path = join(folder, "live.sqlite");
  const client = new Database(path);
  client.pragma("foreign_keys=ON");
  client.pragma("journal_mode=WAL");
  client.pragma("wal_autocheckpoint=0");
  migrate(drizzle(client), {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });
  client.exec(`
    INSERT INTO households(id,name) VALUES('home','Synthetic house');
    INSERT INTO users(id,name,email,password_hash) VALUES('user','Synthetic user','backup@example.invalid','synthetic-hash');
    INSERT INTO household_members(id,household_id,user_id,role) VALUES('member','home','user','owner');
    INSERT INTO household_people(id,household_id,user_id,name) VALUES('person','home','user','Synthetic person');
    INSERT INTO settings(id,household_id) VALUES('settings','home');
    INSERT INTO accounts(id,household_id,name,type,initial_balance_cents,current_balance_cents) VALUES('account','home','Synthetic bank','checking',1000,1500);
    INSERT INTO transactions(id,household_id,account_id,person_id,created_by_user_id,type,status,amount_cents,transaction_date)
      VALUES('transaction','home','account','person','user','income','confirmed',500,'2026-10-26');
    INSERT INTO transaction_splits(id,transaction_id,amount_cents) VALUES('split','transaction',500);
    INSERT INTO tags(id,household_id,name) VALUES('tag','home','Synthetic tag');
    INSERT INTO transaction_tags(transaction_id,tag_id) VALUES('transaction','tag');
  `);
  return {
    folder,
    path,
    client,
    async close() {
      client.close();
      await rm(folder, { recursive: true, force: true });
    },
  };
}

test("online backup captures WAL writes and restores IDs, links, hashes and balances", async () => {
  const data = await fixture();
  try {
    const snapshot = await createBackup(data.path, join(data.folder, "backups"));
    verifyBackup(snapshot);
    const restored = await restoreBackup(snapshot, join(data.folder, "restored.sqlite"));
    const copy = new Database(restored, { readonly: true });
    try {
      for (const table of [
        "households",
        "users",
        "household_people",
        "household_members",
        "settings",
        "accounts",
        "transactions",
        "transaction_splits",
        "tags",
        "transaction_tags",
      ]) {
        assert.deepEqual(
          copy.prepare(`SELECT * FROM ${table}`).all(),
          data.client.prepare(`SELECT * FROM ${table}`).all(),
        );
      }
      assert.equal(
        (
          copy.prepare("SELECT current_balance_cents AS balance FROM accounts").get() as {
            balance: number;
          }
        ).balance,
        1500,
      );
      assert.deepEqual(copy.pragma("foreign_key_check"), []);
    } finally {
      copy.close();
    }
  } finally {
    await data.close();
  }
});
test("restore never overwrites an existing database or the source snapshot", async () => {
  const data = await fixture();
  try {
    const snapshot = await createBackup(data.path, join(data.folder, "backups"));
    const before = await readFile(snapshot);
    await assert.rejects(restoreBackup(snapshot, data.path), { code: "EEXIST" });
    await assert.rejects(restoreBackup(snapshot, snapshot), /diferentes/);
    assert.deepEqual(await readFile(snapshot), before);
    assert.equal(
      (data.client.prepare("SELECT count(*) AS count FROM transactions").get() as { count: number })
        .count,
      1,
    );
  } finally {
    await data.close();
  }
});
test("retention only removes owned snapshots after a successful new backup", async () => {
  const data = await fixture();
  try {
    const folder = join(data.folder, "backups");
    await createBackup(data.path, folder, 2);
    await createBackup(data.path, folder, 2);
    await writeFile(join(folder, "unrelated.sqlite"), "keep me");
    await createBackup(data.path, folder, 2);
    assert.equal((await readdir(folder)).filter((name) => name.startsWith("finance-")).length, 2);
    await assert.rejects(createBackup(join(data.folder, "missing.sqlite"), folder, 1));
    assert.equal((await readdir(folder)).filter((name) => name.startsWith("finance-")).length, 2);
    assert.equal(await readFile(join(folder, "unrelated.sqlite"), "utf8"), "keep me");
  } finally {
    await data.close();
  }
});
test("corrupt or unrelated backups are rejected before creating a destination", async () => {
  const folder = await mkdtemp(join(tmpdir(), "finance-corrupt-backup-"));
  try {
    const source = join(folder, "bad.sqlite");
    await writeFile(source, "not a database");
    await assert.rejects(restoreBackup(source, join(folder, "target.sqlite")));
    assert.deepEqual(await readdir(folder), ["bad.sqlite"]);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
