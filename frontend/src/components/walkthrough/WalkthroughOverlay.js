import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { XIcon } from "../Icons";

/**
 * The guided-tour engine: a spotlight, a popover, and nothing else.
 *
 * In-house rather than a library on purpose — the product already has an
 * overlay idiom, the bundle carries no tour dependency, and the whole engine
 * is smaller than a library's type definitions. Interaction with the app is
 * BLOCKED while a tour runs (the shade eats pointer events): every state
 * change a step needs happens through the `execute` prop IDELayout supplies
 * (open a template, run, stop, switch modes), so the tour can never be
 * stranded by the user half-completing an action mid-step.
 *
 * Target resolution is forgiving by design: a step whose selector matches
 * nothing is SKIPPED with a console.warn after a short retry window (the
 * IDE mounts Blockly and the runtime asynchronously), so a renamed class
 * degrades a tour instead of crashing it.
 *
 * Escape ends the tour. The engine deliberately does not join Overlay.js's
 * stack: a running tour closes Help first (HelpPage unmounts before the
 * first step renders), so the two never coexist.
 */

const SPOT_PAD = 6;
const POPOVER_GAP = 12;
/** How long a step waits for its target to appear before being skipped —
 *  template opening + Blockly injection + the runtime iframe all take real
 *  time. Polled, not observed: MutationObserver over the whole app for a
 *  handful of steps is more machinery than a 250ms poll. */
const TARGET_WAIT_MS = 8000;
const TARGET_POLL_MS = 250;

function rectOf(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}

/**
 * `session` is the tour's cross-mount memory, owned by IDELayout: a step
 * action that opens a template flips IDELayout from its start-menu branch
 * to the IDE shell, which unmounts THIS component and mounts a fresh one.
 * Component state would restart the tour at step 0 (and re-run its action —
 * caught live on the first camera pass); the session object carries the
 * step index and the already-ran action set across that remount.
 */
