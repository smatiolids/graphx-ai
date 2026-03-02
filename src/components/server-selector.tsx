"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Label from "@radix-ui/react-label";
import type { ServerConfig } from "@/lib/types";

type Props = {
  servers: ServerConfig[];
  onConnect: (server: ServerConfig) => Promise<void>;
  onServerCreated: (server: ServerConfig) => void;
  onServerUpdated: (server: ServerConfig) => void;
};

type ServerForm = Omit<ServerConfig, "id">;

const initialForm: ServerForm = {
  name: "",
  host: "localhost",
  port: 8182,
  protocol: "ws",
  path: "/gremlin",
  username: "",
  password: "",
  traversalSource: "g"
};

function ServerFormFields({
  form,
  setForm,
  prefix
}: {
  form: ServerForm;
  setForm: React.Dispatch<React.SetStateAction<ServerForm>>;
  prefix: string;
}) {
  return (
    <div className="stack" style={{ marginTop: "0.75rem" }}>
      <div>
        <Label.Root htmlFor={`${prefix}-name`}>Name</Label.Root>
        <input
          id={`${prefix}-name`}
          className="input"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
      </div>
      <div className="row">
        <div style={{ flex: 1 }}>
          <Label.Root htmlFor={`${prefix}-host`}>Host</Label.Root>
          <input
            id={`${prefix}-host`}
            className="input"
            value={form.host}
            onChange={(event) => setForm((prev) => ({ ...prev, host: event.target.value }))}
          />
        </div>
        <div style={{ width: 120 }}>
          <Label.Root htmlFor={`${prefix}-port`}>Port</Label.Root>
          <input
            id={`${prefix}-port`}
            className="input"
            type="number"
            value={form.port}
            onChange={(event) => setForm((prev) => ({ ...prev, port: Number(event.target.value || 0) }))}
          />
        </div>
      </div>
      <div className="row">
        <div style={{ width: 140 }}>
          <Label.Root htmlFor={`${prefix}-protocol`}>Protocol</Label.Root>
          <select
            id={`${prefix}-protocol`}
            className="select"
            value={form.protocol}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, protocol: event.target.value as ServerConfig["protocol"] }))
            }
          >
            <option value="ws">ws</option>
            <option value="wss">wss</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <Label.Root htmlFor={`${prefix}-path`}>Path</Label.Root>
          <input
            id={`${prefix}-path`}
            className="input"
            value={form.path}
            onChange={(event) => setForm((prev) => ({ ...prev, path: event.target.value }))}
          />
        </div>
      </div>
      <div className="row">
        <div style={{ flex: 1 }}>
          <Label.Root htmlFor={`${prefix}-username`}>Username</Label.Root>
          <input
            id={`${prefix}-username`}
            className="input"
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Label.Root htmlFor={`${prefix}-password`}>Password</Label.Root>
          <input
            id={`${prefix}-password`}
            className="input"
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          />
        </div>
      </div>
      <div>
        <Label.Root htmlFor={`${prefix}-traversalSource`}>Traversal source</Label.Root>
        <input
          id={`${prefix}-traversalSource`}
          className="input"
          value={form.traversalSource}
          onChange={(event) => setForm((prev) => ({ ...prev, traversalSource: event.target.value }))}
        />
      </div>
    </div>
  );
}

export function ServerSelector({ servers, onConnect, onServerCreated, onServerUpdated }: Props) {
  const safeServers = Array.isArray(servers) ? servers : [];
  const [selectedId, setSelectedId] = useState<string>(safeServers[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ServerForm>(initialForm);
  const [editForm, setEditForm] = useState<ServerForm>(initialForm);

  const selected = useMemo(() => safeServers.find((server) => server.id === selectedId), [safeServers, selectedId]);

  useEffect(() => {
    if (!selectedId && safeServers.length > 0) {
      setSelectedId(safeServers[0].id);
    }
  }, [safeServers, selectedId]);

  async function handleCreateServer() {
    try {
      setError("");
      const response = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm)
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create server");
      }

      onServerCreated(payload.server as ServerConfig);
      setSelectedId(payload.server.id);
      setCreateDialogOpen(false);
      setCreateForm(initialForm);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create server");
    }
  }

  function openEditDialog() {
    if (!selected) return;

    setEditForm({
      name: selected.name,
      host: selected.host,
      port: selected.port,
      protocol: selected.protocol,
      path: selected.path,
      username: selected.username || "",
      password: selected.password || "",
      traversalSource: selected.traversalSource || "g"
    });
    setEditDialogOpen(true);
  }

  async function handleEditServer() {
    if (!selected) return;

    try {
      setError("");
      const response = await fetch(`/api/servers/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update server");
      }

      onServerUpdated(payload.server as ServerConfig);
      setEditDialogOpen(false);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Failed to update server");
    }
  }

  async function handleConnect() {
    if (!selected) return;
    setLoading(true);
    setError("");

    try {
      const healthResponse = await fetch("/api/servers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected)
      });
      const healthPayload = await healthResponse.json();
      if (!healthResponse.ok || !healthPayload.health?.ok) {
        throw new Error(healthPayload.health?.message || healthPayload.error || "Connection check failed");
      }

      await onConnect(selected);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Failed to connect");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 900, margin: "2rem auto", padding: "1rem" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>JanusGraph Visualizer Agent</h1>
          <p style={{ margin: "0.4rem 0", color: "var(--muted)" }}>Select a server or create a new connection.</p>
        </div>

        <div className="row">
          <Dialog.Root open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <Dialog.Trigger asChild>
              <button className="button secondary" disabled={!selected} onClick={openEditDialog}>
                Edit Server
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.25)",
                  backdropFilter: "blur(2px)"
                }}
              />
              <Dialog.Content
                className="panel"
                style={{
                  width: "min(640px, 94vw)",
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  padding: "1rem"
                }}
              >
                <Dialog.Title>Edit Server</Dialog.Title>
                <ServerFormFields form={editForm} setForm={setEditForm} prefix="edit" />
                <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.75rem" }}>
                  <Dialog.Close asChild>
                    <button className="button secondary">Cancel</button>
                  </Dialog.Close>
                  <button className="button" onClick={handleEditServer}>
                    Save Changes
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <Dialog.Root open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <Dialog.Trigger asChild>
              <button className="button secondary">New Server</button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.25)",
                  backdropFilter: "blur(2px)"
                }}
              />
              <Dialog.Content
                className="panel"
                style={{
                  width: "min(640px, 94vw)",
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  padding: "1rem"
                }}
              >
                <Dialog.Title>Create New Server</Dialog.Title>
                <ServerFormFields form={createForm} setForm={setCreateForm} prefix="create" />
                <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.75rem" }}>
                  <Dialog.Close asChild>
                    <button className="button secondary">Cancel</button>
                  </Dialog.Close>
                  <button className="button" onClick={handleCreateServer}>
                    Save Server
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>

      <div className="stack" style={{ marginTop: "1rem" }}>
        <label htmlFor="serverSelect">Available servers</label>
        <select
          id="serverSelect"
          className="select"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {safeServers.map((server) => (
            <option key={server.id} value={server.id}>
              {server.name} ({server.protocol}://{server.host}:{server.port})
            </option>
          ))}
        </select>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="button" onClick={handleConnect} disabled={loading || !selected}>
            {loading ? "Connecting..." : "Connect"}
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
}
