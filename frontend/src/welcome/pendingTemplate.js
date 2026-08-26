/**
 * pendingTemplate — the handoff between a welcome-page tile and the IDE.
 *
 * A worked-project tile on WelcomePage names a real template and opens the
 * IDE with it already loaded, as a guest, in one click. WelcomePage cannot
 * build that project itself — manifest-building lives in the IDE (see
 * StartMenu's buildManifestSpec and useProject's createNew) — so a tile
 * click leaves a note here and the IDE reads it once on the way in
 * (IDELayout, via hooks/usePendingTemplateSeed.js).
 *
 * sessionStorage, not localStorage: the note shares the welcome pass
 * stamp's lifetime (WELCOME_PASSED_SESSION_KEY, constants/index.js) — one
 * browser tab's session — and a tab that blocks storage (private mode)
 * degrades to "no template pending": the click still navigates through
 * go(), the IDE just opens to its ordinary start menu instead of a
 * template. Both functions are wrapped in try/catch for exactly that case.
 */

const PENDING_TEMPLATE_KEY = "pide_pending_template";

/** Called by a tile's click handler, before go() navigates to "/". */
export function setPendingTemplate(id) {
  try {
    sessionStorage.setItem(PENDING_TEMPLATE_KEY, id);
  } catch {
    // Storage blocked — the click still navigates; nothing pends.
  }
}

/**
 * Read + remove in one call, so the key is consumed exactly once: a reload
 * after landing finds nothing pending and must not re-create the project.
 * Returns the id, or null when nothing is pending or storage is blocked.
 */
export function consumePendingTemplate() {
  try {
    const id = sessionStorage.getItem(PENDING_TEMPLATE_KEY);
    if (id) sessionStorage.removeItem(PENDING_TEMPLATE_KEY);
    return id || null;
  } catch {
    return null;
  }
}
