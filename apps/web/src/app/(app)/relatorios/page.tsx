import { getServerSession } from "next-auth";
import { CLASS_GROUPS } from "@cip/shared";
import { authOptions } from "@/lib/auth";
import { apiFetch, API_URL } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { saudeGoverno } from "@/components/overview/governo-glance";
import type { OverviewResponse } from "@/components/overview/types";
import { ExportButtons } from "./export-buttons";

type Report = {
  data: {
    geradoEm: string;
    metodoVersao: string;
    observacao: string;
    porSecretaria: Array<{
      id: string;
      nome: string;
      sigla?: string | null;
      classificacao: string;
      kpis: {
        totalTarefas: number;
        abertas: number;
        atrasadas: number;
        pctAtraso: number;
        indicePonderado: number;
        semPrazo: number;
        diasSemAtualizacao: number | null;
      };
      projetos: Array<{
        id: string;
        codigo: string;
        nome: string;
        totalTarefas: number;
        atrasadas: number;
        pctAtraso: number;
      }>;
      pedemAcao: {
        atrasadas: Array<{ id: string; descricao: string; projeto: string; gravidade?: string | null }>;
        vencemEm15d: Array<{ id: string; descricao: string; projeto: string }>;
        semPrazo: Array<{ id: string; descricao: string; projeto: string }>;
      };
    }>;
  };
};

/* Paleta do documento (fundo claro, legível em impressão). */
const COR = {
  verde: "#2f9e5b",
  azul: "#3f63e0",
  ouro: "#c98a1a",
  rosa: "#e0335f",
  lilas: "#7a55d6",
  cinza: "#8a91a8",
};

const CLASSE_COR: Record<string, string> = {
  INTERVENCAO: COR.rosa,
  DADOS_DEFASADOS: COR.lilas,
  ACOMPANHAMENTO: COR.ouro,
  ROTINA: COR.verde,
};
const ORDEM = ["INTERVENCAO", "DADOS_DEFASADOS", "ACOMPANHAMENTO", "ROTINA"];

