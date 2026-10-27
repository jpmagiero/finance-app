import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  accounts,
  categories,
  householdMembers,
  householdPeople,
  households,
  payees,
  recurringSplits,
  recurringTags,
  recurringTransactions,
  tags,
  transactionSplits,
  transactions,
  transactionTags,
  users,
} from "../db/schema";
import { occurrenceDates } from "../lib/recurrence-dates";

test("monthly anchors clamp to month end without drifting", () => {
  assert.deepEqual(
    occurrenceDates(
      { startsAt: "2025-01-31", frequency: "monthly", interval: 1 },
      "2025-01-01",
      "2025-04-30",
    ),
    ["2025-01-31", "2025-02-28", "2025-03-31", "2025-04-30"],
  );
  assert.deepEqual(
    occurrenceDates(
      { startsAt: "2024-01-30", frequency: "monthly", interval: 1 },
      "2024-02-01",
      "2024-03-30",
    ),
    ["2024-02-29", "2024-03-30"],
  );
});
test("yearly February 29 retains the original leap-day anchor", () => {
  assert.deepEqual(
    occurrenceDates(
      { startsAt: "2024-02-29", frequency: "yearly", interval: 1 },
      "2025-01-01",
      "2028-12-31",
    ),
    ["2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"],
  );
});
test("intervals are anchored at startsAt across years and range clipping", () => {
  assert.deepEqual(
    occurrenceDates(
      { startsAt: "2025-11-30", endsAt: "2026-05-30", frequency: "monthly", interval: 2 },
      "2025-12-01",
      "2026-12-31",
    ),
    ["2026-01-30", "2026-03-30", "2026-05-30"],
  );
  assert.deepEqual(
    occurrenceDates(
      { startsAt: "2026-01-07", frequency: "weekly", interval: 2 },
      "2026-01-08",
      "2026-02-10",
    ),
    ["2026-01-21", "2026-02-04"],
  );
});
test("daily scheduling handles ancient starts and business dates without timezone drift", () => {
  assert.deepEqual(
    occurrenceDates(
      { startsAt: "0001-01-01", frequency: "daily", interval: 1 },
      "2026-10-25",
      "2026-10-27",
    ),
    ["2026-10-25", "2026-10-26", "2026-10-27"],
  );
  assert.deepEqual(
    occurrenceDates(
      { startsAt: "9999-12-31", frequency: "monthly", interval: 1 },
      "9999-12-01",
      "9999-12-31",
    ),
    ["9999-12-31"],
  );
  assert.deepEqual(
    occurrenceDates(
      { startsAt: "2026-10-26", endsAt: "2026-10-26", frequency: "daily", interval: 1 },
      "2026-10-25",
      "2026-10-27",
    ),
    ["2026-10-26"],
  );
});

const folder = await mkdtemp(join(tmpdir(), "finance-recurring-"));
process.env.DATABASE_URL = `file:${join(folder, "test.sqlite")}`;
const { db, closeDatabase } = await import("../db");
const { buildApp } = await import("../app");
const { hashPassword } = await import("../services/auth-service");
const { getTransaction } = await import("../services/transactions-service");
migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
const password = "Synthetic-Password-123!";
const passwordHash = await hashPassword(password);
const app = await buildApp({ logger: false });
let cookie = "",
  csrf = "",
  address = 0;
