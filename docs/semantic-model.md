# Semantic Model Notes

Reference: Matthew Collinson, Timo Eckhardt, and David Pym, "Towards an
Inferentialist Account of Information Through Proof-theoretic Semantics",
arXiv:2605.05368v5.

## Working Interpretation

dspec should not treat a spec rule as a bare truth-valued sentence. A rule is
better treated as an inferon-like claim whose meaning is given by the bases that
support it.

For the current prototype:

- `Rule` is the claim unit.
- `when`, `must`, and `mustNot` are pre-logical atoms or clauses in the local
  base.
- domain preset packs are authoring channels that expand repeated domain
  claims into the same `Term`, `Rule`, and `Clause.ast` units.
- `i18n.requiredLocales` and `i18n.glossary` are support obligations for the
  human-language surface of stable vocabulary ids.
- `CheckTarget` and `ImplementationRef` are support evidence.
- `CheckTarget.assurances` assigns explicit epistemic kinds to that support:
  `reference`, `executed`, `mutation-tested`, `bounded`, and `proved`. These
  form a set rather than a total strength order because mutation testing and
  bounded model checking answer different questions.
- support stronger than `reference` carries an `assuranceEvidence` reference;
  `Rule.requiredAssurances` declares which kinds must be present before an
  approved claim counts as covered.
- `CheckTarget.covers` can refine support from rule-level to clause-level
  selectors such as `must[0]`.
- `patterns.db` is a typed domain base for tables, invariants, transactions,
  and migrations.
- `patterns.cloud` is a typed domain base for network zones, cloud nodes,
  communication flows, and explicit access policies.
- `patterns.data` is a typed domain base for data policies, datasets, stores,
  placements, and store-to-store data flows.
- `patterns.release` is a typed domain base for services, environments, gates,
  rollbacks, migrations, and release steps.
- `patterns.runtime` is a typed domain base for services, dependencies,
  signals, runbooks, alerts, SLOs, and imported runtime evidence records.
- `drift` checks that declared support still resolves to concrete artifacts.
- backend-aware drift checks parse common support surfaces directly: Node and
  Playwright test anchors, Lean declarations, TLA+ definitions/theorems, Alloy
  sig/assert/pred/check names, Pkl targets, and runtime collector sources.
- `coverage` checks that approved claims have automated support, and checks
  full clause support for rules that opt into `coverage = "clause"`. It also
  rejects rules whose automated targets do not supply every required assurance
  kind.
- generated QuickCheck data preserves `requiredAssurances`, target assurances,
  and evidence references, then rechecks required assurance coverage as an
  executable property.
- `domain-coverage` checks that typed domain-base elements are mentioned by
  approved claims through stable ids, so orphan model facts do not silently
  become source-of-truth data.
- `import-real-app` creates observed app facts from implementation artifacts
  such as routes, contracts, workflows, and quality-tool config.
- `reconcile-real-app` checks whether the authored domain base is supported by
  those observed app facts.
- `check --json`, `drift --json`, `coverage --json`, and
  `domain-coverage --json` turn those gate results into stable support
  artifacts for CI and external agents.
- `impact --json` projects source-model diffs through source maps so changed
  terms and rules can be routed to affected generated selectors and
  implementation references.
- `spec-change compat --json` classifies the same before/after model pair as
  compatible, breaking, narrowing, widening, or unknown, with a decision record
  for each changed term, rule, or domain element.
- `spec-change scaffold` turns that before/after pair into a typed
  `SpecChangeReview` Pkl draft, so the compatibility decision, required review
  steps, and breaking-change evidence policy become an editable source artifact
  instead of a hand-copied report. With `--output`, the scaffold is written as
  a Pkl file whose schema import and model paths are resolved relative to the
  destination, so the saved draft can be passed directly to `spec-change review`
  independent of the caller's working directory.
- The pre-release CLI intentionally exposes only the grouped
  `spec-change compat|scaffold|review` commands. Removed long command names are
  rejected as unknown commands, so the semantic model treats them as negative
  regression guards rather than compatibility aliases.
