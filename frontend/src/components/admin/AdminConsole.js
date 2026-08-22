import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";

const TABS = ["People", "Classes", "Emails", "Health"];

export default function AdminConsole() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState("People");

  if (isLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;
  if (me.role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link to="/" className="auth-brand">
          Physics<span>IDE</span>
        </Link>
        <h1>Admin console</h1>
        <nav className="admin-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={t === tab ? "admin-tab admin-tab--on" : "admin-tab"}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>
      {tab === "People" ? <PeopleTab /> : null}
      {tab === "Classes" ? <ClassesTab /> : null}
      {tab === "Emails" ? <EmailsTab /> : null}
      {tab === "Health" ? <HealthTab /> : null}
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
    <div className="admin-body">
      {capQuery.data ? (
        <div className="admin-cap">
          <strong>
            {capQuery.data.count} / {capQuery.data.cap}
          </strong>{" "}
          accounts used.
          <input
            className="auth-input admin-cap-input"
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
      <input
        className="auth-input"
        placeholder="Search by name or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {act.error ? <div className="auth-error">{act.error.message}</div> : null}
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
                  {u.active ? "active" : "deactivated"}
                  {!u.emailConfirmed ? " · unconfirmed" : ""}
                </td>
                <td className="admin-actions">
                  {u.active ? (
                    <button className="btn" type="button" onClick={() => act.mutate({ id: u.id, action: "deactivate" })}>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmailsTab() {
  const [openId, setOpenId] = useState(null);
  const emailsQuery = useQuery({
    queryKey: ["admin", "emails"],
    queryFn: () => api("/api/admin/emails?limit=200"),
  });
  return (
    <div className="admin-body">
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
            </tr>
          </thead>
          <tbody>
            {(emailsQuery.data?.emails ?? []).map((m) => (
              <React.Fragment key={m.id}>
                <tr className="admin-mail-row" onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                  <td>{new Date(m.createdAt).toLocaleString()}</td>
                  <td>{m.toEmail}</td>
                  <td>{m.subject}</td>
                </tr>
                {openId === m.id ? (
                  <tr>
                    <td colSpan="3">
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
    <div className="admin-body">
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

function HealthTab() {
  const healthQuery = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => api("/api/admin/health"),
  });
  const h = healthQuery.data;
  return (
    <div className="admin-body">
      {h ? (
        <ul className="admin-health">
          <li>API: {h.ok ? "running" : "trouble"}</li>
          <li>Database: {h.db}</li>
          <li>
            Accounts: {h.users} of {h.cap}
          </li>
          <li>Emails logged: {h.emailsLogged}</li>
        </ul>
      ) : (
        <p className="auth-text">Loading…</p>
      )}
    </div>
  );
}
