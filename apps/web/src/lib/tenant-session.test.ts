import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "next-auth";
import { changeTenantSession } from "./tenant-session";
import { getHomeForRole, getNavForRole, canWriteRole, canValidateRole } from "./roles";

function session(municipioId: string, role = "analista", accessToken = "old-token"): Session {
  return {
    expires: "2099-01-01",
    accessToken,
    user: { id: "consultor", role, municipioId, municipioNome: municipioId, isPlatformAdmin: false },
  };
}

test("cada vínculo de consultor confirma a sessão antes de abrir o painel", async (t) => {
  for (const municipioId of ["prefeitura-a", "prefeitura-b"]) {
    const calls: string[] = [];
    t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
      calls.push("select");
      assert.ok(url.endsWith("/auth/select-tenant"));
      assert.equal(new Headers(options.headers).get("Authorization"), "Bearer old-token");
      assert.deepEqual(JSON.parse(String(options.body)), { municipioId });
      return Response.json({
        data: { accessToken: "new-token", user: { id: "consultor", municipioId, role: "analista" } },
      });
    });
    const home = await changeTenantSession({
      session: session("anterior"),
      municipioId,
      update: async (data) => {
        calls.push("update");
        assert.deepEqual(data, { accessToken: "new-token" });
        return session(municipioId, "analista", data.accessToken);
      },
    });
    assert.equal(home, "/painel");
    assert.deepEqual(calls, ["select", "update"]);
    t.mock.restoreAll();
  }
});

test("troca para vínculo leitura não herda o papel de consultor", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    data: { accessToken: "read-token", user: { id: "consultor", municipioId: "leitura", role: "leitura" } },
  }));
  const updated = session("leitura", "leitura", "read-token");
  assert.equal(await changeTenantSession({
    session: session("consultoria"),
    municipioId: "leitura",
    update: async () => updated,
  }), "/painel");
  assert.equal(canWriteRole(updated.user.role), false);
  assert.equal(canValidateRole(updated.user.role), false);
  assert.deepEqual(getNavForRole(updated.user.role).map((item) => item.href),
    ["/painel", "/base-conhecimento", "/relatorios"]);
});

test("não atualiza a sessão quando a prefeitura é recusada", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    error: { code: "TENANT_ACCESS_DENIED", message: "Sem vínculo" },
  }, { status: 403 }));
  await assert.rejects(changeTenantSession({
    session: session("origem"),
    municipioId: "sem-vinculo",
    update: async () => assert.fail("Não deve atualizar a sessão"),
  }), /Sem vínculo/);
});

test("não retorna destino se o servidor responder com outra conta ou prefeitura", async (t) => {
  for (const user of [
    { id: "outra-conta", municipioId: "destino", role: "analista" },
    { id: "consultor", municipioId: "outra-prefeitura", role: "analista" },
  ]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({ data: { accessToken: "new", user } }));
    await assert.rejects(changeTenantSession({
      session: session("origem"),
      municipioId: "destino",
      update: async () => assert.fail("Não deve atualizar a sessão"),
    }), /contexto solicitado/);
    t.mock.restoreAll();
  }
});

test("não retorna destino se a sessão atualizada estiver ausente, antiga ou divergente", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    data: { accessToken: "new", user: { id: "consultor", municipioId: "destino", role: "leitura" } },
  }));
  for (const updated of [
    null,
    session("origem"),
    session("destino", "analista", "new"),
    session("destino", "leitura", "old"),
    { ...session("destino", "leitura", "new"), user: { ...session("destino").user, id: "outro" } },
  ]) {
    await assert.rejects(changeTenantSession({
      session: session("origem"),
      municipioId: "destino",
      update: async () => updated,
    }), /confirmar a sessão/);
  }
});

test("propaga falha de atualização e preserva os destinos dos demais papéis", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    data: { accessToken: "new", user: { id: "consultor", municipioId: "destino", role: "analista" } },
  }));
  await assert.rejects(changeTenantSession({
    session: session("origem"),
    municipioId: "destino",
    update: async () => { throw new Error("Falha na sessão"); },
  }), /Falha na sessão/);
  for (const [role, home] of [
    ["admin", "/painel"], ["prefeito", "/painel"], ["gestor", "/minha-pasta"], ["leitura", "/painel"],
  ]) {
    assert.equal(getHomeForRole(role), home);
  }
  assert.ok(!getNavForRole("gestor").some((item) => item.href === "/painel"));
});
