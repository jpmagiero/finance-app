import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { budgetPeriodRange } from "@finance/shared";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  accounts,
  budgetItems,
  budgets,
  categories,
  householdMembers,
  householdPeople,
  households,
  settings,
  transactions,
  users,
} from "../db/schema";

const folder = await mkdtemp(join(tmpdir(), "finance-budgets-"));
process.env.DATABASE_URL = `file:${join(folder, "test.sqlite")}`;
const { db, closeDatabase } = await import("../db");
const { buildApp } = await import("../app");
const { hashPassword } = await import("../services/auth-service");
migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
const password = "Synthetic-Password-123!";
const passwordHash = await hashPassword(password);
const app = await buildApp({ logger: false });
let cookie = "",
  csrf = "",
  address = 0;
async function request(
  method: "GET" | "POST" | "PUT" | "DELETE",
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
  db.insert(settings)
    .values({
      id: "config",
      householdId: "home",
      monthlyPeriodStartDay: 15,
      includePendingInReports: false,
      currency: "BRL",
    })
    .run();
  db.insert(users)
    .values([
      { id: "owner", name: "Owner", email: "owner@example.invalid", passwordHash },
      { id: "member", name: "Member", email: "member@example.invalid", passwordHash },
    ])
    .run();
  db.insert(householdMembers)
    .values([
      { id: "o-member", householdId: "home", userId: "owner", role: "owner" },
      { id: "m-member", householdId: "home", userId: "member", role: "member" },
    ])
    .run();
  db.insert(accounts)
    .values([
      {
        id: "bank",
        householdId: "home",
        name: "Synthetic bank",
        type: "checking",
        initialBalanceCents: 1000000,
        currentBalanceCents: 1000000,
      },
      { id: "wallet", householdId: "home", name: "Wallet", type: "cash" },
      { id: "dollar", householdId: "home", name: "Dollar", type: "cash", currency: "USD" },
    ])
    .run();
  db.insert(householdPeople)
    .values([
      { id: "p1", householdId: "home", name: "Person 1" },
      { id: "p2", householdId: "home", name: "Person 2" },
      { id: "outsider", householdId: "foreign", name: "Outsider" },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: "food", householdId: "home", name: "Food", type: "expense" },
      { id: "fun", householdId: "home", name: "Fun", type: "expense" },
      { id: "income", householdId: "home", name: "Income", type: "income" },
      { id: "foreign-category", householdId: "foreign", name: "Foreign", type: "expense" },
    ])
    .run();
  db.insert(categories)
    .values({ id: "child", householdId: "home", name: "Child", type: "expense", parentId: "food" })
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
    personId: null,
    name: "Synthetic budget",
    period: "custom",
    startsAt: "2026-01-01",
    endsAt: "2026-01-31",
    currency: "BRL",
    items: [{ categoryId: "food", limitCents: 120000 }],
    ...extra,
  };
}
async function expense(amountCents = 1000, extra: Record<string, unknown> = {}) {
  return request(
    "POST",
    "/transactions/",
    {
      householdId: "home",
      personId: "p1",
      accountId: "bank",
      type: "expense",
      status: "confirmed",
      amountCents,
      transactionDate: "2026-01-15",
      splits: [{ categoryId: "food", amountCents }],
      ...extra,
    },
    201,
  );
}
async function create(extra: Record<string, unknown> = {}) {
  return request("POST", "/budgets/", input(extra), 201);
}
async function summary(id: string) {
  return request("GET", `/budgets/${id}/summary`);
}

