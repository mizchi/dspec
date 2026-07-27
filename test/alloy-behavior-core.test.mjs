import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import {
  compileAlloyBehaviorModel,
  verifyAlloyBehaviorModel,
  verifyAlloyBehaviorScopeMatrix,
  verifyAlloyBehaviorWithAnalyzer,
} from "../src/core/alloy-behavior.mjs";

const fixturePath = "fixtures/alloy-behavior-reservation.pkl";
const releaseBeforeReserveFixturePath = "fixtures/alloy-behavior-reservation-release-before-reserve.pkl";
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const hasAlloy = spawnSync("alloy6", ["version"], { encoding: "utf8" }).status === 0;

function reservationDocument() {
  return evaluatePklJson(fixturePath);
}

function releaseBeforeReserveDocument() {
  return evaluatePklJson(releaseBeforeReserveFixturePath);
}

test("lowers a Lean-free reservation model to Alloy 6 relational temporal syntax", () => {
  const compiled = compileAlloyBehaviorModel(reservationDocument());

  assert.deepEqual(compiled.model, {
    id: "commerce.reservation.alloy-v1",
    entities: [
      { id: "customer", scope: 2 },
      { id: "product", scope: 2 },
    ],
    reservation: {
      id: "product-reservation",
      owner: "customer",
      resource: "product",
      scheduling: "unconstrained",
    },
    checks: [
      {
        id: "reservation.exclusive.holds",
        rule: "RESERVATION-EXCLUSIVE",
        kind: "alwaysExclusive",
        expectation: "holds",
        maxSteps: 4,
      },
      {
        id: "reservation.eventually-released.violated",
        rule: "RESERVATION-RELEASES",
        kind: "eventuallyReleased",
        expectation: "violated",
        maxSteps: 4,
      },
      {
        id: "reservation.owner-capacity.violated",
        rule: "RESERVATION-OWNER-CAPACITY",
        kind: "alwaysOwnerCapacity",
        expectation: "violated",
        maxSteps: 4,
      },
    ],
    sanity: [
      { id: "world", command: "ReservationWorld", maxSteps: 4 },
      { id: "reserve", command: "ReservationCanBeReserved", maxSteps: 4 },
      { id: "release", command: "ReservationCanBeReleased", maxSteps: 4 },
    ],
  });
  assert.match(compiled.alloySource, /one sig ReservationState \{\n  var owner: Product -> lone Customer\n\}/);
  assert.match(compiled.alloySource, /fact Initial \{\n  no ReservationState\.owner\n\}/);
  assert.match(compiled.alloySource, /pred reserve\[c: Customer, p: Product\]/);
  assert.match(compiled.alloySource, /assert ReservationExclusive \{/);
  assert.match(compiled.alloySource, /always \(all p: Product \| lone p\.\(ReservationState\.owner\)\)/);
  assert.match(compiled.alloySource, /assert ReservationEventuallyReleased \{/);
  assert.match(compiled.alloySource, /eventually no p\.\(ReservationState\.owner\)/);
  assert.match(compiled.alloySource, /assert ReservationOwnerCapacity \{/);
  assert.match(compiled.alloySource, /always \(all c: Customer \| lone c\.~\(ReservationState\.owner\)\)/);
  assert.match(compiled.alloySource, /pred ReservationWorld \{\n  some Customer\n  some Product\n\}/);
  assert.match(compiled.alloySource, /pred ReservationCanBeReserved \{\n  eventually some ReservationState\.owner\n\}/);
  assert.match(compiled.alloySource, /pred ReservationCanBeReleased \{/);
  assert.match(compiled.alloySource, /run ReservationWorld for exactly 2 Customer, exactly 2 Product, 4 steps/);
  assert.match(compiled.alloySource, /check ReservationExclusive for exactly 2 Customer, exactly 2 Product, 4 steps/);
});

test("links every relational temporal check to a declared domain rule", () => {
  const document = reservationDocument();
  document.alloyBehavior.checks[0].rule = "UNKNOWN-RULE";

  const report = verifyAlloyBehaviorModel(document);

  assert.equal(report.status, "fail");
  assert.deepEqual(report.errors, [
    "alloy behavior references unknown domain rule: reservation.exclusive.holds -> UNKNOWN-RULE",
  ]);
});

test("checks safety and liveness expectations over the declared finite bound", () => {
  const report = verifyAlloyBehaviorModel(reservationDocument());

  assert.equal(report.status, "pass");
  assert.deepEqual(report.checks.map((check) => ({
    id: check.id,
    assurance: check.assurance,
    status: check.status,
    witness: check.witness,
  })), [
    {
      id: "reservation.exclusive.holds",
      assurance: "bounded-relational-reference",
      status: "pass",
      witness: null,
    },
    {
      id: "reservation.eventually-released.violated",
      assurance: "bounded-relational-reference",
      status: "pass",
      witness: {
        trace: [
          { reservation: [] },
          { reservation: [{ resource: "product#0", owner: "customer#0" }] },
          { reservation: [{ resource: "product#0", owner: "customer#0" }] },
          { reservation: [{ resource: "product#0", owner: "customer#0" }] },
          { reservation: [{ resource: "product#0", owner: "customer#0" }] },
        ],
        violation: { resource: "product#0", index: 1 },
      },
    },
    {
      id: "reservation.owner-capacity.violated",
      assurance: "bounded-relational-reference",
      status: "pass",
      witness: {
        trace: [
          { reservation: [] },
          { reservation: [{ resource: "product#0", owner: "customer#0" }] },
          {
            reservation: [
              { resource: "product#0", owner: "customer#0" },
              { resource: "product#1", owner: "customer#0" },
            ],
          },
          {
            reservation: [
              { resource: "product#0", owner: "customer#0" },
              { resource: "product#1", owner: "customer#0" },
            ],
          },
          {
            reservation: [
              { resource: "product#0", owner: "customer#0" },
              { resource: "product#1", owner: "customer#0" },
            ],
          },
        ],
        violation: { owner: "customer#0", index: 2 },
      },
    },
  ]);
});

test("makes eventual release hold only after a declared release-before-reserve policy", () => {
  const compiled = compileAlloyBehaviorModel(releaseBeforeReserveDocument());
  const report = verifyAlloyBehaviorModel(releaseBeforeReserveDocument());

  assert.equal(compiled.model.reservation.scheduling, "releaseBeforeReserve");
  assert.match(compiled.alloySource, /some ReservationState\.owner =>/);
  assert.match(compiled.alloySource, /\(some c: Customer, p: Product \| release\[c, p\]\)/);
  assert.match(compiled.alloySource, /else\n      \(\(some c: Customer, p: Product \| reserve\[c, p\]\) or stutter\)/);
  assert.equal(report.status, "pass");
  assert.equal(report.checks[1].expectation, "holds");
  assert.equal(report.checks[1].witness, null);
  assert.equal(report.checks[2].expectation, "holds");
  assert.equal(report.checks[2].witness, null);
});

test("renders a stable Alloy 6 artifact from the relational behavior DSL", () => {
  for (const [modelPath, outputPath] of [
    [fixturePath, "fixtures/alloy-behavior/CommerceReservationGenerated.als"],
    [releaseBeforeReserveFixturePath, "fixtures/alloy-behavior/CommerceReservationReleaseBeforeReserveGenerated.als"],
  ]) {
    const generate = spawnSync(process.execPath, [
      "scripts/generate-alloy-behavior.mjs",
      modelPath,
      outputPath,
    ], { cwd: projectRoot, encoding: "utf8" });
    assert.equal(generate.status, 0, generate.stderr || generate.stdout);

    const check = spawnSync(process.execPath, [
      "scripts/generate-alloy-behavior.mjs",
      "--check",
      modelPath,
      outputPath,
    ], { cwd: projectRoot, encoding: "utf8" });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  }
});

test("Alloy 6 agrees with the expected bounded safety and liveness results", { skip: !hasAlloy }, () => {
  const report = verifyAlloyBehaviorWithAnalyzer(reservationDocument());

  assert.equal(report.status, "pass");
  assert.deepEqual(report.checks.map((check) => ({
    id: check.id,
    actual: check.actual,
    assurance: check.assurance,
    status: check.status,
  })), [
    {
      id: "reservation.exclusive.holds",
      actual: "holds",
      assurance: "alloy6-bounded",
      status: "pass",
    },
    {
      id: "reservation.eventually-released.violated",
      actual: "violated",
      assurance: "alloy6-bounded",
      status: "pass",
    },
    {
      id: "reservation.owner-capacity.violated",
      actual: "violated",
      assurance: "alloy6-bounded",
      status: "pass",
    },
  ]);
  const trace = report.checks[1].counterexample.trace;
  assert.deepEqual(trace[0], { reservation: [] });
  assert.equal(trace[1].reservation.length, 1);
  assert.match(trace[1].reservation[0].resource, /^product#\d+$/);
  assert.match(trace[1].reservation[0].owner, /^customer#\d+$/);

  const mismatchedExpectation = reservationDocument();
  mismatchedExpectation.alloyBehavior.checks[1].expectation = "holds";
  const mismatch = verifyAlloyBehaviorWithAnalyzer(mismatchedExpectation);
  assert.equal(mismatch.status, "fail");
  assert.equal(mismatch.checks[1].actual, "violated");
  assert.equal(mismatch.checks[1].status, "fail");
  assert.match(mismatch.checks[1].error, /expected holds, but found violated/);

  const releaseBeforeReserve = verifyAlloyBehaviorWithAnalyzer(releaseBeforeReserveDocument());
  assert.equal(releaseBeforeReserve.status, "pass");
  assert.equal(releaseBeforeReserve.checks[1].actual, "holds");
  assert.equal(releaseBeforeReserve.checks[1].counterexample, null);
  assert.equal(releaseBeforeReserve.checks[2].actual, "holds");
  assert.equal(releaseBeforeReserve.checks[2].counterexample, null);

  assert.deepEqual(report.sanity.map((check) => ({ id: check.id, actual: check.actual, status: check.status })), [
    { id: "world", actual: "reachable", status: "pass" },
    { id: "reserve", actual: "reachable", status: "pass" },
    { id: "release", actual: "reachable", status: "pass" },
  ]);
});

test("searches a bounded Alloy scope matrix without treating a missing small counterexample as success", { skip: !hasAlloy }, () => {
  const matrix = verifyAlloyBehaviorScopeMatrix(reservationDocument());

  assert.equal(matrix.status, "pass");
  assert.equal(matrix.cells.length, 16);
  assert.ok(matrix.cells.every((cell) => cell.checks[0].status === "pass"));
  assert.ok(matrix.cells.some((cell) => cell.checks[1].status === "counterexample"));
  assert.ok(matrix.cells.some((cell) => cell.checks[2].status === "counterexample"));
  assert.ok(matrix.cells.some((cell) => cell.checks[2].status === "not-found"));
  assert.deepEqual(Object.fromEntries(Object.entries(matrix.summary).map(([id, summary]) => [id, {
    expectation: summary.expectation,
    status: summary.status,
  }])), {
    "reservation.exclusive.holds": { expectation: "holds", status: "pass" },
    "reservation.eventually-released.violated": { expectation: "violated", status: "pass" },
    "reservation.owner-capacity.violated": { expectation: "violated", status: "pass" },
  });
});
