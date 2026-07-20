import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import {
  boundedReachabilityReport,
  evaluateLeanTemporalFormula,
  evaluateLeanTemporalChecks,
  evaluateLeanInvariant,
  executeLeanTransitionSystem,
  initialLeanState,
  leanSemanticCoreSourceMap,
  renderLeanTransitionSystem,
  solveLeanSatChecks,
  solveLeanSatChecksDpll,
  solveLeanSatChecksTseitin,
  solveLeanSmtChecks,
  renderLeanSmtLibCheck,
  verifyLeanSmtChecksZ3,
  validateLeanSemanticCore,
  validateLeanTemporalChecks,
  verifyGeneratedLeanTransitionConformance,
  verifyLeanSemanticCore,
} from "../src/core/lean-semantic-core.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = "fixtures/lean-core-purchase.pkl";
const leanCommand = process.env.LEAN_COMMAND ?? "lean";
const hasLean = spawnSync(leanCommand, ["--version"], { encoding: "utf8" }).status === 0;
const z3Command = process.env.Z3_COMMAND ?? "z3";
const hasZ3 = spawnSync(z3Command, ["-version"], { encoding: "utf8" }).status === 0;

function purchaseDocument() {
  return evaluatePklJson(fixturePath);
}

test("executes the Pkl transition-system AST before referring to Lean proof artifacts", () => {
  const system = purchaseDocument().leanCore.transitionSystem;

  assert.deepEqual(initialLeanState(system), { available: 10 });
  const accepted = executeLeanTransitionSystem(system, { available: 1 }, {
    id: "purchase",
    input: { quantity: 1 },
  });
  assert.deepEqual(accepted, { status: "accepted", state: { available: 0 } });
  assert.equal(evaluateLeanInvariant(system, "purchase.capacity", { available: 10 }, accepted.state), true);

  const rejected = executeLeanTransitionSystem(system, { available: 1 }, {
    id: "purchase",
    input: { quantity: 2 },
  });
  assert.deepEqual(rejected, { status: "rejected", state: { available: 1 } });

  assert.throws(() => executeLeanTransitionSystem(system, { available: 1 }, {
    id: "purchase",
    input: { quantity: -1 },
  }), /action input must be a non-negative integer: purchase\.quantity/);
});

test("renders the closed Pkl transition system as a Lean denote function", () => {
  const generated = renderLeanTransitionSystem(purchaseDocument().leanCore.transitionSystem);

  assert.match(generated, /namespace DspecGenerated/);
  assert.match(generated, /structure State where\n  available : Nat/);
  assert.match(generated, /inductive Action where\n  \| purchase \(quantity : Nat\)/);
  assert.match(generated, /def initial : State := \{ available := 10 \}/);
  assert.match(generated, /def denote \(state : State\) \(action : Action\) : Option State :=/);
  assert.match(generated, /match action with/);
  assert.match(generated, /if quantity ≤ state\.available then\n      some \{ available := \(state\.available - quantity\) \}/);
});

test("rejects hand-edited drift in the generated Lean transition model", () => {
  const invalid = structuredClone(purchaseDocument());
  invalid.leanCore.generatedSource = "fixtures/lean-core/CommercePurchase.lean";

  assert.deepEqual(validateLeanSemanticCore(invalid, { projectRoot }), [
    "generated Lean transition source drift: fixtures/lean-core/CommercePurchase.lean",
  ]);
});

