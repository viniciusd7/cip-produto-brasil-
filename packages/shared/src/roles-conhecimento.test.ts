import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSIONS, ROLE_PERMISSIONS } from "./roles";

test("upload da base é permitido a todos os perfis, sem liberar edição de iniciativas", () => {
  for (const role of ["admin", "analista", "prefeito", "gestor", "leitura"] as const) {
    assert.ok(ROLE_PERMISSIONS[role].includes(PERMISSIONS.CONHECIMENTO_UPLOAD), role);
  }
  assert.ok(!ROLE_PERMISSIONS.leitura.includes(PERMISSIONS.INICIATIVA_WRITE));
  assert.ok(!ROLE_PERMISSIONS.prefeito.includes(PERMISSIONS.INICIATIVA_WRITE));
  assert.ok(!ROLE_PERMISSIONS.gestor.includes(PERMISSIONS.INICIATIVA_WRITE));
});
