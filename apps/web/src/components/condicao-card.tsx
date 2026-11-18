"use client";

import { Children, isValidElement, cloneElement, useId, type ReactElement, type ReactNode } from "react";
import { AjudaCampo } from "@/components/ajuda-campo";
import {
  RESPOSTA_FECHADA_LABEL,
  RESPOSTA_FECHADA_OPCOES,
  deRespostaFechada,
  parseCondicaoResposta,
  respostaFechada,
  type CondicaoResposta,
  type ModeloPerguntaDef,
  type RespostaFechada,
} from "@cip/shared";

export type CondicaoValorState = string | CondicaoResposta;

function CampoComAjuda({
  mostrar,
  campo,
  ajuda,
  children,
}: {
  mostrar?: boolean;
  campo: string;
  ajuda: string;
  children: ReactElement<{ children: ReactNode }>;
}) {
  const fieldId = useId();
  if (!mostrar) return <>{children}</>;
  const [caption, ...controls] = Children.toArray(children.props.children);
  return (
    <div className="condicao-card__field">
      <div className="rotulo-com-ajuda">
        <label htmlFor={fieldId}>{caption}</label>
        <AjudaCampo campo={campo}>{ajuda}</AjudaCampo>
      </div>
      {controls.map((control) =>
        isValidElement<{ id?: string }>(control) &&
        ["input", "select", "textarea"].includes(String(control.type))
          ? cloneElement(control, { id: fieldId })
          : control,
      )}
    </div>
  );
}

