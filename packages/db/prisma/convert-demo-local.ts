import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  createDemoProjects, DEMO_MUNICIPIOS, demoPlano, demoSecretarias,
  type DemoIdResolver,
} from "./demo-modelos-data";

const VERSION = "CONVERT_DEMO_LOCAL_V1";
const ORIGINAL_NAMES = ["Conceição do Mato Dentro", "Belo Horizonte"];
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export const conversionPrefix = (municipioId: string) =>
  `cip-conv-local-v1-${createHash("sha256").update(municipioId).digest("hex").slice(0, 24)}-`;
export const conversionMarkerId = (municipioId: string) => `${conversionPrefix(municipioId)}aplicacao`;

export interface ConversionOptions {
  cmdId: string;
  bhId: string;
  userId: string;
  secretarias: Record<string, string>;
}

export function validateConversionOptions(options: ConversionOptions) {
  for (const id of [options.cmdId, options.bhId, options.userId, ...Object.values(options.secretarias)]) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
      throw new Error("IDs explícitos devem conter de 1 a 128 letras, números, hífen ou sublinhado.");
    }
  }
  if (options.cmdId === options.bhId) throw new Error("Os IDs municipais devem ser distintos.");
  const keys = DEMO_MUNICIPIOS.flatMap((demo) =>
    [...demo.projetos.map((p) => `${demo.numero}:${p.sigla}`), `${demo.numero}:PLA`]);
  if (Object.keys(options.secretarias).some((key) => !keys.includes(key))) {
    throw new Error("Mapeamento de secretaria desconhecido. Use chaves 1:EDU/SAU/INF/CUL/PLA ou 2:EDU/SAU/MOB/SUR/PLA.");
  }
}

export function validateConversionTarget(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV === "production") throw new Error("Conversão bloqueada com NODE_ENV=production.");
  let url: URL;
  try {
    url = new URL(env.CONVERT_DATABASE_URL || "");
  } catch {
    throw new Error("Informe CONVERT_DATABASE_URL explícita. Não há fallback para DATABASE_URL/DIRECT_URL.");
  }
  const database = url.pathname.slice(1);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.search || url.hash ||
    !/^[a-z][a-z0-9_]{0,62}$/.test(database) ||
    env.CONVERT_EXPECT_DATABASE !== database
  ) {
    throw new Error("Exige PostgreSQL local direto, sem parâmetros/fragmentos, e CONVERT_EXPECT_DATABASE igual ao banco explícito.");
  }
  return {
    datasourceUrl: env.CONVERT_DATABASE_URL!,
    target: `${url.hostname}:${url.port || "5432"}/${database}`,
  };
}

export function conversionConfirmation(target: string, options: ConversionOptions) {
  validateConversionOptions(options);
  const mapping = Object.entries(options.secretarias).sort(([a], [b]) => a.localeCompare(b));
  const digest = createHash("sha256").update(JSON.stringify({
    target, cmdId: options.cmdId, bhId: options.bhId, userId: options.userId, secretarias: mapping,
  })).digest("hex");
  return `CONVERTER-${digest.slice(0, 24)}`;
}

type SecretariaPlan = { key: string; id: string; nome: string; sigla: string; criar: boolean };
type MunicipioPlan = {
  numero: number; id: string; nomeAtual: string; nomeNovo: string;
  projetosAtuais: number; secretariasAtuais: number; projetosAdicionar: number;
  secretarias: SecretariaPlan[];
};
export interface ConversionPlan {
  status: "planejado" | "aplicado" | "ja-aplicado";
  userId: string;
  municipios: MunicipioPlan[];
  vinculosAdicionar: string[];
  avisos: string[];
}

