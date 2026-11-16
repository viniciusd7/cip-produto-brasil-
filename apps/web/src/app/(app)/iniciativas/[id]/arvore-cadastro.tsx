"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";
import type { ProjetoDocData, ProjetoDocMeta } from "./projeto-documento";

type MetaPlano = {
  id: string;
  nome: string;
  codigo?: string | null;
  secretaria?: { nome: string; sigla?: string | null } | null;
};

type Plano = { id: string; nome: string; metas: MetaPlano[] };

type Indicador = {
  id: string;
  nome: string;
  unidade?: string | null;
  alvo?: string | null;
  metaEstrategicaId?: string | null;
  metaExecucaoId?: string | null;
};

type Selecao =
  | { tipo: "estruturante" }
  | { tipo: "indicador-est" }
  | { tipo: "nova-exec" }
  | { tipo: "indicador-exec"; metaId: string }
  | { tipo: "nova-tarefa"; metaId: string }
  | { tipo: "nova-sub"; marcoId: string; metaId: string };

export function ArvoreCadastro({
  token,
  iniciativaId,
  secretariaId,
  metaEstrategica,
  permiteMetaPlano,
  metasExecucao,
  equipe,
}: {
  token: string;
  iniciativaId: string;
  secretariaId: string;
  metaEstrategica?: ProjetoDocData["metaEstrategica"];
  permiteMetaPlano: boolean;
  metasExecucao: ProjetoDocMeta[];
  equipe: string[];
}) {
  const router = useRouter();
  const [selecao, setSelecao] = useState<Selecao>(
    metaEstrategica || !permiteMetaPlano ? { tipo: "nova-exec" } : { tipo: "estruturante" },
  );
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    Promise.all([
      fetch(`${API_URL}/planejamento/resumo`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API_URL}/planejamento/indicadores`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ]).then(([planosJson, indJson]) => {
      if (cancelado) return;
      setPlanos(planosJson.data || []);
      setIndicadores(indJson.data || []);
    }).catch(() => {
      if (!cancelado) setErro("Não foi possível carregar metas e indicadores.");
    });
    return () => {
      cancelado = true;
    };
  }, [token, metaEstrategica?.id, metasExecucao.length]);

  const metasPlano = planos.flatMap((p) => p.metas);
  const indsEst = indicadores.filter((i) => i.metaEstrategicaId === metaEstrategica?.id);

  async function salvar(url: string, body: Record<string, unknown>, method = "POST") {
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao salvar");
      router.refresh();
      const ind = await fetch(`${API_URL}/planejamento/indicadores`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      setIndicadores(ind.data || []);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  async function garantirPlano() {
    if (planos[0]) return planos[0].id;
    const res = await fetch(`${API_URL}/planejamento/planos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nome: "Plano de governo" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || "Não foi possível abrir o plano");
    setPlanos((atual) => [...atual, { ...json.data, metas: [] }]);
    return json.data.id as string;
  }

  function ativo(id: string) {
    if (selecao.tipo === "estruturante") return id === "estruturante";
    if (selecao.tipo === "indicador-est") return id === "indicador-est";
    if (selecao.tipo === "nova-exec") return id === "nova-exec";
    if (selecao.tipo === "indicador-exec") return id === `ind:${selecao.metaId}`;
    if (selecao.tipo === "nova-tarefa") return id === `tarefa:${selecao.metaId}`;
    return id === `sub:${selecao.marcoId}`;
  }

  return (
    <section className="cadastro-arvore" aria-label="Cadastro do projeto">
      <header className="cadastro-arvore__head">
        <div>
          <p>Cadastro do projeto</p>
          <h2>Das metas às tarefas</h2>
        </div>
        <small>Escolha o nível na árvore e registre ali mesmo.</small>
      </header>
      <div className="cadastro-arvore__corpo">
        <ul className="cadastro-arvore__nos">
          {permiteMetaPlano && <li>
            <button type="button" aria-current={ativo("estruturante") ? "true" : undefined} onClick={() => setSelecao({ tipo: "estruturante" })}>
              <span>Meta do plano de governo</span>
              <strong>{metaEstrategica?.nome || "A definir"}</strong>
            </button>
            {metaEstrategica && (
              <ul>
                {indsEst.map((ind) => (
                  <li key={ind.id}>
                    <span className="cadastro-arvore__folha">Indicador · {ind.nome}</span>
                  </li>
                ))}
                <li>
                  <button type="button" aria-current={ativo("indicador-est") ? "true" : undefined} onClick={() => setSelecao({ tipo: "indicador-est" })}>
                    <span>+ Indicador</span>
                  </button>
                </li>
              </ul>
            )}
          </li>}
          <li>
            <span className="cadastro-arvore__grupo">Metas de execução</span>
            <ul>
              {metasExecucao.map((meta) => {
                const inds = indicadores.filter((i) => i.metaExecucaoId === meta.id);
                return (
                  <li key={meta.id}>
                    <span className="cadastro-arvore__folha">Meta de execução · {meta.nome}</span>
                    <ul>
                      {inds.map((ind) => (
                        <li key={ind.id}>
                          <span className="cadastro-arvore__folha">Indicador · {ind.nome}</span>
                        </li>
                      ))}
                      {!inds.length && meta.indicador && (
                        <li>
                          <span className="cadastro-arvore__folha">Indicador · {meta.indicador}</span>
                        </li>
                      )}
                      <li>
                        <button type="button" aria-current={ativo(`ind:${meta.id}`) ? "true" : undefined} onClick={() => setSelecao({ tipo: "indicador-exec", metaId: meta.id })}>
                          <span>+ Indicador</span>
                        </button>
                      </li>
                      {meta.marcos.map((tarefa) => (
                        <li key={tarefa.id}>
                          <span className="cadastro-arvore__folha">Tarefa · {tarefa.descricao}</span>
                          <ul>
                            {tarefa.subtarefas.map((sub) => (
                              <li key={sub.id}>
                                <span className="cadastro-arvore__folha">Subtarefa · {sub.descricao}</span>
                              </li>
                            ))}
                            <li>
                              <button type="button" aria-current={ativo(`sub:${tarefa.id}`) ? "true" : undefined} onClick={() => setSelecao({ tipo: "nova-sub", marcoId: tarefa.id, metaId: meta.id })}>
                                <span>+ Subtarefa</span>
                              </button>
                            </li>
                          </ul>
                        </li>
                      ))}
                      <li>
                        <button type="button" aria-current={ativo(`tarefa:${meta.id}`) ? "true" : undefined} onClick={() => setSelecao({ tipo: "nova-tarefa", metaId: meta.id })}>
                          <span>+ Tarefa</span>
                        </button>
                      </li>
                    </ul>
                  </li>
                );
              })}
              <li>
                <button type="button" aria-current={ativo("nova-exec") ? "true" : undefined} onClick={() => setSelecao({ tipo: "nova-exec" })}>
                  <span>+ Meta de execução</span>
                </button>
              </li>
            </ul>
          </li>
        </ul>

        <form
          key={selecao.tipo + ("metaId" in selecao ? selecao.metaId : "") + ("marcoId" in selecao ? selecao.marcoId : "")}
          className="quick-task-form cadastro-arvore__form"
          onSubmit={async (event) => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            const texto = (nome: string) => String(fd.get(nome) || "").trim();
            try {
              if (selecao.tipo === "estruturante") {
                const existente = texto("metaId");
                if (existente) {
                  await salvar(`${API_URL}/iniciativas/${iniciativaId}`, { metaEstrategicaId: existente }, "PATCH");
                  return;
                }
                if (texto("nome").length < 3) {
                  setErro("Dê um nome à meta do plano de governo ou escolha uma já cadastrada.");
                  return;
                }
                const planoId = await garantirPlano();
                const criada = await fetch(`${API_URL}/planejamento/metas`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({
                    planoId,
                    secretariaId,
                    nome: texto("nome"),
                    indicador: texto("indicador") || undefined,
                    alvo: texto("alvo") || undefined,
                    unidade: texto("unidade") || undefined,
                  }),
                });
                const json = await criada.json();
                if (!criada.ok) throw new Error(json?.error?.message || "Falha ao criar a meta");
                await salvar(`${API_URL}/iniciativas/${iniciativaId}`, { metaEstrategicaId: json.data.id }, "PATCH");
                return;
              }
              if (selecao.tipo === "indicador-est" && metaEstrategica) {
                await salvar(`${API_URL}/planejamento/indicadores`, {
                  metaEstrategicaId: metaEstrategica.id,
                  nome: texto("nome"),
                  unidade: texto("unidade") || undefined,
                  alvo: texto("alvo") || undefined,
                  valorBase: texto("valorBase") || undefined,
                });
                return;
              }
              if (selecao.tipo === "nova-exec") {
                await salvar(`${API_URL}/iniciativas/${iniciativaId}/metas-execucao`, {
                  nome: texto("nome"),
                  indicador: texto("indicador") || undefined,
                  alvo: texto("alvo") || undefined,
                  responsavel: texto("responsavel") || undefined,
                });
                return;
              }
              if (selecao.tipo === "indicador-exec") {
                await salvar(`${API_URL}/planejamento/indicadores`, {
                  metaExecucaoId: selecao.metaId,
                  nome: texto("nome"),
                  unidade: texto("unidade") || undefined,
                  alvo: texto("alvo") || undefined,
                  valorBase: texto("valorBase") || undefined,
                });
                return;
              }
              if (selecao.tipo === "nova-tarefa") {
                const prazo = texto("prazo");
                await salvar(`${API_URL}/iniciativas/${iniciativaId}/marcos`, {
                  descricao: texto("descricao"),
                  responsavel: texto("responsavel") || undefined,
                  metaExecucaoId: selecao.metaId,
                  prazoOriginal: prazo ? new Date(prazo).toISOString() : null,
                });
                return;
              }
              if (selecao.tipo !== "nova-sub") return;
              await salvar(`${API_URL}/iniciativas/marcos/${selecao.marcoId}/subtarefas`, {
                descricao: texto("descricao"),
                responsavel: texto("responsavel") || undefined,
              });
            } catch (err) {
              setErro(err instanceof Error ? err.message : "Erro");
            }
          }}
        >
          <Formulario selecao={selecao} metasPlano={metasPlano} metasExecucao={metasExecucao} equipe={equipe} salvando={salvando} />
          {erro && <p className="cadastro-arvore__erro">{erro}</p>}
        </form>
      </div>
    </section>
  );
}

