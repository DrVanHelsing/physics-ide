import React from "react";
import { Navigate } from "react-router-dom";
import { SIGNED_IN_HINT_KEY, WELCOME_PASSED_SESSION_KEY } from "../constants";

/** Pure decision (v2): guests meet the front door once per browser session. */
export function shouldShowWelcome({ signedInHint, sessionPassed }) {
  return !signedInHint && !sessionPassed;
}

/**
 * Wraps "/": a visitor who is not signed in and hasn't passed through the
 * welcome screen in this browser session goes to /welcome. The CTAs there
 * stamp the session pass, so the IDE stays at "/" for the rest of the
 * session; a new session sees the front door again. Signed-in visitors are
 * never hijacked. Fully synchronous — no storage read to await, no flash.
 */
export default function WelcomeGate({ children }) {
  let signedInHint = false;
  let sessionPassed = false;
  try {
    signedInHint = !!localStorage.getItem(SIGNED_IN_HINT_KEY);
    sessionPassed = !!sessionStorage.getItem(WELCOME_PASSED_SESSION_KEY);
  } catch {
    // Storage blocked: treat it as a fresh guest and show the welcome screen.
  }
  if (shouldShowWelcome({ signedInHint, sessionPassed })) {
    return <Navigate to="/welcome" replace />;
  }
  return children;
}
