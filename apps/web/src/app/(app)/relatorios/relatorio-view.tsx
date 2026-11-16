import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { ExportButtons } from "./export-buttons";
import { FiltrosPrestacao } from "./filtros-prestacao";
import { TabelaRelatorio, type ConsultaRelatorio } from "./tabela-relatorio";
import "./prestacao.css";

export type SecaoRelatorio = "visao" | "secretarias" | "metas" | "projetos" | "tarefas" | "evidencias";

type Prestacao = {
  data: {
    geradoEm: string;
    opcoes: {
      secretarias: Array<{ id: string; nome: string; sigla?: string | null }>;
      projetos: Array<{ id: string; codigo: string; nome: string; secretariaId: string }>;
      mandato: { inicio: string | null; fim: string | null } | null;
    };
    consulta: ConsultaRelatorio;
    csv: string;
  };
};

const TITULOS: Record<string, string> = {
  tarefas: "Tarefas", metas: "Metas estratégicas e indicadores", projetos: "Projetos",
  secretarias: "Secretarias", evidencias: "Evidências",
};

export async function RelatorioConteudo({
  secao,
  searchParams,
}: {
  secao: SecaoRelatorio;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const chave of ["tipo", "de", "ate", "secretariaId", "projetoId", "status", "busca", "ordenar", "direcao"]) {
    const valor = sp[chave];
    if (typeof valor === "string" && valor) qs.set(chave, valor);
    if (Array.isArray(valor)) valor.forEach((item) => qs.append(chave, item));
  }
  if (!qs.has("tipo")) qs.set("tipo", secao === "visao" ? "tarefas" : secao);

  const session = await getServerSession(authOptions);
  const { data } = await apiFetch<Prestacao>(`/reports/prestacao.json?${qs}`, { token: session?.accessToken });
  const { consulta, opcoes } = data;
  const titulo = TITULOS[consulta.tipo];

  return (
    <div className="pc">
      <header className="pc-acoes">
        <div>
          <h1>Relatórios</h1>
          <p>Selecione os dados, aplique os filtros e exporte a tabela que está vendo.</p>
        </div>
        <ExportButtons csv={data.csv} />
      </header>

      <FiltrosPrestacao key={qs.toString()} opcoes={opcoes} filtros={Object.fromEntries(qs)} />

      <section className="pc-resultados" aria-labelledby="relatorio-resultados">
        <header className="pc-resultados__cabecalho">
          <div>
            <h2 id="relatorio-resultados">{titulo}</h2>
            <p>{session?.user?.municipioNome || "Prefeitura"} · {consulta.total} {consulta.total === 1 ? "linha" : "linhas"}</p>
          </div>
          <p className="pc-nota">CSV com as mesmas colunas, linhas e ordem. Datas no formato ano-mês-dia.</p>
        </header>
        <p className="pc-nota">
          {consulta.tipo === "metas"
            ? "Uma linha por indicador real. Metas sem indicadores também aparecem. O período limita as medições; base, atual e alvo mantêm os valores cadastrados."
            : consulta.tipo === "evidencias"
              ? "Uma linha por evidência do projeto. O período considera a data de envio."
              : "Todas as tarefas do projeto, inclusive as anteriores, entram na contagem. O período considera o prazo ou a conclusão."}
        </p>
        <TabelaRelatorio consulta={consulta} parametros={qs.toString()} />
        <footer className="pc-nota">
          Consulta gerada em {new Date(data.geradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
          {" "}O CSV corresponde a esta consulta. Aplique os filtros novamente para atualizar os dados.
        </footer>
      </section>
    </div>
  );
}
