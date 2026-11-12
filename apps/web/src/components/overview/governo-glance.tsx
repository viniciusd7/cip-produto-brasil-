import Link from "next/link";
import type { ReactNode } from "react";
import { CLASS_GROUPS } from "@cip/shared";
import type { OverviewResponse } from "./types";

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

export function numero(valor: string | null | undefined) {
  if (valor == null) return null;
  const n = Number(String(valor).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function saudeGoverno(governo: Data["governo"]) {
  if (!governo.totalTarefas) return null;
  const abertasEmDia = Math.max(0, governo.abertas - governo.atrasadas - governo.semPrazo);
  return Math.round(((governo.concluidas + abertasEmDia) / governo.totalTarefas) * 100);
}

export function veredito(saude: number | null) {
  if (saude == null)
    return { cor: COR.cinza, titulo: "Aguardando cadastros", texto: "O consultor ainda está cadastrando projetos e tarefas." };
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

export function GovernoGlance({ data, secretarias: secretariasSlot }: { data: Data; secretarias?: ReactNode }) {
  const { governo, porSecretaria, metas, estrategia, tarefasPedemAcao } = data;
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
  const metasExec = metas ?? { total: 0, comValor: 0, cobertura: 0, atrasadas: 0, semPrazo: 0, concluidas: 0, pedemAcao: [] };
  const metasEmAndamento = Math.max(0, metasExec.total - metasExec.concluidas - metasExec.atrasadas - metasExec.semPrazo);

  const atencao = [
    ...(tarefasPedemAcao?.atrasadas ?? []).map((t) => ({
      key: `a-${t.id}`,
      cor: COR.rosa,
      rotulo: "Atrasada",
      titulo: t.descricao,
      onde: `${t.secretaria} · ${t.iniciativaNome}`,
      href: `/iniciativas/${t.iniciativaId}?aba=andamento`,
    })),
    ...metasExec.pedemAcao.map((m) => ({
      key: `m-${m.id}`,
      cor: COR.lilas,
      rotulo: "Meta vencida",
      titulo: m.nome,
      onde: `${m.secretaria} · ${m.iniciativaNome}`,
      href: `/iniciativas/${m.iniciativaId}`,
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
      <section id="visao" className="gl-hero" style={{ ["--v" as string]: v.cor }}>
        <div className="gl-hero__medidor">
          <Medidor valor={saude} cor={v.cor} />
        </div>
        <div className="gl-hero__texto">
          <p className="gl-kicker">Situação geral do governo</p>
          <h2>{v.titulo}</h2>
          <p>{v.texto}</p>
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
          <li><strong>{governo.totalProjetos}</strong><span>projetos</span></li>
          <li><strong>{governo.totalTarefas}</strong><span>tarefas</span></li>
          <li><strong>{metasExec.total}</strong><span>metas de execução</span></li>
          <li><strong>{metasEstrategicas.length}</strong><span>metas estratégicas</span></li>
        </ul>
      </section>

      {secretariasSlot ?? (
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
      )}

      <div className="gl-duas">
        <section id="meta-estrategica" className="gl-bloco">
          <header className="gl-bloco__cab">
            <div>
              <p className="gl-kicker">Plano de governo</p>
              <h2>Metas estratégicas</h2>
            </div>
          </header>
          {metasEstrategicas.length ? (
            <ul className="gl-metas">
              {metasEstrategicas.slice(0, 6).map((m) => {
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
                      {m.indicador || "Indicador a definir"} ·{" "}
                      {realizado != null ? `${m.medicaoAtual?.valorRealizado}` : "—"} de {m.alvo || "—"} {m.unidade || ""}
                      {pct != null ? ` (${pct}%)` : ""}
                    </small>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="gl-vazio">O consultor ainda não cadastrou metas estratégicas.</p>
          )}
        </section>

        <section id="meta-execucao" className="gl-bloco">
          <header className="gl-bloco__cab">
            <div>
              <p className="gl-kicker">Entregas dos projetos</p>
              <h2>Metas de execução</h2>
            </div>
          </header>
          <div className="gl-exec">
            <div className="gl-exec__grande" style={{ ["--c" as string]: COR.verde }}>
              <strong>{metasExec.concluidas}</strong>
              <span>de {metasExec.total} concluídas</span>
            </div>
            <BarraEmpilhada
              partes={[
                { rotulo: "concluídas", valor: metasExec.concluidas, cor: COR.verde },
                { rotulo: "em andamento", valor: metasEmAndamento, cor: COR.azul },
                { rotulo: "sem prazo", valor: metasExec.semPrazo, cor: COR.ouro },
                { rotulo: "vencidas", valor: metasExec.atrasadas, cor: COR.rosa },
              ]}
            />
            <p className="gl-exec__nota">
              <strong>{metasExec.cobertura}%</strong> das metas têm o valor atual informado pelos indicadores.
            </p>
          </div>
        </section>
      </div>

      <section id="atencao" className="gl-bloco">
        <header className="gl-bloco__cab">
          <div>
            <p className="gl-kicker">Para a próxima reunião</p>
            <h2>O que precisa da sua atenção</h2>
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