export function CondicaoCard({
  pergunta,
  valor,
  onChange,
  mostrarAjuda = false,
}: {
  pergunta: ModeloPerguntaDef;
  valor: CondicaoValorState | undefined;
  onChange: (next: CondicaoValorState) => void;
  mostrarAjuda?: boolean;
}) {
  const parsed = parseCondicaoResposta(pergunta.codigo, valor ?? "a_avaliar");
  const fechada = respostaFechada(parsed);
  const rotulo = pergunta.rotulo || pergunta.texto;
  const perguntaTxt = pergunta.pergunta || pergunta.texto;
  const isSelecao = pergunta.tipoResposta === "SELECAO";
  const isNumero = pergunta.tipoResposta === "NUMERO";
  const isTexto = pergunta.tipoResposta === "TEXTO";
  const isFechada = pergunta.tipoResposta === "CONDICAO_FECHADA";
  const isImpedimento = pergunta.metadados?.impedimento === true;

  const followUps = pergunta.camposFollowUp || [];
  const selecaoAtual =
    typeof valor === "string"
      ? valor
      : typeof parsed.detalhes?._selecao === "string"
        ? String(parsed.detalhes._selecao)
        : "";
  const showFollowUps =
    followUps.length > 0 &&
    (isSelecao
      ? Boolean(selecaoAtual && (!pergunta.opcoesComDetalhes || pergunta.opcoesComDetalhes.includes(selecaoAtual)))
      : fechada === "pendente" || fechada === "atendida");

  function setFechada(next: RespostaFechada) {
    onChange({
      codigo: pergunta.codigo,
      ...deRespostaFechada(next),
      fundamento: parsed.fundamento,
      proximoPasso: parsed.proximoPasso,
      responsavel: parsed.responsavel,
      detalhes: parsed.detalhes,
    });
  }

  function patchMeta(partial: Partial<CondicaoResposta>) {
    onChange({ ...parsed, ...partial });
  }

  function selecionarAplicabilidade(value: string) {
    if (value === "SIM") {
      patchMeta({
        aplicabilidade: "sim",
        situacao:
          parsed.aplicabilidade === "sim" &&
          (parsed.situacao === "atendida" || parsed.situacao === "pendente")
            ? parsed.situacao
            : "pendente",
      });
      return;
    }

    if (value === "") {
      patchMeta({ aplicabilidade: "a_avaliar", situacao: "em_analise" });
      return;
    }

    patchMeta({
      aplicabilidade: "nao",
      situacao:
        value === "NAO_SE_APLICA"
          ? "dispensada_com_fundamento"
          : "em_analise",
    });
  }

  function patchDetalhe(chave: string, v: string) {
    const detalhes = { ...(parsed.detalhes || {}), [chave]: v === "" ? null : v };
    if (isSelecao) {
      onChange({
        codigo: pergunta.codigo,
        aplicabilidade: "sim",
        situacao: "pendente",
        detalhes: { ...detalhes, _selecao: selecaoAtual || detalhes._selecao || null },
      });
      return;
    }
    onChange({ ...parsed, detalhes });
  }

  return (
    <section className="condicao-card" aria-labelledby={`cond-${pergunta.codigo}`}>
      <h3 id={`cond-${pergunta.codigo}`} className="condicao-card__rotulo">
        {rotulo}
        {pergunta.obrigatoria ? " *" : ""}
        {pergunta.impacto === "BLOQUEANTE" ? (
          <span className="condicao-card__tag">bloqueante</span>
        ) : null}
      </h3>
      <div className="rotulo-com-ajuda">
        <p className="condicao-card__pergunta">{perguntaTxt}</p>
        {mostrarAjuda && pergunta.ajuda ? <AjudaCampo campo={rotulo}>{pergunta.ajuda}</AjudaCampo> : null}
      </div>
      {!mostrarAjuda && pergunta.ajuda ? (
        <p className="condicao-card__ajuda">{pergunta.ajuda}</p>
      ) : null}

      {isSelecao ? (
        <CampoComAjuda mostrar={mostrarAjuda} campo={rotulo} ajuda={pergunta.ajuda || perguntaTxt}>
        <label className="condicao-card__field">
          <span>Situação</span>
          <select
            value={selecaoAtual}
            onChange={(e) => {
              const sel = e.target.value;
              if (followUps.length && sel && (!pergunta.opcoesComDetalhes || pergunta.opcoesComDetalhes.includes(sel))) {
                onChange({
                  codigo: pergunta.codigo,
                  aplicabilidade: "sim",
                  situacao: "pendente",
                  detalhes: { ...(parsed.detalhes || {}), _selecao: sel },
                });
              } else {
                onChange(sel);
              }
            }}
          >
            <option value="">Selecione</option>
            {(pergunta.opcoes || []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        </CampoComAjuda>
      ) : null}

      {isNumero ? (
        <CampoComAjuda mostrar={mostrarAjuda} campo={rotulo} ajuda={pergunta.ajuda || perguntaTxt}>
        <label className="condicao-card__field">
          <span>Valor</span>
          <input
            type="number"
            min={0}
            value={typeof valor === "string" || typeof valor === "number" ? String(valor) : ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
        </CampoComAjuda>
      ) : null}

      {isTexto ? (
        <CampoComAjuda mostrar={mostrarAjuda} campo={rotulo} ajuda={pergunta.ajuda || perguntaTxt}>
        <label className="condicao-card__field">
          <span>Resposta</span>
          <textarea
            rows={3}
            value={typeof valor === "string" ? valor : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={pergunta.ajuda || undefined}
          />
        </label>
        </CampoComAjuda>
      ) : null}

      {(isFechada ||
        pergunta.tipoResposta === "SIM_NAO" ||
        pergunta.tipoResposta === "SIM_NAO_ANDAMENTO") &&
      !isSelecao &&
      !isNumero &&
      !isTexto ? (
        <>
          {isImpedimento ? (
            <CampoComAjuda mostrar={mostrarAjuda} campo={rotulo} ajuda={pergunta.ajuda || perguntaTxt}>
            <label className="condicao-card__field">
              <span>Este item é necessário?</span>
              <select
                required={pergunta.obrigatoria}
                value={
                  parsed.aplicabilidade === "sim"
                    ? "SIM"
                    : parsed.aplicabilidade === "nao" &&
                        parsed.situacao === "dispensada_com_fundamento"
                      ? "NAO_SE_APLICA"
                      : parsed.aplicabilidade === "nao"
                        ? "NAO"
                        : ""
                }
                onChange={(event) =>
                  selecionarAplicabilidade(event.target.value)
                }
              >
                <option value="">Selecione</option>
                <option value="SIM">Sim</option>
                <option value="NAO">Não</option>
                <option value="NAO_SE_APLICA">Não se aplica</option>
              </select>
            </label>
            </CampoComAjuda>
          ) : (
            <CampoComAjuda mostrar={mostrarAjuda} campo={rotulo} ajuda={pergunta.ajuda || perguntaTxt}>
            <label className="condicao-card__field">
              <span>Situação: {rotulo}</span>
              <select
                value={
                  isFechada
                    ? fechada
                    : typeof valor === "string"
                      ? valor === "SIM"
                        ? "atendida"
                        : valor === "NAO"
                          ? "pendente"
                          : valor === "EM_ANDAMENTO"
                            ? "a_avaliar"
                            : "a_avaliar"
                      : "a_avaliar"
                }
                onChange={(e) => {
                  const v = e.target.value as RespostaFechada;
                  if (isFechada) setFechada(v);
                  else if (v === "atendida") onChange("SIM");
                  else if (v === "pendente") onChange("NAO");
                  else if (v === "nao_se_aplica") onChange("NAO");
                  else onChange("EM_ANDAMENTO");
                }}
              >
                {RESPOSTA_FECHADA_OPCOES.map((o) => (
                  <option key={o} value={o}>
                    {RESPOSTA_FECHADA_LABEL[o]}
                  </option>
                ))}
              </select>
            </label>
            </CampoComAjuda>
          )}

          {isImpedimento && parsed.aplicabilidade === "sim" ? (
            <CampoComAjuda mostrar={mostrarAjuda} campo="Situação do item" ajuda="Indique se o item necessário já foi atendido ou ainda está pendente.">
            <label className="condicao-card__field">
              <span>Situação do item</span>
              <select
                value={
                  parsed.situacao === "atendida" ? "atendida" : "pendente"
                }
                onChange={(event) =>
                  patchMeta({
                    aplicabilidade: "sim",
                    situacao: event.target.value as "atendida" | "pendente",
                  })
                }
              >
                <option value="pendente">Pendente</option>
                <option value="atendida">Atendido</option>
              </select>
            </label>
            </CampoComAjuda>
          ) : null}

          {isFechada ? (
            <>
              <CampoComAjuda mostrar={mostrarAjuda} campo="Fundamento" ajuda="Informe a fonte, documento ou avaliação que justifica a situação informada.">
              <label className="condicao-card__field">
                <span>
                  {fechada === "nao_se_aplica"
                    ? pergunta.metadados?.seNao || "Por que não se aplica?"
                    : "O que sustenta essa informação?"}
                </span>
                <textarea
                  rows={2}
                  value={parsed.fundamento || ""}
                  onChange={(e) => patchMeta({ fundamento: e.target.value })}
                  placeholder="Fonte, documento ou avaliação da área competente"
                />
              </label>
              </CampoComAjuda>
              {(fechada === "pendente" || fechada === "a_avaliar") && (
                <div className="condicao-card__grid">
                  <CampoComAjuda mostrar={mostrarAjuda} campo="Próxima providência" ajuda="Descreva a próxima ação necessária para resolver ou avaliar este item.">
                  <label className="condicao-card__field">
                    <span>Próxima providência</span>
                    <input
                      value={parsed.proximoPasso || ""}
                      onChange={(e) => patchMeta({ proximoPasso: e.target.value })}
                      placeholder="Ex.: solicitar avaliação à área financeira"
                    />
                  </label>
                  </CampoComAjuda>
                  <CampoComAjuda mostrar={mostrarAjuda} campo="Responsável pelo acompanhamento" ajuda="Informe a pessoa ou área responsável pelo acompanhamento da próxima providência.">
                  <label className="condicao-card__field">
                    <span>Responsável pelo acompanhamento</span>
                    <input
                      value={parsed.responsavel || ""}
                      onChange={(e) => patchMeta({ responsavel: e.target.value })}
                      placeholder="Nome da pessoa ou área responsável"
                    />
                  </label>
                  </CampoComAjuda>
                </div>
              )}
            </>
          ) : null}
        </>
      ) : null}

      {showFollowUps ? (
        <div className="condicao-card__detalhe">
          <p className="condicao-card__detalhe-title">Dados deste projeto</p>
          {followUps.map((campo) => {
            const raw = parsed.detalhes?.[campo.chave];
            const val = raw === null || raw === undefined ? "" : String(raw);
            return (
              <CampoComAjuda key={campo.chave} mostrar={mostrarAjuda} campo={campo.label} ajuda={campo.ajuda || campo.placeholder || `Informe ${campo.label.toLowerCase()} para detalhar este item do projeto.`}>
              <label className="condicao-card__field">
                <span>{campo.label}</span>
                {campo.tipo === "textarea" ? (
                  <textarea
                    rows={3}
                    value={val}
                    placeholder={campo.placeholder}
                    onChange={(e) => patchDetalhe(campo.chave, e.target.value)}
                  />
                ) : (
                  <input
                    type={campo.tipo === "numero" || campo.tipo === "moeda" ? "number" : "text"}
                    min={0}
                    step={campo.tipo === "moeda" ? "0.01" : undefined}
                    value={val}
                    placeholder={campo.placeholder}
                    onChange={(e) => patchDetalhe(campo.chave, e.target.value)}
                  />
                )}
                {campo.ajuda ? (
                  <span className="condicao-card__ajuda">{campo.ajuda}</span>
                ) : null}
              </label>
              </CampoComAjuda>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
