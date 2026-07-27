# Lean-first semantic core experiment

Status: experimental vertical slice for [issue #10](https://github.com/mizchi/dspec/issues/10).

## Decision

Pkl remains the human-facing authoring surface for domain terms, localized
requirements, stable identifiers, and review metadata. Lean owns the checked
formal claims for a deliberately selected fragment. The transition relation is
currently represented twice—an executable closed Pkl AST and a hand-authored
Lean model—so their semantic correspondence is still an explicit boundary.
Generated documents, test oracles, and external backend inputs are projections;
they do not become separate specification masters.

This is not a claim that the complete Pkl language is interpreted by Lean.
Pkl-to-Lean bindings are an explicit, narrow boundary with stable ids and a
checked source path.

## First vertical slice: concurrent purchase

[lean-core-purchase.pkl](../fixtures/lean-core-purchase.pkl) declares one
approved Pkl rule, `PURCHASE-CAPACITY`, and binds it to two declarations in
[CommercePurchase.lean](../fixtures/lean-core/CommercePurchase.lean):

| Pkl claim | Lean declaration | Assurance | Meaning |
| --- | --- | --- | --- |
| `purchase.capacity.non-atomic-oversell` | `finiteBrokenModelFindsOversell` | `bounded` | The finite broken model finds a concrete oversell witness. |
| `purchase.capacity.atomic-preserves-capacity` | `atomicPurchasePreservesCapacity` | `proved` | Atomic purchase cannot increase stock beyond the initial-capacity bound. |
| `purchase.capacity.requested-in-stock.sat` | `purchaseRequestedAndStockAvailableSat` | `exhaustive` | The Boolean request-and-stock scenario has a satisfying assignment. |
| `purchase.capacity.requested-out-of-stock.unsat` | `requestedWithoutStockViolatesCapacityUnsat` | `exhaustive` | A requested purchase without stock conflicts with the capacity constraint. |

The intentionally broken model lets Alice and Bob both decide against stock
one before either update is visible. Lean evaluates the domain-readable
witness:

```text
broken witness: stock=1, accepted=2, requested=2
```

The corrected model is a sequential atomic transition. Its theorem is a
property of that model, not a proof that a database, queue, or TypeScript
implementation is serializable. An implementation adapter or a stronger
concurrent model is still required to claim that property for an application.

## Closed transition-system expression fragment

`dspec/LeanCore.pkl` defines the first closed Pkl expression fragment. The
purchase fixture now contains a `transitionSystem`, rather than only a text
rule and a theorem name:

- natural-number state fields and explicit initial values;
- named actions with natural-number inputs;
- guards over `<=` and `==`;
- simultaneous state updates using natural-number literals, state fields,
  initial fields, action inputs, `+`, and truncated natural subtraction; and
- invariants composed with `and` and `implies`.

`src/core/lean-semantic-core.mjs` validates and executes that fragment. An
accepted transition evaluates every update against the old state; a rejected
transition leaves it unchanged. State and action inputs must be non-negative
integers, matching the current Lean `Nat` model rather than silently accepting
JavaScript negative numbers.

The Pkl transition system is the executable reference model for this fragment.
It also renders deterministically to
[CommercePurchaseGenerated.lean](../fixtures/lean-core/CommercePurchaseGenerated.lean),
which contains a Lean `State`, `Action`, `initial`, and `denote` transition
function. `leanCore.generatedSource` names that file. Verification re-renders
the Pkl system, rejects any byte-level drift in the generated file, and asks
Lean to compile it alongside the hand-authored proof file.

This closes one practical failure mode: an edited generated Lean model cannot
silently diverge from the Pkl transition AST. It also executes the generated
Lean `denote` for every finite action path from the initial state through the
largest declared `boundedReachability.maxSteps`, then compares every accepted
or rejected step and its resulting state with the Pkl evaluator. The purchase
fixture checks the three paths of length one through three. The second path is
particularly useful: it records `accepted: available=0` followed by
`rejected: available=0`, so both evaluators must preserve stock after the
rejected repeat purchase. A disagreement preserves both serialized outcomes as
a bounded counterexample.

This `bounded-path-conformance` evidence does **not** prove equivalence for
arbitrary starting states, arbitrary natural-number inputs, or paths beyond the
declared bound. Nor do the current hand-authored theorems import the generated
file. Those semantic links remain explicit work, rather than an unstated
assumption.

## Bounded reachability

Actions may additionally declare `finiteValues` for each input parameter. They
are **not** an application input validation rule and do not change the `Nat`
transition relation. They say only which values this particular model check
enumerates. `boundedReachability` then gives a target formula, an expected
result, and `maxSteps`.

The purchase fixture deliberately uses the one-value exploration domain
`quantity ∈ {10}`. It contains these two bounded claims:

| Check | Finite question | Result | Evidence |
| --- | --- | --- | --- |
| `purchase.stock-empty.reachable` | Can `available == 0` occur within one step? | reachable | `purchase(quantity: 10)` from `available: 10` |
| `purchase.stock-increase.unreachable` | Can `available == 11` occur within three steps? | unreachable | No state witness in the two explored states, `{available: 10}` and `{available: 0}` |

The checker returns the first breadth-first witness as an action path and
state. If an `unreachable` expectation is false, the verification report fails
and keeps that witness. This makes a bounded counterexample reviewable in
domain language rather than reporting only a Boolean.

An `unreachable` pass means exactly: *no witness exists through the declared
finite input values within the declared step bound*. It does **not** establish
that stock can never increase for arbitrary natural-number inputs, more steps,
or a concurrent production implementation. That latter kind of claim requires
a Lean theorem about a generated denotation, or a wider model and a suitable
solver/model checker.

## Closed Boolean SAT fragment

`LeanSatCheck` adds a separate finite question to the same Pkl domain model.
It has a list of Boolean variables and an expression made only from variables,
Boolean literals, `not`, `and`, and `or`. The implementation enumerates all
assignments, so its `exhaustive` assurance means *every assignment to the
listed variables was evaluated*.

The purchase model makes the capacity rule into the Boolean implication
`purchaseRequested → stockAvailable`, represented in the core syntax as
`¬purchaseRequested ∨ stockAvailable`. It then asks two useful questions:

| Check | Formula | Exact result |
| --- | --- | --- |
| `purchase.capacity.requested-in-stock.sat` | `purchaseRequested ∧ stockAvailable` | SAT; witness `{purchaseRequested: true, stockAvailable: true}` |
| `purchase.capacity.requested-out-of-stock.unsat` | `purchaseRequested ∧ ¬stockAvailable ∧ (¬purchaseRequested ∨ stockAvailable)` | UNSAT; no witness among all four assignments |

This is the first SAT mental model: a formula is SAT when at least one total
variable assignment makes it true; it is UNSAT when none do. The current
enumerator is intentionally the small, slow reference oracle. It exposes
assignments directly, which makes an accidental weakening of a constraint
reviewable: removing the implication produces the witness
`{purchaseRequested: true, stockAvailable: false}` and fails verification.

Each SAT check is also bound to a Lean theorem. Lean proves the corresponding
hand-authored Boolean statement, while the JavaScript checker exhaustively
decides the Pkl AST. These two results are reported together, but they do not
yet prove a general Pkl-AST-to-Lean-formula meaning-preservation theorem.

## CNF and DPLL

The same AST now also takes a second route: negations are pushed to literals,
then `or` is distributed over `and` to form CNF. CNF is an AND of clauses,
where each clause is an OR of literals. For the UNSAT purchase question, the
result is:

```text
(purchaseRequested)
∧ (¬stockAvailable)
∧ (¬purchaseRequested ∨ stockAvailable)
```

The DPLL solver repeatedly applies three operations:

1. **Unit propagation**: `(purchaseRequested)` forces it to true, and
   `(¬stockAvailable)` forces it to false.
2. **Pure-literal elimination**: when a remaining variable occurs with just
   one polarity, assign that polarity.
3. **Decision and backtracking**: choose an unassigned variable only when the
   first two operations cannot proceed; try true, then false if needed.

For the purchase checks, unit propagation alone decides both formulas, so the
report shows zero decisions and four propagations. This DPLL implementation is
not trusted as a proof: `verifyLeanSemanticCore` runs it beside the exhaustive
reference evaluator and fails if they disagree on whether each formula has a
witness. The current CNF conversion uses direct distribution and can grow
exponentially; it is intentionally suitable only for the small teaching
fragment.

## Tseitin CNF encoding

The scalable route introduces one fresh Boolean variable for each composite
subformula. For example, for `v` representing `a ∧ b`, the encoder adds:

```text
(¬v ∨ a) ∧ (¬v ∨ b) ∧ (v ∨ ¬a ∨ ¬b)
```

and a final unit clause requiring the root variable to be true. The generated
variables, such as `__tseitin_0`, are solver-internal: the DPLL result is
projected back to the Pkl-declared variables before it is returned as a domain
witness. Thus a satisfying assignment to the encoded CNF yields a satisfying
assignment for the original formula, while no generated name leaks into the
domain model.

The test suite compares three finite code paths: exhaustive evaluation,
direct-CNF DPLL, and Tseitin-CNF DPLL. A disjunction of eight two-variable
conjunctions needs 256 clauses after direct distribution, but only 34 clauses
with the current Tseitin encoding. The verifier treats a disagreement about
whether a witness exists as a failure. This is a regression guard, not a Lean
proof that the encoder is correct.

## Bounded integer constraints and SMT

SAT variables range over `true` and `false`. SMT extends that idea with a
background theory: here, mathematical integers and their linear arithmetic.
`LeanSmtCheck` is a closed fragment with explicitly bounded integer variables,
integer literals, `+`, `-`, multiplication by a constant, `<=`, `==`, and
Boolean `not` / `and` / `or` over those comparisons.

The purchase fixture uses two variables in the finite range `0..10`:
`requestedQuantity` and `availableStock`.

| Check | Constraint | Result |
| --- | --- | --- |
| `purchase.capacity.requested-five-stock-five.sat` | `requestedQuantity = 5 ∧ availableStock = 5 ∧ requestedQuantity ≤ availableStock` | SAT, with witness `{requestedQuantity: 5, availableStock: 5}` |
| `purchase.capacity.requested-seven-stock-five.unsat` | `requestedQuantity = 7 ∧ availableStock = 5 ∧ requestedQuantity ≤ availableStock` | UNSAT |

The reference evaluator enumerates all 121 assignments per check. Its
`bounded-exhaustive` result means exactly that every assignment inside the
declared bounds was evaluated; it is not a statement about every integer.

The same AST renders as QF_LIA SMT-LIB—for example, the first check emits
integer declarations, the two range assertions, its constraint, and
`(check-sat)`. Z3 receives that program and reports `sat` or `unsat`; the
verifier compares the result with the finite reference evaluator. Z3 is an
optional backend: when unavailable its report is `skip`, rather than claiming
external SMT evidence. The fixture's corresponding Lean theorems prove the
two concrete integer facts, but a general proof that the Pkl-to-SMT or
Pkl-to-Lean translation preserves meaning remains future work.

## Finite temporal checks

`LeanTemporalCheck` has two deliberately distinct scopes:

- `scope = "path"` (the default) evaluates a formula over one explicit finite
  execution path. Each path starts with the declared initial state and lists
  concrete action invocations.
- `scope = "allPaths"` enumerates every finite action sequence from depth zero
  through its required `maxSteps`, using only each action parameter's declared
  `finiteValues`.

The explicit purchase path `purchase(quantity: 10)` produces the trace:

```text
[{ available: 10 }, { available: 0 }]
```

The current operators have **strong finite-trace semantics** at a position in
that trace:

- `next P` holds when a following state exists and `P` holds there; it is false
  at the final state.
- `always P` holds when `P` holds at every remaining state, including the
  current one.
- `eventually P` holds when `P` holds at some remaining state, including the
  current one.

The explicit-path fixture checks both expected successes and an expected
failure:

| Check | Formula at the first state | Result |
| --- | --- | --- |
| `purchase.stock-empty-next.holds` | `next (available = 0)` | holds |
| `purchase.stock-eventually-empty.holds` | `eventually (available = 0)` | holds |
| `purchase.capacity-always.holds` | `always (available <= initial.available)` | holds |
| `purchase.stock-unchanged-always.violated` | `always (available = 10)` | violated, with state `{ available: 0 }` at index `1` |

For a violated expectation the report retains the earliest failing state when
the outer operator is `always`; this is a concrete reviewable counterexample,
not merely `false`. The temporal checks are bound to Lean declarations for the
same concrete purchase, but the Pkl trace evaluator and hand-authored Lean
theorems are still separate implementations.

### Bounded all-path exploration

The fixture additionally declares:

| Check | Scope | Result |
| --- | --- | --- |
| `purchase.capacity-all-paths.holds` | all sequences of `purchase(quantity: 10)` through depth 3 | holds: `always (available <= initial.available)` |
| `purchase.eventually-empty-all-paths.violated` | the same finite set | violated: the empty path `[]` leaves `available = 10` |

With one finite action invocation, depth 3 means four traces (`[]`, one
purchase, two purchases, and three purchases) and ten visited states per
property. A guard failure is retained as a **stuttering** step: a rejected
purchase remains in the trace but preserves its state. This makes the Pkl
explorer agree with the generated Lean `run` semantics and keeps actions that
the environment may attempt visible to safety properties.

The corresponding hand-authored Lean theorem,
`atomicPurchaseTracePreservesCapacity`, proves the capacity invariant for an
arbitrary finite `List Purchase` by induction. The eventual-empty failure is
bound to `emptyPurchaseTraceDoesNotEmptyStock`, a concrete Lean witness. The
Pkl result is still labelled `bounded-all-paths`: it is exhaustive only over
the stated finite action values and depth, and it does not claim that every
unbounded trace eventually empties stock.

Neither `finite-trace` nor `bounded-all-paths` means that the formula holds
across arbitrary inputs, arbitrary lengths, infinite executions, schedules,
or fairness assumptions. Those are the next semantic steps before this can be
called an LTL or TLA+ replacement.

## Binding contract

`src/core/lean-semantic-core.mjs` validates that:

1. every bound Pkl rule and domain term exists;
2. the Lean path stays inside the project root;
3. every declared Lean theorem or definition exists in that source file; and
4. every core claim labels its assurance as `bounded` or `proved`, and every
   SAT or SMT check declares `sat` or `unsat`, while every temporal check
   declares `holds` or `violated`; an `allPaths` temporal check must declare a
   non-negative bound and finite values for every action parameter; and
5. when `generatedSource` is declared, its contents exactly equal the Lean
   rendering of the closed transition system; and
6. the generated Lean finite-input executions agree with the Pkl evaluator at
   the declared initial state.

It also returns a deterministic Pkl-rule-to-Lean-declaration source map. This
validation proves neither the Pkl parser nor a code generator semantically
preserving; it prevents dangling references and keeps the trust boundary
reviewable.

`verifyLeanSemanticCore` first validates the bindings and then invokes Lean on
both the hand-authored proof file and the generated transition file. A missing
Lean executable returns `skip`, not a passing formal result. The fixture uses
`by decide`, not native evaluation, and its test rejects `Lean.trustCompiler`
or `Lean.ofReduceBool` in the theorem's axiom report. It also runs the declared
bounded reachability, SAT, bounded integer checks, explicit-path temporal
checks, and bounded-all-path temporal checks. If Z3 is installed, it additionally runs the generated QF_LIA
programs. It also compares Lean's generated finite-input execution records
with the Pkl evaluator. A Lean proof can still compile while a Pkl expectation
has a counterexample; in that case the combined report is `fail` and preserves
both kinds of evidence separately.

## Run

```sh
node --test test/lean-semantic-core.test.mjs
pkf run --no-cache lean-core:generate
pkf run --no-cache lean-core:verify
pkf run --no-cache test
```

The pkfire `test` task includes `fixtures/**/*.lean` in its declared inputs,
so a change to the Lean theorem invalidates the cached test result.

## Next boundary

The next useful extension is to widen bounded path conformance to arbitrary
bounded starting states, then bind the domain theorems directly to the
generated denotation. Temporal work can next add nondeterministic multiple
actions and then make an explicit decision about infinite traces and fairness.
Arbitrary Lean theorems remain supported as escape hatches but are not assumed
to be serializable to all backends.
