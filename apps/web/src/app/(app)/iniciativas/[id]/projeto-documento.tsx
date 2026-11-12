"use client";

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
import { useState } from "react";
import { Badge, Card } from "@cip/ui";
import { EVIDENCIA_STATUS, EvidenciaCard, type EvidenciaItem } from "./evidencia-actions";
import { EvidenciaEnvio } from "./evidencia-envio";
import { HistoricoProjeto } from "./historico-projeto";
import { ProjetoPastas, STATUS_TAREFA } from "./projeto-pastas";
import { VinculosEditor } from "./vinculos-editor";
import "./projeto.css";

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
  marcosAguardandoValidacao?: string[];
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

const ABAS: Array<{ id: Aba; label: string; icone: string }> = [
  { id: "andamento", label: "Tarefas", icone: "🗂️" },
  { id: "evidencias", label: "Evidências", icone: "📎" },
  { id: "visao", label: "Sobre o projeto", icone: "ℹ️" },
];

type FiltroEvid = "TODAS" | "PENDENTE" | "VERIFICADA" | "REJEITADA";

function situacaoEvid(status: string): FiltroEvid {
  if (status === "VERIFICADA") return "VERIFICADA";
  if (status === "REJEITADA") return "REJEITADA";
  return "PENDENTE";
}

function rotuloSituacao(v: { aplicabilidade: string; situacao: string }) {
  if (v.aplicabilidade === "NAO") return { label: "Não se aplica", tone: "neutral" as const };
  if (v.situacao === "ATENDIDA") return { label: "Atendida", tone: "success" as const };
  if (v.situacao === "DISPENSADA_COM_FUNDAMENTO") return { label: "Dispensada", tone: "info" as const };
  if (v.situacao === "PENDENTE") return { label: "Pendente", tone: "warning" as const };
  return { label: "Em análise", tone: "warning" as const };
}

