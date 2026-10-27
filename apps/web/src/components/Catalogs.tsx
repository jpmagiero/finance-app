import { Archive, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { api } from "../lib/api";
import type { Account, Catalogs, Category, Named, Person } from "../lib/models";
import { accountLabels, typeLabels } from "../lib/models";
import { amountInput, cents, money } from "../lib/money";
import { Modal } from "./Modal";

type Resource = "accounts" | "people" | "categories" | "payees" | "tags";
type Item = Named & Partial<Account & Person & Omit<Category, "type">> & { type?: string };
const labels: Record<Resource, string> = {
  accounts: "Contas",
  people: "Pessoas",
  categories: "Categorias",
  payees: "Favorecidos",
  tags: "Tags",
};
export function CatalogsView({
  data,
  householdId,
  canManage,
  onRefresh,
  onNotice,
}: {
  data: Catalogs;
  householdId: string;
  canManage: boolean;
  onRefresh: () => void;
  onNotice: (value: string) => void;
}) {
  const [resource, setResource] = useState<Resource>("accounts");
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [removing, setRemoving] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const items = (data[resource] as Item[]).filter(
    (item) => archived || !(item.isArchived || item.isActive === false),
  );
  async function remove(item: Item, restore = false) {
    setBusy(true);
    setError("");
    try {
      await api(`/${resource}/${item.id}${restore ? "/restore" : ""}`, {
        method: restore ? "POST" : "DELETE",
      });
      setRemoving(null);
      onNotice(restore ? "Cadastro restaurado." : "Cadastro removido ou arquivado.");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na operação.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <nav className="tabs" aria-label="Tipos de cadastro">
        {(Object.keys(labels) as Resource[]).map((key) => (
          <button
            type="button"
            key={key}
            className={resource === key ? "tab active" : "tab"}
            onClick={() => {
              setResource(key);
              setError("");
            }}
          >
            {labels[key]}
          </button>
        ))}
      </nav>
      <div className="panel-header">
        <div>
          <h2>{labels[resource]}</h2>
          <p className="muted">Organize os cadastros da sua casa.</p>
        </div>
        {canManage && (
          <button type="button" className="primary-button" onClick={() => setEditing("new")}>
            <Plus size={17} />
            Adicionar
          </button>
        )}
      </div>
      {["people", "accounts", "categories"].includes(resource) && (
        <label className="check-label archived-toggle">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Incluir arquivados e inativos
        </label>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhum cadastro por aqui</h3>
          <p>Adicione um cadastro para facilitar seus lançamentos.</p>
        </div>
      ) : (
        <div className="catalog-list">
          {items.map((item) => {
            const inactive = item.isArchived || item.isActive === false;
            return (
              <article key={item.id} className="catalog-row">
                <div className="catalog-name">
                  <span className="color-dot" style={{ background: item.color || "#176653" }} />
                  <div>
                    <strong>{item.name}</strong>
                    <p className="muted">
                      {resource === "accounts"
                        ? `${accountLabels[item.type as Account["type"]]} · ${money(item.currentBalanceCents ?? 0, item.currency)}`
                        : resource === "categories"
                          ? typeLabels[item.type as Category["type"]]
                          : resource === "people"
                            ? item.userId
                              ? "Pessoa com login vinculado"
                              : "Pessoa financeira sem login"
                            : ""}
                    </p>
                  </div>
                  {inactive && <span className="badge">Arquivado</span>}
                </div>
                {canManage && (
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Editar ${item.name}`}
                      onClick={() => setEditing(item)}
                    >
                      <Pencil size={16} />
                    </button>
                    {inactive ? (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Restaurar ${item.name}`}
                        onClick={() => void remove(item, true)}
                        disabled={busy}
                      >
                        <RotateCcw size={17} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => {
                          setError("");
                          setRemoving(item);
                        }}
                      >
                        {["payees", "tags"].includes(resource) ? (
                          <Trash2 size={16} />
                        ) : (
                          <Archive size={16} />
                        )}
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {editing && (
        <CatalogForm
          key={resource + (editing === "new" ? "new" : editing.id)}
          resource={resource}
          item={editing === "new" ? undefined : editing}
          data={data}
          householdId={householdId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onNotice("Cadastro salvo.");
            onRefresh();
          }}
        />
      )}
      {removing && (
        <Modal title="Confirmar remoção" onClose={() => setRemoving(null)} busy={busy}>
          <div className="form-stack">
            <p>
              Deseja {["payees", "tags"].includes(resource) ? "excluir" : "arquivar"}{" "}
              <strong>{removing.name}</strong>?
            </p>
            <p className="hint">
              {["payees", "tags"].includes(resource)
                ? "Cadastros em uso não podem ser excluídos."
                : "O histórico dos lançamentos será preservado."}
            </p>
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setRemoving(null)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => void remove(removing)}
                disabled={busy}
              >
                {busy ? "Removendo…" : "Confirmar"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function CatalogForm({
  resource,
  item,
  data,
  householdId,
  onClose,
  onSaved,
}: {
  resource: Resource;
  item?: Item;
  data: Catalogs;
  householdId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [type, setType] = useState(
    item?.type ?? (resource === "accounts" ? "checking" : "expense"),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const input: Record<string, unknown> = { name: String(form.get("name")).trim() };
      if (!item) input.householdId = householdId;
      if (resource === "accounts")
        Object.assign(input, {
          type,
          personId: form.get("personId") || null,
          institution: form.get("institution") || null,
          currency: form.get("currency"),
          initialBalanceCents: cents(String(form.get("initialBalance")), true),
          isShared: form.get("isShared") === "on",
        });
      if (resource === "categories")
        Object.assign(input, {
          type,
          parentId: form.get("parentId") || null,
          color: form.get("color"),
        });
      if (resource === "people" || resource === "tags") input.color = form.get("color");
      await api(`/${resource}/${item?.id ?? ""}`, { method: item ? "PUT" : "POST", body: input });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${item ? "Editar" : "Adicionar"} · ${labels[resource]}`}
      onClose={onClose}
      busy={busy}
    >
      <form className="form-stack" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Nome
            <input
              name="name"
              required
              maxLength={resource === "tags" ? 80 : resource === "payees" ? 160 : 120}
              defaultValue={item?.name ?? ""}
            />
          </label>
          {resource === "accounts" && (
            <>
              <div className="form-grid">
                <label>
                  Tipo
                  <select aria-label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
                    {Object.entries(accountLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Moeda
                  <input
                    name="currency"
                    required
                    minLength={3}
                    maxLength={3}
                    defaultValue={item?.currency ?? data.settings.currency}
                  />
                </label>
              </div>
              <label>
                Saldo inicial
                <input
                  required
                  name="initialBalance"
                  inputMode="decimal"
                  defaultValue={amountInput(item?.initialBalanceCents ?? 0)}
                />
              </label>
              <p className="hint">
                Alterar o saldo inicial recalcula o saldo atual. O saldo atual não é editado
                diretamente.
              </p>
              <label>
                Pessoa
                <select aria-label="Pessoa" name="personId" defaultValue={item?.personId ?? ""}>
                  <option value="">Casa / sem pessoa</option>
                  {data.people
                    .filter((p) => p.isActive || p.id === item?.personId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Instituição
                <input name="institution" maxLength={120} defaultValue={item?.institution ?? ""} />
              </label>
              <label className="check-label">
                <input name="isShared" type="checkbox" defaultChecked={item?.isShared ?? false} />
                Conta compartilhada
              </label>
              {type === "credit_card" && (
                <p className="hint">
                  O cadastro de cartão ainda não oferece faturas ou parcelamentos.
                </p>
              )}
            </>
          )}
          {resource === "categories" && (
            <>
              <label>
                Tipo
                <select aria-label="Tipo" value={type} onChange={(e) => setType(e.target.value)}>
                  {(["income", "expense", "transfer"] as const).map((key) => (
                    <option key={key} value={key}>
                      {typeLabels[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Categoria pai
                <select
                  aria-label="Categoria pai"
                  name="parentId"
                  defaultValue={item?.parentId ?? ""}
                >
                  <option value="">Sem categoria pai</option>
                  {data.categories
                    .filter((c) => !c.isArchived && c.id !== item?.id && c.type === type)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
          {["categories", "people", "tags"].includes(resource) && (
            <label>
              Cor
              <input
                type="color"
                name="color"
                defaultValue={item?.color?.match(/^#[0-9a-f]{6}$/i) ? item.color : "#176653"}
              />
            </label>
          )}
        </fieldset>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Salvando…" : "Salvar cadastro"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
