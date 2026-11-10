import type { Prisma, PrismaClient } from "@cip/db";

type Db = PrismaClient | Prisma.TransactionClient;

export async function syncTitularFieldsFromPessoa(
  db: Db,
  secretariaId: string,
) {
  const titular = await db.secretariaPessoa.findFirst({
    where: { secretariaId, papel: "TITULAR", ativo: true },
    orderBy: { updatedAt: "desc" },
  });

  await db.secretaria.update({
    where: { id: secretariaId },
    data: {
      titularNome: titular?.nome ?? null,
      titularCargo: titular?.cargo ?? null,
      titularTelefone: titular?.telefone ?? null,
      titularEmail: titular?.email ?? null,
    },
  });

  return titular;
}

/** Promove pessoa a TITULAR e rebaixa o titular anterior para EQUIPE. */
export async function promoteToTitular(
  db: Db,
  secretariaId: string,
  pessoaId: string,
) {
  await db.secretariaPessoa.updateMany({
    where: {
      secretariaId,
      papel: "TITULAR",
      ativo: true,
      NOT: { id: pessoaId },
    },
    data: { papel: "EQUIPE" },
  });

  const pessoa = await db.secretariaPessoa.update({
    where: { id: pessoaId },
    data: { papel: "TITULAR", ativo: true },
  });

  await syncTitularFieldsFromPessoa(db, secretariaId);
  return pessoa;
}

/** Mantém SecretariaPessoa TITULAR alinhada aos campos titular* da Secretaria. */
export async function upsertTitularFromSecretariaFields(
  db: Db,
  secretariaId: string,
  fields: {
    titularNome?: string | null;
    titularCargo?: string | null;
    titularTelefone?: string | null;
    titularEmail?: string | null;
  },
) {
  const nome = fields.titularNome?.trim();
  if (!nome) {
    await db.secretariaPessoa.updateMany({
      where: { secretariaId, papel: "TITULAR", ativo: true },
      data: { ativo: false, papel: "EQUIPE" },
    });
    return null;
  }

  const existing = await db.secretariaPessoa.findFirst({
    where: { secretariaId, papel: "TITULAR", ativo: true },
  });

  const cargo = fields.titularCargo?.trim() || "Titular";
  const telefone = fields.titularTelefone?.trim() || null;
  const email = fields.titularEmail?.trim() || null;

  if (existing) {
    return db.secretariaPessoa.update({
      where: { id: existing.id },
      data: { nome, cargo, telefone, email, ativo: true },
    });
  }

  return db.secretariaPessoa.create({
    data: {
      secretariaId,
      nome,
      cargo,
      telefone,
      email,
      papel: "TITULAR",
      ativo: true,
    },
  });
}
