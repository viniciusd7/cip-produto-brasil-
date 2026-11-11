"use client";

import Link from "next/link";
import { ComunicacaoProjeto } from "@/components/comunicacao-projeto";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GRUPOS_CONDICOES,
  MODELO_ACAO_DIARIA,
  MODELO_PLANO_GOVERNO,
  buildCatalogoPerguntas,
  formatarDetalhes,
  quizItem,
  textoPorQueParado,
} from "@cip/shared";
import { Badge, Card } from "@cip/ui";
import { FluxoArvore, type FluxoNode } from "@/components/fluxo-arvore";
import { EvidenciaCard, type EvidenciaItem } from "./evidencia-actions";
import { EvidenciaForm } from "./evidencia-form";
import { VinculosEditor } from "./vinculos-editor";
import { TarefasBoard } from "./tarefas-board";

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
  concluidoEm?: string | null;
  gravidade?: string | null;
  metaExecucaoId?: string | null;
  responsavel?: string | null;
  subtarefas: Array<{
    id: string;
    descricao: string;
    concluida: boolean;
    responsavel?: string | null;
  }>;
  reprogramacoes: Array<{ id: string; motivo: string; dataNova?: string; dataAnterior?: string | null }>;
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
  metaEstrategica?: {
    id: string;
    nome: string;
    codigo?: string | null;
    indicador?: string | null;
    valorBase?: string | null;
    alvo?: string | null;
    unidade?: string | null;
    perspectivaBsc?: string | null;
    resultadoChaveOkr?: string | null;
  } | null;
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
  respostasViabilidade?: Array<{
    id: string;
    perguntaCodigo: string;
    perguntaTexto: string;
    valor: unknown;
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

const ROTULOS_CAMPOS = new Map(
  [...buildCatalogoPerguntas(), ...MODELO_ACAO_DIARIA.perguntas, ...MODELO_PLANO_GOVERNO.perguntas]
    .map((p) => [p.codigo, Object.fromEntries((p.camposFollowUp || []).map((c) => [c.chave, c.label]))]),
);
const GRUPOS_DOCUMENTO = [
  { id: "planejamento", nome: "Planejamento" },
  ...GRUPOS_CONDICOES,
];

type Aba = "visao" | "andamento" | "evidencias";

function respostaLegivel(codigo: string, valor: unknown): string {
  if (valor === null || valor === undefined) return "A confirmar";
  if (typeof valor !== "object" || Array.isArray(valor)) return String(valor);
  const obj = valor as Record<string, unknown>;
  const detalhes = obj.detalhes && typeof obj.detalhes === "object" && !Array.isArray(obj.detalhes)
    ? obj.detalhes as Record<string, string | number | null>
    : undefined;
  const selecao = detalhes?._selecao;
  const principal = typeof selecao === "string" ? selecao : obj.situacao === "atendida" ? "Atendida" : obj.situacao === "pendente" ? "Pendente" : "A confirmar";
  const complemento = formatarDetalhes(detalhes, ROTULOS_CAMPOS.get(codigo));
  return complemento ? `${principal} · ${complemento}` : principal;
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
  canSubmitEvidence,
  canValidate,
  token,
  equipe,
  todasSecretarias,
}: {
  item: ProjetoDocData;
  canWrite: boolean;
  canSubmitEvidence: boolean;
  canValidate: boolean;
  token: string;
  /** Nomes da equipe das pastas envolvidas (sugestões de responsável). */
  equipe: string[];
  todasSecretarias: SecretariaRef[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("aba");
  const requestedMarcoId = searchParams.get("marcoId");
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

  function marcoParaNo(m: ProjetoDocMarco): FluxoNode {
    return {
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
    };
  }

  const fluxoNodes: FluxoNode[] = [
    ...item.metasExecucao.map((me) => {
      const prog = metaProgress(me);
      return {
        id: me.id,
        codigo: me.codigo,
        nome: me.nome,
        nivel: "META" as const,
        indicador: me.indicador,
        alvo: me.alvo,
        status: me.status,
        progresso: prog.pct,
        responsavel: me.responsavel,
        children: me.marcos.map(marcoParaNo),
      };
    }),
    ...marcosSemMeta.map(marcoParaNo),
  ];

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

      <section className="projeto-metas-destaque" aria-label="Metas do projeto">
        <article className="projeto-indicador-chip projeto-indicador-chip--estrategica">
          <div className="projeto-indicador-chip__head">
            <strong>Meta estratégica</strong>
            <Badge tone={item.metaEstrategica ? "info" : "warning"}>
              {item.metaEstrategica ? "Vinculada" : "Pendente"}
            </Badge>
          </div>
          {item.metaEstrategica ? (
            <>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {item.metaEstrategica.codigo ? `${item.metaEstrategica.codigo} · ` : ""}
                {item.metaEstrategica.nome}
              </p>
              <div className="projeto-indicador-chip__metrics">
                <div>
                  <span className="projeto-indicador-chip__label">Indicador</span>
                  <p>{item.metaEstrategica.indicador || "—"}</p>
                </div>
                <div>
                  <span className="projeto-indicador-chip__label">Base / Alvo</span>
                  <p>
                    {item.metaEstrategica.valorBase || "—"} / {item.metaEstrategica.alvo || "—"}
                    {item.metaEstrategica.unidade ? ` ${item.metaEstrategica.unidade}` : ""}
                  </p>
                </div>
              </div>
              {(item.metaEstrategica.perspectivaBsc || item.metaEstrategica.resultadoChaveOkr) && (
                <span className="dashboard-muted">
                  {[
                    item.metaEstrategica.perspectivaBsc && `BSC: ${item.metaEstrategica.perspectivaBsc}`,
                    item.metaEstrategica.resultadoChaveOkr && `OKR: ${item.metaEstrategica.resultadoChaveOkr}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </>
          ) : (
            <p className="dashboard-muted" style={{ margin: 0 }}>
              {item.estruturante
                ? "Obrigatória para projeto estruturante — vincule na aba Visão."
                : "Nenhuma meta estratégica vinculada."}
            </p>
          )}
        </article>
      </section>

      <section className="projeto-indicadores" aria-label="Metas de execução">
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
                <strong>Meta de execução · {me.nome}</strong>
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

          {!!item.respostasViabilidade?.length && (
            <Card title="Respostas do cadastro">
              {item.respostasViabilidade.map((resposta) => (
                <div key={resposta.id} className="dashboard-list-item">
                  <div>
                    <strong>{resposta.perguntaTexto}</strong>
                    <div className="dashboard-muted">{respostaLegivel(resposta.perguntaCodigo, resposta.valor)}</div>
                  </div>
                </div>
              ))}
            </Card>
          )}

          <div className="dashboard-grid-2">
            <Card title="Condicionantes por grupo">
              {GRUPOS_DOCUMENTO.map((grupo) => {
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
            Board de tarefas por status · avance, atraso e conclusão. Agrupe pela meta de execução abaixo.
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

          <ComunicacaoProjeto token={token} iniciativaId={item.id} canWrite={canWrite} />

          <TarefasBoard
            metasExecucao={item.metasExecucao}
            marcosSemMeta={marcosSemMeta}
            canWrite={canWrite}
            token={token}
            equipe={equipe}
            iniciativaId={item.id}
          />
        </div>
      )}

      {aba === "evidencias" && (
        <div className="stack">
          <Card
            title="Registro de evidências"
            subtitle="Registre o avanço com foto, vídeo ou documento. A consultoria valida."
          >
            {canSubmitEvidence && (
              <div style={{ marginBottom: 16 }}>
                <EvidenciaForm
                  token={token}
                  iniciativaId={item.id}
                  marcos={marcoOptions}
                  initialMarcoId={
                    marcoOptions.some((marco) => marco.id === requestedMarcoId)
                      ? requestedMarcoId ?? undefined
                      : undefined
                  }
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
