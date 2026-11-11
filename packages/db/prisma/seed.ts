import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ESTRUTURANTE_PADRAO_MODELO_SNAPSHOT } from "./estruturante-modelo-snapshot";

const prisma = new PrismaClient();

async function main() {
  const permissions = [
    { code: "municipio:manage", name: "Gerenciar município" },
    { code: "users:manage", name: "Gerenciar usuários" },
    { code: "iniciativa:read", name: "Ler iniciativas" },
    { code: "iniciativa:write", name: "Editar iniciativas" },
    { code: "marco:write", name: "Editar marcos" },
    { code: "evidencia:submit", name: "Enviar evidências" },
    { code: "evidencia:validate", name: "Validar evidências" },
    { code: "import:run", name: "Executar importações" },
    { code: "report:export", name: "Exportar relatórios" },
    { code: "audit:read", name: "Ler auditoria" },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name },
      create: p,
    });
  }

  const allPerms = await prisma.permission.findMany();
  const byCode = Object.fromEntries(allPerms.map((p) => [p.code, p.id]));

  const rolesDef = [
    {
      code: "admin",
      name: "Administrador",
      perms: permissions.map((p) => p.code),
    },
    {
      code: "prefeito",
      name: "Gabinete do Prefeito",
      perms: ["iniciativa:read", "report:export", "audit:read"],
    },
    {
      code: "gestor",
      name: "Gestor municipal",
      perms: [
        "iniciativa:read",
        "evidencia:submit",
        "report:export",
      ],
    },
    {
      code: "analista",
      name: "Analista técnico",
      perms: [
        "iniciativa:read",
        "iniciativa:write",
        "marco:write",
        "evidencia:submit",
        "evidencia:validate",
        "report:export",
      ],
    },
    {
      code: "leitura",
      name: "Somente leitura",
      perms: ["iniciativa:read", "report:export"],
    },
  ];

  for (const r of rolesDef) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: { code: r.code, name: r.name },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const code of r.perms) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: byCode[code] },
      });
    }
  }

  const tiposVerificacao = [
    {
      codigo: "ORCAMENTO",
      nome: "Orçamento / recursos",
      descricao: "Verificar disponibilidade orçamentária e financeira",
    },
    {
      codigo: "PROJETO_LEI",
      nome: "Projeto de lei",
      descricao: "Necessidade de ato legislativo",
    },
    {
      codigo: "DESAPROPRIACAO",
      nome: "Desapropriação / imóvel",
      descricao: "Questões patrimoniais e de imóvel",
    },
    {
      codigo: "LICITACAO",
      nome: "Licitação / contratação",
      descricao: "Procedimentos de contratação pública",
    },
    {
      codigo: "PROJETO_TECNICO",
      nome: "Projeto técnico",
      descricao: "Elaboração de projeto técnico",
    },
  ];

  for (const t of tiposVerificacao) {
    await prisma.tipoVerificacao.upsert({
      where: { codigo: t.codigo },
      update: { nome: t.nome, descricao: t.descricao },
      create: t,
    });
  }

  // CNPJ da Prefeitura de Conceição do Mato Dentro (só dígitos) — Transferegov/PNCP.
  const CNPJ_CMD = "18315416000196";
  const municipio = await prisma.municipio.upsert({
    where: { ibgeCode: "3117504" },
    update: {
      nome: "Conceição do Mato Dentro",
      uf: "MG",
      cnpjOrgao: CNPJ_CMD,
    },
    create: {
      nome: "Conceição do Mato Dentro",
      uf: "MG",
      ibgeCode: "3117504",
      cnpjOrgao: CNPJ_CMD,
    },
  });

  const secretariasNomes = [
    { nome: "Educação", sigla: "EDU", titularNome: "Raquel Souza", titularCargo: "Secretária Municipal", titularTelefone: "(31) 98610-1001", titularEmail: "educacao@cmd.mg.gov.br" },
    { nome: "Cultura", sigla: "CUL", titularNome: "Júlia Santana", titularCargo: "Secretária Municipal", titularTelefone: "(31) 98610-1002", titularEmail: "cultura@cmd.mg.gov.br" },
    { nome: "Infraestrutura", sigla: "INF", titularNome: "Alexandre Leal", titularCargo: "Secretário Municipal", titularTelefone: "(31) 98610-1003", titularEmail: "infra@cmd.mg.gov.br" },
    { nome: "Saúde", sigla: "SAU", titularNome: "Fabricio Simões", titularCargo: "Secretário Municipal", titularTelefone: "(31) 98610-1004", titularEmail: "saude@cmd.mg.gov.br" },
    { nome: "Assistência Social", sigla: "ASS", titularNome: "Romero Otoni", titularCargo: "Secretário Municipal", titularTelefone: "(31) 98610-1005", titularEmail: "social@cmd.mg.gov.br" },
    { nome: "Administração", sigla: "ADM", titularNome: "Haécio Lages", titularCargo: "Secretário Municipal", titularTelefone: "(31) 98610-1006", titularEmail: "adm@cmd.mg.gov.br" },
    { nome: "Procuradoria Geral do Município", sigla: "PGM", titularNome: "Carla Mendes", titularCargo: "Procuradora-Geral", titularTelefone: "(31) 98610-1007", titularEmail: "pgm@cmd.mg.gov.br" },
    { nome: "Planejamento", sigla: "PLA", titularNome: "José Morais", titularCargo: "Secretário Municipal", titularTelefone: "(31) 98610-1008", titularEmail: "planejamento@cmd.mg.gov.br" },
    { nome: "Meio Ambiente", sigla: "MAM", titularNome: "Mariana Rodrigues", titularCargo: "Secretária Municipal", titularTelefone: "(31) 98610-1009", titularEmail: "meioambiente@cmd.mg.gov.br" },
    { nome: "Esporte e Lazer", sigla: "ESP", titularNome: "Bruno Fonseca", titularCargo: "Secretário Municipal", titularTelefone: "(31) 98610-1010", titularEmail: "esporte@cmd.mg.gov.br" },
    { nome: "Desenvolvimento Econômico", sigla: "DES", titularNome: "Patrícia Alves", titularCargo: "Secretária Municipal", titularTelefone: "(31) 98610-1011", titularEmail: "desenvolvimento@cmd.mg.gov.br" },
    { nome: "Obras", sigla: "OBR", titularNome: "Ricardo Nunes", titularCargo: "Secretário Municipal", titularTelefone: "(31) 98610-1012", titularEmail: "obras@cmd.mg.gov.br" },
    { nome: "Gabinete", sigla: "GAB", titularNome: "Chefe de Gabinete", titularCargo: "Chefe de Gabinete", titularTelefone: "(31) 98610-1013", titularEmail: "gabinete@cmd.mg.gov.br" },
  ];

  const secretarias: Record<string, string> = {};
  for (const s of secretariasNomes) {
    const row = await prisma.secretaria.upsert({
      where: {
        municipioId_nome: { municipioId: municipio.id, nome: s.nome },
      },
      update: {
        sigla: s.sigla,
        titularNome: s.titularNome,
        titularCargo: s.titularCargo,
        titularTelefone: s.titularTelefone,
        titularEmail: s.titularEmail,
      },
      create: {
        municipioId: municipio.id,
        nome: s.nome,
        sigla: s.sigla,
        titularNome: s.titularNome,
        titularCargo: s.titularCargo,
        titularTelefone: s.titularTelefone,
        titularEmail: s.titularEmail,
      },
    });
    secretarias[s.sigla] = row.id;

    const titularId = `pessoa-titular-${s.sigla.toLowerCase()}`;
    await prisma.secretariaPessoa.upsert({
      where: { id: titularId },
      update: {
        nome: s.titularNome,
        cargo: s.titularCargo,
        telefone: s.titularTelefone,
        email: s.titularEmail,
        papel: "TITULAR",
        ativo: true,
        secretariaId: row.id,
      },
      create: {
        id: titularId,
        secretariaId: row.id,
        nome: s.titularNome,
        cargo: s.titularCargo,
        telefone: s.titularTelefone,
        email: s.titularEmail,
        papel: "TITULAR",
        ativo: true,
      },
    });
    await prisma.secretariaPessoa.updateMany({
      where: {
        secretariaId: row.id,
        papel: "TITULAR",
        NOT: { id: titularId },
      },
      data: { papel: "EQUIPE", ativo: false },
    });
  }

  const equipeExtra: Array<{
    id: string;
    sigla: string;
    nome: string;
    cargo: string;
    telefone: string;
    email: string;
  }> = [
    {
      id: "pessoa-edu-coord",
      sigla: "EDU",
      nome: "Camila Borges",
      cargo: "Coordenadora de Projetos",
      telefone: "(31) 98610-2001",
      email: "camila.borges@cmd.mg.gov.br",
    },
    {
      id: "pessoa-edu-analista",
      sigla: "EDU",
      nome: "Diego Martins",
      cargo: "Analista de Infraestrutura Escolar",
      telefone: "(31) 98610-2002",
      email: "diego.martins@cmd.mg.gov.br",
    },
    {
      id: "pessoa-sau-coord",
      sigla: "SAU",
      nome: "Helena Prado",
      cargo: "Coordenadora de Atenção Básica",
      telefone: "(31) 98610-2003",
      email: "helena.prado@cmd.mg.gov.br",
    },
    {
      id: "pessoa-obr-eng",
      sigla: "OBR",
      nome: "Paulo Henrique Costa",
      cargo: "Engenheiro de Obras",
      telefone: "(31) 98610-2004",
      email: "paulo.costa@cmd.mg.gov.br",
    },
    {
      id: "pessoa-obr-fiscal",
      sigla: "OBR",
      nome: "Larissa Melo",
      cargo: "Fiscal de Contratos",
      telefone: "(31) 98610-2005",
      email: "larissa.melo@cmd.mg.gov.br",
    },
  ];

  for (const p of equipeExtra) {
    await prisma.secretariaPessoa.upsert({
      where: { id: p.id },
      update: {
        nome: p.nome,
        cargo: p.cargo,
        telefone: p.telefone,
        email: p.email,
        papel: "EQUIPE",
        ativo: true,
        secretariaId: secretarias[p.sigla],
      },
      create: {
        id: p.id,
        secretariaId: secretarias[p.sigla],
        nome: p.nome,
        cargo: p.cargo,
        telefone: p.telefone,
        email: p.email,
        papel: "EQUIPE",
        ativo: true,
      },
    });
  }

  const plano = await prisma.planoGoverno.upsert({
    where: { id: "plano-cmd-demo" },
    update: {
      mandatoInicio: new Date("2025-01-01T00:00:00.000Z"),
      mandatoFim: new Date("2028-12-31T00:00:00.000Z"),
    },
    create: {
      id: "plano-cmd-demo",
      municipioId: municipio.id,
      nome: "Plano de Governo CMD 2025-2028",
      periodo: "2025-2028",
      descricao: "Plano piloto para demonstração CIP",
      mandatoInicio: new Date("2025-01-01T00:00:00.000Z"),
      mandatoFim: new Date("2028-12-31T00:00:00.000Z"),
    },
  });

  const metaEdu = await prisma.metaEstrategica.upsert({
    where: { id: "meta-edu-demo" },
    update: {
      indicador: "% escolas com intervenção concluída",
      valorBase: "10",
      alvo: "80",
      unidade: "%",
      periodicidade: "Quinzenal",
      statusValidacao: "VALIDADO",
      perspectivaBsc: "PROCESSOS",
      resultadoChaveOkr: "Concluir 80% das intervenções prioritárias até 2026",
    },
    create: {
      id: "meta-edu-demo",
      planoId: plano.id,
      secretariaId: secretarias.EDU,
      codigo: "ME-EDU-01",
      nome: "Ampliar infraestrutura educacional",
      descricao: "Garantir condições físicas adequadas às escolas municipais",
      indicador: "% escolas com intervenção concluída",
      valorBase: "10",
      alvo: "80",
      unidade: "%",
      periodicidade: "Quinzenal",
      statusValidacao: "VALIDADO",
      perspectivaBsc: "PROCESSOS",
      resultadoChaveOkr: "Concluir 80% das intervenções prioritárias até 2026",
    },
  });

  const medicaoExistente = await prisma.medicao.findFirst({
    where: {
      municipioId: municipio.id,
      metaEstrategicaId: metaEdu.id,
      dataCorte: new Date("2026-10-06T12:00:00.000Z"),
    },
  });
  if (!medicaoExistente) {
    await prisma.medicao.create({
      data: {
        municipioId: municipio.id,
        metaEstrategicaId: metaEdu.id,
        dataCorte: new Date("2026-10-06T12:00:00.000Z"),
        valorRealizado: "35",
        valorEsperado: "40",
        fonte: "Relatório Quinzenal REV04",
        confiabilidade: "MEDIA",
        observacao: "Medição ilustrativa do piloto CMD",
      },
    });
  }

  for (const doc of [
    { id: "doc-ppa-cmd", tipo: "PPA", titulo: "PPA 2026–2029 CMD", vigencia: "2026-2029" },
    { id: "doc-ldo-cmd", tipo: "LDO", titulo: "LDO 2026 CMD", vigencia: "2026" },
    { id: "doc-loa-cmd", tipo: "LOA", titulo: "LOA 2026 CMD", vigencia: "2026" },
  ] as const) {
    await prisma.documentoConhecimento.upsert({
      where: { id: doc.id },
      update: { titulo: doc.titulo, vigencia: doc.vigencia },
      create: {
        id: doc.id,
        municipioId: municipio.id,
        tipo: doc.tipo,
        titulo: doc.titulo,
        vigencia: doc.vigencia,
        fonte: "Prefeitura de Conceição do Mato Dentro",
        statusConferencia: "PENDENTE",
      },
    });
  }

  const compromisso = await prisma.compromisso.upsert({
    where: { id: "comp-edu-demo" },
    update: {},
    create: {
      id: "comp-edu-demo",
      municipioId: municipio.id,
      codigo: "CG-01",
      titulo: "Melhoria da rede escolar municipal",
      fonte: "Plano de Governo / REV04",
    },
  });

  const equipamento = await prisma.equipamentoPublico.upsert({
    where: {
      municipioId_nome: {
        municipioId: municipio.id,
        nome: "Escola João Lima",
      },
    },
    update: {},
    create: {
      municipioId: municipio.id,
      nome: "Escola João Lima",
      tipo: "ESCOLA",
      endereco: "Conceição do Mato Dentro - MG",
    },
  });

  const dataRef = new Date("2026-10-06T12:00:00.000Z");

  const iniciativaEdu = await prisma.iniciativa.upsert({
    where: {
      municipioId_codigo: { municipioId: municipio.id, codigo: "EDU-JL-01" },
    },
    update: {},
    create: {
      municipioId: municipio.id,
      secretariaPrincipalId: secretarias.EDU,
      metaEstrategicaId: metaEdu.id,
      codigo: "EDU-JL-01",
      nome: "Escola João Lima",
      descricao:
        "Projeto estruturante com frentes de desapropriação, acesso, obra e restauro.",
      tipo: "ESTRUTURANTE",
      origem: "REV04 / Relatório Quinzenal 06/10/2026",
      responsavel: "Secretaria de Educação",
      ciclo: "EM_ACOMPANHAMENTO",
      estruturante: true,
      dataReferencia: dataRef,
      fonte: "Relatório Quinzenal de Metas e Ações REV04",
      confiabilidade: "ALTA",
    },
  });

  await prisma.iniciativaSecretaria.upsert({
    where: {
      iniciativaId_secretariaId: {
        iniciativaId: iniciativaEdu.id,
        secretariaId: secretarias.INF,
      },
    },
    update: {},
    create: {
      iniciativaId: iniciativaEdu.id,
      secretariaId: secretarias.INF,
      papel: "CORRESPONSAVEL",
      responsavel: "Obras / Infraestrutura",
    },
  });

  await prisma.iniciativaSecretaria.upsert({
    where: {
      iniciativaId_secretariaId: {
        iniciativaId: iniciativaEdu.id,
        secretariaId: secretarias.PGM,
      },
    },
    update: {},
    create: {
      iniciativaId: iniciativaEdu.id,
      secretariaId: secretarias.PGM,
      papel: "PARTICIPANTE",
      responsavel: "Assessoria jurídica",
    },
  });

  await prisma.iniciativaCompromisso.upsert({
    where: {
      iniciativaId_compromissoId: {
        iniciativaId: iniciativaEdu.id,
        compromissoId: compromisso.id,
      },
    },
    update: {},
    create: {
      iniciativaId: iniciativaEdu.id,
      compromissoId: compromisso.id,
      tipoContribuicao: "DIRETA",
      origemVinculo: "SEED_DEMO",
    },
  });

  await prisma.iniciativaEquipamento.upsert({
    where: {
      iniciativaId_equipamentoId: {
        iniciativaId: iniciativaEdu.id,
        equipamentoId: equipamento.id,
      },
    },
    update: { validado: true },
    create: {
      iniciativaId: iniciativaEdu.id,
      equipamentoId: equipamento.id,
      tipoVinculo: "OBJETO_PRINCIPAL",
      validado: true,
    },
  });

  const iniciativaCul = await prisma.iniciativa.upsert({
    where: {
      municipioId_codigo: { municipioId: municipio.id, codigo: "CUL-JL-01" },
    },
    update: {},
    create: {
      municipioId: municipio.id,
      secretariaPrincipalId: secretarias.CUL,
      codigo: "CUL-JL-01",
      nome: "Escoramento e restauro Escola João Lima",
      descricao: "Frente cultural de preservação e restauro do equipamento.",
      tipo: "PRESERVACAO",
      origem: "REV04 p.11",
      responsavel: "Secretaria de Cultura",
      ciclo: "EM_ACOMPANHAMENTO",
      dataReferencia: dataRef,
      fonte: "Relatório Quinzenal de Metas e Ações REV04",
      confiabilidade: "ALTA",
    },
  });

  await prisma.iniciativaEquipamento.upsert({
    where: {
      iniciativaId_equipamentoId: {
        iniciativaId: iniciativaCul.id,
        equipamentoId: equipamento.id,
      },
    },
    update: { validado: true },
    create: {
      iniciativaId: iniciativaCul.id,
      equipamentoId: equipamento.id,
      tipoVinculo: "RELACIONADO",
      validado: true,
    },
  });

  const iniciativaAlca = await prisma.iniciativa.upsert({
    where: {
      municipioId_codigo: { municipioId: municipio.id, codigo: "INF-AV-01" },
    },
    update: {},
    create: {
      municipioId: municipio.id,
      secretariaPrincipalId: secretarias.INF,
      codigo: "INF-AV-01",
      nome: "Alça Viária",
      descricao:
        "Projeto piloto de dependências intersecretarias (teste conceitual).",
      tipo: "INFRAESTRUTURA",
      origem: "Caderno de Testes CMD v0.2",
      responsavel: "Secretaria de Infraestrutura",
      ciclo: "EM_PLANEJAMENTO",
      estruturante: true,
      dataReferencia: dataRef,
      fonte: "Caderno de Testes / F2",
      confiabilidade: "MEDIA",
    },
  });

  // Marcos EDU (amostra do piloto)
  const marcosEdu = [
    {
      codigo: "EDU-001",
      descricao: "Desapropriação / regularização do imóvel",
      prazoOriginal: null as Date | null,
      concluidoEm: null as Date | null,
    },
    {
      codigo: "EDU-002",
      descricao: "Projeto de entrada / acesso",
      prazoOriginal: null,
      concluidoEm: null,
    },
    {
      codigo: "EDU-003",
      descricao: "Obra de acesso",
      prazoOriginal: null,
      concluidoEm: null,
    },
    {
      codigo: "EDU-004",
      descricao: "Licitação / contratação",
      prazoOriginal: null,
      concluidoEm: null,
    },
    {
      codigo: "EDU-005",
      descricao: "Execução do saldo de obra",
      prazoOriginal: null,
      concluidoEm: new Date("2026-09-15T12:00:00.000Z"),
    },
    {
      codigo: "EDU-006",
      descricao: "Cobertura / escoramento",
      prazoOriginal: null,
      concluidoEm: null,
    },
  ];

  const metaExecEdu = await prisma.metaExecucao.upsert({
    where: { id: "meta-exec-edu-jl" },
    update: {
      nome: "Concluir intervenções físicas e regulares da Escola João Lima",
      indicador: "% etapas críticas concluídas",
      alvo: "100%",
      valorAtual: "33%",
      unidade: "%",
      criterio: "Desapropriação, acesso, licitação e saldo de obra concluídos",
      responsavel: "Educação / Infraestrutura",
      prazo: new Date("2026-12-15T12:00:00.000Z"),
      status: "EM_ANDAMENTO",
    },
    create: {
      id: "meta-exec-edu-jl",
      iniciativaId: iniciativaEdu.id,
      codigo: "MX-EDU-01",
      nome: "Concluir intervenções físicas e regulares da Escola João Lima",
      indicador: "% etapas críticas concluídas",
      alvo: "100%",
      valorAtual: "33%",
      unidade: "%",
      criterio: "Desapropriação, acesso, licitação e saldo de obra concluídos",
      responsavel: "Educação / Infraestrutura",
      prazo: new Date("2026-12-15T12:00:00.000Z"),
      ordem: 1,
      status: "EM_ANDAMENTO",
    },
  });

  for (let i = 0; i < marcosEdu.length; i++) {
    const m = marcosEdu[i];
    const existing = await prisma.marcoEntrega.findFirst({
      where: { iniciativaId: iniciativaEdu.id, codigo: m.codigo },
    });
    if (existing) {
      await prisma.marcoEntrega.update({
        where: { id: existing.id },
        data: { metaExecucaoId: metaExecEdu.id },
      });
      continue;
    }
    const marco = await prisma.marcoEntrega.create({
      data: {
        iniciativaId: iniciativaEdu.id,
        metaExecucaoId: metaExecEdu.id,
        equipamentoId: equipamento.id,
        codigo: m.codigo,
        descricao: m.descricao,
        ordem: i + 1,
        responsavel: "Educação",
        prazoOriginal: m.prazoOriginal,
        prazoVigente: m.prazoOriginal,
        concluidoEm: m.concluidoEm,
        gravidade: m.prazoOriginal ? undefined : undefined,
      },
    });
    if (m.codigo === "EDU-001") {
      await prisma.subtarefa.createMany({
        data: [
          {
            marcoId: marco.id,
            descricao: "Levantar documentação patrimonial",
            responsavel: "PGM",
            concluida: true,
          },
          {
            marcoId: marco.id,
            descricao: "Confirmar titularidade administrativa do imóvel",
            responsavel: "PGM",
            concluida: false,
          },
        ],
      });
    }
  }

  const marcosCul = [
    {
      codigo: "CUL-013",
      descricao: "Escoramento estrutural",
      prazoOriginal: new Date("2026-08-01T12:00:00.000Z"),
      concluidoEm: new Date("2026-07-20T12:00:00.000Z"),
    },
    {
      codigo: "CUL-015",
      descricao: "Restauro de fachada",
      prazoOriginal: new Date("2026-09-15T12:00:00.000Z"),
      concluidoEm: null,
    },
    {
      codigo: "CUL-016",
      descricao: "Entrega de relatório patrimonial",
      prazoOriginal: new Date("2026-09-01T12:00:00.000Z"),
      concluidoEm: null,
    },
  ];

  for (let i = 0; i < marcosCul.length; i++) {
    const m = marcosCul[i];
    const existing = await prisma.marcoEntrega.findFirst({
      where: { iniciativaId: iniciativaCul.id, codigo: m.codigo },
    });
    if (existing) continue;
    const marco = await prisma.marcoEntrega.create({
      data: {
        iniciativaId: iniciativaCul.id,
        equipamentoId: equipamento.id,
        codigo: m.codigo,
        descricao: m.descricao,
        ordem: i + 1,
        responsavel: "Cultura",
        prazoOriginal: m.prazoOriginal,
        prazoVigente: m.prazoOriginal,
        concluidoEm: m.concluidoEm,
        gravidade:
          m.codigo === "CUL-015"
            ? "GRAVE"
            : m.codigo === "CUL-016"
              ? "MODERADA"
              : null,
      },
    });

    if (m.codigo === "CUL-015") {
      await prisma.reprogramacao.create({
        data: {
          marcoId: marco.id,
          dataAnterior: m.prazoOriginal,
          dataNova: new Date("2026-10-30T12:00:00.000Z"),
          motivo: "Ajuste de cronograma por dependência de escoramento",
        },
      });
      await prisma.marcoEntrega.update({
        where: { id: marco.id },
        data: { prazoVigente: new Date("2026-10-30T12:00:00.000Z") },
      });
      await prisma.subtarefa.create({
        data: {
          marcoId: marco.id,
          descricao: "Contratar equipe de restauro especializada",
          responsavel: "Cultura",
          concluida: false,
        },
      });
    }
  }

  const metaExecCul = await prisma.metaExecucao.upsert({
    where: { id: "meta-exec-cul-jl" },
    update: {
      nome: "Preservar e restaurar o equipamento Escola João Lima",
      indicador: "Etapas de escoramento/restauro concluídas",
      alvo: "3/3",
      valorAtual: "1/3",
      unidade: "etapas",
      responsavel: "Cultura",
      prazo: new Date("2026-09-30T12:00:00.000Z"),
      status: "EM_ANDAMENTO",
    },
    create: {
      id: "meta-exec-cul-jl",
      iniciativaId: iniciativaCul.id,
      codigo: "MX-CUL-01",
      nome: "Preservar e restaurar o equipamento Escola João Lima",
      indicador: "Etapas de escoramento/restauro concluídas",
      alvo: "3/3",
      valorAtual: "1/3",
      unidade: "etapas",
      responsavel: "Cultura",
      prazo: new Date("2026-09-30T12:00:00.000Z"),
      ordem: 1,
      status: "EM_ANDAMENTO",
    },
  });
  await prisma.marcoEntrega.updateMany({
    where: { iniciativaId: iniciativaCul.id },
    data: { metaExecucaoId: metaExecCul.id },
  });

  // Meta de infraestrutura — vencida para alimentar o board
  const iniInfra = await prisma.iniciativa.findFirst({
    where: { municipioId: municipio.id, codigo: "INF-AV-01" },
  });
  if (iniInfra) {
    await prisma.metaExecucao.upsert({
      where: { id: "meta-exec-inf-av" },
      update: {
        valorAtual: "40%",
        alvo: "100%",
        prazo: new Date("2026-09-15T12:00:00.000Z"),
        status: "EM_ANDAMENTO",
      },
      create: {
        id: "meta-exec-inf-av",
        iniciativaId: iniInfra.id,
        codigo: "MX-INF-01",
        nome: "Avançar a execução da obra prioritária de infraestrutura",
        indicador: "% físico executado",
        alvo: "100%",
        valorAtual: "40%",
        unidade: "%",
        responsavel: "Infraestrutura",
        prazo: new Date("2026-09-15T12:00:00.000Z"),
        ordem: 1,
        status: "EM_ANDAMENTO",
      },
    });
  }

  // Verificações AT-02
  const tipos = await prisma.tipoVerificacao.findMany();
  const tipoMap = Object.fromEntries(tipos.map((t) => [t.codigo, t.id]));

  await prisma.verificacao.upsert({
    where: {
      iniciativaId_tipoVerificacaoId: {
        iniciativaId: iniciativaEdu.id,
        tipoVerificacaoId: tipoMap.DESAPROPRIACAO,
      },
    },
    update: {
      aplicabilidade: "NAO",
      situacao: "DISPENSADA_COM_FUNDAMENTO",
      justificativa: "Não aplicável no recorte atual da iniciativa (demo AT-02)",
      responsavel: "PGM",
    },
    create: {
      iniciativaId: iniciativaEdu.id,
      tipoVerificacaoId: tipoMap.DESAPROPRIACAO,
      aplicabilidade: "NAO",
      situacao: "DISPENSADA_COM_FUNDAMENTO",
      justificativa: "Não aplicável no recorte atual da iniciativa (demo AT-02)",
      responsavel: "PGM",
      efeitoNoAvanco: "INFORMATIVO",
    },
  });

  await prisma.verificacao.upsert({
    where: {
      iniciativaId_tipoVerificacaoId: {
        iniciativaId: iniciativaEdu.id,
        tipoVerificacaoId: tipoMap.ORCAMENTO,
      },
    },
    update: {
      aplicabilidade: "SIM",
      situacao: "PENDENTE",
      justificativa: "Compatibilidade orçamentária pendente de atesto",
      responsavel: "Planejamento / Finanças",
      proximaAcao: "Solicitar confirmação de dotação",
    },
    create: {
      iniciativaId: iniciativaEdu.id,
      tipoVerificacaoId: tipoMap.ORCAMENTO,
      aplicabilidade: "SIM",
      situacao: "PENDENTE",
      justificativa: "Compatibilidade orçamentária pendente de atesto",
      responsavel: "Planejamento / Finanças",
      efeitoNoAvanco: "REQUER_PROVIDENCIA",
      proximaAcao: "Solicitar confirmação de dotação",
    },
  });

  const impedimento = await prisma.impedimento.findFirst({
    where: {
      iniciativaId: iniciativaEdu.id,
      descricao: { contains: "orçamentária" },
    },
  });

  const impedimentoId =
    impedimento?.id ??
    (
      await prisma.impedimento.create({
        data: {
          iniciativaId: iniciativaEdu.id,
          tipo: "ORCAMENTO",
          descricao: "Pendência orçamentária para continuidade da obra",
          gravidade: "ALTA",
          responsavel: "Planejamento / Finanças",
          status: "ABERTO",
          proximoPasso: "Encaminhar pedido de reforço orçamentário",
          prazo: new Date("2026-11-20T12:00:00.000Z"),
        },
      })
    ).id;

  const decisaoExistente = await prisma.decisaoProvidencia.findFirst({
    where: { impedimentoId },
  });
  if (!decisaoExistente) {
    await prisma.decisaoProvidencia.create({
      data: {
        iniciativaId: iniciativaEdu.id,
        impedimentoId,
        descricao: "Providência: formalizar solicitação de recurso complementar",
        responsavel: "Planejamento",
        status: "EM_ANDAMENTO",
        prazo: new Date("2026-11-15T12:00:00.000Z"),
      },
    });
  }

  const evidenciaExistente = await prisma.evidencia.findFirst({
    where: {
      iniciativaId: iniciativaEdu.id,
      titulo: "Registro fotográfico do saldo de obra",
    },
  });
  if (!evidenciaExistente) {
    await prisma.evidencia.create({
      data: {
        iniciativaId: iniciativaEdu.id,
        titulo: "Registro fotográfico do saldo de obra",
        descricao: "Evidência declarada, ainda não validada (AT-05)",
        tipo: "FOTO",
        fonte: "Equipe de obras",
        autorNome: "Analista demo",
        status: "A_VERIFICAR",
        urlOuArquivo: "https://cipinteligenciapublica.com.br/",
      },
    });
  }

  // Marco INF guarda-chuva
  const marcoInfra = await prisma.marcoEntrega.findFirst({
    where: {
      iniciativaId: iniciativaAlca.id,
      codigo: "INF-JL-SALDO",
    },
  });
  if (!marcoInfra) {
    await prisma.marcoEntrega.create({
      data: {
        iniciativaId: iniciativaAlca.id,
        equipamentoId: equipamento.id,
        codigo: "INF-JL-SALDO",
        descricao: "Término do saldo obra da Escola João Lima",
        ordem: 1,
        responsavel: "Infraestrutura",
        prazoOriginal: null,
        prazoVigente: null,
      },
    });
  }

  if (process.env.NODE_ENV === "production" && process.env.CIP_ALLOW_DEMO_SEED !== "true") {
    throw new Error(
      "Seed demo bloqueado em produção. Use NODE_ENV≠production ou CIP_ALLOW_DEMO_SEED=true apenas em ambiente isolado.",
    );
  }

  const passwordHash = await bcrypt.hash("Cip@2026", 10);
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { code: "admin" },
  });
  const gestorRole = await prisma.role.findUniqueOrThrow({
    where: { code: "gestor" },
  });
  const analistaRole = await prisma.role.findUniqueOrThrow({
    where: { code: "analista" },
  });
  const prefeitoRole = await prisma.role.findUniqueOrThrow({
    where: { code: "prefeito" },
  });

  const users = [
    {
      email: "admin@cip.local",
      name: "Admin CIP",
      roleId: adminRole.id,
    },
    {
      email: "prefeito@cmd.local",
      name: "Gabinete do Prefeito CMD",
      roleId: prefeitoRole.id,
    },
    {
      email: "gestor@cmd.local",
      name: "Gestor Municipal CMD",
      roleId: gestorRole.id,
    },
    {
      email: "analista@cmd.local",
      name: "Analista Técnico CMD",
      roleId: analistaRole.id,
    },
  ];

  for (const u of users) {
    // Não redefine passwordHash no update — evita resetar senhas em reseed.
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, active: true },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        active: true,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: u.roleId } },
      update: {},
      create: { userId: user.id, roleId: u.roleId },
    });
    await prisma.vinculoUsuarioMunicipio.upsert({
      where: {
        userId_municipioId: { userId: user.id, municipioId: municipio.id },
      },
      update: {
        principal: true,
        ...(u.roleId === gestorRole.id ? { secretariaId: secretarias.GAB } : {}),
      },
      create: {
        userId: user.id,
        municipioId: municipio.id,
        ...(u.roleId === gestorRole.id ? { secretariaId: secretarias.GAB } : {}),
        principal: true,
      },
    });
  }

  // Município B para teste AT-08
  const municipioB = await prisma.municipio.upsert({
    where: { ibgeCode: "3106200" },
    update: {},
    create: {
      nome: "Belo Horizonte",
      uf: "MG",
      ibgeCode: "3106200",
    },
  });
  await prisma.secretaria.upsert({
    where: {
      municipioId_nome: {
        municipioId: municipioB.id,
        nome: "Planejamento Urbano",
      },
    },
    update: {},
    create: {
      municipioId: municipioB.id,
      nome: "Planejamento Urbano",
      sigla: "PUR",
    },
  });

  await ativarModeloPadrao(municipio.id, {
    snapshot: ESTRUTURANTE_PADRAO_MODELO_SNAPSHOT,
    descricao:
      "Projeto estruturante QUIZ_P03+: planejamento, recursos, preparação e operação (licitação, desapropriação, PPA/LOA, custeio).",
    categoria: "Gestão pública",
  });

  console.log("Seed concluído com sucesso.");
  console.log("Usuários demo (senha: Cip@2026):");
  console.log("- admin@cip.local");
  console.log("- prefeito@cmd.local");
  console.log("- gestor@cmd.local");
  console.log("- analista@cmd.local");
  console.log("Modelo ativado: PROJETO_ESTRUTURANTE_PADRAO (sem presets UBS/UPA no wizard)");
  console.log(`CNPJ do órgão CMD: ${CNPJ_CMD}`);
}

