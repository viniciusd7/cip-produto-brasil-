import Link from "next/link";
import { getServerSession } from "next-auth";
import { toneClassPasta as classTone } from "@cip/shared";
import { Badge } from "@cip/ui";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ApiError, apiFetch } from "@/lib/api";
import { PastaSaudeResumo } from "@/components/charts/pasta-saude-resumo";
import { SecretariaGlance } from "@/components/overview/secretaria-glance";
import type { CenarioSecretariaResponse } from "@/components/overview/cenario-secretaria";
import { DadosExternos } from "@/components/dados-externos";
import { canWriteRole } from "@/lib/roles";
import {
  TarefasGestao,
  type TarefaGestaoItem,
} from "./tarefas-gestao";
import {
  ProjetosSecretaria,
  type ProjetoSecretariaItem,
} from "./projetos-secretaria";
import {
  MetasSecretaria,
  type MetaEstrategicaPasta,
  type MetaExecucaoPasta,
} from "./metas-secretaria";

type ProjetoItem = ProjetoSecretariaItem;

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
    metasEstrategicas?: MetaEstrategicaPasta[];
    metasExecucao?: MetaExecucaoPasta[];
  } | null;
};

type AgendaResponse = {
  data: { tarefas: TarefaGestaoItem[] };
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

export default async function MinhaPastaPage({
  searchParams,
}: {
  searchParams: Promise<{ secretariaId?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const qs = sp.secretariaId ? `?secretariaId=${sp.secretariaId}` : "";
  let payload: PastaResumo;
  let tarefas: TarefaGestaoItem[] = [];
  let cenario: CenarioSecretariaResponse | null = null;
  try {
    const [pastaPayload, agendaPayload, cenarioPayload] = await Promise.all([
      apiFetch<PastaResumo>(`/dashboard/pasta-resumo${qs}`, {
        token: session?.accessToken,
      }),
      session?.user?.role === "gestor"
        ? apiFetch<AgendaResponse>("/dashboard/agenda", {
            token: session?.accessToken,
          })
        : Promise.resolve({ data: { tarefas: [] } }),
      apiFetch<CenarioSecretariaResponse>(`/dashboard/cenario-secretaria${qs}`, {
        token: session?.accessToken,
      }).catch(() => null),
    ]);
    payload = pastaPayload;
    cenario = cenarioPayload;
    tarefas = agendaPayload.data.tarefas;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  if (!payload.data) {
    return (
      <div className="pasta-board">
        <header className="pasta-hero">
          <p className="pasta-hero__kicker">Minha secretaria · acompanhamento</p>
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
    metasEstrategicas,
    metasExecucao,
  } = payload.data;
  const principais = projetosPrincipais ?? projetos;
  const correlacionados = projetosCorrelacionados ?? [];
  const novoHref = `/minha-pasta/novo?secretariaId=${secretaria.id}`;
  const canCreateProject = canWriteRole(session?.user?.role);
  const titulo = secretaria.sigla
    ? `${secretaria.nome} (${secretaria.sigla})`
    : secretaria.nome;

  return (
    <div className="pasta-board">
      <header className="pasta-hero">
        <div className="pasta-hero__main">
          <p className="pasta-hero__kicker">Minha secretaria · acompanhamento</p>
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
          {canCreateProject && (
            <Link href={novoHref} className="cip-btn cip-btn--primary">
              Novo projeto
            </Link>
          )}
        </div>
      </header>

      {cenario?.data?.selected ? (
        <SecretariaGlance
          dados={cenario.data}
          titulo="Visão geral da sua secretaria"
          mostrarProjetos={false}
        />
      ) : (
        <section className="pasta-section" aria-labelledby="pasta-saude-title">
          <div className="pasta-section__head">
            <h2 id="pasta-saude-title">Saúde da secretaria</h2>
            <p>
              Tarefas dos projetos sob gestão direta e participação compartilhada.
            </p>
          </div>
          <div className="pasta-section__surface">
            <PastaSaudeResumo status={tarefasStatus} />
          </div>
        </section>
      )}

      <ProjetosSecretaria projetos={[...principais, ...correlacionados]} />

      {session?.user?.role === "gestor" && (
        <TarefasGestao tarefas={tarefas} token={session?.accessToken || ""} />
      )}

      {!cenario?.data?.selected && (
        <MetasSecretaria
          estrategicas={metasEstrategicas ?? []}
          execucao={metasExecucao ?? []}
        />
      )}

      <DadosExternos token={session?.accessToken || ""} />
    </div>
  );
}
