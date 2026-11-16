import Link from "next/link";

export type ConsultaRelatorio = {
  tipo: string;
  busca: string;
  ordenar: string;
  direcao: "asc" | "desc";
  total: number;
  colunas: Array<{ chave: string; rotulo: string }>;
  linhas: Array<{ id: string; valores: Record<string, string | number | null> }>;
};

export function TabelaRelatorio({ consulta, parametros }: { consulta: ConsultaRelatorio; parametros: string }) {
  if (!consulta.linhas.length) {
    return <p className="pc-vazio" role="status">Nenhum resultado para os filtros aplicados. Altere os filtros ou limpe a busca.</p>;
  }
  return (
    <div className="pc-tabela__rolagem" tabIndex={0} role="region" aria-label="Resultados do relatório">
      <table className="pc-grade">
        <caption>{consulta.total} {consulta.total === 1 ? "resultado" : "resultados"} com os filtros aplicados</caption>
        <thead>
          <tr>
            {consulta.colunas.map((coluna) => {
              const ativa = consulta.ordenar === coluna.chave;
              const params = new URLSearchParams(parametros);
              params.set("ordenar", coluna.chave);
              params.set("direcao", ativa && consulta.direcao === "asc" ? "desc" : "asc");
              return (
                <th key={coluna.chave} scope="col" aria-sort={ativa ? (consulta.direcao === "asc" ? "ascending" : "descending") : "none"}>
                  <Link href={`/relatorios?${params}`} scroll={false}>
                    {coluna.rotulo}
                    <span aria-hidden="true">{ativa ? (consulta.direcao === "asc" ? " ↑" : " ↓") : " ↕"}</span>
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {consulta.linhas.map((linha) => (
            <tr key={linha.id}>
              {consulta.colunas.map((coluna) => <td key={coluna.chave}>{linha.valores[coluna.chave] ?? ""}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
