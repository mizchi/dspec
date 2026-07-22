# Semantic Model Notes

Reference: Matthew Collinson, Timo Eckhardt, and David Pym, "Towards an
Inferentialist Account of Information Through Proof-theoretic Semantics",
arXiv:2605.05368v5.

## Product Positioning and Scope

dspec is a system specification and assurance toolkit, not a general theorem
prover. Its source of truth is a human-authored typed formal model containing
normative rules and domain facts. Localized natural-language labels are derived
review projections; they cannot add semantics missing from the formal model.
"Executable" means that the model has deterministic checks, projections,
reconciliation gates, and evidence contracts; it does not mean that arbitrary
program behavior is inferred from prose or proved correct.

The formal-first target is that every supported semantic fragment has a
machine-checkable source artifact, such as a typed AST with a declared
interpreter or a Lean theorem/proof, from which readable documents and test
oracles are deterministically derived. Pkl is currently the typed IR and
authoring syntax. Lean is semantic only for the documented
`eq`/`neq`/`not`/`implies` fragment, so the current prototype must not call its
whole Pkl surface Lean-proved. A source claim becomes proof-level only where a
specific formal artifact, backend applicability, and passing evidence establish
that scope.

An LLM can turn a natural-language change request or question into a candidate
formal-model edit or a structured query. The candidate is neither normative nor
evidence until deterministic validation, review, generated-oracle checks, and
implementation evidence accept it.

The central operational loop has three directions:

1. **Reconciliation**: declared model facts must be supported by imported
   observations where an adapter can observe them.
2. **Reverse coverage**: imported observations must be represented in the
   authored model rather than remaining unreviewed implementation facts.
3. **Domain coverage**: tracked model facts must be grounded in approved rules.

An importer or reconciliation pass establishes a relation between the model and
the facts that an adapter observed. It is not deployment or
production-reachability proof. Unknown facts remain unknown rather than being
promoted to guarantees.

Every assurance claim is scoped to its selector, backend, input domain, and
evidence time:

- structural checks establish typed and reference consistency;
- exercised and runtime evidence establish behavior for recorded inputs or
  observation windows;
- bounded checks establish only the declared finite model and bound;
- `proved` is valid only for a clause selector with a semantic backend binding
  and a passing clause-scoped artifact.

These kinds are intentionally not a total order. A passing `proved` selector is
not a proof of the whole system, and a generated TLA+/Alloy artifact is not a
semantic claim unless the model, selector, backend support, and evidence
contract say so. Algorithmic correctness and universal implementation
refinement require a separately designed formal model or proof artifact; dspec
can track its claim and evidence but has no generic proof path for it.

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
- `Projection` is a source-level ownership contract for deterministic support
  artifacts. Its `locales` matrix expands Markdown review output; its `single`
  matrix owns one QuickCheck, Lean, Alloy, TLA+, TLA config, source-map, or
  generated-manifest artifact. Its output path names the artifact and its
  freshness policy determines which filesystem states are valid. Its provenance
  artifact binds those bytes to the source model, projection contract, emitter
  version, and stable generation time.
- `CheckTarget` and `ImplementationRef` are support evidence.
- `CheckTarget.assurances` assigns explicit epistemic kinds to that support:
  `reference`, `executed`, `mutation-tested`, `bounded`, and `proved`. These
  form a set rather than a total strength order because mutation testing and
  bounded model checking answer different questions.
- support stronger than `reference` carries an `assuranceEvidence` reference;
  `Rule.requiredAssurances` declares which kinds must be present before an
  approved claim counts as covered.
