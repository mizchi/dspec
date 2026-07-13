# Dogfooding Evaluation 2026-07-10

## Scope

This dogfood run treats `examples/dspec.pkl` as the master spec for the dspec
prototype itself, and treats `fixtures/runtime-model.pkl` as the smallest
end-to-end Runtime observation loop. It also treats
`examples/sample-webapp-2026.pkl` as the first real-app dogfood model, backed
by an adjacent `sample-webapp-2026` checkout.

The question under review is not whether dspec proves arbitrary software
correct. The practical question is narrower:

- Can the spec file drive development without becoming detached documentation?
- Can implementation drift and missing coverage be detected mechanically?
- Can orphan domain model facts be detected before they become unreviewed
  source-of-truth data?
- Can runtime evidence move from declared intent to provider-shaped payloads
  and back into reviewable drift reports?

## Commands Run

```sh
node src/cli.mjs check examples/dspec.pkl
node src/cli.mjs check --json examples/dspec.pkl
node src/cli.mjs drift examples/dspec.pkl
node src/cli.mjs drift --json examples/dspec.pkl
node src/cli.mjs coverage examples/dspec.pkl
node src/cli.mjs coverage --json examples/dspec.pkl
node src/cli.mjs domain-coverage examples/sample-webapp-2026.pkl
node src/cli.mjs domain-coverage --json examples/sample-webapp-2026.pkl
node src/cli.mjs domain-coverage --json fixtures/domain-coverage-orphan.pkl
node src/cli.mjs check examples/sample-webapp-2026.pkl
node src/cli.mjs drift examples/sample-webapp-2026.pkl
node src/cli.mjs import-real-app --json ../sample-webapp-2026
node src/cli.mjs reconcile-real-app --json examples/sample-webapp-2026.pkl fixtures/reports/import-real-app-sample-webapp.json
node src/cli.mjs reverse-coverage --json examples/sample-webapp-2026.pkl fixtures/reports/import-real-app-sample-webapp.json
node src/cli.mjs scaffold-app-profile --observed-facts fixtures/reports/import-real-app-sample-webapp.json examples/sample-webapp-2026.pkl ../sample-webapp-2026
node src/cli.mjs scaffold-app-profile --diff fixtures/sample-webapp-profile.pkl --json --observed-facts fixtures/reports/import-real-app-sample-webapp.json examples/sample-webapp-2026.pkl ../sample-webapp-2026
node src/cli.mjs scaffold-app-profile --apply fixtures/sample-webapp-profile.pkl --json --dry-run --observed-facts fixtures/reports/import-real-app-sample-webapp.json examples/sample-webapp-2026.pkl ../sample-webapp-2026
node src/cli.mjs evaluate-app-profile --json fixtures/sample-webapp-profile.pkl
node src/cli.mjs evaluate-app-profile --json fixtures/sample-webapp-profile-scenarios.pkl
node src/cli.mjs evaluate-app-profile --json fixtures/sample-webapp-profile-extended-scenarios.pkl
node src/cli.mjs evaluate-app-profile --markdown fixtures/sample-webapp-profile-extended-scenarios.pkl
node src/cli.mjs coverage-app-profile-scenarios --json fixtures/sample-webapp-profile-extended-scenarios.pkl
node src/cli.mjs score-app-profile-mutations --json fixtures/sample-webapp-profile-extended-scenarios.pkl
node src/cli.mjs score-app-profile-mutations --json fixtures/holdout-schema-profile.pkl
node src/cli.mjs score-app-profile-mutations --json fixtures/holdout-workflow-profile.pkl
node src/cli.mjs score-app-profile-mutations --json fixtures/holdout-mixed-profile.pkl
node src/cli.mjs score-app-profile-mutations --json fixtures/holdout-mixed-shuffled-profile.pkl
node src/cli.mjs score-app-profile-mutations --json fixtures/holdout-mixed-noisy-profile.pkl
node src/cli.mjs replay-app-profile-changes --json fixtures/app-change-replay-corpus.pkl
node src/cli.mjs spec-reading-eval --json fixtures/spec-reading-eval-sample-webapp.pkl
node src/cli.mjs spec-reading-eval --json fixtures/spec-reading-eval-holdout-runtime.pkl
node src/cli.mjs spec-reading-eval-suite --json fixtures/spec-reading-eval-suite.pkl
node src/cli.mjs coverage-spec-reading-eval-suite --json fixtures/spec-reading-eval-suite.pkl
node src/cli.mjs metamorphic-spec-reading-eval --json fixtures/spec-reading-eval-sample-webapp.pkl
node src/cli.mjs spec-reading-eval --prompt fixtures/spec-reading-eval-sample-webapp.pkl
node src/cli.mjs spec-reading-eval --prompt --locale en fixtures/spec-reading-eval-sample-webapp.pkl
node src/cli.mjs spec-reading-eval --json --refresh-digests fixtures/spec-reading-eval-stale-digest.pkl
node src/cli.mjs spec-reading-eval --json --score fixtures/spec-reading-eval-answers.json --write-run /tmp/dspec-spec-reading-run.json fixtures/spec-reading-eval-sample-webapp.pkl
node src/cli.mjs spec-reading-eval --markdown --score fixtures/spec-reading-eval-answers.json fixtures/spec-reading-eval-sample-webapp.pkl
node src/cli.mjs spec-change compat --json fixtures/compat-before.pkl fixtures/compat-narrowing-after.pkl
node src/cli.mjs spec-change scaffold fixtures/compat-before.pkl fixtures/compat-narrowing-after.pkl
node src/cli.mjs spec-change scaffold --json fixtures/compat-before.pkl fixtures/compat-breaking-after.pkl
node src/cli.mjs spec-change --help
node src/cli.mjs spec-change scaffold --help
node src/cli.mjs spec-change scaffold --output /tmp/dspec-spec-change-review.pkl fixtures/compat-before.pkl fixtures/compat-narrowing-after.pkl
node src/cli.mjs spec-change review --json /tmp/dspec-spec-change-review.pkl
node src/cli.mjs spec-change review --json fixtures/spec-change-review.pkl
node src/cli.mjs spec-change review --json fixtures/spec-change-review-breaking-approved.pkl
node src/cli.mjs check-app-profile --json fixtures/sample-webapp-profile.pkl
node src/cli.mjs check-app-profile --json fixtures/sample-webapp-profile.pkl fixtures/sample-webapp-profile.pkl
node src/cli.mjs check-app-profile-suite --json fixtures/sample-webapp-profile-suite.pkl
node src/cli.mjs evaluate-app-profile-suite --json fixtures/sample-webapp-profile-suite.pkl
node src/cli.mjs check-app-profile --markdown fixtures/sample-webapp-profile.pkl
node src/cli.mjs check-app-profile --fix --dry-run fixtures/sample-webapp-profile.pkl
node src/cli.mjs check-app-profile --fix fixtures/sample-webapp-profile.pkl
pkf run app-profile:refresh
node src/cli.mjs impact --json fixtures/impact-before.pkl fixtures/impact-after.pkl
node src/cli.mjs verify-generated --json examples/dspec.pkl
node src/cli.mjs import-db-schema --json fixtures/db-schema.sql
node src/cli.mjs check-sql-queries --json fixtures/db-model.pkl fixtures/db-queries.sql
node src/cli.mjs emit runtime-collector-fixture fixtures/runtime-model.pkl \
  | node src/cli.mjs verify-runtime-evidence --json /dev/stdin
```

