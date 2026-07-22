import assert from "node:assert/strict";
import test from "node:test";

import {
  DOMAIN_CODEGEN_IR_SCHEMA_VERSION,
  domainCodegenIr,
  renderDomainTypescript,
} from "../src/core/domain.mjs";

function fixtureModel() {
  return {
    id: "commerce-domain",
    version: "0.1.0",
    rules: [{ id: "ORDER-TOTAL-NON-NEGATIVE" }],
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
    formalizations: 1,
    invariants: 1,
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
    target: { kind: "model", path: "fixtures/order-behavior.pkl", symbol: null },
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

test("rejects an Aggregate whose root is not one of its declared Entity members", () => {
  const model = fixtureModel();
  model.patterns.domain.aggregates[0].members = [];

  const ir = domainCodegenIr(model);

  assert.equal(ir.status, "fail");
  assert.deepEqual(ir.errors, ["domain aggregate purchase-order must include its root purchase-order in members"]);
});
