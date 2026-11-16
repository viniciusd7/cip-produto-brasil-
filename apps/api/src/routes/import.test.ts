import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { Prisma, prisma } from "@cip/db";
import { signAccessToken } from "../middleware/auth";
import { errorHandler } from "../middleware/error";
import { importRouter } from "./import";

process.env.DATABASE_URL = "******127.0.0.1:1/import_tests?connect_timeout=1";
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

async function setup(t: TestContext) {
  stub(t, prisma.user, "findUnique", async () => ({
    active: true,
    isPlatformAdmin: true,
  }));
  stub(t, prisma.municipio, "findFirst", async () => ({
    id: "municipio",
    nome: "Município",
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

  const app = express();
  app.use(express.json());
  app.use("/import", importRouter);
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
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function importBatch(body: object) {
    const response = await fetch(`${baseUrl}/import/amostral`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  }

  return { importBatch };
}

const validBatch = {
  nomeArquivo: "amostra.json",
  dataReferencia: "2026-10-06T12:00:00.000Z",
  linhas: [{
    idExterno: "EXT-001",
    secretaria: "Educação",
    projeto: "Projeto de teste",
    tarefa: "Tarefa de teste",
  }],
};

for (const field of ["prazoOriginal", "novoPrazo", "conclusao"] as const) {
  test(`importação rejeita ${field} inválido antes de abrir transação`, async (t) => {
    const ctx = await setup(t);
    let transactionCalls = 0;
    stub(t, prisma, "$transaction", async () => {
      transactionCalls += 1;
      throw new Error("Transação inesperada para payload inválido");
    });

    const response = await ctx.importBatch({
      ...validBatch,
      linhas: [{ ...validBatch.linhas[0], [field]: "data-inválida" }],
    });

    assert.equal(response.status, 400, JSON.stringify(response.json));
    assert.equal(response.json.error.code, "VALIDATION_ERROR");
    assert.equal(transactionCalls, 0);
  });
}

test("importação aborta o lote inteiro quando a criação da tarefa falha", async (t) => {
  const ctx = await setup(t);
  t.mock.method(console, "error", () => {});
  let transactionCalls = 0;
  let inTransaction = false;
  let pendingWrites = 0;
  let committedWrites = 0;
  const recordWrite = () => {
    if (inTransaction) pendingWrites += 1;
    else committedWrites += 1;
  };

  stub(t, prisma.importacaoSnapshot, "create", async () => {
    recordWrite();
    return { id: "snapshot" };
  });
  stub(t, prisma.secretaria, "findFirst", async () => ({ id: "secretaria" }));
  stub(t, prisma.iniciativa, "findUnique", async () => null);
  stub(t, prisma.iniciativa, "create", async () => {
    recordWrite();
    return { id: "iniciativa" };
  });
  stub(t, prisma.marcoEntrega, "create", async () => {
    recordWrite();
    throw new Error("falha simulada ao criar tarefa");
  });
  stub(
    t,
    prisma,
    "$transaction",
    async (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
      transactionCalls += 1;
      inTransaction = true;
      try {
        const result = await operation(prisma);
        committedWrites += pendingWrites;
        return result;
      } finally {
        pendingWrites = 0;
        inTransaction = false;
      }
    },
  );

  const response = await ctx.importBatch(validBatch);

  assert.equal(response.status, 500);
  assert.equal(transactionCalls, 1);
  assert.equal(committedWrites, 0);
});

test("importação concluída mantém snapshot e contagem retornados", async (t) => {
  const ctx = await setup(t);
  stub(t, prisma.importacaoSnapshot, "create", async () => ({ id: "snapshot" }));
  stub(t, prisma.secretaria, "findFirst", async () => ({ id: "secretaria" }));
  stub(t, prisma.iniciativa, "findUnique", async () => null);
  stub(t, prisma.iniciativa, "create", async () => ({ id: "iniciativa" }));
  stub(t, prisma.marcoEntrega, "create", async () => ({ id: "marco" }));
  stub(t, prisma.importacaoSnapshot, "update", async () => ({
    id: "snapshot",
    importadas: 1,
    conflitos: 0,
    resultado: "CONCLUIDO",
  }));
  stub(t, prisma.auditLog, "create", async () => ({}));
  stub(
    t,
    prisma,
    "$transaction",
    async (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      operation(prisma),
  );

  const response = await ctx.importBatch(validBatch);

  assert.equal(response.status, 201, JSON.stringify(response.json));
  assert.equal(response.json.data.importadas, 1);
  assert.equal(response.json.data.resultado, "CONCLUIDO");
});
