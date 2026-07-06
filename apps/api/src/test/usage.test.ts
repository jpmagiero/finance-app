import { describe, expect, it } from "vitest";
import { BadRequestError, NotFoundError } from "../lib/http";
import { deletePayee, getPayee } from "../services/payees-service";
import { deleteTag, getTag } from "../services/tags-service";
import { createTransaction, deleteTransaction } from "../services/transactions-service";
import {
  buildTransactionInput,
  createTestAccount,
  createTestHousehold,
  createTestPayee,
  createTestTag,
} from "./fixtures";

describe("tags e favorecidos em uso", () => {
  it("deleteTag com transacao ativa lanca BadRequestError; apos soft delete a exclusao passa", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId);
    const tag = createTestTag(householdId);

    const transaction = createTransaction(
      buildTransactionInput({
        householdId,
        type: "expense",
        accountId: account.id,
        amountCents: 1_000,
        tagIds: [tag.id],
      }),
    );

    expect(() => deleteTag(householdId, tag.id)).toThrow(BadRequestError);

    deleteTransaction(householdId, transaction.id);

    expect(() => deleteTag(householdId, tag.id)).not.toThrow();
    expect(() => getTag(householdId, tag.id)).toThrow(NotFoundError);
  });

  it("deletePayee com transacao ativa lanca BadRequestError; apos soft delete a exclusao passa", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId);
    const payee = createTestPayee(householdId);

    const transaction = createTransaction(
      buildTransactionInput({
        householdId,
        type: "expense",
        accountId: account.id,
        payeeId: payee.id,
        amountCents: 1_000,
      }),
    );

    expect(() => deletePayee(householdId, payee.id)).toThrow(BadRequestError);

    deleteTransaction(householdId, transaction.id);

    expect(() => deletePayee(householdId, payee.id)).not.toThrow();
    expect(() => getPayee(householdId, payee.id)).toThrow(NotFoundError);
  });
});
