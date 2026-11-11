"use client";

import { useEffect, useState, type ReactNode } from "react";
import { API_URL } from "@/lib/api";

type ItemExterno = {
  id?: string | number | null;
  numero?: string | number | null;
  situacao?: string | null;
  valor?: string | number | null;
  orgao?: string | null;
  objeto?: string | null;
  modalidade?: string | null;
  link?: string | null;
};

type Bloco = {
  fonte: string;
  cnpj?: string;
  total?: number;
  itens: ItemExterno[];
  erro?: string;
};

function formatMoney(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function loadBloco(
  token: string,
  path: string,
): Promise<Bloco> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        fonte: path.includes("pncp") ? "PNCP" : "Transferegov",
        itens: [],
        erro: json?.error?.message || `Falha (${res.status})`,
      };
    }
    return {
      fonte: json.data?.fonte || "—",
      cnpj: json.data?.cnpj,
      total: json.data?.total,
      itens: json.data?.itens || [],
    };
  } catch (e) {
    return {
      fonte: path.includes("pncp") ? "PNCP" : "Transferegov",
      itens: [],
      erro: e instanceof Error ? e.message : "Erro de rede",
    };
  }
}

export function DadosExternos({ token }: { token: string }) {
  const [tg, setTg] = useState<Bloco | null>(null);
  const [pncp, setPncp] = useState<Bloco | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    Promise.all([
      loadBloco(token, "/integracoes/transferegov/propostas"),
      loadBloco(token, "/integracoes/pncp/contratacoes"),
    ]).then(([a, b]) => {
      if (cancelled) return;
      setTg(a);
      setPncp(b);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section className="pasta-section" aria-labelledby="dados-ext-title">
      <div className="pasta-section__head">
        <h2 id="dados-ext-title">Dados externos</h2>
        <p>
          Complemento público (Transferegov e PNCP) pelo CNPJ do município — não
          substitui o cadastro do projeto.
        </p>
      </div>
      {loading ? (
        <p className="dashboard-muted">Consultando portais públicos…</p>
      ) : (
        <div className="dados-ext-grid">
          <BlocoCard
            titulo="Transferências / convênios"
            bloco={tg}
            empty="Nenhuma proposta encontrada para o CNPJ."
            renderItem={(item) => (
              <>
                <strong>{item.numero ?? "—"}</strong>
                <span>{item.situacao || "—"}</span>
                {formatMoney(item.valor) ? <span>{formatMoney(item.valor)}</span> : null}
                {item.orgao ? <span className="dashboard-muted">{item.orgao}</span> : null}
              </>
            )}
          />
          <BlocoCard
            titulo="Contratações recentes (PNCP)"
            bloco={pncp}
            empty="Nenhuma contratação encontrada para o CNPJ neste ano."
            renderItem={(item) => (
              <>
                <strong>{item.numero ?? "—"}</strong>
                <span>{item.objeto || "—"}</span>
                <span>{item.situacao || "—"}</span>
                {formatMoney(item.valor) ? <span>{formatMoney(item.valor)}</span> : null}
              </>
            )}
          />
        </div>
      )}
    </section>
  );
}

function BlocoCard({
  titulo,
  bloco,
  empty,
  renderItem,
}: {
  titulo: string;
  bloco: Bloco | null;
  empty: string;
  renderItem: (item: ItemExterno) => ReactNode;
}) {
  const link = bloco?.itens[0]?.link;
  return (
    <div className="dados-ext-card">
      <div className="dados-ext-card__head">
        <h3>{titulo}</h3>
        {bloco?.cnpj ? (
          <span className="dashboard-muted">CNPJ {bloco.cnpj}</span>
        ) : null}
      </div>
      {bloco?.erro ? (
        <p className="dados-ext-card__erro">{bloco.erro}</p>
      ) : !bloco?.itens.length ? (
        <p className="dashboard-muted">{empty}</p>
      ) : (
        <ul className="dados-ext-list">
          {bloco.itens.slice(0, 8).map((item, i) => (
            <li key={String(item.id ?? item.numero ?? i)}>{renderItem(item)}</li>
          ))}
        </ul>
      )}
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className="text-link">
          Abrir portal ↗
        </a>
      ) : null}
    </div>
  );
}
