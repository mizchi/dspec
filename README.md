# dspec

Typed Pkl prototype for a system specification and assurance toolkit.

dspec keeps a human-authored, typed formal model as the specification master,
then makes that model executable in a narrow and explicit sense: it
deterministically checks, projects, reconciles, and records evidence. It is not
a general theorem prover or a claim that arbitrary production code has been
proved correct.

## Formal-First Goal

The formal model is normative; Natural-language text is a derived, localized
review projection and cannot introduce a requirement that is absent from the
model. Test oracles, backend artifacts, and implementation-conformance inputs
must derive from the same formal model. An implementation is accepted only by
passing the declared oracle or by carrying the explicitly scoped proof/evidence
required by its claim.

Pkl is the current typed IR and authoring syntax, not natural-language source
text. Its `Clause.ast` and domain records have declared backend applicability.
Lean currently provides semantic proof only for the documented
`eq`/`neq`/`not`/`implies` fragment; a claim outside that fragment must not be
presented as Lean-proved. The formal-first target is to make each supported
semantic fragment originate in a machine-checkable model or proof artifact,
then generate readable documents and test oracles from it.

An LLM may translate a requested change or question into a candidate formal
model edit or structured query. It is not allowed to make the source model true
by assertion: candidates are validated, reviewed, projected, and checked
against implementation evidence before they become authoritative.

The first prototype uses Pkl as that typed formal model:

- stable ids and typed schema live in `dspec/Schema.pkl`
- authored models live in `examples/*.pkl`
- natural-language rendering is generated from localized labels and has no
  independent normative force
- cross-model consistency checks run in `src/cli.mjs`

This is intentionally not YAML. The authoring surface is Pkl so schema
errors are caught before the model reaches the implementation checker.

## Core Workflow

The primary workflow is a bidirectional reconciliation loop:

1. Author normative rules, domain models, Intent contracts, and projections in
   Pkl.
2. Import conservative observations from application and infrastructure
   artifacts.
3. Check declared-to-observed reconciliation, observed-to-model reverse
   coverage, and model-to-approved-rule domain coverage.
4. Attach current execution or formal-tool evidence to the claim it supports.

This catches both directions of drift: a declared requirement that no longer
has an implementation anchor, and an observed route, resource, or operational
fact that was never made part of the specification master.

## Semantic Graph Interoperability

The Pkl master can be exported as a labelled semantic graph for RDF tooling or
for retrieval/navigation with `mizchi/meandb`:

```sh
dspec graph export --format turtle --output specification.ttl examples/tetris.pkl
dspec graph export --format graphdb --output generated/tetris.graphdb-input examples/tetris.pkl
dspec graph embed generated/tetris.graphdb-input
dspec graph build --mutual generated/tetris.graphdb-input
dspec graph query-dsl --explain generated/tetris.graphdb-input/specification.graphdb traceability.gql
dspec graph query --locale ja examples/tetris.pkl "テトリスの回転規則"
```

The graph explicitly distinguishes Pkl-declared relationships from observed
or verified evidence. Turtle retains labelled predicates; the GraphDB bundle
reifies each relation as a tagged intermediate node, while JSON/Turtle remain
lossless sidecars. See [`docs/semantic-graph.md`](docs/semantic-graph.md) for
the contract and embedding/import flow.

## Daily Drift Review

`examples/daily-drift-targets.pkl` is a typed `DailyDrift.Manifest`. It names
every target model, its applicable core gates, and its implementation-observation
source. An `application` target must name an `AppProfile`; its packet therefore
includes imported real-app facts, reconciliation, and reverse coverage rather
than only source-reference checks. A `runtime` target may require a normalized
runtime-evidence manifest. `tooling-self` is intentionally narrower and does
not claim to observe arbitrary implementation behavior.

`pkf run daily-drift:packet` collects one report directory per declared target
in `.dspec/daily-drift/`. It includes the selected core gates, each declared
implementation observation, locale-specific Markdown projections, a packet-local
copy of the review skill, and a prompt that treats all packet content as
untrusted data. Run it through the Nix development shell when formal backend
tools are required:

```sh
nix develop path:$PWD -c pkf run daily-drift:packet
```

An approved baseline records a target model digest and Intent graph digest.
Changing either is drift until a human deliberately establishes a replacement
baseline with an approver and approval id:

```sh
nix develop path:$PWD -c node src/cli.mjs daily-drift approve \
  --approved-by 'name@example.com' --approval-id ADR-123 \
  --spec-change-review target-id=reviews/target-change.pkl \
  --require-formal-tools examples/daily-drift-targets.pkl
```

The installed package exposes the same command as `dspec daily-drift approve`.
Every declared target needs one `--spec-change-review` binding. Its successful
after-model digest must equal that target's current model digest; the baseline
records the review and report digests with the human approval.

`.github/workflows/daily-drift-review.yml` runs the same collection on a daily
cron, retains the packet as an artifact, and invokes the versioned
`skills/dspec-intent-formal-implementation-drift` skill through a read-only
Codex review. The LLM job has no checkout and reads only the packet artifact.
`OPENAI_API_KEY` is required for scheduled runs; a manual dispatch may record a
deliberate skip instead. All third-party actions are pinned to immutable
commits.

The review can report candidate Pkl, test, or implementation changes. It never
edits the model, opens issues or pull requests, or treats a candidate as an
accepted requirement. A human accepts a candidate only by changing the formal
model and passing the declared validation, drift, and assurance gates.

