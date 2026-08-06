import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import * as core from "../src/core/index.mjs";

const read = (path) => readFileSync(path, "utf8");
const pkg = JSON.parse(read("package.json"));

test("defines the v0.1 public package boundary", () => {
  assert.equal(pkg.name, "@mizchi/dspec");
  assert.equal(pkg.private, undefined);
  assert.equal(pkg.license, "MIT");
  assert.deepEqual(pkg.publishConfig, { access: "public" });
  assert.deepEqual(pkg.files, ["PklProject", "dspec", "examples/dspec.pkl", "examples/dspec.traceability.gql", "pkl-tests", "scripts", "skills", "src", "README.md", "LICENSE"]);
  assert.equal(pkg.exports["."], "./src/core/index.mjs");
  assert.equal(pkg.exports["./clause-ast"], "./src/core/clause-ast.mjs");
  assert.equal(pkg.exports["./conformance"], "./src/core/conformance.mjs");
  assert.equal(pkg.exports["./spec-query"], "./src/core/spec-query.mjs");
  assert.equal(pkg.exports["./assurance-evidence"], "./src/core/assurance-evidence.mjs");
  assert.equal(pkg.exports["./real-app"], "./src/core/real-app.mjs");
  assert.equal(pkg.exports["./semantic-graph"], "./src/core/semantic-graph.mjs");
  assert.equal(pkg.exports["./projection"], "./src/core/projection.mjs");
  assert.equal(pkg.exports["./external-holdouts"], "./src/core/external-holdouts.mjs");
  assert.equal(pkg.exports["./schema"], "./dspec/Schema.pkl");
  assert.equal(typeof core.assuranceEvidenceSnapshot, "function");
  assert.equal(typeof core.verifyAssuranceEvidenceManifest, "function");
  assert.equal(typeof core.planProjectionChanges, "function");
  assert.equal(core.PROJECTION_EMITTERS.quickcheck.name, "dspec/quickcheck");
  assert.equal(typeof core.conformanceReport, "function");
  assert.equal(typeof core.querySpec, "function");
  assert.equal(typeof core.externalHoldoutCorpusReport, "function");
  assert.equal(typeof core.semanticGraph, "function");
  assert.equal(pkg.scripts["checker:conformance"], "node scripts/verify-checker-conformance.mjs");
  assert.equal(pkg.scripts["meandb:traceability"], "node scripts/verify-meandb-traceability.mjs");
});

test("defines explicit release and compatibility policy", () => {
  assert.match(read("docs/versioning.md"), /Clause\.ast semantics `1\.0`/);
  assert.match(read("docs/releasing.md"), /Trusted Publisher/);
  assert.equal(JSON.parse(read(".release-please-manifest.json"))["."], "0.0.0");
  assert.equal(JSON.parse(read("release-please-config.json")).packages["."]["release-type"], "node");
  assert.match(read("PklProject"), /version = npmPackage\.version/);
});

test("publishes through npm OIDC without a long-lived token", () => {
  const publish = read(".github/workflows/publish.yml");
  const releasePlease = read(".github/workflows/release-please.yml");

  assert.match(publish, /id-token: write/);
  assert.match(publish, /actions\/setup-node@[a-f0-9]{40} # v6\.4\.0/);
  assert.match(publish, /node-version: "24"/);
  assert.match(publish, /mizchi\/pkfire@[a-f0-9]{40} # v0\.11\.0/);
  assert.match(publish, /pkl-version: 0\.31\.1/);
  assert.match(publish, /pkl project package --skip-publish-check --output-path dist\/pkl/);
  assert.match(publish, /gh release create pkl --title "Pkl package index" --prerelease/);
  assert.match(publish, /gh release upload pkl dist\/pkl\/\* --clobber/);
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
  assert.match(taskfile, /name = "checker:conformance"/);
  assert.match(taskfile, /npm pack --dry-run --json >\/dev\/null/);
  assert.match(taskfile, /checkFast:[\s\S]*?packageReview/);
});

test("builds the public Pkl package after checking its facade API", () => {
  assert.ok(existsSync("PklProject"));
  const output = mkdtempSync(join(tmpdir(), "dspec-pkl-package-"));
  try {
    const result = spawnSync("pkl", ["project", "package", "--skip-publish-check", "--output-path", output, "."], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const artifacts = readdirSync(output);
    assert.ok(artifacts.includes(`dspec@${pkg.version}.zip`));
    assert.ok(artifacts.includes(`dspec@${pkg.version}`));
    assert.ok(artifacts.includes(`dspec@${pkg.version}.zip.sha256`));
    const metadata = JSON.parse(readFileSync(join(output, `dspec@${pkg.version}`), "utf8"));
    assert.equal(
      metadata.packageUri,
      `package://github.com/mizchi/dspec/releases/download/pkl/dspec@${pkg.version}`,
    );
    assert.equal(
      metadata.packageZipUrl,
      `https://github.com/mizchi/dspec/releases/download/pkl/dspec@${pkg.version}.zip`,
    );
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});

test("resolves the Pkl facade through consumer dependency notation", () => {
  const consumer = "fixtures/pkl-package-consumer";
  const resolved = spawnSync("pkl", ["project", "resolve", consumer], { encoding: "utf8" });
  assert.equal(resolved.status, 0, `${resolved.stdout}\n${resolved.stderr}`);

  const evaluated = spawnSync("pkl", ["eval", "--project-dir", consumer, `${consumer}/consumer.pkl`], { encoding: "utf8" });
  assert.equal(evaluated.status, 0, `${evaluated.stdout}\n${evaluated.stderr}`);
  assert.match(evaluated.stdout, /pkl-package-consumer/);
});