function Formulario({
  selecao,
  metasPlano,
  metasExecucao,
  equipe,
  salvando,
}: {
  selecao: Selecao;
  metasPlano: MetaPlano[];
  metasExecucao: ProjetoDocMeta[];
  equipe: string[];
  salvando: boolean;
}) {
  const lista = "equipe-cadastro-arvore";
  const metaExec = "metaId" in selecao ? metasExecucao.find((m) => m.id === selecao.metaId) : undefined;

  return (
    <>
      <datalist id={lista}>
        {equipe.map((nome) => (
          <option key={nome} value={nome} />
        ))}
      </datalist>
      {selecao.tipo === "estruturante" && (
        <>
          <strong className="quick-task-form__title">Meta do plano de governo</strong>
          {!!metasPlano.length && (
            <div>
              <label htmlFor="metaId">Usar uma meta já cadastrada</label>
              <select id="metaId" name="metaId" defaultValue="">
                <option value="">Criar uma nova</option>
                {metasPlano.map((meta) => (
                  <option key={meta.id} value={meta.id}>
                    {meta.codigo ? `${meta.codigo} · ` : ""}
                    {meta.nome}
                    {meta.secretaria?.sigla ? ` (${meta.secretaria.sigla})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="nome-est">Nova meta do plano de governo</label>
            <input id="nome-est" name="nome" placeholder="Ex.: Ampliar a cobertura da atenção básica" />
          </div>
          <div className="form-grid form-grid--2">
            <div>
              <label htmlFor="ind-est">Indicador</label>
              <input id="ind-est" name="indicador" placeholder="Ex.: % de cobertura" />
            </div>
            <div>
              <label htmlFor="alvo-est">Alvo</label>
              <input id="alvo-est" name="alvo" placeholder="Ex.: 90%" />
            </div>
          </div>
          <div>
            <label htmlFor="un-est">Unidade</label>
            <input id="un-est" name="unidade" placeholder="Ex.: %" />
          </div>
        </>
      )}
      {(selecao.tipo === "indicador-est" || selecao.tipo === "indicador-exec") && (
        <>
          <strong className="quick-task-form__title">
            Indicador {selecao.tipo === "indicador-exec" ? `· ${metaExec?.nome || "meta de execução"}` : "da meta do plano de governo"}
          </strong>
          <div>
            <label htmlFor="nome-ind">Nome do indicador</label>
            <input id="nome-ind" name="nome" required minLength={3} placeholder="Ex.: Imóveis regularizados" autoFocus />
          </div>
          <div className="form-grid form-grid--2">
            <div>
              <label htmlFor="base-ind">Ponto de partida</label>
              <input id="base-ind" name="valorBase" placeholder="Ex.: 20" />
            </div>
            <div>
              <label htmlFor="alvo-ind">Alvo</label>
              <input id="alvo-ind" name="alvo" placeholder="Ex.: 80" />
            </div>
          </div>
          <div>
            <label htmlFor="un-ind">Unidade</label>
            <input id="un-ind" name="unidade" placeholder="Ex.: %" />
          </div>
        </>
      )}
      {selecao.tipo === "nova-exec" && (
        <>
          <strong className="quick-task-form__title">Meta de execução</strong>
          <div>
            <label htmlFor="nome-exec">O que precisa ser entregue?</label>
            <input id="nome-exec" name="nome" required placeholder="Ex.: Concluir a regularização patrimonial" autoFocus />
          </div>
          <div className="form-grid form-grid--2">
            <div>
              <label htmlFor="ind-exec">Indicador</label>
              <input id="ind-exec" name="indicador" placeholder="Ex.: % de imóveis regularizados" />
            </div>
            <div>
              <label htmlFor="alvo-exec">Alvo</label>
              <input id="alvo-exec" name="alvo" placeholder="Ex.: 80% até dez/2026" />
            </div>
          </div>
          <div>
            <label htmlFor="resp-exec">Quem responde?</label>
            <input id="resp-exec" name="responsavel" list={lista} placeholder="Nome ou equipe" />
          </div>
        </>
      )}
      {selecao.tipo === "nova-tarefa" && (
        <>
          <strong className="quick-task-form__title">Tarefa · {metaExec?.nome}</strong>
          <div>
            <label htmlFor="desc-tar">Qual é a tarefa?</label>
            <input id="desc-tar" name="descricao" required placeholder="Ex.: Publicar edital" autoFocus />
          </div>
          <div className="form-grid form-grid--2">
            <div>
              <label htmlFor="prazo-tar">Prazo</label>
              <input id="prazo-tar" name="prazo" type="date" />
            </div>
            <div>
              <label htmlFor="resp-tar">Quem faz?</label>
              <input id="resp-tar" name="responsavel" list={lista} placeholder="Nome ou equipe" />
            </div>
          </div>
        </>
      )}
      {selecao.tipo === "nova-sub" && (
        <>
          <strong className="quick-task-form__title">Subtarefa</strong>
          <div>
            <label htmlFor="desc-sub">Próximo passo</label>
            <input id="desc-sub" name="descricao" required placeholder="Ex.: Levantar documentos" autoFocus />
          </div>
          <div>
            <label htmlFor="resp-sub">Quem faz?</label>
            <input id="resp-sub" name="responsavel" list={lista} placeholder="Nome ou equipe" />
          </div>
        </>
      )}
      <div className="chip-row">
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar neste nível"}
        </Button>
      </div>
    </>
  );
}