- `emit` commands are deterministic projections from the source model into
  review or verification sites.
- `verify-generated` checks that selected generated support artifacts are
  executable, compilable, syntactically well-shaped, or accepted by installed
  backend tools.
- `verify-generated --json` turns those support-site results into a stable
  machine-readable artifact.
- `fixtures/reports/` locks those machine-readable artifacts as compatibility
  fixtures, using a stable projection for optional verification backends whose
  availability depends on the environment.
- `fixtures/spec-change-scaffold-*.pkl` locks deterministic authoring
  scaffolds in the same spirit, but for typed source drafts rather than JSON
  reports.
- `emit source-map` records how generated selectors correspond to source
  `Rule`, `Clause`, and `CheckTarget` paths.
- `emit generated-manifest` records deterministic hashes for the primary
  generated support channels.
- `normalize-counterexamples` uses the source map to translate backend
  failures back into `Rule.id`, source paths, and reviewable messages.
- when TLA+/Alloy failures expose generated selectors, the normalizer treats
  those selectors as witnesses and returns the concrete source record behind
  the generated artifact.

This gives dspec three layers:

1. **Source base**: the Pkl model.
2. **Support sites**: tests, implementation symbols, proof files, generated
   backend models.
3. **Channels**: deterministic emitters such as Markdown, QuickCheck, Alloy,
   TLA+, Lean, and source maps.

Domain preset packs sit at the authoring boundary of the source base. They are
not independent truth systems: `dspec/domains/Rbac.pkl` and
`dspec/domains/Tenant.pkl` only provide reusable constructors for common terms
and rules, and those constructors emit ordinary Core IR. This keeps local
domain DSLs useful for writing while preserving one validation, drift,
coverage, source-map, and backend-projection path.

The domain pack registry makes that boundary explicit: each helper declares
whether it returns a term or a rule, and rule helpers must declare typed AST
predicates. Drift then checks that the registered helper symbols still exist in
the pack implementation file.

The i18n contract adds a small semantic-drift layer for human-readable labels.
It does not prove translation quality. It checks that every `LocalizedText`
has labels for required locales and that glossary entries match the labels on
stable vocabulary terms. That keeps ids language-independent while making
localized wording a reviewable support obligation instead of untracked prose.

The DB pattern adds a fourth, domain-specific layer inside the source base:
`DbTable` describes relational structure, `DbInvariant` names the predicates
that must survive operations, `DbTransaction` declares which invariants it
preserves when it writes tables, and `DbMigration` declares which invariants it
preserves while mapping source tables to target tables. `DbMapping` attaches
source/target mapping expressions to the invariants they witness, and those
expressions must at least mention the migration source and target tables. This
is intentionally weaker than proving SQL, migration code, or database
isolation, but it is strong enough to make missing preservation claims, missing
mapping witnesses, and ungrounded mapping expressions executable and
reviewable.

`import-db-schema` is the first bridge from implementation artifacts back into
this source base. It does not claim SQL-level proof: it deterministically
extracts `CREATE TABLE` structure into `DbTable` and `DbColumn` facts so humans
can start from observed schema, then add the behavioral invariants,
transactions, migrations, and preservation witnesses that the schema alone
cannot declare.

`check-sql-queries` is the matching lightweight oracle for query catalogs. It
does not prove SQL equivalence or cost: it checks that query table and column
references still exist in `patterns.db`, that tenant-scoped tables are filtered
or inserted with their tenant column, that `SELECT *` does not hide result
shape drift, and that joins across modeled foreign references mention the FK
column and target key.

The Cloud pattern adds another domain-specific layer inside the source base:
`CloudZone` declares public/private/restricted exposure, `CloudNode` declares
resource kind and tenant scope, `CloudFlow` declares source, target, action,
tenant propagation, and idempotency evidence, and `CloudPolicy` declares
allowed principal/resource/action triples. The generated checks are again
deliberately conservative: they do not prove a real AWS/GCP/Azure deployment is
secure, but they make missing boundary isolation, missing sensitive-resource
policies, missing tenant propagation, and non-idempotent queue publication
executable and reviewable.

