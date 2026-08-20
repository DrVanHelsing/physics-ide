import React, { useState } from "react";
import { XIcon, GraduationCapIcon } from "./Icons";

const TIPS = {
  physics: [
    { id: "ph-run",   text: "Press Run in the toolbar to start your simulation." },
    { id: "ph-var",   text: "Open the Objects drawer to add balls, boxes and springs to your scene." },
    { id: "ph-trace", text: "Click Record in the Variables panel to capture data while simulating." },
  ],
  datascience: [
    { id: "ds-load",  text: "Start with Load data → Load built-in dataset to import penguins, weather, or planets." },
    { id: "ds-show",  text: "Add Show table to see your dataset immediately." },
    { id: "ds-chart", text: "Drag a Chart block (bar, line, scatter) after your data to visualise results." },
  ],
  hybrid: [
    { id: "hy-sim",   text: "Run your simulation and click Record to capture variable data." },
    { id: "hy-save",  text: "After recording, click Chart in the Variables panel to promote the run to a dataset." },
    { id: "hy-trace", text: "Use Load trace dataset in DS blocks to analyse your simulation output." },
  ],
};

export default function BeginnerGuide({ goal, checkpointState, onDismiss }) {
  const tips = TIPS[goal] || TIPS.physics;
  const [dismissed, setDismissed] = useState(() => {
    const saved = checkpointState?.dismissedTips;
    return new Set(Array.isArray(saved) ? saved : []);
  });

  const visible = tips.filter((t) => !dismissed.has(t.id));
  if (visible.length === 0) return null;

  const tip = visible[0];

  const handleDismiss = () => {
    const next = new Set(dismissed);
    next.add(tip.id);
    setDismissed(next);
    onDismiss?.([...next]);
  };

  return (
    <div className="beginner-guide">
      <GraduationCapIcon size={13} />
      <span className="beginner-guide-text">{tip.text}</span>
      <span className="beginner-guide-counter">{tips.indexOf(tip) + 1}/{tips.length}</span>
      <button className="beginner-guide-dismiss" onClick={handleDismiss} title="Dismiss tip" aria-label="Dismiss tip">
        <XIcon size={11} />
      </button>
    </div>
  );
}
