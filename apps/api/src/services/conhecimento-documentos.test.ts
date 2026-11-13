import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  DOCX_MIME,
  extractKnowledgeText,
  isKnowledgeFileAllowed,
  PDF_MIME,
} from "./conhecimento-documentos";

function createPdf(text: string) {
  const content = `BT /F1 12 Tf 10 100 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document, "ascii"));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, "ascii");
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document, "ascii");
}

test("validates the file extension and MIME pair", () => {
  assert.equal(isKnowledgeFileAllowed("plano.pdf", PDF_MIME), true);
  assert.equal(isKnowledgeFileAllowed("plano.docx", DOCX_MIME), true);
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
});
