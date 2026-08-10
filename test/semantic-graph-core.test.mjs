import assert from "node:assert/strict";
import test from "node:test";

import {
  embedGraphdbDocuments,
  SEMANTIC_GRAPH_SCHEMA_VERSION,
  graphdbBundle,
  querySemanticGraph,
  renderSemanticGraphTurtle,
  semanticGraph,
  semanticGraphWithEvidence,
} from "../src/core/semantic-graph.mjs";

function fixtureModel() {
  return {
    id: "semantic-graph-fixture",
    name: { default: "Semantic graph fixture", labels: { ja: "意味グラフのフィクスチャ" } },
    version: "0.1.0",
    primaryLocale: "ja",
    vocabulary: [{ id: "order", kind: "entity", text: { default: "Order" } }],
    rules: [{
      id: "ORDER-VALID",
      text: { default: "An order must be valid." },
      terms: ["order"],
      checks: [{ backend: "node", ref: "test/order.test.mjs#valid" }],
      implementedBy: [{ kind: "code", path: "src/order.mts", symbol: "validateOrder" }],
    }],
    decisions: [{
      id: "ADR-0001",
      date: "2026-08-04",
      summary: { default: "Keep Pkl authoritative." },
      rationale: "Generated graph formats are derived artifacts.",
    }],
    projections: [{
      id: "rules-markdown",
      kind: "markdown",
      output: "docs/rules.md",
      provenance: "docs/provenance.json",
    }],
    patterns: {
      domain: {
        entities: [{ id: "order", identity: "order-id", fields: [{ id: "order-id", type: "uuid" }] }],
        aggregates: [{ id: "order", root: "order", members: ["order"] }],
        invariants: [{ id: "order-valid", aggregate: "order", rule: "ORDER-VALID" }],
      },
      intent: {
        capabilities: [{ id: "inventory", kind: "dependency", text: { default: "Inventory" } }],
        outcomes: [{ id: "accepted", state: "order", text: { default: "Accepted" } }],
        processes: [{
          id: "place-order",
          input: "order",
          outcomes: ["accepted"],
          requires: ["inventory"],
          text: { default: "Place an order" },
        }],
        goals: [{
          id: "customer-can-order",
          intents: ["place-order"],
          claims: ["order-placement"],
          text: { default: "Customers can place orders" },
        }],
        claims: [{
          id: "order-placement",
          processes: ["place-order"],
          text: { default: "Order placement is available" },
        }],
      },
    },
  };
}

