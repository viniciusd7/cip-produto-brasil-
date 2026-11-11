"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@cip/ui";
import { API_URL } from "@/lib/api";

type Doc = {
  id: string;
  tipo: string;
  titulo: string;
  vigencia?: string | null;
  statusConferencia: string;
};

type MedicaoFormMeta = { id: string; nome: string };

export function ConhecimentoForm({
  token,
  metas,
}: {
  token: string;
  metas: MedicaoFormMeta[];
}) {
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [alertas, setAlertas] = useState<Array<{ tipo: string; titulo: string }>>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`${API_URL}/conhecimento/documentos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setDocs(json.data || []);
    setAlertas(json.meta?.alertasOrcamento || []);
  }

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitDoc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`${API_URL}/conhecimento/documentos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        tipo: String(form.get("tipo")),
        titulo: String(form.get("titulo")),
        vigencia: String(form.get("vigencia") || "") || undefined,
        versao: String(form.get("versao") || "") || undefined,
        fonte: String(form.get("fonte") || "") || undefined,
        statusConferencia: String(form.get("statusConferencia") || "PENDENTE"),
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json?.error?.message || "Falha ao salvar documento");
      return;
    }
    e.currentTarget.reset();
    await load();
    router.refresh();
  }

  async function submitMedicao(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const dataCorte = String(form.get("dataCorte"));
    const res = await fetch(`${API_URL}/planejamento/medicoes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        metaEstrategicaId: String(form.get("metaEstrategicaId")),
        dataCorte: new Date(dataCorte).toISOString(),
        valorRealizado: String(form.get("valorRealizado")),
        valorEsperado: String(form.get("valorEsperado") || "") || undefined,
        fonte: String(form.get("fonte") || "") || undefined,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json?.error?.message || "Falha ao salvar medição");
      return;
    }
    e.currentTarget.reset();
    router.refresh();
  }

  async function conferir(id: string) {
    await fetch(`${API_URL}/conhecimento/documentos/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ statusConferencia: "CONFERIDO" }),
    });
    await load();
  }

  return (
    <div className="stack">
      {alertas.length > 0 && (
        <Card title="Alerta de orçamento" subtitle="Pendências não bloqueiam o cadastro">
          <ul>
            {alertas.map((a, i) => (
              <li key={`${a.tipo}-${i}`}>
                {a.tipo}: {a.titulo}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Base de conhecimento (PPA / LDO / LOA)" subtitle="Documentos do município com status de conferência">
        <ul className="stack" style={{ gap: 8 }}>
          {docs.map((d) => (
            <li key={d.id} className="chip-row" style={{ justifyContent: "space-between" }}>
              <span>
                {d.tipo} · {d.titulo}
                {d.vigencia ? ` (${d.vigencia})` : ""} · {d.statusConferencia}
              </span>
              {d.statusConferencia !== "CONFERIDO" && (
                <Button type="button" variant="secondary" onClick={() => void conferir(d.id)}>
                  Marcar conferido
                </Button>
              )}
            </li>
          ))}
          {!docs.length && <p className="dashboard-muted">Nenhum documento cadastrado.</p>}
        </ul>
        <form onSubmit={submitDoc} className="stack" style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" name="tipo" required defaultValue="PPA">
                <option value="PPA">PPA</option>
                <option value="LDO">LDO</option>
                <option value="LOA">LOA</option>
                <option value="DIAGNOSTICO">Diagnóstico</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
            <div>
              <label htmlFor="titulo">Título</label>
              <input id="titulo" name="titulo" required minLength={3} />
            </div>
            <div>
              <label htmlFor="vigencia">Vigência</label>
              <input id="vigencia" name="vigencia" placeholder="2026" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="versao">Versão</label>
              <input id="versao" name="versao" />
            </div>
            <div>
              <label htmlFor="fonte">Fonte</label>
              <input id="fonte" name="fonte" />
            </div>
            <div>
              <label htmlFor="statusConferencia">Status</label>
              <select id="statusConferencia" name="statusConferencia" defaultValue="PENDENTE">
                <option value="PENDENTE">Pendente</option>
                <option value="CONFERIDO">Conferido</option>
                <option value="DESATUALIZADO">Desatualizado</option>
              </select>
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Incluir documento"}
          </Button>
        </form>
      </Card>

      <Card title="Medição de Meta Estratégica" subtitle="Registra realizado e esperado na data de corte">
        {!metas.length ? (
          <p className="dashboard-muted">Cadastre uma meta estratégica antes de medir.</p>
        ) : (
          <form onSubmit={submitMedicao} className="stack">
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label htmlFor="metaEstrategicaId">Meta</label>
                <select id="metaEstrategicaId" name="metaEstrategicaId" required>
                  {metas.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="dataCorte">Data de corte</label>
                <input id="dataCorte" name="dataCorte" type="date" required />
              </div>
              <div>
                <label htmlFor="valorRealizado">Realizado</label>
                <input id="valorRealizado" name="valorRealizado" required />
              </div>
              <div>
                <label htmlFor="valorEsperado">Esperado</label>
                <input id="valorEsperado" name="valorEsperado" />
              </div>
            </div>
            <div>
              <label htmlFor="fonteMed">Fonte</label>
              <input id="fonteMed" name="fonte" placeholder="Relatório quinzenal / SEPLAN" />
            </div>
            <Button type="submit" disabled={saving}>
              Registrar medição
            </Button>
          </form>
        )}
      </Card>

      <Card title="Tramitação de validação" subtitle="Solicitação e decisão humanas (RN-V)">
        <TramitacaoMini token={token} metas={metas} />
      </Card>

      {error && <p style={{ color: "var(--cip-danger)" }}>{error}</p>}
    </div>
  );
}

function TramitacaoMini({
  token,
  metas,
}: {
  token: string;
  metas: MedicaoFormMeta[];
}) {
  const [lista, setLista] = useState<
    Array<{
      id: string;
      entidadeTipo: string;
      entidadeId: string;
      status: string;
      justificativa: string;
      decisoes: Array<{ resultado: string; parecer: string }>;
    }>
  >([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await fetch(`${API_URL}/conhecimento/validacoes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    setLista(json.data || []);
  }

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function abrir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`${API_URL}/conhecimento/validacoes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        entidadeTipo: "META_ESTRATEGICA",
        entidadeId: String(form.get("entidadeId")),
        tipo: "REVISAO",
        justificativa: String(form.get("justificativa")),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json?.error?.message || "Falha ao abrir solicitação");
      return;
    }
    e.currentTarget.reset();
    await load();
  }

  async function decidir(id: string, resultado: "APROVADA" | "REJEITADA") {
    await fetch(`${API_URL}/conhecimento/validacoes/${id}/decidir`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        resultado,
        parecer: resultado === "APROVADA" ? "Aprovado na revisão municipal" : "Devolvido para ajuste",
      }),
    });
    await load();
  }

  return (
    <div className="stack">
      <ul className="stack" style={{ gap: 8 }}>
        {lista.slice(0, 8).map((s) => (
          <li key={s.id} className="chip-row" style={{ justifyContent: "space-between" }}>
            <span>
              {s.entidadeTipo} · {s.status} · {s.justificativa.slice(0, 80)}
              {s.decisoes[0] ? ` → ${s.decisoes[0].resultado}` : ""}
            </span>
            {s.status === "ABERTA" && (
              <span className="chip-row">
                <Button type="button" onClick={() => void decidir(s.id, "APROVADA")}>
                  Aprovar
                </Button>
                <Button type="button" variant="secondary" onClick={() => void decidir(s.id, "REJEITADA")}>
                  Rejeitar
                </Button>
              </span>
            )}
          </li>
        ))}
        {!lista.length && <p className="dashboard-muted">Nenhuma tramitação aberta.</p>}
      </ul>
      {metas.length > 0 && (
        <form onSubmit={abrir} className="stack">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div>
              <label htmlFor="entidadeId">Meta para revisão</label>
              <select id="entidadeId" name="entidadeId" required>
                {metas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="justificativa">Justificativa</label>
              <input id="justificativa" name="justificativa" required minLength={5} />
            </div>
          </div>
          <Button type="submit">Abrir solicitação</Button>
        </form>
      )}
      {msg && <p style={{ color: "var(--cip-danger)" }}>{msg}</p>}
    </div>
  );
}