test("household budget totals confirmed and pending expenses, excluding canceled/deleted/income/transfers", async () => {
  await expense(50000);
  await expense(30000, { personId: "p2" });
  await expense(15000, { personId: null, status: "pending" });
  await expense(9000, { status: "canceled" });
  const deleted = await expense(11000);
  await request("DELETE", `/transactions/${deleted.id}`, undefined, 204);
  await expense(10000, { type: "income", splits: [{ amountCents: 10000 }] });
  await expense(10000, {
    type: "transfer",
    transferAccountId: "wallet",
    splits: [{ amountCents: 10000 }],
  });
  await expense(12000, { transactionDate: "2025-12-31" });
  const before = db.select().from(accounts).all();
  const budget = await create();
  const result = await summary(budget.id);
  assert.deepEqual(result.totals, {
    limitCents: 120000,
    confirmedCents: 80000,
    pendingCents: 15000,
    committedCents: 95000,
    remainingCents: 25000,
    exceededCents: 0,
  });
  assert.deepEqual(db.select().from(accounts).all(), before);
});

test("splits consume exact categories without double counting parents, and expose unbudgeted/uncategorized expenses", async () => {
  await expense(20000, {
    splits: [
      { categoryId: "food", amountCents: 6000 },
      { categoryId: "child", amountCents: 4000 },
      { categoryId: "fun", amountCents: 8000 },
      { amountCents: 2000 },
    ],
  });
  const budget = await create({
    items: [
      { categoryId: "food", limitCents: 10000 },
      { categoryId: "child", limitCents: 6000 },
    ],
  });
  const result = await summary(budget.id);
  assert.equal(
    result.items.find((item: { categoryId: string }) => item.categoryId === "food").committedCents,
    6000,
  );
  assert.equal(
    result.items.find((item: { categoryId: string }) => item.categoryId === "child").committedCents,
    4000,
  );
  assert.equal(result.totals.committedCents, 10000);
  assert.equal(result.unbudgetedCents, 10000);
  assert.deepEqual(
    new Set(result.unbudgeted.map((item: { categoryId: string | null }) => item.categoryId)),
    new Set(["fun", null]),
  );
});

test("individual scope filters the financial person while house and individual budgets coexist", async () => {
  await expense(1000);
  await expense(2000, { personId: "p2" });
  await expense(3000, { personId: null });
  const house = await create();
  const person = await create({ personId: "p1" });
  assert.equal((await summary(house.id)).totals.confirmedCents, 6000);
  assert.equal((await summary(person.id)).totals.confirmedCents, 1000);
});

test("currency buckets include accountless house-currency expenses without mixing foreign accounts", async () => {
  await expense(1000, { accountId: null });
  await expense(2000, { accountId: "dollar" });
  await expense(3000);
  const brl = await create();
  const usd = await create({ currency: "USD" });
  assert.equal((await summary(brl.id)).totals.confirmedCents, 4000);
  assert.equal((await summary(brl.id)).excludedCurrencyCount, 1);
  assert.equal((await summary(usd.id)).totals.confirmedCents, 2000);
  assert.equal((await summary(usd.id)).excludedCurrencyCount, 2);
});

test("monthly financial windows include both boundaries and retain saved dates after settings changes", async () => {
  await expense(100, { transactionDate: "2026-01-14" });
  await expense(200, { transactionDate: "2026-01-15" });
  await expense(300, { transactionDate: "2026-02-14" });
  await expense(400, { transactionDate: "2026-02-15" });
  const range = budgetPeriodRange("monthly", "2026-01", 15);
  const budget = await create({ period: "monthly", ...range });
  assert.equal((await summary(budget.id)).totals.confirmedCents, 500);
  db.update(settings).set({ monthlyPeriodStartDay: 20 }).where(eq(settings.id, "config")).run();
  await request(
    "PUT",
    `/budgets/${budget.id}`,
    input({ period: "monthly", ...range, name: "Historical window" }),
  );
  assert.equal((await summary(budget.id)).budget.endsAt, "2026-02-14");
  await request(
    "POST",
    "/budgets/",
    input({ period: "monthly", startsAt: "2026-03-15", endsAt: "2026-04-14" }),
    400,
  );
  const next = await create({ period: "monthly", ...budgetPeriodRange("monthly", "2026-03", 20) });
  assert.equal(next.startsAt, "2026-03-20");
  assert.deepEqual(budgetPeriodRange("monthly", "2024-02", 1), {
    startsAt: "2024-02-01",
    endsAt: "2024-02-29",
  });
  assert.deepEqual(budgetPeriodRange("yearly", "2024"), {
    startsAt: "2024-01-01",
    endsAt: "2024-12-31",
  });
});

