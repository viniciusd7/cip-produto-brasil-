/**
 * Estrutura de sugestões para o cadastro do plano de governo.
 * Hoje usa heurística CIP por tema; um provedor LLM pode substituir
 * `provedorAtivo` mantendo o mesmo contrato (o consultor sempre aceita/rejeita).
 */
export type SugestaoIndicador = {
  nome: string;
  unidade: string;
  periodicidade: string;
  polaridade: "MAIOR_MELHOR" | "MENOR_MELHOR";
  fonte: string;
  formula?: string;
};

export type SugestaoTarefa = { descricao: string; diasPrazo: number };

export interface ContextoMeta {
  nome: string;
  descricao?: string | null;
  secretaria?: string | null;
}

export interface SuggestionProvider {
  fonte: string;
  indicadores(meta: ContextoMeta): Promise<SugestaoIndicador[]>;
  tarefas(meta: ContextoMeta): Promise<SugestaoTarefa[]>;
}

type Tema = { chaves: string[]; indicadores: SugestaoIndicador[] };

const TEMAS: Tema[] = [
  {
    chaves: ["saude", "ubs", "atencao basica", "vacina", "hospital", "medic"],
    indicadores: [
      { nome: "Cobertura da Atenção Primária", unidade: "%", periodicidade: "QUADRIMESTRAL", polaridade: "MAIOR_MELHOR", fonte: "e-Gestor AB / SISAB" },
      { nome: "Cobertura vacinal do calendário infantil", unidade: "%", periodicidade: "MENSAL", polaridade: "MAIOR_MELHOR", fonte: "SI-PNI" },
      { nome: "Tempo médio de espera para consulta especializada", unidade: "dias", periodicidade: "MENSAL", polaridade: "MENOR_MELHOR", fonte: "Regulação municipal" },
    ],
  },
  {
    chaves: ["educa", "escola", "creche", "ensino", "alfabetiz", "aluno"],
    indicadores: [
      { nome: "IDEB anos iniciais da rede municipal", unidade: "índice", periodicidade: "BIENAL", polaridade: "MAIOR_MELHOR", fonte: "INEP" },
      { nome: "Taxa de atendimento em creche (0 a 3 anos)", unidade: "%", periodicidade: "ANUAL", polaridade: "MAIOR_MELHOR", fonte: "Censo Escolar" },
      { nome: "Crianças alfabetizadas ao final do 2º ano", unidade: "%", periodicidade: "ANUAL", polaridade: "MAIOR_MELHOR", fonte: "Avaliação municipal / CNCA" },
    ],
  },
  {
    chaves: ["obra", "infraestrutura", "paviment", "estrada", "drenagem", "ilumina", "saneamento"],
    indicadores: [
      { nome: "Extensão de vias pavimentadas", unidade: "km", periodicidade: "TRIMESTRAL", polaridade: "MAIOR_MELHOR", fonte: "Secretaria de Obras" },
      { nome: "Obras concluídas dentro do prazo", unidade: "%", periodicidade: "TRIMESTRAL", polaridade: "MAIOR_MELHOR", fonte: "Carteira de projetos CIP" },
      { nome: "Domicílios com acesso a esgotamento sanitário", unidade: "%", periodicidade: "ANUAL", polaridade: "MAIOR_MELHOR", fonte: "SNIS" },
    ],
  },
  {
    chaves: ["assist", "social", "cras", "vulnerab", "renda", "fome"],
    indicadores: [
      { nome: "Famílias acompanhadas pelo PAIF", unidade: "famílias", periodicidade: "MENSAL", polaridade: "MAIOR_MELHOR", fonte: "RMA / SUAS" },
      { nome: "Cadastro Único atualizado", unidade: "%", periodicidade: "MENSAL", polaridade: "MAIOR_MELHOR", fonte: "CECAD" },
    ],
  },
  {
    chaves: ["seguran", "violenc", "guarda", "transito"],
    indicadores: [
      { nome: "Ocorrências de crimes contra o patrimônio", unidade: "ocorrências", periodicidade: "MENSAL", polaridade: "MENOR_MELHOR", fonte: "SSP estadual" },
      { nome: "Acidentes de trânsito com vítimas", unidade: "acidentes", periodicidade: "MENSAL", polaridade: "MENOR_MELHOR", fonte: "DETRAN / Guarda Municipal" },
    ],
  },
  {
    chaves: ["ambient", "resíduo", "residuo", "lixo", "recicl", "arboriz"],
    indicadores: [
      { nome: "Resíduos destinados à reciclagem", unidade: "%", periodicidade: "MENSAL", polaridade: "MAIOR_MELHOR", fonte: "Secretaria de Meio Ambiente" },
      { nome: "Árvores plantadas", unidade: "unidades", periodicidade: "TRIMESTRAL", polaridade: "MAIOR_MELHOR", fonte: "Secretaria de Meio Ambiente" },
    ],
  },
  {
    chaves: ["finan", "arrecada", "receita", "fiscal", "tribut", "gestao", "gestão"],
    indicadores: [
      { nome: "Receita própria arrecadada", unidade: "R$", periodicidade: "MENSAL", polaridade: "MAIOR_MELHOR", fonte: "SICONFI / Contabilidade" },
      { nome: "Processos digitais concluídos no prazo", unidade: "%", periodicidade: "MENSAL", polaridade: "MAIOR_MELHOR", fonte: "Sistema de protocolo" },
    ],
  },
];

const GENERICOS: SugestaoIndicador[] = [
  { nome: "Entregas da meta concluídas no prazo", unidade: "%", periodicidade: "MENSAL", polaridade: "MAIOR_MELHOR", fonte: "Carteira de projetos CIP", formula: "tarefas concluídas no prazo ÷ tarefas com prazo vencido × 100" },
  { nome: "População beneficiada pela meta", unidade: "pessoas", periodicidade: "TRIMESTRAL", polaridade: "MAIOR_MELHOR", fonte: "Registro da secretaria" },
];

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const provedorHeuristico: SuggestionProvider = {
  fonte: "heuristica-cip",
  async indicadores(meta) {
    const texto = normalizar(`${meta.nome} ${meta.descricao ?? ""} ${meta.secretaria ?? ""}`);
    const temas = TEMAS.filter((t) => t.chaves.some((c) => texto.includes(normalizar(c))));
    const lista = temas.flatMap((t) => t.indicadores);
    return [...lista, ...GENERICOS].slice(0, 5);
  },
  async tarefas(meta) {
    return [
      { descricao: `Levantar diagnóstico e linha de base de "${meta.nome}"`, diasPrazo: 15 },
      { descricao: "Definir equipe responsável e plano de trabalho", diasPrazo: 20 },
      { descricao: "Preparar termo de referência / processo de contratação", diasPrazo: 45 },
      { descricao: "Executar a entrega e registrar evidências (foto, vídeo ou documento)", diasPrazo: 90 },
      { descricao: "Medir o resultado e reportar ao consultor", diasPrazo: 100 },
    ];
  },
};

export const provedorAtivo: SuggestionProvider = provedorHeuristico;
