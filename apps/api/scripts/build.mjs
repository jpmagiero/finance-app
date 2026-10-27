import { readFile, rm } from "node:fs/promises";
import { build } from "esbuild";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
await rm(new URL("../dist", import.meta.url), { recursive: true, force: true });
await build({
  entryPoints: [
    "src/index.ts",
    "src/db/migrate.ts",
    "src/db/seed.ts",
    "src/db/provision-user.ts",
    "src/db/backup.ts",
    "src/db/restore.ts",
  ],
  outdir: "dist",
  outbase: "src",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  external: Object.keys(manifest.dependencies).filter((name) => name !== "@finance/shared"),
});
