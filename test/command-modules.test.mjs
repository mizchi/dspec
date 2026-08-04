import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TOP_LEVEL_COMMANDS, topLevelCommand, topLevelCommandRegistry } from "../src/commands/registry.mjs";
import { domainUsage, parseDomainArgs } from "../src/commands/domain.mjs";
import { dailyDriftUsage } from "../src/commands/daily-drift.mjs";
import { appProfileObservedFixtureStep } from "../src/commands/app-profile-observed-fixture.mjs";
import { parseAppProfileArgs, parseScaffoldAppProfileArgs } from "../src/commands/app-profile-options.mjs";
import {
  renderAppChangeReplayReport,
  renderAppProfileMarkdownReport,
  renderAppProfileMutationScoreReport,
  renderAppProfileReport,
} from "../src/commands/app-profile-render.mjs";
import {
  scaffoldAppProfile,
  scaffoldAppProfileApplyReport,
  scaffoldAppProfileDiffReport,
} from "../src/commands/app-profile-scaffold.mjs";
import { parseIntentGraphArgs } from "../src/commands/intent-options.mjs";
import { appProfileReport, appProfileSuiteReport } from "../src/core/app-profile-report.mjs";

function appProfileContext() {
  const pass = () => ({ status: "pass", errors: [] });
  return {
    loadModel: (path) => ({ path }),
    importRealApp: (root) => ({ id: `app:${root}`, routes: ["/health"], contracts: { schemas: ["health"] }, workflows: [] }),
    checkReport: pass,
    driftReport: pass,
    domainCoverageReport: pass,
    reconcileRealAppReport: pass,
    reverseCoverageReport: pass,
    observedFixtureStep: () => ({ id: "observed-fixture", status: "pass", errors: [] }),
    loadAppProfile: (path) => ({
      id: path,
      modelPath: "model.pkl",
      appRoot: "app",
      gates: ["check"],
    }),
    reportStatus: (errors) => errors.length === 0 ? "pass" : "fail",
    sortedUnique: (values) => [...new Set(values)].sort(),
  };
}

