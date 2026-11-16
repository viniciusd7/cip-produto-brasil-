import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ApiError, apiFetch } from "@/lib/api";
import { canWriteRole } from "@/lib/roles";
import {
  ProjetosSecretaria,
  type ProjetoSecretariaItem,
} from "../projetos-secretaria";
import { PlanoGovernoArvore } from "@/components/plano-governo-arvore";
import { classificacaoDoProjeto, type ClassificacaoProjeto } from "@/lib/classificacao-projeto";

type PastaResumo = {
  data: {
    secretaria: { id: string; nome: string; sigla?: string | null };
    projetosPrincipais?: ProjetoSecretariaItem[];
    projetosCorrelacionados?: ProjetoSecretariaItem[];
    projetos: ProjetoSecretariaItem[];
  } | null;
};

const VISTAS = {
  todos: {
    filtro: "TODOS" as const,
    titulo: "Todos os projetos",
    descricao: "Projetos da secretaria e os que ela acompanha em parceria.",
  },
  principais: {
    filtro: "PRINCIPAIS" as const,
    titulo: "Projetos",
    descricao: "Projetos sob responsabilidade direta da secretaria.",
  },
  correlacionados: {
    filtro: "CORRELACIONADOS" as const,
    titulo: "Correlacionados",
    descricao: "Projetos de outra pasta em que esta secretaria participa.",
  },
  estruturante: {
    filtro: "PRINCIPAIS" as const,
    titulo: "Projeto estruturante",
    descricao: "Projetos estruturantes sob responsabilidade direta da secretaria.",
    classe: "ESTRUTURANTE" as ClassificacaoProjeto,
    vazio: "Nenhum projeto estruturante nesta secretaria.",
  },
  prioritario: {
    filtro: "PRINCIPAIS" as const,
    titulo: "Projeto prioritário",
    descricao: "Projetos prioritários sob responsabilidade direta da secretaria.",
    classe: "PRIORITARIO" as ClassificacaoProjeto,
    vazio: "Nenhum projeto prioritário nesta secretaria.",
  },
  "plano-governo": {
    filtro: "PRINCIPAIS" as const,
    titulo: "Plano de governo",
    descricao: "Metas estratégicas e os projetos da secretaria ligados a cada meta.",
  },
  "acao-diaria": {
    filtro: "PRINCIPAIS" as const,
    titulo: "Ação diária",
    descricao: "Ações do dia a dia sob responsabilidade direta da secretaria.",
    classe: "ACAO_DIARIA" as ClassificacaoProjeto,
    vazio: "Nenhuma ação diária nesta secretaria.",
  },
};

export async function ListaProjetos({
  tipo,
}: {
  tipo: keyof typeof VISTAS;
}) {
  const session = await getServerSession(authOptions);
  const vista = VISTAS[tipo];
  let payload: PastaResumo;
  try {
    payload = await apiFetch<PastaResumo>("/dashboard/pasta-resumo", {
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
          <p className="pasta-hero__kicker">Projetos</p>
          <h1 className="pasta-hero__title">{vista.titulo}</h1>
          <p className="pasta-hero__lead">Cadastre uma secretaria para ver os projetos.</p>
        </header>
      </div>
    );
  }

  const principais = payload.data.projetosPrincipais ?? payload.data.projetos;
  const correlacionados = payload.data.projetosCorrelacionados ?? [];
  const secretaria = payload.data.secretaria;
  const tipoNovo: Partial<Record<keyof typeof VISTAS, string>> = {
    estruturante: "estruturante",
    prioritario: "prioritario",
    "plano-governo": "plano-governo",
    "acao-diaria": "acao-diaria",
  };
  const hrefNovo = tipoNovo[tipo]
    ? `/minha-pasta/novo?tipo=${tipoNovo[tipo]}&secretariaId=${encodeURIComponent(
        secretaria.id,
      )}`
    : `/minha-pasta/novo?secretariaId=${encodeURIComponent(secretaria.id)}`;
  const categoriaDoProjeto = (projeto: ProjetoSecretariaItem) =>
    classificacaoDoProjeto(
      projeto.classificacaoPrincipal || projeto.classificacoes?.[0],
    );
  const nome = secretaria.sigla
    ? `${secretaria.nome} (${secretaria.sigla})`
    : secretaria.nome;
  const classe = "classe" in vista ? vista.classe : null;
  const projetos = classe
    ? principais.filter((projeto) => categoriaDoProjeto(projeto) === classe)
    : [...principais, ...correlacionados];

  return (
    <div className="pasta-board">
      <header className="pasta-hero">
        <div className="pasta-hero__main">
          <p className="pasta-hero__kicker">Projetos · {nome}</p>
          <h1 className="pasta-hero__title">{vista.titulo}</h1>
          <p className="pasta-hero__lead">{vista.descricao}</p>
        </div>
        <div className="pasta-hero__aside">
          <Link href="/minha-pasta" className="cip-btn cip-btn--secondary">
            Voltar à secretaria
          </Link>
          {canWriteRole(session?.user?.role) && (
            <Link href={hrefNovo} className="cip-btn cip-btn--primary">
              Novo projeto
            </Link>
          )}
        </div>
      </header>
      {tipo === "plano-governo" ? (
        <PlanoGovernoArvore token={session?.accessToken || ""} />
      ) : (
        <ProjetosSecretaria
          projetos={projetos}
          filtroFixo={vista.filtro}
          titulo={vista.titulo}
          descricao={vista.descricao}
          mensagemVazio={"vazio" in vista ? vista.vazio : undefined}
        />
      )}
    </div>
  );
}
