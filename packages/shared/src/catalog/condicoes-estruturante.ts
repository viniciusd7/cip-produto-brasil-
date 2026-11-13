/**
 * Catálogo QUIZ_P03+ — condições de viabilidade de projeto estruturante.
 * Base: Produto cip (labels.ts) + profundidade legal do snapshot CIP.
 */
import { condicaoBloqueia, type CampoFollowUp } from "../condicao-resposta";
import { PERGUNTAS_IMPEDIMENTOS_COMUNS } from "./impedimentos-comuns";
import type {
  EfeitoPergunta,
  ModeloPerguntaDef,
  ModeloSnapshot,
} from "../wizard-engine";

export const GRUPOS_CONDICOES = [
  {
    id: "preparacao",
    nome: "O que falta para começar",
    ajuda: "Responda sobre imóvel, projeto técnico, licenças e contratação.",
    ordem: 1,
  },
  {
    id: "operacao",
    nome: "Após a entrega",
    ajuda: "Informe como a entrega será mantida em funcionamento.",
    ordem: 2,
  },
] as const;

export type GrupoCondicaoId =
  | (typeof GRUPOS_CONDICOES)[number]["id"]
  | "planejamento"
  | "recursos";

export type TemaCondicao = {
  codigo: string;
  grupo: GrupoCondicaoId;
  rotulo: string;
  pergunta: string;
  ajuda: string;
  espera: string;
  impacto?: ModeloPerguntaDef["impacto"];
  obrigatoria?: boolean;
  efeitos?: EfeitoPergunta[];
  dependeDeCodigo?: string;
  dependeDeValor?: ModeloPerguntaDef["dependeDeValor"];
  /** SELECAO auxiliar (ex.: fonte, situação do imóvel). */
  tipoResposta?: ModeloPerguntaDef["tipoResposta"];
  opcoes?: string[];
  favoraveis?: string[];
  /** Triagem de urgência (sem grupo de checklist). */
  triagem?: boolean;
  camposFollowUp?: CampoFollowUp[];
};

function seNao(rotulo: string) {
  return `Registre por que «${rotulo.toLowerCase()}» não se aplica a este projeto.`;
}
function sePendente(rotulo: string) {
  return `Registre a providência e quem acompanha: ${rotulo.toLowerCase()}. O projeto pode ser cadastrado com essa pendência.`;
}