`pkf run daily-drift:eval` scores the review skill against seeded
Intent-to-formal, formal-to-implementation, i18n, and no-drift cases. It checks
machine-readable finding ids, classifications, evidence paths, and restraint
against hallucinated findings. This is a regression harness for the review
instruction and model choice, not evidence that an LLM found a production bug.
The latest operator walkthrough and remaining boundary are recorded in
[`docs/dogfooding-2026-07-17-daily-drift.md`](docs/dogfooding-2026-07-17-daily-drift.md).

## Assurance Boundary

dspec checks typed model structure, stable references, declared coverage, and
deterministic projections. It can compare declared `Clause.ast` behavior with
finite implementation conformance cases and detect drift in recorded observed
facts. Lean is semantic only for the documented equality/negation/implication
fragment; other backend paths are structural, textual, or unmapped.

It does not prove that arbitrary production code refines a business rule, that
an imported cloud declaration is deployed or reachable, or that a generated
Quint/Alloy artifact covers an undeclared behavior. These limits are deliberate
and are recorded in the model and evidence contracts.

For cases that need direct Lean or Alloy source, [`docs/formal-links.md`](docs/formal-links.md)
defines an explicit `authored`/`extension` registry. A direct artifact names
the domain rule it grounds; an extension must `import`/`open` its generated
dependency. This preserves DSL-first generation while keeping deliberate
escape hatches reviewable and executable.

[`docs/trace-lock.md`](docs/trace-lock.md) describes a separate reviewed trace
lock for detecting specification, implementation, and verification-link drift.
[`docs/translation-lock.md`](docs/translation-lock.md) applies the same review
and freshness boundary to translations of `LocalizedText`.

## Capability Boundaries

| Question | dspec can establish | It does not establish |
| --- | --- | --- |
| Architecture, ownership, topology, and data placement | Typed model consistency plus reconciliation and reverse coverage for supported adapters | That the deployment actually occurred, is reachable, or remains healthy |
| API and business process behavior | Declared Intent contracts, finite scenarios, refinement exercises, and current runtime evidence | Universal equivalence between an implementation and a business process |
| Distributed or temporal behavior | A generated artifact can be syntax-checked or tool-checked within its declared model and scope | That generated Quint/Alloy output covers undeclared states or production execution |
| Clause semantics | Clause-scoped Lean evidence only for the documented `eq`/`neq`/`not`/`implies` fragment | A generic proof path for algorithms, SDK behavior, or arbitrary application code |
| Compliance and audit | Reviewable rules, evidence manifests, provenance, and CI results | Legal certification or compliance by itself |

The current importers cover selected TypeScript and infrastructure surfaces.
Adapter coverage is an implementation boundary, not a claim that dspec is tied
to one permanent stack. There is also no validated service-count threshold:
adoption is justified when the cost of cross-artifact drift exceeds the cost of
maintaining the model.

### Quint temporal backend

`dspec emit quint <model.pkl>` is the temporal projection surface and emits one
`.qnt` artifact. The former direct `tla` and `tla-cfg` emit targets are removed.
The generated model covers approved-rule workflow safety plus bounded Intent
execution concurrency, idempotency, and timeout state. `verify-generated`
always runs `quint typecheck`; with a working Java runtime it additionally runs
`quint verify --backend tlc --max-steps 10`. Assurance evidence records that
bound and backend, so a bounded pass is not presented as an unbounded proof or
as evidence about undeclared production behavior.

## Install

```sh
pnpm add @mizchi/dspec
dspec init
dspec verify --require-lock dspec.pkl
```

The CLI requires Node.js 24+ and Pkl on `PATH`. `dspec init` writes `dspec.pkl`,
`dspec.lock.json`, and resolves the bundled schema to a relative import. Use
`dspec init --output specs/core.pkl` for a different location; existing files
require `--force` to be replaced.

`dspec verify` combines structural validity, reference drift, and approved-rule
coverage in one report. The lock is optional for existing models and required
with `--require-lock`; refresh it intentionally after reviewing a schema update:

```sh
dspec verify --json --require-lock spec.pkl
dspec lock --force spec.pkl
dspec explain --markdown --require-lock spec.pkl
```

`dspec explain --json` emits de-duplicated diagnostics with a gate phase,
stable error code, rule id when available, model source line, and a corrective
suggestion. `dspec scaffold rule` emits a typed draft Rule fragment without
editing the master model:

```sh
dspec scaffold rule --output drafts/access-rule.pkl --kind obligation \
  --term request.authenticated \
  --implementation src/access.mjs#canAccess \
  --test test/access.test.mjs#authenticated-requests-can-access \
  spec.pkl ACCESS-AUTHENTICATED
```

## Pkl Package

The repository also publishes the schema as a native Pkl package. `PklProject`
uses the npm package version, runs the public-facade API tests, and produces the
Pkl metadata, SHA-256 checksums, and ZIP with `pkl project package`.

After a Pkl release is available, declare it in a consumer `PklProject` and
import the facade with dependency notation:

```pkl
amends "pkl:Project"

dependencies {
  ["dspec"] {
    uri = "package://github.com/mizchi/dspec/releases/download/pkl/dspec@0.1.0"
  }
}
```

```pkl
import "@dspec/dspec/Schema.pkl" as d
```

Run `pkl project resolve` after changing dependencies. Local Pkl dependencies
using the same notation are supported by `dspec lock` and `dspec verify`; remote
Pkl dependencies remain Pkl-resolved, while dspec's file-digest lock is limited
to module files available locally.

## Try

With Nix:

