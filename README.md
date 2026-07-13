# dspec

Typed Pkl prototype for a human-level executable specification language.

The first prototype treats Pkl as the source of truth:

- stable ids and typed schema live in `dspec/Schema.pkl`
- authored models live in `examples/*.pkl`
- natural-language rendering is generated from localized labels
- cross-model consistency checks run in `src/cli.mjs`

This is intentionally not YAML. The authoring surface is Pkl so schema
errors are caught before the model reaches the implementation checker.

## Try

With Nix:

```sh
nix develop path:$PWD
pnpm test
node src/cli.mjs devshell-smoke --json
node src/cli.mjs verify-generated examples/dspec.pkl
node src/cli.mjs verify-generated --json examples/dspec.pkl
node src/cli.mjs verify-generated --json --require-formal-tools fixtures/typed-ast.pkl
```

The dev shell provides Node.js 24, pnpm, Pkl, Lean via elan, Z3, TLA+, and Alloy 6.
When `tlasany`, `tlc`, and `alloy6` are on `PATH`, `verify-generated` promotes
the generated TLA+/Alloy gates from built-in syntax-shape checks to tool-backed
SANY, TLC, and Alloy analyzer checks.
`devshell-smoke --json --strict --require-store-path` checks that required
tools come from the devShell rather than the host. `pkf run devshell:tools`,
`pkf run devshell:formal`, and `pkf run devshell:check` mirror the CI gates.

Spec-change happy path:

```sh
node src/cli.mjs spec-change compat --json before.pkl after.pkl
node src/cli.mjs spec-change scaffold --output review.pkl before.pkl after.pkl
node src/cli.mjs spec-change review --json review.pkl
```

```sh
pnpm test
node src/cli.mjs check examples/rbac.pkl
node src/cli.mjs check fixtures/domain-pack-model.pkl
node src/cli.mjs check fixtures/db-model.pkl
node src/cli.mjs check fixtures/cloud-model.pkl
node src/cli.mjs check fixtures/data-model.pkl
node src/cli.mjs check fixtures/release-model.pkl
node src/cli.mjs check fixtures/runtime-model.pkl
node src/cli.mjs render --locale ja examples/rbac.pkl
node src/cli.mjs check examples/dspec.pkl
node src/cli.mjs check --json examples/dspec.pkl
node src/cli.mjs drift examples/dspec.pkl
node src/cli.mjs drift --json examples/dspec.pkl
node src/cli.mjs coverage examples/dspec.pkl
node src/cli.mjs coverage --json examples/dspec.pkl
node src/cli.mjs domain-coverage examples/sample-webapp-2026.pkl
node src/cli.mjs domain-coverage --json fixtures/domain-coverage-orphan.pkl
node src/cli.mjs import-real-app --json fixtures/sample-webapp-2026
node src/cli.mjs import-real-app --pkl fixtures/sample-webapp-2026
node src/cli.mjs evaluate-real-app-import --json fixtures/import-real-app-eval-mnemo.pkl
node src/cli.mjs evaluate-real-app-import --json fixtures/import-real-app-eval-iac.pkl
node src/cli.mjs reconcile-real-app --json examples/sample-webapp-2026.pkl fixtures/reports/import-real-app-sample-webapp.json
node src/cli.mjs reverse-coverage --json examples/sample-webapp-2026.pkl fixtures/reports/import-real-app-sample-webapp.json
node src/cli.mjs scaffold-app-profile --observed-facts fixtures/reports/import-real-app-sample-webapp.json examples/sample-webapp-2026.pkl fixtures/sample-webapp-2026
node src/cli.mjs scaffold-app-profile --diff fixtures/sample-webapp-profile.pkl --json --observed-facts fixtures/reports/import-real-app-sample-webapp.json examples/sample-webapp-2026.pkl fixtures/sample-webapp-2026
node src/cli.mjs scaffold-app-profile --apply fixtures/sample-webapp-profile.pkl --json --dry-run --observed-facts fixtures/reports/import-real-app-sample-webapp.json examples/sample-webapp-2026.pkl fixtures/sample-webapp-2026
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
node src/cli.mjs spec-reading-eval --json --runner fixtures/spec-reading-agent-runner.pkl --write-run /tmp/dspec-spec-reading-agent-run.json fixtures/spec-reading-eval-sample-webapp.pkl
node src/cli.mjs spec-reading-eval --markdown --score fixtures/spec-reading-eval-answers.json fixtures/spec-reading-eval-sample-webapp.pkl
node src/cli.mjs spec-change compat --json fixtures/compat-before.pkl fixtures/compat-narrowing-after.pkl
node src/cli.mjs spec-change scaffold fixtures/compat-before.pkl fixtures/compat-narrowing-after.pkl
node src/cli.mjs spec-change scaffold --json fixtures/compat-before.pkl fixtures/compat-breaking-after.pkl
node src/cli.mjs spec-change scaffold --output /tmp/dspec-spec-change-review.pkl fixtures/compat-before.pkl fixtures/compat-narrowing-after.pkl
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
node src/cli.mjs emit markdown --locale ja examples/dspec.pkl
node src/cli.mjs emit quickcheck examples/dspec.pkl
node src/cli.mjs emit alloy examples/dspec.pkl
node src/cli.mjs emit tla examples/dspec.pkl
node src/cli.mjs emit tla-cfg examples/dspec.pkl
node src/cli.mjs emit lean examples/dspec.pkl
node src/cli.mjs emit source-map --locale ja examples/dspec.pkl
node src/cli.mjs emit runtime-collector fixtures/runtime-model.pkl
node src/cli.mjs emit runtime-collector-fixture fixtures/runtime-model.pkl
node src/cli.mjs verify-generated examples/dspec.pkl
node src/cli.mjs verify-generated --json examples/dspec.pkl
node src/cli.mjs collect-runtime-evidence fixtures/runtime-evidence-collector.json
node src/cli.mjs collect-runtime-evidence --pkl fixtures/runtime-evidence-collector.json
node src/cli.mjs verify-runtime-evidence fixtures/runtime-evidence-collector.json
node src/cli.mjs verify-runtime-evidence --json fixtures/runtime-evidence-collector-broken.json
node src/cli.mjs import-db-schema fixtures/db-schema.sql
node src/cli.mjs import-db-schema --json fixtures/db-schema.sql
node src/cli.mjs check-sql-queries fixtures/db-model.pkl fixtures/db-queries.sql
node src/cli.mjs check-sql-queries --json fixtures/db-model.pkl fixtures/db-queries-broken.sql
node src/cli.mjs import-runtime-evidence fixtures/runtime-evidence-import.json
node src/cli.mjs import-runtime-evidence --json fixtures/runtime-evidence-import.json
node src/cli.mjs normalize-counterexamples --json --locale ja fixtures/coverage-missing-check.pkl
node src/cli.mjs render --locale ja examples/dspec.pkl
```

