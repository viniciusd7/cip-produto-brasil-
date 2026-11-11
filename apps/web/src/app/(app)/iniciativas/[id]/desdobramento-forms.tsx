"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";

export function DesdobramentoForms({
  mode,
  token,
  iniciativaId,
  metaExecucaoId,
  marcoId,
  equipe = [],
}: {
  mode: "meta" | "tarefa" | "subtarefa";
  token: string;
  iniciativaId?: string;
  metaExecucaoId?: string;
  marcoId?: string;
  /** Nomes da equipe das pastas envolvidas, sugeridos no campo de responsável. */
  equipe?: string[];
}) {
  const router = useRouter();
  const listaEquipe = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const fd = new FormData(e.currentTarget);
    try {
      let url = "";
      let body: Record<string, unknown> = {};
      if (mode === "meta") {
        url = `${API_URL}/iniciativas/${iniciativaId}/metas-execucao`;
        body = {
          nome: String(fd.get("nome") || ""),
          indicador: String(fd.get("indicador") || "") || undefined,
          alvo: String(fd.get("alvo") || "") || undefined,
          responsavel: String(fd.get("responsavel") || "") || undefined,
        };
      } else if (mode === "tarefa") {
        url = `${API_URL}/iniciativas/${iniciativaId}/marcos`;
        const prazo = String(fd.get("prazo") || "");
        body = {
          descricao: String(fd.get("descricao") || ""),
          responsavel: String(fd.get("responsavel") || "") || undefined,
          metaExecucaoId,
          prazoOriginal: prazo ? new Date(prazo).toISOString() : null,
        };
      } else {
        url = `${API_URL}/iniciativas/marcos/${marcoId}/subtarefas`;
        body = {
          descricao: String(fd.get("descricao") || ""),
          responsavel: String(fd.get("responsavel") || "") || undefined,
        };
      }
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao salvar");
      setMsg("Salvo");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  const label =
    mode === "meta"
      ? "+ Meta"
      : mode === "tarefa"
        ? "+ Tarefa"
        : "+ Subtarefa";

  const title =
    mode === "meta"
      ? "Nova meta de execução"
      : mode === "tarefa"
        ? "Nova tarefa"
        : "Nova subtarefa";

  return (
    <div style={{ marginTop: 10 }}>
      {!open ? (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          {label}
        </Button>
      ) : (
        <form onSubmit={onSubmit} className="quick-task-form">
          <strong className="quick-task-form__title">{title}</strong>
          <datalist id={listaEquipe}>
            {equipe.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
          {mode === "meta" && (
            <>
              <div>
                <label>O que precisa ser entregue?</label>
                <input
                  name="nome"
                  required
                  placeholder="Ex.: Concluir regularização patrimonial"
                  autoFocus
                />
              </div>
              <div className="form-grid form-grid--2">
                <div>
                  <label>Indicador</label>
                  <input
                    name="indicador"
                    placeholder="Ex.: % de imóveis regularizados"
                  />
                </div>
                <div>
                  <label>Alvo</label>
                  <input name="alvo" placeholder="Ex.: 80% até dez/2026" />
                </div>
              </div>
              <div>
                <label>Quem responde?</label>
                <input name="responsavel" list={listaEquipe} placeholder="Nome ou equipe" />
              </div>
            </>
          )}
          {mode === "tarefa" && (
            <>
              <div>
                <label>Qual é a tarefa?</label>
                <input
                  name="descricao"
                  required
                  placeholder="Ex.: Publicar edital"
                  autoFocus
                />
              </div>
              <div className="form-grid form-grid--2">
                <div>
                  <label>Prazo</label>
                  <input name="prazo" type="date" />
                </div>
                <div>
                  <label>Quem faz?</label>
                  <input name="responsavel" list={listaEquipe} placeholder="Nome ou equipe" />
                </div>
              </div>
            </>
          )}
          {mode === "subtarefa" && (
            <>
              <div>
                <label>Próximo passo</label>
                <input
                  name="descricao"
                  required
                  placeholder="Ex.: Levantar documentos"
                  autoFocus
                />
              </div>
              <div>
                <label>Quem faz?</label>
                <input name="responsavel" list={listaEquipe} placeholder="Nome ou equipe" />
              </div>
            </>
          )}
          <div className="chip-row">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            {msg && <span className="dashboard-muted">{msg}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
