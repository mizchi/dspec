import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import * as core from "../src/core/index.mjs";

const read = (path) => readFileSync(path, "utf8");
const pkg = JSON.parse(read("package.json"));

function taskBlock(source, name) {
  const start = source.indexOf(`local ${name}: Task = new {`);
  assert.notEqual(start, -1, `missing task: ${name}`);
  const next = source.indexOf("\nlocal ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

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
  const releasing = read("docs/releasing.md");
  assert.match(releasing, /Trusted Publisher/);
  assert.match(releasing, /npm trust github @mizchi\/dspec --repo mizchi\/dspec --file publish\.yml --allow-publish/);
  assert.match(releasing, /npm version <version> --no-git-tag-version/);
  assert.match(releasing, /npx -y git-cliff@2\.14\.2 --tag v<version> -o CHANGELOG\.md/);
  assert.match(releasing, /git tag v<version>/);
  assert.match(releasing, /git push origin main v<version>/);
  assert.doesNotMatch(releasing, /release-please/i);
  for (const retired of ["release-please-config.json", ".release-please-manifest.json", ".github/workflows/release-please.yml"]) {
    assert.equal(existsSync(retired), false, `${retired} belongs to the retired release-please flow`);
  }
  assert.match(read("cliff.toml"), /tag_pattern = "\^v\[0-9\]"/);
  assert.match(read("PklProject"), /version = npmPackage\.version/);
});

test("publishes through npm OIDC without a long-lived token", () => {
  const publish = read(".github/workflows/publish.yml");

  assert.match(publish, /^on:\n  push:\n    tags: \["v\*"\]\n\n/m);
  assert.doesNotMatch(publish, /^  (release|workflow_dispatch|pull_request):/m);
  assert.match(publish, /    permissions:\n      contents: write[^\n]*\n      id-token: write/);
  assert.match(publish, /actions\/setup-node@[a-f0-9]{40} # v6\.4\.0/);
  assert.match(publish, /node-version: "24"/);
  assert.match(publish, /registry-url: "https:\/\/registry\.npmjs\.org"/);
  assert.match(publish, /mizchi\/pkfire@[a-f0-9]{40} # v0\.11\.0/);
  assert.match(publish, /pkl-version: 0\.31\.1/);
  assert.match(publish, /pkl project package --skip-publish-check --output-path dist\/pkl/);
  assert.match(publish, /gh release create pkl --title "Pkl package index" --prerelease/);
  assert.match(publish, /gh release upload pkl dist\/pkl\/\* --clobber/);
  assert.match(publish, /npm install -g npm@11/);
  assert.match(publish, /\*-\*\) npm publish --tag next ;;/);
  assert.match(publish, /gh release create "\$GITHUB_REF_NAME" [^\n]*--notes-file notes\.md/);
  assert.match(publish, /gh release create "\$GITHUB_REF_NAME" [^\n]*--generate-notes/);
  assert.doesNotMatch(publish, /NPM_TOKEN|NODE_AUTH_TOKEN|secrets\.|create-github-app-token|release-please/);
  for (const line of publish.split("\n").filter((line) => /^\s*(- )?uses: /.test(line))) {
    assert.match(line, /uses: [\w./-]+@[a-f0-9]{40} # v\d+\.\d+\.\d+$/, `action is not pinned by commit: ${line.trim()}`);
  }

  const order = [
    'if [ "v$version" != "$GITHUB_REF_NAME" ]; then',
    "pnpm run typecheck",
    "pnpm test",
    "pnpm run package:smoke",
    "pkl project package",
    "npm install -g npm@11",
    "npm publish",
    'gh release create "$GITHUB_REF_NAME"',
  ].map((needle) => [needle, publish.indexOf(needle)]);
  for (const [needle, index] of order) assert.notEqual(index, -1, `missing publish step: ${needle}`);
  assert.deepEqual(order, order.toSorted((left, right) => left[1] - right[1]), "validation precedes npm publish, which precedes the GitHub release");
});

test("tracks release inputs and reviews the package in the fast gate", () => {
  const taskfile = read("Taskfile.pkl");

  assert.match(taskfile, /local projectMetadata: Listing<String>/);
  assert.match(taskfile, /"docs\/\*\*\/\*\.md"/);
  assert.match(taskfile, /"cliff\.toml"/);
  assert.match(taskfile, /"CHANGELOG\.md"/);
  assert.doesNotMatch(taskfile, /release-please/);
  assert.match(taskfile, /name = "package:review"/);
  assert.match(taskfile, /name = "checker:conformance"/);
  assert.match(taskfile, /npm pack --dry-run --json >\/dev\/null/);
  assert.match(taskfile, /checkFast:[\s\S]*?packageReview/);
});

test("builds generated Node modules before fast and formal runtime consumers", () => {
  const taskfile = read("Taskfile.pkl");

  assert.match(taskBlock(taskfile, "test"), /cmd = "node --test"/);
  for (const name of [
    "packageReview",
    "drift",
    "traceVerify",
    "translationVerify",
    "specReadingDogfood",
    "devshellTools",
    "devshellFormal",
  ]) {
    assert.match(taskBlock(taskfile, name), /deps \{[^}]*\bbuild\b[^}]*\}/, `${name} must depend on build`);
  }
});

test("keeps transient test fixtures outside the package root", () => {
  const cliTests = read("test/cli.test.mjs");

  assert.doesNotMatch(cliTests, /join\(root,\s*["']\.tmp-/);
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