The spec-change pass intentionally uses only canonical grouped commands.
Removed long command names are exercised by negative CLI tests as unknown
commands, not as compatibility aliases.

Observed result:

- self model check: `ok: dspec-self (100 terms, 67 rules)`
- implementation drift: `ok: dspec-self drift (846 references)`
- approved-rule coverage: `ok: dspec-self coverage (65/65 approved rules)`
- real app model check: `ok: sample-webapp-2026 (27 terms, 4 rules)`
- real app implementation drift: `ok: sample-webapp-2026 drift (11 references)`
- real app domain coverage: `ok: sample-webapp-2026 domain coverage (29/29 elements)`
- real app artifact import: pass, observed routes/contracts/workflows/flaker/VRT
- real app reconciliation: pass
- real app reverse coverage: pass
- app profile bundle: pass
- app profile declared scenarios: pass
- app profile extended scenarios: pass
- app profile scenario coverage oracle: pass
- app profile mutation score: pass, 12/12 generated mutations detected
- app profile mutation holdouts: pass for schema-only, workflow-only, and mixed-minimal profiles
- app profile mutation metamorphic holdouts: pass for shuffled and noisy mixed profiles
- app profile change replay corpus: pass for no-drift, implementation-missing, and spec-missing labels
- spec reading evaluation: pass for 7 label-hidden claims over `sample-webapp-2026`
  plus a 3-case Runtime holdout suite, including rubric version checks,
  i18n/paraphrase prompt, answer evidence score, sub-agent run artifact,
  markdown report, stale evidence digest detection, and digest refresh dry-run
