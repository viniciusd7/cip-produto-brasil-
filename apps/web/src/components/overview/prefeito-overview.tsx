"use client";

import Link from "next/link";
import { useId, useState } from "react";

type Medicao = {
  dataCorte: string;
  valorRealizado: string;
  valorEsperado: string | null;
  fonte: string | null;
};

type MedicaoAnterior = { dataCorte: string; valorRealizado: string };

type MetaExecutiva = {
  id: string;
  nome: string;
  codigo?: string | null;
  secretariaId?: string | null;
  secretariaNome?: string | null;
  alvo?: string | null;
  unidade?: string | null;
  resultadoChaveOkr?: string | null;
  projetosVinculados: Array<{ id: string; codigo: string; nome: string }>;
  indicadores: Array<{ id: string; nome: string; unidade?: string | null; valorAtual?: string | null; alvo?: string | null }>;
  medicaoAtual: Medicao | null;
  medicaoAnterior?: MedicaoAnterior | null;
  desvio: number | null;
};

type ProjetoExecutivo = {
  id: string;
  codigo: string;
  nome: string;
  metasExecucao?: Array<{
    id: string;
    codigo: string | null;
    nome: string;
    indicador: string | null;
    unidade: string | null;
    alvo: string | null;
    valorAtual: string | null;
    prazo: string | null;
    medicaoAtual: Medicao | null;
    medicaoAnterior: MedicaoAnterior | null;
    desvio: number | null;
  }>;
};

