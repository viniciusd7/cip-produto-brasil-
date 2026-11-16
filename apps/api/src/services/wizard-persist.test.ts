import assert from "node:assert/strict";
import test from "node:test";
import { prisma, type Prisma } from "@cip/db";
import type { TreeNode } from "@cip/shared";
import { persistTree } from "./wizard-persist";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/wizard_tests?connect_timeout=1";
process.env.DIRECT_URL = process.env.DATABASE_URL;

const subtarefa: TreeNode = {
  codigo: "SUB", nome: "Subtarefa", nivel: "SUBTAREFA", children: [],
  origemPerguntaCodigo: "PERGUNTA", origemValor: "sim", responsavel: "Equipe",
  prazo: "2026-12-02",
};
const tarefa: TreeNode = {
  codigo: "TAR", nome: "Tarefa", nivel: "TAREFA", children: [subtarefa],
  origemPerguntaCodigo: "PERGUNTA", origemValor: "sim",
  responsavel: "Pessoa", prazo: "2026-12-01",
};

test("persiste tarefas e subtarefas diretamente sem novas metas", async (t) => {
  const nodes = [tarefa, { ...tarefa, codigo: "DIRETA" }];
  assert.deepEqual(nodes.map((n) => n.codigo), ["TAR", "DIRETA"]);
  assert.deepEqual(nodes[0].children, [subtarefa]);
  const tarefas: Prisma.MarcoEntregaUncheckedCreateInput[] = [];
  const subtarefas: Prisma.SubtarefaUncheckedCreateInput[] = [];
  const origens: Prisma.ItemGeradoOrigemUncheckedCreateInput[] = [];
  const writes: Array<[object, string, unknown]> = [];
  function stub(target: object, method: string, implementation: unknown) {
    writes.push([target, method, Reflect.get(target, method)]);
    Reflect.set(target, method, implementation);
  }
  t.after(() => {
    for (const [target, method, original] of writes) Reflect.set(target, method, original);
  });
  stub(prisma.metaExecucao, "create", async () => assert.fail("Meta nao pode ser criada"));
  stub(prisma.marcoEntrega, "create", async ({ data }: { data: Prisma.MarcoEntregaUncheckedCreateInput }) => {
    tarefas.push(data);
    return { id: `tarefa-${tarefas.length}`, ...data };
  });
  stub(prisma.subtarefa, "create", async ({ data }: { data: Prisma.SubtarefaUncheckedCreateInput }) => {
    subtarefas.push(data);
    return { id: `sub-${subtarefas.length}`, ...data };
  });
  stub(prisma.itemGeradoOrigem, "create", async ({ data }: { data: Prisma.ItemGeradoOrigemUncheckedCreateInput }) => {
    origens.push(data);
    return { id: "origem", ...data };
  });
  await persistTree("projeto", nodes);
  assert.equal(tarefas.length, 2);
  assert.deepEqual(tarefas.map((m) => m.ordem), [0, 1]);
  assert.ok(tarefas.every((m) => m.iniciativaId === "projeto" && !("metaExecucaoId" in m)));
  assert.equal(tarefas[0].responsavel, "Pessoa");
  assert.equal(tarefas[0].prazoOriginal?.toString(), new Date("2026-12-01").toString());
  assert.deepEqual(subtarefas.map((s) => s.marcoId), ["tarefa-1", "tarefa-2"]);
  assert.ok(subtarefas.every((s) => s.responsavel === "Equipe"));
  assert.equal(subtarefas[0].prazo?.toString(), new Date("2026-12-02").toString());
  assert.equal(origens.length, 4);
  assert.ok(origens.every((o) => !o.metaExecucaoId && o.perguntaCodigo === "PERGUNTA"));
  assert.deepEqual(origens.map((o) => o.marcoId || o.subtarefaId), ["tarefa-1", "sub-1", "tarefa-2", "sub-2"]);
});

test("persistencia rejeita arvore invalida antes de gravar qualquer tarefa", async () => {
  await assert.rejects(persistTree("projeto", [
    tarefa,
    subtarefa,
  ]), { status: 422, code: "ESCOPO_INVALIDO" });
});
