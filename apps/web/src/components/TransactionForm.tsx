import { type CreateTransactionInput, createTransactionSchema } from "@finance/shared";
import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { api } from "../lib/api";
import type { Catalogs, Transaction } from "../lib/models";
import { statusLabels, typeLabels } from "../lib/models";
import { amountInput, cents, today } from "../lib/money";
import { Modal } from "./Modal";

let nextSplit = 0;
export function TransactionForm({
  data,
  householdId,
  transaction,
  onClose,
  onSaved,
  recurringMode = false,
  extraFields,
  onSubmitInput,
}: {
  data: Catalogs;
  householdId: string;
  transaction?: Transaction;
  onClose: () => void;
  onSaved: () => void;
  recurringMode?: boolean;
  extraFields?: ReactNode;
  onSubmitInput?: (input: CreateTransactionInput, form: FormData) => Promise<void>;
}) {
  const [type, setType] = useState(transaction?.type ?? "expense");
  const [status, setStatus] = useState(
    transaction?.status ?? (recurringMode ? "pending" : "confirmed"),
  );
  const [amount, setAmount] = useState(transaction ? amountInput(transaction.amountCents) : "");
  const [splits, setSplits] = useState(() =>
    (transaction?.splits ?? [{ amountCents: 0 }]).map((s) => ({
      key: ++nextSplit,
      categoryId: s.categoryId ?? "",
      amount: s.amountCents ? amountInput(s.amountCents) : "",
      description: s.description ?? "",
    })),
  );
  const [tagIds, setTagIds] = useState(transaction?.tagIds ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const input = createTransactionSchema.safeParse({
        householdId,
        type,
        status,
        amountCents: cents(amount),
        personId: form.get("personId") || null,
        accountId: form.get("accountId") || null,
        transferAccountId: type === "transfer" ? form.get("transferAccountId") || null : null,
        payeeId: form.get("payeeId") || null,
        description: form.get("description") || null,
        notes: form.get("notes") || null,
        transactionDate: form.get("date"),
        competenceDate: form.get("competenceDate") || null,
        tagIds,
        splits: splits.map((s) => ({
          categoryId: s.categoryId || null,
          amountCents: cents(s.amount),
          description: s.description || null,
        })),
      });
      if (!input.success)
        throw new Error(input.error.issues.map((issue) => issue.message).join(" "));
      if (onSubmitInput) await onSubmitInput(input.data, form);
      else
        await api(transaction ? `/transactions/${transaction.id}` : "/transactions/", {
          method: transaction ? "PUT" : "POST",
          body: input.data,
        });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        recurringMode
          ? transaction
            ? "Editar recorrência"
            : "Nova recorrência"
          : transaction
            ? "Editar lançamento"
            : "Novo lançamento"
      }
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} className="form-stack">
        <fieldset disabled={busy}>
          <div className="form-grid">
            <label>
              Tipo
              <select
                aria-label="Tipo"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as typeof type);
                  setSplits(splits.map((s) => ({ ...s, categoryId: "" })));
                }}
              >
                {(["expense", "income", "transfer"] as const)
                  .filter((value) => !recurringMode || value !== "transfer")
                  .map((v) => (
                    <option key={v} value={v}>
                      {typeLabels[v]}
                    </option>
                  ))}
              </select>
            </label>
            {!recurringMode && (
              <label>
                Status
                <select
                  aria-label="Status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  {(["confirmed", "pending", "canceled"] as const).map((v) => (
                    <option key={v} value={v}>
                      {statusLabels[v]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Valor
              <input
                required
                inputMode="decimal"
                value={amount}
                placeholder="0,00"
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (splits.length === 1)
                    setSplits(splits.map((s) => ({ ...s, amount: e.target.value })));
                }}
              />
            </label>
            <label>
              {recurringMode ? "Início da recorrência" : "Data"}
              <input
                required
                name="date"
                type="date"
                defaultValue={transaction?.transactionDate ?? today(data.settings.timezone)}
              />
            </label>
          </div>
          {extraFields}
          <label>
            Descrição
            <input
              name="description"
              maxLength={180}
              placeholder="Ex.: compra no mercado"
              defaultValue={transaction?.description ?? ""}
            />
          </label>
          <div className="form-grid">
            <label>
              Pessoa
              <select
                aria-label="Pessoa"
                name="personId"
                defaultValue={transaction?.personId ?? ""}
              >
                <option value="">Casa / sem pessoa</option>
                {data.people
                  .filter((p) => p.isActive || p.id === transaction?.personId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {!p.isActive ? " (inativa)" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {type === "transfer" ? "Conta de origem" : "Conta (opcional)"}
              <select
                aria-label={type === "transfer" ? "Conta de origem" : "Conta (opcional)"}
                name="accountId"
                defaultValue={transaction?.accountId ?? ""}
                required={type === "transfer"}
              >
                <option value="">Sem conta</option>
                {data.accounts
                  .filter((a) => !a.isArchived || a.id === transaction?.accountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.isArchived ? " (arquivada)" : ""}
                    </option>
                  ))}
              </select>
            </label>
            {type === "transfer" && (
              <label>
                Conta de destino
                <select
                  aria-label="Conta de destino"
                  name="transferAccountId"
                  required
                  defaultValue={transaction?.transferAccountId ?? ""}
                >
                  <option value="">Selecione</option>
                  {data.accounts
                    .filter((a) => !a.isArchived || a.id === transaction?.transferAccountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              Favorecido / pagador
              <select
                aria-label="Favorecido / pagador"
                name="payeeId"
                defaultValue={transaction?.payeeId ?? ""}
              >
                <option value="">Não informado</option>
                {data.payees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="section-title">
            <h3>Categorias e divisão do valor</h3>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setSplits([
                  ...splits,
                  { key: ++nextSplit, categoryId: "", amount: "", description: "" },
                ])
              }
            >
              <Plus size={15} />
              Adicionar divisão
            </button>
          </div>
          {splits.map((split, index) => (
            <div className="split-row" key={split.key}>
              <label>
                Categoria {splits.length > 1 ? index + 1 : ""}
                <select
                  aria-label={splits.length > 1 ? `Categoria ${index + 1}` : "Categoria"}
                  value={split.categoryId}
                  onChange={(e) =>
                    setSplits(
                      splits.map((s) =>
                        s.key === split.key ? { ...s, categoryId: e.target.value } : s,
                      ),
                    )
                  }
                >
                  <option value="">Sem categoria</option>
                  {data.categories
                    .filter(
                      (c) =>
                        c.type === type &&
                        (!c.isArchived || transaction?.splits.some((s) => s.categoryId === c.id)),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.isArchived ? " (arquivada)" : ""}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Valor da divisão
                <input
                  required
                  inputMode="decimal"
                  value={split.amount}
                  onChange={(e) =>
                    setSplits(
                      splits.map((s) =>
                        s.key === split.key ? { ...s, amount: e.target.value } : s,
                      ),
                    )
                  }
                />
              </label>
              {splits.length > 1 && (
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={`Remover divisão ${index + 1}`}
                  onClick={() => setSplits(splits.filter((s) => s.key !== split.key))}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          ))}
          <p className="hint">A soma das divisões precisa ser igual ao valor do lançamento.</p>
          {data.tags.length > 0 && (
            <div>
              <h3>Tags</h3>
              <div className="tag-options">
                {data.tags.map((tag) => (
                  <label className="check-label" key={tag.id}>
                    <input
                      type="checkbox"
                      checked={tagIds.includes(tag.id)}
                      onChange={(e) =>
                        setTagIds(
                          e.target.checked
                            ? [...tagIds, tag.id]
                            : tagIds.filter((id) => id !== tag.id),
                        )
                      }
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <details>
            <summary>{recurringMode ? "Observações" : "Competência e observações"}</summary>
            {!recurringMode && (
              <label>
                Data de competência
                <input
                  name="competenceDate"
                  type="date"
                  defaultValue={transaction?.competenceDate ?? ""}
                />
              </label>
            )}
            <label>
              Observações
              <textarea name="notes" maxLength={2000} defaultValue={transaction?.notes ?? ""} />
            </label>
            <p className="hint">Os relatórios usam a data do lançamento.</p>
          </details>
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
            {busy ? "Salvando…" : recurringMode ? "Salvar recorrência" : "Salvar lançamento"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
