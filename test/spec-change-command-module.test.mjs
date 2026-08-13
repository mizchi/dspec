import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CommandError } from "../src/commands/error.mjs";
import {
  parseScaffoldSpecChangeReviewArgs,
  parseSpecChangeReviewArgs,
  parseSpecCompatibilityArgs,
  runSpecChangeCommand,
  scaffoldSpecChangeReviewUsage,
  specChangeCompatUsage,
  specChangeReviewUsage,
  specChangeUsage,
} from "../src/commands/spec-change.mjs";

function commandContext(overrides = {}) {
  const calls = [];
  const writes = [];
  const context = {
    loadModel: (file) => {
      calls.push(["loadModel", file]);
      return { id: file, version: "1.0.0" };
    },
    specCompatibilityReport: (before, after) => ({
      status: "pass",
      classification: "narrowing",
      model: { before: before.id, after: after.id },
      errors: [],
    }),
    renderSpecCompatibilityMarkdownReport: () => "# Compatibility\n",
    renderSpecCompatibilityReport: () => "compatibility: narrowing\n",
    loadSpecChangeReview: (file) => {
      calls.push(["loadSpecChangeReview", file]);
      return { id: "review-1" };
    },
    specChangeReviewReport: (review, file) => ({
      status: "pass",
      review,
      file,
      classification: "narrowing",
      errors: [],
    }),
    renderSpecChangeReviewMarkdownReport: () => "# Review\n",
    renderSpecChangeReviewReport: () => "review: pass\n",
    specChangeReviewScaffoldReport: (options) => ({
      status: "pass",
      classification: "narrowing",
      model: { before: options.beforeModel.id, after: options.afterModel.id },
      draft: {
        id: options.id ?? "generated-review",
        beforeModelPath: options.beforeFile,
        afterModelPath: options.afterFile,
      },
      errors: [],
    }),
    specChangeReviewDraftForOutput: (draft, outputFile) => ({
      ...draft,
      beforeModelPath: `relative:${draft.beforeModelPath}`,
      afterModelPath: `relative:${draft.afterModelPath}`,
      outputFile,
    }),
    writeSpecChangeReviewScaffold: (outputFile) => ({
      path: outputFile,
      schemaImportPath: "../dspec/Schema.pkl",
      bytes: 42,
    }),
    renderSpecChangeReviewDraftPkl: (draft) => `review: ${draft.id}\n`,
    assertReportOk: (report) => {
      calls.push(["assertReportOk", report.status]);
      if (report.errors.length > 0) throw new CommandError(`${report.errors.join("\n")}\n`);
    },
    stableJson: (value) => `${JSON.stringify(value)}\n`,
    write: (value) => writes.push(value),
    ...overrides,
  };
  return { calls, context, writes };
}

describe("spec-change command module", () => {
  it("owns compat, review, and scaffold option parsing", () => {
    assert.deepEqual(
      parseSpecCompatibilityArgs(["--json", "before.pkl", "after.pkl"], "usage\n"),
      { beforeFile: "before.pkl", afterFile: "after.pkl", json: true, markdown: false },
    );
    assert.deepEqual(
      parseSpecChangeReviewArgs(["--markdown", "review.pkl"], "usage\n"),
      { file: "review.pkl", json: false, markdown: true },
    );
    assert.deepEqual(parseScaffoldSpecChangeReviewArgs([
      "--json",
      "--id",
      "review-2",
      "--output",
      "review.pkl",
      "before.pkl",
      "after.pkl",
    ], "usage\n"), {
      beforeFile: "before.pkl",
      afterFile: "after.pkl",
      id: "review-2",
      json: true,
      outputFile: "review.pkl",
    });
    assert.throws(
      () => parseSpecCompatibilityArgs(["--json", "--markdown", "a", "b"], "usage\n"),
      CommandError,
    );
    assert.throws(
      () => parseScaffoldSpecChangeReviewArgs(["--id"], "usage\n"),
      /--id requires a review id/,
    );
  });

  it("runs compatibility and review through injected report boundaries", () => {
    const compat = commandContext();
    runSpecChangeCommand([
      "compat",
      "--json",
      "before.pkl",
      "after.pkl",
    ], compat.context);
    assert.deepEqual(compat.calls, [
      ["loadModel", "before.pkl"],
      ["loadModel", "after.pkl"],
      ["assertReportOk", "pass"],
    ]);
    assert.equal(JSON.parse(compat.writes[0]).classification, "narrowing");

    const review = commandContext();
    runSpecChangeCommand([
      "review",
      "--markdown",
      "review.pkl",
    ], review.context);
    assert.deepEqual(review.calls, [["loadSpecChangeReview", "review.pkl"]]);
    assert.equal(review.writes[0], "# Review\n");
  });

  it("writes a scaffold and emits the next review command", () => {
    const scaffold = commandContext();
    runSpecChangeCommand([
      "scaffold",
      "--output",
      "review.pkl",
      "before.pkl",
      "after.pkl",
    ], scaffold.context);

    assert.deepEqual(scaffold.calls, [
      ["loadModel", "before.pkl"],
      ["loadModel", "after.pkl"],
      ["assertReportOk", "pass"],
    ]);
    assert.deepEqual(scaffold.writes, [
      "ok: wrote spec change review scaffold review.pkl\n",
      "next: dspec spec-change review --json review.pkl\n",
    ]);
  });

  it("owns group and subcommand help plus unknown subcommands", () => {
    assert.match(specChangeUsage(), /Typical flow:/);
    assert.match(specChangeCompatUsage(), /classify the compatibility change/);
    assert.match(specChangeReviewUsage(), /one spec-change gate/);
    assert.match(scaffoldSpecChangeReviewUsage(), /breaking evidence/);

    const groupHelp = commandContext();
    runSpecChangeCommand(["help"], groupHelp.context);
    assert.equal(groupHelp.writes[0], specChangeUsage());

    const localHelp = commandContext();
    runSpecChangeCommand(["scaffold", "--help"], localHelp.context);
    assert.equal(localHelp.writes[0], scaffoldSpecChangeReviewUsage());

    assert.throws(
      () => runSpecChangeCommand(["unknown"], commandContext().context),
      /unknown spec-change subcommand: unknown/,
    );
  });
});
