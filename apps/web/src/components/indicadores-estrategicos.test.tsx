import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ListaIndicadoresEstrategicos } from "../app/(app)/iniciativas/[id]/metas-indicadores";

test("apresenta apenas os indicadores efetivamente vinculados à meta estratégica", () => {
  const html = renderToStaticMarkup(<ListaIndicadoresEstrategicos indicadores={[
    { id: "indicador-1", nome: "Atendimentos", unidade: "pessoas", valorBase: "0", alvo: "500", valorAtual: "120" },
  ]} />);
  assert.match(html, /Atendimentos/);
  assert.match(html, /Unidade: pessoas/);
  assert.match(html, /Base: 0/);
  assert.match(html, /Alvo: 500/);
  assert.match(html, /Atual: 120/);
  assert.equal((html.match(/<li>/g) ?? []).length, 1);
  assert.match(renderToStaticMarkup(<ListaIndicadoresEstrategicos indicadores={[]} />), /Nenhum indicador cadastrado/);
});
