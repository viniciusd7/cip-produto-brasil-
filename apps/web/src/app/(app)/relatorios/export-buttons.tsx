"use client";

import { Button } from "@cip/ui";
import { useState } from "react";

export function ExportButtons() {
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState("");

  async function imprimirRelatorio() {
    setExportando(true);
    setErro("");
    const recolhidos = Array.from(document.querySelectorAll<HTMLDetailsElement>(
      ".pc-gerenciador details, .pc-dados, .pc-complemento",
    )).filter((detalhe) => !detalhe.open);

    function restaurar() {
      recolhidos.forEach((detalhe) => { detalhe.open = false; });
      setExportando(false);
      window.removeEventListener("afterprint", restaurar);
    }

    try {
      recolhidos.forEach((detalhe) => { detalhe.open = true; });
      await document.fonts.ready;
      await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>(".pc img"))
        .map((imagem) => imagem.decode().catch(() => undefined)));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.addEventListener("afterprint", restaurar, { once: true });
      window.print();
    } catch {
      restaurar();
      setErro("Não foi possível preparar o PDF. Tente novamente.");
    }
  }

  return (
    <div className="pc-exportar no-print">
      <Button type="button" disabled={exportando} onClick={() => void imprimirRelatorio()}>
        {exportando ? "Preparando PDF…" : "Salvar relatório em PDF"}
      </Button>
      {erro && <p role="alert">{erro}</p>}
    </div>
  );
}
