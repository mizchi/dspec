import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CommandError } from "../src/commands/error.mjs";
import {
  generatedUsage,
  parseProjectionArgs,
  parseProjectionUnlockArgs,
  runGenerateCommand,
  runGeneratedCommand,
} from "../src/commands/projection.mjs";

const FIXED_TIME = "2026-08-12T00:00:00.000Z";

function commandContext(overrides = {}) {
  const calls = [];
  const writes = [];
  const context = {
    generateUsage: "usage: dspec generate <model.pkl>\n",
    now: () => FIXED_TIME,
    loadModel: (file) => {
      calls.push(["loadModel", file]);
      return { id: "projection-model" };
    },
    generateProjectionArtifacts: (_model, options) => {
      calls.push(["generateProjectionArtifacts", options]);
      return {
        status: "pass",
        dryRun: options.dryRun,
        changed: 2,
        model: { id: "projection-model" },
        summary: { projections: 1, artifacts: 2 },
        errors: [],
      };
    },
    generatedProjectionReport: (_model, options) => {
      calls.push(["generatedProjectionReport", options]);
      return {
        status: "pass",
        model: { id: "projection-model" },
        summary: { projections: 1, artifacts: 2 },
        errors: [],
      };
    },
    recoverProjectionLock: (root, options) => {
      calls.push(["recoverProjectionLock", root, options]);
      return {
        status: "absent",
        forced: false,
        previous: {
          liveness: "absent",
          lease: { status: "absent" },
        },
      };
    },
    renderGeneratedProjectionReport: (report, action) => {
      calls.push(["renderGeneratedProjectionReport", action]);
      return `${action}: ${report.status}\n`;
    },
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

describe("projection command module", () => {
  it("owns generate and unlock option parsing", () => {
    assert.deepEqual(parseProjectionArgs([
      "--json",
      "--dry-run",
      "--generated-at",
      "2026-08-11T00:00:00Z",
      "--root",
      "workspace",
      "model.pkl",
    ], "generate usage\n", { allowGenerationOptions: true }), {
      file: "model.pkl",
      dryRun: true,
      generatedAt: "2026-08-11T00:00:00Z",
      json: true,
      root: "workspace",
    });
    assert.deepEqual(
      parseProjectionUnlockArgs(["--json", "--force", "--root", "workspace"]),
      { force: true, json: true, root: "workspace" },
    );
    assert.match(generatedUsage(), /dspec generated unlock/);
    assert.throws(
      () => parseProjectionArgs([
        "--generated-at",
        "invalid",
        "model.pkl",
      ], "generate usage\n", { allowGenerationOptions: true }),
      /invalid --generated-at: invalid/,
    );
    assert.throws(
      () => parseProjectionUnlockArgs(["--root"]),
      CommandError,
    );
  });

  it("runs generation with an injected clock and report boundary", () => {
    const generated = commandContext();
    runGenerateCommand([
      "--json",
      "--dry-run",
      "--root",
      "workspace",
      "model.pkl",
    ], generated.context);

    assert.deepEqual(generated.calls, [
      ["loadModel", "model.pkl"],
      ["generateProjectionArtifacts", {
        dryRun: true,
        generatedAt: FIXED_TIME,
        root: "workspace",
      }],
      ["assertReportOk", "pass"],
    ]);
    assert.equal(JSON.parse(generated.writes[0]).status, "pass");
  });

  it("checks generated artifacts and recovers an absent lock", () => {
    const checked = commandContext();
    runGeneratedCommand([
      "check",
      "--json",
      "--root",
      "workspace",
      "model.pkl",
    ], checked.context);
    assert.deepEqual(checked.calls, [
      ["loadModel", "model.pkl"],
      ["generatedProjectionReport", { root: "workspace" }],
      ["assertReportOk", "pass"],
    ]);
    assert.equal(JSON.parse(checked.writes[0]).status, "pass");

    const unlocked = commandContext();
    runGeneratedCommand([
      "unlock",
      "--root",
      "workspace",
    ], unlocked.context);
    assert.deepEqual(unlocked.calls, [
      ["recoverProjectionLock", "workspace", { force: false }],
    ]);
    assert.equal(unlocked.writes[0], "ok: no Projection generation lock\n");
  });

  it("owns generated help, recovery errors, and unknown subcommands", () => {
    const help = commandContext();
    runGeneratedCommand(["help"], help.context);
    assert.equal(help.writes[0], generatedUsage());

    const failed = commandContext({
      recoverProjectionLock: () => {
        throw new Error("lock is live");
      },
    });
    assert.throws(
      () => runGeneratedCommand(["unlock"], failed.context),
      /lock is live/,
    );
    assert.throws(
      () => runGeneratedCommand(["unknown"], commandContext().context),
      /unknown generated subcommand: unknown/,
    );
  });
});
