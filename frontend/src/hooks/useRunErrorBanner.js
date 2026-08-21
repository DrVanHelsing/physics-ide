import { useEffect, useRef, useState } from "react";

/**
 * Latches a run error's text into its own state so the run-error banner
 * actually persists.
 *
 * `status` is a shared single-slot bulletin — export success, mode
 * switches, workspace clears, and debug entry all overwrite it (see
 * useExport.js, useSimulation.js, useDebug.js). Deriving the banner text
 * straight from `status` makes it vanish the instant any later status
 * message is posted, reproducing the exact "overwritten by the next status
 * string" bug the banner exists to fix.
 *
 * The latched text persists until the caller dismisses it, a fresh run
 * starts, or `sessionKey` changes — a stale error must not overlay a run
 * that is now succeeding or failing on its own terms, and it must not
 * follow the student into a different project either: an error belongs to
 * one project's run. IDELayout passes `proj.activeProjectId` as the key, so
 * switching projects (or returning to the start menu) clears the latch even
 * though this hook call itself survives the navigation.
 *
 * @param {{ type: string, text: string }} status
 * @param {boolean} running
 * @param {string|null} [sessionKey]
 * @returns {[string|null, () => void]} [bannerText, dismiss]
 */
export function useRunErrorBanner(status, running, sessionKey = null) {
  const [latchedError, setLatchedError] = useState(null);
  const wasRunningRef = useRef(false);
  const sessionKeyRef = useRef(sessionKey);

  useEffect(() => {
    if (status.type === "error") setLatchedError(status.text);
  }, [status]);

  useEffect(() => {
    if (running && !wasRunningRef.current) setLatchedError(null);
    wasRunningRef.current = running;
  }, [running]);

  useEffect(() => {
    if (sessionKeyRef.current !== sessionKey) {
      sessionKeyRef.current = sessionKey;
      setLatchedError(null);
    }
  }, [sessionKey]);

  const dismiss = () => setLatchedError(null);
  return [latchedError, dismiss];
}
