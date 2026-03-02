import { NextRequest, NextResponse } from "next/server";
import { createSession, listSessions } from "@/lib/sessions/store";
import { initializeSessionContextFiles } from "@/lib/agent/deepagent-tools";
import { getServerById } from "@/lib/servers/store";
import { sessionCreateSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const serverId = request.nextUrl.searchParams.get("serverId");
    if (!serverId) {
      return NextResponse.json({ error: "serverId is required" }, { status: 400 });
    }

    const sessions = await listSessions(serverId);
    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = sessionCreateSchema.parse(body);
    const server = await getServerById(payload.serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    const session = await createSession(payload.serverId, payload.title);
    await initializeSessionContextFiles(session.id, server);

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 400 }
    );
  }
}
