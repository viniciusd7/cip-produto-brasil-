"use client";

import {
  CARRETAS_ETAPAS,
  CARRETAS_FICHA_CAMPOS,
  CARRETAS_GATES,
  CARRETAS_INDICADORES,
  CARRETAS_ORCAMENTO,
  CARRETAS_POPS,
  CARRETAS_PRESTACAO,
  CARRETAS_RISCOS,
  type CarretasDossie,
} from "@cip/shared";
import { useEffect, useState, type FormEvent } from "react";
import { API_URL } from "@/lib/api";

type DossiePayload = {
  revision: number;
  dossie: CarretasDossie;
  updatedAt: string | null;
};

function Campo({
  label,
  ajuda,
  valor,
  tipo = "text",
  desabilitado,
  aoAlterar,
}: {
  label: string;
  ajuda?: string;
  valor: string;
  tipo?: "text" | "date" | "decimal" | "textarea";
  desabilitado: boolean;
  aoAlterar: (valor: string) => void;
}) {
  return (
    <label className="carretas-campo">
      <span>{label}</span>
      {tipo === "textarea" ? (
        <textarea
          value={valor}
          maxLength={4000}
          disabled={desabilitado}
          onChange={(event) => aoAlterar(event.target.value)}
        />
      ) : (
        <input
          type={tipo === "date" ? "date" : "text"}
          inputMode={tipo === "decimal" ? "decimal" : undefined}
          value={valor}
          maxLength={tipo === "decimal" ? 32 : 4000}
          placeholder={tipo === "decimal" ? "A definir" : "A definir"}
          disabled={desabilitado}
          onChange={(event) => aoAlterar(event.target.value)}
        />
      )}
      {ajuda && <small>{ajuda}</small>}
    </label>
  );
}