test("overlap prevention covers inclusive boundaries, with different categories/people/currencies allowed", async () => {
  const budget = await create();
  await request("POST", "/budgets/", input({ name: "Duplicate" }), 400);
  await request("POST", "/budgets/", input({ startsAt: "2026-01-31", endsAt: "2026-02-20" }), 400);
  await create({ startsAt: "2026-02-01", endsAt: "2026-02-28" });
  await create({ items: [{ categoryId: "fun", limitCents: 1000 }] });
  await create({ personId: "p1" });
  await create({ currency: "USD" });
  await request("PUT", `/budgets/${budget.id}`, input({ name: "Rename is allowed" }));
});

test("archive preserves items, transactions and balances; restore rechecks active overlaps", async () => {
  await expense();
  const budget = await create();
  const balance = db.select().from(accounts).all();
  await request("DELETE", `/budgets/${budget.id}`, undefined, 204);
  assert.equal((await request("GET", "/budgets/")).length, 0);
  assert.equal((await request("GET", "/budgets/?includeArchived=true")).length, 1);
  assert.equal(db.select().from(budgetItems).all().length, 1);
  const other = await create();
  await request("POST", `/budgets/${budget.id}/restore`, undefined, 400);
  await request("DELETE", `/budgets/${other.id}`, undefined, 204);
  const restored = await request("POST", `/budgets/${budget.id}/restore`);
  assert.equal(restored.isArchived, false);
  assert.equal((await summary(budget.id)).totals.confirmedCents, 1000);
  assert.deepEqual(db.select().from(accounts).all(), balance);
});

test("create and replacement roll back all item writes on late SQL failure", async () => {
  const budget = await create();
  db.run(
    sql.raw(
      "CREATE TRIGGER fail_budget_item BEFORE INSERT ON budget_items WHEN NEW.category_id='fun' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END",
    ),
  );
  try {
    await request(
      "PUT",
      `/budgets/${budget.id}`,
      input({
        name: "Should roll back",
        items: [
          { categoryId: "food", limitCents: 5000 },
          { categoryId: "fun", limitCents: 5000 },
        ],
      }),
      500,
    );
    await request(
      "POST",
      "/budgets/",
      input({
        personId: "p1",
        items: [
          { categoryId: "food", limitCents: 5000 },
          { categoryId: "fun", limitCents: 5000 },
        ],
      }),
      500,
    );
  } finally {
    db.run(sql.raw("DROP TRIGGER fail_budget_item"));
  }
  assert.equal(db.select().from(budgets).all().length, 1);
  const original = await request("GET", `/budgets/${budget.id}`);
  assert.equal(original.name, "Synthetic budget");
  assert.deepEqual(original.items, [{ categoryId: "food", limitCents: 120000 }]);
});

test("validation rejects invalid dates, repeated or non-expense categories, foreign references and unsafe limits", async () => {
  for (const change of [
    { name: "" },
    { startsAt: "2026-02-30" },
    { endsAt: "2025-01-01" },
    { period: "monthly" },
    { period: "yearly", endsAt: "2026-06-30" },
    { currency: "brl" },
    { items: [] },
    { items: [{ categoryId: "food", limitCents: 0 }] },
    { items: [{ categoryId: "food", limitCents: 1.5 }] },
    { items: [{ categoryId: "food", limitCents: Number.MAX_SAFE_INTEGER + 1 }] },
    {
      items: [
        { categoryId: "food", limitCents: Number.MAX_SAFE_INTEGER },
        { categoryId: "fun", limitCents: 1 },
      ],
    },
    {
      items: [
        { categoryId: "food", limitCents: 1 },
        { categoryId: "food", limitCents: 2 },
      ],
    },
    { items: [{ categoryId: "income", limitCents: 100 }] },
    { isArchived: true },
  ])
    await request("POST", "/budgets/", input(change), 400);
  await request("POST", "/budgets/", input({ personId: "outsider" }), 404);
  await request(
    "POST",
    "/budgets/",
    input({ items: [{ categoryId: "foreign-category", limitCents: 100 }] }),
    404,
  );
  assert.equal(db.select().from(budgets).all().length, 0);
});