- spec reading suite coverage oracle: pass for labels, evidence kinds, model
  kinds, tags, and paraphrase locales; the undercovered suite fails as expected
- spec reading metamorphic check: pass for answer-order, evidence-order, noisy
  rationale, negative-control, and prompt label-leak checks
- spec reading file-relative paths: pass when eval and suite files are invoked
  from a different cwd by absolute path
- spec reading dogfood tasks: `spec-reading:report-fixtures` and
  `spec-reading:dogfood` pass
- spec compatibility classifier: pass for compatible, breaking, narrowing, widening, and unknown fixtures
- spec change review scaffold: pass for deterministic Pkl draft generation, destination-relative schema/model paths, repo-external cwd review, command-local help, and breaking evidence policy defaults
- breaking evidence suggestions: pass for Pkl evidence snippets when required migration, deprecation, rollout, or owner-approval evidence is missing
- spec change review procedure: pass for before/after check, impact, compatibility gate, breaking evidence policy, evidence-ref resolution, and after coverage
- breaking spec change fixture: pass when migration, deprecation, rollout, and owner-approval evidence are present; fail when required evidence is missing
- missing evidence-ref fixture: fails when a Markdown evidence anchor does not resolve
- app profile suite registry: pass
- scaffold profile diff: pass
- scaffold profile apply dry-run: pass
- app profile evaluation markdown: pass
- app profile fixture refresh: pass
- orphan domain coverage fixture: fails on `cloud.node orphan-worker`
- check/drift/coverage/domain-coverage JSON reports: pass
- spec-diff impact JSON report: pass
- generated QuickCheck: pass
- generated Lean: pass
- generated TLA+/Alloy syntax shape: pass
- local optional TLA+ SANY/TLC and Alloy analyzer: skipped when tools are not
  on `PATH`
- runtime collector fixture verification: pass, `4/4` expectations

Spec-reading dogfood found one useful issue in the evaluation set itself:
the latency-budget claim was originally labeled `not-supported`, but the spec
declares `dependency.dashboard-to-api.timeoutMs = 2000`. A label-hidden
sub-agent classified the 200ms claim as `contradicted`, which is the correct
reading, so the gold case was renamed to `latency-budget`.
After adding a separate `slo-owner` case to preserve coverage of
all three labels, a second label-hidden sub-agent matched the revised 7-case
gold set at 7/7.

The Nix devShell gate has also been exercised in the current prototype and
enables the optional TLA+ and Alloy tool checks:

```sh
ulimit -n 4096 && nix develop path:/Users/mz/ghq/github.com/mizchi/dspec -c pkf run check
```

For repeatable local dogfooding, the same self-spec, Runtime observation, and
real-app model checks are available as:

```sh
pkf run dogfood
```

## Spec Change Review

Breaking spec changes are reviewable only when the typed review carries
migration, deprecation, rollout, and owner-approval evidence. The review
procedure also checks that those evidence refs resolve to concrete repository
files and Markdown anchors.

## What Passed The Dogfood Test

`examples/dspec.pkl` is now useful as an active development ledger. Adding a
feature is no longer just a code/test change; it can be locked with:

- a stable vocabulary term
- an approved rule
- `CheckTarget` anchors into tests
- `ImplementationRef` anchors into code or fixture files
- domain preset packs that expand repeated domain constraints into Core IR
- a current RBAC example written through those preset packs rather than raw
  `Rule` boilerplate
- an i18n contract that requires `ja`/`en` labels and checks selected glossary
  labels against stable vocabulary terms
- stable JSON reports for check, drift, coverage, and domain coverage gate
  results
- a domain coverage oracle that rejects domain pattern elements not grounded in
  approved rules
- a real-app artifact importer that turns implementation artifacts into
  observed facts
- a real-app reconciliation oracle that checks the hand-authored model against
  observed facts
- a spec-diff impact report that maps changed terms/rules to generated
  selectors and implementation references