`normalize-counterexamples` exits non-zero when it successfully finds generated
counterexamples; use `--json` when another tool should consume the normalized
records.

With pkfire:

```sh
pkf run check
pkf run dogfood
pkf run report-fixtures:review
pkf run render
```

## Self Model

`examples/dspec.pkl` is the first self-hosted model: dspec describes the
contracts that the current prototype actually implements.

It models the current implementation boundary:

- Pkl owns typed document validation through `dspec/Schema.pkl`.
- `dspec/Schema.pkl` exposes shorthand helpers for common localized text,
  terms, clauses, check targets, and implementation references.
- `dspec/domains/*.pkl` exposes domain preset packs that expand repeated
  domain constraints, currently RBAC and tenant isolation, into ordinary
  `Term`, `Rule`, and typed `Clause.ast` records.
- `domainPacks` declares preset-pack helper contracts so rule helpers are
  checked for typed AST support and drift-checked against implementation
  symbols.
- `i18n` declares required locales and glossary labels so localized model text
  and vocabulary terms can be checked for semantic drift.
- `examples/rbac.pkl` is the current RBAC example authored through the RBAC
  preset pack, with project-specific text and check targets applied as Pkl
  amendments.
- CLI input modules expose a top-level `model`.
- Stable ids are independent from localized labels.
- `render` produces locale-specific text with default fallback.
- `check` rejects duplicate ids, unknown references, direct
  `must`/`mustNot` contradictions, missing required localized labels,
  glossary label drift, and approved rules with no verification or
  implementation target.
- `drift` validates that implementation references and check targets still
  resolve to files, symbols, and test anchors.
- `drift` resolves backend-specific check target anchors for Node, Playwright,
  Lean, TLA+, Alloy, Pkl, and runtime collector manifests.
