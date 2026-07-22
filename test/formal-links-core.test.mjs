import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import {
  FORMAL_LINKS_SCHEMA_VERSION,
  validateFormalLinks,
  verifyFormalLinks,
  verifyFormalLinksWithTools,
} from "../src/core/formal-links.mjs";

const purchaseFixture = "fixtures/formal-links-purchase.pkl";
const reservationFixture = "fixtures/formal-links-reservation.pkl";
const hasLean = spawnSync("lean", ["--version"], { encoding: "utf8" }).status === 0;
const hasAlloy = spawnSync("alloy6", ["version"], { encoding: "utf8" }).status === 0;

function purchaseDocument() {
  return evaluatePklJson(purchaseFixture);
}

function reservationDocument() {
  return evaluatePklJson(reservationFixture);
}

test("distinguishes an explicit authored Lean model from an extension of generated Lean", () => {
  const report = verifyFormalLinks(purchaseDocument());

  assert.equal(report.schemaVersion, FORMAL_LINKS_SCHEMA_VERSION);
  assert.equal(report.status, "pass");
  assert.deepEqual(report.artifacts.map((artifact) => ({
    id: artifact.id,
    backend: artifact.backend,
    mode: artifact.mode,
    imports: artifact.generated.map((dependency) => dependency.importName),
    claims: artifact.claims.map((claim) => ({
      rule: claim.rule,
      anchor: claim.anchor,
      expectation: claim.expectation,
    })),
  })), [
    {
      id: "purchase.capacity.authored-lean",
      backend: "lean",
      mode: "authored",
      imports: [],
      claims: [{
        rule: "PURCHASE-CAPACITY",
        anchor: "purchase_never_increases",
        expectation: "proved",
      }],
    },
    {
      id: "purchase.capacity.generated-lean-extension",
      backend: "lean",
      mode: "extension",
      imports: ["CommercePurchaseGenerated"],
      claims: [{
        rule: "PURCHASE-CAPACITY",
        anchor: "purchase_never_increases",
        expectation: "proved",
      }],
    },
  ]);
  assert.match(report.artifacts[1].source.digest, /^sha256:[a-f0-9]{64}$/);
  assert.match(report.artifacts[1].generated[0].digest, /^sha256:[a-f0-9]{64}$/);
});

test("requires direct artifacts to name an existing rule and language-level generated dependency", () => {
  const document = purchaseDocument();
  document.formalLinks.artifacts[1].claims[0].rule = "UNKNOWN-RULE";
  document.formalLinks.artifacts[1].generated[0].importName = "MissingGeneratedModule";

  assert.deepEqual(validateFormalLinks(document), [
    "formal link Lean extension is missing import MissingGeneratedModule: purchase.capacity.generated-lean-extension",
    "formal link references unknown domain rule: purchase.capacity.generated-lean-extension -> UNKNOWN-RULE",
  ]);
});

test("makes an accidental second source model visible in the authoring mode", () => {
  const document = purchaseDocument();
  document.formalLinks.artifacts[0].generated = [{
    path: "fixtures/behavior/CommercePurchaseGenerated.lean",
    importName: "CommercePurchaseGenerated",
  }];
  document.formalLinks.artifacts[1].generated = [];

  assert.deepEqual(validateFormalLinks(document), [
    "formal link authored artifact must not depend on generated source: purchase.capacity.authored-lean",
    "formal link extension requires generated dependency: purchase.capacity.generated-lean-extension",
  ]);
});

test("recognizes a direct Alloy check that opens the generated relational temporal model", () => {
  const report = verifyFormalLinks(reservationDocument());

  assert.equal(report.status, "pass");
  assert.deepEqual(report.artifacts[0].claims, [{
    id: "reservation.owner-capacity.extension-check",
    rule: "RESERVATION-OWNER-CAPACITY",
    anchor: "ExtensionOwnerCapacity",
    expectation: "violated",
  }]);
  assert.equal(report.artifacts[0].generated[0].importName, "CommerceReservationGenerated");
});

test("Lean and Alloy tool results are retained as distinct evidence", { skip: !hasLean || !hasAlloy }, () => {
  const purchase = verifyFormalLinksWithTools(purchaseDocument());
  const reservation = verifyFormalLinksWithTools(reservationDocument());

  assert.equal(purchase.status, "pass");
  assert.deepEqual(purchase.artifacts.map((artifact) => ({
    id: artifact.id,
    status: artifact.status,
    claims: artifact.claims.map((claim) => ({
      anchor: claim.anchor,
      actual: claim.actual,
      assurance: claim.assurance,
      status: claim.status,
    })),
  })), [
    {
      id: "purchase.capacity.authored-lean",
      status: "pass",
      claims: [{
        anchor: "purchase_never_increases",
        actual: "proved",
        assurance: "lean4-kernel",
        status: "pass",
      }],
    },
    {
      id: "purchase.capacity.generated-lean-extension",
      status: "pass",
      claims: [{
        anchor: "purchase_never_increases",
        actual: "proved",
        assurance: "lean4-kernel",
        status: "pass",
      }],
    },
  ]);

  assert.equal(reservation.status, "pass");
  assert.deepEqual(reservation.artifacts[0].claims.map((claim) => ({
    anchor: claim.anchor,
    expectation: claim.expectation,
    actual: claim.actual,
    assurance: claim.assurance,
    status: claim.status,
    hasCounterexample: Boolean(claim.counterexample),
  })), [{
    anchor: "ExtensionOwnerCapacity",
    expectation: "violated",
    actual: "violated",
    assurance: "alloy6-bounded",
    status: "pass",
    hasCounterexample: true,
  }]);
});
