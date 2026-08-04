import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { hostname, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeCounterexamples,
  topLevelCommandRegistry,
  validateGeneratedAlloy,
  validateGeneratedTla,
  verifyGenerated,
  verifyGeneratedReport,
} from "../src/cli.mjs";
import { normalizeCounterexamplesFixtureProjection } from "../scripts/project-normalize-counterexamples-fixture.mjs";
import { verifyGeneratedFixtureProjection } from "../scripts/project-verify-generated-fixture.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(root, "src", "cli.mjs");
const hasLean = spawnSync("which", ["lean"]).status === 0;
const hasTlasany = spawnSync("which", ["tlasany"]).status === 0;
const hasTlc = spawnSync("which", ["tlc"]).status === 0;
const hasAlloy6 = spawnSync("which", ["alloy6"]).status === 0;

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

function runAsync(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });
}

function loadModel(file) {
  const result = spawnSync("pkl", ["eval", "-f", "json", file], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).model;
}

function assertReportFixture(args, fixture, expectedStatus = 0) {
  const result = run(args);
  const expected = readFileSync(join(root, fixture), "utf8");

  assert.equal(result.status, expectedStatus, result.stderr);
  assert.equal(result.stdout, expected);
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

function stableJson(value) {
  return `${JSON.stringify(stableObject(value), null, 2)}\n`;
}

function cliUsageCommands(stdout) {
  return new Set(Array.from(stdout.matchAll(/^  dspec ([a-z][a-z0-9-]*)\b/gm), (match) => match[1]));
}

function specChangeUsageCommands(stdout) {
  return new Set(Array.from(stdout.matchAll(/^  dspec spec-change ([a-z][a-z0-9-]*)\b/gm), (match) => match[1]));
}

function sourceLineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function appendDocumentedCliInvocation(invocations, path, source, raw, index) {
  const normalized = raw.replace(/\\\s*$/, "").replace(/\s+/g, " ").trim();
  if (!normalized) return;
  const args = normalized.split(/\s+/);
  const command = args[0];
  if (!/^[a-z][a-z0-9-]*$/.test(command)) return;
  const subcommand = command === "spec-change" && /^[a-z][a-z0-9-]*$/.test(args[1] ?? "") ? args[1] : undefined;
  invocations.push({
    command,
    index,
    raw: normalized,
    source: `${path}:${sourceLineNumber(source, index)}`,
    subcommand,
  });
}

function appendFencedDspecInvocations(invocations, path, source) {
  for (const block of source.matchAll(/```[^\n]*\n([\s\S]*?)```/g)) {
    const body = block[1];
    const bodyIndex = (block.index ?? 0) + block[0].indexOf(body);
    let offset = 0;
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("dspec ")) {
        appendDocumentedCliInvocation(invocations, path, source, trimmed.slice("dspec ".length), bodyIndex + offset);
      }
      offset += line.length + 1;
    }
  }
}

