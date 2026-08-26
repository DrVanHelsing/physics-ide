import React, { useState } from "react";

/**
 * DebugDemo — §5's artifact (fun-redesign brief §2, §5 entry): a small,
 * static-but-interactive breakpoint diagram. Three mock block chips, reusing
 * the `.welcome-code__chip` treatment §3 already ships. A chip that "can
 * pause" carries a dashed outline; a chip with "a breakpoint set" carries a
 * solid one — clicking a chip toggles it between the two states, so the
 * page's headline claim ("blocks that can pause show a dashed outline,
 * blocks with a breakpoint a solid one") is demonstrated, not just described.
 *
 * This is a page-only mock: the three lines below are illustrative, not a
 * live trace of a real run, and are not wired to the product's actual debug
 * machinery (hooks/useDebugHotkeys.js, the block editor's own breakpoint
 * gutter) in any way. No claim here goes further than "this is what the
 * mechanism looks like."
 */
const CHIPS = [
  "apply force to ball   accel (0, -9.81, 0)   dt 0.01",
  "if height < 0",
  "update position of ball   dt 0.01",
];

/* One chip starts armed so a visitor who never clicks still sees both
   states side by side — the diagram reads correctly at rest, not only after
   interaction. */
const INITIAL_ARMED = new Set([1]);

export default function DebugDemo() {
  const [armed, setArmed] = useState(INITIAL_ARMED);

  const toggle = (i) => {
    setArmed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="welcome-debugdemo">
      {CHIPS.map((t, i) => {
        const isArmed = armed.has(i);
        return (
          <button
            key={t}
            type="button"
            className={`welcome-code__chip welcome-debugdemo__chip${isArmed ? " is-armed" : ""}`}
            aria-pressed={isArmed}
            aria-label={`${t} — ${isArmed ? "breakpoint set, click to clear it" : "can pause, click to set a breakpoint"}`}
            onClick={() => toggle(i)}
          >
            {t}
          </button>
        );
      })}
      <p className="welcome-debugdemo__hint">
        Click a line — dashed means it can pause, solid means it will.
      </p>
    </div>
  );
}
