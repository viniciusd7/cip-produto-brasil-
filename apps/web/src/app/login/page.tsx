"use client";

import { FormEvent, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { BrandLogo } from "@/components/brand-logo";
import { getHomeForRole } from "@/lib/roles";
import { API_URL } from "@/lib/api";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const DEMO_PASSWORD = "Cip@2026";

const DEMO_ACCOUNTS = [
  { email: "prefeito@cmd.local", label: "Prefeito — cenário" },
  { email: "gestor@cmd.local", label: "Secretário — pasta" },
  { email: "analista@cmd.local", label: "Consultor — projetos" },
] as const;

type TenantOption = {
  id: string;
  nome: string;
  uf: string;
  role: string;
  secretariaNome?: string | null;
};

export default function LoginPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[] | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  function fillDemo(email: string) {
    if (!DEMO_MODE) return;
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) {
      passwordRef.current.value = DEMO_PASSWORD;
      passwordRef.current.focus();
    }
    setError("");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, preview: true }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result?.error?.message || "Credenciais inválidas. Verifique e-mail e senha.",
        );
      }
      const data = result.data as {
        isPlatformAdmin: boolean;
        requiresSelection: boolean;
        tenants: TenantOption[];
      };
      setPendingEmail(email);
      setPendingPassword(password);
      if (data.requiresSelection) {
        setTenantOptions(data.tenants);
        setLoading(false);
        return;
      }
      await establishSession(email, password, data.tenants[0]?.id);
    } catch (error) {
      setLoading(false);
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a sessão.",
      );
    }
  }

  async function establishSession(email: string, password: string, municipioId?: string) {
    const result = await signIn("credentials", {
      email,
      password,
      ...(municipioId ? { municipioId } : {}),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Não foi possível abrir o acesso para esta prefeitura.");
      return;
    }
    setPendingPassword("");

    try {
      const response = await fetch("/api/auth/session");
      const session = await response.json();
      router.push(getHomeForRole(session?.user?.role));
    } catch {
      router.push("/painel");
    }
    router.refresh();
  }

  async function selectTenant(municipioId: string) {
    const password = pendingPassword;
    if (!pendingEmail || !password || !municipioId) {
      setError("Entre novamente para escolher uma prefeitura.");
      setTenantOptions(null);
      setPendingPassword("");
      return;
    }
    setLoading(true);
    setError("");
    await establishSession(pendingEmail, password, municipioId);
  }

  return (
    <div className="login-access">
      <section className="login-hero" aria-label="Sobre a CIP">
        <div className="login-hero__brand">
          <BrandLogo priority />
          <p className="login-hero__org">Centro de Inteligência Pública</p>
        </div>

        <h1 className="login-hero__title">
          Da estratégia
          <br />
          {"à entrega."}
        </h1>
        <p className="login-hero__lead">
          Inteligência de gestão municipal: do cenário do governo à cobrança
          pontual em cada pasta e projeto.
        </p>

        <ul className="login-hero__points">
          <li>
            <span>Cenário</span>
            Visão executiva da carteira, atrasos e atenção do gabinete.
          </li>
          <li>
            <span>Pasta</span>
            Saúde da secretaria, equipe e pauta de acompanhamento.
          </li>
          <li>
            <span>Projeto</span>
            Meta → tarefa → evidência, com responsáveis e prazos reais.
          </li>
        </ul>

        <a
          className="login-hero__site"
          href="https://cipinteligenciapublica.com.br/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Conhecer a CIP ↗
        </a>
      </section>

      <section className="login-panel" aria-label="Acesso ao painel">
        <p className="login-panel__eyebrow">Acesso ao painel</p>
        <h2 className="login-panel__title">
          {tenantOptions ? "Escolha a prefeitura" : "Entrar"}
        </h2>
        <p className="login-panel__hint">
          {tenantOptions
            ? "Sua conta tem acesso a mais de uma prefeitura. Escolha onde deseja trabalhar agora."
            : "Acesse o ambiente municipal ou a gestão central da CIP com suas credenciais."}
        </p>

        {tenantOptions ? (
          <div className="login-form">
            {tenantOptions.map((tenant) => (
              <button
                key={tenant.id}
                type="button"
                className="tenant-choice"
                disabled={loading}
                onClick={() => void selectTenant(tenant.id)}
              >
                <strong>{tenant.nome} ({tenant.uf})</strong>
                <span>
                  {tenant.role === "gestor"
                    ? `Secretário${tenant.secretariaNome ? ` · ${tenant.secretariaNome}` : ""}`
                    : tenant.role === "analista"
                      ? "Consultor"
                      : tenant.role === "prefeito"
                        ? "Prefeito"
                        : "Acesso de consulta"}
                </span>
              </button>
            ))}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setTenantOptions(null);
                setPendingEmail("");
                setPendingPassword("");
                setError("");
              }}
            >
              Voltar ao login
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="login-form">
            <div>
              <label htmlFor="email">E-mail</label>
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="voce@prefeitura.gov.br"
              />
            </div>
            <div>
              <label htmlFor="password">Senha</label>
              <input
                ref={passwordRef}
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Sua senha"
              />
            </div>
            {error && (
              <p className="login-form__error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Entrando…" : "Entrar no painel"}
            </Button>
          </form>
        )}

        {error && tenantOptions && (
          <p className="login-form__error" role="alert">
            {error}
          </p>
        )}

        {DEMO_MODE ? (
          <div className="login-demo">
            <p className="login-demo__label">Contas de demonstração</p>
            <p className="login-demo__note">
              Ambiente local. Clique para preencher e-mail e senha. Senha:{" "}
              <code>{DEMO_PASSWORD}</code>
            </p>
            <ul className="login-demo__list">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    className="login-demo__btn"
                    onClick={() => fillDemo(account.email)}
                  >
                    {account.label}
                    <small>{account.email}</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="login-cip-mark">
          Produto do{" "}
          <a
            href="https://cipinteligenciapublica.com.br/"
            target="_blank"
            rel="noreferrer"
          >
            Centro de Inteligência Pública (CIP)
          </a>
          . Uso sob licença proprietária.
        </p>
      </section>
    </div>
  );
}
