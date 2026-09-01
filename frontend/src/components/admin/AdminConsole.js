import React, { useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";
import { CheckIcon, AlertTriangleIcon, SearchIcon, XIcon, TrashIcon } from "../Icons";
import PortalHeader from "../layout/PortalHeader";
import DataRequestsTab from "./DataRequestsTab";
import Overlay from "../common/Overlay";

const TABS = ["People", "Classes", "Emails", "Health", "Data requests"];

/* F2 (2026-08-28 UI audit) — the console's only structural link was the
   wordmark, and it ejects to "/" (the IDE), which is not a portal
   destination. An admin who arrived from their classes had no path back. */
const ADMIN_BACK = { to: "/classes", label: "Back to my classes" };

export default function AdminConsole() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState("People");
  const tabRefs = useRef({});

  if (isLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;
  if (me.role !== "admin") return <Navigate to="/" replace />;

  /* Roving tabindex (WAI-ARIA tabs pattern): the arrow key both selects and
     moves DOM focus, so the ring lands on the tab that is now active. */
  function selectTab(next) {
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  function onTabKeyDown(e) {
    const idx = TABS.indexOf(tab);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      selectTab(TABS[(idx + 1) % TABS.length]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      selectTab(TABS[(idx - 1 + TABS.length) % TABS.length]);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectTab(TABS[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      selectTab(TABS[TABS.length - 1]);
    }
  }

  return (
    <div className="page">
      <PortalHeader
        title="Admin console"
        back={ADMIN_BACK}
        nav={
          <nav className="tabs" role="tablist" aria-label="Admin sections">
            {TABS.map((t) => (
              <button
                key={t}
                ref={(el) => {
                  tabRefs.current[t] = el;
                }}
                type="button"
                role="tab"
                id={`admin-tab-${t}`}
                aria-controls="admin-panel"
                aria-selected={t === tab}
                tabIndex={t === tab ? 0 : -1}
                className={t === tab ? "tab tab--on" : "tab"}
                onClick={() => selectTab(t)}
                onKeyDown={onTabKeyDown}
              >
                {t}
              </button>
            ))}
          </nav>
        }
      />
      <div role="tabpanel" id="admin-panel" aria-labelledby={`admin-tab-${tab}`}>
        {tab === "People" ? <PeopleTab /> : null}
        {tab === "Classes" ? <ClassesTab /> : null}
        {tab === "Emails" ? <EmailsTab /> : null}
        {tab === "Health" ? <HealthTab /> : null}
        {tab === "Data requests" ? <DataRequestsTab /> : null}
      </div>
    </div>
  );
}

function PeopleTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [capInput, setCapInput] = useState(null);
  const usersQuery = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () => api(`/api/admin/users?q=${encodeURIComponent(q)}`),
  });
  const capQuery = useQuery({
    queryKey: ["admin", "cap"],
    queryFn: () => api("/api/admin/cap"),
  });
  const act = useMutation({
    mutationFn: ({ id, action }) => api(`/api/admin/users/${id}/${action}`, { method: "POST", body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  const saveCap = useMutation({
    mutationFn: (cap) => api("/api/admin/cap", { method: "PUT", body: { cap } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "cap"] }),
  });

  return (
    <div className="page-body page-body--wide">
      {capQuery.data ? (
        <div className="admin-cap">
          <strong>
            {capQuery.data.count} / {capQuery.data.cap}
          </strong>{" "}
          accounts used.
          <input
            className="input admin-cap-input"
            type="number"
            min="1"
            value={capInput ?? capQuery.data.cap}
            onChange={(e) => setCapInput(Number(e.target.value))}
          />
          <button
            className="btn"
            type="button"
            disabled={capInput === null || capInput === capQuery.data.cap}
            onClick={() => saveCap.mutate(capInput)}
          >
            Save cap
          </button>
        </div>
      ) : null}
      <div className="admin-search-box">
        <span className="admin-search-icon" aria-hidden="true">
          <SearchIcon size={13} />
        </span>
        <input
          className="input admin-search-input"
          type="text"
          placeholder="Search by name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search by name or email"
        />
        {q ? (
          <button
            type="button"
            className="admin-search-clear"
            onClick={() => setQ("")}
            aria-label="Clear search"
          >
            <XIcon size={13} />
          </button>
        ) : null}
      </div>
      {act.error ? <div className="alert alert--danger">{act.error.message}</div> : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Kind</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(usersQuery.data?.users ?? []).map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role === "admin" ? "admin" : u.isTeacher ? "teacher" : "student"}</td>
                <td>
                  {u.erased ? (
                    <span className="status-erased">erased</span>
                  ) : (
                    <>
                      {u.active ? "active" : "deactivated"}
                      {!u.emailConfirmed ? " · unconfirmed" : ""}
                    </>
                  )}
                </td>
                <td className="admin-actions">
                  {/* The People tab's third status (D§5): a scrubbed shell
                      offers none of the four actions — Reactivate on one
                      would be a lie, and the backend 409s the other three
                      anyway (Task 10). */}
                  {u.erased ? null : (
                    <>
                      {u.active ? (
                        <button className="btn btn--danger" type="button" onClick={() => act.mutate({ id: u.id, action: "deactivate" })}>
                          Deactivate
                        </button>
                      ) : (
                        <button className="btn" type="button" onClick={() => act.mutate({ id: u.id, action: "reactivate" })}>
                          Reactivate
                        </button>
                      )}
                      {!u.emailConfirmed ? (
                        <button className="btn" type="button" onClick={() => act.mutate({ id: u.id, action: "resend-confirmation" })}>
                          Resend confirmation
                        </button>
                      ) : null}
                      <button className="btn" type="button" onClick={() => act.mutate({ id: u.id, action: "send-reset" })}>
                        Send reset
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* D13: "delivered"/"sent" resolve through the success token, "bounced"/
   "failed" through the danger token, everything else (the dev driver's
   "dev", plus the brevo driver's transient "sending") stays neutral — the
   plain .badge base already defaults --badge-color to --text-dim, so no new
   token or class is needed for that third bucket. Colour is never the only
   channel: the badge always carries the status word itself, verbatim. */
function emailStatusBadgeClass(status) {
  if (status === "bounced" || status === "failed") return "badge badge--danger";
  if (status === "delivered" || status === "sent") return "badge badge--success";
  return "badge";
}

function EmailsTab() {
  const [openId, setOpenId] = useState(null);
  const emailsQuery = useQuery({
    queryKey: ["admin", "emails"],
    queryFn: () => api("/api/admin/emails?limit=200"),
  });
  return (
    <div className="page-body page-body--wide">
      <p className="auth-text auth-text--dim">
        The pretend inbox: every email the system would have sent, exactly as it would look.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>To</th>
              <th>Subject</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(emailsQuery.data?.emails ?? []).map((m) => (
              <React.Fragment key={m.id}>
                <tr
                  className="admin-mail-row"
                  tabIndex={0}
                  role="button"
                  aria-expanded={openId === m.id}
                  onClick={() => setOpenId(openId === m.id ? null : m.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      if (e.key === " ") e.preventDefault();
                      setOpenId(openId === m.id ? null : m.id);
                    }
                  }}
                >
                  <td>{new Date(m.createdAt).toLocaleString()}</td>
                  <td>{m.toEmail}</td>
                  <td>{m.subject}</td>
                  <td>
                    <span className={emailStatusBadgeClass(m.status)}>{m.status}</span>
                  </td>
                </tr>
                {openId === m.id ? (
                  <tr>
                    <td colSpan="4">
                      <pre className="admin-mail-body">{m.bodyText}</pre>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClassesTab() {
  const classesQuery = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: () => api("/api/admin/classes"),
  });
  return (
    <div className="page-body page-body--wide">
      <p className="auth-text auth-text--dim">
        Every class on the site — visibility, not management.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Teachers</th>
              <th>Members</th>
              <th>Joining</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(classesQuery.data?.classes ?? []).map((c) => (
              <tr key={c.id}>
                <td>
                  {c.name}
                  {c.subjectLabel ? ` · ${c.subjectLabel}` : ""}
                </td>
                <td>{c.teachers.join(", ")}</td>
                <td>{c.activeMembers}</td>
                <td>{c.joinMode}</td>
                <td>{c.archived ? "archived" : "active"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* §10's second Health promise: "storage used", rendered human-readable
   rather than as a raw byte count nobody can read at a glance. */
function formatBytes(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exp;
  return `${exp === 0 ? value : value.toFixed(1)} ${units[exp]}`;
}

export function HealthTab() {
  const healthQuery = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => api("/api/admin/health"),
  });
  const h = healthQuery.data;
  return (
    <div className="page-body">
      {h ? (
        <div className="card">
          <ul className="admin-health">
            <li>
              API:{" "}
              <span className={`badge ${h.ok ? "badge--success" : "badge--danger"}`}>
                {h.ok ? <CheckIcon size={12} /> : <AlertTriangleIcon size={12} />}
                {h.ok ? "running" : "trouble"}
              </span>
            </li>
            <li>
              Database:{" "}
              <span className={`badge ${h.db === "ok" ? "badge--success" : "badge--danger"}`}>
                {h.db === "ok" ? <CheckIcon size={12} /> : <AlertTriangleIcon size={12} />}
                {h.db}
              </span>
            </li>
            <li>
              Accounts: {h.users} of {h.cap}
            </li>
            <li>Emails logged: {h.emailsLogged}</li>
            <li>Storage used: {formatBytes(h.storageBytes)}</li>
          </ul>
          <RetentionControl />
        </div>
      ) : (
        <p className="auth-text">Loading…</p>
      )}
    </div>
  );
}

/* §11's retention clock (Task 8): the setting Task 9's sweep will read.
   DataRequestsTab's ERASE_SENTENCE idiom, reused — a file-level const,
   spoken before the request is even sent, asserted verbatim by
   adminStatus.test.js. */
export const RETENTION_SENTENCE =
  "This cannot be undone. Once saved, every archived class older than the " +
  "new period is deleted automatically on the next daily sweep — the " +
  "class, its work and its marks go.";

/* The cap editor one scroll up (PeopleTab, above) is a bare number input
   and one Save button — fine for a setting that only ever grows a limit.
   This one destroys data with no undo, so Save opens a confirm step naming
   exactly how many classes the candidate value makes eligible for the
   daily sweep, which drains them in small batches
   (GET /api/admin/retention?years=N, fetched fresh, never estimated),
   echoing the tree's own destructive precedent: DataRequestsTab's erase
   dialog, which makes an admin retype the subject's email before it acts. */
function RetentionControl() {
  const qc = useQueryClient();
  const [draftYears, setDraftYears] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const retentionQuery = useQuery({
    queryKey: ["admin", "retention"],
    queryFn: () => api("/api/admin/retention"),
  });
  // getSetting returns `unknown` — the same typeof guard auth.ts uses for
  // the signup cap, mirrored here on the client side of the same setting.
  const current =
    typeof retentionQuery.data?.retentionYears === "number" ? retentionQuery.data.retentionYears : 3;
  const years = draftYears ?? current;

  const previewQuery = useQuery({
    queryKey: ["admin", "retention", "preview", years],
    queryFn: () => api(`/api/admin/retention?years=${years}`),
    enabled: confirming,
  });
  const wouldDelete = previewQuery.data?.wouldDelete;

  const saveRetention = useMutation({
    mutationFn: (value) => api("/api/admin/retention", { method: "PUT", body: { retentionYears: value } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "retention"] });
      setConfirming(false);
      setDraftYears(null);
    },
  });

  function closeConfirm() {
    setConfirming(false);
  }

  return (
    <>
      <div className="admin-retention">
        <strong>{years}</strong> {years === 1 ? "year" : "years"} — how long an archived class is kept
        before it's deleted automatically.
        <input
          className="input admin-retention-input"
          type="number"
          min="1"
          max="50"
          value={years}
          onChange={(e) => setDraftYears(Number(e.target.value))}
          aria-label="Retention period in years"
        />
        <button
          className="btn"
          type="button"
          disabled={draftYears === null || draftYears === current}
          onClick={() => setConfirming(true)}
        >
          Save retention period
        </button>
      </div>
      {confirming ? (
        <Overlay
          onClose={closeConfirm}
          label="Change retention period"
          panelClassName="erase-dialog"
          dismissOnBackdrop={false}
        >
          <h2 className="erase-dialog__title">Change retention period</h2>
          <p>{RETENTION_SENTENCE}</p>
          <p>
            At <strong>{years}</strong> {years === 1 ? "year" : "years"},{" "}
            <strong>{previewQuery.isLoading ? "…" : (wouldDelete ?? 0)}</strong>{" "}
            {wouldDelete === 1 ? "class qualifies" : "classes qualify"} for deletion — removed in
            small batches by the daily cleanup, not all at once.
          </p>
          {saveRetention.error ? (
            <div className="alert alert--danger" role="alert">
              {saveRetention.error.message}
            </div>
          ) : null}
          <div className="erase-dialog__actions">
            <button className="btn" type="button" onClick={closeConfirm}>
              Cancel
            </button>
            <button
              className="btn btn--danger"
              type="button"
              disabled={previewQuery.isLoading || saveRetention.isPending}
              onClick={() => saveRetention.mutate(years)}
            >
              <TrashIcon size={13} /> Confirm change
            </button>
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