- Top-level CLI usage is generated from a command registry. README/docs/Taskfile
  command examples are checked and help-smoked against that live surface, with a
  holdout Markdown fixture covering extractor shapes such as fenced `dspec`,
  `node $OLDPWD`, pipes, and inline backticks.
- `coverage` requires approved active rules to have automated check targets,
  and can require clause-level support through `Rule.coverage = "clause"` plus
  `CheckTarget.covers`.
- `domain-coverage` requires tracked domain pattern elements to be grounded in
  approved rules by stable ids, so orphan Cloud/Data/Release/Runtime model
  facts are caught before they become unreviewed spec master data.
- `import-real-app` extracts observed facts from a real application checkout:
  Hono API routes, Zod contract schemas, GitHub Actions workflows, flaker/VRT
  config, Cloudflare Wrangler JSONC, Pulumi declarations, Terraform/OpenTofu
  planned resources, and application-owned Kubernetes manifests. IaC
  declarations are observations, not deployment proofs. Unknown encryption,
  deletion, criticality, retry, and idempotency guarantees remain false or
  unset in generated Pkl drafts.
- `evaluate-real-app-import` compares normalized importer facts with a typed
  Pkl gold set and reports missing/unexpected facts plus precision and recall.
  The mnemo holdout records source commit, file digests, sanitization, vendored
  config noise, and E2E environment classification.
  The normalization, fact comparison, and conservative domain projection are
  also available as filesystem-free functions from `src/core/real-app.mjs`;
  the CLI is an adapter over the same core output.
- `reconcile-real-app` compares those observed facts with a hand-authored
  Cloud/Data/Release/Runtime model, catching implementation-to-domain mapping
  drift such as a missing release gate.
- `reverse-coverage` checks the opposite direction: observed
  Cloud/Data/Release/Runtime facts must be represented in the hand-authored
  model, catching implementation facts that never became spec master data.
- `check-app-profile` reads a typed Pkl app profile and runs the real-app gate
  bundle: model check, drift, domain coverage, import freshness,
  reconciliation, and reverse coverage. Passing multiple profile files returns
  an aggregate report while preserving the single-profile report shape for
  one file. `check-app-profile-suite` reads a typed `AppProfileSuite` registry
  when the profile list itself should be the specification master.
  `check-app-profile --markdown` renders the same report as a review table.
  `check-app-profile --fix` refreshes a stale `observedFacts` fixture from the
  current importer output.
  `check-app-profile --fix --dry-run` reports the same candidate as `wouldFix`
  without writing the fixture; the equivalent write task is
  `pkf run app-profile:refresh`.
- `scaffold-app-profile` emits an editable Pkl `AppProfile` draft from
  `modelPath` and `appRoot`, so an AI authoring loop can start from a typed
  skeleton instead of inventing the profile shape. `scaffold-app-profile
  --diff --json` compares the regenerated draft with an existing profile so
  profile drift is visible before overwriting anything. `scaffold-app-profile
  --apply --dry-run` previews the same update path, and `--apply` writes the
  regenerated profile with an import path relative to the output file.
  `evaluate-app-profile` runs a baseline false-positive guard and injected
  false-negative guards for missing expected facts and unmodeled observed
  facts; `profile.scenarios` can declare route, contract schema, workflow,
  data store, runtime dependency, and release gate mutations explicitly.
  `evaluate-app-profile --markdown` renders the same scenario table for human
  review, including the detected suggestion kind and mutation payload.
  `coverage-app-profile-scenarios` checks that the profile declares baseline,
  implementation-missing, and spec-missing scenario coverage at both gate and
  scenario-category scope, and only counts scenarios whose evaluation passed.
  The category set is inferred from the model and observed app by default; set
  `profile.requiredScenarioCategories` to narrow a smaller app, but declared
  categories must still include every inferred category.
  `score-app-profile-mutations` deterministically generates implementation-
  missing and spec-missing mutations for each required scenario category,
  evaluates whether the detector catches them, and reports the mutation score
  plus shrink candidates for the generated witness. Holdout profiles exercise
  the same score path with non-sample route, schema, and workflow names so the
  mutation generator does not overfit to the main dogfood app. Shuffled and
  noisy holdouts check the metamorphic relation that witness selection stays
  stable under observed-fact order changes and unrelated extra facts.
  `replay-app-profile-changes` evaluates a typed before/after corpus of real
  app-shaped changes against expected `no-drift`, `implementation-missing`, and
  `spec-missing` labels, so detector behavior is checked on fixed examples that
  are not generated by the mutation engine.
  `evaluate-app-profile-suite` aggregates those scenario evaluations for a
  profile registry.
