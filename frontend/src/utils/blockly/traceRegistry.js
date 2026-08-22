/**
 * traceRegistry.js
 *
 * A shared, mutable registry of trace entries produced during Python code
 * generation from the Blockly workspace.  Entries are read by glowRunner
 * when it instruments the compiled JS for live-trace and pause/breakpoints.
 *
 * Kept as a module-level array (not a React state atom) because it must be
 * accessible synchronously from both the Blockly generator and the runner.
 */

/** @type {Array<{safeName: string, displayName: string, blockId: string}>} */
export const traceRegistry = [];

/**
 * Clear all entries from the trace registry.
 * Call this before each code-generation pass so stale entries are not
 * re-injected into the next run's compiled JS.
 */
export function clearTraceRegistry() {
  traceRegistry.length = 0;
}

/**
 * The block ids that can actually hold a breakpoint.
 *
 * Only a trace checkpoint can pause the runtime (glowRunner.js injects the
 * pause loop alongside each `_phtr_` assignment), and a checkpoint exists only
 * where the generator called tr() — seven block types. Before Tranche 3 the UI
 * happily accepted a breakpoint on any block and then never fired it.
 *
 * Valid only after a code-generation pass; call it from the same place that
 * reads `traceRegistry`.
 */
export function breakableIds() {
  const out = new Set();
  for (const e of traceRegistry) if (e.blockId) out.add(e.blockId);
  return out;
}
