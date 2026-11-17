import Link from "next/link";
import type { ConsultaRelatorio } from "./tabela-relatorio";

export type DadosGerenciador = {
  projetos: Array<{ id: string; codigo: string; nome: string; secretaria: string; total: number; concluidas: number; noPrazo: number; semPrazo: number; atrasadas: number }>;
  tarefas: Array<{
    id: string; codigo: string | null; descricao: string; status: string;
    responsavel: string | null; prazo: string | null; projetoId: string;
    projetoCodigo: string; projetoNome: string; secretaria: string;
    subtarefas: {
      total: number; feitas: number;
      itens: Array<{ id: string; descricao: string; concluida: boolean; prazo: string | null; responsavel: string | null }>;
    };
  }>;
  metasEstrategicas: Array<{
    id: string; nome: string; secretaria: string | null;
    base?: string | null; alvo?: string | null; realizado?: string | null; dataCorte?: string | null;
    indicadores: Array<{
      id: string; nome: string; unidade: string | null; valorBase: string | null;
      valorAtual: string | null; alvo: string | null;
      medicao: { valorRealizado: string; dataCorte: string } | null;
    }>;
  }>;
};

const SITUACOES = [
  { chave: "CONCLUIDO", nome: "Concluídas", cor: "#b4e4a0" },
  { chave: "NO_PRAZO", nome: "No prazo", cor: "#a7baff" },
  { chave: "SEM_PRAZO", nome: "Sem prazo", cor: "#eac78c" },
  { chave: "VENCIDO", nome: "Atrasadas", cor: "#ff91ac" },
  { chave: "ENCERRADO_SEM_SOLUCAO", nome: "Encerradas sem solução", cor: "#a5aec5" },
] as const;

function percentual(parte: number, total: number) {
  return total ? Math.round((parte / total) * 100) : 0;
}

function numero(valor: string | null | undefined) {
  if (!valor) return null;
  let texto = valor.replace(/[^\d,.-]/g, "");
  if (!texto) return null;
  if (texto.includes(",")) texto = texto.replace(/\./g, "").replace(",", ".");
  const resultado = Number(texto);
  return Number.isFinite(resultado) ? resultado : null;
}

function avancar(base: string | null, alvo: string | null, atual: string | null) {
  const inicio = numero(base);
  const fim = numero(alvo);
  const realizado = numero(atual);
  if (inicio == null || fim == null || realizado == null || inicio === fim) return null;
  return Math.max(0, Math.min(100, Math.round(((realizado - inicio) / (fim - inicio)) * 100)));
}

function dataCurta(valor: string | null) {
  return valor ? new Date(valor).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "Sem prazo";
}

