import { describe, expect, it } from "vitest";
import { NotFoundError } from "../lib/http";
import { recalculateAccountBalance } from "../services/accounts-service";
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "../services/transactions-service";
import {
  accountBalance,
  buildTransactionInput,
  createTestAccount,
  createTestHousehold,
} from "./fixtures";

describe("saldo - fluxo basico", () => {
  it("income confirmado soma na conta", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId, { initialBalanceCents: 10_000 });

    createTransaction(
      buildTransactionInput({
        householdId,
        type: "income",
        accountId: account.id,
        amountCents: 5_000,
      }),
    );

    expect(accountBalance(account.id)).toBe(15_000);
  });

  it("expense confirmada subtrai da conta", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId, { initialBalanceCents: 10_000 });

    createTransaction(
      buildTransactionInput({
        householdId,
        type: "expense",
        accountId: account.id,
        amountCents: 3_000,
      }),
    );

    expect(accountBalance(account.id)).toBe(7_000);
  });

  it("transfer debita a origem e credita o destino", () => {
    const householdId = createTestHousehold();
    const origin = createTestAccount(householdId, { initialBalanceCents: 10_000 });
    const destination = createTestAccount(householdId, { initialBalanceCents: 2_000 });

    createTransaction(
      buildTransactionInput({
        householdId,
        type: "transfer",
        accountId: origin.id,
        transferAccountId: destination.id,
        amountCents: 4_000,
      }),
    );

    expect(accountBalance(origin.id)).toBe(6_000);
    expect(accountBalance(destination.id)).toBe(6_000);
  });

  it("adjustment com valor negativo reduz o saldo", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId, { initialBalanceCents: 10_000 });

    createTransaction(
      buildTransactionInput({
        householdId,
        type: "adjustment",
        accountId: account.id,
        amountCents: -2_500,
        splits: [{ amountCents: -2_500 }],
      }),
    );

    expect(accountBalance(account.id)).toBe(7_500);
  });

  it("transacao pending nao altera o saldo", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId, { initialBalanceCents: 10_000 });

    createTransaction(
      buildTransactionInput({
        householdId,
        type: "expense",
        status: "pending",
        accountId: account.id,
        amountCents: 3_000,
      }),
    );

    expect(accountBalance(account.id)).toBe(10_000);
  });
});

describe("saldo - transicoes de status e updates", () => {
  it("update pending -> confirmed aplica o saldo", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId, { initialBalanceCents: 10_000 });

    const transaction = createTransaction(
      buildTransactionInput({
        householdId,
        type: "expense",
        status: "pending",
        accountId: account.id,
        amountCents: 1_000,
      }),
    );

    expect(accountBalance(account.id)).toBe(10_000);

    updateTransaction(householdId, transaction.id, { status: "confirmed" });

    expect(accountBalance(account.id)).toBe(9_000);
  });

  it("update confirmed -> canceled reverte o saldo", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId, { initialBalanceCents: 10_000 });

    const transaction = createTransaction(
      buildTransactionInput({
        householdId,
        type: "income",
        accountId: account.id,
        amountCents: 2_000,
      }),
    );

    expect(accountBalance(account.id)).toBe(12_000);

    updateTransaction(householdId, transaction.id, { status: "canceled" });

    expect(accountBalance(account.id)).toBe(10_000);
  });

  it("update de amountCents + splits ajusta o saldo pela diferenca", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId, { initialBalanceCents: 10_000 });

    const transaction = createTransaction(
      buildTransactionInput({
        householdId,
        type: "expense",
        accountId: account.id,
        amountCents: 1_000,
      }),
    );

    expect(accountBalance(account.id)).toBe(9_000);

    updateTransaction(householdId, transaction.id, {
      amountCents: 2_500,
      splits: [{ amountCents: 2_500 }],
    });

    expect(accountBalance(account.id)).toBe(7_500);
  });

  it("deleteTransaction reverte o saldo e a transacao some do list/get", () => {
    const householdId = createTestHousehold();
    const account = createTestAccount(householdId, { initialBalanceCents: 10_000 });

    const transaction = createTransaction(
      buildTransactionInput({
        householdId,
        type: "expense",
        accountId: account.id,
        amountCents: 4_000,
      }),
    );

    expect(accountBalance(account.id)).toBe(6_000);

    deleteTransaction(householdId, transaction.id);

    expect(accountBalance(account.id)).toBe(10_000);

    const listed = listTransactions({ householdId, limit: 100 });

    expect(listed.some((item) => item.id === transaction.id)).toBe(false);
    expect(() => getTransaction(householdId, transaction.id)).toThrow(NotFoundError);
  });
});

