import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type StoredFile = {
  relativePath: string;
  originalName: string;
  mimeType: string;
  size: number;
};

type UploadDirectory = "evidencias" | "conhecimento";

const UPLOAD_ROOT =
  process.env.UPLOAD_DIR ||
  path.join(process.cwd(), "uploads");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function isAllowedMime(mime: string) {
  return ALLOWED_MIME.has(mime);
}

export function inferTipoFromMime(mime: string): "FOTO" | "VIDEO" | "DOCUMENTO" {
  if (mime.startsWith("image/")) return "FOTO";
  if (mime.startsWith("video/")) return "VIDEO";
  return "DOCUMENTO";
}

/** Porta de storage local — trocável por Blob depois. */
export const localStorage = {
  root: UPLOAD_ROOT,

  async ensureRoot() {
    await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  },

  async save(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    directory: UploadDirectory = "evidencias",
  ): Promise<StoredFile> {
    await this.ensureRoot();
    const safeBase = originalName
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(0, 80);
    const relativePath = path.join(
      directory,
      `${Date.now()}-${randomUUID().slice(0, 8)}-${safeBase}`,
    );
    const full = path.join(UPLOAD_ROOT, relativePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
    return {
      relativePath: relativePath.replace(/\\/g, "/"),
      originalName,
      mimeType,
      size: buffer.length,
    };
  },

  absolutePath(relativePath: string) {
    const root = path.resolve(UPLOAD_ROOT);
    const resolved = path.resolve(root, relativePath);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error("INVALID_PATH");
    }
    return resolved;
  },

  async read(relativePath: string) {
    return fs.readFile(this.absolutePath(relativePath));
  },

  async remove(relativePath: string) {
    await fs.rm(this.absolutePath(relativePath));
  },

  async exists(relativePath: string) {
    try {
      await fs.access(this.absolutePath(relativePath));
      return true;
    } catch {
      return false;
    }
  },
};
