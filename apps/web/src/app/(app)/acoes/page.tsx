import { getServerSession } from "next-auth";
import { Badge, Card, PageHeader, SourceMeta } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { AcaoForm } from "./acao-form";

type InitiativesResponse = {
  data: Array<{ id: string; codigo: string; nome: string; secretariaPrincipal: string; prazoDerivado?: string | null }>;
  meta?: { fonte?: string; dataReferencia?: string };
};

export default async function AcoesPage() {
  const session = await getServerSession(authOptions);
  const payload = await apiFetch<InitiativesResponse>("/iniciativas", { token: session?.accessToken });
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Módulo operacional"
        title="Ações diárias que movem os projetos"
        description="Registre uma entrega, uma cobrança ou uma próxima ação vinculada a um projeto. O histórico preserva prazo original, reprogramações e evidências."
      />
      <SourceMeta fonte={payload.meta?.fonte} dataReferencia={payload.meta?.dataReferencia} confiabilidade="Registro operacional" />
      <AcaoForm token={session?.accessToken || ""} iniciativas={payload.data.map((item) => ({ id: item.id, label: `${item.codigo} · ${item.nome}` }))} />
      <Card title="Carteira para atualização" subtitle="Escolha um projeto para abrir a ficha completa e acompanhar seus marcos.">
        <div className="dashboard-grid-3">
          {payload.data.slice(0, 12).map((item) => (
            <a href={`/iniciativas/${item.id}`} key={item.id} style={{ display: "block", border: "1px solid var(--cip-border)", borderRadius: 14, padding: 16, background: "rgba(255,255,255,0.025)" }}>
              <div className="dashboard-muted">{item.secretariaPrincipal}</div>
              <h3 style={{ margin: "8px 0 12px", fontSize: 16 }}>{item.nome}</h3>
              <Badge tone={item.prazoDerivado === "VENCIDO" ? "danger" : item.prazoDerivado === "SEM_PRAZO" ? "warning" : "info"}>{item.prazoDerivado || "SEM STATUS"}</Badge>
            </a>
          ))}
          {!payload.data.length && <p className="dashboard-muted">Cadastre um projeto antes de registrar ações diárias.</p>}
        </div>
      </Card>
    </div>
  );
}
