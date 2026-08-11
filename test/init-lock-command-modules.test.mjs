import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { CommandError } from "../src/commands/error.mjs";
import {
  initUsage,
  initializedModelId,
  parseInitArgs,
  renderInitializedModel,
  runInitCommand,
} from "../src/commands/init.mjs";
import {
  lockUsage,
  parseLockArgs,
  runLockCommand,
} from "../src/commands/lock.mjs";
import {
  defaultSchemaLockPath,
  schemaImportFromModel,
  schemaLockDocument,
  schemaLockReport,
} from "../src/commands/schema-lock.mjs";

const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

describe("init command module", () => {
  it("owns init parsing, model ids, and source rendering", () => {
    assert.deepEqual(parseInitArgs([
      "--json",
      "--force",
      "--lock",
      "reviewed.lock.json",
      "spec/my model.pkl",
    ]), {
      force: true,
      json: true,
      outputFile: "spec/my model.pkl",
      lockFile: "reviewed.lock.json",
    });
    assert.equal(initializedModelId("spec/my model.pkl"), "my-model");
    assert.match(renderInitializedModel({
      id: "my-model",
      schemaImportPath: "../dspec/Schema.pkl",
    }), /^import "\.\.\/dspec\/Schema\.pkl" as d/m);
    assert.match(initUsage(), /dspec init/);
    assert.throws(() => parseInitArgs(["--output", "--force"]), CommandError);
  });

  it("initializes a model and schema lock behind the command boundary", (context) => {
    const root = mkdtempSync(join(tmpdir(), "dspec-init-command-"));
    context.after(() => rmSync(root, { recursive: true, force: true }));
    const output = join(root, "spec", "model.pkl");
    const writes = [];

    runInitCommand(["--json", "--output", output], {
      stableJson,
      write: (value) => writes.push(value),
    });

    assert.equal(writes.length, 1);
    const report = JSON.parse(writes[0]);
    assert.equal(report.model.id, "model");
    assert.equal(report.output.path, output);
    assert.ok(existsSync(output));
    assert.ok(existsSync(report.output.lock.path));
    assert.match(readFileSync(output, "utf8"), /model: d\.Model/);
    assert.equal(schemaLockReport(output).status, "pass");
  });
});

describe("lock command module", () => {
  it("owns lock parsing and default lock naming", () => {
    assert.deepEqual(parseLockArgs([
      "--json",
      "--force",
      "--output",
      "reviewed.lock.json",
      "model.pkl",
    ]), {
      file: "model.pkl",
      force: true,
      json: true,
      outputFile: "reviewed.lock.json",
    });
    assert.equal(defaultSchemaLockPath("spec/model.pkl"), "spec/model.lock.json");
    assert.match(lockUsage(), /dspec lock/);
    assert.throws(() => parseLockArgs(["--output", "--force", "model.pkl"]), CommandError);
  });

  it("writes a schema lock through the command boundary", (context) => {
    const root = mkdtempSync(join(tmpdir(), "dspec-lock-command-"));
    context.after(() => rmSync(root, { recursive: true, force: true }));
    const output = join(root, "consumer.lock.json");
    const writes = [];

    runLockCommand([
      "--json",
      "--output",
      output,
      "fixtures/pkl-package-consumer/consumer.pkl",
    ], {
      loadModel: () => ({ id: "pkl-package-consumer", version: "0.1.0" }),
      modelReport: (model) => ({ id: model.id, version: model.version }),
      stableJson,
      write: (value) => writes.push(value),
    });

    assert.equal(writes.length, 1);
    assert.equal(JSON.parse(writes[0]).lock.path, output);
    assert.equal(JSON.parse(readFileSync(output, "utf8")).schemaLockVersion, 1);
  });
});

describe("schema lock service", () => {
  it("resolves the model import and materializes its module contract", (context) => {
    const root = mkdtempSync(join(tmpdir(), "dspec-lock-document-"));
    context.after(() => rmSync(root, { recursive: true, force: true }));
    const lockFile = join(root, "consumer.lock.json");

    assert.equal(
      schemaImportFromModel("fixtures/pkl-package-consumer/consumer.pkl"),
      "@dspec/dspec/Schema.pkl",
    );
    const document = schemaLockDocument(
      "fixtures/pkl-package-consumer/consumer.pkl",
      lockFile,
    );

    assert.equal(document.schemaLockVersion, 1);
    assert.equal(document.model.schemaImportPath, "@dspec/dspec/Schema.pkl");
    assert.ok(document.schema.files.length > 0);
    assert.match(document.schema.files[0].digest, /^sha256:[0-9a-f]{64}$/);
  });
});
