"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { overviewCopy, secretariaRecommendation } from "./audience";
import { PrefeitoProjetos } from "./prefeito-projetos";
import { GovernoPanorama } from "./governo-panorama";
import { GovernoAnalises } from "./governo-analises";
import { SecretariaSaude } from "./secretaria-saude";
import { hasSecretariaStatus, secretariaStatus, secretariaStatuses as statuses, share } from "./overview-model";
import type { OverviewResponse, SecretariaOverview } from "./types";

type View = "resumo" | "secretarias" | "projetos";
type IconName = "projects" | "building" | "check" | "clock" | "arrow" | "search" | "calendar";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    projects: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 5V3h8v2M3 10h18M9 14h6" /></>,
    building: <><path d="m3 9 9-6 9 6M4 21h16M6 10v7m6-7v7m6-7v7" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const priority = ["INTERVENCAO", "DADOS_DEFASADOS", "ACOMPANHAMENTO", "ROTINA"];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const formatNumber = (value: number) => value.toLocaleString("pt-BR");
function SecretariaCard({ secretaria: p, role, showHealth = false }: { secretaria: SecretariaOverview; role?: string; showHealth?: boolean }) {
  const status = secretariaStatus(p);
  const progress = share(p.concluidas, p.tarefasTotal);
  return (
    <article className="gov-secretaria">
      <div className="gov-secretaria__top"><span className={`gov-status gov-tone-${status.tone}`}><i />{status.label}</span><span>{p.projetos} {p.projetos === 1 ? "projeto" : "projetos"}</span></div>
      <h3>{p.nome}</h3>
      <p className="gov-secretaria__owner">{p.titular?.nome || "Responsável não cadastrado"}</p>
      {showHealth && <SecretariaSaude secretaria={p} />}
      <div className="gov-secretaria__progress"><span>Tarefas concluídas</span><strong>{p.concluidas} de {p.tarefasTotal}</strong></div>
      <div className="gov-progress" role="img" aria-label={`${Math.round(progress)}% das tarefas concluídas`}><span style={{ width: `${progress}%` }} /></div>
      <div className="gov-secretaria__facts"><span className={p.atrasadas ? "gov-tone-rose" : undefined}><b>{p.atrasadas}</b> em atraso</span><span className={p.semPrazo ? "gov-tone-amber" : undefined}><b>{p.semPrazo}</b> sem prazo</span>{p.criticas > 0 && <span className="gov-tone-rose"><b>{p.criticas}</b> {p.criticas === 1 ? "crítica" : "críticas"}</span>}</div>
      <p className="gov-secretaria__advice">{secretariaRecommendation(p, role)}</p>
      <footer><span>{p.diasSemAtualizacao == null ? "Sem atualização registrada" : p.diasSemAtualizacao <= 0 ? "Atualizada na data de referência" : `${p.diasSemAtualizacao} dias sem atualização`}</span><Link href={`/painel?secretariaId=${encodeURIComponent(p.id)}`} aria-label={`Abrir secretaria ${p.nome}`}>Abrir secretaria <Icon name="arrow" /></Link></footer>
    </article>
  );
}

