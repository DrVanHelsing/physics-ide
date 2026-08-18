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
