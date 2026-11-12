"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type HistoricoItem = {
  id: string;
  tipo: string;
  action: string;
  entity: string;
  autor: string | null;
  createdAt: string;
  detalhe?: unknown;
};

const ENTIDADE: Record<string, string> = {
  Iniciativa: "o projeto",
  MarcoEntrega: "uma tarefa",
  MetaExecucao: "uma meta de execução",
  Subtarefa: "uma subtarefa",
  Evidencia: "uma evidência",
};

const ACAO: Record<string, { icone: string; texto: string }> = {
  CREATE: { icone: "➕", texto: "criou" },
  UPDATE: { icone: "✏️", texto: "atualizou" },
  DELETE: { icone: "🗑️", texto: "removeu" },
  REPROGRAMAR: { icone: "📅", texto: "reprogramou o prazo de" },
  VALIDATE: { icone: "✅", texto: "validou" },
  VALIDAR_CONCLUSAO: { icone: "✅", texto: "aprovou a conclusão de" },
  DEVOLVER_CONCLUSAO: { icone: "↺", texto: "devolveu a conclusão de" },
  CONCLUIR: { icone: "✓", texto: "concluiu" },
  REABRIR: { icone: "↺", texto: "reabriu" },
};

function descreve(h: HistoricoItem) {
  const acao = ACAO[h.action] ?? { icone: "•", texto: h.action.toLowerCase().replace(/_/g, " ") };
  const alvo = ENTIDADE[h.entity] ?? h.entity;
  const detalhe = h.detalhe && typeof h.detalhe === "object" ? (h.detalhe as Record<string, unknown>) : null;
  const nome = detalhe?.marco ?? detalhe?.descricao ?? detalhe?.nome ?? detalhe?.titulo;
  const motivo = h.tipo === "REPROGRAMACAO" && typeof detalhe?.motivo === "string" ? detalhe.motivo : null;
  return {
    icone: acao.icone,
    texto: `${h.autor || "Sistema"} ${acao.texto} ${alvo}`,
    nome: typeof nome === "string" ? nome : null,
    motivo,
  };
}

/** Linha do tempo legível do que aconteceu no projeto. */
export function HistoricoProjeto({ iniciativaId, token }: { iniciativaId: string; token: string }) {
  const [itens, setItens] = useState<HistoricoItem[] | null>(null);
  const [limite, setLimite] = useState(10);

  useEffect(() => {
    let ativo = true;
    fetch(`${API_URL}/iniciativas/${iniciativaId}/historico`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (ativo) setItens(json.data || []);
      })
      .catch(() => {
        if (ativo) setItens([]);
      });
    return () => {
      ativo = false;
    };
  }, [iniciativaId, token]);

  if (!itens) return <p className="dashboard-muted">Carregando histórico…</p>;
  if (!itens.length) return <p className="dashboard-muted">Nenhum evento registrado ainda.</p>;

  return (
    <div>
      <ol className="pj-timeline">
        {itens.slice(0, limite).map((h) => {
          const d = descreve(h);
          return (
            <li key={`${h.tipo}-${h.id}`}>
              <span className="pj-timeline__icone" aria-hidden="true">{d.icone}</span>
              <div>
                <p>
                  {d.texto}
                  {d.nome ? <> · <b>{d.nome}</b></> : null}
                </p>
                {d.motivo && <p className="pj-timeline__motivo">Motivo: {d.motivo}</p>}
                <time dateTime={h.createdAt}>{new Date(h.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
              </div>
            </li>
          );
        })}
      </ol>
      {itens.length > limite && (
        <button type="button" className="pj-link" onClick={() => setLimite((l) => l + 20)}>
          Ver mais eventos
        </button>
      )}
    </div>
  );
}
