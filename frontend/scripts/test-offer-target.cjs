const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");
const exports_ = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/offer-target.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exports_, URL });
const { offerTarget, merchantLanding, merchantSearchTarget, confirmedTarget, homepageClickHint } = exports_;
const now = Date.now();
const g = {
  title: "Exact model", product_id: "sku-black", status: "active", price_conflict: false,
  glitched_price: 50, currency: "EUR", url: "https://shop.example/product",
  source_url: "https://example.com/original", affiliate_url: null, link_status: "checked",
  link_check: { passed: true, checked_at: new Date(now).toISOString(),
    title: "Exact model", product_id: "sku-black", price: 50, currency: "EUR",
    url: "https://shop.example/product" },
};
test("only an exact fresh proof exposes a purchase target", () => {
  assert.equal(offerTarget(g, now).purchase, true);
  for (const patch of [
    { link_status: "unverified" }, { link_check: null }, { price_conflict: true },
    { glitched_price: 49 }, { product_id: "sku-blue" }, { status: "expired" },
    { url: "https://shop.example/other" }, { expires_at: new Date(now-1000).toISOString() },
    { link_check: { ...g.link_check, checked_at: new Date(now-16*60_000).toISOString() } },
  ]) {
    const result = offerTarget({ ...g, ...patch }, now);
    assert.equal(result.purchase, false);
    assert.equal(result.url, g.source_url);
  }
});
test("a stale cached affiliate cannot bypass the source fallback", () => {
  const result = offerTarget({ ...g, link_status: "unverified", affiliate_url: "https://tracker.example/wrong" }, now);
  assert.equal(result.purchase, false);
  assert.equal(result.url, g.source_url);
});
test("a checked product does not authorize an unchecked affiliate redirect", () => {
  const result = offerTarget({ ...g, affiliate_url: "https://tracker.example/wrong" }, now);
  assert.equal(result.purchase, true);
  assert.equal(result.url, g.url);
});
test("unsafe or malformed source URLs are never opened", () => {
  for (const source_url of ["javascript:alert(1)", "http://example.com", "https://user:pass@example.com", "invalid"]) {
    assert.equal(offerTarget({ ...g, link_check: null, source_url }, now).url, null);
  }
});

test("a homepage or search landing requires explicit user confirmation and never exposes the product URL", () => {
  assert.equal(merchantLanding({ ...g, shop: "Amazon" }), "https://www.amazon.de/");
  assert.equal(merchantSearchTarget({ ...g, shop: "Amazon" }), "https://www.amazon.de/s?k=Exact%20model");
  assert.equal(merchantLanding({ ...g, shop: "Unknown Store" }), null);
  assert.equal(merchantSearchTarget({ ...g, shop: "Unknown Store" }), null);
  const unverified = { ...g, link_check: null, link_status: "unverified", shop: "Amazon" };
  assert.equal(confirmedTarget(unverified, false, now).landing, null);
  const confirmed = confirmedTarget(unverified, true, now);
  assert.equal(confirmed.landing, "https://www.amazon.de/s?k=Exact%20model");
  assert.equal(confirmed.purchase, false);
  assert.ok(!("https://shop.example/product" === confirmed.url && !confirmed.purchase));
  const fallbackConfirmed = confirmedTarget({ ...unverified, title: "" }, true, now);
  assert.equal(fallbackConfirmed.landing, "https://www.amazon.de/");
  assert.equal(homepageClickHint(unverified, now) === null, false);
  assert.equal(homepageClickHint({ ...g }, now), null);
});

test("a raw arbitrary shop name is never turned into a homepage domain", () => {
  assert.equal(merchantLanding({ ...g, shop: "example.com/../../login" }), null);
  assert.equal(merchantSearchTarget({ ...g, shop: "example.com/../../login" }), null);
  assert.equal(merchantLanding({ ...g, shop: "evil.example" }), null);
  assert.equal(merchantLanding({ ...g, shop: "Amazon " }), "https://www.amazon.de/");
});
