"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@cip/ui";
import { apiFetch } from "@/lib/api";
import { secretariaLabel } from "@/lib/secretaria-label";

export type Indicador = {
  id: string;
  nome: string;
  unidade?: string | null;
  valorBase?: string | null;
  alvo?: string | null;
  valorAtual?: string | null;
  periodicidade?: string | null;
  fonte?: string | null;
  polaridade?: "MAIOR_MELHOR" | "MENOR_MELHOR";
  progresso?: number | null;
  responsavelUser?: { id: string; name: string } | null;
};

export type Meta = {
  id: string;
  codigo?: string | null;
  nome: string;
  descricao?: string | null;
  indicador?: string | null;
  alvo?: string | null;
  prazo?: string | null;
  iniciativas: number;
  secretaria?: { id?: string; nome: string; sigla?: string | null } | null;
  secretariaId?: string | null;
  responsavelUser?: { id: string; name: string } | null;
  indicadores: Indicador[];
};

export type Plano = { id: string; nome: string; periodo?: string | null; descricao?: string | null; metas: Meta[] };
export type Secretaria = { id: string; nome: string; sigla?: string | null };
export type Responsavel = { id: string; name: string; roleCode: string; secretaria?: { id: string; nome: string; sigla?: string | null } | null };
export type Sugestao = {
  id: string;
  entidadeId: string;
  campo: "INDICADOR" | "TAREFA";
  fonte?: string | null;
  proposta: { tipo: "INDICADOR"; nome: string; unidade: string; periodicidade: string; polaridade: string; fonte: string; formula?: string } | null;
};

const PAPEL: Record<string, string> = { gestor: "Secretário", analista: "Consultor", prefeito: "Prefeito" };
const PERIODICIDADES = ["MENSAL", "BIMESTRAL", "TRIMESTRAL", "QUADRIMESTRAL", "SEMESTRAL", "ANUAL"];

function opcaoResponsavel(r: Responsavel) {
  const sec = r.secretaria ? ` · ${r.secretaria.sigla || r.secretaria.nome}` : "";
  return `${r.name} (${PAPEL[r.roleCode] || r.roleCode}${sec})`;
}

function txt(form: FormData, campo: string) {
  const v = String(form.get(campo) || "").trim();
  return v || undefined;
}

type Ctx = {
  token: string;
  secretarias: Secretaria[];
  responsaveis: Responsavel[];
  sugestoes: Sugestao[];
  podeEditar: boolean;
};

export function PlanoEstrutura({ planos, ...ctx }: Ctx & { planos: Plano[] }) {
  return (
    <>
      {planos.map((plano) => (
        <PlanoCard key={plano.id} plano={plano} {...ctx} />
      ))}
    </>
  );
}

