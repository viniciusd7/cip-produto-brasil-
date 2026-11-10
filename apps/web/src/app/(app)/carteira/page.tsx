import Link from "next/link";
import { getServerSession } from "next-auth";
import { toneCiclo, tonePrazo } from "@cip/shared";
import { Badge, Button, Card, PageHeader, SourceMeta } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type ListResponse = {
  data: Array<{
    id: string;
    codigo: string;
    nome: string;
    ciclo: string;
    secretariaPrincipal: string;
    classificacaoPrincipal?: string;
    bloqueioLabel?: string | null;
    responsavel?: string | null;
    origem?: string | null;
    atualizadoEm: string;
    fonte?: string | null;
    dataReferencia?: string | null;
    pendencias: number;
    prazoDerivado?: string | null;
  }>;
  meta?: { fonte?: string; dataReferencia?: string };
};

export default async function CarteiraPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ciclo?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.ciclo) qs.set("ciclo", sp.ciclo);

  const payload = await apiFetch<ListResponse>(
    `/iniciativas${qs.toString() ? `?${qs}` : ""}`,
    { token: session?.accessToken },
  );

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Carteira de iniciativas"
        title="Pastas de projetos"
        description="Abra a secretaria, escolha a pasta do projeto e acompanhe metas, tarefas, prazos e conversas."
        actions={
          <Link href="/minha-pasta/novo" className="cip-btn cip-btn--primary">
            Novo projeto
          </Link>
        }
      />

      <SourceMeta
        fonte={payload.meta?.fonte}
        dataReferencia={payload.meta?.dataReferencia}
      />

      <Card>
        <form className="filter-grid">
          <div>
            <label htmlFor="q">Buscar</label>
            <input
              id="q"
              name="q"
              defaultValue={sp.q || ""}
              placeholder="Código, nome ou origem"
            />
          </div>
          <div>
            <label htmlFor="ciclo">Ciclo</label>
            <select id="ciclo" name="ciclo" defaultValue={sp.ciclo || ""}>
              <option value="">Todos</option>
              <option value="EM_PLANEJAMENTO">Em planejamento</option>
              <option value="EM_ACOMPANHAMENTO">Em acompanhamento</option>
              <option value="CONCLUIDA">Concluída</option>
              <option value="SUSPENSA">Suspensa</option>
            </select>
          </div>
          <div style={{ alignSelf: "end" }}>
            <Button type="submit" style={{ width: "100%" }}>
              Filtrar
            </Button>
          </div>
        </form>
      </Card>

      {!payload.data.length && <p>Nenhum projeto encontrado. Crie uma pasta ou ajuste os filtros.</p>}
      {[...new Set(payload.data.map((p) => p.secretariaPrincipal))].map((secretaria) => (
        <details key={secretaria} className="more-block projeto-pasta" open>
          <summary>📁 {secretaria} · {payload.data.filter((p) => p.secretariaPrincipal === secretaria).length} projetos</summary>
          <div className="pastas-grid">
            {payload.data.filter((p) => p.secretariaPrincipal === secretaria).map((p) => (
              <Link key={p.id} href={`/iniciativas/${p.id}?aba=andamento`} className="projeto-folder">
                <span className="projeto-folder__tab">{p.classificacaoPrincipal === "ACAO_DIARIA" ? "Ação diária" : p.classificacaoPrincipal === "PLANO_GOVERNO" ? "Plano de governo" : "Estruturante"}</span>
                <h2>📁 {p.nome}</h2>
                <p>{p.codigo} · {p.responsavel || "Responsável a definir"}</p>
                <div className="chip-row"><Badge tone={toneCiclo(p.ciclo)}>{({ EM_PLANEJAMENTO: "Em planejamento", EM_ACOMPANHAMENTO: "Em acompanhamento", AGUARDANDO_PRE_REQUISITO: "Aguardando providência", CONCLUIDA: "Concluído", SUSPENSA: "Suspenso" } as Record<string, string>)[p.ciclo] || p.ciclo}</Badge><Badge tone={tonePrazo(p.prazoDerivado || "")}>{({ NO_PRAZO: "No prazo", VENCIDO: "Prazo vencido", SEM_PRAZO: "Definir prazo", CONCLUIDO: "Concluído" } as Record<string, string>)[p.prazoDerivado || ""] || "Sem tarefas"}</Badge></div>
                <p>{p.bloqueioLabel || (p.pendencias ? `${p.pendencias} providências pendentes` : "Abrir metas e tarefas →")}</p>
              </Link>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
