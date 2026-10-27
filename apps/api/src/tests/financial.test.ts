import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createTransactionSchema } from "@finance/shared";
import Database from "better-sqlite3";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  accounts,
  categories,
  householdMembers,
  householdPeople,
  households,
  payees,
  sessions,
  settings,
  tags,
  transactionSplits,
  transactions,
  transactionTags,
  users,
} from "../db/schema";

// Set the isolated URL BEFORE importing app/db/env. Never load the personal .env.
const directory = await mkdtemp(join(tmpdir(), "finance-api-test-"));
process.env.DATABASE_URL = `file:${join(directory, "test.sqlite")}`;
const { db, closeDatabase } = await import("../db");
const { buildApp } = await import("../app");
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
migrate(db, { migrationsFolder });
const app = await buildApp({ logger: false });
await app.ready();

after(async () => {
  await app.close();
  closeDatabase();
  await rm(directory, { recursive: true, force: true });
});

beforeEach(() => {
  db.run(sql.raw("DROP TRIGGER IF EXISTS fail_split"));
  db.run(sql.raw("DROP TRIGGER IF EXISTS fail_tag"));
  db.run(sql.raw("DROP TRIGGER IF EXISTS fail_balance"));
  db.delete(households).run();
  db.insert(households)
    .values([
      { id: "home", name: "Casa teste" },
      { id: "other", name: "Outra casa" },
    ])
    .run();
  db.insert(settings).values({ id: "settings", householdId: "home" }).run();
  if (!db.select().from(users).where(eq(users.id, "tester")).get())
    db.insert(users).values({ id: "tester", name: "Test", email: "test@example.invalid" }).run();
  db.insert(householdMembers)
    .values({ id: "test-member", householdId: "home", userId: "tester", role: "owner" })
    .run();
  db.insert(sessions)
    .values({
      id: "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb",
      userId: "tester",
      householdId: "home",
      csrfToken: "test-csrf",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    })
    .run();
});

type Payload = Record<string, unknown>;
async function request(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: Payload,
  status = 200,
) {
  const response = await app.inject({
    method,
    url,
    payload,
    headers: { cookie: `finance_session=${"a".repeat(64)}`, "x-csrf-token": "test-csrf" },
  });
  assert.equal(response.statusCode, status, response.body);
  return response.statusCode === 204 ? undefined : response.json();
}
async function account(initialBalanceCents = 10000, extra: Payload = {}) {
  return request(
    "POST",
    "/accounts/",
    { householdId: "home", name: "Conta", type: "checking", initialBalanceCents, ...extra },
    201,
  );
}
function payload(extra: Payload = {}): Payload {
  return {
    householdId: "home",
    type: "expense",
    amountCents: 1000,
    transactionDate: "2026-10-26",
    splits: [{ amountCents: 1000 }],
    ...extra,
  };
}
async function create(extra: Payload = {}) {
  return request("POST", "/transactions/", payload(extra), 201);
}
function balance(id: string) {
  return db.select().from(accounts).where(eq(accounts.id, id)).get()?.currentBalanceCents;
}
async function balances(expected: [string, number][]) {
  for (const [id, value] of expected) {
    assert.equal(balance(id), value);
    const recalculated = await request("POST", `/accounts/${id}/recalculate-balance`);
    assert.equal(recalculated.currentBalanceCents, value);
  }
}
function snapshot() {
  return {
    accounts: db.select().from(accounts).all(),
    transactions: db.select().from(transactions).all(),
    splits: db.select().from(transactionSplits).all(),
    tags: db.select().from(transactionTags).all(),
  };
}

test("boot, health and OpenAPI expose the financial routes", async () => {
  await request("GET", "/health/");
  const docs = await request("GET", "/docs/json");
  assert.ok(docs.paths["/transactions/"]);
  assert.ok(docs.paths["/accounts/{id}/recalculate-balance"]);
});

