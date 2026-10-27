import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
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
  transactions,
  users,
} from "../db/schema";

const directory = await mkdtemp(join(tmpdir(), "finance-access-test-"));
process.env.DATABASE_URL = `file:${join(directory, "test.sqlite")}`;
const { db, closeDatabase } = await import("../db");
const { buildApp } = await import("../app");
const { hashPassword } = await import("../services/auth-service");
migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
const password = "Synthetic-Password-123!";
const passwordHash = await hashPassword(password);
const app = await buildApp({ logger: false });
await app.ready();
let cookie = "",
  csrf = "",
  address = 0;
beforeEach(() => {
  address++;
  cookie = "";
  csrf = "";
  db.delete(households).run();
  db.delete(users).run();
  db.insert(households)
    .values([
      { id: "home", name: "Nossa casa" },
      { id: "foreign", name: "Outra casa" },
    ])
    .run();
  db.insert(settings).values({ id: "settings", householdId: "home" }).run();
  db.insert(users)
    .values([
      { id: "owner", name: "Owner", email: "owner@example.invalid", passwordHash },
      { id: "member", name: "Member", email: "member@example.invalid", passwordHash },
      { id: "stranger", name: "Stranger", email: "stranger@example.invalid", passwordHash },
    ])
    .run();
  db.insert(householdMembers)
    .values([
      { id: "m1", userId: "owner", householdId: "home", role: "owner" },
      { id: "m2", userId: "member", householdId: "home", role: "member" },
      { id: "m3", userId: "stranger", householdId: "foreign", role: "owner" },
    ])
    .run();
  db.insert(householdPeople)
    .values([
      { id: "person", householdId: "home", name: "Pessoa", userId: "member" },
      { id: "outsider", householdId: "foreign", name: "Outra pessoa", userId: "stranger" },
    ])
    .run();
});
after(async () => {
  await app.close();
  closeDatabase();
  await rm(directory, { recursive: true, force: true });
});
async function raw(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return app.inject({
    method,
    url,
    payload,
    remoteAddress: `127.0.0.${address}`,
    headers: { ...(cookie ? { cookie, "x-csrf-token": csrf } : {}), ...headers },
  });
}
async function req(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: Record<string, unknown>,
  status = 200,
) {
  const response = await raw(method, url, payload);
  assert.equal(response.statusCode, status, response.body);
  return status === 204 ? undefined : response.json();
}
async function signIn(email = "owner@example.invalid") {
  const response = await raw("POST", "/auth/login", { email, password });
  assert.equal(response.statusCode, 200, response.body);
  cookie = `finance_session=${response.cookies[0]?.value}`;
  csrf = response.json().csrfToken;
  return response;
}
function input(extra: Record<string, unknown> = {}) {
  return {
    householdId: "home",
    type: "expense",
    amountCents: 1000,
    transactionDate: "2026-10-26",
    splits: [{ amountCents: 1000 }],
    ...extra,
  };
}

