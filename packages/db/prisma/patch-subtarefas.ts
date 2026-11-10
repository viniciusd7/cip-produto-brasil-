import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const marco = await p.marcoEntrega.findFirst({ where: { codigo: "EDU-001" } });
  if (marco) {
    const n = await p.subtarefa.count({ where: { marcoId: marco.id } });
    if (!n) {
      await p.subtarefa.createMany({
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
      console.log("subtarefas EDU-001 criadas");
    } else {
      console.log("EDU-001 já tinha", n);
    }
  }
  const cul = await p.marcoEntrega.findFirst({ where: { codigo: "CUL-015" } });
  if (cul) {
    const n = await p.subtarefa.count({ where: { marcoId: cul.id } });
    if (!n) {
      await p.subtarefa.create({
        data: {
          marcoId: cul.id,
          descricao: "Contratar equipe de restauro especializada",
          responsavel: "Cultura",
          concluida: false,
        },
      });
      console.log("subtarefa CUL-015 criada");
    }
  }
  await p.$disconnect();
}

main();
