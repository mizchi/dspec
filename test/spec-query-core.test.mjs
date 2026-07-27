import assert from "node:assert/strict";
import test from "node:test";

import { querySpec, verifySpecAnswer } from "../src/core/spec-query.mjs";

const model = {
  id: "query-core",
  version: "0.1.0",
  primaryLocale: "en",
  vocabulary: [
    { id: "term.account", kind: "entity", text: { default: "Account", labels: { en: "Account", ja: "口座" } } },
    { id: "term.owner", kind: "entity", text: { default: "Owner", labels: { en: "Owner", ja: "所有者" } } },
  ],
  rules: [
    {
      id: "ACCOUNT-OWNER",
      kind: "invariant",
      text: { default: "An account has an owner", labels: { en: "An account has an owner", ja: "口座には所有者がいる" } },
      terms: ["term.account", "term.owner"],
      reviewStatus: "approved",
      priority: 100,
      deprecated: false,
      must: [{ expr: "account.owner != null", text: { default: "owner exists", labels: { en: "owner exists", ja: "所有者が存在する" } } }],
      mustNot: [{ expr: "account.owner == null", text: { default: "owner missing", labels: { en: "owner missing", ja: "所有者が不在" } } }],
      when: [],
      checks: [{ backend: "node", ref: "test/account.test.mjs#owner", assurances: ["reference", "executed"] }],
      implementedBy: [{ kind: "code", path: "src/account.mjs", symbol: "hasOwner" }],
    },
    {
      id: "ACCOUNT-AUDIT",
      kind: "obligation",
      text: { default: "Account updates are audited", labels: { en: "Account updates are audited", ja: "口座更新は監査される" } },
      terms: ["term.account"],
      reviewStatus: "draft",
      priority: 100,
      deprecated: false,
      must: [],
      mustNot: [],
      when: [],
      checks: [],
      implementedBy: [],
    },
  ],
};

test("returns a localized, evidence-grounded rule query", () => {
  const report = querySpec(model, { kind: "rule", id: "ACCOUNT-OWNER" }, { locale: "ja" });

  assert.equal(report.status, "pass");
  assert.equal(report.classification, "entailed");
  assert.equal(report.result.text, "口座には所有者がいる");
  assert.deepEqual(report.evidence.map((entry) => entry.ref), [
    "rule:ACCOUNT-OWNER",
    "clause:ACCOUNT-OWNER#must[0]",
    "clause:ACCOUNT-OWNER#mustNot[0]",
    "check:ACCOUNT-OWNER#0",
    "implementation:ACCOUNT-OWNER#0",
  ]);
});

test("classifies an explicit prohibition as contradicted and unknown ids as not-supported", () => {
  const prohibited = querySpec(model, { kind: "clause", id: "ACCOUNT-OWNER", selector: "mustNot[0]" });
  const missing = querySpec(model, { kind: "term", id: "term.unknown" });

  assert.equal(prohibited.classification, "contradicted");
  assert.equal(prohibited.result.text, "owner missing");
  assert.equal(missing.status, "pass");
  assert.equal(missing.classification, "not-supported");
  assert.equal(missing.result, null);
});

test("finds the rules impacted by a term and rejects unsupported answer evidence", () => {
  const impact = querySpec(model, { kind: "impact", id: "term.account" });
  const verified = verifySpecAnswer(impact, {
    classification: "entailed",
    evidence: ["term:term.account", "rule:ACCOUNT-AUDIT"],
  });
  const invalid = verifySpecAnswer(impact, {
    classification: "entailed",
    evidence: ["rule:DOES-NOT-EXIST"],
  });

  assert.deepEqual(impact.result.rules.map((rule) => rule.id), ["ACCOUNT-AUDIT", "ACCOUNT-OWNER"]);
  assert.equal(verified.status, "pass");
  assert.equal(invalid.status, "fail");
  assert.match(invalid.errors[0], /does not resolve/);
});
