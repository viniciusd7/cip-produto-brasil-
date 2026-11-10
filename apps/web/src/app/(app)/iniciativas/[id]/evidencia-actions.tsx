"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@cip/ui";
import { toneEvidencia } from "@cip/shared";
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
  marco?: { id: string; codigo?: string | null; descricao: string } | null;
  validacoes?: Array<{
    id: string;
    status: string;
    parecer?: string | null;
    createdAt: string;
    validador?: { name: string } | null;
  }>;
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

  return (
    <article className="evidencia-card">
      <div className="evidencia-card__top">
        <div>
          <strong>{evidencia.titulo}</strong>
          <div className="dashboard-muted" style={{ marginTop: 4 }}>
            {[evidencia.tipo, evidencia.fonte, evidencia.autorNome]
              .filter(Boolean)
              .join(" · ") || "Sem metadados"}
          </div>
        </div>
        <Badge tone={toneEvidencia(evidencia.status)}>{evidencia.status}</Badge>
      </div>

      {evidencia.descricao && (
        <p className="evidencia-card__feito">
          <span className="dashboard-muted">O que foi feito · </span>
          {evidencia.descricao}
        </p>
      )}

      {evidencia.marco && (
        <p className="dashboard-muted" style={{ margin: "8px 0" }}>
          Tarefa:{" "}
          {evidencia.marco.codigo ? `${evidencia.marco.codigo} · ` : ""}
          {evidencia.marco.descricao}
        </p>
      )}

      {hasLocalFile && (
        <div className="evidencia-card__media">
          <EvidenciaMedia
            evidenciaId={evidencia.id}
            token={token}
            mimeType={evidencia.mimeType}
            arquivoNome={evidencia.arquivoNome}
            titulo={evidencia.titulo}
          />
        </div>
      )}

      {!hasLocalFile && evidencia.urlOuArquivo?.startsWith("http") && (
        <a
          href={evidencia.urlOuArquivo}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--cip-blue)", fontWeight: 600 }}
        >
          Abrir link
        </a>
      )}

      {!!evidencia.validacoes?.length && (
        <ul className="evidencia-card__hist">
          {evidencia.validacoes.map((v) => (
            <li key={v.id}>
              <Badge tone={toneEvidencia(v.status)}>{v.status}</Badge>{" "}
              {v.validador?.name || "Validador"} ·{" "}
              {new Date(v.createdAt).toLocaleDateString("pt-BR")}
              {v.parecer ? ` — ${v.parecer}` : ""}
            </li>
          ))}
        </ul>
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
                Validar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStatus("REJEITADA");
                  setOpen(true);
                }}
              >
                Rejeitar
              </Button>
            </div>
          ) : (
            <form onSubmit={onValidate} className="stack">
              <strong>
                {status === "VERIFICADA" ? "Validar evidência" : "Rejeitar evidência"}
              </strong>
              <div>
                <label>Parecer</label>
                <textarea
                  rows={2}
                  value={parecer}
                  onChange={(e) => setParecer(e.target.value)}
                  placeholder="Comentário para a equipe"
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
    </article>
  );
}
