import { type CreateTransactionInput, createTransactionSchema } from "@finance/shared";
import { and, desc, eq, gte, isNull, lte, or, type SQL, sql } from "drizzle-orm";
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
import { moneyAsBigInt, safeMoneyCents } from "../lib/money";
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
  page?: number;
  search?: string;
  categoryId?: string;
  tagId?: string;
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

function updateAccountBalance(accountId: string, amountCents: bigint, timestamp: string) {
  const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!account) {
    notFound("Conta nao encontrada.");
  }
  const currentBalanceCents = safeMoneyCents(
    moneyAsBigInt(account.currentBalanceCents) + amountCents,
  );
  db.update(accounts)
    .set({
      currentBalanceCents,
      updatedAt: timestamp,
    })
    .where(eq(accounts.id, accountId))
    .run();
}

type BalanceTransaction = {
  type: string;
  status: string;
  amountCents: number;
  accountId: string | null;
  transferAccountId: string | null;
};

function applyTransactionBalances(
  changes: { transaction: BalanceTransaction; direction: 1 | -1 }[],
  timestamp: string,
) {
  // Apply the net change per account. Reversing an old entry separately could
  // overflow temporarily even when the final balance is representable.
  const deltas = new Map<string, bigint>();
  const add = (id: string, amount: bigint) => {
    deltas.set(id, (deltas.get(id) ?? 0n) + amount);
  };
  for (const { transaction, direction } of changes) {
    if (transaction.status !== "confirmed") continue;
    const amount = moneyAsBigInt(transaction.amountCents) * BigInt(direction);
    if (transaction.type === "income" && transaction.accountId) {
      add(transaction.accountId, amount);
    }
    if (transaction.type === "expense" && transaction.accountId) {
      add(transaction.accountId, -amount);
    }
    if (transaction.type === "transfer" && transaction.accountId && transaction.transferAccountId) {
      add(transaction.accountId, -amount);
      add(transaction.transferAccountId, amount);
    }
  }
  for (const [id, delta] of deltas) updateAccountBalance(id, delta, timestamp);
}

function ensureTransactionReferences(
  input: ReturnType<typeof normalizeTransactionInput>,
  existing?: ReturnType<typeof getTransaction>,
) {
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

  if (
    input.personId &&
    !db.select().from(householdPeople).where(eq(householdPeople.id, input.personId)).get()
      ?.isActive &&
    existing?.personId !== input.personId
  )
    badRequest("Pessoa esta inativa.");

  if (input.accountId) {
    const account = db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();

    if (!account || account.householdId !== input.householdId) {
      notFound("Conta de origem nao encontrada nesta casa.");
    }
  }

  if (
    input.accountId &&
    db.select().from(accounts).where(eq(accounts.id, input.accountId)).get()?.isArchived &&
    existing?.accountId !== input.accountId
  )
    badRequest("Conta de origem esta arquivada.");

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

  if (
    input.transferAccountId &&
    db.select().from(accounts).where(eq(accounts.id, input.transferAccountId)).get()?.isArchived &&
    existing?.transferAccountId !== input.transferAccountId
  )
    badRequest("Conta de destino esta arquivada.");

  if (input.type === "transfer" && input.accountId && input.transferAccountId) {
    const origin = db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();
    const destination = db
      .select()
      .from(accounts)
      .where(eq(accounts.id, input.transferAccountId))
      .get();
    if (origin?.currency !== destination?.currency) {
      badRequest("Transferencias exigem contas da mesma moeda.");
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

    if (category.isArchived && !existing?.splits.some((old) => old.categoryId === category.id))
      badRequest("Categoria esta arquivada.");

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

function transactionConditions(input: ListTransactionsInput) {
  ensureHouseholdExists(input.householdId);

  const conditions: SQL[] = [
    eq(transactions.householdId, input.householdId),
    isNull(transactions.deletedAt),
  ];

  if (input.personId) {
    conditions.push(
      input.personId === "unassigned"
        ? isNull(transactions.personId)
        : eq(transactions.personId, input.personId),
    );
  }

  if (input.accountId) {
    const accountCondition = or(
      eq(transactions.accountId, input.accountId),
      eq(transactions.transferAccountId, input.accountId),
    );
    if (accountCondition) conditions.push(accountCondition);
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

  if (input.search)
    conditions.push(
      sql`instr(lower(coalesce(${transactions.description}, '') || ' ' || coalesce(${transactions.notes}, '')), lower(${input.search})) > 0`,
    );
  if (input.categoryId)
    conditions.push(
      sql`exists (select 1 from transaction_splits s where s.transaction_id = ${transactions.id} and s.category_id = ${input.categoryId})`,
    );
  if (input.tagId)
    conditions.push(
      sql`exists (select 1 from transaction_tags tt where tt.transaction_id = ${transactions.id} and tt.tag_id = ${input.tagId})`,
    );
  return and(...conditions);
}

export function listTransactions(input: ListTransactionsInput) {
  return db
    .select()
    .from(transactions)
    .where(transactionConditions(input))
    .orderBy(
      desc(transactions.transactionDate),
      desc(transactions.createdAt),
      desc(transactions.id),
    )
    .limit(input.limit)
    .offset(((input.page ?? 1) - 1) * input.limit)
    .all();
}

export function listTransactionPage(input: ListTransactionsInput) {
  const items = listTransactions(input);
  const total =
    db
      .select({ total: sql<number>`count(*)` })
      .from(transactions)
      .where(transactionConditions(input))
      .get()?.total ?? 0;
  return { items, total, page: input.page ?? 1, pageSize: input.limit };
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

export function validateNewTransaction(input: CreateTransactionInput) {
  const normalized = normalizeTransactionInput(createTransactionSchema.parse(input));
  ensureTransactionReferences(normalized);
  return normalized;
}
export function createTransaction(
  input: CreateTransactionInput,
  createdByUserId?: string,
  recurrence?: { recurringTransactionId: string; occurrenceDate: string },
) {
  const normalizedInput = normalizeTransactionInput(createTransactionSchema.parse(input));
  ensureTransactionReferences(normalizedInput);

  const transactionId = createId();
  const timestamp = now();

  db.transaction(() => {
    db.insert(transactions)
      .values({
        id: transactionId,
        createdByUserId: createdByUserId ?? null,
        recurringTransactionId: recurrence?.recurringTransactionId ?? null,
        occurrenceDate: recurrence?.occurrenceDate ?? null,
        isRecurring: !!recurrence,
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

    applyTransactionBalances([{ transaction: normalizedInput, direction: 1 }], timestamp);

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
  const normalizedInput = normalizeTransactionInput(createTransactionSchema.parse(input));
  if (normalizedInput.householdId !== existingTransaction.householdId) {
    badRequest("A casa da transacao nao pode ser alterada.");
  }
  ensureTransactionReferences(normalizedInput, existingTransaction);

  const timestamp = now();

  db.transaction(() => {
    applyTransactionBalances(
      [
        { transaction: existingTransaction, direction: -1 },
        { transaction: normalizedInput, direction: 1 },
      ],
      timestamp,
    );

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

    applyTransactionBalances([{ transaction, direction: -1 }], timestamp);
  });
}
