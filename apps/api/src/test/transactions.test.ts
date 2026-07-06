import { updateTransactionSchema } from "@finance/shared";
import { describe, expect, it } from "vitest";
import {
  createTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "../services/transactions-service";
import {
  accountBalance,
  buildTransactionInput,
  createTestAccount,
  createTestCategory,
  createTestHousehold,
  createTestTag,
} from "./fixtures";

describe("transacoes - update parcial", () => {
  it("mudar so a description mantem splits, tagIds e saldo", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId, { initialBalanceCents: 10_000 });
    const category = createTestCategory(householdId, { type: "expense" });
    const tag = createTestTag(householdId);

    const transaction = createTransaction(
      buildTransactionInput({
        householdId,
        type: "expense",
        accountId: account.id,
        amountCents: 1_000,
        description: "descricao original",
        splits: [{ categoryId: category.id, amountCents: 600 }, { amountCents: 400 }],
        tagIds: [tag.id],
      }),
    );

    expect(accountBalance(account.id)).toBe(9_000);

    const updated = updateTransaction(householdId, transaction.id, {
      description: "nova descricao",
    });

    expect(updated.description).toBe("nova descricao");
    expect(updated.amountCents).toBe(1_000);
    expect(updated.tagIds).toEqual([tag.id]);
    expect(updated.splits).toHaveLength(2);
    expect(updated.splits.map((split) => split.amountCents).sort((a, b) => a - b)).toEqual([
      400, 600,
    ]);
    expect(updated.splits.find((split) => split.amountCents === 600)?.categoryId).toBe(category.id);
    expect(accountBalance(account.id)).toBe(9_000);
  });

  it("updateTransactionSchema rejeita amountCents sem splits (e vice-versa)", () => {
    const onlyAmount = updateTransactionSchema.safeParse({ amountCents: 2_000 });
    expect(onlyAmount.success).toBe(false);

    const onlySplits = updateTransactionSchema.safeParse({ splits: [{ amountCents: 2_000 }] });
    expect(onlySplits.success).toBe(false);

    const both = updateTransactionSchema.safeParse({
      amountCents: 2_000,
      splits: [{ amountCents: 2_000 }],
    });
    expect(both.success).toBe(true);
  });
});

describe("transacoes - list por conta", () => {
  it("listTransactions com accountId inclui transferencias recebidas", () => {
    const householdId = createTestHousehold();
    const origin = createTestAccount(householdId, { initialBalanceCents: 10_000 });
    const destination = createTestAccount(householdId, { initialBalanceCents: 0 });

    const transfer = createTransaction(
      buildTransactionInput({
        householdId,
        type: "transfer",
        accountId: origin.id,
        transferAccountId: destination.id,
        amountCents: 1_500,
      }),
    );

    const listedForDestination = listTransactions({
      householdId,
      accountId: destination.id,
      limit: 100,
    });

    expect(listedForDestination.some((item) => item.id === transfer.id)).toBe(true);

    const listedForOrigin = listTransactions({
      householdId,
      accountId: origin.id,
      limit: 100,
    });

    expect(listedForOrigin.some((item) => item.id === transfer.id)).toBe(true);
  });
});

describe("transacoes - getTransaction com detalhes", () => {
  it("retorna splits e tagIds da transacao", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId, { initialBalanceCents: 0 });
    const tag = createTestTag(householdId);

    const created = createTransaction(
      buildTransactionInput({
        householdId,
        type: "income",
        accountId: account.id,
        amountCents: 2_000,
        tagIds: [tag.id],
      }),
    );

    const found = getTransaction(householdId, created.id);

    expect(found.id).toBe(created.id);
    expect(found.splits).toHaveLength(1);
    expect(found.splits[0]?.amountCents).toBe(2_000);
    expect(found.tagIds).toEqual([tag.id]);
  });
});
