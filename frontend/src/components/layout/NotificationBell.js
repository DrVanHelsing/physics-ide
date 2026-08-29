import React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DropdownMenu from "../common/DropdownMenu";
import { BellIcon } from "../Icons";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";

/** The bell (spec §9, design D§1/D§3): a DropdownMenu reuse, never a new
 *  popover; polls on react-query's refetchInterval — the tree's first,
 *  deliberately (BatonChip's raw interval exists for its side-effectful
 *  poll; the bell has none, and mark-as-read wants invalidateQueries). */
export const BELL_POLL_MS = 60 * 1000;
export const BELL_EMPTY = "Nothing yet — marks, reminders and shares will land here.";
export const NOTIFICATIONS_KEY = ["notifications"];

export default function NotificationBell() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => api("/api/notifications"),
    refetchInterval: BELL_POLL_MS,
    enabled: !!me,
  });
  const markAll = useMutation({
    mutationFn: () => api("/api/notifications/read", { method: "POST", body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
  if (!me) return null;
  const unread = q.data?.unreadCount ?? 0;
  const rows = q.data?.notifications ?? [];
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <DropdownMenu
      align="right"
      chevron={false}
      triggerAriaLabel={label}
      /* Icon-only, like the theme toggle beside it — so it composes
         `.tb-btn--icon` (chrome.css) rather than restating that rule's
         padding under its own name. `bell-trigger` is the block hook the
         stylesheet scopes by and portal-e2e selects on. */
      triggerClassName="tb-btn tb-btn--icon bell-trigger"
      onOpenChange={(open) => {
        if (open && unread > 0 && !markAll.isPending) markAll.mutate();
      }}
      trigger={
        <span className="bell-trigger__inner">
          <BellIcon size={16} />
          {unread > 0 ? <span className="badge badge--accent bell-badge">{unread > 9 ? "9+" : unread}</span> : null}
        </span>
      }
    >
      {rows.length === 0 ? (
        <button type="button" className="tb-dropdown-item bell-empty" disabled>
          {BELL_EMPTY}
        </button>
      ) : (
        rows.map((n) => (
          <button
            key={n.id}
            type="button"
            className={n.readAt ? "tb-dropdown-item bell-item" : "tb-dropdown-item bell-item bell-item--unread"}
            onClick={() => navigate(n.href)}
          >
            <span className="bell-item__text">{n.text}</span>
            {n.readAt ? null : <span className="bell-item__dot" aria-hidden="true" />}
          </button>
        ))
      )}
    </DropdownMenu>
  );
}