- `check --json`, `drift --json`, `coverage --json`, and
  `domain-coverage --json` emit stable machine-readable pass/fail reports with
  detected errors. `reconcile-real-app --json` uses the same pass/fail report
  shape for real-app artifact reconciliation; `reverse-coverage --json`,
  `check-app-profile --json`, profile suite reports, and scaffold diff reports
  use it for observed-to-spec coverage and bundled app gates.
- `impact --json` compares two spec models and maps changed terms/rules to
  affected generated selectors and implementation references.
- `spec-change compat --json` compares two spec models and classifies the
  change as `compatible`, `breaking`, `narrowing`, `widening`, or `unknown`,
  with one decision per changed term/rule/domain element.
- `spec-change scaffold [--json|--pkl]` turns a before/after model pair
  into a deterministic `SpecChangeReview` Pkl draft. It fills compatibility
  expectations and standard review steps, and for `breaking` drafts it declares
  the required evidence while leaving evidence entries empty for the review gate
  to catch. `--output <review.pkl>` writes the draft and resolves schema/model
  paths relative to the destination path, so the saved review can be run from a
  different cwd. `--help` shows command-local examples.
- `spec-change review --json|--markdown` reads a typed Pkl review plan and
  runs the spec-change procedure as one gate: before/after `check`, `impact`,
  compatibility classification, allowed/expected compatibility, breaking-change
  evidence policy, and after-side `coverage`. For `breaking` changes, the
  default policy requires migration, deprecation, rollout, and owner-approval
  evidence unless the review declares a narrower `breakingRequires` set. Local
  Markdown evidence refs must resolve to an existing file and heading anchor.
  Missing breaking evidence reports include Pkl evidence-entry snippets.
  Because the CLI is still pre-release, the public command surface is only the
  grouped `spec-change ...` form; removed long command names are rejected as
  unknown commands instead of kept as aliases.
- `spec-reading-eval --json|--prompt|--score` keeps a gold set of claims over a
  correct spec model. Cases are labeled as `entailed`, `contradicted`, or
  `not-supported`; `--prompt` hides labels for sub-agent evaluation, includes a
  label rubric, and can render another locale with paraphrases. `--score`
  grades labels and answer evidence overlap, while stored evidence digests catch
  stale gold cases after spec edits. `--refresh-digests` dry-runs digest
  updates, `--refresh-digests --apply` writes them back to the Pkl gold set,
  `--write-run` records the sub-agent prompt and score report, and
  `spec-reading-eval-suite` aggregates sample and holdout evaluation sets.
  `--runner <runner.pkl>` invokes a provider-neutral process adapter: prompt on
  stdin, answers JSON on stdout. The typed runner records provider/model
  identity and argv without embedding an SDK. Its deterministic artifact keeps
  runner, prompt, and answer digests, exit status, raw stdout/stderr, and the
  ordinary score report; environment variables and secrets are not recorded.
  `coverage-spec-reading-eval-suite` checks that a suite covers required
  labels, evidence kinds, model kinds, tags, and paraphrase locales.
  `metamorphic-spec-reading-eval` verifies that answer order, evidence order,
  and rationale noise do not change scoring, and that prompts do not leak gold
  labels near case IDs. Eval `modelPath` and suite `evaluations` are resolved
  relative to their owning Pkl files, so evaluation bundles remain portable
  across cwd changes. `rubricVersion` locks a gold set to the scoring rubric.
  `--markdown --score` emits a sub-agent run report with gold-fix candidates.
- `fixtures/reports/*.json` fixes the check/drift/coverage/impact,
  domain-coverage, real-app import/reconciliation, app-profile mutation score,
  app change replay, spec reading evaluation and agent runs, spec compatibility, spec change
  review, verify-generated, and normalized-counterexample report shapes as
  compatibility artifacts for future checker implementations.
  `fixtures/spec-change-scaffold-*.pkl` does the same for deterministic
  authoring scaffolds.
- `emit` deterministically projects the source model to Markdown, QuickCheck,
  Alloy, TLA+, Lean skeletons, runtime collector manifests, and
  generated-artifact source maps.
- `patterns.db` models database tables, invariants, transactions, and
  migrations, then projects preservation, mapping-coverage, and mapping
  well-formedness checks to QuickCheck, Alloy, and TLA+.
