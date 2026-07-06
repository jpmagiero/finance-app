import type { CategoryType, CreateCategoryInput, UpdateCategoryInput } from "@finance/shared";
import { and, eq, type SQL } from "drizzle-orm";
import { db } from "../db";
import { categories } from "../db/schema";
import { badRequest, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";
import { ensureHouseholdExists } from "./common-service";

const MAX_HIERARCHY_HOPS = 100;

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

export function getCategory(householdId: string, id: string) {
  const category = db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.householdId, householdId)))
    .get();

  if (!category) {
    notFound("Categoria nao encontrada nesta casa.");
  }

  return category;
}

// Valida o pai efetivo de uma categoria: existencia na casa, auto-referencia,
// compatibilidade de tipo e ausencia de ciclo na hierarquia.
function ensureParentCategory(
  householdId: string,
  parentId: string,
  effectiveType: CategoryType,
  currentCategoryId?: string,
) {
  if (currentCategoryId && parentId === currentCategoryId) {
    badRequest("Categoria nao pode ser pai dela mesma.");
  }

  const parent = db
    .select()
    .from(categories)
    .where(and(eq(categories.id, parentId), eq(categories.householdId, householdId)))
    .get();

  if (!parent) {
    notFound("Categoria pai nao encontrada nesta casa.");
  }

  if (parent.type !== effectiveType) {
    badRequest("Categoria pai deve ter o mesmo tipo da categoria.");
  }

  if (currentCategoryId) {
    let ancestorId = parent.parentId;

    for (let hop = 0; ancestorId && hop < MAX_HIERARCHY_HOPS; hop += 1) {
      if (ancestorId === currentCategoryId) {
        badRequest("Hierarquia de categorias nao pode formar ciclo.");
      }

      const ancestor = db
        .select({ parentId: categories.parentId })
        .from(categories)
        .where(and(eq(categories.id, ancestorId), eq(categories.householdId, householdId)))
        .get();

      ancestorId = ancestor ? ancestor.parentId : null;
    }
  }

  return parent;
}

export function createCategory(input: CreateCategoryInput) {
  ensureHouseholdExists(input.householdId);

  if (input.parentId) {
    ensureParentCategory(input.householdId, input.parentId, input.type);
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

  return getCategory(input.householdId, id);
}

export function updateCategory(householdId: string, id: string, input: UpdateCategoryInput) {
  const category = getCategory(householdId, id);

  // Pai e tipo EFETIVOS: mesmo quando so um dos dois muda, a combinacao final
  // precisa continuar valida (null em parentId significa limpar o pai).
  const parentId = input.parentId === undefined ? category.parentId : input.parentId;
  const type = input.type ?? category.type;

  if (parentId) {
    ensureParentCategory(householdId, parentId, type, id);
  }

  db.update(categories)
    .set({
      parentId,
      name: input.name ?? category.name,
      type,
      color: input.color === undefined ? category.color : input.color,
      icon: input.icon === undefined ? category.icon : input.icon,
      updatedAt: now(),
    })
    .where(eq(categories.id, id))
    .run();

  return getCategory(householdId, id);
}

export function archiveCategory(householdId: string, id: string) {
  getCategory(householdId, id);

  db.update(categories)
    .set({
      isArchived: true,
      updatedAt: now(),
    })
    .where(eq(categories.id, id))
    .run();
}
