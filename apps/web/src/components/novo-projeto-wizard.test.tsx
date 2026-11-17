import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { NovoProjetoWizard } from "../app/(app)/minha-pasta/novo/novo-projeto-wizard";

const router = {
  bfcacheId: "teste",
  back() {}, forward() {}, refresh() {}, hmrRefresh() {},
  push() {}, replace() {}, prefetch() {},
};

test("prefeitura sem modelo ativo não derruba a renderização inicial dos fluxos estruturantes", () => {
  for (const classificacao of ["ESTRUTURANTE", "PRIORITARIO"] as const) {
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={router}>
        <NovoProjetoWizard
          token="token-de-teste"
          usuarioId="usuario"
          municipioId="municipio-sem-modelo"
          initialClassification={classificacao}
          secretarias={[]}
          modelos={[]}
          metas={[]}
          planos={[]}
        />
      </AppRouterContext.Provider>,
    );
    assert.match(html, /Carregando rascunho/);
    assert.doesNotMatch(html, /token-de-teste/);
  }
});
