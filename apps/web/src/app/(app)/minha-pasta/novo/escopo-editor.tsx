"use client";

import { Button } from "@cip/ui";

/** Nó editável do escopo: Meta → Tarefa → Subtarefa, cada um com responsável. */
export type EscopoNo = {
  codigo: string;
  nivel: "META" | "TAREFA" | "SUBTAREFA";
  nome: string;
  indicador?: string | null;
  alvo?: string | null;
  responsavel?: string | null;
  /** ISO (apenas tarefas). */
  prazo?: string | null;
  origemPerguntaCodigo?: string | null;
  origemValor?: string | null;
  /** Criado pela equipe no wizard (não veio do modelo). */
  manual?: boolean;
  children: EscopoNo[];
};

let sequencia = 0;
export function novoCodigo(nivel: EscopoNo["nivel"]) {
  sequencia += 1;
  return `MANUAL-${nivel}-${Date.now().toString(36)}-${sequencia}`;
}

export function criarNo(nivel: EscopoNo["nivel"], nome: string): EscopoNo {
  return { codigo: novoCodigo(nivel), nivel, nome, manual: true, children: [] };
}

/** Responsável está preenchido? Usado nos avisos do wizard. */
export function temResponsavel(no: { responsavel?: string | null }) {
  return Boolean(no.responsavel?.trim());
}

function patchAt<T>(lista: T[], index: number, patch: Partial<T>): T[] {
  return lista.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function removeAt<T>(lista: T[], index: number): T[] {
  return lista.filter((_, i) => i !== index);
}

function dataParaIso(valor: string): string | null {
  if (!valor) return null;
  // Meio-dia local evita que o fuso desloque o dia ao salvar.
  return new Date(`${valor}T12:00:00`).toISOString();
}

function isoParaData(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function EscopoEditor({
  nodes,
  onChange,
  equipe,
  listId,
}: {
  nodes: EscopoNo[];
  onChange: (next: EscopoNo[]) => void;
  /** Nomes da equipe das pastas envolvidas (sugestões de responsável). */
  equipe: string[];
  listId: string;
}) {
  function atualizarMeta(mi: number, patch: Partial<EscopoNo>) {
    onChange(patchAt(nodes, mi, patch));
  }

  function atualizarTarefas(mi: number, tarefas: EscopoNo[]) {
    onChange(patchAt(nodes, mi, { children: tarefas }));
  }

  function atualizarSubtarefas(mi: number, ti: number, subs: EscopoNo[]) {
    const tarefas = nodes[mi].children;
    atualizarTarefas(mi, patchAt(tarefas, ti, { children: subs }));
  }

  return (
    <div className="stack">
      <datalist id={listId}>
        {equipe.map((nome) => (
          <option key={nome} value={nome} />
        ))}
      </datalist>

      {!nodes.length && (
        <p className="dashboard-muted">
          Nenhuma meta ainda. Adicione a primeira meta para desdobrar o projeto em tarefas.
        </p>
      )}

      {nodes.map((meta, mi) => (
        <article key={meta.codigo} className="entity-card">
          <div className="entity-card__top">
            <strong>Meta {mi + 1}</strong>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(removeAt(nodes, mi))}
            >
              Remover meta
            </Button>
          </div>
          <div className="form-grid form-grid--2">
            <div>
              <label>O que precisa ser entregue</label>
              <input
                value={meta.nome}
                onChange={(e) => atualizarMeta(mi, { nome: e.target.value })}
              />
            </div>
            <div>
              <label>Responsável pela meta</label>
              <input
                list={listId}
                value={meta.responsavel ?? ""}
                placeholder="Nome ou equipe"
                onChange={(e) => atualizarMeta(mi, { responsavel: e.target.value })}
              />
            </div>
          </div>

          <div className="stack" style={{ marginTop: 12 }}>
            {meta.children.map((tarefa, ti) => (
              <div key={tarefa.codigo} className="dashboard-list-item" style={{ display: "block" }}>
                <div className="form-grid form-grid--2">
                  <div>
                    <label>Tarefa</label>
                    <input
                      value={tarefa.nome}
                      onChange={(e) =>
                        atualizarTarefas(
                          mi,
                          patchAt(meta.children, ti, { nome: e.target.value }),
                        )
                      }
                    />
                  </div>
                  <div>
                    <label>Quem faz?</label>
                    <input
                      list={listId}
                      value={tarefa.responsavel ?? ""}
                      placeholder="Nome ou equipe"
                      onChange={(e) =>
                        atualizarTarefas(
                          mi,
                          patchAt(meta.children, ti, { responsavel: e.target.value }),
                        )
                      }
                    />
                  </div>
                  <div>
                    <label>Prazo</label>
                    <input
                      type="date"
                      value={isoParaData(tarefa.prazo)}
                      onChange={(e) =>
                        atualizarTarefas(
                          mi,
                          patchAt(meta.children, ti, { prazo: dataParaIso(e.target.value) }),
                        )
                      }
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "end" }}>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => atualizarTarefas(mi, removeAt(meta.children, ti))}
                    >
                      Remover tarefa
                    </Button>
                  </div>
                </div>

                <ul className="stack" style={{ listStyle: "none", paddingLeft: 16, marginTop: 10 }}>
                  {tarefa.children.map((sub, si) => (
                    <li key={sub.codigo} className="form-grid form-grid--2">
                      <div>
                        <label>Subtarefa</label>
                        <input
                          value={sub.nome}
                          onChange={(e) =>
                            atualizarSubtarefas(
                              mi,
                              ti,
                              patchAt(tarefa.children, si, { nome: e.target.value }),
                            )
                          }
                        />
                      </div>
                      <div>
                        <label>Quem faz?</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            list={listId}
                            value={sub.responsavel ?? ""}
                            placeholder="Nome ou equipe"
                            onChange={(e) =>
                              atualizarSubtarefas(
                                mi,
                                ti,
                                patchAt(tarefa.children, si, { responsavel: e.target.value }),
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              atualizarSubtarefas(mi, ti, removeAt(tarefa.children, si))
                            }
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="ghost"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    atualizarSubtarefas(mi, ti, [
                      ...tarefa.children,
                      criarNo("SUBTAREFA", "Nova subtarefa"),
                    ])
                  }
                >
                  + Subtarefa
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                atualizarTarefas(mi, [...meta.children, criarNo("TAREFA", "Nova tarefa")])
              }
            >
              + Tarefa
            </Button>
          </div>
        </article>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...nodes, criarNo("META", "Nova meta")])}
      >
        + Meta
      </Button>
    </div>
  );
}