function documentedCliInvocations(paths) {
  const invocations = [];
  for (const path of paths) {
    const source = readFileSync(join(root, path), "utf8");
    for (const match of source.matchAll(/node\s+(?:\$OLDPWD\/)?src\/cli\.mjs\s+([^`"'|;&)\n]+)/g)) {
      appendDocumentedCliInvocation(invocations, path, source, match[1], match.index ?? 0);
    }
    for (const match of source.matchAll(/`dspec\s+([^`]+)`/g)) {
      appendDocumentedCliInvocation(invocations, path, source, match[1], match.index ?? 0);
    }
    for (const match of source.matchAll(/`spec-change\s+([^`]+)`/g)) {
      appendDocumentedCliInvocation(invocations, path, source, `spec-change ${match[1]}`, match.index ?? 0);
    }
    appendFencedDspecInvocations(invocations, path, source);
  }
  return invocations.sort((left, right) => left.index - right.index);
}

function documentedCliHelpSmokeArgs(invocations) {
  const seen = new Set();
  const smoke = [];
  for (const invocation of invocations) {
    const args =
      invocation.command === "spec-change" && invocation.subcommand && invocation.subcommand !== "help"
        ? ["spec-change", invocation.subcommand, "--help"]
        : [invocation.command, "--help"];
    const key = args.join("\0");
    if (seen.has(key)) continue;
    seen.add(key);
    smoke.push({ args, source: invocation.source, raw: invocation.raw });
  }
  return smoke;
}

function assertProjectedReportFixture(args, fixture, project, expectedStatus = 0) {
  const result = run(args);
  const expected = readFileSync(join(root, fixture), "utf8");

  assert.equal(result.status, expectedStatus, result.stderr);
  assert.equal(stableJson(project(JSON.parse(result.stdout))), expected);
}

function mutationWitnessProjection(report) {
  return report.mutations.map((mutation) => ({
    id: mutation.id,
    category: mutation.category,
    suggestionKind: mutation.suggestionKind,
    status: mutation.status,
    mutation: mutation.mutation,
  }));
}

describe("dspec CLI", () => {
  it("initializes a valid model without overwriting an existing file", () => {
    const directory = mkdtempSync(join(tmpdir(), "dspec-init-"));
    const output = join(directory, "spec", "dspec.pkl");
    try {
      const initialized = run(["init", "--json", "--output", output]);

      assert.equal(initialized.status, 0, initialized.stderr);
      const report = JSON.parse(initialized.stdout);
      assert.equal(report.status, "pass");
      assert.equal(report.output.path, output);
      assert.ok(report.output.lock);
      assert.ok(existsSync(report.output.lock.path));
      const source = readFileSync(output, "utf8");
      const schemaImport = source.match(/^import "(.+)" as d$/m)?.[1];
      assert.ok(schemaImport);
      assert.equal(resolve(dirname(output), schemaImport), join(root, "dspec", "Schema.pkl"));
      const verified = run(["verify", "--json", output]);
      assert.equal(verified.status, 0, verified.stderr);
      assert.equal(JSON.parse(verified.stdout).schemaLock.status, "pass");

      const lock = JSON.parse(readFileSync(report.output.lock.path, "utf8"));
      lock.schema.files[0].digest = `sha256:${"0".repeat(64)}`;
      writeFileSync(report.output.lock.path, stableJson(lock));
      const staleLock = run(["verify", "--json", output]);
      assert.notEqual(staleLock.status, 0);
      assert.equal(JSON.parse(staleLock.stdout).schemaLock.status, "fail");

      const refreshed = run(["lock", "--json", "--force", output]);
      assert.equal(refreshed.status, 0, refreshed.stderr);
      assert.equal(run(["verify", "--json", output]).status, 0);

      const existing = run(["init", "--output", output]);
      assert.notEqual(existing.status, 0);
      assert.match(existing.stderr, /refusing to overwrite existing model/);
      assert.equal(run(["init", "--force", "--output", output]).status, 0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("checks a valid Pkl model", () => {
    const result = run(["check", "examples/rbac.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: app-rbac/);
    assert.match(result.stdout, /4 terms, 3 rules/);
  });

  it("aggregates structural, drift, and coverage gates through verify", () => {
    const passed = run(["verify", "--json", "fixtures/typed-ast.pkl"]);

    assert.equal(passed.status, 0, passed.stderr);
    const report = JSON.parse(passed.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.check.status, "pass");
    assert.equal(report.drift.status, "pass");
    assert.equal(report.coverage.status, "pass");
    assert.equal(report.schemaLock.status, "skip");

    const requiredLock = run(["verify", "--json", "--require-lock", "fixtures/typed-ast.pkl"]);
    assert.notEqual(requiredLock.status, 0);
    assert.equal(JSON.parse(requiredLock.stdout).schemaLock.status, "fail");

    const failed = run(["verify", "--json", "fixtures/invalid-typed-ast.pkl"]);
    assert.notEqual(failed.status, 0);
    const failedReport = JSON.parse(failed.stdout);
    assert.equal(failedReport.status, "fail");
    assert.equal(failedReport.check.status, "fail");
  });

  it("scaffolds a typed draft rule from an existing model vocabulary", () => {
    const directory = mkdtempSync(join(tmpdir(), "dspec-scaffold-rule-"));
    const output = join(directory, "draft-rule.pkl");
    try {
      const scaffolded = run([
        "scaffold",
        "rule",
        "--output",
        output,
        "--kind",
        "invariant",
        "--term",
        "artifact.schema",
        "--implementation",
        "dspec/Schema.pkl#Model",
        "--test",
        "test/cli.test.mjs#checks a valid Pkl model",
        "examples/dspec.pkl",
        "DSPEC-SCAFFOLDED-RULE",
      ]);

      assert.equal(scaffolded.status, 0, scaffolded.stderr);
      const source = readFileSync(output, "utf8");
      assert.match(source, /id = "DSPEC-SCAFFOLDED-RULE"/);
      assert.match(source, /reviewStatus = "draft"/);
      assert.match(source, /d\.nodeCheck\("test\/cli\.test\.mjs#checks a valid Pkl model"\)/);
      assert.equal(spawnSync("pkl", ["eval", output], { cwd: root, encoding: "utf8" }).status, 0);

      const unknownTerm = run(["scaffold", "rule", "--term", "missing.term", "examples/dspec.pkl", "DSPEC-UNKNOWN-TERM"]);
      assert.notEqual(unknownTerm.status, 0);
      assert.match(unknownTerm.stderr, /unknown vocabulary term: missing.term/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("explains verification failures with stable structured diagnostics", () => {
    const result = run(["explain", "--json", "fixtures/invalid-typed-ast.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.equal(report.summary.diagnostics, 1);
    assert.deepEqual(report.diagnostics[0], {
      id: "check:invalid-clause-ast:INVALID-TYPED-AST",
      phase: "check",
      code: "invalid-clause-ast",
      severity: "error",
      ruleId: "INVALID-TYPED-AST",
      message: "invalid expr ast: INVALID-TYPED-AST must[0] eq expects exactly 2 args",
      source: {
        path: "fixtures/invalid-typed-ast.pkl",
        line: 7,
      },
      suggestion: "correct the Clause.ast operator shape for this rule",
    });
  });

  it("locks schema modules imported through a local Pkl dependency", () => {
    const directory = mkdtempSync(join(tmpdir(), "dspec-pkl-dependency-lock-"));
    const lock = join(directory, "consumer.lock.json");
    try {
      const locked = run(["lock", "--json", "--output", lock, "fixtures/pkl-package-consumer/consumer.pkl"]);
      assert.equal(locked.status, 0, locked.stderr);

      const verified = run([
        "verify",
        "--json",
        "--require-lock",
        "--lock",
        lock,
        "fixtures/pkl-package-consumer/consumer.pkl",
      ]);
      assert.equal(verified.status, 0, verified.stderr);
      assert.equal(JSON.parse(verified.stdout).schemaLock.status, "pass");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses domain preset packs for the current RBAC spec", () => {
    const model = loadModel("examples/rbac.pkl");
    const allowRule = model.rules.find((rule) => rule.id === "RBAC-ALLOW");
    const denyRule = model.rules.find((rule) => rule.id === "RBAC-DENY");

    assert.equal(allowRule.must[0].ast.name, "allow");
    assert.deepEqual(allowRule.must[0].ast.args, ["action.view", "screen.admin"]);
    assert.equal(denyRule.mustNot[0].ast.name, "allow");
    assert.deepEqual(denyRule.mustNot[0].ast.args, ["action.view", "screen.admin"]);
  });

  it("rejects duplicate rule ids", () => {
    const result = run(["check", "fixtures/duplicate-rule.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate rule id: RBAC-ALLOW/);
  });

  it("rejects unknown term references", () => {
    const result = run(["check", "fixtures/unknown-reference.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown term reference: RBAC-UNKNOWN-TERM -> missing\.term/);
  });

  it("rejects direct must and mustNot contradictions", () => {
    const result = run(["check", "fixtures/contradiction.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rule has both must and mustNot: RBAC-CONTRADICTION -> same\.expr/);
  });

  it("rejects typed AST must and mustNot contradictions", () => {
    const result = run(["check", "fixtures/typed-ast-contradiction.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /rule has both must and mustNot: TYPED-AST-CONTRADICTION -> atom:allow\(action\.view,screen\.admin\)/);
  });

  it("rejects approved rules without verification targets", () => {
    const result = run(["check", "fixtures/approved-without-target.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /approved rule has no verification target: RBAC-APPROVED-WITHOUT-TARGET/);
  });

  it("rejects a primary locale missing from locales", () => {
    const result = run(["check", "fixtures/primary-locale-missing.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /primary locale is not listed in locales: ja/);
  });

  it("accepts i18n contract coverage", () => {
    const result = run(["check", "fixtures/i18n-contract.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: i18n-contract-fixture/);
    assert.match(result.stdout, /1 terms, 1 rules/);
  });

  it("rejects missing required localized labels", () => {
    const result = run(["check", "fixtures/i18n-contract-missing-label.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing localized label: model\.name\.labels\.en/);
  });

  it("rejects i18n glossary label drift", () => {
    const result = run(["check", "fixtures/i18n-contract-glossary-mismatch.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /i18n glossary label mismatch: term\.product\.en expected "Item", actual "Product"/);
  });

  it("rejects files without top-level model", () => {
    const result = run(["check", "fixtures/missing-model.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing top-level model: fixtures\/missing-model\.pkl/);
  });

  it("accepts opaque Clause.expr text", () => {
    const result = run(["check", "fixtures/opaque-expr.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: app-rbac/);
  });

  it("accepts typed Clause.ast", () => {
    const result = run(["check", "fixtures/typed-ast.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: typed-ast-fixture/);
  });

  it("accepts shorthand authoring helpers", () => {
    const result = run(["check", "fixtures/shorthand-model.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: shorthand-fixture/);
    assert.match(result.stdout, /1 terms, 1 rules/);
  });

  it("accepts domain preset packs", () => {
    const result = run(["check", "fixtures/domain-pack-model.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: domain-pack-fixture/);
    assert.match(result.stdout, /5 terms, 2 rules/);

    const model = loadModel("fixtures/domain-pack-model.pkl");
    assert.deepEqual(
      model.rules.map((rule) => rule.id),
      ["DOMAIN-RBAC-DELETE-ADMIN-ONLY", "DOMAIN-TENANT-NO-CROSS-WORKSPACE"],
    );
    assert.equal(model.rules[0].mustNot[0].ast.name, "allow");
    assert.equal(model.rules[1].must[0].ast.name, "sameTenantScope");
  });

  it("accepts web app domain preset packs", () => {
    const result = run(["check", "fixtures/webapp-domain-pack-model.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: webapp-domain-pack-fixture/);

    const model = loadModel("fixtures/webapp-domain-pack-model.pkl");
    assert.equal(model.rules[0].must[0].ast.name, "routeUsesSchema");
    assert.deepEqual(model.rules[0].must[0].ast.args, ["route.dashboard", "schema.dashboardSnapshot"]);
    assert.equal(model.rules[1].must[0].ast.name, "workflowHasGate");
    assert.deepEqual(model.rules[1].must[0].ast.args, ["workflow.ci", "gate.vrt"]);
  });

  it("accepts domain pack contract registry", () => {
    const result = run(["check", "fixtures/domain-pack-contract.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: domain-pack-contract-fixture/);

    const model = loadModel("fixtures/domain-pack-contract.pkl");
    const webapp = model.domainPacks.find((pack) => pack.id === "webapp");
    assert.ok(webapp);
    assert.deepEqual(
      webapp.helpers.map((helper) => helper.id),
      [
        "webapp.route",
        "webapp.schema",
        "webapp.workflow",
        "webapp.gate",
        "webapp.routeUsesSchema",
        "webapp.workflowHasGate",
      ],
    );
  });

  it("rejects domain pack rule helpers without typed AST contract", () => {
    const result = run(["check", "fixtures/domain-pack-contract-broken.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /domain pack rule helper must emit typed ast: bad\.bad\.ruleHelper/);
  });

  it("detects missing domain pack helper symbols", () => {
    const result = run(["drift", "fixtures/domain-pack-contract-missing-symbol.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing domain pack helper symbol: rbac\.rbac\.missing -> dspec\/domains\/Rbac\.pkl#missingHelper/);
  });

  it("accepts DB model pattern", () => {
    const result = run(["check", "fixtures/db-model.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: db-model-fixture/);
  });

  it("imports SQL schema as DB model JSON", () => {
    const result = run(["import-db-schema", "--json", "fixtures/db-schema.sql"]);

    assert.equal(result.status, 0, result.stderr);
    const imported = JSON.parse(result.stdout);
    assert.deepEqual(
      imported.db.tables.map((table) => table.id),
      ["posts", "users"],
    );
    const posts = imported.db.tables[0];
    assert.deepEqual(posts.primaryKey, ["id"]);
    assert.equal(posts.columns.find((column) => column.id === "id").type, "id");
    assert.equal(posts.columns.find((column) => column.id === "id").nullable, false);
    assert.equal(posts.columns.find((column) => column.id === "slug").unique, true);
    assert.equal(posts.columns.find((column) => column.id === "published").type, "bool");
    assert.equal(posts.columns.find((column) => column.id === "published_at").type, "datetime");
    const users = imported.db.tables[1];
    assert.equal(users.columns.find((column) => column.id === "email").nullable, false);
    assert.equal(users.columns.find((column) => column.id === "email").unique, true);
  });

  it("imports SQL schema as a deterministic Pkl fragment", () => {
    const result = run(["import-db-schema", "fixtures/db-schema.sql"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /tables \{/);
    assert.match(result.stdout, /new d\.DbTable \{/);
    assert.match(result.stdout, /id = "posts"/);
    assert.match(result.stdout, /primaryKey \{\n      "id"\n    \}/);
    assert.match(result.stdout, /new d\.DbColumn \{\n        id = "slug"\n        type = "string"\n        nullable = false\n        unique = true\n      \}/);
    assert.match(result.stdout, /id = "users"/);
  });

  it("checks SQL query catalog against DB model", () => {
    const result = run(["check-sql-queries", "fixtures/db-model.pkl", "fixtures/db-queries.sql"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: db-model-fixture sql queries \(3 queries\)/);
  });

  it("imports real app artifacts as observed facts", () => {
    const result = run(["import-real-app", "--json", "fixtures/sample-webapp-2026"]);

    assert.equal(result.status, 0, result.stderr);
    const imported = JSON.parse(result.stdout);
    assert.equal(imported.app.id, "sample-webapp-2026");
    assert.deepEqual(
      imported.app.routes.map((route) => `${route.method} ${route.path}`),
      ["GET /api/dashboard", "GET /api/health", "GET /api/services/:serviceId"],
    );
    for (const schema of ["dashboardFilterSchema", "dashboardSnapshotSchema", "healthResponseSchema", "serviceDetailSchema"]) {
      assert.ok(imported.app.contracts.schemas.includes(schema), schema);
    }
    const ci = imported.app.workflows.find((workflow) => workflow.id === "ci");
    assert.ok(ci);
    for (const gate of ["e2e", "typecheck", "unit", "vrt"]) {
      assert.ok(ci.gates.includes(gate), gate);
    }
    assert.deepEqual(imported.app.quality.vrt.routes, ["/", "/critical", "/services/payments"]);
    assert.deepEqual(imported.app.quality.flaker.profiles, ["ci", "local", "scheduled"]);
  });

  it("imports real app artifacts as a Pkl fragment", () => {
    const result = run(["import-real-app", "--pkl", "fixtures/sample-webapp-2026"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /new d\.CloudNode \{/);
    assert.match(result.stdout, /id = "api"/);
    assert.match(result.stdout, /new d\.ReleaseGate \{/);
    assert.match(result.stdout, /id = "typecheck"/);
    assert.match(result.stdout, /new d\.DataSet \{/);
    assert.match(result.stdout, /id = "dashboard-snapshot"/);
  });

  it("imports Cloudflare and Pulumi infrastructure from a second real app holdout", () => {
    const result = run(["import-real-app", "--json", "fixtures/holdout-mnemo-app"]);

    assert.equal(result.status, 0, result.stderr);
    const imported = JSON.parse(result.stdout);
    assert.equal(imported.app.contracts.path, null);
    assert.deepEqual(
      imported.app.infrastructure.sources.map((source) => `${source.kind}:${source.path}`),
      [
        "pulumi:mnemo-server/infra/pulumi/index.ts",
        "wrangler:mnemo-server/wrangler.e2e.jsonc",
        "wrangler:mnemo-server/wrangler.jsonc",
      ],
    );
    assert.deepEqual(
      imported.app.infrastructure.environments.map((environment) => environment.id),
      ["e2e", "production", "staging"],
    );
    const resourceIds = imported.app.infrastructure.resources.map((resource) => resource.id);
    for (const id of [
      "production/mnemo",
      "production/db",
      "production/skill-assets",
      "e2e/mnemo-e2e",
      "e2e/db",
      "staging/mnemo-staging",
      "staging/db",
      "staging/skill-index",
      "pulumi/mnemo-v1-api",
      "pulumi/mnemo-platform-db",
    ]) {
      assert.ok(resourceIds.includes(id), id);
    }
    assert.ok(!resourceIds.some((id) => id.includes("vendored")));
    assert.deepEqual(
      imported.app.infrastructure.schedules.map((schedule) => schedule.id),
      ["production/0-star-star-star-star"],
    );
  });

  it("evaluates real app importer precision and recall against typed gold facts", () => {
    const result = run([
      "evaluate-real-app-import",
      "--json",
      "fixtures/import-real-app-eval-mnemo.pkl",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.summary, {
      expected: 32,
      observed: 32,
      matched: 32,
      missing: 0,
      unexpected: 0,
      precision: 1,
      recall: 1,
    });
    assert.deepEqual(report.missing, []);
    assert.deepEqual(report.unexpected, []);
  });

  it("keeps the external real app import evaluation report in sync", () => {
    assertReportFixture(
      ["evaluate-real-app-import", "--json", "fixtures/import-real-app-eval-mnemo.pkl"],
      "fixtures/reports/evaluate-real-app-import-mnemo.json",
    );
  });

  it("imports Terraform plans and Kubernetes manifests as infrastructure facts", () => {
    const result = run(["import-real-app", "--json", "fixtures/holdout-iac-app"]);

    assert.equal(result.status, 0, result.stderr);
    const infrastructure = JSON.parse(result.stdout).app.infrastructure;
    assert.deepEqual(
      infrastructure.sources.map((source) => `${source.kind}:${source.path}`),
      [
        "kubernetes:infra/k8s/payments.yaml",
        "terraform-plan:infra/terraform-plan.json",
      ],
    );
    assert.deepEqual(
      infrastructure.environments.map((environment) => environment.id),
      ["kubernetes/production", "production"],
    );
    const byId = new Map(infrastructure.resources.map((resource) => [resource.id, resource]));
    assert.equal(byId.get("terraform/aws_db_instance.primary")?.kind, "database");
    assert.equal(byId.get("terraform/aws_s3_bucket.assets")?.kind, "bucket");
    assert.equal(byId.get("terraform/module.queue.aws_sqs_queue.jobs")?.kind, "queue");
    assert.equal(byId.get("kubernetes/production/deployment/payments-api")?.kind, "service");
    assert.equal(byId.get("kubernetes/production/secret/payments-api-secrets")?.kind, "secret");
    assert.deepEqual(
      infrastructure.schedules.map((schedule) => schedule.id),
      ["kubernetes/production/nightly-reconcile"],
    );
  });

  it("evaluates Terraform and Kubernetes importer coverage", () => {
    const result = run([
      "evaluate-real-app-import",
      "--json",
      "fixtures/import-real-app-eval-iac.pkl",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.summary, {
      expected: 12,
      observed: 12,
      matched: 12,
      missing: 0,
      unexpected: 0,
      precision: 1,
      recall: 1,
    });
  });

  it("keeps the Terraform and Kubernetes import evaluation report in sync", () => {
    assertReportFixture(
      ["evaluate-real-app-import", "--json", "fixtures/import-real-app-eval-iac.pkl"],
      "fixtures/reports/evaluate-real-app-import-iac.json",
    );
  });

  it("evaluates the external holdout corpus with provenance and recorded IaC changes", () => {
    const result = run(["evaluate-external-holdouts", "--json", "fixtures/external-holdout-real-app-import.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.summary.holdouts, {
      total: 3,
      passed: 3,
      expected: 59,
      observed: 59,
      matched: 59,
      missing: 0,
      unexpected: 0,
      precision: 1,
      recall: 1,
      estimatedAuthoringMinutes: 95,
      manualMappings: 0,
      exclusions: 4,
    });
    assert.deepEqual(report.summary.mutations, {
      total: 1,
      detected: 1,
      missed: 0,
      detectionRate: 1,
      added: 8,
      removed: 0,
    });
    assert.deepEqual(report.mutations[0].added, [
      { kind: "infrastructure-environment", id: "staging" },
      { kind: "infrastructure-resource", id: "staging/ai" },
      { kind: "infrastructure-resource", id: "staging/db" },
      { kind: "infrastructure-resource", id: "staging/db-shard-00" },
      { kind: "infrastructure-resource", id: "staging/db-shard-01" },
      { kind: "infrastructure-resource", id: "staging/mnemo-staging" },
      { kind: "infrastructure-resource", id: "staging/skill-assets" },
      { kind: "infrastructure-resource", id: "staging/skill-index" },
    ]);
    assert.deepEqual(report.mutations[0].removed, []);
  });

  it("keeps the external holdout corpus report in sync", () => {
    assertReportFixture(
      ["evaluate-external-holdouts", "--json", "fixtures/external-holdout-real-app-import.pkl"],
      "fixtures/reports/evaluate-external-holdouts.json",
    );
  });

  it("projects imported IaC into domain patterns without inventing guarantees", () => {
    const iac = run(["import-real-app", "--pkl", "fixtures/holdout-iac-app"]);
    assert.equal(iac.status, 0, iac.stderr);
    assert.match(
      iac.stdout,
      /new d\.CloudNode \{\n        id = "terraform\/aws_db_instance\.primary"\n        kind = "database"/,
    );
    assert.match(
      iac.stdout,
      /new d\.DataStore \{\n        id = "terraform\/aws_db_instance\.primary"\n        region = "production"\n        encrypted = false\n        deletionSupported = false/,
    );
    assert.match(
      iac.stdout,
      /new d\.RuntimeService \{\n        id = "kubernetes\/production\/deployment\/payments-api"/,
    );

    const mnemo = run(["import-real-app", "--pkl", "fixtures/holdout-mnemo-app"]);
    assert.equal(mnemo.status, 0, mnemo.stderr);
    assert.match(mnemo.stdout, /id = "production\/mnemo\/to\/production\/db"/);
    assert.match(mnemo.stdout, /from = "production\/mnemo"/);
    assert.match(mnemo.stdout, /to = "production\/db"/);

    const dir = mkdtempSync(join(root, "fixtures", ".tmp-iac-import-"));
    try {
      const modelPath = join(dir, "model.pkl");
      writeFileSync(
        modelPath,
        `import "../../dspec/Schema.pkl" as d\nimport "../../examples/rbac.pkl" as base\n\nmodel: d.Model = (base.model) {\n${iac.stdout}}\n`,
      );
      const evaluated = spawnSync("pkl", ["eval", modelPath], { cwd: root, encoding: "utf8" });
      assert.equal(evaluated.status, 0, evaluated.stderr);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("keeps real app import fixture in sync", () => {
    assertReportFixture(
      ["import-real-app", "--json", "fixtures/sample-webapp-2026"],
      "fixtures/reports/import-real-app-sample-webapp.json",
    );
  });

  it("reconciles a real app model with imported facts", () => {
    const imported = run(["import-real-app", "--json", "fixtures/sample-webapp-2026"]);
    assert.equal(imported.status, 0, imported.stderr);

    const dir = mkdtempSync(join(tmpdir(), "dspec-real-app-observed-"));
    try {
      const observedPath = join(dir, "observed.json");
      writeFileSync(observedPath, imported.stdout);

      const result = run(["reconcile-real-app", "--json", "examples/sample-webapp-2026.pkl", observedPath]);

      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "pass");
      assert.equal(report.covered, report.total);
      assert.deepEqual(report.errors, []);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("keeps real app reconciliation fixture in sync", () => {
    assertReportFixture(
      [
        "reconcile-real-app",
        "--json",
        "examples/sample-webapp-2026.pkl",
        "fixtures/reports/import-real-app-sample-webapp.json",
      ],
      "fixtures/reports/reconcile-real-app-sample-webapp.json",
    );
  });

  it("reports real app reconciliation drift", () => {
    const imported = run(["import-real-app", "--json", "fixtures/sample-webapp-2026"]);
    assert.equal(imported.status, 0, imported.stderr);

    const observed = JSON.parse(imported.stdout);
    observed.app.workflows = observed.app.workflows.map((workflow) =>
      workflow.id === "ci" ? { ...workflow, gates: workflow.gates.filter((gate) => gate !== "vrt") } : workflow,
    );

    const dir = mkdtempSync(join(tmpdir(), "dspec-real-app-observed-broken-"));
    try {
      const observedPath = join(dir, "observed.json");
      writeFileSync(observedPath, JSON.stringify(observed, null, 2));

      const result = run(["reconcile-real-app", "--json", "examples/sample-webapp-2026.pkl", observedPath]);

      assert.notEqual(result.status, 0);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "fail");
      assert.ok(report.errors.some((error) => error.includes("missing observed release gate: ci -> vrt")));
      assert.ok(
        report.suggestions.some((suggestion) =>
          suggestion.kind === "implementation-missing" &&
          suggestion.action === "restore-observed-fact" &&
          suggestion.message.includes('Restore release gate "vrt" on release step "ci"')
        ),
      );
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("reports reverse coverage for observed real app facts", () => {
    const imported = run(["import-real-app", "--json", "fixtures/sample-webapp-2026"]);
    assert.equal(imported.status, 0, imported.stderr);

    const dir = mkdtempSync(join(tmpdir(), "dspec-reverse-coverage-"));
    try {
      const observedPath = join(dir, "observed.json");
      writeFileSync(observedPath, imported.stdout);

      const result = run(["reverse-coverage", "--json", "examples/sample-webapp-2026.pkl", observedPath]);

      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "pass");
      assert.equal(report.covered, report.total);
      assert.deepEqual(report.uncovered, []);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("keeps reverse coverage JSON report fixture in sync", () => {
    assertReportFixture(
      [
        "reverse-coverage",
        "--json",
        "examples/sample-webapp-2026.pkl",
        "fixtures/reports/import-real-app-sample-webapp.json",
      ],
      "fixtures/reports/reverse-coverage-sample-webapp.json",
    );
  });

  it("reports unmodeled observed real app facts", () => {
    const imported = run(["import-real-app", "--json", "fixtures/sample-webapp-2026"]);
    assert.equal(imported.status, 0, imported.stderr);

    const observed = JSON.parse(imported.stdout);
    observed.app.workflows = observed.app.workflows.map((workflow) =>
      workflow.id === "ci" ? { ...workflow, gates: [...workflow.gates, "security"] } : workflow,
    );

    const dir = mkdtempSync(join(tmpdir(), "dspec-reverse-coverage-broken-"));
    try {
      const observedPath = join(dir, "observed.json");
      writeFileSync(observedPath, JSON.stringify(observed, null, 2));

      const result = run(["reverse-coverage", "--json", "examples/sample-webapp-2026.pkl", observedPath]);

      assert.notEqual(result.status, 0);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "fail");
      assert.ok(report.uncovered.some((entry) => entry.kind === "release.gate" && entry.id === "security"));
      assert.ok(report.errors.some((error) => error.includes("unmodeled observed fact: release.gate security")));
      assert.ok(
        report.suggestions.some((suggestion) =>
          suggestion.kind === "spec-missing" &&
          suggestion.action === "model-observed-fact" &&
          suggestion.message.includes('Model observed release.gate "security"')
        ),
      );
      assert.ok(
        report.uncovered.some((entry) =>
          entry.kind === "release.gate" &&
          entry.id === "security" &&
          entry.suggestion?.kind === "spec-missing"
        ),
      );
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("renders real app drift suggestions for CLI readers", () => {
    const imported = run(["import-real-app", "--json", "fixtures/sample-webapp-2026"]);
    assert.equal(imported.status, 0, imported.stderr);

    const observed = JSON.parse(imported.stdout);
    observed.app.workflows = observed.app.workflows.map((workflow) =>
      workflow.id === "ci" ? { ...workflow, gates: workflow.gates.filter((gate) => gate !== "vrt") } : workflow,
    );

    const dir = mkdtempSync(join(tmpdir(), "dspec-real-app-drift-ux-"));
    try {
      const observedPath = join(dir, "observed.json");
      writeFileSync(observedPath, JSON.stringify(observed, null, 2));

      const result = run(["reconcile-real-app", "examples/sample-webapp-2026.pkl", observedPath]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /missing observed release gate: ci -> vrt/);
      assert.match(result.stderr, /suggestion: Restore release gate "vrt" on release step "ci"/);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("checks app profiles as a dogfood bundle", () => {
    const result = run(["check-app-profile", "--json", "fixtures/sample-webapp-profile.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.profile.id, "sample-webapp-2026");
    assert.deepEqual(
      report.checks.map((check) => check.id),
      [
        "check",
        "drift",
        "domain-coverage",
        "import-real-app",
        "observed-fixture",
        "reconcile-real-app",
        "reverse-coverage",
      ],
    );
    assert.ok(report.checks.every((check) => check.status === "pass"));
  });

  it("checks multiple app profiles as an aggregate bundle", () => {
    const result = run([
      "check-app-profile",
      "--json",
      "fixtures/sample-webapp-profile.pkl",
      "fixtures/sample-webapp-profile.pkl",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.passed, 2);
    assert.equal(report.total, 2);
    assert.equal(report.profiles.length, 2);
    assert.ok(report.profiles.every((entry) => entry.profile.id === "sample-webapp-2026"));
  });

  it("checks app profile suites from a registry", () => {
    const result = run(["check-app-profile-suite", "--json", "fixtures/sample-webapp-profile-suite.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.suite.id, "sample-webapp-suite");
    assert.deepEqual(report.suite.profiles, [
      "fixtures/sample-webapp-profile.pkl",
      "fixtures/sample-webapp-profile-scenarios.pkl",
    ]);
    assert.equal(report.passed, 2);
    assert.equal(report.total, 2);
    assert.equal(report.profiles.length, 2);
  });

  it("renders app profile reports as markdown", () => {
    const result = run(["check-app-profile", "--markdown", "fixtures/sample-webapp-profile.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^# App Profile sample-webapp-2026/m);
    assert.match(result.stdout, /\| Gate \| Status \| Errors \|/);
    assert.match(result.stdout, /\| check \| pass \|  \|/);
    assert.match(result.stdout, /\| reverse-coverage \| pass \|  \|/);
  });

  it("scaffolds app profiles for AI authoring", () => {
    const result = run([
      "scaffold-app-profile",
      "--observed-facts",
      "fixtures/reports/import-real-app-sample-webapp.json",
      "examples/sample-webapp-2026.pkl",
      "fixtures/sample-webapp-2026",
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /import "\.\/dspec\/Schema\.pkl" as d/);
    assert.match(result.stdout, /profile: d\.AppProfile = new/);
    assert.match(result.stdout, /id = "sample-webapp-2026"/);
    assert.match(result.stdout, /modelPath = "examples\/sample-webapp-2026\.pkl"/);
    assert.match(result.stdout, /observedFacts = "fixtures\/reports\/import-real-app-sample-webapp\.json"/);
    assert.match(result.stdout, /"reconcile-real-app"/);
    assert.match(result.stdout, /"reverse-coverage"/);
  });

  it("checks scaffolded app profiles after saving them", () => {
    const profilePath = join(root, ".tmp-scaffolded-app-profile.pkl");
    try {
      const scaffold = run([
        "scaffold-app-profile",
        "--observed-facts",
        "fixtures/reports/import-real-app-sample-webapp.json",
        "examples/sample-webapp-2026.pkl",
        "fixtures/sample-webapp-2026",
      ]);
      assert.equal(scaffold.status, 0, scaffold.stderr);
      writeFileSync(profilePath, scaffold.stdout);

      const result = run(["check-app-profile", "--json", profilePath]);

      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "pass");
      assert.equal(report.profile.id, "sample-webapp-2026");
    } finally {
      rmSync(profilePath, { force: true });
    }
  });

  it("diffs scaffolded app profiles against existing profiles", () => {
    const result = run([
      "scaffold-app-profile",
      "--diff",
      "fixtures/sample-webapp-profile.pkl",
      "--json",
      "--observed-facts",
      "fixtures/reports/import-real-app-sample-webapp.json",
      "examples/sample-webapp-2026.pkl",
      "fixtures/sample-webapp-2026",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.profile.id, "sample-webapp-2026");
    assert.deepEqual(report.changes, []);
  });

  it("reports scaffolded profile drift as JSON", () => {
    const dir = mkdtempSync(join(root, "fixtures", ".tmp-app-profile-diff-"));
    try {
      const profilePath = join(dir, "profile.pkl");
      writeFileSync(profilePath, `import "../../dspec/Schema.pkl" as d

profile: d.AppProfile = new {
  id = "sample-webapp-2026"
  modelPath = "examples/sample-webapp-2026.pkl"
  appRoot = "fixtures/sample-webapp-2026"
  observedFacts = "fixtures/reports/stale-import-real-app.json"
  gates {
    "check"
  }
}
`);

      const result = run([
        "scaffold-app-profile",
        "--diff",
        profilePath,
        "--json",
        "--observed-facts",
        "fixtures/reports/import-real-app-sample-webapp.json",
        "examples/sample-webapp-2026.pkl",
        "fixtures/sample-webapp-2026",
      ]);

      assert.notEqual(result.status, 0);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "fail");
      assert.equal(report.profile.id, "sample-webapp-2026");
      assert.ok(report.changes.some((change) => change.field === "observedFacts"));
      assert.ok(report.changes.some((change) => change.field === "gates"));
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("applies scaffolded app profile updates safely", () => {
    const dir = mkdtempSync(join(root, "fixtures", ".tmp-app-profile-apply-"));
    try {
      const profilePath = join(dir, "profile.pkl");
      const stale = `import "../../dspec/Schema.pkl" as d

profile: d.AppProfile = new {
  id = "sample-webapp-2026"
  modelPath = "examples/sample-webapp-2026.pkl"
  appRoot = "fixtures/sample-webapp-2026"
  observedFacts = "fixtures/reports/stale-import-real-app.json"
  gates {
    "check"
  }
}
`;
      writeFileSync(profilePath, stale);

      const preview = run([
        "scaffold-app-profile",
        "--apply",
        profilePath,
        "--json",
        "--dry-run",
        "--observed-facts",
        "fixtures/reports/import-real-app-sample-webapp.json",
        "examples/sample-webapp-2026.pkl",
        "fixtures/sample-webapp-2026",
      ]);

      assert.notEqual(preview.status, 0);
      const previewReport = JSON.parse(preview.stdout);
      assert.equal(previewReport.status, "fail");
      assert.equal(previewReport.wouldApply, true);
      assert.equal(readFileSync(profilePath, "utf8"), stale);

      const applied = run([
        "scaffold-app-profile",
        "--apply",
        profilePath,
        "--json",
        "--observed-facts",
        "fixtures/reports/import-real-app-sample-webapp.json",
        "examples/sample-webapp-2026.pkl",
        "fixtures/sample-webapp-2026",
      ]);

      assert.equal(applied.status, 0, applied.stderr);
      const appliedReport = JSON.parse(applied.stdout);
      assert.equal(appliedReport.status, "pass");
      assert.equal(appliedReport.applied, true);
      assert.match(readFileSync(profilePath, "utf8"), /import "\.\.\/\.\.\/dspec\/Schema\.pkl" as d/);

      const checked = run(["check-app-profile", "--json", profilePath]);
      assert.equal(checked.status, 0, checked.stderr);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("keeps scaffolded app profile diff JSON report fixture in sync", () => {
    assertReportFixture(
      [
        "scaffold-app-profile",
        "--diff",
        "fixtures/sample-webapp-profile.pkl",
        "--json",
        "--observed-facts",
        "fixtures/reports/import-real-app-sample-webapp.json",
        "examples/sample-webapp-2026.pkl",
        "fixtures/sample-webapp-2026",
      ],
      "fixtures/reports/scaffold-app-profile-diff.json",
    );
  });

  it("evaluates app profile false-positive and false-negative guards", () => {
    const result = run(["evaluate-app-profile", "--json", "fixtures/sample-webapp-profile.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.passed, 3);
    assert.equal(report.total, 3);
    assert.deepEqual(
      report.scenarios.map((scenario) => scenario.id),
      ["baseline-no-drift", "remove-required-release-gate", "add-unmodeled-release-gate"],
    );
    assert.equal(report.scenarios[0].guard, "false-positive");
    assert.equal(report.scenarios[0].actual, "pass");
    assert.equal(report.scenarios[1].guard, "false-negative");
    assert.equal(report.scenarios[1].actual, "fail");
    assert.equal(report.scenarios[1].detectedSuggestionKind, "implementation-missing");
    assert.equal(report.scenarios[2].guard, "false-negative");
    assert.equal(report.scenarios[2].actual, "fail");
    assert.equal(report.scenarios[2].detectedSuggestionKind, "spec-missing");
  });

  it("evaluates declared app profile scenarios", () => {
    const result = run(["evaluate-app-profile", "--json", "fixtures/sample-webapp-profile-scenarios.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.profile.id, "sample-webapp-2026-scenarios");
    assert.deepEqual(
      report.scenarios.map((scenario) => scenario.id),
      ["baseline", "ci-missing-vrt", "ci-add-security"],
    );
    assert.equal(report.scenarios[0].guard, "false-positive");
    assert.equal(report.scenarios[0].actual, "pass");
    assert.equal(report.scenarios[1].guard, "false-negative");
    assert.equal(report.scenarios[1].actual, "fail");
    assert.equal(report.scenarios[1].detectedSuggestionKind, "implementation-missing");
    assert.deepEqual(report.scenarios[1].mutation, { removedGate: "vrt", step: "ci" });
    assert.equal(report.scenarios[2].guard, "false-negative");
    assert.equal(report.scenarios[2].actual, "fail");
    assert.equal(report.scenarios[2].detectedSuggestionKind, "spec-missing");
    assert.deepEqual(report.scenarios[2].mutation, { addedGate: "security", workflow: "ci" });
  });

  it("evaluates extended app profile scenario patterns", () => {
    const result = run(["evaluate-app-profile", "--json", "fixtures/sample-webapp-profile-extended-scenarios.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(
      report.scenarios.map((scenario) => scenario.id),
      [
        "baseline",
        "release-gate-missing-vrt",
        "release-gate-add-security",
        "route-missing-dashboard",
        "route-add-admin",
        "schema-missing-dashboard-snapshot",
        "schema-add-audit-log",
        "workflow-missing-weekly-review",
        "workflow-add-nightly",
        "store-missing-flaker-duckdb",
        "store-add-audit-log",
        "dependency-missing-dashboard-api",
        "dependency-add-worker-api",
      ],
    );
    assert.ok(report.scenarios.filter((scenario) => scenario.detectedSuggestionKind === "implementation-missing").length >= 5);
    assert.ok(report.scenarios.filter((scenario) => scenario.detectedSuggestionKind === "spec-missing").length >= 5);
  });

  it("renders app profile evaluation reports as markdown", () => {
    const result = run(["evaluate-app-profile", "--markdown", "fixtures/sample-webapp-profile-extended-scenarios.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^# App Profile Evaluation sample-webapp-2026-extended-scenarios/m);
    assert.match(result.stdout, /\| Scenario \| Kind \| Guard \| Expected \| Actual \| Status \| Suggestion Kind \| Mutation \| Errors \|/);
    assert.match(result.stdout, /\| route-add-admin \| add-observed-route \| false-negative \| fail \| fail \| pass \| spec-missing \| \{"addedRoute":"\/api\/admin"\} \|/);
  });

  it("reports app profile scenario coverage", () => {
    const result = run(["coverage-app-profile-scenarios", "--json", "fixtures/sample-webapp-profile-extended-scenarios.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.profile.id, "sample-webapp-2026-extended-scenarios");
    assert.ok(report.requirements.some((requirement) =>
      requirement.gate === "reconcile-real-app" &&
      requirement.guard === "false-negative" &&
      requirement.suggestionKind === "implementation-missing" &&
      requirement.status === "pass"
    ));
    assert.ok(report.requirements.some((requirement) =>
      requirement.gate === "reverse-coverage" &&
      requirement.guard === "false-negative" &&
      requirement.suggestionKind === "spec-missing" &&
      requirement.status === "pass"
    ));
    assert.deepEqual(
      report.requirements
        .filter((requirement) => requirement.scope === "category" && requirement.status === "pass")
        .map((requirement) => `${requirement.category}:${requirement.suggestionKind}`)
        .sort(),
      [
        "contract-schema:implementation-missing",
        "contract-schema:spec-missing",
        "data-store:implementation-missing",
        "data-store:spec-missing",
        "release-gate:implementation-missing",
        "release-gate:spec-missing",
        "route:implementation-missing",
        "route:spec-missing",
        "runtime-dependency:implementation-missing",
        "runtime-dependency:spec-missing",
        "workflow:implementation-missing",
        "workflow:spec-missing",
      ],
    );
  });

  it("scopes app profile scenario coverage to required categories", () => {
    const result = run(["coverage-app-profile-scenarios", "--json", "fixtures/sample-webapp-profile-route-scenarios.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.inferredCategories, ["route"]);
    assert.deepEqual(report.requiredCategories, ["route"]);
    assert.equal(report.covered, 3);
    assert.equal(report.total, 3);
    assert.deepEqual(
      report.requirements
        .filter((requirement) => requirement.scope === "category")
        .map((requirement) => `${requirement.category}:${requirement.suggestionKind}`)
        .sort(),
      [
        "route:implementation-missing",
        "route:spec-missing",
      ],
    );
  });

  it("rejects missing required app profile scenario category coverage", () => {
    const result = run(["coverage-app-profile-scenarios", "--json", "fixtures/sample-webapp-profile-route-missing-spec-scenario.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.match(result.stderr, /missing app profile scenario coverage: category route false-negative spec-missing/);
    assert.ok(report.requirements.some((requirement) =>
      requirement.scope === "category" &&
      requirement.category === "route" &&
      requirement.suggestionKind === "spec-missing" &&
      requirement.status === "fail"
    ));
  });

  it("rejects underdeclared app profile scenario categories inferred from the model and observed app", () => {
    const result = run(["coverage-app-profile-scenarios", "--json", "fixtures/sample-webapp-profile-underdeclared-categories.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.deepEqual(report.requiredCategories, ["route"]);
    assert.ok(report.inferredCategories.includes("contract-schema"));
    assert.ok(report.inferredCategories.includes("release-gate"));
    assert.match(result.stderr, /missing inferred app profile scenario category: contract-schema/);
  });

  it("does not count ineffective app profile scenarios as scenario coverage", () => {
    const result = run(["coverage-app-profile-scenarios", "--json", "fixtures/sample-webapp-profile-route-ineffective-scenario.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.ok(report.scenarios.some((scenario) =>
      scenario.id === "route-add-existing-ping" &&
      scenario.actual === "pass" &&
      scenario.status === "fail"
    ));
    assert.ok(report.requirements.some((requirement) =>
      requirement.scope === "category" &&
      requirement.category === "route" &&
      requirement.suggestionKind === "spec-missing" &&
      requirement.status === "fail"
    ));
  });

  it("scores generated app profile mutations", () => {
    const result = run(["score-app-profile-mutations", "--json", "fixtures/sample-webapp-profile-extended-scenarios.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.generated, 12);
    assert.equal(report.detected, 12);
    assert.equal(report.missed, 0);
    assert.equal(report.score, 1);
    assert.deepEqual(report.categories, [
      "release-gate",
      "route",
      "contract-schema",
      "workflow",
      "data-store",
      "runtime-dependency",
    ]);
    assert.ok(report.mutations.every((mutation) => mutation.status === "pass"));
    assert.ok(report.mutations.every((mutation) => Array.isArray(mutation.shrinks)));
  });

  it("scores generated app profile mutations for route-only profiles", () => {
    const result = run(["score-app-profile-mutations", "--json", "fixtures/sample-webapp-profile-route-scenarios.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.categories, ["route"]);
    assert.equal(report.generated, 2);
    assert.equal(report.detected, 2);
    assert.equal(report.score, 1);
    assert.deepEqual(
      report.mutations.map((mutation) => `${mutation.category}:${mutation.suggestionKind}`),
      ["route:implementation-missing", "route:spec-missing"],
    );
  });

  it("scores generated app profile mutations on holdout fixtures", () => {
    const cases = [
      ["fixtures/holdout-schema-profile.pkl", ["contract-schema"], 2],
      ["fixtures/holdout-workflow-profile.pkl", ["workflow"], 2],
      ["fixtures/holdout-mixed-profile.pkl", ["route", "contract-schema", "workflow"], 6],
    ];

    for (const [file, categories, generated] of cases) {
      const result = run(["score-app-profile-mutations", "--json", file]);

      assert.equal(result.status, 0, `${file}\n${result.stderr}`);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "pass", file);
      assert.deepEqual(report.categories, categories, file);
      assert.equal(report.generated, generated, file);
      assert.equal(report.detected, generated, file);
      assert.equal(report.score, 1, file);
    }
  });

  it("keeps generated app profile mutation witnesses stable under metamorphic app changes", () => {
    const base = run(["score-app-profile-mutations", "--json", "fixtures/holdout-mixed-profile.pkl"]);
    const shuffled = run(["score-app-profile-mutations", "--json", "fixtures/holdout-mixed-shuffled-profile.pkl"]);
    const noisy = run(["score-app-profile-mutations", "--json", "fixtures/holdout-mixed-noisy-profile.pkl"]);

    assert.equal(base.status, 0, base.stderr);
    assert.equal(shuffled.status, 0, shuffled.stderr);
    assert.equal(noisy.status, 0, noisy.stderr);

    const baseProjection = mutationWitnessProjection(JSON.parse(base.stdout));
    assert.deepEqual(mutationWitnessProjection(JSON.parse(shuffled.stdout)), baseProjection);
    assert.deepEqual(mutationWitnessProjection(JSON.parse(noisy.stdout)), baseProjection);
  });

  it("replays real app change corpus labels", () => {
    const result = run(["replay-app-profile-changes", "--json", "fixtures/app-change-replay-corpus.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.passed, 3);
    assert.equal(report.total, 3);
    assert.deepEqual(
      report.cases.map((entry) => `${entry.id}:${entry.expected}:${entry.actual}:${entry.status}`),
      [
        "compatible-order-only-change:no-drift:no-drift:pass",
        "implementation-removed-modeled-surface:implementation-missing:implementation-missing:pass",
        "implementation-added-unmodeled-surface:spec-missing:spec-missing:pass",
      ],
    );
    assert.ok(report.cases[1].changes.some((change) =>
      change.kind === "route" &&
      change.id === "/api/orders" &&
      change.change === "removed" &&
      change.suggestionKind === "implementation-missing"
    ));
    assert.ok(report.cases[2].changes.some((change) =>
      change.kind === "route" &&
      change.id === "/api/audit" &&
      change.change === "added" &&
      change.suggestionKind === "spec-missing"
    ));
  });

  it("renders app change replay corpus as markdown", () => {
    const result = run(["replay-app-profile-changes", "--markdown", "fixtures/app-change-replay-corpus.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^# App Change Replay Corpus app-change-replay-corpus/m);
    assert.match(result.stdout, /\| Case \| Expected \| Actual \| Status \| Changes \| Errors \|/);
    assert.match(result.stdout, /implementation-removed-modeled-surface/);
  });

  it("keeps app change replay JSON report fixture in sync", () => {
    assertReportFixture(
      ["replay-app-profile-changes", "--json", "fixtures/app-change-replay-corpus.pkl"],
      "fixtures/reports/replay-app-profile-changes.json",
    );
  });

  it("evaluates spec reading gold sets", () => {
    const result = run(["spec-reading-eval", "--json", "fixtures/spec-reading-eval-sample-webapp.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.eval.id, "sample-webapp-reading-eval");
    assert.equal(report.eval.modelPath, "../examples/sample-webapp-2026.pkl");
    assert.equal(report.eval.locale, "ja");
    assert.equal(report.eval.rubricVersion, "spec-reading-rubric-v1");
    assert.match(report.eval.digest, /^sha256:[a-f0-9]{64}$/);
    assert.match(report.eval.modelDigest, /^sha256:[a-f0-9]{64}$/);
    assert.match(report.eval.inputDigest, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(report.summary, {
      cases: 7,
      entailed: 3,
      contradicted: 3,
      notSupported: 1,
    });
    assert.deepEqual(
      report.cases.map((entry) => `${entry.id}:${entry.expected}:${entry.status}`),
      [
        "cloud-topology:entailed:pass",
        "runtime-slo:entailed:pass",
        "ci-weekly-review:entailed:pass",
        "database-primary-store:contradicted:pass",
        "payment-release-gate:contradicted:pass",
        "latency-budget:contradicted:pass",
        "slo-owner:not-supported:pass",
      ],
    );
  });

  it("runs typed implementation conformance against Clause.ast reference semantics", () => {
    const result = run(["conformance", "--json", "fixtures/conformance-webapp.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.summary, { targets: 1, passed: 1, failed: 0, cases: 3, passedCases: 3, failedCases: 0 });
    assert.equal(report.targets[0].implementation.symbol, "isAllowed");
  });

  it("reports the smallest declared conformance counterexample", () => {
    const result = run(["conformance", "--json", "fixtures/conformance-webapp-broken.pkl"]);

    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.equal(report.targets[0].counterexample.caseId, "minimal-input");
    assert.equal(report.targets[0].counterexample.expected, true);
    assert.equal(report.targets[0].counterexample.actual, false);
  });

  it("keeps the conformance JSON report fixture in sync", () => {
    assertReportFixture(
      ["conformance", "--json", "fixtures/conformance-webapp.pkl"],
      "fixtures/reports/conformance-webapp.json",
    );
  });

  it("queries localized claims and verifies an evidence-grounded answer", () => {
    const result = run([
      "query",
      "--json",
      "--locale",
      "ja",
      "--answer",
      "fixtures/spec-query-answer-valid.json",
      "fixtures/conformance-webapp.pkl",
      "rule",
      "WEBAPP-ACCESS-CONFORMANCE",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.classification, "entailed");
    assert.equal(report.result.text, "許可された主体だけがアクセスできる");
    assert.equal(report.answer.status, "pass");
    assert.deepEqual(report.answer.evidence, ["rule:WEBAPP-ACCESS-CONFORMANCE", "clause:WEBAPP-ACCESS-CONFORMANCE#must[0]"]);
  });

  it("keeps unsupported query evidence from being accepted as an answer", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-query-answer-"));
    try {
      const answer = join(dir, "invalid.json");
      writeFileSync(answer, JSON.stringify({ classification: "entailed", evidence: ["rule:DOES-NOT-EXIST"] }));
      const result = run([
        "query",
        "--json",
        "--answer",
        answer,
        "fixtures/conformance-webapp.pkl",
        "rule",
        "WEBAPP-ACCESS-CONFORMANCE",
      ]);

      assert.equal(result.status, 1);
      const report = JSON.parse(result.stdout);
      assert.equal(report.answer.status, "fail");
      assert.match(report.answer.errors[0], /does not resolve/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("renders deterministic Markdown for a localized query", () => {
    const result = run([
      "query",
      "--markdown",
      "--locale",
      "ja",
      "fixtures/conformance-webapp.pkl",
      "clause",
      "WEBAPP-ACCESS-CONFORMANCE",
      "must[0]",
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^# DSpec Query clause:WEBAPP-ACCESS-CONFORMANCE/m);
    assert.match(result.stdout, /主体は許可されている/);
    assert.match(result.stdout, /`clause:WEBAPP-ACCESS-CONFORMANCE#must\[0\]`/);
  });

  it("keeps the spec query JSON report fixture in sync", () => {
    assertReportFixture(
      [
        "query",
        "--json",
        "--locale",
        "ja",
        "--answer",
        "fixtures/spec-query-answer-valid.json",
        "fixtures/conformance-webapp.pkl",
        "rule",
        "WEBAPP-ACCESS-CONFORMANCE",
      ],
      "fixtures/reports/spec-query-webapp.json",
    );
  });

  it("renders spec reading evaluation prompts without gold labels", () => {
    const result = run(["spec-reading-eval", "--prompt", "fixtures/spec-reading-eval-sample-webapp.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^# Spec Reading Evaluation sample-webapp-reading-eval/m);
    assert.match(result.stdout, /modelPath: `\.\.\/examples\/sample-webapp-2026\.pkl`/);
    assert.match(result.stdout, /Allowed labels: `entailed`, `contradicted`, `not-supported`/);
    assert.match(result.stdout, /## Rubric/);
    assert.match(result.stdout, /explicit value differs/);
    assert.match(result.stdout, /cloud-topology/);
    assert.match(result.stdout, /Paraphrases/);
    assert.doesNotMatch(result.stdout, /expected/);
    assert.doesNotMatch(result.stdout, /entailed:pass/);
  });

  it("renders localized spec reading prompts with paraphrases", () => {
    const result = run(["spec-reading-eval", "--prompt", "--locale", "en", "fixtures/spec-reading-eval-sample-webapp.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /locale: `en`/);
    assert.match(result.stdout, /Dashboard\/API\/contracts and CI runner connectivity follows explicit topology/);
    assert.match(result.stdout, /The dashboard, API, contracts, and CI runner communicate through the modeled topology/);
    assert.doesNotMatch(result.stdout, /dashboard\/API\/contracts と CI runner/);
  });

  it("scores spec reading evaluation answers", () => {
    const result = run([
      "spec-reading-eval",
      "--json",
      "--score",
      "fixtures/spec-reading-eval-answers.json",
      "fixtures/spec-reading-eval-sample-webapp.pkl",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.score, {
      accuracy: 1,
      correct: 7,
      total: 7,
    });
    assert.deepEqual(report.cases.map((entry) => `${entry.id}:${entry.expected}:${entry.actual}:${entry.status}`), [
      "cloud-topology:entailed:entailed:pass",
      "runtime-slo:entailed:entailed:pass",
      "ci-weekly-review:entailed:entailed:pass",
      "database-primary-store:contradicted:contradicted:pass",
      "payment-release-gate:contradicted:contradicted:pass",
      "latency-budget:contradicted:contradicted:pass",
      "slo-owner:not-supported:not-supported:pass",
    ]);
    assert.deepEqual(report.evidenceScore, {
      correct: 7,
      total: 7,
    });
    assert.equal(report.cases[0].answerEvidenceStatus, "pass");
    assert.deepEqual(report.cases[0].answerEvidenceOverlap, ["rule:SAMPLE-CLOUD-TOPOLOGY"]);
  });

  it("scores spec reading answer evidence", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-spec-reading-"));
    try {
      const answers = JSON.parse(readFileSync(join(root, "fixtures/spec-reading-eval-answers.json"), "utf8"));
      answers.answers[0].evidence = ["rule:DOES-NOT-EXIST"];
      const answersFile = join(dir, "answers.json");
      writeFileSync(answersFile, JSON.stringify(answers));

      const result = run([
        "spec-reading-eval",
        "--json",
        "--score",
        answersFile,
        "fixtures/spec-reading-eval-sample-webapp.pkl",
      ]);

      assert.notEqual(result.status, 0);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "fail");
      assert.equal(report.cases[0].answerEvidenceStatus, "fail");
      assert.match(report.errors.join("\n"), /missing evidence rule: DOES-NOT-EXIST/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects stale spec reading gold evidence digests", () => {
    const result = run(["spec-reading-eval", "--json", "fixtures/spec-reading-eval-stale-digest.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.match(report.errors.join("\n"), /stale evidence digest/);
  });

  it("refreshes spec reading gold evidence digests", () => {
    const fixture = join(root, "fixtures", `.tmp-spec-reading-refresh-${process.pid}-${Date.now()}.pkl`);
    try {
      writeFileSync(fixture, readFileSync(join(root, "fixtures/spec-reading-eval-stale-digest.pkl"), "utf8"));

      const dryRun = run(["spec-reading-eval", "--json", "--refresh-digests", fixture]);
      assert.equal(dryRun.status, 0, dryRun.stderr);
      const dryRunReport = JSON.parse(dryRun.stdout);
      assert.equal(dryRunReport.status, "pass");
      assert.equal(dryRunReport.updated, 1);
      assert.equal(readFileSync(fixture, "utf8").includes("sha256:stale"), true);

      const applied = run(["spec-reading-eval", "--json", "--refresh-digests", "--apply", fixture]);
      assert.equal(applied.status, 0, applied.stderr);
      const appliedReport = JSON.parse(applied.stdout);
      assert.equal(appliedReport.updated, 1);
      assert.equal(readFileSync(fixture, "utf8").includes("sha256:stale"), false);

      const checked = run(["spec-reading-eval", "--json", fixture]);
      assert.equal(checked.status, 0, checked.stderr);
      assert.equal(JSON.parse(checked.stdout).status, "pass");
    } finally {
      rmSync(fixture, { force: true });
    }
  });

  it("evaluates spec reading suites with holdout cases", () => {
    const result = run(["spec-reading-eval-suite", "--json", "fixtures/spec-reading-eval-suite.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.summary, {
      evaluations: 2,
      cases: 10,
      entailed: 4,
      contradicted: 4,
      notSupported: 2,
    });
    assert.deepEqual(report.evaluations.map((entry) => `${entry.eval.id}:${entry.status}:${entry.summary.cases}`), [
      "sample-webapp-reading-eval:pass:7",
      "holdout-runtime-reading-eval:pass:3",
    ]);
    assert.match(report.suite.digest, /^sha256:[a-f0-9]{64}$/);
    assert.match(report.suite.inputDigest, /^sha256:[a-f0-9]{64}$/);
  });

  it("resolves spec reading eval paths relative to the eval file", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-spec-reading-cwd-"));
    try {
      const result = spawnSync(
        process.execPath,
        [cli, "spec-reading-eval", "--json", join(root, "fixtures/spec-reading-eval-sample-webapp.pkl")],
        {
          cwd: dir,
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
        },
      );

      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).status, "pass");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves spec reading suite entries relative to the suite file", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-spec-reading-suite-cwd-"));
    try {
      const result = spawnSync(
        process.execPath,
        [cli, "spec-reading-eval-suite", "--json", join(root, "fixtures/spec-reading-eval-suite.pkl")],
        {
          cwd: dir,
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
        },
      );

      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "pass");
      assert.equal(report.summary.evaluations, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports spec reading suite coverage", () => {
    const result = run(["coverage-spec-reading-eval-suite", "--json", "fixtures/spec-reading-eval-suite.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.coverage.evaluations, 2);
    assert.equal(report.coverage.cases, 10);
    assert.deepEqual(report.coverage.labels, {
      contradicted: 4,
      entailed: 4,
      "not-supported": 2,
    });
    assert.deepEqual(report.coverage.evidenceKinds, {
      clause: 2,
      rule: 8,
      term: 5,
    });
    for (const tag of ["cloud", "data", "release", "runtime", "near-miss", "value-mismatch", "missing-owner"]) {
      assert.ok(report.coverage.tags[tag] > 0, tag);
    }
  });

  it("rejects undercovered spec reading suites", () => {
    const result = run(["coverage-spec-reading-eval-suite", "--json", "fixtures/spec-reading-eval-suite-undercovered.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.match(report.errors.join("\n"), /missing spec reading suite coverage/);
    assert.match(report.errors.join("\n"), /minEvaluations/);
    assert.match(report.errors.join("\n"), /evidenceKind clause/);
  });

  it("detects spec reading rubric version mismatches", () => {
    const result = run(["spec-reading-eval", "--json", "fixtures/spec-reading-eval-rubric-mismatch.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.match(report.errors.join("\n"), /rubric version mismatch/);
  });

  it("renders spec reading score reports for subagent runs", () => {
    const result = run([
      "spec-reading-eval",
      "--markdown",
      "--score",
      "fixtures/spec-reading-eval-answers.json",
      "fixtures/spec-reading-eval-sample-webapp.pkl",
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^# Spec Reading Evaluation sample-webapp-reading-eval/m);
    assert.match(result.stdout, /## Subagent Run/);
    assert.match(result.stdout, /- answersFile: `fixtures\/spec-reading-eval-answers\.json`/);
    assert.match(result.stdout, /\| Case \| Expected \| Actual \| Label \| Evidence \| Status \|/);
    assert.match(result.stdout, /gold fix candidates: `0`/);
  });

  it("writes spec reading subagent run artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-spec-reading-run-"));
    try {
      const artifact = join(dir, "run.json");
      const result = run([
        "spec-reading-eval",
        "--json",
        "--score",
        "fixtures/spec-reading-eval-answers.json",
        "--write-run",
        artifact,
        "fixtures/spec-reading-eval-sample-webapp.pkl",
      ]);

      assert.equal(result.status, 0, result.stderr);
      const written = JSON.parse(readFileSync(artifact, "utf8"));
      assert.equal(written.status, "pass");
      assert.equal(written.score.correct, 7);
      assert.match(written.subagentRun.prompt, /Read the spec model and classify each claim/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs provider-neutral spec reading agents and records reproducible artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-spec-reading-agent-run-"));
    try {
      const artifact = join(dir, "run.json");
      const result = run([
        "spec-reading-eval",
        "--json",
        "--runner",
        "fixtures/spec-reading-agent-runner.pkl",
        "--write-run",
        artifact,
        "fixtures/spec-reading-eval-sample-webapp.pkl",
      ]);

      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      const written = JSON.parse(readFileSync(artifact, "utf8"));
      assert.deepEqual(written, report);
      assert.equal(report.status, "pass");
      assert.equal(report.score.correct, 7);
      assert.deepEqual(report.agentRun.runner, {
        id: "fixture-agent",
        provider: "process-fixture",
        model: "deterministic-gold-v1",
      });
      assert.equal(report.agentRun.exitCode, 0);
      assert.match(report.agentRun.promptDigest, /^sha256:[a-f0-9]{64}$/);
      assert.match(report.agentRun.answerDigest, /^sha256:[a-f0-9]{64}$/);
      assert.match(report.agentRun.rawStdout, /"answers"/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("records invalid spec reading agent output as a failing artifact", () => {
    const result = run([
      "spec-reading-eval",
      "--json",
      "--runner",
      "fixtures/spec-reading-agent-invalid-runner.pkl",
      "fixtures/spec-reading-eval-sample-webapp.pkl",
    ]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.equal(report.agentRun.exitCode, 0);
    assert.equal(report.agentRun.rawStdout, "not-json\n");
    assert.match(report.errors.join("\n"), /failed to parse agent stdout/);
  });

  it("keeps provider-neutral spec reading agent artifacts in sync", () => {
    assertReportFixture(
      [
        "spec-reading-eval",
        "--json",
        "--runner",
        "fixtures/spec-reading-agent-runner.pkl",
        "fixtures/spec-reading-eval-sample-webapp.pkl",
      ],
      "fixtures/reports/spec-reading-agent-run.json",
    );
  });

  it("runs metamorphic spec reading evaluation", () => {
    const result = run(["metamorphic-spec-reading-eval", "--json", "fixtures/spec-reading-eval-sample-webapp.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.variants.map((entry) => `${entry.id}:${entry.status}:${entry.score.correct}/${entry.score.total}`), [
      "gold-order:pass:7/7",
      "reversed-answer-order:pass:7/7",
      "reversed-evidence-order:pass:7/7",
      "noisy-rationale:pass:7/7",
    ]);
    assert.deepEqual(report.negativeControls.map((entry) => `${entry.id}:${entry.status}:${entry.score.correct}/${entry.score.total}`), [
      "flipped-label:pass:6/7",
    ]);
    assert.deepEqual(report.promptChecks.map((entry) => `${entry.id}:${entry.status}`), [
      "prompt-default:pass",
      "prompt-en:pass",
    ]);
  });

  it("keeps spec reading evaluation JSON report fixture in sync", () => {
    assertReportFixture(
      ["spec-reading-eval", "--json", "fixtures/spec-reading-eval-sample-webapp.pkl"],
      "fixtures/reports/spec-reading-eval-sample-webapp.json",
    );
  });

  it("keeps spec reading digest refresh JSON report fixture in sync", () => {
    assertReportFixture(
      ["spec-reading-eval", "--json", "--refresh-digests", "fixtures/spec-reading-eval-stale-digest.pkl"],
      "fixtures/reports/spec-reading-eval-refresh-stale.json",
    );
  });

  it("keeps spec reading suite JSON report fixture in sync", () => {
    assertReportFixture(
      ["spec-reading-eval-suite", "--json", "fixtures/spec-reading-eval-suite.pkl"],
      "fixtures/reports/spec-reading-eval-suite.json",
    );
  });

  it("keeps spec reading suite coverage JSON report fixture in sync", () => {
    assertReportFixture(
      ["coverage-spec-reading-eval-suite", "--json", "fixtures/spec-reading-eval-suite.pkl"],
      "fixtures/reports/coverage-spec-reading-eval-suite.json",
    );
  });

  it("keeps metamorphic spec reading JSON report fixture in sync", () => {
    assertReportFixture(
      ["metamorphic-spec-reading-eval", "--json", "fixtures/spec-reading-eval-sample-webapp.pkl"],
      "fixtures/reports/metamorphic-spec-reading-eval.json",
    );
  });

  it("renders app profile mutation scores as markdown", () => {
    const result = run(["score-app-profile-mutations", "--markdown", "fixtures/sample-webapp-profile-route-scenarios.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^# App Profile Mutation Score route-only-scenarios/m);
    assert.match(result.stdout, /- score: `1`/);
    assert.match(result.stdout, /\| Mutation \| Category \| Suggestion Kind \| Actual \| Status \| Payload \| Shrinks \| Errors \|/);
    assert.match(result.stdout, /\| route-spec-missing \| route \| spec-missing \| fail \| pass \| \{"addedRoute":"\/api\/admin"\} \|/);
  });

  it("keeps app profile mutation score JSON report fixture in sync", () => {
    assertReportFixture(
      ["score-app-profile-mutations", "--json", "fixtures/sample-webapp-profile-extended-scenarios.pkl"],
      "fixtures/reports/score-app-profile-mutations.json",
    );
  });

  it("keeps app profile evaluation Markdown report fixture in sync", () => {
    const result = run(["evaluate-app-profile", "--markdown", "fixtures/sample-webapp-profile-extended-scenarios.pkl"]);
    const expected = readFileSync(join(root, "fixtures/reports/evaluate-app-profile-extended-scenarios.md"), "utf8");

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
  });

  it("keeps extended app profile evaluation JSON report fixture in sync", () => {
    assertReportFixture(
      ["evaluate-app-profile", "--json", "fixtures/sample-webapp-profile-extended-scenarios.pkl"],
      "fixtures/reports/evaluate-app-profile-extended-scenarios.json",
    );
  });

  it("keeps app profile scenario coverage JSON report fixture in sync", () => {
    assertReportFixture(
      ["coverage-app-profile-scenarios", "--json", "fixtures/sample-webapp-profile-extended-scenarios.pkl"],
      "fixtures/reports/coverage-app-profile-scenarios.json",
    );
  });

  it("keeps app profile evaluation JSON report fixture in sync", () => {
    assertReportFixture(
      ["evaluate-app-profile", "--json", "fixtures/sample-webapp-profile.pkl"],
      "fixtures/reports/evaluate-app-profile-sample-webapp.json",
    );
  });

  it("keeps app profile scenario evaluation JSON report fixture in sync", () => {
    assertReportFixture(
      ["evaluate-app-profile", "--json", "fixtures/sample-webapp-profile-scenarios.pkl"],
      "fixtures/reports/evaluate-app-profile-scenarios.json",
    );
  });

  it("evaluates app profile suites from a registry", () => {
    const result = run(["evaluate-app-profile-suite", "--json", "fixtures/sample-webapp-profile-suite.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.suite.id, "sample-webapp-suite");
    assert.equal(report.passed, 2);
    assert.equal(report.total, 2);
    assert.equal(report.evaluations.length, 2);
    assert.deepEqual(
      report.evaluations.find((entry) => entry.profile.id === "sample-webapp-2026-scenarios").scenarios.map((scenario) => scenario.id),
      ["baseline", "ci-missing-vrt", "ci-add-security"],
    );
  });

  it("keeps app profile suite JSON report fixture in sync", () => {
    assertReportFixture(
      ["check-app-profile-suite", "--json", "fixtures/sample-webapp-profile-suite.pkl"],
      "fixtures/reports/check-app-profile-suite.json",
    );
  });

  it("keeps app profile suite evaluation JSON report fixture in sync", () => {
    assertReportFixture(
      ["evaluate-app-profile-suite", "--json", "fixtures/sample-webapp-profile-suite.pkl"],
      "fixtures/reports/evaluate-app-profile-suite.json",
    );
  });

  it("keeps app profile JSON report fixture in sync", () => {
    assertReportFixture(
      ["check-app-profile", "--json", "fixtures/sample-webapp-profile.pkl"],
      "fixtures/reports/check-app-profile-sample-webapp.json",
    );
  });

  it("keeps scaled app profile JSON report fixture in sync", () => {
    assertReportFixture(
      [
        "check-app-profile",
        "--json",
        "fixtures/sample-webapp-profile.pkl",
        "fixtures/sample-webapp-profile.pkl",
        "fixtures/sample-webapp-profile.pkl",
        "fixtures/sample-webapp-profile.pkl",
        "fixtures/sample-webapp-profile.pkl",
        "fixtures/sample-webapp-profile.pkl",
        "fixtures/sample-webapp-profile.pkl",
        "fixtures/sample-webapp-profile.pkl",
      ],
      "fixtures/reports/check-app-profile-scale.json",
    );
  });

  it("refreshes stale app profile observed facts with --fix", () => {
    const dir = mkdtempSync(join(root, "fixtures", ".tmp-app-profile-"));
    try {
      const observedPath = join(dir, "observed.json");
      const profilePath = join(dir, "profile.pkl");
      writeFileSync(observedPath, `${JSON.stringify({ app: { id: "stale" } }, null, 2)}\n`);
      writeFileSync(profilePath, `import "../../dspec/Schema.pkl" as d

profile: d.AppProfile = new {
  id = "sample-webapp-2026"
  modelPath = "examples/sample-webapp-2026.pkl"
  appRoot = "fixtures/sample-webapp-2026"
  observedFacts = "${observedPath}"
  gates {
    "observed-fixture"
  }
}
`);

      const stale = run(["check-app-profile", "--json", profilePath]);
      assert.notEqual(stale.status, 0);
      assert.match(stale.stderr, /observed facts fixture is stale/);

      const fixed = run(["check-app-profile", "--json", "--fix", profilePath]);
      assert.equal(fixed.status, 0, fixed.stderr);
      const report = JSON.parse(fixed.stdout);
      assert.equal(report.status, "pass");
      assert.deepEqual(report.fixed, [observedPath]);
      assert.equal(report.checks[0].fixed, true);
      assert.equal(JSON.parse(readFileSync(observedPath, "utf8")).app.id, "sample-webapp-2026");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("previews stale app profile observed fact refresh with --fix --dry-run", () => {
    const dir = mkdtempSync(join(root, "fixtures", ".tmp-app-profile-dry-run-"));
    try {
      const observedPath = join(dir, "observed.json");
      const profilePath = join(dir, "profile.pkl");
      const stale = `${JSON.stringify({ app: { id: "stale" } }, null, 2)}\n`;
      writeFileSync(observedPath, stale);
      writeFileSync(profilePath, `import "../../dspec/Schema.pkl" as d

profile: d.AppProfile = new {
  id = "sample-webapp-2026"
  modelPath = "examples/sample-webapp-2026.pkl"
  appRoot = "fixtures/sample-webapp-2026"
  observedFacts = "${observedPath}"
  gates {
    "observed-fixture"
  }
}
`);

      const preview = run(["check-app-profile", "--json", "--fix", "--dry-run", profilePath]);

      assert.notEqual(preview.status, 0);
      const report = JSON.parse(preview.stdout);
      assert.equal(report.status, "fail");
      assert.deepEqual(report.wouldFix, [observedPath]);
      assert.equal(report.checks[0].wouldFix, true);
      assert.equal(readFileSync(observedPath, "utf8"), stale);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("keeps gate suggestions in failing app profile reports", () => {
    const dir = mkdtempSync(join(root, "fixtures", ".tmp-app-profile-suggestions-"));
    try {
      const appRoot = join(dir, "app");
      mkdirSync(join(appRoot, "apps/api/src"), { recursive: true });
      mkdirSync(join(appRoot, "packages/contracts/src"), { recursive: true });
      mkdirSync(join(appRoot, ".github/workflows"), { recursive: true });
      writeFileSync(join(appRoot, "package.json"), stableJson({
        name: "sample-webapp-2026",
        scripts: {
          "dev:dashboard": "vite",
          "serve:api": "node apps/api/src/app.ts",
          test: "vitest",
          typecheck: "tsc --noEmit",
        },
      }));
      writeFileSync(join(appRoot, "apps/api/src/app.ts"), `const app = {};
app.get("/api/dashboard", () => {});
app.get("/api/health", () => {});
app.get("/api/services/:serviceId", () => {});
`);
      writeFileSync(join(appRoot, "packages/contracts/src/index.ts"), `export const dashboardSnapshotSchema = {};
export const incidentSchema = {};
export const serviceDetailSchema = {};
`);
      writeFileSync(join(appRoot, "flaker.toml"), `owner = "mizchi"
name = "flaker"
path = ".flaker/data.duckdb"

[profile.ci]
`);
      writeFileSync(join(appRoot, ".github/workflows/ci.yml"), `name: ci
jobs:
  verify:
    steps:
      - name: Typecheck
        run: pnpm typecheck
      - name: Unit tests
        run: pnpm test
      - name: Playwright E2E
        run: pnpm test:e2e
      - name: flaker review markdown
        run: pnpm flaker
      - name: Upload quality artifacts
        uses: actions/upload-artifact@v6
        with:
          name: quality-artifacts
`);
      writeFileSync(join(appRoot, ".github/workflows/weekly-review.yml"), `name: weekly-review
jobs:
  review:
    steps:
      - name: Unit tests
        run: pnpm test
      - name: Playwright E2E
        run: pnpm test:e2e
      - name: flaker scheduled profile
        run: pnpm flaker
      - name: Upload weekly review artifacts
        uses: actions/upload-artifact@v6
        with:
          name: weekly-review-artifacts
`);

      const profilePath = join(dir, "profile.pkl");
      writeFileSync(profilePath, `import "../../dspec/Schema.pkl" as d

profile: d.AppProfile = new {
  id = "sample-webapp-2026"
  modelPath = "examples/sample-webapp-2026.pkl"
  appRoot = ${JSON.stringify(appRoot)}
  gates {
    "reconcile-real-app"
  }
}
`);

      const result = run(["check-app-profile", "--json", profilePath]);

      assert.notEqual(result.status, 0);
      const report = JSON.parse(result.stdout);
      const reconcile = report.checks.find((check) => check.id === "reconcile-real-app");
      assert.equal(report.status, "fail");
      assert.equal(reconcile.status, "fail");
      assert.ok(
        reconcile.suggestions.some((suggestion) =>
          suggestion.kind === "implementation-missing" &&
          suggestion.message.includes('Restore release gate "vrt"')
        ),
      );
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("reports SQL query drift as JSON", () => {
    const result = run(["check-sql-queries", "--json", "fixtures/db-model.pkl", "fixtures/db-queries-broken.sql"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.equal(report.queries, 4);
    assert.deepEqual(
      report.errors.map((error) => error.property),
      [
        "sql-select-star",
        "sql-missing-tenant-filter",
        "sql-missing-fk-join",
        "sql-missing-tenant-filter",
        "sql-unknown-column",
        "sql-insert-missing-tenant-column",
      ],
    );
    assert.equal(report.errors[0].query, "list-all-orders");
    assert.equal(report.errors[2].query, "list-payment-orders-without-fk-join");
    assert.equal(report.errors[4].column, "orders.missing_column");
  });

  it("rejects invalid DB model references", () => {
    const result = run(["check", "fixtures/db-model-invalid-ref.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown db transaction write table: bad-transaction -> missing_table/);
  });

  it("rejects invalid DB migration references", () => {
    const result = run(["check", "fixtures/db-model-invalid-migration-ref.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown db migration target table: bad-migration -> missing_table/);
  });

  it("rejects invalid DB migration mapping references", () => {
    const result = run(["check", "fixtures/db-model-invalid-mapping-ref.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown db migration mapping invariant: bad-mapping-ref.bad-mapping -> missing-invariant/);
  });

  it("rejects DB migration mappings outside preserved invariants", () => {
    const result = run(["check", "fixtures/db-model-invalid-mapping-preserve.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /db migration mapping invariant is not preserved: bad-mapping-preserve.unscoped-mapping -> paid-order-has-payment/);
  });

  it("accepts Cloud topology pattern", () => {
    const result = run(["check", "fixtures/cloud-model.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: cloud-model-fixture/);
  });

  it("rejects invalid Cloud topology references", () => {
    const result = run(["check", "fixtures/cloud-model-invalid-ref.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown cloud node zone: orphan -> missing-zone/);
  });

  it("accepts Data governance pattern", () => {
    const result = run(["check", "fixtures/data-model.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: data-model-fixture/);
  });

  it("rejects invalid Data governance references", () => {
    const result = run(["check", "fixtures/data-model-invalid-ref.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown data placement dataset: orphan-placement -> missing-dataset/);
  });

  it("accepts Release safety pattern", () => {
    const result = run(["check", "fixtures/release-model.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: release-model-fixture/);
  });

  it("rejects invalid Release safety references", () => {
    const result = run(["check", "fixtures/release-model-invalid-ref.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown release step service: orphan-release -> missing-service/);
  });

  it("accepts Runtime safety pattern", () => {
    const result = run(["check", "fixtures/runtime-model.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: runtime-model-fixture/);
  });

  it("accepts Intent processes with closed construction paths", () => {
    const result = run(["check", "fixtures/intent-process.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: intent-process-fixture/);
  });

  it("rejects Intent processes that require undeclared capabilities", () => {
    const result = run(["check", "fixtures/intent-process-invalid-capability.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown intent process required capability/);
  });

  it("rejects Intent processes with unauthorised construction paths", () => {
    const result = run(["check", "fixtures/intent-process-invalid-authority.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /intent process construction has no authority: request\.cancel -> request\.cancelled/);
  });

  it("rejects Intent scenarios with discontinuous state traces", () => {
    const result = run(["check", "fixtures/intent-process-invalid-scenario.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /intent scenario input state mismatch: request-approval-from-wrong-state\[0\] expected request\.approved, process accepts request\.pending/);
  });

  it("tracks Intent process implementation references in drift detection", () => {
    const result = run(["drift", "--json", "fixtures/intent-process.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.ok(JSON.parse(result.stdout).references >= 1);
  });

  it("reports Intent elements that are not grounded in approved rules", () => {
    const result = run(["domain-coverage", "--json", "fixtures/intent-process.pkl"]);

    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.ok(report.errors.includes("uncovered domain element: intent.process request.approve at model.patterns.intent.processes[0]"));
    assert.ok(report.errors.includes("uncovered domain element: intent.scenario request-approval at model.patterns.intent.scenarios[0]"));
  });

  it("rejects invalid Runtime safety references", () => {
    const result = run(["check", "fixtures/runtime-model-invalid-ref.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown runtime alert signal: orphan-alert -> missing-signal/);
  });

  it("rejects invalid Runtime evidence references", () => {
    const result = run(["check", "fixtures/runtime-model-evidence-invalid-ref.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown runtime telemetry signal: orphan-telemetry -> missing-signal/);
  });

  it("imports runtime evidence JSON as a deterministic Pkl fragment", () => {
    const result = run(["import-runtime-evidence", "fixtures/runtime-evidence-import.json"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /telemetry \{/);
    assert.match(result.stdout, /new d\.RuntimeTelemetryWindow \{/);
    assert.match(result.stdout, /id = "checkout-availability-30d"/);
    assert.match(result.stdout, /alertPolicies \{/);
    assert.match(result.stdout, /new d\.RuntimeAlertPolicy \{/);
    assert.match(result.stdout, /runbookExecutions \{/);
    assert.match(result.stdout, /new d\.RuntimeRunbookExecution \{/);
    assert.match(result.stdout, /dependencyTraces \{/);
    assert.match(result.stdout, /new d\.RuntimeDependencyTrace \{/);
    assert.match(result.stdout, /source = "otel:checkout-api-to-payments:p95"/);
  });

  it("imports runtime evidence JSON as stable JSON", () => {
    const result = run(["import-runtime-evidence", "--json", "fixtures/runtime-evidence-import.json"]);

    assert.equal(result.status, 0, result.stderr);
    const imported = JSON.parse(result.stdout);
    assert.equal(imported.runtimeEvidence.telemetry[0].id, "checkout-availability-30d");
    assert.equal(imported.runtimeEvidence.alertPolicies[0].alert, "checkout-availability-page");
    assert.equal(imported.runtimeEvidence.runbookExecutions[0].status, "pass");
    assert.equal(imported.runtimeEvidence.dependencyTraces[0].observedLatencyMs, 120);
  });

  it("rejects invalid runtime evidence imports", () => {
    const result = run(["import-runtime-evidence", "fixtures/runtime-evidence-import-invalid.json"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /runtime evidence import prometheus.telemetry\[0\] missing required field: id/);
    assert.match(result.stderr, /runtime evidence import prometheus.telemetry\[0\] observedPercent out of range: 101/);
  });

  it("collects runtime evidence from provider API payloads", () => {
    const result = run(["collect-runtime-evidence", "fixtures/runtime-evidence-collector.json"]);

    assert.equal(result.status, 0, result.stderr);
    const collected = JSON.parse(result.stdout);
    assert.equal(collected.prometheus.telemetry[0].id, "checkout-availability-30d");
    assert.equal(collected.prometheus.telemetry[0].observedPercent, 100);
    assert.equal(collected.pagerduty.alertPolicies[0].alert, "checkout-availability-page");
    assert.equal(collected.incident.runbookExecutions[0].status, "pass");
    assert.equal(collected.otel.dependencyTraces[0].observedLatencyMs, 120);
    assert.equal(collected.otel.dependencyTraces[0].idempotencyKeyObserved, true);
  });

  it("collects runtime evidence from live HTTP sources", async () => {
    const payload = {
      data: {
        result: [
          {
            metric: {
              __name__: "checkout_availability_ratio",
              evidence_id: "checkout-availability-http",
              observed_at: "2026-07-10",
              service: "checkout-api",
              signal: "checkout-availability-signal",
              slo: "checkout-availability",
            },
            value: [1783670400, "1"],
          },
        ],
        resultType: "vector",
      },
      status: "success",
    };
    const server = createServer((request, response) => {
      if (request.url !== "/prometheus/availability") {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "not found" }));
        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    });
    const dir = mkdtempSync(join(tmpdir(), "dspec-http-collector-"));
    try {
      const address = await listen(server);
      const manifest = {
        sources: [
          {
            expects: {
              asOf: "2026-07-10",
              freshWithinDays: 1,
              id: "checkout-availability-http",
              observedPercentAtLeast: 99,
              service: "checkout-api",
              signal: "checkout-availability-signal",
              slo: "checkout-availability",
            },
            kind: "telemetry",
            provider: "prometheus",
            source: "http",
            timeoutMs: 1000,
            url: `http://127.0.0.1:${address.port}/prometheus/availability`,
          },
        ],
      };
      const manifestPath = join(dir, "collector.json");
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      const result = await runAsync(["verify-runtime-evidence", "--json", manifestPath]);

      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "pass");
      assert.equal(report.passed, 1);
      assert.equal(report.total, 1);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("collects runtime evidence directly as a Pkl fragment", () => {
    const result = run(["collect-runtime-evidence", "--pkl", "fixtures/runtime-evidence-collector.json"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /new d\.RuntimeTelemetryWindow \{/);
    assert.match(result.stdout, /id = "checkout-availability-30d"/);
    assert.match(result.stdout, /new d\.RuntimeDependencyTrace \{/);
    assert.match(result.stdout, /idempotencyKeyObserved = true/);
  });

  it("rejects invalid runtime evidence collector manifests", () => {
    const result = run(["collect-runtime-evidence", "fixtures/runtime-evidence-collector-invalid.json"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /runtime evidence collector source\[0\] unsupported provider\/kind: prometheus\/unknown/);
  });

  it("emits runtime evidence collector manifests from Runtime safety specs", () => {
    const result = run(["emit", "runtime-collector", "fixtures/runtime-model.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(result.stdout);
    assert.equal(manifest.modelId, "runtime-model-fixture");
    assert.deepEqual(
      manifest.sources.map((source) => `${source.provider}/${source.kind}/${source.expects.id}`),
      [
        "incident/runbookExecutions/checkout-page-runbook-execution",
        "otel/dependencyTraces/checkout-api-to-payments-trace",
        "pagerduty/alertPolicies/checkout-availability-page-policy",
        "prometheus/telemetry/checkout-availability-30d",
      ],
    );
    assert.equal(manifest.sources[3].query.signal, "checkout-availability-signal");
    assert.equal(manifest.sources[3].query.targetPercent, 99);
  });

  it("collects implementation-side Intent execution policy observations through OTel", () => {
    const emitted = run(["emit", "runtime-collector-fixture", "fixtures/intent-contract-execution-policy.pkl"]);
    const sourceMap = run(["emit", "source-map", "fixtures/intent-contract-execution-policy.pkl"]);

    assert.equal(emitted.status, 0, emitted.stderr);
    assert.equal(sourceMap.status, 0, sourceMap.stderr);
    const manifest = JSON.parse(emitted.stdout);
    assert.equal(manifest.sources.length, 1);
    const source = manifest.sources[0];
    assert.equal(source.provider, "otel");
    assert.equal(source.kind, "intentExecutions");
    assert.deepEqual(source.expects, {
      duplicateSuppressed: true,
      id: "request.approve-request.approve-handler-execution",
      idempotencyKeyObserved: true,
      maxInFlightObservedAtMost: 2,
      observedLatencyMsAtMost: 1000,
      process: "request.approve",
      refinement: "request.approve-handler",
      timedOut: false,
    });
    assert.deepEqual(source.payload.spans[0].attributes, {
      "dspec.execution.duplicate_suppressed": true,
      "dspec.execution.max_in_flight": 2,
      "dspec.intent.process": "request.approve",
      "dspec.intent.refinement": "request.approve-handler",
      "http.request.header.idempotency-key.present": true,
    });
    assert.ok(JSON.parse(sourceMap.stdout).artifacts.runtimeCollector.some((entry) =>
      entry.generated === "runtimeCollector.sources.otel.intentExecutions.request.approve-request.approve-handler-execution" &&
      entry.source.path === "model.patterns.intent.processes[0].execution"
    ));

    const dir = mkdtempSync(join(tmpdir(), "dspec-intent-otel-"));
    try {
      const passingFile = join(dir, "passing.json");
      const failingFile = join(dir, "failing.json");
      writeFileSync(passingFile, emitted.stdout);
      const passing = run(["verify-runtime-evidence", "--json", passingFile]);
      assert.equal(passing.status, 0, passing.stderr);
      assert.equal(JSON.parse(passing.stdout).passed, 1);

      source.payload.spans[0].attributes["dspec.execution.max_in_flight"] = 3;
      source.payload.spans[0].attributes["dspec.execution.duplicate_suppressed"] = false;
      writeFileSync(failingFile, stableJson(manifest));
      const failing = run(["verify-runtime-evidence", "--json", failingFile]);
      assert.notEqual(failing.status, 0);
      assert.deepEqual(JSON.parse(failing.stdout).failures.map((failure) => failure.property), [
        "intentExecution.maxInFlightObservedAtMost",
        "intentExecution.duplicateSuppressed",
      ]);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("verifies runtime evidence collector expectations", () => {
    const result = run(["verify-runtime-evidence", "fixtures/runtime-evidence-collector.json"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: runtime evidence expectations \(4\/4\)/);
  });

  it("reports runtime evidence expectation drift as JSON", () => {
    const result = run(["verify-runtime-evidence", "--json", "fixtures/runtime-evidence-collector-broken.json"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.equal(report.passed, 0);
    assert.equal(report.total, 4);
    assert.deepEqual(
      report.failures.map((failure) => failure.property),
      [
        "runbookExecution.status",
        "dependencyTrace.observedLatencyMsAtMost",
        "dependencyTrace.timedOut",
        "dependencyTrace.idempotencyKeyObserved",
        "alertPolicy.enabled",
        "telemetry.observedPercentAtLeast",
      ],
    );
  });

  it("reports stale runtime evidence as drift", () => {
    const result = run(["verify-runtime-evidence", "--json", "fixtures/runtime-evidence-collector-stale.json"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    const stale = report.failures.find((failure) => failure.property === "telemetry.freshWithinDays");
    assert.ok(stale);
    assert.deepEqual(stale.expected, {
      asOf: "2026-07-10",
      earliest: "2026-07-09",
      freshWithinDays: 1,
    });
    assert.equal(stale.observed, "2026-07-07");
  });

  it("reports runtime evidence quality and freshness summary", () => {
    const result = run(["verify-runtime-evidence", "--json", "fixtures/runtime-evidence-collector-stale.json"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.quality, {
      failed: 1,
      freshnessChecked: 1,
      missing: 0,
      passed: 0,
      score: 0,
      sourceMapped: 0,
      stale: 1,
      total: 1,
    });
    assert.equal(report.evidence[0].id, "checkout-availability-30d");
    assert.equal(report.evidence[0].status, "fail");
    assert.equal(report.evidence[0].observedAt, "2026-07-07");
    assert.deepEqual(report.evidence[0].freshness, {
      asOf: "2026-07-10",
      checked: true,
      earliest: "2026-07-09",
      freshWithinDays: 1,
      status: "stale",
    });
  });

  it("emits collectable inline runtime evidence fixture manifests", () => {
    const emitted = run(["emit", "runtime-collector-fixture", "fixtures/runtime-model.pkl"]);

    assert.equal(emitted.status, 0, emitted.stderr);
    const manifest = JSON.parse(emitted.stdout);
    assert.equal(manifest.modelId, "runtime-model-fixture");
    assert.equal(manifest.sources.length, 4);
    assert.ok(manifest.sources.every((source) => source.source === "inline"));
    assert.equal(manifest.sources[3].payload.data.result[0].metric.evidence_id, "checkout-availability-30d");

    const dir = mkdtempSync(join(tmpdir(), "dspec-runtime-collector-"));
    const file = join(dir, "collector.json");
    try {
      writeFileSync(file, emitted.stdout);
      const verified = run(["verify-runtime-evidence", file]);
      const collected = run(["collect-runtime-evidence", file]);

      assert.equal(verified.status, 0, verified.stderr);
      assert.match(verified.stdout, /ok: runtime evidence expectations \(4\/4\)/);
      assert.equal(collected.status, 0, collected.stderr);
      assert.equal(JSON.parse(collected.stdout).prometheus.telemetry[0].observedPercent, 99);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("rejects invalid typed Clause.ast", () => {
    const result = run(["check", "fixtures/invalid-typed-ast.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /invalid expr ast: INVALID-TYPED-AST must\[0\] eq expects exactly 2 args/);
  });

  it("rejects expr ast fields outside operator semantics", () => {
    const result = run(["check", "fixtures/invalid-ast-extra-fields.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /invalid expr ast: INVALID-AST-EXTRA-FIELDS must\[0\] atom does not accept children/);
  });

  it("rejects unsupported Clause.ast semantics versions", () => {
    const result = run(["check", "fixtures/unsupported-ast-semantics.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unsupported Clause\.ast semantics version: 2\.0/);
  });

  it("renders localized model text", () => {
    const result = run(["render", "--locale", "ja", "examples/rbac.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /# RBAC 仕様/);
    assert.match(result.stdout, /- \[permission\] RBAC-ALLOW: 管理者は管理画面を閲覧できる/);
    assert.match(result.stdout, /  - must: allow\(action\.view, screen\.admin\)/);
  });

  it("checks dspec's self model", () => {
    const result = run(["check", "examples/dspec.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: dspec-self/);
    assert.match(result.stdout, /138 terms, 81 rules/);
  });

  it("emits check JSON reports", () => {
    const result = run(["check", "--json", "examples/dspec.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.model, { id: "dspec-self", version: "0.1.0" });
    assert.equal(report.summary.terms, 138);
    assert.equal(report.summary.projections, 8);
    assert.equal(report.summary.rules, 81);
    assert.deepEqual(report.assurance.rules, { satisfied: 79, total: 79 });
    assert.equal(report.assurance.targets.byKind.executed, 5);
    assert.equal(report.assurance.targets.byKind["mutation-tested"], 1);
    assert.equal(report.assurance.targets.byKind.bounded, 0);
    assert.equal(report.assurance.targets.byKind.proved, 0);
    assert.deepEqual(report.errors, []);
  });

  it("keeps check JSON report fixture in sync", () => {
    assertReportFixture(["check", "--json", "examples/dspec.pkl"], "fixtures/reports/check-dspec.json");
  });

  it("resolves backend-aware drift targets", () => {
    const result = run(["drift", "fixtures/backend-aware-drift.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: backend-aware-drift drift/);
  });

  it("rejects missing backend-aware drift target symbols", () => {
    const result = run(["drift", "fixtures/backend-aware-drift-invalid.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing lean check target symbol: BACKEND-DRIFT-MISSING -> fixtures\/backend-drift\/Proof\.lean#missing_anchor/);
    assert.match(result.stderr, /missing tla check target symbol: BACKEND-DRIFT-MISSING -> fixtures\/backend-drift\/Spec\.tla#MissingInvariant/);
    assert.match(result.stderr, /missing alloy check target symbol: BACKEND-DRIFT-MISSING -> fixtures\/backend-drift\/model\.als#MissingInvariant/);
    assert.match(result.stderr, /missing runtime check target source: BACKEND-DRIFT-MISSING -> fixtures\/backend-drift\/runtime-manifest\.json#missing-runtime/);
    assert.match(result.stderr, /missing playwright check target anchor: BACKEND-DRIFT-MISSING -> fixtures\/backend-drift\/example\.spec\.ts#missing playwright target/);
  });

  it("renders dspec's self model", () => {
    const result = run(["render", "--locale", "ja", "examples/dspec.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /# DSpec 自己仕様/);
    assert.match(result.stdout, /DSPEC-SCHEMA-TYPED: 仕様モデルは Pkl schema で型検査される/);
    assert.match(result.stdout, /DSPEC-EXPR-OPAQUE: 現段階の Clause\.expr は typed AST ではなく opaque string として扱う/);
  });

  it("keeps stable ids across localized renders", () => {
    const ja = run(["render", "--locale", "ja", "examples/dspec.pkl"]);
    const en = run(["render", "--locale", "en", "examples/dspec.pkl"]);

    assert.equal(ja.status, 0, ja.stderr);
    assert.equal(en.status, 0, en.stderr);
    assert.match(ja.stdout, /DSPEC-SCHEMA-TYPED/);
    assert.match(en.stdout, /DSPEC-SCHEMA-TYPED/);
    assert.match(ja.stdout, /仕様モデルは Pkl schema で型検査される/);
    assert.match(en.stdout, /Spec models are type-checked by the Pkl schema/);
  });

  it("emits deterministic markdown", () => {
    const result = run(["emit", "markdown", "--locale", "ja", "examples/dspec.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /# DSpec 自己仕様/);
    assert.match(result.stdout, /## Review Summary/);
    assert.match(result.stdout, /- approvedRules: `\d+`/);
    assert.match(result.stdout, /- automatedCheckTargets: `\d+`/);
    assert.match(result.stdout, /- implementationRefs: `\d+`/);
    assert.match(result.stdout, /- projections: `8`/);
    assert.match(result.stdout, /- domainElements: `\d+`/);
    assert.match(result.stdout, /- runtimeEvidenceRecords: `\d+`/);
    assert.match(result.stdout, /## Projections/);
    assert.match(result.stdout, /### self-markdown/);
    assert.match(result.stdout, /- output: `generated\/examples\/\{locale\}\/dspec\.md`/);
    assert.match(result.stdout, /### DSPEC-EMIT-MARKDOWN/);
    assert.match(result.stdout, /- status: approved/);
    assert.match(result.stdout, /- check: node test\/cli\.test\.mjs#emits deterministic markdown/);
    assert.match(result.stdout, /#### Review/);
    assert.match(result.stdout, /- coverage: rule/);
    assert.match(result.stdout, /- source: model\.rules\[/);
    assert.match(result.stdout, /- selector: DSPEC-EMIT-MARKDOWN\.must\[0\]/);
  });

  it("emits deterministic quickcheck with shrink", () => {
    const result = run(["emit", "quickcheck", "examples/dspec.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /export const modelId = "dspec-self";/);
    assert.match(result.stdout, /export function shrinkRuleId/);
    assert.match(result.stdout, /DSPEC-EMIT-QUICKCHECK/);
    assert.match(result.stdout, /propertyApprovedRulesHaveAutomatedChecks/);
  });

  it("emits formal backend skeletons", () => {
    const alloy = run(["emit", "alloy", "examples/dspec.pkl"]);
    const tla = run(["emit", "tla", "examples/dspec.pkl"]);
    const tlaCfg = run(["emit", "tla-cfg", "examples/dspec.pkl"]);
    const lean = run(["emit", "lean", "examples/dspec.pkl"]);

    assert.equal(alloy.status, 0, alloy.stderr);
    assert.equal(tla.status, 0, tla.stderr);
    assert.equal(tlaCfg.status, 0, tlaCfg.stderr);
    assert.equal(lean.status, 0, lean.stderr);
    assert.match(alloy.stdout, /assert ApprovedRulesHaveChecks/);
    assert.match(alloy.stdout, /abstract sig ActiveApprovedRule extends Rule/);
    assert.match(alloy.stdout, /abstract sig AutomatedCheckTarget extends CheckTarget/);
    assert.match(alloy.stdout, /assert ActiveApprovedRulesHaveAutomatedSupport/);
    assert.match(tla.stdout, /RuleWorkflowState ==/);
    assert.match(tla.stdout, /DetectUncovered ==/);
    assert.match(tla.stdout, /Spec ==/);
    assert.match(tla.stdout, /CoverageInvariant ==/);
    assert.match(tla.stdout, /WorkflowInvariant ==/);
    assert.match(tlaCfg.stdout, /SPECIFICATION Spec/);
    assert.match(tlaCfg.stdout, /INVARIANT CoverageInvariant/);
    assert.match(tlaCfg.stdout, /INVARIANT WorkflowInvariant/);
    assert.match(lean.stdout, /def AutomatedSupport/);
    assert.match(lean.stdout, /theorem coverage_invariant/);
    assert.match(lean.stdout, /theorem approved_rules_have_checks/);
  });

  it("emits source maps for generated artifacts", () => {
    const result = run(["emit", "source-map", "--locale", "ja", "fixtures/typed-ast.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const sourceMap = JSON.parse(result.stdout);
    assert.equal(sourceMap.model.id, "typed-ast-fixture");
    for (const artifact of ["markdown", "quickcheck", "alloy", "tla", "tlaCfg", "lean"]) {
      assert.ok(Array.isArray(sourceMap.artifacts[artifact]), artifact);
    }
    assert.ok(
      sourceMap.artifacts.markdown.some(
        (entry) => entry.generated === "markdown.rule.TYPED-AST-PRESERVED" && entry.source.path === "model.rules[0]",
      ),
    );
    assert.ok(
      sourceMap.artifacts.quickcheck.some(
        (entry) => entry.source.kind === "clause" && entry.source.ruleId === "TYPED-AST-PRESERVED" && entry.source.field === "must" && entry.source.index === 0,
      ),
    );
    assert.ok(sourceMap.artifacts.alloy.some((entry) => entry.generated === "alloy.sig.R_TYPED_AST_PRESERVED"));
    assert.ok(sourceMap.artifacts.tla.some((entry) => entry.generated === "tla.Checks[TYPED-AST-PRESERVED]"));
    assert.ok(sourceMap.artifacts.lean.some((entry) => entry.generated === "lean.RuleId.TYPED_AST_PRESERVED"));
  });

  it("emits spec diff impact reports", () => {
    const result = run(["impact", "--json", "fixtures/impact-before.pkl", "fixtures/impact-after.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.model.before, { id: "impact-fixture", version: "0.1.0" });
    assert.deepEqual(report.model.after, { id: "impact-fixture", version: "0.1.1" });
    assert.deepEqual(report.changed.terms, [{ id: "action.view", change: "modified" }]);
    assert.deepEqual(report.changed.rules, [{ id: "IMPACT-AUDIT", change: "added" }]);
    assert.deepEqual(report.changed.projections, []);
    assert.deepEqual(report.changed.formalizations, [
      { id: "impact-allow-alloy", change: "added" },
      { id: "impact-allow-behavior", change: "added" },
    ]);
    assert.deepEqual(report.changed.refinements, [{ id: "impact-allow-refinement", change: "added" }]);
    assert.deepEqual(report.projectionImpact.regenerateArgv, ["dspec", "generate", "fixtures/impact-after.pkl"]);
    assert.equal(report.projectionImpact.regenerateCommand, "dspec generate fixtures/impact-after.pkl");
    assert.deepEqual(
      report.projectionImpact.artifacts,
      [
        {
          action: "regenerate",
          kind: "markdown",
          locale: "en",
          path: "generated/impact/en/impact.md",
          projectionId: "impact-markdown",
          projectionKind: "markdown",
        },
        {
          action: "regenerate",
          kind: "provenance",
          locale: null,
          path: "generated/impact/impact.provenance.json",
          projectionId: "impact-markdown",
          projectionKind: "markdown",
        },
        {
          action: "regenerate",
          kind: "markdown",
          locale: "ja",
          path: "generated/impact/ja/impact.md",
          projectionId: "impact-markdown",
          projectionKind: "markdown",
        },
      ],
    );

    const termImpact = report.impacts.find((impact) => impact.kind === "term" && impact.id === "action.view");
    assert.ok(termImpact);
    assert.deepEqual(termImpact.affectedRules, ["IMPACT-ALLOW", "IMPACT-AUDIT"]);
    assert.ok(termImpact.generated.some((entry) => entry.generated === "markdown.term.action.view"));
    assert.ok(termImpact.generated.some((entry) => entry.generated === "quickcheck.rule.IMPACT-ALLOW"));
    assert.deepEqual(termImpact.implementationRefs.map((ref) => ref.symbol).sort(), ["validate", "validateCoverage"]);

    const ruleImpact = report.impacts.find((impact) => impact.kind === "rule" && impact.id === "IMPACT-AUDIT");
    assert.ok(ruleImpact);
    assert.ok(ruleImpact.generated.some((entry) => entry.generated === "markdown.rule.IMPACT-AUDIT"));
    assert.ok(ruleImpact.generated.some((entry) => entry.generated === "lean.RuleId.IMPACT_AUDIT"));

    const formalizationImpact = report.impacts.find((impact) => impact.kind === "formalization" && impact.id === "impact-allow-behavior");
    assert.ok(formalizationImpact);
    assert.deepEqual(formalizationImpact.affectedRules, ["IMPACT-ALLOW"]);
    assert.deepEqual(formalizationImpact.checks, ["purchase.capacity-always.holds"]);
    assert.deepEqual(formalizationImpact.reverification, ["traceability", "check:purchase.capacity-always.holds"]);

    const refinementImpact = report.impacts.find((impact) => impact.kind === "refinement" && impact.id === "impact-allow-refinement");
    assert.ok(refinementImpact);
    assert.deepEqual(refinementImpact.affectedRules, ["IMPACT-ALLOW"]);
    assert.deepEqual(refinementImpact.checks, ["impact.allow.refines.holds"]);
    assert.deepEqual(refinementImpact.reverification, ["traceability", "check:impact.allow.refines.holds"]);
  });

  it("keeps impact JSON report fixture in sync", () => {
    assertReportFixture(
      ["impact", "--json", "fixtures/impact-before.pkl", "fixtures/impact-after.pkl"],
      "fixtures/reports/impact.json",
    );
  });

  it("reports removed and regenerated artifacts for projection path changes", () => {
    const result = run([
      "impact",
      "--json",
      "fixtures/impact-before.pkl",
      "fixtures/impact-projection-after.pkl",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.changed.projections, [{ id: "impact-markdown", change: "modified" }]);
    assert.ok(report.projectionImpact.artifacts.some(
      (artifact) => artifact.action === "remove" && artifact.path === "generated/impact/en/impact.md",
    ));
    assert.ok(report.projectionImpact.artifacts.some(
      (artifact) => artifact.action === "regenerate" && artifact.path === "generated/impact-v2/en/impact.md",
    ));
    assert.deepEqual(report.projectionImpact.regenerateArgv, [
      "dspec",
      "generate",
      "fixtures/impact-projection-after.pkl",
    ]);
    assert.equal(report.projectionImpact.regenerateCommand, "dspec generate fixtures/impact-projection-after.pkl");
  });

  it("classifies spec compatibility changes", () => {
    const cases = [
      ["fixtures/compat-compatible-after.pkl", "compatible"],
      ["fixtures/compat-narrowing-after.pkl", "narrowing"],
      ["fixtures/compat-widening-after.pkl", "widening"],
      ["fixtures/compat-breaking-after.pkl", "breaking"],
      ["fixtures/compat-unknown-after.pkl", "unknown"],
    ];

    for (const [after, expected] of cases) {
      const result = run(["spec-change", "compat", "--json", "fixtures/compat-before.pkl", after]);

      assert.equal(result.status, 0, `${after}\n${result.stderr}`);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "pass", after);
      assert.equal(report.classification, expected, after);
      assert.ok(Array.isArray(report.decisions), after);
    }
  });

  it("classifies assurance requirement compatibility", () => {
    const narrowing = run([
      "spec-change",
      "compat",
      "--json",
      "fixtures/assurance-compat-before.pkl",
      "fixtures/assurance-compat-after.pkl",
    ]);
    const widening = run([
      "spec-change",
      "compat",
      "--json",
      "fixtures/assurance-compat-after.pkl",
      "fixtures/assurance-compat-before.pkl",
    ]);

    assert.equal(narrowing.status, 0, narrowing.stderr);
    assert.equal(widening.status, 0, widening.stderr);
    assert.equal(JSON.parse(narrowing.stdout).classification, "narrowing");
    assert.equal(JSON.parse(widening.stdout).classification, "widening");
  });

  it("renders spec compatibility classification for review", () => {
    const result = run(["spec-change", "compat", "--markdown", "fixtures/compat-before.pkl", "fixtures/compat-narrowing-after.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^# Spec Compatibility compat-fixture/m);
    assert.match(result.stdout, /- classification: `narrowing`/);
    assert.match(result.stdout, /\| Change \| Classification \| Reason \|/);
    assert.match(result.stdout, /COMPAT-AUDIT-VIEW/);
  });

  it("keeps spec compatibility JSON report fixture in sync", () => {
    assertReportFixture(
      ["spec-change", "compat", "--json", "fixtures/compat-before.pkl", "fixtures/compat-narrowing-after.pkl"],
      "fixtures/reports/spec-compat-narrowing.json",
    );
  });

  it("classifies spec compatibility through spec-change subcommands", () => {
    const result = run(["spec-change", "compat", "--json", "fixtures/compat-before.pkl", "fixtures/compat-narrowing-after.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.classification, "narrowing");
  });

  it("reviews a spec change procedure", () => {
    const result = run(["spec-change", "review", "--json", "fixtures/spec-change-review.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.review.id, "spec-change-review-narrowing");
    assert.equal(report.classification, "narrowing");
    assert.equal(report.passed, 7);
    assert.equal(report.total, 7);
    assert.deepEqual(report.steps.map((step) => step.id), [
      "check-before",
      "check-after",
      "impact",
      "compatibility",
      "breaking-policy",
      "evidence-ref",
      "coverage-after",
    ]);
    assert.deepEqual(report.errors, []);
  });

  it("reviews spec changes through spec-change subcommands", () => {
    const result = run(["spec-change", "review", "--json", "fixtures/spec-change-review.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.review.id, "spec-change-review-narrowing");
    assert.equal(report.classification, "narrowing");
  });

  it("reports portable projection actions through spec-change review", () => {
    const reviewFile = join(root, "fixtures", "spec-change-review-projection.pkl");
    const result = spawnSync(process.execPath, [cli, "spec-change", "review", "--json", reviewFile], {
      cwd: tmpdir(),
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    const impact = report.steps.find((step) => step.id === "impact");
    assert.ok(impact);
    assert.equal(impact.projectionArtifacts, 6);
    assert.deepEqual(impact.regenerateArgv, ["dspec", "generate", "fixtures/impact-projection-after.pkl"]);
    assert.equal(impact.regenerateCommand, "dspec generate fixtures/impact-projection-after.pkl");
  });

  it("renders a spec change procedure for review", () => {
    const result = run(["spec-change", "review", "--markdown", "fixtures/spec-change-review.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^# Spec Change Review spec-change-review-narrowing/m);
    assert.match(result.stdout, /- classification: `narrowing`/);
    assert.match(result.stdout, /\| Step \| Status \| Summary \| Errors \|/);
    assert.match(result.stdout, /coverage-after/);
  });

  it("rejects a spec change procedure when compatibility is not allowed", () => {
    const result = run(["spec-change", "review", "--json", "fixtures/spec-change-review-breaking-disallowed.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.equal(report.classification, "breaking");
    assert.ok(report.errors.some((error) => error.includes("compatibility breaking is not allowed")));
  });

  it("requires explicit evidence for approved breaking spec changes", () => {
    const result = run(["spec-change", "review", "--json", "fixtures/spec-change-review-breaking-missing-evidence.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.equal(report.classification, "breaking");
    const policy = report.steps.find((step) => step.id === "breaking-policy");
    assert.ok(policy);
    assert.deepEqual(policy.missingEvidence, ["deprecation-plan", "migration-plan", "rollout-plan"]);
    assert.ok(report.errors.some((error) => error.includes("missing breaking change evidence")));
  });

  it("accepts approved breaking spec changes with required evidence", () => {
    const result = run(["spec-change", "review", "--json", "fixtures/spec-change-review-breaking-approved.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.classification, "breaking");
    const policy = report.steps.find((step) => step.id === "breaking-policy");
    assert.ok(policy);
    assert.equal(policy.status, "pass");
    assert.deepEqual(policy.missingEvidence, []);
  });

  it("rejects breaking spec changes with missing evidence refs", () => {
    const result = run(["spec-change", "review", "--json", "fixtures/spec-change-review-breaking-missing-ref.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.equal(report.classification, "breaking");
    const refs = report.steps.find((step) => step.id === "evidence-ref");
    assert.ok(refs);
    assert.equal(refs.status, "fail");
    assert.ok(refs.errors.some((error) => error.includes("missing markdown evidence anchor")));
  });

  it("keeps spec change review JSON report fixture in sync", () => {
    assertReportFixture(
      ["spec-change", "review", "--json", "fixtures/spec-change-review.pkl"],
      "fixtures/reports/spec-change-review.json",
    );
  });

  it("keeps approved breaking spec change review JSON report fixture in sync", () => {
    assertReportFixture(
      ["spec-change", "review", "--json", "fixtures/spec-change-review-breaking-approved.pkl"],
      "fixtures/reports/spec-change-review-breaking-approved.json",
    );
  });

  it("keeps missing-evidence spec change review JSON report fixture in sync", () => {
    assertReportFixture(
      ["spec-change", "review", "--json", "fixtures/spec-change-review-breaking-missing-evidence.pkl"],
      "fixtures/reports/spec-change-review-breaking-missing-evidence.json",
      1,
    );
  });

  it("keeps missing-ref spec change review JSON report fixture in sync", () => {
    assertReportFixture(
      ["spec-change", "review", "--json", "fixtures/spec-change-review-breaking-missing-ref.pkl"],
      "fixtures/reports/spec-change-review-breaking-missing-ref.json",
      1,
    );
  });

  it("scaffolds spec change review drafts", () => {
    const result = run(["spec-change", "scaffold", "fixtures/compat-before.pkl", "fixtures/compat-narrowing-after.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^import "\.\.\/dspec\/Schema\.pkl" as d/m);
    assert.match(result.stdout, /review: d\.SpecChangeReview = new \{/);
    assert.match(result.stdout, /id = "compat-fixture-0\.1\.0-to-0\.2\.0"/);
    assert.match(result.stdout, /expectedCompatibility = "narrowing"/);

    const tempFile = join(root, "fixtures", `.tmp-spec-change-scaffold-${process.pid}.pkl`);
    try {
      writeFileSync(tempFile, result.stdout);
      const evalResult = spawnSync("pkl", ["eval", "-f", "json", tempFile], {
        cwd: root,
        encoding: "utf8",
      });

      assert.equal(evalResult.status, 0, evalResult.stderr);
      const review = JSON.parse(evalResult.stdout).review;
      assert.equal(review.id, "compat-fixture-0.1.0-to-0.2.0");
      assert.equal(review.beforeModelPath, "fixtures/compat-before.pkl");
      assert.equal(review.afterModelPath, "fixtures/compat-narrowing-after.pkl");
      assert.equal(review.expectedCompatibility, "narrowing");
      assert.deepEqual(review.allowedCompatibility, ["compatible", "narrowing"]);
      assert.deepEqual(review.requiredSteps, [
        "check-before",
        "check-after",
        "impact",
        "compatibility",
        "breaking-policy",
        "evidence-ref",
        "coverage-after",
      ]);
    } finally {
      rmSync(tempFile, { force: true });
    }
  });

  it("scaffolds breaking spec change review drafts with evidence policy", () => {
    const result = run(["spec-change", "scaffold", "--json", "fixtures/compat-before.pkl", "fixtures/compat-breaking-after.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.classification, "breaking");
    assert.deepEqual(report.draft.allowedCompatibility, ["breaking"]);
    assert.deepEqual(report.draft.breakingRequires, [
      "migration-plan",
      "deprecation-plan",
      "rollout-plan",
      "owner-approval",
    ]);
    assert.deepEqual(report.draft.evidence, []);

    const pklResult = run(["spec-change", "scaffold", "fixtures/compat-before.pkl", "fixtures/compat-breaking-after.pkl"]);
    const tempRelative = `fixtures/.tmp-spec-change-scaffold-breaking-${process.pid}.pkl`;
    const tempFile = join(root, tempRelative);
    try {
      writeFileSync(tempFile, pklResult.stdout);
      const review = run(["spec-change", "review", "--json", tempRelative]);
      assert.notEqual(review.status, 0);
      const reviewReport = JSON.parse(review.stdout);
      assert.ok(reviewReport.errors.some((error) => error.includes("missing breaking change evidence")));
    } finally {
      rmSync(tempFile, { force: true });
    }
  });

  it("keeps scaffolded spec change review draft fixture in sync", () => {
    assertReportFixture(
      ["spec-change", "scaffold", "fixtures/compat-before.pkl", "fixtures/compat-narrowing-after.pkl"],
      "fixtures/spec-change-scaffold-narrowing.pkl",
    );
  });

  it("writes scaffolded spec change review drafts to an output path", () => {
    const tempDir = mkdtempSync(join(root, "fixtures", ".tmp-scaffold-output-"));
    const outputFile = join(tempDir, "reviews", "generated-review.pkl");
    try {
      const result = run([
        "spec-change",
        "scaffold",
        "--output",
        outputFile,
        "fixtures/compat-before.pkl",
        "fixtures/compat-narrowing-after.pkl",
      ]);

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /ok: wrote spec change review scaffold/);

      const rendered = readFileSync(outputFile, "utf8");
      assert.match(rendered, /^import "\.\.\/\.\.\/\.\.\/dspec\/Schema\.pkl" as d/m);
      assert.match(rendered, /beforeModelPath = "\.\.\/\.\.\/compat-before\.pkl"/);
      assert.match(rendered, /afterModelPath = "\.\.\/\.\.\/compat-narrowing-after\.pkl"/);

      const evalResult = spawnSync("pkl", ["eval", "-f", "json", outputFile], {
        cwd: root,
        encoding: "utf8",
      });
      assert.equal(evalResult.status, 0, evalResult.stderr);

      const review = run(["spec-change", "review", "--json", outputFile]);
      assert.equal(review.status, 0, review.stderr);
      assert.equal(JSON.parse(review.stdout).classification, "narrowing");

      const reviewFromOtherCwd = spawnSync(process.execPath, [cli, "spec-change", "review", "--json", outputFile], {
        cwd: tmpdir(),
        encoding: "utf8",
      });
      assert.equal(reviewFromOtherCwd.status, 0, reviewFromOtherCwd.stderr);
      assert.equal(JSON.parse(reviewFromOtherCwd.stdout).classification, "narrowing");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("scaffolds spec change reviews through spec-change subcommands", () => {
    const tempDir = mkdtempSync(join(root, "fixtures", ".tmp-spec-change-group-"));
    const outputFile = join(tempDir, "reviews", "generated-review.pkl");
    try {
      const result = run([
        "spec-change",
        "scaffold",
        "--output",
        outputFile,
        "fixtures/compat-before.pkl",
        "fixtures/compat-narrowing-after.pkl",
      ]);

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /ok: wrote spec change review scaffold/);
      assert.match(result.stdout, new RegExp(`next: dspec spec-change review --json ${outputFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));

      const rendered = readFileSync(outputFile, "utf8");
      assert.match(rendered, /beforeModelPath = "\.\.\/\.\.\/compat-before\.pkl"/);

      const review = spawnSync(process.execPath, [cli, "spec-change", "review", "--json", outputFile], {
        cwd: tmpdir(),
        encoding: "utf8",
      });
      assert.equal(review.status, 0, review.stderr);
      assert.equal(JSON.parse(review.stdout).classification, "narrowing");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports scaffolded spec change review output metadata as JSON", () => {
    const tempDir = mkdtempSync(join(root, "fixtures", ".tmp-scaffold-output-json-"));
    const outputFile = join(tempDir, "reviews", "generated-review.pkl");
    try {
      const result = run([
        "spec-change",
        "scaffold",
        "--json",
        "--output",
        outputFile,
        "fixtures/compat-before.pkl",
        "fixtures/compat-narrowing-after.pkl",
      ]);

      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "pass");
      assert.equal(report.output.path, outputFile);
      assert.equal(report.output.schemaImportPath, "../../../dspec/Schema.pkl");
      assert.equal(report.draft.beforeModelPath, "../../compat-before.pkl");
      assert.equal(report.draft.afterModelPath, "../../compat-narrowing-after.pkl");
      assert.ok(report.output.bytes > 0);
      assert.equal(JSON.parse(spawnSync("pkl", ["eval", "-f", "json", outputFile], {
        cwd: root,
        encoding: "utf8",
      }).stdout).review.id, "compat-fixture-0.1.0-to-0.2.0");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("renders breaking spec change evidence suggestions", () => {
    const pklResult = run(["spec-change", "scaffold", "fixtures/compat-before.pkl", "fixtures/compat-breaking-after.pkl"]);
    const tempRelative = `fixtures/.tmp-spec-change-scaffold-suggestions-${process.pid}.pkl`;
    const tempFile = join(root, tempRelative);
    try {
      writeFileSync(tempFile, pklResult.stdout);
      const review = run(["spec-change", "review", tempRelative]);

      assert.notEqual(review.status, 0);
      assert.equal(review.stdout, "");
      assert.match(review.stderr, /suggested evidence entries:/);
      assert.match(review.stderr, /kind = "migration-plan"/);
      assert.match(review.stderr, /ref = "docs\/compat-fixture-0\.1\.0-to-1\.0\.0\.md#migration-plan"/);
      assert.equal(review.stderr.match(/missing breaking change evidence/g).length, 1);
    } finally {
      rmSync(tempFile, { force: true });
    }
  });

  it("reports breaking spec change evidence suggestions as JSON", () => {
    const result = run(["spec-change", "review", "--json", "fixtures/spec-change-review-breaking-missing-evidence.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    const policy = report.steps.find((step) => step.id === "breaking-policy");
    assert.ok(policy);
    assert.deepEqual(policy.suggestedEvidence.map((entry) => entry.kind), [
      "deprecation-plan",
      "migration-plan",
      "rollout-plan",
    ]);
    assert.match(policy.suggestedEvidence[0].pkl, /kind = "deprecation-plan"/);
  });

  it("renders scaffold spec change review command help", () => {
    const result = run(["spec-change", "scaffold", "--help"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^usage:\n  dspec spec-change scaffold/m);
    assert.doesNotMatch(result.stdout, /scaffold-spec-change-review|Compatibility alias/);
    assert.match(result.stdout, /--output <review\.pkl>/);
    assert.match(result.stdout, /breaking evidence/);
  });

  it("renders spec-change command group help", () => {
    const result = run(["spec-change", "--help"]);
    const helpResult = run(["spec-change", "help"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(helpResult.status, 0, helpResult.stderr);
    assert.equal(helpResult.stdout, result.stdout);
    assert.match(result.stdout, /^usage:\n  dspec spec-change compat/m);
    assert.ok(result.stdout.indexOf("dspec spec-change scaffold") < result.stdout.indexOf("dspec spec-change review"));
    assert.match(result.stdout, /Typical flow:/);
    assert.match(result.stdout, /dspec spec-change scaffold --output review\.pkl before\.pkl after\.pkl/);
    assert.doesNotMatch(result.stdout, /classify-spec-compat|review-spec-change|scaffold-spec-change-review|Compatibility alias/);
  });

  it("renders spec-change in normal workflow order in top-level usage", () => {
    const result = run(["--help"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /dspec spec-change <compat\|scaffold\|review> \.\.\./);
    assert.doesNotMatch(result.stdout, /dspec spec-change <compat\|review\|scaffold>/);
  });

  it("defines top-level CLI commands through the command registry", () => {
    const result = run(["--help"]);

    assert.equal(result.status, 0, result.stderr);
    const registry = topLevelCommandRegistry();
    const registryNames = registry.map((entry) => entry.name);
    assert.ok(registry.length > 20);
    assert.deepEqual(new Set(registryNames).size, registryNames.length);
    assert.deepEqual(registryNames, Array.from(cliUsageCommands(result.stdout)));
    for (const entry of registry) {
      assert.match(entry.usage, new RegExp(`^dspec ${entry.name}\\b`));
    }
  });

  it("keeps documented CLI command examples on the live command surface", () => {
    const usageResult = run(["--help"]);
    const specChangeUsageResult = run(["spec-change", "--help"]);
    assert.equal(usageResult.status, 0, usageResult.stderr);
    assert.equal(specChangeUsageResult.status, 0, specChangeUsageResult.stderr);

    const commands = cliUsageCommands(usageResult.stdout);
    const specChangeSubcommands = specChangeUsageCommands(specChangeUsageResult.stdout);
    const invocations = documentedCliInvocations([
      "README.md",
      "docs/dogfooding-2026-07-10.md",
      "docs/usability-evaluation.md",
      "docs/semantic-model.md",
      "Taskfile.pkl",
    ]);

    assert.ok(invocations.length > 80);
    for (const invocation of invocations) {
      assert.ok(commands.has(invocation.command), `${invocation.source}: unknown documented command ${invocation.raw}`);
      if (invocation.command === "spec-change" && invocation.subcommand && invocation.subcommand !== "help") {
        assert.ok(
          specChangeSubcommands.has(invocation.subcommand),
          `${invocation.source}: unknown documented spec-change subcommand ${invocation.raw}`,
        );
      }
    }
  });

  it("smoke-runs documented CLI command examples through help", () => {
    const invocations = documentedCliInvocations([
      "README.md",
      "docs/dogfooding-2026-07-10.md",
      "docs/usability-evaluation.md",
      "docs/semantic-model.md",
      "Taskfile.pkl",
    ]);
    const smoke = documentedCliHelpSmokeArgs(invocations);

    assert.ok(smoke.length > 20);
    for (const item of smoke) {
      const result = run(item.args);
      assert.equal(result.status, 0, `${item.source}: ${item.raw}\n${result.stderr}`);
      assert.match(result.stdout, /^usage:\n  dspec /, `${item.source}: ${item.raw}`);
    }
  });

  it("keeps product positioning and assurance boundaries explicit", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const semanticModel = readFileSync(join(root, "docs", "semantic-model.md"), "utf8");
    const graph = run(["intent", "graph", "--json", "examples/dspec.pkl"]);

    assert.match(readme, /system specification and assurance toolkit/);
    assert.match(readme, /not\s+a general theorem prover/);
    assert.match(readme, /formal model is normative/);
    assert.match(readme, /Natural-language text is a derived/);
    assert.match(readme, /## Capability Boundaries/);
    assert.match(semanticModel, /## Product Positioning and Scope/);
    assert.match(semanticModel, /formal-first target/);
    assert.match(semanticModel, /LLM.*candidate/);
    assert.match(semanticModel, /not deployment or\s+production-reachability proof/);
    assert.equal(graph.status, 0, graph.stderr);
    assert.ok(JSON.parse(graph.stdout).goals.some((goal) =>
      goal.id === "goal.formal-source-of-truth" && goal.priority === 0 &&
      goal.claims.includes("claim.formal-source-of-truth")
    ));
    assert.ok(JSON.parse(graph.stdout).goals.some((goal) =>
      goal.id === "goal.daily-drift-review" &&
      goal.claims.includes("claim.daily-drift-review")
    ));
  });

  it("keeps documented CLI extractor covered by holdout shapes", () => {
    const invocations = documentedCliInvocations(["fixtures/documented-cli-examples-holdout.md"]);

    assert.deepEqual(
      invocations.map((invocation) => [invocation.command, invocation.subcommand ?? null, invocation.raw]),
      [
        ["drift", null, "drift --json examples/dspec.pkl"],
        ["emit", null, "emit runtime-collector-fixture fixtures/runtime-model.pkl"],
        ["verify-runtime-evidence", null, "verify-runtime-evidence --json /dev/stdin"],
        ["check", null, "check examples/dspec.pkl"],
        ["coverage", null, "coverage --json examples/dspec.pkl"],
        ["spec-change", "compat", "spec-change compat --json fixtures/compat-before.pkl fixtures/compat-narrowing-after.pkl"],
      ],
    );
  });

  it("renders spec-change subcommand help", () => {
    const compat = run(["spec-change", "compat", "--help"]);
    const review = run(["spec-change", "review", "--help"]);

    assert.equal(compat.status, 0, compat.stderr);
    assert.match(compat.stdout, /^usage:\n  dspec spec-change compat/m);
    assert.doesNotMatch(compat.stdout, /classify-spec-compat|Compatibility alias/);

    assert.equal(review.status, 0, review.stderr);
    assert.match(review.stdout, /^usage:\n  dspec spec-change review/m);
    assert.doesNotMatch(review.stdout, /review-spec-change|Compatibility alias/);
  });

  it("renders spec-change subcommand usage for argument errors", () => {
    const compat = run(["spec-change", "compat", "--json", "fixtures/compat-before.pkl"]);
    const review = run(["spec-change", "review", "--json", "--markdown", "fixtures/spec-change-review.pkl"]);
    const scaffold = run(["spec-change", "scaffold", "--json"]);

    assert.notEqual(compat.status, 0);
    assert.equal(compat.stdout, "");
    assert.match(compat.stderr, /^usage:\n  dspec spec-change compat/m);

    assert.notEqual(review.status, 0);
    assert.equal(review.stdout, "");
    assert.match(review.stderr, /^usage:\n  dspec spec-change review/m);

    assert.notEqual(scaffold.status, 0);
    assert.equal(scaffold.stdout, "");
    assert.match(scaffold.stderr, /^usage:\n  dspec spec-change scaffold/m);
  });

  it("rejects removed legacy spec-change command names", () => {
    for (const command of ["classify-spec-compat", "review-spec-change", "scaffold-spec-change-review"]) {
      const result = run([command, "--help"]);

      assert.notEqual(result.status, 0, command);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, new RegExp(`unknown command: ${command}`));
    }
  });

  it("emits generated artifact manifest", () => {
    const result = run(["emit", "generated-manifest", "--locale", "ja", "examples/dspec.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(result.stdout);
    assert.equal(manifest.model.id, "dspec-self");
    assert.equal(manifest.locale, "ja");
    for (const artifact of ["markdown", "quickcheck", "alloy", "tla", "tlaCfg", "lean", "sourceMap"]) {
      assert.match(manifest.artifacts[artifact].sha256, /^[a-f0-9]{64}$/);
      assert.ok(manifest.artifacts[artifact].bytes > 0);
    }
  });

  it("accepts localized generated projection contracts", () => {
    const result = run(["check", "fixtures/projection-model.pkl"]);
    const sourceMapResult = run(["emit", "source-map", "fixtures/projection-model.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(sourceMapResult.status, 0, sourceMapResult.stderr);
    const sourceMap = JSON.parse(sourceMapResult.stdout);
    assert.ok(sourceMap.artifacts.markdown.some(
      (entry) => entry.generated === "markdown.projection.localized-markdown"
        && entry.source.path === "projections[0]",
    ));
  });

  it("does not inherit entrypoint projection ownership through model amendments", () => {
    const checked = run(["check", "--json", "fixtures/projection-derived-model.pkl"]);
    const generated = run(["generated", "check", "--json", "fixtures/projection-derived-model.pkl"]);

    assert.equal(checked.status, 0, checked.stderr);
    assert.equal(JSON.parse(checked.stdout).summary.projections, 0);
    assert.equal(generated.status, 0, generated.stderr);
    assert.equal(JSON.parse(generated.stdout).summary.projections, 0);
  });

  it("generates and checks localized projection artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-projection-"));
    const generatedPath = join(dir, "generated", "projection");
    try {
      const generated = run(["generate", "--json", "--root", dir, "fixtures/projection-model.pkl"]);
      assert.equal(generated.status, 0, generated.stderr);
      const generatedReport = JSON.parse(generated.stdout);
      assert.equal(generatedReport.status, "pass");
      assert.equal(generatedReport.summary.artifacts, 2);
      assert.equal(generatedReport.projections[0].source, "self");
      assert.deepEqual(readdirSync(generatedPath).toSorted(), ["en", "ja", "projection-model.provenance.json"]);

      const checked = run(["generated", "check", "--json", "--root", dir, "fixtures/projection-model.pkl"]);
      assert.equal(checked.status, 0, checked.stderr);
      assert.equal(JSON.parse(checked.stdout).status, "pass");

      rmSync(join(generatedPath, "en", "projection-model.md"));
      const missing = run(["generated", "check", "--root", dir, "fixtures/projection-model.pkl"]);
      assert.notEqual(missing.status, 0);
      assert.match(missing.stderr, /missing generated artifact: localized-markdown -> generated\/projection\/en\/projection-model\.md/);
      assert.equal(run(["generate", "--root", dir, "fixtures/projection-model.pkl"]).status, 0);

      writeFileSync(join(generatedPath, "en", "projection-model.md"), "stale\n");
      const stale = run(["generated", "check", "--root", dir, "fixtures/projection-model.pkl"]);
      assert.notEqual(stale.status, 0);
      assert.match(stale.stderr, /stale generated artifact: localized-markdown -> generated\/projection\/en\/projection-model\.md/);

      mkdirSync(join(generatedPath, "fr"), { recursive: true });
      writeFileSync(join(generatedPath, "fr", "projection-model.md"), "extra\n");
      const extra = run(["generated", "check", "--root", dir, "fixtures/projection-model.pkl"]);
      assert.notEqual(extra.status, 0);
      assert.match(extra.stderr, /unexpected generated artifact: localized-markdown -> generated\/projection\/fr\/projection-model\.md/);

      const repaired = run(["generate", "--root", dir, "fixtures/projection-model.pkl"]);
      assert.equal(repaired.status, 0, repaired.stderr);
      assert.deepEqual(readdirSync(generatedPath).toSorted(), ["en", "ja", "projection-model.provenance.json"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generates, checks, and repairs every deterministic backend projection kind", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-projection-kinds-"));
    const output = (path) => join(dir, ...path.split("/"));
    try {
      const generated = run(["generate", "--json", "--root", dir, "fixtures/projection-all-kinds.pkl"]);
      assert.equal(generated.status, 0, generated.stderr);
      const report = JSON.parse(generated.stdout);
      assert.equal(report.summary.projections, 8);
      assert.equal(report.summary.artifacts, 9);
      assert.equal(report.summary.actions.create, 17);
      assert.deepEqual(
        report.projections.map((projection) => projection.kind),
        ["alloy", "generated-manifest", "lean", "markdown", "quickcheck", "source-map", "tla", "tla-cfg"],
      );

      const sourceMap = JSON.parse(run(["emit", "source-map", "fixtures/projection-all-kinds.pkl"]).stdout);
      const sourceMapProjectionEntries = {
        alloy: ["alloy", "alloy.projection.alloy"],
        "generated-manifest": ["generatedManifest", "generatedManifest.projection.generated-manifest"],
        lean: ["lean", "lean.projection.lean"],
        markdown: ["markdown", "markdown.projection.localized-markdown"],
        quickcheck: ["quickcheck", "quickcheck.projection.quickcheck"],
        "source-map": ["sourceMap", "sourceMap.projection.source-map"],
        tla: ["tla", "tla.projection.tla"],
        "tla-cfg": ["tlaCfg", "tlaCfg.projection.tla-cfg"],
      };
      for (const [kind, [artifact, generated]] of Object.entries(sourceMapProjectionEntries)) {
        assert.ok(sourceMap.artifacts[artifact].some((entry) => entry.generated === generated), kind);
      }

      const checked = run(["generated", "check", "--json", "--root", dir, "fixtures/projection-all-kinds.pkl"]);
      assert.equal(checked.status, 0, checked.stderr);
      assert.equal(JSON.parse(checked.stdout).status, "pass");

      writeFileSync(output("generated/projection-kinds/Spec.lean"), "stale\n");
      const stale = run(["generated", "check", "--root", dir, "fixtures/projection-all-kinds.pkl"]);
      assert.notEqual(stale.status, 0);
      assert.match(stale.stderr, /stale generated artifact: lean -> generated\/projection-kinds\/Spec\.lean/);

      assert.equal(run(["generate", "--root", dir, "fixtures/projection-all-kinds.pkl"]).status, 0);
      assert.equal(readFileSync(output("generated/projection-kinds/Spec.lean"), "utf8").startsWith("namespace DSpec.Generated"), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports deterministic impact for every materialized backend projection", () => {
    const result = run([
      "impact",
      "--json",
      "fixtures/projection-all-kinds.pkl",
      "fixtures/projection-all-kinds-after.pkl",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(
      new Set(report.projectionImpact.artifacts.map((artifact) => artifact.projectionKind)),
      new Set(["markdown", "quickcheck", "lean", "alloy", "tla", "tla-cfg", "source-map", "generated-manifest"]),
    );
    assert.ok(report.projectionImpact.artifacts.some(
      (artifact) => artifact.kind === "source-map" && artifact.path === "generated/projection-kinds/source-map.json" && artifact.action === "regenerate",
    ));
    assert.ok(report.projectionImpact.artifacts.some(
      (artifact) => artifact.kind === "generated-manifest" && artifact.path === "generated/projection-kinds/manifest.json" && artifact.action === "regenerate",
    ));
    assert.deepEqual(report.projectionImpact.regenerateArgv, [
      "dspec",
      "generate",
      "fixtures/projection-all-kinds-after.pkl",
    ]);
  });

  it("previews Projection generation without writing", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-projection-preview-"));
    try {
      const result = run([
        "generate",
        "--dry-run",
        "--json",
        "--generated-at",
        "2026-07-15T00:00:00.000Z",
        "--root",
        dir,
        "fixtures/projection-model.pkl",
      ]);

      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.dryRun, true);
      assert.equal(report.transaction.status, "preview");
      assert.deepEqual(report.summary.actions, { create: 3, remove: 0, unchanged: 0, update: 0 });
      assert.equal(existsSync(join(dir, "generated")), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid Projection generation timestamps as command errors", () => {
    const result = run([
      "generate",
      "--dry-run",
      "--generated-at",
      "not-an-iso-timestamp",
      "fixtures/projection-model.pkl",
    ]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /invalid --generated-at: not-an-iso-timestamp/);
    assert.doesNotMatch(result.stderr, /TypeError|\n\s+at /);
  });

  it("writes and checks Projection provenance without changing its stable generation time", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-projection-provenance-"));
    const provenancePath = join(dir, "generated", "projection", "projection-model.provenance.json");
    try {
      const first = run([
        "generate",
        "--json",
        "--generated-at",
        "2026-07-15T00:00:00.000Z",
        "--root",
        dir,
        "fixtures/projection-model.pkl",
      ]);
      assert.equal(first.status, 0, first.stderr);
      const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
      assert.equal(provenance.schemaVersion, "1.0");
      assert.equal(provenance.generatedAt, "2026-07-15T00:00:00.000Z");
      assert.equal(provenance.projection.id, "localized-markdown");
      assert.match(provenance.model.digest, /^sha256:[a-f0-9]{64}$/);
      assert.deepEqual(provenance.emitter, { name: "dspec/markdown", version: "1.0" });

      const repeated = run([
        "generate",
        "--json",
        "--generated-at",
        "2027-01-01T00:00:00.000Z",
        "--root",
        dir,
        "fixtures/projection-model.pkl",
      ]);
      assert.equal(repeated.status, 0, repeated.stderr);
      assert.equal(JSON.parse(repeated.stdout).changed, 0);
      assert.equal(JSON.parse(readFileSync(provenancePath, "utf8")).generatedAt, "2026-07-15T00:00:00.000Z");

      writeFileSync(provenancePath, "{}\n");
      const stale = run(["generated", "check", "--root", dir, "fixtures/projection-model.pkl"]);
      assert.notEqual(stale.status, 0);
      assert.match(stale.stderr, /stale projection provenance: localized-markdown/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("recovers stale Projection generation locks without overriding live owners", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-projection-unlock-"));
    const lock = join(dir, ".dspec-projection.lock");
    const writeOwner = (pid, token) => {
      const now = new Date().toISOString();
      mkdirSync(lock);
      writeFileSync(join(lock, "owner.json"), `${JSON.stringify({
        schemaVersion: "2.0",
        token,
        pid,
        hostname: hostname(),
        acquiredAt: now,
        heartbeatAt: now,
        leaseMs: 900_000,
      }, null, 2)}\n`);
    };

    try {
      writeOwner(2_147_483_647, "stale-cli-owner");
      const stale = run(["generated", "unlock", "--json", "--root", dir]);
      assert.equal(stale.status, 0, stale.stderr);
      assert.equal(JSON.parse(stale.stdout).status, "recovered");
      assert.equal(existsSync(lock), false);

      writeOwner(process.pid, "live-cli-owner");
      const live = run(["generated", "unlock", "--root", dir]);
      assert.notEqual(live.status, 0);
      assert.match(live.stderr, /Projection generation lock has a live owner/);
      assert.equal(existsSync(lock), true);

      const forced = run(["generated", "unlock", "--json", "--force", "--root", dir]);
      assert.equal(forced.status, 0, forced.stderr);
      assert.equal(JSON.parse(forced.stdout).forced, true);
      assert.equal(existsSync(lock), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps generate projection JSON report fixture in sync", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-generate-report-"));
    try {
      const result = run([
        "generate",
        "--json",
        "--generated-at",
        "2026-07-15T00:00:00.000Z",
        "--root",
        dir,
        "fixtures/projection-model.pkl",
      ]);
      const expected = readFileSync(join(root, "fixtures", "reports", "generate-projection.json"), "utf8");

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, expected);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps generated check projection JSON report fixture in sync", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-generated-check-report-"));
    try {
      const generated = run([
        "generate",
        "--generated-at",
        "2026-07-15T00:00:00.000Z",
        "--root",
        dir,
        "fixtures/projection-model.pkl",
      ]);
      const result = run(["generated", "check", "--json", "--root", dir, "fixtures/projection-model.pkl"]);
      const expected = readFileSync(join(root, "fixtures", "reports", "generated-check-projection.json"), "utf8");

      assert.equal(generated.status, 0, generated.stderr);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, expected);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects projection locale matrices without a locale output placeholder", () => {
    const result = run(["check", "fixtures/projection-invalid-template.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /projection output must contain exactly one \{locale\}: localized-markdown/);
  });

  it("checks dspec's localized projection artifacts", () => {
    const result = run(["generated", "check", "--json", "examples/dspec.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    const markdown = report.projections.find((projection) => projection.id === "self-markdown");
    assert.ok(markdown);
    assert.deepEqual(
      markdown.artifacts.map((artifact) => artifact.locale),
      ["en", "ja"],
    );
  });

  it("checks sample webapp localized projection artifacts", () => {
    const result = run(["generated", "check", "--json", "examples/sample-webapp-2026.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.summary.projections, 1);
    assert.equal(report.summary.artifacts, 2);
    assert.deepEqual(
      report.projections[0].artifacts.map((artifact) => artifact.locale),
      ["en", "ja"],
    );
  });

  it("dogfoods single-locale and monorepo Projection holdouts", () => {
    const cases = [
      ["fixtures/projection-holdout-single-locale.pkl", 1, 1, 2],
      ["fixtures/projection-holdout-monorepo.pkl", 2, 4, 6],
    ];

    for (const [file, projections, artifacts, initialChanges] of cases) {
      const dir = mkdtempSync(join(tmpdir(), "dspec-projection-holdout-"));
      try {
        const preview = run([
          "generate",
          "--dry-run",
          "--json",
          "--generated-at",
          "2026-07-15T00:00:00.000Z",
          "--root",
          dir,
          file,
        ]);
        assert.equal(preview.status, 0, `${file}\n${preview.stderr}`);
        assert.equal(JSON.parse(preview.stdout).changed, initialChanges);
        assert.equal(existsSync(join(dir, "generated")), false);

        const generated = run([
          "generate",
          "--json",
          "--generated-at",
          "2026-07-15T00:00:00.000Z",
          "--root",
          dir,
          file,
        ]);
        assert.equal(generated.status, 0, `${file}\n${generated.stderr}`);
        const generatedReport = JSON.parse(generated.stdout);
        assert.equal(generatedReport.summary.projections, projections);
        assert.equal(generatedReport.summary.artifacts, artifacts);

        const checked = run(["generated", "check", "--json", "--root", dir, file]);
        assert.equal(checked.status, 0, `${file}\n${checked.stderr}`);
        assert.equal(JSON.parse(checked.stdout).summary.provenance, projections);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("keeps generated source map artifact in sync", () => {
    const emitted = run(["emit", "source-map", "--locale", "ja", "examples/dspec.pkl"]);
    const artifact = readFileSync(join(root, "generated", "source-map.json"), "utf8");

    assert.equal(emitted.status, 0, emitted.stderr);
    assert.equal(artifact, emitted.stdout);
  });

  it("keeps generated manifest artifact in sync", () => {
    const emitted = run(["emit", "generated-manifest", "--locale", "ja", "examples/dspec.pkl"]);
    const artifact = readFileSync(join(root, "generated", "manifest.json"), "utf8");

    assert.equal(emitted.status, 0, emitted.stderr);
    assert.equal(artifact, emitted.stdout);
  });

  it("splits fast and formal GitHub Actions gates with caches", () => {
    const source = readFileSync(join(root, ".github", "workflows", "check.yml"), "utf8");
    const taskfile = readFileSync(join(root, "Taskfile.pkl"), "utf8");

    assert.match(source, /^  fast:/m);
    assert.match(source, /^  formal:/m);
    assert.match(source, /cache: "pnpm"/);
    assert.match(source, /magic-nix-cache-action@[a-f0-9]{40}/);
    assert.match(source, /pkf run check:fast/);
    assert.match(source, /nix develop path:\$PWD -c pkf run check:formal/);
    assert.match(source, /cancel-in-progress: \$\{\{ github\.ref != 'refs\/heads\/main' \}\}/);
    assert.match(taskfile, /name = "check:fast"/);
    assert.match(taskfile, /name = "check:formal"/);
  });

  it("declares formal backend tools in Nix devShell", () => {
    const source = readFileSync(join(root, "flake.nix"), "utf8");

    for (const packageName of ["nodejs_24", "pnpm", "pkl", "elan", "z3", "tlaplus", "alloy6"]) {
      assert.match(source, new RegExp(`\\b${packageName}\\b`));
    }
    assert.match(source, /nixpkgs-weekly/);
  });

  it("emits devShell tool smoke reports", () => {
    const result = run(["devshell-smoke", "--json"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.match(report.status, /^(pass|fail)$/);
    for (const tool of ["node", "pnpm", "pkl", "pkf", "lean", "z3", "tlasany", "tlc", "alloy6"]) {
      assert.ok(report.tools.some((entry) => entry.name === tool), tool);
    }
    assert.equal(report.summary.required, 9);
    assert.equal(report.summary.formalRequired, 5);
  });

  it("requires formal backend tools when requested", () => {
    const result = run(["verify-generated", "--json", "--require-formal-tools", "fixtures/typed-ast.pkl"]);
    const report = JSON.parse(result.stdout);
    const skipped = [report.backends.lean, report.backends.tlaSany, report.backends.tlaTlc, report.backends.alloyAnalyzer]
      .filter((backend) => backend.status === "skip");

    if (skipped.length > 0) {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /required formal backend skipped/);
    } else {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(report.backends.tlaSany.status, "pass");
      assert.equal(report.backends.tlaTlc.status, "pass");
      assert.equal(report.backends.alloyAnalyzer.status, "pass");
    }
  });

  it("declares a dogfood task for self-spec evaluation", () => {
    const source = readFileSync(join(root, "Taskfile.pkl"), "utf8");

    assert.match(source, /name = "devshell:check"/);
    assert.match(source, /name = "devshell:tools"/);
    assert.match(source, /name = "devshell:formal"/);
    assert.match(source, /devshell-smoke --json --strict --require-store-path/);
    assert.match(source, /verify-generated --require-formal-tools fixtures\/typed-ast\.pkl/);
    assert.match(source, /evidence create --require-formal-tools .* fixtures\/typed-ast\.pkl/);
    assert.match(source, /node --test --test-name-pattern='Lean eq\|composed Lean implication' test\/cli\.test\.mjs/);
    assert.match(source, /name = "dogfood"/);
    assert.match(source, /name = "spec-reading:dogfood"/);
    assert.match(source, /name = "spec-reading:report-fixtures"/);
    assert.match(source, /verify-runtime-evidence --json/);
    assert.match(source, /runtime-collector-fixture/);
    assert.match(source, /sample-webapp-2026\.pkl/);
    assert.match(source, /domain-coverage --json examples\/sample-webapp-2026\.pkl/);
    assert.match(source, /import-real-app --json fixtures\/sample-webapp-2026/);
    assert.match(source, /reconcile-real-app --json examples\/sample-webapp-2026\.pkl/);
    assert.match(source, /reverse-coverage --json examples\/sample-webapp-2026\.pkl/);
    assert.match(source, /check-app-profile --json fixtures\/sample-webapp-profile\.pkl/);
    assert.match(source, /scaffold-app-profile --diff fixtures\/sample-webapp-profile\.pkl --json/);
    assert.match(source, /scaffold-app-profile --apply fixtures\/sample-webapp-profile\.pkl --json --dry-run/);
    assert.match(source, /evaluate-app-profile --json fixtures\/sample-webapp-profile-scenarios\.pkl/);
    assert.match(source, /evaluate-app-profile --json fixtures\/sample-webapp-profile-extended-scenarios\.pkl/);
    assert.match(source, /evaluate-app-profile --markdown fixtures\/sample-webapp-profile-extended-scenarios\.pkl/);
    assert.match(source, /coverage-app-profile-scenarios --json fixtures\/sample-webapp-profile-extended-scenarios\.pkl/);
    assert.match(source, /score-app-profile-mutations --json fixtures\/sample-webapp-profile-extended-scenarios\.pkl/);
    assert.match(source, /score-app-profile-mutations --json fixtures\/holdout-mixed-profile\.pkl/);
    assert.match(source, /score-app-profile-mutations --json fixtures\/holdout-mixed-noisy-profile\.pkl/);
    assert.match(source, /replay-app-profile-changes --json fixtures\/app-change-replay-corpus\.pkl/);
    assert.match(source, /spec-reading-eval --json fixtures\/spec-reading-eval-sample-webapp\.pkl/);
    assert.match(source, /spec-reading-eval --json fixtures\/spec-reading-eval-holdout-runtime\.pkl/);
    assert.match(source, /spec-reading-eval-suite --json fixtures\/spec-reading-eval-suite\.pkl/);
    assert.match(source, /spec-reading-eval --prompt fixtures\/spec-reading-eval-sample-webapp\.pkl/);
    assert.match(source, /spec-reading-eval --prompt --locale en fixtures\/spec-reading-eval-sample-webapp\.pkl/);
    assert.match(source, /spec-reading-eval --json --refresh-digests fixtures\/spec-reading-eval-stale-digest\.pkl/);
    assert.match(source, /spec-reading-eval --json --score fixtures\/spec-reading-eval-answers\.json --write-run \/tmp\/dspec-spec-reading-run\.json fixtures\/spec-reading-eval-sample-webapp\.pkl/);
    assert.match(source, /spec-reading-eval --markdown --score fixtures\/spec-reading-eval-answers\.json fixtures\/spec-reading-eval-sample-webapp\.pkl/);
    assert.match(source, /spec-reading-eval --json fixtures\/spec-reading-eval-stale-digest\.pkl/);
    assert.match(source, /spec-reading-eval --json fixtures\/spec-reading-eval-rubric-mismatch\.pkl/);
    assert.match(source, /coverage-spec-reading-eval-suite --json fixtures\/spec-reading-eval-suite\.pkl/);
    assert.match(source, /coverage-spec-reading-eval-suite --json fixtures\/spec-reading-eval-suite-undercovered\.pkl/);
    assert.match(source, /metamorphic-spec-reading-eval --json fixtures\/spec-reading-eval-sample-webapp\.pkl/);
    assert.match(source, /cd \/tmp && node \$OLDPWD\/src\/cli\.mjs spec-reading-eval --json \$OLDPWD\/fixtures\/spec-reading-eval-sample-webapp\.pkl/);
    assert.match(source, /cd \/tmp && node \$OLDPWD\/src\/cli\.mjs spec-reading-eval-suite --json \$OLDPWD\/fixtures\/spec-reading-eval-suite\.pkl/);
    assert.match(source, /spec-change compat --json fixtures\/compat-before\.pkl fixtures\/compat-narrowing-after\.pkl/);
    assert.match(source, /spec-change scaffold fixtures\/compat-before\.pkl fixtures\/compat-narrowing-after\.pkl/);
    assert.match(source, /spec-change scaffold --json fixtures\/compat-before\.pkl fixtures\/compat-breaking-after\.pkl/);
    assert.match(source, /spec-change --help/);
    assert.match(source, /spec-change scaffold --help/);
    assert.match(source, /spec-change scaffold --output \/tmp\/dspec-spec-change-review\.pkl fixtures\/compat-before\.pkl fixtures\/compat-narrowing-after\.pkl/);
    assert.match(source, /cd \/tmp && node \$OLDPWD\/src\/cli\.mjs spec-change review --json \/tmp\/dspec-spec-change-review\.pkl/);
    assert.match(source, /spec-change review --json fixtures\/spec-change-review\.pkl/);
    assert.match(source, /spec-change review --json fixtures\/spec-change-review-breaking-approved\.pkl/);
    assert.match(source, /check-app-profile-suite --json fixtures\/sample-webapp-profile-suite\.pkl/);
    assert.match(source, /evaluate-app-profile-suite --json fixtures\/sample-webapp-profile-suite\.pkl/);
  });

  it("declares an app profile refresh task", () => {
    const source = readFileSync(join(root, "Taskfile.pkl"), "utf8");

    assert.match(source, /name = "app-profile:refresh"/);
    assert.match(source, /check-app-profile --fix fixtures\/sample-webapp-profile\.pkl/);
  });

  it("emits typed Clause.ast into backend projections", () => {
    const quickcheck = run(["emit", "quickcheck", "fixtures/typed-ast.pkl"]);
    const lean = run(["emit", "lean", "fixtures/typed-ast.pkl"]);
    const tla = run(["emit", "tla", "fixtures/typed-ast.pkl"]);

    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.equal(lean.status, 0, lean.stderr);
    assert.equal(tla.status, 0, tla.stderr);
    assert.match(quickcheck.stdout, /"ast": \{\n\s+"op": "atom",\n\s+"name": "approvedHasAutomatedCheck"/);
    assert.match(quickcheck.stdout, /export const clauseAstSemanticsVersion = "1\.0"/);
    assert.match(quickcheck.stdout, /"astSemanticsVersion": "1\.0"/);
    assert.match(lean.stdout, /def clauseAstSemanticsVersion : String := "1\.0"/);
    assert.match(lean.stdout, /Expr\.atom "approvedHasAutomatedCheck" \["rule"\]/);
    assert.match(tla.stdout, /ClauseAstSemanticsVersion == "1\.0"/);
    assert.match(tla.stdout, /approvedHasAutomatedCheck\(rule\)/);
  });

  it("emits DB model pattern into backend projections", () => {
    const markdown = run(["emit", "markdown", "--locale", "ja", "fixtures/db-model.pkl"]);
    const quickcheck = run(["emit", "quickcheck", "fixtures/db-model.pkl"]);
    const alloy = run(["emit", "alloy", "fixtures/db-model.pkl"]);
    const tla = run(["emit", "tla", "fixtures/db-model.pkl"]);
    const sourceMap = run(["emit", "source-map", "--locale", "ja", "fixtures/db-model.pkl"]);

    assert.equal(markdown.status, 0, markdown.stderr);
    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.equal(alloy.status, 0, alloy.stderr);
    assert.equal(tla.status, 0, tla.stderr);
    assert.equal(sourceMap.status, 0, sourceMap.stderr);

    assert.match(markdown.stdout, /## Database Model/);
    assert.match(markdown.stdout, /### Table orders/);
    assert.match(markdown.stdout, /### Transaction pay-order/);
    assert.match(markdown.stdout, /### Migration v2-add-payments/);
    assert.match(quickcheck.stdout, /export const dbModel =/);
    assert.match(quickcheck.stdout, /propertyDbTransactionsPreserveInvariants/);
    assert.match(quickcheck.stdout, /propertyDbMigrationsPreserveInvariants/);
    assert.match(quickcheck.stdout, /propertyDbMigrationMappingsCoverInvariants/);
    assert.match(quickcheck.stdout, /propertyDbMigrationMappingExpressionsMentionTables/);
    assert.match(alloy.stdout, /abstract sig DbTable/);
    assert.match(alloy.stdout, /abstract sig DbMigration/);
    assert.match(alloy.stdout, /abstract sig DbMapping/);
    assert.match(alloy.stdout, /one sig DBT_orders extends DbTable/);
    assert.match(alloy.stdout, /one sig DBM_v2_add_payments extends DbMigration/);
    assert.match(alloy.stdout, /one sig DBMAP_v2_add_payments_paid_orders_create_payments extends DbMapping/);
    assert.match(tla.stdout, /DbTransactions == \{"pay-order"\}/);
    assert.match(tla.stdout, /DbMigrations == \{"v2-add-payments"\}/);
    assert.match(tla.stdout, /DbInvariantPreserved ==/);
    assert.match(tla.stdout, /DbMigrationPreserved ==/);
    assert.match(tla.stdout, /DbMigrationMappingCovered ==/);
    assert.match(tla.stdout, /DbMigrationMappingRefsMentionTables ==/);
    assert.deepEqual(validateGeneratedAlloy(alloy.stdout), []);
    assert.deepEqual(validateGeneratedTla(tla.stdout), []);

    const map = JSON.parse(sourceMap.stdout);
    assert.ok(map.artifacts.quickcheck.some((entry) => entry.generated === "quickcheck.db.transactions.pay-order"));
    assert.ok(map.artifacts.quickcheck.some((entry) => entry.generated === "quickcheck.db.migrations.v2-add-payments"));
    assert.ok(map.artifacts.quickcheck.some((entry) => entry.generated === "quickcheck.db.migrations.v2-add-payments.mappings.paid-orders-create-payments"));
    assert.ok(map.artifacts.tla.some((entry) => entry.generated === "tla.DbTransactions[pay-order]"));
    assert.ok(map.artifacts.tla.some((entry) => entry.generated === "tla.DbMigrations[v2-add-payments]"));
  });

  it("emits Cloud topology pattern into backend projections", () => {
    const markdown = run(["emit", "markdown", "--locale", "ja", "fixtures/cloud-model.pkl"]);
    const quickcheck = run(["emit", "quickcheck", "fixtures/cloud-model.pkl"]);
    const alloy = run(["emit", "alloy", "fixtures/cloud-model.pkl"]);
    const tla = run(["emit", "tla", "fixtures/cloud-model.pkl"]);
    const sourceMap = run(["emit", "source-map", "--locale", "ja", "fixtures/cloud-model.pkl"]);

    assert.equal(markdown.status, 0, markdown.stderr);
    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.equal(alloy.status, 0, alloy.stderr);
    assert.equal(tla.status, 0, tla.stderr);
    assert.equal(sourceMap.status, 0, sourceMap.stderr);

    assert.match(markdown.stdout, /## Cloud Topology/);
    assert.match(markdown.stdout, /### Cloud Node api/);
    assert.match(markdown.stdout, /### Cloud Flow api-to-db/);
    assert.match(quickcheck.stdout, /export const cloudModel =/);
    assert.match(quickcheck.stdout, /propertyCloudPublicIngressBlocked/);
    assert.match(quickcheck.stdout, /propertyCloudResourceAccessHasPolicy/);
    assert.match(quickcheck.stdout, /propertyCloudTenantFlowsPropagateTenant/);
    assert.match(quickcheck.stdout, /propertyCloudQueuePublishesHaveIdempotencyKey/);
    assert.match(alloy.stdout, /abstract sig CloudNode/);
    assert.match(alloy.stdout, /one sig CN_api extends CloudNode/);
    assert.match(tla.stdout, /CloudFlows ==/);
    assert.match(tla.stdout, /CloudPublicIngressBlocked ==/);
    assert.match(tla.stdout, /CloudResourceAccessHasPolicy ==/);
    assert.deepEqual(validateGeneratedAlloy(alloy.stdout), []);
    assert.deepEqual(validateGeneratedTla(tla.stdout), []);

    const map = JSON.parse(sourceMap.stdout);
    assert.ok(map.artifacts.quickcheck.some((entry) => entry.generated === "quickcheck.cloud.flows.api-to-db"));
    assert.ok(map.artifacts.tla.some((entry) => entry.generated === "tla.CloudFlows[api-to-db]"));
  });

  it("emits Data governance pattern into backend projections", () => {
    const markdown = run(["emit", "markdown", "--locale", "ja", "fixtures/data-model.pkl"]);
    const quickcheck = run(["emit", "quickcheck", "fixtures/data-model.pkl"]);
    const alloy = run(["emit", "alloy", "fixtures/data-model.pkl"]);
    const tla = run(["emit", "tla", "fixtures/data-model.pkl"]);
    const sourceMap = run(["emit", "source-map", "--locale", "ja", "fixtures/data-model.pkl"]);

    assert.equal(markdown.status, 0, markdown.stderr);
    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.equal(alloy.status, 0, alloy.stderr);
    assert.equal(tla.status, 0, tla.stderr);
    assert.equal(sourceMap.status, 0, sourceMap.stderr);

    assert.match(markdown.stdout, /## Data Governance/);
    assert.match(markdown.stdout, /### Data Set customer-profile/);
    assert.match(markdown.stdout, /### Data Flow customer-profile-to-analytics/);
    assert.match(quickcheck.stdout, /export const dataModel =/);
    assert.match(quickcheck.stdout, /propertyDataSensitivePlacementsEncrypted/);
    assert.match(quickcheck.stdout, /propertyDataPersonalPlacementsSupportDeletion/);
    assert.match(quickcheck.stdout, /propertyDataCrossRegionFlowsHaveLegalBasis/);
    assert.match(quickcheck.stdout, /propertyDataRetentionWithinPolicy/);
    assert.match(alloy.stdout, /abstract sig DataSet/);
    assert.match(alloy.stdout, /one sig DS_customer_profile extends DataSet/);
    assert.match(tla.stdout, /DataFlows ==/);
    assert.match(tla.stdout, /DataSensitivePlacementsEncrypted ==/);
    assert.match(tla.stdout, /DataCrossRegionFlowsHaveLegalBasis ==/);
    assert.deepEqual(validateGeneratedAlloy(alloy.stdout), []);
    assert.deepEqual(validateGeneratedTla(tla.stdout), []);

    const map = JSON.parse(sourceMap.stdout);
    assert.ok(map.artifacts.quickcheck.some((entry) => entry.generated === "quickcheck.data.flows.customer-profile-to-analytics"));
    assert.ok(map.artifacts.tla.some((entry) => entry.generated === "tla.DataFlows[customer-profile-to-analytics]"));
  });

  it("emits Release safety pattern into backend projections", () => {
    const markdown = run(["emit", "markdown", "--locale", "ja", "fixtures/release-model.pkl"]);
    const quickcheck = run(["emit", "quickcheck", "fixtures/release-model.pkl"]);
    const alloy = run(["emit", "alloy", "fixtures/release-model.pkl"]);
    const tla = run(["emit", "tla", "fixtures/release-model.pkl"]);
    const sourceMap = run(["emit", "source-map", "--locale", "ja", "fixtures/release-model.pkl"]);

    assert.equal(markdown.status, 0, markdown.stderr);
    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.equal(alloy.status, 0, alloy.stderr);
    assert.equal(tla.status, 0, tla.stderr);
    assert.equal(sourceMap.status, 0, sourceMap.stderr);

    assert.match(markdown.stdout, /## Release Safety/);
    assert.match(markdown.stdout, /### Release Step prod-canary/);
    assert.match(quickcheck.stdout, /export const releaseModel =/);
    assert.match(quickcheck.stdout, /propertyReleaseProductionStepsHaveHealthGate/);
    assert.match(quickcheck.stdout, /propertyReleaseTrafficShiftsHaveRollback/);
    assert.match(quickcheck.stdout, /propertyReleaseRollbackPlansAreTested/);
    assert.match(quickcheck.stdout, /propertyReleaseMigrationsAreBackwardCompatible/);
    assert.match(alloy.stdout, /abstract sig ReleaseStep/);
    assert.match(alloy.stdout, /one sig RS_prod_canary extends ReleaseStep/);
    assert.match(tla.stdout, /ReleaseSteps ==/);
    assert.match(tla.stdout, /ReleaseProductionStepsHaveHealthGate ==/);
    assert.match(tla.stdout, /ReleaseTrafficShiftsHaveRollback ==/);
    assert.deepEqual(validateGeneratedAlloy(alloy.stdout), []);
    assert.deepEqual(validateGeneratedTla(tla.stdout), []);

    const map = JSON.parse(sourceMap.stdout);
    assert.ok(map.artifacts.quickcheck.some((entry) => entry.generated === "quickcheck.release.steps.prod-canary"));
    assert.ok(map.artifacts.tla.some((entry) => entry.generated === "tla.ReleaseSteps[prod-canary]"));
  });

  it("emits Runtime safety pattern into backend projections", () => {
    const markdown = run(["emit", "markdown", "--locale", "ja", "fixtures/runtime-model.pkl"]);
    const quickcheck = run(["emit", "quickcheck", "fixtures/runtime-model.pkl"]);
    const alloy = run(["emit", "alloy", "fixtures/runtime-model.pkl"]);
    const tla = run(["emit", "tla", "fixtures/runtime-model.pkl"]);
    const sourceMap = run(["emit", "source-map", "--locale", "ja", "fixtures/runtime-model.pkl"]);

    assert.equal(markdown.status, 0, markdown.stderr);
    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.equal(alloy.status, 0, alloy.stderr);
    assert.equal(tla.status, 0, tla.stderr);
    assert.equal(sourceMap.status, 0, sourceMap.stderr);

    assert.match(markdown.stdout, /## Runtime Safety/);
    assert.match(markdown.stdout, /### Runtime SLO checkout-availability/);
    assert.match(markdown.stdout, /### Runtime Dependency checkout-api-to-payments/);
    assert.match(markdown.stdout, /### Runtime Telemetry checkout-availability-30d/);
    assert.match(markdown.stdout, /### Runtime Alert Policy checkout-availability-pagerduty/);
    assert.match(markdown.stdout, /### Runtime Runbook Execution checkout-page-runbook-2026-07-08/);
    assert.match(markdown.stdout, /### Runtime Dependency Trace checkout-api-to-payments-p95/);
    assert.match(quickcheck.stdout, /export const runtimeModel =/);
    assert.match(quickcheck.stdout, /propertyRuntimeCriticalSlosHavePageAlert/);
    assert.match(quickcheck.stdout, /propertyRuntimePageAlertsHaveTestedRunbook/);
    assert.match(quickcheck.stdout, /propertyRuntimeDependenciesHaveTimeout/);
    assert.match(quickcheck.stdout, /propertyRuntimeRetriesAreIdempotent/);
    assert.match(quickcheck.stdout, /propertyRuntimeSlosHaveTelemetry/);
    assert.match(quickcheck.stdout, /propertyRuntimeTelemetryMeetsSlo/);
    assert.match(quickcheck.stdout, /propertyRuntimePageAlertsHaveEnabledPolicy/);
    assert.match(quickcheck.stdout, /propertyRuntimePageAlertsHaveExecutedRunbook/);
    assert.match(quickcheck.stdout, /propertyRuntimeDependencyTracesWithinTimeout/);
    assert.match(alloy.stdout, /abstract sig RuntimeSlo/);
    assert.match(alloy.stdout, /abstract sig RuntimeTelemetry/);
    assert.match(alloy.stdout, /one sig RSLO_checkout_availability extends RuntimeSlo/);
    assert.match(alloy.stdout, /one sig RTELEM_checkout_availability_30d extends RuntimeTelemetry/);
    assert.match(tla.stdout, /RuntimeSlos ==/);
    assert.match(tla.stdout, /RuntimeTelemetry ==/);
    assert.match(tla.stdout, /RuntimeCriticalSlosHavePageAlert ==/);
    assert.match(tla.stdout, /RuntimeRetriesAreIdempotent ==/);
    assert.match(tla.stdout, /RuntimeTelemetryMeetsSlo ==/);
    assert.deepEqual(validateGeneratedAlloy(alloy.stdout), []);
    assert.deepEqual(validateGeneratedTla(tla.stdout), []);

    const map = JSON.parse(sourceMap.stdout);
    assert.ok(map.artifacts.quickcheck.some((entry) => entry.generated === "quickcheck.runtime.slos.checkout-availability"));
    assert.ok(map.artifacts.quickcheck.some((entry) => entry.generated === "quickcheck.runtime.telemetry.checkout-availability-30d"));
    assert.ok(map.artifacts.quickcheck.some((entry) => entry.generated === "quickcheck.runtime.dependencyTraces.checkout-api-to-payments-p95"));
    assert.ok(map.artifacts.tla.some((entry) => entry.generated === "tla.RuntimeSlos[checkout-availability]"));
    assert.ok(map.artifacts.runtimeCollector.some((entry) => entry.generated === "runtimeCollector.sources.prometheus.telemetry.checkout-availability-30d"));
  });

  it("emits Intent processes into human and executable projections", () => {
    const markdown = run(["emit", "markdown", "--locale", "ja", "fixtures/intent-process.pkl"]);
    const quickcheck = run(["emit", "quickcheck", "fixtures/intent-process.pkl"]);
    const alloy = run(["emit", "alloy", "fixtures/intent-process.pkl"]);
    const tla = run(["emit", "tla", "fixtures/intent-process.pkl"]);
    const tlaCfg = run(["emit", "tla-cfg", "fixtures/intent-process.pkl"]);
    const sourceMap = run(["emit", "source-map", "--locale", "ja", "fixtures/intent-process.pkl"]);

    assert.equal(markdown.status, 0, markdown.stderr);
    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.equal(alloy.status, 0, alloy.stderr);
    assert.equal(tla.status, 0, tla.stderr);
    assert.equal(tlaCfg.status, 0, tlaCfg.stderr);
    assert.equal(sourceMap.status, 0, sourceMap.stderr);

    assert.match(markdown.stdout, /## Intent Model/);
    assert.match(markdown.stdout, /### Process request\.approve/);
    assert.match(markdown.stdout, /### Construction Authority request\.approve-constructs-approved/);
    assert.match(markdown.stdout, /### Scenario request-approval/);
    assert.match(quickcheck.stdout, /export const intentModel =/);
    assert.match(quickcheck.stdout, /generateIntentProcesses/);
    assert.match(quickcheck.stdout, /generateIntentScenarios/);
    assert.match(quickcheck.stdout, /propertyIntentProcessConstructionIsAuthorized/);
    assert.match(quickcheck.stdout, /propertyIntentScenarioTraceIsContinuous/);
    assert.match(alloy.stdout, /abstract sig IntentOutcome/);
    assert.match(alloy.stdout, /one sig IO_request_approved extends IntentOutcome/);
    assert.match(alloy.stdout, /assert IntentProcessConstructionIsAuthorized/);
    assert.match(tla.stdout, /IntentOutcomes ==/);
    assert.match(tla.stdout, /IntentProcessConstructionIsAuthorized ==/);
    assert.match(tla.stdout, /IntentScenarioTraceIsContinuous ==/);
    assert.match(tlaCfg.stdout, /INVARIANT IntentProcessConstructionIsAuthorized/);
    assert.match(tlaCfg.stdout, /INVARIANT IntentScenarioTraceIsContinuous/);
    assert.deepEqual(validateGeneratedAlloy(alloy.stdout), []);
    assert.deepEqual(validateGeneratedTla(tla.stdout), []);

    const map = JSON.parse(sourceMap.stdout);
    assert.ok(map.artifacts.quickcheck.some((entry) => entry.generated === "quickcheck.intent.processes.request.approve"));
    assert.ok(map.artifacts.tla.some((entry) => entry.generated === "tla.IntentOutcomes[request.approved]"));
    assert.ok(map.artifacts.alloy.some((entry) => entry.generated === "alloy.sig.IO_request_approved"));
  });

  it("validates typed Intent input and outcome contracts", () => {
    const valid = run(["check", "fixtures/intent-contract.pkl"]);
    const invalid = run(["check", "fixtures/intent-contract-invalid-field.pkl"]);
    const invalidRefinement = run(["check", "fixtures/intent-contract-invalid-refinement.pkl"]);

    assert.equal(valid.status, 0, valid.stderr);
    assert.notEqual(invalid.status, 0);
    assert.notEqual(invalidRefinement.status, 0);
    assert.match(invalid.stderr, /intent contract minimum exceeds maximum: request\.approve input\.amountCents/);
    assert.match(invalidRefinement.stderr, /intent refinement missing required field binding: request\.approve\.request\.approve-handler input -> amountCents/);
  });

  it("verifies observed Intent traces through a declared refinement mapping", () => {
    const result = run([
      "intent",
      "verify",
      "--json",
      "fixtures/intent-contract.pkl",
      "fixtures/intent-traces.json",
    ]);
    const markdown = run([
      "intent",
      "verify",
      "--markdown",
      "fixtures/intent-contract.pkl",
      "fixtures/intent-traces.json",
    ]);
    const schema = run(["intent", "schema", "fixtures/intent-contract.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(markdown.status, 0, markdown.stderr);
    assert.equal(schema.status, 0, schema.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.summary.traces, 1);
    assert.equal(report.summary.steps, 1);
    assert.deepEqual(
      report.evidence.checks.map((check) => check.id),
      ["intent-static-contract", "intent-refinement-reference", "intent-observed-trace"],
    );
    assert.match(markdown.stdout, /# Intent Trace Verification intent-contract-fixture/);
    assert.match(markdown.stdout, /request-approve-001/);
    const traceSchema = JSON.parse(schema.stdout);
    assert.equal(traceSchema.model.id, "intent-contract-fixture");
    assert.equal(traceSchema.traces.items.properties.steps.items.properties.refinement.type, "string");
  });

  it("checks the declared Intent scenario corpus and proposes missing cases", () => {
    const incomplete = run([
      "intent",
      "corpus",
      "--json",
      "fixtures/intent-contract.pkl",
      "fixtures/intent-traces-corpus-incomplete.json",
    ]);
    const complete = run([
      "intent",
      "corpus",
      "--json",
      "fixtures/intent-contract.pkl",
      "fixtures/intent-traces-corpus-complete.json",
    ]);
    const markdown = run([
      "intent",
      "corpus",
      "--markdown",
      "fixtures/intent-contract.pkl",
      "fixtures/intent-traces-corpus-incomplete.json",
    ]);
    const schema = run(["intent", "schema", "fixtures/intent-contract.pkl"]);
    const modelMarkdown = run(["emit", "markdown", "--locale", "en", "fixtures/intent-contract.pkl"]);
    const quickcheck = run(["emit", "quickcheck", "fixtures/intent-contract.pkl"]);

    assert.notEqual(incomplete.status, 0);
    const incompleteReport = JSON.parse(incomplete.stdout);
    assert.equal(incompleteReport.status, "fail");
    assert.equal(incompleteReport.summary.required, 2);
    assert.equal(incompleteReport.summary.covered, 1);
    assert.deepEqual(incompleteReport.missing.map((scenario) => scenario.id), ["request-rejection"]);
    assert.deepEqual(incompleteReport.suggestions, [{
      scenario: "request-rejection",
      initialState: "request.pending",
      expectedState: "request.not-authorized",
      steps: [{ process: "request.approve", outcome: "request.not-authorized" }],
      reason: "required declared scenario has no matching observed trace",
    }]);
    assert.match(incompleteReport.errors.join("\n"), /missing required Intent scenario trace: request-rejection/);

    assert.equal(complete.status, 0, complete.stderr);
    const completeReport = JSON.parse(complete.stdout);
    assert.equal(completeReport.status, "pass");
    assert.equal(completeReport.summary.coverage, 1);
    assert.equal(completeReport.observations.length, 2);

    assert.notEqual(markdown.status, 0);
    assert.match(markdown.stdout, /# Intent Scenario Corpus intent-contract-fixture/);
    assert.match(markdown.stdout, /request-rejection/);
    assert.match(markdown.stdout, /required declared scenario has no matching observed trace/);

    const traceSchema = JSON.parse(schema.stdout);
    assert.equal(traceSchema.traces.items.properties.scenario.type, "string");
    assert.equal(modelMarkdown.status, 0, modelMarkdown.stderr);
    assert.match(modelMarkdown.stdout, /### Scenario request-rejection/);
    assert.match(modelMarkdown.stdout, /- kind: `rejection`/);
    assert.match(modelMarkdown.stdout, /- required: `true`/);
    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.match(quickcheck.stdout, /"kind": "rejection"/);
    assert.match(quickcheck.stdout, /"required": true/);
  });

  it("resolves Intent access exceptions by explicit authority and precedence", () => {
    const access = run([
      "intent",
      "access",
      "--json",
      "fixtures/intent-contract.pkl",
      "request.approve",
      "role.manager",
    ]);
    const invalid = run(["check", "fixtures/intent-access-policy-invalid.pkl"]);
    const markdown = run(["emit", "markdown", "--locale", "en", "fixtures/intent-contract.pkl"]);
    const quickcheck = run(["emit", "quickcheck", "fixtures/intent-contract.pkl"]);

    assert.equal(access.status, 0, access.stderr);
    assert.deepEqual(JSON.parse(access.stdout), {
      decision: "deny",
      model: { id: "intent-contract-fixture", version: "0.1.0" },
      policy: {
        id: "request.approve-manager-deny-exception",
        overrides: ["request.approve-manager-allow"],
        priority: 200,
      },
      process: "request.approve",
      status: "pass",
      subject: "role.manager",
    });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /ambiguous intent access policy precedence: request\.approve -> role\.manager at priority 100/);
    assert.equal(markdown.status, 0, markdown.stderr);
    assert.match(markdown.stdout, /### Access Policy request\.approve-manager-deny-exception/);
    assert.match(markdown.stdout, /- decision: `deny`/);
    assert.match(markdown.stdout, /- overrides: `request\.approve-manager-allow`/);
    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.match(quickcheck.stdout, /propertyIntentAccessPolicyOverridesHaveHigherPriority/);
    assert.match(quickcheck.stdout, /propertyIntentAccessPoliciesResolveDeterministically/);
  });

  it("detects semantic implementation drift from explicit Intent bindings", () => {
    const passing = run([
      "intent",
      "bindings",
      "--json",
      "fixtures/intent-contract-semantic-http.pkl",
      "fixtures/intent-semantic-bindings-observed.json",
    ]);
    const drifting = run([
      "intent",
      "bindings",
      "--json",
      "fixtures/intent-contract-semantic-http.pkl",
      "fixtures/intent-semantic-bindings-drift.json",
    ]);
    const markdown = run(["emit", "markdown", "--locale", "en", "fixtures/intent-contract-semantic-http.pkl"]);
    const quickcheck = run(["emit", "quickcheck", "fixtures/intent-contract-semantic-http.pkl"]);

    assert.equal(passing.status, 0, passing.stderr);
    assert.deepEqual(JSON.parse(passing.stdout).summary, {
      matched: 2,
      missing: 0,
      observed: 2,
      required: 2,
      unmodeled: 0,
    });

    assert.notEqual(drifting.status, 0);
    const driftReport = JSON.parse(drifting.stdout);
    assert.deepEqual(driftReport.missing.map((binding) => binding.id), ["request.approve-otel-process"]);
    assert.deepEqual(driftReport.unmodeled, [{ kind: "cloud-resource", target: "approval-api", value: null }]);
    assert.match(driftReport.errors.join("\n"), /missing required semantic binding: request\.approve-otel-process/);
    assert.match(driftReport.errors.join("\n"), /unmodeled observed semantic binding: cloud-resource approval-api/);

    assert.equal(markdown.status, 0, markdown.stderr);
    assert.match(markdown.stdout, /### Semantic Binding request\.approve-http-route/);
    assert.match(markdown.stdout, /- kind: `http-route`/);
    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.match(quickcheck.stdout, /propertyIntentSemanticBindingsAreWellFormed/);
  });

  it("organizes natural-language Intent goals into claims, assurance tasks, and implementation bindings", () => {
    const checked = run(["check", "fixtures/intent-goal-graph.pkl"]);
    const graph = run(["intent", "graph", "--json", "fixtures/intent-goal-graph.pkl"]);
    const graphMarkdown = run(["intent", "graph", "--markdown", "--locale", "en", "fixtures/intent-goal-graph.pkl"]);
    const invalid = run(["check", "fixtures/intent-goal-graph-invalid.pkl"]);
    const markdown = run(["emit", "markdown", "--locale", "en", "fixtures/intent-goal-graph.pkl"]);
    const quickcheck = run(["emit", "quickcheck", "fixtures/intent-goal-graph.pkl"]);
    const sourceMap = run(["emit", "source-map", "fixtures/intent-goal-graph.pkl"]);

    assert.equal(checked.status, 0, checked.stderr);
    assert.equal(graph.status, 0, graph.stderr);
    assert.equal(graphMarkdown.status, 0, graphMarkdown.stderr);
    assert.deepEqual(JSON.parse(graph.stdout).summary, {
      bindings: 1,
      claims: 1,
      formalTasks: 1,
      goals: 1,
      implementationCoveredClaims: 1,
      intents: 1,
      taskCoveredClaims: 1,
      tasks: 2,
    });
    assert.match(graphMarkdown.stdout, /Only a manager can approve a request/);
    assert.match(graphMarkdown.stdout, /The authority model is bounded to the declared process and outcomes/);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /intent claim has no assurance task: request\.approve-unverified/);
    assert.match(invalid.stderr, /intent claim has no implementation binding: request\.approve-unverified/);
    assert.equal(markdown.status, 0, markdown.stderr);
    assert.match(markdown.stdout, /### Goal request-approval-safety/);
    assert.match(markdown.stdout, /### Claim request\.approve-manager-only/);
    assert.match(markdown.stdout, /### Assurance Task request\.approve-authority-alloy/);
    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.match(quickcheck.stdout, /propertyIntentClaimGraphIsComplete/);
    assert.equal(sourceMap.status, 0, sourceMap.stderr);
    const map = JSON.parse(sourceMap.stdout);
    assert.ok(map.artifacts.markdown.some((entry) =>
      entry.generated === "markdown.intent.goals.request-approval-safety" &&
      entry.source.path === "model.patterns.intent.goals[0]"
    ));
    assert.ok(map.artifacts.quickcheck.some((entry) =>
      entry.generated === "quickcheck.intent.claims.request.approve-manager-only" &&
      entry.source.path === "model.patterns.intent.claims[0]"
    ));
    assert.ok(map.artifacts.quickcheck.some((entry) =>
      entry.generated === "quickcheck.intent.assuranceTasks.request.approve-authority-alloy" &&
      entry.source.path === "model.patterns.intent.assuranceTasks[1]"
    ));
  });

  it("binds transaction and cloud implementation semantics to the same drift protocol", () => {
    const checked = run(["check", "fixtures/intent-contract-semantic-transaction-cloud.pkl"]);
    const alloy = run(["emit", "alloy", "fixtures/intent-contract-semantic-transaction-cloud.pkl"]);
    const verified = run([
      "intent",
      "bindings",
      "--json",
      "fixtures/intent-contract-semantic-transaction-cloud.pkl",
      "fixtures/intent-semantic-bindings-transaction-cloud.json",
    ]);

    assert.equal(checked.status, 0, checked.stderr);
    assert.equal(alloy.status, 0, alloy.stderr);
    assert.match(alloy.stdout, /DbModel\.dbPreserves = none -> none/);
    assert.match(alloy.stdout, /DbModel\.dbMigrationPreserves = none -> none/);
    assert.match(alloy.stdout, /CloudModel\.cloudFlowFrom = none -> none/);
    assert.match(alloy.stdout, /CloudModel\.cloudFlowTo = none -> none/);
    assert.equal(verified.status, 0, verified.stderr);
    assert.deepEqual(JSON.parse(verified.stdout).summary, {
      matched: 3,
      missing: 0,
      observed: 3,
      required: 3,
      unmodeled: 0,
    });
  });

  it("reports value and refinement drift in observed Intent traces", () => {
    const result = run([
      "intent",
      "verify",
      "--json",
      "fixtures/intent-contract.pkl",
      "fixtures/intent-traces-invalid.json",
    ]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.match(report.errors.join("\n"), /trace request-approve-invalid step 0 input: field amountCents expected integer/);
    assert.match(report.errors.join("\n"), /trace request-approve-invalid step 0 output: missing required field approvalId/);
  });

  it("executes function refinements against bounded Intent trace cases", () => {
    const passing = run([
      "intent",
      "exercise",
      "--json",
      "fixtures/intent-contract.pkl",
      "fixtures/intent-traces.json",
    ]);
    const failing = run([
      "intent",
      "exercise",
      "--json",
      "fixtures/intent-contract-broken-implementation.pkl",
      "fixtures/intent-traces.json",
    ]);
    const blocked = run([
      "intent",
      "exercise",
      "--json",
      "fixtures/intent-contract.pkl",
      "fixtures/intent-traces-invalid.json",
    ]);
    const timedOut = run([
      "intent",
      "exercise",
      "--json",
      "--timeout-ms",
      "150",
      "fixtures/intent-contract-timeout-implementation.pkl",
      "fixtures/intent-traces.json",
    ]);

    assert.equal(passing.status, 0, passing.stderr);
    const passReport = JSON.parse(passing.stdout);
    assert.equal(passReport.status, "pass");
    assert.equal(passReport.summary.executedRefinements, 1);
    assert.equal(passReport.evidence.checks.at(-1).id, "intent-executed-refinement");
    assert.equal(passReport.evidence.execution.runner, "node-permission-child-process");
    assert.equal(passReport.evidence.execution.timeoutMs, 5000);
    assert.equal(passReport.evidence.execution.permissions.fsWrite, false);
    assert.equal(passReport.evidence.execution.permissions.childProcess, false);
    assert.equal(passReport.evidence.execution.implementations.length, 1);
    assert.match(passReport.evidence.execution.implementations[0].digest, /^sha256:/);

    assert.notEqual(failing.status, 0);
    const failReport = JSON.parse(failing.stdout);
    assert.match(failReport.errors.join("\n"), /trace request-approve-001 step 0 refinement request\.approve-handler: output does not match observed trace/);

    assert.notEqual(blocked.status, 0);
    const blockedReport = JSON.parse(blocked.stdout);
    assert.equal(blockedReport.summary.executedRefinements, 0);
    assert.equal(blockedReport.evidence.checks.at(-1).status, "skip");

    assert.notEqual(timedOut.status, 0);
    const timeoutReport = JSON.parse(timedOut.stdout);
    assert.match(timeoutReport.errors.join("\n"), /execution timed out after 150ms/);
  });

  it("stores and verifies current Intent exercise evidence", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-intent-evidence-"));
    try {
      const reportFile = join(dir, "intent-exercise.json");
      const manifestFile = join(dir, "assurance.json");
      const exercised = run([
        "intent",
        "exercise",
        "--json",
        "--output",
        reportFile,
        "fixtures/intent-contract.pkl",
        "fixtures/intent-traces.json",
      ]);
      const created = run([
        "evidence",
        "create",
        "--json",
        "--intent-report",
        reportFile,
        "fixtures/intent-contract.pkl",
      ]);

      assert.equal(exercised.status, 0, exercised.stderr);
      assert.equal(created.status, 0, created.stderr);
      const manifest = JSON.parse(created.stdout).manifest;
      assert.equal(manifest.intentExercises.length, 1);
      assert.equal(manifest.intentExercises[0].execution.runner, "node-permission-child-process");
      writeFileSync(manifestFile, stableJson(manifest));

      const verified = run(["evidence", "verify", "--json", "fixtures/intent-contract.pkl", manifestFile]);
      assert.equal(verified.status, 0, verified.stderr);
      assert.equal(JSON.parse(verified.stdout).summary.intentExercises, 1);

      const refreshed = run([
        "evidence",
        "refresh",
        "--json",
        "--executed-at",
        "2026-07-16T12:00:00Z",
        "fixtures/intent-contract.pkl",
        manifestFile,
      ]);
      assert.equal(refreshed.status, 0, refreshed.stderr);
      assert.equal(JSON.parse(refreshed.stdout).manifest.intentExercises.length, 1);

      manifest.intentExercises[0].trace.digest = "sha256:stale";
      writeFileSync(manifestFile, stableJson(manifest));
      const stale = run(["evidence", "verify", "--json", "fixtures/intent-contract.pkl", manifestFile]);
      assert.notEqual(stale.status, 0);
      assert.match(JSON.parse(stale.stdout).errors.join("\n"), /stale Intent trace evidence digest/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("binds opt-in Intent execution policy observations into assurance evidence", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-intent-policy-evidence-"));
    try {
      const reportFile = join(dir, "intent-exercise.json");
      const manifestFile = join(dir, "assurance.json");
      const exercised = run([
        "intent",
        "exercise",
        "--json",
        "--policy",
        "--output",
        reportFile,
        "fixtures/intent-contract-execution-policy.pkl",
        "fixtures/intent-traces.json",
      ]);
      const created = run([
        "evidence",
        "create",
        "--json",
        "--intent-report",
        reportFile,
        "fixtures/intent-contract-execution-policy.pkl",
      ]);

      assert.equal(exercised.status, 0, exercised.stderr);
      assert.equal(created.status, 0, created.stderr);
      const manifest = JSON.parse(created.stdout).manifest;
      assert.equal(manifest.intentExercises[0].executionPolicy.status, "pass");
      assert.equal(manifest.intentExercises[0].executionPolicy.observations[0].pressure.maxInFlight, 2);
      writeFileSync(manifestFile, stableJson(manifest));

      const verified = run(["evidence", "verify", "--json", "fixtures/intent-contract-execution-policy.pkl", manifestFile]);
      assert.equal(verified.status, 0, verified.stderr);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps a skipped opt-in policy observation out of assurance evidence", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-intent-policy-skip-"));
    try {
      const reportFile = join(dir, "intent-exercise.json");
      const exercised = run([
        "intent",
        "exercise",
        "--json",
        "--policy",
        "--output",
        reportFile,
        "fixtures/intent-contract.pkl",
        "fixtures/intent-traces.json",
      ]);
      const created = run([
        "evidence",
        "create",
        "--json",
        "--intent-report",
        reportFile,
        "fixtures/intent-contract.pkl",
      ]);

      assert.equal(exercised.status, 0, exercised.stderr);
      assert.equal(JSON.parse(exercised.stdout).executionPolicy.status, "skip");
      assert.equal(created.status, 0, created.stderr);
      assert.equal(JSON.parse(created.stdout).manifest.intentExercises[0].executionPolicy, null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("executes HTTP route refinements against bounded Intent trace cases", async () => {
    const server = createServer(async (request, response) => {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/requests/approve");
      let body = "";
      for await (const chunk of request) body += chunk;
      assert.deepEqual(JSON.parse(body), {
        request_id: "request-001",
        amount_cents: 500,
        locale: "ja",
        notify: true,
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ approval_id: "approval-request-001", notified: true }));
    });
    try {
      const address = await listen(server);
      const result = await runAsync([
        "intent",
        "exercise",
        "--json",
        "--http-base-url",
        `http://127.0.0.1:${address.port}`,
        "fixtures/intent-contract-http.pkl",
        "fixtures/intent-traces.json",
      ]);

      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.status, "pass");
      assert.equal(report.evidence.execution.runner, "http-fetch");
      assert.deepEqual(report.evidence.execution.implementations[0].endpoint, {
        method: "POST",
        path: "/requests/approve",
        expectedStatus: 200,
      });
    } finally {
      server.close();
    }
  });

  it("replays an Intent execution policy against an HTTP endpoint with bounded client pressure", async () => {
    let requests = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    const server = createServer(async (request, response) => {
      requests += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        assert.equal(request.method, "POST");
        assert.equal(request.url, "/requests/approve");
        let body = "";
        for await (const chunk of request) body += chunk;
        assert.equal(JSON.parse(body).request_id, "request-001");
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 40));
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ approval_id: "approval-request-001", notified: true }));
      } finally {
        inFlight -= 1;
      }
    });
    try {
      const address = await listen(server);
      const result = await runAsync([
        "intent",
        "exercise",
        "--json",
        "--policy",
        "--http-base-url",
        `http://127.0.0.1:${address.port}`,
        "fixtures/intent-contract-execution-policy-http.pkl",
        "fixtures/intent-traces.json",
      ]);

      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.executionPolicy.status, "pass");
      assert.equal(report.executionPolicy.observations[0].pressure.maxObservedInFlight, 2);
      assert.equal(requests, 4);
      assert.equal(maxInFlight, 2);
    } finally {
      server.close();
    }
  });

  it("verifies Outcome effect postconditions and exercises transaction refinements", () => {
    const verified = run([
      "intent",
      "verify",
      "--json",
      "fixtures/intent-contract-effects-transaction.pkl",
      "fixtures/intent-traces-effects-transaction.json",
    ]);
    const schema = run(["intent", "schema", "fixtures/intent-contract-effects-transaction.pkl"]);
    const exercised = run([
      "intent",
      "exercise",
      "--json",
      "fixtures/intent-contract-effects-transaction.pkl",
      "fixtures/intent-traces-effects-transaction.json",
    ]);
    const missingEffect = run([
      "intent",
      "verify",
      "--json",
      "fixtures/intent-contract-effects-transaction.pkl",
      "fixtures/intent-traces-effects-missing.json",
    ]);
    const brokenTransaction = run([
      "intent",
      "exercise",
      "--json",
      "fixtures/intent-contract-effects-transaction-broken.pkl",
      "fixtures/intent-traces-effects-transaction.json",
    ]);

    assert.equal(verified.status, 0, verified.stderr);
    const traceReport = JSON.parse(verified.stdout);
    assert.equal(traceReport.summary.observedEffects, 1);
    assert.ok(traceReport.evidence.checks.some((check) => check.id === "intent-observed-effect" && check.status === "pass"));
    assert.equal(JSON.parse(schema.stdout).traces.items.properties.steps.items.properties.effects.type, "array");

    assert.equal(exercised.status, 0, exercised.stderr);
    const exerciseReport = JSON.parse(exercised.stdout);
    assert.equal(exerciseReport.evidence.execution.runner, "node-transaction-journal-child-process");
    assert.deepEqual(exerciseReport.executions[0].transaction, {
      id: "approve-request",
      isolation: "serializable",
      status: "committed",
      reads: ["requests"],
      writes: ["requests"],
      effects: [{ id: "request.approved.notification", output: { approval_id: "approval-request-001" } }],
    });

    assert.notEqual(missingEffect.status, 0);
    assert.match(JSON.parse(missingEffect.stdout).errors.join("\n"), /missing required effect request\.approved\.notification/);
    assert.notEqual(brokenTransaction.status, 0);
    assert.match(JSON.parse(brokenTransaction.stdout).errors.join("\n"), /undeclared transaction write: approvals/);
  });

  it("replays an Intent execution policy through transaction journal observations", () => {
    const result = run([
      "intent",
      "exercise",
      "--json",
      "--policy",
      "fixtures/intent-contract-execution-policy-transaction.pkl",
      "fixtures/intent-traces-effects-transaction.json",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    const observation = report.executionPolicy.observations[0];
    assert.equal(observation.status, "pass");
    assert.equal(observation.result.effectsMatchObserved, true);
    assert.equal(observation.invocations.length, 3);
    assert.ok(observation.invocations.every((invocation) => invocation.transaction.status === "committed"));
  });

  it("classifies adding a required Outcome effect as a narrowing change", () => {
    const result = run([
      "spec-change",
      "compat",
      "--json",
      "fixtures/intent-contract.pkl",
      "fixtures/intent-contract-effects-transaction.pkl",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.classification, "narrowing");
    assert.ok(report.decisions.some((decision) => decision.change === "intent-outcome:request.approved:modified" && decision.classification === "narrowing"));
  });

  it("measures Intent trace coverage and detects generated trace mutations", () => {
    const coverage = run([
      "intent",
      "coverage",
      "--json",
      "fixtures/intent-contract-effects-transaction.pkl",
      "fixtures/intent-traces-effects-complete.json",
    ]);
    const incompleteCoverage = run([
      "intent",
      "coverage",
      "--json",
      "fixtures/intent-contract-effects-transaction.pkl",
      "fixtures/intent-traces-effects-transaction.json",
    ]);
    const mutations = run([
      "intent",
      "mutation",
      "--json",
      "fixtures/intent-contract-effects-transaction.pkl",
      "fixtures/intent-traces-effects-complete.json",
    ]);
    const markdown = run([
      "intent",
      "mutation",
      "--markdown",
      "fixtures/intent-contract-effects-transaction.pkl",
      "fixtures/intent-traces-effects-complete.json",
    ]);

    assert.equal(coverage.status, 0, coverage.stderr);
    const coverageReport = JSON.parse(coverage.stdout);
    assert.equal(coverageReport.status, "pass");
    assert.equal(coverageReport.summary.targets, 13);
    assert.equal(coverageReport.summary.covered, 13);
    assert.equal(coverageReport.summary.coverage, 1);

    assert.notEqual(incompleteCoverage.status, 0);
    const incompleteReport = JSON.parse(incompleteCoverage.stdout);
    assert.ok(incompleteReport.uncovered.some((target) => target.kind === "transition" && target.id === "request.approve/request.not-authorized"));

    assert.equal(mutations.status, 0, mutations.stderr);
    const mutationReport = JSON.parse(mutations.stdout);
    assert.equal(mutationReport.status, "pass");
    assert.equal(mutationReport.generated, 15);
    assert.equal(mutationReport.detected, 15);
    assert.equal(mutationReport.score, 1);
    assert.ok(mutationReport.mutations.some((mutation) => mutation.kind === "required-effect-removed"));
    assert.ok(mutationReport.mutations.every((mutation) => mutation.status === "pass" && mutation.actual === "fail"));
    assert.match(markdown.stdout, /^# Intent Trace Mutation Score intent-contract-fixture/m);
  });

  it("classifies a required Intent contract field as a narrowing change", () => {
    const result = run([
      "spec-change",
      "compat",
      "--json",
      "fixtures/intent-contract-before.pkl",
      "fixtures/intent-contract-after-narrowing.pkl",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.classification, "narrowing");
    assert.ok(report.decisions.some((decision) => decision.change === "intent-process:request.approve:modified"));
  });

  it("projects Intent contracts and refinements into Markdown and QuickCheck", () => {
    const markdown = run(["emit", "markdown", "--locale", "ja", "fixtures/intent-contract.pkl"]);
    const quickcheck = run(["emit", "quickcheck", "fixtures/intent-contract.pkl"]);
    const sourceMap = run(["emit", "source-map", "fixtures/intent-contract.pkl"]);

    assert.equal(markdown.status, 0, markdown.stderr);
    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.equal(sourceMap.status, 0, sourceMap.stderr);
    assert.match(markdown.stdout, /- input field: `amountCents` \(integer, required, minimum 1, maximum 100000\)/);
    assert.match(markdown.stdout, /- refinement: `request\.approve-handler` \(function\)/);
    assert.match(quickcheck.stdout, /propertyIntentProcessRefinementBindingsAreComplete/);
    const map = JSON.parse(sourceMap.stdout);
    assert.ok(map.artifacts.quickcheck.some((entry) => entry.generated === "quickcheck.intent.processes.request.approve.input.fields.amountCents"));
    assert.ok(map.artifacts.markdown.some((entry) => entry.generated === "markdown.intent.processes.request.approve.refinements.request.approve-handler"));
  });

  it("projects bounded Intent execution policies into Markdown, QuickCheck, and TLA+", () => {
    const model = "fixtures/intent-contract-execution-policy.pkl";
    const valid = run(["check", model]);
    const invalid = run(["check", "fixtures/intent-contract-execution-policy-invalid-key.pkl"]);
    const markdown = run(["emit", "markdown", "--locale", "ja", model]);
    const quickcheck = run(["emit", "quickcheck", model]);
    const tla = run(["emit", "tla", model]);
    const tlaCfg = run(["emit", "tla-cfg", model]);
    const sourceMap = run(["emit", "source-map", model]);
    const traceSchema = run(["intent", "schema", model]);
    const compatibility = run(["spec-change", "compat", "--json", "fixtures/intent-contract.pkl", model]);
    const domainCoverage = run(["domain-coverage", "--json", model]);

    assert.equal(valid.status, 0, valid.stderr);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /intent execution idempotency key must have identifier or string type: request\.approve -> amountCents/);
    assert.equal(markdown.status, 0, markdown.stderr);
    assert.equal(quickcheck.status, 0, quickcheck.stderr);
    assert.equal(tla.status, 0, tla.stderr);
    assert.equal(tlaCfg.status, 0, tlaCfg.stderr);
    assert.equal(sourceMap.status, 0, sourceMap.stderr);
    assert.equal(traceSchema.status, 0, traceSchema.stderr);
    assert.equal(compatibility.status, 0, compatibility.stderr);
    assert.match(markdown.stdout, /- execution maxInFlight: `2`/);
    assert.match(markdown.stdout, /- execution idempotency key: `requestId`/);
    assert.match(markdown.stdout, /- execution timeout steps: `2`/);
    assert.match(markdown.stdout, /- execution timeout ms: `1000`/);
    assert.match(quickcheck.stdout, /"maxInFlight": 2/);
    assert.match(quickcheck.stdout, /"timeoutMs": 1000/);
    assert.equal(JSON.parse(traceSchema.stdout).processes[0].execution.timeoutMs, 1000);
    assert.match(tla.stdout, /IntentExecutionProcesses == \{"request\.approve"\}/);
    assert.match(tla.stdout, /IntentIdempotentProcesses == \{"request\.approve"\}/);
    assert.match(tla.stdout, /IntentTimedProcesses == \{"request\.approve"\}/);
    assert.match(tla.stdout, /IntentConcurrencyBounded ==/);
    assert.match(tla.stdout, /IntentIdempotencyKeysAreExclusive ==/);
    assert.match(tla.stdout, /IntentTimeoutsBounded ==/);
    assert.match(tlaCfg.stdout, /INVARIANT IntentConcurrencyBounded/);
    assert.match(tlaCfg.stdout, /INVARIANT IntentIdempotencyKeysAreExclusive/);
    assert.match(tlaCfg.stdout, /INVARIANT IntentTimeoutsBounded/);
    assert.deepEqual(validateGeneratedTla(tla.stdout), []);

    const compatibilityReport = JSON.parse(compatibility.stdout);
    assert.equal(compatibilityReport.classification, "narrowing");
    assert.ok(compatibilityReport.decisions.some((entry) => entry.change === "intent-process:request.approve:modified" && entry.classification === "narrowing"));

    const domainCoverageReport = JSON.parse(domainCoverage.stdout);
    const executionPolicy = domainCoverageReport.elements.find((entry) => entry.kind === "intent.executionPolicy" && entry.id === "request.approve");
    assert.ok(executionPolicy?.coveredBy.some((entry) => entry.rule === "INTENT-EXECUTION-BOUNDED"));

    const map = JSON.parse(sourceMap.stdout);
    assert.ok(map.artifacts.markdown.some((entry) => entry.generated === "markdown.intent.processes.request.approve.execution"));
    assert.ok(map.artifacts.tla.some((entry) => entry.generated === "tla.IntentExecutionPolicy[request.approve]"));
    assert.ok(map.artifacts.tla.some((entry) => entry.generated === "tla.IntentExecutionTypeInvariant"));
    assert.ok(map.artifacts.tla.some((entry) => entry.generated === "tla.IntentConcurrencyBounded"));
    assert.ok(map.artifacts.tlaCfg.some((entry) => entry.generated === "tlaCfg.INVARIANT.IntentExecutionTypeInvariant"));
    assert.ok(map.artifacts.tlaCfg.some((entry) => entry.generated === "tlaCfg.INVARIANT.IntentTimeoutsBounded"));
  });

  it("replays trace inputs for opt-in Intent execution policy observations", () => {
    const result = run([
      "intent",
      "exercise",
      "--json",
      "--policy",
      "fixtures/intent-contract-execution-policy.pkl",
      "fixtures/intent-traces.json",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.executionPolicy.status, "pass");
    assert.equal(report.executionPolicy.summary.policies, 1);
    assert.equal(report.executionPolicy.summary.replays, 3);
    assert.equal(report.executionPolicy.observations.length, 1);
    assert.equal(report.executionPolicy.observations[0].process, "request.approve");
    assert.equal(report.executionPolicy.observations[0].idempotency.contractField, "requestId");
    assert.equal(report.executionPolicy.observations[0].idempotency.implementationField, "request_id");
    assert.equal(report.executionPolicy.observations[0].idempotency.value, "request-001");
    assert.equal(report.executionPolicy.observations[0].pressure.maxInFlight, 2);
    assert.equal(report.executionPolicy.observations[0].pressure.maxObservedInFlight, 2);
    assert.equal(report.executionPolicy.observations[0].result.outputMatchesObserved, true);
    assert.equal(report.evidence.checks.at(-1).id, "intent-execution-policy-observation");
  });

  it("uses an Intent execution policy timeoutMs as the adapter deadline", () => {
    const result = run([
      "intent",
      "exercise",
      "--json",
      "fixtures/intent-contract-execution-policy-timeout-implementation.pkl",
      "fixtures/intent-traces.json",
    ]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.match(report.errors.join("\n"), /execution timed out after 150ms/);
  });

  it("requires Intent contract fields and refinements to be grounded by approved rules", () => {
    const result = run(["domain-coverage", "fixtures/intent-contract.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /uncovered domain element: intent\.inputField request\.approve\/input\/amountCents/);
    assert.match(result.stderr, /uncovered domain element: intent\.refinement request\.approve\/request\.approve-handler/);
  });

  it("verifies generated backends for an Intent model without rules", () => {
    const result = run(["verify-generated", "fixtures/intent-process.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: intent-process-fixture generated quickcheck/);
    if (hasLean) {
      assert.match(result.stdout, /ok: intent-process-fixture generated lean/);
    } else {
      assert.doesNotMatch(result.stdout, /generated lean/);
    }
  });

  it("runs generated QuickCheck output", () => {
    const result = run(["verify-generated", "fixtures/typed-ast.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: typed-ast-fixture generated quickcheck/);
  });

  it("emits verify-generated JSON artifacts", () => {
    const result = run(["verify-generated", "--json", "fixtures/typed-ast.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.model.id, "typed-ast-fixture");
    assert.equal(report.status, "pass");
    assert.equal(report.backends.quickcheck.status, "pass");
    assert.match(report.backends.lean.status, /^(pass|skip)$/);
    assert.equal(report.backends.tlaSyntax.status, "pass");
    assert.equal(report.backends.alloySyntax.status, "pass");
    assert.match(report.backends.tlaSany.status, /^(pass|skip)$/);
    assert.match(report.backends.tlaTlc.status, /^(pass|skip)$/);
    assert.match(report.backends.alloyAnalyzer.status, /^(pass|skip)$/);
  });

  it("skips unavailable formal tools unless they are required", () => {
    const model = loadModel("fixtures/typed-ast.pkl");
    const toolAvailable = () => false;
    const report = verifyGeneratedReport(model, { toolAvailable });

    assert.equal(report.status, "pass");
    assert.equal(report.backends.quickcheck.status, "pass");
    assert.equal(report.backends.lean.status, "skip");
    assert.throws(
      () => verifyGenerated(model, { requireFormalTools: true, toolAvailable }),
      /required formal backend skipped: lean \(lean\)/,
    );
  });

  it("keeps verify-generated JSON report fixture in sync", () => {
    assertProjectedReportFixture(
      ["verify-generated", "--json", "fixtures/typed-ast.pkl"],
      "fixtures/reports/verify-generated-typed-ast.json",
      verifyGeneratedFixtureProjection,
    );
  });

  it("normalizes generated counterexamples to source rules", () => {
    const result = run(["normalize-counterexamples", "--json", "--locale", "ja", "fixtures/coverage-missing-check.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.model.id, "dspec-self");
    assert.equal(report.status, "fail");
    assert.ok(report.counterexamples.length >= 1);

    const quickcheck = report.counterexamples.find((entry) => entry.backend === "quickcheck");
    assert.equal(quickcheck.generated, "quickcheck.approvedRuleIds.COVERAGE-MISSING-CHECK");
    assert.equal(quickcheck.source.kind, "rule");
    assert.equal(quickcheck.source.ruleId, "COVERAGE-MISSING-CHECK");
    assert.equal(quickcheck.source.path, "model.rules[0]");
    assert.equal(quickcheck.rule.id, "COVERAGE-MISSING-CHECK");
    assert.match(quickcheck.rule.text, /DSpec 自己仕様/);
    assert.match(quickcheck.message, /automated check/);

    const model = loadModel("fixtures/coverage-missing-check.pkl");
    const normalized = normalizeCounterexamples(
      model,
      {
        model: { id: model.id, version: model.version },
        status: "fail",
        backends: {
          lean: { status: "fail", message: "AutomatedSupport is false" },
          tlaTlc: { status: "fail", message: "Error: The invariant of CoverageInvariant is equal to FALSE" },
          alloyAnalyzer: { status: "fail", message: "check ApprovedRulesHaveChecks found a failure" },
        },
      },
      "ja",
    );
    const lean = normalized.counterexamples.find((entry) => entry.backend === "lean");
    assert.equal(lean.generated, "lean.RuleId.COVERAGE_MISSING_CHECK");
    assert.equal(lean.source.ruleId, "COVERAGE-MISSING-CHECK");
    const tla = normalized.counterexamples.find((entry) => entry.backend === "tlaTlc");
    assert.equal(tla.generated, "tla.Checks[COVERAGE-MISSING-CHECK]");
    assert.equal(tla.source.ruleId, "COVERAGE-MISSING-CHECK");
    const alloy = normalized.counterexamples.find((entry) => entry.backend === "alloyAnalyzer");
    assert.equal(alloy.generated, "alloy.sig.R_COVERAGE_MISSING_CHECK");
    assert.equal(alloy.source.ruleId, "COVERAGE-MISSING-CHECK");
  });

  it("normalizes TLA and Alloy backend witnesses to source records", () => {
    const model = loadModel("fixtures/cloud-model-broken.pkl");
    const normalized = normalizeCounterexamples(
      model,
      {
        model: { id: model.id, version: model.version },
        status: "fail",
        backends: {
          tlaTlc: {
            status: "fail",
            message: "Error: The invariant of CloudPublicIngressBlocked is equal to FALSE\nwitness: tla.CloudFlows[internet-to-db]",
          },
          alloyAnalyzer: {
            status: "fail",
            message: "check CloudPublicIngressBlocked found a counterexample\nthis/CF_internet_to_db",
          },
        },
      },
      "ja",
    );

    const tla = normalized.counterexamples.find((entry) => entry.backend === "tlaTlc");
    assert.equal(tla.generated, "tla.CloudFlows[internet-to-db]");
    assert.equal(tla.source.kind, "cloudFlow");
    assert.match(tla.source.path, /model\.patterns\.cloud\.flows\[/);
    assert.equal(tla.property, "cloud-public-ingress-blocked");

    const alloy = normalized.counterexamples.find((entry) => entry.backend === "alloyAnalyzer");
    assert.equal(alloy.generated, "alloy.sig.CF_internet_to_db");
    assert.equal(alloy.source.kind, "cloudFlow");
    assert.match(alloy.source.path, /model\.patterns\.cloud\.flows\[/);
    assert.equal(alloy.property, "cloud-public-ingress-blocked");
  });

  it("keeps normalized counterexample JSON report fixture in sync", () => {
    assertProjectedReportFixture(
      ["normalize-counterexamples", "--json", "--locale", "ja", "fixtures/coverage-missing-check.pkl"],
      "fixtures/reports/normalize-counterexamples-coverage-missing-check.json",
      normalizeCounterexamplesFixtureProjection,
      1,
    );
  });

  it("keeps optional formal witnesses out of portable counterexample fixtures", () => {
    const projection = normalizeCounterexamplesFixtureProjection({
      model: { id: "fixture", version: "1" },
      status: "fail",
      locale: "ja",
      counterexamples: [
        { backend: "quickcheck", generated: "quickcheck.rule" },
        { backend: "lean", generated: "lean.RuleId.RULE" },
      ],
    });

    assert.deepEqual(projection.counterexamples.map((entry) => entry.backend), ["quickcheck"]);
  });

  it("normalizes DB migration counterexamples to source patterns", () => {
    const result = run(["normalize-counterexamples", "--json", "--locale", "ja", "fixtures/db-model-migration-missing-preserve.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    const migration = report.counterexamples.find((entry) => entry.property === "db-migration-preserves-invariants");

    assert.equal(migration.generated, "quickcheck.db.migrations.v2-add-payments-without-preserve");
    assert.equal(migration.source.kind, "dbMigration");
    assert.match(migration.source.path, /model\.patterns\.db\.migrations\[/);
    assert.equal(migration.rule, null);
    assert.equal(migration.evidence.invariant, "paid-order-has-payment");
  });

  it("normalizes DB migration mapping counterexamples to source patterns", () => {
    const result = run(["normalize-counterexamples", "--json", "--locale", "ja", "fixtures/db-model-migration-missing-mapping.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    const migration = report.counterexamples.find((entry) => entry.property === "db-migration-mappings-cover-invariants");

    assert.equal(migration.generated, "quickcheck.db.migrations.v2-add-payments-without-mapping");
    assert.equal(migration.source.kind, "dbMigration");
    assert.match(migration.source.path, /model\.patterns\.db\.migrations\[/);
    assert.equal(migration.rule, null);
    assert.equal(migration.evidence.invariant, "paid-order-has-payment");
  });

  it("normalizes DB migration mapping expression counterexamples to source mappings", () => {
    const result = run(["normalize-counterexamples", "--json", "--locale", "ja", "fixtures/db-model-mapping-missing-table-mention.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    const mapping = report.counterexamples.find((entry) => entry.property === "db-migration-mapping-expressions-mention-tables");

    assert.equal(mapping.generated, "quickcheck.db.migrations.v2-add-payments-with-opaque-mapping.mappings.opaque-mapping");
    assert.equal(mapping.source.kind, "dbMapping");
    assert.match(mapping.source.path, /model\.patterns\.db\.migrations\[.*\]\.mappings\[/);
    assert.equal(mapping.rule, null);
    assert.equal(mapping.evidence.mapping, "opaque-mapping");
  });

  it("normalizes Cloud topology counterexamples to source flows", () => {
    const result = run(["normalize-counterexamples", "--json", "--locale", "ja", "fixtures/cloud-model-broken.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    const flow = report.counterexamples.find((entry) => entry.property === "cloud-public-ingress-blocked");

    assert.equal(flow.generated, "quickcheck.cloud.flows.internet-to-db");
    assert.equal(flow.source.kind, "cloudFlow");
    assert.match(flow.source.path, /model\.patterns\.cloud\.flows\[/);
    assert.equal(flow.rule, null);
    assert.equal(flow.evidence.value, "internet-to-db");
  });

  it("normalizes Data governance counterexamples to source records", () => {
    const result = run(["normalize-counterexamples", "--json", "--locale", "ja", "fixtures/data-model-broken.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    const placement = report.counterexamples.find((entry) => entry.property === "data-sensitive-placement-encrypted");
    const flow = report.counterexamples.find((entry) => entry.property === "data-cross-region-flow-has-legal-basis");
    const dataset = report.counterexamples.find((entry) => entry.property === "data-retention-within-policy");

    assert.equal(placement.generated, "quickcheck.data.placements.customer-profile-legacy");
    assert.equal(placement.source.kind, "dataPlacement");
    assert.match(placement.source.path, /model\.patterns\.data\.placements\[/);
    assert.equal(flow.generated, "quickcheck.data.flows.customer-profile-to-us-without-basis");
    assert.equal(flow.source.kind, "dataFlow");
    assert.match(flow.source.path, /model\.patterns\.data\.flows\[/);
    assert.equal(dataset.generated, "quickcheck.data.datasets.customer-profile-long-retention");
    assert.equal(dataset.source.kind, "dataSet");
    assert.match(dataset.source.path, /model\.patterns\.data\.datasets\[/);
  });

  it("normalizes Release safety counterexamples to source steps", () => {
    const result = run(["normalize-counterexamples", "--json", "--locale", "ja", "fixtures/release-model-broken.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    const health = report.counterexamples.find((entry) => entry.property === "release-production-step-has-health-gate");
    const rollback = report.counterexamples.find((entry) => entry.property === "release-traffic-shift-has-rollback");
    const tested = report.counterexamples.find((entry) => entry.property === "release-rollback-plan-tested");
    const migration = report.counterexamples.find((entry) => entry.property === "release-migration-backward-compatible");

    assert.equal(health.generated, "quickcheck.release.steps.prod-without-health");
    assert.equal(health.source.kind, "releaseStep");
    assert.match(health.source.path, /model\.patterns\.release\.steps\[/);
    assert.equal(rollback.generated, "quickcheck.release.steps.prod-without-rollback");
    assert.equal(rollback.source.kind, "releaseStep");
    assert.equal(tested.generated, "quickcheck.release.steps.prod-untested-rollback");
    assert.equal(tested.source.kind, "releaseStep");
    assert.equal(migration.generated, "quickcheck.release.steps.prod-breaking-migration");
    assert.equal(migration.source.kind, "releaseStep");
  });

  it("normalizes Runtime safety counterexamples to source records", () => {
    const result = run(["normalize-counterexamples", "--json", "--locale", "ja", "fixtures/runtime-model-broken.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    const slo = report.counterexamples.find((entry) => entry.property === "runtime-critical-slo-has-page-alert");
    const alert = report.counterexamples.find((entry) => entry.property === "runtime-page-alert-has-tested-runbook");
    const timeout = report.counterexamples.find((entry) => entry.property === "runtime-dependency-has-timeout");
    const retry = report.counterexamples.find((entry) => entry.property === "runtime-retry-is-idempotent");
    const missingTelemetry = report.counterexamples.find((entry) => entry.property === "runtime-slo-has-telemetry");
    const lowTelemetry = report.counterexamples.find((entry) => entry.property === "runtime-telemetry-meets-slo");
    const disabledPolicy = report.counterexamples.find((entry) => entry.property === "runtime-page-alert-has-enabled-policy");
    const failedRunbook = report.counterexamples.find((entry) => entry.property === "runtime-page-alert-has-runbook-execution");
    const slowTrace = report.counterexamples.find((entry) => entry.property === "runtime-dependency-trace-within-timeout");

    assert.equal(slo.generated, "quickcheck.runtime.slos.billing-availability");
    assert.equal(slo.source.kind, "runtimeSlo");
    assert.match(slo.source.path, /model\.patterns\.runtime\.slos\[/);
    assert.equal(alert.generated, "quickcheck.runtime.alerts.checkout-latency-page-untested");
    assert.equal(alert.source.kind, "runtimeAlert");
    assert.equal(timeout.generated, "quickcheck.runtime.dependencies.checkout-api-to-inventory-without-timeout");
    assert.equal(timeout.source.kind, "runtimeDependency");
    assert.equal(retry.generated, "quickcheck.runtime.dependencies.checkout-api-to-payments-non-idempotent-retry");
    assert.equal(retry.source.kind, "runtimeDependency");
    assert.equal(missingTelemetry.generated, "quickcheck.runtime.slos.billing-availability");
    assert.equal(missingTelemetry.source.kind, "runtimeSlo");
    assert.equal(lowTelemetry.generated, "quickcheck.runtime.telemetry.checkout-availability-low-30d");
    assert.equal(lowTelemetry.source.kind, "runtimeTelemetry");
    assert.equal(disabledPolicy.generated, "quickcheck.runtime.alerts.checkout-latency-page-untested");
    assert.equal(disabledPolicy.source.kind, "runtimeAlert");
    assert.equal(failedRunbook.generated, "quickcheck.runtime.alerts.checkout-latency-page-untested");
    assert.equal(failedRunbook.source.kind, "runtimeAlert");
    assert.equal(slowTrace.generated, "quickcheck.runtime.dependencyTraces.checkout-api-to-payments-timeout-trace");
    assert.equal(slowTrace.source.kind, "runtimeDependencyTrace");
  });

  it("keeps generated backend checks load-bearing", () => {
    const report = verifyGeneratedReport(loadModel("fixtures/coverage-missing-check.pkl"));

    assert.equal(report.status, "fail");
    assert.equal(report.backends.quickcheck.status, "fail");
    assert.match(report.backends.quickcheck.message, /approved-rules-have-automated-checks/);
    if (report.backends.lean.status !== "skip") {
      assert.equal(report.backends.lean.status, "fail");
    }
    if (report.backends.tlaTlc.status !== "skip") {
      assert.equal(report.backends.tlaTlc.status, "fail");
    }
    if (report.backends.alloyAnalyzer.status !== "skip") {
      assert.equal(report.backends.alloyAnalyzer.status, "fail");
    }
  });

  it("keeps generated DB invariant checks load-bearing", () => {
    const report = verifyGeneratedReport(loadModel("fixtures/db-model-missing-preserve.pkl"));

    assert.equal(report.status, "fail");
    assert.equal(report.backends.quickcheck.status, "fail");
    assert.match(report.backends.quickcheck.message, /db-transaction-preserves-invariants/);
    assert.match(report.backends.quickcheck.message, /paid-order-has-payment/);
  });

  it("keeps generated DB migration checks load-bearing", () => {
    const report = verifyGeneratedReport(loadModel("fixtures/db-model-migration-missing-preserve.pkl"));

    assert.equal(report.status, "fail");
    assert.equal(report.backends.quickcheck.status, "fail");
    assert.match(report.backends.quickcheck.message, /db-migration-preserves-invariants/);
    assert.match(report.backends.quickcheck.message, /paid-order-has-payment/);
  });

  it("keeps generated DB migration mapping checks load-bearing", () => {
    const report = verifyGeneratedReport(loadModel("fixtures/db-model-migration-missing-mapping.pkl"));

    assert.equal(report.status, "fail");
    assert.equal(report.backends.quickcheck.status, "fail");
    assert.match(report.backends.quickcheck.message, /db-migration-mappings-cover-invariants/);
    assert.match(report.backends.quickcheck.message, /paid-order-has-payment/);
  });

  it("keeps generated DB migration mapping expression checks load-bearing", () => {
    const report = verifyGeneratedReport(loadModel("fixtures/db-model-mapping-missing-table-mention.pkl"));

    assert.equal(report.status, "fail");
    assert.equal(report.backends.quickcheck.status, "fail");
    assert.match(report.backends.quickcheck.message, /db-migration-mapping-expressions-mention-tables/);
    assert.match(report.backends.quickcheck.message, /opaque-mapping/);
  });

  it("keeps generated Cloud topology checks load-bearing", () => {
    const report = verifyGeneratedReport(loadModel("fixtures/cloud-model-broken.pkl"));

    assert.equal(report.status, "fail");
    assert.equal(report.backends.quickcheck.status, "fail");
    assert.match(report.backends.quickcheck.message, /cloud-public-ingress-blocked/);
    assert.match(report.backends.quickcheck.message, /cloud-resource-access-has-policy/);
    assert.match(report.backends.quickcheck.message, /cloud-tenant-flow-propagates-tenant/);
    assert.match(report.backends.quickcheck.message, /cloud-queue-publish-has-idempotency-key/);
  });

  it("keeps generated Data governance checks load-bearing", () => {
    const report = verifyGeneratedReport(loadModel("fixtures/data-model-broken.pkl"));

    assert.equal(report.status, "fail");
    assert.equal(report.backends.quickcheck.status, "fail");
    assert.match(report.backends.quickcheck.message, /data-sensitive-placement-encrypted/);
    assert.match(report.backends.quickcheck.message, /data-personal-placement-supports-deletion/);
    assert.match(report.backends.quickcheck.message, /data-cross-region-flow-has-legal-basis/);
    assert.match(report.backends.quickcheck.message, /data-retention-within-policy/);
  });

  it("keeps generated Release safety checks load-bearing", () => {
    const report = verifyGeneratedReport(loadModel("fixtures/release-model-broken.pkl"));

    assert.equal(report.status, "fail");
    assert.equal(report.backends.quickcheck.status, "fail");
    assert.match(report.backends.quickcheck.message, /release-production-step-has-health-gate/);
    assert.match(report.backends.quickcheck.message, /release-traffic-shift-has-rollback/);
    assert.match(report.backends.quickcheck.message, /release-rollback-plan-tested/);
    assert.match(report.backends.quickcheck.message, /release-migration-backward-compatible/);
  });

  it("keeps generated Runtime safety checks load-bearing", () => {
    const report = verifyGeneratedReport(loadModel("fixtures/runtime-model-broken.pkl"));

    assert.equal(report.status, "fail");
    assert.equal(report.backends.quickcheck.status, "fail");
    assert.match(report.backends.quickcheck.message, /runtime-critical-slo-has-page-alert/);
    assert.match(report.backends.quickcheck.message, /runtime-page-alert-has-tested-runbook/);
    assert.match(report.backends.quickcheck.message, /runtime-dependency-has-timeout/);
    assert.match(report.backends.quickcheck.message, /runtime-retry-is-idempotent/);
    assert.match(report.backends.quickcheck.message, /runtime-slo-has-telemetry/);
    assert.match(report.backends.quickcheck.message, /runtime-telemetry-meets-slo/);
    assert.match(report.backends.quickcheck.message, /runtime-page-alert-has-enabled-policy/);
    assert.match(report.backends.quickcheck.message, /runtime-page-alert-has-runbook-execution/);
    assert.match(report.backends.quickcheck.message, /runtime-dependency-trace-within-timeout/);
  });

  it("compiles generated Lean output", { skip: !hasLean }, () => {
    const result = run(["verify-generated", "fixtures/typed-ast.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: typed-ast-fixture generated lean/);
  });

  it("validates generated TLA+ syntax", () => {
    const result = run(["verify-generated", "fixtures/typed-ast.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: typed-ast-fixture generated tla syntax/);
    assert.deepEqual(validateGeneratedTla("---- MODULE BROKEN ----\nApprovedRules == {"), [
      "missing TLA+ module terminator",
      "missing TLA+ definition: Rules",
      "missing TLA+ definition: ActiveApprovedRules",
      "missing TLA+ definition: Checks",
      "missing TLA+ definition: RuleClauses",
      "missing TLA+ definition: DbTables",
      "missing TLA+ definition: DbInvariants",
      "missing TLA+ definition: DbTransactions",
      "missing TLA+ definition: DbPreserves",
      "missing TLA+ definition: DbTouches",
      "missing TLA+ definition: DbMigrations",
      "missing TLA+ definition: DbMigrationPreserves",
      "missing TLA+ definition: DbMigrationTouches",
      "missing TLA+ definition: DbMigrationMappings",
      "missing TLA+ definition: DbMappings",
      "missing TLA+ definition: DbMappingCovers",
      "missing TLA+ definition: DbMigrationMappingCoverage",
      "missing TLA+ definition: DbMigrationSources",
      "missing TLA+ definition: DbMigrationTargets",
      "missing TLA+ definition: DbMappingMentionsSource",
      "missing TLA+ definition: DbMappingMentionsTarget",
      "missing TLA+ definition: CloudNodes",
      "missing TLA+ definition: CloudFlows",
      "missing TLA+ definition: CloudPublicIngress",
      "missing TLA+ definition: CloudSensitiveResources",
      "missing TLA+ definition: CloudFlowFrom",
      "missing TLA+ definition: CloudFlowTo",
      "missing TLA+ definition: CloudRequiresPolicy",
      "missing TLA+ definition: CloudAllowedByPolicy",
      "missing TLA+ definition: CloudTenantScopedNodes",
      "missing TLA+ definition: CloudTenantPropagatedFlows",
      "missing TLA+ definition: CloudQueuePublishes",
      "missing TLA+ definition: CloudIdempotentFlows",
      "missing TLA+ definition: DataSets",
      "missing TLA+ definition: DataStores",
      "missing TLA+ definition: DataPlacements",
      "missing TLA+ definition: DataFlows",
      "missing TLA+ definition: DataSensitivePlacements",
      "missing TLA+ definition: DataEncryptedPlacements",
      "missing TLA+ definition: DataPersonalPlacements",
      "missing TLA+ definition: DataDeletionSupportedPlacements",
      "missing TLA+ definition: DataCrossRegionFlows",
      "missing TLA+ definition: DataLegalBasisFlows",
      "missing TLA+ definition: DataRetentionScopedSets",
      "missing TLA+ definition: DataRetentionCompliantSets",
      "missing TLA+ definition: ReleaseServices",
      "missing TLA+ definition: ReleaseEnvironments",
      "missing TLA+ definition: ReleaseGates",
      "missing TLA+ definition: ReleaseRollbacks",
      "missing TLA+ definition: ReleaseMigrations",
      "missing TLA+ definition: ReleaseSteps",
      "missing TLA+ definition: ReleaseProductionSteps",
      "missing TLA+ definition: ReleaseHealthGatedSteps",
      "missing TLA+ definition: ReleaseTrafficShiftSteps",
      "missing TLA+ definition: ReleaseRollbackPlannedSteps",
      "missing TLA+ definition: ReleaseRollbackTestedSteps",
      "missing TLA+ definition: ReleaseMigrationScopedSteps",
      "missing TLA+ definition: ReleaseMigrationCompatibleSteps",
      "missing TLA+ definition: RuntimeServices",
      "missing TLA+ definition: RuntimeDependencies",
      "missing TLA+ definition: RuntimeSignals",
      "missing TLA+ definition: RuntimeRunbooks",
      "missing TLA+ definition: RuntimeAlerts",
      "missing TLA+ definition: RuntimeSlos",
      "missing TLA+ definition: RuntimeTelemetry",
      "missing TLA+ definition: RuntimeAlertPolicies",
      "missing TLA+ definition: RuntimeRunbookExecutions",
      "missing TLA+ definition: RuntimeDependencyTraces",
      "missing TLA+ definition: RuntimeCriticalSlos",
      "missing TLA+ definition: RuntimePageAlertedSlos",
      "missing TLA+ definition: RuntimePageAlerts",
      "missing TLA+ definition: RuntimeTestedRunbookAlerts",
      "missing TLA+ definition: RuntimeTimeoutDependencies",
      "missing TLA+ definition: RuntimeRetryDependencies",
      "missing TLA+ definition: RuntimeIdempotentDependencies",
      "missing TLA+ definition: RuntimeTelemetrySlos",
      "missing TLA+ definition: RuntimePassingTelemetry",
      "missing TLA+ definition: RuntimeEnabledPolicyAlerts",
      "missing TLA+ definition: RuntimeExecutedRunbookAlerts",
      "missing TLA+ definition: RuntimeTimeoutCompliantTraces",
      "missing TLA+ definition: IntentExecutionProcesses",
      "missing TLA+ definition: IntentIdempotentProcesses",
      "missing TLA+ definition: IntentTimedProcesses",
      "missing TLA+ definition: IntentProcessMaxInFlight",
      "missing TLA+ definition: IntentProcessTimeoutSteps",
      "missing TLA+ definition: IntentExecutionKeySpace",
      "missing TLA+ definition: RuleWorkflowState",
      "missing TLA+ definition: vars",
      "missing TLA+ definition: Init",
      "missing TLA+ definition: MarkVerified",
      "missing TLA+ definition: DetectUncovered",
      "missing TLA+ definition: Deprecate",
      "missing TLA+ definition: Next",
      "missing TLA+ definition: Spec",
      "missing TLA+ definition: CoverageInvariant",
      "missing TLA+ definition: WorkflowInvariant",
      "missing TLA+ definition: DbInvariantPreserved",
      "missing TLA+ definition: DbMigrationPreserved",
      "missing TLA+ definition: DbMigrationMappingCovered",
      "missing TLA+ definition: DbMigrationMappingRefsMentionTables",
      "missing TLA+ definition: CloudPublicIngressBlocked",
      "missing TLA+ definition: CloudResourceAccessHasPolicy",
      "missing TLA+ definition: CloudTenantFlowsPropagateTenant",
      "missing TLA+ definition: CloudQueuePublishesHaveIdempotencyKey",
      "missing TLA+ definition: DataSensitivePlacementsEncrypted",
      "missing TLA+ definition: DataPersonalPlacementsSupportDeletion",
      "missing TLA+ definition: DataCrossRegionFlowsHaveLegalBasis",
      "missing TLA+ definition: DataRetentionWithinPolicy",
      "missing TLA+ definition: ReleaseProductionStepsHaveHealthGate",
      "missing TLA+ definition: ReleaseTrafficShiftsHaveRollback",
      "missing TLA+ definition: ReleaseRollbackPlansAreTested",
      "missing TLA+ definition: ReleaseMigrationsAreBackwardCompatible",
      "missing TLA+ definition: RuntimeCriticalSlosHavePageAlert",
      "missing TLA+ definition: RuntimePageAlertsHaveTestedRunbook",
      "missing TLA+ definition: RuntimeDependenciesHaveTimeout",
      "missing TLA+ definition: RuntimeRetriesAreIdempotent",
      "missing TLA+ definition: RuntimeSlosHaveTelemetry",
      "missing TLA+ definition: RuntimeTelemetryMeetsSlo",
      "missing TLA+ definition: RuntimePageAlertsHaveEnabledPolicy",
      "missing TLA+ definition: RuntimePageAlertsHaveExecutedRunbook",
      "missing TLA+ definition: RuntimeDependencyTracesWithinTimeout",
      "missing TLA+ definition: IntentExecutionTypeInvariant",
      "missing TLA+ definition: IntentConcurrencyBounded",
      "missing TLA+ definition: IntentIdempotencyKeysAreExclusive",
      "missing TLA+ definition: IntentTimeoutsBounded",
      "unbalanced TLA+ delimiters: {",
    ]);
  });

  it("validates generated Alloy syntax", () => {
    const result = run(["verify-generated", "fixtures/typed-ast.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: typed-ast-fixture generated alloy syntax/);
    assert.deepEqual(validateGeneratedAlloy("module broken\nabstract sig Rule {"), [
      "missing Alloy declaration: abstract sig ActiveApprovedRule",
      "missing Alloy declaration: abstract sig AutomatedCheckTarget",
      "missing Alloy declaration: abstract sig CheckTarget",
      "missing Alloy declaration: one sig Model",
      "missing Alloy declaration: fact GeneratedChecks",
      "missing Alloy declaration: assert ApprovedRulesHaveChecks",
      "missing Alloy declaration: assert ActiveApprovedRulesHaveAutomatedSupport",
      "missing Alloy declaration: check ApprovedRulesHaveChecks",
      "unbalanced Alloy braces",
    ]);
  });

  it("runs generated TLA+ through SANY when available", { skip: !hasTlasany }, () => {
    const result = run(["verify-generated", "fixtures/typed-ast.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: typed-ast-fixture generated tla sany/);
  });

  it("runs generated TLA+ through TLC when available", { skip: !hasTlc }, () => {
    const result = run(["verify-generated", "fixtures/typed-ast.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: typed-ast-fixture generated tla tlc/);
  });

  it("runs generated Alloy through analyzer when available", { skip: !hasAlloy6 }, () => {
    const result = run(["verify-generated", "fixtures/typed-ast.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: typed-ast-fixture generated alloy exec/);
  });

  it("detects implementation drift in dspec's self model", () => {
    const result = run(["drift", "examples/dspec.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: dspec-self drift/);
  });

  it("emits drift JSON reports", () => {
    const result = run(["drift", "--json", "examples/dspec.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.model, { id: "dspec-self", version: "0.1.0" });
    assert.equal(report.references, 1126);
    assert.deepEqual(report.assurance.rules, { satisfied: 79, total: 79 });
    assert.deepEqual(report.errors, []);
  });

  it("keeps drift JSON report fixture in sync", () => {
    assertReportFixture(["drift", "--json", "examples/dspec.pkl"], "fixtures/reports/drift-dspec.json");
  });

  it("detects missing implementation symbols", () => {
    const result = run(["drift", "fixtures/drift-missing-symbol.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing implementation symbol: DRIFT-MISSING-SYMBOL -> src\/cli\.mjs#definitelyMissingSymbol/);
  });

  it("reports coverage for dspec's self model", () => {
    const result = run(["coverage", "examples/dspec.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: dspec-self coverage \(79\/79 approved rules\)/);
  });

  it("reports domain model element coverage", () => {
    const result = run(["domain-coverage", "examples/sample-webapp-2026.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: sample-webapp-2026 domain coverage \(\d+\/\d+ elements\)/);
  });

  it("reports uncovered domain model elements as JSON", () => {
    const result = run(["domain-coverage", "--json", "fixtures/domain-coverage-orphan.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.ok(report.uncovered.some((entry) => entry.kind === "cloud.node" && entry.id === "orphan-worker"));
    assert.ok(report.errors.some((error) => error.includes("uncovered domain element: cloud.node orphan-worker")));
  });

  it("keeps domain coverage JSON report fixture in sync", () => {
    assertReportFixture(
      ["domain-coverage", "--json", "examples/sample-webapp-2026.pkl"],
      "fixtures/reports/domain-coverage-sample-webapp.json",
    );
  });

  it("keeps failing domain coverage JSON report fixture in sync", () => {
    assertReportFixture(
      ["domain-coverage", "--json", "fixtures/domain-coverage-orphan.pkl"],
      "fixtures/reports/domain-coverage-orphan.json",
      1,
    );
  });

  it("dogfoods a real app model", () => {
    const check = run(["check", "examples/sample-webapp-2026.pkl"]);
    const drift = run(["drift", "examples/sample-webapp-2026.pkl"]);
    const domainCoverage = run(["domain-coverage", "examples/sample-webapp-2026.pkl"]);

    assert.equal(check.status, 0, check.stderr);
    assert.match(check.stdout, /ok: sample-webapp-2026/);
    assert.equal(drift.status, 0, drift.stderr);
    assert.match(drift.stdout, /ok: sample-webapp-2026 drift/);
    assert.equal(domainCoverage.status, 0, domainCoverage.stderr);
  });

  it("emits coverage JSON reports", () => {
    const result = run(["coverage", "--json", "examples/dspec.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.model, { id: "dspec-self", version: "0.1.0" });
    assert.equal(report.covered, 79);
    assert.equal(report.total, 79);
    assert.deepEqual(report.assurance.requirements, {
      reference: 79,
      executed: 5,
      "mutation-tested": 1,
      bounded: 0,
      proved: 0,
    });
    assert.deepEqual(report.errors, []);
  });

  it("reports explicit assurance claims", () => {
    const result = run(["coverage", "--json", "fixtures/assurance-levels.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.assurance, {
      kinds: ["reference", "executed", "mutation-tested", "bounded", "proved"],
      rules: { satisfied: 1, total: 1 },
      targets: {
        total: 3,
        byKind: {
          reference: 3,
          executed: 1,
          "mutation-tested": 1,
          bounded: 1,
          proved: 1,
        },
      },
      requirements: {
        reference: 1,
        executed: 1,
        "mutation-tested": 1,
        bounded: 1,
        proved: 1,
      },
    });
  });

  it("preserves assurance requirements in generated QuickCheck properties", () => {
    const emitted = run(["emit", "quickcheck", "fixtures/assurance-levels.pkl"]);

    assert.equal(emitted.status, 0, emitted.stderr);
    assert.match(emitted.stdout, /"requiredAssurances": \[/);
    assert.match(emitted.stdout, /"mutation-tested"/);
    assert.match(emitted.stdout, /propertyApprovedRulesHaveRequiredAssurances/);
    assert.match(emitted.stdout, /approved-rules-have-required-assurances/);

    const verified = run(["verify-generated", "fixtures/assurance-levels.pkl"]);
    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, /ok: assurance-levels generated quickcheck/);

    const missing = verifyGeneratedReport(loadModel("fixtures/assurance-required-missing.pkl"));
    assert.equal(missing.status, "fail");
    assert.equal(missing.backends.quickcheck.status, "fail");
    assert.match(missing.backends.quickcheck.message, /approved-rules-have-required-assurances/);

    const normalized = run(["normalize-counterexamples", "--json", "fixtures/assurance-required-missing.pkl"]);
    assert.notEqual(normalized.status, 0);
    const counterexample = JSON.parse(normalized.stdout).counterexamples[0];
    assert.equal(counterexample.property, "approved-rules-have-required-assurances");
    assert.equal(counterexample.rule.id, "ASSURANCE-REQUIRED-MISSING");
    assert.match(counterexample.message, /required assurance/);
  });

  it("renders assurance claims for human review", () => {
    const result = run(["emit", "markdown", "fixtures/assurance-levels.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /- requiredAssurances: reference, executed, mutation-tested, bounded, proved/);
    assert.match(
      result.stdout,
      /- check: node test\/cli\.test\.mjs#scores generated app profile mutations \[reference, executed, mutation-tested\]/,
    );
    assert.match(result.stdout, /- assuranceEvidence: mutation-tested -> fixtures\/reports\/score-app-profile-mutations\.json/);
  });

  it("rejects missing required assurances", () => {
    const result = run(["coverage", "--json", "fixtures/assurance-required-missing.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.assurance.rules, { satisfied: 0, total: 1 });
    assert.match(result.stderr, /approved rule is missing required assurance: ASSURANCE-REQUIRED-MISSING -> bounded/);
  });

  it("rejects incompatible assurance backends", () => {
    const result = run(["check", "fixtures/assurance-backend-invalid.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /incompatible check assurance: ASSURANCE-BACKEND-INVALID -> proved requires lean backend, got node/);
  });

  it("rejects assurances without evidence", () => {
    const result = run(["check", "fixtures/assurance-evidence-missing.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing check assurance evidence: ASSURANCE-EVIDENCE-MISSING -> executed/);
  });

  it("creates and verifies typed assurance evidence manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-assurance-evidence-"));
    const manifestPath = join(dir, "evidence.json");
    try {
      const created = run([
        "evidence",
        "create",
        "--json",
        "--executed-at",
        "2026-07-14T00:00:00Z",
        "--output",
        manifestPath,
        "fixtures/typed-ast.pkl",
      ]);

      assert.equal(created.status, 0, created.stderr);
      const creation = JSON.parse(created.stdout);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      assert.equal(creation.status, "pass");
      assert.equal(manifest.schemaVersion, "1.0");
      assert.equal(manifest.executedAt, "2026-07-14T00:00:00Z");
      assert.equal(manifest.model.id, "typed-ast-fixture");
      assert.match(manifest.model.digest, /^sha256:[a-f0-9]{64}$/);
      assert.match(manifest.sourceMapDigest, /^sha256:[a-f0-9]{64}$/);
      assert.deepEqual(manifest.artifacts.map((artifact) => artifact.id), ["alloy", "lean", "quickcheck", "tla"]);
      assert.ok(manifest.artifacts.every((artifact) => artifact.scope === "generator"));
      assert.ok(manifest.clauseBindings.length > 0);
      const binding = manifest.clauseBindings[0];
      assert.match(binding.astDigest, /^sha256:[a-f0-9]{64}$/);
      assert.ok(binding.backends.some((backend) => backend.backend === "lean" && backend.support === "structural"));
      assert.ok(binding.backends.some((backend) => backend.backend === "tla" && backend.support === "textual"));
      assert.ok(binding.backends.some((backend) => backend.backend === "alloy" && backend.support === "unmapped"));
      assert.ok(binding.backends.every((backend) => backend.support !== "semantic"));

      const verified = run(["evidence", "verify", "--json", "fixtures/typed-ast.pkl", manifestPath]);
      assert.equal(verified.status, 0, verified.stderr);
      assert.equal(JSON.parse(verified.stdout).status, "pass");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects and refreshes stale assurance evidence manifests", () => {
    const dir = mkdtempSync(join(tmpdir(), "dspec-assurance-refresh-"));
    const manifestPath = join(dir, "evidence.json");
    try {
      const created = run([
        "evidence",
        "create",
        "--output",
        manifestPath,
        "--executed-at",
        "2026-07-14T00:00:00Z",
        "fixtures/typed-ast.pkl",
      ]);
      assert.equal(created.status, 0, created.stderr);

      const staleModel = JSON.parse(readFileSync(manifestPath, "utf8"));
      staleModel.model.digest = `sha256:${"0".repeat(64)}`;
      writeFileSync(manifestPath, stableJson(staleModel));
      const modelDrift = run(["evidence", "verify", "--json", "fixtures/typed-ast.pkl", manifestPath]);
      assert.notEqual(modelDrift.status, 0);
      assert.match(modelDrift.stderr, /stale evidence model digest/);

      const refreshed = run([
        "evidence",
        "refresh",
        "--json",
        "--executed-at",
        "2026-07-15T00:00:00Z",
        "fixtures/typed-ast.pkl",
        manifestPath,
      ]);
      assert.equal(refreshed.status, 0, refreshed.stderr);
      assert.equal(JSON.parse(refreshed.stdout).status, "pass");

      const freshManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const staleTool = structuredClone(freshManifest);
      staleTool.artifacts.find((artifact) => artifact.id === "quickcheck").tool.version = "v0.0.0";
      writeFileSync(manifestPath, stableJson(staleTool));
      const toolDrift = run(["evidence", "verify", "--json", "fixtures/typed-ast.pkl", manifestPath]);
      assert.notEqual(toolDrift.status, 0);
      assert.match(toolDrift.stderr, /stale evidence tool version: node/);

      const missingToolVersion = structuredClone(freshManifest);
      missingToolVersion.artifacts.find((artifact) => artifact.id === "quickcheck").tool.version = null;
      writeFileSync(manifestPath, stableJson(missingToolVersion));
      const missingVersion = run(["evidence", "verify", "--json", "fixtures/typed-ast.pkl", manifestPath]);
      assert.notEqual(missingVersion.status, 0);
      assert.match(missingVersion.stderr, /stale evidence tool version: node/);

      const forgedResult = structuredClone(freshManifest);
      forgedResult.artifacts.find((artifact) => artifact.id === "quickcheck").result = "fail";
      writeFileSync(manifestPath, stableJson(forgedResult));
      const resultDrift = run(["evidence", "verify", "--json", "fixtures/typed-ast.pkl", manifestPath]);
      assert.notEqual(resultDrift.status, 0);
      assert.match(resultDrift.stderr, /invalid assurance evidence artifact result: quickcheck/);

      const forgedScope = structuredClone(freshManifest);
      forgedScope.artifacts.find((artifact) => artifact.id === "lean").scope = "clause";
      writeFileSync(manifestPath, stableJson(forgedScope));
      const scopeDrift = run(["evidence", "verify", "--json", "fixtures/typed-ast.pkl", manifestPath]);
      assert.notEqual(scopeDrift.status, 0);
      assert.match(scopeDrift.stderr, /invalid assurance evidence artifact scope: lean/);

      const malformedArtifact = structuredClone(freshManifest);
      malformedArtifact.artifacts[0] = null;
      writeFileSync(manifestPath, stableJson(malformedArtifact));
      const malformed = run(["evidence", "verify", "--json", "fixtures/typed-ast.pkl", manifestPath]);
      assert.notEqual(malformed.status, 0);
      assert.match(malformed.stderr, /invalid assurance evidence artifact at index 0/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects formal assurance when backend binding is structural only", () => {
    const result = run(["check", "fixtures/assurance-formal-unsupported.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /formal assurance requires semantic Clause\.ast support: ASSURANCE-FORMAL-UNSUPPORTED -> proved lean must\[0\] \(structural\)/,
    );
  });

  it("proves Lean eq clauses with clause-scoped evidence", { skip: !hasLean }, () => {
    const manifestPath = "/tmp/dspec-assurance-formal-lean-eq.json";
    try {
      rmSync(manifestPath, { force: true });
      const missing = run(["check", "fixtures/assurance-formal-lean-eq.pkl"]);
      assert.notEqual(missing.status, 0);
      assert.match(missing.stderr, /missing formal assurance evidence manifest/);

      const created = run([
        "evidence",
        "create",
        "--json",
        "--executed-at",
        "2026-07-15T00:00:00Z",
        "--output",
        manifestPath,
        "fixtures/assurance-formal-lean-eq.pkl",
      ]);

      assert.equal(created.status, 0, created.stderr);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const selector = "lean.theorem.clause_ASSURANCE_FORMAL_LEAN_EQ_must_0";
      const artifact = manifest.artifacts.find((entry) => entry.id === "lean-clause-ASSURANCE-FORMAL-LEAN-EQ-must-0");
      assert.equal(artifact.scope, "clause");
      assert.equal(artifact.result, "pass");
      assert.equal(artifact.theorem, "clause_ASSURANCE_FORMAL_LEAN_EQ_must_0");
      assert.deepEqual(artifact.propertyIds, [selector]);
      const binding = manifest.clauseBindings.find(
        (entry) => entry.ruleId === "ASSURANCE-FORMAL-LEAN-EQ" && entry.selector === "must[0]",
      );
      const lean = binding.backends.find((entry) => entry.backend === "lean");
      assert.equal(lean.support, "semantic");
      assert.ok(lean.generatedSelectors.includes(selector));

      const checked = run(["check", "fixtures/assurance-formal-lean-eq.pkl"]);
      assert.equal(checked.status, 0, checked.stderr);
    } finally {
      rmSync(manifestPath, { force: true });
    }
  });

  it("keeps Lean eq semantic proofs load-bearing", { skip: !hasLean }, () => {
    const result = run([
      "evidence",
      "create",
      "--executed-at",
      "2026-07-15T00:00:00Z",
      "fixtures/assurance-formal-lean-eq-broken.pkl",
    ]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /generated verification failed:/);
    assert.match(result.stderr, /unsolved goals/);
  });

  it("proves composed Lean implication clauses with clause-scoped evidence", { skip: !hasLean }, () => {
    const manifestPath = "/tmp/dspec-assurance-formal-lean-implies.json";
    try {
      rmSync(manifestPath, { force: true });
      const created = run([
        "evidence",
        "create",
        "--json",
        "--executed-at",
        "2026-07-15T00:00:00Z",
        "--output",
        manifestPath,
        "fixtures/assurance-formal-lean-implies.pkl",
      ]);

      assert.equal(created.status, 0, created.stderr);
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const selector = "lean.theorem.clause_ASSURANCE_FORMAL_LEAN_IMPLIES_must_0";
      const binding = manifest.clauseBindings.find(
        (entry) => entry.ruleId === "ASSURANCE-FORMAL-LEAN-IMPLIES" && entry.selector === "must[0]",
      );
      assert.deepEqual(binding.operators, ["eq", "implies"]);
      const lean = binding.backends.find((entry) => entry.backend === "lean");
      assert.equal(lean.support, "semantic");
      assert.ok(lean.generatedSelectors.includes(selector));
      assert.ok(manifest.artifacts.some(
        (entry) => entry.scope === "clause" && entry.propertyIds.includes(selector) && entry.result === "pass",
      ));

      const checked = run(["check", "fixtures/assurance-formal-lean-implies.pkl"]);
      assert.equal(checked.status, 0, checked.stderr);
    } finally {
      rmSync(manifestPath, { force: true });
    }
  });

  it("keeps composed Lean implication proofs load-bearing", { skip: !hasLean }, () => {
    const result = run([
      "evidence",
      "create",
      "--executed-at",
      "2026-07-15T00:00:00Z",
      "fixtures/assurance-formal-lean-implies-broken.pkl",
    ]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /generated verification failed:/);
    assert.match(result.stderr, /unsolved goals/);
  });

  it("rejects legacy references as formal assurance evidence", () => {
    const result = run(["check", "fixtures/assurance-levels.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /formal assurance requires evidence manifest: ASSURANCE-LEVELS -> bounded fixtures\/backend-drift\/Spec\.tla#BackendInvariant/,
    );
    assert.match(
      result.stderr,
      /formal assurance requires evidence manifest: ASSURANCE-LEVELS -> proved fixtures\/backend-drift\/Proof\.lean#backend_anchor/,
    );
  });

  it("keeps coverage JSON report fixture in sync", () => {
    assertReportFixture(["coverage", "--json", "examples/dspec.pkl"], "fixtures/reports/coverage-dspec.json");
  });

  it("emits failing coverage JSON reports", () => {
    const result = run(["coverage", "--json", "fixtures/coverage-missing-check.pkl"]);

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "fail");
    assert.equal(report.covered, 0);
    assert.equal(report.total, 1);
    assert.deepEqual(report.errors, ["approved rule has no automated check target: COVERAGE-MISSING-CHECK"]);
  });

  it("keeps failing coverage JSON report fixture in sync", () => {
    assertReportFixture(
      ["coverage", "--json", "fixtures/coverage-missing-check.pkl"],
      "fixtures/reports/coverage-missing-check.json",
      1,
    );
  });

  it("rejects approved rules without load-bearing checks in coverage", () => {
    const result = run(["coverage", "fixtures/coverage-missing-check.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /approved rule has no automated check target: COVERAGE-MISSING-CHECK/);
  });

  it("reports clause-level coverage", () => {
    const result = run(["coverage", "fixtures/coverage-clause-covered.pkl"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ok: coverage-clause-covered coverage \(1\/1 approved rules\)/);
  });

  it("rejects clause-level coverage gaps", () => {
    const result = run(["coverage", "fixtures/coverage-clause-missing.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /approved rule has uncovered clause: CLAUSE-MISSING -> mustNot\[0\]/);
  });

  it("rejects invalid clause coverage selectors", () => {
    const result = run(["check", "fixtures/coverage-clause-invalid-selector.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown check target covered clause: CLAUSE-INVALID-SELECTOR -> must\[1\]/);
  });

  it("rejects check targets that do not resolve to test anchors", () => {
    const result = run(["coverage", "fixtures/coverage-missing-test-anchor.pkl"]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing check target anchor: COVERAGE-MISSING-TEST-ANCHOR -> test\/cli\.test\.mjs#missing test anchor/);
  });
});
