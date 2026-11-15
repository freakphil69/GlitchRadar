const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

function mount(overrides = {}, options = {}) {
  let analysisCalls = 0;
  const events = [];
  const effects = [];
  const state = { values: new Map() };
  const item = {
    id: "audit-17", type: "coupon", title: "LG OLED TV", shop: "Conrad",
    category: "Elektronik", source_label: "MYDEALZ", source_url: "https://example.com/original",
    risk_level: "high", success_rate: 1, status: "active", enriched: false,
    instructions: [], tips: [], discount_pct: 0, ...overrides,
  };
  const mocks = {
    react: { useEffect: f => effects.push(f), useRef: value => ({ current: value }),
      useState: value => [state.values.has(value) ? state.values.get(value) : value, next => {
        state.values.set(value, typeof next === "function" ? next(state.values.get(value) ?? value) : next);
      }] },
    "react-native": { ActivityIndicator: "ActivityIndicator", Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", View: "View" },
    "expo-image": { Image: "Image" },
    "expo-clipboard": {}, "expo-web-browser": { openBrowserAsync: async url => events.push(["open", url]) }, "expo-haptics": {},
    "expo-router": { useLocalSearchParams: () => ({ id: item.id }), useRouter: () => ({}) },
    "@react-native-vector-icons/material-design-icons": "Icon",
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    "@/src/components/Age": { Age: "Age" }, "@/src/components/ChipRow": { ChipRow: "ChipRow" },
    "@/src/components/Countdown": { Countdown: "Countdown" },
    "@/src/components/Toast": { useToast: () => () => events.push(["toast"]) },
    "@/src/lib/format": { fmtMoney: String, fmtPrice: String, imgSrc: String, fmtDateTime: () => "date" },
    "@/src/lib/offer-target": {
      offerTarget: () => ({ url: item.source_url, purchase: false }),
      merchantLanding: () => item.landing ?? null,
      merchantSearchTarget: () => item.landing ?? null,
      homepageClickHint: () => item.landing ? "HINT" : null,
      confirmedTarget: (data, confirm) => ({ url: confirm || !item.landing ? data.source_url : null, purchase: false, landing: confirm ? item.landing : null }),
    },
    "@/src/lib/queries": {
      useGlitch: () => ({ data: item, refetch: async () => {
        events.push(["refetch"]);
        return options.refetchError ? { isError: true } : { data: item };
      } }),
      useEnrich: () => ({ mutate: () => analysisCalls++, isPending: false, isError: false }),
      useReportDead: () => ({}),
    },
    "@/src/lib/stash": { useIsStashed: () => false, useStashActions: () => ({}) },
    "@/src/lib/types": { RISK_LABELS: { high: "HOCH" }, TYPE_LABELS: { coupon: "GUTSCHEIN" } },
    "@/src/theme": { fonts: {}, spacing: {}, radius: {}, useTheme: () => ({ colors: {} }), makeStyles: () => () => ({}) },
  };
  const output = ts.transpileModule(fs.readFileSync("app/glitch/[id].tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require(name) {
    if (name === "react/jsx-runtime") return require(name);
    if (name in mocks) return mocks[name];
    throw Error(`Unexpected import: ${name}`);
  } });
  const render = () => {
    const root = exports.default();
    for (const effect of effects) effect();
    effects.length = 0;
    function walk(node) {
      if (Array.isArray(node)) return node.flatMap(walk);
      if (!node?.props) return [];
      return [node, ...walk(node.props.children)];
    }
    return walk(root);
  };
  const nodes = render();
  return { nodes, rerender: () => { nodes.length = 0; nodes.push(...render()); }, calls: () => analysisCalls, events };
}

test("opening an offer never starts an optional paid analysis", () => {
  assert.equal(mount().calls(), 0);
});

test("optional analysis is available through an explicit user action", () => {
  const screen = mount();
  const button = screen.nodes.find(n => n.props.testID === "enrich-request-button");
  assert.ok(button);
  button.props.onPress();
  assert.equal(screen.calls(), 1);
});

test("a conflicting legacy price shows a warning instead of false certainty", () => {
  const screen = mount({ price_conflict: true });
  assert.ok(screen.nodes.some(n => n.props.testID === "detail-price-conflict"));
  assert.ok(!screen.nodes.some(n => n.props.children === "TREFFERQUOTE"));
});

test("saved instructions remain visible without a new analysis call", () => {
  const screen = mount({ enriched: true, instructions: ["Bedingungen im Original prüfen"] });
  assert.equal(screen.calls(), 0);
  assert.ok(screen.nodes.some(n => n.props.children === "Bedingungen im Original prüfen"));
});

test("opening the target refreshes the API before opening a browser", async () => {
  const screen = mount();
  await screen.nodes.find(n => n.props.testID === "detail-shop-button").props.onPress();
  assert.equal(screen.events[0][0], "refetch");
  assert.equal(screen.events.at(-1)[0], "open");
  assert.equal(screen.calls(), 0);
});

test("failed fresh lookup never opens an old cached merchant link", async () => {
  const screen = mount({ url: "https://shop.example/old-product" }, { refetchError: true });
  await screen.nodes.find(n => n.props.testID === "detail-shop-button").props.onPress();
  assert.equal(screen.events[0][0], "refetch");
  assert.ok(!screen.events.some(e => e[0] === "open"));
});

test("a homepage landing is announced and requires two deliberate taps", async () => {
  const screen = mount({ landing: "https://www.amazon.de/" });
  assert.ok(screen.nodes.some(n => n.props.testID === "detail-homepage-click-hint"));
  const first = screen.nodes.find(n => n.props.testID === "detail-homepage-button");
  assert.ok(first);
  assert.ok(!screen.events.some(e => e[0] === "open"));
  first.props.onPress();
  assert.ok(!screen.events.some(e => e[0] === "open"));
  screen.rerender();
  const second = screen.nodes.find(n => n.props.testID === "detail-homepage-button");
  await second.props.onPress();
  await Promise.resolve();
  assert.ok(screen.events.some(e => e[0] === "refetch" || e[0] === "toast" || e[0] === "open"));
  assert.ok(screen.events.some(e => e[0] === "open" && e[1] === "https://www.amazon.de/"));
});

test("without a known homepage the shop button stays the direct target flow", async () => {
  const screen = mount();
  assert.ok(screen.nodes.some(n => n.props.testID === "detail-shop-button"));
  assert.ok(!screen.nodes.some(n => n.props.testID === "detail-homepage-click-hint"));
  await screen.nodes.find(n => n.props.testID === "detail-shop-button").props.onPress();
  assert.equal(screen.events.at(-1)[0], "open");
});