```sh
nix develop path:$PWD
pnpm test
pnpm run checker:conformance
node src/cli.mjs devshell-smoke --json
node src/cli.mjs verify-generated examples/dspec.pkl
node src/cli.mjs verify-generated --json examples/dspec.pkl
node src/cli.mjs verify-generated --skip-quint-verify examples/dspec.pkl
node src/cli.mjs verify-generated --json --require-formal-tools fixtures/typed-ast.pkl
node src/cli.mjs traceability --gate --require-executed-formal-tools examples/tetris.pkl
node src/cli.mjs formal-mutation --json --require-formal-tools fixtures/tetris-alloy.pkl
node src/cli.mjs evidence create --output evidence.json fixtures/typed-ast.pkl
node src/cli.mjs evidence verify --json fixtures/typed-ast.pkl evidence.json
node src/cli.mjs evidence refresh fixtures/typed-ast.pkl evidence.json
node src/cli.mjs conformance --json fixtures/conformance-webapp.pkl
node src/cli.mjs query --json --locale ja --answer fixtures/spec-query-answer-valid.json fixtures/conformance-webapp.pkl rule WEBAPP-ACCESS-CONFORMANCE
node src/cli.mjs generate --dry-run --json examples/dspec.pkl
node src/cli.mjs generate examples/dspec.pkl
node src/cli.mjs generated check examples/dspec.pkl
node src/cli.mjs generate examples/sample-webapp-2026.pkl
node src/cli.mjs generated check examples/sample-webapp-2026.pkl
# Crash recovery only; refuses a live local owner without --force.
node src/cli.mjs generated unlock --root .
```

The dev shell provides Node.js 24, pnpm, Pkl, Lean via elan, Z3, Java 21, and Alloy 6.
The project dependency provides Quint. `verify-generated` always runs
`quint typecheck`; when Java is available it also runs bounded `quint verify`
with the TLC backend, alongside the Alloy analyzer gate.
Fast gates may pass `--skip-quint-verify` to leave bounded execution to the
separate `--require-formal-tools` gate while retaining Quint typechecking.
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
node src/cli.mjs evaluate-external-holdouts --markdown fixtures/external-holdout-real-app-import.pkl
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
node src/cli.mjs emit quint examples/dspec.pkl
node src/cli.mjs emit lean examples/dspec.pkl
node src/cli.mjs emit source-map --locale ja examples/dspec.pkl
node src/cli.mjs emit runtime-collector fixtures/runtime-model.pkl
node src/cli.mjs emit runtime-collector-fixture fixtures/runtime-model.pkl
node src/cli.mjs verify-generated examples/dspec.pkl
node src/cli.mjs verify-generated --json examples/dspec.pkl
node src/cli.mjs evidence create --output /tmp/dspec-evidence.json fixtures/typed-ast.pkl
node src/cli.mjs evidence verify --json fixtures/typed-ast.pkl /tmp/dspec-evidence.json
node src/cli.mjs evidence refresh fixtures/typed-ast.pkl /tmp/dspec-evidence.json
node src/cli.mjs domain ir fixtures/domain-codegen.pkl
node src/cli.mjs domain generate --language typescript --output /tmp/commerce-domain.ts fixtures/domain-codegen.pkl
node src/cli.mjs domain relationships --markdown --output /tmp/commerce-relationships.md fixtures/domain-codegen.pkl
node src/cli.mjs intent exercise --json --output /tmp/dspec-intent-exercise.json fixtures/intent-contract.pkl fixtures/intent-traces.json
node src/cli.mjs intent generate-tests --json fixtures/intent-contract-http.pkl
node src/cli.mjs intent test --json --http-base-url http://127.0.0.1:3000 fixtures/intent-contract-http.pkl
node src/cli.mjs intent test --json --grpc-runner ./scripts/grpc-runner.mjs fixtures/intent-contract-grpc.pkl
node src/cli.mjs intent corpus --json fixtures/intent-contract.pkl fixtures/intent-traces-corpus-complete.json
node src/cli.mjs intent access --json fixtures/intent-contract.pkl request.approve role.manager
node src/cli.mjs intent bindings --json fixtures/intent-contract-semantic-http.pkl fixtures/intent-semantic-bindings-observed.json
node src/cli.mjs intent graph --json fixtures/intent-goal-graph.pkl
node src/cli.mjs intent coverage --json fixtures/intent-contract-effects-transaction.pkl fixtures/intent-traces-effects-complete.json
node src/cli.mjs intent mutation --json fixtures/intent-contract-effects-transaction.pkl fixtures/intent-traces-effects-complete.json
node src/cli.mjs evidence create --intent-report /tmp/dspec-intent-exercise.json --output /tmp/dspec-intent-evidence.json fixtures/intent-contract.pkl
node src/cli.mjs evidence verify --json fixtures/intent-contract.pkl /tmp/dspec-intent-evidence.json
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

## Conformance And Query

`dspec conformance` evaluates an explicit, finite `ConformanceCase` set. Each
case supplies bindings, atom valuations, and an optional reviewed `shrinksTo`
link. The CLI evaluates the selected `Clause.ast` as the reference relation and
compares it with a named JavaScript adapter export. A pass is `executed`
conformance evidence over those inputs; it is not a Lean proof that arbitrary
application execution refines the clause.

`dspec query` is the deterministic read API for the model. It accepts `rule`,
`term`, `evidence`, `impact`, or `clause` lookup, emits locale-aware JSON or
Markdown, and returns resolvable model evidence. An AI may translate a natural
language question into this structured query, but it must not become the
source of truth. Supply its candidate `{ classification, evidence }` JSON with
`--answer` to reject labels or evidence that do not match the deterministic
result.

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
  Lean, Quint, Alloy, Pkl, and runtime collector manifests.
- Top-level CLI usage is generated from a command registry. README/docs/Taskfile
  command examples are checked and help-smoked against that live surface, with a
  holdout Markdown fixture covering extractor shapes such as fenced `dspec`,
  `node $OLDPWD`, pipes, and inline backticks.
