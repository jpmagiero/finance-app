import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, copyFile, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";

const backupPattern = /^finance-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9-]{36}\.sqlite$/;
const requiredTables = [
  "users",
  "households",
  "accounts",
  "transactions",
  "transaction_splits",
  "transaction_tags",
  "sessions",
  "__drizzle_migrations",
];

export function verifyBackup(path: string) {
  const client = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const integrity = client.pragma("integrity_check") as { integrity_check: string }[];
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok")
      throw new Error("Integridade SQLite invalida.");
    if ((client.pragma("foreign_key_check") as unknown[]).length)
      throw new Error("Backup tem vinculos invalidos.");
    const tables = new Set(
      (
        client.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
          name: string;
        }[]
      ).map((row) => row.name),
    );
    if (requiredTables.some((name) => !tables.has(name)))
      throw new Error("Backup nao contem o schema financeiro esperado.");
  } finally {
    client.close();
  }
}

export async function createBackup(databasePath: string, directory: string, keep = 14) {
  if (!Number.isSafeInteger(keep) || keep < 1)
    throw new Error("Retencao precisa ser um inteiro positivo.");
  const folder = resolve(directory);
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const name = `finance-${new Date().toISOString().replaceAll(":", "-").replace(".", "-")}-${randomUUID()}.sqlite`;
  const target = join(folder, name);
  const temporary = `${target}.partial`;
  const source = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    // SQLite online backup includes committed WAL writes; never copy a live main file.
    await writeFile(temporary, "", { flag: "wx", mode: 0o600 });
    await source.backup(temporary);
    const snapshot = new Database(temporary);
    try {
      snapshot.pragma("journal_mode=DELETE");
    } finally {
      snapshot.close();
    }
    await chmod(temporary, 0o600);
    verifyBackup(temporary);
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  } finally {
    source.close();
  }
  const owned = (await readdir(folder, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && backupPattern.test(entry.name))
    .map((entry) => entry.name)
    .filter((entry) => entry !== name)
    .sort()
    .reverse();
  // Only remove this tool's snapshots, after successfully validating a new one.
  for (const expired of owned.slice(keep - 1)) await rm(join(folder, expired));
  return target;
}

export async function restoreBackup(source: string, destination: string) {
  const from = resolve(source),
    target = resolve(destination);
  if (from === target) throw new Error("Origem e destino devem ser diferentes.");
  verifyBackup(from);
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  // Existing files are never overwritten, even if the caller forgot to stop the API.
  await copyFile(from, target, constants.COPYFILE_EXCL);
  try {
    await chmod(target, 0o600);
    verifyBackup(target);
  } catch (error) {
    await rm(target, { force: true });
    throw error;
  }
  return target;
}
