"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@cip/ui";
import { API_URL } from "@/lib/api";
import type { TarefaGestaoItem } from "../minha-pasta/tarefas-gestao";

type Projeto = { id: string; label: string };
type Responsavel = { id: string; name: string; secretaria?: { nome: string; sigla?: string | null } | null };

export function AcaoForm({ token, iniciativas, tarefas, responsaveis, usuarioId, administrador }: {
  token: string;
  iniciativas: Projeto[];
  tarefas: TarefaGestaoItem[];
  responsaveis: Responsavel[];
  usuarioId: string;
  administrador: boolean;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"TAREFA" | "SUBTAREFA">("TAREFA");
  const [projetoId, setProjetoId] = useState(iniciativas[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const tarefasProjeto = tarefas.filter((tarefa) =>
    tarefa.iniciativaId === projetoId &&
    !["CONCLUIDO", "ENCERRADO_SEM_SOLUCAO"].includes(tarefa.status) &&
    (administrador || !tarefa.responsavelUserId || tarefa.responsavelUserId === usuarioId)
  );
  const pessoas = [...new Map(responsaveis.map((pessoa) => [pessoa.id, pessoa])).values()];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formulario = event.currentTarget;
    const form = new FormData(formulario);
    const descricao = String(form.get("descricao") || "").trim();
    const responsavelUserId = String(form.get("responsavelUserId") || "");
    const prazo = String(form.get("prazo") || "");
    const marcoId = String(form.get("marcoId") || "");
    if (!projetoId || (tipo === "SUBTAREFA" && !tarefasProjeto.some((tarefa) => tarefa.id === marcoId))) {
      setError("Selecione um projeto e uma tarefa aberta para a subtarefa.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const endpoint = tipo === "TAREFA" ? `/iniciativas/${projetoId}/marcos` : `/iniciativas/marcos/${marcoId}/subtarefas`;
      const body = tipo === "TAREFA"
        ? { descricao, responsavelUserId, prazoOriginal: new Date(`${prazo}T12:00:00`).toISOString() }
        : { descricao, responsavelUserId, prazo: new Date(`${prazo}T12:00:00`).toISOString() };
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "Não foi possível salvar.");
      formulario.reset();
      setTipo("TAREFA");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Criar tarefa ou subtarefa" subtitle="Defina o projeto, o responsável e o prazo da entrega.">
      {!iniciativas.length ? (
        <p className="dashboard-muted">Nenhum projeto disponível para cadastrar tarefas.</p>
      ) : (
        <form onSubmit={submit} className="quick-task-form">
          <fieldset className="tarefa-criacao__tipo">
            <legend>O que deseja criar?</legend>
            <label><input type="radio" name="tipo" value="TAREFA" checked={tipo === "TAREFA"} onChange={() => setTipo("TAREFA")} /> Tarefa</label>
            <label><input type="radio" name="tipo" value="SUBTAREFA" checked={tipo === "SUBTAREFA"} onChange={() => setTipo("SUBTAREFA")} /> Subtarefa</label>
          </fieldset>
          <div>
            <label htmlFor="tarefa-projeto">Projeto</label>
            <select id="tarefa-projeto" name="iniciativaId" value={projetoId} onChange={(event) => setProjetoId(event.target.value)} required>
              {iniciativas.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          {tipo === "SUBTAREFA" && (
            <div>
              <label htmlFor="tarefa-pai">Tarefa principal</label>
              <select id="tarefa-pai" name="marcoId" required defaultValue="" key={projetoId}>
                <option value="" disabled>Selecione a tarefa</option>
                {tarefasProjeto.map((tarefa) => <option key={tarefa.id} value={tarefa.id}>{tarefa.codigo ? `${tarefa.codigo} · ` : ""}{tarefa.descricao}</option>)}
              </select>
              {!tarefasProjeto.length && <small className="dashboard-muted">Crie primeiro uma tarefa aberta neste projeto.</small>}
            </div>
          )}
          <div>
            <label htmlFor="tarefa-descricao">{tipo === "TAREFA" ? "Tarefa" : "Subtarefa"}</label>
            <input id="tarefa-descricao" name="descricao" required minLength={3} placeholder="Descreva a entrega" />
          </div>
          <div className="form-grid form-grid--2">
            <div>
              <label htmlFor="tarefa-responsavel">Responsável</label>
              <select id="tarefa-responsavel" name="responsavelUserId" required defaultValue="">
                <option value="" disabled>Selecione uma pessoa</option>
                {pessoas.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.name}{pessoa.secretaria ? ` · ${pessoa.secretaria.sigla || pessoa.secretaria.nome}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tarefa-prazo">Prazo</label>
              <input id="tarefa-prazo" name="prazo" type="date" required />
            </div>
          </div>
          {error && <p role="alert" className="gp-erro">{error}</p>}
          <Button type="submit" disabled={saving || !pessoas.length || (tipo === "SUBTAREFA" && !tarefasProjeto.length)}>
            {saving ? "Salvando..." : tipo === "TAREFA" ? "Criar tarefa" : "Criar subtarefa"}
          </Button>
          {!pessoas.length && <p className="dashboard-muted">Cadastre um responsável na equipe para atribuir a entrega.</p>}
        </form>
      )}
    </Card>
  );
}
