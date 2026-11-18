const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function load(name, mocks, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(`${__dirname}/../src/components/${name}.tsx`, 'utf8');
  assert.doesNotMatch(source, /logo-mark\.png/);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  vm.runInNewContext(outputText, { exports, ...globals, require: (id) => id === 'react/jsx-runtime' ? require(id) : mocks[id] ?? (() => { throw new Error(id); })() });
  return exports[name];
}

function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}

function mount(reduce) {
  const timers = new Map();
  let frame = 0, id = 0, hidden = 0, effect;
  const Splash = load('AppSplash', {
    react: { useState: () => [frame, (next) => { frame = next; }], useEffect: (fn) => { effect = fn; } },
    'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: (x) => x, absoluteFillObject: {} }, AccessibilityInfo: { isReduceMotionEnabled: async () => reduce } },
    'expo-splash-screen': { preventAutoHideAsync: async () => {}, hideAsync: async () => { hidden++; } },
    './Mascot': { Mascot: 'Mascot' },
  }, { setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; }, clearTimeout: (key) => timers.delete(key) });
  Splash();
  const cleanup = effect();
  return { timers, Splash, cleanup, hidden: () => hidden, fire(ms) {
    const entry = [...timers].find(([, timer]) => timer.ms === ms);
    assert.ok(entry, `missing timer ${ms}`);
    timers.delete(entry[0]);
    entry[1].fn();
  } };
}

test('Freak Labs appears before the sunglasses mascot and then releases the app', async () => {
  const state = mount(false);
  await Promise.resolve();
  assert.equal(state.hidden(), 1);
  assert.ok(!nodes(state.Splash()).some((n) => n.type === 'Mascot'));
  for (const ms of [260, 560, 890]) state.fire(ms);
  assert.ok(nodes(state.Splash()).some((n) => Array.isArray(n.props.children) && n.props.children.includes('Freak ')));
  state.fire(1240);
  assert.equal(nodes(state.Splash()).find((n) => n.type === 'Mascot')?.props.pose, 'neutral');
  state.fire(1320);
  assert.ok(nodes(state.Splash()).some((n) => n.type === 'Mascot'));
  state.fire(2120);
  assert.equal(state.Splash(), null);
  state.cleanup();
});

test('reduced motion skips to the mascot; unmount clears the timers', async () => {
  const state = mount(true);
  await Promise.resolve();
  assert.equal(nodes(state.Splash()).find((n) => n.type === 'Mascot')?.props.pose, 'neutral');
  assert.deepEqual([...state.timers.values()].map((t) => t.ms), [800]);
  state.cleanup();
  assert.equal(state.timers.size, 0);
  const early = mount(true);
  early.cleanup();
  await Promise.resolve();
  assert.equal(early.timers.size, 0);
});

test('main ticker renders the neutral mascot alongside LIVE', () => {
  const Ticker = load('Ticker', {
    react: { useEffect: () => {} }, 'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable' },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useSharedValue: (value) => ({ value }), useAnimatedStyle: () => ({}) },
    '@/src/lib/format': { fmtClock: () => '', fmtMoney: () => '' },
    '@/src/theme': { fonts: {}, makeStyles: (factory) => () => factory({}), useTheme: () => ({ colors: {} }) },
    './Mascot': { Mascot: 'Mascot' },
  });
  const tree = nodes(Ticker({ activeCount: 3 }));
  assert.equal(nodes(tree.find((n) => n.props.testID === 'ticker-logo')).find((n) => n.type === 'Mascot')?.props.pose, 'neutral');
  assert.ok(tree.some((n) => n.props.children === 'LIVE'));
});
