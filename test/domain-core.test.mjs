import assert from "node:assert/strict";
import test from "node:test";

import {
  DOMAIN_CODEGEN_IR_SCHEMA_VERSION,
  DOMAIN_RELATIONSHIP_GRAPH_SCHEMA_VERSION,
  domainCodegenIr,
  domainRelationshipGraph,
  renderDomainRelationshipMarkdown,
  renderDomainTypescript,
} from "../src/core/domain.mjs";

function fixtureModel() {
  return {
    id: "commerce-domain",
    version: "0.1.0",
    vocabulary: [{ id: "money", kind: "concept" }],
    rules: [{
      id: "ORDER-TOTAL-NON-NEGATIVE",
      terms: ["money"],
      checks: [{ backend: "node", ref: "test/domain-core.test.mjs#renders a TypeScript domain scaffold without inventing invariant behavior" }],
      implementedBy: [{ kind: "code", path: "src/core/domain.mjs", symbol: "renderDomainTypescript" }],
    }],
    patterns: {
      domain: {
        enums: [{ id: "order-status", values: ["draft", "confirmed"] }],
        valueObjects: [{
          id: "money",
          fields: [
            { id: "amount", type: "decimal" },
            { id: "currency", type: "string" },
          ],
        }],
        entities: [{
          id: "purchase-order",
          identity: "orderId",
          fields: [
            { id: "orderId", type: "uuid" },
            { id: "status", type: "enum", target: "order-status" },
            { id: "total", type: "value-object", target: "money" },
          ],
        }],
        aggregates: [{ id: "purchase-order", root: "purchase-order", members: ["purchase-order"] }],
        commands: [{
          id: "create-purchase-order",
          aggregate: "purchase-order",
          fields: [
            { id: "orderId", type: "uuid" },
            { id: "total", type: "value-object", target: "money" },
          ],
        }],
        events: [{
          id: "purchase-order-created",
          aggregate: "purchase-order",
          fields: [{ id: "orderId", type: "uuid" }],
        }],
        invariants: [{ id: "order-total-non-negative", aggregate: "purchase-order", rule: "ORDER-TOTAL-NON-NEGATIVE" }],
        formalizations: [{
          id: "order-total-alloy",
          rule: "ORDER-TOTAL-NON-NEGATIVE",
          kind: "alloy-behavior",
          assurance: "bounded",
          target: { kind: "model", path: "fixtures/order-behavior.pkl" },
          actionMappings: [{
            action: "create",
            command: "create-purchase-order",
            events: ["purchase-order-created"],
          }],
          checks: ["order.total.holds"],
        }, {
          id: "order-total-behavior",
          rule: "ORDER-TOTAL-NON-NEGATIVE",
          kind: "behavior",
          assurance: "bounded",
          target: { kind: "model", path: "fixtures/order-behavior.pkl" },
          checks: ["order.total.behavior.holds"],
        }],
        refinements: [{
          id: "order-total-input-abstraction",
          kind: "input-abstraction",
          sourceFormalization: "order-total-behavior",
          targetFormalization: "order-total-alloy",
          sourceCondition: "total-input >= 0",
          targetCondition: "no negative order total exists",
          checks: ["order.total.holds"],
        }],
      },
    },
  };
}

