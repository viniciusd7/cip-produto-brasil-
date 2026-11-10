import { getServerSession } from "next-auth";
import { Badge, Card, PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export default async function AdministracaoPage() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  const role = session?.user?.role;

  const [secretarias, tipos, equipamentos] = await Promise.all([
    apiFetch<{ data: Array<{ id: string; nome: string; sigla?: string | null }> }>(
      "/admin/secretarias",
      { token },
    ),
    apiFetch<{ data: Array<{ codigo: string; nome: string; descricao?: string | null }> }>(
      "/admin/tipos-verificacao",
      { token },
    ),
    apiFetch<{
      data: Array<{
        nome: string;
        tipo?: string | null;
        iniciativas: Array<{ iniciativa: { codigo: string; nome: string } }>;
      }>;
    }>("/admin/equipamentos", { token }),
  ]);

  let usuarios: Array<{
    id: string;
    name: string;
    email: string;
    roles: string[];
    active: boolean;
  }> = [];
  let auditoria: Array<{
    id: string;
    action: string;
    entity: string;
    createdAt: string;
    actor?: { name: string } | null;
  }> = [];

  if (role === "admin") {
    const [u, a] = await Promise.all([
      apiFetch<{
        data: Array<{
          id: string;
          name: string;
          email: string;
          roles: string[];
          active: boolean;
        }>;
      }>("/admin/usuarios", { token }),
      apiFetch<{
        data: Array<{
          id: string;
          action: string;
          entity: string;
          createdAt: string;
          actor?: { name: string } | null;
        }>;
      }>("/admin/auditoria", { token }),
    ]);
    usuarios = u.data;
    auditoria = a.data;
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Administração"
        title="Governança, catálogos e acesso"
        description="Perfis, catálogo de verificações e objetos compartilhados (equipamentos) — sem quebrar histórico."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <Card title="Secretarias">
          <ul>
            {secretarias.data.map((s) => (
              <li key={s.id}>
                <strong>{s.sigla || "—"}</strong> · {s.nome}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Tipos de verificação">
          <ul>
            {tipos.data.map((t) => (
              <li key={t.codigo}>
                <strong>{t.nome}</strong>
                <div style={{ fontSize: 12, color: "var(--cip-muted)" }}>
                  {t.descricao}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Equipamentos públicos (objeto compartilhado)">
          <ul>
            {equipamentos.data.map((e) => (
              <li key={e.nome}>
                <strong>{e.nome}</strong> · {e.tipo || "—"}
                <div style={{ fontSize: 12, color: "var(--cip-muted)" }}>
                  Vinculado a:{" "}
                  {e.iniciativas
                    .map((i) => `${i.iniciativa.codigo}`)
                    .join(", ") || "nenhuma"}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {role === "admin" ? (
        <>
          <Card title="Usuários do município">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Papéis</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td className="chip-row">
                      {u.roles.map((r) => (
                        <Badge key={r} tone="info">
                          {r}
                        </Badge>
                      ))}
                    </td>
                    <td>
                      <Badge tone={u.active ? "success" : "danger"}>
                        {u.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Auditoria recente">
            <table className="table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Ação</th>
                  <th>Entidade</th>
                  <th>Autor</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.slice(0, 20).map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.createdAt).toLocaleString("pt-BR")}</td>
                    <td>{a.action}</td>
                    <td>{a.entity}</td>
                    <td>{a.actor?.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <Card title="Área restrita">
          <p>
            Gestão de usuários e auditoria completa disponível para perfil{" "}
            <strong>admin</strong>.
          </p>
        </Card>
      )}
    </div>
  );
}