- formal `bounded` and `proved` support additionally requires a verified
  `AssuranceEvidenceManifest`. The manifest binds model/source-map/artifact
  digests, tool identity, execution result, and Clause selectors.
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
- `patterns.intent` is a typed intent base for Capabilities, Outcomes,
  Processes, ConstructionAuthorities, AccessPolicies, SemanticBindings,
  ordered Scenario traces, scalar data contracts, and implementation refinement
  mappings. It closes declared construction paths without becoming an
  implementation DSL.
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
- `evidence create`, `verify`, and `refresh` manage generated backend evidence.
  Verification detects model, generated artifact, tool-version, and Clause
  binding drift without treating an old pass result as current.
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
  implementation references. It separately compares entrypoint Projection
  materializations by generated content, reports `regenerate` and `remove`
  paths, and returns the after-side generation argv plus a shell-formatted
  display command.
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
- `generate` materializes the entrypoint's top-level `projections`. A pure core
  first snapshots model plus rendered artifacts, validates ownership, and
  produces create/update/remove/unchanged actions with before/after digests.
  `generate --dry-run --json` exposes that plan without filesystem mutation.
  The filesystem adapter stages all writes, checks preconditions, commits the
  plan, and rolls back committed paths if a later operation fails. An atomic
  generation-root lock serializes writers; preconditions are checked only
  after the lock is held and the lock is released on every exit path. Lock
  metadata records PID, hostname, acquisition time, and an ownership token.
  A bounded lease adds `heartbeatAt` and `leaseMs`; staging and commit renew the
  heartbeat. `generated unlock` checks same-host process liveness, protects an
  active foreign lease, and normally removes only a dead owner or expired
  lease. Unknown active ownership requires `--force`.
- `generated check` compares declared artifact and provenance bytes with the
  filesystem without writing. `markdown x locales x exact` rejects missing,
  stale, and template-matching undeclared-locale artifacts; the `single`
  matrix applies the same ownership and provenance rules to QuickCheck, Lean,
  Alloy, TLA+, TLA config, source-map, and generated-manifest artifacts.
  An unchanged deterministic input preserves provenance `generatedAt`, avoiding
  time-only drift. `AssuranceEvidenceManifest` is intentionally separate: it
  attests to an executed tool run and is captured by `evidence`, rather than
  regenerated as static source output.
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
  `Rule`, `Clause`, `CheckTarget`, and Intent Goal/Claim/AssuranceTask paths.
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
   TLA+, Lean, and source maps. A `Projection` promotes a selected channel from
   an ad hoc command into a source-owned materialization contract.

`IntentGoal` adds a localized human-level purpose to this source base. It owns
explicit Intent process ids, `IntentClaim` ids, and localized non-goals. A
Claim is the smallest implementation-facing proposition: it has Process ids,
one or more `IntentAssuranceTask` records, and normally one or more
`IntentSemanticBinding` records. The graph is deliberately checked by stable
ids rather than by natural-language entailment. `intent graph` is the
deterministic coverage report; Markdown, QuickCheck, and source maps project
the same records.

An LLM may propose a Goal, Claim, binding, or semantic-diff review plan, but
that proposal is not evidence and does not update the source base by itself.
It becomes a candidate Pkl record which must pass graph validation, ordinary
implementation drift checks, and the declared assurance/evidence gates. This
keeps i18n text reviewable while the acceptance condition remains deterministic.

`dspec/DailyDrift.pkl` defines a typed scheduled-review manifest. Each target
declares its model and applicable core gates. An `application` target must name
an `AppProfile`, so its packet includes imported app facts, reconciliation, and
reverse coverage. Optional Intent binding and exercise inputs add declared
behavioral observations. A `runtime` target may require normalized runtime
evidence. A `tooling-self` target is allowed for the toolkit's own model, but
its report is explicitly not evidence about arbitrary external implementation
behavior.

