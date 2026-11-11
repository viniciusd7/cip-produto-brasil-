import Link from "next/link";
import { getServerSession } from "next-auth";
import { PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type DashboardResponse = {
  data: {
    projetos: Array<{
      id: string;
      codigo: string;
      nome: string;
      secretariaPrincipal: { id: string; nome: string };
      tarefas: {
        total: number;
        concluidas: number;
        atrasadas: number;
        pctConclusao: number;
      };
    }>;
    tarefas: Array<{
      id: string;
      codigo: string | null;
      descricao: string;
      status: string;
      responsavel: string | null;
      prazo: string | null;
      meta: string | null;
      subtarefas: { total: number; concluidas: number };
      iniciativaId: string;
      iniciativaNome: string;
      secretaria: string;
    }>;
    pendencias: Array<{
      id: string;
      tipo: string;
      titulo: string;
      status: string;
      responsavel?: string | null;
      prazo?: string | null;
      iniciativaId: string;
      iniciativaNome: string;
      href?: string;
    }>;
  };
};

type Grupo = "atrasado" | "semana" | "proximas" | "semPrazo";

type ItemAgenda = {
  key: string;
  tipo: string;
  acao: string;
  titulo: string;
  detalhe: string | null;
  projeto: string;
  secretaria: string | null;
  responsavel: string | null;
  prazo: Date | null;
  dias: number | null;
  href: string;
};

const DIA_MS = 86_400_000;
const LIMITE_GRUPO = 8;

const GRUPOS: Array<{
  id: Grupo;
  titulo: string;
  dica: string;
  vazio: string;
}> = [
  {
    id: "atrasado",
    titulo: "Atrasado",
    dica: "Resolver primeiro: o prazo já passou.",
    vazio: "Nenhum item atrasado. Ótimo trabalho!",
  },
  {
    id: "semana",
    titulo: "Esta semana",
    dica: "Vence nos próximos 7 dias.",
    vazio: "Nada vence nos próximos 7 dias.",
  },
  {
    id: "proximas",
    titulo: "Mais adiante",
    dica: "Prazo depois desta semana.",
    vazio: "Nenhum item com prazo futuro.",
  },
  {
    id: "semPrazo",
    titulo: "Sem prazo definido",
    dica: "Precisa de data para entrar no acompanhamento.",
    vazio: "Todos os itens têm prazo.",
  },
];

const ACAO_PENDENCIA: Record<string, { tipo: string; acao: string }> = {
  IMPEDIMENTO: { tipo: "Impedimento", acao: "Destravar" },
  DECISAO: { tipo: "Decisão", acao: "Decidir" },
  EVIDENCIA: { tipo: "Evidência", acao: "Analisar evidência" },
  VERIFICACAO: { tipo: "Verificação", acao: "Verificar" },
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function inicioDoDia(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function hoje() {
  return inicioDoDia(new Date());
}

function diasAte(prazo: Date, base: Date) {
  return Math.round((inicioDoDia(prazo).getTime() - base.getTime()) / DIA_MS);
}

function grupoDe(item: ItemAgenda): Grupo {
  if (item.dias === null) return "semPrazo";
  if (item.dias < 0) return "atrasado";
  if (item.dias <= 7) return "semana";
  return "proximas";
}

function prazoTexto(dias: number | null) {
  if (dias === null) return "Sem prazo";
  if (dias < -1) return `Atrasado há ${-dias} dias`;
  if (dias === -1) return "Venceu ontem";
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  return `Vence em ${dias} dias`;
}

function montarAgenda(payload: DashboardResponse["data"], base: Date) {
  const itens: ItemAgenda[] = [];
  for (const t of payload.tarefas) {
    if (t.status === "CONCLUIDO" || t.status === "ENCERRADO_SEM_SOLUCAO") continue;
    const prazo = t.prazo ? new Date(t.prazo) : null;
    itens.push({
      key: `t-${t.id}`,
      tipo: "Tarefa",
      acao: "Executar",
      titulo: `${t.codigo ? `${t.codigo} · ` : ""}${t.descricao}`,
      detalhe: t.subtarefas.total
        ? `${t.subtarefas.concluidas} de ${t.subtarefas.total} subtarefas feitas`
        : t.meta,
      projeto: t.iniciativaNome,
      secretaria: t.secretaria,
      responsavel: t.responsavel,
      prazo,
      dias: prazo ? diasAte(prazo, base) : t.status === "VENCIDO" ? -1 : null,
      href: `/iniciativas/${t.iniciativaId}?aba=andamento`,
    });
  }
  for (const p of payload.pendencias) {
    const meta = ACAO_PENDENCIA[p.tipo] ?? { tipo: p.tipo, acao: "Acompanhar" };
    const prazo = p.prazo ? new Date(p.prazo) : null;
    itens.push({
      key: `${p.tipo}-${p.id}`,
      tipo: meta.tipo,
      acao: meta.acao,
      titulo: p.titulo,
      detalhe: null,
      projeto: p.iniciativaNome,
      secretaria: null,
      responsavel: p.responsavel ?? null,
      prazo,
      dias: prazo ? diasAte(prazo, base) : null,
      href: p.href || `/iniciativas/${p.iniciativaId}`,
    });
  }
  itens.sort((a, b) => {
    if (a.dias === null) return b.dias === null ? 0 : 1;
    if (b.dias === null) return -1;
    return a.dias - b.dias;
  });
  const grupos: Record<Grupo, ItemAgenda[]> = {
    atrasado: [],
    semana: [],
    proximas: [],
    semPrazo: [],
  };
  for (const item of itens) grupos[grupoDe(item)].push(item);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const data = new Date(base.getTime() + i * DIA_MS);
    return {
      data,
      rotulo: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : SEMANA[data.getDay()],
      itens: itens.filter((item) => item.dias === i),
    };
  });

  const concluidas = payload.tarefas.filter((t) => t.status === "CONCLUIDO").length;
  return { grupos, dias, concluidas, total: itens.length };
}

function ItemCard({ item, grupo }: { item: ItemAgenda; grupo: Grupo }) {
  return (
    <li className={`ag-item ag-item--${grupo}`}>
      <div className="ag-item__data" aria-hidden="true">
        {item.prazo ? (
          <>
            <strong>{item.prazo.getDate()}</strong>
            <span>{MESES[item.prazo.getMonth()]}</span>
          </>
        ) : (
          <strong>—</strong>
        )}
      </div>
      <div className="ag-item__corpo">
        <p className="ag-item__tipo">
          <span className="ag-chip">{item.tipo}</span>
          <span className="ag-item__prazo">{prazoTexto(item.dias)}</span>
        </p>
        <h3>
          <Link href={item.href}>{item.titulo}</Link>
        </h3>
        {item.detalhe && <p className="ag-item__detalhe">{item.detalhe}</p>}
        <p className="ag-item__meta">
          <span><b>Projeto</b> {item.projeto}</span>
          {item.secretaria && (
            <span>
              <b>Secretaria</b> {item.secretaria}
            </span>
          )}
          <span>
            <b>Responsável</b> {item.responsavel || "a definir"}
          </span>
        </p>
      </div>
      <Link href={item.href} className="ag-item__acao">
        {item.acao} →
      </Link>
    </li>
  );
}

export default async function PendenciasPage() {
  const session = await getServerSession(authOptions);
  const payload = await apiFetch<DashboardResponse>("/dashboard/agenda", {
    token: session?.accessToken,
  });
  const base = hoje();
  const { grupos, dias, concluidas, total } = montarAgenda(payload.data, base);
  const dataHoje = base.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const projetos = [...payload.data.projetos].sort(
    (a, b) => b.tarefas.atrasadas - a.tarefas.atrasadas,
  );

  return (
    <div className="stack ag">
      <PageHeader
        eyebrow={`Agenda · ${dataHoje}`}
        title="O que precisa ser feito"
        description="Tudo o que está em aberto, em ordem de urgência. Comece pelo vermelho e siga as cores."
      />

      <nav className="ag-resumo" aria-label="Resumo da agenda">
        {GRUPOS.map((g) => (
          <a key={g.id} href={`#${g.id}`} className={`ag-resumo__card ag-resumo__card--${g.id}`}>
            <strong>{grupos[g.id].length}</strong>
            <span>{g.titulo}</span>
            <small>{g.dica}</small>
          </a>
        ))}
        <div className="ag-resumo__card ag-resumo__card--feito">
          <strong>{concluidas}</strong>
          <span>Concluídas</span>
          <small>Tarefas já entregues.</small>
        </div>
      </nav>

      <section className="ag-semana" aria-label="Próximos 7 dias">
        <h2>Próximos 7 dias</h2>
        <ol>
          {dias.map((d) => (
            <li
              key={d.data.toISOString()}
              className={d.itens.length ? "ag-dia ag-dia--ocupado" : "ag-dia"}
            >
              <span className="ag-dia__rotulo">{d.rotulo}</span>
              <span className="ag-dia__numero">
                {d.data.getDate()} {MESES[d.data.getMonth()]}
              </span>
              {d.itens.length ? (
                <>
                  <strong className="ag-dia__total">
                    {d.itens.length} {d.itens.length === 1 ? "entrega" : "entregas"}
                  </strong>
                  <ul>
                    {d.itens.slice(0, 2).map((item) => (
                      <li key={item.key}>
                        <Link href={item.href}>{item.titulo}</Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <span className="ag-dia__livre">Livre</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {total === 0 && (
        <p className="ag-vazio">
          Nenhuma tarefa ou providência em aberto. Quando o consultor cadastrar
          tarefas com prazo, elas aparecem aqui.
        </p>
      )}

      {GRUPOS.map((g) => {
        const itens = grupos[g.id];
        if (!itens.length && g.id !== "atrasado") return null;
        return (
          <section key={g.id} id={g.id} className={`ag-grupo ag-grupo--${g.id}`}>
            <header>
              <h2>
                {g.titulo} <span>{itens.length}</span>
              </h2>
              <p>{g.dica}</p>
            </header>
            {itens.length ? (
              <>
                <ul className="ag-lista">
                  {itens.slice(0, LIMITE_GRUPO).map((item) => (
                    <ItemCard key={item.key} item={item} grupo={g.id} />
                  ))}
                </ul>
                {itens.length > LIMITE_GRUPO && (
                  <details className="ag-mais">
                    <summary>Ver mais {itens.length - LIMITE_GRUPO}</summary>
                    <ul className="ag-lista">
                      {itens.slice(LIMITE_GRUPO).map((item) => (
                        <ItemCard key={item.key} item={item} grupo={g.id} />
                      ))}
                    </ul>
                  </details>
                )}
              </>
            ) : (
              <p className="ag-grupo__vazio">{g.vazio}</p>
            )}
          </section>
        );
      })}

      {projetos.length > 0 && (
        <section className="ag-projetos" aria-label="Andamento por projeto">
          <h2>Andamento por projeto</h2>
          <ul>
            {projetos.map((p) => (
              <li key={p.id}>
                <Link href={`/iniciativas/${p.id}?aba=andamento`}>
                  <span className="ag-projetos__nome">
                    {p.nome}
                    <small>{p.secretariaPrincipal.nome}</small>
                  </span>
                  <span
                    className="ag-projetos__barra"
                    role="progressbar"
                    aria-label={`Conclusão de ${p.nome}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={p.tarefas.pctConclusao}
                  >
                    <span style={{ width: `${p.tarefas.pctConclusao}%` }} />
                  </span>
                  <span className="ag-projetos__pct">{p.tarefas.pctConclusao}%</span>
                  {p.tarefas.atrasadas > 0 ? (
                    <span className="ag-projetos__alerta">
                      {p.tarefas.atrasadas} atrasada{p.tarefas.atrasadas > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="ag-projetos__ok">Em dia</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
