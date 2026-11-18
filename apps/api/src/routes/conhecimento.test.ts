import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import express from "express";
import { prisma } from "@cip/db";
import type { RoleCode } from "@cip/shared";
import { signAccessToken } from "../middleware/auth";
import { errorHandler } from "../middleware/error";
import * as knowledgeFiles from "../services/conhecimento-documentos";
import { localStorage } from "../services/storage";
import { createPdf } from "../test/knowledge-files";
import { conhecimentoRouter } from "./conhecimento";

process.env.DATABASE_URL = "******127.0.0.1:1/conhecimento_tests?connect_timeout=1";
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.NODE_ENV = "test";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL;

function stub(
  t: TestContext,
  target: object,
  method: string,
  implementation: (...args: never[]) => unknown,
) {
  const original = Reflect.get(target, method);
  assert.equal(typeof original, "function", method);
  assert.equal(Reflect.set(target, method, implementation), true, method);
  t.after(() => Reflect.set(target, method, original));
}

async function setup(t: TestContext, role: RoleCode = "admin") {
  const documentos: Array<Record<string, unknown>> = [];
  const savedFiles: unknown[][] = [];
  const deletedFiles: string[] = [];
  stub(t, localStorage, "save", async (...args: unknown[]) => {
    savedFiles.push(args);
    return {
      relativePath: `conhecimento/test-${savedFiles.length}`,
      originalName: args[1],
      mimeType: args[2],
      size: 0,
    };
  });
  stub(t, localStorage, "remove", async (key: string) => {
    deletedFiles.push(key);
  });
  stub(t, prisma.user, "findUnique", async () => ({
    active: true,
    isPlatformAdmin: role === "admin",
  }));
  stub(t, prisma.municipio, "findFirst", async ({ where }: {
    where: { id: string };
  }) => ({
    id: where.id,
    nome: "Município",
  }));
  stub(t, prisma.vinculoUsuarioMunicipio, "findUnique", async () =>
    role === "admin" ? null : { roleCode: role, secretariaId: null },
  );
  stub(t, prisma.documentoConhecimento, "create", async ({ data, select }: {
    data: Record<string, unknown>;
    select: Record<string, boolean>;
  }) => {
    documentos.push(data);
    const stored = {
      id: `documento-${documentos.length}`,
      municipioId: "municipio",
      arquivoUrl: null,
      arquivoNome: null,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return Object.fromEntries(
      Object.entries(stored).filter(([key]) => select[key]),
    );
  });
  stub(t, prisma.documentoConhecimento, "findMany", async ({ where }: {
    where: { municipioId: string; tipo?: string };
  }) =>
    documentos.filter((doc) => doc.municipioId === where.municipioId && (!where.tipo || doc.tipo === where.tipo)).map((documento, index) => ({
      id: `documento-${index + 1}`,
      ...documento,
    })),
  );
  stub(t, prisma.documentoConhecimento, "findFirst", async ({ where }: {
    where: { id: string; municipioId: string; tipo?: string };
  }) => {
    if (where.municipioId !== "municipio") return null;
    const document = documentos.find((doc, index) => where.id === `documento-${index + 1}`);
    if (document) {
      return where.tipo && document.tipo !== where.tipo ? null : { id: where.id, ...document };
    }
    if (where.id !== "documento-sem-arquivo" || (where.tipo && where.tipo !== "PPA")) return null;
    return {
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
    };
  });
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
    role,
    isPlatformAdmin: role === "admin",
    permissions: [],
  });

  async function createDocument(tipo: string, options: {
    file?: { bytes: Uint8Array; name: string; mime: string };
    fields?: Record<string, string | null>;
    authorization?: string | null;
  } = {}) {
    const form = new FormData();
    form.set("tipo", tipo);
    form.set("titulo", `Documento ${tipo}`);
    form.set("observacao", "Descrição do conteúdo do documento.");
    for (const [key, value] of Object.entries(options.fields ?? {})) {
      if (value === null) form.delete(key);
      else form.set(key, value);
    }
    if (options.file) {
      form.set("arquivo", new Blob([new Uint8Array(options.file.bytes)], {
        type: options.file.mime,
      }), options.file.name);
    }
    const authorization = options.authorization === undefined
      ? `Bearer ${token}` : options.authorization;
    const response = await fetch(`${baseUrl}/conhecimento/documentos`, {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : {},
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

  return {
    createDocument, changeDocumentType, listDocuments, documentos,
    savedFiles, deletedFiles, baseUrl, token,
  };
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

function pdfFile(text: string, name = "documento.pdf") {
  return { bytes: createPdf(text), name, mime: knowledgeFiles.PDF_MIME };
}

test("todos os tipos exigem título e descrição antes de armazenar o arquivo", async (t) => {
  const ctx = await setup(t);
  for (const tipo of ["AUTO", "PLANO_GOVERNO", "PPA", "LDO", "LOA", "DIAGNOSTICO", "OUTRO"]) {
    for (const campo of ["titulo", "observacao"]) {
      for (const valor of [null, "", "   ", "ab"]) {
        const response = await ctx.createDocument(tipo, {
          file: pdfFile("Plano Plurianual"),
          fields: { [campo]: valor },
        });
        assert.equal(response.status, 400, `${tipo}/${campo}/${valor}`);
        assert.equal(response.json.error.code, "VALIDATION_ERROR");
      }
    }
  }
  assert.equal(ctx.savedFiles.length, 0);
  assert.equal(ctx.documentos.length, 0);
  const created = await ctx.createDocument("AUTO", {
    file: pdfFile("Plano Plurianual"),
    fields: { titulo: "  Investimentos municipais  ", observacao: "  Prioridades do município.  " },
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.titulo, "Investimentos municipais");
  assert.equal(created.json.data.observacao, "Prioridades do município.");
});

for (const role of ["admin", "prefeito", "gestor", "analista", "leitura"] as const) {
  test(`${role}: consulta respeita visibilidade dos documentos`, async (t) => {
    const ctx = await setup(t, role);
    const tipos = ["PLANO_GOVERNO", "PPA", "LDO", "LOA", "DIAGNOSTICO", "OUTRO"];
    for (const tipo of tipos) {
      ctx.documentos.push({
        municipioId: "municipio", tipo, titulo: `Documento ${tipo}`,
        observacao: `Conteúdo ${tipo}`, arquivoNome: `${tipo}.pdf`,
        storageKey: "local:conhecimento/arquivo", conteudoExtraido: `Texto ${tipo}`,
      });
    }
    stub(t, localStorage, "read", async () => Buffer.from("arquivo"));
    const listed = await ctx.listDocuments();
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.json.data.map((doc: { tipo: string }) => doc.tipo),
      role === "analista" ? ["PLANO_GOVERNO"] : tipos);
    for (const [index, tipo] of tipos.entries()) {
      for (const suffix of ["arquivo", "conteudo"]) {
        const response = await fetch(`${ctx.baseUrl}/conhecimento/documentos/documento-${index + 1}/${suffix}`, {
          headers: { Authorization: `Bearer ${ctx.token}` },
        });
        const oculto = role === "analista" && tipo !== "PLANO_GOVERNO";
        assert.equal(response.status, oculto ? 404 : 200, `${tipo}/${suffix}`);
        if (oculto) assert.equal((await response.json()).error.code, "NOT_FOUND");
        else if (suffix === "conteudo") assert.equal((await response.json()).data.texto, `Texto ${tipo}`);
        else assert.equal(await response.text(), "arquivo");
      }
    }
  });
}

test("consultor pode enviar documento adicional, mas não consultá-lo nem alterá-lo depois", async (t) => {
  const ctx = await setup(t, "analista");
  const uploaded = await ctx.createDocument("AUTO", { file: pdfFile("Plano Plurianual") });
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.json.data.tipo, "PPA");
  assert.deepEqual((await ctx.listDocuments()).json.data, []);
  const response = await fetch(`${ctx.baseUrl}/conhecimento/documentos/documento-1`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${ctx.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tipo: "PLANO_GOVERNO" }),
  });
  assert.equal(response.status, 404);
});

