# Versioning and compatibility

dspec follows Semantic Versioning for the npm package and separately versions
machine-readable semantics and artifact contracts.

## v0.1 public boundary

The following surfaces are public in v0.1:

- the `dspec` executable and command-local `--help` contracts;
- `dspec/Schema.pkl`, including stable IDs and typed Pkl records;
- the Pkl package
  `package://github.com/mizchi/dspec/releases/download/pkl/dspec@<version>` and its
  dependency-notation facade `@dspec/dspec/Schema.pkl`;
- Clause.ast semantics `1.0` and the `@mizchi/dspec/clause-ast` reference API;
- the filesystem-free `@mizchi/dspec/real-app` normalization API;
- the filesystem-free `@mizchi/dspec/external-holdouts` aggregation API,
  compiled from its checked TypeScript source;
- `fixtures/checker-conformance-suite.json` and the JSON reports it names as
  the v0.1 checker compatibility oracle;
- JSON reports and generated artifacts that carry an explicit contract or
  semantics version.

The real-app source adapters, formal backend completeness, and agent provider
adapters remain experimental. Their normalized facts and process contracts are
tested, but adding a new observed fact or backend check may change a report.

The `Core -> Claims -> Checks` Pkl module chain is an internal implementation
detail. Consumers import only `dspec/Schema.pkl`; compatible type and field
meaning changes are governed by the public facade.

The Pkl package version is read from `package.json`, so npm and Pkl releases
share one SemVer value. The package's API tests compile the public facade before
its ZIP, metadata, and SHA-256 files are attached to the GitHub release.

## Compatibility policy

Before 1.0, a breaking public API or schema change increments the minor
version. Patch releases preserve the supported Clause.ast semantics version,
Pkl field meanings, CLI exit behavior, and existing report fields. New optional
fields and new commands may be added in a patch release.

Clause.ast interpretation never changes silently. A semantic change requires a
new `Model.clauseAstSemanticsVersion`; unsupported versions fail closed. Agent
run artifacts use `spec-reading-agent-process-v1`, and future incompatible
process contracts must use a new contract value.

Generated formal models are projections of declared semantics, not proofs of
undeclared infrastructure or runtime guarantees. Importers preserve this by
leaving unknown safety properties false or unset.
