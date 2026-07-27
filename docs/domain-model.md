# Domain model and code generation

`patterns.domain` is the DDD-oriented layer in dspec. It makes the usual domain
actors explicit without making any application framework normative:

- `DomainValueObject` is an immutable descriptive value;
- `DomainEntity` has a named identity field;
- `DomainAggregate` establishes a consistency boundary with one root;
- `DomainCommand` requests a decision for an Aggregate;
- `DomainEvent` describes a fact emitted by that Aggregate;
- `DomainInvariant` links an Aggregate concern to a normative `Rule`;
- `DomainFormalization` states which formal artifact checks that Rule.

The Pkl declarations are the source of truth for shape and linkage. They do
not assert that a generated class has proven the business rules.

```pkl
patterns = new d.PatternCatalog {
  domain = new d.DomainModel {
    valueObjects {
      new d.DomainValueObject {
        id = "money"
        fields {
          new d.DomainField { id = "amount"; type = "decimal" }
          new d.DomainField { id = "currency"; type = "string" }
        }
      }
    }
    entities {
      new d.DomainEntity {
        id = "purchase-order"
        identity = "orderId"
        fields {
          new d.DomainField { id = "orderId"; type = "uuid" }
          new d.DomainField { id = "total"; type = "value-object"; target = "money" }
        }
      }
    }
    aggregates {
      new d.DomainAggregate {
        id = "purchase-order"
        root = "purchase-order"
        members { "purchase-order" }
      }
    }
  }
}
```

`DomainField.type` supports scalar types plus `value-object`,
`entity-reference`, and `enum`. The latter three require `target`. The checker
rejects unknown targets, duplicate code names, identities that are not fields,
and Aggregate roots omitted from their member list.

## Formalization is an explicit choice

An invariant says which Rule applies; it does not select a verifier implicitly.
Use a `DomainFormalization` to record that decision:

```pkl
new d.DomainFormalization {
  id = "order-total-alloy"
  rule = "ORDER-TOTAL-NON-NEGATIVE"
  kind = "alloy-behavior"
  assurance = "bounded"
  target = new d.ImplementationRef {
    kind = "model"
    path = "fixtures/order-behavior.pkl"
  }
}
```

`kind` selects a declared route: `behavior`, `lean-core`, `alloy-behavior`, or
`formal-links`. The target is validated by the normal drift gate. The result
must still be interpreted according to its declared assurance: a bounded Alloy
check is not a Lean proof, and neither proves that arbitrary application code
matches the model.

## Explicit refinement links

When one model deliberately abstracts another, state that connection as a
`DomainFormalizationRefinement` rather than only mentioning it in an
assumption. It names the abstract and concrete formalizations, the condition
on each side, and the stable check produced by the concrete model.

```pkl
new d.DomainFormalizationRefinement {
  id = "spawn-open-from-coordinates"
  kind = "input-abstraction"
  sourceFormalization = "start-game-behavior"
  targetFormalization = "coordinate-start-spawn-alloy"
  sourceCondition = "spawn-open = 1"
  targetCondition = "no (SpawnScenario.spawn & SpawnScenario.locked)"
  checks { "tetris.coordinate-spawn.availability-refines-coordinates.holds" }
}
```

The checker rejects an unknown endpoint, a self-link, an empty check list, or
a check not declared by the concrete formalization. Traceability then requires
passing evidence for both endpoints and for every named check. The condition
strings remain reviewable labels; the bounded assertion named by `checks` is
the machine-checkable evidence. A passing bounded check still establishes only
the selected scope, not a complete refinement proof or application-code
conformance. A concrete model may also contribute a finite implementation
conformance check; that is separate evidence and must say which adapter and
finite input space it exercised.

## Language-neutral IR

```sh
dspec domain ir fixtures/domain-codegen.pkl > domain-ir.json
```

The IR has a versioned schema and contains normalized names, the original
`DomainField.type` and `target` (without collapsing `decimal` into a
TypeScript `string`), Aggregate membership, invariant Rule ids, and
formalization links. It is the contract for renderers in other ecosystems. A
Go/Rust/Java/Kotlin/Python renderer should consume this JSON rather than parse
Pkl or duplicate DDD validation rules.

The regular Markdown projection also renders the Domain Model. Its source map
contains an entry for every declaration and field, so a reader can navigate
from a generated Entity, Value Object, or formalization link back to the exact
Pkl declaration that owns it.

## Specification relationship document

The relationship graph makes the links that are otherwise implicit in separate
declarations reviewable in one place. It includes field references, Aggregate
boundaries, Commands and Events, Invariant-to-Rule links, Formalization-to-
artifact links, and each linked Rule's terms, checks, and implementation
references. It also includes refinement nodes that connect an abstract
formalization to its concrete target and assertion evidence.

```sh
# Reviewable document with a Mermaid diagram
dspec domain relationships --markdown \
  --output docs/generated/commerce-relationships.md \
  fixtures/domain-codegen.pkl

# Stable machine-readable graph for a UI, query layer, or another generator
dspec domain relationships --json fixtures/domain-codegen.pkl > relationships.json
```

The generated edges are declared traceability, not a proof of equivalence. In
particular, a `checks-rule` edge says that an artifact was selected to check a
Rule; its `assurance` and verifier result determine what claim can be made.

## Built-in TypeScript scaffold

```sh
dspec domain generate --language typescript \
  --output src/generated/domain.ts \
  fixtures/domain-codegen.pkl
```

The generated file contains:

- string-literal enum types;
- interfaces for Value Objects, Entities, Commands, and Events;
- branded identity types for Entity identity fields;
- Aggregate repository ports;
- constructor stubs for Commands; and
- machine-readable formalization links.

Constructor stubs always throw after documenting the invariant Rule ids. This
is intentional: field shape is safe to generate, but acceptance conditions,
authorization, allocation, persistence, side effects, and error semantics need
an explicit application implementation and separate conformance evidence.

## Adding another language

Keep language-specific behavior outside the DDD declaration. A renderer reads
the `domain ir` JSON and may generate only the safe mechanical layer (types,
ports, event envelopes, and TODO-bearing constructors). The application then
implements the behavior and links its tests, model checks, or Lean proof back
to the invariant Rule through normal dspec evidence. This keeps a future
renderer replaceable without giving a generated class an unjustified claim of
domain correctness.