The Data pattern adds a governance layer that is intentionally separate from
topology: `DataPolicy` declares classification-level retention limits,
`DataSet` declares classification, residency, and retention intent,
`DataStore` declares region, encryption, and deletion support,
`DataPlacement` declares where a dataset is stored, and `DataFlow` declares
store-to-store movement with purpose and optional legal basis. The generated
checks do not prove regulatory compliance, but they make missing encryption,
missing deletion support, missing cross-region transfer basis, and retention
limit drift executable and reviewable.

The Release pattern adds a deployment-safety layer. `ReleaseService` and
`ReleaseEnvironment` define deployment targets, `ReleaseGate` captures
test/approval/health evidence, `ReleaseRollback` declares rollback readiness,
`ReleaseMigration` declares backward compatibility, and `ReleaseStep` combines
strategy, traffic percentage, gates, rollback, and migration evidence. The
generated checks are intentionally finite safety invariants: production steps
need health gates, production traffic shifts need rollback plans, rollback
plans must be tested, and production migrations must be backward compatible.
This is the first pattern that points naturally toward richer temporal models,
but the current projection keeps the backend check reviewable and deterministic.

The Runtime pattern adds an operations-safety layer. `RuntimeService` declares
criticality, `RuntimeDependency` records target/kind/timeout/retry/idempotency
intent, `RuntimeSignal` names the observed indicator, `RuntimeRunbook` records
tested response evidence, `RuntimeAlert` connects a signal to severity and
response, and `RuntimeSlo` declares the service-level target. The generated
checks are finite invariants over operational metadata: critical-service SLOs
need page alerts, page alerts need tested runbooks, dependencies need positive
timeouts, and retryable dependencies must be marked idempotent. They do not
prove production reliability, but they make missing operational contracts
executable and reviewable before real telemetry is imported.

Runtime evidence records are the first bridge from declared operations intent
to observed support. `RuntimeTelemetryWindow` imports an observed signal window
and optional SLO binding, `RuntimeAlertPolicy` imports whether a declared alert
has an enabled policy, `RuntimeRunbookExecution` imports drill or incident
execution results, and `RuntimeDependencyTrace` imports latency/timeout
observations for a dependency. The generated checks compare imported evidence
against the declared model: SLOs need telemetry, telemetry must meet the SLO
target, page alerts need enabled policies and passing runbook executions, and
dependency traces must stay within declared timeouts. This is still
metadata-level evidence, not a proof that production was reliable.

`import-runtime-evidence` is a normalization channel into that source base. It
does not assign truth to vendor APIs directly; it accepts provider-scoped JSON
exports for Prometheus-like telemetry, PagerDuty-like alert policies,
incident/runbook execution records, and OpenTelemetry-like dependency traces,
then emits deterministic `RuntimeModel` evidence records. The formal checks run
after this normalization boundary.

`collect-runtime-evidence` is the preceding collection channel. It reads a
manifest of provider payload sources from files, inline fixtures, or live HTTP
URLs, adapts Prometheus vector results, PagerDuty-style alert policy exports,
incident/runbook execution exports, and OpenTelemetry spans into the
provider-scoped JSON accepted by the importer. This keeps vendor payload
parsing outside the formal projection while still
making the collection step deterministic and testable.

`emit runtime-collector` is the preceding specification-to-observation
channel. It derives the collector manifest from declared Runtime safety records:
SLOs become Prometheus telemetry requests, page alerts become PagerDuty policy
requests, linked runbooks become incident execution requests, and dependencies
become OpenTelemetry trace requests. Each generated request carries a
`sourceMap` entry back to the source spec record, so missing or stale runtime
evidence can be reviewed as a spec-level drift question.

`verify-runtime-evidence` is the expectation oracle for that generated
manifest. It treats `source.expects` as the declared observation contract,
collects and normalizes the referenced payloads, then reports where observed
evidence fails the contract: missing records, SLO percentages below target,
disabled alert policies, failed runbook executions, timeout traces, or missing
idempotency-key observations. This keeps runtime drift detection deterministic
without treating raw vendor payloads as formal semantics.