test("projects Pkl declarations into an evidence-aware semantic graph", () => {
  const graph = semanticGraph(fixtureModel());

  assert.equal(graph.status, "pass");
  assert.equal(graph.schemaVersion, SEMANTIC_GRAPH_SCHEMA_VERSION);
  assert.equal(graph.model.id, "semantic-graph-fixture");
  assert.ok(graph.nodes.some((node) => node.id === "model/semantic-graph-fixture" && node.kind === "model"));
  assert.ok(graph.nodes.some((node) => node.id === "decision/ADR-0001" && node.kind === "decision"));
  assert.ok(graph.nodes.some((node) => node.id === "projection/rules-markdown" && node.kind === "projection"));
  assert.ok(graph.nodes.some((node) => node.id === "intent/process/place-order" && node.kind === "intent-process"));
  assert.ok(graph.edges.some((edge) => edge.from === "intent/process/place-order" && edge.relation === "requires-capability" && edge.to === "intent/capability/inventory"));
  assert.ok(graph.edges.some((edge) => edge.from === "intent/goal/customer-can-order" && edge.relation === "includes-process" && edge.to === "intent/process/place-order"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/invariant/order-valid" && edge.relation === "states-rule" && edge.to === "rule/ORDER-VALID"));
  assert.ok(graph.nodes.every((node) => node.origin === "pkl" && node.evidenceStatus === "declared"));
  assert.ok(graph.edges.every((edge) => edge.origin === "pkl" && edge.evidenceStatus === "declared"));
  assert.match(graph.semantics.evidencePolicy, /does not establish implementation conformance/);
});

test("renders the semantic graph as lossless Turtle and a GraphDB import bundle", () => {
  const graph = semanticGraph(fixtureModel());
  const turtle = renderSemanticGraphTurtle(graph);
  const bundle = graphdbBundle(graph);

  assert.match(turtle, /@prefix dspec:/);
  assert.match(turtle, /<urn:dspec:node:intent%2Fprocess%2Fplace-order>/);
  assert.match(turtle, /dspec:requires-capability/);
  assert.match(bundle.files["links.csv"], /^# src_id,dst_id\n/m);
  assert.match(bundle.files["meta.tsv"], /^# id\ttitle\ttags\n/m);
  assert.match(bundle.files["meta.tsv"], /relation:requires-capability/);
  assert.match(bundle.files["documents.jsonl"], /"stableId":"intent\/process\/place-order"/);
  assert.match(bundle.files["README.md"], /reified relation nodes/);
  const idMap = JSON.parse(bundle.files["id-map.json"]);
  assert.equal(idMap.schemaVersion, "1.0");
  assert.equal(idMap.nodes.length, graph.nodes.length + graph.edges.length);
  assert.match(idMap.nodes[0].graphdbId, /^\d+$/);
  const documents = bundle.files["documents.jsonl"].trim().split("\n").map((line) => JSON.parse(line));
  const relation = documents.find((document) => document.tags.includes("relation:requires-capability"));
  const process = idMap.nodes.find((node) => node.stableId === "intent/process/place-order");
  const capability = idMap.nodes.find((node) => node.stableId === "intent/capability/inventory");
  assert.ok(relation);
  assert.ok(process);
  assert.ok(capability);
  assert.match(bundle.files["links.csv"], new RegExp("^" + process.graphdbId + "," + relation.graphdbId + "$", "m"));
  assert.match(bundle.files["links.csv"], new RegExp("^" + relation.graphdbId + "," + capability.graphdbId + "$", "m"));
});

test("embeds GraphDB documents deterministically and retrieves declarations with their graph evidence", () => {
  const graph = semanticGraph(fixtureModel());
  const documents = graphdbBundle(graph).files["documents.jsonl"].trim().split("\n").map((line) => JSON.parse(line));
  const embedded = embedGraphdbDocuments(documents, { dimensions: 16 });
  const query = querySemanticGraph(graph, "Customers can place orders", { dimensions: 16, limit: 3 });

  assert.equal(embedded.provider, "hash");
  assert.equal(embedded.dimensions, 16);
  assert.match(embedded.notesCsv, /^\d+,-?0\.\d{8}/m);
  assert.equal(query.status, "pass");
  assert.equal(query.classification, "retrieved");
  assert.ok(query.matches.some((match) => match.stableId === "intent/goal/customer-can-order"));
  assert.ok(query.evidence.some((entry) => entry.ref === "node:intent/goal/customer-can-order"));
});

test("keeps imported implementation evidence distinct from Pkl declarations", () => {
  const graph = semanticGraph(fixtureModel());
  const enriched = semanticGraphWithEvidence(graph, {
    conformance: {
      model: { id: "semantic-graph-fixture", version: "0.1.0" },
      status: "pass",
      targets: [{ id: "order-valid", ruleId: "ORDER-VALID", status: "pass", cases: [{ id: "valid-order", status: "pass" }] }],
    },
    assurance: {
      model: { id: "semantic-graph-fixture", version: "0.1.0" },
      artifacts: [{ id: "lean", backend: "lean", result: "pass", scope: "generator", propertyIds: ["lean.theorem.order_valid"] }],
    },
    realApp: {
      model: { id: "semantic-graph-fixture", version: "0.1.0" },
      status: "pass",
      checks: [{ id: "order-api", kind: "route", path: "model.patterns.api.routes[0]", status: "pass" }],
    },
  });

  assert.equal(enriched.status, "pass");
  assert.ok(enriched.nodes.some((node) => node.id === "evidence/conformance/order-valid" && node.origin === "conformance-report" && node.evidenceStatus === "verified"));
  assert.ok(enriched.nodes.some((node) => node.id === "evidence/assurance/lean" && node.origin === "assurance-manifest" && node.evidenceStatus === "verified"));
  assert.ok(enriched.nodes.some((node) => node.id === "evidence/real-app/route/order-api" && node.origin === "real-app-reconciliation" && node.evidenceStatus === "observed"));
  assert.ok(enriched.edges.some((edge) => edge.from === "rule/ORDER-VALID" && edge.relation === "has-conformance-result" && edge.to === "evidence/conformance/order-valid"));
  assert.ok(enriched.nodes.filter((node) => node.origin === "pkl").every((node) => node.evidenceStatus === "declared"));
});

test("rejects imported evidence without the exact source model identity", () => {
  const graph = semanticGraph(fixtureModel());
  const enriched = semanticGraphWithEvidence(graph, {
    conformance: {
      status: "pass",
      targets: [],
    },
    assurance: {
      model: { id: "semantic-graph-fixture" },
      artifacts: [],
    },
    realApp: {
      model: { id: "other-model", version: "9.9.9" },
      status: "pass",
      checks: [],
    },
  });

  assert.equal(enriched.status, "fail");
  assert.deepEqual(enriched.errors, [
    "assurance evidence model version is missing: expected 0.1.0",
    "conformance evidence model id is missing: expected semantic-graph-fixture",
    "conformance evidence model version is missing: expected 0.1.0",
    "real app evidence model id mismatch: expected semantic-graph-fixture, got other-model",
    "real app evidence model version mismatch: expected 0.1.0, got 9.9.9",
  ]);
});