test("unauthenticated requests cannot read or mutate financial resources", async () => {
  for (const path of [
    "/households/current",
    "/people/?householdId=home",
    "/accounts/?householdId=home",
    "/categories/?householdId=home",
    "/payees/?householdId=home",
    "/tags/?householdId=home",
    "/settings/home",
    "/transactions/?householdId=home",
    "/dashboard/monthly?householdId=home&month=2026-10",
  ])
    await req("GET", path, undefined, 401);
  await req("POST", "/transactions/", input(), 401);
});
test("login issues HttpOnly SameSite cookie; only a digest is stored; me contains no secrets", async () => {
  const result = await signIn();
  const header = String(result.headers["set-cookie"]);
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Strict/i);
  assert.notEqual(db.select().from(sessions).get()?.id, result.cookies[0]?.value);
  const me = await req("GET", "/auth/me");
  assert.equal(me.user.id, "owner");
  assert.equal("passwordHash" in me.user, false);
  assert.equal("sessionId" in me, false);
  assert.equal((await req("GET", "/households/current")).household.id, "home");
});
test("bad passwords and nonexistent users return the same response", async () => {
  const a = await raw("POST", "/auth/login", { email: "owner@example.invalid", password: "wrong" });
  const b = await raw("POST", "/auth/login", {
    email: "absent@example.invalid",
    password: "wrong",
  });
  assert.equal(a.statusCode, 401);
  assert.equal(a.body, b.body);
});
test("logout invalidates the old cookie and expires it in the browser", async () => {
  await signIn();
  const result = await raw("POST", "/auth/logout");
  assert.equal(result.statusCode, 204);
  assert.match(String(result.headers["set-cookie"]), /Max-Age=0/i);
  await req("GET", "/auth/me", undefined, 401);
});
test("expired session, inactive user and removed membership are rejected", async () => {
  for (const reason of ["expired", "inactive", "membership"]) {
    db.update(users).set({ isActive: true }).where(eq(users.id, "owner")).run();
    if (!db.select().from(householdMembers).where(eq(householdMembers.id, "m1")).get())
      db.insert(householdMembers)
        .values({ id: "m1", userId: "owner", householdId: "home", role: "owner" })
        .run();
    await signIn();
    if (reason === "expired")
      db.update(sessions).set({ expiresAt: "2000-01-01T00:00:00.000Z" }).run();
    if (reason === "inactive")
      db.update(users).set({ isActive: false }).where(eq(users.id, "owner")).run();
    if (reason === "membership")
      db.delete(householdMembers).where(eq(householdMembers.id, "m1")).run();
    await req("GET", "/auth/me", undefined, 401);
  }
});
test("writes reject missing CSRF, malicious Origin and unauthenticated cross-origin login", async () => {
  await signIn();
  assert.equal(
    (await raw("POST", "/transactions/", input(), { "x-csrf-token": "" })).statusCode,
    403,
  );
  assert.equal(
    (await raw("POST", "/transactions/", input(), { origin: "https://evil.invalid" })).statusCode,
    403,
  );
  assert.equal(
    (
      await raw(
        "POST",
        "/auth/login",
        { email: "owner@example.invalid", password },
        { origin: "null" },
      )
    ).statusCode,
    403,
  );
  await req("POST", "/transactions/", input(), 201);
});
test("all resource-by-id routes and household selectors enforce isolation", async () => {
  db.insert(accounts)
    .values({ id: "foreign-account", householdId: "foreign", name: "Secret", type: "checking" })
    .run();
  db.insert(categories)
    .values({ id: "foreign-category", householdId: "foreign", name: "Secret", type: "expense" })
    .run();
  db.insert(payees)
    .values({
      id: "foreign-payee",
      householdId: "foreign",
      name: "Secret",
      normalizedName: "secret",
    })
    .run();
  db.insert(tags).values({ id: "foreign-tag", householdId: "foreign", name: "Secret" }).run();
  db.insert(transactions)
    .values({
      id: "foreign-transaction",
      householdId: "foreign",
      type: "expense",
      amountCents: 1,
      transactionDate: "2026-10-26",
    })
    .run();
  await signIn();
  for (const [resource, id] of [
    ["people", "outsider"],
    ["accounts", "foreign-account"],
    ["categories", "foreign-category"],
    ["payees", "foreign-payee"],
    ["tags", "foreign-tag"],
    ["transactions", "foreign-transaction"],
  ]) {
    await req("GET", `/${resource}/${id}`, undefined, 404);
    await req(
      "PUT",
      `/${resource}/${id}`,
      resource === "transactions" ? input() : { name: "Cannot change" },
      404,
    );
    await req("DELETE", `/${resource}/${id}`, undefined, 404);
  }
  await req("POST", "/accounts/foreign-account/recalculate-balance", undefined, 404);
  await req("POST", "/people/outsider/restore", undefined, 404);
  await req("GET", "/settings/foreign", undefined, 404);
  await req("GET", "/transactions/?householdId=foreign", undefined, 404);
  assert.equal(
    db.select().from(accounts).where(eq(accounts.id, "foreign-account")).get()?.name,
    "Secret",
  );
});
test("members can launch for another person but cannot administer or create logins", async () => {
  await signIn("member@example.invalid");
  const t = await req(
    "POST",
    "/transactions/",
    input({ personId: "person", createdByUserId: "owner" }),
    201,
  );
  assert.equal(t.personId, "person");
  assert.equal(t.createdByUserId, "member");
  await req("PUT", `/transactions/${t.id}`, input({ personId: "person", status: "pending" }));
  await req("POST", "/people/", { householdId: "home", name: "Not allowed" }, 403);
  await req("PUT", "/settings/home", { monthlyPeriodStartDay: 15 }, 403);
  await req("POST", "/auth/users", { name: "New", email: "new@example.invalid", password }, 403);
});
test("administrator can create a member login linked to an existing financial person", async () => {
  await signIn();
  db.insert(householdPeople)
    .values({ id: "unlinked", householdId: "home", name: "Already tracked" })
    .run();
  const created = await req(
    "POST",
    "/auth/users",
    { name: "Second User", email: "new@example.invalid", password, personId: "unlinked" },
    201,
  );
  assert.equal(
    db.select().from(householdPeople).where(eq(householdPeople.id, "unlinked")).get()?.userId,
    created.id,
  );
  assert.notEqual(
    db.select().from(users).where(eq(users.id, created.id)).get()?.passwordHash,
    password,
  );
  await signIn("new@example.invalid");
  assert.equal((await req("GET", "/auth/me")).role, "member");
});
test("administrator cannot reset an existing outsider login via create user", async () => {
  await signIn();
  const before = db.select().from(users).where(eq(users.id, "stranger")).get();
  await req(
    "POST",
    "/auth/users",
    { name: "Attack", email: "stranger@example.invalid", password: "Changed-Password-123" },
    400,
  );
  assert.deepEqual(db.select().from(users).where(eq(users.id, "stranger")).get(), before);
});
test("duplicate normalized payees return a conflict without leaking SQL", async () => {
  await signIn();
  await req("POST", "/payees/", { householdId: "home", name: "Mercadó" }, 201);
  const result = await req("POST", "/payees/", { householdId: "home", name: " mercado " }, 409);
  assert.equal(result.error, "conflict");
  assert.equal(JSON.stringify(result).includes("SQLITE"), false);
});
test("category hierarchy blocks cycles, mismatched parent and historical type changes", async () => {
  await signIn();
  const parent = await req(
    "POST",
    "/categories/",
    { householdId: "home", type: "expense", name: "Parent" },
    201,
  );
  const child = await req(
    "POST",
    "/categories/",
    { householdId: "home", type: "expense", name: "Child", parentId: parent.id },
    201,
  );
  await req("PUT", `/categories/${parent.id}`, { parentId: child.id }, 400);
  await req(
    "POST",
    "/categories/",
    { householdId: "home", type: "income", name: "Bad", parentId: parent.id },
    400,
  );
  await req(
    "POST",
    "/transactions/",
    input({ splits: [{ amountCents: 1000, categoryId: child.id }] }),
    201,
  );
  await req("PUT", `/categories/${child.id}`, { type: "income", parentId: null }, 400);
});
test("archived references are unavailable for new entries but historical edits and restoration work", async () => {
  await signIn();
  const a = await req(
    "POST",
    "/accounts/",
    { householdId: "home", type: "checking", name: "Archived" },
    201,
  );
  const t = await req(
    "POST",
    "/transactions/",
    input({ accountId: a.id, personId: "person" }),
    201,
  );
  await req("DELETE", `/accounts/${a.id}`, undefined, 204);
  await req("DELETE", "/people/person", undefined, 204);
  await req("POST", "/transactions/", input({ accountId: a.id }), 400);
  await req("POST", "/transactions/", input({ personId: "person" }), 400);
  await req("PUT", `/transactions/${t.id}`, input({ accountId: a.id, personId: "person" }));
  assert.deepEqual(await req("GET", "/people/?householdId=home"), []);
  await req("POST", "/people/person/restore", undefined, 204);
  await req("POST", `/accounts/${a.id}/restore`, undefined, 204);
  await req("POST", "/transactions/", input({ accountId: a.id, personId: "person" }), 201);
});
test("person login links require membership, are unique per house and can be removed", async () => {
  await signIn();
  await req("PUT", "/people/person", { userId: null });
  assert.equal(
    db.select().from(householdPeople).where(eq(householdPeople.id, "person")).get()?.userId,
    null,
  );
  await req("PUT", "/people/person", { userId: "stranger" }, 404);
  await req("PUT", "/people/person", { userId: "member" });
  await req("POST", "/people/", { householdId: "home", name: "Duplicate", userId: "member" }, 400);
});
test("transaction list pages, search, category, tag and incoming transfer account filter", async () => {
  await signIn();
  const a = await req(
    "POST",
    "/accounts/",
    { householdId: "home", type: "checking", name: "Origin" },
    201,
  );
  const b = await req(
    "POST",
    "/accounts/",
    { householdId: "home", type: "checking", name: "Destination" },
    201,
  );
  const c = await req(
    "POST",
    "/categories/",
    { householdId: "home", type: "expense", name: "Market" },
    201,
  );
  const tag = await req("POST", "/tags/", { householdId: "home", name: "Week" }, 201);
  for (let i = 0; i < 3; i++)
    await req(
      "POST",
      "/transactions/",
      input({
        description: "Searchable",
        tagIds: [tag.id],
        splits: [{ amountCents: 1000, categoryId: c.id }],
      }),
      201,
    );
  const first = await req(
    "GET",
    `/transactions/?householdId=home&page=1&limit=2&search=Search&categoryId=${c.id}&tagId=${tag.id}`,
  );
  const second = await req("GET", "/transactions/?householdId=home&page=2&limit=2");
  assert.equal(first.total, 3);
  assert.equal(first.items.length, 2);
  assert.equal(second.items.length, 1);
  assert.equal(
    first.items.some((t: { id: string }) => t.id === second.items[0].id),
    false,
  );
  const transfer = await req(
    "POST",
    "/transactions/",
    input({ type: "transfer", accountId: a.id, transferAccountId: b.id }),
    201,
  );
  const received = await req("GET", `/transactions/?householdId=home&accountId=${b.id}`);
  assert.equal(received[0].id, transfer.id);
});
test("dashboard financial period, person, pending totals, splits and transfers are coherent", async () => {
  await signIn();
  await req("PUT", "/settings/home", { monthlyPeriodStartDay: 15 });
  await req(
    "POST",
    "/transactions/",
    input({ personId: "person", transactionDate: "2026-10-14" }),
    201,
  );
  await req(
    "POST",
    "/transactions/",
    input({ personId: "person", transactionDate: "2026-10-15" }),
    201,
  );
  await req(
    "POST",
    "/transactions/",
    input({ personId: "person", transactionDate: "2026-11-14", status: "pending" }),
    201,
  );
  await req(
    "POST",
    "/transactions/",
    input({ personId: "person", transactionDate: "2026-11-15" }),
    201,
  );
  await req("POST", "/transactions/", input({ type: "income", personId: "person" }), 201);
  await req("POST", "/transactions/", input({ status: "canceled", personId: "person" }), 201);
  const summary = await req(
    "GET",
    "/dashboard/monthly?householdId=home&month=2026-10&personId=person",
  );
  assert.equal(summary.from, "2026-10-15");
  assert.equal(summary.to, "2026-11-14");
  assert.equal(summary.expenseCents, 2000);
  assert.equal(summary.incomeCents, 1000);
  assert.equal(summary.confirmedExpenseCents, 1000);
  assert.equal(summary.pendingExpenseCents, 1000);
  assert.equal(summary.categories[0].category, null);
  assert.equal(summary.categories[0].amountCents, 2000);
  await req("PUT", "/settings/home", { includePendingInReports: false });
  assert.equal(
    (await req("GET", "/dashboard/monthly?householdId=home&month=2026-10&personId=person"))
      .expenseCents,
    1000,
  );
  assert.equal(
    (await req("GET", "/dashboard/monthly?householdId=home&month=2026-10&personId=unassigned"))
      .transactionCount,
    0,
  );
});
test("login endpoint rate limits repeated attempts", async () => {
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await raw("POST", "/auth/login", { email: "missing@example.invalid", password: "wrong" }))
        .statusCode,
      401,
    );
  assert.equal(
    (await raw("POST", "/auth/login", { email: "missing@example.invalid", password: "wrong" }))
      .statusCode,
    429,
  );
});

