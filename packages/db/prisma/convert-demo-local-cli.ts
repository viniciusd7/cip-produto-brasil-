import { Prisma, PrismaClient } from "@prisma/client";
import {
  conversionConfirmation, convertDemoLocal, validateConversionOptions, validateConversionTarget,
  type ConversionOptions,
} from "./convert-demo-local";

export function parseConversionArgs(args: string[]) {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const names = ["--cmd-id", "--bh-id", "--user-id", "--confirm", "--secretarias"];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (["--apply", "--dry-run", "--help", "--backup-confirmed"].includes(arg)) {
      if (flags.has(arg)) throw new Error(`Argumento repetido: ${arg}`);
      flags.add(arg);
    } else if (names.includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith("--") || values.has(arg)) throw new Error(`Valor ausente/repetido: ${arg}`);
      values.set(arg, value);
    } else {
      throw new Error("Argumento desconhecido. Use --help.");
    }
  }
  if (flags.has("--apply") && flags.has("--dry-run")) throw new Error("Escolha --dry-run ou --apply.");
  let mapping: unknown = {};
  try {
    if (values.has("--secretarias")) mapping = JSON.parse(values.get("--secretarias")!);
  } catch {
    throw new Error("--secretarias deve ser um objeto JSON de chaves de pasta para IDs.");
  }
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping) ||
    Object.values(mapping).some((value) => typeof value !== "string")) {
    throw new Error("--secretarias deve conter somente IDs textuais.");
  }
  const options: ConversionOptions = {
    cmdId: values.get("--cmd-id") || "", bhId: values.get("--bh-id") || "",
    userId: values.get("--user-id") || "",
    secretarias: Object.fromEntries(Object.entries(mapping).map(([key, value]) => [key, String(value)])),
  };
  if (!flags.has("--help")) validateConversionOptions(options);
  return { options, apply: flags.has("--apply"), help: flags.has("--help"),
    backupConfirmed: flags.has("--backup-confirmed"), confirm: values.get("--confirm") };
}

export async function runConversionCli(args: string[], env: NodeJS.ProcessEnv) {
  const parsed = parseConversionArgs(args);
  if (parsed.help) {
    console.log("Conversão local v1: reaproveita IDs existentes; não cria municípios nem usuários.");
    console.log("CONVERT_DATABASE_URL e CONVERT_EXPECT_DATABASE são obrigatórias; .env remoto não é usado.");
    console.log("pnpm db:convert:modelos --cmd-id ID_CMD --bh-id ID_BH --user-id ID_DEMO --dry-run");
    console.log("Opcional: --secretarias '{\"1:CUL\":\"ID_SECRETARIA\"}'");
    console.log("Aplicar exige --apply --backup-confirmed --confirm TOKEN_EXIBIDO_NO_DRY_RUN, com os mesmos IDs/mapeamentos.");
    return;
  }
  const { datasourceUrl, target } = validateConversionTarget(env);
  const confirmation = conversionConfirmation(target, parsed.options);
  if (parsed.apply && (!parsed.backupConfirmed || parsed.confirm !== confirmation)) {
    throw new Error("Aplicação exige backup confirmado e token correto do dry-run com os mesmos IDs, destino e mapeamentos.");
  }
  const prisma = new PrismaClient({ datasourceUrl });
  try {
    const plan = await convertDemoLocal(prisma, parsed.options, parsed.apply);
    console.log(JSON.stringify({ modo: parsed.apply ? "apply" : "dry-run (somente leitura)",
      destino: target, ...plan, confirmacao: confirmation }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

export function reportConversionError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`Falha PostgreSQL/Prisma (${error.code}); nenhuma gravação parcial foi confirmada. Revise conflitos/schema/conexão e repita o dry-run.`);
  } else if (error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError) {
    console.error("Falha de conexão/schema/Prisma; nenhuma gravação parcial foi confirmada. Verifique o banco explicitamente configurado.");
  } else {
    console.error(error instanceof Error ? error.message : "Falha inesperada na conversão; transação não confirmada.");
  }
  process.exitCode = 1;
}
