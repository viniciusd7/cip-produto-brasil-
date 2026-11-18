import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ListaIndicadoresEstrategicos, ResumoMetaEstrategica } from "../app/(app)/iniciativas/[id]/metas-indicadores";

test("apresenta apenas os indicadores efetivamente vinculados à meta estratégica", () => {
  const html = renderToStaticMarkup(<ListaIndicadoresEstrategicos indicadores={[
    { id: "indicador-1", nome: "Atendimentos", unidade: "pessoas", valorBase: "0", alvo: "500", valorAtual: "120" },
  ]} />);
  assert.match(html, /Atendimentos/);
  assert.match(html, /<dt>Ponto de partida<\/dt><dd[^>]*><span>0<\/span><small>pessoas<\/small>/);
  assert.match(html, /<dt>Resultado esperado<\/dt><dd[^>]*><span>500<\/span><small>pessoas<\/small>/);
  assert.match(html, /<dt>Valor atual informado<\/dt><dd[^>]*><span>120<\/span><small>pessoas<\/small>/);
  assert.equal((html.match(/<article /g) ?? []).length, 1);
  assert.doesNotMatch(html, /O valor atual ainda não foi informado/);
});

test("zero é um valor informado e ausência de informação não vira zero", () => {
  const zero = renderToStaticMarkup(<ListaIndicadoresEstrategicos indicadores={[{ id: "zero", nome: "Atendimentos", valorAtual: "0" }]} />);
  assert.match(zero, /<dt>Valor atual informado<\/dt><dd[^>]*><span>0<\/span>/);
  assert.doesNotMatch(zero, /O valor atual ainda não foi informado/);
  const vazio = renderToStaticMarkup(<ListaIndicadoresEstrategicos indicadores={[{ id: "vazio", nome: "Atendimentos", valorBase: " ", valorAtual: null, alvo: "" }]} />);
  assert.equal((vazio.match(/<span>Não informado<\/span>/g) ?? []).length, 3);
  assert.match(vazio, /O valor atual ainda não foi informado/);
  assert.doesNotMatch(vazio, /<span>0<\/span>|progressbar/);
});

test("preserva unidades já escritas no valor e textos sem duplicá-los", () => {
  const html = renderToStaticMarkup(<ListaIndicadoresEstrategicos indicadores={[
    { id: "percentual", nome: "Cobertura", unidade: "%", valorAtual: "25%" },
    { id: "texto", nome: "Situação", unidade: "etapas", valorAtual: "Em implantação" },
  ]} />);
  assert.match(html, /<span>25%<\/span><\/dd>/);
  assert.match(html, /<span>Em implantação<\/span><\/dd>/);
  assert.doesNotMatch(html, /<small>%<\/small>|<small>etapas<\/small>/);
});

test("não inventa percentuais de progresso nem situação para metas de redução", () => {
  const html = renderToStaticMarkup(<ListaIndicadoresEstrategicos indicadores={[
    { id: "espera", nome: "Tempo de espera", unidade: "dias", valorBase: "30", valorAtual: "20", alvo: "10", periodicidade: "MENSAL" },
  ]} />);
  for (const valor of ["30", "20", "10"]) assert.ok(html.includes(`<span>${valor}</span>`), valor);
  assert.match(html, /Mensal/);
  assert.doesNotMatch(html, /progressbar|\d+%|Meta atingida|Atrasado|Concluído/);
});

test("mantém a frequência descritiva cadastrada e apresenta orientação quando não há indicadores", () => {
  const html = renderToStaticMarkup(<ListaIndicadoresEstrategicos indicadores={[
    { id: "frequencia", nome: "Atendimentos", periodicidade: "A cada trimestre (SUS)" },
  ]} />);
  assert.match(html, /A cada trimestre \(SUS\)/);
  const vazio = renderToStaticMarkup(<ListaIndicadoresEstrategicos indicadores={[]} />);
  assert.match(vazio, /Nenhum indicador cadastrado/);
  assert.match(vazio, /como o resultado da meta será acompanhado/);
  assert.doesNotMatch(vazio, /<article|<dd/);
});

test("destaca o objetivo estratégico e sua descrição sem confundi-los com um indicador", () => {
  const html = renderToStaticMarkup(<ResumoMetaEstrategica nome="Ampliar o acesso à saúde" descricao="Atender mais famílias do município." />);
  assert.match(html, /Meta que este projeto ajuda a alcançar/);
  assert.match(html, /Ampliar o acesso à saúde/);
  assert.match(html, /Atender mais famílias do município/);
  assert.doesNotMatch(html, /Valor atual|progressbar|\d+%/);
});
