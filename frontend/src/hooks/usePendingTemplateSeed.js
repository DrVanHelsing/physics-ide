/**
 * usePendingTemplateSeed — the IDE-side half of the welcome page's openable
 * worked-project tiles (see welcome/pendingTemplate.js and
 * StartMenu.js's resolvePendingTemplateSpec).
 *
 * A tile click stamps a template id into sessionStorage and navigates to
 * "/" through the ordinary gated go() path; it does not and cannot create
 * the project itself, since manifest-building lives in the IDE. This hook
 * is the seam that picks the note up once the project bootstrap has
 * settled (`proj.loaded`) and creates the project through the SAME path
 * the wizard's "Create project" button uses — buildManifestSpec, then
 * createNew — never a fork of that logic.
 *
 * No pending id, or an id that does not match a real template, is exactly
 * today's behaviour: nothing runs, the ordinary start menu (or a restored
 * project) shows as it always did. consumePendingTemplate() removes the
 * key on read, and this hook additionally guards with a ref so its own
 * effect body runs at most once per mount — together, a reload after
 * landing never re-creates the project.
 */
import { useEffect, useRef } from "react";
import { consumePendingTemplate } from "../welcome/pendingTemplate";
import { resolvePendingTemplateSpec } from "../components/StartMenu";

export function usePendingTemplateSeed(proj) {
  const consumedRef = useRef(false);
  useEffect(() => {
    if (!proj.loaded || consumedRef.current) return;
    consumedRef.current = true;
    const id = consumePendingTemplate();
    if (!id) return;
    const spec = resolvePendingTemplateSpec(id);
    if (!spec) return;
    Promise.resolve(proj.createNew(spec)).catch((err) => {
      console.warn("usePendingTemplateSeed: failed to seed project from template:", err);
    });
    // Only proj.loaded gates when this fires; proj itself is a fresh object
    // every render (useProject.js returns a new literal), so it is read
    // through the closure rather than listed as a dependency — same pattern
    // useProject.js's own bootstrap-restore effects use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj.loaded]);
}
