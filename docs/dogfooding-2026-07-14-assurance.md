# Assurance Contract Dogfooding 2026-07-14

This is the pre-semantic-path snapshot. The first clause-scoped Lean equality
proof was added in the follow-up evaluation on 2026-07-15.

## Scope

This pass evaluates whether dspec can distinguish different kinds of support
instead of treating every resolvable test or formal-tool reference as the same
level of evidence.

The vocabulary is a set, not a linear maturity scale:

- `reference`: the declared support site resolves
- `executed`: an execution artifact is attached
- `mutation-tested`: representative faults were detected
- `bounded`: a bounded model-check result is attached
- `proved`: a proof-assistant declaration is attached

`fixtures/assurance-levels.pkl` exercises declaration and rendering of all five
kinds. It is intentionally rejected by `dspec check` as production formal
evidence because its Lean/TLA+ anchors are not typed evidence manifests and do
not bind source clauses. Negative fixtures also cover a missing required kind,
an incompatible backend, and missing evidence.

## Result

The contract now survives the complete authoring path:

1. Pkl gives `CheckTarget.assurances`, `assuranceEvidence`, and
   `Rule.requiredAssurances` closed types.
2. `check` rejects incompatible backend claims and unresolved evidence.
3. `coverage` rejects approved rules whose automated targets do not supply all
   required kinds.
4. check, drift, coverage, and Markdown output expose the assurance
   distribution.
5. generated QuickCheck data preserves the contract and rechecks it as
   `propertyApprovedRulesHaveRequiredAssurances`.
6. spec compatibility classifies added requirements as `narrowing` and removed
   requirements as `widening`.
7. generated assurance failures normalize back to the source rule and the
   `approved-rules-have-required-assurances` property.
8. `evidence create`, `verify`, and `refresh` bind backend execution to model,
   source-map, artifact, tool-version, and Clause-selector digests.
9. Clause/backend support is explicit per operator; generator-scoped structural
   success cannot authorize `bounded` or `proved`.

The self model currently reports:

- approved active rules: 68
- rules satisfying required assurance: 68/68
- automated targets: 296
- `executed` targets: 3
- `mutation-tested` targets: 1
- `bounded` targets: 0
- `proved` targets: 0

The zero values are intentional. Generated Lean, TLA+, and Alloy artifacts pass
their real tools in the Nix devShell, but the current backend projections do
not establish the business meaning of the source `Clause.ast`. Tool execution
alone is therefore not recorded as bounded or proved assurance.

## Verification

- `pkf run --refresh check:fast`: 268 tests, 265 pass, 3 formal-tool tests
  skipped outside the devShell, 0 failures
- `nix develop path:$PWD -c pkf run --refresh check:formal`: QuickCheck, Lean,
  TLA+ SANY/TLC, and Alloy Analyzer pass for the self model and typed AST
  fixture
- self drift: 944 references resolve
- self coverage: 68/68 approved rules

## Decision

The assurance contract is useful as a specification-ledger control. It stops a
plain anchor from being silently presented as an executed, mutation-tested,
bounded, or proved result, and it makes assurance regressions visible during a
spec change.

It is still not business-clause proof attestation. The typed manifest now makes
the missing semantic correspondence explicit and drift-checked, and formal
assurance rejects legacy anchors. The generated artifacts remain
generator-scoped because no backend currently checks the source Clause
satisfaction relation. The all-kinds fixture validates declaration mechanics
and must not be interpreted as a proof of dspec's business clauses.

## Next Constraint

The next useful increment is one real `semantic` operator/backend path: define
an interpretation environment, generate a load-bearing satisfaction property,
bind its rule and Clause selectors into a clause-scoped manifest artifact, and
only then allow that path to emit `bounded` or `proved`. Until that exists,
dspec should continue to report those self-assurance counts as zero.
