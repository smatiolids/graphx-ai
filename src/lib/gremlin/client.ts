import { logEvent } from "@/lib/logger";
import { serializeGremlinValue } from "@/lib/gremlin/serialize";
import type { ServerConfig } from "@/lib/types";
import type GremlinType from "gremlin";

let gremlinModule: typeof GremlinType | null = null;

async function loadGremlin(): Promise<typeof GremlinType> {
  if (gremlinModule) return gremlinModule;
  // Force ws to avoid optional native addons that can break in bundled runtimes.
  process.env.WS_NO_BUFFER_UTIL ??= "1";
  process.env.WS_NO_UTF_8_VALIDATE ??= "1";
  const mod = await import("gremlin");
  gremlinModule = (mod as { default?: typeof GremlinType }).default ?? (mod as typeof GremlinType);
  return gremlinModule;
}

export async function runGremlinQuery(server: ServerConfig, query: string): Promise<unknown> {
  const gremlin = await loadGremlin();
  const { Client } = gremlin.driver;

  const traversalSource = server.traversalSource || process.env.GREMLIN_DEFAULT_TRAVERSAL_SOURCE || "g";
  const protocol = server.protocol || "ws";
  const path = server.path.startsWith("/") ? server.path : `/${server.path}`;
  const uri = `${protocol}://${server.host}:${server.port}${path}`;
  const startedAt = Date.now();

  await logEvent("debug", "gremlin.query.start", {
    serverId: server.id,
    host: server.host,
    port: server.port,
    protocol,
    path,
    traversalSource,
    query
  });

  const client = new Client(uri, {
    mimeType: "application/vnd.gremlin-v3.0+json",
    pingEnabled: true,
    traversalSource,
    ...(server.username
      ? {
          authenticator: new gremlin.driver.auth.PlainTextSaslAuthenticator(server.username, server.password || "")
        }
      : {})
  });

  try {
    const directResult = await client.submit(query, {});
    const data = serializeGremlinValue(directResult.toArray());
    await logEvent("info", "gremlin.query.success", {
      serverId: server.id,
      host: server.host,
      port: server.port,
      traversalSource,
      elapsedMs: Date.now() - startedAt,
      resultCount: Array.isArray(data) ? data.length : 0
    });
    return data;
  } catch (error) {
    await logEvent("error", "gremlin.query.error", {
      serverId: server.id,
      host: server.host,
      port: server.port,
      traversalSource,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown Gremlin error",
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  } finally {
    await client.close();
  }
}

export async function checkServerHealth(server: ServerConfig): Promise<{ ok: boolean; message?: string }> {
  try {
    const traversalSource = server.traversalSource || process.env.GREMLIN_DEFAULT_TRAVERSAL_SOURCE || "g";
    await logEvent("info", "gremlin.healthcheck.start", {
      serverId: server.id,
      host: server.host,
      port: server.port,
      protocol: server.protocol,
      path: server.path,
      traversalSource
    });
    const result = await runGremlinQuery(server, `${traversalSource}.V().limit(1)`);
    await logEvent("info", "gremlin.healthcheck.success", {
      serverId: server.id,
      resultCount: Array.isArray(result) ? result.length : 0
    });
    return { ok: true, message: `Connected. Sample size: ${Array.isArray(result) ? result.length : 0}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connection error";
    await logEvent("error", "gremlin.healthcheck.error", {
      serverId: server.id,
      error: message
    });
    return { ok: false, message };
  }
}
