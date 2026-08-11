import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CommandError } from "../src/commands/error.mjs";
import {
  evidenceUsage,
  parseEvidenceCreateArgs,
  parseEvidenceRefreshArgs,
  parseEvidenceVerifyArgs,
  runEvidenceCommand,
} from "../src/commands/evidence.mjs";

const FIXED_TIME = "2026-08-12T00:00:00.000Z";

function commandContext(overrides = {}) {
  const writes = [];
  const calls = [];
  const context = {
    now: () => FIXED_TIME,
    loadModel: (file) => {
      calls.push(["loadModel", file]);
      return { id: "typed-model", version: "1.0.0" };
    },
    assertModelCoverage: (model) => calls.push(["assertModelCoverage", model.id]),
    createAssuranceEvidenceManifest: (_model, options) => {
      calls.push(["createManifest", options]);
      return {
        schemaVersion: "1.0",
        executedAt: options.executedAt,
        intentReportFiles: options.intentReportFiles,
      };
    },
    writeAssuranceEvidenceManifest: (path, manifest) => {
      calls.push(["writeManifest", path, manifest]);
      return { path, bytes: 42, digest: "sha256:manifest" };
    },
    readJsonFile: (file, label) => {
      calls.push(["readJsonFile", file, label]);
      return { schemaVersion: "1.0" };
    },
    assuranceEvidenceVerificationReport: (model, manifest) => ({
      status: "pass",
      model: { id: model.id, version: model.version },
      manifest,
      summary: { artifacts: 4, clauseBindings: 2 },
      errors: [],
      warnings: [],
    }),
    assertReportOk: (report) => {
      calls.push(["assertReportOk", report.status]);
      if (report.errors.length > 0) throw new CommandError(`${report.errors.join("\n")}\n`);
    },
    assuranceDigest: (value) => `digest:${value}`,
    stableJson: (value) => `${JSON.stringify(value)}\n`,
    modelReport: (model) => ({ id: model.id, version: model.version }),
    manifestExists: () => false,
    write: (value) => writes.push(value),
    ...overrides,
  };
  return { calls, context, writes };
}

describe("evidence command module", () => {
  it("owns create, verify, and refresh option parsing", () => {
    assert.deepEqual(parseEvidenceCreateArgs([
      "--json",
      "--require-formal-tools",
      "--output",
      "evidence.json",
      "--intent-report",
      "intent-a.json",
      "--intent-report",
      "intent-b.json",
      "model.pkl",
    ], () => FIXED_TIME), {
      modelFile: "model.pkl",
      json: true,
      outputFile: "evidence.json",
      executedAt: FIXED_TIME,
      requireFormalTools: true,
      intentReportFiles: ["intent-a.json", "intent-b.json"],
    });
    assert.deepEqual(
      parseEvidenceVerifyArgs(["--json", "model.pkl", "evidence.json"]),
      { modelFile: "model.pkl", manifestFile: "evidence.json", json: true },
    );
    assert.deepEqual(parseEvidenceRefreshArgs([
      "--executed-at",
      "2026-08-11T00:00:00Z",
      "model.pkl",
      "evidence.json",
    ], () => FIXED_TIME), {
      modelFile: "model.pkl",
      manifestFile: "evidence.json",
      json: false,
      executedAt: "2026-08-11T00:00:00Z",
      requireFormalTools: false,
      intentReportFiles: [],
    });
    assert.match(evidenceUsage(), /dspec evidence refresh/);
    assert.throws(
      () => parseEvidenceCreateArgs(["--output"]),
      /--output requires a manifest path/,
    );
    assert.throws(() => parseEvidenceVerifyArgs(["model.pkl"]), CommandError);
  });

  it("creates and verifies manifests through injected boundaries", () => {
    const created = commandContext();
    runEvidenceCommand([
      "create",
      "--json",
      "--output",
      "evidence.json",
      "--intent-report",
      "intent.json",
      "model.pkl",
    ], created.context);

    assert.deepEqual(created.calls.slice(0, 3), [
      ["loadModel", "model.pkl"],
      ["assertModelCoverage", "typed-model"],
      ["createManifest", {
        modelFile: "model.pkl",
        json: true,
        outputFile: "evidence.json",
        executedAt: FIXED_TIME,
        requireFormalTools: false,
        intentReportFiles: ["intent.json"],
      }],
    ]);
    assert.equal(JSON.parse(created.writes[0]).status, "pass");

    const verified = commandContext();
    runEvidenceCommand([
      "verify",
      "--json",
      "model.pkl",
      "evidence.json",
    ], verified.context);
    assert.deepEqual(verified.calls, [
      ["loadModel", "model.pkl"],
      ["readJsonFile", "evidence.json", "assurance evidence manifest"],
      ["assertReportOk", "pass"],
    ]);
    assert.equal(JSON.parse(verified.writes[0]).status, "pass");
  });

  it("refreshes with prior Intent report paths when none are supplied", () => {
    const prior = {
      schemaVersion: "1.0",
      intentExercises: [
        { report: { path: "intent-a.json" } },
        { report: { path: "intent-b.json" } },
      ],
    };
    const refreshed = commandContext({
      manifestExists: (file) => file === "evidence.json",
      readJsonFile: (file, label) => {
        refreshed.calls.push(["readJsonFile", file, label]);
        return prior;
      },
    });

    runEvidenceCommand([
      "refresh",
      "--json",
      "model.pkl",
      "evidence.json",
    ], refreshed.context);

    const createCall = refreshed.calls.find(([name]) => name === "createManifest");
    assert.deepEqual(createCall[1].intentReportFiles, ["intent-a.json", "intent-b.json"]);
    const report = JSON.parse(refreshed.writes[0]);
    assert.equal(report.status, "pass");
    assert.equal(report.changed, true);
    assert.equal(report.output.path, "evidence.json");
  });

  it("owns help and unknown subcommand handling", () => {
    const help = commandContext();
    runEvidenceCommand(["help"], help.context);
    assert.equal(help.writes[0], evidenceUsage());

    assert.throws(
      () => runEvidenceCommand(["unknown"], commandContext().context),
      /unknown evidence subcommand: unknown/,
    );
  });
});
