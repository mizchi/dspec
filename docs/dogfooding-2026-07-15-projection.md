# Generated Projection Dogfooding 2026-07-15

## Question

Can dspec make every checked-in deterministic generator output part of the
typed source contract, instead of relying on repository-specific generation
scripts and separate task conventions?

## Source Contract

`examples/dspec.pkl` declares a localized Markdown review projection plus
single-artifact backend projections:

```pkl
projections: Listing<d.Projection> = new {
  new d.Projection {
    id = "self-markdown"
    kind = "markdown"
    matrix = "locales"
    output = "generated/examples/{locale}/dspec.md"
    freshness = "exact"
    provenance = "generated/examples/dspec.provenance.json"
  }
  new d.Projection {
    id = "self-quickcheck"
    kind = "quickcheck"
    matrix = "single"
    output = "generated/backends/dspec-self.mjs"
    provenance = "generated/backends/dspec-self.quickcheck.provenance.json"
  }
  // lean, alloy, tla, tla-cfg, source-map, and generated-manifest follow
  // the same single-output contract.
}
```

`markdown` is the only locale matrix today: it expands every declared model
locale and owns paths matched by its output template. `quickcheck`, `lean`,
`alloy`, `tla`, `tla-cfg`, `source-map`, and `generated-manifest` use `single`;
their output is one safe path with a kind-specific extension and its own
provenance document.

## Workflow

```sh
node src/cli.mjs generate --dry-run --json examples/dspec.pkl
node src/cli.mjs generate examples/dspec.pkl
node src/cli.mjs generated check examples/dspec.pkl
```

`generate --dry-run` computes create/update/remove/unchanged actions and
digests without writing. A real `generate` stages the complete plan, verifies
staged bytes and observed preconditions, then commits it as one rollback
boundary. It also writes the declared provenance artifact. `generated check`
is read-only and fails for missing, stale, or unexpected owned artifacts or
stale provenance. The commands support `--json` and `--root` for CI or isolated
fixture execution.

## Mutations

The fixture workflow exercised four states:

- remove the English artifact: detected as `missing`
- replace the English content: detected as `stale`
- add a French template-matching artifact: detected as `unexpected`
- replace provenance content: detected as stale provenance
- run `generate` again: all conditions are repaired deterministically

An invalid locale projection without exactly one `{locale}` placeholder is
rejected by `dspec check` before generation. A single projection cannot contain
any placeholder. Absolute paths, parent traversal, unsupported placeholders,
kind-incompatible extensions, duplicate ids, unsafe or missing provenance
paths, and output/provenance collisions are also rejected by the validator.

## Dogfood Findings

The source model can now answer which localized review artifacts should exist,
where they belong, and whether the checked-in copies are current. The former
`scripts/generate-localized-markdown.mjs` repository convention is no longer a
second source of truth; `Taskfile.pkl` and `package.json` call the generic dspec
commands.

The first implementation put `projections` inside `Model`. Dogfooding exposed
that fixtures importing and amending `examples/dspec.pkl.model` then inherited
the base entrypoint's generated-file ownership. Requiring every derived model
to reset the listing was easy to forget and mixed logical inheritance with
build ownership.

The corrected contract keeps typed `projections` next to `model` at the Pkl
entrypoint. The CLI combines them only when loading that entrypoint. A fixture
that amends `base.model` now receives the logical specification with zero
projections automatically, while direct commands against `examples/dspec.pkl`
still see and enforce `self-markdown`.

The same contract is now declared by `examples/sample-webapp-2026.pkl`, which
owns Japanese and English Markdown review artifacts independently of the self
specification. Both projections share `generated/examples/`, but exact
freshness remains scoped to each output template, so neither entrypoint treats
the other's files as unexpected.

`impact --json` compares every materialized projection by path. It reports
`regenerate` when bytes differ, `remove` when an owned path disappears, and
includes both `kind` and `projectionKind`. The latter preserves the backend
identity for provenance-only changes, such as a model digest change where a
TLA config's static text remains unchanged. The report includes the after-side
`dspec generate` argv plus a shell display command. The `spec-change review`
path reports that argv relative to the review execution root, so its JSON is
portable across working directories and checkouts.

The planner and report formatter now live in `src/core/projection.mjs`, with a
public `@mizchi/dspec/projection` export. They consume model and filesystem
observations as data and have no write authority. `src/projection-filesystem.mjs`
is the separate staged transaction adapter. It acquires an atomic
generation-root lock before checking plan preconditions, rejects a concurrent
writer, and releases the lock after either commit or rollback. The lock stores
PID, hostname, acquisition time, and an ownership token. `generated unlock`
recovers a dead same-host owner or expired lease, refuses an active live/foreign
owner, and requires `--force` for malformed active ownership metadata. The
15-minute lease heartbeat is renewed during staging and each commit step.

Provenance records model and projection digests, emitter name/version, stable
generation time, and every owned artifact digest. Re-running an unchanged
projection preserves `generatedAt`, while changed deterministic inputs replace
it. A fixed `--generated-at` option keeps report fixtures reproducible.

Two holdouts broadened the path shapes: one has a single Japanese locale under
a deeply nested review directory; the other models a monorepo with two
independent projections under app and package roots. Preview, generation, and
freshness checks pass for both.

Dogfooding exposed a same-process mutation bug: the Markdown renderer sorts
parts of its input model, so rendering one locale changed the model digest used
by later provenance calculation. Snapshot creation now clones the model for
every renderer invocation, and a focused regression test locks that isolation.

Exact freshness is deliberately bounded by each declared output shape. It
removes `generated/examples/fr/dspec.md` for an undeclared locale, but it does
not own or delete unrelated files next to any localized or single-output
artifact.

`generated-manifest` is a deterministic digest catalog for static generator
outputs. It is not an `AssuranceEvidenceManifest`: the latter records a real
tool execution, time, and result. `evidence create`, `verify`, and `refresh`
remain the only path for those attestations, so `generate` cannot overwrite
execution evidence with an unexecuted claim.

## Result

The self model reports 111 terms, 74 rules, 335 automated targets, eight
declared projections, and 1061 resolvable drift references. The projections
close checked-in backend freshness gaps without claiming that generated sources
or documents prove application behavior.

## Verification

- `pkf run --refresh check:fast`: portable schema, generated-artifact, report,
  and dogfood gates pass; optional formal-tool tests may skip outside the
  devShell
- `nix develop path:$PWD -c pkf run check:formal`: generated
  QuickCheck and Lean pass; TLA+ SANY/TLC and Alloy Analyzer pass; typed Lean
  equality and implication evidence remains accepted
- `pkf lint`: 8 existing `inputs-without-cache` warnings, no new finding

## Next Extensions

- add a projection kind for a checked-in runtime collector only when a project
  needs that generated observation plan under source ownership
- evaluate whether reusable project-local projection constructors are enough
  to hide common output templates without adding a second DSL
- keep temporal assurance evidence separate unless a project defines an
  execution-attestation store with its own retention and freshness contract
- replace the filesystem lease with an external coordination service if
  multi-host generation becomes routine; the current protocol assumes bounded
  clock skew and that one staging operation completes within the lease window
