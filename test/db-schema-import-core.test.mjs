import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DbSchemaImportError,
  emitDbSchemaPkl,
  importDbSchema,
} from "../src/core/db-schema-import.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

describe("DB schema import core", () => {
  it("imports the existing SQL fixture without CLI or filesystem coupling", () => {
    const sql = readFileSync(join(root, "fixtures", "db-schema.sql"), "utf8");

    const db = importDbSchema(sql);

    assert.deepEqual(db.tables.map((table) => table.id), ["posts", "users"]);
    const posts = db.tables[0];
    assert.deepEqual(posts.primaryKey, ["id"]);
    assert.deepEqual(
      posts.columns.find((column) => column.id === "author_id"),
      {
        id: "author_id",
        type: "id",
        nullable: false,
        unique: false,
        references: "users.id",
      },
    );
  });

  it("normalizes quoted identifiers and table-level constraints", () => {
    const db = importDbSchema(`
      -- Qualified and quoted names should not leak into stable IDs.
      CREATE TABLE "public"."users" (
        "id" BIGINT,
        "tenant_id" BIGINT NOT NULL,
        CONSTRAINT "users_pk" PRIMARY KEY ("id"),
        UNIQUE ("tenant_id")
      );
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY,
        author_id BIGINT,
        FOREIGN KEY (author_id) REFERENCES "public"."users"("id")
      );
    `);

    assert.deepEqual(db.tables.map((table) => table.id), ["posts", "users"]);
    assert.equal(db.tables[0].columns[1].references, "users.id");
    assert.equal(db.tables[1].columns[0].type, "id");
    assert.equal(db.tables[1].columns[1].unique, true);
  });

  it("renders a deterministic Pkl fragment", () => {
    const source = emitDbSchemaPkl({
      tables: [{
        id: "users",
        primaryKey: ["id"],
        columns: [{ id: "id", type: "id", nullable: false, unique: true }],
      }],
    });

    assert.equal(source, `tables {
  new d.DbTable {
    id = "users"
    primaryKey {
      "id"
    }
    columns {
      new d.DbColumn {
        id = "id"
        type = "id"
        nullable = false
        unique = true
      }
    }
  }
}
`);
  });

  it("fails explicitly when no CREATE TABLE statement exists", () => {
    assert.throws(
      () => importDbSchema("SELECT 1;"),
      (error) => error instanceof DbSchemaImportError &&
        error.message === "db schema import found no CREATE TABLE statements",
    );
  });
});
