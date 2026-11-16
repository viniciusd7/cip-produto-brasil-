import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { localStorage } from "./storage";

test("localStorage.exists returns false only when the file is absent", async () => {
  assert.equal(await localStorage.exists(`missing-${randomUUID()}`), false);
});

test("localStorage.exists propagates invalid paths", async () => {
  await assert.rejects(
    localStorage.exists("../outside-storage-root"),
    /INVALID_PATH/,
  );
});

test("localStorage.exists propagates filesystem access failures", async (t) => {
  const access = Reflect.get(fs, "access");
  const failure = Object.assign(new Error("permission denied"), {
    code: "EACCES",
  });
  Reflect.set(fs, "access", async () => {
    throw failure;
  });
  t.after(() => Reflect.set(fs, "access", access));

  await assert.rejects(
    localStorage.exists(`inaccessible-${randomUUID()}`),
    (error) => error === failure,
  );
});
