// Manual/automated browser verification server: ALWAYS uses a new temporary synthetic database.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const directory = await mkdtemp(join(tmpdir(), "finance-ui-test-"));
process.env.DATABASE_URL = `file:${join(directory, "synthetic.sqlite")}`;
process.env.DOTENV_CONFIG_PATH = join(directory, "unused.env");
process.env.SEED_USER_EMAIL = "owner@example.invalid";
process.env.SEED_USER_NAME = "Pessoa de teste";
process.env.SEED_HOUSEHOLD_NAME = "Casa de teste";
process.env.COOKIE_SECURE = "false";
const { db, closeDatabase } = await import("../db");
const { households } = await import("../db/schema");
const { provisionUser } = await import("../services/auth-service");
const { buildApp } = await import("../app");
migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
await import("../db/seed");
const household = db.select().from(households).get();
if (!household) throw new Error("Synthetic household not created");
await provisionUser({
  householdId: household.id,
  email: "owner@example.invalid",
  name: "Pessoa de teste",
  password: "Synthetic-Password-123!",
  role: "owner",
});
const app = await buildApp({ logger: false });
await app.listen({ host: "127.0.0.1", port: 4333 });
console.log("Synthetic UI API ready on port 4333");
async function stop() {
  await app.close();
  closeDatabase();
  await rm(directory, { recursive: true, force: true });
  process.exit(0);
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
