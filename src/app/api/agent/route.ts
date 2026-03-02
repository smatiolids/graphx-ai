import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { generateGremlinWithDeepAgent } from "@/lib/agent/deepagent-agent";
import { assertWithinRateLimit } from "@/lib/agent/rate-limit";
import { isMutatingGremlinQuery } from "@/lib/agent/safety";
import { normalizeGraphResult } from "@/lib/graph/normalize";
import { runGremlinQuery } from "@/lib/gremlin/client";
import { logEvent } from "@/lib/logger";
import { getServerById } from "@/lib/servers/store";
import { appendMessages } from "@/lib/sessions/store";
import { agentRequestSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const body = await request.json();
    const payload = agentRequestSchema.parse(body);
    await logEvent("info", "agent.request.received", {
      sessionId: payload.sessionId,
      serverId: payload.serverId,
      promptLength: payload.prompt.length
    });

    assertWithinRateLimit(payload.sessionId);

    const server = await getServerById(payload.serverId);
    if (!server) {
      await logEvent("warn", "agent.request.server_not_found", {
        sessionId: payload.sessionId,
        serverId: payload.serverId
      });
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    const userMessageId = uuidv4();
    const assistantMessageId = uuidv4();

    const { query, reasoning } = await generateGremlinWithDeepAgent(payload.prompt, server, payload.sessionId);
    await logEvent("debug", "agent.query.generated", {
      sessionId: payload.sessionId,
      serverId: payload.serverId,
      queryLength: query.length,
      reasoningLength: reasoning.length
    });

    if ((process.env.GREMLIN_REJECT_MUTATIONS ?? "true") === "true" && isMutatingGremlinQuery(query)) {
      await logEvent("warn", "agent.query.blocked_mutation", {
        sessionId: payload.sessionId,
        serverId: payload.serverId
      });
      await appendMessages(payload.sessionId, [
        {
          id: userMessageId,
          role: "user",
          prompt: payload.prompt,
          createdAt: new Date().toISOString()
        },
        {
          id: assistantMessageId,
          role: "assistant",
          query,
          reasoning,
          data: null,
          graph: { nodes: [], edges: [] },
          createdAt: new Date().toISOString(),
          error: "Blocked potentially mutating query"
        }
      ]);

      return NextResponse.json(
        {
          query,
          reasoning,
          data: null,
          graph: { nodes: [], edges: [] },
          sessionMessageIds: { userMessageId, assistantMessageId },
          latencyMs: Date.now() - startedAt,
          error: "Blocked potentially mutating query"
        },
        { status: 400 }
      );
    }

    const data = await runGremlinQuery(server, query);
    const graph = normalizeGraphResult(data);
    await logEvent("info", "agent.query.executed", {
      sessionId: payload.sessionId,
      serverId: payload.serverId,
      latencyMs: Date.now() - startedAt,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length
    });

    await appendMessages(payload.sessionId, [
      {
        id: userMessageId,
        role: "user",
        prompt: payload.prompt,
        createdAt: new Date().toISOString()
      },
      {
        id: assistantMessageId,
        role: "assistant",
        query,
        reasoning,
        data,
        graph,
        createdAt: new Date().toISOString()
      }
    ]);

    return NextResponse.json({
      query,
      reasoning,
      data,
      graph,
      sessionMessageIds: { userMessageId, assistantMessageId },
      latencyMs: Date.now() - startedAt
    });
  } catch (error) {
    await logEvent("error", "agent.request.error", {
      error: error instanceof Error ? error.message : "Failed to process prompt",
      latencyMs: Date.now() - startedAt
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process prompt",
        latencyMs: Date.now() - startedAt
      },
      { status: 400 }
    );
  }
}
