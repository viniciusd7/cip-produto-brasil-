/**
 * Snapshot preset CIP — Construção de UBS.
 * Reusa o catálogo QUIZ_P03+ com perguntas específicas de UBS.
 */
import {
  buildCatalogoPerguntas,
  etapasFromGrupos,
} from "../../shared/src/catalog/condicoes-estruturante";
import { ESTRUTURANTE_PADRAO_MODELO_SNAPSHOT } from "./estruturante-modelo-snapshot";

const ubsExtras = [
  {
    codigo: "pad_us",
    texto: "A unidade segue o padrão de UBS / eSF previsto na política municipal?",
    rotulo: "Padrão assistencial (UBS)",
    pergunta: "A unidade segue o padrão de UBS / eSF previsto na política municipal?",
    tipoResposta: "CONDICAO_FECHADA" as const,
    impacto: "CONDICIONAL" as const,
    obrigatoria: false,
    ordem: 800,
    ajuda:
      "Confirme dimensionamento (salas, equipe mínima) com a SMS. Não substitui o projeto técnico.",
    espera: "Aguardando definição do padrão assistencial",
    grupo: "planejamento",
    etapa: 1,
    favoraveis: ["atendida", "nao_se_aplica"],
    metadados: {
      seNao: "Registre por que o padrão UBS não se aplica.",
      sePendente: "Registre a providência junto à SMS.",
    },
  },
  {
    codigo: "equipamentos_ubs",
    texto: "Os equipamentos e mobiliário clínico estão previstos no escopo ou em projeto paralelo?",
    rotulo: "Equipamentos e mobiliário",
    pergunta:
      "Os equipamentos e mobiliário clínico estão previstos no escopo ou em projeto paralelo?",
    tipoResposta: "CONDICAO_FECHADA" as const,
    impacto: "CONDICIONAL" as const,
    obrigatoria: false,
    ordem: 801,
    ajuda:
      "Obra sem equipamentos não inaugura atendimento. Separe aquisição de obra se for o caso.",
    espera: "Aguardando previsão de equipamentos",
    grupo: "operacao",
    etapa: 4,
    favoraveis: ["atendida", "nao_se_aplica"],
  },
  {
    codigo: "vigilancia_sanitaria_ubs",
    texto: "A vigilância sanitária foi consultada sobre exigências para funcionamento?",
    rotulo: "Vigilância sanitária (UBS)",
    pergunta: "A vigilância sanitária foi consultada sobre exigências para funcionamento?",
    tipoResposta: "CONDICAO_FECHADA" as const,
    impacto: "CONDICIONAL" as const,
    obrigatoria: false,
    ordem: 802,
    ajuda: "Alvará sanitário e fluxos de resíduos são típicos de UBS.",
    espera: "Aguardando orientação da vigilância sanitária",
    grupo: "preparacao",
    etapa: 3,
    favoraveis: ["atendida", "nao_se_aplica"],
  },
];

export const UBS_MODELO_SNAPSHOT = {
  codigo: "UBS_CONSTRUCAO",
  nome: "Construção de UBS",
  etapas: etapasFromGrupos(),
  perguntas: [...buildCatalogoPerguntas(), ...ubsExtras],
  estrutura: [
    ...ESTRUTURANTE_PADRAO_MODELO_SNAPSHOT.estrutura,
    {
      codigo: "META_EQUIPAMENTOS_UBS",
      nivel: "META",
      nome: "Equipamentos e funcionamento da UBS",
      indicador: "Itens críticos disponíveis",
      alvo: "1",
      ordem: 9,
    },
    {
      codigo: "TAR_LISTA_EQUIPAMENTOS",
      nivel: "TAREFA",
      parentCodigo: "META_EQUIPAMENTOS_UBS",
      nome: "Definir lista de equipamentos e mobiliário clínico",
      ordem: 1,
    },
    {
      codigo: "TAR_ALVARA_SANITARIO",
      nivel: "TAREFA",
      parentCodigo: "META_EQUIPAMENTOS_UBS",
      nome: "Obter alvará sanitário e condições de funcionamento",
      ordem: 2,
    },
  ],
};
