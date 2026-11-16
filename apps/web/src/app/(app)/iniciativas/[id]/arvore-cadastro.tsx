"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";
import type { ProjetoDocData, ProjetoDocMarco } from "./projeto-documento";

type Selecao =
  | { tipo: "nova-tarefa" }
  | { tipo: "nova-sub"; marcoId: string };

export function criarPayloadTarefa({
  descricao,
  responsavel,
  prazo,
}: {
  descricao: string;
  responsavel?: string;
  prazo?: string;
}) {
  return {
    descricao,
    responsavel: responsavel || undefined,
    prazoOriginal: prazo ? new Date(`${prazo}T12:00:00`).toISOString() : null,
  };
}

export function ArvoreCadastro({
  token,
  iniciativaId,
  metaEstrategica,
  permiteMetaPlano,
  marcos,
  equipe,
}: {
  token: string;
  iniciativaId: string;
  metaEstrategica?: ProjetoDocData["metaEstrategica"];
  permiteMetaPlano: boolean;
  marcos: ProjetoDocMarco[];
  equipe: string[];
}) {
  const router = useRouter();
  const [selecao, setSelecao] = useState<Selecao>({ tipo: "nova-tarefa" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(url: string, body: Record<string, unknown>) {
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao salvar");
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro");
    } finally {
      setSalvando(false);
    }
  }

  function ativo(id: string) {
    if (selecao.tipo === "nova-tarefa") return id === "tarefa";
    return id === `sub:${selecao.marcoId}`;
  }

  return (
    <section className="cadastro-arvore" aria-label="Cadastro do projeto">
      <header className="cadastro-arvore__head">
        <div>
          <p>Tarefas do projeto</p>
          <h2>Tarefas e subtarefas</h2>
        </div>
        <small>Crie tarefas diretamente no projeto e desdobre-as em subtarefas.</small>
      </header>
      <div className="cadastro-arvore__corpo">
        <ul className="cadastro-arvore__nos">
          {(metaEstrategica || permiteMetaPlano) && (
            <li>
              {permiteMetaPlano ? (
                <Link className="cadastro-arvore__folha" href={`/iniciativas/${iniciativaId}?aba=metas`}>
                  Meta estratégica do projeto: {metaEstrategica?.nome || "Cadastrar na aba Metas e indicadores"}
                </Link>
              ) : (
                <span className="cadastro-arvore__folha">
                  Meta estratégica do projeto: {metaEstrategica?.nome}
                </span>
              )}
            </li>
          )}
          <li>
            <span className="cadastro-arvore__grupo">Tarefas do projeto</span>
            <ul>
              <li>
                <button type="button" aria-current={ativo("tarefa") ? "true" : undefined} onClick={() => setSelecao({ tipo: "nova-tarefa" })}>
                  <span>+ Tarefa</span>
                </button>
              </li>
              {marcos.map((tarefa) => (
                <li key={tarefa.id}>
                  <span className="cadastro-arvore__folha">Tarefa · {tarefa.descricao}</span>
                  <ul>
                    {tarefa.subtarefas.map((sub) => (
                      <li key={sub.id}>
                        <span className="cadastro-arvore__folha">Subtarefa · {sub.descricao}</span>
                      </li>
                    ))}
                    <li>
                      <button type="button" aria-current={ativo(`sub:${tarefa.id}`) ? "true" : undefined} onClick={() => setSelecao({ tipo: "nova-sub", marcoId: tarefa.id })}>
                        <span>+ Subtarefa</span>
                      </button>
                    </li>
                  </ul>
                </li>
              ))}
            </ul>
          </li>
        </ul>

        <form
          key={selecao.tipo + ("marcoId" in selecao ? selecao.marcoId : "")}
          className="quick-task-form cadastro-arvore__form"
          onSubmit={async (event) => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            const texto = (nome: string) => String(fd.get(nome) || "").trim();
            if (selecao.tipo === "nova-tarefa") {
              await salvar(`${API_URL}/iniciativas/${iniciativaId}/marcos`, {
                ...criarPayloadTarefa({
                  descricao: texto("descricao"),
                  responsavel: texto("responsavel"),
                  prazo: texto("prazo"),
                }),
              });
              return;
            }
            await salvar(`${API_URL}/iniciativas/marcos/${selecao.marcoId}/subtarefas`, {
              descricao: texto("descricao"),
              responsavel: texto("responsavel") || undefined,
              prazo: texto("prazo") ? new Date(`${texto("prazo")}T12:00:00`).toISOString() : null,
            });
          }}
        >
          <Formulario selecao={selecao} equipe={equipe} salvando={salvando} />
          {erro && <p className="cadastro-arvore__erro">{erro}</p>}
        </form>
      </div>
    </section>
  );
}

function Formulario({
  selecao,
  equipe,
  salvando,
}: {
  selecao: Selecao;
  equipe: string[];
  salvando: boolean;
}) {
  const lista = "equipe-cadastro-arvore";

  return (
    <>
      <datalist id={lista}>
        {equipe.map((nome) => (
          <option key={nome} value={nome} />
        ))}
      </datalist>
      {selecao.tipo === "nova-tarefa" && (
        <>
          <strong className="quick-task-form__title">
            Nova tarefa
          </strong>
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
          <div>
            <label htmlFor="prazo-sub">Prazo</label>
            <input id="prazo-sub" name="prazo" type="date" />
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
