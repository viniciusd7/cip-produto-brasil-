import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, prisma } from "@cip/db";
import { criarIniciativa } from "./criacao-iniciativa";

test("erros de outras restrições e falhas operacionais não viram colisão de código", async () => {
  const data = { municipioId: "municipio", secretariaPrincipalId: "secretaria", codigo: "QA-01", nome: "Projeto" };
  for (const error of [
    new Error("Falha operacional"),
    new Prisma.PrismaClientKnownRequestError("Other unique", {
      code: "P2002", clientVersion: Prisma.prismaVersion.client,
      meta: { modelName: "IniciativaSecretaria", target: ["iniciativaId", "secretariaId"] },
    }),
    new Prisma.PrismaClientKnownRequestError("Foreign key", {
      code: "P2003", clientVersion: Prisma.prismaVersion.client,
      meta: { modelName: "Iniciativa", target: ["municipioId", "codigo"] },
    }),
  ]) {
    const original = prisma.iniciativa.create;
    Reflect.set(prisma.iniciativa, "create", async () => { throw error; });
    try {
      await assert.rejects(criarIniciativa(prisma, data), (received) => received === error);
    } finally {
      Reflect.set(prisma.iniciativa, "create", original);
    }
  }
});
