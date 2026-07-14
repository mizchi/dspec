# dspec Usability Evaluation

Date: 2026-07-14

Latest concrete dogfood runs: `docs/dogfooding-2026-07-14-mnemo.md` and
`docs/dogfooding-2026-07-14-assurance.md`.

## Verdict

`examples/dspec.pkl` can now be used as the prototype's active self-spec
ledger. It is strong enough to drive small changes in this repository as long
as new approved rules are paired with automated check targets.

It works today as:

- a typed, reviewable catalog of terms, rules, decisions, and known non-goals
- authoring shorthand helpers for common localized text, term, clause,
  check-target, and implementation-reference records
- RBAC and tenant-isolation domain preset packs that expand to ordinary
  `Term`, `Rule`, and typed `Clause.ast` records
- a domain pack registry that checks pack helper contracts and helper-symbol
  drift
- a current RBAC example that uses the RBAC preset pack while preserving
  project-specific review text and check targets
- a localized source for human-readable spec output
- an i18n contract that checks required localized labels and glossary label
  drift against stable vocabulary terms
- a cheap consistency gate for duplicate ids, broken references, direct
  contradictions, and approved rules without any target
- a drift gate for implementation paths, implementation symbols, check target
  paths, and Node test anchors
- a command registry that generates top-level CLI usage, plus a
  command-example drift guard that extracts README/docs/Taskfile CLI examples,
  help-smokes them against the live CLI surface, and checks extractor behavior
  with a holdout Markdown fixture
- a spec-reading evaluation set that pairs a correct spec model with
  `entailed`, `contradicted`, and `not-supported` claims, renders label-hidden
  sub-agent prompts, scores returned answer JSON, refreshes stale evidence
  digests, and aggregates sample plus holdout suites
- a coverage gate that requires every approved active rule to have an automated
  check target
- typed assurance claims that distinguish resolvable references from executed,
  mutation-tested, bounded, and proved support, require evidence for stronger
  claims, expose the assurance distribution in check/drift/coverage reports,
  survive QuickCheck projection, and participate in compatibility classification
- typed assurance evidence manifests with model/artifact/tool freshness checks,
  refresh workflow, and per-operator Clause/backend applicability records
- a domain coverage gate that requires tracked domain pattern elements to be
  grounded in approved rules by stable ids
- stable JSON reports for check, drift, coverage, and domain coverage gates,
  including failing error arrays for external agents and CI consumers
- a spec-diff impact report that maps changed terms/rules to generated
  selectors and implementation refs for review routing
- compatibility fixtures for check, drift, coverage, and impact JSON report
  shapes under `fixtures/reports/`
- optional clause-level coverage that requires `CheckTarget.covers` to support
  every `when` / `must` / `mustNot` clause for selected rules
- deterministic projections to Markdown, QuickCheck-style JS, Alloy, TLA+, and
  Lean skeletons
- typed `Clause.ast` preservation in QuickCheck, TLA+, and Lean projections
- a typed DB model pattern for tables, invariants, transactions, migrations,
  preservation projections, migration mapping coverage projections, and
  mapping well-formedness checks
- a typed Cloud topology pattern for network zones, cloud nodes, flows,
  explicit policies, boundary checks, sensitive-resource policy coverage,
  tenant-context propagation, and queue idempotency checks
- a typed Data governance pattern for classifications, datasets, stores,
  placements, flows, encryption-at-rest checks, deletion-support checks,
  cross-region legal-basis checks, and retention-policy checks
- a typed Release safety pattern for services, environments, gates, rollback
  plans, migrations, release steps, production health gates, traffic-shift
  rollback checks, rollback-test checks, and migration-compatibility checks
- a typed Runtime safety pattern for services, dependencies, signals,
  runbooks, alerts, SLOs, critical-SLO page alerts, tested-runbook checks,
  dependency-timeout checks, and retry-idempotency checks
- typed Runtime evidence records for telemetry windows, alert policies,
  runbook executions, and dependency traces, with checks for SLO telemetry
  coverage, SLO target drift, enabled alert policies, passing runbook
  executions, and trace timeout drift
- a runtime evidence importer that normalizes provider-scoped JSON exports into
  deterministic Pkl fragments or stable JSON for those evidence records
- a runtime evidence collector that aggregates recorded or live HTTP provider
  API payloads into the importer contract via a deterministic manifest
