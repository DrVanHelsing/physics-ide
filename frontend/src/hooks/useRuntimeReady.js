import { useEffect, useState } from "react";
import { getRuntimeScene } from "../utils/runner/glowRunner";

/** Polls for the GlowScript scene after a run starts. One implementation for
 *  the two former copies (GlowCanvas ~9s, ViewportControls ~6s). */
export function useRuntimeReady({ enabled, tries = 40, intervalMs = 150, onReady } = {}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) { setReady(false); return undefined; }
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      const scene = getRuntimeScene();
      if (scene) { clearInterval(id); setReady(true); onReady?.(scene); }
      else if (count >= tries) clearInterval(id);
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, tries, intervalMs]);
  return ready;
}
