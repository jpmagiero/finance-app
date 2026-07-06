import {
  type CreateTransactionInput,
  createTransactionSchema,
  type TransactionStatus,
  type TransactionType,
  type UpdateTransactionInput,
} from "@finance/shared";
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
import { type BalanceImpactInput, balanceDeltas } from "../lib/balance";
import { badRequest, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";
import { ensureHouseholdExists } from "./common-service";

type ListTransactionsInput = {
  householdId: string;
  personId?: string;
  accountId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
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

// Aplica (direction = 1) ou reverte (direction = -1) o impacto de uma transacao
// nos saldos das contas, usando balanceDeltas como fonte unica da regra.
function applyBalanceDeltas(transaction: BalanceImpactInput, direction: 1 | -1, timestamp: string) {
  for (const delta of balanceDeltas(transaction)) {
    updateAccountBalance(delta.accountId, delta.deltaCents * direction, timestamp);
  }
}

function ensureTransactionReferences(input: ReturnType<typeof normalizeTransactionInput>) {
  ensureHouseholdExists(input.householdId);

  // O schema Zod do shared tambem valida esta regra; mantida aqui como defesa
  // em profundidade para chamadas internas que nao passam pelo schema.
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

    if (!person.isActive) {
      badRequest("Pessoa inativa nao pode receber lancamentos.");
    }
  }

  let originAccount: typeof accounts.$inferSelect | undefined;

  if (input.accountId) {
    originAccount = db.select().from(accounts).where(eq(accounts.id, input.accountId)).get();

    if (!originAccount || originAccount.householdId !== input.householdId) {
      notFound("Conta de origem nao encontrada nesta casa.");
    }

    if (originAccount.isArchived) {
      badRequest("Conta arquivada nao pode receber lancamentos.");
    }
  }

  let destinationAccount: typeof accounts.$inferSelect | undefined;

  if (input.transferAccountId) {
    destinationAccount = db
      .select()
      .from(accounts)
      .where(eq(accounts.id, input.transferAccountId))
      .get();

    if (!destinationAccount || destinationAccount.householdId !== input.householdId) {
      notFound("Conta de destino nao encontrada nesta casa.");
    }

    if (destinationAccount.isArchived) {
      badRequest("Conta arquivada nao pode receber lancamentos.");
    }
  }

  if (
    input.type === "transfer" &&
    originAccount &&
    destinationAccount &&
    originAccount.currency !== destinationAccount.currency
  ) {
    badRequest("Transferencia entre contas de moedas diferentes nao e suportada.");
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

    if (category.isArchived) {
      badRequest("Categoria arquivada nao pode receber lancamentos.");
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
    // O extrato de uma conta inclui transferencias recebidas por ela.
    const accountCondition = or(
      eq(transactions.accountId, input.accountId),
      eq(transactions.transferAccountId, input.accountId),
    );

    if (accountCondition) {
      conditions.push(accountCondition);
    }
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

export function getTransaction(householdId: string, id: string) {
  const transaction = db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.householdId, householdId)))
    .get();

  if (!transaction || transaction.deletedAt) {
    notFound("Transacao nao encontrada nesta casa.");
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

    applyBalanceDeltas(normalizedInput, 1, timestamp);

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

  return getTransaction(input.householdId, transactionId);
}

export function updateTransaction(householdId: string, id: string, input: UpdateTransactionInput) {
  const existingTransaction = getTransaction(householdId, id);

  // Payload completo mesclado: campos ausentes no input mantem o valor atual;
  // null explicito limpa campos nullable. householdId e imutavel.
  const mergedInput = createTransactionSchema.parse({
    householdId: existingTransaction.householdId,
    personId: input.personId === undefined ? existingTransaction.personId : input.personId,
    accountId: input.accountId === undefined ? existingTransaction.accountId : input.accountId,
    payeeId: input.payeeId === undefined ? existingTransaction.payeeId : input.payeeId,
    type: input.type === undefined ? existingTransaction.type : input.type,
    status: input.status === undefined ? existingTransaction.status : input.status,
    amountCents:
      input.amountCents === undefined ? existingTransaction.amountCents : input.amountCents,
    description:
      input.description === undefined ? existingTransaction.description : input.description,
    notes: input.notes === undefined ? existingTransaction.notes : input.notes,
    transactionDate:
      input.transactionDate === undefined
        ? existingTransaction.transactionDate
        : input.transactionDate,
    competenceDate:
      input.competenceDate === undefined
        ? existingTransaction.competenceDate
        : input.competenceDate,
    transferAccountId:
      input.transferAccountId === undefined
        ? existingTransaction.transferAccountId
        : input.transferAccountId,
    splits:
      input.splits === undefined
        ? existingTransaction.splits.map((split) => ({
            categoryId: split.categoryId,
            amountCents: split.amountCents,
            description: split.description,
          }))
        : input.splits,
    tagIds: input.tagIds === undefined ? existingTransaction.tagIds : input.tagIds,
  });

  const normalizedInput = normalizeTransactionInput(mergedInput);
  ensureTransactionReferences(normalizedInput);

  const timestamp = now();

  db.transaction(() => {
    applyBalanceDeltas(existingTransaction, -1, timestamp);

    db.update(transactions)
      .set({
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

    applyBalanceDeltas(normalizedInput, 1, timestamp);
  });

  return getTransaction(householdId, id);
}

export function deleteTransaction(householdId: string, id: string) {
  const transaction = getTransaction(householdId, id);
  const timestamp = now();

  db.transaction(() => {
    db.update(transactions)
      .set({
        deletedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(eq(transactions.id, id))
      .run();

    applyBalanceDeltas(transaction, -1, timestamp);
  });
}