- `import-db-schema` seeds `patterns.db.tables` from existing SQL
  `CREATE TABLE` DDL, preserving primary keys, uniqueness, nullability, and
  foreign references as deterministic JSON or Pkl fragments.
- `check-sql-queries` checks sqlc-style SQL query catalogs against
  `patterns.db` for table/column drift, `SELECT *`, missing tenant filters,
  missing FK joins, and tenant-scoped inserts that omit the tenant column.
- `patterns.cloud` models network zones, cloud nodes, flows, and explicit
  access policies, then projects boundary, sensitive-resource policy,
  tenant-propagation, and queue idempotency checks to QuickCheck, Alloy, and
  TLA+.
- `patterns.data` models data classifications, datasets, stores, placements,
  and flows, then projects encryption-at-rest, deletion support,
  cross-region-transfer basis, and retention-policy checks to QuickCheck,
  Alloy, and TLA+.
- `patterns.release` models services, environments, gates, rollbacks,
  migrations, and release steps, then projects production health-gate, traffic
  rollback, rollback-test, and migration-compatibility checks to QuickCheck,
  Alloy, and TLA+.
- `patterns.runtime` models services, dependencies, signals, runbooks, alerts,
  and SLOs, then projects critical-SLO page-alert, tested-runbook,
  dependency-timeout, and retry-idempotency checks to QuickCheck, Alloy, and
  TLA+.
- `patterns.runtime` also accepts imported runtime evidence records for
  telemetry windows, alert policies, runbook executions, and dependency traces,
  then projects evidence coverage and drift checks to QuickCheck, Alloy, and
  TLA+. Runtime evidence expectations can require freshness with
  `freshWithinDays` and `asOf`; `verify-runtime-evidence --json` also emits an
  evidence quality summary with missing, stale, freshness-checked, and score
  counts.
- `verify-generated` executes generated QuickCheck output, compiles generated
  Lean output, validates generated TLA+/Alloy syntax shape, and runs TLA+ SANY,
  TLA+ TLC, plus Alloy analyzer smoke checks when those tools are available.
- `verify-generated --json` emits a deterministic backend-status report for CI
  artifacts and future drift/coverage ingestion.
- `generated/dspec.md` is the checked-in Markdown review artifact generated
  from `examples/dspec.pkl`; each rule includes review metadata such as source
  path, coverage mode, clause selectors, checks, and implementation refs. The
  top-level review summary records approved-rule, automated-check,
  implementation-ref, domain-element, and runtime-evidence counts.
- `generated/source-map.json` maps generated selectors back to source `Rule`,
  `Clause`, and `CheckTarget` paths.
- `generated/manifest.json` records SHA-256 freshness hashes for primary
  generated artifacts.
- `normalize-counterexamples` turns generated backend failures into `Rule.id`,
  source path, generated selector, and reviewable explanation records. When
  TLA+/Alloy output contains generated selectors, the source map resolves them
  back to concrete spec records.
- `flake.nix` provides the devShell used to put Z3 and the TLA+/Alloy tools on
  `PATH`.
- `.github/workflows/check.yml` runs an Ubuntu `check:fast` job with pnpm,
  Pkl, and pkfire CAS caches in parallel with a macOS/Nix `check:formal` job.
  The formal job requires devShell tools plus Lean/TLA+/Alloy execution while
  the fast job provides earlier schema, report, test, and dogfood feedback.
- `Clause.expr` remains a compatibility/display string, while `Clause.ast`
  carries the typed expression structure used by deterministic projections
  when present.
- `examples/sample-webapp-2026.pkl` dogfoods dspec against a real adjacent
  application checkout, mapping its API, contracts, CI, VRT, release, data,
  and runtime facts into Cloud/Data/Release/Runtime patterns.
- `import-real-app`, `reconcile-real-app`, `reverse-coverage`, and
  `check-app-profile` close the first adapter loop for that dogfood model:
  observed implementation facts are extracted from the adjacent checkout,
  checked against the hand-authored pattern model, checked back in the
  observed-to-spec direction, then bundled as a typed app profile gate.

This file should move from `examples/` to a dedicated `specs/` layout once the
project has more than one first-party model.

## Model Shape

`Model` is the master record.

- `vocabulary`: language-independent domain terms with localized labels.
- `rules`: spec atoms such as `permission`, `prohibition`, `obligation`,
  `invariant`, and `transition`.
