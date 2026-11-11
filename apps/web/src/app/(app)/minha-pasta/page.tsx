import Link from "next/link";
import { getServerSession } from "next-auth";
import { toneClassPasta as classTone } from "@cip/shared";
import { Badge } from "@cip/ui";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ApiError, apiFetch } from "@/lib/api";
import { PastaSaudeResumo } from "@/components/charts/pasta-saude-resumo";
import { DadosExternos } from "@/components/dados-externos";

type ProjetoItem = {
  id: string;
  codigo: string;
  nome: string;
  ciclo: string;
  pendencias: number;
  atrasadas: number;
  bloqueioLabel?: string | null;
  secretariaPrincipalNome?: string;
};

type PastaResumo = {
  data: {
    secretaria: {
      id: string;
      nome: string;
      sigla?: string | null;
      titular: {
        nome?: string | null;
        cargo?: string | null;
        telefone?: string | null;
      };
    };
    classificacao: string;
    pctAtraso: number;
    tarefasStatus: {
      noPrazo: number;
      atrasadas: number;
      semPrazo: number;
      concluidas: number;
    };
    projetosPrincipais?: ProjetoItem[];
    projetosCorrelacionados?: ProjetoItem[];
    projetos: ProjetoItem[];
  } | null;
};

function classLabel(c: string) {
  const map: Record<string, string> = {
    INTERVENCAO: "Intervenção",
    ACOMPANHAMENTO: "Acompanhar",
    ROTINA: "Rotina",
    DADOS_DEFASADOS: "Dados defasados",
  };
  return map[c] || c;
}

