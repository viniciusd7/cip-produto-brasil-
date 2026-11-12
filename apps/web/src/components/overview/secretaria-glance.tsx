import Link from "next/link";
import type { ReactNode } from "react";
import { BarraEmpilhada, COR, Medidor, numero, veredito } from "./governo-glance";
import type { CenarioSecretariaResponse } from "./cenario-secretaria";
import "./overview-painel.css";

type Dados = CenarioSecretariaResponse["data"];

const ESTADO: Record<string, { rotulo: string; cor: string }> = {
  VENCIDO: { rotulo: "Atrasada", cor: COR.rosa },
  NO_PRAZO: { rotulo: "Vence em breve", cor: COR.ouro },
  SEM_PRAZO: { rotulo: "Sem prazo", cor: COR.ouro },
  CONCLUIDO: { rotulo: "Concluída", cor: COR.verde },
};

function dataCurta(iso?: string | null) {
  if (!iso) return "sem prazo";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function corProjeto(p: { totalTarefas: number; atrasadas: number; semPrazo: number; pctConclusao: number }) {
  if (!p.totalTarefas) return COR.cinza;
  if (p.atrasadas) return COR.rosa;
  if (p.semPrazo) return COR.ouro;
  if (p.pctConclusao === 100) return COR.verde;
  return COR.azul;
}

/**
 * Visão "bater o olho" de uma secretaria: saúde das entregas, projetos
 * (próprios e correlacionados), metas e o que precisa de atenção.
 */
export function SecretariaGlance({
  dados,
  titulo = "Situação da secretaria",
  mostrarProjetos = true,
  extra,
}: {
  dados: Dados;
  titulo?: string;
  mostrarProjetos?: boolean;
  extra?: ReactNode;
}) {
  const { indicadores: ind, metasEstrategicas, metasExecucao } = dados;
  const projetos = dados.projetos ?? [];
  const atencao = dados.tarefasAtencao ?? [];
  const saude = ind.totalTarefas ? Math.round(((ind.concluidas + ind.noPrazo) / ind.totalTarefas) * 100) : null;
  const v = veredito(saude);
  const textoVeredito =
    saude == null
      ? "O consultor ainda está cadastrando projetos e tarefas desta secretaria."
      : saude >= 80
        ? "A maior parte das entregas da secretaria está concluída ou dentro do prazo."
        : saude >= 60
          ? "Há atrasos ou tarefas sem prazo que pedem acompanhamento."
          : "Muitas entregas atrasadas. Priorize as tarefas em vermelho abaixo.";

  const metasExecConcluidas = metasExecucao.filter((m) => m.prazoStatus === "CONCLUIDO").length;
  const metasExecVencidas = metasExecucao.filter((m) => m.prazoStatus === "VENCIDO").length;
  const metasExecSemPrazo = metasExecucao.filter((m) => m.prazoStatus === "SEM_PRAZO").length;
  const metasExecAndamento = Math.max(0, metasExecucao.length - metasExecConcluidas - metasExecVencidas - metasExecSemPrazo);
  const principais = projetos.filter((p) => p.participacao === "PRINCIPAL").length;
  const correlacionados = projetos.length - principais;

  return (
    <div className="gl">
      <section className="gl-hero" style={{ ["--v" as string]: v.cor }}>
        <div className="gl-hero__medidor">
          <Medidor valor={saude} cor={v.cor} />
        </div>
        <div className="gl-hero__texto">
          <p className="gl-kicker">{titulo}</p>
          <h2>{v.titulo === "Governo em dia" ? "Secretaria em dia" : v.titulo}</h2>
          <p>{textoVeredito}</p>
          <BarraEmpilhada
            partes={[
              { rotulo: "concluídas", valor: ind.concluidas, cor: COR.verde },
              { rotulo: "no prazo", valor: ind.noPrazo, cor: COR.azul },
              { rotulo: "sem prazo", valor: ind.semPrazo, cor: COR.ouro },
              { rotulo: "atrasadas", valor: ind.atrasadas, cor: COR.rosa },
            ]}
          />
        </div>
        <ul className="gl-hero__numeros">
          <li><strong>{ind.projetos}</strong><span>projetos{correlacionados ? ` (${correlacionados} em parceria)` : ""}</span></li>
          <li><strong>{ind.totalTarefas}</strong><span>tarefas</span></li>
          <li><strong>{metasExecucao.length}</strong><span>metas de execução</span></li>
          <li><strong>{metasEstrategicas.length}</strong><span>metas estratégicas</span></li>
        </ul>
      </section>

      {extra}

      <section className="gl-bloco">
        <header className="gl-bloco__cab">
          <div>
            <p className="gl-kicker">Para agir agora</p>
            <h2>O que precisa de atenção</h2>
          </div>
          <Link href="/pendencias" className="gl-link">Agenda completa →</Link>
        </header>
        {atencao.length ? (
          <ol className="gl-atencao">
            {atencao.map((t) => {
              const e = ESTADO[t.estado] ?? ESTADO.NO_PRAZO;
              return (
                <li key={t.id} style={{ ["--c" as string]: e.cor }}>
                  <Link href={`/iniciativas/${t.iniciativaId}?aba=andamento`}>
                    <span className="gl-atencao__rotulo">{e.rotulo}</span>
                    <span className="gl-atencao__texto">
                      {t.descricao}
                      <small>
                        {t.iniciativaNome} · {t.responsavel || "sem responsável"}
                      </small>
                    </span>
                    <b>{dataCurta(t.prazo)}</b>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="gl-vazio gl-vazio--ok">✓ Nenhuma tarefa atrasada ou vencendo nos próximos 15 dias.</p>
        )}
      </section>

      {mostrarProjetos && (
        <section className="gl-bloco">
          <header className="gl-bloco__cab">
            <div>
              <p className="gl-kicker">Pastas de projeto</p>
              <h2>Projetos da secretaria</h2>
            </div>
            <ul className="gl-legenda">
              <li><i style={{ background: COR.rosa }} />Com atraso</li>
              <li><i style={{ background: COR.ouro }} />Sem prazo</li>
              <li><i style={{ background: COR.azul }} />Em dia</li>
              <li><i style={{ background: COR.verde }} />Concluído</li>
            </ul>
          </header>
          {projetos.length ? (
            <ul className="gl-semaforo">
              {projetos.map((p) => {
                const cor = corProjeto(p);
                return (
                  <li key={p.id}>
                    <Link href={`/iniciativas/${p.id}`} className="gl-pasta" style={{ ["--c" as string]: cor }}>
                      <span className="gl-pasta__luz" aria-hidden="true" />
                      <span className="gl-pasta__nome">{p.nome}</span>
                      <strong className="gl-pasta__pct">{p.totalTarefas ? `${p.pctConclusao}%` : "—"}</strong>
                      <span className="gl-pasta__barra" aria-hidden="true">
                        <span style={{ width: `${p.pctConclusao}%` }} />
                      </span>
                      <span className="gl-pasta__info">
                        {p.participacao === "CORRELACIONADO" ? "🤝 Em parceria · " : ""}
                        {!p.totalTarefas
                          ? "Sem tarefas ainda"
                          : p.atrasadas
                            ? `${p.atrasadas} atrasada${p.atrasadas > 1 ? "s" : ""} · ${p.concluidas}/${p.totalTarefas} feitas`
                            : `${p.concluidas}/${p.totalTarefas} tarefas feitas`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="gl-vazio">Nenhum projeto vinculado a esta secretaria ainda.</p>
          )}
        </section>
      )}

      <div className="gl-duas">
        <section className="gl-bloco">
          <header className="gl-bloco__cab">
            <div>
              <p className="gl-kicker">Plano de governo</p>
              <h2>Metas estratégicas</h2>
            </div>
          </header>
          {metasEstrategicas.length ? (
            <ul className="gl-metas">
              {metasEstrategicas.map((m) => {
                const realizado = numero(m.medicaoAtual?.valorRealizado);
                const alvo = numero(m.alvo);
                const pct = realizado != null && alvo ? Math.max(0, Math.min(100, Math.round((realizado / alvo) * 100))) : null;
                const cor = m.aguardandoMedicao ? COR.lilas : m.desvio != null && m.desvio < 0 ? COR.rosa : COR.verde;
                const situacao = m.aguardandoMedicao
                  ? "Aguardando medição"
                  : m.desvio == null
                    ? "Medida registrada"
                    : m.desvio < 0
                      ? "Abaixo do esperado"
                      : "No ritmo esperado";
                return (
                  <li key={m.id} style={{ ["--c" as string]: cor }}>
                    <div className="gl-metas__topo">
                      <strong>{m.nome}</strong>
                      <span className="gl-metas__situacao">{situacao}</span>
                    </div>
                    <span className="gl-metas__barra" aria-hidden="true"><span style={{ width: `${pct ?? 0}%` }} /></span>
                    <small>
                      {m.indicador || "Indicador a definir"} · {m.medicaoAtual?.valorRealizado ?? "—"} de {m.alvo || "—"} {m.unidade || ""}
                      {pct != null ? ` (${pct}%)` : ""}
                    </small>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="gl-vazio">Nenhuma meta estratégica ligada a esta secretaria ainda.</p>
          )}
        </section>

        <section className="gl-bloco">
          <header className="gl-bloco__cab">
            <div>
              <p className="gl-kicker">Entregas dos projetos</p>
              <h2>Metas de execução</h2>
            </div>
          </header>
          <div className="gl-exec">
            <div className="gl-exec__grande" style={{ ["--c" as string]: COR.verde }}>
              <strong>{metasExecConcluidas}</strong>
              <span>de {metasExecucao.length} concluídas</span>
            </div>
            <BarraEmpilhada
              partes={[
                { rotulo: "concluídas", valor: metasExecConcluidas, cor: COR.verde },
                { rotulo: "em andamento", valor: metasExecAndamento, cor: COR.azul },
                { rotulo: "sem prazo", valor: metasExecSemPrazo, cor: COR.ouro },
                { rotulo: "vencidas", valor: metasExecVencidas, cor: COR.rosa },
              ]}
            />
            {metasExecucao.length > 0 && (
              <ul className="gl-metas">
                {metasExecucao.slice(0, 5).map((m) => {
                  const atual = numero(m.valorAtual);
                  const alvo = numero(m.alvo);
                  const pct = atual != null && alvo ? Math.max(0, Math.min(100, Math.round((atual / alvo) * 100))) : null;
                  const e = ESTADO[m.prazoStatus] ?? { rotulo: "No prazo", cor: COR.azul };
                  const cor = m.prazoStatus === "NO_PRAZO" ? COR.azul : e.cor;
                  return (
                    <li key={m.id} style={{ ["--c" as string]: cor }}>
                      <div className="gl-metas__topo">
                        <Link href={`/iniciativas/${m.iniciativaId}?aba=andamento`} className="gl-metas__link">{m.nome}</Link>
                        <span className="gl-metas__situacao">
                          {m.prazoStatus === "NO_PRAZO" ? `até ${dataCurta(m.prazo)}` : m.prazoStatus === "VENCIDO" ? "Vencida" : e.rotulo}
                        </span>
                      </div>
                      <span className="gl-metas__barra" aria-hidden="true"><span style={{ width: `${pct ?? 0}%` }} /></span>
                      <small>
                        {m.indicador || "Indicador a definir"} · {m.valorAtual || "—"} de {m.alvo || "—"} {m.unidade || ""}
                      </small>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="gl-exec__nota">
              <strong>{ind.coberturaMetas}%</strong> das metas têm o valor atual informado.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
