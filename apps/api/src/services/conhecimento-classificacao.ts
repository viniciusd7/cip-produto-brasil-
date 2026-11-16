type AutomaticKnowledgeType = "PPA" | "LDO" | "LOA" | "DIAGNOSTICO" | "OUTRO";

const TITLE_RULES = [
  ["PPA", String.raw`plano plurianual`, "ppa"],
  ["LDO", String.raw`lei de diretrizes orcamentarias`, "ldo"],
  ["LOA", String.raw`lei orcamentaria anual`, "loa"],
  ["DIAGNOSTICO", String.raw`diagnostico (?:municipal|situacional|socioeconomico|territorial|da gestao municipal)`, ""],
] as const;

const YEAR_SUFFIX = String.raw`(?:exercicio(?: financeiro)?(?: de)?\s+)?20\d{2}(?:\s*[-/a]\s*20\d{2})?`;

const rules = TITLE_RULES.map(([tipo, title, acronym]) => {
  const qualifier = acronym
    ? String.raw`(?:\(${acronym}\)|\b${acronym}\b|${YEAR_SUFFIX})`
    : YEAR_SUFFIX;
  const suffix = String.raw`(?:\s*[-:\u2013\u2014/]?\s*${qualifier})*[.:]?$`;
  return { tipo, pattern: new RegExp(`^(?:${title})${suffix}`) };
});

// Only complete opening titles count: mentions and acronyms are not evidence.
export function classifyKnowledgeText(text: string): AutomaticKnowledgeType {
  const lines = text
    .slice(0, 2_000)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[\r\n]+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 20);

  if (lines.some((line) =>
    /^(?:plano|programa|proposta) de governo\b/.test(line) ||
    /^(?:sumario|indice|referencias(?: bibliograficas)?|bibliografia)[.:]?$/.test(line),
  )) {
    return "OUTRO";
  }

  const matches = rules.filter(({ pattern }) =>
    lines.some((line) => pattern.test(line)),
  );
  return matches.length === 1 ? matches[0].tipo : "OUTRO";
}
