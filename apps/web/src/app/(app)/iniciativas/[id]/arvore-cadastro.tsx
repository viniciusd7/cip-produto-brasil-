"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";
import type { ResponsavelOpcao } from "../../minha-pasta/tarefas-edicao";

export function criarPayloadTarefa({ descricao, responsavel, prazo }: {
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

export function CadastroTarefaProjeto({ token, iniciativaId, responsaveis, marcoId, tarefaDescricao, onFechar }: {
  token: string;
  iniciativaId: string;
  responsaveis: ResponsavelOpcao[];
  marcoId?: string;
  tarefaDescricao?: string;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const pessoas = [...new Map(responsaveis.map((pessoa) => [pessoa.id, pessoa])).values()];

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const descricao = String(form.get("descricao") || "").trim();
    const responsavelUserId = String(form.get("responsavelUserId") || "");
    const prazo = String(form.get("prazo") || "");
    const url = marcoId
      ? `${API_URL}/iniciativas/marcos/${marcoId}/subtarefas`
      : `${API_URL}/iniciativas/${iniciativaId}/marcos`;
    const body = marcoId
      ? { descricao, responsavelUserId, prazo: new Date(`${prazo}T12:00:00`).toISOString() }
      : { descricao, responsavelUserId, prazoOriginal: new Date(`${prazo}T12:00:00`).toISOString() };
    setSalvando(true);
    setErro("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error?.message || "Não foi possível criar a tarefa.");
      onFechar();
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="pj-cadastro-compacto" onSubmit={salvar}>
      <div className="pj-cadastro-compacto__head">
        <div><strong>{marcoId ? "Nova subtarefa" : "Nova tarefa"}</strong>{tarefaDescricao && <small>Em: {tarefaDescricao}</small>}</div>
        <button type="button" className="pj-link" onClick={onFechar}>Fechar</button>
      </div>
      <div className="pj-cadastro-compacto__campos">
        <label>Descrição<input name="descricao" required minLength={3} placeholder={marcoId ? "Ex.: reunir documentos" : "Ex.: publicar edital"} /></label>
        <label>Responsável
          <select name="responsavelUserId" required defaultValue="">
            <option value="" disabled>Selecione uma pessoa</option>
            {pessoas.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.name}{pessoa.secretaria ? ` · ${pessoa.secretaria.sigla || pessoa.secretaria.nome}` : ""}</option>)}
          </select>
        </label>
        <label>Prazo<input name="prazo" type="date" required /></label>
      </div>
      {!pessoas.length && <p className="dashboard-muted">Cadastre um usuário responsável na equipe para atribuir esta entrega.</p>}
      {erro && <p role="alert" className="cadastro-arvore__erro">{erro}</p>}
      <Button type="submit" disabled={salvando || !pessoas.length}>{salvando ? "Salvando…" : marcoId ? "Criar subtarefa" : "Criar tarefa"}</Button>
    </form>
  );
}
