import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canUploadKnowledgeRole, getHomeForRole, getNavForRole, getNextStepForRole } from "./roles";

describe("navegação sem a área de implantação", () => {
  it("encaminha o consultor ao cenário e mantém secretarias como próximo passo", () => {
    assert.equal(getHomeForRole("analista"), "/painel");
    assert.deepEqual(getNavForRole("analista")[0], { href: "/painel", label: "Visão geral", icon: "01" });
    assert.equal(getHomeForRole("prefeito"), getHomeForRole("analista"));
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

  it("ordena os atalhos numerados sem lacunas para todos os perfis", () => {
    for (const role of ["admin", "analista", "prefeito", "gestor", "leitura"]) {
      const nav = getNavForRole(role);
      const numeric = nav.filter((item) => /^\d+$/.test(item.icon || ""));
      assert.deepEqual(numeric.map((item) => item.icon), numeric.map((_, i) => String(i + 1).padStart(2, "0")), role);
    }
    assert.deepEqual(getNavForRole("analista").slice(0, 5).map((item) => item.label),
      ["Visão geral", "Secretarias", "Projetos", "Tarefas", "Aprovações"]);
  });
});
