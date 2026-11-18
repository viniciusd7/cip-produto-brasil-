import assert from "node:assert/strict";
import test from "node:test";
import { gestaoUrl, isLocalSameOriginHost } from "./hosts";

test("acesso pela rede local mantém console e sessão no mesmo endereço", () => {
  for (const host of ["localhost:3000", "127.0.0.1:3000", "192.168.100.227:3000", "10.0.0.2:3000", "172.16.0.2:3000", "172.31.255.254:3000"]) {
    assert.equal(isLocalSameOriginHost(host), true, host);
    assert.equal(gestaoUrl(host), `http://${host}/gestao`);
  }
});

test("domínios públicos e endereços fora das faixas privadas preservam separação dos hosts", () => {
  for (const host of ["cip.example", "172.15.0.1", "172.32.0.1", "192.169.1.1", "192.168.1.999", "192.168.1.1.example", "8.8.8.8"]) {
    assert.equal(isLocalSameOriginHost(host), false, host);
  }
});