function isRecord(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function assertFreeNamespace(tx: Prisma.TransactionClient, municipioId: string) {
  const where = { id: { startsWith: conversionPrefix(municipioId) } };
  const occupied = await Promise.all([
    tx.secretaria.count({ where }), tx.secretariaPessoa.count({ where }),
    tx.planoGoverno.count({ where }), tx.metaEstrategica.count({ where }),
    tx.iniciativa.count({ where }), tx.metaExecucao.count({ where }),
    tx.marcoEntrega.count({ where }), tx.indicador.count({ where }),
    tx.medicao.count({ where }), tx.impedimento.count({ where }),
    tx.auditLog.count({ where }),
  ]);
  if (occupied.some((count) => count > 0)) {
    throw new Error("Namespace de conversão ocupado sem marcador válido. Não recriar nem sobrescrever registros.");
  }
}

async function inspectConversion(tx: Prisma.TransactionClient, options: ConversionOptions): Promise<ConversionPlan> {
  const ids = [options.cmdId, options.bhId];
  const markers = await tx.auditLog.findMany({ where: { id: { in: ids.map(conversionMarkerId) } } });
  if (markers.length && (
    markers.length !== 2 ||
    markers.some((marker) => marker.action !== VERSION || marker.entity !== "DemoLocalConversion" ||
      marker.entityId !== marker.municipioId || !ids.includes(marker.municipioId || "") ||
      marker.id !== conversionMarkerId(marker.municipioId || "") ||
      !isRecord(marker.after) || marker.after.version !== 1 || marker.after.cmdId !== options.cmdId ||
      marker.after.bhId !== options.bhId || marker.after.userId !== options.userId)
  )) {
    throw new Error("Marcador parcial, ocupado ou mapeamento diferente da conversão anterior. Nada será alterado.");
  }
  const applied = markers.length === 2;
  const municipios = await tx.municipio.findMany({
    where: { id: { in: ids } },
    include: { secretarias: true, _count: { select: { iniciativas: true } } },
  });
  if (municipios.length !== 2) throw new Error("Um dos IDs municipais explícitos não existe.");
  const user = await tx.user.findUnique({ where: { id: options.userId }, include: { vinculos: true } });
  if (!user) throw new Error("A conta demo deve existir e ser identificada por ID. Nenhum usuário será criado.");
  const avisos = [
    "Renomear não anonimiza IBGE/CNPJ, contatos, documentos ou dados preservados.",
    "Nenhum usuário, senha, papel ou vínculo existente será atualizado ou removido.",
  ];
  const vinculosAdicionar: string[] = [];
  if (applied) {
    if (!user.active || user.isPlatformAdmin || user.vinculos.some((v) => v.roleCode === "prefeito") ||
      ids.some((id) => !user.vinculos.some((v) => v.municipioId === id)) ||
      municipios.some((m) => !m.active)) {
      avisos.push("Acesso/seletor alterado ou indisponível após a carga; nada será restaurado automaticamente.");
    }
    if (Object.keys(options.secretarias).length) {
      avisos.push("Carga já aplicada: mapeamentos de secretaria não serão reaplicados.");
    }
  } else {
    if (!user.active || user.isPlatformAdmin || user.vinculos.some((v) => v.roleCode === "prefeito")) {
      throw new Error("Conta demo deve estar ativa, sem administração central e sem perfil prefeito. Nenhum papel será convertido.");
    }
    for (const municipioId of ids) {
      const membership = user.vinculos.find((v) => v.municipioId === municipioId);
      if (!membership) vinculosAdicionar.push(municipioId);
      else if (!["leitura", "analista", "gestor"].includes(membership.roleCode) ||
        (membership.roleCode === "gestor" && !municipios.find((m) => m.id === municipioId)
          ?.secretarias.some((s) => s.id === membership.secretariaId && s.active))) {
        throw new Error("Vínculo existente incompatível com o seletor. Revise manualmente; nenhum acesso será sobrescrito.");
      }
    }
  }
  const plans: MunicipioPlan[] = [];
  for (const [index, demo] of DEMO_MUNICIPIOS.entries()) {
    const municipioId = ids[index];
    const municipio = municipios.find((m) => m.id === municipioId)!;
    const secretarias: SecretariaPlan[] = [];
    if (!applied) {
      if (!municipio.active || municipio.uf !== "MG" || municipio.nome !== ORIGINAL_NAMES[index]) {
        throw new Error(`ID de Modelo ${demo.numero} não corresponde ao município original ativo/MG esperado. Nenhuma renomeação por aproximação.`);
      }
      const duplicates = await tx.municipio.count({
        where: { id: { notIn: ids }, nome: { in: [demo.nome, ORIGINAL_NAMES[index]], mode: "insensitive" } },
      });
      if (duplicates) throw new Error("Município original/Modelo duplicado fora dos IDs aprovados. Resolva manualmente.");
      await assertFreeNamespace(tx, municipioId);
      if (await tx.iniciativa.count({
        where: { municipioId, codigo: { in: demo.projetos.map((p) => `DEMO-M${demo.numero}-${p.sigla}-01`) } },
      })) {
        throw new Error("Código de projeto demonstrativo já ocupado; não reaproveitar nem sobrescrever projeto.");
      }
      const definitions = [...demo.projetos.map((p) => ({ nome: p.secretaria, sigla: p.sigla })),
        { nome: "Planejamento", sigla: "PLA" }];
      for (const definition of definitions) {
        const key = `${demo.numero}:${definition.sigla}`;
        const explicit = options.secretarias[key];
        const candidates = municipio.secretarias.filter((s) =>
          explicit ? s.id === explicit : normalized(s.nome) === normalized(definition.nome) ||
            (s.sigla && normalized(s.sigla) === normalized(definition.sigla)));
        if (explicit && candidates.length !== 1) throw new Error(`Secretaria ${key} não pertence ao município aprovado.`);
        if (candidates.length > 1 || (candidates[0] && (!candidates[0].active ||
          (!explicit && (normalized(candidates[0].nome) !== normalized(definition.nome) ||
            (candidates[0].sigla && normalized(candidates[0].sigla) !== normalized(definition.sigla))))))) {
          throw new Error(`Secretaria ${key} ambígua, inativa ou nome/sigla divergente. Informe mapeamento explícito de ID ativo.`);
        }
        secretarias.push({
          key, id: candidates[0]?.id || `${conversionPrefix(municipioId)}secretaria-${definition.sigla}`,
          nome: candidates[0]?.nome || definition.nome, sigla: definition.sigla, criar: !candidates[0],
        });
      }
      if (new Set(secretarias.map((s) => s.id)).size !== secretarias.length) {
        throw new Error("Uma secretaria foi mapeada para mais de uma pasta demonstrativa.");
      }
    }
    plans.push({
      numero: demo.numero, id: municipioId, nomeAtual: municipio.nome, nomeNovo: demo.nome,
      projetosAtuais: municipio._count.iniciativas, secretariasAtuais: municipio.secretarias.length,
      projetosAdicionar: applied ? 0 : demo.projetos.length, secretarias,
    });
  }
  return { status: applied ? "ja-aplicado" : "planejado", userId: user.id, municipios: plans, vinculosAdicionar, avisos };
}

export async function convertDemoLocal(
  prisma: PrismaClient,
  options: ConversionOptions,
  apply = false,
): Promise<ConversionPlan> {
  validateConversionOptions(options);
  return prisma.$transaction(async (tx) => {
    if (!apply) {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    } else {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7611602)`;
      await tx.$queryRaw`SELECT id FROM "Municipio" WHERE id IN (${options.cmdId}, ${options.bhId}) ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${options.userId} FOR UPDATE`;
    }
    const plan = await inspectConversion(tx, options);
    if (!apply || plan.status === "ja-aplicado") return plan;
    for (const [index, municipio] of plan.municipios.entries()) {
      const demo = DEMO_MUNICIPIOS[index];
      const id: DemoIdResolver = (item) => item === "municipio" ? municipio.id
        : item.startsWith("secretaria-")
          ? municipio.secretarias.find((s) => s.sigla === item.slice("secretaria-".length))!.id
          : `${conversionPrefix(municipio.id)}${item}`;
      const definitions = demoSecretarias(demo, id);
      for (const secretaria of municipio.secretarias) {
        if (secretaria.criar) {
          const definition = definitions.find((s) => s.id === secretaria.id)!;
          await tx.secretaria.create({ data: { ...definition, municipio: { connect: { id: municipio.id } } } });
        } else if (secretaria.sigla !== "PLA") {
          await tx.secretariaPessoa.create({
            data: {
              id: id(`pessoa-${secretaria.sigla}`), secretariaId: secretaria.id,
              nome: `Equipe fictícia de ${secretaria.nome}`, cargo: "Coordenação demonstrativa", papel: "EQUIPE",
            },
          });
        }
      }
      await tx.planoGoverno.create({
        data: { ...demoPlano(demo, id), municipio: { connect: { id: municipio.id } } },
      });
      await createDemoProjects(tx, demo, id);
      await tx.municipio.update({ where: { id: municipio.id }, data: { nome: municipio.nomeNovo } });
    }
    const existingMemberships = await tx.vinculoUsuarioMunicipio.count({ where: { userId: options.userId } });
    for (const [index, municipioId] of plan.vinculosAdicionar.entries()) {
      await tx.vinculoUsuarioMunicipio.create({
        data: { userId: options.userId, municipioId, roleCode: "leitura", principal: existingMemberships === 0 && index === 0 },
      });
    }
    for (const municipio of plan.municipios) {
      await tx.auditLog.create({
        data: {
          id: conversionMarkerId(municipio.id), action: VERSION, entity: "DemoLocalConversion",
          municipioId: municipio.id, entityId: municipio.id,
          before: { nome: municipio.nomeAtual, projetos: municipio.projetosAtuais, secretarias: municipio.secretariasAtuais },
          after: {
            version: 1, cmdId: options.cmdId, bhId: options.bhId, userId: options.userId,
            nome: municipio.nomeNovo, projetosAdicionados: municipio.projetosAdicionar,
            secretarias: municipio.secretarias, vinculosAdicionados: plan.vinculosAdicionar,
          },
        },
      });
    }
    return { ...plan, status: "aplicado" };
  }, {
    isolationLevel: apply ? Prisma.TransactionIsolationLevel.ReadCommitted : Prisma.TransactionIsolationLevel.RepeatableRead,
    timeout: 60000, maxWait: 10000,
  });
}
