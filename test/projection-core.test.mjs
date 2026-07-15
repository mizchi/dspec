import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKDOWN_PROJECTION_EMITTER,
  PROJECTION_PROVENANCE_SCHEMA_VERSION,
  createProjectionSnapshot,
  planProjectionChanges,
  projectionGenerateArgv,
  projectionPlanReport,
  validateProjectionContracts,
} from "../src/core/projection.mjs";

const generatedAt = "2026-07-15T00:00:00.000Z";

function fixtureModel() {
  return {
    id: "projection-core-fixture",
    version: "0.1.0",
    locales: ["ja", "en"],
    projections: [
      {
        id: "localized-markdown",
        kind: "markdown",
        source: "self",
        matrix: "locales",
        output: "generated/projection/{locale}/spec.md",
        provenance: "generated/projection/spec.provenance.json",
        freshness: "exact",
      },
    ],
  };
}

const renderMarkdown = (_model, locale) => `# ${locale}\n`;

test("builds deterministic Projection snapshots and provenance", () => {
  const model = fixtureModel();
  assert.deepEqual(validateProjectionContracts(model), []);

  const snapshot = createProjectionSnapshot(model, { renderMarkdown });
  assert.match(snapshot.model.digest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(snapshot.emitter, MARKDOWN_PROJECTION_EMITTER);
  assert.deepEqual(
    snapshot.projections[0].artifacts.map((artifact) => `${artifact.locale}:${artifact.path}`),
    ["en:generated/projection/en/spec.md", "ja:generated/projection/ja/spec.md"],
  );
  assert.equal(snapshot.projections[0].provenancePath, "generated/projection/spec.provenance.json");
});

test("isolates Projection snapshots from renderer mutation", () => {
  const model = fixtureModel();
  const originalLocales = [...model.locales];
  createProjectionSnapshot(model, {
    renderMarkdown(sourceModel, locale) {
      sourceModel.locales.push("fr");
      return `# ${locale}\n`;
    },
  });

  assert.deepEqual(model.locales, originalLocales);
});

test("plans create, update, remove, and unchanged actions without filesystem access", () => {
  const snapshot = createProjectionSnapshot(fixtureModel(), { renderMarkdown });
  const observed = [
    {
      content: "# en\n",
      kind: "artifact",
      locale: "en",
      path: "generated/projection/en/spec.md",
      projectionId: "localized-markdown",
    },
    {
      content: "stale\n",
      kind: "artifact",
      locale: "ja",
      path: "generated/projection/ja/spec.md",
      projectionId: "localized-markdown",
    },
    {
      content: "extra\n",
      kind: "artifact",
      locale: "fr",
      path: "generated/projection/fr/spec.md",
      projectionId: "localized-markdown",
      unexpected: true,
    },
  ];

  const plan = planProjectionChanges(snapshot, observed, { generatedAt });
  assert.deepEqual(plan.summary, {
    actions: 4,
    changed: 3,
    create: 1,
    remove: 1,
    unchanged: 1,
    update: 1,
  });
  assert.deepEqual(
    Object.fromEntries(plan.actions.map((action) => [action.path, `${action.action}:${action.reason}`])),
    {
      "generated/projection/en/spec.md": "unchanged:current",
      "generated/projection/fr/spec.md": "remove:unexpected",
      "generated/projection/ja/spec.md": "update:content-drift",
      "generated/projection/spec.provenance.json": "create:missing-provenance",
    },
  );
  assert.equal(JSON.parse(plan.actions.find((action) => action.kind === "provenance").desiredContent).generatedAt, generatedAt);

  const report = projectionPlanReport(plan);
  assert.ok(report.actions.every((action) => !("desiredContent" in action)));
  assert.equal(report.provenance[0].schemaVersion, PROJECTION_PROVENANCE_SCHEMA_VERSION);
  assert.equal(report.provenance[0].modelDigest, snapshot.model.digest);
});

test("preserves provenance generation time while its deterministic inputs stay current", () => {
  const snapshot = createProjectionSnapshot(fixtureModel(), { renderMarkdown });
  const initial = planProjectionChanges(snapshot, [], { generatedAt });
  const observations = initial.actions
    .filter((action) => action.action === "create")
    .map((action) => ({
      content: action.desiredContent,
      kind: action.kind,
      locale: action.locale,
      path: action.path,
      projectionId: action.projectionId,
    }));

  const repeated = planProjectionChanges(snapshot, observations, { generatedAt: "2027-01-01T00:00:00.000Z" });
  assert.equal(repeated.summary.changed, 0);
  const provenance = repeated.actions.find((action) => action.kind === "provenance");
  assert.equal(provenance.action, "unchanged");
  assert.equal(JSON.parse(provenance.desiredContent).generatedAt, generatedAt);
});

test("represents generation commands as argv", () => {
  assert.deepEqual(
    projectionGenerateArgv("specs/my app.pkl", {
      dryRun: true,
      generatedAt,
      root: "build root",
    }),
    [
      "dspec",
      "generate",
      "--dry-run",
      "--generated-at",
      generatedAt,
      "--root",
      "build root",
      "specs/my app.pkl",
    ],
  );
});

test("rejects unsafe or colliding provenance contracts", () => {
  const model = fixtureModel();
  model.projections[0].provenance = "../spec.json";
  assert.match(validateProjectionContracts(model).join("\n"), /provenance must stay under the generation root/);

  model.projections[0].provenance = "generated/projection/ja/spec.md";
  assert.match(validateProjectionContracts(model).join("\n"), /projection output collision/);

  delete model.projections[0].provenance;
  assert.match(validateProjectionContracts(model).join("\n"), /provenance must stay under the generation root/);
});