function Seletor({
  label,
  valor,
  opcoes,
  desabilitado,
  aoAlterar,
}: {
  label: string;
  valor: string;
  opcoes: Array<[string, string]>;
  desabilitado: boolean;
  aoAlterar: (valor: string) => void;
}) {
  return (
    <label className="carretas-campo">
      <span>{label}</span>
      <select value={valor} disabled={desabilitado} onChange={(event) => aoAlterar(event.target.value)}>
        {opcoes.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </select>
    </label>
  );
}

const situacoesGate: Array<[string, string]> = [
  ["PENDENTE", "Pendente"],
  ["EM_ANALISE", "Em análise"],
  ["APROVADO", "Aprovado"],
  ["APROVADO_COM_CORRECOES", "Aprovado com correções"],
  ["NAO_APROVADO", "Não aprovado"],
];
const situacoesCriterio: Array<[string, string]> = [
  ["PENDENTE", "Pendente"],
  ["ATENDIDO", "Atendido com evidência"],
  ["NAO_APLICAVEL", "Não aplicável — justificar"],
  ["BLOQUEADO", "Bloqueado"],
];
const situacoesEtapa: Array<[string, string]> = [
  ["PENDENTE", "Pendente"],
  ["EM_ANDAMENTO", "Em andamento"],
  ["CONCLUIDO", "Concluído"],
  ["BLOQUEADO", "Bloqueado"],
];

export function CarretasDossie({
  iniciativaId,
  token,
  canWrite,
}: {
  iniciativaId: string;
  token: string;
  canWrite: boolean;
}) {
  const [payload, setPayload] = useState<DossiePayload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState("");
  const dossie = payload?.dossie ?? null;

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/iniciativas/${iniciativaId}/carretas-dossie`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error?.message || `Não foi possível carregar o dossiê (${response.status}).`);
        }
        return body.data as DossiePayload;
      })
      .then((data) => {
        if (active) {
          setPayload(data);
          setErro("");
        }
      })
      .catch((error: unknown) => {
        if (active) setErro(error instanceof Error ? error.message : "Não foi possível carregar o dossiê.");
      })
      .finally(() => {
        if (active) setCarregando(false);
      });
    return () => { active = false; };
  }, [iniciativaId, token]);

  function alterar(mutacao: (rascunho: CarretasDossie) => void) {
    setPayload((atual) => {
      if (!atual) return atual;
      const rascunho = structuredClone(atual.dossie);
      mutacao(rascunho);
      return { ...atual, dossie: rascunho };
    });
    setSalvo("");
  }

  function atualizarLista<
    K extends "gates" | "cronograma" | "orcamento" | "riscos" | "indicadores" | "pops" | "prestacao",
  >(
    lista: K,
    codigo: string,
    atualizar: (linha: CarretasDossie[K][number]) => CarretasDossie[K][number],
  ) {
    alterar((rascunho) => {
      const linhas = rascunho[lista].map((linha) =>
        linha.codigo === codigo ? atualizar(linha) : linha,
      );
      Object.assign(rascunho, { [lista]: linhas });
    });
  }

  function atualizarCriterio(gateCodigo: string, criterioCodigo: string, campo: string, valor: string) {
    alterar((rascunho) => {
      const gate = rascunho.gates.find((item) => item.codigo === gateCodigo);
      const criterio = gate?.criterios.find((item) => item.codigo === criterioCodigo);
      if (criterio && (campo === "situacao" || campo === "responsavel" || campo === "evidencia" || campo === "ajusteLocal")) {
        criterio[campo] = valor;
      }
    });
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload || !canWrite) return;
    setSalvando(true);
    setErro("");
    setSalvo("");
    try {
      const response = await fetch(`${API_URL}/iniciativas/${iniciativaId}/carretas-dossie`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ revision: payload.revision, dossie: payload.dossie }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error?.message || `Não foi possível salvar as alterações (${response.status}).`);
      }
      setPayload(body.data as DossiePayload);
      setSalvo("Dossiê salvo. O histórico de alterações foi registrado.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar as alterações.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="carretas-aviso">Carregando o dossiê de validação…</p>;
  if (erro && !dossie) {
    return <p className="carretas-erro" role="alert">{erro}</p>;
  }
  if (!dossie) {
    return <p className="carretas-erro" role="alert">O dossiê não está disponível. Recarregue o projeto ou peça suporte.</p>;
  }

  const gruposFicha = [...new Set(CARRETAS_FICHA_CAMPOS.map((campo) => campo.grupo))];
  const criteriosPendentes = dossie.gates.reduce(
    (total, gate) => total + gate.criterios.filter((criterio) => criterio.situacao === "PENDENTE").length,
    0,
  );

  return (
    <form className="carretas-dossie" onSubmit={salvar}>
      <header className="carretas-cabecalho">
        <div>
          <p className="carretas-kicker">Projeto de referência · versão 2.0</p>
          <h2>Dossiê de validação do piloto</h2>
          <p>
            Estrutura de planejamento administrativo para confirmar campos, responsáveis,
            evidências e decisões com a prefeitura.
          </p>
        </div>
        <span className="carretas-status">Em validação com o cliente</span>
      </header>

      <div className="carretas-limite" role="note">
        <strong>Modelo de referência — não é autorização de operação.</strong>
        <p>
          Não há oferta municipal, prestador, agenda, capacidade, custo, data ou autorização
          confirmados neste cadastro. Use “A definir” até validação. Não inclua nomes de
          pacientes, diagnósticos, prontuários ou listas identificáveis; esses dados não
          pertencem a este dossiê.
        </p>
      </div>

      <div className="carretas-resumo" aria-label="Resumo de validação">
        <div><strong>{dossie.gates.length}</strong><span>portões de decisão</span></div>
        <div><strong>{criteriosPendentes}</strong><span>critérios ainda pendentes</span></div>
        <div><strong>{dossie.riscos.length}</strong><span>riscos preventivos</span></div>
        <div><strong>{dossie.indicadores.length}</strong><span>indicadores sem metas presumidas</span></div>
      </div>

      <details className="carretas-secao" open>
        <summary><span>Ficha local e perguntas de decisão</span><small>{CARRETAS_FICHA_CAMPOS.length} campos · todos editáveis</small></summary>
        <p className="carretas-intro">
          Preencha apenas com fonte verificável. Campos vazios permanecem como “A definir” e não
          bloqueiam esta revisão de escopo.
        </p>
        {gruposFicha.map((grupo) => (
          <section className="carretas-grupo" key={grupo}>
            <h3>{grupo}</h3>
            <div className="carretas-campos">
              {CARRETAS_FICHA_CAMPOS.filter((campo) => campo.grupo === grupo).map((campo) => (
                <Campo
                  key={campo.codigo}
                  label={campo.rotulo}
                  ajuda={campo.ajuda}
                  valor={dossie.ficha[campo.codigo] ?? ""}
                  tipo={campo.tipo === "date" ? "date" : campo.tipo === "textarea" ? "textarea" : "text"}
                  desabilitado={!canWrite}
                  aoAlterar={(valor) => alterar((draft) => { draft.ficha[campo.codigo] = valor; })}
                />
              ))}
            </div>
          </section>
        ))}
      </details>

      <details className="carretas-secao">
        <summary><span>Portões G0–G4 e evidências</span><small>Critérios essenciais · decisão e correção documentadas</small></summary>
        <p className="carretas-intro">
          “Não aplicável” requer justificativa. Requisitos clínicos, sanitários ou de autorização
          não podem ser dispensados por decisão meramente operacional.
        </p>
        {CARRETAS_GATES.map((modelo) => {
          const gate = dossie.gates.find((item) => item.codigo === modelo.codigo)!;
          return (
            <details className="carretas-registro" key={modelo.codigo}>
              <summary><b>{modelo.codigo}</b><span>{modelo.nome}</span><small>{modelo.responsaveis}</small></summary>
              <p className="carretas-regra"><strong>Bloqueio:</strong> {modelo.criterioBloqueio}</p>
              <div className="carretas-campos carretas-campos--duas">
                <Seletor label="Situação do portão" valor={gate.situacao} opcoes={situacoesGate} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("gates", gate.codigo, (linha) => ({ ...linha, situacao: valor }))} />
                <Seletor label="Decisão registrada" valor={gate.decisao} opcoes={[
                  ["", "Ainda sem decisão"], ["APROVADO", "Aprovado"], ["APROVADO_COM_CORRECOES", "Aprovado com correções"], ["NAO_APROVADO", "Não aprovado"],
                ]} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("gates", gate.codigo, (linha) => ({ ...linha, decisao: valor }))} />
                <Campo label="Autoridade/signatário funcional" valor={gate.autoridade} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("gates", gate.codigo, (linha) => ({ ...linha, autoridade: valor }))} />
                <Campo label="Data da decisão" tipo="date" valor={gate.dataDecisao} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("gates", gate.codigo, (linha) => ({ ...linha, dataDecisao: valor }))} />
                <Campo label="Condição, correção ou pendência" tipo="textarea" valor={gate.correcao} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("gates", gate.codigo, (linha) => ({ ...linha, correcao: valor }))} />
              </div>
              <div className="carretas-lista-controles">
                {modelo.criterios.map(([codigo, rotulo]) => {
                  const criterio = gate.criterios.find((item) => item.codigo === codigo)!;
                  return (
                    <article className="carretas-controle" key={codigo}>
                      <h4>{rotulo}</h4>
                      <div className="carretas-campos carretas-campos--duas">
                        <Seletor label="Situação" valor={criterio.situacao} opcoes={situacoesCriterio} desabilitado={!canWrite}
                          aoAlterar={(valor) => atualizarCriterio(gate.codigo, codigo, "situacao", valor)} />
                        <Campo label="Responsável funcional" valor={criterio.responsavel} desabilitado={!canWrite}
                          aoAlterar={(valor) => atualizarCriterio(gate.codigo, codigo, "responsavel", valor)} />
                        <Campo label="Evidência, documento ou versão" valor={criterio.evidencia} desabilitado={!canWrite}
                          aoAlterar={(valor) => atualizarCriterio(gate.codigo, codigo, "evidencia", valor)} />
                        <Campo label="Adaptação ou justificativa local" valor={criterio.ajusteLocal} desabilitado={!canWrite}
                          aoAlterar={(valor) => atualizarCriterio(gate.codigo, codigo, "ajusteLocal", valor)} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </details>
          );
        })}
      </details>

      <details className="carretas-secao">
        <summary><span>Cronograma relativo a D0</span><small>Sem durações ou datas fictícias</small></summary>
        <p className="carretas-intro">
          D0 é a data pactuada para início. A sequência e as dependências vêm da referência; início,
          duração e responsáveis são decisões locais.
        </p>
        {CARRETAS_ETAPAS.map((modelo) => {
          const etapa = dossie.cronograma.find((item) => item.codigo === modelo.codigo)!;
          return (
            <article className="carretas-linha" key={modelo.codigo}>
              <div className="carretas-linha__titulo"><strong>{modelo.nome}</strong><small>{modelo.dependencia}</small></div>
              <div className="carretas-campos carretas-campos--quatro">
                <Seletor label="Situação" valor={etapa.situacao} opcoes={situacoesEtapa} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("cronograma", etapa.codigo, (linha) => ({ ...linha, situacao: valor }))} />
                <Campo label="Responsável funcional" valor={etapa.responsavel} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("cronograma", etapa.codigo, (linha) => ({ ...linha, responsavel: valor }))} />
                <Campo label="Início relativo a D0" valor={etapa.inicioRelativo} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("cronograma", etapa.codigo, (linha) => ({ ...linha, inicioRelativo: valor }))} />
                <Campo label="Duração pactuada" valor={etapa.duracao} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("cronograma", etapa.codigo, (linha) => ({ ...linha, duracao: valor }))} />
                <Campo label="Evidência/dependência" valor={etapa.evidencia} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("cronograma", etapa.codigo, (linha) => ({ ...linha, evidencia: valor }))} />
              </div>
            </article>
          );
        })}
      </details>

      <details className="carretas-secao">
        <summary><span>Orçamento e fontes de recurso</span><small>7 categorias · valores não preenchidos</small></summary>
        <p className="carretas-intro">
          O documento de referência não fornece custos nem fontes. Valores devem ter memória de
          cálculo, pagador, fonte, documento e responsável; total incremental exige evitar dupla contagem.
        </p>
        {CARRETAS_ORCAMENTO.map((modelo) => {
          const linha = dossie.orcamento.find((item) => item.codigo === modelo.codigo)!;
          return (
            <article className="carretas-linha" key={modelo.codigo}>
              <div className="carretas-linha__titulo">
                <strong>{modelo.categoria}</strong>
                <small>{modelo.memoria} Responsável funcional de referência: {modelo.responsavelFuncional}.</small>
              </div>
              <div className="carretas-campos carretas-campos--quatro">
                <Campo label="Memória de cálculo local" valor={linha.memoriaCalculo} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("orcamento", linha.codigo, (item) => ({ ...item, memoriaCalculo: valor }))} />
                <Campo label="Valor estimado (R$)" tipo="decimal" valor={linha.valor} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("orcamento", linha.codigo, (item) => ({ ...item, valor: valor.replace(",", ".") }))} />
                <Campo label="Pagador" valor={linha.pagador} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("orcamento", linha.codigo, (item) => ({ ...item, pagador: valor }))} />
                <Campo label="Fonte de recurso" valor={linha.fonteRecurso} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("orcamento", linha.codigo, (item) => ({ ...item, fonteRecurso: valor }))} />
                <Campo label="Documento/identificador" valor={linha.documento} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("orcamento", linha.codigo, (item) => ({ ...item, documento: valor }))} />
                <Campo label="Responsável pela estimativa" valor={linha.responsavel} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("orcamento", linha.codigo, (item) => ({ ...item, responsavel: valor }))} />
                <Seletor label="Validação do custo" valor={linha.situacao} opcoes={[
                  ["A_DEFINIR", "A definir"], ["EM_VALIDACAO", "Em validação"], ["VALIDADO", "Validado com fonte"], ["BLOQUEADO", "Bloqueado"],
                ]} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("orcamento", linha.codigo, (item) => ({ ...item, situacao: valor }))} />
              </div>
            </article>
          );
        })}
      </details>

      <details className="carretas-secao">
        <summary><span>Matriz preventiva de riscos</span><small>12 riscos qualitativos · sem probabilidade simulada</small></summary>
        <p className="carretas-intro">
          São hipóteses preventivas da referência, não incidentes observados. Marque “Ocorreu” somente
          quando houver evidência. A plataforma não guarda dados de pacientes neste registro.
        </p>
        {CARRETAS_RISCOS.map((modelo) => {
          const risco = dossie.riscos.find((item) => item.codigo === modelo.codigo)!;
          return (
            <details className="carretas-registro" key={modelo.codigo}>
              <summary><b>{modelo.codigo}</b><span>{modelo.nome}</span><small>Responsável de referência: {modelo.responsavel}</small></summary>
              <dl className="carretas-risco-referencia">
                <div><dt>Prevenção</dt><dd>{modelo.prevencao}</dd></div>
                <div><dt>Gatilho</dt><dd>{modelo.gatilho}</dd></div>
                <div><dt>Resposta proposta</dt><dd>{modelo.resposta}</dd></div>
              </dl>
              <div className="carretas-campos carretas-campos--duas">
                <Seletor label="Situação local" valor={risco.situacao} opcoes={[
                  ["MONITORAR", "Monitorar — risco preventivo"], ["ACONTECEU", "Ocorreu — evidência necessária"], ["MITIGADO", "Mitigado — comprovar controle"], ["ENCERRADO", "Encerrado — justificar"],
                ]} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("riscos", risco.codigo, (item) => ({ ...item, situacao: valor }))} />
                <Campo label="Responsável funcional local" valor={risco.responsavel} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("riscos", risco.codigo, (item) => ({ ...item, responsavel: valor }))} />
                <Campo label="Prevenção adaptada ao município" valor={risco.prevencaoLocal} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("riscos", risco.codigo, (item) => ({ ...item, prevencaoLocal: valor }))} />
                <Campo label="Gatilho local" valor={risco.gatilhoLocal} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("riscos", risco.codigo, (item) => ({ ...item, gatilhoLocal: valor }))} />
                <Campo label="Resposta e escalonamento local" valor={risco.respostaLocal} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("riscos", risco.codigo, (item) => ({ ...item, respostaLocal: valor }))} />
                <Campo label="Evidência do controle ou ocorrência" valor={risco.evidenciaControle} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("riscos", risco.codigo, (item) => ({ ...item, evidenciaControle: valor }))} />
                <Campo label="Ação/pendência local" valor={risco.acaoLocal} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("riscos", risco.codigo, (item) => ({ ...item, acaoLocal: valor }))} />
                <Campo label="Última revisão" tipo="date" valor={risco.revisadoEm} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("riscos", risco.codigo, (item) => ({ ...item, revisadoEm: valor }))} />
              </div>
            </details>
          );
        })}
      </details>

      <details className="carretas-secao">
        <summary><span>Dicionário de indicadores</span><small>{CARRETAS_INDICADORES.length} definições · metas e linhas de base em branco</small></summary>
        <p className="carretas-intro">
          Defina unidade de análise, data de corte, fonte e meta após conhecer a linha de base e a
          capacidade local. Os 18% mencionados no relato de Contagem não são auditados nem constituem meta.
        </p>
        {CARRETAS_INDICADORES.map((modelo) => {
          const indicador = dossie.indicadores.find((item) => item.codigo === modelo.codigo)!;
          return (
            <article className="carretas-linha" key={modelo.codigo}>
              <div className="carretas-linha__titulo">
                <strong>{modelo.nome}</strong>
                <small><b>Cálculo de referência:</b> {modelo.formula} <b>Cautela:</b> {modelo.cautela} Responsável de referência: {modelo.responsavel}.</small>
              </div>
              <div className="carretas-campos carretas-campos--quatro">
                <Campo label="Fórmula local validada" valor={indicador.formulaLocal} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("indicadores", indicador.codigo, (item) => ({ ...item, formulaLocal: valor }))} />
                <Campo label="Unidade de análise" valor={indicador.unidadeAnalise} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("indicadores", indicador.codigo, (item) => ({ ...item, unidadeAnalise: valor }))} />
                <Campo label="Linha de base" tipo="decimal" valor={indicador.linhaBase} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("indicadores", indicador.codigo, (item) => ({ ...item, linhaBase: valor.replace(",", ".") }))} />
                <Campo label="Meta aprovada localmente" tipo="decimal" valor={indicador.meta} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("indicadores", indicador.codigo, (item) => ({ ...item, meta: valor.replace(",", ".") }))} />
                <Campo label="Ato ou referência de aprovação da meta" valor={indicador.aprovacaoMeta} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("indicadores", indicador.codigo, (item) => ({ ...item, aprovacaoMeta: valor }))} />
                <Campo label="Valor atual agregado" tipo="decimal" valor={indicador.valorAtual} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("indicadores", indicador.codigo, (item) => ({ ...item, valorAtual: valor.replace(",", ".") }))} />
                <Campo label="Data de corte" tipo="date" valor={indicador.dataCorte} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("indicadores", indicador.codigo, (item) => ({ ...item, dataCorte: valor }))} />
                <Campo label="Fonte local e versão" valor={indicador.fonteLocal} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("indicadores", indicador.codigo, (item) => ({ ...item, fonteLocal: valor }))} />
                <Campo label="Responsável local" valor={indicador.responsavelLocal} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("indicadores", indicador.codigo, (item) => ({ ...item, responsavelLocal: valor }))} />
                <Campo label="Limitações e regras locais" valor={indicador.limitacaoLocal} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("indicadores", indicador.codigo, (item) => ({ ...item, limitacaoLocal: valor }))} />
                <Campo label="Faixa de alerta/ação local" valor={indicador.faixaAlerta} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("indicadores", indicador.codigo, (item) => ({ ...item, faixaAlerta: valor }))} />
              </div>
            </article>
          );
        })}
      </details>

      <details className="carretas-secao">
        <summary><span>Procedimentos operacionais (POPs)</span><small>8 fluxos · entrada, checagem, decisão, registro, saída e exceção</small></summary>
        {CARRETAS_POPS.map((modelo) => {
          const pop = dossie.pops.find((item) => item.codigo === modelo.codigo)!;
          return (
            <details className="carretas-registro" key={modelo.codigo}>
              <summary><b>{modelo.codigo}</b><span>{modelo.nome}</span><small>Fluxo de referência para adaptação municipal</small></summary>
              <dl className="carretas-pop-etapas">
                <div><dt>Entrada</dt><dd>{modelo.entrada}</dd></div>
                <div><dt>Checagem</dt><dd>{modelo.checagem}</dd></div>
                <div><dt>Decisão</dt><dd>{modelo.decisao}</dd></div>
                <div><dt>Registro</dt><dd>{modelo.registro}</dd></div>
                <div><dt>Saída</dt><dd>{modelo.saida}</dd></div>
                <div><dt>Exceção</dt><dd>{modelo.excecao}</dd></div>
              </dl>
              <div className="carretas-campos carretas-campos--duas">
                <Seletor label="Situação local" valor={pop.situacao} opcoes={[
                  ["PENDENTE", "Pendente de adaptação"], ["EM_VALIDACAO", "Em validação"], ["VALIDADO", "Validado localmente"], ["NAO_APLICAVEL", "Não aplicável — justificar"],
                ]} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("pops", pop.codigo, (item) => ({ ...item, situacao: valor }))} />
                <Campo label="Responsável funcional" valor={pop.responsavel} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("pops", pop.codigo, (item) => ({ ...item, responsavel: valor }))} />
                <Campo label="Evidência/documento" valor={pop.evidencia} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("pops", pop.codigo, (item) => ({ ...item, evidencia: valor }))} />
                <Campo label="Adaptação e exceção local" tipo="textarea" valor={pop.detalhesLocais} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("pops", pop.codigo, (item) => ({ ...item, detalhesLocais: valor, excecaoLocal: valor }))} />
              </div>
            </details>
          );
        })}
      </details>

      <details className="carretas-secao">
        <summary><span>Prestação de contas e avaliação</span><small>Registros, evidências e decisão do piloto</small></summary>
        {CARRETAS_PRESTACAO.map((modelo) => {
          const item = dossie.prestacao.find((row) => row.codigo === modelo.codigo)!;
          return (
            <article className="carretas-linha" key={modelo.codigo}>
              <div className="carretas-linha__titulo"><strong>{modelo.nome}</strong><small>{modelo.criterio}</small></div>
              <div className="carretas-campos carretas-campos--duas">
                <Seletor label="Situação" valor={item.situacao} opcoes={[
                  ["PENDENTE", "Pendente"], ["EM_VALIDACAO", "Em validação"], ["VALIDADO", "Validado"], ["NAO_APLICAVEL", "Não aplicável — justificar"],
                ]} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("prestacao", item.codigo, (linha) => ({ ...linha, situacao: valor }))} />
                <Campo label="Responsável funcional" valor={item.responsavel} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("prestacao", item.codigo, (linha) => ({ ...linha, responsavel: valor }))} />
                <Campo label="Documento/evidência" valor={item.evidencia} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("prestacao", item.codigo, (linha) => ({ ...linha, evidencia: valor }))} />
                <Campo label="Observação ou justificativa" valor={item.observacao} desabilitado={!canWrite}
                  aoAlterar={(valor) => atualizarLista("prestacao", item.codigo, (linha) => ({ ...linha, observacao: valor }))} />
              </div>
            </article>
          );
        })}
        <h3 className="carretas-decisao-titulo">Decisão final do piloto</h3>
        <p className="carretas-intro">Não selecione um resultado até existirem evidências, validação local e autoridade designada.</p>
        <div className="carretas-campos carretas-campos--duas">
          <Seletor label="Resultado" valor={dossie.decisaoPiloto.resultado} opcoes={[
            ["", "Ainda sem decisão"], ["ESCALAR_COM_CONDICOES", "Escalar com condições"], ["CORRIGIR_E_REPETIR", "Corrigir e repetir"], ["NAO_EXPANDIR", "Não expandir/suspender"], ["ADOTAR_ALTERNATIVA", "Adotar alternativa permanente"],
          ]} desabilitado={!canWrite}
            aoAlterar={(valor) => alterar((draft) => { draft.decisaoPiloto.resultado = valor; })} />
          <Campo label="Autoridade competente" valor={dossie.decisaoPiloto.autoridade} desabilitado={!canWrite}
            aoAlterar={(valor) => alterar((draft) => { draft.decisaoPiloto.autoridade = valor; })} />
          <Campo label="Data da decisão" tipo="date" valor={dossie.decisaoPiloto.data} desabilitado={!canWrite}
            aoAlterar={(valor) => alterar((draft) => { draft.decisaoPiloto.data = valor; })} />
          <Campo label="Justificativa e critérios observados" tipo="textarea" valor={dossie.decisaoPiloto.justificativa} desabilitado={!canWrite}
            aoAlterar={(valor) => alterar((draft) => { draft.decisaoPiloto.justificativa = valor; })} />
          <Campo label="Pendências, condição de escala ou alternativa" tipo="textarea" valor={dossie.decisaoPiloto.pendencias} desabilitado={!canWrite}
            aoAlterar={(valor) => alterar((draft) => { draft.decisaoPiloto.pendencias = valor; })} />
        </div>
      </details>

      {erro && <p className="carretas-erro" role="alert">{erro}</p>}
      {salvo && <p className="carretas-salvo" role="status">{salvo}</p>}
      <footer className="carretas-acoes">
        <span>
          {payload?.updatedAt
            ? `Última gravação: ${new Date(payload.updatedAt).toLocaleString("pt-BR")}`
            : "Ainda não há alterações salvas neste dossiê."}
        </span>
        {canWrite && (
          <button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar alterações"}
          </button>
        )}
      </footer>
      {!canWrite && <p className="carretas-aviso">Acesso de consulta: alterações podem ser feitas por um perfil com permissão de edição.</p>}
    </form>
  );
}
