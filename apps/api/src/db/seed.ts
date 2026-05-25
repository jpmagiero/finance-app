import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from ".";
import {
  categories,
  householdMembers,
  householdPeople,
  households,
  settings,
  users,
} from "./schema";

const userName = process.env.SEED_USER_NAME ?? "Admin";
const userEmail = process.env.SEED_USER_EMAIL ?? "admin@local";
const householdName = process.env.SEED_HOUSEHOLD_NAME ?? "Casa";

function id() {
  return randomUUID();
}

const existingUser = db.select().from(users).where(eq(users.email, userEmail)).get();
const userId = existingUser?.id ?? id();

if (!existingUser) {
  db.insert(users)
    .values({
      id: userId,
      name: userName,
      email: userEmail,
    })
    .run();
}

const existingHousehold = db
  .select()
  .from(households)
  .where(eq(households.name, householdName))
  .get();
const householdId = existingHousehold?.id ?? id();

if (!existingHousehold) {
  db.insert(households)
    .values({
      id: householdId,
      name: householdName,
    })
    .run();
}

const existingMember = db
  .select()
  .from(householdMembers)
  .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
  .get();

if (!existingMember) {
  db.insert(householdMembers)
    .values({
      id: id(),
      householdId,
      userId,
      role: "owner",
    })
    .run();
}

const existingPerson = db
  .select()
  .from(householdPeople)
  .where(and(eq(householdPeople.householdId, householdId), eq(householdPeople.userId, userId)))
  .get();

if (!existingPerson) {
  db.insert(householdPeople)
    .values({
      id: id(),
      householdId,
      userId,
      name: userName,
      color: "#116149",
    })
    .run();
}

const existingSettings = db
  .select()
  .from(settings)
  .where(eq(settings.householdId, householdId))
  .get();

if (!existingSettings) {
  db.insert(settings)
    .values({
      id: id(),
      householdId,
    })
    .run();
}

const defaultCategories = [
  { name: "Salario", type: "income", color: "#2f855a", icon: "wallet" },
  { name: "Outras receitas", type: "income", color: "#4f8f7a", icon: "plus" },
  { name: "Moradia", type: "expense", color: "#2563eb", icon: "home" },
  { name: "Mercado", type: "expense", color: "#c2410c", icon: "shopping-cart" },
  { name: "Transporte", type: "expense", color: "#a27c2c", icon: "car" },
  { name: "Saude", type: "expense", color: "#be123c", icon: "heart-pulse" },
  { name: "Lazer", type: "expense", color: "#7c3aed", icon: "ticket" },
  { name: "Assinaturas", type: "expense", color: "#475569", icon: "repeat" },
  { name: "Outras despesas", type: "expense", color: "#737373", icon: "circle" },
] as const;

for (const category of defaultCategories) {
  const existingCategory = db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.householdId, householdId),
        eq(categories.type, category.type),
        eq(categories.name, category.name),
      ),
    )
    .get();

  if (!existingCategory) {
    db.insert(categories)
      .values({
        id: id(),
        householdId,
        name: category.name,
        type: category.type,
        color: category.color,
        icon: category.icon,
        isSystem: true,
      })
      .run();
  }
}

console.log(`Seed concluido para household "${householdName}" e usuario "${userEmail}".`);
