import { describe, expect, it } from "vitest";
import { normalizeGraphResult } from "@/lib/graph/normalize";

describe("normalizeGraphResult", () => {
  it("extracts vertex and edge structures", () => {
    const data = [
      { id: 1, label: "person", type: "vertex" },
      { id: 2, label: "software", type: "vertex" },
      { id: 3, label: "created", type: "edge", outV: 1, inV: 2 }
    ];

    const graph = normalizeGraphResult(data);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ source: "1", target: "2" });
  });

  it("extracts connected nodes and edges from select(e,v) style rows", () => {
    const data = [
      {
        e: {
          id: { "@value": 1001 },
          label: "knows",
          type: "edge",
          outV: { "@value": 10 },
          inV: { "@value": 11 }
        },
        v: {
          id: { "@value": 10 },
          label: "person",
          type: "vertex"
        }
      },
      {
        e: {
          id: { "@value": 1001 },
          label: "knows",
          type: "edge",
          outV: { "@value": 10 },
          inV: { "@value": 11 }
        },
        v: {
          id: { "@value": 11 },
          label: "person",
          type: "vertex"
        }
      }
    ];

    const graph = normalizeGraphResult(data);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ source: "10", target: "11" });
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["10", "11"]);
  });

  it("creates placeholder nodes when only edges are present", () => {
    const data = [{ id: 9, label: "knows", type: "edge", outV: 1, inV: 2 }];
    const graph = normalizeGraphResult(data);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["1", "2"]);
    expect(graph.edges).toHaveLength(1);
  });

  it("supports janusgraph select(e,v) rows with relationId edge ids", () => {
    const data = [
      {
        e: {
          id: { relationId: "jrc-j0g-f11-3ag" },
          label: "registrado por",
          properties: [],
          outV: { id: 24640, label: "veiculo", properties: [] },
          inV: { id: 4264, label: "documento", properties: [] }
        },
        v: {
          id: 24640,
          label: "veiculo",
          properties: []
        }
      },
      {
        e: {
          id: { relationId: "jrc-j0g-f11-3ag" },
          label: "registrado por",
          properties: [],
          outV: { id: 24640, label: "veiculo", properties: [] },
          inV: { id: 4264, label: "documento", properties: [] }
        },
        v: {
          id: 4264,
          label: "documento",
          properties: []
        }
      }
    ];

    const graph = normalizeGraphResult(data);

    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["24640", "4264"]);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      id: "jrc-j0g-f11-3ag",
      source: "24640",
      target: "4264",
      label: "registrado por"
    });
  });

  it("ignores vertex property records as nodes", () => {
    const data = [
      {
        e: {
          id: { relationId: "edge-1" },
          label: "registrado por",
          outV: { id: 1, label: "veiculo", properties: [] },
          inV: { id: 2, label: "documento", properties: [] }
        },
        v: {
          id: 1,
          label: "veiculo",
          properties: [{ id: { relationId: "prop-1" }, label: "placa", key: "placa", value: "AAA0001" }]
        }
      },
      {
        e: {
          id: { relationId: "edge-1" },
          label: "registrado por",
          outV: { id: 1, label: "veiculo", properties: [] },
          inV: { id: 2, label: "documento", properties: [] }
        },
        v: {
          id: 2,
          label: "documento",
          properties: [{ id: { relationId: "prop-2" }, label: "tipo", key: "tipo", value: "CPF" }]
        }
      }
    ];

    const graph = normalizeGraphResult(data);
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["1", "2"]);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ source: "1", target: "2" });
  });
});
