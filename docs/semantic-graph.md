# Semantic graph export

`dspec graph export` projects the Pkl specification master into an
evidence-aware graph. It is an interoperability and retrieval view; it does
not replace Pkl as the authoring format or as the normative source.

```sh
dspec graph export examples/tetris.pkl > tetris.semantic-graph.json
dspec graph export --format turtle --output tetris.semantic-graph.ttl examples/tetris.pkl
dspec graph export --format graphdb --output generated/tetris.graphdb-input examples/tetris.pkl
dspec graph embed generated/tetris.graphdb-input
dspec graph build --mutual generated/tetris.graphdb-input
dspec graph query --locale ja examples/tetris.pkl "回転できない条件は何か"
```

## Semantic contract

The JSON graph has stable string IDs, node kinds, relation labels, and the
evidence status of every declaration. Its first schema version marks every
Pkl-projected node and edge as:

- `origin: "pkl"`
- `evidenceStatus: "declared"`

In particular, `implemented-by`, `has-check`, and `refines-implementation`
mean that the model declares the connection. They do **not** mean that code
conformance was observed or that a refinement was proved. Existing dspec
conformance, evidence, and formal-tool commands remain responsible for those
claims.

The graph currently contains the model root, vocabulary terms, Rules, checks,
implementation artifacts, Decisions, Projections, DDD declarations and their
formalization links, plus Intent capabilities, processes, outcomes, goals,
claims, assurance tasks, bindings, scenarios, and protocol tests. Missing
references remain inspectable as `unresolved-*` nodes when an invalid model is
exported.

## Retrieval-backed specification questions

`dspec graph query` is the free-form entry point for asking the current
specification a question. It returns ranked source nodes, their direct graph
relations, and stable evidence references. It deliberately does not claim that
a generated sentence is entailed: the result remains inspectable as Pkl
declarations or as imported evidence.

```sh
dspec graph query --markdown --locale ja examples/tetris.pkl "落下後に何が起きるか"
dspec graph query --json examples/tetris.pkl "Which rules govern line clearing?"
```

The built-in retrieval provider is `hash`: a deterministic lexical feature
hash. It works without credentials or a model download, including Japanese
character queries, but it is a bootstrap retrieval index rather than a
general-purpose semantic embedding model. Use it for a reproducible local
baseline; replace `notes.csv` with vectors from a chosen embedding model when
semantic recall matters.

## RDF/Turtle

The `turtle` format preserves the same graph with a stable namespace:

```turtle
@prefix dspec: <https://github.com/mizchi/dspec/ontology#> .

<urn:dspec:node:rule%2FORDER-VALID>
  a dspec:rule ;
  dspec:stable-id "rule/ORDER-VALID" .
```

This allows a conventional RDF store to retain relation predicates such as
`dspec:uses-term` or `dspec:requires-capability` for SPARQL or graph analysis.
The namespace is a stable identifier for this export contract; it is not yet a
published OWL ontology or a claim of open-world inference semantics.

## GraphDB bundle

`--format graphdb` writes these files:

| File | Purpose |
| --- | --- |
| `semantic-graph.json` / `semantic-graph.ttl` | Lossless labelled graph sidecars |
| `documents.jsonl` | One embedding document per declaration and reified relation node |
| `id-map.json` | Stable dspec ID ↔ deterministic unsigned 64-bit GraphDB ID |
| `links.csv` | Explicit source → relation → target links for GraphDB |
| `meta.tsv` | GraphDB titles and tags, including `relation:<label>` tags |
| `manifest.json` / `README.md` | Import contract and build command |

`mizchi/meandb` constructs one graph from embeddings and unlabelled
explicit links. The bundle therefore reifies every declared edge as an
intermediate relation node: `source → relation → target`. Relation nodes carry
their exact `relation:<label>` tag, so a GraphDB query can join a source,
named relation, and target without confusing different edge labels. JSON and
Turtle remain the lossless source-side projections.

Choose and operate the embedding model outside dspec, then write
`notes.csv` with the `graphdbId` in the first column and embedding dimensions
after it. Do not replace IDs with JavaScript numbers: they are `u64` decimal
strings.

```sh
dspec graph embed --dimensions 256 generated/tetris.graphdb-input
dspec graph build --metric cosine --k 8 --mutual generated/tetris.graphdb-input
```

`embed` writes a valid `notes.csv`, so `build` invokes `meandb build-graph`
with the matching `links.csv` and `meta.tsv`. To use a different embedding
model, replace only `notes.csv`; then run `dspec graph build` again. `--dry-run`
prints the exact meandb argument vector and `--meandb <path>` selects a
non-default executable.

The resulting `.graphdb` supports similarity search, explicit-link traversal,
and tags. It is a derived index and should be rebuilt from Pkl whenever the
specification changes.

For example, a meandb text query can follow a reified traceability relation:

```text
FIND declaration, relation, artifact
WHERE declaration.tag = "rule"
  AND declaration -[link]-> relation
  AND relation.tag = "relation:implemented-by"
  AND relation -[link]-> artifact
LIMIT 50
```

Run it through dspec with
`dspec graph query-dsl --explain specification.graphdb traceability.gql`.
`--meandb <path>` selects a non-default meandb executable. The explanation
output identifies the two explicit links and the relation node that justified
each result. Relation names are derived from the Pkl semantic graph; inspect
`semantic-graph.json` for the exact available labels.

## Self-specification meandb dogfood

`examples/dspec.traceability.gql` is a structural query over dspec's own Pkl
master: it retrieves each declared Rule, its `implemented-by` relation node,
and the linked implementation artifact. The development task rebuilds this
derived index in a temporary directory, executes the query with `--explain`,
and requires a result with evidence for both explicit links:

```sh
DSPEC_MEANDB=/path/to/meandb pnpm run meandb:traceability
# or, with pkfire:
DSPEC_MEANDB=/path/to/meandb pkf run meandb:traceability
```

This is deliberately an opt-in development gate: meandb is an external Rust
tool rather than a runtime dependency of the published npm package. It checks
that the current dspec self model can still be exported, indexed, and queried;
it does not promote the returned declarations into proof of implementation
correctness.

## Imported implementation evidence

The graph can include results produced by existing dspec verification commands:

```sh
dspec conformance --json examples/my-model.pkl > generated/conformance.json
dspec evidence create --output generated/assurance.json examples/my-model.pkl
dspec reconcile-real-app --json examples/my-model.pkl generated/observed-app.json > generated/reconciliation.json

dspec graph export --format graphdb --output generated/my-model.graphdb-input \
  --conformance generated/conformance.json \
  --assurance generated/assurance.json \
  --real-app generated/reconciliation.json \
  examples/my-model.pkl
```

The imported nodes use separate origins:

- `conformance-report`: finite implementation conformance cases, connected to
  the referenced Rule when one is present;
- `assurance-manifest`: formal-tool or generated-artifact result records and
  their property identifiers;
- `real-app-reconciliation`: facts observed in the inspected app, connected to
  the exact Pkl declaration path checked.

A successful imported report is evidence only in its stated scope. In
particular, a passing finite conformance report is not a proof for all inputs,
and a real-app observation does not turn the Pkl declaration itself from
`declared` into `verified`.
