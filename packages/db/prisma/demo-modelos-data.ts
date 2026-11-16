import type { Prisma } from "@prisma/client";

export const DEMO_REFERENCE = new Date("2026-11-16T12:00:00.000Z");
export const DEMO_SOURCE = "Cenário fictício CIP v1 — sem vínculo com entregas reais";
export const demoId = (municipio: number, item: string) =>
  `cip-demo-modelos-v1-${municipio}-${item}`;
export type DemoMunicipio = (typeof DEMO_MUNICIPIOS)[number];
export type DemoIdResolver = (item: string) => string;

const date = (day: string) => new Date(`${day}T12:00:00.000Z`);

export const DEMO_MUNICIPIOS = [
  {
    numero: 1,
    nome: "Prefeitura Modelo 1",
    inspiracao: "Conceição do Mato Dentro: território rural, patrimônio e acesso a serviços",
    projetos: [
      { secretaria: "Educação", sigla: "EDU", nome: "Escola do Vale — adequação rural", meta: "Qualificar espaços de aprendizagem rural", indicador: "Escolas rurais adequadas", alvo: 8, atual: 3, unidade: "escolas" },
      { secretaria: "Saúde", sigla: "SAU", nome: "Saúde Perto — atendimento itinerante", meta: "Ampliar o acesso rural à atenção primária", indicador: "Comunidades atendidas", alvo: 20, atual: 12, unidade: "comunidades" },
      { secretaria: "Infraestrutura", sigla: "INF", nome: "Caminhos do Interior — acessos comunitários", meta: "Melhorar a circulação entre comunidades", indicador: "Trechos recuperados", alvo: 12, atual: 4, unidade: "trechos" },
      { secretaria: "Cultura e Turismo", sigla: "CUL", nome: "Circuito da Memória — oficinas locais", meta: "Valorizar a memória e a economia criativa", indicador: "Oficinas realizadas", alvo: 10, atual: 10, unidade: "oficinas" },
    ],
  },
  {
    numero: 2,
    nome: "Prefeitura Modelo 2",
    inspiracao: "Belo Horizonte: escala metropolitana, regionais e mobilidade urbana",
    projetos: [
      { secretaria: "Educação", sigla: "EDU", nome: "Escola de Bairro — espaços inclusivos", meta: "Ampliar a acessibilidade da rede escolar", indicador: "Escolas com espaços acessíveis", alvo: 60, atual: 24, unidade: "escolas" },
      { secretaria: "Saúde", sigla: "SAU", nome: "Agenda Regional — acesso a consultas", meta: "Ampliar a oferta regionalizada de consultas", indicador: "Consultas adicionais ofertadas", alvo: 12000, atual: 7200, unidade: "consultas" },
      { secretaria: "Mobilidade", sigla: "MOB", nome: "Conexões Urbanas — corredores acessíveis", meta: "Qualificar conexões de transporte coletivo", indicador: "Pontos acessíveis implantados", alvo: 100, atual: 35, unidade: "pontos" },
      { secretaria: "Serviços Urbanos", sigla: "SUR", nome: "Praça Viva — zeladoria de bairro", meta: "Recuperar espaços de convivência nas regionais", indicador: "Praças atendidas", alvo: 40, atual: 40, unidade: "praças" },
    ],
  },
] as const;

const classifications = [
  ["ESTRUTURANTE", "PLANO_GOVERNO"],
  ["PRIORITARIO", "PLANO_GOVERNO"],
  ["PLANO_GOVERNO"],
  ["ACAO_DIARIA"],
] as const;

