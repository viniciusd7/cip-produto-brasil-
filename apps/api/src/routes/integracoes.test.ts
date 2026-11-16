import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { prisma } from "@cip/db";
import { signAccessToken } from "../middleware/auth";
import { errorHandler } from "../middleware/error";
import { integracoesRouter } from "./integracoes";

process.env.DATABASE_URL = "******127.0.0.1:1/integracoes_tests?connect_timeout=1";
process.env.DIRECT_URL = process.env.DATABASE_URL;

function stub(
  t: TestContext,
  target: object,
  method: string,
  implementation: (...args: never[]) => unknown,
) {
  const original = Reflect.get(target, method);
  assert.equal(typeof original, "function", method);
  Reflect.set(target, method, implementation);
  t.after(() => Reflect.set(target, method, original));
}

async function setup(
  t: TestContext,
  upstreamFetch: typeof fetch,
  ano: number,
) {
  stub(t, prisma.user, "findUnique", async () => ({
    active: true,
    isPlatformAdmin: true,
  }));
  stub(t, prisma.municipio, "findFirst", async () => ({
    id: "municipio",
    nome: "Município",
  }));
  stub(t, prisma.municipio, "findUnique", async () => ({
    id: "municipio",
    cnpjOrgao: "12.345.678/0001-90",
  }));
  stub(t, prisma.vinculoUsuarioMunicipio, "findUnique", async () => null);

  const token = signAccessToken({
    id: "usuario",
    email: "qa@example.invalid",
    name: "QA",
    municipioId: "municipio",
    municipioNome: "Município",
    role: "admin",
    isPlatformAdmin: true,
    permissions: [],
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("http://127.0.0.1:")) {
      return originalFetch(input, init);
    }
    return upstreamFetch(input, init);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const app = express();
  app.use("/integracoes", integracoesRouter);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
    server.closeIdleConnections();
  }));
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(
    `http://127.0.0.1:${address.port}/integracoes/pncp/contratacoes?ano=${ano}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return { status: response.status, json: await response.json() };
}

test("PNCP propaga indisponibilidade upstream como erro 502", async (t) => {
  const response = await setup(
    t,
    async () => new Response("indisponível", { status: 503 }),
    2091,
  );

  assert.equal(response.status, 502);
  assert.equal(response.json.error.code, "UPSTREAM_ERROR");
});

test("PNCP converte falha de conexão upstream em erro 502", async (t) => {
  const response = await setup(
    t,
    async () => {
      throw new Error("falha simulada de conexão");
    },
    2092,
  );

  assert.equal(response.status, 502);
  assert.equal(response.json.error.code, "UPSTREAM_ERROR");
});

test("PNCP continua retornando sucesso quando não há contratações", async (t) => {
  const response = await setup(
    t,
    async () => new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    2093,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.json.data.itens, []);
});