- `decisions`: append-only design history.
- `domainPacks`: preset pack helper contracts for local domain DSL modules.
- `checks`: links from a rule to verification backends such as Lean, Alloy,
  TLA+, Rego, Playwright, or runtime monitoring.
- `implementedBy`: implementation markers used for drift detection.
- `patterns.db`: optional DB model with `tables`, `invariants`,
  `transactions`, and `migrations`.
- `patterns.cloud`: optional cloud topology model with `zones`, `nodes`,
  `flows`, and `policies`.
- `patterns.data`: optional data governance model with `policies`, `datasets`,
  `stores`, `placements`, and `flows`.
- `patterns.release`: optional release safety model with `services`,
  `environments`, `gates`, `rollbacks`, `migrations`, and `steps`.
- `patterns.runtime`: optional runtime safety model with `services`,
  `dependencies`, `signals`, `runbooks`, `alerts`, `slos`, `telemetry`,
  `alertPolicies`, `runbookExecutions`, and `dependencyTraces`.

Domain preset packs under `dspec/domains/` are authoring helpers over this
shape. They do not add a separate semantics layer; they return ordinary Core IR
records so drift detection, coverage, Markdown rendering, QuickCheck, Lean,
TLA+, and Alloy projections keep one source format.

`Clause.expr` is a stable compatibility string. `Clause.ast` is the first typed
expression layer: small boolean/relation nodes that emitters can preserve in
QuickCheck, TLA+, and Lean outputs. The current implementation still falls back
to `expr` when `ast` is absent, which keeps older specs readable while giving
new specs a deterministic projection surface.

`Model.clauseAstSemanticsVersion` versions the interpretation contract for all
typed clauses in a model. Version `1.0` defines a minimal first-order boolean
fragment:
uninterpreted `atom` predicates, symbolic `eq`/`neq`, boolean
`not`/`and`/`or`/`implies`, and single-child `exists`/`forall` binders.
`dspec check` rejects nodes that use fields outside the selected operator's
semantics or models that request an unsupported semantics version. QuickCheck,
TLA+, and Lean projections carry the version explicitly. The executable
reference semantics and conformance tests live in `src/core/clause-ast.mjs` and
`test/clause-ast-core.test.mjs`.

`patterns.db` is the first domain pattern. It separates DB structure from
transaction and migration behavior: tables declare columns, primary keys,
tenant columns, and foreign references; invariants name the tables they
constrain; transactions declare reads, writes, idempotency keys, and which
invariants they preserve; migrations declare source tables, target tables,
which invariants they preserve, and mapping witnesses for those preservation
claims. Generated QuickCheck/TLA+/Alloy projections check that a transaction or
migration touching a table constrained by an invariant declares that invariant
in `preserves`, and that every migration `preserves` entry is covered by at
least one `DbMapping.invariants` entry. They also check that mapping
expressions mention the migration source and target tables, which keeps opaque
mapping text from drifting away from the tables it claims to connect.

`patterns.cloud` is the second domain pattern. It separates cloud topology from
implementation details: zones declare exposure, nodes declare resource kind and
tenant scope, flows declare source/target/action plus tenant propagation or
idempotency evidence, and policies declare which principal may access which
resource actions. Generated QuickCheck/TLA+/Alloy projections check four cheap
cloud-architecture invariants: public ingress must not directly reach sensitive
resources, sensitive-resource access must have an explicit policy, tenant-scoped
flows must propagate tenant context, and queue publish flows must carry an
idempotency key.

`patterns.data` is the third domain pattern. It separates data governance from
provider-specific infrastructure: policies declare classification-level
retention limits, datasets declare classification/residency/retention, stores
declare region/encryption/deletion support, placements declare where datasets
are stored, and flows declare store-to-store movement with purpose and optional
legal basis. Generated QuickCheck/TLA+/Alloy projections check that sensitive
data placements use encrypted stores, personal data placements use stores that
support deletion, cross-region personal-data flows have a legal basis, and
dataset retention stays within the classification policy.

`patterns.release` is the fourth domain pattern. It separates release safety
from CI/CD vendor details: services and environments define deployment targets,
gates define review/test/health evidence, rollback plans declare whether they
are tested, migrations declare backward compatibility, and release steps attach
strategy, traffic percentage, gates, rollback, and migration evidence.
Generated QuickCheck/TLA+/Alloy projections check that production release steps
have health gates, production traffic shifts have rollback plans, referenced
rollback plans are tested, and production migrations are backward compatible.