function dataCurta(value?: string | null) {
  if (!value) return "Data não informada";
  const data = new Date(value);
  return Number.isNaN(data.getTime()) ? "Data não informada" : data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function valor(value: string | null | undefined, unidade?: string | null) {
  const texto = value?.trim();
  if (!texto) return "Não informado";
  return unidade?.trim() && /^[+-]?\d[\d.,\s]*$/.test(texto) ? `${texto} ${unidade.trim()}` : texto;
}

function temMedicao(meta: MetaExecutiva) {
  return Boolean(meta.medicaoAtual?.valorRealizado?.trim());
}

function normalizar(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function ResumoMedicao({ atual, unidade }: { atual: Medicao; unidade?: string | null }) {
  return (
    <div className="prefeito-result__measurement">
      <dl className="prefeito-result__values">
        <div className="prefeito-result__current"><dt>Resultado registrado</dt><dd>{valor(atual.valorRealizado, unidade)}</dd></div>
        <div><dt>Previsto para {dataCurta(atual.dataCorte)}</dt><dd>{valor(atual.valorEsperado, unidade)}</dd></div>
      </dl>
      <p className="prefeito-result__source"><span>Medição de <time dateTime={atual.dataCorte}>{dataCurta(atual.dataCorte)}</time></span><span>Fonte: {atual.fonte?.trim() || "Não informada"}</span></p>
    </div>
  );
}

function MedicaoAnteriorDetalhe({ anterior, unidade }: { anterior?: MedicaoAnterior | null; unidade?: string | null }) {
  return anterior?.valorRealizado?.trim() ? (
    <details className="prefeito-result__details">
      <summary>Ver medição anterior</summary>
      <p>Em {dataCurta(anterior.dataCorte)}, o resultado registrado foi <strong>{valor(anterior.valorRealizado, unidade)}</strong>.</p>
    </details>
  ) : null;
}

function IndicadoresDaMeta({ indicadores }: { indicadores: MetaExecutiva["indicadores"] }) {
  return (
    <ul className="prefeito-result__indicators" aria-label="Valores informados nos indicadores">
      {indicadores.map((indicador) => (
        <li key={indicador.id}>
          <h4>{indicador.nome}</h4>
          <dl>
            <div><dt>Valor informado</dt><dd>{valor(indicador.valorAtual, indicador.unidade)}</dd></div>
            <div><dt>Resultado esperado</dt><dd>{valor(indicador.alvo, indicador.unidade)}</dd></div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function PrefeitoExecutiveFocus({ metas, dataReferencia, escopo = "governo" }: {
  metas: MetaExecutiva[];
  dataReferencia?: string | null;
  escopo?: "governo" | "secretaria";
}) {
  const buscaId = useId();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "medidas" | "sem-medicao">("todas");
  const medidas = metas.filter(temMedicao).length;
  const termo = normalizar(busca.trim());
  const visiveis = metas.filter((meta) =>
    (filtro === "todas" || (filtro === "medidas" ? temMedicao(meta) : !temMedicao(meta))) &&
    (!termo || normalizar([meta.nome, meta.codigo, meta.secretariaNome, ...meta.projetosVinculados.map((p) => p.nome), ...meta.indicadores.map((i) => i.nome)].filter(Boolean).join(" ")).includes(termo)),
  );

  return (
    <section id="meta-estrategica" className="prefeito-results" aria-label={`Metas e indicadores ${escopo === "governo" ? "do governo" : "da secretaria"}`}>
      <header className="prefeito-results__header">
        <div>
          <h2>{escopo === "governo" ? "Metas e indicadores do governo" : "Metas e indicadores da secretaria"}</h2>
          <p>Confira o que foi registrado para cada meta, o que estava previsto e quais resultados ainda precisam ser informados.</p>
        </div>
        <p className="prefeito-results__reference">Data de referência<span>{dataCurta(dataReferencia)}</span></p>
      </header>
      {!!metas.length && (
        <div className="prefeito-results__toolbar">
          <div className="prefeito-results__filters" role="group" aria-label="Filtrar metas por medição">
            {([
              { id: "todas", label: "Todas as metas", total: metas.length },
              { id: "medidas", label: "Com medição", total: medidas },
              { id: "sem-medicao", label: "Sem medição datada", total: metas.length - medidas },
            ] as const).map((opcao) => <button key={opcao.id} type="button" aria-pressed={filtro === opcao.id} onClick={() => setFiltro(opcao.id)}>{opcao.label}<span>{opcao.total}</span></button>)}
          </div>
          <div className="prefeito-results__search">
            <label htmlFor={buscaId}>Buscar meta, secretaria ou projeto</label>
            <input id={buscaId} type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Digite um nome para localizar" />
          </div>
        </div>
      )}
      {!!metas.length && <p className="prefeito-results__count" role="status">Exibindo {visiveis.length} de {metas.length} {metas.length === 1 ? "meta" : "metas"}</p>}
      {visiveis.length ? (
        <ul className="prefeito-results__list">
          {visiveis.map((meta) => {
            const medida = temMedicao(meta);
            const atual = medida ? meta.medicaoAtual : null;
            return (
              <li key={meta.id}>
                <article className="prefeito-result" aria-labelledby={`${buscaId}-${meta.id}`}>
                  <header className="prefeito-result__header">
                    <div>
                      <h3 id={`${buscaId}-${meta.id}`}>{meta.nome}</h3>
                      {meta.secretariaNome ? (
                        <p className="prefeito-result__owner">Secretaria responsável: {meta.secretariaId ? <Link href={`/painel?secretariaId=${encodeURIComponent(meta.secretariaId)}`}>{meta.secretariaNome}</Link> : meta.secretariaNome}</p>
                      ) : escopo === "governo" && <p className="prefeito-result__owner">Secretaria responsável não informada</p>}
                    </div>
                    <span className={`prefeito-result__state${medida ? "" : " prefeito-result__state--missing"}`}>{medida ? "Medição registrada" : "Sem medição datada"}</span>
                  </header>
                  {meta.resultadoChaveOkr && <p className="prefeito-result__objective">{meta.resultadoChaveOkr}</p>}
                  {atual ? <ResumoMedicao atual={atual} unidade={meta.unidade} /> : (
                    <p className="prefeito-result__pending">A equipe ainda não informou uma medição datada desta meta.{meta.indicadores.some((i) => i.valorAtual?.trim()) ? " Os valores cadastrados nos indicadores estão abaixo." : " Solicite a atualização dos resultados à secretaria responsável."}</p>
                  )}
                  {atual ? (
                    <div className="prefeito-result__extra">
                      <MedicaoAnteriorDetalhe anterior={meta.medicaoAnterior} unidade={meta.unidade} />
                      {!!meta.indicadores.length && (
                        <details className="prefeito-result__details">
                          <summary>Ver indicadores desta meta ({meta.indicadores.length})</summary>
                          <p>Valores informados no cadastro dos indicadores.</p>
                          <IndicadoresDaMeta indicadores={meta.indicadores} />
                        </details>
                      )}
                    </div>
                  ) : !!meta.indicadores.length && <IndicadoresDaMeta indicadores={meta.indicadores} />}
                  {!atual && !meta.indicadores.length && meta.alvo?.trim() && <p className="prefeito-result__target">Resultado esperado ao final: <strong>{valor(meta.alvo, meta.unidade)}</strong></p>}
                  <footer className="prefeito-result__projects">
                    <span>Projetos que contribuem para esta meta</span>
                    {meta.projetosVinculados.length ? <ul>{meta.projetosVinculados.map((projeto) => <li key={projeto.id}><Link href={`/iniciativas/${encodeURIComponent(projeto.id)}?aba=metas`}>{projeto.nome}</Link></li>)}</ul> : <p>Nenhum projeto vinculado.</p>}
                  </footer>
                </article>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="prefeito-results__empty">
          <h3>{metas.length ? "Nenhuma meta corresponde à busca e ao filtro" : "Ainda não há metas nesta visão"}</h3>
          <p>{metas.length ? "Tente outro nome ou volte a mostrar todas as metas." : "As metas e os indicadores cadastrados pela equipe aparecerão aqui."}</p>
          {!!metas.length && <button type="button" onClick={() => { setBusca(""); setFiltro("todas"); }}>Limpar busca e filtro</button>}
        </div>
      )}
    </section>
  );
}

export function PrefeitoExecutionGoals({ projetos }: { projetos: ProjetoExecutivo[] }) {
  const comMetas = projetos.filter((projeto) => projeto.metasExecucao?.length);
  if (!comMetas.length) return null;
  return (
    <section className="prefeito-project-results" aria-label="Resultados registrados nos projetos">
      <header className="prefeito-results__header"><div><h2>Resultados registrados nos projetos</h2><p>Consulte as medições de cada entrega e abra o projeto para acompanhar os detalhes.</p></div></header>
      {comMetas.map((projeto) => (
        <article key={projeto.id} className="prefeito-result">
          <header className="prefeito-result__header"><h3>{projeto.nome}</h3><Link href={`/iniciativas/${encodeURIComponent(projeto.id)}?aba=metas`}>Abrir projeto</Link></header>
          {projeto.metasExecucao?.map((meta) => (
            <section key={meta.id} className="prefeito-result__delivery" aria-label={meta.nome}>
              <h4>{meta.nome}</h4>
              {meta.indicador && <p className="prefeito-result__owner">O que é acompanhado: {meta.indicador}</p>}
              {meta.medicaoAtual?.valorRealizado?.trim() ? <><ResumoMedicao atual={meta.medicaoAtual} unidade={meta.unidade} /><MedicaoAnteriorDetalhe anterior={meta.medicaoAnterior} unidade={meta.unidade} /></> : (
                <p className="prefeito-result__pending">Sem medição datada.{meta.valorAtual?.trim() ? ` Valor informado no cadastro: ${valor(meta.valorAtual, meta.unidade)}.` : " O resultado ainda precisa ser informado."}</p>
              )}
              {meta.alvo?.trim() && <p>Resultado esperado ao final: {valor(meta.alvo, meta.unidade)}</p>}
              {meta.prazo && <p>Prazo informado: {dataCurta(meta.prazo)}</p>}
            </section>
          ))}
        </article>
      ))}
    </section>
  );
}
