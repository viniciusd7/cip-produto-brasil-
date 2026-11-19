import type { SecretariaOverview } from "./types";

export const secretariaStatuses: Record<string, { label: string; tone: string }> = {
  INTERVENCAO: { label: "Precisa de atenção", tone: "rose" },
  DADOS_DEFASADOS: { label: "Atualização pendente", tone: "lilac" },
  ACOMPANHAMENTO: { label: "Acompanhar de perto", tone: "amber" },
  ROTINA: { label: "Em acompanhamento", tone: "green" },
};
export function share(value: number, total: number) {
  return total ? Math.min(100, Math.max(0, value / total * 100)) : 0;
}
export function secretariaStatus(p: SecretariaOverview) {
  if (!p.projetos) return { label: "Sem projetos", tone: "muted" };
  if (!p.tarefasTotal) return { label: "Sem tarefas", tone: "muted" };
  return secretariaStatuses[p.classificacao] ?? { label: "Em acompanhamento", tone: "blue" };
}
export function secretariaDimensions(p: SecretariaOverview) {
  return [
    { label: "Execução em dia", value: p.tarefasTotal ? share(p.concluidas + p.noPrazo, p.tarefasTotal) : null },
    { label: "Controle dos prazos", value: p.abertas ? 100 - share(p.atrasadas, p.abertas) : null },
    { label: "Prazos definidos", value: p.abertas ? 100 - share(p.semPrazo, p.abertas) : null },
    { label: "Controle da gravidade", value: p.abertas ? Math.min(100, Math.max(0, 100 - p.indicePonderado)) : null },
  ];
}
export function hasSecretariaStatus(p: SecretariaOverview, filter: string) {
  if (!filter) return true;
  if (filter === "SEM_PRAZO") return p.semPrazo > 0;
  if (filter === "SEM_PROJETOS") return !p.projetos;
  if (filter === "SEM_TAREFAS") return !p.tarefasTotal;
  return p.tarefasTotal > 0 && p.classificacao === filter;
}