- a runtime collector manifest generator that derives provider observation
  requests from Runtime safety specs
- a runtime evidence verifier that compares collector `expects` blocks with
  normalized observations and reports coverage/drift as JSON
- backend-aware drift validators for Node, Playwright, Lean, TLA+, Alloy, Pkl,
  and runtime collector manifest `CheckTarget` refs
- a runtime collector fixture generator that emits collectable inline provider
  payloads for bootstrapping the observation loop
- generated QuickCheck execution and generated Lean compilation through
  `dspec verify-generated`
- generated TLA+/Alloy syntax-shape validation through `dspec verify-generated`
- generated TLA+ SANY/TLC and Alloy analyzer smoke checks when `tlasany`,
  `tlc`, and `alloy6` are available, for example through `nix develop`
- a Nix devShell contract for Node.js 24, pnpm, Pkl, Lean via elan, Z3, TLA+,
  and Alloy 6
- a JSON verification report from `dspec verify-generated --json`
- a load-bearing negative fixture proving generated backend checks fail when
  an approved rule lacks support
- a checked-in Markdown review artifact at `generated/dspec.md`
- a checked-in source-map artifact at `generated/source-map.json` that maps
  generated selectors back to `Rule`, `Clause`, and `CheckTarget` source paths
- a checked-in generated manifest at `generated/manifest.json` that records
  SHA-256 freshness hashes for primary generated artifacts
- counterexample normalization that maps generated QuickCheck/Lean failures
  and TLA+/Alloy generated-selector witnesses back to `Rule.id`, source path,
  generated selector, and reviewable message
- a GitHub Actions gate that runs required-tool smoke, required formal-backend
  smoke, and `pkf run check` inside the Nix devShell
- a real-app dogfood model at `examples/sample-webapp-2026.pkl` that maps an
  adjacent application checkout into Cloud/Data/Release/Runtime patterns and
  passes check, drift, and domain coverage
- a real-app importer that extracts observed Hono route, Zod schema,
  GitHub Actions, flaker, and VRT facts from that checkout
- a real-app reconciliation oracle that compares those observed facts with the
  hand-authored model and reports missing expected gates or pattern facts
- reverse coverage for real-app observed facts, so implementation facts that
  never made it into the hand-authored model are reported as unmodeled facts
- typed app profiles that bundle model path, app root, observed-facts fixture,
  and the real-app gate sequence into one Pkl entrypoint

It is not yet enough as:

- a general source of bounded or proved business-clause assurance; only a
  Lean fragment composed from `eq`, `neq`, `not`, and `implies` currently has a
  semantic satisfaction theorem, and the self model deliberately reports zero
  `bounded` and zero `proved` targets
- a semantic checker for the full meaning of `Clause.ast`; the applicability
  matrix reports semantic support only for that Lean equality fragment
- a proof-producing source generator for application implementation proofs;
  the Lean theorem currently proves the Clause proposition under `ClauseEnv`
- a deep TLC/Alloy model-checking workflow with meaningful bounded scopes and
  counterexample interpretation beyond the current smoke checks
- structured trace valuation for TLA+/Alloy beyond generated-selector witness
  extraction
- SQL query equivalence, observed transaction isolation checking, or executable
  migration-code preservation beyond the current DB preservation declaration
  and mapping coverage / well-formedness checks
- provider-specific cloud verification over real IaC, IAM, routing tables,
  Kubernetes manifests, service meshes, or observed runtime connectivity beyond
  the current topology declaration checks
- full automatic extraction of the real-app model from source code; the current
  importer extracts a useful observed-facts subset, but the authoritative
  sample app model is still authored by hand
- translation-quality validation beyond required-label presence and glossary
  equality; human review or external localization QA is still needed for nuance
- compliance-grade data governance over real catalogs, warehouse lineage,
  consent records, deletion job evidence, retention job evidence, or production
  access logs beyond the current metadata declaration checks
- full deployment workflow model checking over real CI/CD pipelines, traffic
  routers, rollout controllers, health signal timing, rollback trigger timing,
  or migration/rollback interleavings beyond the current release-step metadata
  checks
- production-reliability verification over live monitoring APIs, synthetic
  monitoring, dependency trace sampling strategy, runbook execution freshness,
  or incident timelines beyond the current imported runtime evidence checks and
  quality/freshness summary