export function GerenciadorRelatorio({ dados, consulta }: { dados: DadosGerenciador; consulta: ConsultaRelatorio }) {
  const ids = new Set(consulta.linhas.map((linha) => linha.id));
  const tarefas = dados.tarefas.filter((tarefa) => ids.has(tarefa.id));
  const subtarefasTotal = tarefas.reduce((soma, tarefa) => soma + tarefa.subtarefas.total, 0);
  const subtarefasFeitas = tarefas.reduce((soma, tarefa) => soma + tarefa.subtarefas.feitas, 0);
  const concluidas = tarefas.filter((tarefa) => tarefa.status === "CONCLUIDO").length;
  const indicadores = dados.metasEstrategicas.flatMap((meta) => meta.indicadores.map((indicador) => ({ ...indicador, meta: meta.nome, secretaria: meta.secretaria })));
  const indicadoresMedidos = indicadores.filter((indicador) => indicador.medicao).length;
  const projetos = dados.projetos.map((projeto) => ({
    ...projeto,
    tarefas: tarefas.filter((tarefa) => tarefa.projetoId === projeto.id),
  })).filter((projeto) => !consulta.busca || projeto.tarefas.length);
  const distribuicao = SITUACOES.map((situacao) => ({ ...situacao, quantidade: tarefas.filter((tarefa) => tarefa.status === situacao.chave).length }));
  const outras = tarefas.length - distribuicao.reduce((soma, situacao) => soma + situacao.quantidade, 0);

  return (
    <section className="pc-gerenciador" aria-labelledby="pc-gerenciador-titulo">
      <div className="pc-gerenciador__intro">
        <div>
          <p className="pc-kicker">Acompanhamento da execução</p>
          <h2 id="pc-gerenciador-titulo">Painel de tarefas e resultados</h2>
          <p>Veja o andamento dos projetos, abra as tarefas e confira cada subtarefa registrada.</p>
        </div>
        <Link href="/carteira" className="pc-gerenciador__link">Abrir projetos →</Link>
      </div>

      <div className="pc-gerenciador__kpis" aria-label="Resumo do acompanhamento">
        <div><strong>{tarefas.length}</strong><span>tarefas no recorte</span></div>
        <div><strong>{percentual(concluidas, tarefas.length)}%</strong><span>tarefas concluídas · {concluidas} de {tarefas.length}</span></div>
        <div><strong>{percentual(subtarefasFeitas, subtarefasTotal)}%</strong><span>subtarefas concluídas · {subtarefasFeitas} de {subtarefasTotal}</span></div>
        <div><strong>{indicadoresMedidos}/{indicadores.length}</strong><span>indicadores com medição</span></div>
      </div>

      <div className="pc-gerenciador__graficos">
        <article className="pc-gerenciador__grafico">
          <h3>Situação das tarefas</h3>
          <p>Quantidade e proporção no recorte atual.</p>
          {tarefas.length ? <>
            <div className="pc-gerenciador__pilha" role="img" aria-label={distribuicao.map((item) => `${item.nome}: ${item.quantidade}`).join("; ")}>
              {distribuicao.filter((item) => item.quantidade).map((item) => <span key={item.chave} style={{ width: `${(item.quantidade / tarefas.length) * 100}%`, background: item.cor }} />)}
              {outras > 0 && <span style={{ width: `${(outras / tarefas.length) * 100}%`, background: "#7d879d" }} />}
            </div>
            <ul className="pc-gerenciador__legenda">
              {distribuicao.map((item) => <li key={item.chave}><i style={{ background: item.cor }} /><span>{item.nome}</span><strong>{item.quantidade}</strong></li>)}
              {outras > 0 && <li><i style={{ background: "#7d879d" }} /><span>Outras situações</span><strong>{outras}</strong></li>}
            </ul>
          </> : <p className="pc-grafico__vazio">Nenhuma tarefa neste recorte.</p>}
        </article>
        <article className="pc-gerenciador__grafico">
          <h3>Progresso das subtarefas</h3>
          <p>Itens concluídos dentro das tarefas exibidas.</p>
          {subtarefasTotal ? <div className="pc-gerenciador__subprogresso">
            <div className="pc-gerenciador__anel" role="img" aria-label={`${percentual(subtarefasFeitas, subtarefasTotal)}% das subtarefas concluídas`} style={{ background: `conic-gradient(#b4e4a0 ${percentual(subtarefasFeitas, subtarefasTotal)}%, #39445b 0)` }}><strong>{percentual(subtarefasFeitas, subtarefasTotal)}%</strong></div>
            <div><strong>{subtarefasFeitas} de {subtarefasTotal}</strong><span>subtarefas concluídas</span><small>{subtarefasTotal - subtarefasFeitas} aguardando conclusão</small></div>
          </div> : <p className="pc-grafico__vazio">Ainda não há subtarefas nas tarefas deste recorte.</p>}
        </article>
      </div>

      <IndicadoresRelatorio dados={dados} />

      <div className="pc-gerenciador__bloco">
        <div className="pc-gerenciador__bloco-head"><div><p className="pc-kicker">Gerenciador de tarefas</p><h3>Projetos, tarefas e subtarefas</h3></div><span>{projetos.length} projetos</span></div>
        <p className="pc-gerenciador__nota">O progresso do projeto conta tarefas concluídas. Dentro de cada tarefa, a barra conta subtarefas concluídas.</p>
        {projetos.length ? <div className="pc-gerenciador__projetos">{projetos.map((projeto, index) => {
          const feitas = projeto.tarefas.filter((tarefa) => tarefa.status === "CONCLUIDO").length;
          const progresso = percentual(feitas, projeto.tarefas.length);
          return <details key={projeto.id} className="pc-gerenciador__projeto" open={index === 0} style={{ ["--progresso" as string]: `${progresso}%` }}>
            <summary><span><strong>{projeto.codigo} · {projeto.nome}</strong><small>{projeto.secretaria}</small></span><span className="pc-gerenciador__projeto-pct">{feitas} de {projeto.tarefas.length} tarefas · {progresso}%</span></summary>
            {projeto.tarefas.length ? <ul className="pc-gerenciador__tarefas">{projeto.tarefas.map((tarefa) => {
              const estado = SITUACOES.find((item) => item.chave === tarefa.status);
              const subPct = percentual(tarefa.subtarefas.feitas, tarefa.subtarefas.total);
              const progressoTarefa = tarefa.subtarefas.total ? subPct : tarefa.status === "CONCLUIDO" ? 100 : 0;
              return <li key={tarefa.id}>
                <div className="pc-gerenciador__tarefa-head"><span className="pc-gerenciador__situacao" style={{ ["--situacao" as string]: estado?.cor ?? "#a5aec5" }}>{estado?.nome ?? tarefa.status}</span><Link href={`/iniciativas/${tarefa.projetoId}?aba=andamento`}>{tarefa.codigo ? `${tarefa.codigo} · ` : ""}{tarefa.descricao}</Link></div>
                <div className="pc-gerenciador__tarefa-meta"><span>{tarefa.responsavel || "Responsável não informado"}</span><span>Prazo: {dataCurta(tarefa.prazo)}</span></div>
                <div className="pc-gerenciador__progresso pc-gerenciador__progresso-tarefa"><div><span>{tarefa.subtarefas.total ? "Progresso das subtarefas" : "Conclusão da tarefa"}</span><strong>{progressoTarefa}%</strong></div><progress value={progressoTarefa} max="100">{progressoTarefa}%</progress></div>
                {tarefa.subtarefas.total ? <details className="pc-gerenciador__subtarefas"><summary>Ver {tarefa.subtarefas.total} {tarefa.subtarefas.total === 1 ? "subtarefa" : "subtarefas"} · {tarefa.subtarefas.feitas} {tarefa.subtarefas.feitas === 1 ? "concluída" : "concluídas"}</summary><ul>{tarefa.subtarefas.itens.map((subtarefa) => <li key={subtarefa.id}><span className={subtarefa.concluida ? "pc-gerenciador__feito" : "pc-gerenciador__pendente"} aria-label={subtarefa.concluida ? "Concluída" : "Pendente"}>{subtarefa.concluida ? "✓" : "○"}</span><span>{subtarefa.descricao}<small>{subtarefa.responsavel || "Sem responsável"} · {subtarefa.prazo ? `prazo ${dataCurta(subtarefa.prazo)}` : "sem prazo"}</small></span></li>)}</ul></details> : <small className="pc-gerenciador__nota">Sem subtarefas cadastradas.</small>}
              </li>;
            })}</ul> : <p className="pc-grafico__vazio">Nenhuma tarefa neste projeto e recorte.</p>}
          </details>;
        })}</div> : <p className="pc-vazio">Nenhum projeto com tarefas corresponde à consulta.</p>}
      </div>
    </section>
  );
}


