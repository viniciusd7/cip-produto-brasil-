import { Suspense } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiFetch, API_URL } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { ExportButtons } from "./export-buttons";
import { FiltrosPrestacao } from "./filtros-prestacao";
import { TabelaTarefas, SITUACAO, type TarefaRelatorio } from "./tabela-tarefas";
import "./prestacao.css";

type Contagem = {
  total: number;
  concluidas: number;
  noPrazo: number;
  semPrazo: number;
  atrasadas: number;
  pctEmDia: number | null;
};

type Prestacao = {
  data: {
    geradoEm: string;
    metodoVersao: string;
    filtros: { de: string | null; ate: string | null; secretariaId: string | null; projetoId: string | null; status: string | null };
    opcoes: {
      secretarias: Array<{ id: string; nome: string; sigla?: string | null }>;
      projetos: Array<{ id: string; codigo: string; nome: string; secretariaId: string }>;
      mandato: { inicio: string | null; fim: string | null } | null;
    };
    resumo: Contagem & {
      projetos: number;
      secretarias: number;
      entregues: number;
      pontualidade: number | null;
      reprogramadas: number;
      evidencias: { total: number; aprovadas: number; aguardando: number; porTipo: Array<{ tipo: string; total: number }> };
    };
    evolucao: Array<{ chave: string; previstas: number; entregues: number; noPrazo: number; atrasadas: number }>;
    porSecretaria: Array<Contagem & { id: string; nome: string; sigla?: string | null; titular?: string | null; projetos: number }>;
    projetos: Array<Contagem & { id: string; codigo: string; nome: string; secretaria: string }>;
    metasExecucao: { total: number; concluidas: number; emAndamento: number; semPrazo: number; vencidas: number };
    metasEstrategicas: Array<{
      id: string;
      nome: string;
      indicador?: string | null;
      unidade?: string | null;
      alvo?: string | null;
      base?: string | null;
      secretaria?: string | null;
      realizado?: string | null;
      dataCorte?: string | null;
      pct: number | null;
    }>;
    tarefas: TarefaRelatorio[];
  };
};

const COR = {
  verde: "var(--pc-verde)",
  azul: "var(--pc-azul)",
  ouro: "var(--pc-ouro)",
  rosa: "var(--pc-rosa)",
  lilas: "var(--pc-lilas)",
  cinza: "var(--pc-cinza)",
};

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

function corPct(p: number | null) {
  if (p == null) return COR.cinza;
  if (p >= 80) return COR.verde;
  if (p >= 60) return COR.ouro;
  return COR.rosa;
}

function veredito(p: number | null) {
  if (p == null)
    return { cor: COR.cinza, titulo: "Sem tarefas no recorte", texto: "Não há entregas cadastradas para os filtros escolhidos. Ajuste o período ou a secretaria." };
  if (p >= 80)
    return { cor: COR.verde, titulo: "Plano em dia", texto: "A maior parte das entregas está concluída ou dentro do prazo." };
  if (p >= 60)
    return { cor: COR.ouro, titulo: "Pede atenção", texto: "Há atrasos ou entregas sem prazo que precisam de acompanhamento próximo." };
  return { cor: COR.rosa, titulo: "Precisa de intervenção", texto: "Parte relevante das entregas está atrasada. As secretarias em vermelho precisam de cobrança direta." };
}

