import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clauseIdentity,
  exprAstKey,
  ruleClauseSelectors,
  validateModelStructure,
} from "../src/core/model-structure-validation.mjs";

describe("model structure validation core", () => {
  it("reports catalog, reference, Clause.ast, and coverage errors in contract order", () => {
    assert.deepEqual(validateModelStructure({
      clauseAstSemanticsVersion: "0.9",
      locales: ["en"],
      primaryLocale: "ja",
      vocabulary: [
        {
          id: "term.duplicate",
          values: ["term.missing-value"],
          supersedes: ["term.missing-history"],
        },
        { id: "term.duplicate" },
      ],
      decisions: [
        { id: "decision.duplicate" },
        { id: "decision.duplicate" },
      ],
      rules: [
        {
          id: "RULE-DUPLICATE",
          terms: ["term.missing"],
          exceptions: ["RULE-MISSING"],
          when: [{ ast: { op: "atom" } }],
          must: [{ expr: "same.expr" }],
          mustNot: [{ expr: "same.expr" }],
          checks: [{ covers: ["must[1]"] }],
          implementedBy: [],
          reviewStatus: "draft",
        },
        {
          id: "RULE-DUPLICATE",
          when: [],
          must: [],
          mustNot: [],
          checks: [],
          implementedBy: [],
          reviewStatus: "draft",
        },
      ],
    }), [
      "duplicate term id: term.duplicate",
      "duplicate rule id: RULE-DUPLICATE",
      "duplicate decision id: decision.duplicate",
      "unsupported Clause.ast semantics version: 0.9",
      "primary locale is not listed in locales: ja",
      "unknown term value reference: term.duplicate -> term.missing-value",
      "unknown superseded term reference: term.duplicate -> term.missing-history",
      "unknown term reference: RULE-DUPLICATE -> term.missing",
      "unknown exception reference: RULE-DUPLICATE -> RULE-MISSING",
      "rule has both must and mustNot: RULE-DUPLICATE -> same.expr",
      "invalid expr ast: RULE-DUPLICATE when[0] atom expects name",
      "unknown check target covered clause: RULE-DUPLICATE -> must[1]",
    ]);
  });

  it("requires active approved rules to declare a verification target", () => {
    assert.deepEqual(validateModelStructure({
      clauseAstSemanticsVersion: "1.0",
      locales: ["en"],
      primaryLocale: "en",
      vocabulary: [],
      decisions: [],
      rules: [{
        id: "RULE-APPROVED",
        reviewStatus: "approved",
        deprecated: false,
        when: [],
        must: [],
        mustNot: [],
        checks: [],
        implementedBy: [],
      }],
    }, {
      validateRuleAfterStructure: (rule) => [`assurance validation: ${rule.id}`],
    }), [
      "assurance validation: RULE-APPROVED",
      "approved rule has no verification target: RULE-APPROVED",
    ]);
  });

  it("exposes stable clause identities and selectors", () => {
    const atom = { op: "atom", name: "allow", args: ["read", "document"] };
    const rule = {
      when: [{ expr: "condition" }],
      must: [{ ast: atom }, { expr: "second" }],
      mustNot: [{ expr: "denied" }],
    };

    assert.equal(exprAstKey(atom), "atom:allow(read,document)");
    assert.equal(exprAstKey({ op: "future", z: 1, a: 2 }), '{"a":2,"op":"future","z":1}');
    assert.equal(clauseIdentity({ ast: atom }), "atom:allow(read,document)");
    assert.equal(clauseIdentity({ expr: "opaque.expr" }), "opaque.expr");
    assert.deepEqual(ruleClauseSelectors(rule), [
      "when[0]",
      "must[0]",
      "must[1]",
      "mustNot[0]",
    ]);
  });
});
