const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

function load(path, mocks = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(source, {
    exports, ...globals,
    require(name) {
      if (name in mocks) return mocks[name];
      if (name === "react/jsx-runtime") return require(name);
      if (name.endsWith(".webp")) return name;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !node.props) return [];
  return [node, ...elements(node.props.children)];
}

const theme = {
  fonts: {}, spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { sm: 6, md: 12 }, useTheme: () => ({ colors: {} }),
  makeStyles: (factory) => () => factory({}),
};

test("all mascot poses use small bundled static assets without image fade", () => {
  const { Mascot } = load("src/components/Mascot.tsx", {
    react: { memo: (fn) => fn },
    "react-native": { Image: "Image" },
  });
  let totalBytes = 0;
  for (const pose of ["neutral", "proud", "offer"]) {
    const node = Mascot({ pose, width: 104, height: 104 });
    assert.equal(node.props.source, `@/assets/images/mascot/${pose}.webp`);
    assert.equal(node.props.fadeDuration, 0);
    assert.equal(node.props.accessible, false);
    assert.equal(node.props.style.width, 104);
    const file = fs.readFileSync(`assets/images/mascot/${pose}.webp`);
    assert.equal(file.toString("ascii", 8, 12), "WEBP");
    assert.ok(file.length < 40_000);
    totalBytes += file.length;
  }
  assert.ok(totalBytes < 110_000, `Asset budget exceeded: ${totalBytes}`);
});

function mountSplash(reduced = false) {
  const effects = [];
  const scheduled = [];
  const cleared = [];
  let hidden = false;
  let nativeHideCount = 0;
  let started = 0;
  let stopped = 0;
  let removed = false;
  let changeMotion;
  let steps;
  const values = [];
  class Value {
    constructor(value) { this.value = value; }
    setValue(value) { this.value = value; values.push(value); }
    interpolate(config) { return config; }
    stopAnimation() { stopped++; }
  }
  const { AppSplash } = load("src/components/AppSplash.tsx", {
    react: {
      useEffect: (fn) => effects.push(fn),
      useState: () => [true, (visible) => { hidden = !visible; }],
      useRef: (value) => ({ current: value }),
    },
    "react-native": {
      View: "View", Text: "Text", StyleSheet: { create: (s) => s, absoluteFill: {} },
      useAnimatedValue: (initial) => new Value(initial),
      AccessibilityInfo: {
        isReduceMotionEnabled: () => Promise.resolve(reduced),
        addEventListener: (_, fn) => {
          changeMotion = fn;
          return { remove: () => { removed = true; } };
        },
      },
      Animated: {
        Value, View: "AnimatedView",
        timing: (_, config) => config,
        sequence: (configs) => {
          steps = configs;
          return { start: () => { started++; }, stop: () => { stopped++; } };
        },
      },
    },
    "expo-splash-screen": {
      preventAutoHideAsync: () => Promise.resolve(),
      hideAsync: () => { nativeHideCount++; return Promise.resolve(); },
    },
    "@/src/components/Mascot": { Mascot: "Mascot" },
    "@/src/theme": theme,
  }, {
    setTimeout: (fn, ms) => { scheduled.push({ fn, ms }); return 7; },
    clearTimeout: (id) => cleared.push(id),
  });
  const tree = AppSplash();
  assert.equal(elements(tree).find((n) => n.type === "Mascot").props.pose, "neutral");
  const cleanups = effects.map((effect) => effect());
  return {
    tree, scheduled, cleared, cleanups, changeMotion,
    snapshot: () => ({ hidden, nativeHideCount, started, stopped, removed, steps, values }),
  };
}

test("splash has one dismiss timeout and clears it and animation on unmount", async () => {
  const mounted = mountSplash();
  const { scheduled, cleared, cleanups, snapshot } = mounted;
  await Promise.resolve();
  const { nativeHideCount } = snapshot();
  assert.equal(nativeHideCount, 1);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].ms, 1800);
  scheduled[0].fn();
  assert.equal(snapshot().hidden, true);
  cleanups.forEach((cleanup) => cleanup());
  assert.equal(snapshot().removed, true);
  assert.ok(snapshot().stopped > 0);
  assert.deepEqual(cleared, [7]);
});