test("nullable HTTP fields preserve null and allow accountless launches from the UI", async () => {
  await signIn();
  const result = await req(
    "POST",
    "/transactions/",
    input({
      personId: null,
      accountId: null,
      payeeId: null,
      transferAccountId: null,
      competenceDate: null,
      description: null,
      notes: null,
      splits: [{ amountCents: 1000, categoryId: null }],
    }),
    201,
  );
  for (const field of [
    "personId",
    "accountId",
    "payeeId",
    "transferAccountId",
    "competenceDate",
    "description",
    "notes",
  ])
    assert.equal(result[field], null);
  assert.equal(result.splits[0].categoryId, null);
  const account = await req(
    "POST",
    "/accounts/",
    {
      householdId: "home",
      name: "Null account",
      type: "cash",
      personId: null,
      creditLimitCents: null,
      institution: null,
    },
    201,
  );
  assert.equal(account.creditLimitCents, null);
  assert.equal(account.personId, null);
});
test("password change validates old password, revokes every session and accepts only the new password", async () => {
  await signIn();
  const firstCookie = cookie;
  await signIn();
  await req(
    "POST",
    "/auth/password",
    { currentPassword: "wrong", newPassword: "New-Synthetic-Password!" },
    400,
  );
  await req("GET", "/auth/me");
  await req(
    "POST",
    "/auth/password",
    { currentPassword: password, newPassword: "New-Synthetic-Password!" },
    204,
  );
  await req("GET", "/auth/me", undefined, 401);
  cookie = firstCookie;
  await req("GET", "/auth/me", undefined, 401);
  cookie = "";
  await req("POST", "/auth/login", { email: "owner@example.invalid", password }, 401);
  await req("POST", "/auth/login", {
    email: "owner@example.invalid",
    password: "New-Synthetic-Password!",
  });
});
test("persisted sessions work across Fastify app instances", async () => {
  await signIn();
  const secondApp = await buildApp({ logger: false });
  try {
    const result = await secondApp.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    assert.equal(result.statusCode, 200);
    assert.equal(result.json().user.id, "owner");
  } finally {
    await secondApp.close();
  }
});
test("concurrent duplicate user creation never resets the first credentials", async () => {
  await signIn();
  const results = await Promise.all([
    raw("POST", "/auth/users", {
      name: "One",
      email: "racing@example.invalid",
      password: "First-Password-123!",
    }),
    raw("POST", "/auth/users", {
      name: "Two",
      email: "racing@example.invalid",
      password: "Other-Password-123!",
    }),
  ]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [201, 400]);
  const successful = results.findIndex((r) => r.statusCode === 201);
  cookie = "";
  csrf = "";
  await req("POST", "/auth/login", {
    email: "racing@example.invalid",
    password: successful === 0 ? "First-Password-123!" : "Other-Password-123!",
  });
});
test("invalid timezones cannot be saved and break the browser", async () => {
  await signIn();
  await req("PUT", "/settings/home", { timezone: "Not/A_Timezone" }, 400);
  assert.equal((await req("GET", "/settings/home")).timezone, "America/Sao_Paulo");
});
test("OpenAPI includes session authentication and CSRF requirements", async () => {
  const docs = await req("GET", "/docs/json");
  assert.ok(docs.components.securitySchemes.sessionCookie);
  assert.deepEqual(docs.paths["/transactions/"].post.security, [
    { sessionCookie: [], csrfToken: [] },
  ]);
  assert.ok(docs.paths["/transactions/"].post.responses["401"]);
  assert.ok(docs.paths["/auth/password"]);
});

test("malformed JSON and unsupported media keep client error statuses", async () => {
  await signIn();
  const malformed = await app.inject({
    method: "POST",
    url: "/transactions/",
    headers: { cookie, "x-csrf-token": csrf, "content-type": "application/json" },
    payload: "{",
  });
  assert.equal(malformed.statusCode, 400);
  const unsupported = await app.inject({
    method: "POST",
    url: "/transactions/",
    headers: { cookie, "x-csrf-token": csrf, "content-type": "application/xml" },
    payload: "<bad/>",
  });
  assert.equal(unsupported.statusCode, 415);
});
