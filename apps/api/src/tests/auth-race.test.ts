import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
for (const scenario of ["change-password", "provision", "deactivate"]) {
  test(`in-flight login cannot outlive credential change: ${scenario}`, {
    timeout: 30000,
  }, async () => {
    const result = await execute(
      process.execPath,
      [
        "--import",
        "tsx",
        fileURLToPath(new URL("./fixtures/auth-race.ts", import.meta.url)),
        scenario,
      ],
      {
        env: { ...process.env, UV_THREADPOOL_SIZE: "1" },
        timeout: 25000,
      },
    );
    assert.match(result.stdout, /Race regression passed/);
  });
}
