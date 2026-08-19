import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { listProjects } from "../utils/storage/projectStore";
import { SIGNED_IN_HINT_KEY, WELCOME_SEEN_KEY } from "../constants";

/** Pure decision: only brand-new visitors get the welcome screen. */
export function shouldShowWelcome({ seenFlag, signedInHint, projectCount }) {
  if (seenFlag || signedInHint) return false;
  return projectCount === 0;
}

/**
 * Wraps "/": brand-new visitors (no seen-flag, no session hint, no local
 * projects) go to /welcome; everyone else gets the IDE untouched. A guest
 * who already has projects is grandfathered — stamp the flag, show the IDE.
 */
export default function WelcomeGate({ children }) {
  const seenFlag = !!localStorage.getItem(WELCOME_SEEN_KEY);
  const signedInHint = !!localStorage.getItem(SIGNED_IN_HINT_KEY);
  // Sync fast-path: when a flag already decides it, skip the storage read.
  const [projectCount, setProjectCount] = useState(seenFlag || signedInHint ? 1 : null);

  useEffect(() => {
    if (projectCount !== null) return;
    let cancelled = false;
    listProjects()
      .then((list) => {
        if (cancelled) return;
        if (list.length > 0) localStorage.setItem(WELCOME_SEEN_KEY, "1");
        setProjectCount(list.length);
      })
      .catch(() => {
        if (!cancelled) setProjectCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [projectCount]);

  if (projectCount === null) return null; // one IndexedDB read; avoids an IDE flash
  if (shouldShowWelcome({ seenFlag, signedInHint, projectCount })) {
    // React.createElement (not JSX) here: this is the one file in the welcome
    // module unit-tested directly (see __tests__/welcomeGate.test.js), and
    // vitest's bundled Vite copy only auto-strips JSX from .jsx/.tsx files —
    // it doesn't honor this repo's "JSX-in-.js" convention the way the app's
    // own Vite config does for dev/build. Zero behavior change either way.
    return React.createElement(Navigate, { to: "/welcome", replace: true });
  }
  return children;
}
