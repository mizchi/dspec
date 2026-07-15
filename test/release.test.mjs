import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as core from "../src/core/index.mjs";

const read = (path) => readFileSync(path, "utf8");
const pkg = JSON.parse(read("package.json"));

test("defines the v0.1 public package boundary", () => {
  assert.equal(pkg.name, "@mizchi/dspec");
  assert.equal(pkg.private, undefined);
  assert.equal(pkg.license, "MIT");
  assert.deepEqual(pkg.publishConfig, { access: "public" });
  assert.deepEqual(pkg.files, ["dspec", "src", "README.md", "LICENSE"]);
  assert.equal(pkg.exports["."], "./src/core/index.mjs");
  assert.equal(pkg.exports["./clause-ast"], "./src/core/clause-ast.mjs");
  assert.equal(pkg.exports["./assurance-evidence"], "./src/core/assurance-evidence.mjs");
  assert.equal(pkg.exports["./real-app"], "./src/core/real-app.mjs");
  assert.equal(pkg.exports["./projection"], "./src/core/projection.mjs");
  assert.equal(pkg.exports["./schema"], "./dspec/Schema.pkl");
  assert.equal(typeof core.assuranceEvidenceSnapshot, "function");
  assert.equal(typeof core.verifyAssuranceEvidenceManifest, "function");
  assert.equal(typeof core.planProjectionChanges, "function");
});

test("defines explicit release and compatibility policy", () => {
  assert.match(read("docs/versioning.md"), /Clause\.ast semantics `1\.0`/);
  assert.match(read("docs/releasing.md"), /Trusted Publisher/);
  assert.equal(JSON.parse(read(".release-please-manifest.json"))["."], "0.0.0");
  assert.equal(JSON.parse(read("release-please-config.json")).packages["."]["release-type"], "node");
});

test("publishes through npm OIDC without a long-lived token", () => {
  const publish = read(".github/workflows/publish.yml");
  const releasePlease = read(".github/workflows/release-please.yml");

  assert.match(publish, /id-token: write/);
  assert.match(publish, /actions\/setup-node@[a-f0-9]{40} # v6\.4\.0/);
  assert.match(publish, /node-version: "24"/);
  assert.match(publish, /npm publish/);
  assert.doesNotMatch(publish, /NPM_TOKEN|NODE_AUTH_TOKEN/);
  assert.match(releasePlease, /googleapis\/release-please-action@[a-f0-9]{40} # v5\.0\.0/);
  assert.match(releasePlease, /workflow_dispatch/);
});

test("tracks release inputs and reviews the package in the fast gate", () => {
  const taskfile = read("Taskfile.pkl");

  assert.match(taskfile, /local projectMetadata: Listing<String>/);
  assert.match(taskfile, /"docs\/\*\*\/\*\.md"/);
  assert.match(taskfile, /"\.release-please-manifest\.json"/);
  assert.match(taskfile, /name = "package:review"/);
  assert.match(taskfile, /npm pack --dry-run --json >\/dev\/null/);
  assert.match(taskfile, /checkFast:[\s\S]*?packageReview/);
});
