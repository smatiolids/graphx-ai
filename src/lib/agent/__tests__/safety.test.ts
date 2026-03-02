import { describe, expect, it } from "vitest";
import { isMutatingGremlinQuery } from "@/lib/agent/safety";

describe("isMutatingGremlinQuery", () => {
  it("flags mutating traversals", () => {
    expect(isMutatingGremlinQuery("g.addV('person')")).toBe(true);
    expect(isMutatingGremlinQuery("g.V().drop()")).toBe(true);
  });

  it("allows read-only traversals", () => {
    expect(isMutatingGremlinQuery("g.V().hasLabel('person').limit(10)")).toBe(false);
  });
});