`patterns.runtime` is the fifth domain pattern. It separates runtime safety
from monitoring vendor details: services declare criticality, dependencies
declare target/kind/timeout/retry/idempotency intent, signals declare observed
indicators, runbooks declare tested operational response, alerts connect
signals to severity and response, and SLOs declare service-level targets.
Generated QuickCheck/TLA+/Alloy projections check that critical-service SLOs
have page alerts, page alerts have tested runbooks, dependencies have positive
timeouts, and retryable dependencies are explicitly idempotent.
The same pattern now accepts imported evidence records: telemetry windows are
matched to SLOs and checked against targets, page alerts are matched to enabled
alert policies, page-alert runbooks are matched to passing execution records,
and dependency traces are checked against declared timeouts. This detects
implementation/operation drift in the imported evidence; it does not by itself
prove production reliability or telemetry completeness outside the imported
records.

`import-runtime-evidence` is the first importer boundary. It accepts
provider-scoped JSON exports under `prometheus.telemetry`,
`pagerduty.alertPolicies`, `incident.runbookExecutions`, and
`otel.dependencyTraces`, then emits either a deterministic Pkl fragment for a
`RuntimeModel` block or stable JSON with `--json`.

`collect-runtime-evidence` is the first collector boundary. It reads a manifest
of provider API payload sources from `file`, `inline`, or live `http` entries
and aggregates Prometheus vector responses, PagerDuty-style alert policy
exports, incident/runbook execution exports, and OpenTelemetry span exports
into that provider-scoped import JSON. HTTP entries support GET, optional
headers, and `timeoutMs`; the default output is stable JSON, while `--pkl`
pipes the collected result through `import-runtime-evidence` and emits a
Runtime evidence Pkl fragment.

`emit runtime-collector` generates the expected collector manifest from a
Runtime safety spec. It turns SLOs, page alerts, runbooks, and dependencies
into provider/kind/path/query entries with `sourceMap` records back to the
authoritative spec item. The generated manifest can be used as the handoff
contract for recorded payloads and live HTTP collectors.

`verify-runtime-evidence` is the coverage/drift oracle for that manifest. It
collects the referenced payloads, normalizes them through the same importer
contract, and compares each source's `expects` block with the observed
evidence. It reports missing telemetry, SLO misses, disabled policies, failed
runbook executions, timeout traces, and missing idempotency-key observations as
stable text or JSON.

`emit runtime-collector-fixture` emits the same collector contract with
provider-shaped inline payloads. It is a bootstrap/smoke-test artifact: the
result can be passed directly to `verify-runtime-evidence` or
`collect-runtime-evidence` without first creating files on disk, while still
using the same provider adapters as recorded or live payloads.

## Current Checks

`dspec check` currently validates constraints that Pkl's per-object type system
does not see globally:

- duplicate term/rule/decision ids
- `primaryLocale` not listed in `locales`
- `i18n.requiredLocales` not listed in `locales`
- missing `LocalizedText.labels` entries for required i18n locales
- glossary labels that drift from their vocabulary term labels
- unknown term references from rules
- unknown term value/supersedes references
- unknown exception references
- direct `must` vs `mustNot` contradictions inside one rule
- DB model duplicate ids, broken table/column references, broken invariant
  references, broken transaction references, broken migration references, and
  broken migration mapping references
- cloud model duplicate ids, broken zone/node/policy references, and empty
  policy action sets
- data model duplicate ids, duplicate classification policies, broken
  dataset/store references, missing classification policies, and negative
  retention limits
- release model duplicate ids, broken service/environment/gate/rollback/
  migration references, traffic percentage range, and service mismatches
- runtime model duplicate ids, broken service/signal/runbook/alert/SLO/
  dependency references, negative dependency timeouts, invalid telemetry
  percentages, invalid trace latencies, and out-of-range SLO targets
- approved rules with no verification or implementation target
- implementation reference paths and symbols for `dspec drift`
- check target paths and node test anchors for `dspec drift`
- backend-aware check target anchors for Playwright, Lean, TLA+, Alloy, Pkl,
  and runtime collector manifests
- approved-rule automated check coverage for `dspec coverage`
- stable JSON reports for `dspec check --json`, `dspec drift --json`, and
  `dspec coverage --json`
