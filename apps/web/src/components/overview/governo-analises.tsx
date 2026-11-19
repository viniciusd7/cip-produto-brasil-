import Link from "next/link";
import { overviewCopy } from "./audience";
import { share } from "./overview-model";
import type { OverviewResponse } from "./types";

export function GovernoAnalises({data,role,onFilter}: {data:OverviewResponse["data"];role?:string;onFilter:(filter:string)=>void}) {
  const {governo,agenda,porSecretaria,pendencias}=data;
  const copy=overviewCopy(role);
  const intervention=porSecretaria.filter((p)=>p.tarefasTotal>0 && p.classificacao==="INTERVENCAO");
  const maxBlocker=Math.max(1,...agenda.entraves.map((e)=>e.qtd));
  const severities=[{key:"CRITICA",label:"Crítica",tone:"rose"},{key:"GRAVE",label:"Grave",tone:"rose"},{key:"MODERADA",label:"Moderada",tone:"amber"},{key:"LEVE",label:"Leve",tone:"blue"}].map((item)=>({...item,count:Number(agenda.gravidadeBuckets[item.key])||0}));
  const notClassified=Math.max(0,governo.atrasadas-severities.reduce((total,item)=>total+item.count,0));
  return <details className="gov-analysis">
    <summary><span><strong>Análises de acompanhamento</strong><small>Prioridades, entraves, gravidade, evidências e critérios de leitura.</small></span><span className="gov-analysis__toggle" aria-hidden="true" /></summary>
    <div className="gov-analysis__body">
      <section aria-labelledby="gov-decisions-title"><div className="gov-section-head"><div><h2 id="gov-decisions-title">{copy.decisionsTitle}</h2><p>Informações para organizar as próximas providências com os responsáveis.</p></div><Link href="/pendencias" className="gov-text-link">Abrir agenda ↗</Link></div>
        <div className="gov-decisions">
          <article className="gov-panel"><span className="gov-status gov-tone-rose"><i />Atenção prioritária</span><h3>Secretarias que precisam de providências</h3><strong>{intervention.length}</strong><p>{intervention.length ? intervention.map((p)=>p.nome).join(", ") : "Nenhuma secretaria nesta classificação."}</p><button type="button" className="gov-text-link" onClick={()=>onFilter("INTERVENCAO")}>Ver secretarias</button></article>
          <article className="gov-panel"><span className="gov-status gov-tone-rose"><i />Projetos estruturantes</span><h3>Tarefas atrasadas em projetos estruturantes</h3><strong>{agenda.estruturantesAtrasados}</strong><p>Confira causas, responsáveis e datas para recuperar os prazos.</p><Link href="/carteira/estruturante" className="gov-text-link">Ver projetos estruturantes</Link></article>
          <article className="gov-panel"><span className="gov-status gov-tone-lilac"><i />Atualização das informações</span><h3>Secretarias com dados defasados</h3><strong>{agenda.pastasDesatualizadas.length}</strong><p>{agenda.pastasDesatualizadas.length ? agenda.pastasDesatualizadas.map((p)=>p.nome).join(", ") : "Nenhuma secretaria com dados defasados nesta base."}</p><button type="button" className="gov-text-link" onClick={()=>onFilter("DADOS_DEFASADOS")}>Conferir atualização</button></article>
        </div>
      </section>
      <div className="gov-analysis-grid">
        <section className="gov-panel" aria-labelledby="gov-blockers-title"><div className="gov-section-head"><div><h2 id="gov-blockers-title">O que está travando os projetos</h2><p>Entraves abertos, agrupados pelo tipo registrado.</p></div></div>{agenda.entraves.length ? <ul className="gov-analysis-bars">{agenda.entraves.map((item)=><li key={item.tipo}><span>{item.tipo.replaceAll("_"," ").toLocaleLowerCase("pt-BR")}</span><strong>{item.qtd}</strong><div aria-hidden="true"><span className="gov-fill-rose" style={{width:`${share(item.qtd,maxBlocker)}%`}} /></div></li>)}</ul> : <p className="gov-analysis-empty">Nenhum entrave aberto nesta base.</p>}</section>
        <section className="gov-panel" aria-labelledby="gov-severity-title"><div className="gov-section-head"><div><h2 id="gov-severity-title">Gravidade dos atrasos</h2><p>{governo.atrasadas} tarefas atrasadas, por gravidade registrada.</p></div></div><ul className="gov-analysis-bars">{severities.map((item)=><li key={item.key}><span>{item.label}</span><strong>{item.count}</strong><div aria-hidden="true"><span className={`gov-fill-${item.tone}`} style={{width:`${share(item.count,governo.atrasadas)}%`}} /></div></li>)}{notClassified>0 && <li><span>Sem classificação informada</span><strong>{notClassified}</strong><div aria-hidden="true"><span className="gov-fill-muted" style={{width:`${share(notClassified,governo.atrasadas)}%`}} /></div></li>}</ul></section>
      </div>
      <div className="gov-analysis-grid">
        <section className="gov-panel" aria-labelledby="gov-account-title"><div className="gov-section-head"><div><h2 id="gov-account-title">Conferência das entregas</h2><p>Separe o registro de conclusão da comprovação da entrega.</p></div></div><dl className="gov-account-counts"><div><dt>Tarefas concluídas</dt><dd>{governo.concluidas}</dd></div><div><dt>Evidências aguardando conferência</dt><dd>{data.kpis?.evidenciasPendentes ?? "Não informado"}</dd></div></dl><p className="gov-analysis-note">{copy.accountAction}</p><Link href="/relatorios" className="gov-text-link">Consultar relatórios ↗</Link></section>
        <section className="gov-panel" aria-labelledby="gov-pending-title"><div className="gov-section-head"><div><h2 id="gov-pending-title">Providências em aberto</h2><p>Entraves e evidências que aguardam encaminhamento.</p></div></div>{pendencias.length ? <ul className="gov-pending-items">{pendencias.slice(0,6).map((item)=><li key={`${item.tipo}-${item.id}`}><Link href={item.href || `/iniciativas/${item.iniciativaId}?aba=${item.tipo==="EVIDENCIA" ? "evidencias" : "andamento"}`}><strong>{item.titulo}</strong><small>{item.iniciativaNome}</small></Link></li>)}</ul> : <p className="gov-analysis-empty">Nenhuma providência listada nesta base.</p>}<Link href="/pendencias" className="gov-text-link">Ver agenda completa ↗</Link></section>
      </div>
      <section className="gov-reading" aria-labelledby="gov-reading-title"><h2 id="gov-reading-title">Como interpretar esta visão</h2>
        <details><summary>O que as cores das secretarias significam?</summary><p>Dados defasados: mais de 30 dias sem atualização. Atenção prioritária: ao menos 50% das tarefas abertas em atraso ou índice ponderado de gravidade a partir de 35%. Acompanhamento próximo: ao menos 35% de atraso ou 25% sem prazo. As demais situações seguem em acompanhamento. Pastas sem tarefas têm indicação própria. A classificação orienta o acompanhamento dos registros, sem avaliar a qualidade dos serviços públicos.</p></details>
        <details><summary>Como ler os radares e as barras?</summary><p>Execução em dia soma tarefas concluídas e abertas no prazo e divide pelo total. Controle dos prazos considera a proporção de tarefas abertas sem atraso. Prazos definidos considera a proporção de tarefas abertas com data definida. Controle da gravidade usa 100 menos o índice ponderado. Sem uma base de cálculo, a dimensão aparece como “—”. Quanto maior a área do radar, melhores essas dimensões de acompanhamento.</p><p>O índice pondera tarefas críticas por 1, graves por 0,75, moderadas por 0,5 e leves por 0,25, dividido pelas tarefas abertas. Método da base: {governo.metodoVersao}.</p></details>
        <details><summary>O panorama mostra uma evolução no tempo?</summary><p>A comparação entre secretarias usa a posição atual. A linha do tempo identifica a data disponível; sem outras posições consolidadas, não é possível calcular uma tendência. Cada projeto pode ter sua própria data de referência para o cálculo dos prazos.</p></details>
      </section>
    </div>
  </details>;
}
