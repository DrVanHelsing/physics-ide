/**
 * The one Blockly entry point. Every module that used to read window.Blockly
 * imports this instead. Side-effects on import: standard blocks registered,
 * English locale installed, Python generator attached as Blockly.Python —
 * the name the generator layer has always used, so its 115 call sites and
 * getPythonGen() keep working unchanged.
 *
 * blockly/core is imported as a namespace, not a default import: under
 * Vite/Vitest's dev + test resolution "blockly/core" lands on the CJS
 * blockly_compressed.js (which does have a default export), but `vite
 * build`'s Rollup resolves the package's "import" condition to blockly.mjs,
 * a genuine ESM re-export with no default at all — a default import builds
 * fine in dev/test and then fails `vite build` with "default is not
 * exported by blockly.mjs". Namespace-importing and unwrapping
 * `.default ?? namespace` works under both resolutions, and copying it into
 * a plain object (rather than using the frozen module-namespace object
 * directly) is what makes `Blockly.Python = pythonGenerator` below legal.
 *
 * The unwrap goes through a helper (rather than `ns.default` inline) so
 * Rollup's static export-shape check — which does fire on a direct
 * `BlocklyModule.default` / `En.default` property read even though the
 * `?? ns` fallback makes it safe at runtime — doesn't emit a
 * "'default' is not exported by ..." build warning for a case that's
 * deliberately resolution-dependent.
 *
 * amdGuard is imported first, purely for its side effect (see that file):
 * it hides window.define for the span of these four Blockly imports so
 * their UMD wrappers can't collide with the Monaco AMD loader index.html
 * installs. Restored below, once Blockly's own imports have finished
 * evaluating.
 */
import "./amdGuard";
import * as BlocklyModule from "blockly/core";
import "blockly/blocks";
import * as En from "blockly/msg/en";
import { pythonGenerator } from "blockly/python";

if (typeof window !== "undefined") {
  window.define = window.__blocklyAmdGuardSavedDefine;
  delete window.__blocklyAmdGuardSavedDefine;
}

function unwrapDefault(ns) {
  const key = "default";
  return ns[key] ?? ns;
}

const Blockly = Object.assign({}, unwrapDefault(BlocklyModule));

Blockly.setLocale(unwrapDefault(En));
Blockly.Python = pythonGenerator;

export default Blockly;
