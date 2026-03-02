"use client";

import type { Session } from "@/lib/types";

type Props = {
  sessions: Session[];
  activeSessionId?: string;
  onCreateSession: () => Promise<void>;
  onSelectSession: (id: string) => Promise<void>;
  onRenameSession: (id: string) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
};

export function SessionsPane({
  sessions,
  activeSessionId,
  onCreateSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession
}: Props) {
  return (
    <div className="panel sessions-pane stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Sessions</h3>
        <button className="button secondary" onClick={onCreateSession}>
          New
        </button>
      </div>

      <div className="stack list-scroll">
        {sessions.map((session) => (
          <div key={session.id} className="stack" style={{ gap: "0.35rem" }}>
            <button
              className={`session-item ${activeSessionId === session.id ? "active" : ""}`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 600 }}>{session.title}</div>
                <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                  <span
                    className="link-button"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onRenameSession(session.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        void onRenameSession(session.id);
                      }
                    }}
                  >
                    Rename
                  </span>
                  <span
                    className="link-button"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onDeleteSession(session.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        void onDeleteSession(session.id);
                      }
                    }}
                  >
                    Delete
                  </span>
                </div>
              </div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>{new Date(session.updatedAt).toLocaleString()}</div>
            </button>
          </div>
        ))}

        {sessions.length === 0 ? <p style={{ color: "var(--muted)" }}>No sessions yet.</p> : null}
      </div>
    </div>
  );
}
