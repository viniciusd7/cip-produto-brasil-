import Link from "next/link";
import { getServerSession } from "next-auth";
import { Badge, Card, PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type DashboardResponse = {
  data: {
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

export default async function PendenciasPage() {
  const session = await getServerSession(authOptions);
  const payload = await apiFetch<DashboardResponse>("/dashboard/resumo", {
    token: session?.accessToken,
  });

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Pendências e decisões"
        title="Quem responde o próximo passo?"
        description="Centraliza impedimentos, verificações e evidências pendentes — com responsável e prazo visíveis."
      />

      <Card title={`${payload.data.pendencias.length} itens`}>
        <table className="table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Iniciativa</th>
              <th>Responsável</th>
              <th>Prazo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payload.data.pendencias.map((p) => (
              <tr key={`${p.tipo}-${p.id}`}>
                <td>
                  <Badge tone={p.tipo === "EVIDENCIA" ? "gold" : "neutral"}>
                    {p.tipo === "EVIDENCIA" ? "Evidência" : p.tipo}
                  </Badge>
                </td>
                <td style={{ fontWeight: 600 }}>
                  <Link
                    href={
                      p.href ||
                      `/iniciativas/${p.iniciativaId}${
                        p.tipo === "EVIDENCIA" ? "?aba=evidencias" : ""
                      }`
                    }
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {p.titulo}
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/iniciativas/${p.iniciativaId}`}
                    style={{ color: "var(--cip-blue)" }}
                  >
                    {p.iniciativaNome}
                  </Link>
                </td>
                <td>{p.responsavel || "—"}</td>
                <td>
                  {p.prazo
                    ? new Date(p.prazo).toLocaleDateString("pt-BR")
                    : "—"}
                </td>
                <td>
                  <Badge tone="warning">{p.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
