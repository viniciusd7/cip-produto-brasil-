import Link from "next/link";

type MetaExecutiva = {
  id: string;
  nome: string;
  codigo?: string | null;
  unidade?: string | null;
  resultadoChaveOkr?: string | null;
  projetosVinculados: Array<{ id: string; codigo: string; nome: string }>;
  indicadores: Array<{ id: string; nome: string; unidade?: string | null; valorAtual?: string | null; alvo?: string | null }>;
  medicaoAtual: { dataCorte: string; valorRealizado: string; valorEsperado: string | null; fonte: string | null } | null;
  medicaoAnterior?: { dataCorte: string; valorRealizado: string } | null;
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
    medicaoAtual: { dataCorte: string; valorRealizado: string; valorEsperado: string | null; fonte: string | null } | null;
    medicaoAnterior: { dataCorte: string; valorRealizado: string } | null;
    desvio: number | null;
  }>;
};

function dataCurta(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "Sem data";
}

function numero(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function valor(value: string | null | undefined, unidade?: string | null) {
  return value == null ? "Não informado" : `${value}${unidade ? ` ${unidade}` : ""}`;
}

export function PrefeitoExecutiveFocus({
  metas,
  dataReferencia,
  escopo = "governo",
}: {
  metas: MetaExecutiva[];
  dataReferencia?: string | null;
  escopo?: "governo" | "secretaria";
}) {
  const comMedicao = metas.filter((meta) => meta.medicaoAtual).length;
  const comDesvio = metas.filter((meta) => meta.desvio != null && meta.desvio !== 0).length;

  return (
    <section id="meta-estrategica" className="gl-bloco executivo" aria-label={`Resultados estratégicos ${escopo === "governo" ? "do governo" : "da secretaria"}`}>
      <header id="visao" className="gl-bloco__cab">
        <div>
          <p className="gl-kicker">Visão executiva · {dataCurta(dataReferencia)}</p>
          <h2>{escopo === "governo" ? "Metas estratégicas e resultados" : "Metas estratégicas da secretaria"}</h2>
          <p>O que foi medido, o que era esperado e quais dados ainda precisam de atualização.</p>
        </div>
      </header>
      <div className="gl-executivo-resumo" aria-label="Resumo das metas estratégicas">
        <div><strong>{metas.length}</strong><span>metas estratégicas</span></div>
        <div><strong>{comMedicao}</strong><span>com medição</span></div>
        <div><strong>{metas.length - comMedicao}</strong><span>aguardando medição</span></div>
        <div><strong>{comDesvio}</strong><span>com diferença para o esperado</span></div>
      </div>
      {metas.length ? (
        <ul className="gl-metas gl-metas--executivo">
          {metas.map((meta) => {
            const atual = meta.medicaoAtual;
            return (
              <li key={meta.id}>
                <div className="gl-metas__topo">
                  <strong>{meta.codigo ? `${meta.codigo} · ` : ""}{meta.nome}</strong>
                  <span className="gl-metas__situacao">{atual ? `Medição de ${dataCurta(atual.dataCorte)}` : "Aguardando medição"}</span>
                </div>
                {meta.resultadoChaveOkr && <p className="gl-executivo-resultado">Resultado esperado: {meta.resultadoChaveOkr}</p>}
                <div className="gl-executivo-medidas">
                  <div><span>Realizado informado</span><strong>{atual ? valor(atual.valorRealizado, meta.unidade) : "Aguardando medição"}</strong></div>
                  <div><span>Esperado na data</span><strong>{valor(atual?.valorEsperado, meta.unidade)}</strong></div>
                  <div><span>Desvio numérico</span><strong>{meta.desvio == null ? "Não calculável" : `${meta.desvio > 0 ? "+" : ""}${numero(meta.desvio)}${meta.unidade ? ` ${meta.unidade}` : ""}`}</strong></div>
                  <div><span>Medição anterior</span><strong>{meta.medicaoAnterior ? valor(meta.medicaoAnterior.valorRealizado, meta.unidade) : "Não disponível"}</strong></div>
                </div>
                {atual && meta.medicaoAnterior && (
                  <div className="gl-executivo-evolucao" aria-label={`Evolução registrada de ${dataCurta(meta.medicaoAnterior.dataCorte)} a ${dataCurta(atual.dataCorte)}`}>
                    <span>{dataCurta(meta.medicaoAnterior.dataCorte)}<strong>{valor(meta.medicaoAnterior.valorRealizado, meta.unidade)}</strong></span>
                    <i aria-hidden="true">→</i>
                    <span>{dataCurta(atual.dataCorte)}<strong>{valor(atual.valorRealizado, meta.unidade)}</strong></span>
                  </div>
                )}
                <small>Fonte informada: {atual?.fonte || "Não informada"}</small>
                <small>Indicadores: {meta.indicadores.length ? meta.indicadores.map((indicador) => `${indicador.nome} · atual ${valor(indicador.valorAtual, indicador.unidade)} · alvo ${valor(indicador.alvo, indicador.unidade)}`).join("; ") : "Indicador a definir"}</small>
                <small>Projetos vinculados: {meta.projetosVinculados.length ? meta.projetosVinculados.map((projeto) => `${projeto.codigo} · ${projeto.nome}`).join("; ") : "Nenhum projeto vinculado"}</small>
              </li>
            );
          })}
        </ul>
      ) : <p className="gl-vazio">Ainda não há metas estratégicas cadastradas para esta visão.</p>}
      <p className="gl-executivo-nota">O desvio é a diferença entre realizado e esperado. A direção desejada depende de cada indicador; a diferença isolada não classifica o resultado.</p>
    </section>
  );
}

export function PrefeitoExecutionGoals({ projetos }: { projetos: ProjetoExecutivo[] }) {
  const comMetas = projetos.filter((projeto) => projeto.metasExecucao?.length);
  const totalMetas = comMetas.reduce((total, projeto) => total + (projeto.metasExecucao?.length ?? 0), 0);
  const medidas = comMetas.reduce(
    (total, projeto) => total + (projeto.metasExecucao?.filter((meta) => meta.medicaoAtual).length ?? 0),
    0,
  );

  return (
    <section className="gl-bloco executivo" aria-label="Metas de execução dos projetos">
      <header className="gl-bloco__cab">
        <div>
          <p className="gl-kicker">Resultados da secretaria</p>
          <h2>Metas de execução por projeto</h2>
          <p>Entregas medidas de cada projeto, com valor esperado e data da última atualização.</p>
        </div>
      </header>
      <div className="gl-executivo-resumo" aria-label="Resumo das metas de execução">
        <div><strong>{comMetas.length}</strong><span>projetos com metas</span></div>
        <div><strong>{totalMetas}</strong><span>metas de execução</span></div>
        <div><strong>{medidas}</strong><span>com medição</span></div>
        <div><strong>{totalMetas - medidas}</strong><span>aguardando medição</span></div>
      </div>
      {comMetas.length ? comMetas.map((projeto) => (
        <div key={projeto.id} className="gl-execucao-projeto">
          <div className="gl-execucao-projeto__cab">
            <h3>{projeto.codigo} · {projeto.nome}</h3>
            <Link href={`/iniciativas/${projeto.id}`} className="gl-link">Ver projeto →</Link>
          </div>
          <ul className="gl-metas gl-metas--executivo">
            {projeto.metasExecucao?.map((meta) => {
              const atual = meta.medicaoAtual;
              return (
                <li key={meta.id}>
                  <div className="gl-metas__topo">
                    <strong>{meta.codigo ? `${meta.codigo} · ` : ""}{meta.nome}</strong>
                    <span className="gl-metas__situacao">{atual ? `Medição de ${dataCurta(atual.dataCorte)}` : "Aguardando medição"}</span>
                  </div>
                  <div className="gl-executivo-medidas">
                    <div><span>Realizado informado</span><strong>{atual ? valor(atual.valorRealizado, meta.unidade) : "Aguardando medição"}</strong></div>
                    <div><span>Esperado na data</span><strong>{valor(atual?.valorEsperado, meta.unidade)}</strong></div>
                    <div><span>Desvio numérico</span><strong>{meta.desvio == null ? "Não calculável" : `${meta.desvio > 0 ? "+" : ""}${numero(meta.desvio)}${meta.unidade ? ` ${meta.unidade}` : ""}`}</strong></div>
                    <div><span>Medição anterior</span><strong>{meta.medicaoAnterior ? valor(meta.medicaoAnterior.valorRealizado, meta.unidade) : "Não disponível"}</strong></div>
                  </div>
                  {atual && meta.medicaoAnterior && (
                    <div className="gl-executivo-evolucao" aria-label={`Evolução registrada de ${dataCurta(meta.medicaoAnterior.dataCorte)} a ${dataCurta(atual.dataCorte)}`}>
                      <span>{dataCurta(meta.medicaoAnterior.dataCorte)}<strong>{valor(meta.medicaoAnterior.valorRealizado, meta.unidade)}</strong></span>
                      <i aria-hidden="true">→</i>
                      <span>{dataCurta(atual.dataCorte)}<strong>{valor(atual.valorRealizado, meta.unidade)}</strong></span>
                    </div>
                  )}
                  <small>Indicador: {meta.indicador || "Indicador a definir"}</small>
                  <small>Alvo cadastrado: {valor(meta.alvo, meta.unidade)} · Prazo: {meta.prazo ? dataCurta(meta.prazo) : "Não informado"}</small>
                  {!atual && meta.valorAtual != null && <small>Valor atual cadastrado, sem medição datada: {valor(meta.valorAtual, meta.unidade)}</small>}
                  <small>Fonte informada: {atual?.fonte || "Não informada"}</small>
                </li>
              );
            })}
          </ul>
        </div>
      )) : <p className="gl-vazio">Ainda não há metas de execução cadastradas para os projetos desta secretaria.</p>}
      <p className="gl-executivo-nota">Os valores seguem as medições registradas. O desvio numérico isolado não classifica o resultado.</p>
    </section>
  );
}
