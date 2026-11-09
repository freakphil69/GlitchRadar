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

function load(env, configure = () => {}, options = {}) {
  const exports = {};
  const purchases = { setLogLevel() {}, configure, ...options.purchases };
  vm.runInNewContext(source, {
    exports, __DEV__: false, process: { env },
    require: (name) => {
      if (name === "react-native") return { Platform: { OS: "android" } };
      if (name === "react-native-purchases") return {
        __esModule: true, default: purchases, LOG_LEVEL: { WARN: 1 },
      };
      if (name === "react") return options.react ?? require("react");
      if (name === "react/jsx-runtime") return require(name);
      if (name === "@tanstack/react-query") return options.queries ?? {};
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
  assert.equal(billing.isRevenueCatConfigured(), true);
  assert.equal(count, 1);
});

test("missing billing configuration leaves the free core available", () => {
  const billing = load({}, () => assert.fail("must not configure without a key"));
  billing.initializeRevenueCat();
  assert.equal(billing.rcEnabled, false);
  assert.equal(billing.isRevenueCatConfigured(), false);
});

test("failed configuration never enables unconfigured SDK listeners", () => {
  const billing = load({ EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "goog_test_fixture" }, () => {
    throw new Error("SDK unavailable");
  });
  assert.throws(() => billing.initializeRevenueCat(), /SDK unavailable/);
  assert.equal(billing.rcEnabled, false);
  assert.equal(billing.isRevenueCatConfigured(), false);
});

test("merged billing guards queries, listeners, purchase and restore until configured", async () => {
  const queries = [];
  const effects = [];
  let sdkCalls = 0;
  let listeners = 0;
  const info = { entitlements: { active: { pro: {} } } };
  const billing = load({ EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "goog_test_fixture" }, () => {}, {
    react: {
      createContext: () => ({ Provider: "Provider" }),
      useContext: () => null,
      useEffect: (effect) => effects.push(effect),
      useState: (value) => [typeof value === "function" ? value() : value, () => {}],
    },
    queries: {
      useQueryClient: () => ({ setQueryData() {} }),
      useQuery: (config) => { queries.push(config); return {}; },
      useMutation: (config) => ({ mutateAsync: config.mutationFn }),
    },
    purchases: {
      isAnonymous: async () => false,
      purchasePackage: async () => { sdkCalls++; return { customerInfo: info }; },
      restorePurchases: async () => { sdkCalls++; return info; },
      addCustomerInfoUpdateListener: () => { listeners++; },
      removeCustomerInfoUpdateListener: () => { listeners--; },
    },
  });
  const before = billing.SubscriptionProvider({ children: null }).props.value;
  assert.equal(before.storeReady, false);
  assert.ok(queries.filter((q) => q.queryKey[0] === "revenuecat").every((q) => q.enabled === false));
  assert.equal(effects[0](), undefined);
  await assert.rejects(before.purchase({}), /store_unavailable/);
  await assert.rejects(before.restore(), /store_unavailable/);
  assert.equal(sdkCalls, 0);
  assert.equal(listeners, 0);

  billing.initializeRevenueCat();
  queries.length = 0;
  effects.length = 0;
  const after = billing.SubscriptionProvider({ children: null }).props.value;
  assert.equal(after.storeReady, true);
  assert.ok(queries.filter((q) => q.queryKey[0] === "revenuecat").every((q) => q.enabled === true));
  const cleanup = effects[0]();
  assert.equal(listeners, 1);
  assert.equal(await after.purchase({}), info);
  assert.equal(await after.restore(), info);
  assert.equal(sdkCalls, 2);
  cleanup();
  assert.equal(listeners, 0);
});
