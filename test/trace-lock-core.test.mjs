import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  TRACE_LOCK_SCHEMA_VERSION,
  createTraceLock,
  traceCheck,
  traceSnapshot,
} from "../src/core/trace-lock.mjs";

function fixtureDocument() {
  return {
    model: {
      id: "password-policy",
      version: "0.1.0",
      rules: [{
        id: "PASSWORD-MIN-LENGTH",
        kind: "prohibition",
        text: { default: "8文字未満のパスワードを拒否する", labels: { en: "Reject passwords shorter than eight characters" } },
        terms: ["account.password"],
        mustNot: [{ expr: "accept(password.length < 8)" }],
        implementedBy: [
          { kind: "code", path: "src/password.mjs", symbol: "validatePassword" },
          { kind: "test", path: "test/password.test.mjs", symbol: "rejects short passwords" },
        ],
        checks: [{ backend: "node", ref: "test/password.test.mjs#rejects short passwords" }],
      }],
    },
  };
}

function withProject(run) {
  const directory = mkdtempSync(join(tmpdir(), "dspec-trace-lock-"));
  try {
    mkdirSync(join(directory, "src"));
    mkdirSync(join(directory, "test"));
    writeFileSync(join(directory, "src/password.mjs"), "export function validatePassword(password) { return password.length >= 8; }\n");
    writeFileSync(join(directory, "test/password.test.mjs"), "test(\"rejects short passwords\", () => {});\n");
    return run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("materializes Rule.id, implementation refs, and tests into a deterministic trace lock", () => withProject((projectRoot) => {
  const snapshot = traceSnapshot(fixtureDocument(), { projectRoot });
  const lock = createTraceLock(snapshot);

  assert.equal(snapshot.status, "pass");
  assert.equal(lock.traceLockSchemaVersion, TRACE_LOCK_SCHEMA_VERSION);
  assert.deepEqual(lock.rules, [{
    id: "PASSWORD-MIN-LENGTH",
    contentHash: "sha256:98420edb39ecb37c27c904aeac813eb83ee8fa8ff9fc8e719699ca06361b89f9",
    implementations: [{
      key: "code:src/password.mjs#validatePassword",
      contentHash: "sha256:29e2b9b3590dea27df31654668b1713e57adb314234be1c55de2859388452011",
      hashScope: "symbol-text",
    }],
    tests: [{
      key: "test:test/password.test.mjs#rejects short passwords",
      contentHash: "sha256:3b7c1941bb1f54fccceb9835d39afb13f8c9574d5d7f077772263d8123551481",
      hashScope: "symbol-text",
    }],
    checks: [{
      key: "node:test/password.test.mjs#rejects short passwords",
      contentHash: "sha256:3b7c1941bb1f54fccceb9835d39afb13f8c9574d5d7f077772263d8123551481",
      hashScope: "symbol-text",
    }],
  }]);
  assert.deepEqual(snapshot.coverage, [{
    id: "PASSWORD-MIN-LENGTH",
    status: "verified",
    implementations: 1,
    tests: 1,
    checks: 1,
  }]);
}));

test("reports spec, implementation, and relation changes separately from coverage", () => withProject((projectRoot) => {
  const document = fixtureDocument();
  const lock = createTraceLock(traceSnapshot(document, { projectRoot }));

  writeFileSync(join(projectRoot, "src/password.mjs"), "export function validatePassword(password) { return password.length >= 6; }\n");
  document.model.rules[0].text.default = "6文字未満のパスワードを拒否する";
  document.model.rules[0].implementedBy = document.model.rules[0].implementedBy.filter((reference) => reference.kind !== "test");

  const report = traceCheck(document, lock, { projectRoot });

  assert.equal(report.status, "fail");
  assert.deepEqual(report.drift.map((entry) => ({ kind: entry.kind, key: entry.key })), [
    { kind: "rule-content", key: "PASSWORD-MIN-LENGTH" },
    { kind: "reference-content", key: "code:src/password.mjs#validatePassword" },
    { kind: "reference-unlinked", key: "test:test/password.test.mjs#rejects short passwords" },
  ]);
  assert.deepEqual(report.coverage, [{
    id: "PASSWORD-MIN-LENGTH",
    status: "verified",
    implementations: 1,
    tests: 0,
    checks: 1,
  }]);
}));

test("treats an explicit check target as verification evidence when no test ref is duplicated", () => withProject((projectRoot) => {
  const document = fixtureDocument();
  document.model.rules[0].implementedBy = document.model.rules[0].implementedBy.filter((reference) => reference.kind !== "test");

  const snapshot = traceSnapshot(document, { projectRoot });

  assert.deepEqual(snapshot.coverage, [{
    id: "PASSWORD-MIN-LENGTH",
    status: "verified",
    implementations: 1,
    tests: 0,
    checks: 1,
  }]);
}));

test("keeps a missing declared source as an explicit trace error", () => withProject((projectRoot) => {
  const document = fixtureDocument();
  document.model.rules[0].implementedBy[0].path = "src/missing.mjs";

  const snapshot = traceSnapshot(document, { projectRoot });

  assert.equal(snapshot.status, "fail");
  assert.deepEqual(snapshot.errors, [
    "trace source is missing: PASSWORD-MIN-LENGTH -> src/missing.mjs#validatePassword",
  ]);
}));
