"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { apiFetch } from "@/lib/api";
import { secretariaLabel } from "@/lib/secretaria-label";
import { NovaMetaForm } from "./nova-meta-form";

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
  podeEditar: boolean;
};

export function PlanoEstrutura({ planos, ...ctx }: Ctx & { planos: Plano[] }) {
  const [busca, setBusca] = useState("");
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [secretariaId, setSecretariaId] = useState("");
  const secretarias = Array.from(new Map(planos.flatMap((plano) => plano.metas.flatMap((meta) => {
    const id = meta.secretariaId || meta.secretaria?.id;
    return id && meta.secretaria ? [[id, { ...meta.secretaria, id }] as const] : [];
  }))).values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const termo = normalizar(busca.trim());
  const filtrados = planos.map((plano) => ({ ...plano, metas: plano.metas.filter((meta) =>
    (!secretariaId || (meta.secretariaId || meta.secretaria?.id) === secretariaId) &&
    (!termo || normalizar([meta.codigo, meta.nome, meta.secretaria?.nome, meta.secretaria?.sigla, ...meta.indicadores.map((ind) => ind.nome)].filter(Boolean).join(" ")).includes(termo)),
  ) }));
  const total = filtrados.reduce((soma, plano) => soma + plano.metas.length, 0);
  const filtrando = Boolean(busca.trim() || secretariaId);

  return (
    <>
      <div className="gp-toolbar">
      {planos.some((plano) => plano.metas.length > 0) && <div className="gp-filtros" role="search" aria-label="Filtrar metas estratégicas">
        <label htmlFor="busca-metas">Buscar meta ou indicador
          <input id="busca-metas" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome da meta, código ou indicador" />
        </label>
        <label htmlFor="filtro-secretaria">Secretaria
          <select id="filtro-secretaria" value={secretariaId} onChange={(event) => setSecretariaId(event.target.value)}>
            <option value="">Todas as secretarias</option>
            {secretarias.map((secretaria) => <option key={secretaria.id} value={secretaria.id}>{secretaria.nome}</option>)}
          </select>
        </label>
        {filtrando && <Button variant="ghost" onClick={() => { setBusca(""); setSecretariaId(""); }}>Limpar filtros</Button>}
      </div>}
      {ctx.podeEditar && planos.length > 0 && <div className="gp-cadastro"><NovaMetaForm planos={planos} token={ctx.token} secretarias={ctx.secretarias} /></div>}
      </div>
      {filtrando && <p className="dashboard-muted" role="status">{total} {total === 1 ? "meta encontrada" : "metas encontradas"}.</p>}
      {filtrados.filter((plano) => !filtrando || plano.metas.length > 0).map((plano) => (
        <section key={plano.id} className="gp-plano" aria-labelledby={`plano-${plano.id}`}>
          <header className="gp-plano__head">
            <h2 id={`plano-${plano.id}`}>{plano.nome}</h2>
          </header>
          {plano.metas.length > 0 ? <table className="gp-tabela">
            <caption className="gp-sr-only">Metas e indicadores de {plano.nome}</caption>
            <colgroup><col className="gp-col-meta" /><col className="gp-col-secretaria" /><col className="gp-col-indicador" /><col /><col /><col className="gp-col-acao" /></colgroup>
            <thead><tr><th scope="col">Meta estratégica</th><th scope="col">Secretaria</th><th scope="col">Indicador</th><th scope="col">Atual</th><th scope="col">Alvo</th><th scope="col"><span className="gp-sr-only">Detalhes</span></th></tr></thead>
            {plano.metas.map((meta) => <MetaLinha key={meta.id} meta={meta} aberta={abertaId === meta.id} onToggle={() => setAbertaId((atual) => atual === meta.id ? null : meta.id)} {...ctx} />)}
          </table> : <p className="dashboard-muted">Nenhuma meta cadastrada.{ctx.podeEditar ? " Use “Nova meta estratégica” para começar." : ""}</p>}

        </section>
      ))}
    </>
  );
}

function valorIndicador(valor: string | null | undefined, unidade?: string | null) {
  return valor != null && valor !== "" ? `${valor}${unidade ? ` ${unidade}` : ""}` : "—";
}

function MetaLinha({ meta, aberta, onToggle, ...ctx }: Ctx & { meta: Meta; aberta: boolean; onToggle: () => void }) {
  const indicadores = meta.indicadores.length ? meta.indicadores : [null];
  return (
    <tbody className={`gp-meta-grupo${aberta ? " gp-meta-grupo--aberta" : ""}`}>
      {indicadores.map((indicador, index) => <tr className="gp-resumo" key={indicador?.id || meta.id}>
        {index === 0 && <>
          <th scope="rowgroup" rowSpan={indicadores.length} className="gp-meta-nome">
            <button type="button" onClick={onToggle} aria-expanded={aberta} aria-controls={`detalhes-${meta.id}`}>{meta.nome}</button>
            {meta.codigo && <span className="gp-meta-codigo">{meta.codigo}</span>}
          </th>
          <td rowSpan={indicadores.length} className="gp-meta-secretaria">{meta.secretaria?.nome || "Secretaria a definir"}</td>
        </>}
        <td className="gp-resumo-indicador">{indicador?.nome || <span className="gp-sem-indicador">Sem indicador cadastrado</span>}{indicador?.unidade && <span className="gp-resumo-unidade">Unidade: {indicador.unidade}</span>}</td>
        <td className="gp-valor" data-label="Atual">{valorIndicador(indicador?.valorAtual)}</td>
        <td className="gp-valor" data-label="Alvo">{valorIndicador(indicador?.alvo)}</td>
        {index === 0 && <td rowSpan={indicadores.length} className="gp-abrir"><button type="button" aria-label={`${aberta ? "Fechar" : "Abrir"} meta: ${meta.nome}`} aria-expanded={aberta} aria-controls={`detalhes-${meta.id}`} onClick={onToggle}>{aberta ? "Fechar" : "Abrir"}<span aria-hidden="true">{aberta ? "⌃" : "⌄"}</span></button></td>}
      </tr>)}
      <tr className="gp-detalhe-linha" hidden={!aberta} id={`detalhes-${meta.id}`}>
        <td colSpan={6}>{aberta && <MetaDetalhes meta={meta} {...ctx} />}</td>
      </tr>
    </tbody>
  );
}

function MetaDetalhes({ meta, token, secretarias, responsaveis, podeEditar }: Ctx & { meta: Meta }) {
  const router = useRouter();
  const [novoIndicador, setNovoIndicador] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

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
        <div>
          {meta.codigo && <span className="gp-meta__codigo">{meta.codigo}</span>}
          <h3 className="gp-meta__title">{meta.nome}</h3>
          <p className="gp-meta__secretaria">{meta.secretaria ? secretariaLabel(meta.secretaria) : "Secretaria a definir"}</p>
        </div>
      </header>

      <section className="gp-meta__section" aria-label={`Indicadores da meta ${meta.nome}`}>
        <div className="gp-meta__section-head">
          <h4>Indicadores ({meta.indicadores.length})</h4>
          {podeEditar && <Button variant="secondary" onClick={() => setNovoIndicador((aberto) => !aberto)} aria-expanded={novoIndicador} aria-controls={`novo-indicador-${meta.id}`}>{novoIndicador ? "Cancelar indicador" : "+ Indicador"}</Button>}
        </div>
        {meta.indicadores.length === 0 && (
          <p className="dashboard-muted" style={{ margin: 0 }}>
            {meta.indicador ? `Indicador descrito no plano: ${meta.indicador}${meta.alvo ? ` (alvo ${meta.alvo})` : ""}. Cadastre-o para medir.` : "Nenhum indicador cadastrado."}
          </p>
        )}
        {meta.indicadores.map((ind) => (
          <IndicadorItem key={ind.id} ind={ind} token={token} podeEditar={podeEditar} onAcao={executar} ocupado={ocupado} />
        ))}

        {novoIndicador && (
          <div id={`novo-indicador-${meta.id}`}><NovoIndicadorForm
            metaId={meta.id}
            token={token}
            responsaveis={responsaveis}
            onClose={() => setNovoIndicador(false)}
            onSalvo={() => {
              setNovoIndicador(false);
              router.refresh();
            }}
          /></div>
        )}
      </section>
      <details className="gp-detalhes">
        <summary>Detalhes da meta</summary>
        {meta.descricao && <p className="dashboard-muted">{meta.descricao}</p>}
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


      </details>

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
    <div className="gp-indicador">
      <div className="projeto-indicador-chip__head">
        <strong>{ind.nome}</strong>
      </div>
      <div className="gp-ind__metrics">
        <span><small>Atual</small>{ind.valorAtual ? `${ind.valorAtual}${un}` : "—"}</span>
        <span><small>Alvo</small>{ind.alvo ? `${ind.alvo}${un}` : "—"}</span>
      </div>
      <details className="gp-detalhes">
        <summary>{podeEditar ? "Detalhes e medição" : "Detalhes do indicador"}</summary>
        <p className="dashboard-muted">Valor base: {ind.valorBase ? `${ind.valorBase}${un}` : "A definir"}</p>
        <p className="dashboard-muted">
          {[ind.periodicidade && ind.periodicidade.toLowerCase(), ind.fonte, ind.polaridade === "MENOR_MELHOR" && "quanto menor, melhor", `Responsável: ${ind.responsavelUser?.name || "a definir"}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
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
      </details>
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
