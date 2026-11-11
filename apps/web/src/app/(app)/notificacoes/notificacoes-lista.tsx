"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card } from "@cip/ui";
import { apiFetch } from "@/lib/api";

type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  texto: string;
  link?: string | null;
  lidaEm?: string | null;
  createdAt: string;
};

const TIPOS: Record<string, { label: string; tone: "info" | "warning" | "success" | "violet" }> = {
  ATRIBUICAO: { label: "Atribuição", tone: "info" },
  VALIDACAO_PENDENTE: { label: "Validar", tone: "warning" },
  VALIDACAO_DECIDIDA: { label: "Decisão", tone: "success" },
  REPROGRAMACAO: { label: "Reprogramação", tone: "violet" },
};

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function NotificacoesLista({ token }: { token: string }) {
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [filtro, setFiltro] = useState<"todas" | "nao-lidas">("nao-lidas");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const r = await apiFetch<{ data: Notificacao[]; naoLidas: number }>("/notificacoes", { token });
      setItens(r.data);
      setNaoLidas(r.naoLidas);
      setErro("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar notificações.");
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    let ativo = true;
    apiFetch<{ data: Notificacao[]; naoLidas: number }>("/notificacoes", { token })
      .then((r) => {
        if (!ativo) return;
        setItens(r.data);
        setNaoLidas(r.naoLidas);
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : "Falha ao carregar notificações.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [token]);

  async function marcar(id: string) {
    await apiFetch(`/notificacoes/${id}/lida`, { token, method: "POST" }).catch(() => null);
    void carregar();
  }

  async function marcarTodas() {
    await apiFetch("/notificacoes/lidas", { token, method: "POST" }).catch(() => null);
    void carregar();
  }

  const visiveis = filtro === "nao-lidas" ? itens.filter((n) => !n.lidaEm) : itens;

  return (
    <Card
      title={naoLidas ? `${naoLidas} não lida${naoLidas === 1 ? "" : "s"}` : "Tudo em dia"}
      subtitle="Abra o item para ir direto à tarefa, meta ou validação."
      action={
        <div className="chip-row">
          <div className="projeto-tabs" role="tablist" aria-label="Filtro">
            {(["nao-lidas", "todas"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filtro === f}
                className={`projeto-tabs__btn${filtro === f ? " projeto-tabs__btn--active" : ""}`}
                onClick={() => setFiltro(f)}
              >
                {f === "todas" ? "Todas" : "Não lidas"}
              </button>
            ))}
          </div>
          {naoLidas > 0 && (
            <Button variant="secondary" onClick={() => void marcarTodas()}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
      }
    >
      {erro && <p role="alert" style={{ color: "var(--cip-danger)" }}>{erro}</p>}
      {carregando ? (
        <p className="dashboard-muted">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p className="dashboard-muted">
          {filtro === "nao-lidas" ? "Nenhuma notificação pendente." : "Você ainda não recebeu notificações."}
        </p>
      ) : (
        <ul className="gp-list">
          {visiveis.map((n) => {
            const tipo = TIPOS[n.tipo] || { label: n.tipo, tone: "info" as const };
            return (
              <li key={n.id} className={`gp-list__item${n.lidaEm ? "" : " is-unread"}`}>
                <div className="gp-list__main">
                  <div className="chip-row">
                    <Badge tone={tipo.tone}>{tipo.label}</Badge>
                    <span className="dashboard-muted">{fmt.format(new Date(n.createdAt))}</span>
                  </div>
                  <strong>{n.titulo}</strong>
                  <p className="dashboard-muted" style={{ margin: 0 }}>{n.texto}</p>
                </div>
                <div className="chip-row">
                  {n.link && (
                    <Link className="cip-btn cip-btn--primary" href={n.link} onClick={() => !n.lidaEm && void marcar(n.id)}>
                      Abrir
                    </Link>
                  )}
                  {!n.lidaEm && (
                    <Button variant="ghost" onClick={() => void marcar(n.id)}>
                      Marcar como lida
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
