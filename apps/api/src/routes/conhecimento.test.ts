import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { prisma } from "@cip/db";
import { signAccessToken } from "../middleware/auth";
import { errorHandler } from "../middleware/error";
import { conhecimentoRouter } from "./conhecimento";

process.env.DATABASE_URL = "******127.0.0.1:1/conhecimento_tests?connect_timeout=1";
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
  const documentos: Array<Record<string, unknown>> = [];
  stub(t, prisma.user, "findUnique", async () => ({
    active: true,
    isPlatformAdmin: true,
  }));
  stub(t, prisma.municipio, "findFirst", async () => ({
    id: "municipio",
    nome: "Município",
  }));
  stub(t, prisma.vinculoUsuarioMunicipio, "findUnique", async () => null);
  stub(t, prisma.documentoConhecimento, "create", async ({ data }: {
    data: Record<string, unknown>;
  }) => {
    documentos.push(data);
    return {
      id: `documento-${documentos.length}`,
      municipioId: "municipio",
      arquivoUrl: null,
      arquivoNome: null,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });
  stub(t, prisma.documentoConhecimento, "findMany", async () =>
    documentos.map((documento, index) => ({
      id: `documento-${index + 1}`,
      ...documento,
    })),
  );
  stub(t, prisma.documentoConhecimento, "findFirst", async () => ({
    id: "documento-sem-arquivo",
    municipioId: "municipio",
    tipo: "PPA",
    arquivoNome: null,
    arquivoUrl: null,
    titulo: "Documento PPA",
    vigencia: null,
    versao: null,
    fonte: null,
    responsavel: null,
    statusConferencia: "PENDENTE",
    observacao: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  stub(t, prisma.auditLog, "create", async () => ({}));

  const app = express();
  app.use(express.json());
  app.use("/conhecimento", conhecimentoRouter);
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

  async function createDocument(tipo: string) {
    const form = new FormData();
    form.set("tipo", tipo);
    form.set("titulo", `Documento ${tipo}`);
    const response = await fetch(`${baseUrl}/conhecimento/documentos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: response.status, json: await response.json() };
  }

  async function changeDocumentType(tipo: string) {
    const response = await fetch(
      `${baseUrl}/conhecimento/documentos/documento-sem-arquivo`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tipo }),
      },
    );
    return { status: response.status, json: await response.json() };
  }

  async function listDocuments() {
    const response = await fetch(`${baseUrl}/conhecimento/documentos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: response.status, json: await response.json() };
  }

  return { createDocument, changeDocumentType, listDocuments, documentos };
}

test("Plano de Governo exige arquivo também na API", async (t) => {
  const ctx = await setup(t);
  const response = await ctx.createDocument("PLANO_GOVERNO");

  assert.equal(response.status, 422, JSON.stringify(response.json));
  assert.equal(response.json.error.code, "DOCUMENT_FILE_REQUIRED");
  assert.equal(ctx.documentos.length, 0);
});

test("demais tipos de documento podem ser cadastrados sem arquivo", async (t) => {
  const ctx = await setup(t);
  const tiposOpcionais = ["PPA", "LDO", "LOA", "DIAGNOSTICO", "OUTRO"];

  for (const tipo of tiposOpcionais) {
    const response = await ctx.createDocument(tipo);
    assert.equal(response.status, 201, `${tipo}: ${JSON.stringify(response.json)}`);
  }

  assert.deepEqual(
    ctx.documentos.map((documento) => documento.tipo),
    tiposOpcionais,
  );
  assert.ok(ctx.documentos.every((documento) => documento.arquivoNome === undefined));
});

test("não permite alterar documento sem arquivo para Plano de Governo", async (t) => {
  const ctx = await setup(t);
  const response = await ctx.changeDocumentType("PLANO_GOVERNO");

  assert.equal(response.status, 422, JSON.stringify(response.json));
  assert.equal(response.json.error.code, "DOCUMENT_FILE_REQUIRED");
});

test("documentos opcionais cadastrados não geram alertas de pendência", async (t) => {
  const ctx = await setup(t);
  for (const tipo of ["PPA", "LDO", "LOA"]) {
    assert.equal((await ctx.createDocument(tipo)).status, 201);
  }

  const response = await ctx.listDocuments();
  assert.equal(response.status, 200);
  assert.deepEqual(response.json.data.map((doc: { tipo: string }) => doc.tipo), ["PPA", "LDO", "LOA"]);
  assert.deepEqual(response.json.meta.alertasOrcamento, []);
});