test("all routes enforce house, membership and CSRF; members can manage budgets", async () => {
  const own = await create();
  db.insert(budgets)
    .values({
      id: "foreign-budget",
      householdId: "foreign",
      name: "Foreign",
      period: "custom",
      startsAt: "2026-01-01",
      endsAt: "2026-01-31",
    })
    .run();
  assert.equal((await request("GET", "/budgets/?includeArchived=true")).length, 1);
  for (const [method, suffix, body] of [
    ["GET", "", undefined],
    ["GET", "/summary", undefined],
    ["PUT", "", input()],
    ["DELETE", "", undefined],
    ["POST", "/restore", undefined],
  ] as const)
    await request(method, `/budgets/foreign-budget${suffix}`, body, 404);
  await request("POST", "/budgets/", input({ householdId: "foreign" }), 404);
  await request("GET", "/budgets/", undefined, 401, {});
  await request("PUT", `/budgets/${own.id}`, input(), 403, { cookie });
  await signIn("member@example.invalid");
  const member = await create({ personId: "p1" });
  await request("PUT", `/budgets/${member.id}`, input({ personId: "p1", name: "Member plan" }));
  await summary(member.id);
  await request("DELETE", `/budgets/${member.id}`, undefined, 204);
  await request("POST", `/budgets/${member.id}/restore`);
});

test("category type is preserved for budgets and archived references may remain in existing plans", async () => {
  const budget = await create({ personId: "p1" });
  await request("PUT", "/categories/food", { type: "income" }, 400);
  db.update(categories).set({ isArchived: true }).where(eq(categories.id, "food")).run();
  db.update(householdPeople).set({ isActive: false }).where(eq(householdPeople.id, "p1")).run();
  await request("POST", "/budgets/", input({ personId: "p1" }), 400);
  await request(
    "PUT",
    `/budgets/${budget.id}`,
    input({ personId: "p1", name: "Historical references" }),
  );
  assert.equal((await summary(budget.id)).budget.name, "Historical references");
});

test("over-limit totals stay exact and unsafe consumption returns an error without writes", async () => {
  const budget = await create({ items: [{ categoryId: "food", limitCents: 1000 }] });
  await expense(1500);
  assert.equal((await summary(budget.id)).totals.remainingCents, -500);
  assert.equal((await summary(budget.id)).totals.exceededCents, 500);
  await expense(Number.MAX_SAFE_INTEGER, { accountId: null });
  await request("GET", `/budgets/${budget.id}/summary`, undefined, 400);
  assert.equal(db.select().from(transactions).all().length, 2);
  assert.equal((await request("GET", `/budgets/${budget.id}`)).items[0].limitCents, 1000);
});

test("yearly/custom windows and budget reads remain stable across application instances", async () => {
  const budget = await create({ period: "yearly", ...budgetPeriodRange("yearly", "2026") });
  await expense(2000, { transactionDate: "2026-12-31" });
  await expense(1000, { transactionDate: "2027-01-01" });
  const another = await buildApp({ logger: false });
  try {
    const response = await another.inject({
      method: "GET",
      url: `/budgets/${budget.id}/summary`,
      headers: { cookie },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().totals.confirmedCents, 2000);
  } finally {
    await another.close();
  }
});
