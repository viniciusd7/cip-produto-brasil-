import { Prisma, prisma } from "@cip/db";
import { HttpError } from "../middleware/error";

export async function transacaoEstrategica<T>(
  run: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  try {
    return await prisma.$transaction(run, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new HttpError(
        409,
        "ESTRATEGIA_CONCURRENT_UPDATE",
        "O vínculo estratégico foi alterado simultaneamente. Recarregue e tente novamente",
      );
    }
    throw error;
  }
}
