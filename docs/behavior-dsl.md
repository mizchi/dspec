# Behavior DSL experiment

`dspec/Behavior.pkl` is an author-facing frontend for a deliberately small
closed state-machine language. It is not a second notation for Lean. The
author names domain state, operation preconditions, state updates, invariants,
and finite checks; the compiler lowers those declarations to the existing
closed semantic model and then renders Lean.

The complete executable example is
[behavior-purchase.pkl](../fixtures/behavior-purchase.pkl).

```pkl
states { b.state("available", 10) }

actions {
  new b.Action {
    id = "purchase"
    inputs { b.natInput("quantity", new Listing { 0; 10 }) }
    requires = b.atMost(b.input("quantity"), b.current("available"))
    ensures {
      b.set("available", b.minus(b.current("available"), b.input("quantity")))
    }
  }
}
```

This reads as: a purchase is accepted only when its quantity is at most the
current stock; acceptance changes `available` to current stock minus the
quantity. `samples` on an input are not production validation. They delimit
the finite values used for model checking and implementation grounding.

## What the DSL can express today

- non-negative integer state with an explicit initial value;
- named operations with integer inputs, `requires`, and simultaneous
  `ensures` updates;
- `atMost`, `equals`, `allOf`, `ifThen`, addition, and truncated subtraction;
- bounded reachability questions;
- finite-trace or bounded-all-path temporal checks using `next`, `always`,
  and `eventually`; and
- a concrete adapter from each DSL action to an implementation function.

The domain's localized rules remain in the sibling `model: d.Model` section.
Each behavior invariant or check names the domain rule it supports. The
compiler rejects unknown rule and vocabulary references, so the numeric model
cannot silently become a detached second specification.

## Grounding an implementation

The example binds the `purchase` action as follows.

```pkl
grounding = new b.Grounding {
  maxSteps = 2
  actions {
    new b.ActionGrounding {
      action = "purchase"
      implementation = d.codeRef("fixtures/behavior-purchase-implementation.mjs", "purchase")
    }
  }
}
```

The referenced function receives `{ state, input }` and returns
`{ status, state }`. The grounding verifier enumerates every declared input
sample at every path prefix through `maxSteps`, uses the DSL as the reference
semantics, and compares both acceptance/rejection and the whole resulting
state. The purchase fixture checks six transitions: two inputs at the initial
state, then two inputs at each of the two one-step prefixes.

Changing the adapter to `brokenPurchase` gives a concrete counterexample:

```text
path=[] action=purchase(quantity=10)
expected=accepted, { available: 0 }
actual=accepted, { available: 10 }
```

That is executable finite conformance evidence. It is not a proof that an
arbitrary service implementation refines the model beyond the declared values,
paths, adapter boundary, and observable state shape.

## Lean backend

The same behavior renders to a deterministic Lean `State`, `Action`,
`initial`, and `denote` file. The artifact is checked for byte-level drift and
compiled by Lean:

```sh
pkf run --no-cache behavior:generate
pkf run --no-cache behavior:verify
```

`behavior:verify` rejects generated-source drift, compiles that artifact with
Lean, then runs the reference-model and implementation-grounding checks.

At this stage the generated Lean file provides an independently compiled model
of the DSL transition relation. A hand-authored Lean theorem may later be
bound to that generated denotation; that is a stronger, separate claim and is
not implied merely by a passing implementation adapter.

## Boundary

The DSL intentionally omits arbitrary Lean terms, recursive data, quantifiers,
concurrency, unbounded temporal semantics, and fairness. Those should be
introduced only as domain-level primitives with a clear executable or proof
meaning, rather than exposing Lean syntax in the ordinary authoring path.
