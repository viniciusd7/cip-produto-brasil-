import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Badge, Card, PageHeader } from "@cip/ui";
import { authOptions } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getHomeForRole, getRoleLabel } from "@/lib/roles";
import { UsuarioForm } from "./usuario-form";
import { SecretariaAssignment } from "./secretaria-assignment";

type Usuario = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  active: boolean;
  secretarias: Array<string | null>;
  secretariaId: string | null;
};

/** Equipe da prefeitura: o consultor cadastra prefeito e secretários do ambiente que implanta. */
export default async function EquipePage() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  const role = session?.user?.role;
  if (role !== "analista" && role !== "admin") redirect(getHomeForRole(role));

  const [secretarias, usuarios] = await Promise.all([
    apiFetch<{ data: Array<{ id: string; nome: string; sigla?: string | null }> }>("/admin/secretarias", { token }),
    apiFetch<{ data: Usuario[] }>("/admin/usuarios", { token }),
  ]);

  const contagem = (r: string) => usuarios.data.filter((u) => u.roles.includes(r)).length;
  const semResponsavel = secretarias.data.filter(
    (s) => !usuarios.data.some((u) => u.roles.includes("gestor") && u.secretariaId === s.id),
  );

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Implantação · equipe"
        title={`Equipe de ${session?.user?.municipioNome || "prefeitura"}`}
        description="Cadastre o prefeito e os secretários responsáveis por cada pasta. Cada secretário recebe acesso apenas à sua secretaria."
        actions={<Link href="/implantacao" style={{ color: "var(--cip-blue)", fontWeight: 600 }}>← Implantação</Link>}
      />

      <div className="equipe-kpis">
        <div><strong>{contagem("prefeito")}</strong><span>Prefeito</span></div>
        <div><strong>{contagem("gestor")}</strong><span>Secretários</span></div>
        <div><strong>{secretarias.data.length}</strong><span>Secretarias</span></div>
        <div className={semResponsavel.length ? "is-alerta" : "is-ok"}>
          <strong>{semResponsavel.length}</strong>
          <span>Pastas sem secretário</span>
        </div>
      </div>

      {!!semResponsavel.length && (
        <p className="equipe-aviso">
          Sem secretário com acesso: {semResponsavel.map((s) => s.sigla || s.nome).join(", ")}. Sem responsável, as
          notificações dessas pastas não chegam a ninguém.
        </p>
      )}

      <Card title="Adicionar pessoa" subtitle="O acesso é criado nesta prefeitura com a senha inicial informada.">
        <UsuarioForm token={token || ""} secretarias={secretarias.data} />
      </Card>

      <Card title="Pessoas com acesso">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Secretaria</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.data.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td className="chip-row">
                  {u.roles.map((r) => (
                    <Badge key={r} tone="info">{getRoleLabel(r)}</Badge>
                  ))}
                </td>
                <td>
                  <SecretariaAssignment
                    userId={u.id}
                    initialId={u.secretariaId}
                    isSecretary={u.roles.includes("gestor")}
                    secretarias={secretarias.data}
                    token={token || ""}
                  />
                </td>
                <td>
                  <Badge tone={u.active ? "success" : "danger"}>{u.active ? "Ativo" : "Inativo"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="dashboard-muted">
        Modelos de projeto disponíveis para esta prefeitura: <Link href="/equipe/modelos">gerenciar modelos</Link>.
      </p>
    </div>
  );
}
