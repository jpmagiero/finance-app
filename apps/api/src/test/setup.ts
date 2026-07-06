import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

// O env precisa estar definido ANTES de qualquer import (dinamico) do db,
// senao src/env.ts congela DATABASE_URL apontando para o arquivo local.
process.env.DATABASE_URL = ":memory:";
process.env.NODE_ENV = "test";

const { db } = await import("../db");

// Roda as migrations no banco em memoria uma vez por fork, antes dos testes.
migrate(db, {
  migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
});
