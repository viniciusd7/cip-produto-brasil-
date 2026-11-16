import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { prisma } from "@cip/db";
import { signAccessToken } from "../middleware/auth";
import { errorHandler } from "../middleware/error";
import { iniciativasRouter } from "./iniciativas";

process.env.DATABASE_URL = "******127.0.0.1:1/security_tests?connect_timeout=1";
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
  options: {
    userId: string;
    responsavelUserId: string;
    isPlatformAdmin?: boolean;
  },
) {
  const atualizacoes: Array<Record<string, unknown>> = [];
  stub(t, prisma.user, "findUnique", async () => ({
    active: true,
    isPlatformAdmin: options.isPlatformAdmin ?? false,
  }));
  stub(t, prisma.municipio, "findFirst", async () => ({
    id: "municipio",
    nome: "Município",
  }));
  stub(t, prisma.vinculoUsuarioMunicipio, "findUnique", async () =>
    options.isPlatformAdmin
      ? null
      : { roleCode: "analista", secretariaId: null },
  );
  stub(t, prisma.marcoEntrega, "findUnique", async () => ({
    id: "marco",
    responsavelUserId: options.responsavelUserId,
    iniciativa: {
      id: "iniciativa",
      codigo: "PROJ-01",
      nome: "Projeto",
      municipioId: "municipio",
    },
  }));
  stub(t, prisma.marcoEntrega, "update", async ({ data }: {
    data: Record<string, unknown>;
  }) => {
    atualizacoes.push(data);
    return { id: "marco", ...data };
  });
  stub(t, prisma.auditLog, "create", async () => ({}));

  const token = signAccessToken({
    id: options.userId,
    email: "qa@example.invalid",
    name: "QA",
    municipioId: "municipio",
    municipioNome: "Município",
    role: options.isPlatformAdmin ? "admin" : "analista",
    isPlatformAdmin: options.isPlatformAdmin ?? false,
    permissions: [],
  });
  const app = express();
  app.use(express.json());
  app.use("/iniciativas", iniciativasRouter);
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
    `http://127.0.0.1:${address.port}/iniciativas/marcos/marco`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ descricao: "Descrição atualizada" }),
    },
  );
  return {
    status: response.status,
    json: await response.json(),
    atualizacoes,
  };
}

test("analista não altera tarefa atribuída a outra pessoa", async (t) => {
  const response = await setup(t, {
    userId: "consultor-a",
    responsavelUserId: "consultor-b",
  });

  assert.equal(response.status, 403);
  assert.equal(response.json.error.code, "EXECUTOR_REQUIRED");
  assert.equal(response.atualizacoes.length, 0);
});

test("responsável atribuído pode editar a própria tarefa", async (t) => {
  const response = await setup(t, {
    userId: "executor",
    responsavelUserId: "executor",
  });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.atualizacoes.length, 1);
});

test("admin pode editar tarefa atribuída a outra pessoa", async (t) => {
  const response = await setup(t, {
    userId: "admin",
    responsavelUserId: "executor",
    isPlatformAdmin: true,
  });

  assert.equal(response.status, 200, JSON.stringify(response.json));
  assert.equal(response.atualizacoes.length, 1);
});
