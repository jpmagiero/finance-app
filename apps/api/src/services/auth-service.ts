import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "../db";
import { householdMembers, householdPeople, households, sessions, users } from "../db/schema";
import { badRequest, forbidden, unauthorized } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";

export const sessionLifetime = 60 * 60 * 24 * 7;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${(await derive(password, salt)).toString("hex")}`;
}

async function verifyPassword(password: string, hash: string | null) {
  const [algorithm, salt, value] = (hash ?? "").split(":");
  // Run the same expensive KDF for missing accounts to avoid an obvious timing oracle.
  const expected =
    algorithm === "scrypt" && salt && value ? Buffer.from(value, "hex") : Buffer.alloc(64);
  const actual = await derive(password, salt || "00000000000000000000000000000000");
  return (
    expected.length === actual.length && timingSafeEqual(actual, expected) && algorithm === "scrypt"
  );
}

export function getIdentity(token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) unauthorized();
  const session = db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, digest(token)), gt(sessions.expiresAt, now())))
    .get();
  if (!session) unauthorized();
  const user = db
    .select()
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.isActive, true)))
    .get();
  const member = db
    .select()
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.userId, session.userId),
        eq(householdMembers.householdId, session.householdId),
      ),
    )
    .get();
  if (!user || !member) unauthorized();
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    householdId: member.householdId,
    role: member.role,
    sessionId: session.id,
    csrfToken: session.csrfToken,
  };
}

export type Identity = ReturnType<typeof getIdentity>;
export function publicIdentity(identity: Identity) {
  return {
    user: { id: identity.userId, name: identity.name, email: identity.email },
    householdId: identity.householdId,
    role: identity.role,
    csrfToken: identity.csrfToken,
  };
}

export async function login(email: string, password: string) {
  const user = db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
  const valid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!valid || !user?.isActive) unauthorized("E-mail ou senha incorretos.");
  const token = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  db.transaction(
    () => {
      // Verification awaits scrypt. A reset may commit while it runs: re-read
      // credentials under the same write transaction that creates the session.
      const latest = db.select().from(users).where(eq(users.id, user.id)).get();
      if (!latest?.isActive || latest.passwordHash !== user.passwordHash) {
        unauthorized("As credenciais mudaram. Entre novamente.");
      }
      const member = db
        .select()
        .from(householdMembers)
        .where(eq(householdMembers.userId, user.id))
        .orderBy(householdMembers.createdAt, householdMembers.id)
        .get();
      if (!member) forbidden("Usuario sem acesso a uma casa.");

      db.delete(sessions).where(lt(sessions.expiresAt, now())).run();
      db.insert(sessions)
        .values({
          id: digest(token),
          userId: user.id,
          householdId: member.householdId,
          csrfToken,
          expiresAt: new Date(Date.now() + sessionLifetime * 1000).toISOString(),
        })
        .run();
    },
    { behavior: "immediate" },
  );
  return { token, identity: getIdentity(token) };
}

export function logout(identity: Identity) {
  db.delete(sessions).where(eq(sessions.id, identity.sessionId)).run();
}

// This function is used by the trusted local provisioning command, never a public setup endpoint.
export async function provisionUser(
  input: {
    email: string;
    name: string;
    password: string;
    householdId: string;
    role: "owner" | "admin" | "member";
    personId?: string;
  },
  allowExisting = true,
) {
  const hash = await hashPassword(input.password);
  return db.transaction(() => {
    if (!db.select().from(households).where(eq(households.id, input.householdId)).get())
      badRequest("Casa nao encontrada.");
    const email = input.email.trim().toLowerCase();
    const existing = db.select().from(users).where(eq(users.email, email)).get();
    if (existing && !allowExisting) badRequest("Este e-mail ja esta cadastrado.");
    const id = existing?.id ?? createId();
    if (existing) {
      db.update(users)
        .set({ passwordHash: hash, name: input.name, isActive: true, updatedAt: now() })
        .where(eq(users.id, id))
        .run();
      db.delete(sessions).where(eq(sessions.userId, id)).run();
    } else {
      db.insert(users).values({ id, email, name: input.name, passwordHash: hash }).run();
    }
    const member = db
      .select()
      .from(householdMembers)
      .where(
        and(eq(householdMembers.userId, id), eq(householdMembers.householdId, input.householdId)),
      )
      .get();
    if (!member)
      db.insert(householdMembers)
        .values({ id: createId(), userId: id, householdId: input.householdId, role: input.role })
        .run();
    const linked = db
      .select()
      .from(householdPeople)
      .where(
        and(eq(householdPeople.userId, id), eq(householdPeople.householdId, input.householdId)),
      )
      .get();
    if (input.personId) {
      const person = db
        .select()
        .from(householdPeople)
        .where(
          and(
            eq(householdPeople.id, input.personId),
            eq(householdPeople.householdId, input.householdId),
          ),
        )
        .get();
      if (
        !person?.isActive ||
        (person.userId && person.userId !== id) ||
        (linked && linked.id !== person.id)
      )
        badRequest("Pessoa indisponivel para vinculo.");
      db.update(householdPeople)
        .set({ userId: id, updatedAt: now() })
        .where(eq(householdPeople.id, person.id))
        .run();
    } else if (!linked) {
      db.insert(householdPeople)
        .values({ id: createId(), householdId: input.householdId, userId: id, name: input.name })
        .run();
    }
    return { id, name: input.name, email };
  });
}

export async function createHouseholdLogin(
  identity: Identity,
  input: { email: string; name: string; password: string; personId?: string },
) {
  if (identity.role === "member") forbidden();
  if (db.select().from(users).where(eq(users.email, input.email.toLowerCase())).get())
    badRequest(
      "Este e-mail ja esta cadastrado. Use o provisionamento local para recuperar acesso.",
    );
  // Never let this endpoint reset or attach an existing user's credentials.
  return provisionUser({ ...input, householdId: identity.householdId, role: "member" }, false);
}

export async function changePassword(
  identity: Identity,
  currentPassword: string,
  newPassword: string,
) {
  const user = db.select().from(users).where(eq(users.id, identity.userId)).get();
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash)))
    badRequest("Senha atual incorreta.");
  const hash = await hashPassword(newPassword);
  db.transaction(() => {
    // A concurrent password reset must not be overwritten by stale credentials.
    const latest = db.select().from(users).where(eq(users.id, identity.userId)).get();
    if (!latest || latest.passwordHash !== user.passwordHash)
      unauthorized("As credenciais mudaram. Entre novamente.");
    db.update(users)
      .set({ passwordHash: hash, updatedAt: now() })
      .where(eq(users.id, identity.userId))
      .run();
    db.delete(sessions).where(eq(sessions.userId, identity.userId)).run();
  });
}