test("glitch reveal runs once for 350ms on native driver, with reduced-motion fallback", async () => {
  const mounted = mountSplash();
  await Promise.resolve();
  assert.equal(mounted.snapshot().started, 1);
  const { steps } = mounted.snapshot();
  assert.equal(steps.length, 5);
  assert.equal(steps.reduce((sum, step) => sum + step.duration, 0), 350);
  assert.ok(steps.every((step) => step.useNativeDriver && step.isInteraction === false));
  mounted.changeMotion(true);
  assert.ok(mounted.snapshot().stopped > 0);
  assert.equal(mounted.snapshot().values.at(-1), 1);
  mounted.cleanups.forEach((cleanup) => cleanup());
  const reduced = mountSplash(true);
  await Promise.resolve();
  assert.equal(reduced.snapshot().started, 0);
  reduced.cleanups.forEach((cleanup) => cleanup());
  for (const dispose of ["unmount", "dismiss"]) {
    const late = mountSplash();
    if (dispose === "unmount") late.cleanups.forEach((cleanup) => cleanup());
    else late.scheduled[0].fn();
    await Promise.resolve();
    assert.equal(late.snapshot().started, 0);
  }
});

test("visible branding uses the mascot instead of the old circle mark", () => {
  for (const file of ["src/components/Ticker.tsx", "app/pro.tsx", "app/share-savings.tsx"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /<Mascot /);
    assert.doesNotMatch(source, /assets\/images\/(?:logo-mark|logo-full|icon)\.png/);
  }
});

test("native query focus pauses background reads and resumes on active, with cleanup", () => {
  const calls = [];
  let listener;
  let removed = false;
  const { bindNativeQueryFocus } = load("src/lib/query-focus.ts", {
    "@tanstack/react-query": { focusManager: { setFocused: (value) => calls.push(value) } },
    "react-native": {
      Platform: { OS: "android" },
      AppState: {
        currentState: "background",
        addEventListener: (event, fn) => {
          assert.equal(event, "change");
          listener = fn;
          return { remove: () => { removed = true; } };
        },
      },
    },
  });
  const cleanup = bindNativeQueryFocus();
  listener("active");
  listener("inactive");
  listener("background");
  cleanup();
  assert.deepEqual(calls, [false, true, false, false, undefined]);
  assert.equal(removed, true);
});

test("web keeps browser visibility handling and null native startup state is not forced inactive", () => {
  for (const os of ["web", "android"]) {
    let subscriptions = 0;
    const { bindNativeQueryFocus } = load("src/lib/query-focus.ts", {
      "@tanstack/react-query": { focusManager: { setFocused: () => assert.fail("must not set focus") } },
      "react-native": {
        Platform: { OS: os },
        AppState: {
          currentState: null,
          addEventListener: () => { subscriptions++; return { remove() {} }; },
        },
      },
    });
    bindNativeQueryFocus();
    assert.equal(subscriptions, os === "web" ? 0 : 1);
  }
});

const { annualSavingPercent } = load("src/lib/annual-saving.ts");
const price = (amount, currencyCode = "EUR") => ({ price: amount, currencyCode });

test("annual saving uses regular same-currency store prices, never invented discounts", () => {
  assert.equal(annualSavingPercent(price(49.99), price(7.99)), 48);
  assert.equal(annualSavingPercent(price(80, "USD"), price(10, "USD")), 33);
  for (const [annual, monthly] of [
    [undefined, price(7.99)], [price(49.99), undefined],
    [price(49.99, "EUR"), price(7.99, "USD")],
    [price(49.99, ""), price(7.99, "")],
    [price(96), price(8)], [price(100), price(8)],
    [price(0), price(8)], [price(-5), price(8)],
    [price(NaN), price(8)], [price(49.99), price(Infinity)],
  ]) assert.equal(annualSavingPercent(annual, monthly), null);
});