test("AUTO exige arquivo real mesmo com URL ou texto informados", async (t) => {
  const ctx = await setup(t);
  const response = await ctx.createDocument("AUTO", {
    fields: {
      arquivoUrl: "https://example.invalid/plano.pdf",
      conteudoExtraido: "Plano Plurianual",
    },
  });
  assert.equal(response.status, 422);
  assert.equal(response.json.error.code, "DOCUMENT_FILE_REQUIRED");
  assert.equal(ctx.documentos.length, 0);
  assert.equal(ctx.savedFiles.length, 0);
});

test("AUTO classifica o PDF extraído, ignora tipo/nome/metadados forjados e retorna tipo concreto", async (t) => {
  const ctx = await setup(t);
  for (const [text, tipo] of [
    ["Plano Plurianual", "PPA"],
    ["Lei de Diretrizes Orcamentarias", "LDO"],
    ["Lei Orcamentaria Anual", "LOA"],
    ["Diagnostico Municipal", "DIAGNOSTICO"],
    ["Plano Plurianual\nLei Orcamentaria Anual", "OUTRO"],
    ["Plano de Governo", "OUTRO"],
    ["PPA", "OUTRO"],
    ["", "OUTRO"],
  ]) {
    const response = await ctx.createDocument("AUTO", {
      file: pdfFile(text, "PLANO_GOVERNO.pdf"),
      fields: {
        titulo: "PLANO_GOVERNO.pdf",
        municipioId: "outro-municipio",
        conteudoExtraido: "Plano de Governo",
        storageKey: "test:outro-municipio/forjado",
        vigencia: "2026",
      },
    });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(response.json.data.tipo, tipo, text);
    assert.equal(response.json.data.titulo, "PLANO_GOVERNO.pdf");
    assert.equal(response.json.data.vigencia, "2026");
    assert.equal(response.json.data.municipioId, "municipio");
    assert.equal(response.json.data.arquivoNome, "PLANO_GOVERNO.pdf");
    assert.equal("storageKey" in response.json.data, false);
    assert.equal("conteudoExtraido" in response.json.data, false);
    const stored = ctx.documentos.at(-1)!;
    assert.equal(stored.tipo, tipo);
    assert.notEqual(stored.storageKey, "test:outro-municipio/forjado");
    assert.equal(ctx.savedFiles.at(-1)![3], "conhecimento");
  }
});

