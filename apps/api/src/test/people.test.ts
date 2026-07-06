import { describe, expect, it } from "vitest";
import { getPerson, updatePerson } from "../services/people-service";
import { createTestHousehold, createTestPerson, createTestUser } from "./fixtures";

describe("pessoas - vinculo com usuario", () => {
  it("updatePerson com userId null desvincula o usuario", () => {
    const householdId = createTestHousehold();
    const user = createTestUser();
    const person = createTestPerson(householdId, { userId: user.id });

    expect(person.userId).toBe(user.id);

    const updated = updatePerson(householdId, person.id, { userId: null });

    expect(updated.userId).toBeNull();
    expect(getPerson(householdId, person.id).userId).toBeNull();
  });
});
