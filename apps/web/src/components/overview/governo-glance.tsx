import Link from "next/link";
import type { ReactNode } from "react";
import { CLASS_GROUPS } from "@cip/shared";
import type { OverviewResponse } from "./types";
import { overviewCopy } from "./audience";

type Data = OverviewResponse["data"];

export const COR = {
  verde: "#b4e4a0",
  ouro: "#eac78c",
  rosa: "#ff5982",
  azul: "#7c9cff",
  lilas: "#b9a0ff",
  cinza: "#59647f",
};

const ORDEM = ["INTERVENCAO", "DADOS_DEFASADOS", "ACOMPANHAMENTO", "ROTINA"];

export function saudeGoverno(governo: Data["governo"]) {
  if (!governo.totalTarefas) return null;
  const abertasEmDia = Math.max(0, governo.abertas - governo.atrasadas - governo.semPrazo);
  return Math.round(((governo.concluidas + abertasEmDia) / governo.totalTarefas) * 100);
}

export function veredito(saude: number | null) {
  if (saude == null)
    return { cor: COR.cinza, titulo: "Aguardando cadastros", texto: "Ainda não há projetos e tarefas cadastrados." };
  if (saude >= 80)
    return { cor: COR.verde, titulo: "Governo em dia", texto: "A maior parte das entregas está concluída ou dentro do prazo." };
  if (saude >= 60)
    return { cor: COR.ouro, titulo: "Pede atenção", texto: "Há atrasos ou tarefas sem prazo que precisam de acompanhamento." };
  return { cor: COR.rosa, titulo: "Precisa de intervenção", texto: "Muitas entregas estão atrasadas. Cobre as secretarias em vermelho." };
}

export function Medidor({ valor, cor, rotulo = "entregas em dia" }: { valor: number | null; cor: string; rotulo?: string }) {
  const raio = 80;
  const comprimento = Math.PI * raio;
  const preenchido = valor == null ? 0 : (valor / 100) * comprimento;
  return (
    <svg viewBox="0 0 200 116" className="gl-medidor" role="img" aria-label={valor == null ? "Sem dados" : `${valor}% ${rotulo}`}>
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="18" strokeLinecap="round" />
      <path
        d="M20 100 A80 80 0 0 1 180 100"
        fill="none"
        stroke={cor}
        strokeWidth="18"
        strokeLinecap="round"
        strokeDasharray={`${preenchido} ${comprimento}`}
        style={{ filter: `drop-shadow(0 0 8px ${cor}88)` }}
      />
      <text x="100" y="92" textAnchor="middle" className="gl-medidor__valor" fill={cor}>
        {valor == null ? "—" : `${valor}%`}
      </text>
      <text x="100" y="112" textAnchor="middle" className="gl-medidor__rotulo">
        {rotulo}
      </text>
    </svg>
  );
}

