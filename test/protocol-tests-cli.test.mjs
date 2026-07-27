import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(root, "src", "cli.mjs");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function runAsync(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });
}

test("intent generate-tests emits a transport-neutral plan from Pkl cases", () => {
  const result = run(["intent", "generate-tests", "--json", "fixtures/intent-contract-http.pkl"]);

  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.status, "pass");
  assert.deepEqual(plan.summary, { cases: 1, grpc: 0, http: 1 });
  assert.deepEqual(plan.operations[0].transport, {
    kind: "http",
    method: "POST",
    path: "/requests/approve",
    expectedStatus: 200,
  });
});

test("intent test rejects an empty generated plan instead of reporting a vacuous pass", () => {
  const result = run(["intent", "test", "--json", "fixtures/intent-contract.pkl"]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "fail");
  assert.ok(report.errors.includes("protocol test plan has no cases"));
});

test("validates generated protocol cases as part of the Pkl model contract", () => {
  const result = run(["check", "--json", "fixtures/intent-contract-http-invalid-test.pkl"]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "fail");
  assert.ok(report.errors.includes("protocol test approve-http-success input: missing required field requestId"));
});

test("intent test executes a generated HTTP protocol test", async () => {
  const server = createServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/requests/approve");
    let body = "";
    for await (const chunk of request) body += chunk;
    assert.deepEqual(JSON.parse(body), {
      amount_cents: 500,
      locale: "ja",
      notify: true,
      request_id: "request-001",
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ approval_id: "approval-request-001", notified: true }));
  });
  try {
    const address = await listen(server);
    const result = await runAsync([
      "intent",
      "test",
      "--json",
      "--http-base-url",
      `http://127.0.0.1:${address.port}`,
      "fixtures/intent-contract-http.pkl",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "pass");
    assert.equal(report.summary.executedRefinements, 1);
    assert.equal(report.evidence.execution.runner, "http-fetch");
    assert.equal(report.protocolTestPlan.operations[0].transport.kind, "http");
  } finally {
    server.close();
  }
});

test("intent test executes a generated gRPC protocol test through the runner contract", () => {
  const result = run([
    "intent",
    "test",
    "--json",
    "--grpc-runner",
    "fixtures/intent-grpc-runner.mjs",
    "fixtures/intent-contract-grpc.pkl",
  ]);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "pass");
  assert.equal(report.summary.executedRefinements, 1);
  assert.equal(report.evidence.execution.runner, "grpc-external-runner");
  assert.deepEqual(report.evidence.execution.implementations[0].endpoint, {
    method: "/approval.v1.RequestService/Approve",
    expectedCode: "OK",
  });
  assert.equal(report.protocolTestPlan.operations[0].transport.kind, "grpc");
});
