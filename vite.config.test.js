import test from "node:test";
import assert from "node:assert/strict";
import config from "./vite.config.js";

test("pre-caches generated JavaScript and CSS assets", () => {
  const plugin = config.plugins.find((entry) => entry.name === "supermartket-offline-app-shell");
  assert.ok(plugin, "offline app shell plugin must be registered");

  let emittedWorker;
  plugin.generateBundle.call(
    {
      emitFile(asset) {
        emittedWorker = asset;
      },
    },
    {},
    {
      "assets/index-example.js": { type: "chunk" },
      "assets/index-example.css": { type: "asset" },
      "assets/logo.svg": { type: "asset" },
    },
  );

  assert.equal(emittedWorker.fileName, "sw.js");
  assert.match(emittedWorker.source, /\/SuperMartket\/assets\/index-example\.js/);
  assert.match(emittedWorker.source, /\/SuperMartket\/assets\/index-example\.css/);
  assert.doesNotMatch(emittedWorker.source, /\/SuperMartket\/assets\/logo\.svg/);
});
