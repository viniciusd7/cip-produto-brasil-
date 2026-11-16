import { randomUUID } from "node:crypto";
import { Prisma } from "@cip/db";
import { HttpError } from "../middleware/error";

export async function criarIniciativa(
  tx: Pick<Prisma.TransactionClient, "iniciativa">,
  data: Omit<Prisma.IniciativaUncheckedCreateInput, "codigo"> & { codigo?: string },
) {
  try {
    return await tx.iniciativa.create({
      data: { ...data, codigo: data.codigo ?? randomUUID() },
    });
  } catch (error) {
    const target = error instanceof Prisma.PrismaClientKnownRequestError
      ? error.meta?.target
      : undefined;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (!error.meta?.modelName || error.meta.modelName === "Iniciativa") &&
      Array.isArray(target) &&
      target.length === 2 &&
      target.includes("municipioId") &&
      target.includes("codigo")
    ) {
      throw new HttpError(
        409,
        "CODIGO_INICIATIVA_DUPLICADO",
        "Já existe um projeto com este código nesta prefeitura. Escolha outro código e tente novamente.",
      );
    }
    throw error;
  }
}
