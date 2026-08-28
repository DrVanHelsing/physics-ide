/**
 * "Open this project now" — the one-way channel from the portal into the IDE.
 *
 * The portal's two hand-offs into the workspace (Start work on the assignment
 * page, Open a test copy in the marking room) both settle on a project id,
 * stamp it into LAST_PROJECT_KEY, and then `navigate("/")`. That stamp is
 * what a RELOAD of "/" restores from — ProjectContext reads the key once, in
 * its bootstrap effect — but a client-side navigation remounts nothing, so the
 * bootstrap has long since run and the student lands on the start menu
 * instead of the work they just pressed a button to open.
 *
 * This is the missing half of that handshake: the caller announces the id it
 * settled on, ProjectContext subscribes and switches the active project to
 * it. The key still gets stamped — it is the correct answer for a reload, and
 * `openProject` writes it again anyway — so nothing about the reload path
 * changes.
 *
 * Same subscribe-and-unsubscribe shape as projectStore's own `onProjectSaved`
 * / `onProjectDeleted`, for the same reason: the decision is made down here,
 * and the thing that has to act on it lives up there.
 */
const listeners = new Set();

/** @param {(projectId: string) => void} fn @returns {() => void} unsubscribe */
export function onProjectOpenRequested(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Ask whoever owns the active project to switch to `projectId`. With nobody
 *  subscribed this does nothing at all — the LAST_PROJECT_KEY stamp beside
 *  every call site is what covers that case. */
export function requestProjectOpen(projectId) {
  if (!projectId) return;
  for (const fn of listeners) {
    try {
      fn(projectId);
    } catch {
      /* a listener never breaks the navigation it hangs off */
    }
  }
}
