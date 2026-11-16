import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canUploadKnowledgeRole, getHomeForRole, getNavForRole, getNextStepForRole } from "./roles";

describe("navegação sem a área de implantação", () => {
  it("encaminha o consultor para as secretarias", () => {
    assert.equal(getHomeForRole("analista"), "/secretarias");
    assert.equal(getNextStepForRole("analista").href, "/secretarias");
  });

  it("não oferece implantação no menu de nenhum perfil", () => {
    for (const role of ["admin", "analista", "prefeito", "gestor", "leitura"]) {
      assert.ok(getNavForRole(role).every((item) => item.href !== "/implantacao"), role);
    }
  });

  describe("base de conhecimento", () => {
    it("aparece no menu de todos os perfis municipais", () => {
      for (const role of ["admin", "analista", "prefeito", "gestor", "leitura"]) {
        assert.ok(getNavForRole(role).some((item) => item.href === "/base-conhecimento"), role);
      }
    });

    it("permite anexos sem alterar o perfil somente leitura", () => {
      for (const role of ["admin", "analista", "prefeito", "gestor"]) {
        assert.equal(canUploadKnowledgeRole(role), true, role);
      }
      assert.equal(canUploadKnowledgeRole("leitura"), false);
    });
  });

  it("preserva o acesso do consultor às áreas de trabalho", () => {
    const links = getNavForRole("analista").map((item) => item.href);
    for (const href of ["/secretarias", "/carteira", "/acoes", "/validacoes", "/equipe"]) {
      assert.ok(links.includes(href), href);
    }
  });
});
