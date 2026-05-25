import type { CreateTransactionInput } from "@finance/shared";
import { and, desc, eq, gte, isNull, lte, type SQL, sql } from "drizzle-orm";
import { db } from "../db";
import {
  accounts,
  categories,
  householdPeople,
  payees,
  tags,
  transactionSplits,
  transactions,
  transactionTags,
} from "../db/schema";
import { badRequest, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";
import { ensureHouseholdExists } from "./common-service";

type ListTransactionsInput = {
  householdId: string;
  personId?: string;
  accountId?: string;
  type?: "income" | "expense" | "transfer" | "adjustment";
  status?: "pending" | "confirmed" | "canceled";
  from?: string;
  to?: string;
  limit: number;
};

function normalizeTransactionInput(input: CreateTransactionInput) {
  return {
    ...input,
    personId: input.personId ?? null,
    accountId: input.accountId ?? null,
    payeeId: input.payeeId ?? null,
    description: input.description ?? null,
    notes: input.notes ?? null,
    competenceDate: input.competenceDate ?? null,
    transferAccountId: input.transferAccountId ?? null,
    tagIds: [...new Set(input.tagIds)],
  };
}

function updateAccountBalance(accountId: string, amountCents: number, timestamp: string) {
  db.update(accounts)
    .set({
      currentBalanceCents: sql`${accounts.currentBalanceCents} + ${amountCents}`,
      updatedAt: timestamp,
    })
    .where(eq(accounts.id, accountId))
    .run();
}

function applyTransactionBalance(
  transaction: {
    type: string;
    status: string;
    amountCents: number;
    accountId: string | null;
    transferAccountId: string | null;
  },
  direction: 1 | -1,
  timestamp: string,
) {
  if (transaction.status !== "confirmed") {
    return;
  }

  if (transaction.type === "income" && transaction.accountId) {
    updateAccountBalance(transaction.accountId, transaction.amountCents * direction, timestamp);
  }

  if (transaction.type === "expense" && transaction.accountId) {
    updateAccountBalance(transaction.accountId, -transaction.amountCents * direction, timestamp);
  }

  if (transaction.type === "transfer" && transaction.accountId && transaction.transferAccountId) {
    updateAccountBalance(transaction.accountId, -transaction.amountCents * direction, timestamp);
    updateAccountBalance(
      transaction.transferAccountId,
      transaction.amountCents * direction,
      timestamp,
    );
  }
}

function ensureTransactionReferences(input: ReturnType<typeof normalizeTransactionInput>) {
  ensureHouseholdExists(input.householdId);

  if (input.type !== "transfer" && input.transferAccountId) {
    badRequest("Apenas transferencias podem ter conta de destino.");
  }

  if (input.personId) {
    const person = db
      .select()
      .from(householdPeople)
      .where(eq(householdPeople.id, input.personId))
      .get();

    if (!person || person.householdId !== input.householdId) {
      notFound("Pessoa nao encontrada nesta casa.");
    }
  }

  if (input.accountId) {
    const account = db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();

    if (!account || account.householdId !== input.householdId) {
      notFound("Conta de origem nao encontrada nesta casa.");
    }
  }

  if (input.transferAccountId) {
    const account = db
      .select()
      .from(accounts)
      .where(eq(accounts.id, input.transferAccountId))
      .get();

    if (!account || account.householdId !== input.householdId) {
      notFound("Conta de destino nao encontrada nesta casa.");
    }
  }

  if (input.payeeId) {
    const payee = db.select().from(payees).where(eq(payees.id, input.payeeId)).get();

    if (!payee || payee.householdId !== input.householdId) {
      notFound("Favorecido nao encontrado nesta casa.");
    }
  }

  for (const split of input.splits) {
    if (!split.categoryId) {
      continue;
    }

    const category = db.select().from(categories).where(eq(categories.id, split.categoryId)).get();

    if (!category || category.householdId !== input.householdId) {
      notFound("Categoria nao encontrada nesta casa.");
    }

    if (input.type !== "adjustment" && category.type !== input.type) {
      badRequest("Categoria incompativel com o tipo da transacao.");
    }
  }

  for (const tagId of input.tagIds) {
    const tag = db.select().from(tags).where(eq(tags.id, tagId)).get();

    if (!tag || tag.householdId !== input.householdId) {
      notFound("Tag nao encontrada nesta casa.");
    }
  }
}

export function listTransactions(input: ListTransactionsInput) {
  ensureHouseholdExists(input.householdId);

  const conditions: SQL[] = [
    eq(transactions.householdId, input.householdId),
    isNull(transactions.deletedAt),
  ];

  if (input.personId) {
    conditions.push(eq(transactions.personId, input.personId));
  }

  if (input.accountId) {
    conditions.push(eq(transactions.accountId, input.accountId));
  }

  if (input.type) {
    conditions.push(eq(transactions.type, input.type));
  }

  if (input.status) {
    conditions.push(eq(transactions.status, input.status));
  }

  if (input.from) {
    conditions.push(gte(transactions.transactionDate, input.from));
  }

  if (input.to) {
    conditions.push(lte(transactions.transactionDate, input.to));
  }

  return db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
    .limit(input.limit)
    .all();
}

export function getTransaction(id: string) {
  const transaction = db.select().from(transactions).where(eq(transactions.id, id)).get();

  if (!transaction || transaction.deletedAt) {
    notFound("Transacao nao encontrada.");
  }

  const splits = db
    .select()
    .from(transactionSplits)
    .where(eq(transactionSplits.transactionId, id))
    .all();
  const tagLinks = db
    .select()
    .from(transactionTags)
    .where(eq(transactionTags.transactionId, id))
    .all();

  return {
    ...transaction,
    splits,
    tagIds: tagLinks.map((tagLink) => tagLink.tagId),
  };
}

export function createTransaction(input: CreateTransactionInput) {
  const normalizedInput = normalizeTransactionInput(input);
  ensureTransactionReferences(normalizedInput);

  const transactionId = createId();
  const timestamp = now();

  db.transaction(() => {
    db.insert(transactions)
      .values({
        id: transactionId,
        householdId: normalizedInput.householdId,
        personId: normalizedInput.personId,
        accountId: normalizedInput.accountId,
        payeeId: normalizedInput.payeeId,
        type: normalizedInput.type,
        status: normalizedInput.status,
        amountCents: normalizedInput.amountCents,
        description: normalizedInput.description,
        notes: normalizedInput.notes,
        transactionDate: normalizedInput.transactionDate,
        competenceDate: normalizedInput.competenceDate,
        transferAccountId: normalizedInput.transferAccountId,
      })
      .run();

    applyTransactionBalance(normalizedInput, 1, timestamp);

    for (const split of normalizedInput.splits) {
      db.insert(transactionSplits)
        .values({
          id: createId(),
          transactionId,
          categoryId: split.categoryId ?? null,
          amountCents: split.amountCents,
          description: split.description ?? null,
        })
        .run();
    }

    for (const tagId of normalizedInput.tagIds) {
      db.insert(transactionTags).values({ transactionId, tagId }).run();
    }
  });

  return getTransaction(transactionId);
}

export function updateTransaction(id: string, input: CreateTransactionInput) {
  const existingTransaction = getTransaction(id);
  const normalizedInput = normalizeTransactionInput(input);
  ensureTransactionReferences(normalizedInput);

  const timestamp = now();

  db.transaction(() => {
    applyTransactionBalance(existingTransaction, -1, timestamp);

    db.update(transactions)
      .set({
        householdId: normalizedInput.householdId,
        personId: normalizedInput.personId,
        accountId: normalizedInput.accountId,
        payeeId: normalizedInput.payeeId,
        type: normalizedInput.type,
        status: normalizedInput.status,
        amountCents: normalizedInput.amountCents,
        description: normalizedInput.description,
        notes: normalizedInput.notes,
        transactionDate: normalizedInput.transactionDate,
        competenceDate: normalizedInput.competenceDate,
        transferAccountId: normalizedInput.transferAccountId,
        updatedAt: timestamp,
      })
      .where(eq(transactions.id, id))
      .run();

    db.delete(transactionSplits).where(eq(transactionSplits.transactionId, id)).run();
    db.delete(transactionTags).where(eq(transactionTags.transactionId, id)).run();

    for (const split of normalizedInput.splits) {
      db.insert(transactionSplits)
        .values({
          id: createId(),
          transactionId: id,
          categoryId: split.categoryId ?? null,
          amountCents: split.amountCents,
          description: split.description ?? null,
        })
        .run();
    }

    for (const tagId of normalizedInput.tagIds) {
      db.insert(transactionTags).values({ transactionId: id, tagId }).run();
    }

    applyTransactionBalance(normalizedInput, 1, timestamp);
  });

  return getTransaction(id);
}

export function deleteTransaction(id: string) {
  const transaction = getTransaction(id);
  const timestamp = now();

  db.transaction(() => {
    db.update(transactions)
      .set({
        deletedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(transactions.id, id))
      .run();

    applyTransactionBalance(transaction, -1, timestamp);
  });
}