`emit runtime-collector-fixture` is the scaffold path for this oracle. It emits
the generated collector manifest with provider-shaped inline payloads that
satisfy the `expects` blocks. This does not prove production behavior; it
checks that the declared observation contract, provider adapters, importer, and
verifier compose before replacing the inline payloads with recorded or live
provider data.

`domain-coverage` is the source-base orphan detector. It enumerates selected
DB, Cloud, Data, Release, and Runtime pattern elements, derives candidate
stable ids such as `node.api`, `flow.dashboard-to-api`,
`service.dashboard`, or `dependency.dashboard-to-api`, and checks whether an
approved rule uses those ids in terms or reviewable rule text. This does not
prove the domain fact is correct. It proves a weaker but useful property: if a
fact is present in the spec master, there is at least one approved claim that
names it as part of its support base.

`import-real-app` is the first implementation-to-domain adapter for this
source base. It extracts a deliberately small observed-facts document from a
web application checkout: Hono API routes, exported Zod schemas, GitHub
Actions jobs/steps/gates, flaker profiles, and VRT routes. The importer can
also emit a Pkl fragment that seeds Cloud/Data/Release/Runtime patterns, but
that fragment is not automatically authoritative.

`reconcile-real-app` compares the authored model with the observed-facts
document. It is stricter than drift's file/symbol existence check but weaker
than a proof: it verifies that expected domain facts, release gates, and
runtime dependencies have corresponding implementation artifacts. A missing
gate such as `ci -> vrt` becomes a machine-readable drift report and a domain
question, not an automatic rewrite of the source model.

`reverse-coverage` checks the opposite direction. It derives the same
Cloud/Data/Release/Runtime observed elements from the implementation facts and
requires each observed element to exist in the authored model. This catches the
case where implementation added a route-adjacent workflow gate, data flow, or
runtime dependency but the spec master never absorbed it.

`check-app-profile` packages the real-app adapter loop into a typed Pkl
profile. The profile records `modelPath`, `appRoot`, `observedFacts`, and the
gate list, then runs model check, drift, domain coverage, importer fixture
freshness, reconciliation, and reverse coverage as one reviewable report. A
single profile preserves the per-app report shape; multiple profile files are
returned as an aggregate report with one nested report per profile. The same
report can be rendered as Markdown for human review without changing the JSON
contract used by gates. When the profile list is itself spec-master data,
`check-app-profile-suite` reads a typed `AppProfileSuite` registry rather than
requiring the caller to repeat profile paths at the shell.
`scaffold-app-profile` is the authoring path for AI or human agents that need a
typed Pkl draft before the profile exists. `scaffold-app-profile --diff
--json` compares that regenerated draft with an existing profile and reports
profile drift without writing. `scaffold-app-profile --apply --dry-run`
previews the write path, and `--apply` writes the regenerated profile with a
schema import path relative to the target file. `evaluate-app-profile` is the
calibration path: it checks that the clean profile does not fail spuriously,
then injects implementation-missing and spec-missing drift to ensure the
detectors do not silently pass known-bad cases. `profile.scenarios` can declare
those mutations explicitly for routes, contract schemas, workflows, data
stores, runtime dependencies, and release gates. `evaluate-app-profile
--markdown` renders the scenario table for human review with suggestion kind and
mutation payloads, and
`coverage-app-profile-scenarios` checks that the profile has baseline,
implementation-missing, and spec-missing coverage at gate and category scope.
It counts only evaluated scenarios that pass, not inert declarations.
`profile.requiredScenarioCategories` narrows category-scope requirements for
small apps, while the empty default uses categories inferred from the model and
observed app. Explicit declarations must include every inferred category, so a
profile cannot hide a domain surface to make coverage pass.
`score-app-profile-mutations` is the generated counterpart: it creates
implementation-missing and spec-missing mutations for each required category,
evaluates whether the existing detectors kill those mutations, and reports the
score with shrink candidates for the generated witness. This keeps scenario
coverage from overfitting to only hand-authored examples. Holdout profiles add
schema-only, workflow-only, and mixed route/schema/workflow shapes whose names
do not appear in the sample app, so category inference and mutation generation
must stay model-shaped rather than fixture-shaped. Shuffled and noisy holdouts
assert a metamorphic relation: the selected generated witnesses are stable when
observed facts are reordered or unrelated facts are added.
`replay-app-profile-changes` is the non-generated counterpart: a typed
`AppProfileChangeReplayCorpus` stores fixed before/after app roots with
expected `no-drift`, `implementation-missing`, `spec-missing`, or `mixed`
labels. This catches detector regressions on real-app-shaped changes that were
not synthesized by the mutation engine.
`evaluate-app-profile-suite`
aggregates the same calibration over a profile registry.
When the importer output intentionally changed, `check-app-profile --fix`
updates the `observedFacts` fixture in place; this keeps CI non-mutating while
making the local refresh loop explicit. `check-app-profile --fix --dry-run`
returns the same stale fixture as `wouldFix` without writing, so a reviewer can
separate "this is the refresh I expect" from the actual mutation.

