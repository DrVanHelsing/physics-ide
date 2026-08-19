import React from "react";

/**
 * Line icons for the welcome feature cards.
 *
 * Product UI carries no emoji (standing user rule, 2026-08-19) — these are
 * plain inline SVG: 24px viewBox, `stroke="currentColor"`, no fills, so they
 * inherit colour and size from `.welcome-card__icon` in styles.css and work in
 * both themes. Decorative: the card's heading carries the meaning, so every
 * icon stays aria-hidden.
 */
function Icon({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Blocks or Python — two stacked rounded squares. */
export function BlocksIcon() {
  return (
    <Icon>
      <rect x="3.25" y="3.25" width="11" height="11" rx="2.5" />
      <rect x="9.75" y="9.75" width="11" height="11" rx="2.5" />
    </Icon>
  );
}

/** Live 3D simulations — a body with an orbit ring. */
export function OrbitIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3.6" />
      <ellipse cx="12" cy="12" rx="10" ry="4.3" transform="rotate(-22 12 12)" />
    </Icon>
  );
}

/** Charts & data — three ascending bars. */
export function ChartIcon() {
  return (
    <Icon>
      <rect x="3.5" y="13" width="4.2" height="7.5" rx="1.2" />
      <rect x="9.9" y="9" width="4.2" height="11.5" rx="1.2" />
      <rect x="16.3" y="4.5" width="4.2" height="16" rx="1.2" />
    </Icon>
  );
}

/** Yours, offline — a laptop with a check. */
export function LocalFirstIcon() {
  return (
    <Icon>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M1.8 19.5h20.4" />
      <path d="M8.7 10.4l2.2 2.2 4.4-4.4" />
    </Icon>
  );
}

/** Classrooms — a mortarboard. */
export function ClassroomIcon() {
  return (
    <Icon>
      <path d="M12 4.2 1.9 8.7 12 13.2l10.1-4.5L12 4.2Z" />
      <path d="M5.9 10.9v4.4c0 1.1 2.7 2.5 6.1 2.5s6.1-1.4 6.1-2.5v-4.4" />
    </Icon>
  );
}

/** No surveillance — a shield with a check. */
export function PrivacyIcon() {
  return (
    <Icon>
      <path d="M12 2.8 19 5.7v5.6c0 4.3-2.9 7.7-7 9.6-4.1-1.9-7-5.3-7-9.6V5.7l7-2.9Z" />
      <path d="M8.9 11.9l2.2 2.2 4-4.1" />
    </Icon>
  );
}