export function BarraEmpilhada({ partes }: { partes: Array<{ rotulo: string; valor: number; cor: string }> }) {
  const total = partes.reduce((a, p) => a + p.valor, 0);
  return (
    <div className="gl-pilha">
      <div className="gl-pilha__barra" role="img" aria-label={partes.map((p) => `${p.rotulo}: ${p.valor}`).join(", ")}>
        {total ? (
          partes.map((p) =>
            p.valor ? <span key={p.rotulo} style={{ flexGrow: p.valor, background: p.cor }} /> : null,
          )
        ) : (
          <span style={{ flexGrow: 1, background: "rgba(255,255,255,.08)" }} />
        )}
      </div>
      <ul className="gl-pilha__legenda">
        {partes.map((p) => (
          <li key={p.rotulo}>
            <i style={{ background: p.cor }} />
            <strong>{p.valor}</strong> {p.rotulo}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GovernoGlance({ data, secretarias: secretariasSlot, role, showGoals = true, showSecretarias = true, heroId = "visao" }: { data: Data; secretarias?: ReactNode; role?: string; showGoals?: boolean; showSecretarias?: boolean; heroId?: string }) {
  const { governo, porSecretaria, estrategia, tarefasPedemAcao } = data;
  const copy = overviewCopy(role);
  const saude = saudeGoverno(governo);
  const v = veredito(saude);
  const abertasEmDia = Math.max(0, governo.abertas - governo.atrasadas - governo.semPrazo);

  const secretarias = [...porSecretaria].sort(
    (a, b) =>
      (a.tarefasTotal ? 0 : 1) - (b.tarefasTotal ? 0 : 1) ||
      ORDEM.indexOf(a.classificacao) - ORDEM.indexOf(b.classificacao) ||
      b.pctAtraso - a.pctAtraso,
  );

  const metasEstrategicas = estrategia?.metas ?? [];

  const atencao = [
    ...(tarefasPedemAcao?.atrasadas ?? []).map((t) => ({
      key: `a-${t.id}`,
      cor: COR.rosa,
      rotulo: "Atrasada",
      titulo: t.descricao,
      onde: `${t.secretaria} · ${t.iniciativaNome}`,
      href: `/iniciativas/${t.iniciativaId}?aba=andamento`,
    })),
    ...(tarefasPedemAcao?.vencemEm15d ?? []).map((t) => ({
      key: `v-${t.id}`,
      cor: COR.ouro,
      rotulo: "Vence em breve",
      titulo: t.descricao,
      onde: `${t.secretaria} · ${t.iniciativaNome}`,
      href: `/iniciativas/${t.iniciativaId}?aba=andamento`,
    })),
  ].slice(0, 5);

  return (
    <div className="gl">
      <section id={heroId} className="gl-hero" style={{ ["--v" as string]: v.cor }}>
        <div className="gl-hero__medidor">
          <Medidor valor={saude} cor={v.cor} />
        </div>
        <div className="gl-hero__texto">
          <p className="gl-kicker">{role === "prefeito" ? "Execução registrada nos projetos" : "Situação geral do governo"}</p>
          <h2>{role === "prefeito" && saude != null ? "Situação das entregas" : v.titulo}</h2>
          <p>{saude == null ? copy.emptyTasks : role === "prefeito" && saude < 60 ? "Há entregas atrasadas. Solicite às secretarias uma posição sobre causas e prazos." : v.texto}</p>
          <BarraEmpilhada
            partes={[
              { rotulo: "concluídas", valor: governo.concluidas, cor: COR.verde },
              { rotulo: "no prazo", valor: abertasEmDia, cor: COR.azul },
              { rotulo: "sem prazo", valor: governo.semPrazo, cor: COR.ouro },
              { rotulo: "atrasadas", valor: governo.atrasadas, cor: COR.rosa },
            ]}
          />
        </div>
        <ul className="gl-hero__numeros">
          <li><Link href="/carteira"><strong>{governo.totalProjetos}</strong><span>Total de projetos</span><small>Ver projetos →</small></Link></li>
          <li><Link href="/relatorios/metas"><strong>{metasEstrategicas.length}</strong><span>Metas estratégicas</span><small>Ver metas →</small></Link></li>
          <li><Link href="/relatorios/tarefas"><strong>{governo.totalTarefas}</strong><span>Tarefas de execução</span><small>Ver tarefas →</small></Link></li>
        </ul>
      </section>

      {showSecretarias && (secretariasSlot ?? (
      <section id="secretarias" className="gl-bloco">
        <header className="gl-bloco__cab">
          <div>
            <p className="gl-kicker">Semáforo das secretarias</p>
            <h2>Como está cada pasta</h2>
          </div>
          <ul className="gl-legenda">
            {CLASS_GROUPS.map((g) => (
              <li key={g.key}><i style={{ background: g.color }} />{g.label}</li>
            ))}
          </ul>
        </header>
        <ul className="gl-semaforo">
          {secretarias.map((p) => {
            const g = CLASS_GROUPS.find((x) => x.key === p.classificacao);
            const cor = p.tarefasTotal ? g?.color ?? COR.cinza : COR.cinza;
            const emDia = p.tarefasTotal ? Math.round(((p.concluidas + p.noPrazo) / p.tarefasTotal) * 100) : null;
            return (
              <li key={p.id}>
                <Link href={`/painel?secretariaId=${encodeURIComponent(p.id)}`} className="gl-pasta" style={{ ["--c" as string]: cor }}>
                  <span className="gl-pasta__luz" aria-hidden="true" />
                  <span className="gl-pasta__nome">{p.nome}</span>
                  <strong className="gl-pasta__pct">{emDia == null ? "—" : `${emDia}%`}</strong>
                  <span className="gl-pasta__barra" aria-hidden="true">
                    <span style={{ width: `${emDia ?? 0}%` }} />
                  </span>
                  <span className="gl-pasta__info">
                    {!p.projetos
                      ? "Sem projetos"
                      : !p.tarefasTotal
                        ? `${p.projetos} projeto${p.projetos > 1 ? "s" : ""} · sem tarefas`
                        : p.atrasadas
                          ? `${p.atrasadas} atrasada${p.atrasadas > 1 ? "s" : ""} · ${g?.label ?? ""}`
                          : `Em dia · ${p.projetos} projeto${p.projetos > 1 ? "s" : ""}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {!secretarias.length && <p className="gl-vazio">Nenhuma secretaria cadastrada ainda.</p>}
      </section>
      ))}

      {showGoals && <section id="meta-estrategica" className="gl-bloco">
          <header className="gl-bloco__cab">
            <div>
              <p className="gl-kicker">Plano de governo</p>
              <h2>Metas estratégicas</h2>
            </div>
          </header>
          {metasEstrategicas.length ? (
            <ul className="gl-metas">
              {metasEstrategicas.slice(0, 6).map((m) => {
                const situacao = m.aguardandoMedicao
                  ? "Aguardando medição"
                  : m.desvio == null
                    ? "Medida registrada"
                    : m.desvio < 0
                      ? "Abaixo do esperado"
                      : "No ritmo esperado";
                return (
                  <li key={m.id}>
                    <div className="gl-metas__topo">
                      <strong>{m.nome}</strong>
                      <span className="gl-metas__situacao">{situacao}</span>
                    </div>
                    <small>
                      {m.medicaoAtual
                        ? `Valor medido: ${m.medicaoAtual.valorRealizado}${m.unidade ? ` ${m.unidade}` : ""}${m.medicaoAtual.valorEsperado != null ? ` · esperado: ${m.medicaoAtual.valorEsperado}${m.unidade ? ` ${m.unidade}` : ""}` : ""}`
                        : "Sem medição registrada"}
                    </small>
                    <small>
                      Projetos: {m.projetosVinculados.length
                        ? m.projetosVinculados.map((projeto) => `${projeto.codigo} · ${projeto.nome}`).join("; ")
                        : "Nenhum projeto vinculado"}
                    </small>
                    {m.indicadores.length ? (
                      <ul className="gl-metas__indicadores">
                        {m.indicadores.map((indicador) => (
                          <li key={indicador.id}>
                            <strong>{indicador.nome}</strong>
                            <small>
                              Base: {indicador.valorBase ?? "—"}{indicador.unidade ? ` ${indicador.unidade}` : ""}
                              {" · Atual: "}{indicador.valorAtual ?? "—"}{indicador.unidade ? ` ${indicador.unidade}` : ""}
                              {" · Alvo: "}{indicador.alvo ?? "—"}{indicador.unidade ? ` ${indicador.unidade}` : ""}
                              {indicador.periodicidade ? ` · ${indicador.periodicidade.toLowerCase()}` : ""}
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <small>Sem indicadores vinculados.</small>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="gl-vazio">{copy.emptyGoals}</p>
          )}
      </section>}

      <section id="atencao" className="gl-bloco">
        <header className="gl-bloco__cab">
          <div>
            <p className="gl-kicker">{copy.attentionKicker}</p>
            <h2>{copy.attentionTitle}</h2>
          </div>
          <Link href="/pendencias" className="gl-link">Agenda completa →</Link>
        </header>
        {atencao.length ? (
          <ol className="gl-atencao">
            {atencao.map((item) => (
              <li key={item.key} style={{ ["--c" as string]: item.cor }}>
                <Link href={item.href}>
                  <span className="gl-atencao__rotulo">{item.rotulo}</span>
                  <span className="gl-atencao__texto">
                    <strong>{item.titulo}</strong>
                    <small>{item.onde}</small>
                  </span>
                  <b aria-hidden="true">→</b>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="gl-vazio gl-vazio--ok">Nenhum item atrasado ou vencendo. Tudo sob controle.</p>
        )}
      </section>
    </div>
  );
}
