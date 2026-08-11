import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dataFlows,
  dataPattern,
  dataPlacements,
  dataPolicies,
  dataSets,
  dataStores,
  validateDataModel,
} from "../src/core/data-model-validation.mjs";

describe("Data model validation core", () => {
  it("accepts an absent or internally consistent Data pattern", () => {
    assert.deepEqual(validateDataModel({}), []);
    assert.deepEqual(validateDataModel({
      patterns: {
        data: {
          policies: [{ id: "personal-policy", classification: "personal", maxRetentionDays: 30 }],
          datasets: [{ id: "profiles", classification: "personal", retentionDays: 14 }],
          stores: [{ id: "primary" }, { id: "archive" }],
          placements: [{ id: "profiles-primary", dataset: "profiles", store: "primary" }],
          flows: [{ id: "profiles-archive", dataset: "profiles", from: "primary", to: "archive" }],
        },
      },
    }), []);
  });

  it("reports Data reference errors in deterministic validation order", () => {
    const errors = validateDataModel({
      patterns: {
        data: {
          policies: [
            { id: "policy", classification: "personal", maxRetentionDays: -1 },
            { id: "policy", classification: "personal", maxRetentionDays: 30 },
          ],
          datasets: [
            { id: "dataset", classification: "missing", retentionDays: -1 },
            { id: "dataset", classification: "personal", retentionDays: 1 },
          ],
          stores: [{ id: "store" }, { id: "store" }],
          placements: [
            { id: "placement", dataset: "missing-dataset", store: "missing-store" },
            { id: "placement", dataset: "dataset", store: "store" },
          ],
          flows: [
            { id: "flow", dataset: "missing-dataset", from: "missing-source", to: "missing-target" },
            { id: "flow", dataset: "dataset", from: "store", to: "store" },
          ],
        },
      },
    });

    assert.deepEqual(errors, [
      "duplicate data policy id: policy",
      "duplicate data set id: dataset",
      "duplicate data store id: store",
      "duplicate data placement id: placement",
      "duplicate data flow id: flow",
      "negative data policy max retention days: policy",
      "duplicate data policy classification: personal",
      "missing data policy for classification: dataset -> missing",
      "negative data set retention days: dataset",
      "unknown data placement dataset: placement -> missing-dataset",
      "unknown data placement store: placement -> missing-store",
      "unknown data flow dataset: flow -> missing-dataset",
      "unknown data flow source store: flow -> missing-source",
      "unknown data flow target store: flow -> missing-target",
    ]);
  });

  it("exposes typed accessors used by validation and backend projections", () => {
    const data = dataPattern({
      patterns: {
        data: {
          policies: [{ id: "policy" }],
          datasets: [{ id: "dataset" }],
          stores: [{ id: "store" }],
          placements: [{ id: "placement" }],
          flows: [{ id: "flow" }],
        },
      },
    });

    assert.deepEqual(dataPolicies(data).map(({ id }) => id), ["policy"]);
    assert.deepEqual(dataSets(data).map(({ id }) => id), ["dataset"]);
    assert.deepEqual(dataStores(data).map(({ id }) => id), ["store"]);
    assert.deepEqual(dataPlacements(data).map(({ id }) => id), ["placement"]);
    assert.deepEqual(dataFlows(data).map(({ id }) => id), ["flow"]);
  });
});
