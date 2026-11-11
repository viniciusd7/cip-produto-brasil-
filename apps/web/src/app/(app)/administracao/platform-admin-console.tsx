"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Consultant = {
  id: string;
  name: string;
  email: string;
  municipios: Array<{ id: string; nome: string }>;
};

type Municipality = {
  id: string;
  nome: string;
  uf: string;
  ibgeCode: string | null;
  cnpjOrgao: string | null;
  mandatoInicio: string | null;
  mandatoFim: string | null;
  prefeitoNome: string | null;
  prefeitoTelefone: string | null;
  prefeitoEmail: string | null;
  active: boolean;
  consultorResponsavel: Pick<Consultant, "id" | "name" | "email"> | null;
  secretarias: number;
  projetos: number;
};

type MunicipalUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roleCode: string;
  secretariaId: string | null;
  secretariaNome: string | null;
};

type MunicipalityUsers = {
  id: string;
  nome: string;
  secretarias: Array<{ id: string; nome: string; sigla: string | null }>;
  usuarios: MunicipalUser[];
};

export function PlatformAdminConsole({ token }: { token: string }) {
  const [municipios, setMunicipios] = useState<Municipality[]>([]);
  const [consultores, setConsultores] = useState<Consultant[]>([]);
  const [municipioId, setMunicipioId] = useState("");
  const [municipioUsers, setMunicipioUsers] = useState<MunicipalityUsers | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPortfolio = useCallback(async () => {
    const [municipiosResult, consultoresResult] = await Promise.all([
      apiFetch<{ data: Municipality[] }>("/admin/municipios", { token }),
      apiFetch<{ data: Consultant[] }>("/admin/consultores", { token }),
    ]);
    setMunicipios(municipiosResult.data);
    setConsultores(consultoresResult.data);
    setMunicipioId((current) =>
      current && municipiosResult.data.some((item) => item.id === current)
        ? current
        : municipiosResult.data[0]?.id || "",
    );
  }, [token]);

  const loadMunicipalUsers = useCallback(async () => {
    if (!municipioId) {
      setMunicipioUsers(null);
      return;
    }
    const result = await apiFetch<{ data: MunicipalityUsers }>(
      `/admin/municipios/${encodeURIComponent(municipioId)}/usuarios`,
      { token },
    );
    setMunicipioUsers(result.data);
  }, [municipioId, token]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void loadPortfolio()
        .catch((cause: unknown) => {
          if (active) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Não foi possível carregar a carteira de prefeituras.",
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadPortfolio]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void loadMunicipalUsers().catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar a equipe municipal.",
          );
        }
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadMunicipalUsers]);

  async function refresh() {
    setError("");
    await loadPortfolio();
    await loadMunicipalUsers();
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
    action: (form: FormData) => Promise<void>,
    successMessage: string,
  ) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action(form);
      formElement.reset();
      await refresh();
      setNotice(successMessage);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível concluir a operação.",
      );
    } finally {
      setBusy(false);
    }
  }

  function value(form: FormData, key: string) {
    return String(form.get(key) || "").trim();
  }

  function isoDate(raw: string) {
    return raw ? new Date(`${raw}T00:00:00.000Z`).toISOString() : null;
  }

  async function assignConsultant(municipio: Municipality, consultorId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/admin/municipios/${municipio.id}/consultor`, {
        method: "POST",
        token,
        body: JSON.stringify({ consultorId: consultorId || null }),
      });
      await refresh();
      setNotice(`Consultoria atualizada para ${municipio.nome}.`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar o consultor responsável.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleMunicipio(municipio: Municipality) {
    const nextActive = !municipio.active;
    if (
      !window.confirm(
        nextActive
          ? `Reativar o acesso de ${municipio.nome}?`
          : `Desativar ${municipio.nome}? Os usuários municipais perderão acesso até a reativação.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/admin/municipios/${municipio.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ active: nextActive }),
      });
      await refresh();
      setNotice(
        nextActive
          ? `${municipio.nome} foi reativada.`
          : `${municipio.nome} foi desativada.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível alterar o status da prefeitura.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack platform-console">
      <header className="page-header">
        <p className="eyebrow">Administração da plataforma</p>
        <h1>Carteira de prefeituras</h1>
        <p>
          Cadastre municípios, distribua consultores CIP e acompanhe a estrutura
          e os acessos de cada prefeitura em um único lugar.
        </p>
      </header>

      {error && <p className="platform-message platform-message--error" role="alert">{error}</p>}
      {notice && <p className="platform-message" role="status">{notice}</p>}

      <section className="platform-section">
        <h2>Panorama da carteira</h2>
        {loading ? (
          <p>Carregando prefeituras…</p>
        ) : municipios.length ? (
          <div className="platform-tenant-grid">
            {municipios.map((municipio) => (
              <article className="platform-tenant-card" key={municipio.id}>
                <div className="platform-tenant-card__heading">
                  <div>
                    <h3>{municipio.nome} <span>({municipio.uf})</span></h3>
                    <p>{municipio.active ? "Ativa" : "Inativa"}</p>
                  </div>
                  <button
                    type="button"
                    className="platform-link-button"
                    disabled={busy}
                    onClick={() => setMunicipioId(municipio.id)}
                  >
                    Gerir equipe
                  </button>
                </div>
                <div className="platform-stats">
                  <span><strong>{municipio.secretarias}</strong> secretarias</span>
                  <span><strong>{municipio.projetos}</strong> projetos</span>
                </div>
                <dl>
                  <div><dt>Prefeito(a)</dt><dd>{municipio.prefeitoNome || "Não informado"}</dd></div>
                  <div><dt>Mandato</dt><dd>{municipio.mandatoInicio && municipio.mandatoFim
                    ? `${new Date(municipio.mandatoInicio).toLocaleDateString("pt-BR")} a ${new Date(municipio.mandatoFim).toLocaleDateString("pt-BR")}`
                    : "Não informado"}</dd></div>
                  <div><dt>Consultor responsável</dt><dd>{municipio.consultorResponsavel?.name || "Não atribuído"}</dd></div>
                </dl>
                <label className="platform-field">
                  Atribuir consultor
                  <select
                    value={municipio.consultorResponsavel?.id || ""}
                    disabled={busy}
                    onChange={(event) => void assignConsultant(municipio, event.target.value)}
                  >
                    <option value="">Sem consultor responsável</option>
                    {consultores.map((consultor) => (
                      <option key={consultor.id} value={consultor.id}>
                        {consultor.name} · {consultor.email}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="platform-link-button"
                  disabled={busy}
                  onClick={() => void toggleMunicipio(municipio)}
                >
                  {municipio.active ? "Desativar prefeitura" : "Reativar prefeitura"}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p>Nenhuma prefeitura cadastrada. Use o formulário abaixo para iniciar a carteira.</p>
        )}
      </section>

      <section className="platform-section">
        <h2>Cadastrar prefeitura</h2>
        <form
          className="platform-form"
          onSubmit={(event) => void submit(event, async (form) => {
            await apiFetch("/admin/municipios", {
              method: "POST",
              token,
              body: JSON.stringify({
                nome: value(form, "nome"),
                uf: value(form, "uf"),
                ibgeCode: value(form, "ibgeCode") || null,
                cnpjOrgao: value(form, "cnpjOrgao") || null,
                mandatoInicio: isoDate(value(form, "mandatoInicio")),
                mandatoFim: isoDate(value(form, "mandatoFim")),
                prefeitoNome: value(form, "prefeitoNome"),
                prefeitoTelefone: value(form, "prefeitoTelefone"),
                prefeitoEmail: value(form, "prefeitoEmail"),
              }),
            });
          }, "Prefeitura cadastrada.")}
        >
          <label className="platform-field">Nome da prefeitura<input name="nome" required minLength={2} maxLength={120} /></label>
          <label className="platform-field">UF<input name="uf" required maxLength={2} pattern="[A-Za-z]{2}" /></label>
          <label className="platform-field">Código IBGE<input name="ibgeCode" inputMode="numeric" pattern="[0-9]{7}" /></label>
          <label className="platform-field">CNPJ do órgão<input name="cnpjOrgao" inputMode="numeric" pattern="[0-9]{14}" /></label>
          <label className="platform-field">Início do mandato<input name="mandatoInicio" type="date" /></label>
          <label className="platform-field">Fim do mandato<input name="mandatoFim" type="date" /></label>
          <label className="platform-field">Nome do(a) prefeito(a)<input name="prefeitoNome" required minLength={2} maxLength={120} /></label>
          <label className="platform-field">Telefone do gabinete<input name="prefeitoTelefone" type="tel" required minLength={8} maxLength={30} /></label>
          <label className="platform-field">E-mail do gabinete<input name="prefeitoEmail" type="email" required /></label>
          <button className="cip-btn cip-btn--primary" disabled={busy}>Cadastrar prefeitura</button>
        </form>
      </section>

      <section className="platform-section">
        <h2>Cadastrar consultor e atribuir prefeitura</h2>
        <p className="dashboard-muted">
          Para um consultor já cadastrado, faça a atribuição diretamente no cartão
          da prefeitura. Este formulário cria uma nova conta e já a vincula ao
          município selecionado.
        </p>
        <form
          className="platform-form"
          onSubmit={(event) => void submit(event, async (form) => {
            await apiFetch("/admin/consultores", {
              method: "POST",
              token,
              body: JSON.stringify({
                name: value(form, "name"),
                email: value(form, "email"),
                password: value(form, "password"),
                municipioId: value(form, "consultorMunicipioId"),
              }),
            });
          }, "Consultor criado e atribuído.")}
        >
          <label className="platform-field">Nome completo<input name="name" required minLength={2} maxLength={120} /></label>
          <label className="platform-field">E-mail<input name="email" type="email" required /></label>
          <label className="platform-field">Senha inicial<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
          <label className="platform-field">Prefeitura inicial
            <select name="consultorMunicipioId" required defaultValue="">
              <option value="" disabled>Selecione</option>
              {municipios.filter((municipio) => municipio.active).map((municipio) => (
                <option key={municipio.id} value={municipio.id}>{municipio.nome} ({municipio.uf})</option>
              ))}
            </select>
          </label>
          <button className="cip-btn cip-btn--primary" disabled={busy || !municipios.some((municipio) => municipio.active)}>
            Criar e atribuir consultor
          </button>
        </form>
      </section>

      <section className="platform-section">
        <h2>Equipe municipal</h2>
        <label className="platform-field platform-field--select">
          Prefeitura
          <select value={municipioId} onChange={(event) => setMunicipioId(event.target.value)}>
            {municipios.map((municipio) => (
              <option key={municipio.id} value={municipio.id}>{municipio.nome} ({municipio.uf})</option>
            ))}
          </select>
        </label>
        {municipioUsers && (
          <>
            <p className="dashboard-muted">
              Cadastre prefeito, secretários e acessos de consulta. O papel de secretário
              sempre precisa estar vinculado a uma secretaria desta prefeitura.
            </p>
            <form
              className="platform-form"
              onSubmit={(event) => void submit(event, async (form) => {
                await apiFetch(`/admin/municipios/${municipioUsers.id}/usuarios`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({
                    name: value(form, "municipalName"),
                    email: value(form, "municipalEmail"),
                    password: value(form, "municipalPassword") || undefined,
                    roleCode: value(form, "roleCode"),
                    ...(value(form, "roleCode") === "gestor"
                      ? { secretariaId: value(form, "secretariaId") }
                      : {}),
                  }),
                });
              }, "Acesso municipal cadastrado.")}
            >
              <label className="platform-field">Nome completo<input name="municipalName" required minLength={2} maxLength={120} /></label>
              <label className="platform-field">E-mail<input name="municipalEmail" type="email" required /></label>
              <label className="platform-field">Senha inicial <span>(necessária somente para nova conta)</span><input name="municipalPassword" type="password" minLength={6} autoComplete="new-password" /></label>
              <label className="platform-field">Papel
                <select name="roleCode" defaultValue="gestor">
                  <option value="prefeito">Prefeito</option>
                  <option value="gestor">Secretário</option>
                  <option value="leitura">Consulta</option>
                </select>
              </label>
              <label className="platform-field">Secretaria <span>(para secretário)</span>
                <select name="secretariaId" defaultValue="">
                  <option value="">Selecione</option>
                  {municipioUsers.secretarias.map((secretaria) => (
                    <option key={secretaria.id} value={secretaria.id}>
                      {secretaria.sigla ? `${secretaria.sigla} · ` : ""}{secretaria.nome}
                    </option>
                  ))}
                </select>
              </label>
              <button className="cip-btn cip-btn--primary" disabled={busy}>Cadastrar acesso</button>
            </form>
            <div className="platform-user-list">
              <h3>{municipioUsers.nome}: {municipioUsers.usuarios.length} acessos</h3>
              {municipioUsers.usuarios.length ? municipioUsers.usuarios.map((user) => (
                <article key={user.id}>
                  <div><strong>{user.name}</strong><span>{user.email}</span></div>
                  <div>
                    <strong>{user.roleCode === "gestor" ? "Secretário" : user.roleCode === "prefeito" ? "Prefeito" : user.roleCode === "analista" ? "Consultor" : "Consulta"}</strong>
                    <span>{user.secretariaNome || (user.active ? "Ativo" : "Inativo")}</span>
                  </div>
                </article>
              )) : <p>Nenhum usuário vinculado ainda.</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
