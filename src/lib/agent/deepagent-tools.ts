import path from "node:path";
import { appendFile, mkdir, readFile as readFileFromDisk, rm, writeFile as writeFileToDisk } from "node:fs/promises";
import YAML from "yaml";
import { exists } from "@/lib/fs-utils";
import { runGremlinQuery } from "@/lib/gremlin/client";
import { getSessionAgentContext, getSessionById, updateSessionAgentContext } from "@/lib/sessions/store";
import type { ServerConfig } from "@/lib/types";
import type { DeepAgentResult } from "@/lib/agent/deepagent.types";

type LabelSamples = {
  sampleSizePerLabel: number;
  vertexLabels: string[];
  edgeLabels: string[];
  vertexSamplesByLabel: Record<string, unknown>;
  edgeSamplesByLabel: Record<string, unknown>;
  warning?: string;
  error?: string;
};

const defaultDataModel = {
  description: "Graph data model placeholder. Customize server/datamodel.json or server/datamodel.yaml.",
  vertices: [],
  edges: []
};

const promptLogDir = path.join(process.cwd(), "log");
const promptLogFile = path.join(promptLogDir, "agent-prompts.log");
const sessionContextRoot = path.join(process.cwd(), "server", "session-contexts");

const janusSchemaQuery = `mgmt = graph.openManagement(); try { [
  vertexLabels: mgmt.getVertexLabels().collect { it.name() }.sort(),
  edgeLabels: mgmt.getRelationTypes(org.janusgraph.core.EdgeLabel.class).collect { it.name() }.sort(),
  propertyKeys: mgmt.getRelationTypes(org.janusgraph.core.PropertyKey.class).collect {
    [name: it.name(), dataType: it.dataType() ? it.dataType().simpleName : "UNKNOWN", cardinality: String.valueOf(it.cardinality())]
  }.sort { it.name },
  vertexIndexes: mgmt.getGraphIndexes(org.apache.tinkerpop.gremlin.structure.Vertex.class).collect { idx ->
    [name: idx.name(), unique: idx.isUnique(), backingIndex: idx.getBackingIndex(), keys: idx.getFieldKeys().collect { fk ->
      [name: fk.name(), status: String.valueOf(idx.getIndexStatus(fk))]
    }]
  }.sort { it.name },
  edgeIndexes: mgmt.getGraphIndexes(org.apache.tinkerpop.gremlin.structure.Edge.class).collect { idx ->
    [name: idx.name(), unique: idx.isUnique(), backingIndex: idx.getBackingIndex(), keys: idx.getFieldKeys().collect { fk ->
      [name: fk.name(), status: String.valueOf(idx.getIndexStatus(fk))]
    }]
  }.sort { it.name }
] } finally { mgmt.rollback() }`;

export async function logGeneratedPrompt(payload: Record<string, unknown>): Promise<void> {
  try {
    await mkdir(promptLogDir, { recursive: true });
    await appendFile(
      promptLogFile,
      `${JSON.stringify({ ts: new Date().toISOString(), ...payload })}\n`,
      "utf8"
    );
  } catch {
    // Avoid breaking requests due to prompt logging issues.
  }
}

export async function writeLastPromptMarkdown(params: {
  sessionId: string;
  serverId: string;
  model: string;
  prompt: string;
  agentRawResponse: string;
  parsedResponse?: DeepAgentResult;
  parseError?: string;
}): Promise<void> {
  const filePath = path.join(promptLogDir, `${params.sessionId}-last-prompt.md`);
  const markdown = [
    `# Last Agent Interaction`,
    ``,
    `- ts: ${new Date().toISOString()}`,
    `- sessionId: ${params.sessionId}`,
    `- serverId: ${params.serverId}`,
    `- model: ${params.model}`,
    ``,
    `## Prompt`,
    ``,
    "```text",
    params.prompt,
    "```",
    ``,
    `## Agent Raw Response`,
    ``,
    "```text",
    params.agentRawResponse,
    "```",
    ``
  ];

  if (params.parsedResponse) {
    markdown.push(
      `## Parsed Response`,
      ``,
      "```json",
      JSON.stringify(params.parsedResponse, null, 2),
      "```",
      ``
    );
  }

  if (params.parseError) {
    markdown.push(`## Parse Error`, ``, "```text", params.parseError, "```", ``);
  }

  try {
    await mkdir(promptLogDir, { recursive: true });
    await writeFileToDisk(filePath, markdown.join("\n"), "utf8");
  } catch {
    // Avoid breaking requests due to markdown logging issues.
  }
}

