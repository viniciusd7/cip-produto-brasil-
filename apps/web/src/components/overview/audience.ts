import type { SecretariaOverview } from "./types";

export type OverviewAudience = "consultoria" | "gabinete" | "consulta";

export function overviewAudience(role?: string | null): OverviewAudience {
  if (role === "analista" || role === "admin") return "consultoria";
  if (role === "prefeito") return "gabinete";
  return "consulta";
}

export function overviewCopy(role?: string | null) {
  const audience = overviewAudience(role);
  if (audience === "consultoria") {
    return {
      audience,
      title: "Acompanhamento da consultoria",
      intro: "Projetos, entregas e pontos que a equipe precisa conferir na prefeitura ativa.",
      emptyProjects: "Cadastre projetos e vincule as secretarias para iniciar o acompanhamento.",
      emptyTasks: "Cadastre projetos e tarefas para iniciar o acompanhamento.",
      emptyGoals: "Cadastre metas estratégicas para acompanhar os resultados.",
      attentionKicker: "Para o acompanhamento",
      attentionTitle: "O que a consultoria precisa verificar",
      recommendationLabel: "Próxima ação sugerida",
      detailDescription: "Indicadores, entraves e ações de acompanhamento por secretaria.",
      agendaTitle: "Na pauta da consultoria",
      decisionsKicker: "Acompanhamento da consultoria",
      decisionsTitle: "O que verificar e encaminhar",
      accountKicker: "Conferência das entregas",
      accountTitle: "O que conferir antes de apresentar resultados",
      accountAction: "Conferir as evidências e os pareceres das entregas.",
      missingData: "Conferir a atualização com a secretaria.",
      secretariaEmpty: "Cadastre a primeira secretaria para iniciar o acompanhamento.",
      secretariaAttention: "Tarefas para acompanhamento",
    } as const;
  }
  if (audience === "gabinete") {
    return {
      audience,
      title: "Visão do gabinete",
      intro: "Situação do governo, prioridades das secretarias e resultados para decisão.",
      emptyProjects: "A carteira ainda não tem projetos cadastrados.",
      emptyTasks: "A carteira ainda não tem projetos e tarefas cadastrados.",
      emptyGoals: "Ainda não há metas estratégicas cadastradas.",
      attentionKicker: "Para a próxima reunião",
      attentionTitle: "O que precisa da atenção do gabinete",
      recommendationLabel: "Ponto para acompanhamento",
      detailDescription: "Indicadores, entraves e prioridades para a reunião de governo.",
      agendaTitle: "Na agenda do gabinete",
      decisionsKicker: "Agenda do gabinete",
      decisionsTitle: "Onde pedir providências",
      accountKicker: "Prestação de contas",
      accountTitle: "Entregas que podem compor a prestação de contas",
      accountAction: "Solicitar a conferência das evidências antes da divulgação.",
      missingData: "Solicitar a atualização da informação.",
      secretariaEmpty: "Ainda não há secretarias cadastradas nesta prefeitura.",
      secretariaAttention: "Pontos para a reunião de governo",
    } as const;
  }
  return {
    audience,
    title: "Visão geral da prefeitura",
    intro: "Dados consolidados dos projetos, secretarias e entregas.",
    emptyProjects: "Ainda não há projetos vinculados às secretarias.",
    emptyTasks: "Ainda não há projetos e tarefas cadastrados.",
    emptyGoals: "Ainda não há metas estratégicas cadastradas.",
    attentionKicker: "Itens em destaque",
    attentionTitle: "O que requer acompanhamento",
    recommendationLabel: "Ponto de atenção",
    detailDescription: "Indicadores e critérios de leitura por secretaria.",
    agendaTitle: "Pontos de atenção",
    decisionsKicker: "Acompanhamento",
    decisionsTitle: "Pontos que requerem providências",
    accountKicker: "Entregas registradas",
    accountTitle: "Resultados e evidências disponíveis",
    accountAction: "Consultar as evidências antes de divulgar resultados.",
    missingData: "A informação precisa ser atualizada.",
    secretariaEmpty: "Ainda não há secretarias cadastradas nesta prefeitura.",
    secretariaAttention: "Tarefas que requerem atenção",
  } as const;
}

export function secretariaRecommendation(p: SecretariaOverview, role?: string | null) {
  const audience = overviewAudience(role);
  if (audience === "consultoria") {
    if (!p.projetos) return "Vincular o primeiro projeto a esta secretaria.";
    if (!p.tarefasTotal) return "Registrar as primeiras tarefas dos projetos.";
    if (p.classificacao === "DADOS_DEFASADOS") return "Conferir as entregas e atualizar a carteira.";
    if (p.criticas) return `Analisar ${p.criticas} ${p.criticas === 1 ? "tarefa crítica" : "tarefas críticas"} com os responsáveis.`;
    if (p.semPrazo) return `Pactuar datas para ${p.semPrazo} ${p.semPrazo === 1 ? "tarefa" : "tarefas"} sem prazo.`;
    if (p.atrasadas) return `Registrar causa e providência para ${p.atrasadas} ${p.atrasadas === 1 ? "tarefa atrasada" : "tarefas atrasadas"}.`;
    return "Manter o acompanhamento e conferir as evidências registradas.";
  }
  if (!p.projetos) return "Solicitar o cadastro dos projetos desta secretaria.";
  if (!p.tarefasTotal) return "Solicitar o registro das entregas dos projetos.";
  if (p.classificacao === "DADOS_DEFASADOS") return "Pedir uma posição atualizada sobre as entregas.";
  if (p.criticas) return `Pedir providências para ${p.criticas} ${p.criticas === 1 ? "tarefa crítica" : "tarefas críticas"}.`;
  if (p.semPrazo) return `Pedir datas para ${p.semPrazo} ${p.semPrazo === 1 ? "tarefa" : "tarefas"} sem prazo.`;
  if (p.atrasadas) return `Pedir causa e prazo de solução para ${p.atrasadas} ${p.atrasadas === 1 ? "tarefa atrasada" : "tarefas atrasadas"}.`;
  return "Acompanhar as próximas entregas registradas.";
}