- `coverage` requires approved active rules to have automated check targets,
  and can require clause-level support through `Rule.coverage = "clause"` plus
  `CheckTarget.covers`. `CheckTarget.assurances` distinguishes a resolvable
  `reference` from `executed`, `mutation-tested`, `bounded`, and `proved`
  support. Stronger claims require `assuranceEvidence`, and
  `Rule.requiredAssurances` makes missing assurance fail coverage. QuickCheck
  output preserves these fields and rechecks them as a generated property;
  compatibility review classifies added requirements as narrowing and removed
  requirements as widening.
- `domain-coverage` requires tracked domain pattern elements to be grounded in
  approved rules by stable ids, so orphan Cloud/Data/Release/Runtime/Intent model
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
  `evaluate-external-holdouts` aggregates separately stored external holdouts,
  keeping observed implementation facts distinct from authored gold facts and
  recording source revision, retrospective authoring estimate, manual mapping
  count, documented exclusions, and replayed implementation changes. Its
  Markdown report is intended for review; JSON is the CI contract.
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
- `impact --json` compares two spec entrypoints and maps changed
  terms/rules/projections/formalizations/refinements to affected generated
  selectors, implementation references, named formal checks that require
  re-verification, owned artifact `regenerate`/`remove` actions, and the
  after-side `dspec generate` command.
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
  Alloy, Quint, Lean skeletons, runtime collector manifests, and
  generated-artifact source maps.
- `patterns.db` models database tables, invariants, transactions, and
  migrations, then projects preservation, mapping-coverage, and mapping
  well-formedness checks to QuickCheck, Alloy, and Quint.
- `import-db-schema` seeds `patterns.db.tables` from existing SQL
  `CREATE TABLE` DDL, preserving primary keys, uniqueness, nullability, and
  foreign references as deterministic JSON or Pkl fragments.
- `check-sql-queries` checks sqlc-style SQL query catalogs against
  `patterns.db` for table/column drift, `SELECT *`, missing tenant filters,
  missing FK joins, and tenant-scoped inserts that omit the tenant column.
- `patterns.cloud` models network zones, cloud nodes, flows, and explicit
  access policies, then projects boundary, sensitive-resource policy,
  tenant-propagation, and queue idempotency checks to QuickCheck, Alloy, and
  Quint.
- `patterns.data` models data classifications, datasets, stores, placements,
  and flows, then projects encryption-at-rest, deletion support,
  cross-region-transfer basis, and retention-policy checks to QuickCheck,
  Alloy, and Quint.
- `patterns.release` models services, environments, gates, rollbacks,
  migrations, and release steps, then projects production health-gate, traffic
  rollback, rollback-test, and migration-compatibility checks to QuickCheck,
  Alloy, and Quint.
- `patterns.runtime` models services, dependencies, signals, runbooks, alerts,
  and SLOs, then projects critical-SLO page-alert, tested-runbook,
  dependency-timeout, and retry-idempotency checks to QuickCheck, Alloy, and
  Quint.
- `patterns.runtime` also accepts imported runtime evidence records for
  telemetry windows, alert policies, runbook executions, and dependency traces,
  then projects evidence coverage and drift checks to QuickCheck, Alloy, and
  Quint. Runtime evidence expectations can require freshness with
  `freshWithinDays` and `asOf`; `verify-runtime-evidence --json` also emits an
  evidence quality summary with missing, stale, freshness-checked, and score
  counts.
- `patterns.intent` models a bounded human-level Process as declared input
  state, typed input/output contracts, Outcome, required Capability, observable
  effect, ConstructionAuthority, explicit refinement mapping, and finite
  Scenario trace. `IntentField` supports scalar type, requiredness, enum,
  range, and pattern constraints; relational or quantified conditions remain
  `Clause.ast` obligations. `intent verify` validates a bounded observed trace
  through those mappings and records source/model digests plus assumptions.
  `intent exercise` additionally invokes a `function`, `http-route`, or
  `transaction` refinement with each trace input and compares its JSON return
  value with the observed output. Outcomes can declare typed required or
  optional effect postconditions; `intent verify` checks the step's `effects`
  observations through their refinement bindings.
  A Process may also declare an `execution` policy with a finite
  `maxInFlight`, an `idempotencyKey` naming a required string or identifier
  input, a discrete `timeoutSteps` bound, and an optional adapter deadline
  `timeoutMs`. Quint checks the discrete declarations with an abstract finite
  scheduler; `timeoutMs` is exercised only by runtime adapters.
  It does not embed implementation code or claim universal equivalence:
  QuickCheck shrinks Process/Scenario ids and rechecks refinement bindings,
  Alloy checks closed construction relations, and Quint checks ordered trace
  continuity. Process and refinement references are included in drift
  detection.
- `verify-generated` executes generated QuickCheck output, compiles generated
  Lean output, typechecks generated Quint, and runs bounded Quint verification
  plus Alloy analyzer checks when their runtime dependencies are available.
- `verify-generated --json` emits a deterministic backend-status report for CI
  artifacts and future drift/coverage ingestion.
- `evidence create` executes the generated backends and records a typed
  evidence manifest containing model, source-map, and generated-artifact
  digests, tool versions, results, execution time, and Clause selectors.
  `evidence verify` rejects stale model/artifact/tool/result/binding data, while
  `evidence refresh` re-executes and replaces the manifest. Supply one or more
  `--intent-report` files to bind passing `intent exercise` evidence as well;
  verification then rejects a changed report, trace document, implementation
  module, or model digest.
- Clause/backend applicability is recorded per AST operator as `unmapped`,
  `textual`, `structural`, or `semantic`. Lean has a semantic path for Clauses
  composed only from `eq`, `neq`, `not`, and `implies`: it generates a
  satisfaction theorem and a clause-scoped artifact, so a passing manifest can
  authorize `proved` for that selector. Lean `atom`, `and`, `or`, and quantifier
  operators remain structural, Quint remains textual, and Alloy remains
  unmapped.
