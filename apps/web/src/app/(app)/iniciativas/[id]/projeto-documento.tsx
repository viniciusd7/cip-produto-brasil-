"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GRUPOS_CONDICOES,
  quizItem,
  textoPorQueParado,
  tonePrazo,
} from "@cip/shared";
import { Badge, Card } from "@cip/ui";
import { FluxoArvore, type FluxoNode } from "@/components/fluxo-arvore";
import { DesdobramentoForms } from "./desdobramento-forms";
import { EvidenciaCard, type EvidenciaItem } from "./evidencia-actions";
import { EvidenciaForm } from "./evidencia-form";
import { ResponsavelEditor } from "./responsavel-editor";
import { VinculosEditor } from "./vinculos-editor";

export type SecretariaRef = { id: string; nome: string; sigla?: string | null };

export type ProjetoDocMeta = {
  id: string;
  codigo?: string | null;
  nome: string;
  indicador?: string | null;
  alvo?: string | null;
  valorAtual?: string | null;
  responsavel?: string | null;
  prazo?: string | null;
  status: string;
  marcos: ProjetoDocMarco[];
};

export type ProjetoDocMarco = {
  id: string;
  codigo?: string | null;
  descricao: string;
  prazoStatus: string;
  prazoOriginal?: string | null;
  prazoVigente?: string | null;
  gravidade?: string | null;
  metaExecucaoId?: string | null;
  responsavel?: string | null;
  subtarefas: Array<{
    id: string;
    descricao: string;
    concluida: boolean;
    responsavel?: string | null;
  }>;
  reprogramacoes: Array<{ id: string; motivo: string; dataNova?: string }>;
};

export type ProjetoDocData = {
  id: string;
  codigo: string;
  nome: string;
  ciclo: string;
  responsavel?: string | null;
  responsavelPessoaId?: string | null;
  estruturante?: boolean;
  bloqueioLabel?: string | null;
  bloqueiosAtivos?: Array<{ perguntaCodigo: string; rotulo: string }> | null;
  secretariaPrincipal: { id: string; nome: string; sigla?: string | null };
  metaEstrategica?: { id: string; nome: string; codigo?: string | null } | null;
  secretarias: Array<{ papel: string; secretaria: SecretariaRef }>;
  equipamentos: Array<{ equipamento: { nome: string } }>;
  metasExecucao: ProjetoDocMeta[];
  marcos: ProjetoDocMarco[];
  verificacoes: Array<{
    id: string;
    aplicabilidade: string;
    situacao: string;
    justificativa?: string | null;
    proximaAcao?: string | null;
    responsavel?: string | null;
    tipo: { nome: string; codigo?: string };
  }>;
  impedimentos: Array<{
    id: string;
    descricao: string;
    status: string;
    responsavel?: string | null;
    proximoPasso?: string | null;
  }>;
  evidencias: EvidenciaItem[];
};

type Aba = "visao" | "andamento" | "evidencias";

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function metaProgress(me: ProjetoDocMeta) {
  const subs = me.marcos.flatMap((m) => m.subtarefas);
  if (subs.length) {
    const done = subs.filter((s) => s.concluida).length;
    return { pct: Math.round((done / subs.length) * 100), label: `${done}/${subs.length} passos` };
  }
  if (me.marcos.length) {
    const done = me.marcos.filter((m) => m.prazoStatus === "CONCLUIDO").length;
    return {
      pct: Math.round((done / me.marcos.length) * 100),
      label: `${done}/${me.marcos.length} tarefas`,
    };
  }
  return { pct: 0, label: "Sem tarefas" };
}

const ABAS: Array<{ id: Aba; label: string }> = [
  { id: "visao", label: "Visão" },
  { id: "andamento", label: "Andamento" },
  { id: "evidencias", label: "Evidências" },
];

