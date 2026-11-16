export const KNOWLEDGE_DOCUMENT_TYPES = [
  "PLANO_GOVERNO",
  "PPA",
  "LDO",
  "LOA",
  "DIAGNOSTICO",
  "OUTRO",
] as const;

export type KnowledgeDocumentType = (typeof KNOWLEDGE_DOCUMENT_TYPES)[number];

export type KnowledgeDocumentRecord = {
  tipo: string;
  titulo: string;
  arquivoNome?: string | null;
};

export type RequiredKnowledgeDocumentStatus =
  | { status: "missing" }
  | { status: "file-missing"; titulo: string }
  | { status: "complete"; titulo: string };

export function isKnowledgeDocumentType(
  tipo: string,
): tipo is KnowledgeDocumentType {
  return KNOWLEDGE_DOCUMENT_TYPES.some((documentType) => documentType === tipo);
}

export function isKnowledgeDocumentRequired(tipo: string) {
  return tipo === "PLANO_GOVERNO";
}

export function getRequiredKnowledgeDocumentStatus(
  documents: readonly KnowledgeDocumentRecord[],
): RequiredKnowledgeDocumentStatus {
  const plans = documents.filter((document) =>
    isKnowledgeDocumentRequired(document.tipo),
  );
  const planWithFile = plans.find((document) => Boolean(document.arquivoNome));

  if (planWithFile) {
    return { status: "complete", titulo: planWithFile.titulo };
  }

  const planWithoutFile = plans[0];
  if (planWithoutFile) {
    return { status: "file-missing", titulo: planWithoutFile.titulo };
  }

  return { status: "missing" };
}
