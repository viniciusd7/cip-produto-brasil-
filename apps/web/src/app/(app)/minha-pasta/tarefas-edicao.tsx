"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

export type ResponsavelOpcao = {
  id: string;
  name: string;
  secretaria?: { nome: string; sigla?: string | null } | null;
};

async function enviar(token: string, endpoint: string, method: "PATCH" | "POST", body: Record<string, unknown>) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message || "Não foi possível salvar a alteração.");
}

export function EditarResponsavel({ token, endpoint, atualId, pessoas, rotulo }: {
  token: string;
  endpoint: string;
  atualId?: string | null;
  pessoas: ResponsavelOpcao[];
  rotulo: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const opcoes = [...new Map(pessoas.map((pessoa) => [pessoa.id, pessoa])).values()];

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOcupado(true);
    setErro("");
    try {
      const form = new FormData(event.currentTarget);
      await enviar(token, endpoint, "PATCH", { responsavelUserId: String(form.get("responsavelUserId")) });
      setAberto(false);
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao atribuir responsável.");
    } finally {
      setOcupado(false);
    }
  }

  if (!opcoes.length) return null;
  return (
    <div className="tarefa-edicao">
      {!aberto ? (
        <button type="button" className="linkish" onClick={() => setAberto(true)}>Atribuir responsável</button>
      ) : (
        <form onSubmit={salvar} className="tarefa-edicao__form">
          <label>{rotulo}
            <select name="responsavelUserId" required defaultValue={atualId || ""}>
              <option value="" disabled>Selecione uma pessoa</option>
              {opcoes.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.name}{pessoa.secretaria ? ` · ${pessoa.secretaria.sigla || pessoa.secretaria.nome}` : ""}</option>)}
            </select>
          </label>
          <button type="submit" className="cip-btn cip-btn--secondary" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar responsável"}</button>
          <button type="button" className="linkish" onClick={() => { setAberto(false); setErro(""); }}>Cancelar</button>
          {erro && <p role="alert" className="gp-erro">{erro}</p>}
        </form>
      )}
    </div>
  );
}

export function EditarPrazo({ token, marcoId, prazo }: { token: string; marcoId: string; prazo: string | null }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [minimo] = useState(() => new Date(Date.now() + 86400000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = String(form.get("dataNova") || "");
    const motivo = String(form.get("motivo") || "").trim();
    setOcupado(true);
    setErro("");
    try {
      await enviar(token, `/iniciativas/marcos/${marcoId}/${prazo ? "reprogramar" : "prazo-inicial"}`, "POST", {
        dataNova: `${data}T23:59:59.000-03:00`,
        ...(prazo ? { motivo } : {}),
      });
      setAberto(false);
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao alterar prazo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="tarefa-edicao">
      {!aberto ? (
        <button type="button" className="linkish" onClick={() => setAberto(true)}>{prazo ? "Reprogramar prazo" : "Definir prazo"}</button>
      ) : (
        <form onSubmit={salvar} className="tarefa-edicao__form">
          <label>Nova data de entrega<input type="date" name="dataNova" min={minimo} required /></label>
          {prazo && <label>Motivo da reprogramação<textarea name="motivo" required minLength={5} rows={2} /></label>}
          <button type="submit" className="cip-btn cip-btn--secondary" disabled={ocupado}>{ocupado ? "Salvando…" : prazo ? "Confirmar reprogramação" : "Salvar prazo"}</button>
          <button type="button" className="linkish" onClick={() => { setAberto(false); setErro(""); }}>Cancelar</button>
          {erro && <p role="alert" className="gp-erro">{erro}</p>}
        </form>
      )}
    </div>
  );
}

export function AlternarSubtarefa({ token, id, concluida }: { token: string; id: string; concluida: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function alternar() {
    setOcupado(true);
    setErro("");
    try {
      await enviar(token, `/iniciativas/subtarefas/${id}`, "PATCH", { concluida: !concluida });
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao atualizar a subtarefa.");
    } finally {
      setOcupado(false);
    }
  }

  return <span className="tarefa-subtarefa__controle">
    <button type="button" className="linkish" onClick={alternar} disabled={ocupado} aria-label={concluida ? "Reabrir subtarefa" : "Concluir subtarefa"}>{ocupado ? "…" : concluida ? "✓" : "○"}</button>
    {erro && <small role="alert" className="gp-erro">{erro}</small>}
  </span>;
}
