import { type FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Catalogs } from "../lib/models";
export function SettingsView({
  data,
  householdId,
  canManage,
  onSaved,
}: {
  data: Catalogs;
  householdId: string;
  canManage: boolean;
  onSaved: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [logins, setLogins] = useState<{ id: string; name: string; email: string; role: string }[]>(
    [],
  );
  const [version, setVersion] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version refreshes the list after login creation.
  useEffect(() => {
    let active = true;
    if (canManage)
      void api<typeof logins>("/auth/users")
        .then((items) => {
          if (active) setLogins(items);
        })
        .catch((e: Error) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [canManage, version]);
  async function settings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setBusy(true);
    try {
      await api(`/settings/${householdId}`, {
        method: "PUT",
        body: {
          timezone: form.get("timezone"),
          monthlyPeriodStartDay: Number(form.get("day")),
          includePendingInReports: form.get("pending") === "on",
        },
      });
      onSaved("Configurações salvas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  async function addLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    setError("");
    setBusy(true);
    try {
      await api("/auth/users", {
        method: "POST",
        body: {
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          ...(form.get("personId") ? { personId: form.get("personId") } : {}),
        },
      });
      element.reset();
      setVersion(version + 1);
      onSaved("Login criado com acesso de membro.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar login.");
    } finally {
      setBusy(false);
    }
  }
  async function password(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/auth/password", {
        method: "POST",
        body: {
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
        },
      });
      window.dispatchEvent(new Event("finance-session-expired"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao alterar senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Minha senha</h2>
            <p className="muted">Ao alterar, você entrará novamente em todos os dispositivos.</p>
          </div>
        </div>
        <form className="form-stack" onSubmit={password}>
          <fieldset disabled={busy}>
            <label>
              Senha atual
              <input
                name="currentPassword"
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
              />
            </label>
            <label>
              Nova senha
              <input
                name="newPassword"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <button type="submit" className="primary-button" disabled={busy}>
              Alterar minha senha
            </button>
          </fieldset>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Preferências da casa</h2>
            <p className="muted">Compartilhadas por todos os membros.</p>
          </div>
        </div>
        <form className="form-stack" onSubmit={settings}>
          <fieldset disabled={busy || !canManage}>
            <label>
              Moeda
              <input value={data.settings.currency} readOnly />
            </label>
            <label>
              Fuso horário
              <input name="timezone" required defaultValue={data.settings.timezone} />
            </label>
            <label>
              Início do período mensal
              <input
                name="day"
                type="number"
                required
                min={1}
                max={28}
                defaultValue={data.settings.monthlyPeriodStartDay}
              />
            </label>
            <label className="check-label">
              <input
                name="pending"
                type="checkbox"
                defaultChecked={data.settings.includePendingInReports}
              />
              Incluir pendentes no resultado do período
            </label>
            {canManage && (
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? "Salvando…" : "Salvar preferências"}
              </button>
            )}
          </fieldset>
        </form>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Acesso à casa</h2>
            <p className="muted">Cada pessoa usa o próprio login.</p>
          </div>
        </div>
        {canManage ? (
          <>
            <ul className="login-list">
              {logins.map((u) => (
                <li key={u.id}>
                  <strong>{u.name}</strong>
                  <span>
                    {u.email} · {u.role === "member" ? "Membro" : "Administrador"}
                  </span>
                </li>
              ))}
            </ul>
            <h3>Adicionar login</h3>
            <form className="form-stack" onSubmit={addLogin}>
              <fieldset disabled={busy}>
                <label>
                  Nome
                  <input name="name" required maxLength={120} />
                </label>
                <label>
                  E-mail
                  <input name="email" type="email" required maxLength={254} />
                </label>
                <label>
                  Senha inicial
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                  <span className="hint">Mínimo de 12 caracteres.</span>
                </label>
                <label>
                  Pessoa financeira
                  <select aria-label="Pessoa financeira" name="personId">
                    <option value="">Criar nova pessoa</option>
                    {data.people
                      .filter((p) => p.isActive && !p.userId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <button type="submit" className="primary-button" disabled={busy}>
                  Criar login de membro
                </button>
              </fieldset>
            </form>
          </>
        ) : (
          <p className="hint">
            Você pode lançar e editar as finanças da casa. A administração dos cadastros e logins é
            feita pelo administrador.
          </p>
        )}
      </section>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
