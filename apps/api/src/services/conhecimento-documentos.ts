import { randomUUID } from "node:crypto";
import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { HttpError } from "../middleware/error";
import { localStorage } from "./storage";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PDF_MIME = "application/pdf";
const MAX_EXTRACTED_TEXT_CHARS = 5_000_000;

type KnowledgeFileFormat = "pdf" | "docx";

function getKnowledgeFileFormat(
  originalName: string,
  mimeType: string,
): KnowledgeFileFormat | undefined {
  const extension = path.extname(originalName).toLowerCase();
  if (extension === ".pdf" && mimeType === PDF_MIME) return "pdf";
  if (extension === ".docx" && mimeType === DOCX_MIME) return "docx";
  return undefined;
}

export function isKnowledgeFileAllowed(originalName: string, mimeType: string) {
  return getKnowledgeFileFormat(originalName, mimeType) !== undefined;
}

export async function extractKnowledgeText(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<string> {
  const format = getKnowledgeFileFormat(originalName, mimeType);
  if (!format) {
    throw new HttpError(
      422,
      "INVALID_FILE",
      "Envie um arquivo PDF ou DOCX válido.",
    );
  }

  let text: string;
  if (format === "pdf") {
    if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new HttpError(422, "INVALID_FILE", "O arquivo não contém um PDF válido.");
    }

    const parser = new PDFParse({ data: Uint8Array.from(buffer) });
    try {
      text = (await parser.getText()).text;
    } catch {
      throw new HttpError(422, "INVALID_FILE", "Não foi possível ler o conteúdo deste PDF.");
    } finally {
      await parser.destroy();
    }
  } else {
    if (buffer.subarray(0, 4).toString("hex") !== "504b0304") {
      throw new HttpError(422, "INVALID_FILE", "O arquivo não contém um DOCX válido.");
    }

    try {
      text = (await mammoth.extractRawText({ buffer })).value;
    } catch {
      throw new HttpError(422, "INVALID_FILE", "Não foi possível ler o conteúdo deste DOCX.");
    }
  }

  const normalizedText = text.trim();
  if (normalizedText.length > MAX_EXTRACTED_TEXT_CHARS) {
    throw new HttpError(
      422,
      "DOCUMENT_TEXT_TOO_LARGE",
      "O texto extraído excede o limite de armazenamento permitido.",
    );
  }
  return normalizedText;
}

function storageConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (Boolean(url) !== Boolean(serviceKey)) {
    throw new HttpError(
      503,
      "STORAGE_NOT_CONFIGURED",
      "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para armazenar documentos.",
    );
  }
  if (!url || !serviceKey) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      throw new HttpError(
        503,
        "STORAGE_NOT_CONFIGURED",
        "Configure o armazenamento privado de documentos antes de fazer uploads.",
      );
    }
    return undefined;
  }

  return {
    url: url.replace(/\/+$/, ""),
    serviceKey,
    bucket: process.env.SUPABASE_KNOWLEDGE_BUCKET || "cip-conhecimento",
  };
}

function storageObjectUrl(baseUrl: string, bucket: string, key: string) {
  const encodedBucket = encodeURIComponent(bucket);
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/${encodedBucket}/${encodedKey}`;
}

function safeFileName(name: string) {
  return path
    .basename(name)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
}

export async function saveKnowledgeFile(
  buffer: Buffer,
  municipioId: string,
  originalName: string,
  mimeType: string,
): Promise<string> {
  const config = storageConfig();
  if (!config) {
    const stored = await localStorage.save(
      buffer,
      originalName,
      mimeType,
      "conhecimento",
    );
    return `local:${stored.relativePath}`;
  }

  const objectKey = `${municipioId}/${randomUUID()}-${safeFileName(originalName)}`;
  const uploadBody = new ArrayBuffer(buffer.length);
  new Uint8Array(uploadBody).set(buffer);
  let response: Response;
  try {
    response = await fetch(storageObjectUrl(config.url, config.bucket, objectKey), {
      method: "POST",
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        "Content-Type": mimeType,
        "x-upsert": "false",
      },
      body: uploadBody,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new HttpError(
      502,
      "STORAGE_UNAVAILABLE",
      "Não foi possível conectar ao armazenamento de documentos.",
    );
  }

  if (!response.ok) {
    throw new HttpError(
      502,
      "STORAGE_UPLOAD_FAILED",
      "O armazenamento recusou o arquivo. Verifique a configuração do bucket.",
    );
  }
  return `supabase:${objectKey}`;
}

export async function readKnowledgeFile(storageKey: string): Promise<Buffer> {
  if (storageKey.startsWith("local:")) {
    const relativePath = storageKey.slice("local:".length);
    try {
      return await localStorage.read(relativePath);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new HttpError(404, "FILE_MISSING", "Arquivo não encontrado no armazenamento.");
      }
      throw error;
    }
  }

  if (!storageKey.startsWith("supabase:")) {
    throw new HttpError(404, "FILE_MISSING", "Arquivo não encontrado no armazenamento.");
  }

  const config = storageConfig();
  if (!config) {
    throw new HttpError(
      503,
      "STORAGE_NOT_CONFIGURED",
      "Configure o armazenamento privado para acessar este documento.",
    );
  }

  const objectKey = storageKey.slice("supabase:".length);
  let response: Response;
  try {
    response = await fetch(storageObjectUrl(config.url, config.bucket, objectKey), {
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new HttpError(
      502,
      "STORAGE_UNAVAILABLE",
      "Não foi possível conectar ao armazenamento de documentos.",
    );
  }

  if (response.status === 404) {
    throw new HttpError(404, "FILE_MISSING", "Arquivo não encontrado no armazenamento.");
  }
  if (!response.ok) {
    throw new HttpError(
      502,
      "STORAGE_DOWNLOAD_FAILED",
      "Não foi possível recuperar o documento armazenado.",
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteKnowledgeFile(storageKey: string): Promise<void> {
  if (storageKey.startsWith("local:")) {
    await localStorage.remove(storageKey.slice("local:".length));
    return;
  }
  if (!storageKey.startsWith("supabase:")) return;

  const config = storageConfig();
  if (!config) {
    throw new HttpError(
      503,
      "STORAGE_NOT_CONFIGURED",
      "Configure o armazenamento privado para remover o arquivo.",
    );
  }

  const objectKey = storageKey.slice("supabase:".length);
  let response: Response;
  try {
    response = await fetch(storageObjectUrl(config.url, config.bucket, objectKey), {
      method: "DELETE",
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
      },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new HttpError(
      502,
      "STORAGE_UNAVAILABLE",
      "Não foi possível conectar ao armazenamento de documentos.",
    );
  }
  if (!response.ok) {
    throw new HttpError(
      502,
      "STORAGE_DELETE_FAILED",
      "Não foi possível remover o arquivo do armazenamento.",
    );
  }
}