function renderPaywall(packages, extra = {}, selection = null) {
  let stateCall = 0;
  const { default: ProScreen } = load("app/pro.tsx", {
    react: {
      useMemo: (fn) => fn(),
      useState: (value) => [++stateCall === 2 ? selection : value, () => {}],
    },
    "react-native": Object.fromEntries(
      ["ActivityIndicator", "Image", "Modal", "Pressable", "ScrollView", "Text", "View"].map((n) => [n, n]),
    ),
    "expo-router": { useRouter: () => ({ back() {}, push() {} }) },
    "@react-native-vector-icons/material-design-icons": { __esModule: true, default: "Icon" },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    "@/src/components/Toast": { useToast: () => () => {} },
    "@/src/components/Mascot": { Mascot: "Mascot" },
    "@/src/lib/annual-saving": { annualSavingPercent },
    "@/src/lib/auth": { useAuth: () => ({ user: { id: "fixture" } }) },
    "@/src/lib/revenuecat": {
      isTestStore: false,
      useSubscription: () => ({
        offerings: { current: { availablePackages: packages } },
        identityReady: true, ...extra,
      }),
    },
    "@/src/theme": theme,
    "@/assets/images/icon.png": "existing-icon",
  });
  return elements(ProScreen());
}

const annual = { identifier: "annual-fixture", packageType: "ANNUAL", product: { ...price(49.99), priceString: "49,99 €" } };
const monthly = { identifier: "monthly-fixture", packageType: "MONTHLY", product: { ...price(7.99), priceString: "7,99 €" } };

test("paywall presenter accompanies real annual price and existing plan controls", () => {
  const nodes = renderPaywall([annual, monthly]);
  assert.ok(nodes.some((n) => n.props.testID === "pro-annual-offer"));
  assert.ok(nodes.some((n) => n.type === "Mascot" && n.props.pose === "offer"));
  assert.ok(nodes.some((n) => n.props.testID === "pro-plan-annual"));
  assert.ok(nodes.some((n) => n.props.testID === "pro-plan-monthly"));
  assert.ok(nodes.some((n) => n.props.testID === "pro-buy-button"));
  assert.equal(nodes.find((n) => n.props.testID === "pro-buy-button").props.disabled, false);
  assert.ok(nodes.find((n) => n.props.testID === "pro-plan-annual").props.style[1]);
  assert.match(nodes.find((n) => n.props.testID === "pro-annual-saving").props.children.join(""), /48 %/);
});

test("paywall respects manual selection and falls back safely when a package disappears", () => {
  const selected = renderPaywall([annual, monthly], {}, monthly.identifier);
  assert.ok(selected.find((n) => n.props.testID === "pro-plan-monthly").props.style[1]);
  assert.equal(!!selected.find((n) => n.props.testID === "pro-plan-annual").props.style[1], false);
  const removed = renderPaywall([monthly], {}, annual.identifier);
  assert.ok(removed.find((n) => n.props.testID === "pro-plan-monthly").props.style[1]);
  assert.equal(removed.find((n) => n.props.testID === "pro-buy-button").props.disabled, false);
});

test("no annual offer for unavailable, monthly-only, loading or already-subscribed states", () => {
  for (const [packages, extra] of [
    [[], {}], [[monthly], {}], [[annual, monthly], { isLoading: true }],
    [[annual, monthly], { isSubscribed: true }],
  ]) {
    const nodes = renderPaywall(packages, extra);
    assert.equal(nodes.some((n) => n.props.testID === "pro-annual-offer"), false);
    if (extra.isSubscribed) {
      assert.ok(nodes.some((n) => n.type === "Mascot" && n.props.pose === "proud"));
    }
  }
  const mismatched = { ...monthly, product: { ...monthly.product, currencyCode: "USD" } };
  assert.equal(renderPaywall([annual, mismatched]).some((n) => n.props.testID === "pro-annual-saving"), false);
});
