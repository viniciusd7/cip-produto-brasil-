"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CLASS_GROUPS, SERIES } from "@cip/shared";
import { getNextStepForRole, getRoleLabel } from "@/lib/roles";
import type { OverviewResponse, SecretariaOverview } from "./types";
import { s } from "./ov";

const groups = CLASS_GROUPS;
const percent = (part: number, total: number) => {
  const p = Number(part) || 0;
  const t = Number(total) || 0;
  return t ? Math.min(100, Math.max(0, (p / t) * 100)) : 0;
};
const number = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function health(p: SecretariaOverview) {
  return [
    { label: "Execução", value: p.tarefasTotal ? percent(p.concluidas + p.noPrazo, p.tarefasTotal) : null },
    { label: "Controle de prazos", value: p.abertas ? 100 - percent(p.atrasadas, p.abertas) : null },
    { label: "Definição de prazo", value: p.abertas ? 100 - percent(p.semPrazo, p.abertas) : null },
    { label: "Controle da gravidade", value: p.abertas ? Math.max(0, 100 - p.indicePonderado) : null },
  ];
}

function Radar({ pasta, color }: { pasta: SecretariaOverview; color: string }) {
  const values = health(pasta);
  if (values.some((v) => v.value === null)) return <div className={s.radarEmpty}>Sem tarefas abertas para comparar as quatro dimensões.</div>;
  const points = (scale: number) => `100,${100 - scale} ${100 + scale},100 100,${100 + scale} ${100 - scale},100`;
  const poly = `100,${100 - values[0].value! * .8} ${100 + values[1].value! * .8},100 100,${100 + values[2].value! * .8} ${100 - values[3].value! * .8},100`;
  return (
    <svg viewBox="0 0 200 200" className={s.radar} role="img" aria-label={values.map((v) => `${v.label}: ${Math.round(v.value!)}%`).join("; ")}>
      <defs>
        <radialGradient id={`radarGlow-${pasta.id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="70" fill={`url(#radarGlow-${pasta.id})`} />
      {[20, 40, 60, 80].map((r) => <polygon key={r} points={points(r)} fill="none" stroke="rgba(196,196,224,.18)" />)}
      <path d="M100 20V180M20 100H180" stroke="rgba(196,196,224,.22)" />
      <polygon points={poly} fill={color} fillOpacity=".22" stroke={color} strokeWidth="2.5" style={{ filter: `drop-shadow(0 0 6px ${color}99)` }} />
      <circle cx="100" cy={100 - values[0].value! * .8} r="3.5" fill="#101218" stroke={color} strokeWidth="2" />
      <circle cx={100 + values[1].value! * .8} cy="100" r="3.5" fill="#101218" stroke={color} strokeWidth="2" />
      <circle cx="100" cy={100 + values[2].value! * .8} r="3.5" fill="#101218" stroke={color} strokeWidth="2" />
      <circle cx={100 - values[3].value! * .8} cy="100" r="3.5" fill="#101218" stroke={color} strokeWidth="2" />
      <text x="100" y="14" textAnchor="middle" className={s.radarLabel}>Exec.</text>
      <text x="186" y="104" textAnchor="start" className={s.radarLabel}>Prazos</text>
      <text x="100" y="196" textAnchor="middle" className={s.radarLabel}>Def.</text>
      <text x="14" y="104" textAnchor="end" className={s.radarLabel}>Grav.</text>
    </svg>
  );
}

function recommendation(p: SecretariaOverview) {
  if (!p.tarefasTotal && !(p.metasTotal || 0)) return "Cadastrar metas de execução e as primeiras tarefas para iniciar o acompanhamento.";
  if (p.classificacao === "DADOS_DEFASADOS") return "Validar a situação das entregas e atualizar a carteira antes da próxima reunião.";
  if ((p.metasAtrasadas || 0) > 0) return `Atualizar as ${p.metasAtrasadas} metas com prazo vencido e registrar o valor atual dos indicadores.`;
  if ((p.metasTotal || 0) > 0 && (p.metasComValor || 0) === 0) return "Registrar o valor atual das metas de execução vinculadas aos projetos.";
  if (p.criticas) return `Revisar as ${p.criticas} tarefas críticas e pactuar as providências com os responsáveis.`;
  if (p.semPrazo) return `Definir datas para as ${p.semPrazo} tarefas sem prazo e revisar os encaminhamentos.`;
  if (p.atrasadas) return `Solicitar causa, providência e responsável para as ${p.atrasadas} tarefas atrasadas.`;
  return "Manter o acompanhamento e reunir evidências das entregas registradas.";
}

export function GovernoOverview({ payload, municipio, role }: { payload: OverviewResponse; municipio: string; role?: string }) {
  const { governo, porSecretaria, agenda, projetosEstruturantes, pendencias, tarefasPedemAcao, metas } = payload.data;
  const metasResumo = metas || { total: 0, comIndicador: 0, comValor: 0, cobertura: 0, atrasadas: 0, semPrazo: 0, concluidas: 0, pedemAcao: [] as NonNullable<OverviewResponse["data"]["metas"]>["pedemAcao"] };
  const [tab, setTab] = useState("compare");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("priority");
  const [focusId, setFocusId] = useState("");
  const [lines, setLines] = useState({ atraso: true, semAtraso: false, atencao: true });
  const pastas = porSecretaria.filter((p) => p.projetos > 0);
  const focus = pastas.find((p) => p.id === focusId) || [...pastas].sort((a, b) => b.projetos - a.projetos)[0];
  const dataRef = payload.meta?.dataReferencia;
  const shortDate = dataRef ? new Date(dataRef).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "Data não informada";
  const longDate = dataRef ? new Date(dataRef).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }) : "Data-base não informada";
  const nextStep = getNextStepForRole(role);
  const chart = pastas.map((p) => ({
    id: p.id, nome: p.nome, sigla: p.sigla || p.nome,
    atraso: percent(p.projetosComAtraso, p.projetos),
    semAtraso: percent(p.projetos - p.projetosComAtraso, p.projetos),
    atencao: percent(p.projetosAtencaoExecutiva, p.projetos),
  }));
  const visible = useMemo(() => {
    const priority = ["INTERVENCAO", "DADOS_DEFASADOS", "ACOMPANHAMENTO", "ROTINA"];
    return porSecretaria.filter((p) => p.projetos > 0)
      .filter((p) => !filter || (filter === "SEM_PRAZO" ? p.semPrazo > 0 : p.classificacao === filter))
      .filter((p) => normalize(`${p.nome} ${p.sigla || ""} ${p.titular?.nome || ""}`).includes(normalize(query)))
      .sort((a, b) => sort === "name" ? a.nome.localeCompare(b.nome, "pt-BR") : sort === "delay" ? b.pctAtraso - a.pctAtraso : priority.indexOf(a.classificacao) - priority.indexOf(b.classificacao) || b.pctAtraso - a.pctAtraso);
  }, [porSecretaria, filter, query, sort]);

  const intervencao = pastas.filter((p) => p.classificacao === "INTERVENCAO");
  const entraves = agenda.entraves || [];
  const gravidade = agenda.gravidadeBuckets || {};
  const gravidadeTotal = Object.values(gravidade).reduce((a, b) => a + (Number(b) || 0), 0);
  const maxEntrave = Math.max(1, ...entraves.map((e) => e.qtd));

  function chooseGroup(key: string) {
    setFilter((prev) => (prev === key ? "" : key));
    document.getElementById("secretarias")?.scrollIntoView({ block: "start" });
  }

  return (
    <div className={s.board}>
      <header className={s.header}>
        <div>
          <span className={s.eyebrow}>Centro de Inteligência Pública</span>
          <p className={s.toplineTitle}>Governo em perspectiva</p>
          <p>{municipio}</p>
        </div>
        <div className={s.headerActions}>
          <span className={s.date}>◷ {longDate}</span>
          <Link href={nextStep.href} className={s.button}>{nextStep.label} <span aria-hidden="true">↗</span></Link>
        </div>
      </header>

      {/* ——— #visao ——— */}
      <section id="visao" className={s.chapter}>
        <div className={s.heroGrid}>
          <div className={`${s.panel} ${s.summary}`}>
            <p className={s.kicker}>Cenário do governo / carteira de projetos</p>
            <h1 className={s.heroTitle}>Da estratégia<br />à entrega.<span aria-hidden="true">↗</span></h1>
            <div className={s.total}><strong>{governo.totalProjetos}</strong><span>projetos<br />acompanhados</span></div>
            <div className={s.attention}>
              <div>
                <span className={s.signal}>{governo.projetosComAtraso ? "Carteira em atenção" : governo.totalProjetos ? "Carteira em acompanhamento" : "Aguardando cadastros"}</span>
                <strong>{governo.totalProjetos ? `${number(governo.pctCarteiraComAtraso)}%` : "—"}</strong>
              </div>
              <p>dos projetos têm algum atraso registrado.</p>
              <div className={s.ratio} aria-label={`${governo.projetosComAtraso} com atraso e ${governo.semAtrasoRegistrado} sem atraso`}>
                <span style={{ width: `${governo.pctCarteiraComAtraso}%` }} />
              </div>
              <div className={s.ratioLegend}>
                <span><i className={s.pinkDot} />{governo.projetosComAtraso} com atraso</span>
                <span><i className={s.purpleDot} />{governo.semAtrasoRegistrado} sem atraso registrado</span>
              </div>
            </div>
            <a href="#projetos" className={s.focusCount}>
              <strong>{governo.atencaoExecutiva}</strong>
              <span>projetos na pauta<br />de atenção executiva</span>
              <b aria-hidden="true">↗</b>
            </a>
            <footer>{pastas.length} secretarias com projetos<span>Posição em {shortDate}</span></footer>
          </div>

          <div className={`${s.panel} ${s.landscape}`}>
            <div className={s.panelHead}>
              <div>
                <p className={s.kicker}>Inteligência de execução</p>
                <h2>O governo, projeto a projeto.</h2>
              </div>
              <Link href="/relatorios" className={s.iconLink} aria-label="Abrir prestação">↓ PDF</Link>
            </div>
            <div className={s.chartToolbar}>
              <div className={s.tabs} role="tablist" aria-label="Visualização do panorama">
                <button id="overview-compare-tab" role="tab" aria-selected={tab === "compare"} aria-controls="overview-chart" tabIndex={tab === "compare" ? 0 : -1} onClick={() => setTab("compare")}>Comparar pastas</button>
                <button id="overview-history-tab" role="tab" aria-selected={tab === "history"} aria-controls="overview-history" tabIndex={tab === "history" ? 0 : -1} onClick={() => setTab("history")}>Linha do tempo</button>
              </div>
              <span className={s.measurement}><i />Posição atual</span>
            </div>
            {tab === "compare" ? (
              <div id="overview-chart" role="tabpanel" aria-labelledby="overview-compare-tab">
                <p className={s.chartCaption}>Percentual da carteira de cada secretaria · comparação na mesma data</p>
                {chart.length ? (
                  <div className={s.chart}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <AreaChart data={chart} margin={{ top: 20, right: 18, bottom: 8, left: -16 }} onClick={(event) => { const index = event.activeTooltipIndex; if (index != null && chart[Number(index)]) setFocusId(chart[Number(index)].id); }}>
                        <defs>
                          <linearGradient id="gAtraso" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SERIES.atraso} stopOpacity={0.35} /><stop offset="100%" stopColor={SERIES.atraso} stopOpacity={0} /></linearGradient>
                          <linearGradient id="gAtencao" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SERIES.atencao} stopOpacity={0.28} /><stop offset="100%" stopColor={SERIES.atencao} stopOpacity={0} /></linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(192,193,220,.1)" strokeDasharray="3 6" vertical={false} />
                        <XAxis dataKey="sigla" tick={{ fill: "#c5cbe0", fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#9aa3bf", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <ReferenceLine y={governo.pctCarteiraComAtraso} stroke="#8b93b0" strokeDasharray="4 6" label={{ value: "gov.", fill: "#8b93b0", fontSize: 10, position: "insideTopRight" }} />
                        <Tooltip contentStyle={{ background: "#1a1d2b", border: "1px solid rgba(124,156,255,.35)", borderRadius: 12, color: "#f1f3fc", fontSize: 12 }} labelFormatter={(_, items) => items?.[0]?.payload?.nome || ""} formatter={(value, name) => [`${number(Number(value))}%`, name]} />
                        {lines.atraso && <Area name="Com atraso" dataKey="atraso" type="monotone" stroke={SERIES.atraso} fill="url(#gAtraso)" strokeWidth={3} dot={{ r: 4, fill: "#101218", stroke: SERIES.atraso, strokeWidth: 2 }} activeDot={{ r: 7, strokeWidth: 0, fill: SERIES.atraso }} isAnimationActive={false} style={{ filter: `drop-shadow(0 0 8px ${SERIES.atraso}aa)` }} />}
                        {lines.atencao && <Area name="Atenção executiva" dataKey="atencao" type="monotone" stroke={SERIES.atencao} fill="url(#gAtencao)" strokeWidth={3} dot={{ r: 4, fill: "#101218", stroke: SERIES.atencao, strokeWidth: 2 }} activeDot={{ r: 7, strokeWidth: 0, fill: SERIES.atencao }} isAnimationActive={false} style={{ filter: `drop-shadow(0 0 8px ${SERIES.atencao}aa)` }} />}
                        {lines.semAtraso && <Line name="Sem atraso registrado" dataKey="semAtraso" type="monotone" stroke={SERIES.semAtraso} strokeWidth={2.5} dot={{ r: 3.5, fill: "#101218", stroke: SERIES.semAtraso, strokeWidth: 2 }} isAnimationActive={false} />}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : <div className={s.empty}>Cadastre projetos e vincule suas secretarias para visualizar a carteira.</div>}
                <div className={s.legend}>
                  {([{ key: "atraso", label: "Com atraso", color: SERIES.atraso }, { key: "semAtraso", label: "Sem atraso registrado", color: SERIES.semAtraso }, { key: "atencao", label: "Atenção executiva", color: SERIES.atencao }] as const).map((line) => (
                    <button key={line.key} type="button" className={lines[line.key] ? s.legendOn : s.legendOff} style={{ ["--series" as string]: line.color }} onClick={() => setLines((v) => ({ ...v, [line.key]: !v[line.key] }))}>
                      <i /><span>{line.label}</span>
                    </button>
                  ))}
                </div>
                {focus && (
                  <div className={s.pastaFocus}>
                    <div>
                      <label htmlFor="pasta-foco">Pasta em foco</label>
                      <select id="pasta-foco" value={focus.id} onChange={(e) => setFocusId(e.target.value)}>{pastas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
                      <small>{focus.projetos} projetos · {number(percent(focus.projetosComAtraso, focus.projetos))}% com atraso</small>
                    </div>
                    <div className={s.focusMetric}><strong>{focus.projetosComAtraso}</strong><small>com atraso</small></div>
                    <div className={s.focusMetric}><strong>{focus.projetosAtencaoExecutiva}</strong><small>em atenção</small></div>
                    <Link className={s.button} href={`/secretarias/${focus.id}`}>Abrir pasta ↗</Link>
                  </div>
                )}
                <p className={s.chartFoot}>As curvas comparam secretarias, não períodos. <a href="#metodo">Critérios de leitura ↗</a></p>
              </div>
            ) : (
              <div id="overview-history" role="tabpanel" aria-labelledby="overview-history-tab" className={s.history}>
                <p className={s.chartCaption}>Trajetória da carteira do governo · uma medição consolidada disponível</p>
                <div className={s.timelineChart}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart
                      data={[
                        { label: "Anterior", atraso: null as number | null, atencao: null as number | null },
                        { label: shortDate, atraso: governo.pctCarteiraComAtraso, atencao: percent(governo.atencaoExecutiva, Math.max(1, governo.totalProjetos)) },
                        { label: "Próxima", atraso: null, atencao: null },
                      ]}
                      margin={{ top: 28, right: 28, bottom: 8, left: 0 }}
                    >
                      <defs>
                        <linearGradient id="gTimeAtraso" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SERIES.atraso} stopOpacity={0.45} /><stop offset="100%" stopColor={SERIES.atraso} stopOpacity={0} /></linearGradient>
                        <linearGradient id="gTimeAtencao" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SERIES.atencao} stopOpacity={0.4} /><stop offset="100%" stopColor={SERIES.atencao} stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(192,193,220,.1)" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "#c5cbe0", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#9aa3bf", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <ReferenceLine x={shortDate} stroke="rgba(124,156,255,.35)" strokeDasharray="4 6" />
                      <Tooltip contentStyle={{ background: "#1a1d2b", border: `1px solid ${SERIES.atencao}55`, borderRadius: 12, color: "#f1f3fc" }} formatter={(value, name) => value == null ? ["—", name] : [`${number(Number(value))}%`, name]} />
                      <Area name="% com atraso" dataKey="atraso" type="monotone" connectNulls={false} stroke={SERIES.atraso} fill="url(#gTimeAtraso)" strokeWidth={3.5} dot={(props) => {
                        const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: { atraso: number | null } };
                        if (cx == null || cy == null || payload?.atraso == null) return <g />;
                        return <g><circle cx={cx} cy={cy} r={12} fill={`${SERIES.atraso}33`} /><circle cx={cx} cy={cy} r={7} fill={SERIES.atraso} stroke="#101218" strokeWidth={3} /></g>;
                      }} activeDot={false} isAnimationActive={false} />
                      <Area name="% atenção executiva" dataKey="atencao" type="monotone" connectNulls={false} stroke={SERIES.atencao} fill="url(#gTimeAtencao)" strokeWidth={3.5} dot={(props) => {
                        const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: { atencao: number | null } };
                        if (cx == null || cy == null || payload?.atencao == null) return <g />;
                        return <g><circle cx={cx} cy={cy} r={12} fill={`${SERIES.atencao}33`} /><circle cx={cx} cy={cy} r={7} fill={SERIES.atencao} stroke="#101218" strokeWidth={3} /></g>;
                      }} activeDot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className={s.timelineMeta}>
                  <div className={s.timelineMarker}><i style={{ background: SERIES.atraso, ["--mark" as string]: SERIES.atraso }} /><div><strong>{shortDate}</strong><span>Único marco real · {governo.projetosComAtraso} de {governo.totalProjetos} com atraso ({number(governo.pctCarteiraComAtraso)}%)</span></div></div>
                  <div className={s.timelineMarker}><i style={{ background: SERIES.atencao, ["--mark" as string]: SERIES.atencao }} /><div><strong>Atenção executiva</strong><span>{governo.atencaoExecutiva} projetos na pauta da alta gestão</span></div></div>
                  <div className={`${s.timelineMarker} ${s.timelineMuted}`}><i /><div><strong>Próxima medição</strong><span>Sem interpolação — aguarda nova posição consolidada</span></div></div>
                </div>
                <p className={s.chartFoot}>A aba Linha do tempo não inventa histórico. <a href="#metodo">Critérios de leitura ↗</a></p>
              </div>
            )}
          </div>
        </div>

        <p className={s.readingNote}>Um projeto entra em “com atraso” quando tem ao menos uma tarefa atrasada. Atenção executiva é um subconjunto desses projetos.</p>

        <div className={s.signals}>
          {groups.map((g) => (
            <button key={g.key} type="button" aria-pressed={filter === g.key} onClick={() => chooseGroup(g.key)} className={s.signalCard} style={{ ["--cat" as string]: g.color }}>
              <span>{g.label}</span>
              <strong>{pastas.filter((p) => p.classificacao === g.key).length}</strong>
              <small>secretarias · {g.hint.toLowerCase()} <b aria-hidden="true">↗</b></small>
            </button>
          ))}
        </div>

        <div className={s.alertCard} aria-label="Na agenda da alta gestão">
          <h2>Na agenda da alta gestão</h2>
          <div className={s.alertGrid}>
            <div className={s.agendaItem} style={{ ["--accent" as string]: SERIES.atraso }}>
              <strong>{governo.atrasadas}</strong>
              <span>tarefas atrasadas<br /><small>Revisar causas e encaminhamentos</small></span>
            </div>
            <div className={s.agendaItem} style={{ ["--accent" as string]: SERIES.atencao }}>
              <strong>{agenda.estruturantesAtrasados}</strong>
              <span>tarefas de estruturantes atrasadas<br /><small>Coordenar as prioridades da gestão</small></span>
            </div>
            <div className={s.agendaItem} style={{ ["--accent" as string]: "#eac78c" }}>
              <strong>{governo.semPrazo}</strong>
              <span>tarefas sem prazo<br /><small>Pactuar datas com os responsáveis</small></span>
            </div>
          </div>
          {!!entraves.length && (
            <p className={s.alertFoot}>
              Principais entraves: {entraves.slice(0, 3).map((e) => `${e.tipo} (${e.qtd})`).join(" · ")}. <a href="#decisoes">Abrir agenda ↗</a>
            </p>
          )}
        </div>

        <div className={s.metasStrip} aria-label="Metas de execução">
          <div>
            <p className={s.kicker}>Metas de execução · base do projeto</p>
            <h2>Indicadores das metas cadastradas</h2>
          </div>
          <div className={s.metasGrid}>
            <div><strong>{metasResumo.total}</strong><span>metas</span></div>
            <div><strong>{metasResumo.comValor}</strong><span>com valor atual</span></div>
            <div><strong>{metasResumo.cobertura}%</strong><span>cobertura de atualização</span></div>
            <div><strong>{metasResumo.atrasadas}</strong><span>metas com prazo vencido</span></div>
            <div><strong>{metasResumo.semPrazo}</strong><span>metas sem prazo</span></div>
            <div><strong>{metasResumo.concluidas}</strong><span>metas concluídas</span></div>
          </div>
        </div>
      </section>

      {/* ——— #secretarias ——— */}
      <section id="secretarias" className={s.healthSection}>
        <div className={s.sectionHead}>
          <div>
            <p className={s.kicker}>Do cenário global à cobrança pontual</p>
            <h2>A saúde de cada secretaria</h2>
            <p>Identifique o sinal, entenda a causa e abra a pauta de acompanhamento.</p>
          </div>
          <Link href="/secretarias" className={s.button}>Todas as pastas ↗</Link>
        </div>
        <div className={s.filters}>
          <div>
            <label htmlFor="overview-search">Buscar secretaria ou responsável</label>
            <input id="overview-search" type="search" placeholder="Buscar na carteira…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div>
            <label htmlFor="overview-filter">Situação</label>
            <select id="overview-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">Todas as situações</option>
              {groups.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              <option value="SEM_PRAZO">Com tarefas sem prazo</option>
            </select>
          </div>
          <div>
            <label htmlFor="overview-sort">Ordenar por</label>
            <select id="overview-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="priority">Prioridade de acompanhamento</option>
              <option value="name">Ordem alfabética</option>
              <option value="delay">Maior percentual de atraso</option>
            </select>
          </div>
        </div>
        <div className={s.resultMeta}>
          <span aria-live="polite">{visible.length} de {pastas.length} secretarias com projetos</span>
          <span>Quanto mais próximo da borda, melhor a dimensão. <a href="#metodo">Como ler ↗</a></span>
        </div>
        <div className={s.healthGrid}>
          {visible.map((p) => {
            const g = groups.find((group) => group.key === p.classificacao) || groups[2];
            const dimensions = health(p);
            return (
              <article key={p.id} className={`${s.panel} ${s.healthCard}`} style={{ ["--health" as string]: p.tarefasTotal ? g.color : "#929bb4" }}>
                <div className={s.healthTop}>
                  <span className={s.healthPill}><i />{p.tarefasTotal ? g.label : "Sem tarefas cadastradas"}</span>
                  <small>{p.tarefasTotal} tarefas</small>
                </div>
                <h3>{p.nome}</h3>
                <p className={s.owner}>{p.titular?.nome || "Responsável não cadastrado"}</p>
                <div className={s.healthViz}>
                  <Radar pasta={p} color={g.color} />
                  <div className={s.healthMeasures}>
                    {dimensions.map((d) => (
                      <div key={d.label}>
                        <div className={s.measureRow}><span>{d.label}</span><strong>{d.value == null ? "—" : `${Math.round(d.value)}%`}</strong></div>
                        <div className={s.measureBar}><em style={{ width: `${d.value ?? 0}%`, background: g.color }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className={s.healthMessage}>
                  {p.classificacao === "DADOS_DEFASADOS"
                    ? `${p.diasSemAtualizacao} dias sem atualizar na data-base. Validar a informação.`
                    : p.abertas
                      ? `${number(p.pctAtraso)}% das tarefas abertas estão atrasadas.`
                      : p.tarefasTotal
                        ? "Sem tarefas abertas nesta base."
                        : "Aguardando o registro das primeiras entregas."}
                </p>
                <div className={s.healthCounts}>
                  <span><b>{p.atrasadas}</b> tarefas atr.</span>
                  <span><b>{p.semPrazo}</b> sem prazo</span>
                  <span><b>{p.criticas}</b> críticas</span>
                  <span><b>{p.metasTotal || 0}</b> metas</span>
                  <span><b>{p.metasAtrasadas || 0}</b> metas atr.</span>
                </div>
                <div className={s.recommendation}><small>Próxima cobrança sugerida</small><p>{recommendation(p)}</p></div>
                <footer>
                  <small>{p.diasSemAtualizacao == null ? "Sem atualização registrada" : p.diasSemAtualizacao <= 0 ? "Atualizada no dia da base" : `${p.diasSemAtualizacao} dias sem atualizar na base`}</small>
                  <Link href={`/secretarias/${p.id}`} className={s.button}>Abrir pauta ↗</Link>
                </footer>
              </article>
            );
          })}
        </div>
        {!visible.length && (
          <div className={s.empty}>
            {pastas.length
              ? <>Nenhuma secretaria corresponde aos filtros. <button type="button" onClick={() => { setQuery(""); setFilter(""); }}>Limpar filtros</button></>
              : <>As secretarias aparecerão aqui quando receberem seus primeiros projetos. <Link href="/carteira">Abrir carteira</Link></>}
          </div>
        )}
      </section>

      {/* ——— #decisoes ——— */}
      <section id="decisoes" className={s.chapter}>
        <div className={s.sectionHead}>
          <div>
            <p className={s.kicker}>Agenda de gestão / propostas para validação</p>
            <h2>Onde intervir. Quem cobrar. O que pedir.</h2>
          </div>
          <Link href="/pendencias" className={s.button}>Agenda completa ↗</Link>
        </div>
        <div className={s.decisionGrid}>
          <article className={`${s.panel} ${s.decisionCard}`} style={{ ["--accent" as string]: SERIES.atraso }}>
            <span className={s.healthPill} style={{ ["--health" as string]: SERIES.atraso }}><i />Tarefas e entraves</span>
            <h3>Destravar o que está parado</h3>
            <strong className={s.decisionNumber}>{governo.atrasadas}</strong>
            <p>
              {governo.atrasadas} tarefas atrasadas
              {entraves.length ? ` · ${entraves.reduce((a, e) => a + e.qtd, 0)} entraves abertos (${entraves.slice(0, 2).map((e) => `${e.tipo}: ${e.qtd}`).join(", ")})` : ""}.
            </p>
            <div className={s.recommendation}>
              <small>Pedido sugerido</small>
              <p>Mapear causa, responsável e prazo de desbloqueio nas tarefas vencidas.</p>
            </div>
            <Link href="/pendencias" className={s.button}>Abrir cobrança ↗</Link>
          </article>
          <article className={`${s.panel} ${s.decisionCard}`} style={{ ["--accent" as string]: "#ff779a" }}>
            <span className={s.healthPill} style={{ ["--health" as string]: "#ff779a" }}><i />Plano de recuperação</span>
            <h3>Pastas em intervenção</h3>
            <strong className={s.decisionNumber}>{intervencao.length}</strong>
            <p>{intervencao.length ? intervencao.map((p) => p.nome).join(", ") : "Nenhuma pasta em intervenção nesta base."}</p>
            <div className={s.recommendation}>
              <small>Pedido sugerido</small>
              <p>Cobrar plano de recuperação com datas e responsáveis.</p>
            </div>
            <button type="button" className={s.button} onClick={() => chooseGroup("INTERVENCAO")}>Filtrar pastas ↗</button>
          </article>
          <article className={`${s.panel} ${s.decisionCard}`} style={{ ["--accent" as string]: "#b9a0ff" }}>
            <span className={s.healthPill} style={{ ["--health" as string]: "#b9a0ff" }}><i />Metas e informação</span>
            <h3>Metas vencidas e pastas defasadas</h3>
            <strong className={s.decisionNumber}>{metasResumo.atrasadas}</strong>
            <p>
              {metasResumo.atrasadas} metas com prazo vencido · {agenda.pastasDesatualizadas?.length || 0} pastas defasadas
              {(agenda.pastasDesatualizadas || []).length ? ` (${(agenda.pastasDesatualizadas || []).slice(0, 2).map((p) => p.nome).join(", ")})` : ""}.
            </p>
            <div className={s.recommendation}>
              <small>Pedido sugerido</small>
              <p>Atualizar valor atual das metas e a carteira antes da próxima reunião.</p>
            </div>
            <a href="#prestacao" className={s.button}>Ver prestação ↗</a>
          </article>
        </div>
        <div className={`${s.panel} ${s.actionList}`}>
          <p className={s.kicker}>Itens que pedem ação</p>
          <div className={s.pendingList}>
            {(tarefasPedemAcao?.atrasadas || []).slice(0, 4).map((t) => (
              <Link key={`atr-${t.id}`} href={`/iniciativas/${t.iniciativaId}`}>
                <span><strong>{t.descricao}</strong><small>Tarefa atrasada · {t.secretaria} · {t.iniciativaNome}</small></span>
                <b aria-hidden="true">↗</b>
              </Link>
            ))}
            {(tarefasPedemAcao?.vencemEm15d || []).slice(0, 3).map((t) => (
              <Link key={`v15-${t.id}`} href={`/iniciativas/${t.iniciativaId}`}>
                <span><strong>{t.descricao}</strong><small>Vence em até 15 dias · {t.secretaria}</small></span>
                <b aria-hidden="true">↗</b>
              </Link>
            ))}
            {(tarefasPedemAcao?.semPrazo || []).slice(0, 3).map((t) => (
              <Link key={`sp-${t.id}`} href={`/iniciativas/${t.iniciativaId}`}>
                <span><strong>{t.descricao}</strong><small>Sem prazo · {t.secretaria}</small></span>
                <b aria-hidden="true">↗</b>
              </Link>
            ))}
            {metasResumo.pedemAcao.slice(0, 3).map((m) => (
              <Link key={`meta-${m.id}`} href={`/iniciativas/${m.iniciativaId}`}>
                <span><strong>{m.nome}</strong><small>Meta vencida · {m.secretaria} · atual: {m.valorAtual || "—"} / alvo: {m.alvo || "—"}</small></span>
                <b aria-hidden="true">↗</b>
              </Link>
            ))}
            {!tarefasPedemAcao?.atrasadas?.length && !tarefasPedemAcao?.vencemEm15d?.length && !tarefasPedemAcao?.semPrazo?.length && !metasResumo.pedemAcao.length && (
              <p>Nenhum item pedindo ação nesta base.</p>
            )}
          </div>
        </div>
      </section>

      {/* ——— #prestacao ——— */}
      <section id="prestacao" className={s.chapter}>
        <div className={s.sectionHead}>
          <div>
            <p className={s.kicker}>Evidências para a comunicação pública</p>
            <h2>O que já pode sustentar uma prestação de contas</h2>
          </div>
          <Link href="/relatorios" className={s.button}>Relatórios ↗</Link>
        </div>
        <div className={s.accountGrid}>
          <article className={s.panel}>
            <span className={s.healthPill} style={{ ["--health" as string]: SERIES.semAtraso }}><i />Entregas</span>
            <h3>Concluídas na base</h3>
            <strong className={s.decisionNumber}>{governo.concluidas}</strong>
            <p>Tarefas concluídas · {metasResumo.concluidas} metas concluídas · {metasResumo.cobertura}% das metas com valor atual.</p>
            <div className={s.recommendation}><small>Antes de divulgar</small><p>Validar evidências e o valor atual das metas nas pastas com maior volume de conclusão.</p></div>
          </article>
          <article className={s.panel}>
            <span className={s.healthPill} style={{ ["--health" as string]: SERIES.atraso }}><i />Pendências</span>
            <h3>O que ainda trava a narrativa</h3>
            <strong className={s.decisionNumber}>{governo.atrasadas}</strong>
            <p>{governo.atrasadas} atrasos · {governo.semPrazo} sem prazo. <a href="#decisoes">Ver agenda ↗</a></p>
            <ul className={s.bulletList}>
              {pendencias.slice(0, 3).map((p) => <li key={`${p.tipo}-${p.id}`}>{p.titulo}</li>)}
              {!pendencias.length && <li>Nenhuma pendência listada nesta base.</li>}
            </ul>
          </article>
          <article className={s.panel}>
            <span className={s.healthPill} style={{ ["--health" as string]: SERIES.atencao }}><i />Histórico</span>
            <h3>Retrato sem tendência</h3>
            <div className={s.historyTrack}>
              <div className={s.timelineMarker}><i style={{ background: SERIES.atencao, ["--mark" as string]: SERIES.atencao }} /><div><strong>{shortDate}</strong><span>Medição consolidada disponível</span></div></div>
              <div className={`${s.timelineMarker} ${s.timelineMuted}`}><i /><div><strong>Próxima quinzena</strong><span>Aguarda nova posição</span></div></div>
            </div>
            <p className={s.chartCaption}>Sem série histórica — a leitura é um retrato, não uma tendência.</p>
          </article>
        </div>
      </section>

      {/* ——— #projetos ——— */}
      <section id="projetos" className={s.chapter}>
        <div className={s.sectionHead}>
          <div>
            <p className={s.kicker}>Pontos de atenção</p>
            <h2>Projetos que pedem coordenação</h2>
          </div>
          <Link href="/carteira" className={s.button}>Carteira ↗</Link>
        </div>
        <div className={s.projectGrid}>
          {projetosEstruturantes.slice(0, 6).map((p) => (
            <article key={p.id} className={s.panel}>
              <p className={s.kicker}>{p.secretaria}</p>
              <h3>{p.nome}</h3>
              <span className={s.structBadge}>Estruturante</span>
              <div className={s.healthCounts}>
                <span><b>{p.atrasadas}</b> atrasadas</span>
                <span><b>{p.pendencias}</b> pendências</span>
                <span><b>{p.marcos}</b> tarefas</span>
              </div>
              <Link href={`/iniciativas/${p.id}`} className={s.button}>Ver projeto ↗</Link>
            </article>
          ))}
          {!projetosEstruturantes.length && <div className={s.empty}>Nenhum projeto estruturante cadastrado.</div>}
        </div>
        <div className={s.analyticsGrid}>
          <div className={s.panel}>
            <p className={s.kicker}>O que está travando</p>
            <h3>Entraves abertos</h3>
            <div className={s.barList}>
              {entraves.length ? entraves.map((e) => (
                <div key={e.tipo} className={s.barRow}>
                  <div className={s.measureRow}><span>{e.tipo}</span><strong>{e.qtd}</strong></div>
                  <div className={s.measureBar}><em style={{ width: `${(e.qtd / maxEntrave) * 100}%`, background: SERIES.atraso }} /></div>
                </div>
              )) : <p className={s.chartCaption}>Nenhum entrave aberto nesta base.</p>}
            </div>
          </div>
          <div className={s.panel}>
            <p className={s.kicker}>Gravidade dos atrasos</p>
            <h3>{gravidadeTotal} tarefas atrasadas</h3>
            <div className={s.barList}>
              {(["CRITICA", "GRAVE", "MODERADA", "LEVE"] as const).map((k) => {
                const qtd = Number(gravidade[k]) || 0;
                const color = k === "CRITICA" || k === "GRAVE" ? SERIES.atraso : "#eac78c";
                return (
                  <div key={k} className={s.barRow}>
                    <div className={s.measureRow}><span>{k.charAt(0) + k.slice(1).toLowerCase()}</span><strong>{qtd}</strong></div>
                    <div className={s.measureBar}><em style={{ width: `${gravidadeTotal ? (qtd / gravidadeTotal) * 100 : 0}%`, background: color }} /></div>
                  </div>
                );
              })}
            </div>
            <Link href="/carteira" className={s.textLink}>Consultar agenda de estruturantes ↗</Link>
          </div>
        </div>
      </section>

      {/* ——— #metodo ——— */}
      <section id="metodo" className={s.criteria}>
        <p className={s.kicker}>Transparência da leitura</p>
        <h2>Critérios que sustentam a decisão</h2>
        <details open>
          <summary>Como ler o panorama de projetos</summary>
          <p>O panorama compara projetos com pelo menos uma tarefa vencida com o total de projetos da secretaria. Atenção executiva considera projetos estruturantes com atraso ou projetos com tarefas graves ou críticas. As linhas representam secretarias, não evolução temporal.</p>
        </details>
        <details>
          <summary>Classificação de saúde das secretarias</summary>
          <p>Dados defasados: mais de 30 dias sem atualização na data-base. Intervenção: ao menos 50% de atraso nas tarefas abertas ou índice ponderado de 35%. Acompanhamento: ao menos 35% de atraso ou 25% sem prazo. Rotina: demais situações. As faixas orientam o acompanhamento e não medem a qualidade dos serviços.</p>
        </details>
        <details>
          <summary>Regras e denominadores dos radares</summary>
          <p>Execução = (concluídas + no prazo) / total; controle de prazos = 1 − atrasadas / abertas; definição de prazo = 1 − sem prazo / abertas; controle da gravidade = 1 − índice ponderado. Sem denominador, a dimensão aparece como “—”.</p>
          <p>Os prazos usam a data de referência de cada projeto. Gravidade registrada tem precedência; quando ausente, aplica-se o método {governo.metodoVersao}. Índice ponderado: crítica × 1; grave × 0,75; moderada × 0,5; leve × 0,25, dividido pelas tarefas abertas.</p>
        </details>
        <details>
          <summary>Fonte e posição da base</summary>
          <p>{payload.meta?.fonte || "Base operacional CIP"} · posição em {shortDate}. Dados do município {municipio}. Atualizações de projetos podem ter datas de referência diferentes. A aba de linha do tempo informa quando ainda não há série consolidada.</p>
        </details>
      </section>

      <footer className={s.boardFooter}>
        <span>CIP · Centro de Inteligência Pública</span>
        <span>{municipio} · {getRoleLabel(role)}</span>
      </footer>
    </div>
  );
}
