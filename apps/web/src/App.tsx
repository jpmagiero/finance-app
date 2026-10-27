import type { AuthSession } from "@finance/shared";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutDashboard,
  List,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Wallet,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { CatalogsView } from "./components/Catalogs";
import { Modal } from "./components/Modal";
import { SettingsView } from "./components/SettingsView";
import { TransactionForm } from "./components/TransactionForm";
import { ApiError, api, query, setCsrfToken } from "./lib/api";
import type { Catalogs, Dashboard, Transaction, TransactionPage } from "./lib/models";
import { statusLabels, typeLabels } from "./lib/models";
import { dateLabel, money, today } from "./lib/money";

const emptyFilters = { type: "", status: "", accountId: "", categoryId: "", tagId: "", search: "" };
type Section = "dashboard" | "transactions" | "catalogs" | "settings";
export function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checking, setChecking] = useState(true),
    [sessionError, setSessionError] = useState("");
  const [version, setVersion] = useState(0);
  const signIn = useCallback((value: AuthSession) => {
    setCsrfToken(value.csrfToken);
    setSession(value);
    setSessionError("");
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version explicitly retries session discovery.
  useEffect(() => {
    let active = true;
    void api<AuthSession>("/auth/me")
      .then((value) => {
        if (active) signIn(value);
      })
      .catch((e: Error) => {
        if (active && !(e instanceof ApiError && e.status === 401)) setSessionError(e.message);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [signIn, version]);
  useEffect(() => {
    const expire = () => {
      setCsrfToken("");
      setSession(null);
    };
    window.addEventListener("finance-session-expired", expire);
    return () => window.removeEventListener("finance-session-expired", expire);
  }, []);
  if (checking)
    return (
      <main className="welcome">
        <div className="brand-mark">F</div>
        <p role="status">Abrindo sua casa financeira…</p>
      </main>
    );
  if (!session)
    return (
      <Login
        onSuccess={signIn}
        connectionError={sessionError}
        retry={() => {
          setChecking(true);
          setVersion(version + 1);
        }}
      />
    );
  return (
    <Workspace
      key={session.user.id}
      session={session}
      onLogout={() => {
        setCsrfToken("");
        setSession(null);
      }}
    />
  );
}

function Login({
  onSuccess,
  connectionError,
  retry,
}: {
  onSuccess: (value: AuthSession) => void;
  connectionError: string;
  retry: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      onSuccess(
        await api<AuthSession>("/auth/login", {
          method: "POST",
          body: { email: data.get("email"), password: data.get("password") },
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">F</span>Finance App
        </div>
        <div>
          <p className="eyebrow">UMA CASA, MAIS CLAREZA</p>
          <h1>
            Suas finanças.
            <br />O nosso dia a dia.
          </h1>
          <p>
            Acompanhe o que entra, entenda o que sai e organize a vida financeira da casa em um só
            lugar.
          </p>
          <div className="story-line" />
          <span>Individual quando precisa. Junto quando importa.</span>
        </div>
        <small>Controle financeiro pessoal e familiar</small>
      </section>
      <section className="login-content">
        <div className="login-card">
          <p className="eyebrow">BEM-VINDO DE VOLTA</p>
          <h2>Entre na sua casa</h2>
          <p className="muted">Use seu login individual para continuar.</p>
          <form className="form-stack" onSubmit={submit}>
            <fieldset disabled={busy}>
              <label>
                E-mail
                <input name="email" required autoComplete="username" placeholder="seu@email.com" />
              </label>
              <label>
                Senha
                <input
                  type="password"
                  name="password"
                  required
                  maxLength={128}
                  autoComplete="current-password"
                />
              </label>
              <button type="submit" className="primary-button full-width" disabled={busy}>
                {busy ? "Entrando…" : "Entrar"}
              </button>
            </fieldset>
            {(error || connectionError) && (
              <p className="error-banner" role="alert">
                {error || "Não foi possível conectar à API. Verifique se o servidor está ativo."}
              </p>
            )}
          </form>
          {connectionError && (
            <button type="button" className="text-button" onClick={retry}>
              Tentar conexão novamente
            </button>
          )}
          <p className="login-footnote">
            Seu acesso é definido pelo administrador da casa. Não há senha padrão.
          </p>
        </div>
      </section>
    </main>
  );
}

function Workspace({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const [section, setSection] = useState<Section>("dashboard"),
    [month, setMonth] = useState(today().slice(0, 7)),
    [person, setPerson] = useState("");
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null),
    [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [houseName, setHouseName] = useState("Sua casa");
  const [transactions, setTransactions] = useState<TransactionPage>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [page, setPage] = useState(1),
    [filters, setFilters] = useState(emptyFilters),
    [filterOpen, setFilterOpen] = useState(false);
  const [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Transaction | "new" | null>(null),
    [removing, setRemoving] = useState<Transaction | null>(null),
    [busy, setBusy] = useState(false);
  const canManage = session.role !== "member";
  const reload = () => setRefresh((v) => v + 1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh invalidates server data after a mutation.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const householdId = session.householdId;
    const load = async () => {
      const [house, people, accounts, categories, payees, tags, settings, summary] =
        await Promise.all([
          api<{ household: { name: string } }>("/households/current"),
          api<Catalogs["people"]>(`/people/?${query({ householdId, includeInactive: "true" })}`),
          api<Catalogs["accounts"]>(
            `/accounts/?${query({ householdId, includeArchived: "true" })}`,
          ),
          api<Catalogs["categories"]>(
            `/categories/?${query({ householdId, includeArchived: "true" })}`,
          ),
          api<Catalogs["payees"]>(`/payees/?householdId=${householdId}`),
          api<Catalogs["tags"]>(`/tags/?householdId=${householdId}`),
          api<Catalogs["settings"]>(`/settings/${householdId}`),
          api<Dashboard>(`/dashboard/monthly?${query({ householdId, month, personId: person })}`),
        ]);
      const list = await api<TransactionPage>(
        `/transactions/?${query({ householdId, from: summary.from, to: summary.to, personId: person, ...filters, page, limit: 20 })}`,
      );
      if (!active) return;
      const maxPage = Math.max(1, Math.ceil(list.total / list.pageSize));
      if (page > maxPage) {
        setPage(maxPage);
        return;
      }
      setCatalogs({ people, accounts, categories, payees, tags, settings });
      setHouseName(house.household.name);
      setDashboard(summary);
      setTransactions(list);
    };
    void load()
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session.householdId, month, person, page, filters, refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function edit(item: Transaction) {
    setBusy(true);
    setError("");
    try {
      setEditing(await api<Transaction>(`/transactions/${item.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao abrir.");
    } finally {
      setBusy(false);
    }
  }
  async function confirm(item: Transaction) {
    setBusy(true);
    setError("");
    try {
      const detail = await api<Transaction>(`/transactions/${item.id}`);
      await api(`/transactions/${item.id}`, {
        method: "PUT",
        body: { ...detail, status: "confirmed" },
      });
      setNotice("Lançamento confirmado.");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao confirmar.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError("");
    try {
      await api(`/transactions/${removing.id}`, { method: "DELETE" });
      setRemoving(null);
      setNotice("Lançamento excluído. O saldo foi atualizado.");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout", { method: "POST" });
      onLogout();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao sair.");
    } finally {
      setBusy(false);
    }
  }
  const names: Record<Section, string> = {
    dashboard: "Visão geral",
    transactions: "Lançamentos",
    catalogs: "Cadastros",
    settings: "Configurações",
  };
  const nav = [
    { id: "dashboard" as const, title: "Visão geral", icon: LayoutDashboard },
    { id: "transactions" as const, title: "Lançamentos", icon: List },
    { id: "catalogs" as const, title: "Cadastros", icon: Wallet },
    { id: "settings" as const, title: "Configurações", icon: Settings },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">F</span>Finance App
        </div>
        <div className="house-card">
          <span className="eyebrow">CASA FINANCEIRA</span>
          <strong>{houseName}</strong>
        </div>
        <nav className="nav-list" aria-label="Navegação principal">
          {nav.map(({ id, title, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={section === id ? "nav-item active" : "nav-item"}
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
            >
              <Icon size={18} />
              {title}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-card">
            <span className="avatar">{session.user.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{session.user.name}</strong>
              <small>{canManage ? "Administrador" : "Membro da casa"}</small>
            </div>
          </div>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => void logout()}
          >
            <LogOut size={16} />
            Sair da conta
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">SEU DINHEIRO, COM CLAREZA</p>
            <h1>{names[section]}</h1>
          </div>
          <div className="actions">
            <button
              type="button"
              className="icon-button"
              aria-label="Atualizar dados"
              disabled={loading}
              onClick={reload}
            >
              <RefreshCw size={18} className={loading ? "spinning" : ""} />
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!catalogs || loading || busy}
              onClick={() => setEditing("new")}
            >
              <Plus size={18} />
              Novo lançamento
            </button>
          </div>
        </header>
        {(section === "dashboard" || section === "transactions") && (
          <section className="period-controls" aria-label="Período e pessoa">
            <label>
              Período
              <input
                type="month"
                value={month}
                min="0001-01"
                max="9999-11"
                onChange={(e) => {
                  if (/^\d{4}-\d{2}$/.test(e.target.value)) {
                    setMonth(e.target.value);
                    setPage(1);
                  }
                }}
              />
            </label>
            <label>
              Visão
              <select
                aria-label="Visão"
                value={person}
                onChange={(e) => {
                  setPerson(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Toda a casa</option>
                <option value="unassigned">Casa / sem pessoa</option>
                {catalogs?.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {!p.isActive ? " (inativa)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {dashboard && (
              <span className="period-caption">
                {dateLabel(dashboard.from)} — {dateLabel(dashboard.to)}
              </span>
            )}
          </section>
        )}
        {notice && (
          <p className="success-banner" role="status">
            {notice}
          </p>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button type="button" className="text-button" onClick={reload}>
              Tentar novamente
            </button>
          </div>
        )}
        {loading && (
          <p className="loading-indicator" role="status">
            Atualizando dados…
          </p>
        )}
        {catalogs && dashboard && (
          <div className={loading ? "content-loading" : ""} aria-busy={loading}>
            {section === "dashboard" && (
              <DashboardView
                dashboard={dashboard}
                catalogs={catalogs}
                onTransactions={() => setSection("transactions")}
              />
            )}
            {(section === "transactions" || section === "dashboard") && (
              <section className="panel transactions-panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      {section === "dashboard" ? "Lançamentos do período" : "Todos os lançamentos"}
                    </h2>
                    <p className="muted">
                      {transactions.total}{" "}
                      {transactions.total === 1
                        ? "lançamento encontrado"
                        : "lançamentos encontrados"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    aria-expanded={filterOpen}
                    onClick={() => setFilterOpen(!filterOpen)}
                  >
                    <Filter size={16} />
                    Filtros{Object.values(filters).some(Boolean) ? " · ativos" : ""}
                  </button>
                </div>
                {filterOpen && (
                  <form
                    className="filter-grid"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      setFilters(
                        Object.fromEntries(
                          Object.keys(emptyFilters).map((key) => [
                            key,
                            String(form.get(key) ?? ""),
                          ]),
                        ) as typeof emptyFilters,
                      );
                      setPage(1);
                    }}
                  >
                    <label>
                      Buscar
                      <input
                        name="search"
                        placeholder="Descrição ou observação"
                        defaultValue={filters.search}
                      />
                    </label>
                    <label>
                      Tipo
                      <select aria-label="Tipo" name="type" defaultValue={filters.type}>
                        <option value="">Todos</option>
                        {(["income", "expense", "transfer"] as const).map((t) => (
                          <option key={t} value={t}>
                            {typeLabels[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select aria-label="Status" name="status" defaultValue={filters.status}>
                        <option value="">Todos</option>
                        {(["confirmed", "pending", "canceled"] as const).map((s) => (
                          <option key={s} value={s}>
                            {statusLabels[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Conta
                      <select aria-label="Conta" name="accountId" defaultValue={filters.accountId}>
                        <option value="">Todas</option>
                        {catalogs.accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Categoria
                      <select
                        aria-label="Categoria"
                        name="categoryId"
                        defaultValue={filters.categoryId}
                      >
                        <option value="">Todas</option>
                        {catalogs.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Tag
                      <select aria-label="Tag" name="tagId" defaultValue={filters.tagId}>
                        <option value="">Todas</option>
                        {catalogs.tags.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="filter-actions">
                      <button type="submit" className="primary-button">
                        Aplicar filtros
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setFilters(emptyFilters);
                          setPage(1);
                          setFilterOpen(false);
                        }}
                      >
                        Limpar
                      </button>
                    </div>
                  </form>
                )}
                {transactions.items.length === 0 ? (
                  <div className="empty-state">
                    <Wallet size={28} />
                    <h3>Nenhum lançamento neste período</h3>
                    <p>Registre uma receita ou despesa, ou ajuste os filtros.</p>
                    <button type="button" className="text-button" onClick={() => setEditing("new")}>
                      Adicionar primeiro lançamento
                    </button>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Descrição / pessoa</th>
                          <th>Data</th>
                          <th>Tipo</th>
                          <th>Status</th>
                          <th className="amount-cell">Valor</th>
                          <th>
                            <span className="sr-only">Ações</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.items.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <strong>{t.description || typeLabels[t.type]}</strong>
                              <small>
                                {catalogs.people.find((p) => p.id === t.personId)?.name ?? "Casa"}
                                {t.accountId
                                  ? ` · ${catalogs.accounts.find((a) => a.id === t.accountId)?.name ?? "Conta"}`
                                  : " · Sem conta"}
                                {t.transferAccountId
                                  ? ` → ${catalogs.accounts.find((a) => a.id === t.transferAccountId)?.name ?? "Destino"}`
                                  : ""}
                              </small>
                            </td>
                            <td>{dateLabel(t.transactionDate)}</td>
                            <td>
                              <span className={`type-label ${t.type}`}>{typeLabels[t.type]}</span>
                            </td>
                            <td>
                              <span className={`badge ${t.status}`}>{statusLabels[t.status]}</span>
                            </td>
                            <td
                              className={`amount-cell ${t.type === "expense" ? "expense-text" : t.type === "income" ? "income-text" : ""}`}
                            >
                              {t.type === "expense" ? "− " : t.type === "income" ? "+ " : ""}
                              {money(
                                t.amountCents,
                                catalogs.accounts.find((a) => a.id === t.accountId)?.currency ??
                                  catalogs.settings.currency,
                              )}
                            </td>
                            <td>
                              <div className="row-actions">
                                {t.status === "pending" && t.type !== "adjustment" && (
                                  <button
                                    type="button"
                                    className="icon-button"
                                    aria-label={`Confirmar ${t.description || "lançamento"}`}
                                    disabled={busy || loading}
                                    onClick={() => void confirm(t)}
                                  >
                                    <Check size={16} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="icon-button"
                                  aria-label={`Editar ${t.description || "lançamento"}`}
                                  disabled={busy || loading || t.type === "adjustment"}
                                  onClick={() => void edit(t)}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-button danger"
                                  aria-label={`Excluir ${t.description || "lançamento"}`}
                                  disabled={busy || loading}
                                  onClick={() => setRemoving(t)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <footer className="pagination">
                  <span>
                    Página {transactions.page} de{" "}
                    {Math.max(1, Math.ceil(transactions.total / transactions.pageSize))}
                  </span>
                  <div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Página anterior"
                      disabled={page === 1 || loading}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Próxima página"
                      disabled={page * transactions.pageSize >= transactions.total || loading}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </footer>
              </section>
            )}
            {section === "catalogs" && (
              <CatalogsView
                data={catalogs}
                householdId={session.householdId}
                canManage={canManage}
                onRefresh={reload}
                onNotice={setNotice}
              />
            )}
            {section === "settings" && (
              <SettingsView
                key={refresh}
                data={catalogs}
                householdId={session.householdId}
                canManage={canManage}
                onSaved={(message) => {
                  setNotice(message);
                  reload();
                }}
              />
            )}
          </div>
        )}
      </main>
      {editing && catalogs && (
        <TransactionForm
          data={catalogs}
          householdId={session.householdId}
          transaction={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice("Lançamento salvo.");
            reload();
          }}
        />
      )}
      {removing && (
        <Modal title="Excluir lançamento" onClose={() => setRemoving(null)} busy={busy}>
          <div className="form-stack">
            <p>
              Excluir <strong>{removing.description || typeLabels[removing.type]}</strong> de{" "}
              {money(removing.amountCents)}?
            </p>
            <p className="hint">
              O lançamento sai dos relatórios e seu efeito no saldo é revertido.
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
                onClick={() => void remove()}
                disabled={busy}
              >
                {busy ? "Excluindo…" : "Excluir lançamento"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DashboardView({
  dashboard: d,
  catalogs,
  onTransactions,
}: {
  dashboard: Dashboard;
  catalogs: Catalogs;
  onTransactions: () => void;
}) {
  const max = Math.max(1, ...d.flow.flatMap((day) => [day.incomeCents, day.expenseCents]));
  return (
    <>
      <section className="summary-grid" aria-label="Resumo do período">
        {[
          {
            title: "Receitas",
            value: d.incomeCents,
            tone: "income",
            icon: ArrowDownLeft,
            note: `${money(d.pendingIncomeCents, d.currency)} pendentes`,
          },
          {
            title: "Despesas",
            value: d.expenseCents,
            tone: "expense",
            icon: ArrowUpRight,
            note: `${money(d.pendingExpenseCents, d.currency)} pendentes`,
          },
          {
            title: "Resultado do período",
            value: d.balanceCents,
            tone: "balance",
            icon: Wallet,
            note: catalogs.settings.includePendingInReports
              ? "Inclui pendentes"
              : "Somente confirmados",
          },
        ].map(({ title, value, tone, icon: Icon, note }) => (
          <article className={`metric ${tone}`} key={title}>
            <div>
              <span>{title}</span>
              <Icon size={19} />
            </div>
            <strong>{d.hasMixedCurrencies ? "Moedas distintas" : money(value, d.currency)}</strong>
            <small>{d.hasMixedCurrencies ? "Sem consolidação entre moedas" : note}</small>
          </article>
        ))}
      </section>
      {d.hasMixedCurrencies && (
        <p className="warning-banner">
          Existem contas em moedas diferentes. O resultado consolidado não é exibido porque não há
          conversão cambial.
        </p>
      )}
      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Entradas e saídas</h2>
              <p className="muted">Movimentos por dia do período</p>
            </div>
            <div className="legend">
              <span className="income-dot" />
              Receitas
              <span className="expense-dot" />
              Despesas
            </div>
          </div>
          {d.hasMixedCurrencies ? (
            <div className="chart-empty">
              Fluxo consolidado indisponível para moedas diferentes.
            </div>
          ) : d.flow.length === 0 ? (
            <div className="chart-empty">
              Seu fluxo aparece aqui conforme você registra lançamentos.
            </div>
          ) : (
            <div
              className="flow-chart"
              role="img"
              aria-label="Gráfico diário de receitas e despesas"
            >
              <div className="flow-bars">
                {d.flow.map((day) => (
                  <div
                    className="day-bars"
                    key={day.date}
                    title={`${dateLabel(day.date)}: receitas ${money(day.incomeCents, d.currency)}, despesas ${money(day.expenseCents, d.currency)}`}
                  >
                    <div>
                      <span
                        className="flow-income"
                        style={{ height: `${(day.incomeCents / max) * 150}px` }}
                      />
                      <span
                        className="flow-expense"
                        style={{ height: `${(day.expenseCents / max) * 150}px` }}
                      />
                    </div>
                    <small>{day.date.slice(8)}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button type="button" className="text-button chart-link" onClick={onTransactions}>
            Explorar lançamentos
            <ChevronRight size={15} />
          </button>
        </article>
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Onde você gastou</h2>
              <p className="muted">Despesas por categoria</p>
            </div>
          </div>
          {d.hasMixedCurrencies ? (
            <div className="chart-empty">
              Categorias consolidadas indisponíveis para moedas diferentes.
            </div>
          ) : d.categories.length === 0 ? (
            <div className="chart-empty">Nenhuma despesa neste período.</div>
          ) : (
            <div className="category-list">
              {d.categories.map((item) => (
                <div className="category-row" key={item.category?.id ?? "none"}>
                  <div>
                    <span>{item.category?.name ?? "Sem categoria"}</span>
                    <strong>{money(item.amountCents, d.currency)}</strong>
                  </div>
                  <div className="progress">
                    <span
                      style={{
                        width: `${d.expenseCents ? (item.amountCents / d.expenseCents) * 100 : 0}%`,
                        background: item.category?.color || "#176653",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
      {catalogs.accounts.filter((a) => !a.isArchived).length > 0 && (
        <section className="account-strip" aria-label="Saldos das contas">
          {catalogs.accounts
            .filter((a) => !a.isArchived)
            .map((a) => (
              <article key={a.id}>
                <span>{a.name}</span>
                <strong>{money(a.currentBalanceCents, a.currency)}</strong>
                <small>Saldo atual · confirmados</small>
              </article>
            ))}
        </section>
      )}
    </>
  );
}
