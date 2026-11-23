import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "./api";
import { apiFetchForPage } from "./api-page";

test("sessão expirada na página retorna ao login em vez de renderizar erro de servidor", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: { code: "UNAUTHORIZED", message: "Sessão inválida ou expirada" } }, { status: 401 }));
  await assert.rejects(apiFetchForPage("/dashboard/resumo", { token: "token-expirado", returnTo: "/painel?secretariaId=pasta" }), (error: unknown) => {
    assert.ok(error instanceof Error && "digest" in error);
    assert.ok(String(error.digest).includes("/login?callbackUrl=%2Fpainel%3FsecretariaId%3Dpasta"));
    return true;
  });
});

test("403 e falhas operacionais preservam o erro e não são tratadas como expiração", async (t) => {
  for (const status of [403, 500]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({ error: { message: "Falha da API" } }, { status }));
    await assert.rejects(apiFetchForPage("/dashboard/resumo", { token: "token" }), (error: unknown) => error instanceof ApiError && error.status === status);
    t.mock.restoreAll();
  }
});

test("destino do login aceita apenas caminhos da aplicação", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 401 }));
  for (const returnTo of ["https://outro.example", "//outro.example", "/\\outro.example"]) {
    await assert.rejects(apiFetchForPage("/dashboard/resumo", { returnTo }), (error: unknown) => {
      assert.ok(error instanceof Error && "digest" in error);
      assert.ok(String(error.digest).includes("/login?callbackUrl=%2Fpainel;"));
      return true;
    });
  }
});

test("página autenticada conserva a resposta e o bearer token da API", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    assert.equal(new Headers(options.headers).get("Authorization"), "Bearer token");
    return Response.json({ data: { projetos: 2 } });
  });
  assert.deepEqual(await apiFetchForPage("/dashboard/resumo", { token: "token" }), { data: { projetos: 2 } });
});
