import type { GraphEdge, GraphNode, GraphPayload } from "@/lib/types";

function unwrapGremlinScalar(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) return value;

  if ("@value" in record) {
    return unwrapGremlinScalar(record["@value"]);
  }

  if ("value" in record && Object.keys(record).every((key) => key === "value" || key === "@type")) {
    return unwrapGremlinScalar(record.value);
  }

  return value;
}

function stringifyId(value: unknown): string {
  const unwrapped = unwrapGremlinScalar(value);

  if (typeof unwrapped === "string") return unwrapped;
  if (typeof unwrapped === "number" || typeof unwrapped === "bigint" || typeof unwrapped === "boolean") {
    return String(unwrapped);
  }

  const record = asRecord(unwrapped);
  if (record?.relationId !== undefined) {
    return stringifyId(record.relationId);
  }
  if (record?.id !== undefined) {
    return stringifyId(record.id);
  }

  return JSON.stringify(unwrapped);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractElementId(record: Record<string, unknown>): string | null {
  if (record.id !== undefined) return stringifyId(record.id);
  if (record["@id"] !== undefined) return stringifyId(record["@id"]);
  return null;
}

function extractEndpointId(value: unknown): string {
  const record = asRecord(value);
  if (record && record.id !== undefined) return stringifyId(record.id);
  return stringifyId(value);
}

function tryNode(value: unknown): GraphNode | null {
  const record = asRecord(value);
  if (!record) return null;

  const looksLikeProperty = record.key !== undefined || record.value !== undefined;
  if (looksLikeProperty) {
    return null;
  }

  const hasEdgeEndpoints =
    (record.outV !== undefined && record.inV !== undefined) ||
    (record.outVertex !== undefined && record.inVertex !== undefined);

  const hasPropertiesField = Array.isArray(record.properties);
  if (
    (record.type === "vertex" ||
      (extractElementId(record) !== null && record.label !== undefined && hasPropertiesField)) &&
    !hasEdgeEndpoints &&
    record.type !== "edge"
  ) {
    const id = extractElementId(record);
    if (!id) return null;
    const label = String(record.label ?? id);
    return { id, label, data: record };
  }

  return null;
}

function tryEdge(value: unknown): GraphEdge | null {
  const record = asRecord(value);
  if (!record) return null;

  const outV = record.outV ?? record.outVertex;
  const inV = record.inV ?? record.inVertex;

  if ((record.type === "edge" || (record.id !== undefined && outV !== undefined && inV !== undefined)) && outV !== undefined && inV !== undefined) {
    const source = extractEndpointId(outV);
    const target = extractEndpointId(inV);
    return {
      id: stringifyId(record.id ?? `${outV}->${inV}`),
      source,
      target,
      label: typeof record.label === "string" ? record.label : undefined,
      data: record
    };
  }

  return null;
}

function walk(value: unknown, nodes: Map<string, GraphNode>, edges: Map<string, GraphEdge>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, nodes, edges));
    return;
  }

  const edge = tryEdge(value);
  if (edge) {
    edges.set(edge.id, edge);
  }

  const node = tryNode(value);
  if (node) {
    nodes.set(node.id, node);
  }

  const record = asRecord(value);
  if (!record) return;

  for (const nested of Object.values(record)) {
    walk(nested, nodes, edges);
  }
}

export function normalizeGraphResult(data: unknown): GraphPayload {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  walk(data, nodes, edges);
  for (const edge of edges.values()) {
    if (!nodes.has(edge.source)) {
      nodes.set(edge.source, { id: edge.source, label: edge.source });
    }
    if (!nodes.has(edge.target)) {
      nodes.set(edge.target, { id: edge.target, label: edge.target });
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values())
  };
}