describe("saldo - paridade entre caminho incremental e recalculo", () => {
  it("recalculateAccountBalance nao muda o saldo apos sequencia variada de operacoes", () => {
    const householdId = createTestHousehold();
    const accountA = createTestAccount(householdId, { initialBalanceCents: 10_000 });
    const accountB = createTestAccount(householdId, { initialBalanceCents: 5_000 });

    // 1. income confirmado em A: A 13.000
    createTransaction(
      buildTransactionInput({
        householdId,
        type: "income",
        accountId: accountA.id,
        amountCents: 3_000,
      }),
    );

    // 2. expense confirmada em A: A 11.800
    createTransaction(
      buildTransactionInput({
        householdId,
        type: "expense",
        accountId: accountA.id,
        amountCents: 1_200,
      }),
    );

    // 3. transfer A -> B: A 11.000, B 5.800
    createTransaction(
      buildTransactionInput({
        householdId,
        type: "transfer",
        accountId: accountA.id,
        transferAccountId: accountB.id,
        amountCents: 800,
      }),
    );

    // 4. adjustment negativo em B: B 5.300
    createTransaction(
      buildTransactionInput({
        householdId,
        type: "adjustment",
        accountId: accountB.id,
        amountCents: -500,
        splits: [{ amountCents: -500 }],
      }),
    );

    // 5. adjustment positivo em A: A 11.250
    createTransaction(
      buildTransactionInput({
        householdId,
        type: "adjustment",
        accountId: accountA.id,
        amountCents: 250,
        splits: [{ amountCents: 250 }],
      }),
    );

    // 6. expense pending em A: sem efeito
    createTransaction(
      buildTransactionInput({
        householdId,
        type: "expense",
        status: "pending",
        accountId: accountA.id,
        amountCents: 700,
      }),
    );

    // 7. income em B atualizado de 2.000 para 2.600: B 7.900
    const incomeB = createTransaction(
      buildTransactionInput({
        householdId,
        type: "income",
        accountId: accountB.id,
        amountCents: 2_000,
      }),
    );
    updateTransaction(householdId, incomeB.id, {
      amountCents: 2_600,
      splits: [{ amountCents: 2_600 }],
    });

    // 8. expense em B criada e excluida: B volta a 7.900
    const expenseB = createTransaction(
      buildTransactionInput({
        householdId,
        type: "expense",
        accountId: accountB.id,
        amountCents: 400,
      }),
    );
    deleteTransaction(householdId, expenseB.id);

    // 9. income pending em A confirmado depois: A 12.750
    const pendingIncomeA = createTransaction(
      buildTransactionInput({
        householdId,
        type: "income",
        status: "pending",
        accountId: accountA.id,
        amountCents: 1_500,
      }),
    );
    updateTransaction(householdId, pendingIncomeA.id, { status: "confirmed" });

    // 10. expense confirmada em A cancelada depois: A permanece 12.750
    const canceledExpenseA = createTransaction(
      buildTransactionInput({
        householdId,
        type: "expense",
        accountId: accountA.id,
        amountCents: 300,
      }),
    );
    updateTransaction(householdId, canceledExpenseA.id, { status: "canceled" });

    const balanceABefore = accountBalance(accountA.id);
    const balanceBBefore = accountBalance(accountB.id);

    expect(balanceABefore).toBe(12_750);
    expect(balanceBBefore).toBe(7_900);

    recalculateAccountBalance(householdId, accountA.id);
    recalculateAccountBalance(householdId, accountB.id);

    expect(accountBalance(accountA.id)).toBe(balanceABefore);
    expect(accountBalance(accountB.id)).toBe(balanceBBefore);
  });
});
