import assert from "node:assert/strict";
import { test } from "node:test";
import { salvarMedicao } from "./medicao";

test("saves a measurement using the captured form values", async () => {
  const form = new FormData();
  form.set("metaEstrategicaId", "meta-1");
  form.set("dataCorte", "2026-11-16");
  form.set("valorRealizado", "12");
  form.set("valorEsperado", "");
  form.set("fonte", "Relatório municipal");
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  await salvarMedicao(form, "test-token", async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ data: { id: "medicao-1" } }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  });

  assert.match(requestUrl, /\/planejamento\/medicoes$/);
  assert.equal(requestInit?.method, "POST");
  assert.equal(new Headers(requestInit?.headers).get("Authorization"), "Bearer test-token");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    metaEstrategicaId: "meta-1",
    dataCorte: "2026-11-16T00:00:00.000Z",
    valorRealizado: "12",
    fonte: "Relatório municipal",
  });
});

test("reports the API error when a measurement cannot be saved", async () => {
  const form = new FormData();
  form.set("dataCorte", "2026-11-16");

  await assert.rejects(
    salvarMedicao(form, "test-token", async () =>
      new Response(JSON.stringify({ error: { message: "Meta inválida" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    ),
    { message: "Meta inválida" },
  );
});

test("rejects an invalid cut-off date before sending a request", async () => {
  const form = new FormData();
  form.set("dataCorte", "");
  let requested = false;

  await assert.rejects(
    salvarMedicao(form, "test-token", async () => {
      requested = true;
      return new Response(null, { status: 204 });
    }),
    { message: "Informe uma data de corte válida." },
  );
  assert.equal(requested, false);
});
