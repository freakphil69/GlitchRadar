const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");

test("merge preserves the current Android and iOS application identifiers", () => {
  const { expo } = JSON.parse(fs.readFileSync("app.json", "utf8"));
  assert.equal(expo.android.package, "glitchradar.app");
  assert.equal(expo.ios.bundleIdentifier, "glitchradar.app");
});

test("release build remains an AAB with draft submission to the internal test track", () => {
  const config = JSON.parse(fs.readFileSync("eas.json", "utf8"));
  assert.equal(config.build.production.android.buildType, "app-bundle");
  assert.equal(config.build.production.environment, "production");
  assert.equal(config.build.preview.android.buildType, "apk");
  assert.equal(config.build.preview.distribution, "internal");
  assert.equal(config.submit.production.android.track, "internal");
  assert.equal(config.submit.production.android.releaseStatus, "draft");
});
