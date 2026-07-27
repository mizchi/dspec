# Package Consumer Dogfooding 2026-07-16

## Scope

The v0.1 tarball was packed locally and installed into an empty npm consumer.
The consumer used only the installed `dspec` bin and the bundled Pkl schema.
It declared one vocabulary term, one approved rule, a Node test anchor, and an
implementation symbol.

## Result

The following consumer workflow passes from the installed package:

```sh
dspec --help
dspec verify --json --require-lock consumer-smoke.pkl
```

`dspec init --output starter.pkl` writes the package-relative Schema import and
schema lock, and its output passes `verify --require-lock`. The consumer rule then
uses `d.nodeCheck(...)` for a Node test name and `d.codeRef(...)` for an
implementation function. The package smoke renames that function.
`verify --json` exits nonzero and reports the missing implementation symbol.

## Findings

- npm bin invocation initially exposed a CLI entrypoint bug: a path-string
  comparison did not recognize the `node_modules/.bin/dspec` shim. Comparing
  real paths fixes direct Node execution and installed bin execution.
- Node 24 does not type-strip TypeScript under `node_modules`. The package now
  publishes the generated `.mjs` module while retaining checked `.mts` source.
- The Schema import path is explicit but verbose. `dspec init` now generates a
  local model with the correct package-relative import and refuses accidental
  overwrite unless `--force` is given. It writes a digest lock for Schema.pkl
  and its module chain at the same time.
- The clean npm consumer also builds the bundled Pkl package and runs its API
  test. This catches npm file-list drift between the CLI distribution and the
  Pkl package distribution.
- `drift` proves that a path, declaration symbol, and test anchor resolve. It
  does not prove that a same-named function preserves the rule's behavior.
  Finite `conformance` cases or a semantic backend are required for that
  stronger claim.

## Decision

Keep the consumer smoke as a release gate. It covers the actual package rather
than the repository checkout and protects the schema path, npm bin, public
exports, `verify`, Pkl package artifacts, and a detectable implementation drift.
