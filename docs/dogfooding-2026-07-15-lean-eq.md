# Lean Equality Fragment Semantic Dogfooding 2026-07-15

## Question

Can dspec promote one Clause/backend pair from structural projection to
semantic proof without treating successful Lean compilation as proof of every
business clause?

The source contract is the Clause AST 1.0 evaluator: an unbound operand resolves
to its own name, while a bound operand resolves through the supplied
environment. The first candidate was a standalone `eq` Clause; the current
fragment closes `eq` and `neq` under direct `not` and `implies` composition.

## Model

Generated Lean defines:

- `ClauseEnv = String -> Option String`
- `resolveClauseValue`, which falls back to the original name
- `Satisfies env (Expr.eq left right)` as equality of resolved values
- recursive `Satisfies` cases for `neq`, `not`, and `implies`
- one theorem per selected `must` or `mustNot` Clause

`fixtures/assurance-formal-lean-eq.pkl` declares `balance == balance`. Its
generated theorem holds for every `ClauseEnv`. The evidence manifest records a
separate clause-scoped artifact whose property id is also present in that
Clause's source-map binding.

`fixtures/assurance-formal-lean-eq-broken.pkl` declares `balance == account`.
The generated universal theorem leaves an unsolved Lean goal, so `evidence
create` fails and no passing manifest can be attached.

`fixtures/assurance-formal-lean-implies.pkl` declares that an equality implies
itself. The broken variant uses `not(balance != balance)` as a true antecedent
for the arbitrary `balance == account` conclusion. Lean rejects it, making the
`neq`, `not`, and `implies` interpretation load-bearing rather than a projection
claim.

## Workflow

```sh
node src/cli.mjs evidence create \
  --output /tmp/dspec-assurance-formal-lean-eq.json \
  fixtures/assurance-formal-lean-eq.pkl
node src/cli.mjs check fixtures/assurance-formal-lean-eq.pkl
node src/cli.mjs evidence create \
  --output /tmp/dspec-assurance-formal-lean-implies.json \
  fixtures/assurance-formal-lean-implies.pkl
node src/cli.mjs check fixtures/assurance-formal-lean-implies.pkl
```

The manifest is generated and checked in the same environment. Tool-version,
model, source-map, generated-source, result, and selector drift invalidate it.

## Result

- Lean `eq`, `neq`, `not`, and `implies`: `semantic`
- Lean `atom`, `and`, `or`, `exists`, and `forall`: `structural`
- TLA+: `textual`
- Alloy: `unmapped`
- the positive Clause produces a passing clause-scoped theorem artifact
- the non-reflexive and broken-composition mutations are rejected by Lean
- generator-scoped Lean success still cannot satisfy `proved`

The self model now reports 69/69 covered approved rules, 301 automated targets,
4 executed targets, 1 mutation-tested target, and zero self-claimed `bounded`
or `proved` targets. Drift resolves 959 references.

## Verification

- `pkf run --refresh check:fast`: 273 tests, 270 pass, 3 optional formal-tool
  tests skipped outside the devShell, 0 failures
- `nix develop path:$PWD -c pkf run --refresh check:formal`: generated
  QuickCheck and Lean pass; TLA+ SANY/TLC and Alloy Analyzer pass; the generated
  Lean equality and implication manifests are accepted by `dspec check`

## Interpretation

This is proof of the Clause proposition under the explicit `ClauseEnv`
semantics. It is not proof that application code computes or preserves the
same relation. The next useful refinement is either semantic `and`/`or` or a
typed relation between Clause operands and an implementation API's inputs and
outputs.
