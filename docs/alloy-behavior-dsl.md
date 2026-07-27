# Alloy Behavior DSL

`dspec.AlloyBehavior` is a Lean-free authoring layer for small relational,
temporal models. It complements rather than replaces the numeric
`dspec.Behavior` DSL:

| Question | DSL/backend |
| --- | --- |
| Natural-number state, implementation transition grounding, durable small theorems | `Behavior` → Lean |
| Bounded worlds of actors, resources, and relations; small temporal counterexamples | `AlloyBehavior` → Alloy 6 |

The first vertical slice models exclusive reservation. It is deliberately
closed: authors name entities, an exclusive relation, and domain-linked
temporal checks; the compiler owns Alloy syntax and the `reserve`, `release`,
and `stutter` actions. This avoids making arbitrary Alloy code an opaque escape
hatch in the source-of-truth DSL.

The executable example is
[alloy-behavior-reservation.pkl](../fixtures/alloy-behavior-reservation.pkl).

```pkl
alloyBehavior: a.AlloyBehavior = new {
  id = "commerce.reservation.alloy-v1"
  terms { "commerce.customer"; "catalog.product"; "commerce.reservation" }
  entities { a.entity("customer", 2); a.entity("product", 2) }
  reservation = a.exclusiveReservation("product-reservation", "customer", "product")
  checks {
    a.alwaysExclusive("reservation.exclusive.holds", "RESERVATION-EXCLUSIVE", 4, "holds")
    a.eventuallyReleased("reservation.eventually-released.violated", "RESERVATION-RELEASES", 4, "violated")
  }
}
```

The generated relation is `Product -> lone Customer`: every product has at
most one reservation owner in every state. The generated Alloy model makes
state changes explicit with a mutable (`var`) relation and native temporal
operators (`always`, `eventually`).

## Check boundary

Each `maxSteps` is rendered in the Alloy command, for example:

```alloy
check ReservationEventuallyReleased for exactly 2 Customer, exactly 2 Product, 4 steps
```

This says that Alloy searched the declared finite entity scopes and time bound.
No counterexample at that bound is not an unbounded proof and does not establish
that production code implements the model. The sibling natural-language
`model: d.Model` section remains the master; the compiler rejects a check that
does not name one of its rules.

The fixture intentionally marks `eventuallyReleased` as `"violated"`. The
model permits `stutter` forever, so a product can remain reserved. This is a
useful counterexample: the business must choose a timeout, a fairness
assumption, or a weaker rule before it can claim eventual release.

## Making the liveness decision explicit

The sibling fixture
[alloy-behavior-reservation-release-before-reserve.pkl](../fixtures/alloy-behavior-reservation-release-before-reserve.pkl)
chooses a concrete, stronger policy:

```pkl
reservation = a.releaseBeforeReserveReservation(
  "product-reservation", "customer", "product",
)
```

This does not merely assume the desired `eventually` formula. While at least
one product is reserved, the next generated transition must be `release`; a
new `reserve` is possible only when all reservations have drained. The same
`eventuallyReleased(..., "holds")` check therefore has no Alloy 6
counterexample at the declared bound. This is a deliberately strong policy:
it may not be appropriate for a high-throughput shop, but it makes the
ordering decision reviewable instead of hiding it as an implicit fairness
assumption.

## 関係の多重度を性質として検査する

`alwaysOwnerCapacity` expresses the distinct policy that a customer owns at
most one currently reserved product:

```pkl
a.alwaysOwnerCapacity(
  "reservation.owner-capacity.violated",
  "RESERVATION-OWNER-CAPACITY",
  4,
  "violated",
)
```

The unconstrained fixture intentionally receives a counterexample: one
customer reserves product 0, then product 1. The relation's base type only
guarantees **one owner per product** (`Product -> lone Customer`); it does not
guarantee one product per customer. Under `releaseBeforeReserve`, the same
capacity property holds because a second reservation cannot be accepted while
the first remains active. This keeps multiplicity and scheduling as separate,
reviewable domain decisions.

## Commands

```sh
node scripts/generate-alloy-behavior.mjs \
  fixtures/alloy-behavior-reservation.pkl \
  fixtures/alloy-behavior/CommerceReservationGenerated.als

node scripts/verify-alloy-behavior.mjs --require-analyzer \
  fixtures/alloy-behavior-reservation.pkl
```

The second command invokes `alloy6` when available. It interprets a solution
to `check P` as Alloy's counterexample to `P`, compares that result with
`holds`/`violated`, and keeps both the analyzer receipt and a
domain-readable reservation trace in the JSON report.

Pass `--scope-matrix` to also check every smaller exact entity scope and time
bound up to the fixture's declared bounds:

```sh
node scripts/verify-alloy-behavior.mjs --require-analyzer --scope-matrix \
  fixtures/alloy-behavior-reservation.pkl
```

The report distinguishes three outcomes. A `holds` property must have no
counterexample in every matrix cell. A `violated` property must have a
counterexample in at least one cell; cells too small to express that witness
are reported as `not-found`, not as a proof. Each model also emits Alloy `run`
commands for a non-empty world, a reachable reservation, and a reachable
release. These guard against a vacuous model whose `check` commands pass only
because its facts admit no behavior.
