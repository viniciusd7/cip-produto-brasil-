import Link from "next/link";
import { getServerSession } from "next-auth";
import { toneCiclo, tonePrazo } from "@cip/shared";
import { Badge, Card, EntityCard, PageHeader, SourceMeta, TableScroll } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type ListResponse = {
  data: Array<{
    id: string;
    codigo: string;
    nome: string;
    ciclo: string;
    secretariaPrincipal: string;
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
        title="O que está em curso na gestão?"
        description="Hierarquia preservada: Plano → Secretarias → Meta → Projeto/Iniciativa. Vínculos transversais aparecem na ficha, sem duplicar indicadores."
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
            <button
              type="submit"
              style={{
                background: "var(--cip-navy)",
                color: "#fff",
                border: 0,
                borderRadius: 10,
                padding: "10px 14px",
                fontWeight: 650,
                cursor: "pointer",
                width: "100%",
              }}
            >
              Filtrar
            </button>
          </div>
        </form>
      </Card>

      <div className="mobile-only stack">
        {payload.data.map((item) => (
          <EntityCard
            key={item.id}
            title={item.nome}
            href={`/iniciativas/${item.id}`}
            meta={
              <div className="chip-row">
                <Badge tone={toneCiclo(item.ciclo)}>{item.ciclo}</Badge>
                <Badge tone={tonePrazo(item.prazoDerivado || "")}>
                  {item.prazoDerivado || "—"}
                </Badge>
                <Badge tone={item.pendencias ? "warning" : "success"}>
                  {item.pendencias} pend.
                </Badge>
              </div>
            }
          >
            <div style={{ fontSize: 13, color: "var(--cip-muted)" }}>
              {item.codigo} · {item.secretariaPrincipal}
              <br />
              {item.origem || "—"}
            </div>
          </EntityCard>
        ))}
      </div>

      <Card title={`${payload.data.length} iniciativas`} className="desktop-only">
        <TableScroll>
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Iniciativa</th>
                <th>Secretaria</th>
                <th>Ciclo</th>
                <th>Prazo</th>
                <th>Pendências</th>
              </tr>
            </thead>
            <tbody>
              {payload.data.map((item) => (
                <tr key={item.id}>
                  <td>{item.codigo}</td>
                  <td>
                    <Link
                      href={`/iniciativas/${item.id}`}
                      style={{ color: "var(--cip-blue)", fontWeight: 700 }}
                    >
                      {item.nome}
                    </Link>
                    <div style={{ fontSize: 12, color: "var(--cip-muted)" }}>
                      {item.origem || "—"}
                    </div>
                  </td>
                  <td>{item.secretariaPrincipal}</td>
                  <td>
                    <Badge tone={toneCiclo(item.ciclo)}>{item.ciclo}</Badge>
                  </td>
                  <td>
                    <Badge tone={tonePrazo(item.prazoDerivado || "")}>
                      {item.prazoDerivado || "—"}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={item.pendencias ? "warning" : "success"}>
                      {item.pendencias}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Card>
    </div>
  );
}
