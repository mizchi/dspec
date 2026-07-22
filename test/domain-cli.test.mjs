import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(root, "src", "cli.mjs");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("emits a stable language-neutral domain IR from a Pkl model", () => {
  const result = run(["domain", "ir", "fixtures/domain-codegen.pkl"]);

  assert.equal(result.status, 0, result.stderr);
  const ir = JSON.parse(result.stdout);
  assert.equal(ir.status, "pass");
  assert.equal(ir.types.entities[0].name, "PurchaseOrder");
  assert.equal(ir.formalizations[0].kind, "alloy-behavior");
});

test("generates a TypeScript domain scaffold at a caller-selected path", () => {
  const directory = mkdtempSync(join(tmpdir(), "dspec-domain-codegen-"));
  const output = join(directory, "commerce-domain.ts");
  try {
    const result = run([
      "domain",
      "generate",
      "--language",
      "typescript",
      "--output",
      output,
      "fixtures/domain-codegen.pkl",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const source = readFileSync(output, "utf8");
    assert.match(source, /export interface PurchaseOrder/);
    assert.match(source, /export function createPurchaseOrder/);
    assert.match(source, /Domain constructor is a generated scaffold/);
    const typecheck = spawnSync(join(root, "node_modules", ".bin", "tsc"), [
      "--noEmit",
      "--target", "ES2022",
      "--module", "NodeNext",
      "--moduleResolution", "NodeNext",
      output,
    ], { cwd: root, encoding: "utf8" });
    assert.equal(typecheck.status, 0, typecheck.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects invalid domain declarations through dspec check", () => {
  const result = run(["check", "--json", "fixtures/domain-codegen-invalid.pkl"]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.ok(report.errors.includes("domain aggregate purchase-order must include its root purchase-order in members"));
});

test("tracks formalization artifact paths in the normal drift gate", () => {
  const result = run(["drift", "--json", "fixtures/domain-codegen-missing-formalization.pkl"]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.ok(report.errors.includes("missing domain formalization target path: order-total-alloy -> fixtures/no-such-domain-formalization.pkl"));
});

test("includes DDD declarations in the existing domain coverage inventory", () => {
  const result = run(["domain-coverage", "--json", "fixtures/domain-codegen.pkl"]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.ok(report.elements.some((element) => element.kind === "domain.aggregate" && element.id === "purchase-order"));
  assert.ok(report.elements.some((element) => element.kind === "domain.formalization" && element.id === "order-total-alloy"));
  assert.ok(report.elements.some((element) => element.kind === "domain.field" && element.id === "entity/purchase-order/total"));
});

test("renders DDD declarations and their source links in the Markdown projection", () => {
  const markdown = run(["emit", "markdown", "--locale", "ja", "fixtures/domain-codegen.pkl"]);
  const sourceMap = run(["emit", "source-map", "--locale", "ja", "fixtures/domain-codegen.pkl"]);

  assert.equal(markdown.status, 0, markdown.stderr);
  assert.equal(sourceMap.status, 0, sourceMap.stderr);
  assert.match(markdown.stdout, /## Domain Model/);
  assert.match(markdown.stdout, /### Entity purchase-order/);
  assert.match(markdown.stdout, /### Value Object money/);
  assert.match(markdown.stdout, /### Aggregate purchase-order/);
  assert.match(markdown.stdout, /### Command create-purchase-order/);
  assert.match(markdown.stdout, /### Domain Formalization order-total-alloy/);

  const map = JSON.parse(sourceMap.stdout);
  assert.ok(map.artifacts.markdown.some(
    (entry) => entry.generated === "markdown.domain.entities.purchase-order"
      && entry.source.path === "model.patterns.domain.entities[0]",
  ));
  assert.ok(map.artifacts.markdown.some(
    (entry) => entry.generated === "markdown.domain.formalizations.order-total-alloy"
      && entry.source.path === "model.patterns.domain.formalizations[0]",
  ));
});
