import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cloudFlows,
  cloudNodes,
  cloudPattern,
  cloudPolicies,
  cloudZones,
  validateCloudModel,
} from "../src/core/cloud-model-validation.mjs";

describe("Cloud model validation core", () => {
  it("accepts an absent or internally consistent Cloud pattern", () => {
    assert.deepEqual(validateCloudModel({}), []);
    assert.deepEqual(validateCloudModel({
      patterns: {
        cloud: {
          zones: [{ id: "public" }, { id: "private" }],
          nodes: [
            { id: "gateway", zone: "public" },
            { id: "api", zone: "private" },
          ],
          flows: [{ id: "gateway-api", from: "gateway", to: "api" }],
          policies: [{
            id: "gateway-read-api",
            principal: "gateway",
            resource: "api",
            actions: ["read"],
          }],
        },
      },
    }), []);
  });

  it("reports Cloud reference errors in deterministic validation order", () => {
    const errors = validateCloudModel({
      patterns: {
        cloud: {
          zones: [{ id: "zone" }, { id: "zone" }],
          nodes: [
            { id: "node", zone: "missing-zone" },
            { id: "node", zone: "zone" },
          ],
          flows: [
            { id: "flow", from: "missing-source", to: "missing-target" },
            { id: "flow", from: "node", to: "node" },
          ],
          policies: [
            {
              id: "policy",
              principal: "missing-principal",
              resource: "missing-resource",
              actions: [],
            },
            { id: "policy", principal: "node", resource: "node", actions: ["read"] },
          ],
        },
      },
    });

    assert.deepEqual(errors, [
      "duplicate cloud zone id: zone",
      "duplicate cloud node id: node",
      "duplicate cloud flow id: flow",
      "duplicate cloud policy id: policy",
      "unknown cloud node zone: node -> missing-zone",
      "unknown cloud flow source: flow -> missing-source",
      "unknown cloud flow target: flow -> missing-target",
      "unknown cloud policy principal: policy -> missing-principal",
      "unknown cloud policy resource: policy -> missing-resource",
      "cloud policy has no actions: policy",
    ]);
  });

  it("exposes typed accessors used by validation and backend projections", () => {
    const cloud = cloudPattern({
      patterns: {
        cloud: {
          zones: [{ id: "zone" }],
          nodes: [{ id: "node", zone: "zone" }],
          flows: [{ id: "flow", from: "node", to: "node" }],
          policies: [{
            id: "policy",
            principal: "node",
            resource: "node",
            actions: ["read"],
          }],
        },
      },
    });

    assert.deepEqual(cloudZones(cloud).map(({ id }) => id), ["zone"]);
    assert.deepEqual(cloudNodes(cloud).map(({ id }) => id), ["node"]);
    assert.deepEqual(cloudFlows(cloud).map(({ id }) => id), ["flow"]);
    assert.deepEqual(cloudPolicies(cloud).map(({ id }) => id), ["policy"]);
  });
});