- domain model element coverage for `dspec domain-coverage`
- stable JSON reports for `dspec domain-coverage --json`
- real-app artifact import and reconciliation for `dspec import-real-app` and
  `dspec reconcile-real-app`
- spec-diff impact reports for changed term/rule ids, generated selectors, and
  implementation references
- JSON report compatibility fixtures under `fixtures/reports/`
- stable compatibility fixtures for `verify-generated --json` and
  `normalize-counterexamples --json`; these use projections so optional
  TLA+/Alloy tools can be installed or absent without changing the fixtures
- generated QuickCheck execution and generated Lean compilation for
  `dspec verify-generated`
- generated TLA+/Alloy module shape, required declarations, and delimiter
  balance for `dspec verify-generated`
- generated TLA+ SANY/TLC and Alloy analyzer checks for `dspec verify-generated`
  when `tlasany`, `tlc`, and `alloy6` are installed, for example through
  `nix develop path:$PWD`
- generated backend checks are load-bearing against
  `fixtures/coverage-missing-check.pkl`
- generated DB invariant checks are load-bearing against
  `fixtures/db-model-missing-preserve.pkl`
- generated DB migration checks are load-bearing against
  `fixtures/db-model-migration-missing-preserve.pkl`
- generated DB migration mapping checks are load-bearing against
  `fixtures/db-model-migration-missing-mapping.pkl`
- generated DB migration mapping expression checks are load-bearing against
  `fixtures/db-model-mapping-missing-table-mention.pkl`
- generated Cloud topology checks are load-bearing against
  `fixtures/cloud-model-broken.pkl`
- generated Data governance checks are load-bearing against
  `fixtures/data-model-broken.pkl`
- generated Release safety checks are load-bearing against
  `fixtures/release-model-broken.pkl`
- generated Runtime safety and evidence checks are load-bearing against
  `fixtures/runtime-model-broken.pkl`
- generated Markdown review artifact drift via `generated/dspec.md`
- generated source-map artifact drift via `generated/source-map.json`
- JSON verification report shape via `dspec verify-generated --json`
- counterexample normalization from generated backend failures to source
  `Rule.id`, source-map paths, and TLA+/Alloy generated-selector witnesses
- stale runtime evidence detection via `freshWithinDays` and `asOf`

These are deliberately cheap checks, but they are now load-bearing: a fixture
with an unsupported approved rule fails generated QuickCheck and Lean, and in
the Nix shell also fails the TLA+/Alloy backend gates. The normalizer maps
those failures back to spec source records. The useful next step is to split the
checker into a reusable core so the current Node CLI and a future MoonBit
implementation can share fixtures and expected diagnostics.

## Evaluation

See `docs/usability-evaluation.md` for the current usability assessment and
`docs/dogfooding-2026-07-10.md` for the latest concrete dogfood run.
`examples/dspec.pkl` is now usable as the prototype's active self-spec ledger;
the remaining gap is full backend semantics for `Clause.ast`,
backend-specific proof/model-check generation beyond the current QuickCheck,
Lean, TLA+ SANY/TLC, Alloy analyzer smoke gates, and richer counterexample
interpretation. `patterns.db` is the first concrete domain pattern for this
direction, including declaration-level migration preservation checks and
mapping coverage / well-formedness checks. `patterns.cloud` extends the same
approach to common cloud application topology checks: boundary isolation,
policy coverage for sensitive resources, tenant-context propagation, and
idempotent queue publication. `patterns.data` extends it to data-governance
claims that are usually reviewed separately from topology: encryption,
deletion support, cross-region transfer basis, and retention limits.
`patterns.release` adds a state-transition-oriented surface for deployment
safety: production gates, traffic shifts, rollback readiness, and migration
compatibility.
`patterns.runtime` extends the same pattern to production operations: SLOs,
alerts, runbooks, dependency timeouts, retry idempotency, and imported
operational evidence for telemetry, alert policy, runbook execution, and trace
drift.
`domain-coverage` adds a meta-check over these patterns: it does not prove the
domain facts themselves, but it detects facts that are present in the model and
not mentioned by any approved rule. `examples/sample-webapp-2026.pkl` is the
first real-app dogfood model for that check.

See `docs/semantic-model.md` for the working ontology: dspec rules are treated
as inferon-like claims, support is provided by checks and implementation
references, and deterministic emitters act as projections into review and
verification sites.