export function IndicadoresRelatorio({ dados, consulta }: { dados: DadosGerenciador; consulta?: ConsultaRelatorio }) {
  const ids = consulta ? new Set(consulta.linhas.map((linha) => linha.id)) : null;
  const indicadores = dados.metasEstrategicas.flatMap((meta) =>
    meta.indicadores.filter((indicador) => !ids || ids.has(`${meta.id}:${indicador.id}`))
      .map((indicador) => ({ ...indicador, meta: meta.nome, secretaria: meta.secretaria })),
  );
  const indicadoresMedidos = indicadores.filter((indicador) => indicador.medicao).length;
  return (
    <section className="pc-gerenciador">
      <div className="pc-gerenciador__bloco">
        <h3>Metas estratégicas</h3>
        <div className="pc-gerenciador__indicadores">
          {dados.metasEstrategicas.filter((meta) => !ids || ids.has(meta.id) || meta.indicadores.some((indicador) => ids.has(`${meta.id}:${indicador.id}`))).map((meta) => {
            const progresso = avancar(meta.base ?? null, meta.alvo ?? null, meta.realizado ?? null);
            return (
              <article key={meta.id} className="pc-gerenciador__indicador">
                <small>{meta.secretaria || "Gestão municipal"}</small>
                <h4>{meta.nome}</h4>
                <div className="pc-gerenciador__valores">
                  <div><span>Realizado</span><strong>{meta.realizado ?? "Sem medição"}</strong></div>
                  <div><span>Alvo</span><strong>{meta.alvo ?? "Não informado"}</strong></div>
                </div>
                {progresso != null && <div className="pc-gerenciador__progresso"><div><span>Avanço da meta entre base e alvo</span><strong>{progresso}%</strong></div><progress value={progresso} max="100">{progresso}%</progress></div>}
                <small>{meta.dataCorte ? `Medido em ${dataCurta(meta.dataCorte)}` : "Sem medição da meta no período"}</small>
              </article>
            );
          })}
        </div>
      </div>
      <div className="pc-gerenciador__bloco">
        <div className="pc-gerenciador__bloco-head"><div><p className="pc-kicker">Resultados medidos</p><h3>Indicadores estratégicos</h3></div><span>{indicadoresMedidos} de {indicadores.length} com medição</span></div>
        <p className="pc-gerenciador__nota">Indicadores seguem os filtros de secretaria, projeto e período. Busca textual e situação selecionam apenas tarefas.</p>
        {indicadores.length ? <div className="pc-gerenciador__indicadores">{indicadores.map((indicador) => {
          const atual = indicador.medicao?.valorRealizado ?? indicador.valorAtual;
          const progresso = avancar(indicador.valorBase, indicador.alvo, atual);
          return <article key={indicador.id} className="pc-gerenciador__indicador">
            <small>{indicador.secretaria || "Secretaria não informada"} · {indicador.meta}</small>
            <h4>{indicador.nome}</h4>
            <div className="pc-gerenciador__valores"><div><span>{indicador.medicao ? "Última medição" : "Atual cadastrado"}</span><strong>{atual ?? "Não informado"}{atual && indicador.unidade ? ` ${indicador.unidade}` : ""}</strong></div><div><span>Alvo</span><strong>{indicador.alvo ?? "Não informado"}{indicador.alvo && indicador.unidade ? ` ${indicador.unidade}` : ""}</strong></div></div>
            {progresso != null ? <div className="pc-gerenciador__progresso"><div><span>Avanço entre base e alvo</span><strong>{progresso}%</strong></div><progress value={progresso} max="100">{progresso}%</progress></div> : <p className="pc-gerenciador__nota">Avanço percentual indisponível para os valores cadastrados.</p>}
            <small>{indicador.medicao ? `Medido em ${dataCurta(indicador.medicao.dataCorte)}` : "Sem medição no período"}</small>
          </article>;
        })}</div> : <p className="pc-vazio">Ainda não há indicadores vinculados aos projetos deste recorte.</p>}
      </div>
    </section>
  );
}
