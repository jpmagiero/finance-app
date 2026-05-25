import type { CreateCategoryInput, UpdateCategoryInput } from "@finance/shared";
import { and, eq, type SQL } from "drizzle-orm";
import { db } from "../db";
import { categories } from "../db/schema";
import { badRequest, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";
import { ensureHouseholdExists } from "./common-service";

type ListCategoriesInput = {
  householdId: string;
  type?: "income" | "expense" | "transfer";
  includeArchived?: boolean;
};

export function listCategories(input: ListCategoriesInput) {
  ensureHouseholdExists(input.householdId);

  const conditions: SQL[] = [eq(categories.householdId, input.householdId)];

  if (input.type) {
    conditions.push(eq(categories.type, input.type));
  }

  if (!input.includeArchived) {
    conditions.push(eq(categories.isArchived, false));
  }

  return db
    .select()
    .from(categories)
    .where(and(...conditions))
    .all();
}

export function getCategory(id: string) {
  const category = db.select().from(categories).where(eq(categories.id, id)).get();

  if (!category) {
    notFound("Categoria nao encontrada.");
  }

  return category;
}

function ensureParentCategory(parentId: string, householdId: string, currentCategoryId?: string) {
  if (currentCategoryId && parentId === currentCategoryId) {
    badRequest("Categoria nao pode ser pai dela mesma.");
  }

  const parent = getCategory(parentId);

  if (parent.householdId !== householdId) {
    notFound("Categoria pai nao encontrada nesta casa.");
  }

  return parent;
}

export function createCategory(input: CreateCategoryInput) {
  ensureHouseholdExists(input.householdId);

  if (input.parentId) {
    ensureParentCategory(input.parentId, input.householdId);
  }

  const id = createId();

  db.insert(categories)
    .values({
      id,
      householdId: input.householdId,
      parentId: input.parentId ?? null,
      name: input.name,
      type: input.type,
      color: input.color ?? null,
      icon: input.icon ?? null,
    })
    .run();

  return getCategory(id);
}

export function updateCategory(id: string, input: UpdateCategoryInput) {
  const category = getCategory(id);

  if (input.parentId) {
    const parent = ensureParentCategory(input.parentId, category.householdId, id);

    if (input.type && parent.type !== input.type) {
      badRequest("Categoria pai deve ter o mesmo tipo da categoria.");
    }
  }

  db.update(categories)
    .set({
      parentId: input.parentId === undefined ? category.parentId : input.parentId,
      name: input.name ?? category.name,
      type: input.type ?? category.type,
      color: input.color === undefined ? category.color : input.color,
      icon: input.icon === undefined ? category.icon : input.icon,
      updatedAt: now(),
    })
    .where(eq(categories.id, id))
    .run();

  return getCategory(id);
}

export function archiveCategory(id: string) {
  getCategory(id);

  db.update(categories)
    .set({
      isArchived: true,
      updatedAt: now(),
    })
    .where(eq(categories.id, id))
    .run();
}
