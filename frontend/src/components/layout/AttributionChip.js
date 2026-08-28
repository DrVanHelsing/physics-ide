import React, { useEffect, useState } from "react";
import { getShareAttribution } from "../../utils/storage/shareMeta";
import { attributionSentence, refreshShareAttributions } from "../../utils/sharing/attribution";

/** The copy's permanent credit (spec §8.1), wherever the copy is
 *  identified — here, the status bar, after RulesChip and BatonChip.
 *  Renders nothing for a project with no attribution; text is the channel
 *  (colour never alone), and the sidecar makes it offline-correct.
 *
 *  Two paths populate it. The ordinary one is the sidecar read below —
 *  already seeded by StartMenu's own refresh by the time a project is
 *  opened from the library. The second is a deep-linked or reloaded IDE
 *  session on a SECOND DEVICE that never visited the Start Menu: the
 *  sidecar has no record yet for this projectId. That absence is the
 *  ONLY trigger for calling refreshShareAttributions() here — a record
 *  already in the sidecar means no network round trip on an ordinary
 *  project open. */
export default function AttributionChip({ projectId }) {
  const [attribution, setAttribution] = useState(null);
  useEffect(() => {
    let dead = false;
    if (!projectId) {
      setAttribution(null);
      return undefined;
    }
    getShareAttribution(projectId).then((a) => {
      if (dead) return;
      if (a) {
        setAttribution(a);
        return;
      }
      refreshShareAttributions().then((all) => {
        if (!dead) setAttribution(all[projectId] || null);
      });
    });
    return () => {
      dead = true;
    };
  }, [projectId]);
  if (!attribution) return null;
  const sentence = attributionSentence(attribution.sharerName);
  return (
    <span className="sync-chip attribution-chip" title={sentence}>
      <span className="attribution-chip__text">{sentence}</span>
    </span>
  );
}