async function request(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload?: unknown,
  expected = 200,
  headers?: Record<string, string>,
) {
  const response = await app.inject({
    method,
    url,
    payload: payload as Record<string, unknown> | undefined,
    remoteAddress: `127.0.0.${address}`,
    headers: headers ?? { cookie, "x-csrf-token": csrf },
  });
  assert.equal(response.statusCode, expected, response.body);
  return expected === 204 ? undefined : response.json();
}
async function signIn(email = "owner@example.invalid") {
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
    remoteAddress: `127.0.0.${address}`,
  });
  assert.equal(response.statusCode, 200, response.body);
  cookie = String(response.headers["set-cookie"]).split(";")[0] ?? "";
  csrf = response.json().csrfToken;
}
beforeEach(async () => {
  address++;
  db.delete(households).run();
  db.delete(users).run();
  db.insert(households)
    .values([
      { id: "home", name: "Synthetic house" },
      { id: "foreign", name: "Foreign" },
    ])
    .run();
  db.insert(users)
    .values([
      { id: "owner", name: "Owner", email: "owner@example.invalid", passwordHash },
      { id: "member", name: "Member", email: "member@example.invalid", passwordHash },
    ])
    .run();
  db.insert(householdMembers)
    .values([
      { id: "owner-member", householdId: "home", userId: "owner", role: "owner" },
      { id: "member-member", householdId: "home", userId: "member", role: "member" },
    ])
    .run();
  db.insert(accounts)
    .values({
      id: "bank",
      householdId: "home",
      name: "Synthetic bank",
      type: "checking",
      initialBalanceCents: 10000,
      currentBalanceCents: 10000,
    })
    .run();
  db.insert(householdPeople)
    .values([
      { id: "person", householdId: "home", name: "Synthetic person" },
      { id: "outsider", householdId: "foreign", name: "Outsider" },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: "food", householdId: "home", name: "Food", type: "expense" },
      { id: "other", householdId: "home", name: "Other", type: "expense" },
    ])
    .run();
  db.insert(tags)
    .values([
      { id: "tag", householdId: "home", name: "Tag" },
      { id: "foreign-tag", householdId: "foreign", name: "Foreign" },
    ])
    .run();
  db.insert(payees)
    .values({ id: "payee", householdId: "home", name: "Payee", normalizedName: "payee" })
    .run();
  await signIn();
});
after(async () => {
  await app.close();
  closeDatabase();
  await rm(folder, { recursive: true, force: true });
});
function input(extra: Record<string, unknown> = {}) {
  return {
    householdId: "home",
    personId: "person",
    accountId: "bank",
    payeeId: "payee",
    type: "expense",
    amountCents: 1000,
    description: "Synthetic rent",
    notes: "Keep me",
    frequency: "monthly",
    interval: 1,
    startsAt: "2026-01-31",
    endsAt: null,
    isActive: true,
    splits: [
      { categoryId: "food", amountCents: 600 },
      { categoryId: "other", amountCents: 400 },
    ],
    tagIds: ["tag", "tag"],
    ...extra,
  };
}
const range = { from: "2026-01-01", to: "2026-03-31" };

