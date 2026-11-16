"use client";

import Link from "next/link";
import { Button } from "@cip/ui";

export default function RelatorioErro({ reset }: { reset: () => void }) {
  return (
    <section aria-labelledby="relatorio-erro-titulo">
      <h1 id="relatorio-erro-titulo">Não foi possível carregar o relatório</h1>
      <p role="alert">
        A consulta falhou. Confira os filtros e sua sessão antes de tentar novamente.
        Nenhum arquivo foi gerado para esta consulta.
      </p>
      <div className="chip-row">
        <Button type="button" onClick={reset}>Tentar novamente</Button>
        <Link href="/relatorios">Limpar filtros e abrir relatórios</Link>
      </div>
    </section>
  );
}
