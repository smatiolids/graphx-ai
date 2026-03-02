function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function pickKnownGremlinFields(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = [
    "id",
    "label",
    "type",
    "outV",
    "inV",
    "outVertex",
    "inVertex",
    "outVLabel",
    "inVLabel",
    "key",
    "value",
    "properties",
    "object",
    "bulk"
  ];

  for (const key of keys) {
    if (key in value) {
      out[key] = serializeGremlinValue(value[key]);
    }
  }

  return out;
}

export function serializeGremlinValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => serializeGremlinValue(item));
  }

  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([k, v]) => [String(k), serializeGremlinValue(v)])
    );
  }

  if (value instanceof Set) {
    return Array.from(value.values()).map((item) => serializeGremlinValue(item));
  }

  if (typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;

  if (isPlainObject(record)) {
    return Object.fromEntries(
      Object.entries(record).map(([k, v]) => [k, serializeGremlinValue(v)])
    );
  }

  const enumerable = Object.entries(record);
  if (enumerable.length > 0) {
    return Object.fromEntries(enumerable.map(([k, v]) => [k, serializeGremlinValue(v)]));
  }

  const known = pickKnownGremlinFields(record);
  if (Object.keys(known).length > 0) {
    return known;
  }

  return String(value);
}
