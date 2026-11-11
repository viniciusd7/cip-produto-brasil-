"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@cip/ui";
import { API_URL } from "@/lib/api";

type Equipamento = { id: string; nome: string; tipo?: string | null };
type VinculoEquip = {
  equipamentoId: string;
  tipoVinculo: string;
  validado: boolean;
  equipamento: Equipamento;
};
type Dependencia = {
  id: string;
  origemTipo: string;
  origemId: string;
  destinoTipo: string;
  destinoId: string;
  tipo: string;
  status: string;
  justificativa: string;
};
type HistoricoItem = {
  id: string;
  tipo: string;
  action: string;
  entity: string;
  autor: string | null;
  createdAt: string;
  detalhe?: unknown;
};
type Sugestao = {
  id: string;
  sugestao: string;
  fonte: string | null;
  confianca: string;
  status: string;
};

export function DossieGovernanca({
  iniciativaId,
  canWrite,
  token,
  equipamentosIniciais,
  marcos,
}: {
  iniciativaId: string;
  canWrite: boolean;
  token: string;
  equipamentosIniciais: VinculoEquip[];
  marcos: Array<{ id: string; descricao: string }>;
}) {
  const router = useRouter();
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [vinculos, setVinculos] = useState(equipamentosIniciais);
  const [deps, setDeps] = useState<Dependencia[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [error, setError] = useState("");
  const [equipamentoId, setEquipamentoId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [justificativa, setJustificativa] = useState("");

  async function load() {
    const [eq, dep, hist, sug] = await Promise.all([
      fetch(`${API_URL}/admin/equipamentos`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_URL}/iniciativas/${iniciativaId}/dependencias`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_URL}/iniciativas/${iniciativaId}/historico`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(`${API_URL}/conhecimento/sugestoes?status=PENDENTE`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ]);
    setEquipamentos(eq.data || []);
    setDeps(dep.data || []);
    setHistorico(hist.data || []);
    setSugestoes(sug.data || []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iniciativaId]);

  async function vincularEquipamento(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`${API_URL}/iniciativas/${iniciativaId}/equipamentos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ equipamentoId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message || "Falha ao vincular equipamento");
      return;
    }
    setVinculos((v) => {
      const next = v.filter((x) => x.equipamentoId !== json.data.equipamentoId);
      return [...next, json.data];
    });
    setEquipamentoId("");
    router.refresh();
  }

  async function removerEquipamento(id: string) {
    await fetch(`${API_URL}/iniciativas/${iniciativaId}/equipamentos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setVinculos((v) => v.filter((x) => x.equipamentoId !== id));
    router.refresh();
  }

  async function criarDependencia(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`${API_URL}/iniciativas/${iniciativaId}/dependencias`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        origemTipo: "INICIATIVA",
        origemId: iniciativaId,
        destinoTipo: destinoId.startsWith("marco:") ? "MARCO" : "INICIATIVA",
        destinoId: destinoId.replace(/^marco:/, ""),
        tipo: "IMPEDITIVA",
        justificativa,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message || "Falha ao criar dependência");
      return;
    }
    setDeps((d) => [json.data, ...d]);
    setJustificativa("");
    setDestinoId("");
  }

  async function validarDep(id: string, status: "VALIDADO" | "REJEITADO") {
    const res = await fetch(`${API_URL}/iniciativas/dependencias/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (res.ok) {
      setDeps((d) => d.map((x) => (x.id === id ? json.data : x)));
    }
  }

  async function gerarSugestao() {
    const res = await fetch(`${API_URL}/conhecimento/sugestoes/gerar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (res.ok) setSugestoes((s) => [json.data, ...s]);
    else setError(json?.error?.message || "Não foi possível gerar sugestão");
  }

  async function decidirSugestao(id: string, status: "ACEITA" | "REJEITADA") {
    const res = await fetch(`${API_URL}/conhecimento/sugestoes/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) setSugestoes((s) => s.filter((x) => x.id !== id));
  }

  return (
    <div className="stack">
      {error && <p style={{ color: "var(--cip-danger)" }}>{error}</p>}

      <Card title="Equipamento público" subtitle="Referência transversal — não integra a árvore operacional">
        <ul className="stack" style={{ gap: 8 }}>
          {vinculos.map((v) => (
            <li key={v.equipamentoId} className="chip-row" style={{ justifyContent: "space-between" }}>
              <span>
                {v.equipamento.nome}
                {v.equipamento.tipo ? ` · ${v.equipamento.tipo}` : ""}
              </span>
              {canWrite && (
                <Button type="button" variant="secondary" onClick={() => void removerEquipamento(v.equipamentoId)}>
                  Remover
                </Button>
              )}
            </li>
          ))}
          {!vinculos.length && <p className="dashboard-muted">Nenhum equipamento vinculado.</p>}
        </ul>
        {canWrite && (
          <form onSubmit={vincularEquipamento} className="chip-row" style={{ marginTop: 12 }}>
            <select value={equipamentoId} onChange={(e) => setEquipamentoId(e.target.value)} required>
              <option value="">Selecionar equipamento</option>
              {equipamentos.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nome}
                </option>
              ))}
            </select>
            <Button type="submit">Vincular</Button>
          </form>
        )}
      </Card>

      <Card title="Dependências tipadas" subtitle="Impeditivas passam por validação; ciclos são bloqueados">
        <ul className="stack" style={{ gap: 8 }}>
          {deps.map((d) => (
            <li key={d.id}>
              <div className="chip-row" style={{ justifyContent: "space-between" }}>
                <span>
                  {d.origemTipo}:{d.origemId.slice(0, 6)} → {d.destinoTipo}:{d.destinoId.slice(0, 6)} · {d.tipo} · {d.status}
                </span>
                {canWrite && d.status === "PENDENTE" && (
                  <span className="chip-row">
                    <Button type="button" onClick={() => void validarDep(d.id, "VALIDADO")}>
                      Validar
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void validarDep(d.id, "REJEITADO")}>
                      Rejeitar
                    </Button>
                  </span>
                )}
              </div>
              <p className="dashboard-muted">{d.justificativa}</p>
            </li>
          ))}
          {!deps.length && <p className="dashboard-muted">Sem dependências cadastradas.</p>}
        </ul>
        {canWrite && (
          <form onSubmit={criarDependencia} className="stack" style={{ marginTop: 12 }}>
            <label>
              Destino
              <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} required>
                <option value="">Selecionar</option>
                {marcos.map((m) => (
                  <option key={m.id} value={`marco:${m.id}`}>
                    Tarefa: {m.descricao.slice(0, 80)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Justificativa
              <input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} required minLength={5} />
            </label>
            <Button type="submit">Registrar dependência</Button>
          </form>
        )}
      </Card>

      <Card title="Histórico do projeto" subtitle="Auditoria e reprogramações">
        <ul className="stack" style={{ gap: 6, maxHeight: 240, overflow: "auto" }}>
          {historico.slice(0, 30).map((h) => (
            <li key={`${h.tipo}-${h.id}`} className="dashboard-muted">
              {new Date(h.createdAt).toLocaleString("pt-BR")} · {h.action} · {h.entity}
              {h.autor ? ` · ${h.autor}` : ""}
            </li>
          ))}
          {!historico.length && <p className="dashboard-muted">Sem eventos registrados ainda.</p>}
        </ul>
      </Card>

      <Card title="Sugestões de IA (revisão humana)" subtitle="Sugestões ficam separadas dos registros validados">
        {canWrite && (
          <Button type="button" variant="secondary" onClick={() => void gerarSugestao()}>
            Gerar sugestão
          </Button>
        )}
        <ul className="stack" style={{ gap: 8, marginTop: 12 }}>
          {sugestoes.map((s) => (
            <li key={s.id}>
              <p style={{ margin: 0 }}>{s.sugestao}</p>
              <p className="dashboard-muted">
                Fonte: {s.fonte || "—"} · confiança {s.confianca}
              </p>
              {canWrite && (
                <span className="chip-row">
                  <Button type="button" onClick={() => void decidirSugestao(s.id, "ACEITA")}>
                    Aceitar
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void decidirSugestao(s.id, "REJEITADA")}>
                    Rejeitar
                  </Button>
                </span>
              )}
            </li>
          ))}
          {!sugestoes.length && <p className="dashboard-muted">Nenhuma sugestão pendente.</p>}
        </ul>
      </Card>
    </div>
  );
}
