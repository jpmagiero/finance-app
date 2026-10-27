import "dotenv/config";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { newLoginSchema } from "@finance/shared";
import { ZodError } from "zod";
import { provisionUser } from "../services/auth-service";
import { closeDatabase, db } from ".";
import { households } from "./schema";

async function secret(prompt: string) {
  const hidden = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const terminal = createInterface({ input: stdin, output: hidden, terminal: true });
  stdout.write(prompt);
  try {
    return await terminal.question("");
  } finally {
    terminal.close();
    stdout.write("\n");
  }
}
try {
  if (!stdin.isTTY) throw new Error("Execute este comando em um terminal interativo.");
  const available = db.select().from(households).orderBy(households.name, households.id).all();
  if (available.length === 0)
    throw new Error("Nenhuma casa cadastrada. Execute db:migrate e db:seed no primeiro setup.");
  const terminal = createInterface({ input: stdin, output: stdout });
  let email: string, name: string;
  let household = available[0];
  try {
    while (true) {
      email = (await terminal.question("E-mail [admin@local]: ")).trim() || "admin@local";
      const result = newLoginSchema.shape.email.safeParse(email);
      if (result.success) {
        email = result.data;
        break;
      }
      stdout.write("Informe um e-mail valido com ate 254 caracteres.\n");
    }
    while (true) {
      name = (await terminal.question("Nome [Admin]: ")).trim() || "Admin";
      if (newLoginSchema.shape.name.safeParse(name).success) break;
      stdout.write("O nome precisa ter entre 1 e 120 caracteres.\n");
    }
    stdout.write("\nCasas ja cadastradas (este comando nao cria nem renomeia casas):\n");
    for (const [index, item] of available.entries()) {
      stdout.write(`  ${index + 1}) ${item.name} [${item.id}]\n`);
    }
    while (true) {
      const answer = (await terminal.question("Numero da casa [1]: ")).trim() || "1";
      const index = /^\d+$/.test(answer) ? Number(answer) - 1 : -1;
      const selected = Number.isSafeInteger(index) && index >= 0 ? available[index] : undefined;
      if (selected) {
        household = selected;
        break;
      }
      stdout.write(`Opcao invalida. Escolha um numero entre 1 e ${available.length}.\n`);
    }
    stdout.write(`Casa selecionada: ${household?.name}\n`);
  } finally {
    terminal.close();
  }
  if (!household) throw new Error("Casa nao selecionada.");
  let password: string;
  while (true) {
    password = await secret("Senha (12 a 128 caracteres, oculta): ");
    if (!newLoginSchema.shape.password.safeParse(password).success) {
      stdout.write("A senha precisa ter entre 12 e 128 caracteres. Tente novamente.\n");
      continue;
    }
    if (password !== (await secret("Confirme a senha: "))) {
      stdout.write("As senhas nao coincidem. Tente novamente.\n");
      continue;
    }
    break;
  }
  const input = newLoginSchema.parse({ email, name, password });
  await provisionUser({ ...input, householdId: household.id, role: "owner" });
  stdout.write("Login provisionado. Sessoes antigas desse usuario foram revogadas.\n");
} catch (error) {
  console.error(
    error instanceof ZodError
      ? "Dados invalidos. Confira e-mail, nome e senha e execute novamente."
      : error instanceof Error
        ? error.message
        : "Falha no provisionamento.",
  );
  process.exitCode = 1;
} finally {
  closeDatabase();
}