export function ProjetoDocumento({
  item,
  canWrite,
  canValidate,
  token,
  equipe,
  todasSecretarias,
}: {
  item: ProjetoDocData;
  canWrite: boolean;
  canValidate: boolean;
  token: string;
  /** Nomes da equipe das pastas envolvidas (sugestões de responsável). */
  equipe: string[];
  todasSecretarias: SecretariaRef[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("aba");
  const aba: Aba =
    raw === "visao" || raw === "evidencias" || raw === "andamento"
      ? raw
      : "andamento";

  const marcosSemMeta = item.marcos.filter((m) => !m.metaExecucaoId);
  const atrasadas = item.marcos.filter((m) => m.prazoStatus === "VENCIDO").length;
  const evidPendentes = item.evidencias.filter(
    (e) => e.status === "DECLARADA" || e.status === "A_VERIFICAR",
  ).length;
  const impedAbertos = item.impedimentos.filter(
    (p) => p.status === "ABERTO" || p.status === "EM_ENCAMINHAMENTO",
  ).length;

  const marcoOptions = item.marcos.map((m) => ({
    id: m.id,
    label: m.codigo ? `${m.codigo} · ${m.descricao}` : m.descricao,
  }));

  function setAba(next: Aba) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("aba", next);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Resumo "quem responde": agrupa projeto, metas, tarefas e subtarefas por pessoa.
  const porResponsavel = new Map<string, string[]>();
  const semResponsavel: string[] = [];
  function registraResponsavel(nomeResp: string | null | undefined, rotulo: string) {
    const chave = nomeResp?.trim();
    if (!chave) {
      semResponsavel.push(rotulo);
      return;
    }
    porResponsavel.set(chave, [...(porResponsavel.get(chave) ?? []), rotulo]);
  }
  registraResponsavel(item.responsavel, `Projeto: ${item.nome}`);
  for (const me of item.metasExecucao) registraResponsavel(me.responsavel, `Meta: ${me.nome}`);
  for (const m of item.marcos) {
    registraResponsavel(m.responsavel, `Tarefa: ${m.descricao}`);
    for (const st of m.subtarefas) {
      registraResponsavel(st.responsavel, `Subtarefa: ${st.descricao}`);
    }
  }

  const fluxoNodes: FluxoNode[] = item.metasExecucao.map((me) => {
    const prog = metaProgress(me);
    return {
      id: me.id,
      codigo: me.codigo,
      nome: me.nome,
      nivel: "META",
      indicador: me.indicador,
      alvo: me.alvo,
      status: me.status,
      progresso: prog.pct,
      responsavel: me.responsavel,
      children: me.marcos.map((m) => ({
        id: m.id,
        codigo: m.codigo,
        nome: m.descricao,
        nivel: "TAREFA",
        status: m.prazoStatus,
        responsavel: m.responsavel,
        prazo: m.prazoVigente ?? m.prazoOriginal ?? null,
        children: m.subtarefas.map((st) => ({
          id: st.id,
          nome: st.descricao,
          nivel: "SUBTAREFA",
          status: st.concluida ? "CONCLUIDO" : "EM_ANDAMENTO",
          responsavel: st.responsavel,
        })),
      })),
    };
  });

  return (
    <div className="projeto-doc">
      {(item.ciclo === "AGUARDANDO_PRE_REQUISITO" ||
        (item.bloqueiosAtivos && item.bloqueiosAtivos.length > 0)) && (
        <div className="bloqueio-alert" role="alert">
          <div>
            <strong>{item.bloqueioLabel || "Aguardando pré-requisito"}</strong>
            <p>
              {textoPorQueParado(
                item.verificacoes.map((v) => ({
                  codigo: v.tipo.codigo || v.tipo.nome,
                  aplicabilidade:
                    v.aplicabilidade === "SIM"
                      ? "sim"
                      : v.aplicabilidade === "NAO"
                        ? "nao"
                        : "a_avaliar",
                  situacao:
                    v.situacao === "ATENDIDA"
                      ? "atendida"
                      : v.situacao === "PENDENTE"
                        ? "pendente"
                        : v.situacao === "DISPENSADA_COM_FUNDAMENTO"
                          ? "dispensada_com_fundamento"
                          : "em_analise",
                  proximoPasso: v.proximaAcao || undefined,
                  responsavel: v.responsavel || item.responsavel || undefined,
                })),
              )}
            </p>
          </div>
          <Badge tone="danger">Bloqueado</Badge>
        </div>
      )}

      <section className="projeto-indicadores" aria-label="Indicadores do projeto">
        {!item.metasExecucao.length && (
          <p className="dashboard-muted" style={{ margin: 0 }}>
            Cadastre uma meta de execução na aba Andamento para acompanhar indicadores.
          </p>
        )}
        {item.metasExecucao.map((me) => {
          const prog = metaProgress(me);
          return (
            <article key={me.id} className="projeto-indicador-chip">
              <div className="projeto-indicador-chip__head">
                <strong>{me.nome}</strong>
                <Badge tone="info">{me.status}</Badge>
              </div>
              <div className="projeto-indicador-chip__metrics">
                <div>
                  <span className="projeto-indicador-chip__label">Indicador</span>
                  <p>{me.indicador || "Não definido"}</p>
                </div>
                <div>
                  <span className="projeto-indicador-chip__label">Alvo</span>
                  <p>{me.alvo || "—"}</p>
                  <span className="projeto-indicador-chip__label">Atual</span>
                  <p>{me.valorAtual || "—"}</p>
                </div>
              </div>
              <div className="projeto-progress">
                <div className="projeto-progress__bar" style={{ width: `${prog.pct}%` }} />
              </div>
              <span className="dashboard-muted">
                {prog.pct}% · {prog.label}
              </span>
            </article>
          );
        })}
      </section>

      <nav className="projeto-tabs" aria-label="Seções do projeto">
        {ABAS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={
              aba === t.id ? "projeto-tabs__btn projeto-tabs__btn--active" : "projeto-tabs__btn"
            }
            onClick={() => setAba(t.id)}
          >
            {t.label}
            {t.id === "evidencias" && evidPendentes > 0 ? (
              <span className="projeto-tabs__count">{evidPendentes}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {aba === "visao" && (
        <div className="stack">
          <div className="chip-row">
            <Badge tone={atrasadas ? "danger" : "success"}>
              {atrasadas ? `${atrasadas} atraso(s)` : "Sem atraso"}
            </Badge>
            <Badge tone={evidPendentes ? "warning" : "neutral"}>
              {evidPendentes} evidência(s) pendente(s)
            </Badge>
            <Badge tone={impedAbertos ? "warning" : "neutral"}>
              {impedAbertos} impedimento(s)
            </Badge>
            <Badge tone="neutral">Resp.: {item.responsavel || "—"}</Badge>
          </div>

          <Card title="Posição na hierarquia">
            <div className="tree-block">
              <h4>Meta estratégica</h4>
              <p>
                {item.metaEstrategica
                  ? `${item.metaEstrategica.codigo || ""} ${item.metaEstrategica.nome}`
                  : item.estruturante
                    ? "Pendente de vinculação (obrigatória para estruturante)"
                    : "Não vinculada"}
              </p>
            </div>
            <VinculosEditor
              token={token}
              iniciativaId={item.id}
              secretariaPrincipal={item.secretariaPrincipal}
              secretariasAtuais={item.secretarias.map((s) => s.secretaria)}
              todasSecretarias={todasSecretarias}
              responsavel={item.responsavel}
              responsavelPessoaId={item.responsavelPessoaId}
              canWrite={canWrite}
            />
            <div className="chip-row">
              {item.equipamentos.map((e) => (
                <Badge key={e.equipamento.nome} tone="info">
                  {e.equipamento.nome}
                </Badge>
              ))}
            </div>
          </Card>

          <Card
            title="Quem responde"
            subtitle="Projeto, metas, tarefas e subtarefas agrupados por responsável"
          >
            {!porResponsavel.size && (
              <p className="dashboard-muted">Ninguém definido ainda. Defina o responsável em cada item.</p>
            )}
            {[...porResponsavel.entries()]
              .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
              .map(([nomeResp, itens]) => (
                <details key={nomeResp} className="more-block" open={itens.length <= 6}>
                  <summary>
                    {nomeResp} ({itens.length})
                  </summary>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    {itens.map((t) => (
                      <li key={t} className="dashboard-muted">
                        {t}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            {!!semResponsavel.length && (
              <div className="bloqueio-alert" role="status">
                <div>
                  <strong>{semResponsavel.length} item(ns) sem responsável</strong>
                  <p>
                    {semResponsavel.slice(0, 8).join(" · ")}
                    {semResponsavel.length > 8 ? " …" : ""}
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card title="Mapa de desdobramento">
            <FluxoArvore nodes={fluxoNodes} defaultExpandedDepth={1} showOrigemLabel />
          </Card>

          <div className="dashboard-grid-2">
            <Card title="Condicionantes por grupo">
              {GRUPOS_CONDICOES.map((grupo) => {
                const itens = item.verificacoes.filter((v) => {
                  const tema = quizItem(v.tipo.codigo || "");
                  return tema?.grupo === grupo.id;
                });
                if (!itens.length) return null;
                return (
                  <details key={grupo.id} className="more-block" open>
                    <summary>
                      {grupo.nome} ({itens.length})
                    </summary>
                    {itens.map((v) => (
                      <div key={v.id} className="dashboard-list-item">
                        <div>
                          <strong>{v.tipo.nome}</strong>
                          <div className="dashboard-muted">
                            {v.justificativa || v.proximaAcao || "—"}
                          </div>
                        </div>
                        <Badge
                          tone={
                            v.situacao === "PENDENTE" ||
                            v.situacao === "EM_ANALISE"
                              ? "warning"
                              : v.situacao === "ATENDIDA"
                                ? "success"
                                : "info"
                          }
                        >
                          {v.aplicabilidade}/{v.situacao}
                        </Badge>
                      </div>
                    ))}
                  </details>
                );
              })}
              {!item.verificacoes.length && (
                <p className="dashboard-muted">Sem condicionantes registradas</p>
              )}
              {item.verificacoes
                .filter((v) => !quizItem(v.tipo.codigo || ""))
                .map((v) => (
                  <div key={v.id} className="dashboard-list-item">
                    <div>
                      <strong>{v.tipo.nome}</strong>
                      <div className="dashboard-muted">
                        {v.justificativa || "—"}
                      </div>
                    </div>
                    <Badge tone={v.situacao === "PENDENTE" ? "warning" : "info"}>
                      {v.aplicabilidade}/{v.situacao}
                    </Badge>
                  </div>
                ))}
            </Card>
            <Card title="Impedimentos">
              {item.impedimentos.map((p) => (
                <div key={p.id} className="dashboard-list-item">
                  <div>
                    <strong>{p.descricao}</strong>
                    <div className="dashboard-muted">
                      {p.responsavel || "—"} · {p.proximoPasso || "—"}
                    </div>
                  </div>
                  <Badge tone="warning">{p.status}</Badge>
                </div>
              ))}
              {!item.impedimentos.length && (
                <p className="dashboard-muted">Sem impedimentos</p>
              )}
              {!!item.evidencias.length && (
                <p className="dashboard-muted" style={{ marginTop: 12 }}>
                  Evidências na aba dedicada ·{" "}
                  <button type="button" className="linkish" onClick={() => setAba("evidencias")}>
                    abrir
                  </button>
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      {aba === "andamento" && (
        <div className="stack">
          <p className="dashboard-muted" style={{ margin: 0 }}>
            Pasta do projeto: abra cada meta (▶) para ver tarefas e subtarefas.
          </p>

          {(item.bloqueioLabel ||
            (item.bloqueiosAtivos && item.bloqueiosAtivos.length > 0)) && (
            <div className="bloqueio-alert">
              <div>
                <strong>Por que está parado</strong>
                <p>{item.bloqueioLabel}</p>
                {item.bloqueiosAtivos?.length ? (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    {item.bloqueiosAtivos.map((b) => (
                      <li key={b.perguntaCodigo}>
                        {quizItem(b.perguntaCodigo)?.rotulo || b.perguntaCodigo}:{" "}
                        {b.rotulo}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}

          <Card title="Fluxo Meta → Tarefa → Subtarefa">
            <FluxoArvore nodes={fluxoNodes} defaultExpandedDepth={1} showOrigemLabel />
          </Card>

          {!item.metasExecucao.length && (
            <Card title="Comece pela meta">
              <p className="dashboard-muted">
                Sem meta de execução o escopo fica incompleto.
              </p>
              {canWrite && (
                <DesdobramentoForms equipe={equipe} mode="meta" token={token} iniciativaId={item.id} />
              )}
            </Card>
          )}

          {item.metasExecucao.map((me) => (
            <details key={me.id} className="more-block" open={item.metasExecucao.length === 1}>
              <summary>
                {me.codigo ? `${me.codigo} · ` : ""}
                {me.nome} · {metaProgress(me).pct}% · Resp.: {me.responsavel || "sem responsável"}
              </summary>
              <div className="stack" style={{ marginTop: 12 }}>
                <div className="dashboard-muted">
                  Indicador: {me.indicador || "—"} · Alvo: {me.alvo || "—"} · Atual:{" "}
                  {me.valorAtual || "—"} · Prazo:{" "}
                  {fmt(me.prazo)}
                </div>
                <div className="dashboard-muted">
                  Quem responde pela meta:{" "}
                  <ResponsavelEditor
                    token={token}
                    endpoint={`/iniciativas/metas-execucao/${me.id}`}
                    value={me.responsavel}
                    equipe={equipe}
                    listId="equipe-projeto"
                    canWrite={canWrite}
                  />
                </div>
                {me.marcos.map((m) => (
                  <article key={m.id} className="entity-card">
                    <div className="entity-card__top">
                      <strong>
                        {m.codigo ? `${m.codigo} · ` : ""}
                        {m.descricao}
                      </strong>
                      <Badge tone={tonePrazo(m.prazoStatus)}>{m.prazoStatus}</Badge>
                    </div>
                    <div className="dashboard-muted" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span>
                        Quem faz: {m.responsavel || "sem responsável"} · Prazo: {fmt(m.prazoVigente)}
                      </span>
                      <ResponsavelEditor
                        token={token}
                        endpoint={`/iniciativas/marcos/${m.id}`}
                        value={m.responsavel}
                        equipe={equipe}
                        listId="equipe-projeto"
                        canWrite={canWrite}
                      />
                    </div>
                    <ul className="projeto-timeline__subs">
                      {m.subtarefas.map((st) => (
                        <li key={st.id} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span aria-hidden>{st.concluida ? "✓" : "○"}</span>
                          <span>{st.descricao}</span>
                          <span className="dashboard-muted">
                            · {st.responsavel || "sem responsável"}
                          </span>
                          <ResponsavelEditor
                            token={token}
                            endpoint={`/iniciativas/subtarefas/${st.id}`}
                            value={st.responsavel}
                            equipe={equipe}
                            listId="equipe-projeto"
                            canWrite={canWrite}
                          />
                        </li>
                      ))}
                    </ul>
                    {canWrite && (
                      <DesdobramentoForms equipe={equipe} mode="subtarefa" token={token} marcoId={m.id} />
                    )}
                  </article>
                ))}
                {canWrite && (
                  <DesdobramentoForms equipe={equipe}
                    mode="tarefa"
                    token={token}
                    iniciativaId={item.id}
                    metaExecucaoId={me.id}
                  />
                )}
              </div>
            </details>
          ))}

          {!!marcosSemMeta.length && (
            <Card title="Tarefas sem meta de execução">
              {marcosSemMeta.map((m) => (
                <div key={m.id} className="dashboard-list-item">
                  <span>
                    {m.descricao} · {m.responsavel || "sem responsável"}
                  </span>
                  <Badge tone={tonePrazo(m.prazoStatus)}>{m.prazoStatus}</Badge>
                </div>
              ))}
            </Card>
          )}

          {canWrite && !!item.metasExecucao.length && (
            <DesdobramentoForms equipe={equipe} mode="meta" token={token} iniciativaId={item.id} />
          )}
        </div>
      )}

      {aba === "evidencias" && (
        <div className="stack">
          <Card
            title="Registro de evidências"
            subtitle="Foto ou documento + o que foi feito — o gestor valida e atualiza indicadores"
          >
            {canWrite && (
              <div style={{ marginBottom: 16 }}>
                <EvidenciaForm
                  token={token}
                  iniciativaId={item.id}
                  marcos={marcoOptions}
                />
              </div>
            )}
            <div className="stack">
              {item.evidencias.map((e) => (
                <EvidenciaCard
                  key={e.id}
                  evidencia={e}
                  token={token}
                  canValidate={canValidate}
                  metas={item.metasExecucao.map((m) => ({
                    id: m.id,
                    label: `${m.codigo ? `${m.codigo} · ` : ""}${m.nome}${
                      m.indicador ? ` (${m.indicador})` : ""
                    }`,
                  }))}
                />
              ))}
            </div>
            {!item.evidencias.length && (
              <p className="dashboard-muted">
                Nenhuma evidência ainda. Anexe foto/documento e descreva o que foi feito.
              </p>
            )}
          </Card>
          <p className="dashboard-muted">
            Precisa atualizar tarefas?{" "}
            <button type="button" className="linkish" onClick={() => setAba("andamento")}>
              Voltar ao andamento
            </button>
            {" · "}
            <Link href="/carteira" style={{ color: "var(--cip-blue)", fontWeight: 600 }}>
              Carteira
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
