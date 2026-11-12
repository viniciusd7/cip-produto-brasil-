"use client";

import { DragEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, apiFetch } from "@/lib/api";

export const TIPOS_EVIDENCIA = [
  {
    id: "FOTO",
    icone: "📷",
    label: "Foto",
    dica: "Obra, reunião, entrega, placa…",
    accept: "image/jpeg,image/png,image/webp,image/gif",
  },
  {
    id: "VIDEO",
    icone: "🎥",
    label: "Vídeo",
    dica: "Curto, mostrando o resultado",
    accept: "video/mp4,video/webm,video/quicktime",
  },
  {
    id: "DOCUMENTO",
    icone: "📄",
    label: "Documento",
    dica: "Contrato, ata, ofício, publicação",
    accept: ".pdf,.doc,.docx,application/pdf",
  },
] as const;

export type TipoEvidencia = (typeof TIPOS_EVIDENCIA)[number]["id"];

function tamanho(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Envio guiado de evidência: escolher o tipo, soltar o arquivo, dizer o que foi
 * feito. Com `modo="CONCLUSAO"` o envio também abre o pedido de conclusão da
 * tarefa para a consultoria validar.
 */
export function EvidenciaEnvio({
  token,
  iniciativaId,
  marcoId,
  marcoDescricao,
  marcos,
  modo = "EVIDENCIA",
  tipoInicial,
  onFechar,
}: {
  token: string;
  iniciativaId: string;
  marcoId?: string;
  marcoDescricao?: string;
  /** Quando não vem `marcoId`, o usuário escolhe a tarefa (opcional). */
  marcos?: Array<{ id: string; label: string }>;
  modo?: "EVIDENCIA" | "CONCLUSAO";
  tipoInicial?: TipoEvidencia;
  onFechar?: () => void;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoEvidencia>(tipoInicial ?? "FOTO");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [tarefaId, setTarefaId] = useState(marcoId ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const cfg = TIPOS_EVIDENCIA.find((t) => t.id === tipo)!;
  const conclusao = modo === "CONCLUSAO";

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function escolher(f: File | null | undefined) {
    if (preview) URL.revokeObjectURL(preview);
    setArquivo(f ?? null);
    setPreview(f && (f.type.startsWith("image/") || f.type.startsWith("video/")) ? URL.createObjectURL(f) : null);
    if (f?.type.startsWith("image/")) setTipo("FOTO");
    else if (f?.type.startsWith("video/")) setTipo("VIDEO");
    else if (f) setTipo("DOCUMENTO");
    setErro("");
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setArrastando(false);
    escolher(e.dataTransfer.files?.[0]);
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const descricao = String(form.get("descricao") || "").trim();
    if (!arquivo && !conclusao) {
      setErro("Escolha ou arraste o arquivo da evidência.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      let evidenciaId: string | undefined;
      const alvoId = marcoId ?? tarefaId;
      const alvoNome = marcoDescricao ?? marcos?.find((m) => m.id === alvoId)?.label;
      if (arquivo) {
        const body = new FormData();
        body.set("arquivo", arquivo);
        body.set("tipo", tipo);
        body.set(
          "titulo",
          (String(form.get("titulo") || "").trim() || `${cfg.label} — ${alvoNome || "andamento do projeto"}`).slice(0, 180),
        );
        body.set("descricao", descricao);
        if (alvoId) body.set("marcoId", alvoId);
        const res = await fetch(`${API_URL}/iniciativas/${iniciativaId}/evidencias`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error?.message || "Não foi possível enviar o arquivo.");
        evidenciaId = json.data?.id;
      }
      if (conclusao && alvoId) {
        await apiFetch("/execucao/solicitacoes", {
          token,
          method: "POST",
          body: JSON.stringify({
            entidadeTipo: "MARCO",
            entidadeId: alvoId,
            justificativa: descricao,
            ...(evidenciaId ? { evidenciaId } : {}),
          }),
        });
      }
      setOk(true);
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    return (
      <div className="ev-envio ev-envio--ok" role="status">
        <span className="ev-envio__ok-icone" aria-hidden="true">✓</span>
        <div>
          <strong>{conclusao ? "Conclusão enviada para validação" : "Evidência enviada"}</strong>
          <p>A consultoria foi avisada e vai conferir. Você acompanha o resultado aqui e nas notificações.</p>
        </div>
        <div className="ev-envio__acoes">
          <button
            type="button"
            className="ev-btn ev-btn--ghost"
            onClick={() => {
              escolher(null);
              setOk(false);
            }}
          >
            Enviar outra
          </button>
          {onFechar && (
            <button type="button" className="ev-btn" onClick={onFechar}>
              Fechar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form className="ev-envio" onSubmit={enviar}>
      <ol className="ev-passos" aria-label="Como funciona">
        <li className="is-on"><b>1</b> Escolha o tipo</li>
        <li className={arquivo ? "is-on" : ""}><b>2</b> Anexe o arquivo</li>
        <li><b>3</b> Conte o que foi feito</li>
        <li><b>4</b> A consultoria valida</li>
      </ol>

      <div className="ev-tipos" role="radiogroup" aria-label="Tipo de evidência">
        {TIPOS_EVIDENCIA.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={tipo === t.id}
            className={`ev-tipo${tipo === t.id ? " is-on" : ""}`}
            onClick={() => setTipo(t.id)}
          >
            <span className="ev-tipo__icone" aria-hidden="true">{t.icone}</span>
            <strong>{t.label}</strong>
            <small>{t.dica}</small>
          </button>
        ))}
      </div>

      <label
        className={`ev-drop${arrastando ? " is-drag" : ""}${arquivo ? " has-file" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept={cfg.accept}
          className="ev-drop__input"
          onChange={(e) => escolher(e.target.files?.[0])}
        />
        {arquivo ? (
          <span className="ev-drop__arquivo">
            {preview && arquivo.type.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Pré-visualização" />
            )}
            {preview && arquivo.type.startsWith("video/") && <video src={preview} muted />}
            {!preview && <span className="ev-drop__doc" aria-hidden="true">📄</span>}
            <span>
              <strong>{arquivo.name}</strong>
              <small>{tamanho(arquivo.size)} · clique para trocar</small>
            </span>
          </span>
        ) : (
          <span className="ev-drop__vazio">
            <span aria-hidden="true">{cfg.icone}</span>
            <strong>Arraste a {cfg.label.toLowerCase()} aqui ou clique para escolher</strong>
            <small>Até 25 MB{conclusao ? " · opcional, mas acelera a validação" : ""}</small>
          </span>
        )}
      </label>

      {!marcoId && !!marcos?.length && (
        <div className="ev-campo">
          <label htmlFor={`ev-tarefa-${iniciativaId}`}>A qual tarefa esta evidência se refere?</label>
          <select id={`ev-tarefa-${iniciativaId}`} value={tarefaId} onChange={(e) => setTarefaId(e.target.value)}>
            <option value="">Ao projeto em geral</option>
            {marcos.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      )}
      {marcoDescricao && (
        <p className="ev-alvo">
          <span>Tarefa</span> {marcoDescricao}
        </p>
      )}

      <div className="ev-campo">
        <label htmlFor={`ev-desc-${marcoId ?? iniciativaId}`}>
          {conclusao ? "O que foi entregue?" : "O que esta evidência mostra?"}
        </label>
        <textarea
          id={`ev-desc-${marcoId ?? iniciativaId}`}
          name="descricao"
          rows={2}
          required
          minLength={conclusao ? 5 : 3}
          placeholder={conclusao ? "Ex.: contrato assinado e publicado no Diário Oficial em 12/11" : "Ex.: fundação concluída na quadra 3 — visita de 12/11"}
        />
      </div>
      {!marcoId && (
        <div className="ev-campo">
          <label htmlFor={`ev-tit-${iniciativaId}`}>Título (opcional)</label>
          <input id={`ev-tit-${iniciativaId}`} name="titulo" maxLength={180} placeholder="Gerado automaticamente se ficar em branco" />
        </div>
      )}

      {erro && <p role="alert" className="ev-erro">{erro}</p>}
      <div className="ev-envio__acoes">
        <button type="submit" className="ev-btn" disabled={enviando}>
          {enviando ? "Enviando…" : conclusao ? "Enviar conclusão para validação" : "Enviar evidência"}
        </button>
        {onFechar && (
          <button type="button" className="ev-btn ev-btn--ghost" onClick={onFechar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
