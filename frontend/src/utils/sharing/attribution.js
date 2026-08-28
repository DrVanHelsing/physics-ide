import { api } from "../api/client";
import { listShareAttribution, setShareAttribution } from "../storage/shareMeta";

/** §8.1's own sentence — built in ONE place, asserted verbatim by tests. */
export function attributionSentence(name) {
  return `Based on work shared by ${name}`;
}

/**
 * Refresh the sidecar's cached sharer names from the server (design D§7:
 * rendered from the sidecar offline, resolved to a live name when online —
 * an erased sharer comes back as "Removed student", and a copy accepted on
 * another device gains its local attribution here, since the sync engine
 * pulls the project but knows nothing of sharing). Signed out or offline,
 * the catch keeps the cache standing.
 */
export async function refreshShareAttributions() {
  try {
    const res = await api("/api/shares/attributions");
    for (const [projectId, attribution] of Object.entries(res.attributions)) {
      await setShareAttribution(projectId, attribution);
    }
  } catch {
    /* offline or signed out — the cache stands */
  }
  return listShareAttribution();
}
