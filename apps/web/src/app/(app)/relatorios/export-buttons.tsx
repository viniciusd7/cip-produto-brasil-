"use client";

import { Button } from "@cip/ui";
import { useState } from "react";

export function ExportButtons({
  csv,
}: {
  csv: string;
}) {
  const [erro, setErro] = useState("");
  const [exportando, setExportando] = useState(false);
  function downloadCsv() {
    setErro("");
    setExportando(true);
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cip-relatorios.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível baixar o CSV. Verifique a conexão e tente novamente.");
    } finally {
      setExportando(false);
    }
  }

  function imprimirRelatorio() {
    const recolhidos = Array.from(document.querySelectorAll<HTMLDetailsElement>(".pc-gerenciador details, .pc-dados, .pc-complemento"))
      .filter((detalhe) => !detalhe.open);
    recolhidos.forEach((detalhe) => { detalhe.open = true; });
    window.addEventListener("afterprint", () => {
      recolhidos.forEach((detalhe) => { detalhe.open = false; });
    }, { once: true });
    window.print();
  }

  return (
    <div className="pc-exportar no-print">
      <div className="chip-row">
      <Button type="button" onClick={imprimirRelatorio}>
        Salvar PDF / imprimir
      </Button>
      <Button type="button" variant="secondary" disabled={exportando} onClick={downloadCsv}>
        {exportando ? "Exportando…" : "Exportar esta tabela (CSV)"}
      </Button>
      </div>
      {erro && <p role="alert">{erro}</p>}
    </div>
  );
}
