"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@cip/ui";
import { API_URL } from "@/lib/api";

const CLASSIFICACOES = [
  { codigo: "ESTRUTURANTE", label: "Estruturante" },
  { codigo: "PRIORITARIO", label: "Projeto prioritário" },
  { codigo: "PLANO_GOVERNO", label: "Plano de Governo" },
  { codigo: "ACAO_DIARIA", label: "Ação diária" },
] as const;

const TIPOS_RELACAO = [
  { codigo: "DEPENDENCIA", label: "Dependência" },
  { codigo: "DESDOBRAMENTO", label: "Desdobramento" },
  { codigo: "CONTRIBUICAO", label: "Contribuição" },
  { codigo: "ACOMPANHAMENTO", label: "Acompanhamento" },
] as const;

type RelationRow = {
  id: string;
  tipo: string;
  status: string;
  justificativa: string;
  origem: { id: string; codigo: string; nome: string };
  destino: { id: string; codigo: string; nome: string };
};

type InitiativeOption = { id: string; codigo: string; nome: string };

export function RelacoesIniciativas({
  iniciativaId,
  classificacoesIniciais,
  token,
  canWrite,
}: {
  iniciativaId: string;
  classificacoesIniciais: string[];
  token: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [classificacoes, setClassificacoes] = useState(
    classificacoesIniciais.slice(0, 1),
  );
  const [relacoes, setRelacoes] = useState<RelationRow[]>([]);
  const [iniciativas, setIniciativas] = useState<InitiativeOption[]>([]);
  const [outraId, setOutraId] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS_RELACAO)[number]["codigo"]>("DEPENDENCIA");
  const [direcao, setDirecao] = useState<"ATUAL_ORIGEM" | "OUTRA_ORIGEM">("ATUAL_ORIGEM");
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const [relationsResponse, initiativesResponse] = await Promise.all([
      fetch(`${API_URL}/iniciativas/${iniciativaId}/relacoes`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_URL}/iniciativas`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    const [relationsJson, initiativesJson] = await Promise.all([
      relationsResponse.json(),
      initiativesResponse.json(),
    ]);
    if (!relationsResponse.ok || !initiativesResponse.ok) {
      throw new Error(
        relationsJson?.error?.message ||
          initiativesJson?.error?.message ||
          "Não foi possível carregar as relações",
      );
    }
    return {
      relacoes: relationsJson.data || [],
      iniciativas: (initiativesJson.data || []).filter(
        (item: InitiativeOption) => item.id !== iniciativaId,
      ),
    };
  }, [iniciativaId, token]);

  useEffect(() => {
    let active = true;
    carregar()
      .then(({ relacoes: novasRelacoes, iniciativas: novasIniciativas }) => {
        if (!active) return;
        setRelacoes(novasRelacoes);
        setIniciativas(novasIniciativas);
      })
      .catch((cause) => {
        if (active) setErro(cause instanceof Error ? cause.message : "Erro ao carregar");
      })
      .finally(() => {
        if (active) setCarregando(false);
      });
    return () => {
      active = false;
    };
  }, [carregar]);

  async function salvarClassificacoes() {
    setSalvando(true);
    setErro("");
    try {
      const response = await fetch(
        `${API_URL}/iniciativas/${iniciativaId}/classificacoes`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ classificacoes }),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || "Falha ao salvar");
      router.refresh();
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Erro ao salvar classificações");
    } finally {
      setSalvando(false);
    }
  }

  async function criarRelacao() {
    setSalvando(true);
    setErro("");
    try {
      const response = await fetch(`${API_URL}/iniciativas/${iniciativaId}/relacoes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          outraIniciativaId: outraId,
          tipo,
          direcao,
          justificativa,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || "Falha ao criar relação");
      setOutraId("");
      setJustificativa("");
      const dados = await carregar();
      setRelacoes(dados.relacoes);
      setIniciativas(dados.iniciativas);
      router.refresh();
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Erro ao criar relação");
    } finally {
      setSalvando(false);
    }
  }

  async function atualizarStatus(relacaoId: string, status: "VALIDADO" | "REJEITADO") {
    setSalvando(true);
    setErro("");
    try {
      const response = await fetch(`${API_URL}/iniciativas/relacoes/${relacaoId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || "Falha ao atualizar relação");
      const dados = await carregar();
      setRelacoes(dados.relacoes);
      setIniciativas(dados.iniciativas);
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : "Erro ao atualizar relação");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="stack">
      <Card title="Classificações da iniciativa">
        <div className="stack">
          <p className="dashboard-muted">
            Cada iniciativa pertence a uma única categoria.
          </p>
          <div className="chip-row">
            {CLASSIFICACOES.map((item) => {
              const checked = classificacoes.includes(item.codigo);
              return (
                <label key={item.codigo} className="chip-row">
                  <input
                    type="radio"
                    name="classificacao-iniciativa"
                    checked={checked}
                    disabled={!canWrite || salvando}
                    onChange={() => setClassificacoes([item.codigo])}
                  />
                  {item.label}
                </label>
              );
            })}
          </div>
          {canWrite && (
            <Button
              type="button"
              onClick={salvarClassificacoes}
              disabled={salvando || carregando}
            >
              Salvar classificações
            </Button>
          )}
        </div>
      </Card>

      <Card title="Relações com outras iniciativas">
        <div className="stack">
          <p className="dashboard-muted">
            Relações conectam registros distintos. Dependências permanecem pendentes
            até validação e não alteram a contagem de iniciativas.
          </p>
          {canWrite && (
            <div className="stack">
              <label htmlFor="relacao-outra">Iniciativa relacionada</label>
              <select
                id="relacao-outra"
                value={outraId}
                onChange={(event) => setOutraId(event.target.value)}
                disabled={salvando || carregando}
              >
                <option value="">Selecione</option>
                {iniciativas.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.codigo} · {item.nome}
                  </option>
                ))}
              </select>

              <label htmlFor="relacao-tipo">Tipo</label>
              <select
                id="relacao-tipo"
                value={tipo}
                onChange={(event) =>
                  setTipo(event.target.value as (typeof TIPOS_RELACAO)[number]["codigo"])
                }
                disabled={salvando}
              >
                {TIPOS_RELACAO.map((item) => (
                  <option key={item.codigo} value={item.codigo}>
                    {item.label}
                  </option>
                ))}
              </select>

              <label htmlFor="relacao-direcao">Direção</label>
              <select
                id="relacao-direcao"
                value={direcao}
                onChange={(event) =>
                  setDirecao(event.target.value as "ATUAL_ORIGEM" | "OUTRA_ORIGEM")
                }
                disabled={salvando}
              >
                <option value="ATUAL_ORIGEM">Esta iniciativa → relacionada</option>
                <option value="OUTRA_ORIGEM">Relacionada → esta iniciativa</option>
              </select>

              <label htmlFor="relacao-justificativa">Justificativa</label>
              <textarea
                id="relacao-justificativa"
                minLength={5}
                maxLength={2000}
                value={justificativa}
                onChange={(event) => setJustificativa(event.target.value)}
                disabled={salvando}
              />
              <Button
                type="button"
                onClick={criarRelacao}
                disabled={salvando || carregando || !outraId || justificativa.trim().length < 5}
              >
                Registrar relação
              </Button>
            </div>
          )}

          {carregando ? (
            <p className="dashboard-muted">Carregando relações…</p>
          ) : relacoes.length ? (
            <ul className="pasta-fila">
              {relacoes.map((relacao) => (
                <li key={relacao.id} className="pasta-fila__item">
                  <div className="stack">
                    <strong>
                      {relacao.origem.codigo} · {relacao.origem.nome} →{" "}
                      {relacao.destino.codigo} · {relacao.destino.nome}
                    </strong>
                    <span className="dashboard-muted">
                      {TIPOS_RELACAO.find((item) => item.codigo === relacao.tipo)?.label ||
                        relacao.tipo}
                      {" · "}
                      {relacao.justificativa}
                    </span>
                    <Badge tone={relacao.status === "VALIDADO" ? "success" : "neutral"}>
                      {relacao.status}
                    </Badge>
                  </div>
                  {canWrite && relacao.status === "PENDENTE" && (
                    <div className="chip-row">
                      <Button
                        type="button"
                        disabled={salvando}
                        onClick={() => atualizarStatus(relacao.id, "VALIDADO")}
                      >
                        Validar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={salvando}
                        onClick={() => atualizarStatus(relacao.id, "REJEITADO")}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-muted">Nenhuma relação registrada.</p>
          )}
          {erro && <p style={{ color: "var(--cip-danger)" }}>{erro}</p>}
        </div>
      </Card>
    </div>
  );
}
