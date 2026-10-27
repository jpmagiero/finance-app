import type { RecurringInput } from "@finance/shared";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Catalogs, Transaction } from "../lib/models";
import { dateLabel, money, today } from "../lib/money";
import { Modal } from "./Modal";
import { TransactionForm } from "./TransactionForm";

type Rule = RecurringInput & { id: string };
type Occurrence = { date: string; transactionId: string | null; deleted: boolean };
const frequencyLabels = { daily: "Diária", weekly: "Semanal", monthly: "Mensal", yearly: "Anual" };

export function RecurringView({
  data,
  householdId,
  onChanged,
}: {
  data: Catalogs;
  householdId: string;
  onChanged: () => void;
}) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const [generating, setGenerating] = useState<Rule | null>(null);
  const [from, setFrom] = useState(today(data.settings.timezone));
  const [to, setTo] = useState(today(data.settings.timezone));
  const [preview, setPreview] = useState<Occurrence[] | null>(null);
  const [busy, setBusy] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version reloads rules after mutation.
  useEffect(() => {
    let active = true;
    setLoading(true);
    void api<Rule[]>("/recurring/")
      .then((rows) => {
        if (active) {
          setRules(rows);
          setError("");
        }
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
  }, [version, householdId]);
  function changed(message: string) {
    setNotice(message);
    setVersion((value) => value + 1);
    onChanged();
  }
  async function toggle(rule: Rule) {
    setBusy(true);
    setError("");
    try {
      await api(`/recurring/${rule.id}/active`, {
        method: "PATCH",
        body: { isActive: !rule.isActive },
      });
      changed(
        rule.isActive
          ? "Recorrência pausada. Lançamentos existentes foram preservados."
          : "Recorrência retomada.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao alterar.");
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (!generating) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ created: number; skipped: number }>(
        `/recurring/${generating.id}/generate`,
        { method: "POST", body: { from, to } },
      );
      setGenerating(null);
      setPreview(null);
      changed(
        `${result.created} lançamento(s) pendente(s) criado(s); ${result.skipped} ocorrência(s) já registrada(s).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar.");
    } finally {
      setBusy(false);
    }
  }
  const rule = editing && editing !== "new" ? editing : undefined;
  const transaction: Transaction | undefined = rule
    ? {
        ...rule,
        id: rule.id,
        createdByUserId: null,
        status: "pending",
        transactionDate: rule.startsAt,
      }
    : undefined;
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Receitas e despesas recorrentes</h2>
          <p className="muted">
            Crie uma regra e gere pendentes para o período que deseja conferir.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={busy || loading}
          onClick={() => {
            setError("");
            setEditing("new");
          }}
        >
          Nova recorrência
        </button>
      </div>
      {loading && <p role="status">Carregando recorrências…</p>}
      {notice && (
        <p className="success-banner" role="status">
          {notice}
        </p>
      )}
      {error && !generating && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {!loading && !rules.length && (
        <p className="muted">
          Nenhuma recorrência cadastrada. Comece pelo aluguel, uma assinatura ou uma receita
          habitual.
        </p>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Repetição</th>
              <th>Vigência</th>
              <th>Valor por ocorrência</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.description ||
                    (item.type === "income" ? "Receita recorrente" : "Despesa recorrente")}
                </td>
                <td>
                  {frequencyLabels[item.frequency]} · a cada {item.interval}
                </td>
                <td>
                  {dateLabel(item.startsAt)}
                  {item.endsAt ? ` até ${dateLabel(item.endsAt)}` : " · sem fim definido"}
                </td>
                <td>
                  {money(
                    item.amountCents,
                    data.accounts.find((account) => account.id === item.accountId)?.currency ??
                      data.settings.currency,
                  )}
                </td>
                <td>{item.isActive ? "Ativa" : "Pausada"}</td>
                <td>
                  <div className="actions">
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      aria-label={`Editar recorrência ${item.description ?? ""}`}
                      onClick={() => {
                        setError("");
                        setEditing(item);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => void toggle(item)}
                    >
                      {item.isActive ? "Pausar" : "Retomar"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy || !item.isActive}
                      aria-label={`Gerar ocorrências ${item.description ?? ""}`}
                      onClick={() => {
                        setError("");
                        setPreview(null);
                        setGenerating(item);
                      }}
                    >
                      Gerar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        A geração é feita por você. Pendentes não alteram o saldo das contas. Pausar uma regra não
        cancela lançamentos já gerados.
      </p>
      {editing && (
        <TransactionForm
          data={data}
          householdId={householdId}
          transaction={transaction}
          recurringMode
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            changed("Recorrência salva. Lançamentos existentes foram preservados.");
          }}
          extraFields={
            <div className="form-grid">
              <label>
                Frequência
                <select name="frequency" defaultValue={rule?.frequency ?? "monthly"}>
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                A cada quantos períodos
                <input
                  type="number"
                  name="interval"
                  min={1}
                  max={120}
                  required
                  defaultValue={rule?.interval ?? 1}
                />
              </label>
              <label>
                Fim da recorrência (opcional)
                <input type="date" name="endsAt" defaultValue={rule?.endsAt ?? ""} />
              </label>
            </div>
          }
          onSubmitInput={async (input, form) => {
            const {
              transactionDate,
              status: _status,
              competenceDate: _competence,
              transferAccountId: _transfer,
              ...template
            } = input;
            await api(rule ? `/recurring/${rule.id}` : "/recurring/", {
              method: rule ? "PUT" : "POST",
              body: {
                ...template,
                frequency: form.get("frequency"),
                interval: Number(form.get("interval")),
                startsAt: transactionDate,
                endsAt: form.get("endsAt") || null,
                isActive: rule?.isActive ?? true,
              },
            });
          }}
        />
      )}
      {generating && (
        <Modal
          title="Gerar lançamentos recorrentes"
          busy={busy}
          onClose={() => {
            setGenerating(null);
            setError("");
          }}
        >
          <form
            className="form-stack"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                setPreview(
                  await api<Occurrence[]>(`/recurring/${generating.id}/preview`, {
                    method: "POST",
                    body: { from, to },
                  }),
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Falha na prévia.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>{generating.description || "Recorrência"}: confira as datas antes de gerar.</p>
            <fieldset disabled={busy}>
              <div className="form-grid">
                <label>
                  Gerar desde
                  <input
                    type="date"
                    required
                    value={from}
                    onChange={(event) => {
                      setFrom(event.target.value);
                      setPreview(null);
                    }}
                  />
                </label>
                <label>
                  Gerar até
                  <input
                    type="date"
                    required
                    value={to}
                    onChange={(event) => {
                      setTo(event.target.value);
                      setPreview(null);
                    }}
                  />
                </label>
              </div>
            </fieldset>
            <p className="hint">
              Intervalo de até 366 dias. Ocorrências já geradas, inclusive excluídas ou com data
              alterada, não serão recriadas.
            </p>
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="secondary-button" disabled={busy}>
              Pré-visualizar datas
            </button>
            {preview && (
              <div>
                <p role="status">
                  {preview.filter((item) => !item.transactionId).length} novo(s) lançamento(s)
                  pendente(s).
                </p>
                <ul className="occurrence-preview">
                  {preview.map((item) => (
                    <li key={item.date}>
                      {dateLabel(item.date)} —{" "}
                      {item.transactionId
                        ? item.deleted
                          ? "já gerado e excluído"
                          : "já gerado"
                        : "novo pendente"}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy || !preview.some((item) => !item.transactionId)}
                  onClick={() => void generate()}
                >
                  Gerar pendentes
                </button>
              </div>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}
