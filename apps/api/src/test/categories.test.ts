import { describe, expect, it } from "vitest";
import { BadRequestError } from "../lib/http";
import { updateCategory } from "../services/categories-service";
import { createTestCategory, createTestHousehold } from "./fixtures";

describe("categorias - hierarquia", () => {
  it("update que criaria ciclo A -> B -> A lanca BadRequestError", () => {
    const householdId = createTestHousehold();
    const categoryA = createTestCategory(householdId, { type: "expense" });
    const categoryB = createTestCategory(householdId, {
      type: "expense",
      parentId: categoryA.id,
    });

    // B ja e filha de A; tornar B pai de A fecharia o ciclo.
    expect(() => updateCategory(householdId, categoryA.id, { parentId: categoryB.id })).toThrow(
      BadRequestError,
    );
  });

  it("pai de tipo efetivo diferente lanca BadRequestError", () => {
    const householdId = createTestHousehold();
    const incomeParent = createTestCategory(householdId, { type: "income" });
    const expenseChild = createTestCategory(householdId, { type: "expense" });

    // O update nao envia type: o tipo efetivo da filha continua expense e o
    // pai income e incompativel.
    expect(() =>
      updateCategory(householdId, expenseChild.id, { parentId: incomeParent.id }),
    ).toThrow(BadRequestError);
  });
});