- a spec change review scaffold that derives a typed review Pkl draft from
  before/after models and leaves breaking evidence empty for the gate to catch
- a spec change review procedure that bundles before/after check, impact,
  compatibility gate, breaking evidence policy, evidence-ref resolution, and after coverage
- compatibility fixtures for those report shapes under `fixtures/reports/`
- generated Markdown and source-map review artifacts
- `drift` and `coverage` checks in CI
- a real-app dogfood model for `sample-webapp-2026`

This is enough to prevent the most common documentation drift:

- a rule says it is approved but has no automated check
- a check points to a deleted or renamed test
- an implementation reference points to a missing file or symbol
- a required localized label disappears or a glossary label drifts from its
  vocabulary term
- a generated review artifact is stale
- a runtime observation contract no longer matches normalized evidence
- a Cloud/Data/Release/Runtime model fact is added without an approved rule
  that names it

The Runtime path is the clearest dogfood win. The loop is now executable:

1. Author Runtime intent in Pkl.
2. Generate observation requests with `emit runtime-collector`.
3. Bootstrap the adapter path with `emit runtime-collector-fixture`.
4. Collect provider-shaped payloads with `collect-runtime-evidence`.
5. Compare `expects` with observed evidence using `verify-runtime-evidence`.
6. Import evidence as Pkl when the observed data should become part of the
   spec model.

That gives dspec a concrete bridge from human-authored intent to runtime
evidence without pretending raw vendor payloads are formal semantics.

The real-app dogfood path is intentionally weaker but useful. The model does
not make the imported facts authoritative by themselves; it names the API,
contracts package, CI/VRT runners, release checks, data stores, and runtime
dependency by hand. `import-real-app` extracts the observed facts from the
checkout, `drift` verifies named files/symbols still exist, `domain-coverage`
verifies every tracked model element is named by an approved rule,
`reconcile-real-app` checks that expected pattern facts and release gates are
supported by observed implementation artifacts, `reverse-coverage` checks that
observed implementation facts are represented in the model, and
`check-app-profile` bundles these gates into one typed profile.
Dogfooding exposed that stale observed-facts fixtures were still awkward to
refresh, so `check-app-profile --fix` and `pkf run app-profile:refresh` now
turn that review decision into a single explicit command. The write path is
paired with `check-app-profile --fix --dry-run`, which reports `wouldFix`
without changing the fixture.

The next dogfood pass evaluated change scenarios rather than only the happy
path. A missing observed gate now reports an `implementation-missing`
suggestion, which is the spec-first failure mode: either restore the
implementation fact or consciously update the spec. An extra observed gate now
reports a `spec-missing` suggestion, which is the implementation-first failure
mode: either model the new fact or remove the unintended implementation fact.
`check-app-profile` preserves those downstream suggestions so the app profile
can remain the review entry point. It also accepts multiple profile files and
returns an aggregate report, which keeps the same loop usable once the system
is split into several independently modeled apps.
The next iteration made that aggregate list itself explicit:
`check-app-profile-suite` reads a typed `AppProfileSuite`, and
`evaluate-app-profile-suite` aggregates each profile's drift-guard scenarios.
This keeps the registry in Pkl instead of shell history.
For review channels that should not consume JSON directly,
`check-app-profile --markdown` renders the same profile result as a
deterministic Markdown table.
The next pass added `scaffold-app-profile` for AI/human profile authoring,
`evaluate-app-profile` for false-positive/false-negative guard calibration,
and a scaled aggregate profile fixture so the multi-profile report shape stays
stable under larger profile lists.
Dogfooding the scaffold path exposed that checking stdout text was too weak;
the scaffold is now saved during tests and fed back into `check-app-profile`
to prove the generated Pkl draft is actually usable.
`scaffold-app-profile --diff --json` closes the remaining authoring loop by
comparing the regenerated profile draft with the existing profile without
writing it, so profile drift can be reviewed before any update path exists.
The apply path now keeps that safety property explicit: `--apply --dry-run`
reports whether a profile would change, and `--apply` writes a regenerated Pkl
profile with the schema import path relative to the target file.
The scenario DSL now covers raw importer facts and domain facts: routes,
contract schemas, workflows, data stores, runtime dependencies, and release
gates can all be removed or added as declared drift cases. A separate
`coverage-app-profile-scenarios` oracle checks that the profile has baseline
false-positive coverage and both implementation-missing/spec-missing
false-negative coverage, both at gate scope and at scenario-category scope.
It counts only scenarios whose evaluation result passed, so inert declarations
do not satisfy coverage. `profile.requiredScenarioCategories` can narrow the
category requirements for small apps, but it cannot hide categories inferred
from the model and observed app; omitting it uses the inferred categories.
`score-app-profile-mutations` now generates the category-level
implementation-missing/spec-missing cases itself and reports the killed/missed
score with shrink candidates, so the dogfood gate is not limited to hand-picked
scenario declarations. Schema-only, workflow-only, and mixed-minimal holdout
profiles use names outside the main sample app and guard against overfitting the
generator to one application shape. Shuffled and noisy mixed holdouts assert
that selected mutation witnesses stay stable when observed facts are reordered
or unrelated route/schema/workflow facts are added.
`evaluate-app-profile --markdown` makes the same scenario report usable in human
review threads without dropping the detected suggestion kind or mutation
payload.

