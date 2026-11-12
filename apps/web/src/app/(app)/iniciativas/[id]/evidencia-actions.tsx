"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";
import { EvidenciaMedia } from "./evidencia-media";

export type EvidenciaItem = {
  id: string;
  titulo: string;
  descricao?: string | null;
  status: string;
  tipo?: string | null;
  fonte?: string | null;
  marcoId?: string | null;
  urlOuArquivo?: string | null;
  mimeType?: string | null;
  arquivoNome?: string | null;
  autorNome?: string | null;
  createdAt?: string;
  marco?: { id: string; codigo?: string | null; descricao: string } | null;
  validacoes?: Array<{
    id: string;
    status: string;
    parecer?: string | null;
    createdAt: string;
    validador?: { name: string } | null;
  }>;
};

export const EVIDENCIA_STATUS: Record<string, { label: string; cor: string; icone: string }> = {
  DECLARADA: { label: "Aguardando validação", cor: "#eac78c", icone: "⏳" },
  A_VERIFICAR: { label: "Aguardando validação", cor: "#eac78c", icone: "⏳" },
  VERIFICADA: { label: "Aprovada", cor: "#b4e4a0", icone: "✓" },
  REJEITADA: { label: "Devolvida para ajuste", cor: "#ff5982", icone: "↺" },
};
export const EVIDENCIA_TIPO: Record<string, { label: string; icone: string }> = {
  FOTO: { label: "Foto", icone: "📷" },
  VIDEO: { label: "Vídeo", icone: "🎥" },
  DOCUMENTO: { label: "Documento", icone: "📄" },
  LINK: { label: "Link", icone: "🔗" },
};