- the top-level `projections` entrypoint contract declares generated artifact
  ownership next to the source model. The current `self-markdown` projection
  expands `locales` into
  `generated/examples/{locale}/dspec.md` with exact freshness: `generate`
  creates missing or stale outputs and removes output-template matches for
  undeclared locales, while `generated check` reports drift without writing.
  Each projection also declares a `provenance` path that binds the model,
  projection, emitter version, stable generation time, and artifact digests.
- `generate --dry-run --json` returns the same create/update/remove/unchanged
  plan without touching the filesystem. The planner lives in the public pure
  `@mizchi/dspec/projection` core; the CLI applies its plan as a staged
  transaction and rolls back already committed paths if a later commit fails.
  A generation-root lock serializes concurrent writers and is released on both
  success and rollback. The lock records PID, hostname, acquisition time, and
  a private ownership token. A 15-minute lease is renewed while staging and
  committing. `generated unlock` removes a dead local owner or an expired
  lease; active foreign/unknown owners require an explicit `--force`.
  Machine consumers should use `regenerateArgv` rather than parsing the
  shell-formatted `regenerateCommand` returned by impact reports.
- `generated/examples/ja/dspec.md` and `generated/examples/en/dspec.md` are the
  checked-in localized Markdown review artifacts owned by that projection;
  each rule includes review metadata such as source path, coverage mode,
  clause selectors, checks, and implementation refs. The top-level review
  summary records approved-rule, automated-check, implementation-ref,
  projection, domain-element, and runtime-evidence counts.
- `generated/examples/{ja,en}/sample-webapp-2026.md` applies the same contract
  to the real-app dogfood model, so Projection behavior is not validated only
  against dspec's unusually large self specification.
- `generated/holdouts/` exercises a deeply nested single-locale layout and a
  monorepo layout with two independent projections, preventing the planner and
  ownership checks from specializing to the self-model path shape.
- `generated/source-map.json` maps generated selectors back to source `Rule`,
  `Clause`, `CheckTarget`, and Intent Goal/Claim/AssuranceTask paths.
- `generated/manifest.json` records SHA-256 freshness hashes for primary
  generated artifacts.
- `fixtures/reports/generate-projection.json` and
  `fixtures/reports/generated-check-projection.json` lock the machine-readable
  Projection materialization and freshness report contracts.
- `normalize-counterexamples` turns generated backend failures into `Rule.id`,
  source path, generated selector, and reviewable explanation records. When
  Quint/Alloy output contains generated selectors, the source map resolves them
  back to concrete spec records.
- `flake.nix` provides the devShell used to put Z3 and the Quint/Alloy tools on
  `PATH`.
- `.github/workflows/check.yml` runs an Ubuntu `check:fast` job with pnpm,
  Pkl, and pkfire CAS caches in parallel with a macOS/Nix `check:formal` job.
  The formal job requires devShell tools plus Lean/Quint/Alloy execution while
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

Each Pkl entrypoint exposes a typed `model` and may expose a typed top-level
`projections` listing. Keeping ownership at the entrypoint boundary means a
module that imports and amends `base.model` derives the logical specification
without inheriting where the base entrypoint materializes generated files.

`Model` is the logical master record.

- `vocabulary`: language-independent domain terms with localized labels.
- `rules`: spec atoms such as `permission`, `prohibition`, `obligation`,
  `invariant`, and `transition`.
- `decisions`: append-only design history.
- `domainPacks`: preset pack helper contracts for local domain DSL modules.
- `checks`: links from a rule to verification backends such as Lean, Alloy,
  Quint, Rego, Playwright, or runtime monitoring.
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
- `patterns.intent`: optional executable-intent model with `capabilities`,
  `outcomes`, `processes`, `constructionAuthorities`, and `scenarios`.
  A Process declares stable-id inputs, results, dependencies, effects,
  constructions, transitions, and optional implementation references; it is
  not a general-purpose implementation language.

The top-level `projections` listing contains typed ownership and freshness
contracts for generated artifacts. `kind = "markdown"` with
`matrix = "locales"` expands a Markdown artifact for every locale and requires
one `{locale}` placeholder. The `single` matrix owns one kind-specific artifact
for `quickcheck`, `lean`, `alloy`, `quint`, `source-map`, or
`generated-manifest`; each kind has a required output extension. `output` and
the required non-templated JSON `provenance` path must stay below the generation
root and cannot collide. Repeated generation preserves `generatedAt` while
deterministic inputs are current; `--generated-at <iso>` exists for reproducible
fixtures and first generation. An `AssuranceEvidenceManifest` remains a record
of an executed verification and is created or verified through `evidence`, not
overwritten by static projection generation.

Domain preset packs under `dspec/domains/` are authoring helpers over this
shape. They do not add a separate semantics layer; they return ordinary Core IR
records so drift detection, coverage, Markdown rendering, QuickCheck, Lean,
Quint, and Alloy projections keep one source format.

`Clause.expr` is a stable compatibility string. `Clause.ast` is the first typed
expression layer: small boolean/relation nodes that emitters can preserve in
QuickCheck, Quint, and Lean outputs. The current implementation still falls back
to `expr` when `ast` is absent, which keeps older specs readable while giving
new specs a deterministic projection surface.