function PlanoCard({ plano, ...ctx }: Ctx & { plano: Plano }) {
  const [novaMeta, setNovaMeta] = useState(false);
  const semIndicador = plano.metas.filter((m) => m.indicadores.length === 0).length;
  return (
    <Card
      title={plano.nome}
      subtitle={[
        plano.periodo,
        `${plano.metas.length} meta(s) estratégica(s)`,
        semIndicador ? `${semIndicador} sem indicador` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      action={ctx.podeEditar && !novaMeta ? <Button onClick={() => setNovaMeta(true)}>+ Meta estratégica</Button> : undefined}
    >
      {plano.descricao && <p className="dashboard-muted" style={{ marginTop: 0 }}>{plano.descricao}</p>}
      {novaMeta && <NovaMetaForm planoId={plano.id} onClose={() => setNovaMeta(false)} {...ctx} />}
      <div className="gp-metas">
        {plano.metas.map((meta) => (
          <MetaCard key={meta.id} meta={meta} {...ctx} />
        ))}
        {!plano.metas.length && <p className="dashboard-muted">Adicione a primeira meta estratégica e vincule a secretaria responsável.</p>}
      </div>
    </Card>
  );
}

function NovaMetaForm({ planoId, onClose, token, secretarias, responsaveis }: Ctx & { planoId: string; onClose: () => void }) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSalvando(true);
    setErro("");
    try {
      const prazo = txt(form, "prazo");
      await apiFetch("/planejamento/metas", {
        token,
        method: "POST",
        body: JSON.stringify({
          planoId,
          nome: txt(form, "nome"),
          codigo: txt(form, "codigo"),
          descricao: txt(form, "descricao"),
          secretariaId: txt(form, "secretariaId"),
          responsavelUserId: txt(form, "responsavelUserId") ?? null,
          prazo: prazo ? new Date(`${prazo}T12:00:00`).toISOString() : null,
        }),
      });
      onClose();
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível criar a meta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={submit} className="gp-form">
      <strong>Nova meta estratégica</strong>
      <div className="gp-form__grid">
        <div><label htmlFor={`codigo-${planoId}`}>Código</label><input id={`codigo-${planoId}`} name="codigo" placeholder="EIXO-01" /></div>
        <div className="gp-form__wide"><label htmlFor={`nome-${planoId}`}>Meta</label><input id={`nome-${planoId}`} name="nome" required minLength={3} placeholder="Ampliar a cobertura da atenção básica" /></div>
      </div>
      <div><label htmlFor={`desc-${planoId}`}>Resultado esperado</label><input id={`desc-${planoId}`} name="descricao" placeholder="O que muda para o cidadão ao final do mandato" /></div>
      <div className="gp-form__grid">
        <div>
          <label htmlFor={`sec-${planoId}`}>Secretaria responsável</label>
          <select id={`sec-${planoId}`} name="secretariaId" required>
            <option value="">Selecione…</option>
            {secretarias.map((s) => <option key={s.id} value={s.id}>{secretariaLabel(s)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`resp-${planoId}`}>Responsável (notificado)</label>
          <select id={`resp-${planoId}`} name="responsavelUserId">
            <option value="">A definir</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{opcaoResponsavel(r)}</option>)}
          </select>
        </div>
        <div><label htmlFor={`prazo-${planoId}`}>Prazo</label><input id={`prazo-${planoId}`} name="prazo" type="date" /></div>
      </div>
      {erro && <p role="alert" className="gp-erro">{erro}</p>}
      <div className="chip-row">
        <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Criar meta"}</Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}

function MetaCard({ meta, token, secretarias, responsaveis, sugestoes, podeEditar }: Ctx & { meta: Meta }) {
  const router = useRouter();
  const [novoIndicador, setNovoIndicador] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const minhas = sugestoes.filter((s) => s.entidadeId === meta.id && s.campo === "INDICADOR" && s.proposta);

  async function executar(fn: () => Promise<unknown>) {
    setOcupado(true);
    setErro("");
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Operação não concluída.");
    } finally {
      setOcupado(false);
    }
  }

  const patchMeta = (body: Record<string, unknown>) =>
    executar(() => apiFetch(`/planejamento/metas/${meta.id}`, { token, method: "PATCH", body: JSON.stringify(body) }));

  return (
    <article className="gp-meta">
      <header className="gp-meta__head">
        <div className="chip-row">
          <Badge tone="info">{meta.codigo || "META"}</Badge>
          <Badge tone="neutral">{meta.secretaria?.sigla || meta.secretaria?.nome || "Sem secretaria"}</Badge>
        </div>
        <Badge tone={meta.iniciativas ? "success" : "warning"}>
          {meta.iniciativas} projeto{meta.iniciativas === 1 ? "" : "s"}
        </Badge>
      </header>
      <h3 className="gp-meta__title">{meta.nome}</h3>
      {meta.descricao && <p className="dashboard-muted" style={{ margin: 0 }}>{meta.descricao}</p>}

      <div className="gp-meta__fields">
        {podeEditar ? (
          <>
            <div>
              <label htmlFor={`msec-${meta.id}`}>Secretaria</label>
              <select
                id={`msec-${meta.id}`}
                defaultValue={meta.secretariaId || meta.secretaria?.id || ""}
                disabled={ocupado}
                onChange={(e) => e.target.value && void patchMeta({ secretariaId: e.target.value })}
              >
                <option value="">A definir</option>
                {secretarias.map((s) => <option key={s.id} value={s.id}>{secretariaLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`mresp-${meta.id}`}>Responsável</label>
              <select
                id={`mresp-${meta.id}`}
                defaultValue={meta.responsavelUser?.id || ""}
                disabled={ocupado}
                onChange={(e) => void patchMeta({ responsavelUserId: e.target.value || null })}
              >
                <option value="">A definir</option>
                {responsaveis.map((r) => <option key={r.id} value={r.id}>{opcaoResponsavel(r)}</option>)}
              </select>
            </div>
          </>
        ) : (
          <span className="dashboard-muted">Responsável: {meta.responsavelUser?.name || "a definir"}</span>
        )}
      </div>

      <section className="gp-meta__section" aria-label={`Indicadores da meta ${meta.nome}`}>
        <div className="gp-meta__section-head">
          <strong>Indicadores ({meta.indicadores.length})</strong>
          {podeEditar && (
            <div className="chip-row">
              <Button
                variant="ghost"
                disabled={ocupado}
                onClick={() => void executar(() => apiFetch(`/planejamento/metas/${meta.id}/sugestoes`, { token, method: "POST" }))}
              >
                ✨ Sugerir com IA
              </Button>
              {!novoIndicador && <Button variant="secondary" onClick={() => setNovoIndicador(true)}>+ Indicador</Button>}
            </div>
          )}
        </div>
        {meta.indicadores.length === 0 && !minhas.length && (
          <p className="dashboard-muted" style={{ margin: 0 }}>
            {meta.indicador ? `Indicador descrito no plano: ${meta.indicador}${meta.alvo ? ` (alvo ${meta.alvo})` : ""}. Cadastre-o para medir.` : "Sem indicador — a meta ainda não é mensurável."}
          </p>
        )}
        {meta.indicadores.map((ind) => (
          <IndicadorItem key={ind.id} ind={ind} token={token} podeEditar={podeEditar} onAcao={executar} ocupado={ocupado} />
        ))}

        {minhas.length > 0 && (
          <div className="gp-sugestoes">
            <span className="gp-sugestoes__label">Sugestões da IA — revise antes de aceitar</span>
            {minhas.map((s) => (
              <div key={s.id} className="gp-sugestao">
                <div>
                  <strong>{s.proposta!.nome}</strong>
                  <span className="dashboard-muted">
                    {[s.proposta!.unidade, s.proposta!.periodicidade.toLowerCase(), s.proposta!.polaridade === "MENOR_MELHOR" ? "quanto menor, melhor" : "quanto maior, melhor", s.proposta!.fonte].join(" · ")}
                  </span>
                </div>
                <div className="chip-row">
                  <Button
                    disabled={ocupado}
                    onClick={() => void executar(() => apiFetch(`/planejamento/sugestoes/${s.id}/decidir`, { token, method: "POST", body: JSON.stringify({ aceitar: true }) }))}
                  >
                    Aceitar
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={ocupado}
                    onClick={() => void executar(() => apiFetch(`/planejamento/sugestoes/${s.id}/decidir`, { token, method: "POST", body: JSON.stringify({ aceitar: false }) }))}
                  >
                    Descartar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {novoIndicador && (
          <NovoIndicadorForm
            metaId={meta.id}
            token={token}
            responsaveis={responsaveis}
            onClose={() => setNovoIndicador(false)}
            onSalvo={() => {
              setNovoIndicador(false);
              router.refresh();
            }}
          />
        )}
      </section>
      {erro && <p role="alert" className="gp-erro">{erro}</p>}
    </article>
  );
}

function IndicadorItem({
  ind,
  token,
  podeEditar,
  onAcao,
  ocupado,
}: {
  ind: Indicador;
  token: string;
  podeEditar: boolean;
  onAcao: (fn: () => Promise<unknown>) => Promise<void>;
  ocupado: boolean;
}) {
  const [medir, setMedir] = useState(false);
  const un = ind.unidade ? ` ${ind.unidade}` : "";
  const pct = ind.progresso ?? null;

  async function registrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = String(form.get("dataCorte") || new Date().toISOString().slice(0, 10));
    await onAcao(() =>
      apiFetch(`/planejamento/indicadores/${ind.id}/medicoes`, {
        token,
        method: "POST",
        body: JSON.stringify({
          valorRealizado: String(form.get("valorRealizado") || "").trim(),
          dataCorte: new Date(`${data}T12:00:00`).toISOString(),
          observacao: txt(form, "observacao"),
        }),
      }),
    );
    setMedir(false);
  }

  return (
    <div className="projeto-indicador-chip">
      <div className="projeto-indicador-chip__head">
        <strong>{ind.nome}</strong>
        <Badge tone={pct === null ? "neutral" : pct >= 70 ? "success" : pct >= 35 ? "warning" : "danger"}>
          {pct === null ? "sem medição" : `${pct}%`}
        </Badge>
      </div>
      <div className="gp-ind__metrics">
        <span><small>Base</small>{ind.valorBase ? `${ind.valorBase}${un}` : "—"}</span>
        <span><small>Atual</small>{ind.valorAtual ? `${ind.valorAtual}${un}` : "—"}</span>
        <span><small>Alvo</small>{ind.alvo ? `${ind.alvo}${un}` : "—"}</span>
      </div>
      {pct !== null && (
        <div className="projeto-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso de ${ind.nome}`}>
          <div className="projeto-progress__bar" style={{ width: `${pct}%` }} />
        </div>
      )}
      <span className="dashboard-muted" style={{ fontSize: 12 }}>
        {[ind.periodicidade && ind.periodicidade.toLowerCase(), ind.fonte, ind.polaridade === "MENOR_MELHOR" && "quanto menor, melhor", `Responsável: ${ind.responsavelUser?.name || "a definir"}`]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {podeEditar && !medir && (
        <div className="chip-row">
          <Button variant="secondary" onClick={() => setMedir(true)}>Registrar medição</Button>
          <Button
            variant="ghost"
            disabled={ocupado}
            onClick={() => {
              if (window.confirm(`Remover o indicador "${ind.nome}"?`)) {
                void onAcao(() => apiFetch(`/planejamento/indicadores/${ind.id}`, { token, method: "DELETE" }));
              }
            }}
          >
            Remover
          </Button>
        </div>
      )}
      {medir && (
        <form onSubmit={registrar} className="gp-form gp-form--inline">
          <div><label htmlFor={`val-${ind.id}`}>Valor apurado{un}</label><input id={`val-${ind.id}`} name="valorRealizado" required inputMode="decimal" placeholder="Ex.: 58,4" /></div>
          <div><label htmlFor={`dt-${ind.id}`}>Data de corte</label><input id={`dt-${ind.id}`} name="dataCorte" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
          <div className="gp-form__wide"><label htmlFor={`obs-${ind.id}`}>Observação</label><input id={`obs-${ind.id}`} name="observacao" placeholder="Fonte do dado, ressalvas" /></div>
          <div className="chip-row">
            <Button type="submit" disabled={ocupado}>Salvar</Button>
            <Button type="button" variant="ghost" onClick={() => setMedir(false)}>Cancelar</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function NovoIndicadorForm({
  metaId,
  token,
  responsaveis,
  onClose,
  onSalvo,
}: {
  metaId: string;
  token: string;
  responsaveis: Responsavel[];
  onClose: () => void;
  onSalvo: () => void;
}) {
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSalvando(true);
    setErro("");
    try {
      await apiFetch("/planejamento/indicadores", {
        token,
        method: "POST",
        body: JSON.stringify({
          metaEstrategicaId: metaId,
          nome: txt(form, "nome"),
          unidade: txt(form, "unidade"),
          valorBase: txt(form, "valorBase"),
          alvo: txt(form, "alvo"),
          periodicidade: txt(form, "periodicidade"),
          fonte: txt(form, "fonte"),
          polaridade: txt(form, "polaridade"),
          responsavelUserId: txt(form, "responsavelUserId") ?? null,
        }),
      });
      onSalvo();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar o indicador.");
    } finally {
      setSalvando(false);
    }
  }

  const p = `ind-${metaId}`;
  return (
    <form onSubmit={submit} className="gp-form">
      <div className="gp-form__grid">
        <div className="gp-form__wide"><label htmlFor={`${p}-nome`}>Indicador</label><input id={`${p}-nome`} name="nome" required minLength={3} placeholder="Cobertura da atenção primária" /></div>
        <div><label htmlFor={`${p}-un`}>Unidade</label><input id={`${p}-un`} name="unidade" placeholder="%" /></div>
      </div>
      <div className="gp-form__grid">
        <div><label htmlFor={`${p}-base`}>Linha de base</label><input id={`${p}-base`} name="valorBase" inputMode="decimal" placeholder="42" /></div>
        <div><label htmlFor={`${p}-alvo`}>Alvo</label><input id={`${p}-alvo`} name="alvo" inputMode="decimal" placeholder="70" /></div>
        <div>
          <label htmlFor={`${p}-per`}>Periodicidade</label>
          <select id={`${p}-per`} name="periodicidade" defaultValue="MENSAL">
            {PERIODICIDADES.map((x) => <option key={x} value={x}>{x.charAt(0) + x.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
      </div>
      <div className="gp-form__grid">
        <div><label htmlFor={`${p}-fonte`}>Fonte do dado</label><input id={`${p}-fonte`} name="fonte" placeholder="DATASUS, INEP, sistema municipal…" /></div>
        <div>
          <label htmlFor={`${p}-pol`}>Polaridade</label>
          <select id={`${p}-pol`} name="polaridade" defaultValue="MAIOR_MELHOR">
            <option value="MAIOR_MELHOR">Quanto maior, melhor</option>
            <option value="MENOR_MELHOR">Quanto menor, melhor</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${p}-resp`}>Responsável pela medição</label>
          <select id={`${p}-resp`} name="responsavelUserId">
            <option value="">A definir</option>
            {responsaveis.map((r) => <option key={r.id} value={r.id}>{opcaoResponsavel(r)}</option>)}
          </select>
        </div>
      </div>
      {erro && <p role="alert" className="gp-erro">{erro}</p>}
      <div className="chip-row">
        <Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Salvar indicador"}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  );
}
