import assert from "node:assert/strict";
import { test } from "node:test";
import { prepararDocumento } from "./documento-upload";

test("prepara upload automático com título derivado do arquivo", () => {
  const form = new FormData();
  form.set("tipo", "AUTO");
  form.set("arquivo", new File(["teste"], "Plano plurianual.PDF", { type: "application/pdf" }));
  prepararDocumento(form);
  assert.equal(form.get("titulo"), "Plano plurianual");
  assert.equal(form.get("tipo"), "AUTO");
});

test("não permite envio sem arquivo e aceita nome curto", () => {
  assert.throws(() => prepararDocumento(new FormData()), /Selecione um arquivo/);
  const form = new FormData();
  form.set("arquivo", new File(["teste"], "a.pdf", { type: "application/pdf" }));
  assert.equal(prepararDocumento(form).get("titulo"), "Documento");
});