## What Worked

The authoring loop is usable for small, high-level claims:

1. Add or update a term/rule in Pkl.
2. Run `node src/cli.mjs check examples/dspec.pkl`.
3. Render localized review text with `node src/cli.mjs render --locale ja examples/dspec.pkl`.
4. Add a fixture or test that makes the rule load-bearing.
5. Add a `CheckTarget` pointing to the test anchor.
6. Use `dspec check --json`, `dspec drift --json`, and
   `dspec coverage --json` when another tool should consume gate results.
7. Use `dspec domain-coverage --json model.pkl` when the model owns DB, Cloud,
   Data, Release, or Runtime pattern facts and orphan facts should fail CI.
8. Run `dspec import-real-app --json app-root` to collect observed app facts,
   then `dspec reconcile-real-app --json model.pkl observed.json` to catch
   drift between the hand-authored model and implementation artifacts. Run
   `dspec reverse-coverage --json model.pkl observed.json` to catch facts that
   exist only in implementation artifacts. For repeated evaluation, encode the
   bundle as an app profile and run `dspec check-app-profile --json profile.pkl`.
   Use `dspec scaffold-app-profile model.pkl app-root` when the authoring loop
   needs a typed AppProfile draft before a profile file exists. Use
   `dspec scaffold-app-profile --diff profile.pkl --json model.pkl app-root`
   to compare the regenerated draft with an existing profile before writing
   any update. Use `dspec scaffold-app-profile --apply --dry-run profile.pkl`
   to preview the write path, then remove `--dry-run` only when that update is
   the intended source-of-truth change. Run `dspec evaluate-app-profile --json
   profile.pkl` to check one no-drift false-positive guard and injected
   false-negative guards for both implementation-missing and spec-missing
   drift. Add `profile.scenarios` when those drift mutations should be
   declared in the Pkl profile instead of relying on defaults; route, contract
   schema, workflow, data store, runtime dependency, and release gate mutations
   are supported. Use `dspec evaluate-app-profile --markdown profile.pkl` for a
   review table that keeps suggestion kind and mutation payload visible, and
   `dspec coverage-app-profile-scenarios --json profile.pkl` to fail when
   baseline, implementation-missing, or spec-missing scenario coverage is
   missing at gate or category scope. The coverage oracle counts only evaluated
   scenarios that pass. Use `profile.requiredScenarioCategories` to keep
   category coverage focused on the categories the app actually owns; leaving it
   empty uses categories inferred from the model and observed app, and explicit
   declarations must include every inferred category. Use
   `dspec score-app-profile-mutations --json profile.pkl` when the question is
   detector strength rather than declared coverage: it generates the required
   category mutations deterministically, reports the killed/missed score, and
   includes shrink candidates for the generated witness. Keep holdout profiles
   such as schema-only, workflow-only, and mixed-minimal apps in the dogfood
   suite so generator changes are checked against non-sample names and shapes.
   Add shuffled/noisy variants when the same model should preserve mutation
   witnesses under input-order changes or unrelated observed facts.
   Use `dspec replay-app-profile-changes --json corpus.pkl` for fixed
   before/after real-app-shaped changes whose expected labels are authored by a
   human. This gives the detector a non-generated regression corpus alongside
   mutation score.
   Use `dspec spec-reading-eval --prompt eval.pkl` to hand a label-hidden claim
   set to a sub-agent, then `dspec spec-reading-eval --json --score
   answers.json eval.pkl` to grade whether it correctly classified each claim
   as entailed, contradicted, or not-supported by the spec.
   This should also be used to audit the gold set itself: if the sub-agent
   gives a well-evidenced disagreement, inspect whether the case label is wrong
   before treating the model as a failure.
   Use `--prompt --locale <locale>` to render the same cases with localized
   claims and paraphrases. Store evidence digests on gold cases so spec edits
   that change the referenced term/rule/clause text produce a stale-gold
   failure. Use `dspec spec-reading-eval --json --refresh-digests eval.pkl` to
   inspect digest updates and `--refresh-digests --apply` only when the spec
   change is the intended source-of-truth update. Keep non-sample cases in a
   typed `SpecReadingEvaluationSuite` and run `dspec spec-reading-eval-suite
   --json suite.pkl` so evaluation quality does not overfit one model. For
   review issues, use `--markdown --score answers.json eval.pkl`; it records
   the answer file, label score, evidence score, overlap, and gold-fix
   candidates. Use `--write-run run.json` when the sub-agent prompt and scored
   report should be kept as a reproducible evaluation artifact. Add
   `coverage-spec-reading-eval-suite --json suite.pkl` as a coverage oracle
   over labels, evidence kinds, model kinds, tags, and paraphrase locales, and
   `metamorphic-spec-reading-eval --json eval.pkl` as an overfitting check for
   answer order, evidence order, rationale noise, negative control, and prompt
   label leakage. Keep `modelPath` and suite `evaluations` relative to their
   owning Pkl files; the CLI resolves them file-relative so a checked-out
   evaluation bundle works from another cwd.
   Passing multiple profile files checks them as one aggregate report, which is
   the intended shape for a system made of several independently modeled apps.
   When that profile list should also be typed spec data, use
   `dspec check-app-profile-suite --json suite.pkl` and
   `dspec evaluate-app-profile-suite --json suite.pkl`.
   Use `dspec check-app-profile --markdown profile.pkl` when the same result
   should be pasted into a human review issue or design log.
   When the observed-facts fixture is stale by design, run
   `dspec check-app-profile --fix --dry-run profile.pkl` to preview the
   `wouldFix` paths, then `dspec check-app-profile --fix profile.pkl` or
   `pkf run app-profile:refresh` to write the fixture.
   A failing reconciliation report with
   `suggestions[].kind == "implementation-missing"` is the spec-first case:
   the model expected something the implementation no longer exposes. A
   failing reverse coverage report with `suggestions[].kind == "spec-missing"`
   is the implementation-first case: the implementation exposes a fact that
   is not yet modeled.
