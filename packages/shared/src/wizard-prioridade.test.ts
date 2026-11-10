import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateWizard,
  type ModeloSnapshot,
  type RespostaViabilidade,
  type TreeNode,
} from "./wizard-engine";
import { TRIAGEM_ACAO_DIARIA } from "./modelos/triagem-acao-diaria";
// Banco real do seed: o teste valida o que de fato será gravado.
import { ESTRUTURANTE_PADRAO_MODELO_SNAPSHOT } from "../../db/prisma/estruturante-modelo-snapshot";

const estruturante = ESTRUTURANTE_PADRAO_MODELO_SNAPSHOT as unknown as ModeloSnapshot;

const R = (pares: Record<string, string | number | boolean>): RespostaViabilidade[] =>
  Object.entries(pares).map(([perguntaCodigo, valor]) => ({ perguntaCodigo, valor }));

function codigosDaArvore(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) => [n.codigo, ...codigosDaArvore(n.children)]);
}

function estado(
  respostas: RespostaViabilidade[],
  classificacaoPrincipal: "ESTRUTURANTE" | "ACAO_DIARIA" = "ESTRUTURANTE",
) {
  return evaluateWizard({
    modelo: classificacaoPrincipal === "ESTRUTURANTE" ? estruturante : TRIAGEM_ACAO_DIARIA,
    respostas,
    classificacaoPrincipal,
  });
}

describe("banco padrão de projeto estruturante — integridade", () => {
  const perguntas = estruturante.perguntas;
  const codigosPerguntas = new Set(perguntas.map((p) => p.codigo));
  const codigosEstrutura = new Set(estruturante.estrutura.map((e) => e.codigo));
  const etapas = new Set((estruturante.etapas ?? []).map((e) => e.ordem));

  it("códigos de pergunta e de estrutura são únicos", () => {
    assert.equal(codigosPerguntas.size, perguntas.length);
    assert.equal(codigosEstrutura.size, estruturante.estrutura.length);
  });

  it("toda pergunta com etapa aponta para uma etapa existente", () => {
    for (const p of perguntas) {
      if (p.etapa == null) continue;
      assert.ok(etapas.has(p.etapa), `${p.codigo} aponta para etapa ${p.etapa} inexistente`);
    }
  });

  it("toda dependência aponta para pergunta existente", () => {
    for (const p of perguntas) {
      if (!p.dependeDeCodigo) continue;
      assert.ok(codigosPerguntas.has(p.dependeDeCodigo), `${p.codigo} depende de ${p.dependeDeCodigo}`);
    }
  });

  it("todo código incluído por efeito e todo pai existem na estrutura", () => {
    for (const p of perguntas) {
      for (const ef of p.efeitos ?? []) {
        for (const c of ef.incluirEstrutura ?? []) {
          assert.ok(codigosEstrutura.has(c), `${p.codigo} inclui ${c} inexistente`);
        }
      }
    }
    for (const e of estruturante.estrutura) {
      if (e.parentCodigo) {
        assert.ok(codigosEstrutura.has(e.parentCodigo), `${e.codigo} tem pai inexistente`);
      }
    }
  });

  it("valores de favoráveis e de condições eq/in existem nas opções da pergunta", () => {
    for (const p of perguntas) {
      if (!p.opcoes) continue;
      for (const f of p.favoraveis ?? []) {
        assert.ok(p.opcoes.includes(f), `${p.codigo}: favorável "${f}" não é opção`);
      }
      for (const ef of p.efeitos ?? []) {
        const q = ef.quando as Record<string, unknown>;
        const valores = "eq" in q ? [q.eq] : "in" in q ? (q.in as unknown[]) : [];
        for (const v of valores) {
          assert.ok(p.opcoes.includes(String(v)), `${p.codigo}: condição "${v}" não é opção`);
        }
      }
    }
  });

  it("toda pergunta de etapa tem favoráveis ou é informativa de forma explícita", () => {
    for (const p of perguntas) {
      if (p.etapa == null || p.impacto === "INFORMATIVA") continue;
      assert.ok(p.favoraveis && p.favoraveis.length > 0, `${p.codigo} sem favoráveis`);
    }
  });
});

