import { createTransactionSchema } from "@finance/shared";
import { and, desc, eq, gte, isNull, lte, type SQL, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db";
import {
  accounts,
  categories,
  householdPeople,
  households,
  payees,
  tags,
  transactionSplits,
  transactions,
  transactionTags,
} from "../db/schema";
import {
  dateStringProperty,
  genericArrayResponseSchema,
  genericObjectResponseSchema,
  idParamSchema,
  nullableStringProperty,
} from "../lib/docs";
import { badRequest, handleRouteError, notFound } from "../lib/http";
import { createId } from "../lib/ids";
import { now } from "../lib/normalize";

const listTransactionsQuerySchema = z.object({
  householdId: z.string().min(1),
  personId: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  type: z.enum(["income", "expense", "transfer", "adjustment"]).optional(),
  status: z.enum(["pending", "confirmed", "canceled"]).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const transactionParamsSchema = z.object({
  id: z.string().min(1),
});

function ensureHouseholdExists(householdId: string) {
  const household = db.select().from(households).where(eq(households.id, householdId)).get();

  if (!household) {
    notFound("Casa nao encontrada.");
  }
}

function ensureHouseholdReferences(input: z.infer<typeof createTransactionSchema>) {
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

  for (const tagId of new Set(input.tagIds)) {
    const tag = db.select().from(tags).where(eq(tags.id, tagId)).get();

    if (!tag || tag.householdId !== input.householdId) {
      notFound("Tag nao encontrada nesta casa.");
    }
  }
}

function normalizeTransactionInput(input: z.infer<typeof createTransactionSchema>) {
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

export const transactionRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Lista transacoes de uma casa",
        querystring: {
          type: "object",
          required: ["householdId"],
          properties: {
            householdId: { type: "string" },
            personId: { type: "string" },
            accountId: { type: "string" },
            type: { type: "string", enum: ["income", "expense", "transfer", "adjustment"] },
            status: { type: "string", enum: ["pending", "confirmed", "canceled"] },
            from: dateStringProperty,
            to: dateStringProperty,
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          },
        },
        response: {
          200: genericArrayResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const query = listTransactionsQuerySchema.parse(request.query);
        const conditions: SQL[] = [
          eq(transactions.householdId, query.householdId),
          isNull(transactions.deletedAt),
        ];

        if (query.personId) {
          conditions.push(eq(transactions.personId, query.personId));
        }

        if (query.accountId) {
          conditions.push(eq(transactions.accountId, query.accountId));
        }

        if (query.type) {
          conditions.push(eq(transactions.type, query.type));
        }

        if (query.status) {
          conditions.push(eq(transactions.status, query.status));
        }

        if (query.from) {
          conditions.push(gte(transactions.transactionDate, query.from));
        }

        if (query.to) {
          conditions.push(lte(transactions.transactionDate, query.to));
        }

        return db
          .select()
          .from(transactions)
          .where(and(...conditions))
          .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt))
          .limit(query.limit)
          .all();
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Cria uma transacao",
        body: {
          type: "object",
          required: ["householdId", "type", "amountCents", "transactionDate", "splits"],
          properties: {
            householdId: { type: "string" },
            personId: nullableStringProperty,
            accountId: nullableStringProperty,
            payeeId: nullableStringProperty,
            type: { type: "string", enum: ["income", "expense", "transfer", "adjustment"] },
            status: {
              type: "string",
              enum: ["pending", "confirmed", "canceled"],
              default: "confirmed",
            },
            amountCents: { type: "integer", minimum: 1 },
            description: nullableStringProperty,
            notes: nullableStringProperty,
            transactionDate: dateStringProperty,
            competenceDate: nullableStringProperty,
            transferAccountId: nullableStringProperty,
            splits: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["amountCents"],
                properties: {
                  categoryId: nullableStringProperty,
                  amountCents: { type: "integer", minimum: 1 },
                  description: nullableStringProperty,
                },
              },
            },
            tagIds: {
              type: "array",
              items: { type: "string" },
              default: [],
            },
          },
        },
        response: {
          201: genericObjectResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const input = normalizeTransactionInput(createTransactionSchema.parse(request.body));

        ensureHouseholdExists(input.householdId);
        ensureHouseholdReferences(input);

        if (input.type !== "transfer" && input.transferAccountId) {
          badRequest("Apenas transferencias podem ter conta de destino.");
        }

        const transactionId = createId();
        const timestamp = now();

        db.transaction((tx) => {
          tx.insert(transactions)
            .values({
              id: transactionId,
              householdId: input.householdId,
              personId: input.personId,
              accountId: input.accountId,
              payeeId: input.payeeId,
              type: input.type,
              status: input.status,
              amountCents: input.amountCents,
              description: input.description,
              notes: input.notes,
              transactionDate: input.transactionDate,
              competenceDate: input.competenceDate,
              transferAccountId: input.transferAccountId,
            })
            .run();

          if (input.status === "confirmed" && input.accountId && input.type === "income") {
            tx.update(accounts)
              .set({
                currentBalanceCents: sql`${accounts.currentBalanceCents} + ${input.amountCents}`,
                updatedAt: timestamp,
              })
              .where(eq(accounts.id, input.accountId))
              .run();
          }

          if (input.status === "confirmed" && input.accountId && input.type === "expense") {
            tx.update(accounts)
              .set({
                currentBalanceCents: sql`${accounts.currentBalanceCents} - ${input.amountCents}`,
                updatedAt: timestamp,
              })
              .where(eq(accounts.id, input.accountId))
              .run();
          }

          if (
            input.status === "confirmed" &&
            input.accountId &&
            input.transferAccountId &&
            input.type === "transfer"
          ) {
            tx.update(accounts)
              .set({
                currentBalanceCents: sql`${accounts.currentBalanceCents} - ${input.amountCents}`,
                updatedAt: timestamp,
              })
              .where(eq(accounts.id, input.accountId))
              .run();

            tx.update(accounts)
              .set({
                currentBalanceCents: sql`${accounts.currentBalanceCents} + ${input.amountCents}`,
                updatedAt: timestamp,
              })
              .where(eq(accounts.id, input.transferAccountId))
              .run();
          }

          for (const split of input.splits) {
            tx.insert(transactionSplits)
              .values({
                id: createId(),
                transactionId,
                categoryId: split.categoryId ?? null,
                amountCents: split.amountCents,
                description: split.description ?? null,
              })
              .run();
          }

          for (const tagId of input.tagIds) {
            tx.insert(transactionTags)
              .values({
                transactionId,
                tagId,
              })
              .run();
          }
        });

        const transaction = db
          .select()
          .from(transactions)
          .where(eq(transactions.id, transactionId))
          .get();

        return reply.status(201).send(transaction);
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Transactions"],
        summary: "Remove uma transacao com soft delete",
        params: idParamSchema,
      },
    },
    async (request, reply) => {
      try {
        const params = transactionParamsSchema.parse(request.params);
        const transaction = db
          .select()
          .from(transactions)
          .where(eq(transactions.id, params.id))
          .get();

        if (!transaction || transaction.deletedAt) {
          notFound("Transacao nao encontrada.");
        }

        const timestamp = now();

        db.transaction((tx) => {
          tx.update(transactions)
            .set({
              deletedAt: timestamp,
              updatedAt: timestamp,
            })
            .where(eq(transactions.id, params.id))
            .run();

          if (
            transaction.status === "confirmed" &&
            transaction.accountId &&
            transaction.type === "income"
          ) {
            tx.update(accounts)
              .set({
                currentBalanceCents: sql`
                ${accounts.currentBalanceCents} - ${transaction.amountCents}
              `,
                updatedAt: timestamp,
              })
              .where(eq(accounts.id, transaction.accountId))
              .run();
          }

          if (
            transaction.status === "confirmed" &&
            transaction.accountId &&
            transaction.type === "expense"
          ) {
            tx.update(accounts)
              .set({
                currentBalanceCents: sql`
                ${accounts.currentBalanceCents} + ${transaction.amountCents}
              `,
                updatedAt: timestamp,
              })
              .where(eq(accounts.id, transaction.accountId))
              .run();
          }

          if (
            transaction.status === "confirmed" &&
            transaction.accountId &&
            transaction.transferAccountId &&
            transaction.type === "transfer"
          ) {
            tx.update(accounts)
              .set({
                currentBalanceCents: sql`
                ${accounts.currentBalanceCents} + ${transaction.amountCents}
              `,
                updatedAt: timestamp,
              })
              .where(eq(accounts.id, transaction.accountId))
              .run();

            tx.update(accounts)
              .set({
                currentBalanceCents: sql`
                ${accounts.currentBalanceCents} - ${transaction.amountCents}
              `,
                updatedAt: timestamp,
              })
              .where(eq(accounts.id, transaction.transferAccountId))
              .run();
          }
        });

        return reply.status(204).send();
      } catch (error) {
        return handleRouteError(reply, error);
      }
    },
  );
};