test("compiles Entity, Value Object, Aggregate, Command, Event, and Invariant declarations into a language-neutral IR", () => {
  const ir = domainCodegenIr(fixtureModel());

  assert.equal(ir.status, "pass");
  assert.equal(ir.schemaVersion, DOMAIN_CODEGEN_IR_SCHEMA_VERSION);
  assert.deepEqual(ir.summary, {
    aggregates: 1,
    commands: 1,
    entities: 1,
    enums: 1,
    events: 1,
    formalizations: 2,
    invariants: 1,
    refinements: 1,
    valueObjects: 1,
  });
  assert.deepEqual(ir.types.entities[0], {
    id: "purchase-order",
    name: "PurchaseOrder",
    identity: "orderId",
    identityType: "PurchaseOrderId",
    fields: [
      { id: "orderId", name: "orderId", type: "uuid", target: null, required: true, collection: false },
      { id: "status", name: "status", type: "enum", target: "order-status", required: true, collection: false },
      { id: "total", name: "total", type: "value-object", target: "money", required: true, collection: false },
    ],
  });
  assert.deepEqual(ir.formalizations, [{
    id: "order-total-alloy",
    rule: "ORDER-TOTAL-NON-NEGATIVE",
    kind: "alloy-behavior",
    assurance: "bounded",
    assumptions: [],
    actionMappings: [{
      action: "create",
      command: "create-purchase-order",
      events: ["purchase-order-created"],
    }],
    checks: ["order.total.holds"],
    target: { kind: "model", path: "fixtures/order-behavior.pkl", symbol: null },
  }, {
    id: "order-total-behavior",
    rule: "ORDER-TOTAL-NON-NEGATIVE",
    kind: "behavior",
    assurance: "bounded",
    assumptions: [],
    actionMappings: [],
    checks: ["order.total.behavior.holds"],
    target: { kind: "model", path: "fixtures/order-behavior.pkl", symbol: null },
  }]);
  assert.deepEqual(ir.refinements, [{
    id: "order-total-input-abstraction",
    kind: "input-abstraction",
    sourceFormalization: "order-total-behavior",
    targetFormalization: "order-total-alloy",
    sourceCondition: "total-input >= 0",
    targetCondition: "no negative order total exists",
    assumptions: [],
    checks: ["order.total.holds"],
  }]);
  assert.deepEqual(ir.invariants, [{
    id: "order-total-non-negative",
    aggregate: "purchase-order",
    rule: "ORDER-TOTAL-NON-NEGATIVE",
  }]);
  assert.deepEqual(ir.types.aggregates[0].invariants, [{
    id: "order-total-non-negative",
    aggregate: "purchase-order",
    rule: "ORDER-TOTAL-NON-NEGATIVE",
  }]);
  assert.equal(ir.types.valueObjects[0].fields[0].type, "decimal");
  assert.equal(ir.types.valueObjects[0].fields[0].target, null);
  assert.equal(ir.types.commands[0].fields[0].type, "uuid");
  assert.equal(ir.types.events[0].fields[0].type, "uuid");
});