Real-app failures also carry structured suggestions. Reconciliation failures
use `implementation-missing` when the model expects a fact that the observed
implementation does not expose. Reverse coverage failures use `spec-missing`
when the implementation exposes a fact that is absent from the model. These
suggestions are not proofs; they are deterministic review branches that tell a
human whether to update implementation, update the spec, or reject the change.

Counterexample normalization is the reverse path from support sites back to the
source base. It does not prove that the backend model is semantically complete;
it makes backend failures actionable by naming the spec record that needs a
human decision or a regression guard.

## Why Inferential Semantics

The paper argues for replacing truth with inferability in an account of
information. That maps well to dspec: the question is not "is this sentence
true?" in isolation, but "what supports this claim, and can that support still
be derived or checked?"

This is also a better fit for AI-authored specifications. Natural-language
claims are unstable as final truth values, but they can be normalized into
claim atoms and support obligations. The machine can then check whether support
is present, resolvable, and consistent.

## Consequences For DSpec

`Clause.ast` is now the first small typed expression AST. `Clause.expr` remains
as a compatibility and display fallback, but generators should prefer `ast`
when it is present.

The current AST fixes these operator-level meanings:

- `atom`: an uninterpreted predicate name with string arguments.
- `eq` / `neq`: symbolic equality or inequality over exactly two string
  arguments.
- `not`, `and`, `or`, `implies`: boolean composition over child expressions.
- `exists` / `forall`: a bound variable name scoped over one child expression.

`dspec check` enforces the field shape for each operator. For example, an
`atom` accepts `name` and `args` but not `children`, while `and` accepts
`children` but not `name` or `args`.

The likely next evolution is one of these:

- expand the shared typed expression AST across all backends
- add backend-specific expression dialects with explicit projection rules
- use a hybrid: common boolean/relation/core terms plus backend escapes

Each backend projection must be deterministic and should declare what it
preserves:

- Markdown preserves reviewable claim text, ids, lifecycle, and links.
- QuickCheck preserves finite generators, shrink order, and executable
  properties. The generated JS is run by `verify-generated`.
- Alloy preserves relational shape and bounded counterexample search. The
  generated model distinguishes active approved rules, deprecated rules,
  automated support, and manual/runtime support. The analyzer gate checks that
  active approved rules have automated support within the generated scope.
