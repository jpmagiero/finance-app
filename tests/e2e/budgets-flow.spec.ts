import { expect, test } from "@playwright/test";

test("budgets track category limits, pending amounts, individual scope and archive on desktop/mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("E-mail", { exact: true }).fill("owner@example.invalid");
  await page.getByLabel("Senha", { exact: true }).fill("Synthetic-Password-123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Novo lançamento", exact: true })).toBeEnabled();
  await page.locator(".nav-list").getByRole("button", { name: "Orçamentos", exact: true }).click();

  async function newBudget(name: string, personal = false) {
    await page.getByRole("button", { name: "Novo orçamento", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome do orçamento", { exact: true }).fill(name);
    await dialog.getByLabel("Mês do orçamento", { exact: true }).fill("2029-01");
    if (personal)
      await dialog
        .getByLabel("Visão do orçamento", { exact: true })
        .selectOption({ label: "Pessoa de teste" });
    await dialog.getByLabel("Categoria 1", { exact: true }).selectOption({ label: "Mercado" });
    await dialog.getByLabel("Limite 1", { exact: true }).fill("1200,00");
    return dialog;
  }
  let dialog = await newBudget("Casa orçamento E2E");
  await dialog.getByRole("button", { name: "Adicionar categoria", exact: true }).click();
  await dialog.getByLabel("Categoria 2", { exact: true }).selectOption({ label: "Lazer" });
  await dialog.getByLabel("Limite 2", { exact: true }).fill("400,00");
  await dialog.getByRole("button", { name: "Salvar orçamento", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Casa orçamento E2E", exact: true }),
  ).toBeVisible();

  async function entry(
    description: string,
    value: string,
    category: string,
    pending = false,
    person = false,
  ) {
    await expect(page.getByRole("button", { name: "Novo lançamento", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Novo lançamento", exact: true }).click();
    const form = page.getByRole("dialog");
    await form.getByLabel("Descrição", { exact: true }).fill(description);
    await form.getByLabel("Data", { exact: true }).fill("2029-01-10");
    await form.getByLabel("Valor", { exact: true }).fill(value);
    await form.getByLabel("Categoria", { exact: true }).selectOption({ label: category });
    if (pending) await form.getByLabel("Status", { exact: true }).selectOption("pending");
    if (person)
      await form.getByLabel("Pessoa", { exact: true }).selectOption({ label: "Pessoa de teste" });
    await form.getByRole("button", { name: "Salvar lançamento", exact: true }).click();
    await expect(form).toBeHidden();
  }
  await entry("Mercado orçamento confirmado", "800,00", "Mercado", false, true);
  await entry("Mercado orçamento pendente", "150,00", "Mercado", true);
  let table = page.getByRole("table", { name: "Consumo por categoria", exact: true });
  let market = table.getByRole("row").filter({ hasText: "Mercado" });
  await expect(market.getByRole("cell").nth(2)).toContainText("800,00");
  await expect(market.getByRole("cell").nth(3)).toContainText("150,00");
  await expect(market.getByRole("cell").nth(4)).toContainText("250,00");
  await entry("Assinatura sem limite orçamento", "50,00", "Assinaturas");
  await expect(page.getByRole("table", { name: "Despesas sem limite", exact: true })).toContainText(
    "Assinaturas",
  );
  await entry("Lazer acima do orçamento", "500,00", "Lazer", true);
  await expect(table.getByRole("row").filter({ hasText: "Lazer" })).toContainText("Excesso de");
  await expect(table.getByRole("row").filter({ hasText: "Lazer" })).toContainText("100,00");

  dialog = await newBudget("Pessoal orçamento E2E", true);
  await dialog.getByRole("button", { name: "Salvar orçamento", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "Pessoal orçamento E2E", exact: true }),
  ).toBeVisible();
  table = page.getByRole("table", { name: "Consumo por categoria", exact: true });
  market = table.getByRole("row").filter({ hasText: "Mercado" });
  await expect(market.getByRole("cell").nth(2)).toContainText("800,00");
  await expect(market.getByRole("cell").nth(3)).toContainText("0,00");
  await expect(market.getByRole("cell").nth(4)).toContainText("400,00");
  await page.getByRole("button", { name: "Editar orçamento", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Limite 1", { exact: true }).fill("900,00");
  await dialog.getByRole("button", { name: "Salvar orçamento", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(market.getByRole("cell").nth(4)).toContainText("100,00");

  dialog = await newBudget("Limite duplicado E2E");
  await dialog.getByRole("button", { name: "Salvar orçamento", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Ja existe limite ativo");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Arquivar orçamento", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar arquivamento", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByLabel("Incluir arquivados", { exact: true }).check();
  await page
    .getByLabel("Orçamento", { exact: true })
    .selectOption({ label: "Pessoal orçamento E2E · 01/01/2029 (arquivado)" });
  await expect(
    page.getByRole("button", { name: "Restaurar orçamento", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restaurar orçamento", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pessoal orçamento E2E", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Novo lançamento", exact: true })).toBeEnabled();
  await page.locator(".nav-list").getByRole("button", { name: "Orçamentos", exact: true }).click();
  await page
    .getByLabel("Orçamento", { exact: true })
    .selectOption({ label: "Pessoal orçamento E2E · 01/01/2029" });
  await expect(
    page.getByRole("heading", { name: "Pessoal orçamento E2E", exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: test.info().outputPath("budget-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Editar orçamento", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
