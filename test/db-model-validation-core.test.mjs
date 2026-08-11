import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dbColumnRefParts,
  dbInvariantMap,
  dbPattern,
  dbTableMap,
  validateDbModel,
} from "../src/core/db-model-validation.mjs";

describe("DB model validation core", () => {
  it("accepts an absent or internally consistent DB pattern", () => {
    assert.deepEqual(validateDbModel({}), []);
    assert.deepEqual(validateDbModel({
      patterns: {
        db: {
          tables: [{
            id: "orders",
            columns: [{ id: "id" }, { id: "tenant_id" }],
            primaryKey: ["id"],
            tenantColumn: "tenant_id",
          }],
          invariants: [{ id: "orders-valid", tables: ["orders"] }],
          transactions: [{
            id: "create-order",
            reads: [],
            writes: ["orders"],
            preserves: ["orders-valid"],
            idempotencyKey: "orders.id",
          }],
          migrations: [],
        },
      },
    }), []);
  });

  it("reports DB reference errors in deterministic validation order", () => {
    const errors = validateDbModel({
      patterns: {
        db: {
          tables: [
            {
              id: "orders",
              columns: [{ id: "id" }, { id: "id" }],
              primaryKey: ["missing_pk"],
              tenantColumn: "missing_tenant",
            },
            { id: "orders", columns: [], primaryKey: [] },
            {
              id: "refs",
              columns: [
                { id: "bad_shape", references: "broken" },
                { id: "bad_table", references: "missing.id" },
                { id: "bad_column", references: "orders.missing" },
              ],
              primaryKey: [],
            },
          ],
          invariants: [{ id: "known", tables: ["missing"] }],
          transactions: [{
            id: "tx",
            reads: ["missing"],
            writes: ["missing"],
            preserves: ["missing"],
            idempotencyKey: "missing.id",
          }],
          migrations: [{
            id: "migration",
            fromTables: ["missing"],
            toTables: ["missing"],
            preserves: ["missing"],
            mappings: [
              { id: "mapping", invariants: ["missing", "known"] },
              { id: "mapping", invariants: [] },
            ],
          }],
        },
      },
    });

    assert.deepEqual(errors, [
      "duplicate db table id: orders",
      "duplicate db column id in orders: id",
      "unknown db primary key column: orders -> missing_pk",
      "unknown db tenant column: orders -> missing_tenant",
      "invalid db column reference: refs.bad_shape -> broken",
      "unknown db column reference table: refs.bad_table -> missing.id",
      "unknown db column reference column: refs.bad_column -> orders.missing",
      "unknown db invariant table: known -> missing",
      "unknown db transaction read table: tx -> missing",
      "unknown db transaction write table: tx -> missing",
      "unknown db transaction invariant: tx -> missing",
      "unknown db column reference table: tx.idempotencyKey -> missing.id",
      "duplicate db migration mapping id in migration: mapping",
      "unknown db migration source table: migration -> missing",
      "unknown db migration target table: migration -> missing",
      "unknown db migration invariant: migration -> missing",
      "unknown db migration mapping invariant: migration.mapping -> missing",
      "db migration mapping invariant is not preserved: migration.mapping -> known",
    ]);
  });

  it("exposes typed accessors used by validation and backend projections", () => {
    const model = {
      patterns: {
        db: {
          tables: [{ id: "orders", columns: [{ id: "id" }] }],
          invariants: [{ id: "orders-valid" }],
        },
      },
    };
    const db = dbPattern(model);

    assert.deepEqual(dbColumnRefParts("orders.id"), { tableId: "orders", columnId: "id" });
    assert.equal(dbColumnRefParts("orders"), null);
    assert.equal(dbTableMap(db).get("orders").id, "orders");
    assert.equal(dbInvariantMap(db).get("orders-valid").id, "orders-valid");
  });
});
