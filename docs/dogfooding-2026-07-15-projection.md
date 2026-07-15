# Generated Projection Dogfooding 2026-07-15

## Question

Can dspec make checked-in human review documents part of the typed source
contract, instead of relying on a repository-specific generation script and a
separate task convention?

## Source Contract

`examples/dspec.pkl` now declares:

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
}
```

The first projection kind is intentionally narrow. It expands every declared
model locale, renders deterministic Markdown, and owns only paths matched by
the output template.

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

An invalid projection without exactly one `{locale}` placeholder is rejected
by `dspec check` before generation. Absolute paths, parent traversal,
unsupported placeholders, non-Markdown extensions, duplicate ids, unsafe or
missing provenance paths, and output/provenance collisions are also rejected
by the validator.

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

`impact --json` now compares before/after materialized Markdown by locale and
path. It reports `regenerate` when bytes differ, `remove` when an owned path
disappears, and includes the after-side `dspec generate` argv plus a shell
display command. The `spec-change review` path reports that argv relative to
the review execution root, so its JSON is portable across working directories
and checkouts. Stable JSON fixtures lock both the write report and the
read-only freshness report.

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

Exact freshness is deliberately bounded by the output template. It removes
`generated/examples/fr/dspec.md` for an undeclared locale, but it does not own
or delete unrelated files under `generated/examples/`.

## Result

The self model reports 109 terms, 71 rules, 326 automated targets, one declared
projection, and 1016 resolvable drift references. The projection closes the
checked-in Markdown freshness gap without claiming that generated documents
prove application behavior.

## Verification

- `pkf run --refresh check:fast`: 299 tests, 296 pass, 3 optional formal-tool
  tests skipped outside the devShell, 0 failures
- `nix develop path:$PWD -c pkf run check:formal`: generated
  QuickCheck and Lean pass; TLA+ SANY/TLC and Alloy Analyzer pass; typed Lean
  equality and implication evidence remains accepted
- `pkf lint`: 8 existing `inputs-without-cache` warnings, no new finding

## Next Extensions

- add explicit projection kinds only when a checked-in artifact needs source
  ownership, starting with source maps or generated evidence manifests
- extend projection impact from Markdown content comparison to future emitter
  kinds and dependency-aware generation plans
- evaluate whether reusable project-local projection constructors are enough
  to hide common output templates without adding a second DSL
- replace the filesystem lease with an external coordination service if
  multi-host generation becomes routine; the current protocol assumes bounded
  clock skew and that one staging operation completes within the lease window