## What Failed The Dogfood Test

The authoring surface is still verbose for sustained daily use. Pkl gives
typed structure, and shorthand helpers now reduce repeated localized text,
term, clause, check-target, and implementation-reference boilerplate. Domain
preset packs now remove some repeated RBAC and tenant-isolation rule structure.
Full custom rules are still heavy enough to push users toward copy-paste,
which creates drift risk.

The checker can prove references exist, but not that a referenced test fully
captures the intended rule. That is acceptable for now, but it means dspec is
currently a coverage oracle, not a proof oracle.

`Clause.ast` is still mostly a portable projection carrier. It is useful for
deterministic backend generation, but it is not yet a complete contract
language with independently defined semantics.

The generated TLA+/Alloy artifacts are useful as smoke checks, not yet as deep
models. They need richer transition relations, bounded scopes, and
counterexample interpretation before they can justify design decisions.

Runtime evidence is deterministic for recorded and inline payloads, and the
verifier now reports quality/freshness summary counts. It is still not
production-grade. Missing pieces include sampling contracts, authenticated live
collectors, and incident timeline correlation.

The real-app dogfood model still depends on a hand-authored authoritative
mapping from source files to Cloud/Data/Release/Runtime pattern elements. The
new importer reduces that cost by extracting observed facts, and reconciliation
checks the mapping, but richer extraction from real source, IaC, CI, and
telemetry artifacts remains future work.

## Can This Be The Master Spec?

For dspec's current repository-level CLI/checker contract: yes.

The self model is strong enough to be treated as the active master for:

- what commands exist
- what generated artifacts exist
- what pattern families are supported
- which rules are approved
- which approved rules have automated checks
- which code and fixture symbols implement those rules
- whether generated artifacts are stale
- whether domain pattern facts are orphaned from approved claims
- whether at least one real application checkout can be represented and checked
  as a dspec model
- whether observed real-app artifacts still support the hand-authored model
- whether implementation-observed facts are missing from the hand-authored model
- whether a typed app profile can rerun the real-app gate bundle

For product/domain-level correctness across a real cloud application: not yet.

It can be the master index of claims and evidence, but individual high-risk
claims still need specialized adapters and backend checks:

- DB query behavior now has static schema/tenant/FK drift checks, but still
  needs query-plan or equivalence checks beyond the current oracle.
- Cloud topology needs IaC/IAM/Kubernetes imports and reachability checks.
- Data governance needs catalog, lineage, retention, deletion, consent, and
  access-log evidence.
- Release safety needs real pipeline/controller imports and temporal rollout
  checks.
- Runtime safety needs live collectors, evidence freshness, and incident
  timeline semantics.

## Good Next Work

The next useful increments are:

1. Add an IaC importer so a real cloud app can be reconciled against
   `patterns.cloud`, and extend the real-app importer beyond the current
   Hono/Zod/GitHub Actions/flaker/VRT subset.
2. Extend TLA+/Alloy normalization from generated-selector witnesses into
   structured trace valuation where backend output exposes it.
3. Add authenticated/scheduled collector profiles on top of the generic HTTP
   source support.

## Decision

Keep dogfooding dspec on dspec itself.

The current prototype has crossed the threshold from "interesting schema" to
"usable repository contract ledger". The next threshold is reducing authoring
friction and importing real implementation/runtime artifacts, so that humans
author intent while adapters maintain the lower-level model evidence.
