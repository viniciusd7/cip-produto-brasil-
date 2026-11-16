import type { ConsultaRelatorio } from "./tabela-relatorio";

type Faixa = { nome: string; quantidade: number; cor: string };
type Grafico = { titulo: string; descricao: string; faixas: Faixa[] };

const CORES = ["#a7baff", "#b4e4a0", "#eac78c", "#ff91ac", "#c5a9ed", "#a5aec5"];
const CORES_SITUACAO: Record<string, string> = {
  "Concluída": "#b4e4a0",
  "No prazo": "#a7baff",
  "Sem prazo": "#eac78c",
  "Atrasada": "#ff91ac",
  "Encerrada sem solução": "#a5aec5",
};

function agrupar(consulta: ConsultaRelatorio, campo: string): Faixa[] {
  const grupos = new Map<string, number>();
  for (const linha of consulta.linhas) {
    const valor = linha.valores[campo];
    const nome = valor == null || String(valor).trim() === "" ? "Não informado" : String(valor);
    grupos.set(nome, (grupos.get(nome) ?? 0) + 1);
  }
  const ordenados = [...grupos].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  const principais = ordenados.slice(0, 6);
  const restantes = ordenados.slice(6).reduce((total, [, quantidade]) => total + quantidade, 0);
  return [
    ...principais.map(([nome, quantidade], i) => ({
      nome, quantidade, cor: campo === "situacao" ? CORES_SITUACAO[nome] ?? CORES[i % CORES.length] : CORES[i % CORES.length],
    })),
    ...(restantes ? [{ nome: "Demais grupos", quantidade: restantes, cor: CORES[5] }] : []),
  ];
}

export function graficosDaConsulta(consulta: ConsultaRelatorio): Grafico[] {
  const distribuicao = (titulo: string, descricao: string, campo: string): Grafico => ({
    titulo, descricao, faixas: agrupar(consulta, campo),
  });
  if (consulta.tipo === "tarefas") {
    return [
      distribuicao("Situação das tarefas", "Distribuição das tarefas encontradas.", "situacao"),
      distribuicao("Tarefas por secretaria", "Quantidade de tarefas em cada secretaria.", "secretaria"),
    ];
  }
  if (consulta.tipo === "projetos" || consulta.tipo === "secretarias") {
    const definicoes = [
      ["concluidas", "Concluídas", "#b4e4a0"],
      ["noPrazo", "No prazo", "#a7baff"],
      ["semPrazo", "Sem prazo", "#eac78c"],
      ["atrasadas", "Atrasadas", "#ff91ac"],
    ] as const;
    const totais = definicoes.map(([campo, nome, cor]) => ({
      nome, cor, quantidade: consulta.linhas.reduce((soma, linha) => soma + (typeof linha.valores[campo] === "number" ? linha.valores[campo] : 0), 0),
    }));
    const total = consulta.linhas.reduce((soma, linha) => soma + (typeof linha.valores.total === "number" ? linha.valores.total : 0), 0);
    const demais = Math.max(0, total - totais.reduce((soma, item) => soma + item.quantidade, 0));
    return [
      { titulo: "Situação das tarefas", descricao: "Soma das tarefas nas linhas desta consulta.", faixas: [...totais, ...(demais ? [{ nome: "Encerradas sem solução ou outras", quantidade: demais, cor: CORES[5] }] : [])] },
      consulta.tipo === "projetos"
        ? distribuicao("Projetos por secretaria", "Quantidade de projetos encontrados em cada secretaria.", "secretaria")
        : distribuicao("Secretarias por volume de projetos", "Quantidade de secretarias com cada volume de projetos.", "projetos"),
    ];
  }
  if (consulta.tipo === "metas") {
    return [
      distribuicao("Linhas por secretaria", "Cada linha representa um indicador ou uma meta sem indicador.", "secretaria"),
      distribuicao("Periodicidade dos indicadores", "Distribuição das linhas conforme a periodicidade cadastrada.", "periodicidade"),
    ];
  }
  return [
    distribuicao("Evidências por tipo", "Distribuição das evidências encontradas.", "tipo"),
    distribuicao("Situação das evidências", "Distribuição conforme a situação registrada.", "situacao"),
  ];
}

function GraficoBarras({ grafico }: { grafico: Grafico }) {
  const maximo = Math.max(0, ...grafico.faixas.map((faixa) => faixa.quantidade));
  return (
    <article className="pc-grafico">
      <header>
        <h3>{grafico.titulo}</h3>
        <p>{grafico.descricao}</p>
      </header>
      {maximo ? (
        <ul className="pc-barras">
          {grafico.faixas.map((faixa, index) => (
            <li key={`${faixa.nome}-${index}`}>
              <div className="pc-barras__legenda"><span>{faixa.nome}</span><strong>{faixa.quantidade.toLocaleString("pt-BR")}</strong></div>
              <div className="pc-barras__trilho" aria-hidden="true">
                <span style={{ width: `${(faixa.quantidade / maximo) * 100}%`, backgroundColor: faixa.cor }} />
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="pc-grafico__vazio">Não há dados para este gráfico no recorte selecionado.</p>}
    </article>
  );
}

export function VisaoGrafica({ consulta, titulo }: { consulta: ConsultaRelatorio; titulo: string }) {
  return (
    <section className="pc-visual" aria-labelledby="relatorio-visual">
      <header className="pc-visual__cabecalho">
        <div>
          <h2 id="relatorio-visual">Leitura visual: {titulo}</h2>
          <p>Gráficos do mesmo recorte exibido na tabela.</p>
        </div>
        <div className="pc-visual__total">
          <strong>{consulta.total.toLocaleString("pt-BR")}</strong>
          <span>{consulta.total === 1 ? "linha encontrada" : "linhas encontradas"}</span>
        </div>
      </header>
      <div className="pc-graficos">
        {graficosDaConsulta(consulta).map((grafico) => <GraficoBarras key={grafico.titulo} grafico={grafico} />)}
      </div>
    </section>
  );
}
