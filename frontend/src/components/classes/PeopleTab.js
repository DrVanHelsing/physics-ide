import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { api } from "../../utils/api/client";
import { CheckIcon } from "../Icons";
import ClassChrome from "./ClassChrome";

export default function PeopleTab() {
  return <ClassChrome tab="people">{(c) => <PeopleBody classData={c} />}</ClassChrome>;
}

function PeopleBody({ classData }) {
  const { id } = useParams();
  const qc = useQueryClient();
  const isTeacher = classData.myRole === "teacher";
  const membersQuery = useQuery({
    queryKey: ["class", id, "members"],
    queryFn: () => api(`/api/classes/${id}/members`),
  });
  const invitesQuery = useQuery({
    queryKey: ["class", id, "invites"],
    queryFn: () => api(`/api/classes/${id}/invites`),
    enabled: isTeacher,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["class", id] });
  };
  const act = useMutation({
    mutationFn: ({ path, method = "POST" }) => api(path, { method, body: {} }),
    onSuccess: refresh,
  });
  const invite = useMutation({
    mutationFn: (body) => api(`/api/classes/${id}/invites`, { method: "POST", body }),
    onSuccess: refresh,
  });

  const [emailsRaw, setEmailsRaw] = useState("");
  const [role, setRole] = useState("student");
  const [inviteNote, setInviteNote] = useState(null);

  const members = membersQuery.data?.members ?? [];
  const waiting = members.filter((m) => m.status === "waiting");

  function sendInvites(e) {
    e.preventDefault();
    setInviteNote(null);
    const emails = emailsRaw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    invite.mutate(
      { emails, role },
      {
        onSuccess: (data) => {
          setEmailsRaw("");
          setInviteNote(
            `Invited ${data.invited.length} people` +
              (data.skipped.length ? ` · already members: ${data.skipped.join(", ")}` : ""),
          );
        },
        onError: (err) => setInviteNote(err.message),
      },
    );
  }

  return (
    <div className="page-body page-body--wide">
      {isTeacher ? <JoinPanel classData={classData} onChanged={refresh} /> : null}
      {isTeacher && waiting.length > 0 ? (
        <div>
          <h2 className="section-title">Waiting to join</h2>
          <table className="admin-table">
            <tbody>
              {waiting.map((m) => (
                <tr key={m.userId}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td className="admin-actions">
                    <button
                      className="btn"
                      type="button"
                      onClick={() =>
                        act.mutate({ path: `/api/classes/${id}/members/${m.userId}/approve` })
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn--danger"
                      type="button"
                      onClick={() =>
                        act.mutate({ path: `/api/classes/${id}/members/${m.userId}/deny` })
                      }
                    >
                      Deny
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <h2 className="section-title">Roster</h2>
      {act.error ? <div className="alert alert--danger">{act.error.message}</div> : null}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            {isTeacher ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {members
            .filter((m) => m.status === "active")
            .map((m) => (
              <tr key={m.userId}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>
                  {m.role === "ta" ? "assistant" : m.role}
                </td>
                {isTeacher ? (
                  <td className="admin-actions">
                    <button
                      className="btn btn--danger"
                      type="button"
                      onClick={() =>
                        act.mutate({
                          path: `/api/classes/${id}/members/${m.userId}`,
                          method: "DELETE",
                        })
                      }
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
        </tbody>
      </table>
      {isTeacher ? (
        <>
          <h2 className="section-title">Invite by email</h2>
          <form className="card auth-form form-narrow" onSubmit={sendInvites}>
            <label className="auth-label">
              Email addresses (comma, space, or line separated)
              <textarea
                className="input"
                rows="3"
                value={emailsRaw}
                onChange={(e) => setEmailsRaw(e.target.value)}
              />
            </label>
            <label className="auth-label">
              Invite as
              <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="student">Student</option>
                <option value="ta">Teaching assistant</option>
                <option value="teacher">Co-teacher</option>
              </select>
            </label>
            {inviteNote ? <p className="auth-text auth-text--dim">{inviteNote}</p> : null}
            <button
              className="btn btn--primary btn--lg btn--block"
              type="submit"
              disabled={!emailsRaw.trim() || invite.isPending}
            >
              Send invites
            </button>
          </form>
          {(invitesQuery.data?.invites ?? []).length > 0 ? (
            <>
              <h2 className="section-title">Pending invites</h2>
              <table className="admin-table">
                <tbody>
                  {invitesQuery.data.invites.map((i) => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td>{i.role === "ta" ? "assistant" : i.role}</td>
                      <td className="admin-actions">
                        <button
                          className="btn"
                          type="button"
                          onClick={() => act.mutate({ path: `/api/invites/${i.id}/resend` })}
                        >
                          Resend
                        </button>
                        <button
                          className="btn btn--danger"
                          type="button"
                          onClick={() => act.mutate({ path: `/api/invites/${i.id}/revoke` })}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function JoinPanel({ classData, onChanged }) {
  const { id } = useParams();
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const joinUrl = `${window.location.origin}/join/${classData.joinCode}`;
  const regen = useMutation({
    mutationFn: () => api(`/api/classes/${id}/regenerate-code`, { method: "POST", body: {} }),
    onSuccess: onChanged,
  });

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, joinUrl, { width: 148, margin: 1 }, () => {});
    }
  }, [joinUrl]);

  return (
    <div>
      <h2 className="section-title">Joining</h2>
      <div className="join-panel">
        <div>
          <div className="join-code-big">{classData.joinCode}</div>
          <div className="classes-actions" style={{ marginTop: 8 }}>
            <button
              className="btn"
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(joinUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              Copy join link
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => regen.mutate()}
              disabled={regen.isPending}
            >
              Regenerate code
            </button>
            {/* Always mounted (empty when !copied) so the live region exists
                before its content does — a status element inserted at the same
                moment as its text is not reliably announced. */}
            <span
              className={copied ? "badge badge--success" : undefined}
              role="status"
              aria-live="polite"
            >
              {copied ? (
                <>
                  <CheckIcon size={12} /> Copied!
                </>
              ) : null}
            </span>
          </div>
          <p className="auth-text auth-text--dim" style={{ marginTop: 6 }}>
            Joining is {classData.joinMode === "open" ? "open" : classData.joinMode === "approval" ? "by approval" : "paused"} — change it in Settings.
          </p>
        </div>
        <canvas ref={canvasRef} className="join-qr" />
      </div>
    </div>
  );
}
