# Checker conformance suite

`fixtures/checker-conformance-suite.json` is the portable checker contract for
v0.1. Each case declares a Pkl input, the JSON-mode command arguments, and a
checked-in expected report. The suite deliberately covers model validation,
implementation drift, coverage, finite implementation conformance, localized
spec queries, and an external real-app holdout corpus.

Run the reference implementation with:

```sh
pnpm run checker:conformance
```

An alternative checker, including a `mizchi/pkl-mbt` implementation, should
evaluate the Pkl inputs and compare its normalized JSON output to the declared
`expectedReport` files. It may choose a different command transport, but it
must preserve the report fields and error semantics for every case.

## Boundaries

- `dspec/Schema.pkl` is the stable authoring facade. Its `Core -> Claims ->
  Checks` implementation chain is internal.
- `src/adapters/pkl.mjs` owns Pkl subprocess evaluation and JSON decoding.
- `src/core/*.mjs` own filesystem-free semantic calculations. Selected modules
  use checked `.mts` source with generated `.mjs` execution artifacts.
- `src/commands/*.mts` owns typed usage and argument contracts for extracted
  CLI command groups; `src/cli.mjs` adapts them to process I/O.
- `src/cli.mjs` remains the reference command dispatcher and adapts failures to
  process exit status.

The suite is a compatibility oracle, not a proof that two checkers use the same
algorithm. A new checker must still document any unsupported Pkl feature or
backend guarantee instead of silently weakening a case.
