import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_MUNICIPIOS, DEMO_REFERENCE, demoId, municipioData } from "./demo-modelos-data";
import { DEMO_ACCOUNTS, DEMO_SELECTOR_ACCOUNT, seedDemoModelos, validateDemoPassword, validateDemoTarget } from "./demo-modelos";

const password = "Somente-para-teste-2026!";
const target = {
  DEMO_DATABASE_URL: "postgresql://demo:password@127.0.0.1:5432/cip_demo_test_modelos",
  DEMO_SEED_CONFIRM: "cip_demo_test_modelos",
};

test("alvo exige URL exclusiva, nome dedicado e confirmação; produção é bloqueada", () => {
  assert.equal(validateDemoTarget(target), target.DEMO_DATABASE_URL);
  for (const env of [
    {},
    { DATABASE_URL: target.DEMO_DATABASE_URL, DIRECT_URL: target.DEMO_DATABASE_URL },
    { ...target, NODE_ENV: "production" },
    { ...target, DEMO_SEED_CONFIRM: "outro_banco" },
    { ...target, DEMO_DATABASE_URL: "postgresql://localhost/cip_gestao" },
    { ...target, DEMO_DATABASE_URL: "mysql://localhost/cip_demo_test_modelos" },
    { ...target, DEMO_DATABASE_URL: "url-invalida" },
    { ...target, DEMO_DATABASE_URL: "postgresql://localhost/cip_demo_test_modelos/outro" },
  ]) {
    assert.throws(() => validateDemoTarget(env));
  }
});

test("senha não é fixa e respeita limite do bcrypt", () => {
  assert.equal(validateDemoPassword(password), password);
  for (const value of [undefined, "", "curta", " ".repeat(20), "a".repeat(73), "á".repeat(37)]) {
    assert.throws(() => validateDemoPassword(value));
  }
});

test("somente loopback é permitido e o banco ativo cip é bloqueado antes de conectar", () => {
  for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
    const url = `postgresql://${host}:55439/cip_demo_test_modelos`;
    assert.equal(validateDemoTarget({ ...target, DEMO_DATABASE_URL: url }), url);
  }
  for (const url of [
    "postgresql://127.0.0.1:5434/cip",
    "postgresql://localhost:5434/cip",
    "postgresql://[::1]:5434/cip",
    "postgresql://db.example.test/cip_demo_test_modelos",
    "postgresql://192.168.1.10/cip_demo_test_modelos",
    "postgresql://localhost.example.test/cip_demo_test_modelos",
    "postgresql://127.0.0.1/cip_demo_test_modelos?host=db.example.test",
    "postgresql://127.0.0.1/cip_demo_test_modelos?schema=outro",
    "postgresql://127.0.0.1/cip_demo_test_modelos#fragmento",
  ]) {
    assert.throws(() => validateDemoTarget({
      DEMO_DATABASE_URL: url,
      DEMO_SEED_CONFIRM: new URL(url).pathname.slice(1),
    }));
  }
});

test("fixtures não se identificam como municípios reais", () => {
  for (const demo of DEMO_MUNICIPIOS) {
    const data = municipioData(demo);
    assert.equal(data.nome, `Prefeitura Modelo ${demo.numero}`);
    assert.equal(data.ibgeCode, null);
    assert.equal(data.cnpjOrgao, null);
    assert.match(String(data.id), /^cip-demo-modelos-v1-/);
  }
});

test("plano e argumentos inválidos não usam DATABASE_URL nem expõem segredos", () => {
  const env = {
    ...process.env,
    DATABASE_URL: "postgresql://nao-conectar:segredo@127.0.0.1:1/existente",
    DIRECT_URL: "postgresql://nao-conectar:segredo@127.0.0.1:1/existente",
    DEMO_DATABASE_URL: "",
    DEMO_SEED_PASSWORD: "segredo-nao-exibir",
  };
  const invoke = (...args: string[]) => spawnSync(
    process.execPath,
    ["--import", "tsx", "prisma/seed-demo-modelos.ts", ...args],
    { encoding: "utf8", env },
  );
  const plan = invoke();
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /sem conexão/);
  assert.match(plan.stdout, /Prefeitura Modelo 2/);
  assert.match(plan.stdout, /4 metas estratégicas, 0 metas de execução, 16 tarefas, 4 indicadores/);
  assert.match(plan.stdout, /demo@modelos.example.test/);
  const invalid = invoke("--reset");
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Argumento desconhecido/);
  const missingTarget = invoke("--apply");
  assert.notEqual(missingTarget.status, 0);
  assert.match(missingTarget.stderr, /DEMO_DATABASE_URL/);
  assert.doesNotMatch(plan.stdout + invalid.stderr + missingTarget.stderr, /segredo/);
});

