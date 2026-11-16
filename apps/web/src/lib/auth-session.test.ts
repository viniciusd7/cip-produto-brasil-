import assert from "node:assert/strict";
import { test } from "node:test";
import { authOptions } from "./auth";

test("NextAuth usa o contexto verificado pela API, não os papéis enviados pelo cliente", async (t) => {
  const callback = authOptions.callbacks?.jwt;
  assert.ok(callback);
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.ok(url.endsWith("/auth/me"));
    assert.equal(new Headers(options.headers).get("Authorization"), "Bearer tenant-token");
    return Response.json({
      data: {
        id: "consultor", role: "leitura", municipioId: "destino",
        municipioNome: "Prefeitura destino", secretariaId: null, isPlatformAdmin: false,
      },
    });
  });
  const token = await callback({
    token: { sub: "consultor" },
    user: { id: "consultor", role: "analista", municipioId: "origem" },
    account: null,
    trigger: "update",
    session: {
      accessToken: "tenant-token",
      role: "admin", municipioId: "sem-vinculo", isPlatformAdmin: true,
    },
  });
  assert.equal(token.accessToken, "tenant-token");
  assert.equal(token.role, "leitura");
  assert.equal(token.municipioId, "destino");
  assert.equal(token.municipioNome, "Prefeitura destino");
  assert.equal(token.secretariaId, null);
  assert.equal(token.isPlatformAdmin, false);
});

test("NextAuth recusa token de outra conta e falhas ao verificar a nova sessão", async (t) => {
  const callback = authOptions.callbacks?.jwt;
  assert.ok(callback);
  for (const response of [
    Response.json({ data: { id: "outro", role: "analista", municipioId: "destino" } }),
    Response.json({ error: { message: "Vínculo revogado" } }, { status: 401 }),
  ]) {
    t.mock.method(globalThis, "fetch", async () => response);
    await assert.rejects(async () => callback({
      token: { sub: "consultor" },
      user: { id: "consultor" },
      account: null,
      trigger: "update",
      session: { accessToken: "tenant-token" },
    }), /conta autenticada|Vínculo revogado/);
    t.mock.restoreAll();
  }
});
