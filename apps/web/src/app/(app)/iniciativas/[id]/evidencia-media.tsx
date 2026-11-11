"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export function EvidenciaMedia({
  evidenciaId,
  token,
  mimeType,
  arquivoNome,
  titulo,
}: {
  evidenciaId: string;
  token: string;
  mimeType?: string | null;
  arquivoNome?: string | null;
  titulo: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const isImage = Boolean(mimeType?.startsWith("image/"));
  const isVideo = Boolean(mimeType?.startsWith("video/"));
  const arquivoUrl = `${API_URL}/iniciativas/evidencias/${evidenciaId}/arquivo`;

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(arquivoUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error("fail");
        const blob = await r.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [arquivoUrl, token]);

  if (error) {
    return <p className="dashboard-muted">Arquivo indisponível</p>;
  }
  if (!url) {
    return <p className="dashboard-muted">Carregando mídia…</p>;
  }

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={titulo} className="evidencia-card__thumb" />
    );
  }

  if (isVideo) {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="evidencia-card__video"
        aria-label={titulo}
      />
    );
  }

  return (
    <a
      className="evidencia-card__file"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      {arquivoNome || "Abrir documento"}
    </a>
  );
}
