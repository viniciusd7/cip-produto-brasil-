import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { prisma } from "@cip/db";
import { signAccessToken } from "../middleware/auth";
import { errorHandler } from "../middleware/error";
import { execucaoRouter } from "./execucao";
import { iniciativasRouter } from "./iniciativas";
process.env.DATABASE_URL="postgresql://test:test@127.0.0.1:1/secretario_tests?connect_timeout=1";
process.env.DIRECT_URL=process.env.DATABASE_URL;
async function setup(t: TestContext) {
 const projeto={id:"projeto",codigo:"QA",nome:"QA",municipioId:"cidade",secretariaPrincipalId:"saude",secretarias:[]};
 const marco={id:"tarefa",iniciativaId:projeto.id,descricao:"Tarefa QA",prazoOriginal:new Date("2030-01-01T12:00:00Z"),prazoVigente:new Date("2030-01-01T12:00:00Z"),concluidoEm:null as Date|null,encerradoSemSolucaoEm:null as Date|null,iniciativa:projeto};
 const sub={id:"sub",marcoId:marco.id,descricao:"Etapa QA",concluida:false,marco};
 const pedidos:Array<Record<string,unknown>>=[];const historico:Array<Record<string,unknown>>=[];const avisos:Array<Record<string,unknown>>=[];let conflito=false;let falharEvidencia=false;const arquivos:Array<Record<string,unknown>>=[];
 function stub(target:object,key:string,fn:unknown){const old=Reflect.get(target,key);Reflect.set(target,key,fn);t.after(()=>{Reflect.set(target,key,old)});}
 stub(prisma.user,"findUnique",async()=>({active:true,isPlatformAdmin:false}));
 stub(prisma.municipio,"findFirst",async()=>({id:"cidade",nome:"QA"}));stub(prisma.municipio,"findUnique",async()=>({consultorResponsavelId:null}));
 stub(prisma.vinculoUsuarioMunicipio,"findUnique",async()=>({roleCode:"gestor",secretariaId:"saude"}));stub(prisma.vinculoUsuarioMunicipio,"findMany",async()=>[{userId:"consultor"}]);
 stub(prisma.iniciativa,"findUnique",async()=>projeto);
 stub(prisma.iniciativa,"findUniqueOrThrow",async()=>({...projeto,ciclo:"EM_EXECUCAO",secretariaPrincipal:{titularEmail:null}}));
 stub(prisma.comunicado,"create",async()=>({id:"aviso"}));
 stub(prisma.evidencia,"create",async({data}:{data:Record<string,unknown>})=>{if(falharEvidencia)throw new Error("Persistência simulada");const row={id:"arquivo",...data};arquivos.push(row);return row});
 stub(prisma.evidencia,"findUnique",async()=>({...arquivos[0],iniciativa:projeto}));
 stub(prisma.iniciativa,"findFirst",async()=>projeto);stub(prisma.marcoEntrega,"findUnique",async()=>({...marco}));stub(prisma.marcoEntrega,"findUniqueOrThrow",async()=>({...marco}));stub(prisma.subtarefa,"findUnique",async()=>sub);
 stub(prisma.marcoEntrega,"updateMany",async({data}:{data:object})=>{if(conflito)return {count:0};Object.assign(marco,data);return {count:1}});
 stub(prisma.reprogramacao,"create",async({data}:{data:Record<string,unknown>})=>{historico.push(data);return {id:"r",...data}});
 stub(prisma.solicitacaoValidacao,"findFirst",async()=>pedidos[0]||null);
 stub(prisma.solicitacaoValidacao,"create",async({data}:{data:Record<string,unknown>})=>{const row={id:"pedido",status:"ABERTA",...data};pedidos.push(row);return row});
 stub(prisma.evidencia,"findFirst",async({where}:{where:Record<string,unknown>})=>{assert.deepEqual(where.OR,[{marcoId:null},{marcoId:"tarefa"}]);return where.id==="valida"?{id:"valida"}:null});
 stub(prisma.notificacao,"create",async({data}:{data:Record<string,unknown>})=>{avisos.push(data);return {id:"aviso",...data}});stub(prisma.auditLog,"create",async()=>({}));
 stub(prisma,"$transaction",async(fn:(tx:typeof prisma)=>unknown)=>fn(prisma));
 const token=signAccessToken({id:"secretario",email:"qa@example.invalid",name:"QA",municipioId:"cidade",municipioNome:"QA",role:"gestor",secretariaId:"saude",isPlatformAdmin:false,permissions:[]});
 const app=express();app.use(express.json());app.use("/execucao",execucaoRouter);app.use("/iniciativas",iniciativasRouter);app.use(errorHandler);const server=app.listen(0,"127.0.0.1");t.after(()=>new Promise<void>(resolve=>{server.close(()=>resolve());server.closeIdleConnections()}));await new Promise<void>(resolve=>server.once("listening",resolve));const address=server.address();assert.ok(address&&typeof address!=="string");const port=address.port;
 async function request(path:string,body:object={}){const r=await fetch(`http://127.0.0.1:${port}${path}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});return {status:r.status,json:await r.json()};}
 async function upload(form:FormData){return fetch(`http://127.0.0.1:${port}/iniciativas/projeto/evidencias`,{method:"POST",headers:{Authorization:`Bearer ${token}`},body:form});}
 async function download(){return fetch(`http://127.0.0.1:${port}/iniciativas/evidencias/arquivo/arquivo`,{headers:{Authorization:`Bearer ${token}`}});}
 return {request,upload,download,arquivos,falharEvidencia:()=>{falharEvidencia=true},projeto,marco,sub,pedidos,historico,avisos,conflito:()=>{conflito=true}};
}
const pedido={entidadeTipo:"MARCO",entidadeId:"tarefa",justificativa:"Entrega realizada para conferência",evidenciaId:"valida"};
test("secretário solicita conclusão com evidência e notifica consultor sem concluir tarefa",async t=>{const c=await setup(t);const r=await c.request("/execucao/solicitacoes",pedido);assert.equal(r.status,201,JSON.stringify(r.json));assert.equal(c.pedidos.length,1);assert.equal(c.marco.concluidoEm,null);assert.equal(c.avisos[0].userId,"consultor");assert.equal(c.avisos[0].tipo,"VALIDACAO_PENDENTE");assert.equal((await c.request("/execucao/solicitacoes",pedido)).status,409)});
test("subtarefa de tarefa concluída ou encerrada não gera novo pedido",async t=>{const c=await setup(t);for(const campo of ["concluidoEm","encerradoSemSolucaoEm"] as const){c.marco[campo]=new Date();assert.equal((await c.request("/execucao/solicitacoes",{...pedido,entidadeTipo:"SUBTAREFA",entidadeId:"sub"})).status,422);c.marco[campo]=null;}assert.equal(c.pedidos.length,0);assert.equal(c.avisos.length,0)});
test("evidência de outra tarefa é rejeitada sem gerar solicitação",async t=>{const c=await setup(t);assert.equal((await c.request("/execucao/solicitacoes",{...pedido,evidenciaId:"outra-tarefa"})).status,422);assert.equal(c.pedidos.length,0)});
test("secretário não decide pedido nem conclui diretamente nem cria projeto",async t=>{const c=await setup(t);for(const path of ["/execucao/solicitacoes/pedido/decidir","/iniciativas/marcos/tarefa/concluir","/iniciativas"]){assert.equal((await c.request(path,{resultado:"APROVADA",parecer:"Aprovado"})).status,403);}assert.equal(c.marco.concluidoEm,null)});
test("secretário reprograma sua pasta, preserva original e avisa consultor",async t=>{const c=await setup(t);const r=await c.request("/execucao/marcos/tarefa/reprogramar",{dataNova:"2030-02-01T12:00:00Z",motivo:"Reprogramação justificada"});assert.equal(r.status,201,JSON.stringify(r.json));assert.equal(c.marco.prazoOriginal.toISOString(),"2030-01-01T12:00:00.000Z");assert.equal(c.historico.length,1);assert.equal(c.avisos[0].userId,"consultor")});
test("reprogramação valida data, motivo, encerramento e concorrência",async t=>{const c=await setup(t);for(const body of [{dataNova:"2020-01-01T12:00:00Z",motivo:"Justificativa suficiente"},{dataNova:"2030-01-01T12:00:00Z",motivo:"Justificativa suficiente"}])assert.equal((await c.request("/execucao/marcos/tarefa/reprogramar",body)).status,422);assert.equal((await c.request("/execucao/marcos/tarefa/reprogramar",{dataNova:"2030-02-01T12:00:00Z",motivo:"  "})).status,400);c.conflito();assert.equal((await c.request("/execucao/marcos/tarefa/reprogramar",{dataNova:"2030-02-01T12:00:00Z",motivo:"Justificativa suficiente"})).status,409);assert.equal(c.historico.length,0)});
test("pasta alheia ou secretaria desvinculada não recebe ações do secretário",async t=>{const c=await setup(t);c.projeto.secretariaPrincipalId="obras";for(const path of ["/execucao/solicitacoes","/execucao/marcos/tarefa/reprogramar"]){assert.equal((await c.request(path,{...pedido,dataNova:"2030-02-01T12:00:00Z",motivo:"Justificativa suficiente"})).status,403);}assert.equal(c.pedidos.length,0);assert.equal(c.historico.length,0)});

function storageSimulado(t:TestContext){
 const original=globalThis.fetch;const pdf=Buffer.from("%PDF-1.4\nQA-secretario\n%%EOF");let uploads=0;let removidos=0;
 for(const [key,value] of Object.entries({SUPABASE_URL:"https://storage.example.invalid",SUPABASE_SERVICE_ROLE_KEY:"qa-server-only",SUPABASE_KNOWLEDGE_BUCKET:"qa"})){const old=process.env[key];process.env[key]=value;t.after(()=>{if(old===undefined)delete process.env[key];else process.env[key]=old})}
 t.mock.method(globalThis,"fetch",async(input:Parameters<typeof fetch>[0],init?:RequestInit)=>{if(String(input).startsWith("https://storage.example.invalid/")){assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer qa-server-only");if(init?.method==="POST"){uploads++;return Response.json({Key:"qa"})}if(init?.method==="DELETE"){removidos++;return Response.json({})}return new Response(pdf)}return original(input,init)});
 const form=()=>{const f=new FormData();f.set("arquivo",new Blob([pdf],{type:"application/pdf"}),"QA-secretario.pdf");f.set("titulo","Evidência de teste");f.set("descricao","Entrega fictícia para validação");return f};
 return {pdf,form,uploads:()=>uploads,removidos:()=>removidos};
}
test("secretário envia e recupera evidência privada persistente sem revelar chave ao cliente",async t=>{
 const c=await setup(t);const storage=storageSimulado(t);const response=await c.upload(storage.form());assert.equal(response.status,201,JSON.stringify(await response.clone().json()));const json=await response.json();assert.match(String(c.arquivos[0].urlOuArquivo),/^supabase:cidade\//);assert.doesNotMatch(JSON.stringify(json),/qa-server-only/);const download=await c.download();assert.equal(download.status,200);assert.equal(download.headers.get("cache-control"),"private, no-store");assert.deepEqual(Buffer.from(await download.arrayBuffer()),storage.pdf);c.projeto.secretariaPrincipalId="obras";assert.equal((await c.download()).status,403);assert.equal(storage.uploads(),1);
});
test("arquivo de evidência sem registro é removido se a persistência falhar",async t=>{
 const c=await setup(t);const storage=storageSimulado(t);c.falharEvidencia();t.mock.method(console,"error",()=>{});assert.equal((await c.upload(storage.form())).status,500);assert.equal(c.arquivos.length,0);assert.equal(storage.removidos(),1);
});
