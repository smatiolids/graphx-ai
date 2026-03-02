import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { assertWithinRateLimit } from "@/lib/agent/rate-limit";
import { isMutatingGremlinQuery } from "@/lib/agent/safety";
import { normalizeGraphResult } from "@/lib/graph/normalize";
import { runGremlinQuery } from "@/lib/gremlin/client";
import { logEvent } from "@/lib/logger";
import { getServerById } from "@/lib/servers/store";
import { appendMessages } from "@/lib/sessions/store";
import { agentRerunSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const body = await request.json();
    const payload = agentRerunSchema.parse(body);
    await logEvent("info", "query.execute.received", {
      sessionId: payload.sessionId,
      serverId: payload.serverId,
      queryLength: payload.query.length
    });

    assertWithinRateLimit(payload.sessionId);

    const server = await getServerById(payload.serverId);
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if ((process.env.GREMLIN_REJECT_MUTATIONS ?? "true") === "true" && isMutatingGremlinQuery(payload.query)) {
      return NextResponse.json({ error: "Blocked potentially mutating query" }, { status: 400 });
    }

    const data = await runGremlinQuery(server, payload.query);
    const graph = normalizeGraphResult(data);
    const assistantMessageId = uuidv4();

    await appendMessages(payload.sessionId, [
      {
        id: assistantMessageId,
        role: "assistant",
        query: payload.query,
        reasoning: "Re-ran saved query from history.",
        data,
        graph,
        createdAt: new Date().toISOString()
      }
    ]);

    await logEvent("info", "query.execute.success", {
      sessionId: payload.sessionId,
      serverId: payload.serverId,
      latencyMs: Date.now() - startedAt,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length
    });

    return NextResponse.json({
      query: payload.query,
      reasoning: "Re-ran saved query from history.",
      data,
      graph,
      sessionMessageId: assistantMessageId,
      latencyMs: Date.now() - startedAt
    });
  } catch (error) {
    await logEvent("error", "query.execute.error", {
      error: error instanceof Error ? error.message : "Failed to execute query",
      latencyMs: Date.now() - startedAt
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to execute query",
        latencyMs: Date.now() - startedAt
      },
      { status: 400 }
    );
  }
}
