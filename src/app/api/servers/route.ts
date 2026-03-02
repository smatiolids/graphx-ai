import { NextRequest, NextResponse } from "next/server";
import { createServer, listServers } from "@/lib/servers/store";
import { checkServerHealth } from "@/lib/gremlin/client";
import { logEvent } from "@/lib/logger";
import { serverCreateSchema } from "@/lib/validators";

export async function GET() {
  try {
    const servers = await listServers();
    await logEvent("debug", "servers.list.success", { count: servers.length });
    return NextResponse.json({ servers });
  } catch (error) {
    await logEvent("error", "servers.list.error", {
      error: error instanceof Error ? error.message : "Failed to load servers"
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load servers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = serverCreateSchema.parse(body);
    const server = await createServer(payload);
    await logEvent("info", "servers.create.success", {
      serverId: server.id,
      host: server.host,
      port: server.port,
      protocol: server.protocol,
      path: server.path
    });
    return NextResponse.json({ server }, { status: 201 });
  } catch (error) {
    await logEvent("error", "servers.create.error", {
      error: error instanceof Error ? error.message : "Failed to create server"
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create server" },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = serverCreateSchema.parse(body);

    if (!payload.id) {
      await logEvent("warn", "servers.healthcheck.invalid", { reason: "missing_server_id" });
      return NextResponse.json({ error: "id is required for connection check" }, { status: 400 });
    }

    await logEvent("info", "servers.healthcheck.request", {
      serverId: payload.id,
      host: payload.host,
      port: payload.port,
      protocol: payload.protocol,
      path: payload.path
    });
    const health = await checkServerHealth({ ...payload, id: payload.id });
    await logEvent(health.ok ? "info" : "error", "servers.healthcheck.result", {
      serverId: payload.id,
      ok: health.ok,
      message: health.message
    });
    return NextResponse.json({ health });
  } catch (error) {
    await logEvent("error", "servers.healthcheck.error", {
      error: error instanceof Error ? error.message : "Health check failed"
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Health check failed" },
      { status: 400 }
    );
  }
}
