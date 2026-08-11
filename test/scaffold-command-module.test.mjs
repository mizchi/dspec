import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { CommandError } from "../src/commands/error.mjs";
import {
  parseScaffoldRuleArgs,
  runScaffoldCommand,
  scaffoldRuleDocument,
  scaffoldUsage,
} from "../src/commands/scaffold.mjs";

const commandContext = (writes = []) => ({
  loadModel: () => ({
    id: "dspec-self",
    version: "0.0.0",
    vocabulary: [{ id: "artifact.schema" }],
  }),
  modelReport: (model) => ({ id: model.id, version: model.version }),
  stableJson: (value) => `${JSON.stringify(value, null, 2)}\n`,
  write: (value) => writes.push(value),
});

describe("scaffold command module", () => {
  it("owns typed rule scaffold option parsing", () => {
    assert.deepEqual(parseScaffoldRuleArgs([
      "--json",
      "--force",
      "--output",
      "draft.pkl",
      "--kind",
      "permission",
      "--term",
      "artifact.schema",
      "--implementation",
      "src/core/schema.mjs#validateSchema",
      "--test",
      "test/schema.test.mjs#validates schema",
      "examples/dspec.pkl",
      "DSPEC-SCHEMA",
    ]), {
      modelFile: "examples/dspec.pkl",
      ruleId: "DSPEC-SCHEMA",
      json: true,
      force: true,
      outputFile: "draft.pkl",
      kind: "permission",
      terms: ["artifact.schema"],
      implementation: {
        path: "src/core/schema.mjs",
        anchor: "validateSchema",
      },
      test: {
        path: "test/schema.test.mjs",
        anchor: "validates schema",
      },
    });
    assert.match(scaffoldUsage(), /dspec scaffold rule/);
    assert.throws(
      () => parseScaffoldRuleArgs(["--kind", "unknown", "model.pkl", "RULE"]),
      CommandError,
    );
    assert.throws(
      () => parseScaffoldRuleArgs(["--implementation", "missing-anchor", "model.pkl", "RULE"]),
      /--implementation must use path#symbol-or-anchor/,
    );
  });

  it("renders a draft from the model vocabulary and Schema import", () => {
    const scaffold = scaffoldRuleDocument({
      modelFile: "examples/dspec.pkl",
      ruleId: "DSPEC-SCHEMA",
      json: false,
      force: false,
      outputFile: null,
      kind: "invariant",
      terms: ["artifact.schema"],
      implementation: null,
      test: null,
    }, commandContext());

    assert.deepEqual(scaffold.model, { id: "dspec-self", version: "0.0.0" });
    assert.equal(scaffold.schemaImportPath, "../dspec/Schema.pkl");
    assert.match(scaffold.source, /id = "DSPEC-SCHEMA"/);
    assert.match(scaffold.source, /"artifact\.schema"/);
    assert.match(scaffold.source, /reviewStatus = "draft"/);

    assert.throws(() => scaffoldRuleDocument({
      modelFile: "examples/dspec.pkl",
      ruleId: "DSPEC-UNKNOWN",
      json: false,
      force: false,
      outputFile: null,
      kind: "invariant",
      terms: ["missing.term"],
      implementation: null,
      test: null,
    }, commandContext()), /unknown vocabulary term: missing\.term/);
  });

  it("writes a scaffold through the command orchestration boundary", (context) => {
    const root = mkdtempSync(join(tmpdir(), "dspec-scaffold-command-"));
    context.after(() => rmSync(root, { recursive: true, force: true }));
    const output = join(root, "draft.pkl");
    const writes = [];

    runScaffoldCommand([
      "rule",
      "--output",
      output,
      "--term",
      "artifact.schema",
      "examples/dspec.pkl",
      "DSPEC-SCHEMA",
    ], commandContext(writes));

    assert.equal(writes.length, 1);
    assert.equal(writes[0], `ok: wrote draft rule scaffold ${output}\n`);
    assert.ok(existsSync(output));
    const source = readFileSync(output, "utf8");
    assert.match(source, /id = "DSPEC-SCHEMA"/);
    assert.match(source, /^import ".+Schema\.pkl" as d/m);
  });
});
