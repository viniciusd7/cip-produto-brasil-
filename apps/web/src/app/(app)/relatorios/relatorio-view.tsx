import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { ExportButtons } from "./export-buttons";
import { FiltrosPrestacao } from "./filtros-prestacao";
import { GerenciadorRelatorio, IndicadoresRelatorio, type DadosGerenciador } from "./gerenciador-relatorio";
import { TabelaRelatorio, type ConsultaRelatorio } from "./tabela-relatorio";
import { VisaoGrafica } from "./visao-grafica";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
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
  } & DadosGerenciador;
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
  const filtrosAtivos = ["de", "ate", "secretariaId", "projetoId", "status", "busca"].some((chave) => qs.has(chave));
  const secoes = [
    { tipo: "tarefas", titulo: "Tarefas e progresso", href: "/relatorios" },
    { tipo: "metas", titulo: "Indicadores", href: "/relatorios/metas" },
    { tipo: "projetos", titulo: "Projetos", href: "/relatorios/projetos" },
    { tipo: "secretarias", titulo: "Secretarias", href: "/relatorios/secretarias" },
    { tipo: "evidencias", titulo: "Evidências", href: "/relatorios/evidencias" },
  ];

  function enderecoSecao(item: { tipo: string; href: string }) {
    const parametros = new URLSearchParams(qs);
    parametros.set("tipo", item.tipo);
    parametros.delete("ordenar");
    parametros.delete("direcao");
    if (item.tipo === "metas" || item.tipo === "evidencias") parametros.delete("status");
    return `${item.href}?${parametros}`;
  }

  return (
    <div className="pc">
      <header className="pc-identidade">
        <BrandLogo priority />
        <div>
          <strong>Centro de Inteligência Pública</strong>
          <span>Da estratégia à entrega</span>
        </div>
      </header>
      <header className="pc-acoes">
        <div>
          <p className="pc-acoes__marca">CIP · Inteligência de gestão municipal</p>
          <h1>Relatório de acompanhamento</h1>
          <p>Explore os dados do município em gráficos e detalhes. Escolha um recorte para orientar suas decisões.</p>
        </div>
        <ExportButtons />
      </header>

      <nav className="pc-areas no-print" aria-label="Áreas dos relatórios">
        {secoes.map((item) => <Link key={item.tipo} href={enderecoSecao(item)} aria-current={consulta.tipo === item.tipo ? "page" : undefined}>{item.titulo}</Link>)}
      </nav>

      <details className="pc-filtros-box no-print" open={filtrosAtivos}>
        <summary>Filtros adicionais{filtrosAtivos ? " · ativos" : ""}</summary>
        <FiltrosPrestacao key={qs.toString()} opcoes={opcoes} filtros={Object.fromEntries(qs)} />
      </details>

      <section className="pc-recorte" aria-label="Recorte aplicado ao relatório">
        <strong>{session?.user?.municipioNome || "Prefeitura"} · {titulo}</strong>
        <span>{qs.has("de") || qs.has("ate") ? `Período de ${qs.get("de") || "início dos registros"} até ${qs.get("ate") || "hoje"}` : "Período completo"}</span>
        <span>{opcoes.secretarias.find((item) => item.id === qs.get("secretariaId"))?.nome || "Todas as secretarias"} · {opcoes.projetos.find((item) => item.id === qs.get("projetoId"))?.nome || "Todos os projetos"}</span>
        {qs.get("status") && <span>Situação selecionada: {({ VENCIDO: "Atrasadas", SEM_PRAZO: "Sem prazo", NO_PRAZO: "No prazo", CONCLUIDO: "Concluídas", ENCERRADO_SEM_SOLUCAO: "Encerradas sem solução" } as Record<string, string>)[qs.get("status")!] || qs.get("status")}</span>}
        {consulta.busca && <span>Busca aplicada: {consulta.busca}</span>}
      </section>

      {consulta.tipo === "metas" && <IndicadoresRelatorio dados={data} consulta={consulta} />}
      {consulta.tipo === "tarefas" ? <>
        <GerenciadorRelatorio dados={data} consulta={consulta} />
        <details className="pc-complemento"><summary>Gráficos complementares</summary><VisaoGrafica consulta={consulta} titulo={titulo} /></details>
      </> : <VisaoGrafica consulta={consulta} titulo={titulo} />}

      <details className="pc-dados"><summary>Tabela completa · {consulta.total} {consulta.total === 1 ? "linha" : "linhas"}</summary>
      <section className="pc-resultados" aria-labelledby="relatorio-resultados">
        <header className="pc-resultados__cabecalho">
          <div>
            <h2 id="relatorio-resultados">Detalhamento: {titulo}</h2>
            <p>{session?.user?.municipioNome || "Prefeitura"} · {consulta.total} {consulta.total === 1 ? "linha" : "linhas"}</p>
          </div>
          <p className="pc-nota">O PDF inclui os gráficos e o detalhamento desta consulta.</p>
        </header>
        <p className="pc-nota">
          {consulta.tipo === "metas"
            ? "Uma linha por indicador real. Metas sem indicadores também aparecem. O período limita as medições; base, atual e alvo mantêm os valores cadastrados."
            : consulta.tipo === "evidencias"
              ? "Uma linha por evidência do projeto. O período considera a data de envio."
              : consulta.tipo === "tarefas"
                ? "Uma linha por tarefa. O período considera o prazo ou a conclusão."
                : "Uma linha por projeto ou secretaria. As contagens consideram as tarefas do recorte selecionado."}
        </p>
        <TabelaRelatorio consulta={consulta} parametros={qs.toString()} />
        <footer className="pc-nota">
          Consulta gerada em {new Date(data.geradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
          {" "}Relatório com os filtros aplicados nesta consulta.
        </footer>
      </section>
      </details>
      <footer className="pc-assinatura">
        <strong>CIP · Centro de Inteligência Pública</strong>
        <span>Inteligência de gestão municipal</span>
        <a href="https://cipinteligenciapublica.com.br/">cipinteligenciapublica.com.br</a>
      </footer>
    </div>
  );
}