`Model.clauseAstSemanticsVersion` versions the interpretation contract for all
typed clauses in a model. Version `1.0` defines a minimal first-order boolean
fragment:
uninterpreted `atom` predicates, symbolic `eq`/`neq`, boolean
`not`/`and`/`or`/`implies`, and single-child `exists`/`forall` binders.
`dspec check` rejects nodes that use fields outside the selected operator's
semantics or models that request an unsupported semantics version. QuickCheck,
Quint, and Lean projections carry the version explicitly. The executable
reference semantics and conformance tests live in `src/core/clause-ast.mjs` and
`test/clause-ast-core.test.mjs`.

`src/core/assurance-evidence.mjs` separately records how each operator reaches
each backend. A `bounded` or `proved` target must select concrete clauses, those
clauses must carry `Clause.ast`, every selected operator must have `semantic`
backend support, and the referenced evidence manifest must contain a passing
clause-scoped artifact. File or theorem anchors alone are rejected.
The pure manifest/digest/support helpers are exported from `@mizchi/dspec` and
`@mizchi/dspec/assurance-evidence` for non-CLI integrations.

The semantic implementation is deliberately narrow. Generated Lean defines a
partial `ClauseEnv`, resolves `eq`/`neq` operands, recursively interprets `not`
and `implies`, and proves the selected `must` Clause for every environment.
`eq(x, x)` and `eq(x, y) -> eq(x, y)` succeed; an arbitrary non-reflexive
conclusion does not produce evidence without an actual proof. This proves the
Clause proposition, not the behavior of application code.

`patterns.db` is the first domain pattern. It separates DB structure from
transaction and migration behavior: tables declare columns, primary keys,
tenant columns, and foreign references; invariants name the tables they
constrain; transactions declare reads, writes, idempotency keys, and which
invariants they preserve; migrations declare source tables, target tables,
which invariants they preserve, and mapping witnesses for those preservation
claims. Generated QuickCheck/Quint/Alloy projections check that a transaction or
migration touching a table constrained by an invariant declares that invariant
in `preserves`, and that every migration `preserves` entry is covered by at
least one `DbMapping.invariants` entry. They also check that mapping
expressions mention the migration source and target tables, which keeps opaque
mapping text from drifting away from the tables it claims to connect.

`patterns.cloud` is the second domain pattern. It separates cloud topology from
implementation details: zones declare exposure, nodes declare resource kind and
tenant scope, flows declare source/target/action plus tenant propagation or
idempotency evidence, and policies declare which principal may access which
resource actions. Generated QuickCheck/Quint/Alloy projections check four cheap
cloud-architecture invariants: public ingress must not directly reach sensitive
resources, sensitive-resource access must have an explicit policy, tenant-scoped
flows must propagate tenant context, and queue publish flows must carry an
idempotency key.

`patterns.data` is the third domain pattern. It separates data governance from
provider-specific infrastructure: policies declare classification-level
retention limits, datasets declare classification/residency/retention, stores
declare region/encryption/deletion support, placements declare where datasets
are stored, and flows declare store-to-store movement with purpose and optional
legal basis. Generated QuickCheck/Quint/Alloy projections check that sensitive
data placements use encrypted stores, personal data placements use stores that
support deletion, cross-region personal-data flows have a legal basis, and
dataset retention stays within the classification policy.

`patterns.release` is the fourth domain pattern. It separates release safety
from CI/CD vendor details: services and environments define deployment targets,
gates define review/test/health evidence, rollback plans declare whether they
are tested, migrations declare backward compatibility, and release steps attach
strategy, traffic percentage, gates, rollback, and migration evidence.
Generated QuickCheck/Quint/Alloy projections check that production release steps
have health gates, production traffic shifts have rollback plans, referenced
rollback plans are tested, and production migrations are backward compatible.

`patterns.runtime` is the fifth domain pattern. It separates runtime safety
from monitoring vendor details: services declare criticality, dependencies
declare target/kind/timeout/retry/idempotency intent, signals declare observed
indicators, runbooks declare tested operational response, alerts connect
signals to severity and response, and SLOs declare service-level targets.
Generated QuickCheck/Quint/Alloy projections check that critical-service SLOs
have page alerts, page alerts have tested runbooks, dependencies have positive
timeouts, and retryable dependencies are explicitly idempotent.
The same pattern now accepts imported evidence records: telemetry windows are
matched to SLOs and checked against targets, page alerts are matched to enabled
alert policies, page-alert runbooks are matched to passing execution records,
and dependency traces are checked against declared timeouts. This detects
implementation/operation drift in the imported evidence; it does not by itself
prove production reliability or telemetry completeness outside the imported
records.

`patterns.intent` is the sixth domain pattern. It captures a bounded
human-level operation without turning the spec into an implementation language:
Capabilities name dependencies and observable effects, Outcomes bind domain
results to vocabulary states, Processes declare their input, possible results,
transitions, and legal constructions, and ConstructionAuthority closes the
paths that may create each Outcome. Scenarios are finite ordered traces used to
check that Process inputs, transitions, and final states compose. QuickCheck
generates Process/Scenario ids with deterministic shrinking, Alloy checks that
declared constructions are authorized, and Quint checks trace continuity. A
Process may carry `implementedBy` references so the normal drift detector can
find a removed implementation symbol or path.

`IntentGoal` adds a human-readable desired state above bounded Processes.
Each Goal names its Process intents, reviewable `IntentClaim` records, and
explicit non-goals. A Claim states a behavioral, safety, security, temporal,
or compliance property for one or more Processes. It must have one or more
`IntentAssuranceTask` records and, by default, an `IntentSemanticBinding` to an
implementation-observation boundary. Tasks select a `property-test`,
`formal-model`, `runtime-observation`, or `manual-review` method with an
explicit backend, assurance strength, target, and assumptions. `intent graph`
checks those links and reports missing task or implementation coverage.