describe("prioridade — triagem de urgência e impacto", () => {
  it("sem respostas a prioridade é BAIXA e nenhum bloqueio é criado", () => {
    const r = estado([]);
    assert.equal(r.prioridade, "BAIXA");
    assert.equal(r.cicloInicial, "EM_PLANEJAMENTO");
    assert.deepEqual(r.motivosPrioridade, []);
  });

  it("risco imediato à segurança torna a prioridade CRÍTICA", () => {
    const r = estado(R({ risco_pessoas: "pendente" }));
    assert.equal(r.prioridade, "CRITICA");
    assert.ok(
      r.motivosPrioridade.includes(
        "Risco imediato à segurança ou serviço essencial parado",
      ),
    );
  });

  it("prazo crítico eleva para ALTA", () => {
    const r = estado(R({ prazo_critico: "atendida" }));
    assert.equal(r.prioridade, "ALTA");
  });

  it("prazo crítico dispensado não eleva prioridade", () => {
    const r = estado(R({ prazo_critico: "nao_se_aplica" }));
    assert.equal(r.prioridade, "BAIXA");
  });

  it("janela eleitoral eleva para ALTA", () => {
    const r = estado(R({ janela_eleitoral: "pendente" }));
    assert.equal(r.prioridade, "ALTA");
  });

  it("risco crítico não é rebaixado por outros sinais", () => {
    assert.equal(
      estado(R({ risco_pessoas: "atendida", janela_eleitoral: "nao_se_aplica" }))
        .prioridade,
      "CRITICA",
    );
  });
});

describe("etapas — grupos e prontidão", () => {
  it("sem respostas a etapa atual é planejamento e a prontidão é zero", () => {
    const r = estado([]);
    assert.equal(r.etapaAtual, "PLANEJAMENTO");
    assert.equal(r.prontidaoPct, 0);
    assert.equal(r.etapas[0].status, "PENDENTE");
  });

  it("verba pendente bloqueia o projeto e inclui obter dotação", () => {
    const r = estado(R({ orcamento_recursos: "pendente" }));
    assert.equal(r.cicloInicial, "AGUARDANDO_PRE_REQUISITO");
    assert.equal(r.bloqueioLabel, "Aguardando verba");
    assert.ok(codigosDaArvore(r.estrutura).includes("TAR_OBTER_DOTACAO"));
  });

  it("terreno a desapropriar inclui o processo completo na ordem da lei", () => {
    const r = estado(R({ situacao_imovel: "Imóvel particular a desapropriar" }));
    const codigos = codigosDaArvore(r.estrutura);
    for (const c of [
      "META_DESAPROPRIACAO",
      "TAR_DUP",
      "TAR_AVALIACAO",
      "TAR_OFERTA",
      "TAR_IMISSAO_POSSE",
    ]) {
      assert.ok(codigos.includes(c), `faltou ${c}`);
    }
    assert.equal(r.cicloInicial, "AGUARDANDO_PRE_REQUISITO");
    assert.equal(r.bloqueioLabel, "Aguardando desapropriação do imóvel");
    const meta = r.estrutura.find((n) => n.codigo === "META_DESAPROPRIACAO");
    assert.deepEqual(
      meta?.children.map((c) => c.codigo),
      ["TAR_DUP", "TAR_AVALIACAO", "TAR_OFERTA", "TAR_IMISSAO_POSSE"],
    );
  });

  it("autorização legislativa pendente inclui TAR_LEI_AUTORIZATIVA", () => {
    const r = estado(R({ lei_autorizativa: "pendente" }));
    assert.ok(codigosDaArvore(r.estrutura).includes("TAR_LEI_AUTORIZATIVA"));
  });

  it("área pública disponível é favorável em preparação", () => {
    const r = estado(R({ situacao_imovel: "Área pública disponível" }));
    const prep = r.etapas.find((e) => e.codigo === "PREPARACAO");
    assert.ok((prep?.favoraveis ?? 0) >= 1);
  });

  it("alerta quando preparação avança antes de planejamento", () => {
    const r = estado(
      R({
        situacao_imovel: "Área pública disponível",
        projeto_basico_executivo: "pendente",
      }),
    );
    const prep = r.etapas.find((e) => e.codigo === "PREPARACAO");
    assert.ok(prep?.status === "EM_ANDAMENTO" || prep?.status === "BLOQUEADA");
    assert.ok(
      r.avisos.some((a) => a.includes("Preparação") && a.includes("avança antes")),
      `avisos: ${JSON.stringify(r.avisos)}`,
    );
  });

  it("prontidão sobe com respostas favoráveis parciais", () => {
    const r = estado(
      R({
        necessidade_resultado: "atendida",
        situacao_imovel: "Área pública disponível",
        licenca_ambiental: "Não necessária",
      }),
    );
    assert.ok((r.prontidaoPct ?? 0) > 0 && (r.prontidaoPct ?? 0) < 100);
  });

  it("com todas as perguntas de etapa favoráveis a prontidão é 100", () => {
    const favoraveis: Record<string, string> = {};
    for (const p of estruturante.perguntas) {
      if (p.etapa == null) continue;
      if (!p.favoraveis?.length) continue;
      favoraveis[p.codigo] = String(p.favoraveis[0]);
    }
    const r = estado(R(favoraveis));
    assert.equal(r.prontidaoPct, 100);
    assert.equal(r.etapaAtual, null);
    assert.equal(
      r.etapas.every((e) => e.status === "CONCLUIDA" || e.status === "NAO_APLICAVEL"),
      true,
    );
  });
});