/** 14 temas P03 originais. */
export const QUIZ_P03_BASE: TemaCondicao[] = [
  {
    codigo: "necessidade_resultado",
    grupo: "planejamento",
    rotulo: "Necessidade e resultado",
    pergunta: "O problema e a entrega esperada estão definidos?",
    ajuda:
      "Identifique quem será beneficiado, o local e o que mudará. Ex.: ampliar vagas escolares em um bairro, com uma escola de capacidade definida.",
    espera: "Aguardando definição da entrega",
    impacto: "BLOQUEANTE",
    obrigatoria: true,
  },
  {
    codigo: "viabilidade",
    grupo: "planejamento",
    rotulo: "Viabilidade da solução",
    pergunta: "As alternativas e a viabilidade foram avaliadas?",
    ajuda:
      "Compare as soluções possíveis e seus custos, benefícios, riscos e prazo. O nível de estudo deve acompanhar a complexidade do projeto.",
    espera: "Aguardando estudo de viabilidade",
    impacto: "CONDICIONAL",
  },
  {
    codigo: "orcamento_recursos",
    grupo: "recursos",
    rotulo: "Verba / dotação",
    pergunta: "O projeto possui previsão ou dotação de verba conferida pela área financeira?",
    ajuda:
      "Informe o valor e a fonte. Estimativa ou promessa não comprovam dotação; dotação não garante caixa.",
    espera: "Aguardando verba",
    impacto: "BLOQUEANTE",
    camposFollowUp: [
      {
        chave: "valor_verba",
        label: "Valor da verba / dotação (R$)",
        tipo: "moeda",
        placeholder: "Ex.: 1500000",
        obrigatorioQuando: ["pendente", "atendida"],
      },
      {
        chave: "fonte_confirmada",
        label: "Fonte confirmada",
        tipo: "texto",
        placeholder: "Ex.: recurso próprio, emenda, convênio federal",
      },
    ],
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        ciclo: "AGUARDANDO_PRE_REQUISITO",
        rotuloBloqueio: "Aguardando verba",
        alertaResponsavel: true,
        incluirEstrutura: ["TAR_OBTER_DOTACAO"],
      },
    ],
  },
  {
    codigo: "disponibilidade_financeira",
    grupo: "recursos",
    rotulo: "Disponibilidade financeira",
    pergunta: "Há caixa ou empenho disponível para a próxima etapa deste projeto?",
    ajuda: "Separe previsão de repasse, recurso disponível e despesa já paga.",
    espera: "Aguardando disponibilidade financeira",
    impacto: "CONDICIONAL",
    camposFollowUp: [
      {
        chave: "valor_disponivel",
        label: "Valor disponível (R$)",
        tipo: "moeda",
        placeholder: "Ex.: 200000",
      },
      {
        chave: "documento_ref",
        label: "Documento / empenho de referência",
        tipo: "texto",
        placeholder: "Nº do empenho, ofício ou despacho",
      },
    ],
  },
  {
    codigo: "convenios_repasses",
    grupo: "recursos",
    rotulo: "Convênios e repasses",
    pergunta: "Este projeto depende de convênio, transferência ou contrapartida de outro ente?",
    ajuda: "Registre o instrumento (Transferegov) e o valor. Recurso anunciado pode ainda depender de formalização.",
    espera: "Aguardando convênio ou repasse",
    impacto: "CONDICIONAL",
    camposFollowUp: [
      {
        chave: "instrumento",
        label: "Nº / nome do instrumento",
        tipo: "texto",
        placeholder: "Nº do convênio ou proposta Transferegov",
      },
      {
        chave: "valor_repasse",
        label: "Valor do repasse (R$)",
        tipo: "moeda",
      },
    ],
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_FORMALIZAR_REPASSE"],
      },
    ],
  },
  {
    codigo: "necessidade_pl",
    grupo: "preparacao",
    rotulo: "Lei ou autorização",
    pergunta: "É necessário projeto de lei ou outro ato de autorização?",
    ajuda:
      "Peça a avaliação da área competente. Registre o ato necessário e seu andamento; uma proposta enviada não equivale a um ato aprovado.",
    espera: "Aguardando PL",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_LEI_AUTORIZATIVA"],
      },
    ],
  },
  {
    codigo: "desapropriacao_imovel",
    grupo: "preparacao",
    rotulo: "Terreno ou imóvel",
    pergunta:
      "Esta entrega exige terreno ou imóvel (aquisição, regularização ou desapropriação)?",
    ajuda:
      "Para obra/instalação física, registre endereço ou matrícula e valor estimado. Serviços sem instalação podem marcar não se aplica.",
    espera: "Aguardando imóvel",
    impacto: "CONDICIONAL",
    camposFollowUp: [
      {
        chave: "endereco_ou_matricula",
        label: "Endereço ou matrícula",
        tipo: "texto",
        placeholder: "Ex.: Rua X, Bairro Y / matrícula 12345",
        obrigatorioQuando: ["pendente", "atendida"],
      },
      {
        chave: "valor_estimado",
        label: "Valor estimado (R$)",
        tipo: "moeda",
        placeholder: "Aquisição ou indenização estimada",
      },
    ],
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        ciclo: "AGUARDANDO_PRE_REQUISITO",
        rotuloBloqueio: "Aguardando imóvel",
        incluirEstrutura: [
          "META_TERRENO",
          "TAR_IDENTIFICAR_AREA",
          "TAR_REGULARIZACAO",
        ],
      },
    ],
  },
  {
    codigo: "projeto_tecnico",
    grupo: "preparacao",
    rotulo: "Estudos e projeto técnico",
    pergunta: "São necessários estudos, projetos ou especificações técnicas?",
    ajuda:
      "Pode ser um projeto de engenharia, desenho do serviço ou especificação de um sistema. Identifique a versão e a área que avaliou a documentação.",
    espera: "Aguardando projeto técnico",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: [
          "META_PROJETO",
          "TAR_CONTRATAR_PROJETO",
          "TAR_ELABORAR_PROJETO",
          "TAR_APROVAR_PROJETO",
        ],
      },
    ],
  },
  {
    codigo: "licencas_autorizacoes",
    grupo: "preparacao",
    rotulo: "Licenças e autorizações",
    pergunta: "Há licenças ou autorizações a obter para este projeto?",
    ajuda:
      "Liste quais: ambiental, vigilância sanitária, patrimônio, bombeiros etc. A área técnica confirma o que é exigível.",
    espera: "Aguardando licenças",
    impacto: "CONDICIONAL",
    camposFollowUp: [
      {
        chave: "quais_licencas",
        label: "Quais licenças / autorizações?",
        tipo: "textarea",
        placeholder: "Ex.: licença ambiental prévia; alvará sanitário; AVCB",
        obrigatorioQuando: ["pendente", "atendida"],
      },
    ],
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: [
          "META_LICENCA",
          "TAR_CARACTERIZAR",
          "TAR_PROTOCOLAR_LICENCA",
          "TAR_ACOMPANHAR_LICENCA",
        ],
      },
    ],
  },
  {
    codigo: "licitacao_contratacao",
    grupo: "preparacao",
    rotulo: "Compras e contratação",
    pergunta: "Será necessário licitar ou contratar para este projeto?",
    ajuda:
      "Informe o objeto e a modalidade pretendida. O cadastro não autoriza a contratação.",
    espera: "Aguardando licitação",
    impacto: "CONDICIONAL",
    camposFollowUp: [
      {
        chave: "objeto_contratacao",
        label: "Objeto da contratação",
        tipo: "texto",
        placeholder: "Ex.: construção da escola; aquisição de equipamentos",
      },
      {
        chave: "modalidade_pretendida",
        label: "Modalidade pretendida",
        tipo: "texto",
        placeholder: "Pregão, concorrência, dispensa…",
      },
    ],
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar", "atendida"] },
        incluirEstrutura: ["META_CONTRATACAO"],
      },
    ],
  },
  {
    codigo: "equipe_execucao",
    grupo: "operacao",
    rotulo: "Equipe e acompanhamento",
    pergunta: "Há equipe definida para executar e acompanhar as entregas?",
    ajuda:
      "Identifique os responsáveis por cada entrega e pelo acompanhamento. Ser responsável pelo cadastro não atribui competência técnica ou fiscalização automaticamente.",
    espera: "Aguardando definição da equipe",
    impacto: "CONDICIONAL",
  },
  {
    codigo: "acessibilidade_atendimento",
    grupo: "operacao",
    rotulo: "Acesso da população",
    pergunta: "As necessidades de acessibilidade e atendimento foram avaliadas?",
    ajuda:
      "Considere acesso físico, canais digitais, comunicação e atendimento às pessoas beneficiadas, de acordo com o serviço.",
    espera: "Aguardando avaliação de acessibilidade",
    impacto: "CONDICIONAL",
  },
  {
    codigo: "operacao_manutencao",
    grupo: "operacao",
    rotulo: "Funcionamento após a entrega",
    pergunta: "Está definido como o serviço será mantido depois da entrega?",
    ajuda:
      "Uma escola precisa de equipe, equipamentos e manutenção além da obra. Um sistema precisa de suporte. Identifique quem assumirá a operação e seus custos recorrentes.",
    espera: "Aguardando plano de operação",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_CUSTEIO"],
      },
    ],
  },
  {
    codigo: "comprovacao_resultados",
    grupo: "operacao",
    rotulo: "Comprovação da entrega",
    pergunta: "Está definido como a entrega será comprovada e avaliada?",
    ajuda:
      "Defina documentos, fotos, medições ou registros de atendimento. Quando houver indicador, esclareça unidade, meta e fonte. Foto anexada não é validação automática.",
    espera: "Aguardando critérios de entrega",
    impacto: "CONDICIONAL",
  },
];