This graph makes natural-language Intent reviewable and localizable without
treating language-model interpretation as proof. An LLM may later propose
Goals, Claims, bindings, or a semantic-diff review plan, but its output must
be written as candidate records and pass the same deterministic graph,
implementation-drift, and evidence gates before it becomes specification
state.

An Intent Process may additionally declare `inputContract`, each Outcome may
declare `outputContract` and outcome-specific `effects`, and a Process may
declare `refinements`. Contracts
provide typed scalar fields (`string`, `integer`, `boolean`, `identifier`) with
requiredness, allowed values, bounds, and regex patterns. A refinement maps
canonical contract fields to handler, route, transaction, topic, or worker
payload fields and is drift-checked as an implementation reference. Generate
the model-specific observation shape with `dspec intent schema <model.pkl>`;
validate bounded trace evidence with
`dspec intent verify --json <model.pkl> <traces.json>`. To execute local
`code` or `test` function refinements against those same finite cases, use
`dspec intent exercise --json <model.pkl> <traces.json>`. `exercise` compares
the complete JSON return value with the observed implementation payload and
records an executed-refinement evidence check. Each function case runs in a
fresh Node child process with the Node permission system: filesystem writes,
child processes, and worker threads are denied, and the report records the
timeout, Node version, and implementation digest. This is not network
isolation; use a container or runner-level egress policy when the implementation
must not make network calls. An `http-route` refinement declares a typed method,
path, and expected status; pass `--http-base-url <url>` to run its JSON request
and response against an environment-specific host. Pass `--output` and then
`evidence create --intent-report` to make a report stale when its model, trace,
implementation, or report digest changes. A `transaction` refinement names a
declared `patterns.db.transactions` entry and runs a Node transaction-journal
adapter. The implementation receives `read(table)`, `write(table)`,
`effect(id, payload)`, and `commit()`; the adapter rejects undeclared table or
effect use and compares the committed journal with the observed trace. This is
a bounded interaction conformance harness, not a proof of a deployed database
engine's isolation semantics. `queue-topic` and `worker` refinements remain
rejected until dedicated adapters define their isolation and observation
contracts. `intent coverage` turns valid finite traces into a coverage oracle:
it requires every declared transition, refinement/outcome pair, mapped
input/output field, and declared effect payload field to be observed at least
once. `intent mutation` starts from a valid trace document and deterministically
generates nearby negative cases such as removed required fields, substituted
outcomes, and missing/unexpected/invalid effects; its score is the fraction
rejected by the same verifier. These are finite detector checks, not a measure
of all production faults. Both commands provide runtime conformance
evidence for supplied observations, not a proof that all production executions
refine the model.

`IntentProtocolTest` is a reviewed, finite request/expected-result case held in
the Pkl model rather than in a language-specific test file. It names a Process,
Outcome, and `http-route` or `grpc-method` refinement, and supplies canonical
contract values as strings. `dspec intent generate-tests --json <model.pkl>`
decodes and maps those values into a transport-neutral plan plus an Intent trace
document. `dspec intent test` verifies the generated trace and executes it:
HTTP uses `--http-base-url`; gRPC uses `--grpc-runner`, an executable that reads
one JSON request from stdin and writes one JSON response to stdout. The runner
request is `{ protocol: "dspec-grpc-runner-v1", method, input, timeoutMs }`; the
response is `{ code, output }`, where `code` is a gRPC status name such as `OK`.
This keeps the contract and oracle portable across TypeScript, Go, Java, Rust,
or other clients while making the selected runner and finite-case boundary
explicit evidence rather than a claim of universal implementation equivalence.
See [`docs/protocol-tests.md`](docs/protocol-tests.md) for the Pkl shape and
runner contract.

`patterns.domain` is the DDD-oriented source for `DomainEnum`, Value Object,
Entity, Aggregate, Command, Domain Event, and Domain Invariant declarations.
An Invariant points to its normative Rule; `DomainFormalization` records which
Behavior, LeanCore, AlloyBehavior, or direct formal-link artifact checks that
Rule and is included in normal implementation-drift checks.
`DomainFormalizationRefinement` explicitly connects an abstract formalization
to a concrete one through named conditions and the concrete model's stable
checks; traceability requires evidence for both endpoints and those checks.
This is bounded evidence for the declared correspondence, not an automatic
claim that production code refines either model. `dspec domain ir`
emits a stable language-neutral code-generation IR. The built-in
`dspec domain generate --language typescript` renderer produces only domain
types, repository ports, command/event payloads, and intentionally incomplete
constructor stubs. It never invents persistence, transport, validation-library,
or business-decision code. Other language renderers consume the same IR rather
than reinterpreting Pkl. The Markdown projection and source map retain each
DDD declaration and field for source-level traceability. See
[`docs/domain-model.md`](docs/domain-model.md).

`dspec domain relationships` derives a reviewable relationship ledger and
Mermaid graph from the same catalog: DDD declarations, Rule links, checks,
implementation references, and selected formal artifacts appear as typed
edges. It records traceability rather than inventing semantic equivalence; the
linked artifact's assurance and verifier result remain the basis for a
correctness claim.

`IntentScenario` may be categorized (`success`, `rejection`, `retry`,
`conflict`, or `timeout`) and marked required. `intent corpus` keeps normal
trace verification permissive, but requires one structurally matching observed
trace for every required scenario and emits deterministic missing-case
suggestions without inventing business input values. `IntentAccessPolicy`
declares an allow/deny decision for one actor or role and Process. Higher
priority rules win; a declared override must name the same Process/subject at a
lower priority, and equal priorities are rejected as ambiguous. Query the
resolved policy with `intent access`.

