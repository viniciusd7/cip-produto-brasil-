import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviaProjeto } from "../app/(app)/minha-pasta/novo/previa-projeto";

const props = {
  nome: "Reforma da escola do bairro",
  tipo: "Projeto estruturante",
  secretaria: "Educação",
  outrasSecretarias: ["Obras"],
  responsavel: "Maria Silva",
  meta: "Ampliar o atendimento escolar",
  descricao: "Salas precisam de reparos.",
  entrega: "Salas reformadas para os alunos.",
  beneficiarios: "Alunos do bairro",
  foraEscopo: "Construção de novas salas",
  tarefas: [{
    codigo: "tarefa",
    nivel: "TAREFA" as const,
    nome: "Executar a reforma",
    responsavel: "Equipe de obras",
    prazo: "2026-12-15T12:00:00Z",
    children: [{ codigo: "subtarefa", nivel: "SUBTAREFA" as const, nome: "Conferir materiais", children: [] }],
  }],
  condicoes: [],
  avisos: [],
  avaliacaoPronta: true,
  aguardaPreRequisito: false,
  onEditar() {},
};

test("prévia apresenta os dados preenchidos, responsáveis e prazos sem pontuações automáticas", () => {
  const html = renderToStaticMarkup(<PreviaProjeto {...props} />);
  for (const texto of [props.nome, props.secretaria, "Obras", props.responsavel, props.meta, props.descricao, props.entrega, props.beneficiarios, props.foraEscopo, "Executar a reforma", "Equipe de obras", "15/12/2026", "Conferir materiais", "Ainda não definido", "Sem prazo definido"]) {
    assert.ok(html.includes(texto), texto);
  }
  assert.doesNotMatch(html, /Prontidão|Prioridade|Condições por grupo|Grupo atual|\d+%/);
  for (const acao of ["Editar dados", "Revisar condições", "Editar tarefas"]) assert.ok(html.includes(acao), acao);
});

test("prévia diferencia pré-requisito pendente de condição já atendida e informa a providência", () => {
  const html = renderToStaticMarkup(<PreviaProjeto {...props} aguardaPreRequisito condicoes={[
    { codigo: "licenca", nome: "Licença para a obra", atendida: false, impedeInicio: true, proximaProvidencia: "Solicitar análise técnica", responsavel: "Equipe de engenharia" },
    { codigo: "orcamento", nome: "Dotação confirmada", atendida: true, impedeInicio: true },
  ]} />);
  assert.match(html, /Você pode cadastrar o projeto, mas há pré-requisitos a resolver/);
  for (const texto of ["Licença para a obra", "Solicitar análise técnica", "Equipe de engenharia", "Itens que você informou como atendidos", "Dotação confirmada"]) assert.ok(html.includes(texto), texto);
  assert.doesNotMatch(html, /Nenhum pré-requisito pendente/);
});

test("pendência sem bloqueio não é apresentada como impedimento para iniciar o projeto", () => {
  const html = renderToStaticMarkup(<PreviaProjeto {...props} condicoes={[
    { codigo: "acompanhamento", nome: "Reunião de alinhamento", atendida: false, impedeInicio: false },
  ]} />);
  assert.match(html, /Você informou os itens abaixo como pendentes/);
  assert.match(html, /Item informado como pendente/);
  assert.doesNotMatch(html, /não impedem o início/);
  assert.doesNotMatch(html, /Resolver antes de iniciar/);
});

test("ausência de avaliação ou respostas obrigatórias não produz mensagem de que não há pendências", () => {
  const semAvaliacao = renderToStaticMarkup(<PreviaProjeto {...props} avaliacaoPronta={false} />);
  assert.match(semAvaliacao, /Volte à etapa anterior/);
  assert.doesNotMatch(semAvaliacao, /Nenhum pré-requisito pendente/);
  const comAviso = renderToStaticMarkup(<PreviaProjeto {...props} avisos={["Responda: É necessário licitar?"]} />);
  assert.match(comAviso, /Confira as informações que ainda faltam/);
  assert.match(comAviso, /Responda: É necessário licitar/);
  assert.doesNotMatch(comAviso, /Nenhum pré-requisito pendente/);
});

test("prévia identifica nova meta e plano e orienta como incluir tarefas", () => {
  const html = renderToStaticMarkup(<PreviaProjeto {...props} tarefas={[]} meta="Nova meta escolar" novoPlano="Plano 2025–2028" />);
  assert.match(html, /Nova meta escolar/);
  assert.match(html, /Plano 2025–2028/);
  assert.match(html, /Nenhuma tarefa adicionada/);
  assert.match(html, /Nenhum pré-requisito pendente foi identificado nas respostas informadas/);
});
