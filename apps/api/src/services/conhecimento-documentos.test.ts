import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createPdf } from "../test/knowledge-files";
import {
  DOCX_MIME,
  DOC_MIME,
  extractKnowledgeText,
  isKnowledgeFileAllowed,
  PDF_MIME,
} from "./conhecimento-documentos";

test("validates the file extension and MIME pair", () => {
  assert.equal(isKnowledgeFileAllowed("plano.pdf", PDF_MIME), true);
  assert.equal(isKnowledgeFileAllowed("plano.docx", DOCX_MIME), true);
  assert.equal(isKnowledgeFileAllowed("plano.doc", DOC_MIME), true);
  assert.equal(isKnowledgeFileAllowed("plano.pdf", DOCX_MIME), false);
  assert.equal(isKnowledgeFileAllowed("plano.exe", "application/pdf"), false);
});

test("extracts text from a PDF and a DOCX", async () => {
  const pdfText = await extractKnowledgeText(
    createPdf("Texto para teste"),
    "teste.pdf",
    PDF_MIME,
  );
  assert.match(pdfText, /Texto para teste/);

  const mammothDirectory = path.resolve(
    path.dirname(require.resolve("mammoth")),
    "..",
  );
  const docx = await readFile(
    path.join(mammothDirectory, "test/test-data/single-paragraph.docx"),
  );
  const docxText = await extractKnowledgeText(docx, "teste.docx", DOCX_MIME);
  assert.ok(docxText.length > 0);
});

test("rejects files whose signature does not match the declared format", async () => {
  await assert.rejects(
    extractKnowledgeText(Buffer.from("not a PDF"), "teste.pdf", PDF_MIME),
    { code: "INVALID_FILE" },
  );
  await assert.rejects(
    extractKnowledgeText(Buffer.from("not a DOCX"), "teste.docx", DOCX_MIME),
    { code: "INVALID_FILE" },
  );
  await assert.rejects(
    extractKnowledgeText(Buffer.from("not a DOC"), "teste.doc", DOC_MIME),
    { code: "INVALID_FILE" },
  );
});