type SnapshotModelo = {
  codigo: string;
  nome: string;
  // Estrutura do snapshot varia por modelo; validada pelo motor em @cip/shared.
  perguntas: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  estrutura: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
};

/**
 * Grava catálogo, modelo do município, perguntas e estrutura a partir de um snapshot.
 * Idempotente: reexecutar o seed atualiza o snapshot do modelo já existente.
 */
async function ativarModeloPadrao(
  municipioId: string,
  cfg: { snapshot: SnapshotModelo; descricao: string; categoria: string },
) {
  const snap = cfg.snapshot;

  const catalogo = await prisma.modeloProjetoCatalogo.upsert({
    where: { codigo: snap.codigo },
    update: {
      nome: snap.nome,
      descricao: cfg.descricao,
      categoria: cfg.categoria,
      ativo: true,
      snapshot: snap as object,
    },
    create: {
      codigo: snap.codigo,
      nome: snap.nome,
      descricao: cfg.descricao,
      categoria: cfg.categoria,
      ativo: true,
      snapshot: snap as object,
    },
  });

  const modeloMunicipal = await prisma.modeloProjeto.upsert({
    where: { municipioId_codigo: { municipioId, codigo: snap.codigo } },
    update: {
      nome: snap.nome,
      descricao: cfg.descricao,
      snapshot: snap as object,
    },
    create: {
      municipioId,
      catalogoOrigemId: catalogo.id,
      codigo: snap.codigo,
      nome: snap.nome,
      descricao: cfg.descricao,
      classificacoesPermitidas: ["ESTRUTURANTE"],
      snapshot: snap as object,
      ativo: true,
    },
  });

  for (const p of snap.perguntas) {
    const dados = {
      texto: p.texto,
      tipoResposta: p.tipoResposta,
      impacto: p.impacto,
      obrigatoria: Boolean(p.obrigatoria),
      ordem: p.ordem,
      dependeDeValor: p.dependeDeValor ?? undefined,
      opcoes: p.opcoes ?? undefined,
      efeitos: p.efeitos ?? [],
    };
    await prisma.modeloPergunta.upsert({
      where: {
        modeloId_codigo: { modeloId: modeloMunicipal.id, codigo: p.codigo },
      },
      update: dados,
      create: { modeloId: modeloMunicipal.id, codigo: p.codigo, ...dados },
    });
  }

  // Resolve dependências por código
  for (const p of snap.perguntas) {
    if (!p.dependeDeCodigo) continue;
    const dep = await prisma.modeloPergunta.findUnique({
      where: {
        modeloId_codigo: {
          modeloId: modeloMunicipal.id,
          codigo: p.dependeDeCodigo,
        },
      },
    });
    if (!dep) continue;
    await prisma.modeloPergunta.update({
      where: {
        modeloId_codigo: { modeloId: modeloMunicipal.id, codigo: p.codigo },
      },
      data: { dependeDePerguntaId: dep.id },
    });
  }

  for (const e of snap.estrutura) {
    const dados = {
      nivel: e.nivel,
      parentCodigo: e.parentCodigo ?? null,
      nome: e.nome,
      indicador: e.indicador ?? null,
      alvo: e.alvo ?? null,
      ordem: e.ordem,
      sempreIncluir: Boolean(e.sempreIncluir),
    };
    await prisma.modeloEstruturaItem.upsert({
      where: {
        modeloId_codigo: { modeloId: modeloMunicipal.id, codigo: e.codigo },
      },
      update: dados,
      create: { modeloId: modeloMunicipal.id, codigo: e.codigo, ...dados },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