for (const type of ["income", "expense"] as const) {
  for (const status of ["pending", "confirmed", "canceled"] as const) {
    test(`${type} / ${status}: account effects and accountless reporting`, async () => {
      const a = await account();
      await create({ type, status, accountId: a.id });
      const delta = status === "confirmed" ? (type === "income" ? 1000 : -1000) : 0;
      await balances([[a.id, 10000 + delta]]);
      const unassigned = await create({ type, status });
      assert.equal(unassigned.accountId, null);
      assert.equal(unassigned.personId, null);
      assert.equal(unassigned.payeeId, null);
      await balances([[a.id, 10000 + delta]]);
      const list = await request("GET", "/transactions/?householdId=home");
      assert.equal(list.length, 2);
    });
  }
}

for (const oldStatus of ["pending", "confirmed", "canceled"]) {
  for (const status of ["pending", "confirmed", "canceled"]) {
    test(`status transition ${oldStatus} -> ${status} applies exactly once`, async () => {
      const a = await account();
      const t = await create({ accountId: a.id, status: oldStatus });
      await request("PUT", `/transactions/${t.id}`, payload({ accountId: a.id, status }));
      await balances([[a.id, status === "confirmed" ? 9000 : 10000]]);
    });
  }
}

test("editing amount, account and type reverses the old movement", async () => {
  const a = await account();
  const b = await account(20000);
  const t = await create({ accountId: a.id });
  await request(
    "PUT",
    `/transactions/${t.id}`,
    payload({
      amountCents: 2500,
      splits: [{ amountCents: 2500 }],
      type: "income",
      accountId: b.id,
    }),
  );
  await balances([
    [a.id, 10000],
    [b.id, 22500],
  ]);
});

for (const status of ["pending", "confirmed", "canceled"]) {
  test(`transfer / ${status}: creation, edit, account change and delete`, async () => {
    const a = await account();
    const b = await account(20000);
    const c = await account(30000);
    const t = await create({ type: "transfer", accountId: a.id, transferAccountId: b.id, status });
    await balances([
      [a.id, status === "confirmed" ? 9000 : 10000],
      [b.id, status === "confirmed" ? 21000 : 20000],
    ]);
    await request(
      "PUT",
      `/transactions/${t.id}`,
      payload({
        type: "transfer",
        accountId: b.id,
        transferAccountId: c.id,
        amountCents: 2000,
        splits: [{ amountCents: 2000 }],
        status: "confirmed",
      }),
    );
    await balances([
      [a.id, 10000],
      [b.id, 18000],
      [c.id, 32000],
    ]);
    await request("DELETE", `/transactions/${t.id}`, undefined, 204);
    await balances([
      [a.id, 10000],
      [b.id, 20000],
      [c.id, 30000],
    ]);
  });
}

test("changing expense to transfer and back preserves both balances", async () => {
  const a = await account();
  const b = await account();
  const t = await create({ accountId: a.id });
  await request(
    "PUT",
    `/transactions/${t.id}`,
    payload({ type: "transfer", accountId: a.id, transferAccountId: b.id }),
  );
  await balances([
    [a.id, 9000],
    [b.id, 11000],
  ]);
  await request("PUT", `/transactions/${t.id}`, payload({ type: "income", accountId: b.id }));
  await balances([
    [a.id, 10000],
    [b.id, 11000],
  ]);
});

for (const status of ["pending", "confirmed", "canceled"]) {
  test(`soft delete ${status} and repeated delete never reverse twice`, async () => {
    const a = await account();
    const t = await create({ accountId: a.id, status });
    await request("DELETE", `/transactions/${t.id}`, undefined, 204);
    await request("DELETE", `/transactions/${t.id}`, undefined, 404);
    await request("GET", `/transactions/${t.id}`, undefined, 404);
    assert.deepEqual(await request("GET", "/transactions/?householdId=home"), []);
    assert.ok(db.select().from(transactions).where(eq(transactions.id, t.id)).get()?.deletedAt);
    await balances([[a.id, 10000]]);
  });
}

