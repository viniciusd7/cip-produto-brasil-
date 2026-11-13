"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card } from "@cip/ui";
import { apiFetch } from "@/lib/api";

type Solicitacao = {
  id: string;
  entidadeTipo: "MARCO" | "SUBTAREFA";
  descricao: string;
  justificativa: string;
  status: "ABERTA" | "DECIDIDA";
  createdAt: string;
  autor?: { name: string } | null;
  iniciativa: { id: string; codigo?: string | null; nome: string; secretariaPrincipal?: { nome: string; sigla?: string | null } | null };
  evidencia?: { id: string; titulo: string; tipo: string; arquivoNome?: string | null; urlOuArquivo?: string | null; status: string } | null;
  decisao?: { resultado: "APROVADA" | "DEVOLVIDA"; parecer?: string | null; validador?: string | null; createdAt: string } | null;
};

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const TIPO_EVIDENCIA: Record<string, string> = { DOCUMENTO: "Documento", FOTO: "Foto", VIDEO: "Vídeo", LINK: "Link" };

export function ValidacoesFila({ token, podeDecidir }: { token: string; podeDecidir: boolean }) {
  const [status, setStatus] = useState<"ABERTA" | "DECIDIDA">("ABERTA");
  const [itens, setItens] = useState<Solicitacao[]>([]);
  const [pareceres, setPareceres] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const r = await apiFetch<{ data: Solicitacao[] }>(`/execucao/solicitacoes?status=${status}`, { token });
      setItens(r.data);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar a fila.");
    } finally {
      setCarregando(false);
    }
  }, [status, token]);

  useEffect(() => {
    let ativo = true;
    apiFetch<{ data: Solicitacao[] }>(`/execucao/solicitacoes?status=${status}`, { token })
      .then((r) => {
        if (!ativo) return;
        setItens(r.data);
        setErro("");
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : "Falha ao carregar a fila.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [status, token]);

  async function decidir(id: string, resultado: "APROVADA" | "DEVOLVIDA") {
    const parecer = (pareceres[id] || "").trim();
    if (parecer.length < 3) {
      setErro("Registre o parecer antes de decidir.");
      return;
    }
    setEnviando(id);
    try {
      await apiFetch(`/execucao/solicitacoes/${id}/decidir`, {
        token,
        method: "POST",
        body: JSON.stringify({ resultado, parecer }),
      });
      setPareceres((p) => ({ ...p, [id]: "" }));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao registrar a decisão.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <Card
      title={status === "ABERTA" ? `${itens.length} aguardando decisão` : "Histórico de decisões"}
      subtitle={podeDecidir ? "Confira a evidência antes de aprovar." : "Acompanhe seus pedidos de conclusão."}
      action={
        <div className="projeto-tabs" role="tablist" aria-label="Situação">
          {(["ABERTA", "DECIDIDA"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={status === s}
              className={`projeto-tabs__btn${status === s ? " projeto-tabs__btn--active" : ""}`}
              onClick={() => {
                setCarregando(true);
                setStatus(s);
              }}
            >
              {s === "ABERTA" ? "Abertas" : "Decididas"}
            </button>
          ))}
        </div>
      }
    >
      {erro && <p role="alert" style={{ color: "var(--cip-danger)" }}>{erro}</p>}
      {carregando ? (
        <p className="dashboard-muted">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="dashboard-muted">
          {status === "ABERTA" ? "Nenhuma conclusão aguardando aprovação." : "Nenhuma decisão registrada ainda."}
        </p>
      ) : (
        <ul className="gp-list">
          {itens.map((s) => (
            <li key={s.id} className="gp-list__item gp-list__item--stack">
              <div className="gp-list__main">
                <div className="chip-row">
                  <Badge tone="info">{s.iniciativa.secretariaPrincipal?.sigla || s.iniciativa.secretariaPrincipal?.nome || "Secretaria"}</Badge>
                  <Badge tone="neutral">{s.entidadeTipo === "MARCO" ? "Tarefa" : "Subtarefa"}</Badge>
                  {s.decisao && (
                    <Badge tone={s.decisao.resultado === "APROVADA" ? "success" : "warning"}>
                      {s.decisao.resultado === "APROVADA" ? "Aprovada" : "Devolvida"}
                    </Badge>
                  )}
                  <span className="dashboard-muted">
                    {s.autor?.name || "Secretário"} · {fmt.format(new Date(s.createdAt))}
                  </span>
                </div>
                <strong>{s.descricao || "Tarefa"}</strong>
                <span className="dashboard-muted">
                  Projeto: <Link href={`/iniciativas/${s.iniciativa.id}`}>{s.iniciativa.codigo ? `${s.iniciativa.codigo} · ` : ""}{s.iniciativa.nome}</Link>
                </span>
                <p style={{ margin: "4px 0 0" }}><span className="dashboard-muted">Justificativa:</span> {s.justificativa}</p>
                <p style={{ margin: 0 }}>
                  <span className="dashboard-muted">Evidência:</span>{" "}
                  {s.evidencia ? (
                    <>
                      {TIPO_EVIDENCIA[s.evidencia.tipo] || s.evidencia.tipo} — {s.evidencia.titulo}{" "}
                      {s.evidencia.urlOuArquivo ? (
                        <a href={s.evidencia.urlOuArquivo} target="_blank" rel="noreferrer">abrir link</a>
                      ) : (
                        <Link href={`/iniciativas/${s.iniciativa.id}?aba=evidencias`}>ver no projeto</Link>
                      )}
                    </>
                  ) : (
                    <Badge tone="warning">Sem evidência anexada</Badge>
                  )}
                </p>
                {s.decisao?.parecer && (
                  <p style={{ margin: 0 }}>
                    <span className="dashboard-muted">Parecer{s.decisao.validador ? ` de ${s.decisao.validador}` : ""}:</span> {s.decisao.parecer}
                  </p>
                )}
              </div>
              {podeDecidir && s.status === "ABERTA" && (
                <div className="gp-decisao">
                  <label htmlFor={`parecer-${s.id}`}>Parecer da consultoria</label>
                  <textarea
                    id={`parecer-${s.id}`}
                    rows={2}
                    value={pareceres[s.id] || ""}
                    onChange={(e) => setPareceres((p) => ({ ...p, [s.id]: e.target.value }))}
                    placeholder="Ex.: evidência confere com a entrega pactuada."
                  />
                  <div className="chip-row">
                    <Button disabled={enviando === s.id} onClick={() => void decidir(s.id, "APROVADA")}>
                      Aprovar e concluir
                    </Button>
                    <Button variant="secondary" disabled={enviando === s.id} onClick={() => void decidir(s.id, "DEVOLVIDA")}>
                      Devolver
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
