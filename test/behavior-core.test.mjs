import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import {
  compileBehaviorModel,
  verifyBehaviorImplementation,
  verifyBehaviorModel,
} from "../src/core/behavior.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = "fixtures/behavior-purchase.pkl";
const leanCommand = process.env.LEAN_COMMAND ?? "lean";
const hasLean = spawnSync(leanCommand, ["--version"], { encoding: "utf8" }).status === 0;

function purchaseDocument() {
  return evaluatePklJson(fixturePath);
}

test("compiles a Lean-free behavior DSL into the closed semantic model", () => {
  const compiled = compileBehaviorModel(purchaseDocument());

  assert.deepEqual(compiled.transitionSystem, {
    id: "commerce.purchase.behavior-v1",
    stateFields: [{ id: "available" }],
    initialValues: [{ field: "available", value: 10 }],
    actions: [{
      id: "purchase",
      parameters: [{ id: "quantity", finiteValues: [0, 10] }],
      guard: {
        kind: "le",
        terms: [
          { kind: "input", field: "quantity", value: null, children: [] },
          { kind: "state", field: "available", value: null, children: [] },
        ],
        children: [],
      },
      updates: [{
        field: "available",
        value: {
          kind: "sub",
          field: null,
          value: null,
          children: [
            { kind: "state", field: "available", value: null, children: [] },
            { kind: "input", field: "quantity", value: null, children: [] },
          ],
        },
      }],
    }],
    invariants: [{
      id: "purchase.capacity",
      formula: {
        kind: "le",
        terms: [
          { kind: "state", field: "available", value: null, children: [] },
          { kind: "initial", field: "available", value: null, children: [] },
        ],
        children: [],
      },
    }],
    boundedReachability: [{
      id: "purchase.empty.reachable",
      maxSteps: 1,
      expectation: "reachable",
      target: {
        kind: "eq",
        terms: [
          { kind: "state", field: "available", value: null, children: [] },
          { kind: "literal", field: null, value: 0, children: [] },
        ],
        children: [],
      },
    }],
  });
  assert.match(compiled.generatedLeanSource, /def denote \(state : State\) \(action : Action\) : Option State/);
});

test("checks domain constraints and preserves an all-path counterexample", () => {
  const report = verifyBehaviorModel(purchaseDocument());

  assert.equal(report.status, "pass");
  assert.equal(report.boundedReachability.status, "pass");
  assert.equal(report.temporal.status, "pass");
  assert.deepEqual(report.temporal.checks.map((check) => ({
    id: check.id,
    assurance: check.assurance,
    status: check.status,
    witness: check.witness,
  })), [
    {
      id: "purchase.capacity-always.holds",
      assurance: "bounded-all-paths",
      status: "pass",
      witness: null,
    },
    {
      id: "purchase.eventually-empty.violated",
      assurance: "bounded-all-paths",
      status: "pass",
      witness: {
        path: [],
        trace: [{ available: 10 }],
        violation: { index: 0, state: { available: 10 } },
      },
    },
  ]);
});

test("grounds every bounded transition against the declared implementation adapter", async () => {
  const report = await verifyBehaviorImplementation(purchaseDocument(), { projectRoot });

  assert.equal(report.status, "pass");
  assert.equal(report.checkedTransitions, 6);
  assert.deepEqual(report.counterexample, null);
});

test("keeps a smallest implementation transition mismatch as a counterexample", async () => {
  const document = purchaseDocument();
  document.behavior.grounding.actions[0].implementation.symbol = "brokenPurchase";

  const report = await verifyBehaviorImplementation(document, { projectRoot });

  assert.equal(report.status, "fail");
  assert.deepEqual(report.counterexample, {
    depth: 0,
    path: [],
    action: { id: "purchase", input: { quantity: 10 } },
    state: { available: 10 },
    expected: { status: "accepted", state: { available: 0 } },
    actual: { status: "accepted", state: { available: 10 } },
    error: null,
  });
});

test("renders and checks a stable Lean transition artifact from the behavior DSL", () => {
  const outputPath = "fixtures/behavior/CommercePurchaseGenerated.lean";
  const generate = spawnSync(process.execPath, [
    "scripts/generate-behavior-transition.mjs",
    fixturePath,
    outputPath,
  ], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(generate.status, 0, generate.stderr || generate.stdout);

  const check = spawnSync(process.execPath, [
    "scripts/generate-behavior-transition.mjs",
    "--check",
    fixturePath,
    outputPath,
  ], { cwd: projectRoot, encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr || check.stdout);

  if (hasLean) {
    const lean = spawnSync(leanCommand, [outputPath], { cwd: projectRoot, encoding: "utf8" });
    assert.equal(lean.status, 0, lean.stderr || lean.stdout);
  }
});

test("verifies the behavior reference model and its implementation grounding together", () => {
  const result = spawnSync(process.execPath, [
    "scripts/verify-behavior.mjs",
    fixturePath,
  ], { cwd: projectRoot, encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "pass");
  assert.equal(report.reference.status, "pass");
  assert.equal(report.grounding.status, "pass");
});