/** Enriquecimento além do P03 (profundidade legal CIP). */
export const QUIZ_P03_EXTRA: TemaCondicao[] = [
  // Planejamento
  {
    codigo: "escopo_fronteira",
    grupo: "planejamento",
    rotulo: "Escopo e fronteiras",
    pergunta: "O que fica dentro e fora deste projeto está registrado?",
    ajuda:
      "Liste entregas incluídas e o que será tratado em outra iniciativa (ex.: contratação de pessoal após a obra).",
    espera: "Aguardando definição de escopo",
    impacto: "CONDICIONAL",
  },
  {
    codigo: "beneficiarios",
    grupo: "planejamento",
    rotulo: "Público beneficiado",
    pergunta: "O público beneficiado está estimado e localizado?",
    ajuda:
      "Informe ordem de grandeza e território (bairro, escola, UBS). Ajuda a priorizar e a prestar contas.",
    espera: "Aguardando definição de beneficiários",
    impacto: "INFORMATIVA",
  },
  {
    codigo: "controle_social",
    grupo: "planejamento",
    rotulo: "Controle e participação",
    pergunta: "O projeto foi (ou será) apresentado ao conselho municipal da área?",
    ajuda:
      "Em políticas com conselho obrigatório (saúde, assistência, educação), registre a deliberação ou a agenda.",
    espera: "Aguardando deliberação do conselho",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_CONSELHO"],
      },
    ],
  },
  // Recursos
  {
    codigo: "ppa_previsto",
    grupo: "recursos",
    rotulo: "Previsão no PPA",
    pergunta: "O investimento está previsto no PPA vigente (ou será incluído)?",
    ajuda:
      "CF, art. 167, §1º: investimentos plurianuais devem constar no PPA. Sem previsão, há risco de irregularidade.",
    espera: "Aguardando inclusão no PPA",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_INCLUIR_PPA"],
      },
    ],
  },
  {
    codigo: "dotacao_loa",
    grupo: "recursos",
    rotulo: "Dotação na LOA",
    pergunta: "Há dotação orçamentária na LOA do exercício (ou crédito adicional)?",
    ajuda:
      "Dotação autoriza despesa; não garante caixa. Separe de disponibilidade financeira.",
    espera: "Aguardando dotação na LOA",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_OBTER_DOTACAO"],
      },
    ],
  },
  {
    codigo: "cauc_regular",
    grupo: "recursos",
    rotulo: "CAUC e conformidade",
    pergunta: "O município está regular no CAUC para transferências voluntárias?",
    ajuda:
      "Irregularidade no CAUC impede novos convênios federais até a regularização.",
    espera: "Aguardando regularização no CAUC",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_REGULARIZAR_CAUC"],
      },
    ],
  },
  {
    codigo: "modalidade_recurso",
    grupo: "recursos",
    rotulo: "Fonte e natureza",
    pergunta: "Qual é a fonte principal do recurso?",
    ajuda: "Próprio, federal, estadual, emenda ou operação de crédito mudam o rito.",
    espera: "Aguardando definição da fonte",
    impacto: "INFORMATIVA",
    tipoResposta: "SELECAO",
    opcoes: [
      "Recurso próprio",
      "Transferência federal",
      "Transferência estadual",
      "Emenda parlamentar",
      "Operação de crédito",
      "A definir",
    ],
  },
  {
    codigo: "contrapartida",
    grupo: "recursos",
    rotulo: "Contrapartida municipal",
    pergunta: "Há contrapartida municipal exigida e provisionada?",
    ajuda:
      "Convênios costumam exigir contrapartida. Sem provisionamento, o repasse pode travar.",
    espera: "Aguardando contrapartida",
    impacto: "CONDICIONAL",
    dependeDeCodigo: "convenios_repasses",
    dependeDeValor: { in: ["pendente", "atendida", "a_avaliar"] },
  },
  // Preparação
  {
    codigo: "situacao_imovel",
    grupo: "preparacao",
    rotulo: "Situação do imóvel",
    pergunta: "Qual é a situação atual do terreno ou imóvel?",
    ajuda:
      "Sem domínio claro, a licitação de obra é insegura. Desapropriação segue o Decreto-Lei 3.365/1941.",
    espera: "Aguardando definição da situação do imóvel",
    impacto: "CONDICIONAL",
    tipoResposta: "SELECAO",
    opcoes: [
      "Não se aplica (sem imóvel)",
      "Área pública disponível",
      "Imóvel do município a regularizar",
      "Imóvel particular a adquirir",
      "Imóvel particular a desapropriar",
      "Ainda não identificada",
    ],
    favoraveis: ["Não se aplica (sem imóvel)", "Área pública disponível"],
    efeitos: [
      {
        quando: { eq: "Imóvel particular a desapropriar" },
        ciclo: "AGUARDANDO_PRE_REQUISITO",
        rotuloBloqueio: "Aguardando desapropriação do imóvel",
        incluirEstrutura: [
          "META_DESAPROPRIACAO",
          "TAR_DUP",
          "TAR_AVALIACAO",
          "TAR_OFERTA",
          "TAR_IMISSAO_POSSE",
        ],
      },
      {
        quando: { eq: "Imóvel do município a regularizar" },
        incluirEstrutura: ["TAR_REGULARIZACAO"],
      },
      {
        quando: { eq: "Ainda não identificada" },
        incluirEstrutura: ["TAR_IDENTIFICAR_AREA"],
      },
    ],
  },
  {
    codigo: "desapropriacao_estagio",
    grupo: "preparacao",
    rotulo: "Desapropriação",
    pergunta: "Em que estágio está o processo de desapropriação?",
    ajuda:
      "Sequência típica: decreto de utilidade pública → avaliação → oferta → imissão na posse.",
    espera: "Aguardando andamento da desapropriação",
    impacto: "CONDICIONAL",
    tipoResposta: "SELECAO",
    opcoes: [
      "Não se aplica",
      "Não iniciada",
      "DUP publicado",
      "Avaliação concluída",
      "Oferta em curso",
      "Imissão / posse",
      "Concluída",
    ],
    favoraveis: ["Não se aplica", "Concluída", "Imissão / posse"],
    dependeDeCodigo: "situacao_imovel",
    dependeDeValor: { eq: "Imóvel particular a desapropriar" },
    efeitos: [
      {
        quando: { in: ["Não iniciada", "DUP publicado", "Avaliação concluída", "Oferta em curso"] },
        ciclo: "AGUARDANDO_PRE_REQUISITO",
        rotuloBloqueio: "Aguardando desapropriação do imóvel",
        incluirEstrutura: [
          "META_DESAPROPRIACAO",
          "TAR_DUP",
          "TAR_AVALIACAO",
          "TAR_OFERTA",
          "TAR_IMISSAO_POSSE",
        ],
      },
    ],
  },
  {
    codigo: "lei_autorizativa",
    grupo: "preparacao",
    rotulo: "Lei ou decreto autorizativo",
    pergunta: "A aquisição ou desapropriação exige autorização legislativa?",
    ajuda:
      "Consulte a LOOM e a Procuradoria. Autorização pendente na Câmara trava o processo.",
    espera: "Aguardando autorização legislativa",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_LEI_AUTORIZATIVA"],
      },
    ],
  },
  {
    codigo: "projeto_basico_executivo",
    grupo: "preparacao",
    rotulo: "Projeto básico/executivo",
    pergunta: "Existe projeto básico (e, se exigido, executivo) aprovado?",
    ajuda:
      "Lei 14.133/2021, art. 6º, XXV: projeto básico é elemento da contratação de obra.",
    espera: "Aguardando projeto básico",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: [
          "META_PROJETO",
          "TAR_CONTRATAR_PROJETO",
          "TAR_ELABORAR_PROJETO",
          "TAR_APROVAR_PROJETO",
        ],
      },
    ],
  },
  {
    codigo: "licenca_ambiental",
    grupo: "preparacao",
    rotulo: "Licenciamento ambiental",
    pergunta: "Qual é a situação do licenciamento ambiental deste projeto?",
    ajuda:
      "Órgão competente pela LC 140/2011. Informe órgão e protocolo quando houver processo.",
    espera: "Aguardando licença ambiental",
    impacto: "CONDICIONAL",
    tipoResposta: "SELECAO",
    opcoes: ["Não necessária", "Obtida", "Em andamento", "Não iniciada"],
    favoraveis: ["Não necessária", "Obtida"],
    camposFollowUp: [
      {
        chave: "orgao_numero",
        label: "Órgão e nº / protocolo",
        tipo: "texto",
        placeholder: "Ex.: SUPRAM · processo 123/2026",
      },
    ],
    efeitos: [
      {
        quando: { in: ["Em andamento", "Não iniciada"] },
        incluirEstrutura: [
          "META_LICENCA",
          "TAR_CARACTERIZAR",
          "TAR_PROTOCOLAR_LICENCA",
          "TAR_ACOMPANHAR_LICENCA",
        ],
      },
    ],
  },
  {
    codigo: "vigilancia_patrimonio",
    grupo: "preparacao",
    rotulo: "Vigilância / patrimônio / bombeiros",
    pergunta:
      "Há outras autorizações (vigilância sanitária, patrimônio, corpo de bombeiros)?",
    ajuda:
      "A área técnica indica o que é exigível conforme o objeto (UBS, escola, reforma de bem tombado, etc.).",
    espera: "Aguardando autorizações complementares",
    impacto: "CONDICIONAL",
  },
  {
    codigo: "etp_tr",
    grupo: "preparacao",
    rotulo: "Estudo técnico preliminar",
    pergunta: "O ETP e o termo de referência estão aprovados?",
    ajuda:
      "Lei 14.133/2021, art. 18: a fase preparatória começa pelo estudo técnico preliminar.",
    espera: "Aguardando ETP/TR",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_ETP"],
      },
    ],
  },
  {
    codigo: "pca_planejamento",
    grupo: "preparacao",
    rotulo: "PCA e planejamento de compras",
    pergunta: "A contratação está no Plano de Contratações Anual (PCA)?",
    ajuda: "Lei 14.133/2021, art. 12, VII: a contratação deve constar no PCA.",
    espera: "Aguardando inclusão no PCA",
    impacto: "BLOQUEANTE",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        ciclo: "AGUARDANDO_PRE_REQUISITO",
        rotuloBloqueio: "Aguardando inclusão no PCA",
        incluirEstrutura: ["TAR_PCA"],
      },
    ],
  },
  {
    codigo: "orcamento_estimado",
    grupo: "preparacao",
    rotulo: "Orçamento estimado",
    pergunta: "O orçamento estimado está elaborado?",
    ajuda: "Estimativa com base em SINAPI ou SICRO, por item (Lei 14.133/2021, art. 23).",
    espera: "Aguardando orçamento estimado",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_ORCAMENTO"],
      },
    ],
  },
  {
    codigo: "modalidade_licitacao",
    grupo: "preparacao",
    rotulo: "Modalidade e rito",
    pergunta: "Qual é a modalidade pretendida?",
    ajuda:
      "Obra de engenharia costuma seguir concorrência ou pregão eletrônico. Contratação direta exige justificativa formal.",
    espera: "Aguardando definição da modalidade",
    impacto: "INFORMATIVA",
    tipoResposta: "SELECAO",
    opcoes: [
      "Pregão",
      "Concorrência",
      "Diálogo competitivo",
      "Contratação direta (dispensa ou inexigibilidade)",
      "Ata de registro de preços ou adesão",
      "A definir",
    ],
  },
  {
    codigo: "parecer_juridico_proc",
    grupo: "preparacao",
    rotulo: "Análise jurídica",
    pergunta: "A minuta do edital e do contrato foi analisada pela Procuradoria?",
    ajuda:
      "Lei 14.133/2021, art. 53: ao final da fase preparatória, o processo segue para a assessoria jurídica.",
    espera: "Aguardando parecer jurídico",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_PARECER_JURIDICO"],
      },
    ],
  },
  {
    codigo: "publicacao_julgamento",
    grupo: "preparacao",
    rotulo: "Publicação e julgamento",
    pergunta: "O edital foi publicado e o julgamento/homologação concluídos?",
    ajuda:
      "Após a fase preparatória: publicar, julgar propostas, homologar e assinar o contrato.",
    espera: "Aguardando publicação/julgamento",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_PUBLICAR_JULGAR", "TAR_ASSINAR_CONTRATO"],
      },
    ],
  },
  // Operação
  {
    codigo: "fiscal_contrato",
    grupo: "operacao",
    rotulo: "Fiscal de contrato",
    pergunta: "Há fiscal de contrato designado?",
    ajuda:
      "Lei 14.133/2021, art. 117: a execução é acompanhada por fiscal especialmente designado.",
    espera: "Aguardando designação de fiscal",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_FISCAL"],
      },
    ],
  },
  {
    codigo: "contrato_assinado",
    grupo: "operacao",
    rotulo: "Contrato formalizado",
    pergunta: "O contrato está assinado e o extrato publicado?",
    ajuda: "Sem contrato formal, medições e pagamentos não têm base segura.",
    espera: "Aguardando assinatura do contrato",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_ASSINAR_CONTRATO"],
      },
    ],
  },
  {
    codigo: "medicao_pagamento",
    grupo: "operacao",
    rotulo: "Medições e pagamentos",
    pergunta: "O fluxo de medições e pagamentos está definido?",
    ajuda:
      "Defina periodicidade, responsáveis e documentos de medição físico-financeira.",
    espera: "Aguardando rotina de medições",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_MEDICOES"],
      },
    ],
  },
  {
    codigo: "custeio_pos_entrega",
    grupo: "operacao",
    rotulo: "Custeio pós-entrega",
    pergunta: "Há previsão de custeio após a entrega (equipe, energia, manutenção)?",
    ajuda:
      "Sem custeio, a entrega não opera. Despesa continuada exige estimativa de impacto (LC 101/2000, art. 17).",
    espera: "Aguardando custeio pós-entrega",
    impacto: "CONDICIONAL",
    efeitos: [
      {
        quando: { in: ["pendente", "a_avaliar"] },
        incluirEstrutura: ["TAR_CUSTEIO"],
      },
    ],
  },
];

