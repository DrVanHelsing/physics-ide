/**
 * The hybrid analyse swap/return orchestration, extracted from IDELayout so
 * the ORDER is a tested contract rather than a convention (review round 1 of
 * the data-loss hotfix): nothing may replace the workspace before the stash
 * op has succeeded, a cancelled confirm leaves everything untouched, and a
 * failed op must surface through onError instead of vanishing. IDELayout
 * binds these to useProject/useSimulation; analyseFlow.test.js pins the
 * sequencing with fakes.
 */

/* onError receives (err, phase): phase "op" = the stash/restore itself threw
   (nothing was persisted/applied for swap; nothing restored for return);
   phase "teardown" = the persisted half SUCCEEDED and only the view work
   after it threw. The distinction exists so user-facing copy can be honest
   about data state (review M3). */
export async function performAnalyseSwap(deps, xml) {
  const { analyseStash, exitDebug, loadWorkspaceXml, bumpReloadKey, closeChart, onError } = deps;
  let stashed;
  try {
    stashed = await analyseStash();
  } catch (err) {
    onError(err, "op");
    return false;
  }
  // Cancelled (or no project): the workspace is untouched, byte-identical.
  if (!stashed) return false;
  try {
    exitDebug?.();
    loadWorkspaceXml(xml);
    bumpReloadKey();
    closeChart();
  } catch (err) {
    // The stash persisted before anything was replaced — recoverable.
    onError(err, "teardown");
    return false;
  }
  return true;
}

export async function performAnalyseReturn(deps) {
  const { analyseRestore, exitDebug, stopRun, bumpReloadKey, closeChart, onError } = deps;
  let restored;
  try {
    restored = await analyseRestore();
  } catch (err) {
    onError(err, "op");
    return false;
  }
  if (!restored) return false;
  try {
    exitDebug?.();
    stopRun();
    bumpReloadKey();
    closeChart();
  } catch (err) {
    // The restore persisted AND applied before this — the blocks are back.
    onError(err, "teardown");
    return false;
  }
  return true;
}
