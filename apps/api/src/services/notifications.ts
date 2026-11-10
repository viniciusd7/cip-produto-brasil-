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

export class ConsoleNotificationPort implements NotificationPort {
  async notifyResponsavelBloqueio(ctx: BloqueioNotifyCtx) {
    console.log(
      `[notify] bloqueio → responsável=${ctx.responsavel || "—"} projeto=${ctx.codigo} label=${ctx.bloqueioLabel}`,
    );
  }

  async notifyBloqueioResolvido(ctx: BloqueioNotifyCtx) {
    console.log(
      `[notify] bloqueio resolvido → responsável=${ctx.responsavel || "—"} projeto=${ctx.codigo}`,
    );
  }
}

export const notifications: NotificationPort = new ConsoleNotificationPort();