/** Triagem de urgência (antes da prévia). */
export const TRIAGEM_ESTRUTURANTE: TemaCondicao[] = [
  {
    codigo: "risco_pessoas",
    grupo: "planejamento",
    rotulo: "Risco a pessoas ou serviço",
    pergunta:
      "Há risco imediato à segurança de pessoas ou interrupção de serviço essencial?",
    ajuda:
      "Ex.: estrutura com risco de desabamento, unidade interditada, escola ou UBS sem funcionamento.",
    espera: "Prioridade crítica por risco",
    impacto: "CONDICIONAL",
    triagem: true,
    efeitos: [
      {
        quando: { eq: "pendente" },
        elevaPrioridade: "CRITICA",
        motivoPrioridade: "Risco imediato à segurança ou serviço essencial parado",
      },
      {
        quando: { eq: "atendida" },
        elevaPrioridade: "CRITICA",
        motivoPrioridade: "Risco imediato à segurança ou serviço essencial parado",
      },
    ],
  },
  {
    codigo: "prazo_critico",
    grupo: "planejamento",
    rotulo: "Prazo crítico",
    pergunta:
      "Há prazo legal, contratual ou de vigência de recurso que vence em até 6 meses?",
    ajuda:
      "Ex.: vigência de convênio, prazo de empenho ou de restos a pagar, prazo de prestação de contas.",
    espera: "Prazo crítico em até 6 meses",
    impacto: "CONDICIONAL",
    triagem: true,
    efeitos: [
      {
        quando: { in: ["pendente", "atendida", "a_avaliar"] },
        elevaPrioridade: "ALTA",
        motivoPrioridade: "Prazo crítico em até 6 meses",
      },
    ],
  },
  {
    codigo: "janela_eleitoral",
    grupo: "planejamento",
    rotulo: "Janela eleitoral",
    pergunta:
      "A assinatura do repasse ou a inauguração cairia nos 3 meses antes de uma eleição?",
    ajuda:
      "Lei 9.504/1997: transferências voluntárias são vedadas nos 3 meses antes do pleito; ajuste o cronograma.",
    espera: "Risco de janela eleitoral",
    impacto: "CONDICIONAL",
    triagem: true,
    efeitos: [
      {
        quando: { in: ["pendente", "atendida", "a_avaliar"] },
        elevaPrioridade: "ALTA",
        motivoPrioridade: "Janela eleitoral: risco de vedação ou de perda do repasse",
      },
    ],
  },
];

