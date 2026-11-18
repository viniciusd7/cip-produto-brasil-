import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";

const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const added: Request[] = [];
  const removed: string[] = [];
  const writes: string[] = [];
  const networkOptions: RequestInit[] = [];
  let offline = false;
  let networkResponse = new Response("conteúdo autenticado");
  const fallback = new Response("offline público");
  const cache = {
    add: async (request: Request) => { added.push(request); },
    match: async () => fallback,
    put: async (key: string) => { writes.push(key); },
  };
  runInNewContext(source, {
    URL, Response,
    Request: class extends Request {
      constructor(url: string, init?: RequestInit) {
        super(new URL(url, "https://cip.example"), init);
      }
    },
    self: {
      location: { origin: "https://cip.example" },
      addEventListener: (type: string, callback: (event: unknown) => void) => listeners.set(type, callback),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => cache,
      keys: async () => ["cip-public-offline-v0", "cip-public-offline-v1", "outro-aplicativo"],
      delete: async (key: string) => { removed.push(key); },
    },
    fetch: async (_request: unknown, options: RequestInit) => {
      networkOptions.push(options);
      if (offline) throw new TypeError("Failed to fetch");
      return networkResponse;
    },
  });
  return {
    added, removed, writes, fallback, networkOptions,
    setOffline() { offline = true; },
    setResponse(response: Response) { networkResponse = response; },
    async lifecycle(type: string) {
      let work: Promise<unknown> | undefined;
      listeners.get(type)?.({ waitUntil: (promise: Promise<unknown>) => { work = promise; } });
      await work;
    },
    fetch(path: string, method = "GET", mode = "navigate") {
      let response: Promise<Response> | undefined;
      listeners.get("fetch")?.({
        request: { url: new URL(path, "https://cip.example").href, method, mode },
        respondWith: (promise: Promise<Response>) => { response = promise; },
      });
      return response;
    },
  };
}

test("instalação persiste só documento offline público e omite credenciais", async () => {
  const sw = worker();
  await sw.lifecycle("install");
  assert.equal(sw.added.length, 1);
  assert.equal(sw.added[0].url, "https://cip.example/offline.html");
  assert.equal(sw.added[0].credentials, "omit");
  assert.equal(sw.added[0].cache, "reload");
});

test("navegação privada online e respostas de erro são preservadas sem persistência", async () => {
  const sw = worker();
  for (const status of [200, 401, 403, 503]) {
    const response = new Response("dados privados", { status });
    sw.setResponse(response);
    assert.equal(await sw.fetch("/painel"), response);
  }
  assert.deepEqual(sw.writes, []);
  assert.deepEqual(sw.added, []);
  assert.ok(sw.networkOptions.every((options) => options.cache === "no-store"));
});

test("somente navegação offline recebe o fallback; API, RSC, POST e outros hosts não são interceptados", async () => {
  const sw = worker();
  sw.setOffline();
  assert.equal(await sw.fetch("/iniciativas/projeto-privado"), sw.fallback);
  assert.equal(sw.fetch("/api/auth/session"), undefined);
  assert.equal(sw.fetch("/api"), undefined);
  assert.equal(sw.fetch("/_next"), undefined);
  assert.equal(sw.fetch("/painel?_rsc=123", "GET", "cors"), undefined);
  assert.equal(sw.fetch("/iniciativas", "POST"), undefined);
  assert.equal(sw.fetch("https://api.example/relatorios"), undefined);
  assert.equal(sw.fetch("/_next/static/chunk.js"), undefined);
  assert.deepEqual(sw.writes, []);
});

test("atualização remove apenas versões anteriores do próprio cache público", async () => {
  const sw = worker();
  await sw.lifecycle("activate");
  assert.deepEqual(sw.removed, ["cip-public-offline-v0"]);
});