function getSessionSampleSize(): number {
  const raw = process.env.JANUSGRAPH_SESSION_SAMPLE_SIZE;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function getSessionContextPaths(sessionId: string): { graphDataModelPath: string; janusgraphSchemaIndexesPath: string } {
  const sessionDir = path.join(sessionContextRoot, sessionId);
  return {
    graphDataModelPath: path.join(sessionDir, "graph_datamodel.json"),
    janusgraphSchemaIndexesPath: path.join(sessionDir, "janusgraph_schema_indexes.json")
  };
}

async function loadGraphDataModel(): Promise<unknown> {
  const envModel = process.env.GRAPH_DATA_MODEL_JSON;
  if (envModel) {
    try {
      return JSON.parse(envModel);
    } catch {
      return {
        ...defaultDataModel,
        warning: "GRAPH_DATA_MODEL_JSON is not valid JSON"
      };
    }
  }

  const jsonPath = path.join(process.cwd(), "server", "datamodel.json");
  if (await exists(jsonPath)) {
    const raw = await readFileFromDisk(jsonPath, "utf8");
    return JSON.parse(raw);
  }

  const yamlPath = path.join(process.cwd(), "server", "datamodel.yaml");
  if (await exists(yamlPath)) {
    const raw = await readFileFromDisk(yamlPath, "utf8");
    return YAML.parse(raw);
  }

  return defaultDataModel;
}

async function inspectJanusGraphRuntimeContext(server: ServerConfig): Promise<Record<string, unknown>> {
  try {
    const schema = await runGremlinQuery(server, janusSchemaQuery);

    return {
      source: "janusgraph_live",
      inspectedAt: new Date().toISOString(),
      details: schema
    };
  } catch (error) {
    const fallbackDetails: Record<string, unknown> = {};
    try {
      fallbackDetails.vertexLabels = await runGremlinQuery(server, "g.V().label().dedup().order().limit(200)");
      fallbackDetails.edgeLabels = await runGremlinQuery(server, "g.E().label().dedup().order().limit(200)");
      fallbackDetails.vertexPropertyKeys = await runGremlinQuery(
        server,
        "g.V().limit(200).properties().key().dedup().order()"
      );
      fallbackDetails.edgePropertyKeys = await runGremlinQuery(
        server,
        "g.E().limit(200).properties().key().dedup().order()"
      );
    } catch (fallbackError) {
      fallbackDetails.fallbackError = fallbackError instanceof Error ? fallbackError.message : "Unknown fallback error";
    }

    return {
      source: "janusgraph_live",
      inspectedAt: new Date().toISOString(),
      warning: "Failed to inspect JanusGraph schema/indexes",
      error: error instanceof Error ? error.message : "Unknown inspection error",
      fallbackDetails
    };
  }
}

function escapeGremlinString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function collectLabelSamples(server: ServerConfig, sampleSize: number): Promise<LabelSamples> {
  const [vertexLabelsRaw, edgeLabelsRaw] = await Promise.all([
    runGremlinQuery(server, "g.V().label().dedup().order()"),
    runGremlinQuery(server, "g.E().label().dedup().order()")
  ]);

  const vertexLabels = Array.isArray(vertexLabelsRaw) ? vertexLabelsRaw.map((v) => String(v)) : [];
  const edgeLabels = Array.isArray(edgeLabelsRaw) ? edgeLabelsRaw.map((v) => String(v)) : [];

  const vertexEntries = await Promise.all(
    vertexLabels.map(async (label) => {
      const query = `g.V().hasLabel('${escapeGremlinString(label)}').limit(${sampleSize})`;
      const sample = await runGremlinQuery(server, query);
      return [label, sample] as const;
    })
  );

  const edgeEntries = await Promise.all(
    edgeLabels.map(async (label) => {
      const query = `g.E().hasLabel('${escapeGremlinString(label)}').limit(${sampleSize})`;
      const sample = await runGremlinQuery(server, query);
      return [label, sample] as const;
    })
  );

  return {
    sampleSizePerLabel: sampleSize,
    vertexLabels,
    edgeLabels,
    vertexSamplesByLabel: Object.fromEntries(vertexEntries),
    edgeSamplesByLabel: Object.fromEntries(edgeEntries)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function enrichGraphDataModelWithSamples(baseDataModel: unknown, labelSamples: LabelSamples): Record<string, unknown> {
  const model = isRecord(baseDataModel) ? baseDataModel : defaultDataModel;

  const baseVertices = Array.isArray(model.vertices) ? model.vertices : [];
  const baseEdges = Array.isArray(model.edges) ? model.edges : [];

  const enrichedVertices = baseVertices.map((vertex) => {
    if (!isRecord(vertex) || typeof vertex.label !== "string") return vertex;
    return {
      ...vertex,
      sampleRecords: labelSamples.vertexSamplesByLabel[vertex.label] ?? []
    };
  });

  const enrichedEdges = baseEdges.map((edge) => {
    if (!isRecord(edge) || typeof edge.label !== "string") return edge;
    return {
      ...edge,
      sampleRecords: labelSamples.edgeSamplesByLabel[edge.label] ?? []
    };
  });

  const knownVertexLabels = new Set(
    enrichedVertices.filter(isRecord).map((vertex) => vertex.label).filter((label): label is string => typeof label === "string")
  );
  const knownEdgeLabels = new Set(
    enrichedEdges.filter(isRecord).map((edge) => edge.label).filter((label): label is string => typeof label === "string")
  );

  const inferredVertices = labelSamples.vertexLabels
    .filter((label) => !knownVertexLabels.has(label))
    .map((label) => ({
      label,
      inferred: true,
      sampleRecords: labelSamples.vertexSamplesByLabel[label] ?? []
    }));

  const inferredEdges = labelSamples.edgeLabels
    .filter((label) => !knownEdgeLabels.has(label))
    .map((label) => ({
      label,
      inferred: true,
      sampleRecords: labelSamples.edgeSamplesByLabel[label] ?? []
    }));

  return {
    ...model,
    vertices: [...enrichedVertices, ...inferredVertices],
    edges: [...enrichedEdges, ...inferredEdges],
    sampleSizePerLabel: labelSamples.sampleSizePerLabel,
    enrichedAt: new Date().toISOString()
  };
}

async function readJsonFile(pathToFile: string): Promise<unknown> {
  const raw = await readFileFromDisk(pathToFile, "utf8");
  return JSON.parse(raw);
}

export async function buildPromptWithSessionQueryHistory(sessionId: string, prompt: string): Promise<string> {
  const session = await getSessionById(sessionId);
  if (!session) return prompt;

  const previousQueries = session.messages
    .filter((message) => message.role === "assistant" && typeof message.query === "string" && message.query.trim().length > 0)
    .map((message) => message.query!.trim());

  if (previousQueries.length === 0) return prompt;

  const historyBlock = previousQueries.map((query, index) => `${index + 1}. ${query}`).join("\n");

  return [
    "Session previous generated Gremlin queries:",
    historyBlock,
    "",
    "Current user request:",
    prompt
  ].join("\n");
}

export async function loadSessionContextFiles(sessionId: string): Promise<{ dataModel: unknown; janusRuntimeContext: unknown }> {
  const sessionContext = await getSessionAgentContext(sessionId);
  const fallbackPaths = getSessionContextPaths(sessionId);
  const graphDataModelPath = sessionContext?.contextFiles?.graphDataModelPath ?? fallbackPaths.graphDataModelPath;
  const janusgraphSchemaIndexesPath =
    sessionContext?.contextFiles?.janusgraphSchemaIndexesPath ?? fallbackPaths.janusgraphSchemaIndexesPath;

  const dataModel = (await exists(graphDataModelPath))
    ? await readJsonFile(graphDataModelPath)
    : {
        ...defaultDataModel,
        warning: "Session graph data model file not found. Start a new session to initialize context files."
      };

  const janusRuntimeContext = (await exists(janusgraphSchemaIndexesPath))
    ? await readJsonFile(janusgraphSchemaIndexesPath)
    : {
        source: "session_file",
        warning: "Session JanusGraph schema/indexes file not found. Start a new session to initialize context files."
      };

  return { dataModel, janusRuntimeContext };
}

export async function initializeSessionContextFiles(sessionId: string, server: ServerConfig): Promise<void> {
  const contextPaths = getSessionContextPaths(sessionId);
  const sampleSize = getSessionSampleSize();
  const [dataModel, janusRuntimeContext, labelSamples] = await Promise.all([
    loadGraphDataModel(),
    inspectJanusGraphRuntimeContext(server),
    collectLabelSamples(server, sampleSize).catch((error): LabelSamples => ({
      sampleSizePerLabel: sampleSize,
      warning: "Failed to load per-label samples",
      error: error instanceof Error ? error.message : "Unknown sampling error",
      vertexLabels: [],
      edgeLabels: [],
      vertexSamplesByLabel: {},
      edgeSamplesByLabel: {}
    }))
  ]);

  const enrichedDataModel = enrichGraphDataModelWithSamples(dataModel, labelSamples);

  const sessionSchemaIndexesContext = {
    ...janusRuntimeContext,
    labelSamples
  };

  await mkdir(path.dirname(contextPaths.graphDataModelPath), { recursive: true });
  await writeFileToDisk(contextPaths.graphDataModelPath, JSON.stringify(enrichedDataModel, null, 2), "utf8");
  await writeFileToDisk(
    contextPaths.janusgraphSchemaIndexesPath,
    JSON.stringify(sessionSchemaIndexesContext, null, 2),
    "utf8"
  );

  await updateSessionAgentContext(sessionId, {
    janusgraphRuntimeContext: sessionSchemaIndexesContext,
    janusgraphContextUpdatedAt: new Date().toISOString(),
    contextFiles: contextPaths
  });
}

export async function deleteSessionContextFiles(sessionId: string): Promise<void> {
  const sessionDir = path.join(sessionContextRoot, sessionId);
  await rm(sessionDir, { recursive: true, force: true });
}
