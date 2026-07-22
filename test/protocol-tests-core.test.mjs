import assert from "node:assert/strict";
import test from "node:test";

import {
  PROTOCOL_TEST_PLAN_SCHEMA_VERSION,
  protocolTestPlan,
} from "../src/core/protocol-tests.mjs";

function fixtureModel() {
  return {
    id: "approval-api",
    version: "0.1.0",
    patterns: {
      intent: {
        outcomes: [{
          id: "request.approved",
          state: "request.approved",
          outputContract: {
            fields: [{ id: "approvalId", type: "identifier" }],
          },
        }],
        processes: [{
          id: "request.approve",
          input: "request.pending",
          inputContract: {
            fields: [
              { id: "requestId", type: "identifier" },
              { id: "notify", type: "boolean", required: false },
            ],
          },
          outcomes: ["request.approved"],
          refinements: [
            {
              id: "request.approve-http",
              kind: "http-route",
              http: { method: "POST", path: "/requests/approve", expectedStatus: 201 },
              inputBindings: [
                { contractField: "requestId", implementationField: "request_id" },
                { contractField: "notify", implementationField: "notify" },
              ],
              outcomeBindings: [{
                outcome: "request.approved",
                fields: [{ contractField: "approvalId", implementationField: "approval_id" }],
              }],
            },
            {
              id: "request.approve-grpc",
              kind: "grpc-method",
              grpc: { method: "/approval.v1.RequestService/Approve", expectedCode: "OK" },
              inputBindings: [{ contractField: "requestId", implementationField: "request_id" }],
              outcomeBindings: [{
                outcome: "request.approved",
                fields: [{ contractField: "approvalId", implementationField: "approval_id" }],
              }],
            },
          ],
        }],
        tests: [
          {
            id: "approve-http-success",
            process: "request.approve",
            refinement: "request.approve-http",
            outcome: "request.approved",
            input: { requestId: "request-001", notify: "true" },
            output: { approvalId: "approval-request-001" },
            expectedStatus: 201,
          },
          {
            id: "approve-grpc-success",
            process: "request.approve",
            refinement: "request.approve-grpc",
            outcome: "request.approved",
            input: { requestId: "request-002" },
            output: { approvalId: "approval-request-002" },
            expectedGrpcCode: "OK",
          },
        ],
      },
    },
  };
}

test("generates language-independent HTTP and gRPC test vectors from Intent contract cases", () => {
  const plan = protocolTestPlan(fixtureModel());

  assert.equal(plan.status, "pass");
  assert.equal(plan.protocolTestPlanSchemaVersion, PROTOCOL_TEST_PLAN_SCHEMA_VERSION);
  assert.deepEqual(plan.summary, { cases: 2, grpc: 1, http: 1 });
  assert.deepEqual(plan.operations, [
    {
      id: "approve-grpc-success",
      process: "request.approve",
      refinement: "request.approve-grpc",
      outcome: "request.approved",
      input: { request_id: "request-002" },
      expected: { output: { approval_id: "approval-request-002" } },
      transport: { kind: "grpc", method: "/approval.v1.RequestService/Approve", expectedCode: "OK" },
    },
    {
      id: "approve-http-success",
      process: "request.approve",
      refinement: "request.approve-http",
      outcome: "request.approved",
      input: { notify: true, request_id: "request-001" },
      expected: { output: { approval_id: "approval-request-001" } },
      transport: { kind: "http", method: "POST", path: "/requests/approve", expectedStatus: 201 },
    },
  ]);
  assert.deepEqual(plan.traceDocument.traces[1], {
    id: "protocol/approve-http-success",
    source: "model://approval-api/protocol-test/approve-http-success",
    initialState: "request.pending",
    expectedState: "request.approved",
    steps: [{
      process: "request.approve",
      refinement: "request.approve-http",
      outcome: "request.approved",
      input: { notify: true, request_id: "request-001" },
      output: { approval_id: "approval-request-001" },
      transport: { kind: "http", expectedStatus: 201 },
    }],
  });
});

test("keeps missing required values and mismatched transports as machine-readable plan errors", () => {
  const model = fixtureModel();
  model.patterns.intent.tests[0].input = { notify: "false" };
  model.patterns.intent.tests[1].expectedStatus = 200;

  const plan = protocolTestPlan(model);

  assert.equal(plan.status, "fail");
  assert.deepEqual(plan.errors, [
    "protocol test approve-grpc-success: expectedStatus is only valid for http-route",
    "protocol test approve-http-success input: missing required field requestId",
  ]);
});
