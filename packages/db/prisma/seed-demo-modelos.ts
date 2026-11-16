import { PrismaClient } from "@prisma/client";
import { DEMO_MUNICIPIOS } from "./demo-modelos-data";
import { DEMO_ACCOUNTS, DEMO_SELECTOR_ACCOUNT, seedDemoModelos, validateDemoPassword, validateDemoTarget } from "./demo-modelos";

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--apply", "--help"].includes(arg))) {
    throw new Error("Argumento desconhecido. Use --help ou --apply.");
  }
  if (!args.includes("--apply") || args.includes("--help")) {
    console.log("Seed demonstrativo v1 — plano estático, sem conexão com banco.");
    for (const demo of DEMO_MUNICIPIOS) {
      console.log(`${demo.nome}: 5 secretarias, 4 projetos, 4 metas estratégicas, 0 metas de execução, 16 tarefas, 4 indicadores.`);
    }
    console.log("Aplicar: pnpm db:seed:modelos --apply");
    console.log("Exige DEMO_DATABASE_URL local (loopback, sem parâmetros, banco cip_demo_<nome>), DEMO_SEED_CONFIRM (nome do banco) e DEMO_SEED_PASSWORD (16+ caracteres, até 72 bytes).");
    console.log(`Conta com seletor das duas prefeituras: ${DEMO_SELECTOR_ACCOUNT.email} (somente leitura, sem administração central).`);
    console.log("O banco ativo 127.0.0.1:5434/cip não é alvo permitido. Não há fallback para DATABASE_URL ou DIRECT_URL.");
    console.log("Reexecução preserva toda prefeitura existente, sem reparar exclusões nem redefinir senhas.");
    return;
  }
  const datasourceUrl = validateDemoTarget(process.env);
  const password = validateDemoPassword(process.env.DEMO_SEED_PASSWORD);
  const prisma = new PrismaClient({ datasourceUrl });
  try {
    const result = await seedDemoModelos(prisma, password);
    for (const item of result) console.log(`${item.municipio}: ${item.status}`);
    console.log(`Seletor das duas prefeituras: ${DEMO_SELECTOR_ACCOUNT.email} (leitura; conta criada se ausente, preservada se existente e compatível).`);
    console.log("Contas reservadas (não são recriadas se a prefeitura foi preservada):");
    for (const account of DEMO_ACCOUNTS) console.log(account.email);
    console.log("Senha: a informada em DEMO_SEED_PASSWORD na primeira criação; nunca exibida nem redefinida.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Erros Prisma podem conter a URL ou conteúdo da consulta; não imprimir credenciais.
  console.error(error instanceof Error && !error.constructor.name.startsWith("Prisma")
    ? error.message
    : "Falha no banco durante o seed; transação revertida. Verifique conexão, schema aplicado e colisões de identificadores.");
  process.exitCode = 1;
});