9. Use `dspec impact --json before.pkl after.pkl` to route changed terms and
   rules to affected generated selectors and implementation refs.
10. Use `dspec emit markdown` for review output, `dspec emit source-map` for
   traceability, and `dspec emit quickcheck` or a formal backend emitter when
   the rule has a projection target.
11. Run `pnpm check` or `pkf run check`.

For database specs, the current loop is:

1. Seed `patterns.db.tables` from existing DDL with
   `dspec import-db-schema`, or author tables directly when no schema exists.
2. Add `patterns.db.invariants`, `patterns.db.transactions`, and optionally
   `patterns.db.migrations`.
3. Run `dspec check` to catch broken table, column, invariant, transaction,
   migration, and mapping references.
4. Run `dspec check-sql-queries` against sqlc-style query catalogs to catch
   unknown table/column references, `SELECT *`, missing tenant filters,
   missing FK joins, and tenant-scoped inserts without tenant columns.
5. Run `dspec emit quickcheck` or `verify-generated` to catch transactions or
   migrations that touch tables constrained by an invariant without listing
   that invariant in `preserves`, and migrations that preserve an invariant
   without a `DbMapping.invariants` witness.
6. Keep mapping expressions grounded by mentioning the migration source and
   target tables; the current checker treats missing table mentions as a
   drift-prone opaque expression.

For i18n-sensitive specs, the current loop is:

1. Declare supported `locales` and the stricter `i18n.requiredLocales`.
2. Add glossary entries for terms whose labels must remain semantically stable
   across locales.
3. Run `dspec check` to catch missing `LocalizedText.labels` entries and
   glossary labels that no longer match the vocabulary term labels.
4. Treat stable ids as the source of identity; localized labels remain review
   text and must not become rule or term identifiers.

For cloud topology specs, the current loop is:

1. Add `patterns.cloud.zones`, `patterns.cloud.nodes`,
   `patterns.cloud.flows`, and `patterns.cloud.policies`.
2. Run `dspec check` to catch broken zone, node, and policy references.
3. Run `dspec emit quickcheck` or `verify-generated` to catch public ingress
   that directly reaches sensitive resources, sensitive-resource flows without
   an explicit policy, tenant-scoped flows without tenant propagation, and
   queue publish flows without an idempotency key.
4. Treat the generated source map and counterexample normalizer as the review
   path back from failing backend selectors to the offending `CloudFlow`.

For data governance specs, the current loop is:

1. Add `patterns.data.policies`, `patterns.data.datasets`,
   `patterns.data.stores`, `patterns.data.placements`, and
   `patterns.data.flows`.
