import React, { useEffect, useRef } from "react";

/**
 * One modal wrapper for every dialog in the IDE.
 *
 * Escape closes, the backdrop closes, the dialog announces itself, focus moves
 * in on mount and returns to whatever opened it on unmount. Before this, each
 * of the four overlays implemented a different subset — ChartOverlay, the
 * payoff screen after a recorded run, implemented none of it.
 *
 * Not a focus TRAP: a trap needs a sentinel pair and careful Tab handling, and
 * every dialog here is short. Moving focus in and restoring it out is the part
 * that matters for a keyboard user; trapping is a Tranche 3 refinement.
 */
export default function Overlay({
  onClose,
  label,
  className = "",
  panelClassName = "",
  dismissOnBackdrop = true,
  children,
}) {
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    // A child with `autoFocus` has already claimed focus by the time this
    // (passive) effect runs — React applies autoFocus synchronously during
    // commit. Only fall back to the first focusable descendant when nothing
    // inside the panel already has focus, so autoFocus keeps winning.
    if (!panel?.contains(document.activeElement)) {
      const focusable = panel?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (focusable || panel)?.focus?.();
    }

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const opener = openerRef.current;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div
      className={`overlay-backdrop ${className}`}
      onMouseDown={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onCloseRef.current?.();
      }}
    >
      <div
        ref={panelRef}
        className={`overlay-panel ${panelClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
