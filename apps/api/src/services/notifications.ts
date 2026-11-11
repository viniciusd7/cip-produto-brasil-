import { prisma, type Prisma } from "@cip/db";
/** Porta de notificação — WhatsApp/SMTP entram depois. */

export type BloqueioNotifyCtx = {
  iniciativaId: string;
  codigo: string;
  nome: string;
  responsavel?: string | null;
  bloqueioLabel: string;
  secretariaNome?: string | null;
  titularTelefone?: string | null;
  titularEmail?: string | null;
};

export interface NotificationPort {
  notifyResponsavelBloqueio(ctx: BloqueioNotifyCtx): Promise<void>;
  notifyBloqueioResolvido(ctx: BloqueioNotifyCtx): Promise<void>;
}

/** Entrega interna: titular vinculado por e-mail; sem vínculo, caixa compartilhada dos secretários. */
export async function avisarSecretaria(iniciativaId: string, texto: string, tipo = "AVISO", autorId?: string, db: Prisma.TransactionClient = prisma) {
  const iniciativa = await db.iniciativa.findUniqueOrThrow({ where: { id: iniciativaId }, include: { secretariaPrincipal: true } });
  const email = iniciativa.secretariaPrincipal.titularEmail;
  const titular = email ? await db.user.findFirst({ where: { email, active: true, vinculos: { some: { municipioId: iniciativa.municipioId, roleCode: "gestor" } } } }) : null;
  return db.comunicado.create({ data: { iniciativaId, autorId, destinatarioId: titular?.id, destinoPapel: titular ? null : "gestor", texto, tipo } });
}
export const notifications: NotificationPort = {
  async notifyResponsavelBloqueio(ctx) {
    await avisarSecretaria(ctx.iniciativaId, `${ctx.bloqueioLabel}. Providência: verificar a pendência e orientar a equipe responsável pelo projeto.`, "BLOQUEIO");
  },
  async notifyBloqueioResolvido(ctx) {
    await avisarSecretaria(ctx.iniciativaId, "Pré-requisito resolvido. A equipe pode atualizar o andamento do projeto.", "LIBERACAO");
  },
};
