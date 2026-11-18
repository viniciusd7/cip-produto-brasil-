import assert from "node:assert/strict";
import test from "node:test";
import { getMobileNavForRole, mobileNavActive } from "./mobile-navigation";
import { getNavForRole } from "./roles";

test("atalhos mobile respeitam a navegação autorizada de cada perfil", () => {
  for (const role of ["prefeito", "gestor", "funcionario", "analista", "admin", "leitura", undefined, "desconhecido"]) {
    const mobile = getMobileNavForRole(role);
    const allowed = new Set(getNavForRole(role).map((item) => item.href));
    assert.equal(mobile.length, 3);
    assert.equal(new Set(mobile.map((item) => item.href)).size, 3);
    assert.ok(mobile.every((item) => allowed.has(item.href)), `atalho indevido para ${role}`);
  }
  assert.equal(getMobileNavForRole("gestor")[0].href, "/minha-pasta");
  assert.equal(getMobileNavForRole("leitura").some((item) => item.href === "/equipe"), false);
});

test("rotas aninhadas destacam um único atalho e a ficha mantém o contexto de projetos", () => {
  const items = getMobileNavForRole("gestor");
  for (const route of ["/minha-pasta/projetos", "/minha-pasta/projetos/prioritario", "/iniciativas/projeto-1"]) {
    assert.deepEqual(items.filter((item) => mobileNavActive(route, item, items)).map((item) => item.href), ["/minha-pasta/projetos"]);
  }
  assert.equal(items.some((item) => mobileNavActive("/minha-pasta-extra", item, items)), false);
  assert.equal(items.some((item) => mobileNavActive("/planejamento", item, items)), false);
});