describe("ação diária — demanda operacional", () => {
  function Robj(
    pares: Record<
      string,
      { aplicabilidade: string; situacao: string; detalhes?: Record<string, string | number | null> }
    >,
  ): RespostaViabilidade[] {
    return Object.entries(pares).map(([perguntaCodigo, valor]) => ({
      perguntaCodigo,
      valor: { codigo: perguntaCodigo, ...valor },
    }));
  }

  it("avalia etapas dos segmentos (sem early-return)", () => {
    const r = estado([], "ACAO_DIARIA");
    assert.ok(r.etapas.length >= 4);
    assert.equal(r.cicloInicial, "EM_PLANEJAMENTO");
    assert.equal(r.prioridade, "BAIXA");
  });

  it("prazo de até 2 dias (follow-up) torna a ação CRÍTICA", () => {
    const r = evaluateWizard({
      modelo: TRIAGEM_ACAO_DIARIA,
      classificacaoPrincipal: "ACAO_DIARIA",
      respostas: Robj({
        acao_prazo_externo: {
          aplicabilidade: "sim",
          situacao: "pendente",
          detalhes: { dias_restantes: 1 },
        },
      }),
    });
    assert.equal(r.prioridade, "CRITICA");
  });

  it("prazo de até 7 dias e muitas pessoas afetadas ficam em ALTA", () => {
    const r = evaluateWizard({
      modelo: TRIAGEM_ACAO_DIARIA,
      classificacaoPrincipal: "ACAO_DIARIA",
      respostas: Robj({
        acao_prazo_externo: {
          aplicabilidade: "sim",
          situacao: "pendente",
          detalhes: { dias_restantes: 5 },
        },
        acao_impede_servico: {
          aplicabilidade: "sim",
          situacao: "pendente",
          detalhes: { pessoas_dia: 600 },
        },
      }),
    });
    assert.equal(r.prioridade, "ALTA");
    assert.ok(r.motivosPrioridade.length >= 2);
  });

  it("impedimento de serviço eleva para ALTA", () => {
    const r = evaluateWizard({
      modelo: TRIAGEM_ACAO_DIARIA,
      classificacaoPrincipal: "ACAO_DIARIA",
      respostas: Robj({
        acao_impede_servico: { aplicabilidade: "sim", situacao: "pendente" },
      }),
    });
    assert.equal(r.prioridade, "ALTA");
  });

  it("códigos da ação diária são únicos", () => {
    const codigos = new Set(TRIAGEM_ACAO_DIARIA.perguntas.map((p) => p.codigo));
    assert.equal(codigos.size, TRIAGEM_ACAO_DIARIA.perguntas.length);
    for (const p of TRIAGEM_ACAO_DIARIA.perguntas) {
      if (p.dependeDeCodigo) assert.ok(codigos.has(p.dependeDeCodigo));
    }
  });
});