export function demoSecretarias(demo: DemoMunicipio, id: DemoIdResolver) {
  return [
    ...demo.projetos.map((p) => ({
      id: id(`secretaria-${p.sigla}`),
      nome: p.secretaria,
      sigla: p.sigla,
      titularNome: `Titular fictício de ${p.secretaria}`,
      titularCargo: "Secretário(a) municipal — demonstração",
      pessoas: {
        create: {
          id: id(`pessoa-${p.sigla}`),
          nome: `Equipe fictícia de ${p.secretaria}`,
          cargo: "Coordenação demonstrativa",
          papel: "TITULAR",
        },
      },
    })),
    { id: id("secretaria-PLA"), nome: "Planejamento", sigla: "PLA" },
  ] satisfies Prisma.SecretariaCreateWithoutMunicipioInput[];
}

export function demoPlano(demo: DemoMunicipio, id: DemoIdResolver) {
  return {
    id: id("plano"),
    nome: `Plano demonstrativo Modelo ${demo.numero} 2025–2028`,
    periodo: "2025-2028",
    descricao: `${DEMO_SOURCE}. Inspiração territorial: ${demo.inspiracao}. Projetos, equipes e números inventados; não representam programas oficiais.`,
    mandatoInicio: date("2025-01-01"),
    mandatoFim: date("2028-12-31"),
    metas: {
      create: demo.projetos.map((p, index) => ({
        id: id(`estrategia-${index}`),
        secretaria: { connect: { id: id(`secretaria-${p.sigla}`) } },
        codigo: `DEMO-ME-${index + 1}`,
        nome: p.meta,
        indicador: p.indicador,
        valorBase: "0",
        alvo: String(p.alvo),
        unidade: p.unidade,
        periodicidade: "Mensal",
        prazo: date("2026-12-15"),
        statusValidacao: "VALIDADO",
        perspectivaBsc: "CLIENTES",
        resultadoChaveOkr: `Atingir ${p.alvo} ${p.unidade} no cenário simulado`,
      })),
    },
  } satisfies Prisma.PlanoGovernoCreateWithoutMunicipioInput;
}

export function municipioData(demo: DemoMunicipio): Prisma.MunicipioCreateInput {
  const id = (item: string) => demoId(demo.numero, item);
  return {
    id: id("municipio"),
    nome: demo.nome,
    uf: "MG",
    ibgeCode: null,
    cnpjOrgao: null,
    mandatoInicio: date("2025-01-01"),
    mandatoFim: date("2028-12-31"),
    prefeitoNome: `Gabinete fictício Modelo ${demo.numero}`,
    secretarias: { create: demoSecretarias(demo, id) },
    planos: { create: demoPlano(demo, id) },
  };
}

