import {
  type BudgetRecord,
  type BudgetSummary,
  budgetInputSchema,
  budgetPeriodRange,
} from "@finance/shared";
import { type FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Catalogs } from "../lib/models";
import { amountInput, cents, dateLabel, money, today } from "../lib/money";
import { Modal } from "./Modal";

const periodLabels = { monthly: "Mensal", yearly: "Anual", custom: "Personalizado" };
export function BudgetsView({
  data,
  householdId,
  onChanged,
}: {
  data: Catalogs;
  householdId: string;
  onChanged: () => void;
}) {
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false),
    [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<BudgetRecord | "new" | null>(null);
  const [archiving, setArchiving] = useState<BudgetRecord | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: version reloads budgets after mutation.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api<BudgetRecord[]>(`/budgets/?includeArchived=${includeArchived}`)
      .then((rows) => {
        if (!active) return;
        setBudgets(rows);
        setSelectedId((current) =>
          rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? ""),
        );
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [includeArchived, version, householdId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: data/version invalidate consumption after a financial change.
  useEffect(() => {
    let active = true;
    setSummary(null);
    if (selectedId)
      void api<BudgetSummary>(`/budgets/${selectedId}/summary`)
        .then((result) => {
          if (active) {
            setSummary(result);
            setError("");
          }
        })
        .catch((e: Error) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [selectedId, version, data]);
  function changed(message: string) {
    setNotice(message);
    setVersion((value) => value + 1);
    onChanged();
  }
  async function archive() {
    if (!archiving) return;
    setBusy(true);
    setError("");
    try {
      await api(`/budgets/${archiving.id}`, { method: "DELETE" });
      setArchiving(null);
      changed("Orçamento arquivado. Os lançamentos foram preservados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao arquivar.");
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    if (!summary) return;
    setBusy(true);
    setError("");
    try {
      await api(`/budgets/${summary.budget.id}/restore`, { method: "POST" });
      changed("Orçamento restaurado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao restaurar.");
    } finally {
      setBusy(false);
    }
  }
  const budget = summary?.budget;
  return (
    <section className="panel budget-panel">
      <div className="panel-header">
        <div>
          <h2>Planejado e comprometido</h2>
          <p className="muted">
            Limites por categoria, com despesas confirmadas e pendentes separadas.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={busy || loading}
          onClick={() => setEditing("new")}
        >
          Novo orçamento
        </button>
      </div>
      {notice && (
        <p className="success-banner" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button
            type="button"
            className="text-button"
            onClick={() => setVersion((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </div>
      )}
      <div className="budget-controls">
        <label>
          Orçamento
          <select
            aria-label="Orçamento"
            value={selectedId}
            disabled={loading}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {!budgets.length && <option value="">Nenhum orçamento</option>}
            {budgets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {dateLabel(item.startsAt)}
                {item.isArchived ? " (arquivado)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          Incluir arquivados
        </label>
      </div>
      {loading && <p role="status">Carregando orçamentos…</p>}
      {!loading && !budgets.length && (
        <p className="muted">Defina os limites que deseja acompanhar para a casa ou uma pessoa.</p>
      )}
      {selectedId && !summary && !error && <p role="status">Calculando consumo…</p>}
      {summary && budget && (
        <>
          <div className="panel-header">
            <div>
              <h3>
                {budget.name}
                {budget.isArchived ? " · Arquivado" : ""}
              </h3>
              <p className="muted">
                {periodLabels[budget.period]} · {dateLabel(budget.startsAt)} a{" "}
                {dateLabel(budget.endsAt)} · {budget.currency} ·{" "}
                {budget.personId
                  ? (data.people.find((person) => person.id === budget.personId)?.name ?? "Pessoa")
                  : "Toda a casa"}
              </p>
            </div>
            <div className="actions">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => setEditing(budget)}
              >
                Editar orçamento
              </button>
              {budget.isArchived ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void restore()}
                >
                  Restaurar orçamento
                </button>
              ) : (
                <button
                  type="button"
                  className="text-button danger"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setArchiving(budget);
                  }}
                >
                  Arquivar orçamento
                </button>
              )}
            </div>
          </div>
          <div className="budget-metrics">
            <div className="metric">
              <div>Limite total</div>
              <strong>{money(summary.totals.limitCents, budget.currency)}</strong>
            </div>
            <div className="metric">
              <div>Confirmado</div>
              <strong>{money(summary.totals.confirmedCents, budget.currency)}</strong>
            </div>
            <div className="metric">
              <div>Pendente</div>
              <strong>{money(summary.totals.pendingCents, budget.currency)}</strong>
            </div>
            <div
              className={summary.totals.remainingCents < 0 ? "metric expense" : "metric balance"}
            >
              <div>
                {summary.totals.remainingCents < 0 ? "Excesso total" : "Disponível após pendentes"}
              </div>
              <strong>{money(Math.abs(summary.totals.remainingCents), budget.currency)}</strong>
            </div>
          </div>
          <p className="hint">
            Totais das categorias com limite. Cada categoria é contada diretamente, sem somar suas
            categorias filhas.
          </p>
          {summary.excludedCurrencyCount > 0 && (
            <p className="error-banner" role="status">
              {summary.excludedCurrencyCount} despesa(s) em outras moedas ficaram fora deste
              orçamento. Não há conversão cambial.
            </p>
          )}
          <div className="table-scroll">
            <table aria-label="Consumo por categoria">
              <thead>
                <tr>
                  <th>Categoria / consumo</th>
                  <th>Limite</th>
                  <th>Confirmado</th>
                  <th>Pendente</th>
                  <th>Disponível / excesso</th>
                </tr>
              </thead>
              <tbody>
                {summary.items.map((item) => {
                  const percent = (item.committedCents / item.limitCents) * 100;
                  const state =
                    item.exceededCents > 0 ? "exceeded" : percent >= 80 ? "attention" : "within";
                  return (
                    <tr key={item.categoryId}>
                      <td>
                        <strong>{item.categoryName}</strong>
                        <div
                          className={`budget-progress ${state}`}
                          role="progressbar"
                          aria-label={`Consumo de ${item.categoryName}`}
                          aria-valuenow={Math.min(100, Math.round(percent))}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuetext={`${Math.round(percent)}% do limite`}
                        >
                          <span style={{ width: `${Math.min(100, percent)}%` }} />
                        </div>
                        <small>
                          {item.exceededCents > 0
                            ? "Limite ultrapassado"
                            : percent >= 100
                              ? "Limite atingido"
                              : percent >= 80
                                ? "Próximo do limite"
                                : "Dentro do limite"}
                        </small>
                      </td>
                      <td>{money(item.limitCents, budget.currency)}</td>
                      <td>{money(item.confirmedCents, budget.currency)}</td>
                      <td>{money(item.pendingCents, budget.currency)}</td>
                      <td>
                        {item.exceededCents > 0
                          ? `Excesso de ${money(item.exceededCents, budget.currency)}`
                          : money(item.remainingCents, budget.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h3>Despesas sem limite neste orçamento</h3>
          <p className="hint">
            Mostradas separadamente; não são descontadas do disponível acima. Orçamentos da casa e
            individuais são visões sobrepostas e não devem ser somados.
          </p>
          {summary.unbudgeted.length ? (
            <div className="table-scroll">
              <table aria-label="Despesas sem limite">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Confirmado</th>
                    <th>Pendente</th>
                    <th>Comprometido</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.unbudgeted.map((item) => (
                    <tr key={item.categoryId ?? "unassigned"}>
                      <td>{item.categoryName}</td>
                      <td>{money(item.confirmedCents, budget.currency)}</td>
                      <td>{money(item.pendingCents, budget.currency)}</td>
                      <td>{money(item.committedCents, budget.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Nenhuma despesa sem limite neste período e moeda.</p>
          )}
        </>
      )}
      {editing && (
        <BudgetForm
          data={data}
          householdId={householdId}
          budget={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setSelectedId(id);
            setEditing(null);
            changed("Orçamento salvo.");
          }}
        />
      )}
      {archiving && (
        <Modal title="Arquivar orçamento" busy={busy} onClose={() => setArchiving(null)}>
          <p>
            Arquivar “{archiving.name}”? Os limites ficarão disponíveis no histórico e os
            lançamentos serão preservados.
          </p>
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          <footer className="form-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => setArchiving(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => void archive()}
            >
              Confirmar arquivamento
            </button>
          </footer>
        </Modal>
      )}
    </section>
  );
}

let nextItem = 0;
function BudgetForm({
  data,
  householdId,
  budget,
  onClose,
  onSaved,
}: {
  data: Catalogs;
  householdId: string;
  budget?: BudgetRecord;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const current = today(data.settings.timezone);
  const [period, setPeriod] = useState(budget?.period ?? "monthly");
  const [month, setMonth] = useState(budget?.startsAt.slice(0, 7) ?? current.slice(0, 7));
  const [year, setYear] = useState(budget?.startsAt.slice(0, 4) ?? current.slice(0, 4));
  const [from, setFrom] = useState(budget?.startsAt ?? current),
    [to, setTo] = useState(budget?.endsAt ?? current);
  const [items, setItems] = useState(() =>
    (budget?.items ?? [{ categoryId: "", limitCents: 0 }]).map((item) => ({
      key: ++nextItem,
      categoryId: item.categoryId,
      amount: item.limitCents ? amountInput(item.limitCents) : "",
    })),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  let range = { startsAt: from, endsAt: to };
  if (period !== "custom") {
    const anchor = period === "monthly" ? month : year.padStart(4, "0");
    const unchanged =
      budget?.period === period &&
      budget.startsAt.slice(0, period === "monthly" ? 7 : 4) === anchor;
    if (unchanged && budget) range = { startsAt: budget.startsAt, endsAt: budget.endsAt };
    else if (
      (period === "monthly" && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(anchor)) ||
      (period === "yearly" && /^(?!0000)\d{4}$/.test(anchor))
    )
      range = budgetPeriodRange(period, anchor, data.settings.monthlyPeriodStartDay);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const input = budgetInputSchema.safeParse({
        householdId,
        name: form.get("name"),
        personId: form.get("personId") || null,
        period,
        ...range,
        currency: form.get("currency"),
        items: items.map((item) => ({
          categoryId: item.categoryId,
          limitCents: cents(item.amount),
        })),
      });
      if (!input.success)
        throw new Error(input.error.issues.map((issue) => issue.message).join(" "));
      const result = await api<BudgetRecord>(budget ? `/budgets/${budget.id}` : "/budgets/", {
        method: budget ? "PUT" : "POST",
        body: input.data,
      });
      onSaved(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={budget ? "Editar orçamento" : "Novo orçamento"} busy={busy} onClose={onClose}>
      <form className="form-stack" onSubmit={save}>
        <fieldset disabled={busy}>
          <label>
            Nome do orçamento
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={budget?.name ?? ""}
              placeholder="Ex.: Casa — outubro"
            />
          </label>
          <div className="form-grid">
            <label>
              Visão do orçamento
              <select
                aria-label="Visão do orçamento"
                name="personId"
                defaultValue={budget?.personId ?? ""}
              >
                <option value="">Toda a casa</option>
                {data.people
                  .filter((person) => person.isActive || person.id === budget?.personId)
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                      {!person.isActive ? " (inativa)" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Moeda
              <select
                aria-label="Moeda"
                name="currency"
                defaultValue={budget?.currency ?? data.settings.currency}
              >
                {[
                  ...new Set([
                    data.settings.currency,
                    ...data.accounts.map((account) => account.currency),
                    ...(budget ? [budget.currency] : []),
                  ]),
                ].map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo de período
              <select
                aria-label="Tipo de período"
                value={period}
                onChange={(event) => setPeriod(event.target.value as typeof period)}
              >
                {Object.entries(periodLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {period === "monthly" && (
              <label>
                Mês do orçamento
                <input
                  type="month"
                  required
                  min="0001-01"
                  max="9999-12"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                />
              </label>
            )}
            {period === "yearly" && (
              <label>
                Ano do orçamento
                <input
                  type="number"
                  required
                  min={1}
                  max={9999}
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                />
              </label>
            )}
            {period === "custom" && (
              <>
                <label>
                  Início do orçamento
                  <input
                    type="date"
                    required
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                </label>
                <label>
                  Fim do orçamento
                  <input
                    type="date"
                    required
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </label>
              </>
            )}
          </div>
          <p className="hint">
            Vigência: {dateLabel(range.startsAt)} a {dateLabel(range.endsAt)}. Mensal segue o início
            financeiro da casa; anual usa janeiro a dezembro.
          </p>
          <div className="section-title">
            <h3>Limites por categoria</h3>
            <button
              type="button"
              className="text-button"
              disabled={items.length >= 100}
              onClick={() => setItems([...items, { key: ++nextItem, categoryId: "", amount: "" }])}
            >
              Adicionar categoria
            </button>
          </div>
          {items.map((item, index) => (
            <div className="split-row" key={item.key}>
              <label>
                Categoria {index + 1}
                <select
                  aria-label={`Categoria ${index + 1}`}
                  required
                  value={item.categoryId}
                  onChange={(event) =>
                    setItems(
                      items.map((row) =>
                        row.key === item.key ? { ...row, categoryId: event.target.value } : row,
                      ),
                    )
                  }
                >
                  <option value="">Selecione</option>
                  {data.categories
                    .filter(
                      (category) =>
                        category.type === "expense" &&
                        (!category.isArchived ||
                          budget?.items.some((old) => old.categoryId === category.id)),
                    )
                    .map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                        disabled={items.some(
                          (row) => row.key !== item.key && row.categoryId === category.id,
                        )}
                      >
                        {category.name}
                        {category.isArchived ? " (arquivada)" : ""}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Limite {index + 1}
                <input
                  required
                  inputMode="decimal"
                  value={item.amount}
                  placeholder="0,00"
                  onChange={(event) =>
                    setItems(
                      items.map((row) =>
                        row.key === item.key ? { ...row, amount: event.target.value } : row,
                      ),
                    )
                  }
                />
              </label>
              {items.length > 1 && (
                <button
                  type="button"
                  className="text-button danger"
                  aria-label={`Remover categoria ${index + 1}`}
                  onClick={() => setItems(items.filter((row) => row.key !== item.key))}
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          <p className="hint">
            Os limites não criam lançamentos nem movimentam saldos. Pendentes aparecem no
            comprometido mesmo se estiverem ocultos no dashboard.
          </p>
        </fieldset>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <footer className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Salvando…" : "Salvar orçamento"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
