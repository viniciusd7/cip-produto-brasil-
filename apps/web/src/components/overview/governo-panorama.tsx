"use client";

import Link from "next/link";
import { useState } from "react";
import { hasSecretariaStatus, secretariaStatus, secretariaStatuses, share } from "./overview-model";
import type { OverviewResponse } from "./types";

type Props = { data: OverviewResponse["data"]; dataReferencia?: string; onOpenSecretarias: (filter: string) => void };
type Mode = "quadro" | "comparar" | "historico";

export function GovernoPanorama({ data, dataReferencia, onOpenSecretarias }: Props) {
  const { governo, porSecretaria } = data;
  const [mode, setMode] = useState<Mode>("quadro");
  const [filter, setFilter] = useState("");
  const [measure, setMeasure] = useState("atraso");
  function chooseFilter(next: string) {
    setFilter(next);
    if (mode === "historico") setMode("quadro");
  }
  const onTime = governo.noPrazo ?? Math.max(0, governo.abertas - governo.atrasadas - governo.semPrazo);
  const health = governo.totalTarefas ? Math.round(share(governo.concluidas + onTime, governo.totalTarefas)) : null;
  const tone = health == null ? "muted" : health >= 80 ? "green" : health >= 60 ? "amber" : "rose";
  const priority = ["INTERVENCAO", "DADOS_DEFASADOS", "ACOMPANHAMENTO", "ROTINA"];
  const sorted = [...porSecretaria].sort((a,b) => Number(!a.tarefasTotal)-Number(!b.tarefasTotal) || priority.indexOf(a.classificacao)-priority.indexOf(b.classificacao) || b.pctAtraso-a.pctAtraso || a.nome.localeCompare(b.nome,"pt-BR"));
  const visible = sorted.filter((p) => hasSecretariaStatus(p,filter));
  const reference = dataReferencia ? new Date(dataReferencia) : null;
  const dateLabel = reference && !Number.isNaN(reference.getTime()) ? reference.toLocaleDateString("pt-BR",{timeZone:"UTC"}) : "Data não informada";

  return <section className="gov-panel gov-panorama" aria-labelledby="gov-panorama-title">
    <div className="gov-section-head">
      <div><h2 id="gov-panorama-title">Panorama de todas as secretarias</h2><p>Veja a situação de cada pasta e onde concentrar o acompanhamento.</p></div>
      <div className="gov-view-switch" role="group" aria-label="Visualização do panorama">{([{id:"quadro",label:"Quadro geral"},{id:"comparar",label:"Comparar"},{id:"historico",label:"Linha do tempo"}] as const).map((item) => <button key={item.id} type="button" aria-pressed={mode===item.id} onClick={() => { setMode(item.id); if (item.id === "historico") setFilter(""); }}>{item.label}</button>)}</div>
    </div>
    <div className="gov-panorama__layout">
      <aside className="gov-government-health" aria-label="Situação geral das tarefas">
        <h3>Ritmo do governo</h3>
        <svg viewBox="0 0 200 126" className={`gov-gauge gov-tone-${tone}`} role="img" aria-label={health==null ? "Sem tarefas cadastradas" : `${health}% das tarefas concluídas ou dentro do prazo`}>
          <path d="M20 100A80 80 0 0 1 180 100" fill="none" stroke="#aab6cc26" strokeWidth="13" strokeLinecap="round" />
          <path d="M20 100A80 80 0 0 1 180 100" fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeDasharray={`${(health??0)/100*Math.PI*80} ${Math.PI*80}`} />
          <text x="100" y="88" textAnchor="middle">{health==null ? "—" : `${health}%`}</text><text x="100" y="116" textAnchor="middle" className="gov-gauge__label">tarefas em dia</text>
        </svg>
        <p>Concluídas ou abertas dentro do prazo, entre todas as tarefas cadastradas.</p>
        <dl className="gov-portfolio-counts"><div><dt>Projetos com atraso</dt><dd className="gov-tone-rose">{governo.projetosComAtraso}<small> de {governo.totalProjetos}</small></dd></div><div><dt>Acompanhamento prioritário</dt><dd className="gov-tone-blue">{governo.atencaoExecutiva}</dd></div></dl>
        <div className="gov-status-filters" role="group" aria-label="Filtrar o panorama por situação">
          <button type="button" aria-pressed={!filter} onClick={() => chooseFilter("")}><span>Todas as secretarias</span><b>{porSecretaria.length}</b></button>
          {Object.entries(secretariaStatuses).map(([key,status]) => <button key={key} type="button" aria-pressed={filter===key} onClick={() => chooseFilter(filter===key ? "" : key)}><span className={`gov-status gov-tone-${status.tone}`}><i />{status.label}</span><b>{porSecretaria.filter((p) => hasSecretariaStatus(p,key)).length}</b></button>)}
          {porSecretaria.some((p) => !p.tarefasTotal) && <button type="button" aria-pressed={filter==="SEM_TAREFAS"} onClick={() => chooseFilter(filter==="SEM_TAREFAS" ? "" : "SEM_TAREFAS")}><span className="gov-status gov-tone-muted"><i />Sem tarefas cadastradas</span><b>{porSecretaria.filter((p) => !p.tarefasTotal).length}</b></button>}
        </div>
      </aside>
      <div className="gov-panorama__content">
        <div className="gov-panorama__mobile-filter"><label htmlFor="gov-map-filter">Situação das secretarias</label><select id="gov-map-filter" value={filter} onChange={(event) => chooseFilter(event.target.value)}><option value="">Todas as secretarias ({porSecretaria.length})</option>{Object.entries(secretariaStatuses).map(([key,status]) => <option key={key} value={key}>{status.label} ({porSecretaria.filter((p) => hasSecretariaStatus(p,key)).length})</option>)}<option value="SEM_TAREFAS">Sem tarefas cadastradas</option></select></div>
        <div className="gov-panorama__caption"><p aria-live="polite">{visible.length} de {porSecretaria.length} secretarias{filter ? " na situação selecionada" : " no panorama"}</p><button type="button" className="gov-text-link" onClick={() => onOpenSecretarias(filter)}>Abrir análise das pastas <span aria-hidden="true">↗</span></button></div>
        {!visible.length && <div className="gov-empty"><h3>{porSecretaria.length ? "Nenhuma secretaria nesta situação" : "Nenhuma secretaria cadastrada"}</h3><p>{porSecretaria.length ? "Selecione todas as secretarias para voltar ao panorama completo." : "As secretarias aparecerão aqui quando forem cadastradas."}</p>{filter && <button type="button" className="gov-text-link" onClick={() => chooseFilter("")}>Mostrar todas</button>}</div>}
        {mode==="quadro" && visible.length>0 && <>
          <ul className="gov-map-legend" aria-label="Cores das tarefas"><li><i className="gov-fill-green" />Concluídas</li><li><i className="gov-fill-blue" />No prazo</li><li><i className="gov-fill-rose" />Atrasadas</li><li><i className="gov-fill-amber" />Sem prazo</li></ul>
          <ul className="gov-secretaria-map" aria-label="Todas as secretarias do município">{visible.map((p) => {
            const status=secretariaStatus(p);
            const inDate=p.tarefasTotal ? Math.round(share(p.concluidas+p.noPrazo,p.tarefasTotal)) : null;
            const parts=[{value:p.concluidas,tone:"green"},{value:p.noPrazo,tone:"blue"},{value:p.atrasadas,tone:"rose"},{value:p.semPrazo,tone:"amber"}];
            return <li key={p.id}><Link className="gov-map-card" href={`/painel?secretariaId=${encodeURIComponent(p.id)}`} aria-label={`${p.nome}: ${status.label}; ${p.projetos} ${p.projetos===1 ? "projeto" : "projetos"}; ${p.atrasadas} ${p.atrasadas===1 ? "tarefa atrasada" : "tarefas atrasadas"}; ${p.semPrazo} sem prazo`}>
              <span className={`gov-status gov-tone-${status.tone}`}><i />{status.label}</span><h3>{p.nome}</h3><div className="gov-map-card__reading"><strong>{inDate==null ? "Sem tarefas" : `${inDate}% em dia`}</strong><span className={p.atrasadas ? "gov-tone-rose" : undefined}>{p.atrasadas ? `${p.atrasadas} em atraso` : `${p.projetos} ${p.projetos===1 ? "projeto" : "projetos"}`}</span></div><div className="gov-map-card__bar" aria-hidden="true">{p.tarefasTotal ? parts.filter((part) => part.value>0).map((part) => <span key={part.tone} className={`gov-fill-${part.tone}`} style={{flexGrow:part.value}} />) : <span className="gov-fill-muted" style={{flexGrow:1}} />}</div>
            </Link></li>;
          })}</ul>
        </>}
        {mode==="comparar" && visible.length>0 && <div className="gov-comparison">
          <div className="gov-comparison__head"><div><h3>Compare as secretarias</h3><p>Mesma escala, com quantidade e percentual para cada pasta.</p></div><div><label htmlFor="gov-comparison-measure">Comparar por</label><select id="gov-comparison-measure" value={measure} onChange={(event) => setMeasure(event.target.value)}><option value="atraso">Projetos com atraso</option><option value="prioridade">Projetos prioritários para acompanhamento</option><option value="conclusao">Tarefas concluídas</option></select></div></div>
          <ul className="gov-comparison__rows" aria-label="Comparação das secretarias">{visible.map((p) => {
            const total=measure==="conclusao" ? p.tarefasTotal : p.projetos;
            const count=measure==="conclusao" ? p.concluidas : measure==="prioridade" ? p.projetosAtencaoExecutiva : p.projetosComAtraso;
            const percent=Math.round(share(count,total));
            return <li key={p.id}><Link href={`/painel?secretariaId=${encodeURIComponent(p.id)}`}>{p.nome}</Link><div className="gov-comparison__track" role="img" aria-label={`${p.nome}: ${total ? `${count} de ${total}, ${percent}%` : "Sem base de comparação"}`}><span className={`gov-fill-${measure==="conclusao" ? "green" : measure==="prioridade" ? "blue" : "rose"}`} style={{width:`${percent}%`}} /></div><strong>{total ? `${percent}%` : "—"}<small>{count} de {total}</small></strong></li>;
          })}</ul><p className="gov-chart-note">Um projeto tem atraso quando há ao menos uma tarefa vencida. Acompanhamento prioritário considera projetos estruturantes com atraso ou tarefas graves e críticas.</p>
        </div>}
        {mode==="historico" && <div className="gov-history"><h3>Posição da carteira no tempo</h3><p>A base atual disponibiliza uma posição consolidada.</p><ol><li><span className="gov-history__dot" /><div><strong>{dateLabel}</strong><p>Posição de referência</p><dl><div><dt>Projetos acompanhados</dt><dd>{governo.totalProjetos}</dd></div><div><dt>Com atraso</dt><dd>{governo.projetosComAtraso}</dd></div><div><dt>Em acompanhamento prioritário</dt><dd>{governo.atencaoExecutiva}</dd></div></dl></div></li><li><span className="gov-history__dot gov-history__dot--empty" /><div><strong>Próxima atualização</strong><p>Aguardando uma nova posição consolidada.</p></div></li></ol><p className="gov-chart-note">Ainda não há série histórica para calcular uma tendência. A comparação entre secretarias usa a posição atual.</p></div>}
      </div>
    </div>
  </section>;
}
