import { appName } from "@finance/shared";
import { Filter, Plus, Settings } from "lucide-react";
import { useEffect, useState } from "react";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const summary = [
  { label: "Receita mensal", value: "R$ 0,00", tone: "income" },
  { label: "Despesas", value: "R$ 0,00", tone: "expense" },
  { label: "Saldo previsto", value: "R$ 0,00", tone: "balance" },
  { label: "Lancamentos", value: "0", tone: "neutral" },
];

const categories = [
  { name: "Moradia", amount: "R$ 0,00", percent: 0 },
  { name: "Mercado", amount: "R$ 0,00", percent: 0 },
  { name: "Transporte", amount: "R$ 0,00", percent: 0 },
  { name: "Lazer", amount: "R$ 0,00", percent: 0 },
];

const chartBars = Array.from({ length: 14 }, (_, index) => ({
  id: `month-flow-bar-${index + 1}`,
  height: 24 + (index % 5) * 12,
}));

export function App() {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${apiUrl}/health`, {
      signal: controller.signal,
    })
      .then((response) => {
        setApiStatus(response.ok ? "online" : "offline");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setApiStatus("offline");
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">F</span>
          <span>{appName}</span>
        </div>

        <nav className="nav-list" aria-label="Navegacao principal">
          <a className="nav-item active" href="/">
            Dashboard
          </a>
          <a className="nav-item" href="/">
            Transacoes
          </a>
          <a className="nav-item" href="/">
            Categorias
          </a>
          <a className="nav-item" href="/">
            Orcamentos
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Maio de 2026</p>
            <h1>Visao geral</h1>
          </div>

          <div className="actions">
            <span className={`api-status ${apiStatus}`}>API {apiStatus}</span>
            <button className="icon-button" type="button" title="Filtrar">
              <Filter size={18} />
            </button>
            <button className="icon-button" type="button" title="Configuracoes">
              <Settings size={18} />
            </button>
            <button className="primary-action" type="button">
              <Plus size={18} />
              Nova transacao
            </button>
          </div>
        </header>

        <section className="summary-grid" aria-label="Resumo mensal">
          {summary.map((item) => (
            <article className={`metric ${item.tone}`} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

        <section className="dashboard-grid">
          <div className="panel">
            <div className="panel-header">
              <h2>Fluxo do mes</h2>
              <span>Receitas x despesas</span>
            </div>
            <div className="chart-placeholder" aria-label="Grafico de fluxo mensal" role="img">
              {chartBars.map((bar) => (
                <span className="bar" key={bar.id} style={{ height: `${bar.height}px` }} />
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Categorias</h2>
              <span>Despesas confirmadas</span>
            </div>
            <div className="category-list">
              {categories.map((category) => (
                <div className="category-row" key={category.name}>
                  <div>
                    <strong>{category.name}</strong>
                    <span>{category.amount}</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${category.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Transacoes recentes</h2>
            <span>Nenhum lancamento cadastrado</span>
          </div>
          <div className="empty-state">
            <strong>Comece registrando sua primeira receita ou despesa.</strong>
            <p>
              Quando a API de transacoes entrar, esta area vira a lista operacional do dia a dia.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
