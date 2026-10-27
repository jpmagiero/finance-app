import "dotenv/config";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { closeDatabase, db } from ".";

try {
  // src/db and dist/db have the same depth relative to the migration directory.
  migrate(db, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  console.log("Migrations aplicadas.");
} finally {
  closeDatabase();
}
