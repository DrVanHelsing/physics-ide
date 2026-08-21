/**
 * Side-effect-only module, imported first by blocklyLib.js.
 *
 * Blockly's own package internals are UMD-wrapped (blockly_compressed.js,
 * blocks_compressed.js, python_compressed.js, msg/en.js all probe
 * `typeof define === "function" && define.amd` at evaluation time — this is
 * true even for the .mjs "import"-condition entry points, since those just
 * re-export from the same compressed UMD files under the hood). index.html
 * loads the Monaco editor's AMD loader (loader.min.js) in <head>, which
 * installs exactly such a `define`. Monaco's loader also only tolerates one
 * anonymous `define()` call per evaluated script, so when Blockly's UMD
 * probe sees Monaco's `define` already on window, it collides and throws
 * "Can only have one anonymous define call per script file" — an uncaught
 * top-level error partway through the module graph that stops the app from
 * ever mounting (the same class of conflict index.html's comment about
 * GlowScript's "AMD temporarily disabled" already calls out; GlowScript
 * dodges it by running inside its own iframe, which Blockly — rendering
 * straight into the host document — can't do).
 *
 * Hiding `window.define` for the span of Blockly's own imports (restored
 * immediately after, in blocklyLib.js) forces every one of those UMD
 * wrappers down its non-AMD branch instead, exactly as they'd resolve with
 * no AMD loader present at all.
 */
if (typeof window !== "undefined") {
  window.__blocklyAmdGuardSavedDefine = window.define;
  window.define = undefined;
}
