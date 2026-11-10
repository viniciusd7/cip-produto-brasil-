"use client";

import { useState } from "react";
import { Badge } from "@cip/ui";

export type FluxoNode = {
  id?: string;
  codigo?: string | null;
  nome: string;
  nivel: "META" | "TAREFA" | "SUBTAREFA" | string;
  indicador?: string | null;
  alvo?: string | null;
  status?: string | null;
  progresso?: number | null;
  /** Quem responde pelo item. Vazio é sinalizado para o gestor. */
  responsavel?: string | null;
  /** Prazo ISO (tarefas). */
  prazo?: string | null;
  origemPerguntaCodigo?: string | null;
  children?: FluxoNode[];
};

function formataPrazo(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function NodeRow({
  node,
  depth,
  editable,
  onChange,
  defaultExpandedDepth = 0,
  showOrigemLabel,
}: {
  node: FluxoNode;
  depth: number;
  editable?: boolean;
  onChange?: (next: FluxoNode) => void;
  defaultExpandedDepth?: number;
  showOrigemLabel?: boolean;
}) {
  const [open, setOpen] = useState(depth < defaultExpandedDepth);
  const kids = node.children || [];
  const hasKids = kids.length > 0;

  return (
    <li className="fluxo-node" style={{ paddingLeft: depth ? 12 : 0 }}>
      <div className="fluxo-node__row">
        {hasKids ? (
          <button
            type="button"
            className="fluxo-node__toggle"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "▼" : "▶"}
          </button>
        ) : (
          <span className="fluxo-node__toggle fluxo-node__toggle--leaf" />
        )}
        <div className="fluxo-node__body">
          <div className="fluxo-node__title">
            <span
              className={`fluxo-node__nivel fluxo-node__nivel--${String(node.nivel).toLowerCase()}`}
            >
              {node.nivel}
            </span>
            {editable ? (
              <input
                value={node.nome}
                onChange={(e) => onChange?.({ ...node, nome: e.target.value })}
              />
            ) : (
              <strong>{node.nome}</strong>
            )}
            {node.status && (
              <Badge
                tone={
                  node.status === "CONCLUIDO" || node.status === "VERIFICADA"
                    ? "success"
                    : node.status === "VENCIDO" || node.status === "REJEITADA"
                      ? "danger"
                      : node.status === "SEM_PRAZO" || node.status === "A_VERIFICAR"
                        ? "warning"
                        : "info"
                }
              >
                {node.status}
              </Badge>
            )}
            {typeof node.progresso === "number" && (
              <Badge tone="info">{node.progresso}%</Badge>
            )}
            {node.responsavel ? (
              <Badge tone="neutral">Resp.: {node.responsavel}</Badge>
            ) : (
              <Badge tone="warning">Sem responsável</Badge>
            )}
            {node.prazo && <Badge tone="gold">Prazo {formataPrazo(node.prazo)}</Badge>}
          </div>
          {(node.indicador || node.alvo) && (
            <p className="dashboard-muted">
              {node.indicador || "Indicador"} · alvo {node.alvo || "—"}
            </p>
          )}
          {showOrigemLabel && node.origemPerguntaCodigo && (
            <span className="fluxo-origem">
              Condicionante: {node.origemPerguntaCodigo}
            </span>
          )}
        </div>
      </div>
      {open && hasKids && (
        <ul className="fluxo-node__children">
          {kids.map((c, i) => (
            <NodeRow
              key={c.id || c.codigo || `${node.codigo}-${i}`}
              node={c}
              depth={depth + 1}
              editable={editable}
              defaultExpandedDepth={defaultExpandedDepth}
              showOrigemLabel={showOrigemLabel}
              onChange={(next) => {
                if (!onChange) return;
                const children = [...kids];
                children[i] = next;
                onChange({ ...node, children });
              }}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FluxoArvore({
  nodes,
  editable,
  onChange,
  defaultExpandedDepth = 1,
  showOrigemLabel = true,
}: {
  nodes: FluxoNode[];
  editable?: boolean;
  onChange?: (nodes: FluxoNode[]) => void;
  defaultExpandedDepth?: number;
  showOrigemLabel?: boolean;
}) {
  if (!nodes.length) {
    return <p className="dashboard-muted">Nenhuma meta ou tarefa ainda.</p>;
  }

  return (
    <ul className="fluxo-arvore">
      {nodes.map((n, i) => (
        <NodeRow
          key={n.id || n.codigo || i}
          node={n}
          depth={0}
          editable={editable}
          defaultExpandedDepth={defaultExpandedDepth}
          showOrigemLabel={showOrigemLabel}
          onChange={(next) => {
            if (!onChange) return;
            const copy = [...nodes];
            copy[i] = next;
            onChange(copy);
          }}
        />
      ))}
    </ul>
  );
}
