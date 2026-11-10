"use client";

import { FormEvent, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { BrandLogo } from "@/components/brand-logo";
import { getHomeForRole } from "@/lib/roles";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const DEMO_PASSWORD = "Cip@2026";

const DEMO_ACCOUNTS = [
  { email: "prefeito@cmd.local", label: "Prefeito — cenário" },
  { email: "gestor@cmd.local", label: "Secretário — pasta" },
  { email: "analista@cmd.local", label: "Equipe — projetos" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    const result = await signIn("credentials", {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Credenciais inválidas. Verifique e-mail e senha.");
      return;
    }

    try {
      const res = await fetch("/api/auth/session");
      const session = await res.json();
      router.push(getHomeForRole(session?.user?.role));
    } catch {
      router.push("/painel");
    }
    router.refresh();
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
        <h2 className="login-panel__title">Entrar</h2>
        <p className="login-panel__hint">
          O papel define a visão: prefeito vê o cenário; secretário opera a
          pasta; equipe executa os projetos.
        </p>

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