test("AUTO aceita DOCX real, inclusive sem texto", async (t) => {
  const ctx = await setup(t);
  const fixtures = path.resolve(path.dirname(require.resolve("mammoth")), "../test/test-data");
  for (const name of ["single-paragraph.docx", "empty.docx"]) {
    const response = await ctx.createDocument("AUTO", {
      file: {
        bytes: await readFile(path.join(fixtures, name)),
        name,
        mime: knowledgeFiles.DOCX_MIME,
      },
    });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(response.json.data.tipo, "OUTRO");
  }
});

test("tipos explícitos continuam soberanos, inclusive Plano de Governo com arquivo", async (t) => {
  const ctx = await setup(t);
  for (const tipo of ["PLANO_GOVERNO", "PPA", "LDO", "LOA", "DIAGNOSTICO", "OUTRO"]) {
    const response = await ctx.createDocument(tipo, {
      file: pdfFile("Lei Orcamentaria Anual"),
    });
    assert.equal(response.status, 201, JSON.stringify(response.json));
    assert.equal(response.json.data.tipo, tipo);
  }
  const invalidPatch = await ctx.changeDocumentType("AUTO");
  assert.equal(invalidPatch.status, 400);
  assert.equal(invalidPatch.json.error.code, "VALIDATION_ERROR");
});

test("AUTO e tipos explícitos rejeitam bytes, MIME e formatos inválidos antes de salvar", async (t) => {
  const ctx = await setup(t);
  const invalidFiles = [
    { bytes: Buffer.from("Plano Plurianual"), name: "plano.pdf", mime: knowledgeFiles.PDF_MIME },
    { bytes: Buffer.from("%PDF-1.4\ncorrompido"), name: "plano.pdf", mime: knowledgeFiles.PDF_MIME },
    { bytes: Buffer.from("Plano Plurianual"), name: "plano.doc", mime: knowledgeFiles.DOC_MIME },
    { bytes: Buffer.from("d0cf11e0a1b11ae100000000", "hex"), name: "plano.doc", mime: knowledgeFiles.DOC_MIME },
    { bytes: Buffer.from("Plano Plurianual"), name: "plano.docx", mime: knowledgeFiles.DOCX_MIME },
    { bytes: Buffer.from("504b030400000000", "hex"), name: "plano.docx", mime: knowledgeFiles.DOCX_MIME },
    { bytes: createPdf("Plano Plurianual"), name: "plano.pdf", mime: knowledgeFiles.DOCX_MIME },
    { bytes: createPdf("Plano Plurianual"), name: "plano.exe", mime: knowledgeFiles.PDF_MIME },
  ];
  for (const tipo of ["AUTO", "PLANO_GOVERNO", "PPA"]) {
    for (const file of invalidFiles) {
      const response = await ctx.createDocument(tipo, { file });
      assert.equal(response.status, 422, JSON.stringify(response.json));
      assert.equal(response.json.error.code, "INVALID_FILE");
    }
  }
  const oversized = await ctx.createDocument("AUTO", {
    file: { ...pdfFile(""), bytes: Buffer.alloc(4 * 1024 * 1024 + 1) },
  });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.json.error.code, "FILE_TOO_LARGE");
  assert.equal(ctx.documentos.length, 0);
  assert.equal(ctx.savedFiles.length, 0);
});

