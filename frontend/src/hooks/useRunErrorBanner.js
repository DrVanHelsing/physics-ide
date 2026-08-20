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
 * The latched text persists until the caller dismisses it or a fresh run
 * starts — a stale error must not overlay a run that is now succeeding or
 * failing on its own terms — and a newer error simply replaces whatever was
 * latched.
 *
 * @param {{ type: string, text: string }} status
 * @param {boolean} running
 * @returns {[string|null, () => void]} [bannerText, dismiss]
 */
export function useRunErrorBanner(status, running) {
  const [latchedError, setLatchedError] = useState(null);
  const wasRunningRef = useRef(false);

  useEffect(() => {
    if (status.type === "error") setLatchedError(status.text);
  }, [status]);

  useEffect(() => {
    if (running && !wasRunningRef.current) setLatchedError(null);
    wasRunningRef.current = running;
  }, [running]);

  const dismiss = () => setLatchedError(null);
  return [latchedError, dismiss];
}