test("splits and deduplicated tags are replaced with the transaction", async () => {
  const a = await account();
  db.insert(categories)
    .values({ id: "cat", householdId: "home", name: "Mercado", type: "expense" })
    .run();
  db.insert(tags)
    .values([
      { id: "tag1", householdId: "home", name: "Tag 1" },
      { id: "tag2", householdId: "home", name: "Tag 2" },
    ])
    .run();
  const t = await create({
    accountId: a.id,
    splits: [{ categoryId: "cat", amountCents: 400 }, { amountCents: 600 }],
    tagIds: ["tag1", "tag1"],
  });
  assert.deepEqual(t.tagIds, ["tag1"]);
  const updated = await request(
    "PUT",
    `/transactions/${t.id}`,
    payload({ accountId: a.id, splits: [{ amountCents: 1000 }], tagIds: ["tag2"] }),
  );
  assert.equal(updated.splits.length, 1);
  assert.deepEqual(updated.tagIds, ["tag2"]);
  await balances([[a.id, 9000]]);
});

for (const reference of ["person", "account", "destination", "payee", "category", "tag"]) {
  test(`rejects a ${reference} from another household without any writes`, async () => {
    const a = await account();
    const foreign = "foreign";
    let extra: Payload = {};
    if (reference === "person") {
      db.insert(householdPeople)
        .values({ id: foreign, householdId: "other", name: "Outra pessoa" })
        .run();
      extra = { personId: foreign };
    } else if (reference === "account" || reference === "destination") {
      db.insert(accounts)
        .values({ id: foreign, householdId: "other", name: "Outra conta", type: "checking" })
        .run();
      extra =
        reference === "account"
          ? { accountId: foreign }
          : { type: "transfer", transferAccountId: foreign };
    } else if (reference === "payee") {
      db.insert(payees)
        .values({ id: foreign, householdId: "other", name: "Outro", normalizedName: "outro" })
        .run();
      extra = { payeeId: foreign };
    } else if (reference === "category") {
      db.insert(categories)
        .values({ id: foreign, householdId: "other", name: "Outra", type: "expense" })
        .run();
      extra = { splits: [{ categoryId: foreign, amountCents: 1000 }] };
    } else {
      db.insert(tags).values({ id: foreign, householdId: "other", name: "Outra" }).run();
      extra = { tagIds: [foreign] };
    }
    const before = snapshot();
    await request("POST", "/transactions/", payload({ accountId: a.id, ...extra }), 404);
    assert.deepEqual(snapshot(), before);
  });
}

test("household is immutable when replacing a transaction", async () => {
  const a = await account();
  const t = await create({ accountId: a.id });
  const before = snapshot();
  await request("PUT", `/transactions/${t.id}`, payload({ householdId: "other" }), 400);
  assert.deepEqual(snapshot(), before);
});

test("adjustments are rejected until their financial meaning is defined", async () => {
  const before = snapshot();
  await request("POST", "/transactions/", payload({ type: "adjustment" }), 400);
  assert.deepEqual(snapshot(), before);
});

test("initial balance changes recompute current balance; current balance is read-only", async () => {
  await request(
    "POST",
    "/accounts/",
    { householdId: "home", name: "Conta", type: "checking", currentBalanceCents: 42 },
    400,
  );
  const a = await account();
  await create({ accountId: a.id });
  await request("PUT", `/accounts/${a.id}`, { initialBalanceCents: 20000 });
  await balances([[a.id, 19000]]);
  await request("PUT", `/accounts/${a.id}`, { currentBalanceCents: 1 }, 400);
  await balances([[a.id, 19000]]);
});

test("recalculation repairs a corrupted cache", async () => {
  const a = await account();
  await create({ accountId: a.id });
  db.update(accounts).set({ currentBalanceCents: 123 }).where(eq(accounts.id, a.id)).run();
  assert.equal(
    (await request("POST", `/accounts/${a.id}/recalculate-balance`)).currentBalanceCents,
    9000,
  );
});

test("transfers between legacy accounts with different currencies are rejected", async () => {
  const a = await account();
  db.insert(accounts)
    .values({ id: "usd", householdId: "home", name: "Dollar", type: "checking", currency: "USD" })
    .run();
  const before = snapshot();
  await request(
    "POST",
    "/transactions/",
    payload({ type: "transfer", accountId: a.id, transferAccountId: "usd" }),
    400,
  );
  assert.deepEqual(snapshot(), before);
});

