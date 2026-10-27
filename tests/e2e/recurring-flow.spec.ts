import { expect, test } from "@playwright/test";

test("recurring rules preview, generate pending entries once, preserve history and pause on mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("E-mail", { exact: true }).fill("owner@example.invalid");
  await page.getByLabel("Senha", { exact: true }).fill("Synthetic-Password-123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Novo lançamento", exact: true })).toBeEnabled();
  await page
    .locator(".nav-list")
    .getByRole("button", { name: "Recorrências", exact: true })
    .click();
  await page.getByRole("button", { name: "Nova recorrência", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor", { exact: true }).fill("100,00");
  await dialog.getByLabel("Descrição", { exact: true }).fill("Assinatura recorrente E2E");
  await dialog.getByLabel("Início da recorrência", { exact: true }).fill("2028-01-31");
  await dialog.getByLabel("Fim da recorrência (opcional)", { exact: true }).fill("2028-03-31");
  await dialog.getByLabel("Categoria", { exact: true }).selectOption({ label: "Assinaturas" });
  await dialog.getByRole("button", { name: "Salvar recorrência", exact: true }).click();
  await expect(dialog).toBeHidden();
  const row = page.getByRole("row").filter({ hasText: "Assinatura recorrente E2E" });
  await expect(row).toContainText("100,00");

  async function openPreview(to = "2028-03-31") {
    await row
      .getByRole("button", { name: "Gerar ocorrências Assinatura recorrente E2E", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    await modal.getByLabel("Gerar desde", { exact: true }).fill("2028-01-01");
    await modal.getByLabel("Gerar até", { exact: true }).fill(to);
    await modal.getByRole("button", { name: "Pré-visualizar datas", exact: true }).click();
    await expect(modal.locator(".occurrence-preview")).toBeVisible();
    return modal;
  }
  dialog = await openPreview();
  await expect(dialog.locator(".occurrence-preview")).toContainText("29/02/2028");
  await expect(dialog.getByRole("status")).toContainText("3 novo(s)");
  await dialog.getByRole("button", { name: "Gerar pendentes", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".success-banner")).toContainText("3 lançamento(s) pendente(s)");
  dialog = await openPreview();
  await expect(dialog.getByRole("status")).toContainText("0 novo(s)");
  await expect(dialog.getByRole("button", { name: "Gerar pendentes", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await row
    .getByRole("button", { name: "Editar recorrência Assinatura recorrente E2E", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor", { exact: true }).fill("200,00");
  await dialog.getByLabel("Fim da recorrência (opcional)", { exact: true }).fill("2028-04-30");
  await dialog.getByRole("button", { name: "Salvar recorrência", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("200,00");
  dialog = await openPreview("2028-04-30");
  await expect(dialog.getByRole("status")).toContainText("1 novo(s)");
  await dialog.getByRole("button", { name: "Gerar pendentes", exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.locator(".nav-list").getByRole("button", { name: "Lançamentos", exact: true }).click();
  await page.getByLabel("Período", { exact: true }).fill("2028-01");
  const entry = page.getByRole("row").filter({ hasText: "Assinatura recorrente E2E" });
  await expect(entry).toContainText("100,00");
  await expect(entry).toContainText("Pendente");
  await entry
    .getByRole("button", { name: "Confirmar Assinatura recorrente E2E", exact: true })
    .click();
  await expect(entry).toContainText("Confirmado");
  await expect(page.locator(".loading-indicator")).toBeHidden();
  await entry
    .getByRole("button", { name: "Excluir Assinatura recorrente E2E", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir lançamento", exact: true })
    .click();
  await expect(entry).toHaveCount(0);

  await page
    .locator(".nav-list")
    .getByRole("button", { name: "Recorrências", exact: true })
    .click();
  dialog = await openPreview("2028-04-30");
  await expect(dialog.getByRole("status")).toContainText("0 novo(s)");
  await expect(dialog.locator(".occurrence-preview")).toContainText("já gerado e excluído");
  await page.keyboard.press("Escape");
  await row.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(row).toContainText("Pausada");
  await expect(
    row.getByRole("button", { name: "Gerar ocorrências Assinatura recorrente E2E", exact: true }),
  ).toBeDisabled();
  await row.getByRole("button", { name: "Retomar", exact: true }).click();
  await expect(row).toContainText("Ativa");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await row
    .getByRole("button", { name: "Editar recorrência Assinatura recorrente E2E", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