function EvidenciasPainel({
  item,
  token,
  canSubmitEvidence,
  canWrite,
  canValidate,
  marcoFiltro,
  limparMarco,
}: {
  item: ProjetoDocData;
  token: string;
  canSubmitEvidence: boolean;
  canWrite: boolean;
  canValidate: boolean;
  marcoFiltro: string | null;
  limparMarco: () => void;
}) {
  const [filtro, setFiltro] = useState<FiltroEvid>("TODAS");
  const [novaAberta, setNovaAberta] = useState(canSubmitEvidence && !canWrite);
  const marcoOptions = item.marcos.map((m) => ({
    id: m.id,
    label: m.codigo ? `${m.codigo} · ${m.descricao}` : m.descricao,
  }));
  const marcoValido = marcoFiltro && marcoOptions.some((m) => m.id === marcoFiltro) ? marcoFiltro : null;
  const conta = (f: FiltroEvid) =>
    f === "TODAS" ? item.evidencias.length : item.evidencias.filter((e) => situacaoEvid(e.status) === f).length;
  const lista = item.evidencias.filter(
    (e) => (filtro === "TODAS" || situacaoEvid(e.status) === filtro) && (!marcoValido || e.marcoId === marcoValido),
  );
  const resumo: Array<{ id: FiltroEvid; label: string; cor: string; icone: string }> = [
    { id: "PENDENTE", label: "Aguardando validação", cor: EVIDENCIA_STATUS.DECLARADA.cor, icone: "⏳" },
    { id: "VERIFICADA", label: "Aprovadas", cor: EVIDENCIA_STATUS.VERIFICADA.cor, icone: "✓" },
    { id: "REJEITADA", label: "Devolvidas", cor: EVIDENCIA_STATUS.REJEITADA.cor, icone: "↺" },
  ];

  return (
    <div className="ev-painel">
      <div className="ev-resumo" role="group" aria-label="Filtrar evidências por situação">
        <button type="button" className="ev-resumo__item" aria-pressed={filtro === "TODAS"} onClick={() => setFiltro("TODAS")} style={{ ["--c" as string]: "#7c9cff" }}>
          <span aria-hidden="true">📎</span>
          <b>{conta("TODAS")}</b>
          <small>Todas</small>
        </button>
        {resumo.map((r) => (
          <button key={r.id} type="button" className="ev-resumo__item" aria-pressed={filtro === r.id} onClick={() => setFiltro(r.id)} style={{ ["--c" as string]: r.cor }}>
            <span aria-hidden="true">{r.icone}</span>
            <b>{conta(r.id)}</b>
            <small>{r.label}</small>
          </button>
        ))}
      </div>

      {canSubmitEvidence && (
        <section className="ev-novo">
          <header>
            <div>
              <h3>Enviar nova evidência</h3>
              <p>Foto, vídeo ou documento que comprove o andamento. A consultoria confere e aprova.</p>
            </div>
            {!novaAberta && (
              <button type="button" className="ev-btn" onClick={() => setNovaAberta(true)}>
                + Nova evidência
              </button>
            )}
          </header>
          {novaAberta && (
            <EvidenciaEnvio
              token={token}
              iniciativaId={item.id}
              marcos={marcoOptions}
              marcoId={marcoValido ?? undefined}
              marcoDescricao={marcoValido ? marcoOptions.find((m) => m.id === marcoValido)?.label : undefined}
              onFechar={canWrite ? () => setNovaAberta(false) : undefined}
            />
          )}
        </section>
      )}

      {marcoValido && (
        <p className="ev-filtro-tarefa">
          Mostrando evidências da tarefa <b>{marcoOptions.find((m) => m.id === marcoValido)?.label}</b>
          <button type="button" className="pj-link" onClick={limparMarco}>
            ver todas ✕
          </button>
        </p>
      )}

      {lista.length ? (
        <div className="ev-galeria">
          {lista.map((e) => (
            <EvidenciaCard
              key={e.id}
              evidencia={e}
              token={token}
              canValidate={canValidate}
              metas={item.metasExecucao.map((m) => ({
                id: m.id,
                label: `${m.codigo ? `${m.codigo} · ` : ""}${m.nome}${m.indicador ? ` (${m.indicador})` : ""}`,
              }))}
            />
          ))}
        </div>
      ) : (
        <div className="pj-vazio">
          <span aria-hidden="true">🖼️</span>
          <strong>{item.evidencias.length ? "Nenhuma evidência nesta situação" : "Nenhuma evidência enviada ainda"}</strong>
          <p>
            {item.evidencias.length
              ? "Troque o filtro acima para ver as demais."
              : "As fotos, vídeos e documentos enviados aparecem aqui, com a situação da validação."}
          </p>
        </div>
      )}
    </div>
  );
}

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
    raw === "visao" || raw === "evidencias" || raw === "andamento" ? raw : "andamento";

  const marcosSemMeta = item.marcos.filter((m) => !m.metaExecucaoId);
  const conta = (st: string) => item.marcos.filter((m) => m.prazoStatus === st).length;
  const total = item.marcos.length;
  const concluidas = conta("CONCLUIDO");
  const pct = total ? Math.round((concluidas / total) * 100) : 0;
  const evidPendentes = item.evidencias.filter((e) => situacaoEvid(e.status) === "PENDENTE").length;
  const aguardando = item.marcosAguardandoValidacao ?? [];
  const impedAbertos = item.impedimentos.filter(
    (p) => p.status === "ABERTO" || p.status === "EM_ENCAMINHAMENTO",
  );
  const proxima = item.marcos
    .filter((m) => m.prazoStatus === "NO_PRAZO" && m.prazoVigente)
    .sort((a, b) => String(a.prazoVigente).localeCompare(String(b.prazoVigente)))[0];
  const corAnel =
    conta("VENCIDO") > 0 ? STATUS_TAREFA.VENCIDO.cor : pct === 100 && total ? STATUS_TAREFA.CONCLUIDO.cor : STATUS_TAREFA.NO_PRAZO.cor;
  const correlacionadas = item.secretarias
    .map((s) => s.secretaria)
    .filter((s) => s.id !== item.secretariaPrincipal.id);

  function navegar(next: Aba, marcoId?: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("aba", next);
    if (marcoId) params.set("marcoId", marcoId);
    else params.delete("marcoId");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // "Quem responde": agrupa projeto, metas, tarefas e subtarefas por pessoa.
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
    for (const st of m.subtarefas) registraResponsavel(st.responsavel, `Subtarefa: ${st.descricao}`);
  }

  const bloqueado =
    item.ciclo === "AGUARDANDO_PRE_REQUISITO" || (item.bloqueiosAtivos && item.bloqueiosAtivos.length > 0);

  return (
    <div className="projeto-doc pj">
      <section className="pj-hero" aria-label="Resumo do projeto">
        <div
          className="pj-anel"
          style={{ ["--p" as string]: `${pct}%`, ["--c" as string]: corAnel }}
          role="img"
          aria-label={`${pct}% das tarefas concluídas`}
        >
          <span>
            <b>{pct}%</b>
            <small>concluído</small>
          </span>
        </div>
        <div className="pj-hero__info">
          <div className="pj-hero__tags">
            <span className="pj-tag">🏛️ {item.secretariaPrincipal.nome}</span>
            {correlacionadas.map((s) => (
              <span key={s.id} className="pj-tag pj-tag--soft">🤝 {s.sigla || s.nome}</span>
            ))}
            {item.estruturante && <span className="pj-tag pj-tag--rose">Estruturante</span>}
          </div>
          <p className="pj-hero__meta">
            <span>🎯</span>
            {item.metaEstrategica
              ? <>Contribui para <b>{item.metaEstrategica.nome}</b></>
              : "Ainda sem meta estratégica vinculada"}
          </p>
          <p className="pj-hero__linha">
            <span>👤 {item.responsavel || "Responsável a definir"}</span>
            {proxima && (
              <span>
                ⏭️ Próximo prazo: <b>{new Date(proxima.prazoVigente!).toLocaleDateString("pt-BR")}</b> · {proxima.descricao}
              </span>
            )}
          </p>
        </div>
        <div className="pj-hero__nums">
          {(
            [
              ["VENCIDO", conta("VENCIDO")],
              ["NO_PRAZO", conta("NO_PRAZO")],
              ["SEM_PRAZO", conta("SEM_PRAZO")],
              ["CONCLUIDO", concluidas],
            ] as const
          ).map(([st, n]) => (
            <div key={st} className="pj-num" style={{ ["--c" as string]: STATUS_TAREFA[st].cor }}>
              <b>{n}</b>
              <small>{STATUS_TAREFA[st].label}{st === "CONCLUIDO" ? "s" : n === 1 ? "" : st === "VENCIDO" ? "s" : ""}</small>
            </div>
          ))}
          <div className="pj-num" style={{ ["--c" as string]: "#b9a0ff" }}>
            <b>{evidPendentes + aguardando.length}</b>
            <small>Em validação</small>
          </div>
        </div>
      </section>

      {bloqueado && (
        <div className="bloqueio-alert" role="alert">
          <div>
            <strong>⛔ {item.bloqueioLabel || "Projeto parado aguardando pré-requisito"}</strong>
            <p>
              {textoPorQueParado(
                item.verificacoes.map((v) => ({
                  codigo: v.tipo.codigo || v.tipo.nome,
                  aplicabilidade: v.aplicabilidade === "SIM" ? "sim" : v.aplicabilidade === "NAO" ? "nao" : "a_avaliar",
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
            {!!item.bloqueiosAtivos?.length && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {item.bloqueiosAtivos.map((b) => (
                  <li key={b.perguntaCodigo}>
                    {quizItem(b.perguntaCodigo)?.rotulo || b.perguntaCodigo}: {b.rotulo}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {!!impedAbertos.length && (
        <div className="pj-alerta" role="status">
          <strong>⚠️ {impedAbertos.length} impedimento{impedAbertos.length > 1 ? "s" : ""} em aberto</strong>
          <ul>
            {impedAbertos.map((p) => (
              <li key={p.id}>
                {p.descricao}
                {p.proximoPasso ? ` — próximo passo: ${p.proximoPasso}` : ""}
                {p.responsavel ? ` (${p.responsavel})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <nav className="pj-abas" aria-label="Seções do projeto">
        {ABAS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={aba === t.id ? "page" : undefined}
            className={aba === t.id ? "pj-aba is-on" : "pj-aba"}
            onClick={() => navegar(t.id)}
          >
            <span aria-hidden="true">{t.icone}</span> {t.label}
            {t.id === "andamento" && <span className="pj-aba__n">{total}</span>}
            {t.id === "evidencias" && evidPendentes > 0 && <span className="pj-aba__n pj-aba__n--alerta">{evidPendentes}</span>}
          </button>
        ))}
      </nav>

      {aba === "andamento" && (
        <div className="stack">
          <ProjetoPastas
            metasExecucao={item.metasExecucao}
            marcosSemMeta={marcosSemMeta}
            evidencias={item.evidencias}
            aguardando={aguardando}
            canWrite={canWrite}
            canSubmitEvidence={canSubmitEvidence}
            token={token}
            equipe={equipe}
            iniciativaId={item.id}
            onVerEvidencias={(marcoId) => navegar("evidencias", marcoId)}
          />
          <details className="pj-secao">
            <summary>💬 Avisos e conversa do projeto</summary>
            <ComunicacaoProjeto token={token} iniciativaId={item.id} canWrite={canWrite} />
          </details>
        </div>
      )}

      {aba === "evidencias" && (
        <EvidenciasPainel
          item={item}
          token={token}
          canSubmitEvidence={canSubmitEvidence}
          canWrite={canWrite}
          canValidate={canValidate}
          marcoFiltro={requestedMarcoId}
          limparMarco={() => navegar("evidencias")}
        />
      )}

      {aba === "visao" && (
        <div className="stack">
          <div className="dashboard-grid-2">
            <Card title="🎯 Meta estratégica">
              {item.metaEstrategica ? (
                <div className="pj-meta-est">
                  <strong>
                    {item.metaEstrategica.codigo ? `${item.metaEstrategica.codigo} · ` : ""}
                    {item.metaEstrategica.nome}
                  </strong>
                  <dl>
                    <div><dt>Indicador</dt><dd>{item.metaEstrategica.indicador || "—"}</dd></div>
                    <div><dt>Ponto de partida</dt><dd>{item.metaEstrategica.valorBase || "—"}</dd></div>
                    <div>
                      <dt>Alvo</dt>
                      <dd>
                        {item.metaEstrategica.alvo || "—"}
                        {item.metaEstrategica.unidade ? ` ${item.metaEstrategica.unidade}` : ""}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="dashboard-muted" style={{ margin: 0 }}>
                  {item.estruturante
                    ? "Projeto estruturante precisa de meta estratégica — a consultoria faz o vínculo."
                    : "Nenhuma meta estratégica vinculada."}
                </p>
              )}
            </Card>
            <Card title="🏛️ Secretarias e responsável">
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
            </Card>
          </div>

          <Card title="👥 Quem responde por quê" subtitle="Tudo o que cada pessoa tem sob responsabilidade neste projeto">
            {!porResponsavel.size && (
              <p className="dashboard-muted">Ninguém definido ainda.</p>
            )}
            <div className="pj-pessoas">
              {[...porResponsavel.entries()]
                .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
                .map(([nomeResp, itens]) => (
                  <details key={nomeResp} className="pj-pessoa">
                    <summary>
                      <span className="pj-pessoa__avatar" aria-hidden="true">
                        {nomeResp.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <strong>{nomeResp}</strong>
                      <small>{itens.length} ite{itens.length > 1 ? "ns" : "m"}</small>
                    </summary>
                    <ul>
                      {itens.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </details>
                ))}
            </div>
            {!!semResponsavel.length && (
              <p className="pj-alerta" style={{ marginTop: 12 }}>
                <strong>{semResponsavel.length} item(ns) sem responsável:</strong>{" "}
                {semResponsavel.slice(0, 6).join(" · ")}
                {semResponsavel.length > 6 ? " …" : ""}
              </p>
            )}
          </Card>

          {(!!item.verificacoes.length || !!item.respostasViabilidade?.length) && (
            <details className="pj-secao">
              <summary>📋 Diagnóstico do cadastro (condicionantes e respostas)</summary>
              <div className="stack" style={{ marginTop: 12 }}>
                {GRUPOS_DOCUMENTO.map((grupo) => {
                  const itens = item.verificacoes.filter((v) => quizItem(v.tipo.codigo || "")?.grupo === grupo.id);
                  if (!itens.length) return null;
                  return (
                    <div key={grupo.id}>
                      <h4 className="pj-subtitulo">{grupo.nome}</h4>
                      {itens.map((v) => {
                        const r = rotuloSituacao(v);
                        return (
                          <div key={v.id} className="dashboard-list-item">
                            <div>
                              <strong>{v.tipo.nome}</strong>
                              <div className="dashboard-muted">{v.justificativa || v.proximaAcao || "—"}</div>
                            </div>
                            <Badge tone={r.tone}>{r.label}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {item.verificacoes
                  .filter((v) => !quizItem(v.tipo.codigo || ""))
                  .map((v) => {
                    const r = rotuloSituacao(v);
                    return (
                      <div key={v.id} className="dashboard-list-item">
                        <div>
                          <strong>{v.tipo.nome}</strong>
                          <div className="dashboard-muted">{v.justificativa || "—"}</div>
                        </div>
                        <Badge tone={r.tone}>{r.label}</Badge>
                      </div>
                    );
                  })}
                {!!item.respostasViabilidade?.length && (
                  <div>
                    <h4 className="pj-subtitulo">Respostas do cadastro</h4>
                    {item.respostasViabilidade.map((resposta) => (
                      <div key={resposta.id} className="dashboard-list-item">
                        <div>
                          <strong>{resposta.perguntaTexto}</strong>
                          <div className="dashboard-muted">{respostaLegivel(resposta.perguntaCodigo, resposta.valor)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )}

          <details className="pj-secao">
            <summary>🕘 Histórico do projeto</summary>
            <HistoricoProjeto iniciativaId={item.id} token={token} />
          </details>
        </div>
      )}
    </div>
  );
}