export const QUIZ_P03_ENRIQUECIDO: TemaCondicao[] = [
  ...QUIZ_P03_BASE,
  ...QUIZ_P03_EXTRA,
];

export const QUIZ_P03 = QUIZ_P03_ENRIQUECIDO.map((item) => ({
  ...item,
  seNao: seNao(item.rotulo),
  sePendente: sePendente(item.rotulo),
}));

function temaToPergunta(tema: TemaCondicao, ordem: number): ModeloPerguntaDef {
  const grupoMeta = GRUPOS_CONDICOES.find((g) => g.id === tema.grupo);
  const isSelecao = tema.tipoResposta === "SELECAO";
  return {
    codigo: tema.codigo,
    texto: tema.pergunta,
    rotulo: tema.rotulo,
    pergunta: tema.pergunta,
    tipoResposta: isSelecao ? "SELECAO" : "CONDICAO_FECHADA",
    impacto: tema.impacto ?? "CONDICIONAL",
    obrigatoria: tema.obrigatoria ?? false,
    ordem,
    ajuda: tema.ajuda,
    espera: tema.espera,
    grupo: tema.grupo,
    dependeDeCodigo: tema.dependeDeCodigo,
    dependeDeValor: tema.dependeDeValor,
    opcoes: tema.opcoes,
    efeitos: tema.efeitos,
    etapa: tema.triagem ? null : grupoMeta?.ordem ?? null,
    favoraveis: isSelecao
      ? tema.favoraveis ?? null
      : ["atendida", "nao_se_aplica"],
    metadados: {
      seNao: seNao(tema.rotulo),
      sePendente: sePendente(tema.rotulo),
    },
    camposFollowUp: tema.camposFollowUp ?? null,
  };
}

