import "dotenv/config";
import { restoreBackup } from "../services/backup-service";

const [source, destination, ...extra] = process.argv.slice(2);
if (!source || !destination || extra.length) {
  console.error(
    "Uso: db:restore <backup.sqlite> <novo-destino.sqlite>. Destino existente nao e sobrescrito.",
  );
  process.exitCode = 1;
} else {
  try {
    const path = await restoreBackup(source, destination);
    console.log(
      `Restauracao verificada: ${path}. Pare a API e aponte DATABASE_URL para este arquivo antes de reiniciar.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Falha na restauracao.");
    process.exitCode = 1;
  }
}
