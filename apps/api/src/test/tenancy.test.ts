import { updateTransactionSchema } from "@finance/shared";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "../lib/http";
import { getAccount } from "../services/accounts-service";
import { getTag } from "../services/tags-service";
import {
  createTransaction,
  getTransaction,
  updateTransaction,
} from "../services/transactions-service";
import {
  buildTransactionInput,
  createTestAccount,
  createTestHousehold,
  createTestTag,
} from "./fixtures";

describe("tenancy - escopo por household", () => {
  it("getTransaction do household A com id do household B lanca NotFoundError", () => {
    const householdA = createTestHousehold("Casa A");
    const householdB = createTestHousehold("Casa B");
    const accountB = createTestAccount(householdB);

    const transactionB = createTransaction(
      buildTransactionInput({
        householdId: householdB,
        type: "expense",
        accountId: accountB.id,
        amountCents: 1_000,
      }),
    );

    expect(() => getTransaction(householdA, transactionB.id)).toThrow(NotFoundError);
  });

  it("getAccount do household A com id do household B lanca NotFoundError", () => {
    const householdA = createTestHousehold("Casa A");
    const householdB = createTestHousehold("Casa B");
    const accountB = createTestAccount(householdB);

    expect(() => getAccount(householdA, accountB.id)).toThrow(NotFoundError);
  });

  it("getTag do household A com id do household B lanca NotFoundError", () => {
    const householdA = createTestHousehold("Casa A");
    const householdB = createTestHousehold("Casa B");
    const tagB = createTestTag(householdB);

    expect(() => getTag(householdA, tagB.id)).toThrow(NotFoundError);
  });

  it("updateTransaction nao permite mover de household", () => {
    const householdA = createTestHousehold("Casa A");
    const householdB = createTestHousehold("Casa B");
    const accountA = createTestAccount(householdA);

    const transaction = createTransaction(
      buildTransactionInput({
        householdId: householdA,
        type: "expense",
        accountId: accountA.id,
        amountCents: 1_000,
      }),
    );

    // O campo householdId nem existe no schema de update: e removido do payload.
    const parsed = updateTransactionSchema.safeParse({
      householdId: householdB,
      description: "tentativa de mudanca de casa",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("householdId" in parsed.data).toBe(false);
    }

    const updated = updateTransaction(householdA, transaction.id, {
      description: "tentativa de mudanca de casa",
    });

    expect(updated.householdId).toBe(householdA);
    expect(getTransaction(householdA, transaction.id).householdId).toBe(householdA);
  });
});
