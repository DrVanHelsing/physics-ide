/**
 * Transform probe: a JSX-bearing .js module that exists only so a test can
 * import it. If this file stops compiling under Vitest, the JSX-in-.js shim in
 * vite.config.mjs has regressed and every component test is about to break
 * with an opaque "invalid JS syntax" error. Keep it trivial.
 */
import React from "react";

export default function JsxProbe({ label = "probe" }) {
  return <button type="button" className="jsx-probe">{label}</button>;
}
