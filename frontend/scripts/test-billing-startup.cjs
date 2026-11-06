const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

const source = ts.transpileModule(
  fs.readFileSync("src/lib/revenuecat.tsx", "utf8"),
  { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } },
).outputText;

function load(env, configure = () => {}) {
  const exports = {};
  const purchases = { setLogLevel() {}, configure };
  vm.runInNewContext(source, {
    exports, __DEV__: false, process: { env },
    require: (name) => {
      if (name === "react-native") return { Platform: { OS: "android" } };
      if (name === "react-native-purchases") return {
        __esModule: true, default: purchases, LOG_LEVEL: { WARN: 1 },
      };
      if (name === "react") return require("react");
      return {};
    },
  });
  return exports;
}

test("Android initializes with its Android key alone, without iOS or test keys", () => {
  let count = 0;
  const billing = load({ EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "goog_test_fixture" }, ({ apiKey }) => {
    assert.equal(apiKey, "goog_test_fixture");
    count++;
  });
  billing.initializeRevenueCat();
  billing.initializeRevenueCat();
  assert.equal(billing.rcEnabled, true);
  assert.equal(count, 1);
});

test("missing billing configuration leaves the free core available", () => {
  const billing = load({}, () => assert.fail("must not configure without a key"));
  billing.initializeRevenueCat();
  assert.equal(billing.rcEnabled, false);
});

test("failed configuration never enables unconfigured SDK listeners", () => {
  const billing = load({ EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "goog_test_fixture" }, () => {
    throw new Error("SDK unavailable");
  });
  assert.throws(() => billing.initializeRevenueCat(), /SDK unavailable/);
  assert.equal(billing.rcEnabled, false);
});
