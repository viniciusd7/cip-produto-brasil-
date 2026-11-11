import { prisma } from "@cip/db";
import type { AuthUser } from "../middleware/auth";

export async function writeAudit(params: {
  user?: AuthUser | null;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.user?.id,
      municipioId: params.user?.municipioId || undefined,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      before: params.before as object | undefined,
      after: params.after as object | undefined,
      ip: params.ip,
    },
  });
}
