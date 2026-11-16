import assert from "node:assert/strict";
import test from "node:test";
import {
  KNOWLEDGE_DOCUMENT_TYPES,
  getRequiredKnowledgeDocumentStatus,
  isKnowledgeDocumentType,
  isKnowledgeDocumentRequired,
} from "./knowledge-documents";

test("only the government plan requires an attached document", () => {
  assert.equal(isKnowledgeDocumentType("PLANO_GOVERNO"), true);
  assert.equal(isKnowledgeDocumentType("ARQUIVO_DESCONHECIDO"), false);
  assert.equal(isKnowledgeDocumentRequired("PLANO_GOVERNO"), true);
  for (const tipo of KNOWLEDGE_DOCUMENT_TYPES.filter(
    (documentType) => documentType !== "PLANO_GOVERNO",
  )) {
    assert.equal(isKnowledgeDocumentRequired(tipo), false, tipo);
  }
});

test("reports whether the required government plan is missing, incomplete, or present", () => {
  assert.deepEqual(getRequiredKnowledgeDocumentStatus([]), {
    status: "missing",
  });
  assert.deepEqual(
    getRequiredKnowledgeDocumentStatus([
      { tipo: "PPA", titulo: "PPA 2026", arquivoNome: "ppa.pdf" },
    ]),
    { status: "missing" },
  );
  assert.deepEqual(
    getRequiredKnowledgeDocumentStatus([
      { tipo: "PLANO_GOVERNO", titulo: "Plano atual" },
    ]),
    { status: "file-missing", titulo: "Plano atual" },
  );
  assert.deepEqual(
    getRequiredKnowledgeDocumentStatus([
      { tipo: "PLANO_GOVERNO", titulo: "Plano atual", arquivoNome: "plano.pdf" },
    ]),
    { status: "complete", titulo: "Plano atual" },
  );
});
