import { getServerSession } from "next-auth";
import { Badge, Card, PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { AtivarModeloButton } from "./ativar-modelo-button";

type Catalogo = {
  data: Array<{
    id: string;
    codigo: string;
    nome: string;
    descricao?: string | null;
    categoria?: string | null;
  }>;
};

type Ativos = {
  data: Array<{ id: string; codigo: string; nome: string }>;
};

export default async function ModelosAdminPage() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken || "";

  let catalogo: Catalogo["data"] = [];
  let ativos: Ativos["data"] = [];
  try {
    const [c, a] = await Promise.all([
      apiFetch<Catalogo>("/modelos-projeto/catalogo", { token }),
      apiFetch<Ativos>("/modelos-projeto", { token }),
    ]);
    catalogo = c.data || [];
    ativos = a.data || [];
  } catch {
    catalogo = [];
  }

  const ativosCodigos = new Set(ativos.map((x) => x.codigo));

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Administração"
        title="Modelos de projeto"
        description="Catálogo CIP pré-setado. Ative na prefeitura para usar no wizard."
      />
      <Card title="Ativos neste município">
        {!ativos.length && <p className="dashboard-muted">Nenhum modelo ativado.</p>}
        <div className="chip-row">
          {ativos.map((m) => (
            <Badge key={m.id} tone="info">
              {m.nome}
            </Badge>
          ))}
        </div>
      </Card>
      <Card title="Catálogo CIP">
        <ul className="pasta-fila">
          {catalogo.map((m) => (
            <li key={m.id} className="pasta-fila__item">
              <div>
                <strong>{m.nome}</strong>
                <p className="dashboard-muted">
                  {m.categoria || "Geral"} · {m.codigo}
                </p>
                <p className="dashboard-muted">{m.descricao}</p>
              </div>
              {ativosCodigos.has(m.codigo) ? (
                <Badge tone="success">Ativo</Badge>
              ) : (
                <AtivarModeloButton token={token} catalogoId={m.id} />
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
