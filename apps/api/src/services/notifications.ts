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

// ========== Notificações por usuário (atribuição e validação) ==========

export type NotificacaoInput = {
  municipioId: string;
  userId: string;
  tipo: "ATRIBUICAO" | "VALIDACAO_PENDENTE" | "VALIDACAO_DECIDIDA" | "REPROGRAMACAO";
  titulo: string;
  texto: string;
  link?: string | null;
  entidadeTipo?: string | null;
  entidadeId?: string | null;
};

/** Canal de entrega. O interno grava no banco; SMTP e WhatsApp oficial entram como adaptadores. */
export interface CanalNotificacao {
  nome: string;
  ativo(): boolean;
  enviar(input: NotificacaoInput, db: Prisma.TransactionClient): Promise<void>;
}

const canalInterno: CanalNotificacao = {
  nome: "interno",
  ativo: () => true,
  async enviar(input, db) {
    await db.notificacao.create({
      data: {
        municipioId: input.municipioId,
        userId: input.userId,
        tipo: input.tipo,
        titulo: input.titulo.slice(0, 190),
        texto: input.texto,
        link: input.link ?? null,
        entidadeTipo: input.entidadeTipo ?? null,
        entidadeId: input.entidadeId ?? null,
      },
    });
  },
};

const canalSmtp: CanalNotificacao = {
  nome: "smtp",
  ativo: () => process.env.NOTIFY_SMTP_ENABLED === "true",
  async enviar() {
    // Adaptador SMTP será implementado na etapa de canais externos.
  },
};

const canalWhatsApp: CanalNotificacao = {
  nome: "whatsapp",
  ativo: () => process.env.NOTIFY_WHATSAPP_ENABLED === "true",
  async enviar() {
    // Adaptador da API oficial do WhatsApp será implementado na etapa de canais externos.
  },
};

const canais: CanalNotificacao[] = [canalInterno, canalSmtp, canalWhatsApp];

export async function notificarUsuario(input: NotificacaoInput, db: Prisma.TransactionClient = prisma) {
  for (const canal of canais) {
    if (canal.ativo()) await canal.enviar(input, db);
  }
}

/** Consultores da prefeitura: vínculo "analista" e o consultor responsável definido pela CIP. */
export async function consultoresDaPrefeitura(municipioId: string, db: Prisma.TransactionClient = prisma) {
  const [vinculos, municipio] = await Promise.all([
    db.vinculoUsuarioMunicipio.findMany({
      where: { municipioId, roleCode: "analista", user: { active: true } },
      select: { userId: true },
    }),
    db.municipio.findUnique({ where: { id: municipioId }, select: { consultorResponsavelId: true } }),
  ]);
  const ids = new Set(vinculos.map((v) => v.userId));
  if (municipio?.consultorResponsavelId) ids.add(municipio.consultorResponsavelId);
  return [...ids];
}

export async function notificarConsultores(
  input: Omit<NotificacaoInput, "userId">,
  excetoUserId?: string,
  db: Prisma.TransactionClient = prisma,
) {
  const ids = await consultoresDaPrefeitura(input.municipioId, db);
  for (const userId of ids) {
    if (userId === excetoUserId) continue;
    await notificarUsuario({ ...input, userId }, db);
  }
}
