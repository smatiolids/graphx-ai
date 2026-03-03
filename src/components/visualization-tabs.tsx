"use client";

import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import type { SessionMessage } from "@/lib/types";
import { GraphView } from "@/components/graph-view";
import { PromptInput } from "@/components/prompt-input";

type Props = {
  messages: SessionMessage[];
  onRerunQuery: (query: string) => Promise<void>;
  onCopyPromptToInput: (prompt: string) => void;
  onSubmitPrompt: (prompt: string) => Promise<void>;
  promptDraft: string;
  onPromptDraftChange: (value: string) => void;
  promptDisabled: boolean;
  isExecuting: boolean;
};

export function VisualizationTabs({
  messages,
  onRerunQuery,
  onCopyPromptToInput,
  onSubmitPrompt,
  promptDraft,
  onPromptDraftChange,
  promptDisabled,
  isExecuting
}: Props) {
  const [runningQueryId, setRunningQueryId] = useState<string>("");
  const [rerunError, setRerunError] = useState<string>("");
  const [editorQuery, setEditorQuery] = useState<string>("");
  const [runningEditor, setRunningEditor] = useState(false);
  const assistantMessages = messages.filter((msg) => msg.role === "assistant");
  const latestGraph = assistantMessages.at(-1)?.graph ?? { nodes: [], edges: [] };
  const latestDataMessage = assistantMessages.at(-1);
  const queryMessages = [...assistantMessages].reverse();

  async function handleRerun(messageId: string, query: string): Promise<void> {
    setRerunError("");
    setRunningQueryId(messageId);
    try {
      await onRerunQuery(query);
    } catch (error) {
      setRerunError(error instanceof Error ? error.message : "Failed to rerun query");
    } finally {
      setRunningQueryId("");
    }
  }

  async function handleRunEditorQuery(): Promise<void> {
    const query = editorQuery.trim();
    if (!query) return;

    setRerunError("");
    setRunningEditor(true);
    try {
      await onRerunQuery(query);
    } catch (error) {
      setRerunError(error instanceof Error ? error.message : "Failed to run query");
    } finally {
      setRunningEditor(false);
    }
  }

  function isRerunReasoning(message: SessionMessage): boolean {
    return message.role === "assistant" && message.reasoning === "Re-ran saved query from history.";
  }

  return (
    <Tabs.Root
      className="panel visual-pane"
      defaultValue="graph"
      style={{ padding: "0.75rem", minHeight: 0, height: "100%" }}
    >
      <div className="row tabs-header-row">
        <Tabs.List className="row tabs-header-list" aria-label="Visualization tabs">
          <Tabs.Trigger value="graph" className="tab-trigger">
            Graph View
          </Tabs.Trigger>
          <Tabs.Trigger value="data" className="tab-trigger">
            Data
          </Tabs.Trigger>
          <Tabs.Trigger value="queries" className="tab-trigger">
            <span className="tab-label-with-spinner">
              <span>Query</span>
              {isExecuting ? <span className="spinner tab-spinner" /> : null}
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger value="agent" className="tab-trigger">
            Agent
          </Tabs.Trigger>
        </Tabs.List>
      </div>

      <Tabs.Content value="graph" className="tabs-content-fill">
        <GraphView graph={latestGraph} loading={isExecuting} />
      </Tabs.Content>

      <Tabs.Content value="data" className="tabs-content-fill">
        <div className="stack scroll-fill">
          {isExecuting ? (
            <div className="loading-row">
              <span className="spinner" />
              <span>Executing query...</span>
            </div>
          ) : null}
          {latestDataMessage ? (
            <div className="card">
              <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: "0.5rem" }}>
                Executed: {new Date(latestDataMessage.createdAt).toLocaleString()}
              </div>
              <pre className="mono" style={{ margin: 0 }}>
                {JSON.stringify(latestDataMessage.data ?? null, null, 2)}
              </pre>
            </div>
          ) : (
            <p style={{ color: "var(--muted)" }}>No data yet.</p>
          )}
        </div>
      </Tabs.Content>

      <Tabs.Content value="queries" className="tabs-content-fill">
        <div className="stack" style={{ minHeight: 0, height: "100%" }}>
          <div className="card stack" style={{ gap: "0.5rem" }}>
            <div style={{ fontWeight: 600 }}>Query Editor</div>
            <textarea
              className="textarea mono"
              value={editorQuery}
              onChange={(event) => setEditorQuery(event.target.value)}
              placeholder="Paste or edit a Gremlin query here..."
              disabled={runningEditor}
            />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                className="button"
                onClick={handleRunEditorQuery}
                disabled={runningEditor || !editorQuery.trim()}
              >
                {runningEditor ? "Running..." : "Run Query"}
              </button>
            </div>
          </div>

          {rerunError ? <p className="error">{rerunError}</p> : null}
          <div className="query-history-scroll stack">
            {queryMessages.map((message) => (
              <div key={message.id} className="card mono">
                {(() => {
                  const query = message.query;
                  return (
                    <div className="stack" style={{ gap: "0.5rem" }}>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>{query || "No query"}</div>
                        {query ? (
                          <div className="row">
                            <button className="button secondary" onClick={() => setEditorQuery(query)}>
                              Edit
                            </button>
                            <button
                              className="button secondary"
                              onClick={() => handleRerun(message.id, query)}
                              disabled={runningQueryId === message.id}
                            >
                              {runningQueryId === message.id ? "Running..." : "Rerun"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>
                        Executed: {new Date(message.createdAt).toLocaleString()}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
            {queryMessages.length === 0 ? <p style={{ color: "var(--muted)" }}>No queries yet.</p> : null}
          </div>
        </div>
      </Tabs.Content>

      <Tabs.Content value="agent" className="tabs-content-fill">
        <div className="stack" style={{ minHeight: 0, height: "100%" }}>
          <div className="stack scroll-fill">
            {messages.map((message) => {
              if (isRerunReasoning(message)) {
                return null;
              }

              if (message.role === "user" && message.prompt) {
                const prompt = message.prompt;
                return (
                  <div key={message.id} className="reasoning-row right">
                    <div className="reasoning-bubble user">
                      <div className="row" style={{ justifyContent: "space-between" }}>
                        <div className="reasoning-title">Prompt</div>
                        <button className="link-button" onClick={() => onCopyPromptToInput(prompt)}>
                          Copy to input
                        </button>
                      </div>
                      <div className="reasoning-time">{new Date(message.createdAt).toLocaleString()}</div>
                      <div>{prompt}</div>
                    </div>
                  </div>
                );
              }

              if (message.role === "assistant" && (message.reasoning || message.error)) {
                return (
                  <div key={message.id} className="reasoning-row left">
                    <div className="reasoning-bubble assistant">
                      <div className="reasoning-title">Reasoning</div>
                      <div className="reasoning-time">{new Date(message.createdAt).toLocaleString()}</div>
                      <div>{message.reasoning || "No reasoning"}</div>
                      {message.error ? <p className="error" style={{ marginBottom: 0 }}>{message.error}</p> : null}
                    </div>
                  </div>
                );
              }

              return null;
            })}
            {messages.length === 0 ? <p style={{ color: "var(--muted)" }}>No messages yet.</p> : null}
          </div>
          <PromptInput
            onSubmit={onSubmitPrompt}
            value={promptDraft}
            onChange={onPromptDraftChange}
            disabled={promptDisabled}
          />
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}
