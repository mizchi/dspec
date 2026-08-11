import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  releaseEnvironments,
  releaseGates,
  releaseMigrations,
  releasePattern,
  releaseRollbacks,
  releaseServices,
  releaseSteps,
  validateReleaseModel,
} from "../src/core/release-model-validation.mjs";

describe("Release model validation core", () => {
  it("accepts an absent or internally consistent Release pattern", () => {
    assert.deepEqual(validateReleaseModel({}), []);
    assert.deepEqual(validateReleaseModel({
      patterns: {
        release: {
          services: [{ id: "api" }],
          environments: [{ id: "production" }],
          gates: [{ id: "healthy" }],
          rollbacks: [{ id: "api-rollback", service: "api" }],
          migrations: [{ id: "api-migration", service: "api" }],
          steps: [{
            id: "api-canary",
            service: "api",
            environment: "production",
            trafficPercent: 10,
            gates: ["healthy"],
            rollback: "api-rollback",
            migration: "api-migration",
          }],
        },
      },
    }), []);
  });

  it("reports Release reference errors in deterministic validation order", () => {
    const errors = validateReleaseModel({
      patterns: {
        release: {
          services: [{ id: "api" }, { id: "other" }, { id: "api" }],
          environments: [{ id: "production" }, { id: "production" }],
          gates: [{ id: "healthy" }, { id: "healthy" }],
          rollbacks: [
            { id: "bad-rollback-service", service: "missing-service" },
            { id: "mismatch-rollback", service: "other" },
            { id: "mismatch-rollback", service: "other" },
          ],
          migrations: [
            { id: "bad-migration-service", service: "missing-service" },
            { id: "mismatch-migration", service: "other" },
            { id: "mismatch-migration", service: "other" },
          ],
          steps: [
            {
              id: "step",
              service: "missing-step-service",
              environment: "missing-environment",
              trafficPercent: 101,
              gates: ["missing-gate"],
              rollback: "missing-rollback",
              migration: "missing-migration",
            },
            {
              id: "step",
              service: "api",
              environment: "production",
              trafficPercent: 10,
              gates: ["healthy"],
              rollback: "mismatch-rollback",
              migration: "mismatch-migration",
            },
          ],
        },
      },
    });

    assert.deepEqual(errors, [
      "duplicate release service id: api",
      "duplicate release environment id: production",
      "duplicate release gate id: healthy",
      "duplicate release rollback id: mismatch-rollback",
      "duplicate release migration id: mismatch-migration",
      "duplicate release step id: step",
      "unknown release rollback service: bad-rollback-service -> missing-service",
      "unknown release migration service: bad-migration-service -> missing-service",
      "unknown release step service: step -> missing-step-service",
      "unknown release step environment: step -> missing-environment",
      "release step traffic percent out of range: step -> 101",
      "unknown release step gate: step -> missing-gate",
      "unknown release step rollback: step -> missing-rollback",
      "unknown release step migration: step -> missing-migration",
      "release step rollback service mismatch: step -> mismatch-rollback",
      "release step migration service mismatch: step -> mismatch-migration",
    ]);
  });

  it("exposes typed accessors used by validation and backend projections", () => {
    const release = releasePattern({
      patterns: {
        release: {
          services: [{ id: "service" }],
          environments: [{ id: "environment" }],
          gates: [{ id: "gate" }],
          rollbacks: [{ id: "rollback" }],
          migrations: [{ id: "migration" }],
          steps: [{ id: "step" }],
        },
      },
    });

    assert.deepEqual(releaseServices(release).map(({ id }) => id), ["service"]);
    assert.deepEqual(releaseEnvironments(release).map(({ id }) => id), ["environment"]);
    assert.deepEqual(releaseGates(release).map(({ id }) => id), ["gate"]);
    assert.deepEqual(releaseRollbacks(release).map(({ id }) => id), ["rollback"]);
    assert.deepEqual(releaseMigrations(release).map(({ id }) => id), ["migration"]);
    assert.deepEqual(releaseSteps(release).map(({ id }) => id), ["step"]);
  });
});