describe("command modules", () => {
  it("keeps the top-level registry unique and queryable outside the executable entrypoint", () => {
    const commands = topLevelCommandRegistry();

    assert.equal(commands.length, TOP_LEVEL_COMMANDS.length);
    assert.equal(new Set(commands.map((command) => command.name)).size, commands.length);
    assert.match(topLevelCommand("domain").usage, /^dspec domain /);
  });

  it("parses the domain command without depending on the CLI entrypoint", () => {
    assert.deepEqual(parseDomainArgs(["--json", "examples/tetris.pkl"], "ir"), {
      json: true,
      markdown: false,
      mermaid: false,
      language: null,
      outputFile: null,
      modelFile: "examples/tetris.pkl",
    });
    assert.match(domainUsage(), /dspec domain relationships/);
  });

  it("keeps intent command options independent from execution adapters", () => {
    assert.deepEqual(parseIntentGraphArgs(["--markdown", "--locale", "ja", "examples/dspec.pkl"]), {
      json: false,
      markdown: true,
      locale: "ja",
      modelFile: "examples/dspec.pkl",
    });
  });

  it("keeps daily-drift help independent from the CLI dispatcher", () => {
    assert.match(dailyDriftUsage(), /dspec daily-drift collect/);
  });

  it("evaluates app-profile gates and suites through an injectable integration boundary", () => {
    const context = appProfileContext();
    const report = appProfileReport({
      id: "health-check",
      modelPath: "model.pkl",
      appRoot: "app",
      gates: ["check", "import-real-app"],
    }, {}, context);

    assert.deepEqual(report, {
      profile: {
        id: "health-check",
        modelPath: "model.pkl",
        appRoot: "app",
        observedFacts: null,
      },
      status: "pass",
      passed: 2,
      total: 2,
      checks: [
        { id: "check", status: "pass", errors: [], summary: undefined },
        {
          id: "import-real-app",
          status: "pass",
          errors: [],
          observed: { id: "app:app" },
          facts: { routes: 1, schemas: 1, workflows: 0 },
        },
      ],
      errors: [],
    });
    assert.match(renderAppProfileReport(report), /ok: health-check app profile \(2\/2 checks\)/);
    assert.match(renderAppProfileMarkdownReport(report), /\| import-real-app \| pass \|  \|/);
    assert.equal(
      renderAppProfileMutationScoreReport({
        status: "pass",
        profile: { id: "health-check" },
        score: 1,
        detected: 2,
        generated: 2,
      }),
      "ok: health-check app profile mutation score 1 (2/2 detected)\n",
    );
    assert.equal(
      renderAppChangeReplayReport({ status: "pass", corpus: { id: "smoke" }, passed: 1, total: 1 }),
      "ok: smoke app change replay (1/1 cases)\n",
    );

    const suite = appProfileSuiteReport({ id: "smoke", profiles: ["first", "second"] }, {}, context);
    assert.equal(suite.status, "pass");
    assert.deepEqual(suite.suite, { id: "smoke", profiles: ["first", "second"] });
    assert.equal(suite.total, 2);
  });

  it("keeps observed-facts fixes behind an explicit non-dry-run write", () => {
    const writes = [];
    const context = {
      stableJson: (value) => `${JSON.stringify(value)}\n`,
      exists: () => false,
      resolve: (path) => `/worktree/${path}`,
      read: () => "",
      write: (path, value) => writes.push({ path, value }),
    };
    const profile = { observedFacts: "facts.json" };

    const dryRun = appProfileObservedFixtureStep(profile, { app: "actual" }, { fix: true, dryRun: true }, context);
    assert.equal(dryRun.status, "fail");
    assert.equal(dryRun.wouldFix, true);
    assert.deepEqual(writes, []);

    const fixed = appProfileObservedFixtureStep(profile, { app: "actual" }, { fix: true }, context);
    assert.equal(fixed.status, "pass");
    assert.equal(fixed.fixed, true);
    assert.deepEqual(writes, [{ path: "/worktree/facts.json", value: "{\"app\":\"actual\"}\n" }]);
  });

  it("keeps app-profile scaffolding and diff/apply decisions outside the CLI", () => {
    const writes = [];
    const context = {
      appRootId: () => "storefront",
      resolve: (path) => `/worktree/${path}`,
      write: (path, value) => writes.push({ path, value }),
    };
    const source = scaffoldAppProfile({ modelFile: "spec.pkl", appRoot: "app", gates: ["check"] }, context);
    assert.match(source, /profile: d\.AppProfile/);
    assert.match(source, /id = "storefront"/);

    const current = {
      id: "storefront",
      modelPath: "spec.pkl",
      appRoot: "app",
      observedFacts: "facts.json",
      gates: ["check"],
    };
    const changed = { ...current, gates: ["check", "drift"] };
    const diff = scaffoldAppProfileDiffReport(current, changed);
    assert.deepEqual(diff.changes.map((change) => change.field), ["gates"]);

    const preview = scaffoldAppProfileApplyReport("profile.pkl", current, changed, source, { dryRun: true }, context);
    assert.equal(preview.wouldApply, true);
    assert.deepEqual(writes, []);

    const applied = scaffoldAppProfileApplyReport("profile.pkl", current, changed, source, {}, context);
    assert.equal(applied.applied, true);
    assert.deepEqual(writes, [{ path: "/worktree/profile.pkl", value: source }]);
  });

  it("parses app-profile command modes without depending on global CLI state", () => {
    assert.deepEqual(parseAppProfileArgs(["--fix", "--dry-run", "--json", "one.pkl", "two.pkl"], "usage\n"), {
      files: ["one.pkl", "two.pkl"],
      fix: true,
      dryRun: true,
      json: true,
      markdown: false,
    });
    assert.deepEqual(parseScaffoldAppProfileArgs([
      "--apply", "profile.pkl", "--observed-facts", "facts.json", "--gate", "check", "model.pkl", "app",
    ], "usage\n"), {
      modelFile: "model.pkl",
      appRoot: "app",
      observedFacts: "facts.json",
      gates: ["check"],
      applyFile: "profile.pkl",
      diffFile: null,
      dryRun: false,
      json: false,
    });
  });
});