for (const date of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-00-01", "0000-01-01"]) {
  test(`invalid calendar date ${date} rejected for transaction and competence`, async () => {
    await request("POST", "/transactions/", payload({ transactionDate: date }), 400);
    await request("POST", "/transactions/", payload({ competenceDate: date }), 400);
  });
}
test("leap day is accepted and reversed date ranges / invalid months are rejected", async () => {
  await create({ transactionDate: "2024-02-29" });
  await request(
    "GET",
    "/transactions/?householdId=home&from=2026-10-27&to=2026-10-26",
    undefined,
    400,
  );
  await request("GET", "/transactions/?householdId=home&from=2026-02-30", undefined, 400);
  await request("GET", "/dashboard/monthly?householdId=home&month=2026-13", undefined, 400);
});

test("unsafe numbers, zero, fractions, invalid splits and invalid transfer shapes are rejected", async () => {
  for (const amountCents of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await request(
      "POST",
      "/transactions/",
      payload({ amountCents, splits: [{ amountCents }] }),
      400,
    );
  }
  await request("POST", "/transactions/", payload({ splits: [{ amountCents: 999 }] }), 400);
  await request("POST", "/transactions/", payload({ splits: [] }), 400);
  const a = await account();
  for (const extra of [
    { type: "transfer" },
    { type: "transfer", accountId: a.id, transferAccountId: a.id },
    { transferAccountId: a.id },
  ])
    await request("POST", "/transactions/", payload(extra), 400);
  assert.equal(
    createTransactionSchema.safeParse(
      payload({
        amountCents: Number.MAX_SAFE_INTEGER + 1,
        splits: [{ amountCents: Number.MAX_SAFE_INTEGER + 1 }],
      }),
    ).success,
    false,
  );
});

test("overflow in transfer destination rolls back origin and transaction", async () => {
  const a = await account();
  const b = await account(Number.MAX_SAFE_INTEGER);
  const before = snapshot();
  await request(
    "POST",
    "/transactions/",
    payload({ type: "transfer", accountId: a.id, transferAccountId: b.id }),
    400,
  );
  assert.deepEqual(snapshot(), before);
});

for (const operation of ["create", "edit", "delete"]) {
  test(`late SQL failure rolls back ${operation}, related rows and both balances`, async () => {
    const a = await account();
    const b = await account(20000);
    db.insert(tags).values({ id: "tag", householdId: "home", name: "Tag" }).run();
    const t =
      operation === "create"
        ? undefined
        : await create({
            type: "transfer",
            accountId: a.id,
            transferAccountId: b.id,
            tagIds: ["tag"],
          });
    const before = snapshot();
    if (operation === "delete") {
      db.run(
        sql.raw(
          `CREATE TRIGGER fail_balance BEFORE UPDATE OF current_balance_cents ON accounts WHEN NEW.id = '${b.id}' BEGIN SELECT RAISE(ABORT, 'induced balance failure'); END`,
        ),
      );
      await request("DELETE", `/transactions/${t.id}`, undefined, 500);
    } else {
      // This fires after the transaction, its balance changes and splits were written.
      db.run(
        sql.raw(
          "CREATE TRIGGER fail_tag BEFORE INSERT ON transaction_tags BEGIN SELECT RAISE(ABORT, 'induced tag failure'); END",
        ),
      );
      const input = payload({
        type: "transfer",
        accountId: a.id,
        transferAccountId: b.id,
        amountCents: 2000,
        splits: [{ amountCents: 2000 }],
        tagIds: ["tag"],
      });
      await request(
        operation === "create" ? "POST" : "PUT",
        operation === "create" ? "/transactions/" : `/transactions/${t.id}`,
        input,
        500,
      );
    }
    assert.deepEqual(snapshot(), before);
  });
}

test("editing an unchanged expense at the numeric limit applies net movements", async () => {
  const a = await account(Number.MAX_SAFE_INTEGER);
  const expense = await create({ accountId: a.id });
  await create({ type: "income", accountId: a.id });
  await request("PUT", `/transactions/${expense.id}`, payload({ accountId: a.id }));
  await balances([[a.id, Number.MAX_SAFE_INTEGER]]);
});

