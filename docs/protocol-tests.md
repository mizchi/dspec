# Generated protocol tests

`IntentProtocolTest` makes finite, reviewed conformance examples part of the
Pkl specification. It is intentionally not a TypeScript-, Go-, or test-runner
DSL. dspec first turns the canonical contract fields into a portable test plan,
then a transport adapter executes the plan against an implementation.

```pkl
new d.IntentProtocolTest {
  id = "approve-grpc-success"
  process = "request.approve"
  refinement = "request.approve-grpc"
  outcome = "request.approved"
  input {
    ["requestId"] = "request-002"
    ["amountCents"] = "500"
  }
  output {
    ["approvalId"] = "approval-request-002"
  }
  expectedGrpcCode = "OK"
}
```

The case refers to the Process's canonical `IntentDataContract` names. Values
are strings in Pkl so one form can describe identifiers, strings, integers, and
booleans. Generation validates and decodes them, then uses the refinement's
field bindings to produce the wire payload. Missing required fields, unknown
fields, constraint violations, absent outcome bindings, and mismatched
transport options are deterministic specification errors.

## Generate

```sh
dspec intent generate-tests --json fixtures/intent-contract-http.pkl
```

The generated JSON is the portable artifact. Its `operations` retain the
selected transport metadata, while `traceDocument` is an ordinary bounded
Intent trace that goes through the same contract verifier as externally
observed traces. This allows a future adapter to consume the plan without
reimplementing domain field decoding or refinement binding logic.

## HTTP execution

An `http-route` refinement declares the method, path, and default expected
status. A case may override that status with `expectedStatus`.

```sh
dspec intent test --json \
  --http-base-url http://127.0.0.1:3000 \
  fixtures/intent-contract-http.pkl
```

The adapter sends JSON (or query parameters for `GET`) and compares the status
and response payload with the generated case.

## gRPC execution

A `grpc-method` refinement declares a fully-qualified method path and default
gRPC code:

```pkl
grpc = new d.IntentGrpcEndpoint {
  method = "/approval.v1.RequestService/Approve"
  expectedCode = "OK"
}
```

dspec deliberately does not choose a gRPC language runtime. Instead,
`--grpc-runner` accepts a script or executable with a one-request JSON
protocol. dspec starts it once per test case and supplies stdin:

```json
{
  "protocol": "dspec-grpc-runner-v1",
  "method": "/approval.v1.RequestService/Approve",
  "input": { "request_id": "request-002" },
  "timeoutMs": 5000
}
```

The runner writes exactly one JSON response on stdout:

```json
{
  "code": "OK",
  "output": { "approval_id": "approval-request-002" }
}
```

For a Java, Go, Rust, or TypeScript service, the runner is just the smallest
piece that creates that ecosystem's gRPC client, invokes `method`, and converts
its response into this record. A nonzero exit, invalid JSON, timeout, or
nonmatching status code fails the generated case.

```sh
dspec intent test --json \
  --grpc-runner ./scripts/grpc-runner.mjs \
  fixtures/intent-contract-grpc.pkl
```

## Assurance boundary

The output report binds the model, generated trace document, selected
implementation reference, and adapter execution evidence. It establishes that
the selected finite cases passed against that target. It does not prove that all
requests, all network behavior, server internals, database isolation, or future
deployments refine the specification. Add cases, scenario coverage, formal
models, runtime evidence, and deployment controls according to the risk being
addressed.