function dataLonga(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function rotuloPeriodo(f: Prestacao["data"]["filtros"]) {
  if (f.de && f.ate) return `${dataLonga(f.de)} a ${dataLonga(f.ate)}`;
  if (f.de) return `A partir de ${dataLonga(f.de)}`;
  if (f.ate) return `Até ${dataLonga(f.ate)}`;
  return "Todo o plano de governo";
}

function Barra({ partes }: { partes: Array<{ rotulo: string; valor: number; cor: string }> }) {
  const total = partes.reduce((a, p) => a + p.valor, 0);
  return (
    <div className="pc-barra">
      <div className="pc-barra__trilho">
        {total ? partes.map((p) => (p.valor ? <span key={p.rotulo} style={{ flexGrow: p.valor, background: p.cor }} title={`${p.valor} ${p.rotulo}`} /> : null)) : <span style={{ flexGrow: 1 }} />}
      </div>
      <ul>
        {partes.map((p) => (
          <li key={p.rotulo} style={{ ["--c" as string]: p.cor }}>
            <i />
            <strong>{p.valor}</strong> {p.rotulo}
            {total ? <em>{Math.round((p.valor / total) * 100)}%</em> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const k of ["de", "ate", "secretariaId", "projetoId", "status"]) {
    const v = sp[k];
    if (typeof v === "string" && v) qs.set(k, v);
  }
  const query = qs.size ? `?${qs}` : "";

  const session = await getServerSession(authOptions);
  const municipio = session?.user?.municipioNome || "Prefeitura";
  const { data } = await apiFetch<Prestacao>(`/reports/prestacao.json${query}`, { token: session?.accessToken });
  const { resumo, filtros, opcoes } = data;

  const v = veredito(resumo.pctEmDia);
  const secFiltro = opcoes.secretarias.find((s) => s.id === filtros.secretariaId);
  const projFiltro = opcoes.projetos.find((p) => p.id === filtros.projetoId);
  const recorte = [
    secFiltro ? secFiltro.nome : "Todas as secretarias",
    projFiltro ? `Projeto ${projFiltro.codigo}` : null,
    filtros.status ? `Somente ${SITUACAO[filtros.status]?.rotulo.toLowerCase()}s` : null,
  ].filter(Boolean).join(" · ");

  const maxMes = Math.max(1, ...data.evolucao.map((m) => Math.max(m.previstas, m.entregues)));
  const me = data.metasExecucao;
  const ev = resumo.evidencias;
  const comFiltro = (extra: Record<string, string>) => {
    const p = new URLSearchParams(qs);
    for (const [k, val] of Object.entries(extra)) p.set(k, val);
    return `/relatorios?${p}`;
  };

  const criticas = data.porSecretaria.filter((s) => s.total && (s.pctEmDia ?? 100) < 60);
  const passos: Array<{ cor: string; texto: string }> = [];
  if (criticas.length)
    passos.push({ cor: COR.rosa, texto: `Reunir ${criticas.length === 1 ? "a secretaria" : "as secretarias"} com menos de 60% em dia (${criticas.map((s) => s.sigla || s.nome).join(", ")}) para replanejar as entregas.` });
  if (resumo.atrasadas)
    passos.push({ cor: COR.rosa, texto: `Cobrar a regularização de ${plural(resumo.atrasadas, "tarefa atrasada", "tarefas atrasadas")}, com novo prazo e evidência de execução.` });
  if (resumo.semPrazo)
    passos.push({ cor: COR.ouro, texto: `Definir prazo para ${plural(resumo.semPrazo, "tarefa", "tarefas")} que ainda não têm data de entrega.` });
  if (ev.aguardando)
    passos.push({ cor: COR.lilas, texto: `Validar ${plural(ev.aguardando, "evidência enviada", "evidências enviadas")} pelas secretarias.` });
  const semMedicao = data.metasEstrategicas.filter((m) => !m.realizado).length;
  if (semMedicao)
    passos.push({ cor: COR.azul, texto: `Registrar a medição de ${plural(semMedicao, "meta estratégica", "metas estratégicas")} sem valor atual do indicador.` });
  if (!passos.length) passos.push({ cor: COR.verde, texto: "Manter o ritmo: nenhuma pendência crítica identificada no recorte." });

  const kpis = [
    { rotulo: "tarefas no recorte", valor: resumo.total, detalhe: `${plural(resumo.projetos, "projeto", "projetos")} · ${plural(resumo.secretarias, "secretaria", "secretarias")}`, cor: COR.azul, icone: "📋" },
    { rotulo: "entregas realizadas", valor: resumo.entregues, detalhe: filtros.de || filtros.ate ? "concluídas no período" : "concluídas até hoje", cor: COR.verde, icone: "✅" },
    { rotulo: "pontualidade", valor: resumo.pontualidade == null ? "—" : `${resumo.pontualidade}%`, detalhe: "das entregas feitas no prazo", cor: corPct(resumo.pontualidade), icone: "⏱" },
    { rotulo: "atrasadas", valor: resumo.atrasadas, detalhe: resumo.reprogramadas ? `${plural(resumo.reprogramadas, "reprogramada", "reprogramadas")}` : "sem reprogramações", cor: resumo.atrasadas ? COR.rosa : COR.verde, icone: "⚠️" },
    { rotulo: "sem prazo", valor: resumo.semPrazo, detalhe: "aguardando data de entrega", cor: resumo.semPrazo ? COR.ouro : COR.verde, icone: "📅" },
    { rotulo: "evidências", valor: ev.total, detalhe: `${ev.aprovadas} aprovadas · ${ev.aguardando} em análise`, cor: COR.lilas, icone: "📎" },
  ];

  return (
    <div className="pc">
      <div className="pc-acoes no-print">
        <div>
          <p className="pc-acoes__eyebrow">Prestação de contas</p>
          <h1>Relatório do plano de governo</h1>
          <p>Filtre por período, secretaria, projeto ou situação. O documento abaixo se atualiza e pode ser salvo em PDF ou planilha.</p>
        </div>
        <ExportButtons csvUrl={`${API_URL}/reports/prestacao.csv${query}`} token={session?.accessToken || ""} />
      </div>

      <Suspense fallback={null}>
        <FiltrosPrestacao opcoes={opcoes} />
      </Suspense>

      <article className="pc-doc">
        <header className="pc-capa">
          <div className="pc-capa__topo">
            <BrandLogo />
            <span className="pc-selo">Relatório executivo</span>
          </div>
          <p className="pc-capa__kicker">Prestação de contas do plano de governo</p>
          <h2>{municipio}</h2>
          <div className="pc-capa__meta">
            <span>🗓 {rotuloPeriodo(filtros)}</span>
            <span>🏛 {recorte}</span>
            <span>Gerado em {dataLonga(data.geradoEm)}</span>
          </div>
        </header>

        <section className="pc-secao pc-resumo" style={{ ["--c" as string]: v.cor }}>
          <div
            className="pc-anel"
            style={{ background: `conic-gradient(${v.cor} ${(resumo.pctEmDia ?? 0) * 3.6}deg, var(--pc-trilho) 0)` }}
            role="img"
            aria-label={resumo.pctEmDia == null ? "Sem dados" : `${resumo.pctEmDia}% das entregas em dia`}
          >
            <div>
              <strong>{resumo.pctEmDia == null ? "—" : `${resumo.pctEmDia}%`}</strong>
              <span>em dia</span>
            </div>
          </div>
          <div className="pc-resumo__texto">
            <p className="pc-veredito"><i />{v.titulo}</p>
            <p>{v.texto}</p>
            <Barra
              partes={[
                { rotulo: "concluídas", valor: resumo.concluidas, cor: COR.verde },
                { rotulo: "no prazo", valor: resumo.noPrazo, cor: COR.azul },
                { rotulo: "sem prazo", valor: resumo.semPrazo, cor: COR.ouro },
                { rotulo: "atrasadas", valor: resumo.atrasadas, cor: COR.rosa },
              ]}
            />
          </div>
        </section>

        <ul className="pc-kpis">
          {kpis.map((k) => (
            <li key={k.rotulo} style={{ ["--c" as string]: k.cor }}>
              <span className="pc-kpis__icone" aria-hidden="true">{k.icone}</span>
              <strong>{k.valor}</strong>
              <span className="pc-kpis__rotulo">{k.rotulo}</span>
              <small>{k.detalhe}</small>
            </li>
          ))}
        </ul>

        <section className="pc-secao">
          <h3><span>1</span> Evolução mês a mês</h3>
          <p className="pc-nota">Tarefas com prazo em cada mês (previstas) comparadas às entregas realizadas.</p>
          <div className="pc-evolucao" role="img" aria-label="Gráfico de entregas previstas e realizadas por mês">
            {data.evolucao.map((m) => {
              const [ano, mes] = m.chave.split("-");
              return (
                <div key={m.chave} className="pc-evolucao__mes">
                  <div className="pc-evolucao__barras">
                    <span className="pc-evolucao__prev" style={{ height: `${(m.previstas / maxMes) * 100}%` }} title={`${m.previstas} previstas`}>
                      {m.previstas ? <b>{m.previstas}</b> : null}
                    </span>
                    <span className="pc-evolucao__ent" style={{ height: `${(m.entregues / maxMes) * 100}%` }} title={`${m.entregues} entregues`}>
                      {m.entregues ? <b>{m.entregues}</b> : null}
                    </span>
                  </div>
                  <span className="pc-evolucao__rot">{MES[Number(mes) - 1]}<small>{ano.slice(2)}</small></span>
                  {m.atrasadas ? <em className="pc-evolucao__atr">{m.atrasadas} atras.</em> : <em className="pc-evolucao__atr pc-evolucao__atr--ok">·</em>}
                </div>
              );
            })}
          </div>
          <ul className="pc-legenda">
            <li style={{ ["--c" as string]: "var(--pc-azul)" }}><i />Previstas no mês</li>
            <li style={{ ["--c" as string]: "var(--pc-verde)" }}><i />Entregues no mês</li>
            <li style={{ ["--c" as string]: "var(--pc-rosa)" }}><i />Ainda atrasadas</li>
          </ul>
        </section>

        <section className="pc-secao">
          <h3><span>2</span> Desempenho por secretaria</h3>
          <p className="pc-nota">Percentual de tarefas concluídas ou dentro do prazo. Da mais crítica para a mais tranquila. Clique para filtrar.</p>
          {data.porSecretaria.some((s) => s.total) ? (
            <ol className="pc-ranking">
              {data.porSecretaria.filter((s) => s.total).map((s) => {
                const cor = corPct(s.pctEmDia);
                return (
                  <li key={s.id} style={{ ["--c" as string]: cor }}>
                    <Link href={comFiltro({ secretariaId: s.id })} className="pc-ranking__nome">
                      <span className="pc-sigla">{s.sigla || s.nome.slice(0, 3).toUpperCase()}</span>
                      <span>
                        <strong>{s.nome}</strong>
                        <small>{plural(s.projetos, "projeto", "projetos")}{s.titular ? ` · ${s.titular}` : ""}</small>
                      </span>
                    </Link>
                    <span className="pc-ranking__pilha" aria-hidden="true">
                      {s.concluidas ? <span style={{ flexGrow: s.concluidas, background: COR.verde }} /> : null}
                      {s.noPrazo ? <span style={{ flexGrow: s.noPrazo, background: COR.azul }} /> : null}
                      {s.semPrazo ? <span style={{ flexGrow: s.semPrazo, background: COR.ouro }} /> : null}
                      {s.atrasadas ? <span style={{ flexGrow: s.atrasadas, background: COR.rosa }} /> : null}
                    </span>
                    <strong className="pc-ranking__pct">{s.pctEmDia ?? "—"}%</strong>
                    <span className="pc-ranking__info">
                      {s.concluidas}/{s.total} entregues
                      {s.atrasadas ? <b> · {plural(s.atrasadas, "atrasada", "atrasadas")}</b> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="pc-vazio">Nenhuma secretaria com tarefas no recorte.</p>
          )}
        </section>

        <section className="pc-secao pc-duas">
          <div>
            <h3><span>3</span> Metas estratégicas</h3>
            {data.metasEstrategicas.length ? (
              <ul className="pc-metas">
                {data.metasEstrategicas.map((m) => {
                  const cor = m.pct == null ? COR.lilas : corPct(m.pct);
                  return (
                    <li key={m.id} style={{ ["--c" as string]: cor }}>
                      <div className="pc-metas__topo">
                        <strong>{m.nome}</strong>
                        <em>{m.pct == null ? "Aguardando medição" : `${m.pct}%`}</em>
                      </div>
                      <span className="pc-metas__barra"><span style={{ width: `${m.pct ?? 0}%` }} /></span>
                      <small>
                        {m.secretaria ? `${m.secretaria} · ` : ""}
                        {m.indicador || "Indicador a definir"}: {m.realizado ?? "—"} de {m.alvo || "—"} {m.unidade || ""}
                        {m.dataCorte ? ` · medido em ${new Date(m.dataCorte).toLocaleDateString("pt-BR")}` : ""}
                      </small>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="pc-vazio">Nenhuma meta estratégica cadastrada para o recorte.</p>
            )}
          </div>
          <div className="pc-coluna">
            <div>
              <h3><span>4</span> Metas de execução</h3>
              <p className="pc-destaque"><strong>{me.concluidas}</strong> de {me.total} metas concluídas</p>
              <Barra
                partes={[
                  { rotulo: "concluídas", valor: me.concluidas, cor: COR.verde },
                  { rotulo: "em andamento", valor: me.emAndamento, cor: COR.azul },
                  { rotulo: "sem prazo", valor: me.semPrazo, cor: COR.ouro },
                  { rotulo: "vencidas", valor: me.vencidas, cor: COR.rosa },
                ]}
              />
            </div>
            <div>
              <h3><span>5</span> Evidências de execução</h3>
              <ul className="pc-evid">
                {ev.porTipo.map((t) => (
                  <li key={t.tipo}>
                    <span aria-hidden="true">{t.tipo === "FOTO" ? "📷" : t.tipo === "VIDEO" ? "🎬" : "📄"}</span>
                    <strong>{t.total}</strong>
                    <small>{t.tipo === "FOTO" ? "fotos" : t.tipo === "VIDEO" ? "vídeos" : "documentos"}</small>
                  </li>
                ))}
              </ul>
              <p className="pc-nota">{ev.aprovadas} aprovadas pela consultoria · {ev.aguardando} aguardando validação.</p>
            </div>
          </div>
        </section>

        {!!data.projetos.length && (
          <section className="pc-secao">
            <h3><span>6</span> Projetos</h3>
            <div className="pc-projetos">
              {data.projetos.slice(0, 12).map((p) => {
                const cor = corPct(p.pctEmDia);
                return (
                  <Link key={p.id} href={comFiltro({ projetoId: p.id })} className="pc-projeto" style={{ ["--c" as string]: cor }}>
                    <span className="pc-projeto__topo">
                      <small>{p.secretaria} · {p.codigo}</small>
                      <b>{p.pctEmDia ?? "—"}%</b>
                    </span>
                    <strong>{p.nome}</strong>
                    <span className="pc-projeto__barra"><span style={{ width: `${p.pctEmDia ?? 0}%` }} /></span>
                    <small>
                      {p.concluidas}/{p.total} entregues{p.atrasadas ? ` · ${p.atrasadas} atrasadas` : ""}
                    </small>
                  </Link>
                );
              })}
            </div>
            {data.projetos.length > 12 && <p className="pc-nota">+ {data.projetos.length - 12} projetos na tabela detalhada abaixo.</p>}
          </section>
        )}

        <section className="pc-secao">
          <h3><span>7</span> Tarefas detalhadas</h3>
          <p className="pc-nota">Lista completa do recorte, das atrasadas para as concluídas. Ordene clicando nos títulos das colunas.</p>
          <TabelaTarefas tarefas={data.tarefas} />
        </section>

        <section className="pc-secao">
          <h3><span>8</span> Próximos passos recomendados</h3>
          <ol className="pc-passos">
            {passos.map((p, i) => (
              <li key={i} style={{ ["--c" as string]: p.cor }}>{p.texto}</li>
            ))}
          </ol>
        </section>

        <footer className="pc-rodape">
          <BrandLogo variant="mark" />
          <span>Centro de Inteligência Pública · Da estratégia à entrega</span>
          <span>Gerado em {new Date(data.geradoEm).toLocaleString("pt-BR")} · Método {data.metodoVersao}</span>
        </footer>
      </article>
    </div>
  );
}
