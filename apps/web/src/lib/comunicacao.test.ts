import assert from "node:assert/strict";
import { test } from "node:test";
import { criarEnvioId, linkInternoAviso } from "./comunicacao";

test("avisos mantêm caminhos locais e recusam redirecionamentos externos disfarçados", () => {
 for (const path of ["/iniciativas/projeto?aba=andamento", "/comunicados?projeto=qa"]) assert.equal(linkInternoAviso(path), path);
 for (const path of [null, undefined, "", "https://externo.example", "//externo.example", "/\\externo.example", "/\t/externo.example", "javascript:alert(1)"]) assert.equal(linkInternoAviso(path), null);
});
test("chaves de envio são UUIDs distintos mesmo sem exigir contexto HTTPS", () => {
 const ids=Array.from({length:100},()=>criarEnvioId());
 assert.equal(new Set(ids).size,100);
 for (const id of ids) assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});