`scripts/generate-daily-drift-packet.mjs` evaluates every manifest target
without stopping at the first failure. It preserves each JSON report and stderr
stream under a target-specific directory, renders every declared locale into a
packet-local Markdown review projection, materializes the review skill inside
the packet, and keeps a collection-failure packet even when a declared model is
unreadable. Its baseline records the approved model and Intent graph digests;
replacing it requires an explicit approver and approval id. This catches
unreviewed model weakening, while not treating a baseline match as proof of
implementation equivalence. The public command is `dspec daily-drift collect`
or `dspec daily-drift approve`; in this repository checkout the equivalent is
`node src/cli.mjs daily-drift ...`, because the `dspec/` source directory
shadows an unqualified shell command. An approval binds one passing
`SpecChangeReview` to every target and records the review/report and after-model
digests, so an approval id cannot be reused for an unrelated model.

The daily GitHub Actions workflow collects the packet with formal backend tools
and retains it as an artifact. Its Codex job has no repository checkout or
GitHub permissions, reads only the packet-local prompt and skill, and writes a
separate review artifact. Scheduled runs fail when `OPENAI_API_KEY` is absent;
manual runs may explicitly record a skip. Third-party workflow actions are
commit-pinned. The workflow makes periodic reconciliation observable; it does
not prove semantic equivalence between an Intent and arbitrary code.

`scripts/evaluate-daily-drift-review.mjs` scores the review's required
machine-readable appendix against seeded Intent/formal/implementation/i18n and
no-drift cases. It requires stable finding ids, a supported classification, and
packet evidence paths; unexpected findings fail the no-drift case. The golden
suite evaluates the review contract without claiming a live LLM's behavior has
been universally measured.

Projection ownership is intentionally scoped to paths matched by its output
template. Exact freshness does not delete arbitrary files next to generated
artifacts. Ownership lives next to `model` at the Pkl entrypoint boundary,
rather than inside `Model`: importing and amending `base.model` therefore does
not inherit the base module's materialization destinations. Planning remains a
pure projection over a snapshot; filesystem observation and transactional
application are separate adapters. This makes the same plan reusable by the
CLI, agents, and future editors without granting the semantic core write
authority.

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

Intent scenario corpus evidence makes the expected human-level cases explicit
without treating arbitrary natural-language examples as executable behavior.
`IntentScenario` names a finite structural Process/Outcome path. A required
scenario is covered only by an observed trace that names the scenario and has
the same initial state, outcome sequence, and expected state. Missing coverage
therefore produces a deterministic case skeleton, not fabricated values or an
universal behavior claim.

Intent access evidence separates authorization decision semantics from outcome
construction authority. `IntentAccessPolicy` applies an allow/deny decision to
a Process and actor/role subject. Priority is a total resolution order within a
Process/subject pair; equal priorities are rejected. An override must identify
the lower-priority policy it makes exceptional. This makes exceptions
reviewable, but does not establish identity-provider claims, runtime policy
enforcement, or complete authorization coverage.

Intent semantic bindings connect the model to normalized implementation facts
without embedding one implementation language in the source base. A binding
names an HTTP route, DB transaction, cloud resource, or OTel attribute by
stable `kind`, `target`, and optional `value`. Adapter-produced manifests are
compared in both directions: an unobserved required binding is missing
implementation evidence, while an observed undeclared binding is a candidate
spec omission. The comparison does not prove source-code equivalence,
deployment conformance, or behavior behind the named boundary.

Runtime Intent execution observations add a related but distinct evidence
channel. OTel spans can attest to the process/refinement identifiers,
idempotency-key presence, duplicate suppression flag, reported maximum
in-flight count, timeout flag, and latency. That is stronger than client-side
replay pressure alone, yet it remains trusted telemetry evidence rather than a
proof of internal synchronization or distributed storage semantics.

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

