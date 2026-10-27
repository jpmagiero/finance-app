import assert from "node:assert/strict";
import { test } from "node:test";
import { api, setCsrfToken } from "../../../web/src/lib/api";
import { amountInput, cents } from "../../../web/src/lib/money";

test("money form values preserve cents and reject fractions and unsafe values", () => {
  assert.equal(cents("125,50"), 12550);
  assert.equal(cents("125.5"), 12550);
  assert.equal(cents("-10,01", true), -1001);
  assert.equal(cents(amountInput(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
  assert.equal(cents(amountInput(Number.MIN_SAFE_INTEGER), true), Number.MIN_SAFE_INTEGER);
  for (const value of ["1,234", "1.000,00", "-1", "", "Infinity", "90071992547409,92"])
    assert.throws(() => cents(value));
});

test("an old unauthorized response cannot log out a newer session", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const target = new EventTarget();
  let expired = 0;
  target.addEventListener("finance-session-expired", () => expired++);
  Object.defineProperty(globalThis, "window", { configurable: true, value: target });
  let resolve: (value: Response) => void = () => {
    throw new Error("Request not started");
  };
  globalThis.fetch = () =>
    new Promise<Response>((done) => {
      resolve = done;
    });
  try {
    setCsrfToken("old-session");
    const pending = api("/transactions/");
    setCsrfToken("new-session");
    resolve(new Response(JSON.stringify({ message: "Old session expired" }), { status: 401 }));
    await assert.rejects(pending);
    assert.equal(expired, 0);
    const active = api("/transactions/");
    resolve(new Response(JSON.stringify({ message: "Current session expired" }), { status: 401 }));
    await assert.rejects(active);
    assert.equal(expired, 1);
  } finally {
    globalThis.fetch = originalFetch;
    setCsrfToken("");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
