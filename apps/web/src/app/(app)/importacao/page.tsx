import { getServerSession } from "next-auth";
import { Badge, Card, PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { ImportForm } from "./import-form";

type Snapshots = {
  data: Array<{
    id: string;
    nomeArquivo: string;
    dataReferencia: string;
    fonte?: string | null;
    totalLinhas: number;
    importadas: number;
    conflitos: number;
    resultado: string;
    createdAt: string;
    itensConflito: Array<{
      chaveExterna: string;
      campo?: string | null;
      valorAtual?: string | null;
      valorNovo?: string | null;
    }>;
  }>;
};

export default async function ImportacaoPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const canImport = role === "admin";

  let snapshots: Snapshots["data"] = [];
  if (canImport) {
    const res = await apiFetch<Snapshots>("/import/snapshots", {
      token: session?.accessToken,
    });
    snapshots = res.data;
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Importação controlada"
        title="Snapshot com rastreabilidade e conflitos"
        description="Importação amostral (RF-13): preserva origem, data de referência e nunca sobrescreve automaticamente em conflito (AT-09)."
      />

      {canImport ? (
        <>
          <ImportForm token={session?.accessToken || ""} />
          <Card title="Snapshots recentes">
            <table className="table">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Referência</th>
                  <th>Importadas</th>
                  <th>Conflitos</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.nomeArquivo}</strong>
                      <div style={{ fontSize: 12, color: "var(--cip-muted)" }}>
                        {s.fonte}
                      </div>
                    </td>
                    <td>
                      {new Date(s.dataReferencia).toLocaleDateString("pt-BR")}
                    </td>
                    <td>
                      {s.importadas}/{s.totalLinhas}
                    </td>
                    <td>{s.conflitos}</td>
                    <td>
                      <Badge
                        tone={
                          s.conflitos > 0 ? "warning" : "success"
                        }
                      >
                        {s.resultado}
                      </Badge>
                      {s.itensConflito.slice(0, 2).map((c, idx) => (
                        <div
                          key={idx}
                          style={{ fontSize: 12, color: "var(--cip-muted)" }}
                        >
                          {c.chaveExterna}: {c.valorAtual || "—"} →{" "}
                          {c.valorNovo || "—"}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
                {!snapshots.length && (
                  <tr>
                    <td colSpan={5}>Nenhuma importação ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <Card title="Permissão necessária">
          <p>
            A execução de importações exige permissão <strong>import:run</strong>{" "}
            (perfil admin).
          </p>
        </Card>
      )}
    </div>
  );
}
