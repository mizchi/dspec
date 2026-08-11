import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  runtimeAlertPolicies,
  runtimeAlerts,
  runtimeDependencies,
  runtimeDependencyTraces,
  runtimeIntentExecutions,
  runtimePattern,
  runtimeRunbookExecutions,
  runtimeRunbooks,
  runtimeServices,
  runtimeSignals,
  runtimeSlos,
  runtimeTelemetry,
  validateRuntimeModel,
} from "../src/core/runtime-model-validation.mjs";

describe("Runtime model validation core", () => {
  it("accepts an absent or internally consistent Runtime pattern", () => {
    assert.deepEqual(validateRuntimeModel({}), []);
    assert.deepEqual(validateRuntimeModel({
      patterns: {
        intent: {
          processes: [{ id: "checkout", refinements: [{ id: "checkout-http" }] }],
        },
        runtime: {
          services: [{ id: "api" }],
          dependencies: [{ id: "database", service: "api", timeoutMs: 100 }],
          signals: [{ id: "availability", service: "api", indicator: "availability" }],
          runbooks: [{ id: "restart", service: "api" }],
          alerts: [{ id: "api-down", service: "api", signal: "availability", runbook: "restart" }],
          slos: [{ id: "api-slo", service: "api", indicator: "availability", targetPercent: 99.9 }],
          telemetry: [{
            id: "api-window",
            service: "api",
            signal: "availability",
            slo: "api-slo",
            observedPercent: 99.95,
          }],
          alertPolicies: [{ id: "page-api", alert: "api-down" }],
          runbookExecutions: [{ id: "restart-execution", runbook: "restart" }],
          dependencyTraces: [{ id: "database-trace", dependency: "database", observedLatencyMs: 50 }],
          intentExecutions: [{
            id: "checkout-execution",
            process: "checkout",
            refinement: "checkout-http",
            observedLatencyMs: 50,
            maxInFlightObserved: 1,
          }],
        },
      },
    }), []);
  });

  it("reports Runtime reference errors in deterministic validation order", () => {
    const errors = validateRuntimeModel({
      patterns: {
        intent: {
          processes: [{ id: "checkout", refinements: [{ id: "checkout-http" }] }],
        },
        runtime: {
          services: [{ id: "api" }, { id: "other" }, { id: "api" }],
          dependencies: [{ id: "bad-dependency", service: "missing-service", timeoutMs: -1 }],
          signals: [
            { id: "bad-signal", service: "missing-service", indicator: "availability" },
            { id: "other-signal", service: "other", indicator: "availability" },
            { id: "api-latency", service: "api", indicator: "latency" },
          ],
          runbooks: [
            { id: "bad-runbook", service: "missing-service" },
            { id: "other-runbook", service: "other" },
          ],
          alerts: [{
            id: "bad-alert",
            service: "missing-service",
            signal: "missing-signal",
            runbook: "missing-runbook",
          }],
          slos: [
            { id: "bad-slo", service: "missing-service", indicator: "availability", targetPercent: 101 },
            { id: "other-slo", service: "other", indicator: "availability", targetPercent: 99 },
            { id: "api-availability-slo", service: "api", indicator: "availability", targetPercent: 99 },
          ],
          telemetry: [
            {
              id: "missing-telemetry-refs",
              service: "missing-service",
              signal: "missing-signal",
              slo: "missing-slo",
              observedPercent: 101,
            },
            {
              id: "service-mismatch",
              service: "api",
              signal: "other-signal",
              slo: "other-slo",
              observedPercent: 99,
            },
            {
              id: "indicator-mismatch",
              service: "api",
              signal: "api-latency",
              slo: "api-availability-slo",
              observedPercent: 99,
            },
          ],
          alertPolicies: [{ id: "bad-policy", alert: "missing-alert" }],
          runbookExecutions: [{ id: "bad-runbook-execution", runbook: "missing-runbook" }],
          dependencyTraces: [{
            id: "bad-dependency-trace",
            dependency: "missing-dependency",
            observedLatencyMs: -1,
          }],
          intentExecutions: [
            {
              id: "missing-process",
              process: "missing-process",
              refinement: "missing-refinement",
              observedLatencyMs: -1,
              maxInFlightObserved: -1,
            },
            {
              id: "missing-refinement",
              process: "checkout",
              refinement: "missing-refinement",
              observedLatencyMs: 1,
              maxInFlightObserved: 1,
            },
          ],
        },
      },
    });

    assert.deepEqual(errors, [
      "duplicate runtime service id: api",
      "unknown runtime dependency service: bad-dependency -> missing-service",
      "negative runtime dependency timeout: bad-dependency",
      "unknown runtime signal service: bad-signal -> missing-service",
      "unknown runtime runbook service: bad-runbook -> missing-service",
      "unknown runtime alert service: bad-alert -> missing-service",
      "unknown runtime alert signal: bad-alert -> missing-signal",
      "unknown runtime alert runbook: bad-alert -> missing-runbook",
      "unknown runtime slo service: bad-slo -> missing-service",
      "runtime slo target percent out of range: bad-slo -> 101",
      "unknown runtime telemetry service: missing-telemetry-refs -> missing-service",
      "unknown runtime telemetry signal: missing-telemetry-refs -> missing-signal",
      "unknown runtime telemetry slo: missing-telemetry-refs -> missing-slo",
      "runtime telemetry observed percent out of range: missing-telemetry-refs -> 101",
      "runtime telemetry signal service mismatch: service-mismatch -> other-signal",
      "runtime telemetry slo service mismatch: service-mismatch -> other-slo",
      "runtime telemetry slo indicator mismatch: indicator-mismatch -> api-availability-slo",
      "unknown runtime alert policy alert: bad-policy -> missing-alert",
      "unknown runtime runbook execution runbook: bad-runbook-execution -> missing-runbook",
      "unknown runtime dependency trace dependency: bad-dependency-trace -> missing-dependency",
      "negative runtime dependency trace latency: bad-dependency-trace",
      "unknown runtime Intent execution process: missing-process -> missing-process",
      "negative runtime Intent execution latency: missing-process",
      "negative runtime Intent execution max in-flight: missing-process",
      "unknown runtime Intent execution refinement: missing-refinement -> missing-refinement",
    ]);
  });

  it("exposes typed accessors used by validation and backend projections", () => {
    const runtime = runtimePattern({
      patterns: {
        runtime: {
          services: [{ id: "service" }],
          dependencies: [{ id: "dependency" }],
          signals: [{ id: "signal" }],
          runbooks: [{ id: "runbook" }],
          alerts: [{ id: "alert" }],
          slos: [{ id: "slo" }],
          telemetry: [{ id: "telemetry" }],
          alertPolicies: [{ id: "alert-policy" }],
          runbookExecutions: [{ id: "runbook-execution" }],
          dependencyTraces: [{ id: "dependency-trace" }],
          intentExecutions: [{ id: "intent-execution" }],
        },
      },
    });

    const ids = (items) => items.map(({ id }) => id);
    assert.deepEqual(ids(runtimeServices(runtime)), ["service"]);
    assert.deepEqual(ids(runtimeDependencies(runtime)), ["dependency"]);
    assert.deepEqual(ids(runtimeSignals(runtime)), ["signal"]);
    assert.deepEqual(ids(runtimeRunbooks(runtime)), ["runbook"]);
    assert.deepEqual(ids(runtimeAlerts(runtime)), ["alert"]);
    assert.deepEqual(ids(runtimeSlos(runtime)), ["slo"]);
    assert.deepEqual(ids(runtimeTelemetry(runtime)), ["telemetry"]);
    assert.deepEqual(ids(runtimeAlertPolicies(runtime)), ["alert-policy"]);
    assert.deepEqual(ids(runtimeRunbookExecutions(runtime)), ["runbook-execution"]);
    assert.deepEqual(ids(runtimeDependencyTraces(runtime)), ["dependency-trace"]);
    assert.deepEqual(ids(runtimeIntentExecutions(runtime)), ["intent-execution"]);
  });
});