test("Lean compiles the generated Pkl transition denotation", { skip: !hasLean }, () => {
  const source = purchaseDocument().leanCore.generatedSource;
  const result = spawnSync(leanCommand, [source], { cwd: projectRoot, encoding: "utf8" });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("cross-checks bounded paths between Pkl and generated Lean", { skip: !hasLean }, () => {
  const core = purchaseDocument().leanCore;
  const run = spawnSync(leanCommand, [core.generatedSource], { cwd: projectRoot, encoding: "utf8" });
  const report = verifyGeneratedLeanTransitionConformance(core.transitionSystem, run.stdout);

  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.deepEqual(report, {
    status: "pass",
    assurance: "bounded-path-conformance",
    checkedPaths: 3,
    checks: [
      {
        path: [{ id: "purchase", input: { quantity: 10 } }],
        expected: "dspec-conformance|path=purchase(quantity=10)|accepted:available=0",
        actual: "dspec-conformance|path=purchase(quantity=10)|accepted:available=0",
        status: "pass",
      },
      {
        path: [{ id: "purchase", input: { quantity: 10 } }, { id: "purchase", input: { quantity: 10 } }],
        expected: "dspec-conformance|path=purchase(quantity=10)>purchase(quantity=10)|accepted:available=0>rejected:available=0",
        actual: "dspec-conformance|path=purchase(quantity=10)>purchase(quantity=10)|accepted:available=0>rejected:available=0",
        status: "pass",
      },
      {
        path: [{ id: "purchase", input: { quantity: 10 } }, { id: "purchase", input: { quantity: 10 } }, { id: "purchase", input: { quantity: 10 } }],
        expected: "dspec-conformance|path=purchase(quantity=10)>purchase(quantity=10)>purchase(quantity=10)|accepted:available=0>rejected:available=0>rejected:available=0",
        actual: "dspec-conformance|path=purchase(quantity=10)>purchase(quantity=10)>purchase(quantity=10)|accepted:available=0>rejected:available=0>rejected:available=0",
        status: "pass",
      },
    ],
    errors: [],
  });
});

test("keeps the generated Lean transition disagreement as a bounded witness", () => {
  const system = purchaseDocument().leanCore.transitionSystem;
  const report = verifyGeneratedLeanTransitionConformance(
    system,
    "[\"dspec-conformance|path=purchase(quantity=10)|accepted:available=10\",\"dspec-conformance|path=purchase(quantity=10)>purchase(quantity=10)|accepted:available=0>rejected:available=0\",\"dspec-conformance|path=purchase(quantity=10)>purchase(quantity=10)>purchase(quantity=10)|accepted:available=0>rejected:available=0>rejected:available=0\"]\n",
  );

  assert.equal(report.status, "fail");
  assert.deepEqual(report.checks, [{
    path: [{ id: "purchase", input: { quantity: 10 } }],
    expected: "dspec-conformance|path=purchase(quantity=10)|accepted:available=0",
    actual: "dspec-conformance|path=purchase(quantity=10)|accepted:available=10",
    status: "fail",
  }, {
    path: [{ id: "purchase", input: { quantity: 10 } }, { id: "purchase", input: { quantity: 10 } }],
    expected: "dspec-conformance|path=purchase(quantity=10)>purchase(quantity=10)|accepted:available=0>rejected:available=0",
    actual: "dspec-conformance|path=purchase(quantity=10)>purchase(quantity=10)|accepted:available=0>rejected:available=0",
    status: "pass",
  }, {
    path: [{ id: "purchase", input: { quantity: 10 } }, { id: "purchase", input: { quantity: 10 } }, { id: "purchase", input: { quantity: 10 } }],
    expected: "dspec-conformance|path=purchase(quantity=10)>purchase(quantity=10)>purchase(quantity=10)|accepted:available=0>rejected:available=0>rejected:available=0",
    actual: "dspec-conformance|path=purchase(quantity=10)>purchase(quantity=10)>purchase(quantity=10)|accepted:available=0>rejected:available=0>rejected:available=0",
    status: "pass",
  }]);
  assert.deepEqual(report.errors, [
    "generated Lean transition disagrees with Pkl: purchase(quantity=10)",
  ]);
});

test("checks the generated Lean transition source through its task script", () => {
  const result = spawnSync(process.execPath, [
    "scripts/generate-lean-transition.mjs",
    "--check",
    fixturePath,
  ], { cwd: projectRoot, encoding: "utf8" });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /ok: fixtures\/lean-core\/CommercePurchaseGenerated\.lean is synchronized/);
});

test("searches the explicitly finite action domain for bounded reachability", () => {
  const system = purchaseDocument().leanCore.transitionSystem;
  const report = boundedReachabilityReport(system);

  assert.equal(report.status, "pass");
  assert.equal(report.checkedStates, 2);

  const emptyStock = report.checks.find((check) => check.id === "purchase.stock-empty.reachable");
  assert.deepEqual(emptyStock, {
    id: "purchase.stock-empty.reachable",
    assurance: "bounded",
    expectation: "reachable",
    maxSteps: 1,
    status: "pass",
    witness: {
      depth: 1,
      state: { available: 0 },
      path: [{ id: "purchase", input: { quantity: 10 } }],
    },
  });

  const increasedStock = report.checks.find((check) => check.id === "purchase.stock-increase.unreachable");
  assert.deepEqual(increasedStock, {
    id: "purchase.stock-increase.unreachable",
    assurance: "bounded",
    expectation: "unreachable",
    maxSteps: 3,
    status: "pass",
    witness: null,
  });
});

test("keeps a bounded reachability witness when an unreachable claim is false", () => {
  const document = purchaseDocument();
  const check = document.leanCore.transitionSystem.boundedReachability
    .find((candidate) => candidate.id === "purchase.stock-empty.reachable");
  check.expectation = "unreachable";

  const report = boundedReachabilityReport(document.leanCore.transitionSystem);
  assert.equal(report.status, "fail");
  assert.deepEqual(report.checks[0].witness, {
    depth: 1,
    state: { available: 0 },
    path: [{ id: "purchase", input: { quantity: 10 } }],
  });
});

test("checks next, eventually, and always over an explicit finite transition trace", () => {
  const core = purchaseDocument().leanCore;
  const explicitChecks = core.temporalChecks.filter((check) => (check.scope ?? "path") === "path");
  const report = evaluateLeanTemporalChecks(core.transitionSystem, explicitChecks);

  assert.equal(report.status, "pass");
  assert.equal(report.checkedStates, 8);
  assert.deepEqual(report.checks, [
    {
      id: "purchase.stock-empty-next.holds",
      assurance: "finite-trace",
      expectation: "holds",
      status: "pass",
      trace: [{ available: 10 }, { available: 0 }],
      violation: null,
    },
    {
      id: "purchase.stock-eventually-empty.holds",
      assurance: "finite-trace",
      expectation: "holds",
      status: "pass",
      trace: [{ available: 10 }, { available: 0 }],
      violation: null,
    },
    {
      id: "purchase.capacity-always.holds",
      assurance: "finite-trace",
      expectation: "holds",
      status: "pass",
      trace: [{ available: 10 }, { available: 0 }],
      violation: null,
    },
    {
      id: "purchase.stock-unchanged-always.violated",
      assurance: "finite-trace",
      expectation: "violated",
      status: "pass",
      trace: [{ available: 10 }, { available: 0 }],
      violation: { index: 1, state: { available: 0 } },
    },
  ]);

  const next = explicitChecks[0].formula;
  assert.equal(evaluateLeanTemporalFormula(core.transitionSystem, [{ available: 10 }, { available: 0 }], next, 0), true);
  assert.equal(evaluateLeanTemporalFormula(core.transitionSystem, [{ available: 10 }, { available: 0 }], next, 1), false);
});

test("model checks temporal formulas across every bounded action path", () => {
  const system = purchaseDocument().leanCore.transitionSystem;
  const availableIsNeverAboveInitial = {
    id: "purchase.capacity-all-paths.holds",
    scope: "allPaths",
    maxSteps: 2,
    path: [],
    formula: {
      kind: "always",
      children: [{
        kind: "state",
        predicate: {
          kind: "le",
          terms: [
            { kind: "state", field: "available" },
            { kind: "initial", field: "available" },
          ],
        },
      }],
    },
    expectation: "holds",
  };
  const everyPathEventuallyEmpties = {
    id: "purchase.eventually-empty-all-paths.violated",
    scope: "allPaths",
    maxSteps: 2,
    path: [],
    formula: {
      kind: "eventually",
      children: [{
        kind: "state",
        predicate: {
          kind: "eq",
          terms: [
            { kind: "state", field: "available" },
            { kind: "literal", value: 0 },
          ],
        },
      }],
    },
    expectation: "violated",
  };

  const report = evaluateLeanTemporalChecks(system, [
    availableIsNeverAboveInitial,
    everyPathEventuallyEmpties,
  ]);

  assert.equal(report.status, "pass");
  assert.equal(report.checkedStates, 12);
  assert.deepEqual(report.checks, [
    {
      id: "purchase.capacity-all-paths.holds",
      assurance: "bounded-all-paths",
      expectation: "holds",
      maxSteps: 2,
      checkedTraces: 3,
      checkedStates: 6,
      status: "pass",
      witness: null,
    },
    {
      id: "purchase.eventually-empty-all-paths.violated",
      assurance: "bounded-all-paths",
      expectation: "violated",
      maxSteps: 2,
      checkedTraces: 3,
      checkedStates: 6,
      status: "pass",
      witness: {
        path: [],
        trace: [{ available: 10 }],
        violation: { index: 0, state: { available: 10 } },
      },
    },
  ]);
});

test("keeps declared bounded-all-paths results and their shortest counterexample", () => {
  const core = purchaseDocument().leanCore;
  const allPathsChecks = core.temporalChecks.filter((check) => check.scope === "allPaths");
  const report = evaluateLeanTemporalChecks(core.transitionSystem, allPathsChecks);

  assert.equal(report.status, "pass");
  assert.equal(report.checkedStates, 20);
  assert.deepEqual(report.checks, [
    {
      id: "purchase.capacity-all-paths.holds",
      assurance: "bounded-all-paths",
      expectation: "holds",
      maxSteps: 3,
      checkedTraces: 4,
      checkedStates: 10,
      status: "pass",
      witness: null,
    },
    {
      id: "purchase.eventually-empty-all-paths.violated",
      assurance: "bounded-all-paths",
      expectation: "violated",
      maxSteps: 3,
      checkedTraces: 4,
      checkedStates: 10,
      status: "pass",
      witness: {
        path: [],
        trace: [{ available: 10 }],
        violation: { index: 0, state: { available: 10 } },
      },
    },
  ]);
});

test("requires an explicit finite domain and bound for all-path temporal checks", () => {
  const document = purchaseDocument();
  const allPathsCheck = structuredClone(document.leanCore.temporalChecks
    .find((check) => check.scope === "allPaths"));
  const missingBound = structuredClone(allPathsCheck);
  missingBound.maxSteps = null;
  const systemWithoutFiniteInputs = structuredClone(document.leanCore.transitionSystem);
  systemWithoutFiniteInputs.actions[0].parameters[0].finiteValues = [];

  assert.deepEqual(validateLeanTemporalChecks([missingBound], document.leanCore.transitionSystem), [
    "all-path temporal check maxSteps must be a non-negative integer: purchase.capacity-all-paths.holds",
  ]);
  assert.deepEqual(validateLeanTemporalChecks([allPathsCheck], systemWithoutFiniteInputs), [
    "all-path temporal check requires finite action values: purchase.capacity-all-paths.holds -> purchase.quantity",
  ]);
});

test("decides closed Boolean SAT checks by exhaustively enumerating assignments", () => {
  const report = solveLeanSatChecks(purchaseDocument().leanCore.satChecks);

  assert.equal(report.status, "pass");
  assert.equal(report.checkedAssignments, 8);
  assert.deepEqual(report.checks, [
    {
      id: "purchase.capacity.requested-in-stock.sat",
      assurance: "exhaustive",
      expectation: "sat",
      status: "pass",
      checkedAssignments: 4,
      witness: { purchaseRequested: true, stockAvailable: true },
    },
    {
      id: "purchase.capacity.requested-out-of-stock.unsat",
      assurance: "exhaustive",
      expectation: "unsat",
      status: "pass",
      checkedAssignments: 4,
      witness: null,
    },
  ]);
});

test("keeps a Boolean assignment witness when an UNSAT constraint becomes satisfiable", () => {
  const document = purchaseDocument();
  const check = document.leanCore.satChecks
    .find((candidate) => candidate.id === "purchase.capacity.requested-out-of-stock.unsat");
  check.formula.children.pop();

  const report = solveLeanSatChecks(document.leanCore.satChecks);
  assert.equal(report.status, "fail");
  assert.deepEqual(report.checks[1].witness, {
    purchaseRequested: true,
    stockAvailable: false,
  });
});

test("normalizes SAT checks to CNF and solves them with DPLL", () => {
  const checks = purchaseDocument().leanCore.satChecks;
  const report = solveLeanSatChecksDpll(checks);

  assert.equal(report.status, "pass");
  assert.deepEqual(report.checks.map((check) => ({
    id: check.id,
    expectation: check.expectation,
    status: check.status,
    cnf: check.cnf,
    decisions: check.decisions,
    witness: check.witness,
  })), [
    {
      id: "purchase.capacity.requested-in-stock.sat",
      expectation: "sat",
      status: "pass",
      cnf: [
        [{ variable: "purchaseRequested", negated: false }],
        [{ variable: "stockAvailable", negated: false }],
      ],
      decisions: 0,
      witness: { purchaseRequested: true, stockAvailable: true },
    },
    {
      id: "purchase.capacity.requested-out-of-stock.unsat",
      expectation: "unsat",
      status: "pass",
      cnf: [
        [{ variable: "purchaseRequested", negated: false }],
        [{ variable: "stockAvailable", negated: true }],
        [
          { variable: "purchaseRequested", negated: true },
          { variable: "stockAvailable", negated: false },
        ],
      ],
      decisions: 0,
      witness: null,
    },
  ]);
});

test("DPLL agrees with exhaustive SAT checking on a representative formula corpus", () => {
  const variable = (name) => ({ kind: "variable", name, children: [] });
  const not = (child) => ({ kind: "not", children: [child] });
  const and = (...children) => ({ kind: "and", children });
  const or = (...children) => ({ kind: "or", children });
  const checks = [
    {
      id: "tautology",
      variables: ["a"],
      expectation: "sat",
      formula: or(variable("a"), not(variable("a"))),
    },
    {
      id: "contradiction",
      variables: ["a"],
      expectation: "unsat",
      formula: and(variable("a"), not(variable("a"))),
    },
    {
      id: "three-clause",
      variables: ["a", "b"],
      expectation: "sat",
      formula: and(
        or(variable("a"), variable("b")),
        or(not(variable("a")), variable("b")),
        or(variable("a"), not(variable("b"))),
      ),
    },
  ];

  const exhaustive = solveLeanSatChecks(checks);
  const dpll = solveLeanSatChecksDpll(checks);
  assert.equal(dpll.status, exhaustive.status);
  assert.deepEqual(
    dpll.checks.map((check) => ({ id: check.id, status: check.status })),
    exhaustive.checks.map((check) => ({ id: check.id, status: check.status })),
  );
});

test("uses Tseitin auxiliary variables while returning only domain-variable witnesses", () => {
  const report = solveLeanSatChecksTseitin(purchaseDocument().leanCore.satChecks);

  assert.equal(report.status, "pass");
  assert.deepEqual(report.checks.map((check) => ({
    id: check.id,
    status: check.status,
    auxiliaryVariables: check.auxiliaryVariables,
    clauses: check.cnf.length,
    witness: check.witness,
  })), [
    {
      id: "purchase.capacity.requested-in-stock.sat",
      status: "pass",
      auxiliaryVariables: ["__tseitin_0"],
      clauses: 4,
      witness: { purchaseRequested: true, stockAvailable: true },
    },
    {
      id: "purchase.capacity.requested-out-of-stock.unsat",
      status: "pass",
      auxiliaryVariables: ["__tseitin_0", "__tseitin_1"],
      clauses: 8,
      witness: null,
    },
  ]);
});

test("exhaustively checks bounded integer constraints before using an SMT backend", () => {
  const report = solveLeanSmtChecks(purchaseDocument().leanCore.smtChecks);

  assert.equal(report.status, "pass");
  assert.equal(report.checkedAssignments, 242);
  assert.deepEqual(report.checks, [
    {
      id: "purchase.capacity.requested-five-stock-five.sat",
      assurance: "bounded-exhaustive",
      expectation: "sat",
      status: "pass",
      checkedAssignments: 121,
      witness: { requestedQuantity: 5, availableStock: 5 },
    },
    {
      id: "purchase.capacity.requested-seven-stock-five.unsat",
      assurance: "bounded-exhaustive",
      expectation: "unsat",
      status: "pass",
      checkedAssignments: 121,
      witness: null,
    },
  ]);
});

test("renders the bounded integer check as QF_LIA SMT-LIB", () => {
  const check = purchaseDocument().leanCore.smtChecks[0];
  assert.equal(renderLeanSmtLibCheck(check), [
    "(set-logic QF_LIA)",
    "(declare-const |requestedQuantity| Int)",
    "(assert (and (<= 0 |requestedQuantity|) (<= |requestedQuantity| 10)))",
    "(declare-const |availableStock| Int)",
    "(assert (and (<= 0 |availableStock|) (<= |availableStock| 10)))",
    "(assert (and (= |requestedQuantity| 5) (= |availableStock| 5) (<= |requestedQuantity| |availableStock|)))",
    "(check-sat)",
    "",
  ].join("\n"));
});

test("Z3 agrees with bounded exhaustive integer checking", { skip: !hasZ3 }, () => {
  const report = verifyLeanSmtChecksZ3(purchaseDocument().leanCore.smtChecks, { z3Command });
  assert.equal(report.status, "pass");
  assert.deepEqual(report.checks.map((check) => ({
    id: check.id,
    result: check.result,
    status: check.status,
  })), [
    {
      id: "purchase.capacity.requested-five-stock-five.sat",
      result: "sat",
      status: "pass",
    },
    {
      id: "purchase.capacity.requested-seven-stock-five.unsat",
      result: "unsat",
      status: "pass",
    },
  ]);
});

test("Tseitin encoding avoids exponential CNF distribution on a wider formula", () => {
  const variable = (name) => ({ kind: "variable", name, children: [] });
  const and = (...children) => ({ kind: "and", children });
  const or = (...children) => ({ kind: "or", children });
  const pairCount = 8;
  const variables = Array.from({ length: pairCount }, (_, index) => [
    `left${index}`,
    `right${index}`,
  ]).flat();
  const formula = or(...Array.from({ length: pairCount }, (_, index) => and(
    variable(`left${index}`),
    variable(`right${index}`),
  )));
  const check = {
    id: "wide-disjunction",
    variables,
    expectation: "sat",
    formula,
  };

  const distributed = solveLeanSatChecksDpll([check]).checks[0];
  const tseitin = solveLeanSatChecksTseitin([check]).checks[0];
  assert.equal(distributed.cnf.length, 256);
  assert.equal(tseitin.cnf.length, 34);
  assert.equal(tseitin.status, "pass");
  assert.equal(tseitin.witness.left0, true);
  assert.equal(tseitin.witness.right0, true);
});

test("fails semantic-core verification when a SAT expectation has a Boolean witness", () => {
  const document = purchaseDocument();
  const check = document.leanCore.satChecks
    .find((candidate) => candidate.id === "purchase.capacity.requested-out-of-stock.unsat");
  check.formula.children.pop();

  const report = verifyLeanSemanticCore(document, { projectRoot, leanCommand });
  assert.equal(report.status, "fail");
  assert.equal(report.sat.status, "fail");
  assert.equal(report.dpll.status, "fail");
  assert.equal(report.tseitin.status, "fail");
  assert.deepEqual(report.errors, [
    "SAT check failed: purchase.capacity.requested-out-of-stock.unsat",
  ]);
});

test("fails semantic-core verification when a bounded reachability claim has a witness", () => {
  const document = purchaseDocument();
  const check = document.leanCore.transitionSystem.boundedReachability
    .find((candidate) => candidate.id === "purchase.stock-empty.reachable");
  check.expectation = "unreachable";

  const report = verifyLeanSemanticCore(document, { projectRoot, leanCommand });
  assert.equal(report.status, "fail");
  assert.equal(report.boundedReachability.status, "fail");
  assert.deepEqual(report.errors, [
    "bounded reachability check failed: purchase.stock-empty.reachable",
  ]);
});

test("binds Pkl purchase requirements to stable Lean declarations", () => {
  const document = purchaseDocument();

  assert.deepEqual(validateLeanSemanticCore(document, { projectRoot }), []);
  assert.deepEqual(leanSemanticCoreSourceMap(document), [
    {
      assurance: "bounded",
      claimId: "purchase.capacity.non-atomic-oversell",
      declaration: "finiteBrokenModelFindsOversell",
      ruleId: "PURCHASE-CAPACITY",
      source: "fixtures/lean-core/CommercePurchase.lean",
    },
    {
      assurance: "proved",
      claimId: "purchase.capacity.atomic-preserves-capacity",
      declaration: "atomicPurchasePreservesCapacity",
      ruleId: "PURCHASE-CAPACITY",
      source: "fixtures/lean-core/CommercePurchase.lean",
    },
    {
      assurance: "exhaustive",
      claimId: "purchase.capacity.requested-in-stock.sat",
      declaration: "purchaseRequestedAndStockAvailableSat",
      ruleId: "PURCHASE-CAPACITY",
      source: "fixtures/lean-core/CommercePurchase.lean",
    },
    {
      assurance: "exhaustive",
      claimId: "purchase.capacity.requested-out-of-stock.unsat",
      declaration: "requestedWithoutStockViolatesCapacityUnsat",
      ruleId: "PURCHASE-CAPACITY",
      source: "fixtures/lean-core/CommercePurchase.lean",
    },
    {
      assurance: "bounded-exhaustive",
      claimId: "purchase.capacity.requested-five-stock-five.sat",
      declaration: "requestedFiveStockFiveSatisfiesCapacity",
      ruleId: "PURCHASE-CAPACITY",
      source: "fixtures/lean-core/CommercePurchase.lean",
    },
    {
      assurance: "bounded-exhaustive",
      claimId: "purchase.capacity.requested-seven-stock-five.unsat",
      declaration: "requestedSevenStockFiveViolatesCapacityUnsat",
      ruleId: "PURCHASE-CAPACITY",
      source: "fixtures/lean-core/CommercePurchase.lean",
    },
    {
      assurance: "finite-trace",
      claimId: "purchase.stock-empty-next.holds",
      declaration: "fullPurchaseNextEmptiesStock",
      ruleId: "PURCHASE-CAPACITY",
      source: "fixtures/lean-core/CommercePurchase.lean",
    },
    {
      assurance: "finite-trace",
      claimId: "purchase.stock-eventually-empty.holds",
      declaration: "fullPurchaseEventuallyEmptiesStock",
      ruleId: "PURCHASE-CAPACITY",
      source: "fixtures/lean-core/CommercePurchase.lean",
    },
    {
      assurance: "finite-trace",
      claimId: "purchase.capacity-always.holds",
      declaration: "fullPurchaseTraceAlwaysWithinInitialCapacity",
      ruleId: "PURCHASE-CAPACITY",
      source: "fixtures/lean-core/CommercePurchase.lean",
    },
    {
      assurance: "finite-trace",
      claimId: "purchase.stock-unchanged-always.violated",
      declaration: "fullPurchaseDoesNotKeepStockAtTen",
      ruleId: "PURCHASE-CAPACITY",
      source: "fixtures/lean-core/CommercePurchase.lean",
    },
    {
      assurance: "bounded-all-paths",
      claimId: "purchase.capacity-all-paths.holds",
      declaration: "atomicPurchaseTracePreservesCapacity",
      ruleId: "PURCHASE-CAPACITY",
      source: "fixtures/lean-core/CommercePurchase.lean",
    },
    {
      assurance: "bounded-all-paths",
      claimId: "purchase.eventually-empty-all-paths.violated",
      declaration: "emptyPurchaseTraceDoesNotEmptyStock",
      ruleId: "PURCHASE-CAPACITY",
      source: "fixtures/lean-core/CommercePurchase.lean",
    },
  ]);
});

test("interprets conjunctions in an invariant as all of their child formulas", () => {
  const document = purchaseDocument();
  const invariant = document.leanCore.transitionSystem.invariants[0];
  invariant.formula = {
    kind: "and",
    terms: [],
    children: [
      invariant.formula,
      {
        kind: "eq",
        terms: [
          { kind: "state", field: "available", value: null, children: [] },
          { kind: "state", field: "available", value: null, children: [] },
        ],
        children: [],
      },
    ],
  };

  assert.deepEqual(validateLeanSemanticCore(document, { projectRoot }), []);
  assert.equal(evaluateLeanInvariant(document.leanCore.transitionSystem, "purchase.capacity", { available: 10 }, { available: 0 }), true);
});

test("rejects a Pkl formal target that has no Lean declaration", () => {
  const document = purchaseDocument();
  const invalid = structuredClone(document);
  invalid.leanCore.claims[1].declaration = "missingLeanTheorem";

  assert.deepEqual(validateLeanSemanticCore(invalid, { projectRoot }), [
    "Lean declaration not found: purchase.capacity.atomic-preserves-capacity -> missingLeanTheorem",
  ]);
});

test("requires a proved Pkl claim to bind a Lean theorem rather than a definition", () => {
  const document = purchaseDocument();
  const invalid = structuredClone(document);
  invalid.leanCore.claims[1].declaration = "finiteBrokenModelFindsOversell";

  assert.deepEqual(validateLeanSemanticCore(invalid, { projectRoot }), [
    "proved Lean claim must bind a theorem: purchase.capacity.atomic-preserves-capacity -> finiteBrokenModelFindsOversell",
  ]);
});

test("Lean reports the non-atomic oversell witness and checks the atomic invariant", {
  skip: !hasLean,
}, () => {
  const report = verifyLeanSemanticCore(purchaseDocument(), {
    projectRoot,
    leanCommand,
  });

  assert.equal(report.status, "pass");
  assert.equal(report.summary.claims, 12);
  assert.equal(report.boundedReachability.status, "pass");
  assert.equal(report.sat.status, "pass");
  assert.equal(report.dpll.status, "pass");
  assert.equal(report.tseitin.status, "pass");
  assert.equal(report.smt.status, "pass");
  assert.equal(report.z3.status, hasZ3 ? "pass" : "skip");
  assert.equal(report.temporal.status, "pass");
  assert.deepEqual({
    source: report.generatedTransition.source,
    status: report.generatedTransition.status,
    stderr: report.generatedTransition.stderr,
  }, {
    source: "fixtures/lean-core/CommercePurchaseGenerated.lean",
    status: "pass",
    stderr: "",
  });
  assert.equal(report.generatedTransition.conformance.status, "pass");
  assert.equal(report.generatedTransition.conformance.assurance, "bounded-path-conformance");
  assert.equal(report.generatedTransition.conformance.checkedPaths, 3);
  assert.match(report.generatedTransition.stdout, /rejected:available=0/);
  assert.match(report.stdout, /broken witness: stock=1, accepted=2, requested=2/);
  assert.match(report.stdout, /atomicPurchasePreservesCapacity/);
  assert.match(report.stdout, /requestedWithoutStockViolatesCapacityUnsat/);
  assert.match(report.stdout, /requestedSevenStockFiveViolatesCapacityUnsat/);
  assert.match(report.stdout, /fullPurchaseEventuallyEmptiesStock/);
  assert.doesNotMatch(report.stdout, /Lean\.(?:trustCompiler|ofReduceBool)/);
});