/** Perguntas do catálogo (checklist + triagem) prontas para o snapshot. */
export function buildCatalogoPerguntas(): ModeloPerguntaDef[] {
  const checklist: ModeloPerguntaDef[] = [
    {
      codigo: "situacao_imovel", texto: "O projeto precisa de terreno, aquisição ou desapropriação?",
      rotulo: "Imóvel e desapropriação", pergunta: "O projeto precisa de terreno, aquisição ou desapropriação?",
      ajuda: "Marque a situação atual do local da entrega. Serviços sem imóvel próprio podem escolher 'Não precisa'.",
      tipoResposta: "SELECAO", impacto: "CONDICIONAL", obrigatoria: true,
      ordem: 1, grupo: "preparacao", etapa: 1,
      opcoes: ["Não precisa de imóvel", "Imóvel público disponível", "Precisa identificar uma área", "Precisa regularizar imóvel público", "Precisa adquirir imóvel", "Precisa desapropriar imóvel", "Desapropriação em andamento", "Posse já liberada"],
      favoraveis: ["Não precisa de imóvel", "Imóvel público disponível", "Posse já liberada"],
      opcoesComDetalhes: ["Imóvel público disponível", "Precisa regularizar imóvel público", "Precisa adquirir imóvel", "Precisa desapropriar imóvel", "Desapropriação em andamento", "Posse já liberada"],
      camposFollowUp: [{ chave: "endereco_ou_matricula", label: "Endereço ou matrícula, se conhecido", tipo: "texto" }],
      efeitos: [
        { quando: { eq: "Precisa identificar uma área" }, ciclo: "AGUARDANDO_PRE_REQUISITO", rotuloBloqueio: "Aguardando definição do imóvel", incluirEstrutura: ["TAR_IDENTIFICAR_AREA"] },
        { quando: { eq: "Precisa regularizar imóvel público" }, ciclo: "AGUARDANDO_PRE_REQUISITO", rotuloBloqueio: "Aguardando regularização do imóvel", incluirEstrutura: ["TAR_REGULARIZACAO"] },
        { quando: { eq: "Precisa adquirir imóvel" }, ciclo: "AGUARDANDO_PRE_REQUISITO", rotuloBloqueio: "Aguardando aquisição do imóvel", incluirEstrutura: ["TAR_IDENTIFICAR_AREA", "TAR_REGULARIZACAO"] },
        { quando: { in: ["Precisa desapropriar imóvel", "Desapropriação em andamento"] }, ciclo: "AGUARDANDO_PRE_REQUISITO", rotuloBloqueio: "Aguardando desapropriação", incluirEstrutura: ["TAR_DUP", "TAR_AVALIACAO", "TAR_OFERTA", "TAR_IMISSAO_POSSE"] },
      ],
    },
    {
      codigo: "projeto_basico_executivo", texto: "O projeto técnico ou a especificação da entrega já está pronto?",
      rotulo: "Projeto técnico", pergunta: "O projeto técnico ou a especificação da entrega já está pronto?",
      ajuda: "Para obra, considere projeto básico. Para serviço ou sistema, considere a especificação necessária para executar.",
      tipoResposta: "SELECAO", impacto: "CONDICIONAL", obrigatoria: true,
      ordem: 2, grupo: "preparacao", etapa: 1,
      opcoes: ["Não precisa", "Sim, aprovado", "Em elaboração", "Ainda não iniciado", "A confirmar com a área técnica"],
      favoraveis: ["Não precisa", "Sim, aprovado"],
      efeitos: [{ quando: { in: ["Em elaboração", "Ainda não iniciado", "A confirmar com a área técnica"] }, incluirEstrutura: ["TAR_ELABORAR_PROJETO", "TAR_APROVAR_PROJETO"] }],
    },
    {
      codigo: "licencas_autorizacoes", texto: "O projeto precisa de licença ou autorização para começar?",
      rotulo: "Licenças e autorizações", pergunta: "O projeto precisa de licença ou autorização para começar?",
      ajuda: "Ex.: licença ambiental, vigilância sanitária, bombeiros ou patrimônio. A área competente pode confirmar se há dúvida.",
      tipoResposta: "SELECAO", impacto: "CONDICIONAL", obrigatoria: true,
      ordem: 3, grupo: "preparacao", etapa: 1,
      opcoes: ["Não precisa", "Sim, já obtida", "Sim, em andamento", "Sim, ainda não solicitada", "A confirmar com a área técnica"],
      favoraveis: ["Não precisa", "Sim, já obtida"],
      opcoesComDetalhes: ["Sim, já obtida", "Sim, em andamento", "Sim, ainda não solicitada"],
      camposFollowUp: [{ chave: "quais_licencas", label: "Quais licenças ou autorizações?", tipo: "texto", placeholder: "Ex.: licença ambiental; AVCB" }],
      efeitos: [{ quando: { in: ["Sim, em andamento", "Sim, ainda não solicitada", "A confirmar com a área técnica"] }, incluirEstrutura: ["TAR_CARACTERIZAR", "TAR_PROTOCOLAR_LICENCA", "TAR_ACOMPANHAR_LICENCA"] }],
    },
    {
      codigo: "licitacao_contratacao", texto: "Será preciso licitar ou contratar para executar o projeto?",
      rotulo: "Licitação e contratação", pergunta: "Será preciso licitar ou contratar para executar o projeto?",
      ajuda: "Informe a necessidade, não a modalidade jurídica. Compras e Procuradoria definem o rito depois.",
      tipoResposta: "SELECAO", impacto: "CONDICIONAL", obrigatoria: true,
      ordem: 4, grupo: "preparacao", etapa: 1,
      opcoes: ["Não precisa contratar", "Precisa licitar", "Pode ser contratação direta; confirmar", "Licitação em andamento", "Contrato já assinado", "A confirmar com compras"],
      favoraveis: ["Não precisa contratar", "Contrato já assinado"],
      opcoesComDetalhes: ["Precisa licitar", "Pode ser contratação direta; confirmar", "Licitação em andamento", "Contrato já assinado"],
      camposFollowUp: [{ chave: "objeto_contratacao", label: "O que será contratado?", tipo: "texto", placeholder: "Ex.: construção da escola ou aquisição de equipamentos" }],
      efeitos: [
        { quando: { in: ["Precisa licitar", "Pode ser contratação direta; confirmar", "Licitação em andamento", "A confirmar com compras"] }, incluirEstrutura: ["TAR_ETP", "TAR_ORCAMENTO", "TAR_PCA", "TAR_PARECER_JURIDICO", "TAR_PUBLICAR_JULGAR", "TAR_ASSINAR_CONTRATO"] },
        { quando: { in: ["Precisa licitar", "Pode ser contratação direta; confirmar", "Licitação em andamento", "Contrato já assinado", "A confirmar com compras"] }, incluirEstrutura: ["TAR_FISCAL", "TAR_MEDICOES"] },
      ],
    },
    {
      codigo: "custeio_pos_entrega", texto: "Depois da entrega, haverá gasto mensal ou equipe para manter o serviço?",
      rotulo: "Custeio após a entrega", pergunta: "Depois da entrega, haverá gasto mensal ou equipe para manter o serviço?",
      ajuda: "Ex.: equipe, energia, manutenção, combustível ou suporte. Registre se já há previsão para custear.",
      tipoResposta: "SELECAO", impacto: "CONDICIONAL", obrigatoria: true,
      ordem: 5, grupo: "operacao", etapa: 2,
      opcoes: ["Não haverá gasto recorrente", "Sim, custeio previsto", "Sim, custeio ainda não previsto", "A confirmar"],
      favoraveis: ["Não haverá gasto recorrente", "Sim, custeio previsto"],
      efeitos: [{ quando: { in: ["Sim, custeio ainda não previsto", "A confirmar"] }, incluirEstrutura: ["TAR_CUSTEIO"] }],
    },
  ];
  const triagem: ModeloPerguntaDef[] = [
    { codigo: "risco_pessoas", texto: "Há risco imediato para pessoas ou interrupção de serviço essencial?", rotulo: "Risco imediato", tipoResposta: "SELECAO", impacto: "INFORMATIVA", ordem: 900, etapa: null, opcoes: ["Sim", "Não", "A confirmar"], efeitos: [{ quando: { eq: "Sim" }, elevaPrioridade: "CRITICA", motivoPrioridade: "Risco imediato a pessoas ou serviço essencial" }] },
    { codigo: "prazo_critico", texto: "Há prazo legal, contratual ou de repasse que vence nos próximos 6 meses?", rotulo: "Prazo crítico", tipoResposta: "SELECAO", impacto: "INFORMATIVA", ordem: 901, etapa: null, opcoes: ["Sim", "Não", "A confirmar"], efeitos: [{ quando: { eq: "Sim" }, elevaPrioridade: "ALTA", motivoPrioridade: "Prazo crítico nos próximos 6 meses" }] },
  ];
  return [...checklist, ...triagem];
}

