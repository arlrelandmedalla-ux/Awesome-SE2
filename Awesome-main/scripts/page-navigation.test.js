const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const indexPath = path.join(__dirname, "..", "index.html");
const indexHtml = fs.readFileSync(indexPath, "utf8");
const navigationScriptMatch = indexHtml.match(/<script>\s*([\s\S]*?)<\/script>/i);
if (!navigationScriptMatch) throw new Error("Could not find the page navigation script.");
const navigationScript = new vm.Script(navigationScriptMatch[1], { filename: indexPath });

function runNavigation(type) {
  const listeners = new Map();
  const scrollCalls = [];
  const style = { scrollBehavior: "smooth" };
  const history = { scrollRestoration: "auto" };
  const window = {
    addEventListener(eventName, listener, options) {
      listeners.set(eventName, { listener, options });
    },
    scrollTo(x, y) {
      scrollCalls.push([x, y]);
    }
  };
  const document = { documentElement: { style } };

  navigationScript.runInNewContext({
    document,
    history,
    performance: { getEntriesByType: () => [{ type }] },
    window
  });

  return { history, listeners, scrollCalls, style };
}

test("starts at the top after direct navigation and reload", () => {
  for (const type of ["navigate", "reload"]) {
    const state = runNavigation(type);
    assert.equal(state.history.scrollRestoration, "manual");
    const pageshow = state.listeners.get("pageshow");
    assert.ok(pageshow);
    assert.equal(pageshow.options.once, true);

    pageshow.listener();

    assert.deepEqual(state.scrollCalls, [[0, 0]]);
    assert.equal(state.style.scrollBehavior, "smooth");
    assert.equal(state.history.scrollRestoration, "auto");
  }
});

test("preserves browser scroll restoration when returning through history", () => {
  const state = runNavigation("back_forward");

  assert.equal(state.history.scrollRestoration, "auto");
  assert.equal(state.listeners.has("pageshow"), false);
  assert.deepEqual(state.scrollCalls, []);
});