export default function WalkthroughOverlay({ tour, session, execute, onEnd }) {
  const [stepIndex, setStepIndexState] = useState(() => session?.index ?? 0);
  const setStepIndex = useCallback((updater) => {
    setStepIndexState((prev) => {
      const nextVal = typeof updater === "function" ? updater(prev) : updater;
      if (session) session.index = nextVal;
      return nextVal;
    });
  }, [session]);
  const [rect, setRect] = useState(null);
  const [waiting, setWaiting] = useState(true);
  const popoverRef = useRef(null);
  const actionDoneRef = useRef(session?.done || new Set()); // step indexes whose action already ran
  const endedRef = useRef(false);

  const step = tour.steps[stepIndex] || null;
  const total = tour.steps.length;

  const endTour = useCallback(
    (reason) => {
      if (endedRef.current) return;
      endedRef.current = true;
      // A tour that leaves a simulation running would be a rude exit.
      const current = tour.steps[Math.min(stepIndex, total - 1)];
      if (current?.end) execute?.(current.end);
      onEnd?.(reason);
    },
    [execute, onEnd, stepIndex, total, tour.steps],
  );

  /* ── Step lifecycle: run its action once, then hunt its target ── */
  useEffect(() => {
    if (!step) return undefined;
    let dead = false;
    let timer = null;
    setWaiting(true);
    setRect(null);

    const hunt = (deadline) => {
      if (dead) return;
      const r = rectOf(step.target);
      if (r) {
        setRect(r);
        setWaiting(false);
        return;
      }
      if (Date.now() > deadline) {
        console.warn(`walkthrough: target never appeared, skipping step — ${step.target}`);
        if (stepIndex + 1 < total) setStepIndex((i) => i + 1);
        else endTour("finished");
        return;
      }
      timer = setTimeout(() => hunt(deadline), TARGET_POLL_MS);
    };

    (async () => {
      if (step.action && !actionDoneRef.current.has(stepIndex)) {
        actionDoneRef.current.add(stepIndex);
        try {
          await execute?.(step.action);
        } catch (err) {
          console.warn(`walkthrough: step action failed — ${step.action}`, err);
        }
      }
      if (!dead) hunt(Date.now() + TARGET_WAIT_MS);
    })();

    return () => {
      dead = true;
      if (timer) clearTimeout(timer);
    };
  }, [step, stepIndex, total, execute, endTour]);

  /* ── Keep the spotlight glued to the target across layout shifts ── */
  useEffect(() => {
    if (!step || waiting) return undefined;
    const remeasure = () => {
      const r = rectOf(step.target);
      if (r) setRect(r);
    };
    window.addEventListener("resize", remeasure);
    document.addEventListener("scroll", remeasure, true);
    return () => {
      window.removeEventListener("resize", remeasure);
      document.removeEventListener("scroll", remeasure, true);
    };
  }, [step, waiting]);

  /* ── Escape ends; focus follows the popover ── */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        endTour("dismissed");
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [endTour]);

  useLayoutEffect(() => {
    if (!waiting) popoverRef.current?.focus();
  }, [waiting, stepIndex]);

  if (!step) return null;

  const next = () => {
    if (stepIndex + 1 < total) setStepIndex((i) => i + 1);
    else endTour("finished");
  };
  const back = () => {
    // Back never re-runs actions (actionDoneRef) — it only re-narrates.
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  /* Popover placement: below the target when there is room, else above,
     else BESIDE it — a tall target like the toolbox column leaves no
     vertical slot at all (the first camera pass pinned the popover off the
     top of the screen). Values land as inline styles — one element, no
     measurement pass (the popover has a fixed width). */
  const POP_W = 340;
  const POP_H = 200; // generous estimate; only used to pick a slot
  let popStyle = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centeredLeft = Math.max(12, Math.min(rect.x + rect.w / 2 - POP_W / 2, vw - POP_W - 12));
    const below = rect.y + rect.h + SPOT_PAD + POPOVER_GAP;
    const sideTop = Math.max(12, Math.min(rect.y + rect.h / 2 - POP_H / 2, vh - POP_H - 12));
    if (below + POP_H < vh) {
      popStyle = { left: centeredLeft, top: below };
    } else if (rect.y > POP_H + POPOVER_GAP + 12) {
      popStyle = { left: centeredLeft, bottom: vh - rect.y + SPOT_PAD + POPOVER_GAP };
    } else if (rect.x + rect.w + SPOT_PAD + POPOVER_GAP + POP_W + 12 < vw) {
      popStyle = { left: rect.x + rect.w + SPOT_PAD + POPOVER_GAP, top: sideTop };
    } else if (rect.x > POP_W + SPOT_PAD + POPOVER_GAP + 12) {
      popStyle = { left: rect.x - SPOT_PAD - POPOVER_GAP - POP_W, top: sideTop };
    }
  }

  return (
    <div className="walkthrough" role="presentation">
      {rect ? (
        <div
          className="walkthrough-spot"
          style={{
            left: rect.x - SPOT_PAD,
            top: rect.y - SPOT_PAD,
            width: rect.w + SPOT_PAD * 2,
            height: rect.h + SPOT_PAD * 2,
          }}
        />
      ) : (
        <div className="walkthrough-shade" />
      )}
      <div
        ref={popoverRef}
        className="walkthrough-popover"
        style={popStyle}
        role="dialog"
        aria-modal="true"
        aria-label={`${tour.title} — step ${stepIndex + 1} of ${total}`}
        tabIndex={-1}
      >
        <div className="walkthrough-popover-head">
          <span className="walkthrough-tourname">{tour.title}</span>
          <button
            type="button"
            className="walkthrough-close"
            onClick={() => endTour("dismissed")}
            aria-label="End tour"
          >
            <XIcon size={12} />
          </button>
        </div>
        <h3 className="walkthrough-step-title">{waiting ? "One moment…" : step.title}</h3>
        <p className="walkthrough-step-body">
          {waiting ? "Setting the stage for this step." : step.body}
        </p>
        <div className="walkthrough-popover-foot">
          <div className="walkthrough-dots" aria-hidden="true">
            {tour.steps.map((s, i) => (
              <span
                key={i}
                className={`walkthrough-dot${i === stepIndex ? " walkthrough-dot--on" : ""}`}
              />
            ))}
          </div>
          <div className="walkthrough-nav">
            {stepIndex > 0 && !tour.steps[stepIndex].action && (
              <button type="button" className="walkthrough-btn" onClick={back}>
                Back
              </button>
            )}
            <button
              type="button"
              className="walkthrough-btn walkthrough-btn--primary"
              onClick={next}
              disabled={waiting}
            >
              {stepIndex + 1 < total ? "Next" : "Finish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
