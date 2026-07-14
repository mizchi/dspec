# Assurance Contract Dogfooding 2026-07-14

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

`fixtures/assurance-levels.pkl` exercises all five kinds. Negative fixtures
cover a missing required kind, an incompatible backend, and missing evidence.

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

The self model currently reports:

- approved active rules: 67
- rules satisfying required assurance: 67/67
- automated targets: 292
- `executed` targets: 2
- `mutation-tested` targets: 1
- `bounded` targets: 0
- `proved` targets: 0

The zero values are intentional. Generated Lean, TLA+, and Alloy artifacts pass
their real tools in the Nix devShell, but the current backend projections do
not establish the business meaning of the source `Clause.ast`. Tool execution
alone is therefore not recorded as bounded or proved assurance.

## Verification

- `pkf run --refresh check:fast`: 264 tests, 261 pass, 3 formal-tool tests
  skipped outside the devShell, 0 failures
- `nix develop path:$PWD -c pkf run --refresh check:formal`: QuickCheck, Lean,
  TLA+ SANY/TLC, and Alloy Analyzer pass for the self model and typed AST
  fixture
- self drift: 928 references resolve
- self coverage: 67/67 approved rules

## Decision

The assurance contract is useful as a specification-ledger control. It stops a
plain anchor from being silently presented as an executed, mutation-tested,
bounded, or proved result, and it makes assurance regressions visible during a
spec change.

It is not yet proof attestation. `assuranceEvidence` proves that an artifact and
optional anchor resolve, but it does not prove that the referenced theorem or
model-check property semantically corresponds to the source rule. The
all-kinds fixture validates contract mechanics and must not be interpreted as a
proof of dspec's business clauses.

## Next Constraint

The next useful increment is a typed evidence manifest produced by backend
execution. It should bind model digest, rule id, clause selectors, generated
property id, tool/version, bounds or theorem name, result, and artifact digest.
Only a verified manifest should authorize `bounded` or `proved` in a production
spec. Until that exists, dspec should continue to report those self-assurance
counts as zero.