test("renders a TypeScript domain scaffold without inventing invariant behavior", () => {
  const source = renderDomainTypescript(fixtureModel());

  assert.match(source, /export type OrderStatus = "confirmed" \| "draft";/);
  assert.match(source, /export interface Money \{/);
  assert.match(source, /amount: string;/);
  assert.match(source, /export type PurchaseOrderId = string & \{ readonly __brand: "PurchaseOrderId" \};/);
  assert.match(source, /export interface PurchaseOrder \{/);
  assert.match(source, /export interface CreatePurchaseOrder \{/);
  assert.match(source, /export interface PurchaseOrderCreated \{/);
  assert.match(source, /export interface PurchaseOrderRepository \{/);
  assert.match(source, /export function createPurchaseOrder\(command: CreatePurchaseOrder\): PurchaseOrder \{/);
  assert.match(source, /TODO: enforce domain invariants: ORDER-TOTAL-NON-NEGATIVE/);
  assert.match(source, /throw new Error\("Domain constructor is a generated scaffold; implement it in the application layer"\);/);
});

test("projects DDD declarations, rules, evidence, and formalizations into one relationship graph", () => {
  const graph = domainRelationshipGraph(fixtureModel(), "en");

  assert.equal(graph.status, "pass");
  assert.equal(graph.schemaVersion, DOMAIN_RELATIONSHIP_GRAPH_SCHEMA_VERSION);
  assert.ok(graph.nodes.some((node) => node.id === "domain/entity/purchase-order"));
  assert.ok(graph.nodes.some((node) => node.id === "rule/ORDER-TOTAL-NON-NEGATIVE"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/field/entities/purchase-order/total" && edge.relation === "references" && edge.to === "domain/value-object/money"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/aggregate/purchase-order" && edge.relation === "root" && edge.to === "domain/entity/purchase-order"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/command/create-purchase-order" && edge.relation === "targets-aggregate" && edge.to === "domain/aggregate/purchase-order"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/invariant/order-total-non-negative" && edge.relation === "states-rule" && edge.to === "rule/ORDER-TOTAL-NON-NEGATIVE"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/formalization/order-total-alloy" && edge.relation === "checks-rule" && edge.to === "rule/ORDER-TOTAL-NON-NEGATIVE"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/formalization/order-total-alloy" && edge.relation === "models-action" && edge.to === "formal-action/order-total-alloy/create"));
  assert.ok(graph.edges.some((edge) => edge.from === "formal-action/order-total-alloy/create" && edge.relation === "implements-command" && edge.to === "domain/command/create-purchase-order"));
  assert.ok(graph.edges.some((edge) => edge.from === "formal-action/order-total-alloy/create" && edge.relation === "emits-event" && edge.to === "domain/event/purchase-order-created"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/formalization/order-total-alloy" && edge.relation === "asserts-check" && edge.to === "formal-check/order-total-alloy/order.total.holds"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/refinement/order-total-input-abstraction" && edge.relation === "abstracts-formalization" && edge.to === "domain/formalization/order-total-behavior"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/refinement/order-total-input-abstraction" && edge.relation === "refines-to-formalization" && edge.to === "domain/formalization/order-total-alloy"));
  assert.ok(graph.edges.some((edge) => edge.from === "domain/refinement/order-total-input-abstraction" && edge.relation === "asserts-check" && edge.to === "formal-check/order-total-alloy/order.total.holds"));
  assert.ok(graph.edges.some((edge) => edge.from === "rule/ORDER-TOTAL-NON-NEGATIVE" && edge.relation === "has-check" && edge.to.startsWith("check/node/")));
  assert.ok(graph.edges.some((edge) => edge.from === "rule/ORDER-TOTAL-NON-NEGATIVE" && edge.relation === "implemented-by" && edge.to === "artifact/code/src/core/domain.mjs#renderDomainTypescript"));

  const markdown = renderDomainRelationshipMarkdown(graph);
  assert.match(markdown, /# Specification Relationships commerce-domain/);
  assert.match(markdown, /```mermaid/);
  assert.match(markdown, /states-rule/);
  assert.match(markdown, /\n```\n$/);
});

test("resolves forward DDD references without leaving a valid target marked unresolved", () => {
  const model = fixtureModel();
  model.patterns.domain.valueObjects[0].fields.push({ id: "origin", type: "entity-reference", target: "purchase-order" });

  const graph = domainRelationshipGraph(model);

  assert.equal(graph.status, "pass");
  assert.deepEqual(graph.nodes.find((node) => node.id === "domain/entity/purchase-order"), {
    id: "domain/entity/purchase-order",
    kind: "entity",
    label: "entity purchase-order",
  });
});

test("keeps an invalid relationship graph inspectable by materializing unresolved endpoints", () => {
  const model = fixtureModel();
  model.patterns.domain.aggregates[0].root = "missing-order";

  const graph = domainRelationshipGraph(model);

  assert.equal(graph.status, "fail");
  assert.ok(graph.nodes.some((node) => node.id === "domain/entity/missing-order" && node.kind === "unresolved-domain-target"));
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  assert.ok(graph.edges.every((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)));
});

test("rejects an Aggregate whose root is not one of its declared Entity members", () => {
  const model = fixtureModel();
  model.patterns.domain.aggregates[0].members = [];

  const ir = domainCodegenIr(model);

  assert.equal(ir.status, "fail");
  assert.deepEqual(ir.errors, ["domain aggregate purchase-order must include its root purchase-order in members"]);
});

test("requires a refinement to anchor every check in its concrete formalization", () => {
  const model = fixtureModel();
  model.patterns.domain.refinements[0].checks = ["order.total.missing.holds"];

  const ir = domainCodegenIr(model);

  assert.equal(ir.status, "fail");
  assert.deepEqual(ir.errors, [
    "domain refinement check is not declared by target formalization: order-total-input-abstraction -> order.total.missing.holds",
  ]);
});
