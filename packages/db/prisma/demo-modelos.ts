import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createDemoProjects, DEMO_MUNICIPIOS, demoId, municipioData } from "./demo-modelos-data";

export function validateDemoTarget(env: NodeJS.ProcessEnv): string {
  if (env.NODE_ENV === "production") {
    throw new Error("Seed demonstrativo bloqueado com NODE_ENV=production.");
  }
  if (!env.DEMO_DATABASE_URL) {
    throw new Error("Informe DEMO_DATABASE_URL de um banco isolado. DATABASE_URL e DIRECT_URL não são usados.");
  }
  let url: URL;
  try {
    url = new URL(env.DEMO_DATABASE_URL);
  } catch {
    throw new Error("DEMO_DATABASE_URL inválida.");
  }
  const database = url.pathname.slice(1);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("Seed permitido somente em PostgreSQL local (127.0.0.1, localhost ou [::1]), sem parâmetros de conexão ou fragmentos.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !/^cip_demo_[a-z0-9_]+$/.test(database) ||
    env.DEMO_SEED_CONFIRM !== database
  ) {
    throw new Error("Use banco dedicado cip_demo_<nome> e DEMO_SEED_CONFIRM igual ao nome do banco.");
  }
  return env.DEMO_DATABASE_URL;
}

export function validateDemoPassword(password: string | undefined): string {
  if (!password || password.trim().length < 16 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Informe DEMO_SEED_PASSWORD com pelo menos 16 caracteres e no máximo 72 bytes.");
  }
  return password;
}

export const DEMO_ACCOUNTS = DEMO_MUNICIPIOS.map((demo) => ({
  id: demoId(demo.numero, "prefeito"),
  email: `prefeito@modelo${demo.numero}.example.test`,
  name: `Gabinete demonstrativo Modelo ${demo.numero}`,
  municipioId: demoId(demo.numero, "municipio"),
}));

export const DEMO_SELECTOR_ACCOUNT = {
  id: "cip-demo-modelos-v1-visualizacao",
  email: "demo@modelos.example.test",
  name: "Demonstração — Prefeituras Modelo 1 e 2",
};

async function ensureSelectorAccount(tx: Prisma.TransactionClient, passwordHash: string) {
  const municipioIds = DEMO_MUNICIPIOS.map((demo) => demoId(demo.numero, "municipio"));
  const activeMunicipios = await tx.municipio.count({
    where: { id: { in: municipioIds }, active: true },
  });
  if (activeMunicipios !== municipioIds.length) {
    throw new Error("Prefeitura demonstrativa inativa: seletor indisponível. Nenhum dado foi reativado ou sobrescrito.");
  }
  const existing = await tx.user.findFirst({
    where: {
      OR: [
        { id: DEMO_SELECTOR_ACCOUNT.id },
        { email: { equals: DEMO_SELECTOR_ACCOUNT.email, mode: "insensitive" } },
      ],
    },
    include: { vinculos: true },
  });
  if (existing) {
    if (
      existing.id !== DEMO_SELECTOR_ACCOUNT.id ||
      existing.email !== DEMO_SELECTOR_ACCOUNT.email ||
      !existing.active ||
      existing.isPlatformAdmin ||
      existing.vinculos.length !== municipioIds.length ||
      !municipioIds.every((municipioId) => existing.vinculos.some(
        (vinculo) => vinculo.municipioId === municipioId &&
          vinculo.roleCode === "leitura" && vinculo.secretariaId === null,
      ))
    ) {
      throw new Error("Conta do seletor ocupada, inativa ou com vínculos alterados. Nada foi sobrescrito; revise os acessos manualmente.");
    }
    return;
  }
  await tx.user.create({
    data: {
      ...DEMO_SELECTOR_ACCOUNT,
      passwordHash,
      isPlatformAdmin: false,
      vinculos: {
        create: municipioIds.map((municipioId, index) => ({
          municipioId,
          roleCode: "leitura",
          principal: index === 0,
        })),
      },
    },
  });
}

export async function seedDemoModelos(prisma: PrismaClient, password: string) {
  const passwordHash = await bcrypt.hash(validateDemoPassword(password), 12);
  return prisma.$transaction(async (tx) => {
    // O lock serializa somente este seed; colisões externas ainda causam rollback.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7611601)`;
    const result: Array<{ municipio: string; status: "criado" | "preservado" }> = [];
    for (const demo of DEMO_MUNICIPIOS) {
      const municipioId = demoId(demo.numero, "municipio");
      const existing = await tx.municipio.findUnique({ where: { id: municipioId } });
      if (existing) {
        if (existing.ibgeCode !== null || existing.cnpjOrgao !== null) {
          throw new Error(`Identificador demo ocupado por município com IBGE/CNPJ: Modelo ${demo.numero}. Nada foi alterado.`);
        }
        result.push({ municipio: existing.nome, status: "preservado" });
        continue;
      }
      const collision = await tx.municipio.findFirst({ where: { nome: demo.nome } });
      if (collision) {
        throw new Error(`Já existe ${demo.nome} fora do namespace deste seed. Nada foi alterado.`);
      }
      const account = DEMO_ACCOUNTS[demo.numero - 1];
      const userCollision = await tx.user.findFirst({
        where: { OR: [{ id: account.id }, { email: { equals: account.email, mode: "insensitive" } }] },
      });
      if (userCollision) {
        throw new Error(`Conta demonstrativa já ocupada para Modelo ${demo.numero}. Nenhum acesso foi concedido.`);
      }
      await tx.municipio.create({ data: municipioData(demo) });
      await createDemoProjects(tx, demo);
      await tx.user.create({
        data: {
          id: account.id,
          email: account.email,
          name: account.name,
          passwordHash,
          isPlatformAdmin: false,
          vinculos: {
            create: { municipioId, roleCode: "prefeito", principal: true },
          },
        },
      });
      result.push({ municipio: demo.nome, status: "criado" });
    }
    await ensureSelectorAccount(tx, passwordHash);
    return result;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    maxWait: 10000,
    timeout: 60000,
  });
}
