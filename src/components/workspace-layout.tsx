"use client";

import { useMemo, useState } from "react";
import type { ServerConfig, Session } from "@/lib/types";
import { SessionsPane } from "@/components/sessions-pane";
import { VisualizationTabs } from "@/components/visualization-tabs";

type Props = {
  server: ServerConfig;
  sessions: Session[];
  activeSession?: Session;
  onCreateSession: () => Promise<void>;
  onSelectSession: (id: string) => Promise<void>;
  onRenameSession: (id: string) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onSubmitPrompt: (prompt: string) => Promise<void>;
  onRerunQuery: (query: string) => Promise<void>;
  promptDraft: string;
  onPromptDraftChange: (value: string) => void;
  isExecuting: boolean;
  isCreatingSession: boolean;
};

export function WorkspaceLayout({
  server,
  sessions,
  activeSession,
  onCreateSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onSubmitPrompt,
  onRerunQuery,
  promptDraft,
  onPromptDraftChange,
  isExecuting,
  isCreatingSession
}: Props) {
  const [isSessionsCollapsed, setIsSessionsCollapsed] = useState(false);

  const title = useMemo(() => {
    if (!activeSession) return "No session selected";
    return `${server.name} · ${activeSession.title}`;
  }, [activeSession, server.name]);

  return (
    <div className={`split ${isSessionsCollapsed ? "collapsed" : ""}`}>
      {isSessionsCollapsed ? (
        <div className="panel sessions-collapsed">
          <button
            className="button secondary"
            onClick={() => setIsSessionsCollapsed(false)}
            aria-label="Expand sessions pane"
          >
            <span className="sessions-expand-icon" aria-hidden>
              ▸
            </span>
          </button>
        </div>
      ) : (
        <SessionsPane
          sessions={sessions}
          activeSessionId={activeSession?.id}
          onCreateSession={onCreateSession}
          onSelectSession={onSelectSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
          onCollapse={() => setIsSessionsCollapsed(true)}
          isCreatingSession={isCreatingSession}
          isBusy={isExecuting || isCreatingSession}
        />
      )}

      <div className="right-pane">
        <div className="right-pane-top">
          <div className="row" style={{ justifyContent: "space-between", padding: "0 0.25rem" }}>
            <h3 style={{ margin: 0, color: "var(--accent)" }}>{title}</h3>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>
              {server.protocol}://{server.host}:{server.port}
            </span>
          </div>
          <VisualizationTabs
            messages={activeSession?.messages ?? []}
            onRerunQuery={onRerunQuery}
            onCopyPromptToInput={onPromptDraftChange}
            onSubmitPrompt={onSubmitPrompt}
            promptDraft={promptDraft}
            onPromptDraftChange={onPromptDraftChange}
            promptDisabled={!activeSession || isExecuting || isCreatingSession}
            isExecuting={isExecuting}
          />
        </div>
      </div>
    </div>
  );
}
