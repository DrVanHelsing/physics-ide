import React, { useEffect, useState } from "react";
import { getShareAttribution } from "../../utils/storage/shareMeta";
import { attributionSentence } from "../../utils/sharing/attribution";

/** The copy's permanent credit (spec §8.1), wherever the copy is
 *  identified — here, the status bar, after RulesChip and BatonChip.
 *  Renders nothing for a project with no attribution; text is the channel
 *  (colour never alone), and the sidecar makes it offline-correct. */
export default function AttributionChip({ projectId }) {
  const [attribution, setAttribution] = useState(null);
  useEffect(() => {
    let dead = false;
    if (!projectId) {
      setAttribution(null);
      return undefined;
    }
    getShareAttribution(projectId).then((a) => {
      if (!dead) setAttribution(a);
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