async function snapshot(db: PrismaClient) {
  return JSON.stringify(await Promise.all([
    db.municipio.findMany({ orderBy: { id: "asc" } }),
    db.secretaria.findMany({ orderBy: { id: "asc" } }),
    db.secretariaPessoa.findMany({ orderBy: { id: "asc" } }),
    db.planoGoverno.findMany({ orderBy: { id: "asc" } }),
    db.metaEstrategica.findMany({ orderBy: { id: "asc" } }),
    db.iniciativa.findMany({ orderBy: { id: "asc" } }),
    db.iniciativaClassificacao.findMany({ orderBy: { id: "asc" } }),
    db.iniciativaSecretaria.findMany({ orderBy: { id: "asc" } }),
    db.metaExecucao.findMany({ orderBy: { id: "asc" } }),
    db.marcoEntrega.findMany({ orderBy: { id: "asc" } }),
    db.subtarefa.findMany({ orderBy: { id: "asc" } }),
    db.indicador.findMany({ orderBy: { id: "asc" } }),
    db.medicao.findMany({ orderBy: { id: "asc" } }),
    db.impedimento.findMany({ orderBy: { id: "asc" } }),
    db.decisaoProvidencia.findMany({ orderBy: { id: "asc" } }),
    db.evidencia.findMany({ orderBy: { id: "asc" } }),
    db.user.findMany({ orderBy: { id: "asc" } }),
    db.vinculoUsuarioMunicipio.findMany({ orderBy: { id: "asc" } }),
    db.role.findMany({ orderBy: { id: "asc" } }),
    db.permission.findMany({ orderBy: { id: "asc" } }),
    db.rolePermission.findMany({ orderBy: [{ roleId: "asc" }, { permissionId: "asc" }] }),
    db.userRole.findMany({ orderBy: [{ userId: "asc" }, { roleId: "asc" }] }),
  ]));
}