function ProjetoLista({
  titulo,
  descricao,
  projetos,
  correlacionado,
}: {
  titulo: string;
  descricao: string;
  projetos: ProjetoItem[];
  correlacionado?: boolean;
}) {
  return (
    <section className="pasta-section" aria-labelledby={`${titulo}-title`}>
      <div className="pasta-section__head">
        <h2 id={`${titulo}-title`}>{titulo}</h2>
        <p>{descricao}</p>
      </div>
      {!projetos.length ? (
        <div className="pasta-empty">
          <p>
            {correlacionado
              ? "Nenhum projeto correlacionado nesta pasta."
              : "Ainda não há projetos principais. Use “Novo projeto” para criar o primeiro."}
          </p>
        </div>
      ) : (
        <div className="pastas-grid">
          {projetos.map((p) => (
            <Link
              key={p.id}
              href={`/iniciativas/${p.id}?aba=andamento`}
              className="projeto-folder"
            >
              <div>
                <h3>{p.nome}</h3>
                <p>
                  {p.codigo}
                  {correlacionado && p.secretariaPrincipalNome
                    ? ` · titular: ${p.secretariaPrincipalNome}`
                    : ""}
                  {p.bloqueioLabel ? ` · ${p.bloqueioLabel}` : ""}
                </p>
              </div>
              <Badge tone={p.atrasadas ? "danger" : "success"}>
                {p.atrasadas ? `${p.atrasadas} atrasos` : "ok"}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function MinhaPastaPage({
  searchParams,
}: {
  searchParams: Promise<{ secretariaId?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const qs = sp.secretariaId ? `?secretariaId=${sp.secretariaId}` : "";
  let payload: PastaResumo;
  try {
    payload = await apiFetch<PastaResumo>(`/dashboard/pasta-resumo${qs}`, {
      token: session?.accessToken,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  if (!payload.data) {
    return (
      <div className="pasta-board">
        <header className="pasta-hero">
          <p className="pasta-hero__kicker">Minha pasta · gestão</p>
          <h1 className="pasta-hero__title">Cadastre uma secretaria</h1>
          <p className="pasta-hero__lead">
            A pasta concentra a saúde das tarefas, os projetos principais e os
            correlacionados.
          </p>
        </header>
      </div>
    );
  }

  const {
    secretaria,
    classificacao,
    pctAtraso,
    tarefasStatus,
    projetosPrincipais,
    projetosCorrelacionados,
    projetos,
  } = payload.data;
  const principais = projetosPrincipais ?? projetos;
  const correlacionados = projetosCorrelacionados ?? [];
  const fila = [...principais]
    .sort((a, b) => b.atrasadas - a.atrasadas || b.pendencias - a.pendencias)
    .slice(0, 3);
  const novoHref = `/minha-pasta/novo?secretariaId=${secretaria.id}`;
  const titulo = secretaria.sigla
    ? `${secretaria.nome} (${secretaria.sigla})`
    : secretaria.nome;

  return (
    <div className="pasta-board">
      <header className="pasta-hero">
        <div className="pasta-hero__main">
          <p className="pasta-hero__kicker">Minha pasta · preview de gestão</p>
          <h1 className="pasta-hero__title">{titulo}</h1>
          <p className="pasta-hero__lead">
            {secretaria.titular.nome || "Titular não cadastrado"}
            {secretaria.titular.cargo ? ` · ${secretaria.titular.cargo}` : ""}
            {secretaria.titular.telefone
              ? ` · ${secretaria.titular.telefone}`
              : ""}
          </p>
        </div>
        <div className="pasta-hero__aside">
          <div className="pasta-hero__badges">
            <Badge tone={classTone(classificacao)}>
              {classLabel(classificacao)}
            </Badge>
            <Badge tone={pctAtraso >= 35 ? "danger" : "info"}>
              {pctAtraso}% atraso
            </Badge>
          </div>
          <Link href={novoHref} className="cip-btn cip-btn--primary">
            Novo projeto
          </Link>
        </div>
      </header>

      <section className="pasta-section" aria-labelledby="pasta-saude-title">
        <div className="pasta-section__head">
          <h2 id="pasta-saude-title">Saúde das tarefas</h2>
          <p>Contagem do que está no prazo, atrasado, sem data ou concluído.</p>
        </div>
        <div className="pasta-section__surface">
          <PastaSaudeResumo status={tarefasStatus} />
        </div>
      </section>

      <section className="pasta-section" aria-labelledby="pasta-fila-title">
        <div className="pasta-section__head">
          <h2 id="pasta-fila-title">Fila de ação</h2>
          <p>
            {fila.length
              ? "Priorize o que está atrasado ou bloqueado nos projetos principais."
              : "Nenhum projeto crítico na fila."}
          </p>
        </div>
        {!fila.length ? (
          <div className="pasta-empty">
            <p>Use “Novo projeto” para abrir o primeiro projeto desta pasta.</p>
          </div>
        ) : (
          <ul className="pasta-fila">
            {fila.map((p) => (
              <li key={p.id} className="pasta-fila__item">
                <div>
                  <strong>{p.nome}</strong>
                  <p className="dashboard-muted">
                    {p.codigo}
                    {p.bloqueioLabel ? ` · ${p.bloqueioLabel}` : ""}
                  </p>
                </div>
                <div className="pasta-fila__actions">
                  <Badge
                    tone={
                      p.atrasadas
                        ? "danger"
                        : p.bloqueioLabel
                          ? "warning"
                          : "success"
                    }
                  >
                    {p.bloqueioLabel
                      ? p.bloqueioLabel
                      : p.atrasadas
                        ? `${p.atrasadas} atrasos`
                        : "ok"}
                  </Badge>
                  <Link
                    href={`/iniciativas/${p.id}?aba=andamento`}
                    className="cip-btn cip-btn--secondary"
                  >
                    Andamento
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProjetoLista
        titulo="Meus projetos"
        descricao="Projetos em que esta pasta é a responsável principal."
        projetos={principais}
      />

      <ProjetoLista
        titulo="Projetos correlacionados"
        descricao="Projetos de outras pastas em que esta secretaria participa."
        projetos={correlacionados}
        correlacionado
      />

      <DadosExternos token={session?.accessToken || ""} />
    </div>
  );
}
