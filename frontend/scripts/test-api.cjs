const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

const source = ts.transpileModule(
  fs.readFileSync("src/lib/api.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText;

function load(fetch, backend = "https://api.example.com/", timers = {}) {
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    process: { env: { EXPO_PUBLIC_BACKEND_URL: backend } },
    fetch,
    AbortController,
    setTimeout,
    clearTimeout,
    ...timers,
  });
  return exports;
}

test("feed requests normalize the backend URL and preserve the token", async () => {
  const api = load(async (url, init) => {
    assert.equal(url, "https://api.example.com/api/glitches");
    assert.equal(init.headers.Authorization, "Bearer session");
    return { ok: true, json: async () => [{ id: "real-find" }] };
  });
  api.setAuthToken("session");
  const result = await api.apiGet("/glitches");
  assert.equal(result[0].id, "real-find");
});

test("a missing backend never sends requests to undefined/api", async () => {
  let called = false;
  const api = load(async () => { called = true; }, "");
  await assert.rejects(api.apiGet("/glitches"), /Backend.*konfiguriert/i);
  assert.equal(called, false);
});

test("a stalled feed is cancelled and exposes a retryable error", async () => {
  let aborted = false;
  const api = load((_url, init) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => {
      aborted = true;
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    });
  }), "https://api.example.com", {
    setTimeout: (fn) => setTimeout(fn, 5),
  });
  await assert.rejects(api.apiGet("/glitches"), /Zeitüberschreitung/);
  assert.equal(aborted, true);
});

test("only an HTTP 401 invalidates an existing session", async () => {
  for (const status of [401, 502]) {
    let cleared = false;
    const api = load(async () => ({
      ok: false, status, json: async () => ({ detail: "Testfehler" }),
    }));
    api.setAuthToken("session");
    api.setUnauthorizedHandler(() => { cleared = true; });
    await assert.rejects(api.apiGet("/auth/me"), (error) => error.status === status);
    assert.equal(cleared, status === 401);
  }
});