`patterns.intent` adds a bounded application-behavior channel. An
`IntentDataContract` declares scalar `string`, `integer`, `boolean`, or
`identifier` fields with requiredness, allowed values, integer bounds, and
patterns. Its `clauses` carry cross-field and quantified conditions as existing
`Clause.ast` obligations; the trace verifier does not claim to execute those
symbolic predicates. `IntentRefinement` maps canonical input/output field IDs
to implementation-facing handler, route, transaction, queue-topic, or worker
fields and names the linked implementation reference. An `IntentOutcome` may
also declare typed `IntentEffect` postconditions. Their stable effect ids name
the capability used, their payload contracts are mapped by an outcome-specific
effect binding, and a trace step records them in `effects`. `drift` resolves
that reference. `intent schema` emits the model-specific trace document shape, and
`intent verify` checks supplied finite JSON traces for state continuity,
construction authority, refinement ownership, field bindings, and scalar
values. `intent exercise` first runs that verification, then invokes each
`function` refinement whose `ImplementationRef` is `code` or `test` with the
raw implementation-facing input from a passing trace. Its JSON return value
must exactly match the trace output. An `http-route` refinement instead declares
an `IntentHttpEndpoint` with method, path, and expected status; the runner
receives an environment-specific `--http-base-url`, sends the raw input as a
JSON body, and compares the JSON response. The exercise report adds an
`intent-executed-refinement` evidence check. A `transaction` refinement names
a `patterns.db.transactions` declaration through `IntentTransactionEndpoint`.
Its Node child receives a finite journal API (`read`, `write`, `effect`, and
`commit`), rejects undeclared operations, and returns the committed journal for
comparison with trace effects. This exercises the implementation's declared
transaction interaction; it does not establish isolation of a deployed DB
driver. Queue-topic and worker refinements remain rejected until they have
boundary-specific adapters and observation contracts. Each function case executes in a fresh Node child
process under the Node permission system with filesystem writes, child
processes, and workers denied. The report records the timeout, Node version,
implementation digest, and the explicit limitation that this permission system
does not provide network isolation. `evidence create --intent-report` promotes
a passing report into an assurance manifest; `evidence verify` rechecks the
model, report, trace, and implementation digests. The report separates
static-contract, reference, observed-trace, and executed-refinement checks,
includes model/trace digests, and lists assumptions. This detects data and
implementation drift in supplied finite cases, but is not a universal
refinement proof.

`intent exercise --policy` is a separate, explicit test/staging opt-in for a
declared `Process.execution` policy. It selects one already verified trace step
per policy, replays that input `maxInFlight + 1` times with the same mapped
idempotency-key value, and schedules no more than `maxInFlight` client
invocations at once. The report records that client-side pressure, returned
output/effect consistency, the mapped key, and the declared deadlines. It does
not observe the implementation's internal queue, distributed idempotency
store, database isolation, or deployment capacity. The optional `timeoutMs`
deadline is enforced by the function, transaction, and HTTP adapters; the
separate `timeoutSteps` value remains only an abstract scheduler counter.
Passing policy observations are copied into `evidence create --intent-report`
and rechecked against the current model by `evidence verify`.

`intent coverage` is the finite coverage oracle for the same trace document.
It reports declared transitions, refinement/outcome pairs, mapped input/output
fields, effects, and effect payload fields individually, and fails when any is
unobserved. `intent mutation` requires a passing baseline trace, then produces
deterministic nearby negative cases: removing a required input/output/effect,
substituting an outcome, adding an unexpected effect, or assigning a
wrong-typed required effect payload. Its score is the fraction rejected by the
trace verifier, with a stable local shrink descriptor for each generated case.
Neither command establishes coverage of unrecorded input domains or arbitrary
production implementations.

