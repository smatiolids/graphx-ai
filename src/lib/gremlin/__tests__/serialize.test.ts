import { describe, expect, it } from "vitest";
import { serializeGremlinValue } from "@/lib/gremlin/serialize";

describe("serializeGremlinValue", () => {
  it("serializes map-heavy gremlin results", () => {
    const input = [
      new Map([
        ["e", { id: 1, label: "knows", outV: 10, inV: 11, type: "edge" }],
        ["v", { id: 10, label: "person", type: "vertex" }]
      ])
    ];

    const output = serializeGremlinValue(input) as Array<Record<string, unknown>>;

    expect(Array.isArray(output)).toBe(true);
    expect(output).toHaveLength(1);
    expect(output[0]).toHaveProperty("e");
    expect(output[0]).toHaveProperty("v");
    expect(output[0].e).toMatchObject({ id: 1, label: "knows" });
    expect(output[0].v).toMatchObject({ id: 10, label: "person" });
  });
});