function numero(valor: string | null | undefined) {
  if (valor == null) return null;
  const n = Number(String(valor).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function conclusao(saude: number | null) {
  if (saude == null)
    return { cor: COR.cinza, titulo: "Plano em implantação", texto: "O plano de governo ainda está sendo cadastrado pela consultoria CIP." };
  if (saude >= 80)
    return { cor: COR.verde, titulo: "Governo em dia", texto: "A maior parte das entregas do plano está concluída ou dentro do prazo." };
  if (saude >= 60)
    return { cor: COR.ouro, titulo: "Pede atenção", texto: "Há atrasos ou entregas sem prazo que precisam de acompanhamento próximo." };
  return { cor: COR.rosa, titulo: "Precisa de intervenção", texto: "Parte relevante das entregas está atrasada. As secretarias em vermelho precisam de cobrança direta." };
}

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

function Rosca({ valor, cor }: { valor: number | null; cor: string }) {
  return (
    <div
      className="rp-rosca"
      style={{ background: `conic-gradient(${cor} ${(valor ?? 0) * 3.6}deg, #e7e9f2 0)` }}
      role="img"
      aria-label={valor == null ? "Sem dados" : `${valor}% das entregas em dia`}
    >
      <div>
        <strong style={{ color: cor }}>{valor == null ? "—" : `${valor}%`}</strong>
        <span>entregas em dia</span>
      </div>
    </div>
  );
}

function Pilha({ partes }: { partes: Array<{ rotulo: string; valor: number; cor: string }> }) {
  const total = partes.reduce((a, p) => a + p.valor, 0);
  return (
    <div className="rp-pilha">
      <div className="rp-pilha__barra">
        {total ? (
          partes.map((p) => (p.valor ? <span key={p.rotulo} style={{ flexGrow: p.valor, background: p.cor }} /> : null))
        ) : (
          <span style={{ flexGrow: 1, background: "#e7e9f2" }} />
        )}
      </div>
      <ul className="rp-pilha__legenda">
        {partes.map((p) => (
          <li key={p.rotulo}>
            <i style={{ background: p.cor }} />
            <strong>{p.valor}</strong> {p.rotulo}
            {total ? <em> ({Math.round((p.valor / total) * 100)}%)</em> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function RelatoriosPage() {
  const session = await getServerSession(authOptions);
  const municipio = session?.user?.municipioNome || "Prefeitura";
  const [report, overview] = await Promise.all([
    apiFetch<Report>("/reports/executivo.json", { token: session?.accessToken }),
    apiFetch<OverviewResponse>("/dashboard/resumo", { token: session?.accessToken }),
  ]);

  const { governo, porSecretaria, estrategia } = overview.data;
  const metas = overview.data.metas ?? { total: 0, comIndicador: 0, comValor: 0, cobertura: 0, atrasadas: 0, semPrazo: 0, concluidas: 0, pedemAcao: [] };
  const saude = saudeGoverno(governo);
  const c = conclusao(saude);
  const abertasEmDia = Math.max(0, governo.abertas - governo.atrasadas - governo.semPrazo);
  const metasEmAndamento = Math.max(0, metas.total - metas.concluidas - metas.atrasadas - metas.semPrazo);
  const metasEstrategicas = estrategia?.metas ?? [];
  const aguardandoMedicao = metasEstrategicas.filter((m) => m.aguardandoMedicao).length;

  const geradoEm = new Date(report.data.geradoEm);
  const dataExtenso = geradoEm.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const secretarias = [...porSecretaria]
    .filter((s) => s.tarefasTotal > 0)
    .sort(
      (a, b) =>
        ORDEM.indexOf(a.classificacao) - ORDEM.indexOf(b.classificacao) || b.pctAtraso - a.pctAtraso,
    );
  const semTarefas = porSecretaria.filter((s) => !s.tarefasTotal);
  const emIntervencao = secretarias.filter((s) => s.classificacao === "INTERVENCAO");

  const pontos = report.data.porSecretaria
    .filter((s) => s.pedemAcao.atrasadas.length || s.pedemAcao.vencemEm15d.length)
    .sort((a, b) => b.pedemAcao.atrasadas.length - a.pedemAcao.atrasadas.length);

  const passos: Array<{ cor: string; texto: string }> = [];
  if (emIntervencao.length)
    passos.push({
      cor: COR.rosa,
      texto: `Reunir ${emIntervencao.length === 1 ? "a secretaria" : "as secretarias"} em intervenção (${emIntervencao.map((s) => s.sigla || s.nome).join(", ")}) para replanejar as entregas atrasadas.`,
    });
  if (governo.atrasadas)
    passos.push({ cor: COR.rosa, texto: `Cobrar a regularização de ${plural(governo.atrasadas, "tarefa atrasada", "tarefas atrasadas")}, com novo prazo e evidência de execução.` });
  if (governo.semPrazo)
    passos.push({ cor: COR.ouro, texto: `Definir prazo para ${plural(governo.semPrazo, "tarefa", "tarefas")} que ainda não têm data de entrega.` });
  if (aguardandoMedicao)
    passos.push({ cor: COR.lilas, texto: `Registrar a medição de ${plural(aguardandoMedicao, "meta estratégica que aguarda", "metas estratégicas que aguardam")} o valor atual do indicador.` });
  if (semTarefas.length)
    passos.push({ cor: COR.azul, texto: `Concluir o cadastro do plano em ${plural(semTarefas.length, "secretaria", "secretarias")} sem tarefas: ${semTarefas.map((s) => s.sigla || s.nome).join(", ")}.` });
  if (!passos.length) passos.push({ cor: COR.verde, texto: "Manter o ritmo: nenhuma pendência crítica identificada neste período." });

  return (
    <div className="rp-pagina">
      <div className="rp-barra no-print">
        <div>
          <strong>Relatório de prestação de contas</strong>
          <span>Documento pronto para apresentar ao secretariado, à Câmara ou à imprensa. Use “Salvar PDF” para enviar.</span>
        </div>
        <ExportButtons csvUrl={`${API_URL}/reports/executivo.csv`} token={session?.accessToken || ""} />
      </div>

      <article className="rp-doc">
        <header className="rp-capa">
          <div className="rp-capa__topo">
            <BrandLogo />
            <span className="rp-capa__selo">Relatório executivo</span>
          </div>
          <p className="rp-capa__kicker">Prestação de contas do plano de governo</p>
          <h1>{municipio}</h1>
          <p className="rp-capa__data">Situação em {dataExtenso}</p>
          <p className="rp-capa__proposito">
            Este relatório mostra, de forma objetiva, <strong>o que já foi entregue</strong>,{" "}
            <strong>o que está atrasado</strong> e <strong>onde a gestão precisa agir</strong> para cumprir o plano de governo.
          </p>
        </header>

        <section className="rp-secao">
          <h2><span>1</span> Resumo executivo</h2>
          <div className="rp-resumo" style={{ ["--c" as string]: c.cor }}>
            <Rosca valor={saude} cor={c.cor} />
            <div className="rp-resumo__texto">
              <p className="rp-veredito">{c.titulo}</p>
              <p>{c.texto}</p>
              <Pilha
                partes={[
                  { rotulo: "concluídas", valor: governo.concluidas, cor: COR.verde },
                  { rotulo: "no prazo", valor: abertasEmDia, cor: COR.azul },
                  { rotulo: "sem prazo", valor: governo.semPrazo, cor: COR.ouro },
                  { rotulo: "atrasadas", valor: governo.atrasadas, cor: COR.rosa },
                ]}
              />
            </div>
          </div>
          <ul className="rp-numeros">
            <li><strong>{porSecretaria.length}</strong><span>secretarias</span></li>
            <li><strong>{governo.totalProjetos}</strong><span>projetos</span></li>
            <li><strong>{governo.totalTarefas}</strong><span>tarefas</span></li>
            <li style={{ ["--c" as string]: COR.verde }}><strong>{governo.concluidas}</strong><span>entregues</span></li>
            <li style={{ ["--c" as string]: COR.rosa }}><strong>{governo.atrasadas}</strong><span>atrasadas</span></li>
          </ul>
        </section>

        <section className="rp-secao">
          <h2><span>2</span> Desempenho por secretaria</h2>
          <p className="rp-nota">Percentual de entregas concluídas ou dentro do prazo em cada pasta. Ordenado da mais crítica para a mais tranquila.</p>
          <ul className="rp-legenda">
            {CLASS_GROUPS.map((g) => (
              <li key={g.key}><i style={{ background: CLASSE_COR[g.key] ?? COR.cinza }} />{g.label}</li>
            ))}
          </ul>
          {secretarias.length ? (
            <ol className="rp-ranking">
              {secretarias.map((s) => {
                const cor = CLASSE_COR[s.classificacao] ?? COR.cinza;
                const emDia = Math.round(((s.concluidas + s.noPrazo) / s.tarefasTotal) * 100);
                const g = CLASS_GROUPS.find((x) => x.key === s.classificacao);
                return (
                  <li key={s.id} style={{ ["--c" as string]: cor }}>
                    <span className="rp-ranking__nome">
                      <i />
                      <span>
                        <strong>{s.nome}</strong>
                        <small>{g?.label} · {plural(s.projetos, "projeto", "projetos")}{s.titular?.nome ? ` · ${s.titular.nome}` : ""}</small>
                      </span>
                    </span>
                    <span className="rp-ranking__barra"><span style={{ width: `${emDia}%` }} /></span>
                    <strong className="rp-ranking__pct">{emDia}%</strong>
                    <span className="rp-ranking__info">
                      {s.concluidas}/{s.tarefasTotal} entregues
                      {s.atrasadas ? <b> · {plural(s.atrasadas, "atrasada", "atrasadas")}</b> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="rp-vazio">Nenhuma secretaria com tarefas cadastradas ainda.</p>
          )}
          {!!semTarefas.length && (
            <p className="rp-nota">Ainda sem tarefas cadastradas: {semTarefas.map((s) => s.nome).join(", ")}.</p>
          )}
        </section>

        <section className="rp-secao rp-duas">
          <div>
            <h2><span>3</span> Metas estratégicas</h2>
            {metasEstrategicas.length ? (
              <ul className="rp-metas">
                {metasEstrategicas.map((m) => {
                  const realizado = numero(m.medicaoAtual?.valorRealizado);
                  const alvo = numero(m.alvo);
                  const pct = realizado != null && alvo ? Math.max(0, Math.min(100, Math.round((realizado / alvo) * 100))) : null;
                  const cor = m.aguardandoMedicao ? COR.lilas : m.desvio != null && m.desvio < 0 ? COR.rosa : COR.verde;
                  const situacao = m.aguardandoMedicao ? "Aguardando medição" : m.desvio != null && m.desvio < 0 ? "Abaixo do esperado" : "No ritmo";
                  return (
                    <li key={m.id} style={{ ["--c" as string]: cor }}>
                      <div className="rp-metas__topo">
                        <strong>{m.nome}</strong>
                        <em>{situacao}</em>
                      </div>
                      <span className="rp-metas__barra"><span style={{ width: `${pct ?? 0}%` }} /></span>
                      <small>
                        {m.indicador || "Indicador a definir"}: {m.medicaoAtual?.valorRealizado ?? "—"} de {m.alvo || "—"} {m.unidade || ""}
                        {pct != null ? ` (${pct}%)` : ""}
                      </small>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rp-vazio">Metas estratégicas ainda não cadastradas.</p>
            )}
          </div>
          <div>
            <h2><span>4</span> Metas de execução</h2>
            <div className="rp-exec">
              <p><strong>{metas.concluidas}</strong> de {metas.total} metas concluídas</p>
              <Pilha
                partes={[
                  { rotulo: "concluídas", valor: metas.concluidas, cor: COR.verde },
                  { rotulo: "em andamento", valor: metasEmAndamento, cor: COR.azul },
                  { rotulo: "sem prazo", valor: metas.semPrazo, cor: COR.ouro },
                  { rotulo: "vencidas", valor: metas.atrasadas, cor: COR.rosa },
                ]}
              />
              <p className="rp-nota">{metas.cobertura}% das metas têm o valor atual informado pelos indicadores.</p>
            </div>
          </div>
        </section>

        <section className="rp-secao">
          <h2><span>5</span> Pontos de atenção</h2>
          {pontos.length ? (
            <div className="rp-pontos">
              {pontos.map((s) => (
                <div key={s.id} className="rp-ponto" style={{ ["--c" as string]: CLASSE_COR[s.classificacao] ?? COR.cinza }}>
                  <h3>{s.nome}</h3>
                  <ul>
                    {s.pedemAcao.atrasadas.slice(0, 3).map((t) => (
                      <li key={t.id}><span className="rp-tag rp-tag--rosa">Atrasada</span>{t.descricao}<small>{t.projeto}</small></li>
                    ))}
                    {s.pedemAcao.vencemEm15d.slice(0, 2).map((t) => (
                      <li key={t.id}><span className="rp-tag rp-tag--ouro">Vence em 15 dias</span>{t.descricao}<small>{t.projeto}</small></li>
                    ))}
                  </ul>
                  {s.pedemAcao.atrasadas.length > 3 && (
                    <p className="rp-nota">+ {s.pedemAcao.atrasadas.length - 3} outras atrasadas</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="rp-vazio rp-vazio--ok">Nenhuma entrega atrasada ou vencendo nos próximos 15 dias.</p>
          )}
        </section>

        <section className="rp-secao">
          <h2><span>6</span> Próximos passos recomendados</h2>
          <ol className="rp-passos">
            {passos.map((p, i) => (
              <li key={i} style={{ ["--c" as string]: p.cor }}>{p.texto}</li>
            ))}
          </ol>
        </section>

        <footer className="rp-rodape">
          <BrandLogo variant="mark" />
          <span>Centro de Inteligência Pública · Da estratégia à entrega</span>
          <span>Gerado em {geradoEm.toLocaleString("pt-BR")} · Método {report.data.metodoVersao}</span>
        </footer>
      </article>
    </div>
  );
}