export function etapasFromGrupos() {
  return GRUPOS_CONDICOES.map((g) => ({
    ordem: g.ordem,
    codigo: g.id.toUpperCase(),
    nome: g.nome,
    descricao: g.ajuda,
  }));
}

const PERGUNTAS_ATUAIS = buildCatalogoPerguntas();

export function quizItem(codigo: string) {
  const impedimento = PERGUNTAS_IMPEDIMENTOS_COMUNS.find(
    (item) => item.codigo === codigo,
  );
  if (impedimento) {
    return {
      codigo,
      grupo: "impedimentos",
      rotulo: impedimento.rotulo || impedimento.texto,
      pergunta: impedimento.pergunta || impedimento.texto,
      ajuda: impedimento.ajuda || "",
      espera: impedimento.espera || `Aguardando: ${impedimento.rotulo || impedimento.texto}`,
    };
  }

  const atual = PERGUNTAS_ATUAIS.find((item) => item.codigo === codigo);
  if (atual) {
    return {
      codigo,
      grupo: (atual.grupo || "planejamento") as GrupoCondicaoId,
      rotulo: atual.rotulo || atual.texto,
      pergunta: atual.pergunta || atual.texto,
      ajuda: atual.ajuda || "",
      espera: atual.espera || `Aguardando: ${atual.rotulo || atual.texto}`,
    };
  }
  return QUIZ_P03.find((item) => item.codigo === codigo);
}

