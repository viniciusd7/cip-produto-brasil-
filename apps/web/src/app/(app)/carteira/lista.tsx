import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { toneCiclo, tonePrazo } from "@cip/shared";
import { Badge, Button, Card, PageHeader, SourceMeta } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { ApiError, apiFetch } from "@/lib/api";
import { canWriteRole } from "@/lib/roles";
import { classificacaoDoProjeto, type ClassificacaoProjeto } from "@/lib/classificacao-projeto";

type Projeto = {
  id: string;
  codigo: string;
  nome: string;
  ciclo: string;
  secretariaPrincipal: string;
  classificacaoPrincipal?: string | null;
  classificacoes?: string[];
  bloqueioLabel?: string | null;
  responsavel?: string | null;
  atualizadoEm: string;
  pendencias: number;
  prazoDerivado?: string | null;
};

type ListResponse = {
  data: Projeto[];
  meta?: { fonte?: string; dataReferencia?: string };
};

function categoriaProjeto(projeto: Projeto): ClassificacaoProjeto {
  const principal =
    projeto.classificacaoPrincipal || projeto.classificacoes?.[0];
  return classificacaoDoProjeto(principal);
}

const CICLO: Record<string, string> = {
  EM_PLANEJAMENTO: "Em planejamento",
  EM_ACOMPANHAMENTO: "Em acompanhamento",
  AGUARDANDO_PRE_REQUISITO: "Aguardando providência",
  CONCLUIDA: "Concluído",
  SUSPENSA: "Suspenso",
};

const PRAZO: Record<string, string> = {
  NO_PRAZO: "No prazo",
  VENCIDO: "Prazo vencido",
  SEM_PRAZO: "Definir prazo",
  CONCLUIDO: "Concluído",
};

const PASTAS: Record<
  ClassificacaoProjeto,
  { titulo: string; descricao: string; vazio: string; aba: string }
> = {
  ESTRUTURANTE: {
    titulo: "Projeto estruturante",
    descricao: "Projetos estruturantes do município, agrupados pela secretaria responsável.",
    vazio: "Nenhum projeto estruturante encontrado.",
    aba: "Estruturante",
  },
  PRIORITARIO: {
    titulo: "Projeto prioritário",
    descricao: "Projetos prioritários do município, agrupados pela secretaria responsável.",
    vazio: "Nenhum projeto prioritário encontrado.",
    aba: "Prioritário",
  },
  ACAO_DIARIA: {
    titulo: "Ação diária",
    descricao: "Ações diárias do município, agrupadas pela secretaria responsável.",
    vazio: "Nenhuma ação diária encontrada.",
    aba: "Ação diária",
  },
  PLANO_GOVERNO: {
    titulo: "Plano de governo",
    descricao: "Projetos do plano de governo.",
    vazio: "Nenhum projeto do plano de governo encontrado.",
    aba: "Plano de governo",
  },
};

export async function ListaCarteira({
  searchParams,
  classificacao,
}: {
  searchParams: Promise<{ q?: string; ciclo?: string }>;
  classificacao?: ClassificacaoProjeto;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.ciclo) qs.set("ciclo", sp.ciclo);

  let payload: ListResponse;
  try {
    payload = await apiFetch<ListResponse>(
      `/iniciativas${qs.toString() ? `?${qs}` : ""}`,
      { token: session?.accessToken },
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const pasta = classificacao ? PASTAS[classificacao] : null;
  const tipoNovo = classificacao
    ? {
        ESTRUTURANTE: "estruturante",
        PRIORITARIO: "prioritario",
        PLANO_GOVERNO: "plano-governo",
        ACAO_DIARIA: "acao-diaria",
      }[classificacao]
    : null;
  const projetos = pasta
    ? payload.data.filter((projeto) => categoriaProjeto(projeto) === classificacao)
    : payload.data;
  const secretarias = [...new Set(projetos.map((p) => p.secretariaPrincipal))];
  const podeCadastrar = canWriteRole(session?.user?.role);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Carteira de iniciativas"
        title={pasta?.titulo || "Pastas de projetos"}
        description={
          pasta?.descricao ||
          "Abra a secretaria, escolha a pasta do projeto e acompanhe metas, tarefas, prazos e conversas."
        }
        actions={
          podeCadastrar ? (
            <Link
              href={
                tipoNovo
                  ? `/minha-pasta/novo?tipo=${tipoNovo}`
                  : "/minha-pasta/novo"
              }
              className="cip-btn cip-btn--primary"
            >
              Novo projeto
            </Link>
          ) : undefined
        }
      />

      <SourceMeta
        fonte={payload.meta?.fonte}
        dataReferencia={payload.meta?.dataReferencia}
      />

      <Card>
        <form className="filter-grid">
          <div>
            <label htmlFor="q">Buscar</label>
            <input
              id="q"
              name="q"
              defaultValue={sp.q || ""}
              placeholder="Código, nome ou origem"
            />
          </div>
          <div>
            <label htmlFor="ciclo">Ciclo</label>
            <select id="ciclo" name="ciclo" defaultValue={sp.ciclo || ""}>
              <option value="">Todos</option>
              <option value="EM_PLANEJAMENTO">Em planejamento</option>
              <option value="EM_ACOMPANHAMENTO">Em acompanhamento</option>
              <option value="CONCLUIDA">Concluída</option>
              <option value="SUSPENSA">Suspensa</option>
            </select>
          </div>
          <div style={{ alignSelf: "end" }}>
            <Button type="submit" style={{ width: "100%" }}>
              Filtrar
            </Button>
          </div>
        </form>
      </Card>

      {!projetos.length && (
        <p>{pasta?.vazio || "Nenhum projeto encontrado. Crie uma pasta ou ajuste os filtros."}</p>
      )}
      {secretarias.map((secretaria) => (
        <details key={secretaria} className="more-block projeto-pasta" open>
          <summary>
            📁 {secretaria} · {projetos.filter((p) => p.secretariaPrincipal === secretaria).length} projetos
          </summary>
          <div className="pastas-grid">
            {projetos
              .filter((p) => p.secretariaPrincipal === secretaria)
              .map((p) => (
                <Link key={p.id} href={`/iniciativas/${p.id}?aba=andamento`} className="projeto-folder">
                  <span className="projeto-folder__tab">
                    {pasta?.aba || PASTAS[categoriaProjeto(p)].aba}
                  </span>
                  <h2>📁 {p.nome}</h2>
                  <p>
                    {p.codigo} · {p.responsavel || "Responsável a definir"}
                  </p>
                  <div className="chip-row">
                    <Badge tone={toneCiclo(p.ciclo)}>{CICLO[p.ciclo] || p.ciclo}</Badge>
                    <Badge tone={tonePrazo(p.prazoDerivado || "")}>
                      {PRAZO[p.prazoDerivado || ""] || "Sem tarefas"}
                    </Badge>
                  </div>
                  <p>
                    {p.bloqueioLabel ||
                      (p.pendencias ? `${p.pendencias} providências pendentes` : "Abrir metas e tarefas →")}
                  </p>
                </Link>
              ))}
          </div>
        </details>
      ))}
    </div>
  );
}