test("negative initial balances are supported and underflow is atomic", async () => {
  const a = await account(-10000);
  await create({ accountId: a.id });
  await balances([[a.id, -11000]]);
  const b = await account(Number.MIN_SAFE_INTEGER);
  const before = snapshot();
  await request("POST", "/transactions/", payload({ accountId: b.id }), 400);
  assert.deepEqual(snapshot(), before);
});

test("initial balance overflow rejects the whole account edit", async () => {
  const a = await account();
  await create({ type: "income", accountId: a.id });
  const before = snapshot();
  await request(
    "PUT",
    `/accounts/${a.id}`,
    { name: "Should not change", initialBalanceCents: Number.MAX_SAFE_INTEGER },
    400,
  );
  assert.deepEqual(snapshot(), before);
});

test("account currency can change only before any history exists", async () => {
  const a = await account();
  await request("PUT", `/accounts/${a.id}`, { currency: "USD" });
  const b = await account();
  const t = await create({
    type: "transfer",
    accountId: b.id,
    transferAccountId: (await account()).id,
  });
  for (const id of [t.accountId, t.transferAccountId]) {
    await request("PUT", `/accounts/${id}`, { currency: "USD" }, 400);
  }
  await request("DELETE", `/transactions/${t.id}`, undefined, 204);
  await request("PUT", `/accounts/${b.id}`, { currency: "USD" }, 400);
});

test("edit of a transfer to mismatched currencies is rejected without changing anything", async () => {
  const a = await account();
  const b = await account();
  const c = await account(0, { currency: "USD" });
  const t = await create({ type: "transfer", accountId: a.id, transferAccountId: b.id });
  const before = snapshot();
  await request(
    "PUT",
    `/transactions/${t.id}`,
    payload({ type: "transfer", accountId: a.id, transferAccountId: c.id }),
    400,
  );
  assert.deepEqual(snapshot(), before);
});

test("unsafe account input and split overflow are rejected", async () => {
  for (const field of ["initialBalanceCents", "creditLimitCents"]) {
    for (const value of [Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, 0.5]) {
      await request(
        "POST",
        "/accounts/",
        { householdId: "home", name: "Conta", type: "checking", [field]: value },
        400,
      );
    }
  }
  await request(
    "POST",
    "/transactions/",
    payload({
      amountCents: Number.MAX_SAFE_INTEGER,
      splits: [{ amountCents: Number.MAX_SAFE_INTEGER }, { amountCents: 1 }],
    }),
    400,
  );
});

test("dashboard rejects unsafe aggregate totals instead of returning rounded money", async () => {
  await create({
    type: "income",
    amountCents: Number.MAX_SAFE_INTEGER,
    splits: [{ amountCents: Number.MAX_SAFE_INTEGER }],
  });
  await create({ type: "income", amountCents: 1, splits: [{ amountCents: 1 }] });
  await request("GET", "/dashboard/monthly?householdId=home&month=2026-10", undefined, 400);
});

test("dashboard net and per-category aggregates also enforce safe integers", async () => {
  await create({
    type: "income",
    amountCents: Number.MAX_SAFE_INTEGER,
    splits: [{ amountCents: Number.MAX_SAFE_INTEGER }],
  });
  await create({ type: "expense", amountCents: 1, splits: [{ amountCents: 1 }] });
  const dashboard = await request("GET", "/dashboard/monthly?householdId=home&month=2026-10");
  assert.equal(dashboard.balanceCents, Number.MAX_SAFE_INTEGER - 1);
  db.insert(categories)
    .values({ id: "big-category", householdId: "home", name: "Big", type: "expense" })
    .run();
  await create({
    type: "expense",
    amountCents: Number.MAX_SAFE_INTEGER,
    splits: [{ categoryId: "big-category", amountCents: Number.MAX_SAFE_INTEGER }],
  });
  await create({
    type: "expense",
    amountCents: 1,
    splits: [{ categoryId: "big-category", amountCents: 1 }],
  });
  await request("GET", "/dashboard/monthly?householdId=home&month=2026-10", undefined, 400);
});

