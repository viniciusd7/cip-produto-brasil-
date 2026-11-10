"use client";

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

export function CondicaoCard({
  pergunta,
  valor,
  onChange,
}: {
  pergunta: ModeloPerguntaDef;
  valor: CondicaoValorState | undefined;
  onChange: (next: CondicaoValorState) => void;
}) {
  const parsed = parseCondicaoResposta(pergunta.codigo, valor ?? "a_avaliar");
  const fechada = respostaFechada(parsed);
  const rotulo = pergunta.rotulo || pergunta.texto;
  const perguntaTxt = pergunta.pergunta || pergunta.texto;
  const isSelecao = pergunta.tipoResposta === "SELECAO";
  const isNumero = pergunta.tipoResposta === "NUMERO";
  const isTexto = pergunta.tipoResposta === "TEXTO";
  const isFechada = pergunta.tipoResposta === "CONDICAO_FECHADA";

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
      <p className="condicao-card__pergunta">{perguntaTxt}</p>
      {pergunta.ajuda ? (
        <p className="condicao-card__ajuda">{pergunta.ajuda}</p>
      ) : null}

      {isSelecao ? (
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
      ) : null}

      {isNumero ? (
        <label className="condicao-card__field">
          <span>Valor</span>
          <input
            type="number"
            min={0}
            value={typeof valor === "string" || typeof valor === "number" ? String(valor) : ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      ) : null}

      {isTexto ? (
        <label className="condicao-card__field">
          <span>Resposta</span>
          <textarea
            rows={3}
            value={typeof valor === "string" ? valor : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={pergunta.ajuda || undefined}
          />
        </label>
      ) : null}

      {(isFechada ||
        pergunta.tipoResposta === "SIM_NAO" ||
        pergunta.tipoResposta === "SIM_NAO_ANDAMENTO") &&
      !isSelecao &&
      !isNumero &&
      !isTexto ? (
        <>
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

          {isFechada ? (
            <>
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
              {(fechada === "pendente" || fechada === "a_avaliar") && (
                <div className="condicao-card__grid">
                  <label className="condicao-card__field">
                    <span>Próxima providência</span>
                    <input
                      value={parsed.proximoPasso || ""}
                      onChange={(e) => patchMeta({ proximoPasso: e.target.value })}
                      placeholder="Ex.: solicitar avaliação à área financeira"
                    />
                  </label>
                  <label className="condicao-card__field">
                    <span>Quem acompanha</span>
                    <input
                      value={parsed.responsavel || ""}
                      onChange={(e) => patchMeta({ responsavel: e.target.value })}
                      placeholder="Pessoa ou área competente"
                    />
                  </label>
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
              <label key={campo.chave} className="condicao-card__field">
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
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
