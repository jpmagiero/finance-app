import { expect, type Locator, type Page, test } from "@playwright/test";

const ownerEmail = "owner@example.invalid";
const ownerPassword = "Synthetic-Password-123!";
async function signIn(page: Page, email = ownerEmail, password = ownerPassword) {
  await page.goto("/");
  await page.getByRole("heading", { name: "Entre na sua casa", exact: true }).waitFor();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("heading", { name: "Visão geral", exact: true }).waitFor();
  await expect(page.getByRole("button", { name: "Novo lançamento", exact: true })).toBeEnabled();
  // The fixture's business date stays deterministic even across months/timezones.
  await page.getByLabel("Período", { exact: true }).fill("2026-10");
  await expect(page.locator(".loading-indicator")).toBeHidden();
}
async function go(page: Page, name: string) {
  await page.locator(".nav-list").getByRole("button", { name, exact: true }).click();
}
async function save(page: Page, dialog: Locator, button: string) {
  const updated = page.waitForResponse(
    (response) => response.url().includes("/api/transactions/?") && response.ok(),
  );
  await dialog.getByRole("button", { name: button, exact: true }).click();
  await expect(dialog).toBeHidden();
  await updated;
  await expect(page.locator(".loading-indicator")).toBeHidden();
}
async function catalog(
  page: Page,
  tab: string,
  name: string,
  extra?: (dialog: Locator) => Promise<void>,
) {
  await go(page, "Cadastros");
  await page.locator(".tabs").getByRole("button", { name: tab, exact: true }).click();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill(name);
  if (extra) await extra(dialog);
  await save(page, dialog, "Salvar cadastro");
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}
async function newEntry(page: Page) {
  await page.getByRole("button", { name: "Novo lançamento", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Data", { exact: true }).fill("2026-10-26");
  return dialog;
}

test("administrator and member can complete the financial workflow on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  await catalog(page, "Contas", "Banco E2E", async (dialog) => {
    await dialog.getByLabel("Saldo inicial", { exact: true }).fill("5000,00");
  });
  await catalog(page, "Contas", "Carteira E2E", async (dialog) => {
    await dialog.getByLabel("Tipo", { exact: true }).selectOption("cash");
  });
  await catalog(page, "Pessoas", "Outra pessoa E2E");
  await catalog(page, "Tags", "Viagem E2E");
  await catalog(page, "Favorecidos", "Mercado E2E");

  let dialog = await newEntry(page);
  await dialog.getByLabel("Valor", { exact: true }).fill("125,50");
  await dialog.getByLabel("Descrição", { exact: true }).fill("Compra E2E");
  await dialog.getByLabel("Status", { exact: true }).selectOption("pending");
  await dialog.getByLabel("Pessoa", { exact: true }).selectOption({ label: "Outra pessoa E2E" });
  await dialog.getByLabel("Conta (opcional)", { exact: true }).selectOption({ label: "Banco E2E" });
  await dialog
    .getByLabel("Favorecido / pagador", { exact: true })
    .selectOption({ label: "Mercado E2E" });
  await dialog.getByLabel("Categoria", { exact: true }).selectOption({ label: "Mercado" });
  await dialog.getByLabel("Viagem E2E", { exact: true }).check();
  await save(page, dialog, "Salvar lançamento");
  await go(page, "Lançamentos");
  const row = page.getByRole("row").filter({ hasText: "Compra E2E" });
  await expect(row).toContainText("Pendente");
  await row.getByRole("button", { name: "Confirmar Compra E2E", exact: true }).click();
  await expect(row).toContainText("Confirmado");
  await expect(page.locator(".loading-indicator")).toBeHidden();
  await row.getByRole("button", { name: "Editar Compra E2E", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor", { exact: true }).fill("150,00");
  await save(page, dialog, "Salvar lançamento");
  await expect(row).toContainText("150,00");

  dialog = await newEntry(page);
  await dialog.getByLabel("Descrição", { exact: true }).fill("Compra dividida E2E");
  await dialog.getByLabel("Valor", { exact: true }).fill("200,00");
  await dialog.getByRole("button", { name: "Adicionar divisão", exact: true }).click();
  await dialog.getByLabel("Valor da divisão", { exact: true }).nth(0).fill("120,00");
  await dialog.getByLabel("Valor da divisão", { exact: true }).nth(1).fill("80,00");
  await dialog.getByLabel("Categoria 1", { exact: true }).selectOption({ label: "Mercado" });
  await dialog.getByLabel("Categoria 2", { exact: true }).selectOption({ label: "Lazer" });
  await save(page, dialog, "Salvar lançamento");

  dialog = await newEntry(page);
  await dialog.getByLabel("Tipo", { exact: true }).selectOption("income");
  await dialog.getByLabel("Descrição", { exact: true }).fill("Salário E2E");
  await dialog.getByLabel("Valor", { exact: true }).fill("1000,00");
  await dialog.getByLabel("Conta (opcional)", { exact: true }).selectOption({ label: "Banco E2E" });
  await save(page, dialog, "Salvar lançamento");
  dialog = await newEntry(page);
  await dialog.getByLabel("Tipo", { exact: true }).selectOption("transfer");
  await dialog.getByLabel("Descrição", { exact: true }).fill("Transferência E2E");
  await dialog.getByLabel("Valor", { exact: true }).fill("100,00");
  await dialog.getByLabel("Conta de origem", { exact: true }).selectOption({ label: "Banco E2E" });
  await dialog
    .getByLabel("Conta de destino", { exact: true })
    .selectOption({ label: "Carteira E2E" });
  await save(page, dialog, "Salvar lançamento");

  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page.getByLabel("Buscar", { exact: true }).fill("dividida");
  await page.getByRole("button", { name: "Aplicar filtros", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Limpar", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await go(page, "Visão geral");
  await expect(page.locator(".metric.expense strong")).toContainText("350,00");
  await expect(page.locator(".metric.income strong")).toContainText("1.000,00");
  await expect(page.locator(".metric.balance strong")).toContainText("650,00");
  await expect(page.locator(".account-strip").getByText(/5.750,00/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Visão geral", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Novo lançamento", exact: true })).toBeEnabled();
  await page.getByLabel("Período", { exact: true }).fill("2026-10");

  await go(page, "Configurações");
  const add = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Criar login de membro", exact: true }) });
  await add.getByLabel("Nome", { exact: true }).fill("Membro E2E");
  await add.getByLabel("E-mail", { exact: true }).fill("member@example.invalid");
  await add.getByLabel("Senha inicial").fill("Synthetic-Member-123!");
  await add
    .getByLabel("Pessoa financeira", { exact: true })
    .selectOption({ label: "Outra pessoa E2E" });
  await add.getByRole("button", { name: "Criar login de membro", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Login criado");
  await page.getByRole("button", { name: "Sair da conta", exact: true }).click();
  await signIn(page, "member@example.invalid", "Synthetic-Member-123!");
  await go(page, "Cadastros");
  await expect(page.getByRole("button", { name: "Adicionar", exact: true })).toHaveCount(0);
  await go(page, "Lançamentos");
  await page.getByRole("button", { name: "Excluir Compra E2E", exact: true }).click();
  await save(page, page.getByRole("dialog"), "Excluir lançamento");
  await expect(page.getByRole("button", { name: "Editar Compra E2E", exact: true })).toHaveCount(0);
  await go(page, "Visão geral");
  await expect(page.locator(".metric.expense strong")).toContainText("200,00");

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(
    page.locator(".nav-list").getByRole("button", { name: "Configurações", exact: true }),
  ).toBeVisible();
  dialog = await newEntry(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});

test("bad credentials remain on login with a readable error", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("E-mail", { exact: true }).fill("missing@example.invalid");
  await page.getByLabel("Senha", { exact: true }).fill("Wrong-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("E-mail ou senha incorretos");
  await expect(page.getByRole("heading", { name: "Entre na sua casa", exact: true })).toBeVisible();
});