- TLA+ preserves state/set invariants and temporal transition structure. The
  generated model now includes a minimal rule workflow transition:
  approved-with-support can become verified, approved-without-support can
  become uncovered, and uncovered is an invariant violation. DB transactions
  and migrations also generate finite `DbInvariantPreserved`,
  `DbMigrationPreserved`, `DbMigrationMappingCovered`, and
  `DbMigrationMappingRefsMentionTables` invariants. Cloud topology generates
  finite `CloudPublicIngressBlocked`, `CloudResourceAccessHasPolicy`,
  `CloudTenantFlowsPropagateTenant`, and
  `CloudQueuePublishesHaveIdempotencyKey` invariants. Data governance
  generates finite `DataSensitivePlacementsEncrypted`,
  `DataPersonalPlacementsSupportDeletion`,
  `DataCrossRegionFlowsHaveLegalBasis`, and `DataRetentionWithinPolicy`
  invariants. Release safety generates finite
  `ReleaseProductionStepsHaveHealthGate`,
  `ReleaseTrafficShiftsHaveRollback`, `ReleaseRollbackPlansAreTested`, and
  `ReleaseMigrationsAreBackwardCompatible` invariants. Runtime safety
  generates finite `RuntimeCriticalSlosHavePageAlert`,
  `RuntimePageAlertsHaveTestedRunbook`, `RuntimeDependenciesHaveTimeout`, and
  `RuntimeRetriesAreIdempotent` invariants. Runtime evidence generates finite
  `RuntimeSlosHaveTelemetry`, `RuntimeTelemetryMeetsSlo`,
  `RuntimePageAlertsHaveEnabledPolicy`,
  `RuntimePageAlertsHaveExecutedRunbook`, and
  `RuntimeDependencyTracesWithinTimeout` invariants.
- Lean preserves theorem statements and proof obligations. The generated Lean
  file defines finite `AutomatedSupport` / `CoverageInvariant` semantics and
  proves them with decidable finite cases.
- Source maps preserve traceability from generated review/backend selectors
  back to `Rule`, `Clause`, and `CheckTarget` source paths.
- Counterexample reports preserve failure evidence and attach it to the source
  rule that generated the failing backend selector.
- Check/drift/coverage JSON reports preserve pass/fail status, model identity,
  counts, and stable error arrays for tools that consume the specification
  ledger.
- Impact reports preserve changed term/rule ids, affected rules, generated
  selectors, and implementation refs so a spec change can become a focused
  review queue.
- Compatibility reports preserve the semantic change class that can gate
  whether a spec update is safe to merge without implementation changes.
- Spec change review reports bundle before/after checks, impact routing,
  compatibility gating, breaking-change evidence policy, and after-side
  coverage into one reviewable procedure artifact. Local Markdown evidence
  refs are support sites too, so the review checks that their files and heading
  anchors resolve.
- Compatibility classifies an added assurance requirement on an approved rule
  as `narrowing`, a removed requirement as `widening`, and simultaneous
  replacement as `unknown`.
- Report fixtures preserve the JSON shape of check/drift/coverage/impact and
  compatibility/spec-change-review outputs so another checker implementation
  can be validated against the same support artifact contract.

## Open Design Questions

- Which additional expression nodes are needed before the minimal `Clause.ast`
  becomes a useful contract language rather than only a projection carrier?
- How should `patterns.db` grow from preservation declarations, grounded
  mapping witnesses, and opaque expression references into SQL query
  equivalence, transaction isolation histories, and executable migration-code
  preservation?
- How should `patterns.cloud` grow from topology declarations into concrete
  IaC, IAM, routing-table, Kubernetes, and runtime-observed connectivity
  checks without becoming provider-specific too early?
- How should `patterns.data` import real schema catalogs, warehouse lineage,
  retention jobs, consent records, and deletion workflows without pretending
  that finite metadata alone proves compliance?
- How should `patterns.release` evolve from finite release-step invariants into
  temporal deployment workflows with staged traffic, health feedback,
  rollback-trigger ordering, and migration/rollback interleavings?
- How should `patterns.runtime` move from imported telemetry, alert policies,
  runbook execution evidence, and dependency traces into synthetic monitoring
  and incident timelines without confusing metadata presence with production
  reliability?
- Should `Rule.kind` determine default projection behavior, or should each rule
  declare an explicit projection strategy?
- How should exceptions and priorities interact with support?
- What is the proof object for a `drift` or `coverage` result, and should it be
  stored beside the JSON verification report?
- How much backend-specific trace parsing is needed before normalized
  counterexamples can explain Alloy/TLA+ witnesses beyond generated-selector
  support?
