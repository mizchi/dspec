import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { CommandError } from "../src/commands/error.mjs";
import {
  defaultTraceLockPath,
  parseTraceArgs,
  renderTraceReport,
  runTraceCommand,
  scopeTraceReportToChangedPaths,
  traceUsage,
} from "../src/commands/trace.mjs";
import {
  defaultTranslationLockPath,
  parseTranslationArgs,
  renderTranslationReport,
  runTranslationCommand,
  translationUsage,
} from "../src/commands/translation.mjs";

describe("trace command module", () => {
  it("owns trace option parsing and default lock naming", () => {
    assert.deepEqual(parseTraceArgs([
      "check",
      "--json",
      "--gate",
      "--diff",
      "--lock",
      "reviewed.trace.json",
      "model.pkl",
    ]), {
      operation: "check",
      file: "model.pkl",
      json: true,
      gate: true,
      diff: true,
      output: null,
      lock: "reviewed.trace.json",
    });
    assert.equal(defaultTraceLockPath("spec/model.pkl"), "spec/model.trace.lock.json");
    assert.match(traceUsage(), /dspec trace reconcile/);
    assert.throws(
      () => parseTraceArgs(["reconcile", "--gate", "model.pkl"]),
      CommandError,
    );
  });

  it("scopes trace drift to changed model and implementation paths", () => {
    const report = {
      status: "fail",
      model: { id: "model" },
      errors: [],
      coverage: [{ status: "verified" }, { status: "uncovered" }],
      drift: [
        { kind: "rule-spec", rule: "RULE-SPEC", key: "rule:RULE-SPEC" },
        { kind: "implementation", rule: "RULE-CODE", key: "code:src/core/code.mjs#run" },
        { kind: "test", rule: "RULE-TEST", key: "node:test/code.test.mjs#works" },
      ],
    };

    const scoped = scopeTraceReportToChangedPaths(
      report,
      "examples/model.pkl",
      new Set(["src/core/code.mjs"]),
    );

    assert.deepEqual(scoped.drift, [
      { kind: "implementation", rule: "RULE-CODE", key: "code:src/core/code.mjs#run" },
    ]);
    assert.equal(scoped.status, "fail");
    assert.deepEqual(scoped.scope, {
      kind: "diff",
      changedPaths: ["src/core/code.mjs"],
    });
    assert.equal(
      renderTraceReport({ ...scoped, drift: [], status: "pass" }),
      "ok: model trace (diff, 1/2 verified)\n",
    );
  });

  it("reconciles a trace lock through the command orchestration boundary", (context) => {
    const root = mkdtempSync(join(tmpdir(), "dspec-trace-command-"));
    context.after(() => rmSync(root, { recursive: true, force: true }));
    const output = join(root, "model.trace.lock.json");
    const writes = [];

    runTraceCommand([
      "reconcile",
      "--json",
      "--output",
      output,
      "model.pkl",
    ], {
      loadTraceDocument: () => ({
        model: { id: "model", version: "1.0.0", rules: [] },
      }),
      readJsonFile: () => assert.fail("reconcile must not read a lock"),
      sha256Digest: (value) => `digest:${value.length}`,
      stableJson: (value) => `${JSON.stringify(value)}\n`,
      write: (value) => writes.push(value),
    });

    assert.equal(writes.length, 1);
    assert.equal(JSON.parse(writes[0]).lock.rules, 0);
    assert.equal(JSON.parse(readFileSync(output, "utf8")).model.id, "model");
  });
});

describe("translation command module", () => {
  it("owns translation option parsing and default lock naming", () => {
    assert.deepEqual(parseTranslationArgs([
      "check",
      "--json",
      "--gate",
      "--lock",
      "reviewed.translation.json",
      "model.pkl",
    ]), {
      operation: "check",
      file: "model.pkl",
      json: true,
      gate: true,
      output: null,
      lock: "reviewed.translation.json",
    });
    assert.equal(
      defaultTranslationLockPath("spec/model.pkl"),
      "spec/model.translation.lock.json",
    );
    assert.match(translationUsage(), /dspec translation reconcile/);
    assert.throws(
      () => parseTranslationArgs(["reconcile", "--lock", "lock.json", "model.pkl"]),
      CommandError,
    );
  });

  it("renders translation drift without depending on the executable entrypoint", () => {
    assert.equal(renderTranslationReport({
      status: "fail",
      model: { id: "model" },
      entries: [],
      drift: [{ kind: "source", key: "model.name.en" }],
      errors: ["missing locale: en"],
    }), [
      "translation drift:",
      "  source: model.name.en",
      "  error: missing locale: en",
      "",
    ].join("\n"));
  });

  it("reconciles a translation lock through the command orchestration boundary", (context) => {
    const root = mkdtempSync(join(tmpdir(), "dspec-translation-command-"));
    context.after(() => rmSync(root, { recursive: true, force: true }));
    const output = join(root, "model.translation.lock.json");
    const writes = [];

    runTranslationCommand([
      "reconcile",
      "--json",
      "--output",
      output,
      "model.pkl",
    ], {
      loadTraceDocument: () => ({
        model: {
          id: "model",
          version: "1.0.0",
          primaryLocale: "en",
          locales: ["en"],
          vocabulary: [],
          rules: [],
          decisions: [],
        },
      }),
      readJsonFile: () => assert.fail("reconcile must not read a lock"),
      sha256Digest: (value) => `digest:${value.length}`,
      stableJson: (value) => `${JSON.stringify(value)}\n`,
      write: (value) => writes.push(value),
    });

    assert.equal(writes.length, 1);
    assert.equal(JSON.parse(writes[0]).lock.bindings, 0);
    assert.equal(JSON.parse(readFileSync(output, "utf8")).model.id, "model");
  });
});