`IntentSemanticBinding` is an adapter-neutral bridge from the intent model to
observed implementation facts. It describes a required `http-route`,
`db-transaction`, `cloud-resource`, or `otel-attribute` as a `kind`, `target`,
and optional `value`. `intent bindings` compares a normalized observed manifest
with those declarations: missing required bindings mean implementation evidence
is incomplete; observed but undeclared bindings mean the spec is incomplete.
It does not parse arbitrary application code, prove endpoint behavior, or prove
deployment state. The corresponding adapters must produce the manifest.

A Process may also declare `execution = new d.IntentExecutionPolicy { ... }`.
`maxInFlight` is a finite concurrency bound, `idempotencyKey` names a required
`identifier` or `string` field in the input contract, and `timeoutSteps` is a
discrete abstract scheduler bound. `timeoutMs` is an optional wall-clock
deadline enforced by `intent exercise` adapters; it is not projected into the
Quint scheduler. `intent exercise --policy` is an explicit test/staging opt-in:
it replays one verified input `maxInFlight + 1` times, using the same mapped
idempotency-key value, with at most `maxInFlight` client invocations at once.
The resulting evidence records response/effect consistency and client-side
pressure. It does not prove an internal queue, distributed idempotency store,
DB isolation level, retry implementation, or deployment capacity. The
generated Quint model starts, completes, ticks, and expires bounded executions;
Quint's bounded TLC backend checks the in-flight bound, unique active
idempotency keys, and elapsed-step
bound. Introducing or tightening this policy is classified as narrowing by
`spec-change compat`; relaxing it is widening, while mixed changes or replacing
an idempotency key are unknown and require review.

`import-runtime-evidence` is the first importer boundary. It accepts
provider-scoped JSON exports under `prometheus.telemetry`,
`pagerduty.alertPolicies`, `incident.runbookExecutions`, and
`otel.dependencyTraces` or `otel.intentExecutions`, then emits either a
deterministic Pkl fragment for a `RuntimeModel` block or stable JSON with
`--json`.

`collect-runtime-evidence` is the first collector boundary. It reads a manifest
of provider API payload sources from `file`, `inline`, or live `http` entries
and aggregates Prometheus vector responses, PagerDuty-style alert policy
exports, incident/runbook execution exports, and OpenTelemetry span exports
into that provider-scoped import JSON. HTTP entries support GET, optional
headers, and `timeoutMs`; the default output is stable JSON, while `--pkl`
pipes the collected result through `import-runtime-evidence` and emits a
Runtime evidence Pkl fragment.

`emit runtime-collector` generates the expected collector manifest from a
Runtime safety and Intent execution specs. It turns SLOs, page alerts, runbooks,
dependencies, and Process execution policies
into provider/kind/path/query entries with `sourceMap` records back to the
authoritative spec item. The generated manifest can be used as the handoff
contract for recorded payloads and live HTTP collectors.

Intent execution collector entries use OTel `intentExecutions` spans with
`dspec.intent.process`, `dspec.intent.refinement`,
`dspec.execution.max_in_flight`, and
`dspec.execution.duplicate_suppressed` attributes, plus the standard
idempotency-key presence attribute. They check observed values against the
declared execution policy. They do not prove a distributed idempotency store,
internal queueing, database isolation, or capacity under real load.

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
- backend-aware check target anchors for Playwright, Lean, Quint, Alloy, Pkl,
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
  Quint/Alloy tools can be installed or absent without changing the fixtures
- generated QuickCheck execution and generated Lean compilation for
  `dspec verify-generated`
- generated Quint typechecking and Alloy structural validation for
  `dspec verify-generated`
- bounded `quint verify` and Alloy analyzer checks when Java and `alloy6` are
  available, for example through `nix develop path:$PWD`
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
- localized generated Markdown review artifact drift under `generated/examples/`
- generated source-map artifact drift via `generated/source-map.json`
- JSON verification report shape via `dspec verify-generated --json`
- counterexample normalization from generated backend failures to source
  `Rule.id`, source-map paths, and Quint/Alloy generated-selector witnesses
- stale runtime evidence detection via `freshWithinDays` and `asOf`

These are deliberately cheap checks, but they are now load-bearing: a fixture
with an unsupported approved rule fails generated QuickCheck and Lean, and in
the Nix shell also fails the Quint/Alloy backend gates. The normalizer maps
those failures back to spec source records. The useful next step is to split the
remaining checker and generators into reusable core modules. Clause AST
semantics and real-app normalization already have filesystem-independent core
APIs; most validation, report, and emitter logic still lives in the Node CLI.

## Evaluation

See `docs/usability-evaluation.md` for the current usability assessment,
`docs/dogfooding-2026-07-14-mnemo.md` for the latest external importer run, and
`docs/dogfooding-2026-07-14-assurance.md` for the latest self-spec assurance
review.
`examples/dspec.pkl` is now usable as the prototype's active self-spec ledger;
the remaining gap is full backend semantics for `Clause.ast`,
backend-specific proof/model-check generation beyond the current QuickCheck,
Lean, Quint typecheck/verify, Alloy analyzer gates, and richer counterexample
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
`docs/alloy-behavior-dsl.md` adds a separate, closed relational-temporal
authoring experiment: an exclusive reservation relation renders native Alloy 6
mutable state and temporal checks, then retains bounded counterexamples in
domain vocabulary. It does not make arbitrary Alloy syntax the source DSL or
claim implementation refinement.
`domain-coverage` adds a meta-check over these patterns: it does not prove the
domain facts themselves, but it detects facts that are present in the model and
not mentioned by any approved rule. `examples/sample-webapp-2026.pkl` is the
first real-app dogfood model for that check.

See `docs/semantic-model.md` for the working ontology: dspec rules are treated
as inferon-like claims, support is provided by checks and implementation
references, and deterministic emitters act as projections into review and
verification sites.