2. Run `dspec check` to catch duplicate policies, missing classification
   policies, broken dataset/store references, and invalid retention numbers.
3. Run `dspec emit quickcheck` or `verify-generated` to catch sensitive data
   stored without encryption, personal data stored without deletion support,
   cross-region personal data movement without legal basis, and retention
   periods exceeding classification policy.
4. Treat the generated source map and counterexample normalizer as the review
   path back from failing backend selectors to the offending `DataPlacement`,
   `DataFlow`, or `DataSet`.

For release safety specs, the current loop is:

1. Add `patterns.release.services`, `patterns.release.environments`,
   `patterns.release.gates`, `patterns.release.rollbacks`,
   `patterns.release.migrations`, and `patterns.release.steps`.
2. Run `dspec check` to catch broken service/environment/gate/rollback/
   migration references, traffic percentage range errors, and service
   mismatches between steps and rollback or migration evidence.
3. Run `dspec emit quickcheck` or `verify-generated` to catch production steps
   without health gates, production traffic shifts without rollback plans,
   rollback plans that are not tested, and production migrations that are not
   backward compatible.
4. Treat the generated source map and counterexample normalizer as the review
   path back from failing backend selectors to the offending `ReleaseStep`.

For runtime safety specs, the current loop is:

1. Add `patterns.runtime.services`, `patterns.runtime.dependencies`,
   `patterns.runtime.signals`, `patterns.runtime.runbooks`,
   `patterns.runtime.alerts`, `patterns.runtime.slos`,
   `patterns.runtime.telemetry`, `patterns.runtime.alertPolicies`,
   `patterns.runtime.runbookExecutions`, and
   `patterns.runtime.dependencyTraces`.
   For imported evidence, run `dspec import-runtime-evidence` against a
   provider-scoped JSON export and paste or pipe the generated Pkl fragment
   into the `RuntimeModel` block.
   For recorded provider payloads, run `dspec emit runtime-collector` to derive
   the expected collector manifest from the spec, fill or fetch the referenced
   provider payload files, then run `dspec collect-runtime-evidence` against
   that manifest. Run `dspec verify-runtime-evidence --json` before importing
   when the collector `expects` block should act as the coverage/drift oracle.
   Use `--pkl` when the collected output should go directly into the
   `RuntimeModel` block.
   Before real payload files exist, run `dspec emit runtime-collector-fixture`
   to smoke-test the same collector/importer/verifier path with inline
   provider-shaped payloads.
2. Run `dspec check` to catch broken service/signal/runbook/alert/SLO/
   dependency references, invalid timeout values, invalid telemetry values,
   invalid trace values, and out-of-range SLO targets.
3. Run `dspec emit quickcheck` or `verify-generated` to catch critical-service
   SLOs without page alerts, page alerts without tested runbooks,
   dependencies without positive timeouts, and retryable dependencies that are
   not marked idempotent. With evidence records present, also catch SLOs
   without telemetry, telemetry below SLO targets, page alerts without enabled
   policies, page-alert runbooks without passing execution records, and traces
   that exceed declared timeouts.
4. Treat the generated source map and counterexample normalizer as the review
   path back from failing backend selectors to the offending `RuntimeSlo`,
   `RuntimeAlert`, `RuntimeDependency`, `RuntimeTelemetryWindow`, or
   `RuntimeDependencyTrace`.

The schema also gives immediate feedback for invalid ids, invalid enum values,
missing required fields, and malformed dates or versions. That is already a
practical advantage over YAML.

## Friction

The model is still verbose. Pkl is better than YAML for type safety, but hand
authoring repeated `LocalizedText`, `Rule`, and `Clause` blocks is noisy. This
will matter once the spec has dozens of rules.

The first domain preset packs reduce repetition for RBAC and tenant-isolation
claims, but they also show the boundary: pack helpers are useful when a domain
constraint has a stable reusable shape. One-off claims still need Core `Rule`
authoring or a new reviewed pack helper.

`CheckTarget.ref` and `ImplementationRef.path/symbol` are still strings, but
`dspec drift` now verifies the first useful subset: file paths, JS/Pkl symbol
declarations, and Node test anchors.

