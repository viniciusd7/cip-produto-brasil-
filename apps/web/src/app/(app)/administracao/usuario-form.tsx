"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cip/ui";
import { API_URL } from "@/lib/api";

type SecretariaOption = { id: string; nome: string; sigla?: string | null };

export function UsuarioForm({
  token,
  secretarias,
}: {
  token: string;
  secretarias: SecretariaOption[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [roleCode, setRoleCode] = useState("gestor");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const submittedRole = String(form.get("roleCode") || "");
    const secretariaId = String(form.get("secretariaId") || "");
    try {
      const response = await fetch(`${API_URL}/admin/usuarios`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: String(form.get("name") || "").trim(),
          email: String(form.get("email") || "").trim(),
          password: String(form.get("password") || ""),
          roleCode: submittedRole,
          ...(submittedRole === "gestor" ? { secretariaId } : {}),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          result?.error?.message || "Não foi possível cadastrar o usuário.",
        );
      }

      formElement.reset();
      setRoleCode("gestor");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o usuário.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <strong>Cadastrar usuário municipal</strong>
      <div className="form-grid form-grid--2">
        <div>
          <label htmlFor="usuario-nome">Nome</label>
          <input id="usuario-nome" name="name" required minLength={2} />
        </div>
        <div>
          <label htmlFor="usuario-email">E-mail</label>
          <input id="usuario-email" name="email" type="email" required />
        </div>
        <div>
          <label htmlFor="usuario-senha">Senha inicial</label>
          <input
            id="usuario-senha"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="usuario-papel">Papel</label>
          <select
            id="usuario-papel"
            name="roleCode"
            value={roleCode}
            onChange={(event) => setRoleCode(event.target.value)}
          >
            <option value="gestor">Secretário</option>
            <option value="analista">Consultor</option>
            <option value="prefeito">Prefeito</option>
            <option value="leitura">Somente leitura</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        {roleCode === "gestor" && (
          <div>
            <label htmlFor="usuario-secretaria">Secretaria vinculada</label>
            <select
              id="usuario-secretaria"
              name="secretariaId"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Selecione uma secretaria
              </option>
              {secretarias.map((secretaria) => (
                <option key={secretaria.id} value={secretaria.id}>
                  {secretaria.sigla
                    ? `${secretaria.nome} (${secretaria.sigla})`
                    : secretaria.nome}
                </option>
              ))}
            </select>
            {!secretarias.length && (
              <small>Cadastre uma secretaria antes de criar o usuário.</small>
            )}
          </div>
        )}
      </div>
      {error && <p role="alert" style={{ color: "var(--cip-danger)" }}>{error}</p>}
      <div>
        <Button
          type="submit"
          disabled={saving || (roleCode === "gestor" && !secretarias.length)}
        >
          {saving ? "Cadastrando..." : "Cadastrar usuário"}
        </Button>
      </div>
    </form>
  );
}