test("perfil leitura pode enviar documentos, preservando a autenticação", async (t) => {
  const ctx = await setup(t, "leitura");
  const unauthorized = await ctx.createDocument("AUTO", {
    file: pdfFile("Plano Plurianual"), authorization: null,
  });
  assert.equal(unauthorized.status, 401);
  const uploaded = await ctx.createDocument("AUTO", {
    file: pdfFile("Plano Plurianual"),
  });
  assert.equal(uploaded.status, 201);
  assert.equal(ctx.savedFiles.length, 1);
  assert.equal(ctx.documentos.length, 1);
});

test("gestor pode classificar mas não conferir documento automaticamente", async (t) => {
  const ctx = await setup(t, "gestor");
  const forbidden = await ctx.createDocument("AUTO", {
    file: pdfFile("Plano Plurianual"),
    fields: { statusConferencia: "CONFERIDO" },
  });
  assert.equal(forbidden.status, 403);
  assert.equal(ctx.savedFiles.length, 0);
  const created = await ctx.createDocument("AUTO", { file: pdfFile("Plano Plurianual") });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.tipo, "PPA");
  assert.equal(created.json.data.statusConferencia, "PENDENTE");
});

test("AUTO mantém documentos, conteúdo e download isolados por município", async (t) => {
  const ctx = await setup(t);
  assert.equal((await ctx.createDocument("AUTO", {
    file: pdfFile("Plano Plurianual"),
  })).status, 201);
  const otherToken = signAccessToken({
    id: "usuario", email: "qa@example.invalid", name: "QA", role: "admin",
    municipioId: "outro-municipio", municipioNome: "Outro",
    isPlatformAdmin: true, permissions: [],
  });
  for (const suffix of ["", "/documento-1/conteudo", "/documento-1/arquivo"]) {
    const response = await fetch(`${ctx.baseUrl}/conhecimento/documentos${suffix}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    const json = await response.json();
    assert.equal(response.status, suffix ? 404 : 200);
    if (!suffix) assert.deepEqual(json.data, []);
  }
  const patched = await fetch(`${ctx.baseUrl}/conhecimento/documentos/documento-1`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${otherToken}`, "Content-Type": "application/json",
    },
    body: JSON.stringify({ tipo: "PLANO_GOVERNO" }),
  });
  assert.equal(patched.status, 404);
});

test("remove arquivo se a persistência do documento classificado falhar", async (t) => {
  const ctx = await setup(t);
  stub(t, prisma.documentoConhecimento, "create", async () => {
    throw new Error("Falha de persistência simulada");
  });
  const response = await ctx.createDocument("AUTO", { file: pdfFile("Plano Plurianual") });
  assert.equal(response.status, 500);
  assert.equal(response.json.error.code, "INTERNAL_ERROR");
  assert.deepEqual(ctx.deletedFiles, ["conhecimento/test-1"]);
  assert.equal(ctx.documentos.length, 0);
});

test("AUTO mantém limite de um arquivo e nome do campo multipart", async (t) => {
  const ctx = await setup(t);
  for (const fields of [["arquivo", "arquivo"], ["documento"]]) {
    const form = new FormData();
    form.set("tipo", "AUTO");
    form.set("titulo", "plano.pdf");
    for (const field of fields) {
      form.append(field, new Blob([new Uint8Array(createPdf("Plano Plurianual"))], {
        type: knowledgeFiles.PDF_MIME,
      }), "plano.pdf");
    }
    const response = await fetch(`${ctx.baseUrl}/conhecimento/documentos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.token}` },
      body: form,
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_MULTIPART");
  }
  assert.equal(ctx.documentos.length, 0);
  assert.equal(ctx.savedFiles.length, 0);
});

test("AUTO exige contexto de município mesmo para administrador central", async (t) => {
  const ctx = await setup(t);
  const token = signAccessToken({
    id: "usuario", email: "qa@example.invalid", name: "QA", role: "admin",
    municipioId: "", municipioNome: "Gestão central CIP",
    isPlatformAdmin: true, permissions: [],
  });
  const response = await ctx.createDocument("AUTO", {
    file: pdfFile("Plano Plurianual"), authorization: `Bearer ${token}`,
  });
  assert.equal(response.status, 409);
  assert.equal(response.json.error.code, "TENANT_CONTEXT_REQUIRED");
  assert.equal(ctx.documentos.length, 0);
  assert.equal(ctx.savedFiles.length, 0);
});
