import React, { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "../Icons";

/**
 * Click-to-open menu shared by the header's File and account menus.
 * Lifted verbatim from Toolbar.js so there is exactly one implementation.
 * Children are cloned so selecting an item always closes the menu.
 */
export default function DropdownMenu({
  trigger,
  children,
  align = "left",
  title,
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
      if (e.key === "Escape") setOpen(false);
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
