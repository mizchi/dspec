# Daily Drift Dogfooding 2026-07-17

## Scope

The daily drift workflow was exercised as an operator: collect the current
multi-target packet, inspect a missing-baseline failure, establish a baseline
through the public CLI, and run the seeded review evaluator.

## Result

The normal collection completed with `pass` for all three declared targets:
`dspec-self`, `sample-webapp`, and `runtime-evidence`. The packet contains the
selected deterministic reports, English and Japanese Markdown projections, the
packet-local review skill, provenance, and the approved baseline check.

The later self-specification change that added the public daily-drift CLI
changed the `dspec-self` model digest. The checked-in baseline now correctly
causes the normal task to fail only that target pending human approval. An
isolated baseline approved through `dspec daily-drift approve` passed all three
targets with the Nix formal-tool environment; the checked-in baseline was not
overwritten by this exercise.

The sample web-app target does not currently declare the generic `coverage`
gate; its review fixture therefore declares its applicable review steps
explicitly rather than inheriting the generic review's coverage-after default.
This is a scoped assurance decision, not evidence that the web-app model has
complete rule coverage.

The seeded evaluator completed with `pass`. It covers Intent-to-formal,
formal-to-implementation, localized-meaning, and no-drift restraint cases.

A full three-target approval was then exercised in the Nix formal-tool
environment against a temporary baseline. It bound the self, web-app, and
runtime review fixtures, recorded schema version `1.1` with all three review
and after-model digests, and a subsequent `collect --fail-on-drift` passed all
three targets.

When the baseline file was absent, collection deliberately retained a failing
packet. The per-target `baseline.json` now includes a structured
`remediation.command` for the repository checkout and an
`remediation.installedCommand` for `dspec daily-drift approve`, while retaining
the underlying deterministic error and target digest evidence.

## Findings

- The original baseline operation exposed the internal generator and several
  policy flags. `dspec daily-drift collect` and `dspec daily-drift approve`
  now provide the operator-facing namespace; `approve` is still explicit about
  the approver and approval id.
- In a repository checkout, the `dspec/` source directory shadows an
  unqualified `dspec` command. Repository documentation therefore uses
  `node src/cli.mjs daily-drift ...`; installed package consumers use `dspec
  daily-drift ...`.
- The clean npm consumer smoke now generates a daily packet from a consumer
  working directory. The generator resolves models and output paths from the
  invocation directory, while it resolves the CLI and review skill from the
  installed package. This protects the published command rather than only the
  repository layout.
- Multi-target approval is explicit and auditable, but currently verbose: an
  operator repeats `--spec-change-review target=review.pkl` for every target.
  A typed review-binding manifest or scaffold should derive these bindings from
  a changed-target packet while keeping the target-to-review association
  visible.
- A baseline match only establishes that the declared model and Intent graph
  match an approved snapshot. It does not establish semantic refinement of an
  arbitrary implementation. The packet preserves AppProfile/runtime evidence
  and the review prompt repeats this boundary.
- The LLM job itself was not invoked in this local run: the review packet,
  isolated prompt, and deterministic evaluation oracle were verified, but no
  provider credential or live-model quality claim is implied.

## Decision

Keep the packet and seeded evaluator as the daily deterministic gate. Treat
the LLM review as a packet-bounded classifier whose live behavior must be
measured separately through recorded evaluation runs. The next operational
improvement, now implemented, is an approval ledger: every replacement baseline
must bind a passing `SpecChangeReview` to each target, whose after-model digest
must match the target digest. The baseline stores the review and report digests
alongside the approver and approval id.
