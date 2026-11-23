import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { prisma } from "@cip/db";
import { signAccessToken } from "../middleware/auth";
import { errorHandler } from "../middleware/error";
import { iniciativasRouter } from "./iniciativas";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/tarefas_tests?connect_timeout=1";
process.env.DIRECT_URL = process.env.DATABASE_URL;
async function setup(t: TestContext, role: "analista" | "leitura" = "analista") {
  const iniciativa = { id: "projeto", municipioId: "municipio", codigo: "QA", nome: "QA", ciclo: "EM_EXECUCAO" };
  const marco = { id: "marco", iniciativaId: "projeto", descricao: "Tarefa QA", responsavelUserId: "consultor", concluidoEm: null as Date | null, encerradoSemSolucaoEm: null as Date | null, prazoOriginal: new Date("2030-01-01T12:00:00Z"), prazoVigente: new Date("2030-01-01T12:00:00Z"), iniciativa };
  const sub = { id: "sub", marcoId: "marco", descricao: "Subtarefa QA", responsavelUserId: "consultor", concluida: false, marco };
  let escritas = 0;
  const historico: Array<Record<string, unknown>> = [];
  function stub(target: object, method: string, fn: unknown) { const old=Reflect.get(target,method); Reflect.set(target,method,fn);t.after(()=>{Reflect.set(target,method,old)}); }
  stub(prisma.user,"findUnique",async()=>({active:true,isPlatformAdmin:false}));
  stub(prisma.municipio,"findFirst",async()=>({id:"municipio",nome:"QA"}));
  stub(prisma.vinculoUsuarioMunicipio,"findUnique",async()=>({roleCode:role,secretariaId:null}));
  stub(prisma.marcoEntrega,"findUnique",async()=>({...marco}));
  stub(prisma.marcoEntrega,"updateMany",async({data}: {data:object})=>{escritas++;Object.assign(marco,data);return {count:1}});
  stub(prisma.reprogramacao,"create",async({data}: {data:Record<string, unknown>})=>{historico.push(data);return {id:"reprog",...data}});
  stub(prisma.iniciativa,"findUniqueOrThrow",async()=>({...iniciativa,secretariaPrincipal:{titularEmail:null}}));
  stub(prisma.comunicado,"create",async()=>({id:"aviso"}));
  stub(prisma.subtarefa,"findUnique",async()=>sub);
  stub(prisma.auditLog,"create",async()=>({}));
  stub(prisma.marcoEntrega,"update",async({data}: {data:object})=>{escritas++;Object.assign(marco,data);return {...marco}});
  stub(prisma.subtarefa,"update",async({data}: {data:object})=>{escritas++;Object.assign(sub,data);return {...sub}});
  stub(prisma.subtarefa,"create",async({data}: {data:object})=>{escritas++;return {id:"nova",...data}});
  stub(prisma.subtarefa,"updateMany",async()=>{escritas++;sub.concluida=true;return {count:1}});
  stub(prisma,"$transaction",async(run:(tx:typeof prisma)=>unknown)=>run(prisma));
  const app=express();app.use(express.json());app.use("/iniciativas",iniciativasRouter);app.use(errorHandler);
  const server=app.listen(0,"127.0.0.1");t.after(()=>new Promise<void>(resolve=>{server.close(()=>resolve());server.closeIdleConnections()}));
  await new Promise<void>(resolve=>server.once("listening",resolve));const address=server.address();assert.ok(address&&typeof address!=="string");const port=address.port;
  const token=signAccessToken({id:"consultor",email:"qa@example.invalid",name:"QA",municipioId:"municipio",municipioNome:"QA",role,isPlatformAdmin:false,permissions:[]});
  async function request(path:string,body:object={},method="POST") {const r=await fetch(`http://127.0.0.1:${port}/iniciativas${path}`,{method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});return {status:r.status,json:await r.json()};}
  return {request,marco,sub,iniciativa,historico,escritas:()=>escritas};
}
test("consultor conclui tarefa e subtarefas; reabre a principal antes de reabrir a subtarefa",async t=>{
 const c=await setup(t);
 assert.equal((await c.request("/marcos/marco/concluir")).status,200);assert.ok(c.marco.concluidoEm);assert.equal(c.sub.concluida,true);
 assert.equal((await c.request("/subtarefas/sub",{concluida:false},"PATCH")).status,422);assert.equal(c.sub.concluida,true);
 assert.equal((await c.request("/marcos/marco/subtarefas",{descricao:"Novo passo"})).status,422);
 assert.equal((await c.request("/marcos/marco/reabrir")).status,200);
 assert.equal((await c.request("/subtarefas/sub",{concluida:false},"PATCH")).status,200);assert.equal(c.sub.concluida,false);
 assert.equal((await c.request("/marcos/marco/subtarefas",{descricao:"Novo passo"})).status,201);
});
test("tarefas encerradas sem solução também protegem suas subtarefas e prazos",async t=>{
 const c=await setup(t);c.marco.encerradoSemSolucaoEm=new Date();
 for(const [path,body,method] of [["/subtarefas/sub",{concluida:true},"PATCH"],["/marcos/marco/subtarefas",{descricao:"Novo passo"},"POST"],["/marcos/marco/reprogramar",{dataNova:"2030-02-01T12:00:00Z",motivo:"Revisar cronograma"},"POST"]] as const) assert.equal((await c.request(path,body,method)).status,422);
 assert.equal(c.escritas(),0);
});
test("consultor não reprograma tarefa de outro executor",async t=>{
 const c=await setup(t);c.marco.responsavelUserId="outra-pessoa";
 const r=await c.request("/marcos/marco/reprogramar",{dataNova:"2030-02-01T12:00:00Z",motivo:"Revisar cronograma"});assert.equal(r.status,403);assert.equal(r.json.error.code,"EXECUTOR_REQUIRED");assert.equal(c.escritas(),0);
});
test("projeto com pré-requisito pendente impede conclusão e preserva os dados",async t=>{
 const c=await setup(t);c.iniciativa.ciclo="AGUARDANDO_PRE_REQUISITO";
 assert.equal((await c.request("/marcos/marco/concluir")).status,422);assert.equal((await c.request("/subtarefas/sub",{concluida:true},"PATCH")).status,422);assert.equal(c.escritas(),0);
});
test("perfil de leitura não altera o ciclo da tarefa",async t=>{
 const c=await setup(t,"leitura");for(const acao of ["concluir","reabrir"])assert.equal((await c.request(`/marcos/marco/${acao}`)).status,403);assert.equal(c.escritas(),0);
});

test("reprogramação do executor preserva prazo original e registra data anterior e justificativa",async t=>{
 const c=await setup(t);const original=c.marco.prazoOriginal.toISOString();
 const r=await c.request("/marcos/marco/reprogramar",{dataNova:"2030-02-01T12:00:00Z",motivo:"  Ajustar cronograma da entrega  "});
 assert.equal(r.status,201,JSON.stringify(r.json));assert.equal(c.marco.prazoOriginal.toISOString(),original);assert.equal(c.marco.prazoVigente.toISOString(),"2030-02-01T12:00:00.000Z");
 assert.equal(c.historico.length,1);assert.equal((c.historico[0].dataAnterior as Date).toISOString(),original);assert.equal(c.historico[0].motivo,"Ajustar cronograma da entrega");
});
