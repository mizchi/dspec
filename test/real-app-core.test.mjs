import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  evaluateRealAppImport,
  importInfrastructureDocuments,
  realAppImportFacts,
  realAppObservedDomain,
} from "../src/core/real-app.mjs";

const fixtureRoot = "fixtures/holdout-iac-app";

function fixtureDocument(path) {
  return { path, source: readFileSync(join(fixtureRoot, path), "utf8") };
}

test("normalizes IaC documents without filesystem access", () => {
  const infrastructure = importInfrastructureDocuments([
    fixtureDocument("infra/terraform-plan.json"),
    fixtureDocument("infra/k8s/payments.yaml"),
  ]);

  assert.deepEqual(infrastructure.sources.map((source) => source.kind), ["kubernetes", "terraform-plan"]);
  assert.equal(infrastructure.resources.length, 7);
  assert.equal(infrastructure.schedules.length, 1);
});

test("keeps the core API and CLI infrastructure output identical", () => {
  const expected = importInfrastructureDocuments([
    fixtureDocument("infra/terraform-plan.json"),
    fixtureDocument("infra/k8s/payments.yaml"),
  ]);
  const result = spawnSync(
    process.execPath,
    ["src/cli.mjs", "import-real-app", "--json", fixtureRoot],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).app.infrastructure, expected);
});

test("compares normalized app facts with a typed gold set", () => {
  const app = {
    id: "sample",
    routes: [{ method: "GET", path: "/health" }],
    contracts: { path: null, schemas: [] },
    workflows: [],
    infrastructure: importInfrastructureDocuments([
      fixtureDocument("infra/terraform-plan.json"),
      fixtureDocument("infra/k8s/payments.yaml"),
    ]),
  };
  const expectedFacts = realAppImportFacts(app);
  const report = evaluateRealAppImport({ id: "sample-eval", appRoot: fixtureRoot, expectedFacts }, app);

  assert.equal(report.status, "pass");
  assert.equal(report.summary.precision, 1);
  assert.equal(report.summary.recall, 1);
});

test("projects infrastructure facts conservatively", () => {
  const app = {
    routes: [],
    contracts: { schemas: [] },
    workflows: [],
    scripts: [],
    quality: {},
    infrastructure: importInfrastructureDocuments([
      fixtureDocument("infra/terraform-plan.json"),
      fixtureDocument("infra/k8s/payments.yaml"),
    ]),
  };
  const domain = realAppObservedDomain(app);

  assert.ok(domain.cloud.nodes.includes("terraform/aws_s3_bucket.assets"));
  assert.ok(domain.data.stores.includes("terraform/aws_s3_bucket.assets"));
  assert.ok(domain.release.services.includes("kubernetes/production/deployment/payments-api"));
});
