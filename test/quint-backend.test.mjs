import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderQuintModel } from "../src/core/quint.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(root, "src", "cli.mjs");
const quintTypecheck = join(root, "scripts", "typecheck-quint-stdin.mjs");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
}

test("emits Quint as the temporal model backend", () => {
  const result = run(["emit", "quint", "fixtures/typed-ast.pkl"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^module typed_ast_fixture \{/m);
  assert.match(result.stdout, /action init/);
  assert.match(result.stdout, /action step/);
  assert.match(result.stdout, /val coverageInvariant/);
  assert.doesNotMatch(result.stdout, /---- MODULE|EXTENDS|VARIABLES/);

  const typecheck = spawnSync(process.execPath, [quintTypecheck], {
    cwd: root,
    encoding: "utf8",
    input: result.stdout,
  });
  assert.equal(typecheck.status, 0, typecheck.stderr || typecheck.stdout);
});

test("removes the direct TLA+ emit surface", () => {
  for (const backend of ["tla", "tla-cfg"]) {
    const result = run(["emit", backend, "fixtures/typed-ast.pkl"]);
    assert.notEqual(result.status, 0, backend);
    assert.match(result.stderr, /unknown emit target/);
  }

  const help = run(["emit", "--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /\bquint\b/);
  assert.doesNotMatch(help.stdout, /\btla(?:-cfg)?\b/);
});

test("encodes non-ASCII model strings for the TLC backend", () => {
  const source = renderQuintModel({
    id: "日本語モデル",
    clauseAstSemanticsVersion: "仕様-v1",
    rules: [
      {
        id: "日本語ルール",
        reviewStatus: "approved",
        deprecated: false,
        must: [{ text: { default: "日本語の条件" } }],
        checks: [{ backend: "node", ref: "テスト#検証" }],
      },
      {
        id: "DRAFT-WITHOUT-CHECK",
        reviewStatus: "draft",
        deprecated: false,
        checks: [],
      },
    ],
  });

  assert.doesNotMatch(source, /[^\x00-\x7f]/);
  assert.match(source, /utf8:/);
  assert.doesNotMatch(
    source.match(/^  pure val selectableRules:.*$/m)?.[0] ?? "",
    /DRAFT-WITHOUT-CHECK/,
  );

  const typecheck = spawnSync(process.execPath, [quintTypecheck], {
    cwd: root,
    encoding: "utf8",
    input: source,
  });
  assert.equal(typecheck.status, 0, typecheck.stderr || typecheck.stdout);
});