export function EvidenciaCard({
  evidencia,
  token,
  canValidate,
  metas,
}: {
  evidencia: EvidenciaItem;
  token: string;
  canValidate: boolean;
  metas: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"VERIFICADA" | "REJEITADA">("VERIFICADA");
  const [parecer, setParecer] = useState("");
  const [concluirMarco, setConcluirMarco] = useState(Boolean(evidencia.marcoId));
  const [metaId, setMetaId] = useState(metas[0]?.id || "");
  const [valorTexto, setValorTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasLocalFile =
    Boolean(evidencia.urlOuArquivo) &&
    !String(evidencia.urlOuArquivo).startsWith("http");
  const pending =
    evidencia.status === "A_VERIFICAR" || evidencia.status === "DECLARADA";

  async function onValidate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `${API_URL}/iniciativas/evidencias/${evidencia.id}/validar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            parecer: parecer || undefined,
            concluirMarco:
              status === "VERIFICADA" && evidencia.marcoId
                ? concluirMarco
                : false,
            atualizarIndicador:
              status === "VERIFICADA" && valorTexto.trim() && metaId
                ? { metaExecucaoId: metaId, valorTexto: valorTexto.trim() }
                : undefined,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao validar");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  const st = EVIDENCIA_STATUS[evidencia.status] ?? { label: evidencia.status, cor: "#929bb4", icone: "•" };
  const tp = EVIDENCIA_TIPO[evidencia.tipo || ""] ?? { label: "Arquivo", icone: "📎" };
  const ultima = evidencia.validacoes?.[0];

  return (
    <article className="ev-card" style={{ ["--c" as string]: st.cor }}>
      <div className="ev-card__media">
        {hasLocalFile ? (
          <EvidenciaMedia
            evidenciaId={evidencia.id}
            token={token}
            mimeType={evidencia.mimeType}
            arquivoNome={evidencia.arquivoNome}
            titulo={evidencia.titulo}
          />
        ) : evidencia.urlOuArquivo?.startsWith("http") ? (
          <a href={evidencia.urlOuArquivo} target="_blank" rel="noreferrer" className="ev-card__link">
            🔗 Abrir link externo
          </a>
        ) : (
          <span className="ev-card__semarquivo" aria-hidden="true">{tp.icone}</span>
        )}
        <span className="ev-card__status">
          <span aria-hidden="true">{st.icone}</span> {st.label}
        </span>
      </div>
      <div className="ev-card__corpo">
        <span className="ev-card__tipo">{tp.icone} {tp.label}</span>
        <strong className="ev-card__titulo">{evidencia.titulo}</strong>
        {evidencia.descricao && <p className="ev-card__desc">{evidencia.descricao}</p>}
        {evidencia.marco && (
          <p className="ev-card__tarefa">
            <span>Tarefa</span> {evidencia.marco.codigo ? `${evidencia.marco.codigo} · ` : ""}
            {evidencia.marco.descricao}
          </p>
        )}
        <p className="ev-card__autor">
          {evidencia.autorNome || "Equipe"}
          {evidencia.createdAt ? ` · ${new Date(evidencia.createdAt).toLocaleDateString("pt-BR")}` : ""}
        </p>
        {ultima && (
          <p className="ev-card__parecer">
            <b>{ultima.status === "VERIFICADA" ? "Aprovada" : "Devolvida"} por {ultima.validador?.name || "consultoria"}</b>
            {ultima.parecer ? ` — “${ultima.parecer}”` : ""}
          </p>
        )}
        {evidencia.validacoes && evidencia.validacoes.length > 1 && (
          <details className="ev-card__hist">
            <summary>Histórico ({evidencia.validacoes.length})</summary>
            <ul>
              {evidencia.validacoes.map((v) => (
                <li key={v.id}>
                  {new Date(v.createdAt).toLocaleDateString("pt-BR")} · {v.status === "VERIFICADA" ? "Aprovada" : "Devolvida"} ·{" "}
                  {v.validador?.name || "Validador"}
                  {v.parecer ? ` — ${v.parecer}` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}

      {canValidate && pending && (
        <div style={{ marginTop: 12 }}>
          {!open ? (
            <div className="chip-row">
              <Button
                type="button"
                onClick={() => {
                  setStatus("VERIFICADA");
                  setOpen(true);
                }}
              >
                ✓ Aprovar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStatus("REJEITADA");
                  setOpen(true);
                }}
              >
                ↺ Devolver para ajuste
              </Button>
            </div>
          ) : (
            <form onSubmit={onValidate} className="stack">
              <strong>
                {status === "VERIFICADA" ? "Aprovar evidência" : "Devolver para o secretário ajustar"}
              </strong>
              <div>
                <label>Parecer</label>
                <textarea
                  rows={2}
                  value={parecer}
                  onChange={(e) => setParecer(e.target.value)}
                  placeholder={status === "VERIFICADA" ? "Comentário opcional" : "Explique o que precisa ser corrigido"}
                  required={status === "REJEITADA"}
                />
              </div>
              {status === "VERIFICADA" && evidencia.marcoId && (
                <label className="wizard-check">
                  <input
                    type="checkbox"
                    checked={concluirMarco}
                    onChange={(e) => setConcluirMarco(e.target.checked)}
                  />
                  Concluir tarefa vinculada
                </label>
              )}
              {status === "VERIFICADA" && !!metas.length && (
                <div className="form-grid form-grid--2">
                  <div>
                    <label>Meta / indicador (opcional)</label>
                    <select
                      value={metaId}
                      onChange={(e) => setMetaId(e.target.value)}
                    >
                      {metas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Atualizar indicador</label>
                    <input
                      value={valorTexto}
                      onChange={(e) => setValorTexto(e.target.value)}
                      placeholder="Ex.: 60% da fundação"
                    />
                  </div>
                </div>
              )}
              {error && (
                <p style={{ color: "var(--cip-danger)", margin: 0 }}>{error}</p>
              )}
              <div className="chip-row">
                <Button type="submit" disabled={saving}>
                  {saving ? "Enviando..." : "Confirmar"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
      </div>
    </article>
  );
}
