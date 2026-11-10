"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";

type MarcoOption = { id: string; label: string };

export function EvidenciaForm({
  token,
  iniciativaId,
  marcos,
}: {
  token: string;
  iniciativaId: string;
  marcos: MarcoOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [fileName, setFileName] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const marcoId = String(fd.get("marcoId") || "");
    if (marcoId) fd.set("marcoId", marcoId);
    else fd.delete("marcoId");

    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      fd.delete("arquivo");
    }

    try {
      const res = await fetch(`${API_URL}/iniciativas/${iniciativaId}/evidencias`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao registrar");
      setMsg(json?.aviso || "Evidência registrada");
      setOpen(false);
      setFileName("");
      form.reset();
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        + Registrar evidência
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="quick-task-form evidencia-form">
      <strong className="quick-task-form__title">Nova evidência</strong>
      <p className="dashboard-muted" style={{ margin: 0 }}>
        Foto ou documento da galeria + o que foi feito. O gestor valida antes de
        contar como entrega.
      </p>
      <div>
        <label>Título</label>
        <input
          name="titulo"
          required
          minLength={3}
          placeholder="Ex.: Foto da obra — fundação concluída"
          autoFocus
        />
      </div>
      <div>
        <label>O que foi feito</label>
        <textarea
          name="descricao"
          rows={3}
          required
          minLength={3}
          placeholder="Descreva o avanço de forma explícita para o gestor validar"
        />
      </div>
      <div className="form-grid form-grid--2">
        <div>
          <label>Tipo</label>
          <select name="tipo" defaultValue="FOTO">
            <option value="FOTO">Foto</option>
            <option value="DOCUMENTO">Documento</option>
            <option value="LINK">Link externo</option>
          </select>
        </div>
        <div>
          <label>Fonte (opcional)</label>
          <input name="fonte" placeholder="Ex.: Campo, SEI, DOM" />
        </div>
      </div>
      <div>
        <label>Foto ou documento (galeria)</label>
        <input
          name="arquivo"
          type="file"
          accept="image/*,.pdf,.doc,.docx,application/pdf"
          onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
        />
        {fileName && (
          <p className="dashboard-muted" style={{ margin: "4px 0 0" }}>
            Selecionado: {fileName}
          </p>
        )}
      </div>
      <div>
        <label>Ou link externo (se não anexar arquivo)</label>
        <input name="urlOuArquivo" placeholder="https://… ou nº do processo" />
      </div>
      {!!marcos.length && (
        <div>
          <label>Vincular a tarefa</label>
          <select name="marcoId" defaultValue="">
            <option value="">Projeto (sem tarefa)</option>
            {marcos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="chip-row">
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Salvar evidência"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
        {msg && <span className="dashboard-muted">{msg}</span>}
      </div>
    </form>
  );
}
