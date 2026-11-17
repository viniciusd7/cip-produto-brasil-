import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { prisma } from "@cip/db";
import { permissionsForRole, requireAuth, requirePermission, signAccessToken } from "../middleware/auth";
import { errorHandler } from "../middleware/error";
import { authRouter } from "./auth";
import { dashboardRouter } from "./dashboard";
import { planejamentoRouter } from "./planejamento";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/tenant_tests?connect_timeout=1";
process.env.DIRECT_URL = process.env.DATABASE_URL;

function stub(t: TestContext, target: object, method: string, implementation: (...args: never[]) => unknown) {
  const original = Reflect.get(target, method);
  assert.equal(typeof original, "function", method);
  Reflect.set(target, method, implementation);
  t.after(() => Reflect.set(target, method, original));
}

async function setup(t: TestContext, isPlatformAdmin = false) {
  const memberships = new Map([
    ["a", { roleCode: "analista", secretariaId: null }],
    ["b", { roleCode: "analista", secretariaId: null }],
    ["c", { roleCode: "leitura", secretariaId: null }],
    ["d", { roleCode: "gestor", secretariaId: "d-1" }],
    ["e", { roleCode: "prefeito", secretariaId: null }],
    ["f", { roleCode: "admin", secretariaId: null }],
    ["inativo", { roleCode: "analista", secretariaId: null }],
  ]);
  const scopes: Array<{ model: string; where: Record<string, unknown> }> = [];
  let empty = false;
  const user = { id: "consultor", email: "qa@example.invalid", name: "QA", active: true, isPlatformAdmin };
  stub(t, prisma.user, "findUnique", async () => user);
  stub(t, prisma.user, "findFirst", async () => user);
  stub(t, prisma.municipio, "findFirst", async ({ where }: { where: { id: string; active: boolean } }) => {
    assert.equal(where.active, true);
    return where.id && where.id !== "inativo" ? { id: where.id, nome: `Prefeitura ${where.id}` } : null;
  });
  stub(t, prisma.municipio, "findMany", async ({ where }: { where: Record<string, unknown> }) => {
    assert.deepEqual(where, isPlatformAdmin
      ? { active: true }
      : { active: true, vinculos: { some: { userId: user.id } } });
    return [...memberships].filter(([id]) => id !== "inativo").map(([id, membership]) => ({
      id, nome: `Prefeitura ${id}`, uf: "MG", vinculos: [membership],
    }));
  });
  stub(t, prisma.vinculoUsuarioMunicipio, "findUnique", async ({ where }: {
    where: { userId_municipioId: { userId: string; municipioId: string } };
  }) => {
    assert.equal(where.userId_municipioId.userId, user.id);
    return memberships.get(where.userId_municipioId.municipioId) ?? null;
  });
  for (const [model, target] of [
    ["iniciativa", prisma.iniciativa],
    ["metaEstrategica", prisma.metaEstrategica],
    ["equipamentoPublico", prisma.equipamentoPublico],
  ] as const) {
    stub(t, target, "findMany", async ({ where }: { where: Record<string, unknown> }) => {
      scopes.push({ model, where });
      return [];
    });
  }
  stub(t, prisma.secretaria, "findMany", async ({ where }: {
    where: { municipioId: string; active: boolean; id?: string };
  }) => {
    scopes.push({ model: "secretaria", where });
    return empty ? [] : [1, 2]
      .filter((n) => !where.id || where.id === `${where.municipioId}-${n}`)
      .map((n) => ({ id: `${where.municipioId}-${n}`, nome: `Pasta ${where.municipioId}-${n}` }));
  });
  stub(t, prisma.planoGoverno, "count", async ({ where }: { where: Record<string, unknown> }) => {
    scopes.push({ model: "planoGoverno", where });
    return 0;
  });
  stub(t, prisma.auditLog, "create", async () => ({}));

  const token = signAccessToken({
    ...user, role: isPlatformAdmin ? "admin" : "analista",
    municipioId: isPlatformAdmin ? "" : "a", municipioNome: "Prefeitura a",
    secretariaId: null, permissions: permissionsForRole("analista"),
  });
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/planejamento", planejamentoRouter);
  app.post("/write-probe", requireAuth, requirePermission("iniciativa:write"), (_req, res) => res.sendStatus(204));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
    server.closeIdleConnections();
  }));
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const request = (path: string, accessToken = token, body?: object) => fetch(
    `http://127.0.0.1:${address.port}${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  return { token, request, scopes, memberships, setEmpty: () => { empty = true; } };
}

test("seletor conserva apenas vínculos ativos e seus papéis municipais", async (t) => {
  const { request } = await setup(t);
  const response = await request("/auth/contexts");
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.isPlatformAdmin, false);
  assert.equal(data.activeMunicipioId, "a");
  assert.deepEqual(data.tenants.map((tenant: { id: string; role: string }) => [tenant.id, tenant.role]),
    [["a", "analista"], ["b", "analista"], ["c", "leitura"], ["d", "gestor"], ["e", "prefeito"], ["f", "admin"]]);
});

test("cada prefeitura de consultoria fornece visão geral só do município da sessão", async (t) => {
  const { request, scopes } = await setup(t);
  for (const municipioId of ["b", "a"]) {
    const selected = await request("/auth/select-tenant", undefined, { municipioId });
    assert.equal(selected.status, 200);
    const { data } = await selected.json();
    assert.equal(data.user.role, "analista");
    assert.equal(data.user.municipioId, municipioId);
    const me = await request("/auth/me", data.accessToken);
    const context = (await me.json()).data;
    assert.equal(context.role, "analista");
    assert.equal(context.municipioId, municipioId);
    assert.equal(context.secretariaId, null);
    assert.deepEqual(context.permissions, permissionsForRole("analista"));
    scopes.length = 0;
    const dashboard = await request("/dashboard/resumo?municipioId=sem-vinculo", data.accessToken);
    assert.equal(dashboard.status, 200);
    const overview = (await dashboard.json()).data;
    assert.deepEqual(overview.porSecretaria.map((s: { id: string }) => s.id), [`${municipioId}-1`, `${municipioId}-2`]);
    assert.equal(scopes.length, 5);
    for (const { model, where } of scopes) {
      assert.deepEqual(model === "metaEstrategica" ? where.plano : { municipioId: where.municipioId }, { municipioId }, model);
      if (model === "iniciativa") assert.deepEqual(where.AND, [{}]);
    }
  }
});

test("consultor e prefeito consultam a mesma visão geral no mesmo município", async (t) => {
  const { request, memberships } = await setup(t);
  const consultor = await request("/dashboard/resumo");
  assert.equal(consultor.status, 200);
  const consultorData = (await consultor.json()).data;
  memberships.set("a", { roleCode: "prefeito", secretariaId: null });
  const prefeito = await request("/dashboard/resumo");
  assert.equal(prefeito.status, 200);
  assert.deepEqual((await prefeito.json()).data, consultorData);
});

test("a API da área de implantação foi removida", async (t) => {
  const { request } = await setup(t);
  const response = await request("/planejamento/implantacao");
  assert.equal(response.status, 404);
});

test("perfis municipais abrem cenário vazio e gestor mantém seu escopo", async (t) => {
  const { request, setEmpty } = await setup(t);
  setEmpty();
  for (const municipioId of ["a", "c", "e"]) {
    const selected = await request("/auth/select-tenant", undefined, { municipioId });
    const token = (await selected.json()).data.accessToken;
    const response = await request("/dashboard/resumo", token);
    assert.equal(response.status, 200, municipioId);
    const { data } = await response.json();
    assert.equal(data.governo.totalProjetos, 0);
    assert.deepEqual(data.porSecretaria, []);
  }
  const selected = await request("/auth/select-tenant", undefined, { municipioId: "d" });
  const token = (await selected.json()).data.accessToken;
  const scoped = await request("/dashboard/resumo", token);
  assert.equal(scoped.status, 403);
  assert.equal((await scoped.json()).error.code, "SECRETARIA_REQUIRED");
});

test("administrador abre cenário de prefeitura vazia", async (t) => {
  const { request, setEmpty } = await setup(t, true);
  setEmpty();
  const selected = await request("/auth/select-tenant", undefined, { municipioId: "a" });
  const token = (await selected.json()).data.accessToken;
  const response = await request("/dashboard/resumo", token);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.porSecretaria, []);
});

test("cenário do gestor continua limitado à secretaria do vínculo", async (t) => {
  const { request, scopes } = await setup(t);
  const selected = await request("/auth/select-tenant", undefined, { municipioId: "d" });
  const token = (await selected.json()).data.accessToken;
  const response = await request("/dashboard/resumo", token);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.porSecretaria.map((s: { id: string }) => s.id), ["d-1"]);
  const secretaria = scopes.find((scope) => scope.model === "secretaria");
  assert.deepEqual(secretaria?.where, { municipioId: "d", active: true, id: "d-1" });
  assert.deepEqual(scopes.find((scope) => scope.model === "iniciativa")?.where.AND, [{
    OR: [
      { secretariaPrincipalId: "d-1" },
      { secretarias: { some: { secretariaId: "d-1" } } },
    ],
  }]);
});

test("papel leitura não herda direitos do vínculo analista; outros papéis permanecem locais", async (t) => {
  const { request } = await setup(t);
  for (const [municipioId, role] of [["c", "leitura"], ["d", "gestor"], ["e", "prefeito"], ["f", "leitura"]]) {
    const selected = await request("/auth/select-tenant", undefined, { municipioId });
    assert.equal(selected.status, 200);
    const { data } = await selected.json();
    assert.equal(data.user.role, role);
    const me = await request("/auth/me", data.accessToken);
    const context = (await me.json()).data;
    assert.equal(context.isPlatformAdmin, false);
    assert.equal(context.secretariaId, role === "gestor" ? "d-1" : null);
    assert.ok(!context.permissions.includes("iniciativa:write"));
    assert.ok(!context.permissions.includes("tarefa:validar"));
    assert.equal((await request("/write-probe", data.accessToken, {})).status, 403);
  }
});

test("troca recusa município sem vínculo, inativo ou contexto central para consultor", async (t) => {
  const { request } = await setup(t);
  for (const [municipioId, status, code] of [
    ["sem-vinculo", 403, "TENANT_ACCESS_DENIED"],
    ["inativo", 404, "TENANT_NOT_FOUND"],
    [null, 422, "TENANT_REQUIRED"],
  ]) {
    const response = await request("/auth/select-tenant", undefined, { municipioId });
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.equal(body.data, undefined);
  }
});

test("revogação ou rebaixamento do vínculo vale mesmo com token antigo de consultor", async (t) => {
  const { request, memberships, scopes } = await setup(t);
  memberships.set("a", { roleCode: "leitura", secretariaId: null });
  assert.equal((await request("/write-probe", undefined, {})).status, 403);
  const me = await request("/auth/me");
  assert.equal((await me.json()).data.role, "leitura");
  memberships.delete("a");
  const response = await request("/dashboard/resumo");
  assert.equal(response.status, 401);
  assert.deepEqual(scopes, []);
});

test("admin da plataforma preserva entrada central e seleção de prefeitura sem vínculo", async (t) => {
  const { request } = await setup(t, true);
  const central = await request("/auth/select-tenant", undefined, { municipioId: null });
  assert.equal(central.status, 200);
  assert.equal((await central.json()).data.user.municipioId, "");
  const selected = await request("/auth/select-tenant", undefined, { municipioId: "sem-vinculo" });
  assert.equal(selected.status, 200);
  const { data } = await selected.json();
  assert.equal(data.user.role, "admin");
  assert.equal(data.user.isPlatformAdmin, true);
});