export function GovernoOverview({ payload, municipio, role }: { payload: OverviewResponse; municipio: string; role?: string }) {
  const { governo, porSecretaria, agenda, tarefasPedemAcao, pendencias, projetosEstruturantes } = payload.data;
  const copy = overviewCopy(role);
  const [view, setView] = useState<View>("resumo");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("priority");
  const [showHealth, setShowHealth] = useState(true);
  const [attentionFilter, setAttentionFilter] = useState("");
  const tabsRef = useRef<HTMLElement>(null);
  const reference = payload.meta?.dataReferencia ? new Date(payload.meta.dataReferencia) : null;
  const validReference = reference && !Number.isNaN(reference.getTime()) ? reference : null;
  const referenceLabel = validReference?.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }) ?? "Data não informada";
  const onTime = governo.noPrazo ?? Math.max(0, governo.abertas - governo.atrasadas - governo.semPrazo);
  const pendingCount = payload.data.kpis?.pendenciasAbertas ?? pendencias.length;
  const completedPercent = Math.round(share(governo.concluidas, governo.totalTarefas));
  const taskParts = [
    { label: "Concluídas", value: governo.concluidas, tone: "green", description: "Finalizadas no sistema" },
    { label: "Dentro do prazo", value: onTime, tone: "blue", description: "Abertas, com prazo em dia" },
    { label: "Atrasadas", value: governo.atrasadas, tone: "rose", description: "Com prazo vencido" },
    { label: "Sem prazo", value: governo.semPrazo, tone: "amber", description: "Aguardam definição de data" },
  ];
  const sortedSecretarias = [...porSecretaria].sort((a, b) =>
    Number(!a.tarefasTotal) - Number(!b.tarefasTotal) ||
    priority.indexOf(a.classificacao) - priority.indexOf(b.classificacao) || b.pctAtraso - a.pctAtraso || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  const visible = sortedSecretarias.filter((p) =>
    normalize(`${p.nome} ${p.sigla ?? ""} ${p.titular?.nome ?? ""}`).includes(normalize(query.trim())) &&
    hasSecretariaStatus(p, filter),
  ).sort((a, b) => sort === "name" ? a.nome.localeCompare(b.nome, "pt-BR") : sort === "delay" ? b.atrasadas - a.atrasadas : 0);
  const attentionItems = [
    ...(tarefasPedemAcao?.atrasadas ?? []).map((t) => ({ ...t, category: "atrasadas", label: "Atrasada", tone: "rose" })),
    ...(tarefasPedemAcao?.vencemEm15d ?? []).map((t) => ({ ...t, category: "proximas", label: "Vence em até 15 dias", tone: "amber" })),
    ...(tarefasPedemAcao?.semPrazo ?? []).map((t) => ({ ...t, category: "sem-prazo", label: "Sem prazo definido", tone: "muted" })),
  ].filter((item, index, items) => items.findIndex((other) => other.id === item.id) === index);
  const visibleAttention = attentionItems.filter((item) => !attentionFilter || item.category === attentionFilter);
  const views: Array<{ id: View; label: string; count?: number }> = [
    { id: "resumo", label: "Resumo" },
    { id: "secretarias", label: "Secretarias", count: porSecretaria.length },
    { id: "projetos", label: "Projetos", count: governo.totalProjetos },
  ];

  function changeView(next: View, focus = false) {
    setView(next);
    if (focus) tabsRef.current?.querySelector<HTMLButtonElement>(`#gov-tab-${next}`)?.focus();
  }
  function openSecretarias(nextFilter: string) {
    setQuery("");
    setFilter(nextFilter);
    changeView("secretarias", true);
  }
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | undefined;
    if (event.key === "ArrowRight") next = (index + 1) % views.length;
    if (event.key === "ArrowLeft") next = (index - 1 + views.length) % views.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = views.length - 1;
    if (next != null) { event.preventDefault(); changeView(views[next].id, true); }
  }

  return (
    <div className="gov-overview">
      <header className="gov-header">
        <div><p className="gov-municipio"><Icon name="building" />{municipio}</p><h1>Visão geral</h1><p>O essencial para acompanhar os projetos e as entregas da prefeitura.</p></div>
        <div className="gov-reference"><Icon name="calendar" /><div><span>Data de referência</span>{validReference ? <time dateTime={validReference.toISOString()}>{referenceLabel}</time> : <strong>{referenceLabel}</strong>}</div></div>
      </header>

      <nav ref={tabsRef} className="gov-tabs" role="tablist" aria-label="Visualizações da prefeitura">
        {views.map((item, index) => <button key={item.id} id={`gov-tab-${item.id}`} type="button" role="tab" aria-selected={view === item.id} aria-controls={view === item.id ? `gov-panel-${item.id}` : undefined} tabIndex={view === item.id ? 0 : -1} onClick={() => changeView(item.id)} onKeyDown={(event) => onTabKey(event, index)}>{item.label}{item.count != null && <span>{formatNumber(item.count)}</span>}</button>)}
      </nav>

      {view === "resumo" && <div id="gov-panel-resumo" role="tabpanel" aria-labelledby="gov-tab-resumo" tabIndex={0}>
        <div className="gov-stats" aria-label="Resumo da prefeitura">
          <button type="button" className="gov-stat" onClick={() => changeView("projetos", true)}><span className="gov-stat__icon gov-tone-blue"><Icon name="projects" /></span><span className="gov-stat__label">Projetos acompanhados</span><strong>{formatNumber(governo.totalProjetos)}</strong><span className="gov-stat__note">{governo.projetosComAtraso ? `${governo.projetosComAtraso} com tarefas atrasadas` : "Ver os projetos da prefeitura"}<Icon name="arrow" /></span></button>
          <button type="button" className="gov-stat" onClick={() => changeView("secretarias", true)}><span className="gov-stat__icon gov-tone-blue"><Icon name="building" /></span><span className="gov-stat__label">Secretarias</span><strong>{formatNumber(porSecretaria.length)}</strong><span className="gov-stat__note">{porSecretaria.filter((p) => p.projetos > 0).length} com projetos cadastrados<Icon name="arrow" /></span></button>
          <Link href="/relatorios/tarefas" className="gov-stat"><span className="gov-stat__icon gov-tone-green"><Icon name="check" /></span><span className="gov-stat__label">Tarefas concluídas</span><strong>{formatNumber(governo.concluidas)}<small> / {formatNumber(governo.totalTarefas)}</small></strong><span className="gov-stat__note">{governo.totalTarefas ? `${completedPercent}% das tarefas cadastradas` : "Aguardando o cadastro de tarefas"}<Icon name="arrow" /></span></Link>
          <Link href="/pendencias" className={`gov-stat${governo.atrasadas ? " gov-stat--attention" : ""}`}><span className={`gov-stat__icon gov-tone-${governo.atrasadas ? "rose" : "green"}`}><Icon name="clock" /></span><span className="gov-stat__label">Tarefas atrasadas</span><strong>{formatNumber(governo.atrasadas)}</strong><span className="gov-stat__note">{governo.atrasadas ? "Precisam de acompanhamento" : "Nenhum atraso registrado"}<Icon name="arrow" /></span></Link>
        </div>

        <GovernoPanorama data={payload.data} dataReferencia={payload.meta?.dataReferencia} onOpenSecretarias={openSecretarias} />

        <div className="gov-summary-grid">
          <section className="gov-panel gov-execution" aria-labelledby="gov-execution-title">
            <div className="gov-section-head"><div><h2 id="gov-execution-title">Como estão as tarefas</h2><p>Uma leitura simples do andamento dos projetos.</p></div><span className="gov-total">{formatNumber(governo.totalTarefas)} no total</span></div>
            <div className="gov-execution__highlight"><strong>{governo.totalTarefas ? `${completedPercent}%` : "—"}</strong><div><span>das tarefas concluídas</span><small>{governo.totalTarefas ? `${governo.concluidas} finalizadas de ${governo.totalTarefas} cadastradas` : "Cadastre tarefas nos projetos para acompanhar a execução."}</small></div></div>
            <div className="gov-task-bar" role="img" aria-label={taskParts.map((p) => `${p.label}: ${p.value}`).join("; ")}>{governo.totalTarefas ? taskParts.filter((p) => p.value > 0).map((part) => <span key={part.label} className={`gov-fill-${part.tone}`} style={{ flexGrow: part.value }} />) : <span className="gov-fill-muted" style={{ flexGrow: 1 }} />}</div>
            <ul className="gov-task-legend">{taskParts.map((part) => <li key={part.label}><i className={`gov-fill-${part.tone}`} /><span>{part.label}<small>{part.description}</small></span><strong>{formatNumber(part.value)}</strong></li>)}</ul>
            <p className="gov-execution__note">A conclusão da tarefa é um registro do sistema. A comprovação da entrega depende da conferência das evidências.</p>
          </section>

          <section className="gov-panel gov-attention" aria-labelledby="gov-attention-title">
            <div className="gov-section-head"><div><h2 id="gov-attention-title">O que precisa de atenção</h2><p>Atrasos e próximos prazos para acompanhar.</p></div><Link href="/pendencias" className="gov-text-link">Ver agenda <Icon name="arrow" /></Link></div>
            <div className="gov-attention-filters" role="group" aria-label="Filtrar tarefas que pedem atenção">{[{id:"",label:"Todas"},{id:"atrasadas",label:"Atrasadas"},{id:"proximas",label:"Próximos prazos"},{id:"sem-prazo",label:"Sem prazo"}].map((item) => <button key={item.id} type="button" aria-pressed={attentionFilter === item.id} onClick={() => setAttentionFilter(item.id)}>{item.label}</button>)}</div>
            {visibleAttention.length ? <><ul className="gov-attention-list">{visibleAttention.slice(0, 5).map((item) => <li key={item.id}><Link href={`/iniciativas/${item.iniciativaId}?aba=andamento`}><span className={`gov-status gov-tone-${item.tone}`}><i />{item.label}</span><strong>{item.descricao}</strong><small>{item.secretaria} · {item.iniciativaNome}</small><span className="gov-attention-list__arrow"><Icon name="arrow" /></span></Link></li>)}</ul><p className="gov-attention__foot">Exibindo {Math.min(5, visibleAttention.length)} tarefas prioritárias. Consulte a agenda para ver os demais itens.</p></> : attentionFilter ? <div className="gov-empty"><h3>Nenhuma tarefa nesta categoria</h3><p>Escolha outra categoria para consultar os itens disponíveis nesta base.</p><button type="button" className="gov-text-link" onClick={() => setAttentionFilter("")}>Mostrar todas</button></div> : <div className="gov-empty"><span className={`gov-empty__icon gov-tone-${governo.atrasadas || governo.semPrazo ? "amber" : "green"}`}><Icon name={governo.atrasadas || governo.semPrazo ? "clock" : "check"} /></span><h3>{governo.atrasadas || governo.semPrazo ? "Confira os pontos de atenção" : governo.totalTarefas ? "Nenhum alerta de tarefa nesta lista" : "O acompanhamento começa aqui"}</h3><p>{governo.atrasadas || governo.semPrazo ? `Há ${governo.atrasadas} tarefas atrasadas e ${governo.semPrazo} sem prazo. Consulte os detalhes na agenda.` : governo.totalTarefas ? "As tarefas atrasadas ou próximas do vencimento aparecerão aqui quando estiverem disponíveis." : copy.emptyTasks}</p><Link href={governo.totalTarefas ? "/pendencias" : "/carteira"} className="gov-text-link">{governo.totalTarefas ? "Abrir agenda" : "Ver projetos"}<Icon name="arrow" /></Link></div>}
          </section>
        </div>

        <section className="gov-follow-up" aria-label="Próximas providências">
          <div><span className="gov-follow-up__icon"><Icon name="clock" /></span><h2>Próximas providências</h2></div>
          <Link href="/acoes"><strong>{governo.semPrazo}</strong><span>tarefas sem prazo<small>Definir as datas com os responsáveis</small></span><Icon name="arrow" /></Link>
          <Link href="/pendencias"><strong>{pendingCount}</strong><span>providências em aberto<small>Consultar os encaminhamentos</small></span><Icon name="arrow" /></Link>
          <button type="button" onClick={() => { setFilter("DADOS_DEFASADOS"); changeView("secretarias", true); }}><strong>{agenda.pastasDesatualizadas.length}</strong><span>secretarias sem atualização<small>Solicitar uma posição mais recente</small></span><Icon name="arrow" /></button>
        </section>



        {projetosEstruturantes.length > 0 && <section className="gov-projects-section" aria-labelledby="gov-projects-title"><div className="gov-section-head"><div><h2 id="gov-projects-title">Projetos estruturantes</h2><p>Projetos destacados para o acompanhamento da prefeitura.</p></div><button type="button" className="gov-text-link" onClick={() => changeView("projetos", true)}>Ver projetos <Icon name="arrow" /></button></div><div className="gov-featured-projects">{projetosEstruturantes.slice(0, 6).map((p) => <Link key={p.id} href={`/iniciativas/${p.id}`}><span className="gov-project-icon"><Icon name="projects" /></span><div><h3>{p.nome}</h3><p>{p.secretaria}</p><span className={p.atrasadas ? "gov-tone-rose" : "gov-tone-muted"}>{p.atrasadas ? `${p.atrasadas} tarefas atrasadas` : "Sem atraso registrado"}</span><small className="gov-featured-projects__facts">{`${p.marcos} ${p.marcos === 1 ? "tarefa" : "tarefas"} · ${p.pendencias} ${p.pendencias === 1 ? "pendência" : "pendências"}`}</small></div><Icon name="arrow" /></Link>)}</div></section>}
        <GovernoAnalises data={payload.data} role={role} onFilter={openSecretarias} />
      </div>}

      {view === "secretarias" && <section id="gov-panel-secretarias" role="tabpanel" aria-labelledby="gov-tab-secretarias" tabIndex={0}>
        <div className="gov-section-head"><div><h2>Situação das secretarias</h2><p>Consulte os projetos, as tarefas e o que precisa de acompanhamento em cada pasta.</p></div><Link href="/secretarias" className="gov-text-link">Ver lista completa <Icon name="arrow" /></Link></div>
        <div className="gov-filters"><div className="gov-search"><label htmlFor="gov-search">Buscar secretaria ou responsável</label><div><Icon name="search" /><input id="gov-search" type="search" placeholder="Nome da secretaria ou responsável" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div><label htmlFor="gov-filter">Situação</label><select id="gov-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Todas as situações</option>{Object.entries(statuses).map(([key, status]) => <option key={key} value={key}>{status.label}</option>)}<option value="SEM_PRAZO">Com tarefas sem prazo</option><option value="SEM_PROJETOS">Sem projetos</option><option value="SEM_TAREFAS">Sem tarefas cadastradas</option></select></div><div><label htmlFor="gov-sort">Ordenar por</label><select id="gov-sort" value={sort} onChange={(event) => setSort(event.target.value)}><option value="priority">Prioridade de acompanhamento</option><option value="name">Nome da secretaria</option><option value="delay">Mais tarefas atrasadas</option></select></div></div>
        <div className="gov-secretarias-toolbar"><p>O radar reúne execução, prazos e gravidade. Abra uma pasta para consultar os projetos.</p><div className="gov-view-switch" role="group" aria-label="Detalhamento das secretarias"><button type="button" aria-pressed={!showHealth} onClick={() => setShowHealth(false)}>Resumo</button><button type="button" aria-pressed={showHealth} onClick={() => setShowHealth(true)}>Análise visual</button></div></div>
        <p className="gov-result-count" aria-live="polite">{visible.length} de {porSecretaria.length} secretarias{(query || filter) && <button type="button" onClick={() => { setQuery(""); setFilter(""); }}>Limpar filtros</button>}</p>
        {visible.length ? <div className="gov-secretaria-grid">{visible.map((p) => <SecretariaCard key={p.id} secretaria={p} role={role} showHealth={showHealth} />)}</div> : <div className="gov-panel gov-empty"><h3>{porSecretaria.length ? "Nenhuma secretaria encontrada" : "Nenhuma secretaria cadastrada"}</h3><p>{porSecretaria.length ? "Tente outro nome ou limpe os filtros para ver todas as secretarias." : copy.secretariaEmpty}</p>{porSecretaria.length ? <button type="button" className="gov-text-link" onClick={() => { setQuery(""); setFilter(""); }}>Limpar filtros</button> : <Link href="/secretarias" className="gov-text-link">Abrir secretarias <Icon name="arrow" /></Link>}</div>}
      </section>}

      {view === "projetos" && <div id="gov-panel-projetos" role="tabpanel" aria-labelledby="gov-tab-projetos" tabIndex={0}><PrefeitoProjetos projetos={payload.data.projetosVisao ?? []} /></div>}

      <footer className="gov-footer"><span>Fonte: {payload.meta?.fonte || "Registros dos projetos e tarefas na plataforma CIP"}</span><span>Referência: {validReference?.toLocaleDateString("pt-BR", { timeZone: "UTC" }) ?? "não informada"}</span></footer>
    </div>
  );
}
