import "dotenv/config";
import { setTimeout as delay } from "node:timers/promises";
import { env } from "../env";
import { createBackup } from "../services/backup-service";

const directory = process.env.BACKUP_DIR ?? "./backups";
const keep = Number(process.env.BACKUP_KEEP ?? 14);
const intervalHours = Number(process.env.BACKUP_INTERVAL_HOURS ?? 24);
const loop = process.argv.includes("--loop");
if (!Number.isFinite(intervalHours) || intervalHours <= 0 || intervalHours * 3600000 > 2147483647)
  throw new Error("Intervalo de backup invalido.");
const databasePath = env.DATABASE_URL.startsWith("file:")
  ? env.DATABASE_URL.slice(5)
  : env.DATABASE_URL;
try {
  do {
    const path = await createBackup(databasePath, directory, keep);
    console.log(`Backup verificado: ${path}`);
    if (loop) await delay(intervalHours * 60 * 60 * 1000);
  } while (loop);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Falha no backup.");
  process.exitCode = 1;
}