export function etiquetaEspera(codigo: string) {
  return quizItem(codigo)?.espera ?? "Aguardando condição";
}

export function textoPorQueParado(
  respostas: {
    codigo: string;
    aplicabilidade: string;
    situacao: string;
    proximoPasso?: string;
    responsavel?: string;
  }[],
) {
  const bloqueios = respostas.filter((r) =>
    condicaoBloqueia({
      aplicabilidade: r.aplicabilidade as "sim" | "nao" | "a_avaliar",
      situacao: r.situacao as
        | "em_analise"
        | "atendida"
        | "pendente"
        | "dispensada_com_fundamento",
    }),
  );
  if (bloqueios.length === 0) {
    return "Nenhuma condição pendente. O projeto pode entrar em acompanhamento.";
  }
  return bloqueios
    .map((item) => {
      const quiz = quizItem(item.codigo);
      const passo =
        item.proximoPasso?.trim() || "definir o próximo passo na secretaria";
      const dono = item.responsavel?.trim() || "a secretaria responsável";
      return `${quiz?.espera ?? item.codigo}: ${quiz ? sePendente(quiz.rotulo) : "condição pendente"} Próximo passo: ${passo}. Quem responde: ${dono}.`;
    })
    .join(" ");
}

/** Placeholder de estrutura — o snapshot concreto injeta a árvore completa. */
export type CatalogoSnapshotPartial = Pick<
  ModeloSnapshot,
  "codigo" | "nome" | "perguntas" | "etapas"
>;

export function buildCatalogoSnapshotMeta(
  codigo = "PROJETO_ESTRUTURANTE_PADRAO",
  nome = "Projeto estruturante (padrão CIP)",
): CatalogoSnapshotPartial {
  return {
    codigo,
    nome,
    perguntas: buildCatalogoPerguntas(),
    etapas: etapasFromGrupos(),
  };
}
