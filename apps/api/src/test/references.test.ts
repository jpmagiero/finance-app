import { describe, expect, it } from "vitest";
import { BadRequestError } from "../lib/http";
import { createTransaction } from "../services/transactions-service";
import {
  buildTransactionInput,
  createTestAccount,
  createTestCategory,
  createTestHousehold,
  createTestPerson,
} from "./fixtures";

describe("regras de referencia na criacao de transacao", () => {
  it("transfer entre contas de moedas diferentes lanca BadRequestError", () => {
    const householdId = createTestHousehold();
    const originBrl = createTestAccount(householdId, { currency: "BRL" });
    const destinationUsd = createTestAccount(householdId, { currency: "USD" });

    expect(() =>
      createTransaction(
        buildTransactionInput({
          householdId,
          type: "transfer",
          accountId: originBrl.id,
          transferAccountId: destinationUsd.id,
          amountCents: 1_000,
        }),
      ),
    ).toThrow(BadRequestError);
  });

  it("lancamento em conta arquivada lanca BadRequestError", () => {
    const householdId = createTestHousehold();
    const archivedAccount = createTestAccount(householdId, { isArchived: true });

    expect(() =>
      createTransaction(
        buildTransactionInput({
          householdId,
          type: "expense",
          accountId: archivedAccount.id,
          amountCents: 1_000,
        }),
      ),
    ).toThrow(BadRequestError);
  });

  it("categoria de tipo incompativel com a transacao lanca BadRequestError", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId);
    const incomeCategory = createTestCategory(householdId, { type: "income" });

    expect(() =>
      createTransaction(
        buildTransactionInput({
          householdId,
          type: "expense",
          accountId: account.id,
          amountCents: 1_000,
          splits: [{ categoryId: incomeCategory.id, amountCents: 1_000 }],
        }),
      ),
    ).toThrow(BadRequestError);
  });

  it("pessoa inativa lanca BadRequestError", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId);
    const inactivePerson = createTestPerson(householdId, { isActive: false });

    expect(() =>
      createTransaction(
        buildTransactionInput({
          householdId,
          type: "expense",
          accountId: account.id,
          personId: inactivePerson.id,
          amountCents: 1_000,
        }),
      ),
    ).toThrow(BadRequestError);
  });
});