test("integração em PostgreSQL descartável", {
  skip: !process.env.DEMO_TEST_DATABASE_URL && "Informe DEMO_TEST_DATABASE_URL de um banco descartável vazio.",
}, async (t) => {
  const datasourceUrl = validateDemoTarget({
    DEMO_DATABASE_URL: process.env.DEMO_TEST_DATABASE_URL,
    DEMO_SEED_CONFIRM: process.env.DEMO_TEST_CONFIRM,
    NODE_ENV: process.env.NODE_ENV,
  });
  assert.match(new URL(datasourceUrl).pathname, /^\/cip_demo_test_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl });
  try {
    assert.equal(await db.municipio.count(), 0, "O teste exige banco vazio; não reutilize uma base existente.");
    assert.equal(await db.user.count(), 0, "O teste exige banco vazio.");

    await t.test("colisão com conta existente não concede privilégios e reverte ambas as prefeituras", async () => {
      await db.user.create({
        data: { id: "sentinela-usuario", email: DEMO_ACCOUNTS[1].email, name: "Não alterar", passwordHash: "sentinela" },
      });
      const before = await snapshot(db);
      await assert.rejects(seedDemoModelos(db, password), /Conta demonstrativa já ocupada/);
      assert.equal(await snapshot(db), before);
      await db.user.delete({ where: { id: "sentinela-usuario" } });
    });

    await t.test("conta do seletor ocupada não é reaproveitada e reverte a criação das prefeituras", async () => {
      await db.user.create({
        data: { id: "sentinela-seletor", email: DEMO_SELECTOR_ACCOUNT.email, name: "Não alterar", passwordHash: "sentinela" },
      });
      const before = await snapshot(db);
      await assert.rejects(seedDemoModelos(db, password), /Conta do seletor ocupada/);
      assert.equal(await snapshot(db), before);
      await db.user.delete({ where: { id: "sentinela-seletor" } });
    });

    await t.test("colisão por nome não renomeia nem se apropria de município existente", async () => {
      await db.municipio.create({ data: { id: "sentinela-nome", nome: "Prefeitura Modelo 2", uf: "MG" } });
      const before = await snapshot(db);
      await assert.rejects(seedDemoModelos(db, password), /fora do namespace/);
      assert.equal(await snapshot(db), before);
      await db.municipio.delete({ where: { id: "sentinela-nome" } });
    });

    await t.test("IDs internos ocupados causam rollback, nunca upsert ou reconexão", async () => {
      await db.municipio.create({ data: { id: "sentinela-id", nome: "Município sentinela", uf: "MG" } });
      await db.secretaria.create({
        data: { id: demoId(2, "secretaria-EDU"), municipioId: "sentinela-id", nome: "Não alterar" },
      });
      const before = await snapshot(db);
      await assert.rejects(seedDemoModelos(db, password));
      assert.equal(await snapshot(db), before);
      await db.municipio.delete({ where: { id: "sentinela-id" } });
    });

    await t.test("raiz com identificador real é conflito, não uma prefeitura demonstrativa", async () => {
      await db.municipio.create({
        data: { id: demoId(1, "municipio"), nome: "Não renomear", uf: "MG", ibgeCode: "3117504" },
      });
      const before = await snapshot(db);
      await assert.rejects(seedDemoModelos(db, password), /IBGE\/CNPJ/);
      assert.equal(await snapshot(db), before);
      await db.municipio.delete({ where: { id: demoId(1, "municipio") } });
    });

    await t.test("uma raiz existente é preservada integralmente e somente a outra é criada", async () => {
      const root = await db.municipio.create({
        data: { id: demoId(1, "municipio"), nome: "Demonstração editada", uf: "MG" },
      });
      assert.deepEqual((await seedDemoModelos(db, password)).map((r) => r.status), ["preservado", "criado"]);
      assert.deepEqual(await db.municipio.findUnique({ where: { id: root.id } }), root);
      assert.equal(await db.secretaria.count({ where: { municipioId: root.id } }), 0);
      assert.equal(await db.user.count({ where: { id: DEMO_ACCOUNTS[0].id } }), 0);
      await db.municipio.delete({ where: { id: root.id } });
      await db.municipio.delete({ where: { id: demoId(2, "municipio") } });
      await db.user.delete({ where: { id: DEMO_ACCOUNTS[1].id } });
      await db.user.delete({ where: { id: DEMO_SELECTOR_ACCOUNT.id } });
    });

    await t.test("cria dados completos sem tocar municípios reais ou RBAC global", async () => {
      await db.municipio.createMany({
        data: [
          { id: "real-cmd", nome: "Conceição do Mato Dentro", uf: "MG", ibgeCode: "3117504" },
          { id: "real-bh", nome: "Belo Horizonte", uf: "MG", ibgeCode: "3106200" },
        ],
      });
      await db.role.create({ data: { id: "sentinela-role", code: "leitura", name: "Nome editado" } });
      const realBefore = await db.municipio.findMany({ where: { id: { in: ["real-cmd", "real-bh"] } }, orderBy: { id: "asc" } });
      const runs = await Promise.all([seedDemoModelos(db, password), seedDemoModelos(db, password)]);
      assert.deepEqual(runs.map((run) => run.map((r) => r.status).join(",")).sort(), [
        "criado,criado", "preservado,preservado",
      ]);
      assert.deepEqual(await db.municipio.findMany({ where: { id: { in: ["real-cmd", "real-bh"] } }, orderBy: { id: "asc" } }), realBefore);
      assert.equal((await db.role.findUniqueOrThrow({ where: { id: "sentinela-role" } })).name, "Nome editado");
      assert.equal(await db.permission.count(), 0);

      for (const demo of DEMO_MUNICIPIOS) {
        const municipioId = demoId(demo.numero, "municipio");
        const projects = await db.iniciativa.findMany({
          where: { municipioId },
          include: {
            secretariaPrincipal: true, responsavelPessoa: true,
            metaEstrategica: { include: { plano: true } },
            classificacoes: true, metasExecucao: true,
            marcos: { include: { subtarefas: true } },
          },
        });
        assert.equal(await db.secretaria.count({ where: { municipioId } }), 5);
        assert.equal(projects.length, 4);
        assert.equal(await db.metaEstrategica.count({ where: { plano: { municipioId } } }), 4);
        const classes = new Set(projects.flatMap((p) => p.classificacoes.map((c) => c.classificacao)));
        assert.deepEqual([...classes].sort(), ["ACAO_DIARIA", "ESTRUTURANTE", "PLANO_GOVERNO", "PRIORITARIO"]);
        const statuses = new Set<string>();
        for (const project of projects) {
          assert.equal(project.secretariaPrincipal.municipioId, municipioId);
          assert.equal(project.responsavelPessoa?.secretariaId, project.secretariaPrincipalId);
          assert.equal(project.metaEstrategica?.plano.municipioId, municipioId);
          assert.equal(project.estruturante, project.classificacoes.some((c) => c.classificacao === "ESTRUTURANTE"));
          assert.equal(project.vinculoPlanoGoverno, project.classificacoes.some((c) => c.classificacao === "PLANO_GOVERNO"));
          assert.ok(project.classificacoes.some((c) => c.classificacao === project.classificacaoPrincipal));
          assert.equal(project.metasExecucao.length, 0);
          assert.equal(project.marcos.length, 4);
          for (const task of project.marcos) {
            assert.equal(task.iniciativaId, project.id);
            assert.equal(task.metaExecucaoId, null);
            assert.equal(task.subtarefas.length, 2);
            assert.deepEqual(task.prazoOriginal, task.prazoVigente);
            statuses.add(task.concluidoEm ? "CONCLUIDO" : !task.prazoVigente ? "SEM_PRAZO" : task.prazoVigente < DEMO_REFERENCE ? "VENCIDO" : "NO_PRAZO");
          }
        }
        assert.deepEqual([...statuses].sort(), ["CONCLUIDO", "NO_PRAZO", "SEM_PRAZO", "VENCIDO"]);
        assert.equal(await db.indicador.count({ where: { municipioId } }), 4);
        assert.equal(await db.medicao.count({ where: { municipioId } }), 12);
        const user = await db.user.findUniqueOrThrow({
          where: { id: demoId(demo.numero, "prefeito") }, include: { vinculos: true },
        });
        assert.equal(user.isPlatformAdmin, false);
        assert.equal(user.vinculos.length, 1);
        assert.equal(user.vinculos[0].municipioId, municipioId);
        assert.equal(user.vinculos[0].roleCode, "prefeito");
        assert.ok(await bcrypt.compare(password, user.passwordHash));
      }
    });

    await t.test("reexecução e concorrência não alteram nenhum registro", async () => {
      const before = await snapshot(db);
      const results = await Promise.all([seedDemoModelos(db, password), seedDemoModelos(db, password)]);
      assert.ok(results.flat().every((r) => r.status === "preservado"));
      assert.equal(await snapshot(db), before);
    });

    await t.test("conta do seletor acessa somente as duas prefeituras, sem papel prefeito ou admin", async () => {
      const user = await db.user.findUniqueOrThrow({
        where: { id: DEMO_SELECTOR_ACCOUNT.id }, include: { vinculos: true },
      });
      assert.equal(user.email, DEMO_SELECTOR_ACCOUNT.email);
      assert.equal(user.isPlatformAdmin, false);
      assert.ok(await bcrypt.compare(password, user.passwordHash));
      assert.deepEqual(user.vinculos.map((v) => v.municipioId).sort(),
        DEMO_MUNICIPIOS.map((demo) => demoId(demo.numero, "municipio")).sort());
      assert.ok(user.vinculos.every((v) => v.roleCode === "leitura" && v.secretariaId === null));
      assert.equal(user.vinculos.filter((v) => v.principal).length, 1);
    });

    await t.test("bases do seed anterior recebem apenas a nova conta do seletor", async () => {
      await db.user.delete({ where: { id: DEMO_SELECTOR_ACCOUNT.id } });
      const before = await snapshot(db);
      assert.ok((await seedDemoModelos(db, password)).every((r) => r.status === "preservado"));
      const user = await db.user.findUniqueOrThrow({
        where: { id: DEMO_SELECTOR_ACCOUNT.id }, include: { vinculos: true },
      });
      assert.equal(user.vinculos.length, 2);
      await db.user.delete({ where: { id: user.id } });
      assert.equal(await snapshot(db), before);
      await seedDemoModelos(db, password);
    });

    await t.test("edições, exclusões, senha e vínculos individuais não são restaurados", async () => {
      await db.municipio.update({ where: { id: demoId(1, "municipio") }, data: { nome: "Nome editado pelo usuário" } });
      await db.iniciativa.update({ where: { id: demoId(1, "projeto-0") }, data: { nome: "Projeto editado", ciclo: "SUSPENSA" } });
      await db.marcoEntrega.delete({ where: { id: demoId(1, "tarefa-0-0") } });
      await db.user.update({ where: { id: DEMO_ACCOUNTS[0].id }, data: { passwordHash: "senha-editada", active: false } });
      await db.user.update({ where: { id: DEMO_SELECTOR_ACCOUNT.id }, data: { name: "Conta editada", passwordHash: "hash-editado" } });
      await db.vinculoUsuarioMunicipio.deleteMany({ where: { userId: DEMO_ACCOUNTS[1].id } });
      const before = await snapshot(db);
      assert.ok((await seedDemoModelos(db, "Outra-senha-nao-aplicar!")).every((r) => r.status === "preservado"));
      assert.equal(await snapshot(db), before);
    });

    await t.test("não reativa prefeitura desativada e informa seletor indisponível", async () => {
      await db.municipio.update({ where: { id: demoId(1, "municipio") }, data: { active: false } });
      const before = await snapshot(db);
      await assert.rejects(seedDemoModelos(db, password), /Prefeitura demonstrativa inativa/);
      assert.equal(await snapshot(db), before);
      await db.municipio.update({ where: { id: demoId(1, "municipio") }, data: { active: true } });
    });

    await t.test("não restaura vínculo removido do seletor e informa conflito sem gravar", async () => {
      await db.vinculoUsuarioMunicipio.deleteMany({
        where: { userId: DEMO_SELECTOR_ACCOUNT.id, municipioId: demoId(2, "municipio") },
      });
      const before = await snapshot(db);
      await assert.rejects(seedDemoModelos(db, password), /vínculos alterados/);
      assert.equal(await snapshot(db), before);
    });
  } finally {
    await db.$disconnect();
  }
});
