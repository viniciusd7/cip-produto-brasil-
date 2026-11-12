"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type TarefaRelatorio = {
  id: string;
  codigo?: string | null;
  descricao: string;
  status: string;
  prazo: string | null;
  prazoOriginal: string | null;
  concluidoEm: string | null;
  entregueNoPrazo: boolean;
  reprogramacoes: number;
  responsavel?: string | null;
  meta?: string | null;
  subtarefas: { total: number; feitas: number };
  evidencias: { total: number; aprovadas: number };
  projetoId: string;
  projetoCodigo: string;
  projetoNome: string;
  secretaria: string;
};

export const SITUACAO: Record<string, { rotulo: string; cor: string }> = {
  VENCIDO: { rotulo: "Atrasada", cor: "var(--pc-rosa)" },
  SEM_PRAZO: { rotulo: "Sem prazo", cor: "var(--pc-ouro)" },
  NO_PRAZO: { rotulo: "No prazo", cor: "var(--pc-azul)" },
  CONCLUIDO: { rotulo: "Concluída", cor: "var(--pc-verde)" },
};

const ORDEM = ["VENCIDO", "SEM_PRAZO", "NO_PRAZO", "CONCLUIDO"];

type Coluna = "status" | "descricao" | "projeto" | "secretaria" | "prazo" | "entrega";

function data(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }) : "—";
}

export function TabelaTarefas({ tarefas }: { tarefas: TarefaRelatorio[] }) {
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<{ col: Coluna; asc: boolean }>({ col: "status", asc: true });
  const [limite, setLimite] = useState(25);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtradas = q
      ? tarefas.filter((t) =>
          [t.descricao, t.projetoNome, t.projetoCodigo, t.secretaria, t.responsavel, t.meta]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : tarefas;
    const valor = (t: TarefaRelatorio): string | number => {
      switch (ordem.col) {
        case "status": return ORDEM.indexOf(t.status);
        case "descricao": return t.descricao.toLowerCase();
        case "projeto": return t.projetoNome.toLowerCase();
        case "secretaria": return t.secretaria.toLowerCase();
        case "prazo": return t.prazo ? new Date(t.prazo).getTime() : Number.MAX_SAFE_INTEGER;
        case "entrega": return t.concluidoEm ? new Date(t.concluidoEm).getTime() : Number.MAX_SAFE_INTEGER;
      }
    };
    return [...filtradas].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      const r = va < vb ? -1 : va > vb ? 1 : 0;
      return ordem.asc ? r : -r;
    });
  }, [tarefas, busca, ordem]);

  function cabecalho(col: Coluna, children: string) {
    const ativo = ordem.col === col;
    return (
      <th key={col} aria-sort={ativo ? (ordem.asc ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => setOrdem({ col, asc: ativo ? !ordem.asc : true })}>
          {children}
          <span aria-hidden="true">{ativo ? (ordem.asc ? "▲" : "▼") : "↕"}</span>
        </button>
      </th>
    );
  }

  if (!tarefas.length) {
    return <p className="pc-vazio">Nenhuma tarefa encontrada com os filtros escolhidos.</p>;
  }

  return (
    <div className="pc-tabela">
      <div className="pc-tabela__barra no-print">
        <input
          type="search"
          placeholder="Buscar tarefa, projeto, responsável…"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setLimite(25);
          }}
          aria-label="Buscar na lista de tarefas"
        />
        <span>{lista.length} de {tarefas.length} tarefas</span>
      </div>
      <div className="pc-tabela__rolagem">
        <table>
          <thead>
            <tr>
              {cabecalho("status", "Situação")}
              {cabecalho("descricao", "Tarefa")}
              {cabecalho("projeto", "Projeto")}
              {cabecalho("secretaria", "Secretaria")}
              {cabecalho("prazo", "Prazo")}
              {cabecalho("entrega", "Entrega")}
              <th>Evidências</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((t, i) => {
              const s = SITUACAO[t.status] ?? { rotulo: t.status, cor: "var(--pc-cinza)" };
              return (
                <tr key={t.id} className={i >= limite ? "pc-so-impressao" : undefined} style={{ ["--c" as string]: s.cor }}>
                  <td><span className="pc-status"><i />{s.rotulo}</span></td>
                  <td>
                    <strong>{t.descricao}</strong>
                    <small>
                      {t.meta ? `Meta: ${t.meta}` : "Sem meta vinculada"}
                      {t.responsavel ? ` · ${t.responsavel}` : ""}
                      {t.subtarefas.total ? ` · ${t.subtarefas.feitas}/${t.subtarefas.total} subtarefas` : ""}
                    </small>
                  </td>
                  <td><Link href={`/iniciativas/${t.projetoId}`}>{t.projetoNome}</Link><small>{t.projetoCodigo}</small></td>
                  <td>{t.secretaria}</td>
                  <td>
                    {data(t.prazo)}
                    {t.reprogramacoes > 0 && (
                      <small title={`Prazo original: ${data(t.prazoOriginal)}`}>
                        reprogramada {t.reprogramacoes}×
                      </small>
                    )}
                  </td>
                  <td>
                    {t.concluidoEm ? (
                      <>
                        {data(t.concluidoEm)}
                        <small className={t.entregueNoPrazo ? "pc-ok" : "pc-alerta"}>
                          {t.entregueNoPrazo ? "no prazo" : "com atraso"}
                        </small>
                      </>
                    ) : "—"}
                  </td>
                  <td>
                    {t.evidencias.total ? (
                      <span className="pc-ev">📎 {t.evidencias.total}<small>{t.evidencias.aprovadas} aprovada{t.evidencias.aprovadas === 1 ? "" : "s"}</small></span>
                    ) : (
                      <span className="pc-ev pc-ev--zero">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lista.length > limite && (
        <button type="button" className="pc-mais no-print" onClick={() => setLimite((l) => l + 50)}>
          Mostrar mais {Math.min(50, lista.length - limite)} tarefas
        </button>
      )}
    </div>
  );
}
