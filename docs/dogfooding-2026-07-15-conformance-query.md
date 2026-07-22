# Conformance And Query Dogfood

## Scope

This pass adds two boundaries that were previously implicit:

- `conformance` compares one selected `Clause.ast` with a named implementation
  adapter over explicit finite Pkl inputs.
- `query` provides deterministic, localized lookup over stable model IDs before
  an AI is allowed to formulate a human-facing answer.

The dogfood fixture models `allowed(subject)`. Its implementation adapter
returns true only for `alice`; the broken companion fixture always returns
false.

## Results

- The valid adapter agrees with reference semantics for three declared cases.
- The broken adapter produces the declared minimal failing witness
  `minimal-input`, with expected `true` and actual `false`.
- A Japanese `rule` query returns model-owned rule and clause evidence.
- An answer carrying a nonexistent evidence ref is rejected even when its label
  is otherwise plausible.
- JSON reports for both commands are stored in `fixtures/reports/` and checked
  by the report-fixture task.

## Interpretation

Conformance closes the first useful gap between a typed claim and executable
implementation behavior. It is deliberately finite: the Pkl author declares
the input valuation and any shrink relation. The result is executable evidence
for that set, not a proof that every execution of arbitrary JavaScript refines
the Clause.

Query closes the read path without making an LLM authoritative. An AI can map a
natural-language request to `{ kind, id, selector }`, then propose a
classification and evidence. `dspec query --answer` accepts that proposal only
when it agrees with the deterministic result.

## Next Constraint

The next refinement is to derive finite conformance cases from typed domain
generators while preserving a reviewable shrinking relation. That work should
remain separate from a source-level refinement proof: generated test agreement,
Lean proof of the DSL proposition, and proof that production code refines that
proposition are different assurance levels.
