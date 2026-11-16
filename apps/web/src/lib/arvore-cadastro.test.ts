import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { criarPayloadTarefa } from "../app/(app)/iniciativas/[id]/arvore-cadastro";

describe("payload de criação de tarefa", () => {
  it("permite criar tarefa sem meta de execução", () => {
    const payload = criarPayloadTarefa({
      descricao: "Publicar edital",
      responsavel: "Equipe de projetos",
    });

    assert.deepEqual(payload, {
      descricao: "Publicar edital",
      responsavel: "Equipe de projetos",
      prazoOriginal: null,
    });
    assert.equal("metaExecucaoId" in payload, false);
  });

  it("mantém o dia do prazo sem criar vínculo legado", () => {
    const payload = criarPayloadTarefa({
      descricao: "Publicar edital",
      prazo: "2026-12-10",
    });

    assert.equal("metaExecucaoId" in payload, false);
    assert.equal(payload.prazoOriginal, new Date("2026-12-10T12:00:00").toISOString());
  });
});