`Process.execution` adds a separate finite concurrency/time model. Its
`maxInFlight` limits abstract concurrent executions, `idempotencyKey` must
refer to a required `identifier` or `string` input field, and `timeoutSteps`
is a discrete scheduler counter rather than milliseconds. Optional `timeoutMs`
is a runtime adapter deadline and is deliberately absent from that abstract
scheduler. TLA+ projects the declared processes into an abstract state machine
with start, complete, tick, and expire actions over a finite key space. TLC checks
`IntentConcurrencyBounded`, `IntentIdempotencyKeysAreExclusive`, and
`IntentTimeoutsBounded`. These establish safety only for that generated finite
model. They do not establish a real worker queue's delivery behavior, actual
database isolation, clock behavior, retry policy, or service capacity.
`spec-change compat` treats adding or tightening the policy as narrowing,
removing or relaxing it as widening, and mixed changes or a replacement key as
unknown.

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
`evaluate-external-holdouts` is the importer-facing equivalent. Its typed
`ExternalRealAppImportCorpus` keeps the reviewed, authored gold facts separate
from facts observed from each reduced external checkout. Every holdout records
repository/revision provenance, an explicitly retrospective authoring-time
estimate, zero or more manual mappings, and exclusions for facts a static
adapter must not claim. The same corpus can replay an actual source change as
a before/after fact delta. This measures the importer itself: precision and
recall describe the holdouts, while mutation detection describes whether a
recorded source change remains visible. Neither metric turns a declaration
into evidence of deployment, reachability, or policy satisfaction.
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

Backend applicability is a separate contract from AST well-formedness. Each
operator/backend pair is classified as:

- `unmapped`: the backend does not carry the Clause AST.
- `textual`: only a rendered expression string reaches the backend.
- `structural`: the typed node shape reaches the backend, but no satisfaction
  relation is checked.
- `semantic`: the generated property checks the source Clause meaning.

The current matrix classifies Alloy as `unmapped`, TLA+ as `textual`, and
QuickCheck as `structural`. Lean is `semantic` for expression trees composed
only from `eq`, `neq`, `not`, and `implies`, and remains `structural` when an
`atom`, `and`, `or`, or quantifier occurs. Lean resolves equality operands
through `ClauseEnv = String -> Option String`, recursively interprets negation
and implication as propositions, emits a theorem for selected `must`/`mustNot`
Clauses, and records the theorem as a clause-scoped artifact. All other backend
smoke success remains generator-scoped and cannot satisfy `bounded` or
`proved`.

Semantic support means that the generated theorem checks the Clause AST
proposition under the declared interpretation. It does not mean application
code implements that proposition. An implementation proof still needs a
separate refinement or conformance relation.

`conformance` supplies the first executable relation at that boundary. A Pkl
`ConformanceTarget` selects one typed Clause, a JavaScript adapter export, and
a finite catalog of inputs. Each input declares substitutions, atom valuations,
and an optional reviewed shrink link. The checker evaluates the Clause AST as
the reference relation, runs the adapter over the same input, and records a
deterministic failing witness when they differ. This is executed conformance
evidence for an explicit finite domain, not a Lean proof of arbitrary program
behavior.

`query` is deliberately below an AI answer layer. It resolves rule, term,
evidence, impact, and clause requests by stable IDs, emits localized results
and model evidence, and classifies an explicit prohibition as `contradicted`.
An agent may map a human question to that request shape, but its proposed
classification and evidence are accepted only after `--answer` matches the
deterministic query report.

The likely next evolution is one of these:

- add semantic `and`/`or` once list-valued proposition recursion is modeled and
  mutation-tested
- connect a Clause interpretation to implementation inputs and outputs
- expand the shared typed expression AST across the other backends
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
  Intent generation adds `IntentProcessConstructionIsAuthorized` to Alloy and
  TLA+ and `IntentScenarioTraceIsContinuous` to TLA+. An optional
  `Process.execution` additionally generates the finite
  `IntentConcurrencyBounded`, `IntentIdempotencyKeysAreExclusive`, and
  `IntentTimeoutsBounded` scheduler invariants. QuickCheck generates and
  deterministically shrinks Process and Scenario ids and checks that declared
  refinements bind every required input/output field. These checks establish
  only the declared finite model, while Process/refinement references are
  checked separately by drift detection and observed values are checked by
  `intent verify`.
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
