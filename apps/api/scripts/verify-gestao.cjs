// Teste integrado local, com municipio e usuarios temporarios.
const assert = require('node:assert/strict');
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Este teste exige banco local');
process.env.VERCEL = '1';
const { prisma } = require('@cip/db');
const { ROLE_PERMISSIONS } = require('@cip/shared');
const { signAccessToken } = require('../dist/middleware/auth');
const app = require('../dist/index').default;
(async () => {
  let municipio, outro, secretaria, analista, gestor, server;
  try {
    const stamp = Date.now();
    municipio = await prisma.municipio.create({ data: { nome: `QA fluxo ${stamp}`, uf: 'MG' } });
    outro = await prisma.municipio.create({ data: { nome: `QA isolamento ${stamp}`, uf: 'MG' } });
    const user = async (role) => prisma.user.create({ data: { name: `QA ${role}`, email: `qa-${role}-${stamp}@example.invalid`, passwordHash: 'not-a-login', roles: { create: { role: { connect: { code: role } } } }, vinculos: { create: { municipioId: municipio.id } } } });
    analista = await user('analista'); gestor = await user('gestor');
    secretaria = await prisma.secretaria.create({ data: { municipioId: municipio.id, nome: 'QA Educacao', titularEmail: gestor.email } });
    const token = (u, role, mid = municipio.id) => signAccessToken({ id: u.id, email: u.email, name: u.name, role, municipioId: mid, municipioNome: 'QA', permissions: ROLE_PERMISSIONS[role] });
    const equipeToken = token(analista, 'analista'), gestorToken = token(gestor, 'gestor');
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    async function request(path, method, body, auth = equipeToken, expected = 200) {
      const r = await fetch(base + path, { method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json(); assert.equal(r.status, expected, JSON.stringify(j)); return j;
    }
    const projeto = (await request('/iniciativas/wizard/confirmar', 'POST', {
      codigo: `QA-${stamp}`, nome: 'Projeto de teste integrado', secretariaPrincipalId: secretaria.id, classificacaoPrincipal: 'PLANO_GOVERNO',
      novaMeta: { nome: 'Ampliar vagas', novoPlanoNome: 'Plano QA 2025-2028' }, novaPessoa: { nome: 'Equipe QA', cargo: 'Analista' }, respostas: [],
      estruturaOverride: [{ codigo: 'META_QA', nivel: 'META', nome: 'Entrega QA', children: [{ codigo: 'TAR_QA', nivel: 'TAREFA', nome: 'Preparar entrega', prazo: '2030-01-10T12:00:00.000Z', children: [] }] }],
    }, equipeToken, 201)).data;
    const salvo = await prisma.iniciativa.findUniqueOrThrow({ where: { id: projeto.id }, include: { metaEstrategica: true, marcos: true } });
    assert.equal(salvo.metaEstrategica.nome, 'Ampliar vagas');
    const tarefa = salvo.marcos[0];
    await request(`/iniciativas/marcos/${tarefa.id}/reprogramar`, 'POST', { dataNova: '2030-02-10T23:59:59.000-03:00', motivo: 'Ajuste de fornecimento com nova entrega' }, equipeToken, 201);
    const revisada = await prisma.marcoEntrega.findUniqueOrThrow({ where: { id: tarefa.id }, include: { reprogramacoes: true } });
    assert.equal(revisada.prazoOriginal.toISOString(), tarefa.prazoOriginal.toISOString());
    assert.equal(revisada.reprogramacoes.length, 1);
    await request(`/iniciativas/marcos/${tarefa.id}/reprogramar`, 'POST', { dataNova: '2030-02-10T23:59:59.000-03:00', motivo: 'Mesma data' }, equipeToken, 422);
    const caixa = (await request('/comunicados', 'GET', null, gestorToken)).data;
    assert.equal(caixa.length, 1); assert.equal(caixa[0].destinatarioId, gestor.id); assert.match(caixa[0].texto, /10\/02\/2030/);
    await request(`/comunicados/${caixa[0].id}/lido`, 'POST', {}, gestorToken);
    assert.equal((await request('/comunicados', 'GET', null, gestorToken)).data[0].leituras.length, 1);
    await request('/comunicados', 'POST', { iniciativaId: projeto.id, destinatarioId: analista.id, texto: 'Confirmar fornecedor e atualizar a tarefa.' }, gestorToken, 201);
    assert.equal((await request('/comunicados', 'GET')).data.length, 1);
    assert.equal((await request(`/comunicados?iniciativaId=${projeto.id}`, 'GET', null, token(gestor, 'gestor', outro.id))).data.length, 0);
    await request('/comunicados', 'POST', { iniciativaId: projeto.id, destinatarioId: analista.id, texto: 'Tentativa de outro municipio' }, token(gestor, 'gestor', outro.id), 403);
    const semPrazo = await prisma.marcoEntrega.create({ data: { iniciativaId: projeto.id, descricao: 'Tarefa sem prazo' } });
    await request(`/iniciativas/marcos/${semPrazo.id}/prazo-inicial`, 'POST', { dataNova: '2030-03-10T23:59:59.000-03:00' }, equipeToken, 201);
    await request(`/iniciativas/marcos/${semPrazo.id}/prazo-inicial`, 'POST', { dataNova: '2030-04-10T23:59:59.000-03:00' }, equipeToken, 409);
    const evidencia = (await request(`/iniciativas/${projeto.id}/evidencias`, 'POST', { titulo: 'Entrega documentada', descricao: 'Registro da atividade para verificar', tipo: 'LINK', urlOuArquivo: 'https://example.invalid/qa', marcoId: tarefa.id }, equipeToken, 201)).data;
    assert.ok((await request('/comunicados', 'GET', null, gestorToken)).data.some((a) => a.tipo === 'EVIDENCIA'));
    await request(`/iniciativas/evidencias/${evidencia.id}/validar`, 'POST', { status: 'REJEITADA', parecer: 'Complementar a comprovação da entrega.' }, gestorToken);
    assert.ok((await request('/comunicados', 'GET')).data.some((a) => a.tipo === 'VALIDACAO'));
    console.log('OK: meta no cadastro, reprogramacao, prazo original, aviso ao secretario, leitura, resposta, prazo inicial, evidencias e isolamento municipal.');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    for (const m of [municipio, outro].filter(Boolean)) {
      await prisma.auditLog.deleteMany({ where: { municipioId: m.id } });
      await prisma.iniciativa.deleteMany({ where: { municipioId: m.id } });
      await prisma.planoGoverno.deleteMany({ where: { municipioId: m.id } });
      await prisma.secretaria.deleteMany({ where: { municipioId: m.id } });
      await prisma.municipio.delete({ where: { id: m.id } });
    }
    for (const u of [analista, gestor].filter(Boolean)) await prisma.user.delete({ where: { id: u.id } });
    await prisma.$disconnect();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
