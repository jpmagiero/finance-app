import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app";
import { createTransaction } from "../services/transactions-service";
import { buildTransactionInput, createTestAccount, createTestHousehold } from "./fixtures";

type App = Awaited<ReturnType<typeof buildApp>>;

describe("HTTP - contratos de erro e saude", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health responde 200 { status: 'ok' }", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("POST /payees duplicado (mesmo nome normalizado) responde 409 conflict", async () => {
    const householdId = createTestHousehold();
    const name = `Mercado ${randomUUID().slice(0, 8)}`;

    const first = await app.inject({
      method: "POST",
      url: "/payees",
      payload: { householdId, name },
    });

    expect(first.statusCode).toBe(201);

    // Mesmo nome com caixa e espacos diferentes: normaliza para o mesmo valor.
    const second = await app.inject({
      method: "POST",
      url: "/payees",
      payload: { householdId, name: `  ${name.toUpperCase()}  ` },
    });

    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ error: "conflict" });
  });

  it("POST /transactions com body invalido responde 400 validation_error", async () => {
    const householdId = createTestHousehold();

    const response = await app.inject({
      method: "POST",
      url: "/transactions",
      payload: { householdId },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "validation_error" });
  });

  it("GET /transactions/:id com householdId de outra casa responde 404 not_found", async () => {
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

    const response = await app.inject({
      method: "GET",
      url: `/transactions/${transaction.id}?householdId=${householdB}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });

  it("GET /dashboard/monthly de household inexistente responde 404", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/dashboard/monthly?householdId=${randomUUID()}&month=2026-01`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });
});