`Clause.expr` is now a compatibility/display fallback, and `Clause.ast` carries
the first typed expression structure. The checker validates the shape of this
AST and rejects fields outside each operator's declared semantics. It does not
yet prove semantic equivalence, satisfiability, or backend soundness for
`must`, `mustNot`, `when`, and `exceptions`.

The current renderer is useful for review, but not sufficient for human spec
editing. It does not show verification links, implementation links, lifecycle
status, or rationale.

## Minimum Bar For "Spec Master"

Before treating dspec as the only source of truth for larger projects, add
these remaining gates:

1. Extend backend-aware drift validation to Rego/CUE and future adapters.
2. Move first-party specs from `examples/` to `specs/`, leaving `examples/` for
   tutorials only.
3. Extend `Clause.ast` from a preserved projection carrier into a contract
   language with explicit backend-specific semantics where needed.
4. Add non-trivial TLC transitions and scoped Alloy assertion checks once the
   emitted models carry enough domain semantics to make counterexamples useful.
5. Extend DB pattern support into SQL query equivalence, isolation-history
   checking, and executable migration-code preservation.
6. Extend Cloud topology support into IaC/IAM/routing/Kubernetes imports and
   provider-aware reachability checks.
7. Extend Data governance support into schema catalogs, warehouse lineage,
   consent/deletion/retention job evidence, and runtime access logs.
8. Extend Release safety support into real pipeline imports, progressive
   delivery controller state, health signal timing, rollback trigger ordering,
   and migration/rollback interleaving checks.
9. Extend Runtime safety support from generic HTTP payload collection into
   authenticated/scheduled vendor collectors, synthetic checks, sampling
   guarantees, and incident timelines.
10. Extend backend counterexample normalization from generated-selector
    witnesses into concrete trace values, domain wording, and review questions.

## Recommended Next Shape

Keep Pkl as the authoring language, but split the schema into three layers:

- `schema/core.pkl`: stable ids, i18n text, lifecycle, references
- `schema/claims.pkl`: rules, clauses, decisions, exceptions
- `schema/checks.pkl`: backend-specific check and implementation references

Then move the checker behind reusable report and fixture contracts. The current
Node CLI can remain the first implementation, while `mizchi/pkl-mbt` can
replace the checker later without changing the Pkl authoring surface.
`check --json`, `drift --json`, `coverage --json`, `impact --json`,
`spec-change compat --json`, `spec-change scaffold`,
`spec-change review --json`,
`verify-generated --json`, `emit source-map`, and
`normalize-counterexamples --json` are now the first artifact contracts.
`fixtures/reports/` fixes the check/drift/coverage/impact, spec compatibility,
spec change review, app change replay, backend verification, and counterexample
report shapes. `fixtures/spec-change-scaffold-*.pkl` fixes the typed
authoring draft shape. The backend fixtures use stable projections because
optional TLA+/Alloy tools differ between local and Nix environments.
The spec-change review contract now includes a breaking-change evidence gate:
breaking updates must carry migration, deprecation, rollout, and owner-approval
evidence unless the typed review explicitly narrows that policy.
Those evidence records are not just labels; repository-local Markdown refs must
resolve to concrete files and heading anchors. The scaffold command reduces the
manual translation step by deriving expected compatibility and required steps
from the before/after models, while intentionally leaving breaking evidence
empty so the review gate still forces human-supported proof. The `--output`
path closes another authoring gap: the generated draft is saved with a
destination-relative schema import and model paths, and can be fed back into
`spec-change review` from a different working directory without hand-editing
paths. When breaking evidence is missing, the review output now includes Pkl
evidence-entry snippets rather than only naming the missing evidence kinds, and
the `spec-change` command group has subcommand-local help for the review
authoring flow. `spec-change --help` documents the normal
`compat -> scaffold -> review` flow, `compat/review/scaffold --help` each return
local usage, and successful `scaffold --output` prints the exact next
`spec-change review --json` command. Dogfood uses only the grouped names so the
normal workflow stays short and unambiguous before the first release. Because
there is no released compatibility contract yet, removed long command names are
rejected as unknown commands and covered only by negative CLI tests.

## Current Decision

Use `examples/dspec.pkl` as the self-hosted ledger during prototyping. It may
be treated as the active master for the current repository's CLI/checker
contract, with one caveat: claims whose meaning depends on `Clause.expr`
or deeper `Clause.ast` semantics still need separate backend checks.
