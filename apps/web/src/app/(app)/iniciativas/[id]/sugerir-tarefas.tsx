"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { apiFetch } from "@/lib/api";

type Sugestao = {
  id: string;
  proposta: { tipo: string; descricao?: string; nome?: string; diasPrazo?: number } | null;
};

export function SugerirTarefas({ token, metaExecucaoId }: { token: string; metaExecucaoId: string }) {
  const router = useRouter();
  const [itens, setItens] = useState<Sugestao[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function executar(fn: () => Promise<void>) {
    setOcupado(true);
    setErro("");
    try {
      await fn();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Operação não concluída.");
    } finally {
      setOcupado(false);
    }
  }

  const carregar = async () => {
    const r = await apiFetch<{ data: Sugestao[] }>(`/planejamento/sugestoes?entidadeId=${metaExecucaoId}`, { token });
    setItens(r.data.filter((s) => s.proposta?.tipo === "TAREFA"));
  };

  const gerar = () =>
    executar(async () => {
      await apiFetch(`/planejamento/metas-execucao/${metaExecucaoId}/sugestoes`, { token, method: "POST" });
      await carregar();
    });

  const decidir = (id: string, aceitar: boolean) =>
    executar(async () => {
      await apiFetch(`/planejamento/sugestoes/${id}/decidir`, { token, method: "POST", body: JSON.stringify({ aceitar }) });
      setItens((atual) => (atual || []).filter((s) => s.id !== id));
      if (aceitar) router.refresh();
    });

  return (
    <div className="stack" style={{ gap: 8 }}>
      <Button type="button" variant="ghost" disabled={ocupado} onClick={() => void gerar()}>
        {ocupado && !itens ? "Gerando…" : "✨ Sugerir tarefas com IA"}
      </Button>
      {erro && <p role="alert" className="gp-erro">{erro}</p>}
      {itens && (
        <div className="gp-sugestoes">
          <p className="gp-sugestoes__label">Sugestões da IA — revise antes de aceitar</p>
          {!itens.length && <p className="dashboard-muted" style={{ margin: 0 }}>Nenhuma sugestão nova para esta meta.</p>}
          {itens.map((s) => (
            <div key={s.id} className="gp-sugestao">
              <div>
                <strong>{s.proposta?.descricao || s.proposta?.nome}</strong>
                {s.proposta?.diasPrazo ? <span className="dashboard-muted">prazo sugerido: {s.proposta.diasPrazo} dias</span> : null}
              </div>
              <div className="chip-row">
                <Button type="button" disabled={ocupado} onClick={() => void decidir(s.id, true)}>Aceitar</Button>
                <Button type="button" variant="ghost" disabled={ocupado} onClick={() => void decidir(s.id, false)}>Descartar</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
