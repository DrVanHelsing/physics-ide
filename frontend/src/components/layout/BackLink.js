import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "../Icons";

/**
 * The one back affordance in the portal (F2, 2026-08-28 UI audit).
 *
 * Before this there was no back-link component, class or shared idiom
 * anywhere in `frontend/src`: the wordmark was the only structural link a
 * drill-down page carried, and it reads as a logo, not an up-control. The
 * inbox was the single screen that got it right — a persistent link above the
 * fold — so this generalises exactly that, and every stranded page now renders
 * it in the header region.
 *
 * It is NOT browser history. `to` is the page's REAL parent route and `label`
 * names that destination out loud ("Back to inbox", not "Back"), so the link
 * says where it goes before it is pressed and lands somewhere predictable when
 * the page was opened from a bookmark or a pasted URL.
 */
export default function BackLink({ to, label }) {
  return (
    <Link className="back-link" to={to}>
      <ArrowLeftIcon size={14} />
      {label}
    </Link>
  );
}