export async function createDemoProjects(
  tx: Prisma.TransactionClient,
  demo: DemoMunicipio,
  id: DemoIdResolver = (item) => demoId(demo.numero, item),
) {
  for (const [index, p] of demo.projetos.entries()) {
    const classes = classifications[index];
    const concluded = index === 3;
    const initiativeId = id(`projeto-${index}`);
    const owner = `Equipe fictícia de ${p.secretaria}`;
    await tx.iniciativa.create({
      data: {
        id: initiativeId,
        municipioId: id("municipio"),
        secretariaPrincipalId: id(`secretaria-${p.sigla}`),
        metaEstrategicaId: id(`estrategia-${index}`),
        responsavelPessoaId: id(`pessoa-${p.sigla}`),
        codigo: `DEMO-M${demo.numero}-${p.sigla}-01`,
        nome: `[DEMO] ${p.nome}`,
        descricao: `${DEMO_SOURCE}. Exemplo criado para visualizar a plataforma; não é uma ação oficial.`,
        tipo: classes[0],
        classificacaoPrincipal: classes[0],
        classificacoes: { create: classes.map((classificacao) => ({ classificacao })) },
        estruturante: classes.some((c) => c === "ESTRUTURANTE"),
        vinculoPlanoGoverno: classes.some((c) => c === "PLANO_GOVERNO"),
        origem: "SIMULACAO",
        ciclo: concluded ? "CONCLUIDA" : index === 2 ? "EM_PLANEJAMENTO" : "EM_ACOMPANHAMENTO",
        prioridadeNivel: index === 0 ? "CRITICA" : index === 1 ? "ALTA" : "MEDIA",
        responsavel: owner,
        publicacao: "INTERNA",
        fonte: DEMO_SOURCE,
        confiabilidade: "MEDIA",
        dataReferencia: DEMO_REFERENCE,
        atualizadoEm: index === 2 ? date("2026-10-01") : DEMO_REFERENCE,
        secretarias: {
          create: {
            secretariaId: id("secretaria-PLA"),
            papel: "PARTICIPANTE",
            responsavel: "Equipe fictícia de Planejamento",
          },
        },
        impedimentos: index === 0 ? {
          create: {
            id: id(`impedimento-${index}`),
            tipo: "PROJETO_TECNICO",
            descricao: "SIMULAÇÃO: revisão de acessibilidade aguardando parecer técnico.",
            gravidade: "ALTA",
            status: "ABERTO",
            responsavel: owner,
            proximoPasso: "Pactuar revisão do projeto e apresentar parecer fictício.",
            prazo: date("2026-11-20"),
          },
        } : undefined,
        decisoes: index === 0 ? {
          create: {
            descricao: "SIMULAÇÃO: pactuar providência para a revisão de acessibilidade.",
            impedimentoId: id(`impedimento-${index}`),
            responsavel: owner,
            prazo: date("2026-11-23"),
          },
        } : undefined,
        evidencias: {
          create: {
            titulo: "Registro ilustrativo de acompanhamento",
            descricao: "Conteúdo fictício, sem arquivo comprobatório. Não valida uma entrega real.",
            fonte: DEMO_SOURCE,
            autorNome: owner,
            status: "A_VERIFICAR",
          },
        },
      },
    });

    for (let task = 0; task < 4; task++) {
      const done = concluded || task === 0;
      const deadline = index === 0 && task > 0
        ? date("2026-09-15")
        : index === 2 && task > 0 ? null : date("2026-11-25");
      await tx.marcoEntrega.create({
        data: {
          id: id(`tarefa-${index}-${task}`),
          iniciativaId: initiativeId,
          codigo: `DEMO-T${index + 1}-${task + 1}`,
          descricao: [
            "Concluir diagnóstico demonstrativo do território",
            "Preparar plano técnico ilustrativo",
            "Executar frente de atendimento simulada",
            "Conferir resultados e reunir evidências fictícias",
          ][task],
          ordem: task + 1,
          responsavel: owner,
          prazoOriginal: deadline,
          prazoVigente: deadline,
          concluidoEm: done ? date("2026-11-10") : null,
          gravidade: !done && index === 0 ? "CRITICA" : null,
          subtarefas: {
            create: [
              { descricao: "Organizar insumos fictícios", responsavel: owner, concluida: true },
              { descricao: "Registrar conferência demonstrativa", responsavel: owner, concluida: done },
            ],
          },
        },
      });
    }

    const indicador = await tx.indicador.create({
      data: {
        id: id(`indicador-${index}`),
        municipioId: id("municipio"),
        metaEstrategicaId: id(`estrategia-${index}`),
        nome: p.indicador,
        descricao: "Série inteiramente fictícia para demonstração.",
        unidade: p.unidade,
        valorBase: "0",
        alvo: String(p.alvo),
        valorAtual: String(p.atual),
        periodicidade: "Mensal",
        fonte: DEMO_SOURCE,
      },
    });
    await tx.medicao.createMany({
      data: ["2026-09-16", "2026-10-16", "2026-11-16"].map((day, point) => ({
        id: id(`medicao-${index}-${point}`),
        municipioId: id("municipio"),
        metaEstrategicaId: id(`estrategia-${index}`),
        indicadorId: indicador.id,
        dataCorte: date(day),
        valorRealizado: String(Math.round(p.atual * (point + 1) / 3)),
        valorEsperado: String(Math.round(p.alvo * (point + 1) / 3)),
        fonte: DEMO_SOURCE,
        observacao: "Medição simulada, sem correspondência com dados oficiais.",
      })),
    });
  }
}