test("generated pending entries keep full templates, identity and unchanged balances; retries survive edits/deletion", async () => {
  const rule = await request("POST", "/recurring/", input(), 201);
  assert.deepEqual(rule.tagIds, ["tag"]);
  assert.equal(rule.splits.length, 2);
  const preview = await request("POST", `/recurring/${rule.id}/preview`, range);
  assert.deepEqual(
    preview.map((row: { date: string }) => row.date),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
  const generated = await request("POST", `/recurring/${rule.id}/generate`, range);
  assert.equal(generated.created, 3);
  assert.equal(db.select().from(accounts).get()?.currentBalanceCents, 10000);
  const entry = getTransaction(generated.transactionIds[0]);
  assert.equal(entry.status, "pending");
  assert.equal(entry.createdByUserId, "owner");
  assert.equal(entry.isRecurring, true);
  assert.equal(entry.recurringTransactionId, rule.id);
  assert.equal(entry.personId, "person");
  assert.equal(entry.notes, "Keep me");
  assert.deepEqual(entry.tagIds, ["tag"]);
  assert.equal(entry.splits.length, 2);
  await request("PUT", `/transactions/${entry.id}`, {
    ...entry,
    status: "confirmed",
    transactionDate: "2026-02-03",
  });
  assert.equal(db.select().from(accounts).get()?.currentBalanceCents, 9000);
  await request("DELETE", `/transactions/${entry.id}`, undefined, 204);
  assert.equal(db.select().from(accounts).get()?.currentBalanceCents, 10000);
  const repeated = await request("POST", `/recurring/${rule.id}/generate`, range);
  assert.equal(repeated.created, 0);
  assert.equal(repeated.skipped, 3);
  const updated = await request("POST", `/recurring/${rule.id}/preview`, range);
  assert.equal(updated[0].deleted, true);
});

test("generation and template changes roll back every nested write on SQL failure", async () => {
  const rule = await request("POST", "/recurring/", input(), 201);
  db.run(
    sql.raw(
      "CREATE TRIGGER fail_second_occurrence BEFORE INSERT ON transactions WHEN NEW.transaction_date = '2026-02-28' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END",
    ),
  );
  try {
    await request("POST", `/recurring/${rule.id}/generate`, range, 500);
  } finally {
    db.run(sql.raw("DROP TRIGGER fail_second_occurrence"));
  }
  assert.equal(db.select().from(transactions).all().length, 0);
  assert.equal(db.select().from(transactionSplits).all().length, 0);
  assert.equal(db.select().from(transactionTags).all().length, 0);
  assert.equal(db.select().from(accounts).get()?.currentBalanceCents, 10000);
  db.run(
    sql.raw(
      "CREATE TRIGGER fail_recurring_split BEFORE INSERT ON recurring_splits BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END",
    ),
  );
  try {
    await request("PUT", `/recurring/${rule.id}`, input({ description: "Should roll back" }), 500);
  } finally {
    db.run(sql.raw("DROP TRIGGER fail_recurring_split"));
  }
  const original = await request("GET", `/recurring/${rule.id}`);
  assert.equal(original.description, "Synthetic rent");
  assert.equal(original.splits.length, 2);
  assert.deepEqual(original.tagIds, ["tag"]);
});

test("all rule operations enforce household boundaries and CSRF", async () => {
  const own = await request("POST", "/recurring/", input(), 201);
  db.insert(recurringTransactions)
    .values({
      id: "foreign-rule",
      householdId: "foreign",
      type: "expense",
      amountCents: 100,
      frequency: "monthly",
      startsAt: "2026-01-01",
    })
    .run();
  assert.equal((await request("GET", "/recurring/")).length, 1);
  for (const [method, suffix, body] of [
    ["GET", "", undefined],
    ["PUT", "", input()],
    ["PATCH", "/active", { isActive: false }],
    ["POST", "/preview", range],
    ["POST", "/generate", range],
  ] as const)
    await request(method, `/recurring/foreign-rule${suffix}`, body, 404);
  await request("POST", "/recurring/", input({ householdId: "foreign" }), 404);
  await request("POST", "/recurring/", input({ personId: "outsider" }), 404);
  await request("POST", "/recurring/", input({ tagIds: ["foreign-tag"] }), 404);
  await request("POST", `/recurring/${own.id}/generate`, range, 403, { cookie });
  await request("GET", "/recurring/", undefined, 401, {});
});

test("members create, edit, pause, resume and generate without administrative rights", async () => {
  await signIn("member@example.invalid");
  const rule = await request("POST", "/recurring/", input(), 201);
  await request("PUT", `/recurring/${rule.id}`, input({ description: "Member rule" }));
  await request("PATCH", `/recurring/${rule.id}/active`, { isActive: false });
  await request("POST", `/recurring/${rule.id}/generate`, range, 400);
  await request("PATCH", `/recurring/${rule.id}/active`, { isActive: true });
  const generated = await request("POST", `/recurring/${rule.id}/generate`, range);
  assert.equal(getTransaction(generated.transactionIds[0]).createdByUserId, "member");
  await request("PATCH", `/recurring/${rule.id}/active`, { isActive: false });
  assert.equal(db.select().from(transactions).all().length, 3);
});

test("editing a template affects only ungenerated occurrences and persists across app instances", async () => {
  const rule = await request("POST", "/recurring/", input(), 201);
  await request("POST", `/recurring/${rule.id}/generate`, { from: "2026-01-01", to: "2026-01-31" });
  await request(
    "PUT",
    `/recurring/${rule.id}`,
    input({ amountCents: 2000, splits: [{ amountCents: 2000 }], tagIds: [] }),
  );
  const secondApp = await buildApp({ logger: false });
  try {
    const response = await secondApp.inject({
      method: "POST",
      url: `/recurring/${rule.id}/generate`,
      headers: { cookie, "x-csrf-token": csrf },
      payload: range,
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().created, 2);
  } finally {
    await secondApp.close();
  }
  assert.deepEqual(
    db
      .select()
      .from(transactions)
      .orderBy(transactions.transactionDate)
      .all()
      .map((row) => row.amountCents),
    [1000, 2000, 2000],
  );
  assert.equal((await request("POST", `/recurring/${rule.id}/generate`, range)).created, 0);
});

test("archived references block new generation while pausing and history remain available", async () => {
  const rule = await request("POST", "/recurring/", input(), 201);
  db.update(accounts).set({ isArchived: true }).where(eq(accounts.id, "bank")).run();
  await request("POST", `/recurring/${rule.id}/generate`, range, 400);
  assert.equal(db.select().from(transactions).all().length, 0);
  await request("PATCH", `/recurring/${rule.id}/active`, { isActive: false });
  assert.equal((await request("GET", `/recurring/${rule.id}`)).isActive, false);
});

test("payees and tags referenced by paused templates cannot be deleted", async () => {
  await request("POST", "/recurring/", input({ isActive: false }), 201);
  await request("DELETE", "/tags/tag", undefined, 400);
  await request("DELETE", "/payees/payee", undefined, 400);
  await request("PUT", "/categories/food", { type: "income" }, 400);
  await request("PUT", "/accounts/bank", { currency: "USD" }, 400);
  assert.equal(db.select().from(recurringSplits).all().length, 2);
  assert.equal(db.select().from(recurringTags).all().length, 1);
});

test("invalid schedules, amounts and unsupported types are rejected before writes", async () => {
  for (const changes of [
    { startsAt: "2026-02-30" },
    { endsAt: "2025-01-01" },
    { interval: 0 },
    { interval: 121 },
    { type: "transfer" },
    { type: "adjustment" },
    { frequency: "hourly" },
    { amountCents: 999 },
    { autoCreate: true },
  ])
    await request("POST", "/recurring/", input(changes), 400);
  assert.equal(db.select().from(recurringTransactions).all().length, 0);
  const rule = await request("POST", "/recurring/", input(), 201);
  for (const invalid of [
    { from: "2026-01-02", to: "2026-01-01" },
    { from: "2025-01-01", to: "2027-01-01" },
  ])
    await request("POST", `/recurring/${rule.id}/generate`, invalid, 400);
});

test("unique occurrence key prevents duplication independently of mutable transaction dates", async () => {
  const rule = await request("POST", "/recurring/", input(), 201);
  const result = await request("POST", `/recurring/${rule.id}/generate`, range);
  const original = getTransaction(result.transactionIds[0]);
  assert.throws(
    () =>
      db
        .insert(transactions)
        .values({
          id: "duplicate",
          householdId: "home",
          type: "expense",
          status: "pending",
          amountCents: 1000,
          transactionDate: "2027-01-01",
          recurringTransactionId: rule.id,
          occurrenceDate: original.occurrenceDate,
        })
        .run(),
    /UNIQUE/,
  );
});

test("income recurrence and non-overlapping windows preserve inclusive schedule limits", async () => {
  const rule = await request(
    "POST",
    "/recurring/",
    input({
      type: "income",
      splits: [{ amountCents: 1000 }],
      startsAt: "2026-01-01",
      frequency: "weekly",
      interval: 2,
      endsAt: "2026-02-12",
    }),
    201,
  );
  const first = await request("POST", `/recurring/${rule.id}/generate`, {
    from: "2026-01-01",
    to: "2026-01-31",
  });
  const second = await request("POST", `/recurring/${rule.id}/generate`, {
    from: "2026-02-01",
    to: "2026-03-31",
  });
  assert.equal(first.created, 3);
  assert.equal(second.created, 1);
  assert.equal(db.select().from(accounts).get()?.currentBalanceCents, 10000);
});
