"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

type Opcoes = {
  secretarias: Array<{ id: string; nome: string; sigla?: string | null }>;
  projetos: Array<{ id: string; codigo: string; nome: string; secretariaId: string }>;
  mandato: { inicio: string | null; fim: string | null } | null;
};

const SITUACOES = [
  { valor: "", rotulo: "Todas", cor: "var(--pc-azul)" },
  { valor: "VENCIDO", rotulo: "Atrasadas", cor: "var(--pc-rosa)" },
  { valor: "SEM_PRAZO", rotulo: "Sem prazo", cor: "var(--pc-ouro)" },
  { valor: "NO_PRAZO", rotulo: "No prazo", cor: "var(--pc-azul)" },
  { valor: "CONCLUIDO", rotulo: "Concluídas", cor: "var(--pc-verde)" },
];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presets(mandato: Opcoes["mandato"]) {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  const tri = Math.floor(m / 3) * 3;
  const lista = [
    { id: "tudo", rotulo: "Todo o período", de: "", ate: "" },
    { id: "mes", rotulo: "Este mês", de: iso(new Date(y, m, 1)), ate: iso(new Date(y, m + 1, 0)) },
    { id: "mes-ant", rotulo: "Mês passado", de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m, 0)) },
    { id: "30d", rotulo: "Últimos 30 dias", de: iso(new Date(y, m, hoje.getDate() - 30)), ate: iso(hoje) },
    { id: "tri", rotulo: "Este trimestre", de: iso(new Date(y, tri, 1)), ate: iso(new Date(y, tri + 3, 0)) },
    { id: "ano", rotulo: `Ano ${y}`, de: iso(new Date(y, 0, 1)), ate: iso(new Date(y, 11, 31)) },
  ];
  if (mandato?.inicio && mandato?.fim)
    lista.push({ id: "mandato", rotulo: "Mandato", de: mandato.inicio.slice(0, 10), ate: mandato.fim.slice(0, 10) });
  return lista;
}

export function FiltrosPrestacao({ opcoes }: { opcoes: Opcoes }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendente, startTransition] = useTransition();
  const [lista] = useState(() => presets(opcoes.mandato));

  const de = params.get("de") ?? "";
  const ate = params.get("ate") ?? "";
  const secretariaId = params.get("secretariaId") ?? "";
  const projetoId = params.get("projetoId") ?? "";
  const status = params.get("status") ?? "";

  function aplicar(mudancas: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    startTransition(() => router.replace(`/relatorios${p.size ? `?${p}` : ""}`, { scroll: false }));
  }

  const presetAtivo = lista.find((p) => p.de === de && p.ate === ate)?.id ?? (de || ate ? "custom" : "tudo");
  const projetos = opcoes.projetos.filter((p) => !secretariaId || p.secretariaId === secretariaId);
  const ativos = [de || ate, secretariaId, projetoId, status].filter(Boolean).length;

  return (
    <section className="pc-filtros no-print" aria-label="Filtros do relatório" aria-busy={pendente}>
      <div className="pc-filtros__linha">
        <span className="pc-filtros__rotulo">Período</span>
        <div className="pc-chips" role="group" aria-label="Período rápido">
          {lista.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={presetAtivo === p.id}
              onClick={() => aplicar({ de: p.de, ate: p.ate })}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <div className="pc-datas">
          <label>
            De
            <input type="date" value={de} max={ate || undefined} onChange={(e) => aplicar({ de: e.target.value })} />
          </label>
          <label>
            Até
            <input type="date" value={ate} min={de || undefined} onChange={(e) => aplicar({ ate: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="pc-filtros__linha">
        <label className="pc-campo">
          <span className="pc-filtros__rotulo">Secretaria</span>
          <select
            value={secretariaId}
            onChange={(e) => aplicar({ secretariaId: e.target.value, projetoId: "" })}
          >
            <option value="">Todas as secretarias</option>
            {opcoes.secretarias.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sigla ? `${s.sigla} · ` : ""}{s.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="pc-campo">
          <span className="pc-filtros__rotulo">Projeto</span>
          <select value={projetoId} onChange={(e) => aplicar({ projetoId: e.target.value })}>
            <option value="">Todos os projetos</option>
            {projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} · {p.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="pc-campo">
          <span className="pc-filtros__rotulo">Situação das tarefas</span>
          <div className="pc-chips" role="group" aria-label="Situação">
            {SITUACOES.map((s) => (
              <button
                key={s.valor || "todas"}
                type="button"
                aria-pressed={status === s.valor}
                style={{ ["--c" as string]: s.cor }}
                onClick={() => aplicar({ status: s.valor })}
              >
                <i aria-hidden="true" />
                {s.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pc-filtros__rodape">
        <span>
          {pendente
            ? "Atualizando relatório…"
            : ativos
              ? `${ativos} ${ativos === 1 ? "filtro aplicado" : "filtros aplicados"}`
              : "Mostrando todo o plano de governo"}
        </span>
        {!!ativos && (
          <button type="button" className="pc-limpar" onClick={() => aplicar({ de: "", ate: "", secretariaId: "", projetoId: "", status: "" })}>
            Limpar filtros
          </button>
        )}
      </div>
    </section>
  );
}