test("services enforce validation even without HTTP", async () => {
  const service = await import("../services/transactions-service");
  const accountService = await import("../services/accounts-service");
  const unsafe = payload({
    amountCents: Number.MAX_SAFE_INTEGER + 1,
    splits: [{ amountCents: Number.MAX_SAFE_INTEGER + 1 }],
  });
  assert.throws(() =>
    service.createTransaction(unsafe as Parameters<typeof service.createTransaction>[0]),
  );
  const a = await account();
  const t = await create({ accountId: a.id });
  assert.throws(() =>
    service.updateTransaction(
      t.id,
      payload({ householdId: "other" }) as Parameters<typeof service.updateTransaction>[1],
    ),
  );
  assert.throws(() =>
    accountService.updateAccount(a.id, { currentBalanceCents: 1 } as unknown as Parameters<
      typeof accountService.updateAccount
    >[1]),
  );
  await balances([[a.id, 9000]]);
});

test("OpenAPI documents safe amounts, calendar dates, adjustment restriction and read-only balance", async () => {
  const docs = await request("GET", "/docs/json");
  const body = docs.paths["/transactions/"].post.requestBody.content["application/json"].schema;
  assert.deepEqual(body.properties.type.enum, ["income", "expense", "transfer"]);
  assert.equal(body.properties.amountCents.maximum, Number.MAX_SAFE_INTEGER);
  assert.equal(body.properties.transactionDate.format, "date");
  assert.equal(
    body.properties.splits.items.properties.amountCents.maximum,
    Number.MAX_SAFE_INTEGER,
  );
  assert.deepEqual(
    docs.paths["/accounts/"].post.requestBody.content["application/json"].schema.not.required,
    ["currentBalanceCents"],
  );
});

test("failure inserting the second split rolls back all prior writes", async () => {
  const a = await account();
  const before = snapshot();
  db.run(
    sql.raw(
      "CREATE TRIGGER fail_split BEFORE INSERT ON transaction_splits WHEN NEW.amount_cents = 600 BEGIN SELECT RAISE(ABORT, 'induced second split failure'); END",
    ),
  );
  await request(
    "POST",
    "/transactions/",
    payload({ accountId: a.id, splits: [{ amountCents: 400 }, { amountCents: 600 }] }),
    500,
  );
  assert.deepEqual(snapshot(), before);
});

test("migrations and seed are repeatable in a separate temporary database", () => {
  const databasePath = join(directory, "seed.sqlite");
  const sqlite = new Database(databasePath);
  try {
    sqlite.pragma("foreign_keys = ON");
    const seedDb = drizzle(sqlite);
    migrate(seedDb, { migrationsFolder });
    migrate(seedDb, { migrationsFolder });
    for (let attempt = 0; attempt < 2; attempt++) {
      execFileSync(process.execPath, ["--import", "tsx", "src/db/seed.ts"], {
        cwd: fileURLToPath(new URL("../../", import.meta.url)),
        env: {
          ...process.env,
          DATABASE_URL: `file:${databasePath}`,
          DOTENV_CONFIG_PATH: join(directory, "unused-test.env"),
          SEED_USER_NAME: "Synthetic Test User",
          SEED_USER_EMAIL: "test@example.invalid",
          SEED_HOUSEHOLD_NAME: "Synthetic Test Household",
        },
        timeout: 30000,
      });
    }
    for (const table of [
      "users",
      "households",
      "household_members",
      "household_people",
      "settings",
    ]) {
      assert.deepEqual(sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get(), {
        count: 1,
      });
    }
    assert.deepEqual(sqlite.prepare("SELECT count(*) AS count FROM categories").get(), {
      count: 9,
    });
    assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
  } finally {
    sqlite.close();
  }
});

test("recalculation rejects an unrepresentable total and does not overwrite the cache", async () => {
  const a = await account(Number.MAX_SAFE_INTEGER);
  // Simulates legacy/inconsistent data that bypassed API validation.
  db.insert(transactions)
    .values({
      id: "legacy-income",
      householdId: "home",
      accountId: a.id,
      type: "income",
      amountCents: 1,
      transactionDate: "2026-10-26",
    })
    .run();
  const before = snapshot();
  await request("POST", `/accounts/${a.id}/recalculate-balance`, undefined, 400);
  assert.deepEqual(snapshot(), before);
});
