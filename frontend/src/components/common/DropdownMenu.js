import React, { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "../Icons";

/**
 * Click-to-open menu shared by the header's File, account and overflow menus.
 * Lifted verbatim from Toolbar.js so there is exactly one implementation.
 * Children are cloned so selecting an item always closes the menu.
 *
 * `title` becomes the trigger's tooltip only. It is deliberately NOT reused
 * as `aria-label` — the account trigger's title ("Signed in as a@b.com")
 * does not contain its visible label (the user's name), so defaulting
 * aria-label to title there would break WCAG 2.5.3 Label in Name. Pass
 * `triggerAriaLabel` explicitly on callers (like the icon-only overflow
 * trigger) that have no visible text of their own to fall back on.
 */
export default function DropdownMenu({
  trigger,
  children,
  align = "left",
  title,
  triggerAriaLabel,
  triggerClassName = "tb-btn tb-btn--dropdown",
  chevron = true,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        // Without this, Escape bubbles to useHotkeys' window listener, which
        // matches bare Escape to "stop" — closing this menu would silently
        // kill a running simulation. Same fix as Overlay.js.
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="tb-dropdown" ref={ref}>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setOpen((o) => !o)}
        title={title}
        aria-label={triggerAriaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
        {chevron && <ChevronDownIcon size={10} />}
      </button>
      {open && (
        <div
          className={`tb-dropdown-menu ${align === "right" ? "tb-dropdown-menu--right" : ""}`}
          role="menu"
        >
          {React.Children.map(children, (child) =>
            child
              ? React.cloneElement(child, {
                  role: "menuitem",
                  onClick: (...args) => {
                    setOpen(false);
                    child.props.onClick?.(...args);
                  },
                })
              : null,
          )}
        </div>
      )}
    </div>
  );
}
