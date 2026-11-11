"use client";

import { Button } from "@cip/ui";

export function ExportButtons({
  csvUrl,
  token,
}: {
  csvUrl: string;
  token: string;
}) {
  async function downloadCsv() {
    const res = await fetch(csvUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cip-relatorio-executivo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="chip-row">
      <Button type="button" onClick={() => window.print()}>
        Salvar PDF / imprimir
      </Button>
      <Button type="button" variant="secondary" onClick={downloadCsv}>
        Planilha (CSV)
      </Button>
    </div>
  );
}
