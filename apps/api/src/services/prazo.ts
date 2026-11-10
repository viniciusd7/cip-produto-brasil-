import { derivarPrazoMarco } from "@cip/shared";

export function prazoStatus(marco: {
  prazoVigente: Date | null;
  concluidoEm: Date | null;
}, dataReferencia?: Date | null) {
  return derivarPrazoMarco({
    prazoVigente: marco.prazoVigente,
    concluidoEm: marco.concluidoEm,
    dataReferencia: dataReferencia ?? undefined,
  });
}
