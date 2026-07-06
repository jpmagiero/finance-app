import { describe, expect, it } from "vitest";
import { createAccount, getAccount, updateAccount } from "../services/accounts-service";
import { createTestHousehold } from "./fixtures";

describe("contas - saldo inicial", () => {
  it("createAccount grava currentBalanceCents igual ao initialBalanceCents", () => {
    const householdId = createTestHousehold();

    const account = createAccount({
      householdId,
      name: "Conta Corrente",
      type: "checking",
      currency: "BRL",
      initialBalanceCents: 12_345,
      isShared: false,
    });

    expect(account.initialBalanceCents).toBe(12_345);
    expect(account.currentBalanceCents).toBe(12_345);
  });

  it("updateAccount com initialBalanceCents novo ajusta currentBalanceCents pela diferenca", () => {
    const householdId = createTestHousehold();

    const account = createAccount({
      householdId,
      name: "Conta Poupanca",
      type: "savings",
      currency: "BRL",
      initialBalanceCents: 10_000,
      isShared: false,
    });

    // Sobe o saldo inicial em 4.000; o saldo atual deve subir junto.
    const updated = updateAccount(householdId, account.id, { initialBalanceCents: 14_000 });

    expect(updated.initialBalanceCents).toBe(14_000);
    expect(updated.currentBalanceCents).toBe(14_000);

    const found = getAccount(householdId, account.id);
    expect(found.currentBalanceCents).toBe(14_000);
  });
});
