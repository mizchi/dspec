# DSpec self specification

- model: `dspec-self`
- version: `0.1.0`
- locale: `en`

## Review Summary

- approvedRules: `69`
- automatedCheckTargets: `302`
- implementationRefs: `637`
- domainElements: `0`
- runtimeEvidenceRecords: `0`
- assuranceTargets: `reference=302, executed=4, mutation-tested=1, bounded=0, proved=0`

## Vocabulary

- `actor.spec_author` (actor): spec author
- `artifact.app_profile` (entity): application verification profile
- `artifact.app_profile_scenario` (entity): application profile evaluation scenario
- `artifact.app_profile_suite` (entity): application profile registry suite
- `artifact.assurance_evidence_manifest` (entity): assurance evidence manifest
- `artifact.authoring_shorthand` (action): authoring shorthand
- `artifact.breaking_change_policy` (entity): breaking change policy
- `artifact.checker` (action): consistency check
- `artifact.clause_coverage` (action): clause-level coverage
- `artifact.cli` (entity): dspec CLI
- `artifact.cloud_topology_pattern` (entity): Cloud topology pattern
- `artifact.command_example` (entity): documented CLI command example
- `artifact.command_registry` (entity): CLI command registry
- `artifact.compat_report` (entity): spec compatibility report
- `artifact.counterexample_normalizer` (action): counterexample normalization
- `artifact.coverage_oracle` (action): spec coverage oracle
- `artifact.data_governance_pattern` (entity): Data governance pattern
- `artifact.db_model_pattern` (entity): DB model pattern
- `artifact.db_schema_importer` (action): DB schema importer
- `artifact.dogfood_task` (action): dogfood evaluation task
- `artifact.domain_coverage_oracle` (action): domain model coverage oracle
- `artifact.domain_preset_pack` (entity): domain preset pack
- `artifact.drift_detector` (action): implementation drift detection
- `artifact.drift_guard_evaluation` (action): false-positive and false-negative drift guard evaluation
- `artifact.evidence_quality_summary` (entity): evidence quality and freshness summary
- `artifact.failure_suggestion` (entity): failure suggestion
- `artifact.formal_backend` (entity): formal-method backend format
- `artifact.generated_manifest` (entity): generated artifact manifest
- `artifact.generator` (action): deterministic generator
- `artifact.i18n_contract` (entity): i18n semantic contract
- `artifact.impact_report` (entity): spec diff impact report
- `artifact.json_report` (entity): JSON report
- `artifact.markdown` (entity): Markdown specification document
- `artifact.nix_dev_shell` (entity): Nix devShell
- `artifact.observed_app_facts` (entity): observed application facts
- `artifact.package_release` (action): npm package release
- `artifact.pkl_model` (entity): Pkl spec model
- `artifact.profile_scaffold` (action): app profile authoring scaffold
- `artifact.profile_scaffold_diff` (action): app profile scaffold drift diff
- `artifact.quickcheck` (entity): QuickCheck-style property test
- `artifact.real_app_importer` (action): real application artifact importer
- `artifact.real_app_model` (entity): real application dogfood model
- `artifact.reconciliation_oracle` (action): spec-to-artifact reconciliation oracle
- `artifact.release_safety_pattern` (entity): Release safety pattern
- `artifact.renderer` (action): natural-language rendering
- `artifact.report_fixture` (entity): JSON report compatibility fixture
- `artifact.reverse_coverage_oracle` (action): observed-to-spec reverse coverage oracle
- `artifact.runtime_collector_fixture` (entity): Runtime collector fixture
- `artifact.runtime_collector_manifest` (entity): Runtime collector manifest
- `artifact.runtime_evidence_collector` (action): Runtime evidence collector
- `artifact.runtime_evidence_importer` (action): Runtime evidence importer
- `artifact.runtime_evidence_pattern` (entity): Runtime evidence pattern
- `artifact.runtime_evidence_verifier` (action): Runtime evidence verifier
- `artifact.runtime_safety_pattern` (entity): Runtime safety pattern
- `artifact.schema` (entity): dspec schema
- `artifact.source_map` (entity): generated source map
- `artifact.spec_change_review` (entity): spec change review
- `artifact.spec_change_review_scaffold` (action): spec change review scaffold
- `artifact.spec_reading_eval` (entity): spec reading evaluation set
- `artifact.sql_query_oracle` (action): SQL query oracle
- `backend.pkl` (entity): Pkl evaluator
- `backend.pkl_mbt` (entity): mizchi/pkl-mbt
- `concept.clause_backend_support` (value): Clause/backend support level
- `concept.clause_expr` (value): Clause.expr
- `concept.cloud_flow` (relation): Cloud flow
- `concept.cloud_node` (entity): Cloud node
- `concept.cloud_policy` (relation): Cloud policy
- `concept.cloud_zone` (entity): Cloud network zone
- `concept.data_flow` (relation): Data flow
- `concept.data_placement` (relation): Data placement
- `concept.data_policy` (relation): Data governance policy
- `concept.data_set` (entity): Data set
- `concept.data_store` (entity): Data store
- `concept.db_invariant` (relation): DB invariant
- `concept.db_mapping` (relation): DB migration mapping
- `concept.db_migration` (action): DB migration
- `concept.db_transaction` (action): DB transaction
- `concept.expr_ast` (value): Clause.ast expression AST
- `concept.inferon` (entity): inferon-like spec claim
- `concept.localized_text` (value): localized text
- `concept.release_environment` (state): Release environment
- `concept.release_gate` (relation): Release gate
- `concept.release_migration` (action): Release migration
- `concept.release_rollback` (action): Release rollback
- `concept.release_service` (entity): Release service
- `concept.release_step` (action): Release step
- `concept.rule` (entity): spec rule
- `concept.runtime_alert` (action): Runtime alert
- `concept.runtime_alert_policy` (relation): Runtime alert policy
- `concept.runtime_dependency` (relation): Runtime dependency
- `concept.runtime_dependency_trace` (event): Runtime dependency trace
- `concept.runtime_evidence_collection` (action): Runtime evidence collection
- `concept.runtime_evidence_import` (action): Runtime evidence import
- `concept.runtime_runbook` (action): Runtime runbook
- `concept.runtime_runbook_execution` (event): Runtime runbook execution
- `concept.runtime_service` (entity): Runtime service
- `concept.runtime_signal` (relation): Runtime signal
- `concept.runtime_slo` (relation): Runtime SLO
- `concept.runtime_telemetry` (relation): Runtime telemetry
- `concept.stable_id` (value): stable id
- `concept.support` (relation): support relation
- `concept.term` (entity): vocabulary term
- `concept.verification_target` (relation): verification target

## Rules

### DSPEC-APP-PROFILE

App profiles bundle real-app dogfood verification gates as typed Pkl configuration

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference, executed, mutation-tested
- term: `artifact.app_profile`
- term: `artifact.app_profile_scenario`
- term: `artifact.app_profile_suite`
- term: `artifact.drift_guard_evaluation`
- term: `artifact.failure_suggestion`
- term: `artifact.profile_scaffold`
- term: `artifact.profile_scaffold_diff`
- term: `artifact.real_app_importer`
- term: `artifact.real_app_model`
- term: `artifact.reconciliation_oracle`
- term: `artifact.reverse_coverage_oracle`
- must: `scaffoldAppProfile(modelPath, appRoot).emits(AppProfile)`
- must: `scaffoldAppProfile(...).roundTrips(checkAppProfile)`
- must: `checkAppProfile(profile).runs(check + drift + domainCoverage + import + reconcile + reverseCoverage)`
- must: `checkAppProfile(profiles).aggregates(profileReports)`
- must: `checkAppProfile(scaleFixture).preserves(aggregateReportShape)`
- must: `checkAppProfileSuite(suite).loads(profileRegistry)`
- must: `observedFacts.fixture == importRealApp(appRoot)`
- must: `checkAppProfile(--fix, profile).refreshes(observedFacts)`
- must: `checkAppProfile(--fix --dry-run, profile).wouldFix(observedFacts)`
- must: `checkAppProfile(profile).preserves(gate.suggestions)`
- must: `checkAppProfile(--markdown, profile).renders(reviewTable)`
- must: `scaffoldAppProfile(--diff, profile).reports(scaffoldDrift)`
- must: `scaffoldAppProfile(--apply --dry-run, profile).previews(scaffoldDrift)`
- must: `scaffoldAppProfile(--apply, profile).writes(AppProfile)`
- must: `evaluateAppProfile(profile).checks(falsePositive + falseNegative)`
- must: `evaluateAppProfile(profile.scenarios).usesDeclaredScenarioDsl`
- must: `evaluateAppProfile(profile.scenarios).covers(releaseGate + route + schema + workflow + dataStore + runtimeDependency)`
- must: `evaluateAppProfile(--markdown, profile).renders(scenarioReviewTable + suggestionKind + mutation)`
- must: `coverageAppProfileScenarios(profile).requires(gateCoverage + categoryCoverage)`
- must: `coverageAppProfileScenarios(profile).countsOnly(evaluateAppProfileScenario.status == pass)`
- must: `profile.requiredScenarioCategories.scopes(categoryCoverage) && includes(inferredScenarioCategories)`
- must: `scoreAppProfileMutations(profile).generates(requiredScenarioCategories x suggestionKinds)`
- must: `scoreAppProfileMutations(profile).score == detected / generated && includes(shrinks)`
- must: `scoreAppProfileMutations(holdoutProfiles).guardsAgainst(sampleOverfit)`
- must: `scoreAppProfileMutations(profile).witnesses.stableUnder(orderPermutation + unrelatedObservedFacts)`
- must: `replayAppProfileChanges(corpus).matches(expectedDriftLabels)`
- must: `evaluateAppProfileSuite(suite).aggregates(profileEvaluations)`
- check: node test/cli.test.mjs#checks app profiles as a dogfood bundle [reference]
- check: node test/cli.test.mjs#checks multiple app profiles as an aggregate bundle [reference]
- check: node test/cli.test.mjs#checks app profile suites from a registry [reference]
- check: node test/cli.test.mjs#renders app profile reports as markdown [reference]
- check: node test/cli.test.mjs#scaffolds app profiles for AI authoring [reference]
- check: node test/cli.test.mjs#checks scaffolded app profiles after saving them [reference]
- check: node test/cli.test.mjs#diffs scaffolded app profiles against existing profiles [reference]
- check: node test/cli.test.mjs#reports scaffolded profile drift as JSON [reference]
- check: node test/cli.test.mjs#applies scaffolded app profile updates safely [reference]
- check: node test/cli.test.mjs#evaluates app profile false-positive and false-negative guards [reference]
- check: node test/cli.test.mjs#evaluates declared app profile scenarios [reference]
- check: node test/cli.test.mjs#evaluates extended app profile scenario patterns [reference]
- check: node test/cli.test.mjs#renders app profile evaluation reports as markdown [reference]
- check: node test/cli.test.mjs#reports app profile scenario coverage [reference]
- check: node test/cli.test.mjs#scopes app profile scenario coverage to required categories [reference]
- check: node test/cli.test.mjs#rejects missing required app profile scenario category coverage [reference]
- check: node test/cli.test.mjs#rejects underdeclared app profile scenario categories inferred from the model and observed app [reference]
- check: node test/cli.test.mjs#does not count ineffective app profile scenarios as scenario coverage [reference]
- check: node test/cli.test.mjs#scores generated app profile mutations [reference, executed, mutation-tested]
- assuranceEvidence: executed -> Taskfile.pkl#test
- assuranceEvidence: mutation-tested -> fixtures/reports/score-app-profile-mutations.json
- check: node test/cli.test.mjs#scores generated app profile mutations for route-only profiles [reference]
- check: node test/cli.test.mjs#scores generated app profile mutations on holdout fixtures [reference]
- check: node test/cli.test.mjs#keeps generated app profile mutation witnesses stable under metamorphic app changes [reference]
- check: node test/cli.test.mjs#replays real app change corpus labels [reference]
- check: node test/cli.test.mjs#renders app change replay corpus as markdown [reference]
- check: node test/cli.test.mjs#keeps app change replay JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#renders app profile mutation scores as markdown [reference]
- check: node test/cli.test.mjs#keeps app profile mutation score JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app change replay JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile evaluation Markdown report fixture in sync [reference]
- check: node test/cli.test.mjs#evaluates app profile suites from a registry [reference]
- check: node test/cli.test.mjs#keeps app profile evaluation JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile scenario evaluation JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps extended app profile evaluation JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile scenario coverage JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile suite JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile suite evaluation JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps scaled app profile JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#refreshes stale app profile observed facts with --fix [reference]
- check: node test/cli.test.mjs#previews stale app profile observed fact refresh with --fix --dry-run [reference]
- check: node test/cli.test.mjs#keeps gate suggestions in failing app profile reports [reference]
- check: node test/cli.test.mjs#declares an app profile refresh task [reference]
- implementation: code dspec/Schema.pkl#AppProfile
- implementation: code dspec/Schema.pkl#AppProfileScenarioCategory
- implementation: code dspec/Schema.pkl#AppProfileScenario
- implementation: code dspec/Schema.pkl#AppProfileSuite
- implementation: code dspec/Schema.pkl#AppProfileChangeDrift
- implementation: code dspec/Schema.pkl#AppProfileChangeReplayCase
- implementation: code dspec/Schema.pkl#AppProfileChangeReplayCorpus
- implementation: code src/cli.mjs#loadAppProfileSuite
- implementation: code src/cli.mjs#loadAppProfileChangeReplayCorpus
- implementation: code src/cli.mjs#parseAppProfileArgs
- implementation: code src/cli.mjs#parseAppProfileSuiteArgs
- implementation: code src/cli.mjs#parseScaffoldAppProfileArgs
- implementation: code src/cli.mjs#parseEvaluateAppProfileSuiteArgs
- implementation: code src/cli.mjs#appProfileStep
- implementation: code src/cli.mjs#appProfileReport
- implementation: code src/cli.mjs#appProfilesReport
- implementation: code src/cli.mjs#appProfileCommandReport
- implementation: code src/cli.mjs#appProfileSuiteReport
- implementation: code src/cli.mjs#appProfileObservedFixtureStep
- implementation: code src/cli.mjs#renderAppProfileMarkdownReport
- implementation: code src/cli.mjs#scaffoldAppProfileDocument
- implementation: code src/cli.mjs#scaffoldAppProfile
- implementation: code src/cli.mjs#scaffoldAppProfileDiffReport
- implementation: code src/cli.mjs#scaffoldAppProfileApplyReport
- implementation: code src/cli.mjs#pklImportPath
- implementation: code src/cli.mjs#appProfileEvaluationReport
- implementation: code src/cli.mjs#appProfileEvaluationSuiteReport
- implementation: code src/cli.mjs#evaluateAppProfileScenario
- implementation: code src/cli.mjs#evaluateRemoveRouteScenario
- implementation: code src/cli.mjs#evaluateAddObservedRouteScenario
- implementation: code src/cli.mjs#evaluateRemoveContractSchemaScenario
- implementation: code src/cli.mjs#firstDetectableContractSchema
- implementation: code src/cli.mjs#evaluateAddObservedContractSchemaScenario
- implementation: code src/cli.mjs#evaluateRemoveWorkflowScenario
- implementation: code src/cli.mjs#evaluateAddObservedWorkflowScenario
- implementation: code src/cli.mjs#evaluateRemoveObservedDomainScenario
- implementation: code src/cli.mjs#evaluateAddObservedDomainScenario
- implementation: code src/cli.mjs#modelClauseExpressions
- implementation: code src/cli.mjs#modelRouteCandidates
- implementation: code src/cli.mjs#modelContractSchemaCandidates
- implementation: code src/cli.mjs#firstObservedModelRoute
- implementation: code src/cli.mjs#firstObservedModelContractSchema
- implementation: code src/cli.mjs#firstObservedModelWorkflow
- implementation: code src/cli.mjs#appProfileOrderedScenarioCategories
- implementation: code src/cli.mjs#appProfileInferredScenarioCategories
- implementation: code src/cli.mjs#appProfileRequiredScenarioCategories
- implementation: code src/cli.mjs#appProfileScenarioCategoryDeclarationErrors
- implementation: code src/cli.mjs#appProfileScenarioMatchesCoverageRequirement
- implementation: code src/cli.mjs#appProfileScenarioCoverageReport
- implementation: code src/cli.mjs#appProfileGeneratedMutationScenarios
- implementation: code src/cli.mjs#appProfileScenarioShrinks
- implementation: code src/cli.mjs#appProfileMutationScoreEntry
- implementation: code src/cli.mjs#appProfileMutationScoreReport
- implementation: code src/cli.mjs#appSurfaceFacts
- implementation: code src/cli.mjs#modelSurfaceFacts
- implementation: code src/cli.mjs#appChangeReplayChanges
- implementation: code src/cli.mjs#appChangeReplayCaseReport
- implementation: code src/cli.mjs#appChangeReplayCorpusReport
- implementation: code src/cli.mjs#renderAppProfileEvaluationMarkdownReport
- implementation: code src/cli.mjs#renderAppProfileScenarioCoverageMarkdownReport
- implementation: code src/cli.mjs#renderAppProfileMutationScoreMarkdownReport
- implementation: code src/cli.mjs#renderAppProfileMutationScoreReport
- implementation: code src/cli.mjs#renderAppChangeReplayMarkdownReport
- implementation: code src/cli.mjs#renderAppChangeReplayReport
- implementation: code src/cli.mjs#firstObservedReleaseGate
- implementation: runtime Taskfile.pkl
- implementation: model fixtures/sample-webapp-profile.pkl
- implementation: model fixtures/sample-webapp-profile-scenarios.pkl
- implementation: model fixtures/sample-webapp-profile-extended-scenarios.pkl
- implementation: model fixtures/sample-webapp-profile-route-scenarios.pkl
- implementation: model fixtures/sample-webapp-profile-route-missing-spec-scenario.pkl
- implementation: model fixtures/sample-webapp-profile-route-ineffective-scenario.pkl
- implementation: model fixtures/sample-webapp-profile-underdeclared-categories.pkl
- implementation: model fixtures/route-only-model.pkl
- implementation: model fixtures/route-only-app/apps/api/src/app.ts
- implementation: model fixtures/holdout-schema-model.pkl
- implementation: model fixtures/holdout-schema-profile.pkl
- implementation: model fixtures/holdout-schema-app/packages/contracts/src/index.ts
- implementation: model fixtures/holdout-workflow-model.pkl
- implementation: model fixtures/holdout-workflow-profile.pkl
- implementation: model fixtures/holdout-workflow-app/.github/workflows/ci.yml
- implementation: model fixtures/holdout-mixed-model.pkl
- implementation: model fixtures/holdout-mixed-profile.pkl
- implementation: model fixtures/holdout-mixed-app/apps/api/src/app.ts
- implementation: model fixtures/holdout-mixed-app/packages/contracts/src/index.ts
- implementation: model fixtures/holdout-mixed-app/.github/workflows/ci.yml
- implementation: model fixtures/holdout-mixed-shuffled-profile.pkl
- implementation: model fixtures/holdout-mixed-shuffled-app/apps/api/src/app.ts
- implementation: model fixtures/holdout-mixed-shuffled-app/packages/contracts/src/index.ts
- implementation: model fixtures/holdout-mixed-shuffled-app/.github/workflows/ci.yml
- implementation: model fixtures/holdout-mixed-noisy-profile.pkl
- implementation: model fixtures/holdout-mixed-noisy-app/apps/api/src/app.ts
- implementation: model fixtures/holdout-mixed-noisy-app/packages/contracts/src/index.ts
- implementation: model fixtures/holdout-mixed-noisy-app/.github/workflows/ci.yml
- implementation: model fixtures/holdout-mixed-noisy-app/.github/workflows/weekly-review.yml
- implementation: model fixtures/app-change-replay-corpus.pkl
- implementation: model fixtures/replay-missing-app/package.json
- implementation: model fixtures/replay-missing-app/apps/api/src/app.ts
- implementation: model fixtures/replay-missing-app/packages/contracts/src/index.ts
- implementation: model fixtures/sample-webapp-profile-suite.pkl
- implementation: model fixtures/reports/scaffold-app-profile-diff.json
- implementation: model fixtures/reports/evaluate-app-profile-sample-webapp.json
- implementation: model fixtures/reports/evaluate-app-profile-scenarios.json
- implementation: model fixtures/reports/evaluate-app-profile-extended-scenarios.json
- implementation: model fixtures/reports/evaluate-app-profile-extended-scenarios.md
- implementation: model fixtures/reports/coverage-app-profile-scenarios.json
- implementation: model fixtures/reports/replay-app-profile-changes.json
- implementation: model fixtures/reports/score-app-profile-mutations.json
- implementation: model fixtures/reports/evaluate-app-profile-suite.json
- implementation: model fixtures/reports/check-app-profile-sample-webapp.json
- implementation: model fixtures/reports/check-app-profile-suite.json
- implementation: model fixtures/reports/check-app-profile-scale.json

#### Review

- source: model.rules[22]
- coverage: rule
- automatedChecks: 41
- implementationRefs: 112
- selector: DSPEC-APP-PROFILE.must[0]
- selector: DSPEC-APP-PROFILE.must[1]
- selector: DSPEC-APP-PROFILE.must[2]
- selector: DSPEC-APP-PROFILE.must[3]
- selector: DSPEC-APP-PROFILE.must[4]
- selector: DSPEC-APP-PROFILE.must[5]
- selector: DSPEC-APP-PROFILE.must[6]
- selector: DSPEC-APP-PROFILE.must[7]
- selector: DSPEC-APP-PROFILE.must[8]
- selector: DSPEC-APP-PROFILE.must[9]
- selector: DSPEC-APP-PROFILE.must[10]
- selector: DSPEC-APP-PROFILE.must[11]
- selector: DSPEC-APP-PROFILE.must[12]
- selector: DSPEC-APP-PROFILE.must[13]
- selector: DSPEC-APP-PROFILE.must[14]
- selector: DSPEC-APP-PROFILE.must[15]
- selector: DSPEC-APP-PROFILE.must[16]
- selector: DSPEC-APP-PROFILE.must[17]
- selector: DSPEC-APP-PROFILE.must[18]
- selector: DSPEC-APP-PROFILE.must[19]
- selector: DSPEC-APP-PROFILE.must[20]
- selector: DSPEC-APP-PROFILE.must[21]
- selector: DSPEC-APP-PROFILE.must[22]
- selector: DSPEC-APP-PROFILE.must[23]
- selector: DSPEC-APP-PROFILE.must[24]
- selector: DSPEC-APP-PROFILE.must[25]
- selector: DSPEC-APP-PROFILE.must[26]

### DSPEC-ASSURANCE-EVIDENCE-MANIFEST

Formal assurance is verified by a manifest binding execution results to Clause/backend support

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference, executed
- term: `artifact.assurance_evidence_manifest`
- term: `artifact.formal_backend`
- term: `artifact.source_map`
- term: `concept.clause_backend_support`
- term: `concept.expr_ast`
- term: `concept.rule`
- term: `concept.verification_target`
- must: `evidence.create binds (modelDigest + sourceMapDigest + artifactDigest + toolVersion + result + executedAt)`
- must: `evidence.verify rejects stale(modelDigest || artifactDigest || toolVersion || result || clauseBindings)`
- must: `evidence.refresh == create(currentModel, currentTools)`
- must: `clauseBinding.support in {unmapped, textual, structural, semantic}`
- must: `formalAssurance -> selectors.nonEmpty && clauses.ast.nonEmpty && support == semantic && artifact.scope == clause && artifact.result == pass`
- must: `artifact.scope == generator -> assurance notIn {bounded, proved}`
- check: node test/cli.test.mjs#creates and verifies typed assurance evidence manifests [reference, executed]
- assuranceEvidence: executed -> Taskfile.pkl#test
- check: node test/cli.test.mjs#detects and refreshes stale assurance evidence manifests [reference]
- check: node test/cli.test.mjs#rejects formal assurance when backend binding is structural only [reference]
- check: node test/cli.test.mjs#rejects legacy references as formal assurance evidence [reference]
- implementation: code dspec/Schema.pkl#AssuranceEvidenceManifest
- implementation: code dspec/Schema.pkl#AssuranceEvidenceClauseBinding
- implementation: code src/core/assurance-evidence.mjs#assuranceEvidenceSnapshot
- implementation: code src/core/assurance-evidence.mjs#CLAUSE_BACKEND_OPERATOR_SUPPORT
- implementation: code src/core/assurance-evidence.mjs#verifyAssuranceEvidenceManifest
- implementation: code src/cli.mjs#createAssuranceEvidenceManifest
- implementation: code src/cli.mjs#assuranceEvidenceVerificationReport
- implementation: code src/cli.mjs#runEvidenceCommand
- implementation: code src/cli.mjs#validateCheckTargetAssuranceDeclarations
- implementation: model fixtures/typed-ast.pkl
- implementation: model fixtures/assurance-formal-unsupported.pkl

#### Review

- source: model.rules[16]
- coverage: rule
- automatedChecks: 4
- implementationRefs: 11
- selector: DSPEC-ASSURANCE-EVIDENCE-MANIFEST.must[0]
- selector: DSPEC-ASSURANCE-EVIDENCE-MANIFEST.must[1]
- selector: DSPEC-ASSURANCE-EVIDENCE-MANIFEST.must[2]
- selector: DSPEC-ASSURANCE-EVIDENCE-MANIFEST.must[3]
- selector: DSPEC-ASSURANCE-EVIDENCE-MANIFEST.must[4]
- selector: DSPEC-ASSURANCE-EVIDENCE-MANIFEST.must[5]

### DSPEC-AUTHORING-SHORTHAND

The schema provides authoring shorthand for common spec elements

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `actor.spec_author`
- term: `artifact.authoring_shorthand`
- term: `artifact.schema`
- must: `shorthand.constructs.sameTypedRecords`
- check: node test/cli.test.mjs#accepts shorthand authoring helpers [reference]
- implementation: code dspec/Schema.pkl#text
- implementation: code dspec/Schema.pkl#term
- implementation: code dspec/Schema.pkl#clause
- implementation: code dspec/Schema.pkl#nodeCheck
- implementation: model fixtures/shorthand-model.pkl

#### Review

- source: model.rules[1]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 5
- selector: DSPEC-AUTHORING-SHORTHAND.must[0]

### DSPEC-BACKEND-REPORT-COMPAT-FIXTURES

Backend verification and counterexample normalization report fixtures stay synchronized with stable projections

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.counterexample_normalizer`
- term: `artifact.formal_backend`
- term: `artifact.json_report`
- term: `artifact.report_fixture`
- must: `verifyGenerated.fixture == stableProjection(verifyGenerated.json)`
- must: `normalizeCounterexamples.fixture == stableProjection(normalizeCounterexamples.json)`
- check: node test/cli.test.mjs#keeps verify-generated JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps normalized counterexample JSON report fixture in sync [reference]
- implementation: runtime Taskfile.pkl
- implementation: code scripts/project-verify-generated-fixture.mjs#verifyGeneratedFixtureProjection
- implementation: code scripts/project-normalize-counterexamples-fixture.mjs#normalizeCounterexamplesFixtureProjection
- implementation: code src/cli.mjs#sanitizeGeneratedBackendMessage
- implementation: model fixtures/typed-ast.pkl
- implementation: model fixtures/coverage-missing-check.pkl
- implementation: model fixtures/reports/verify-generated-typed-ast.json
- implementation: model fixtures/reports/normalize-counterexamples-coverage-missing-check.json

#### Review

- source: model.rules[53]
- coverage: rule
- automatedChecks: 2
- implementationRefs: 8
- selector: DSPEC-BACKEND-REPORT-COMPAT-FIXTURES.must[0]
- selector: DSPEC-BACKEND-REPORT-COMPAT-FIXTURES.must[1]

### DSPEC-CHECK-APPROVED-VERIFIED

Approved active rules have a verification or implementation target

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.checker`
- term: `concept.rule`
- term: `concept.verification_target`
- when: `rule.reviewStatus == approved && !rule.deprecated`
- must: `rule.checks.size + rule.implementedBy.size > 0`
- check: node test/cli.test.mjs#rejects approved rules without verification targets [reference]
- implementation: code src/cli.mjs#validate

#### Review

- source: model.rules[9]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-CHECK-APPROVED-VERIFIED.when[0]
- selector: DSPEC-CHECK-APPROVED-VERIFIED.must[0]

### DSPEC-CHECK-ASSURANCE

CheckTargets declare assurance kinds and evidence, and coverage checks required assurances

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference, executed
- term: `artifact.coverage_oracle`
- term: `artifact.json_report`
- term: `concept.rule`
- term: `concept.verification_target`
- must: `check.assurances subsetOf {reference, executed, mutation-tested, bounded, proved}`
- must: `check.assurances - {reference} subsetOf check.assuranceEvidence.keys`
- must: `proved -> backend == lean && bounded -> backend in {tla, alloy}`
- must: `rule.requiredAssurances subsetOf union(rule.automatedChecks.assurances)`
- must: `reports.assurance == summary(activeApprovedRules.checks.assurances)`
- must: `generated.quickcheck.rules preserves (requiredAssurances + checks.assurances + assuranceEvidence)`
- must: `added(requiredAssurances) -> narrowing && removed(requiredAssurances) -> widening`
- must: `normalize(assuranceFailure).source.ruleId == failedRule.id`
- check: node test/cli.test.mjs#reports explicit assurance claims [reference, executed]
- assuranceEvidence: executed -> Taskfile.pkl#test
- check: node test/cli.test.mjs#renders assurance claims for human review [reference]
- check: node test/cli.test.mjs#rejects missing required assurances [reference]
- check: node test/cli.test.mjs#rejects incompatible assurance backends [reference]
- check: node test/cli.test.mjs#rejects assurances without evidence [reference]
- check: node test/cli.test.mjs#preserves assurance requirements in generated QuickCheck properties [reference]
- check: node test/cli.test.mjs#classifies assurance requirement compatibility [reference]
- implementation: code dspec/Schema.pkl#CheckAssuranceKind
- implementation: code dspec/Schema.pkl#CheckTarget
- implementation: code dspec/Schema.pkl#Rule
- implementation: code src/cli.mjs#validateCheckTargetAssuranceDeclarations
- implementation: code src/cli.mjs#assuranceSummary
- implementation: code src/cli.mjs#validateCoverage
- implementation: code src/cli.mjs#emitQuickcheck
- implementation: code src/cli.mjs#classifyModifiedApprovedRule
- implementation: code src/cli.mjs#normalizeQuickcheckCounterexamples
- implementation: model fixtures/assurance-levels.pkl
- implementation: model fixtures/assurance-required-missing.pkl
- implementation: model fixtures/assurance-backend-invalid.pkl
- implementation: model fixtures/assurance-evidence-missing.pkl
- implementation: model fixtures/assurance-compat-before.pkl
- implementation: model fixtures/assurance-compat-after.pkl

#### Review

- source: model.rules[15]
- coverage: rule
- automatedChecks: 7
- implementationRefs: 15
- selector: DSPEC-CHECK-ASSURANCE.must[0]
- selector: DSPEC-CHECK-ASSURANCE.must[1]
- selector: DSPEC-CHECK-ASSURANCE.must[2]
- selector: DSPEC-CHECK-ASSURANCE.must[3]
- selector: DSPEC-CHECK-ASSURANCE.must[4]
- selector: DSPEC-CHECK-ASSURANCE.must[5]
- selector: DSPEC-CHECK-ASSURANCE.must[6]
- selector: DSPEC-CHECK-ASSURANCE.must[7]

### DSPEC-CHECK-CONTRADICTION

The same clause identity is not allowed in both must and mustNot within one rule

- kind: prohibition
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.checker`
- term: `concept.clause_expr`
- term: `concept.expr_ast`
- term: `concept.rule`
- mustNot: `same_clause_identity.in(must).and(mustNot)`
- check: node test/cli.test.mjs#rejects direct must and mustNot contradictions [reference]
- check: node test/cli.test.mjs#rejects typed AST must and mustNot contradictions [reference]
- implementation: code src/cli.mjs#validate
- implementation: code src/cli.mjs#clauseIdentity
- implementation: code src/cli.mjs#exprAstKey
- implementation: model fixtures/typed-ast-contradiction.pkl

#### Review

- source: model.rules[10]
- coverage: rule
- automatedChecks: 2
- implementationRefs: 4
- selector: DSPEC-CHECK-CONTRADICTION.mustNot[0]

### DSPEC-CHECK-DRIFT-COVERAGE-JSON

check, drift, coverage, domain-coverage, reconcile, reverse, and app-profile gates can emit machine-readable JSON reports

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.app_profile`
- term: `artifact.checker`
- term: `artifact.coverage_oracle`
- term: `artifact.domain_coverage_oracle`
- term: `artifact.drift_detector`
- term: `artifact.json_report`
- term: `artifact.reconciliation_oracle`
- term: `artifact.reverse_coverage_oracle`
- must: `report.status in {pass, fail}`
- must: `report.errors.explainsFailingChecks`
- check: node test/cli.test.mjs#emits check JSON reports [reference]
- check: node test/cli.test.mjs#emits drift JSON reports [reference]
- check: node test/cli.test.mjs#emits coverage JSON reports [reference]
- check: node test/cli.test.mjs#emits failing coverage JSON reports [reference]
- check: node test/cli.test.mjs#reports uncovered domain model elements as JSON [reference]
- check: node test/cli.test.mjs#reports real app reconciliation drift [reference]
- check: node test/cli.test.mjs#reports unmodeled observed real app facts [reference]
- check: node test/cli.test.mjs#checks app profiles as a dogfood bundle [reference]
- implementation: code src/cli.mjs#parseJsonReportArgs
- implementation: code src/cli.mjs#parseReconcileRealAppArgs
- implementation: code src/cli.mjs#checkReport
- implementation: code src/cli.mjs#driftReport
- implementation: code src/cli.mjs#coverageReport
- implementation: code src/cli.mjs#domainCoverageReport
- implementation: code src/cli.mjs#reconcileRealAppReport
- implementation: code src/cli.mjs#reverseCoverageReport
- implementation: code src/cli.mjs#appProfileReport
- implementation: code src/cli.mjs#assertReportOk
- implementation: model fixtures/coverage-missing-check.pkl
- implementation: model fixtures/domain-coverage-orphan.pkl

#### Review

- source: model.rules[51]
- coverage: rule
- automatedChecks: 8
- implementationRefs: 12
- selector: DSPEC-CHECK-DRIFT-COVERAGE-JSON.must[0]
- selector: DSPEC-CHECK-DRIFT-COVERAGE-JSON.must[1]

### DSPEC-CHECK-DUPLICATES

Duplicate term, rule, or decision ids are rejected within one model

- kind: prohibition
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.checker`
- term: `concept.stable_id`
- mustNot: `duplicate_id.accepted`
- check: node test/cli.test.mjs#rejects duplicate rule ids [reference]
- implementation: code src/cli.mjs#checkUnique

#### Review

- source: model.rules[7]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-CHECK-DUPLICATES.mustNot[0]

### DSPEC-CHECK-REFERENCES

Terms and exceptions referenced by rules resolve within the same model

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.checker`
- term: `concept.rule`
- term: `concept.term`
- must: `rule.terms.all(termIds.has)`
- must: `rule.exceptions.all(ruleIds.has)`
- check: node test/cli.test.mjs#rejects unknown term references [reference]
- implementation: code src/cli.mjs#validate

#### Review

- source: model.rules[8]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-CHECK-REFERENCES.must[0]
- selector: DSPEC-CHECK-REFERENCES.must[1]

### DSPEC-CLOUD-TOPOLOGY-PATTERN

Cloud topology is authored as a typed pattern and projects boundary, policy, tenant, and idempotency checks to backends

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.cloud_topology_pattern`
- term: `artifact.generator`
- term: `concept.cloud_flow`
- term: `concept.cloud_node`
- term: `concept.cloud_policy`
- term: `concept.cloud_zone`
- must: `cloudPublicIngressBlocked(flow)`
- must: `cloudResourceAccessHasPolicy(flow)`
- must: `cloudTenantFlowPropagatesTenant(flow)`
- must: `cloudQueuePublishHasIdempotencyKey(flow)`
- check: node test/cli.test.mjs#accepts Cloud topology pattern [reference]
- check: node test/cli.test.mjs#rejects invalid Cloud topology references [reference]
- check: node test/cli.test.mjs#emits Cloud topology pattern into backend projections [reference]
- check: node test/cli.test.mjs#normalizes Cloud topology counterexamples to source flows [reference]
- check: node test/cli.test.mjs#keeps generated Cloud topology checks load-bearing [reference]
- implementation: model dspec/Schema.pkl#CloudModel
- implementation: code src/cli.mjs#validateCloudModel
- implementation: code src/cli.mjs#cloudProjection
- implementation: code src/cli.mjs#propertyCloudPublicIngressBlocked
- implementation: code src/cli.mjs#propertyCloudResourceAccessHasPolicy
- implementation: code src/cli.mjs#propertyCloudTenantFlowsPropagateTenant
- implementation: code src/cli.mjs#propertyCloudQueuePublishesHaveIdempotencyKey
- implementation: model fixtures/cloud-model.pkl
- implementation: model fixtures/cloud-model-broken.pkl

#### Review

- source: model.rules[36]
- coverage: rule
- automatedChecks: 5
- implementationRefs: 9
- selector: DSPEC-CLOUD-TOPOLOGY-PATTERN.must[0]
- selector: DSPEC-CLOUD-TOPOLOGY-PATTERN.must[1]
- selector: DSPEC-CLOUD-TOPOLOGY-PATTERN.must[2]
- selector: DSPEC-CLOUD-TOPOLOGY-PATTERN.must[3]

### DSPEC-COUNTEREXAMPLE-NORMALIZED

Generated backend failures are normalized back to source spec elements through source maps

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.counterexample_normalizer`
- term: `artifact.formal_backend`
- term: `artifact.source_map`
- term: `concept.rule`
- must: `normalizesCounterexample(report, source-map)`
- must: `normalizeCounterexamples(tlaOrAlloyWitness).uses(source-map.generatedSelector)`
- check: node test/cli.test.mjs#normalizes generated counterexamples to source rules [reference]
- check: node test/cli.test.mjs#normalizes TLA and Alloy backend witnesses to source records [reference]
- implementation: code src/cli.mjs#normalizeCounterexamples
- implementation: code src/cli.mjs#renderCounterexampleReport
- implementation: code src/cli.mjs#generatedSelectorsInText
- implementation: model fixtures/coverage-missing-check.pkl
- implementation: model fixtures/cloud-model-broken.pkl

#### Review

- source: model.rules[61]
- coverage: rule
- automatedChecks: 2
- implementationRefs: 5
- selector: DSPEC-COUNTEREXAMPLE-NORMALIZED.must[0]
- selector: DSPEC-COUNTEREXAMPLE-NORMALIZED.must[1]

### DSPEC-COVERAGE-APPROVED-CHECKED

Approved active rules have automated check targets

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.counterexample_normalizer`
- term: `artifact.coverage_oracle`
- term: `concept.rule`
- term: `concept.verification_target`
- when: `rule.reviewStatus == approved && !rule.deprecated`
- must: `rule.checks.exists(check => check.backend != manual && check.backend != runtime)`
- check: node test/cli.test.mjs#reports coverage for dspec's self model [reference]
- check: node test/cli.test.mjs#rejects approved rules without load-bearing checks in coverage [reference]
- implementation: code src/cli.mjs#validateCoverage

#### Review

- source: model.rules[13]
- coverage: rule
- automatedChecks: 2
- implementationRefs: 1
- selector: DSPEC-COVERAGE-APPROVED-CHECKED.when[0]
- selector: DSPEC-COVERAGE-APPROVED-CHECKED.must[0]

### DSPEC-COVERAGE-CLAUSE-QUALITY

Rules requiring clause-level coverage have CheckTarget.covers entries for every clause

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.clause_coverage`
- term: `artifact.coverage_oracle`
- term: `concept.rule`
- term: `concept.verification_target`
- when: `rule.coverage == clause`
- must: `rule.clauses.all(selector => automatedChecks.covers(selector))`
- must: `check.covers.all(selector => rule.clauses.has(selector))`
- check: node test/cli.test.mjs#reports clause-level coverage [reference]
- check: node test/cli.test.mjs#rejects clause-level coverage gaps [reference]
- check: node test/cli.test.mjs#rejects invalid clause coverage selectors [reference]
- implementation: code dspec/Schema.pkl#CheckTarget
- implementation: code dspec/Schema.pkl#Rule
- implementation: code src/cli.mjs#ruleClauseSelectors
- implementation: code src/cli.mjs#validateCheckTargetCoverageSelectors
- implementation: code src/cli.mjs#validateCoverage
- implementation: model fixtures/coverage-clause-covered.pkl
- implementation: model fixtures/coverage-clause-missing.pkl
- implementation: model fixtures/coverage-clause-invalid-selector.pkl

#### Review

- source: model.rules[14]
- coverage: clause
- automatedChecks: 3
- implementationRefs: 8
- selector: DSPEC-COVERAGE-CLAUSE-QUALITY.when[0]
- selector: DSPEC-COVERAGE-CLAUSE-QUALITY.must[0]
- selector: DSPEC-COVERAGE-CLAUSE-QUALITY.must[1]
- covers: node test/cli.test.mjs#reports clause-level coverage -> when[0], must[0]
- covers: node test/cli.test.mjs#rejects clause-level coverage gaps -> must[0]
- covers: node test/cli.test.mjs#rejects invalid clause coverage selectors -> must[1]

### DSPEC-DATA-GOVERNANCE-PATTERN

Data governance is authored as a typed pattern and projects encryption, deletion support, transfer-basis, and retention checks to backends

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.data_governance_pattern`
- term: `artifact.generator`
- term: `concept.data_flow`
- term: `concept.data_placement`
- term: `concept.data_policy`
- term: `concept.data_set`
- term: `concept.data_store`
- must: `dataSensitivePlacementEncrypted(placement)`
- must: `dataPersonalPlacementSupportsDeletion(placement)`
- must: `dataCrossRegionFlowHasLegalBasis(flow)`
- must: `dataRetentionWithinPolicy(dataset)`
- check: node test/cli.test.mjs#accepts Data governance pattern [reference]
- check: node test/cli.test.mjs#rejects invalid Data governance references [reference]
- check: node test/cli.test.mjs#emits Data governance pattern into backend projections [reference]
- check: node test/cli.test.mjs#normalizes Data governance counterexamples to source records [reference]
- check: node test/cli.test.mjs#keeps generated Data governance checks load-bearing [reference]
- implementation: model dspec/Schema.pkl#DataModel
- implementation: code src/cli.mjs#validateDataModel
- implementation: code src/cli.mjs#dataProjection
- implementation: code src/cli.mjs#propertyDataSensitivePlacementsEncrypted
- implementation: code src/cli.mjs#propertyDataPersonalPlacementsSupportDeletion
- implementation: code src/cli.mjs#propertyDataCrossRegionFlowsHaveLegalBasis
- implementation: code src/cli.mjs#propertyDataRetentionWithinPolicy
- implementation: model fixtures/data-model.pkl
- implementation: model fixtures/data-model-broken.pkl

#### Review

- source: model.rules[37]
- coverage: rule
- automatedChecks: 5
- implementationRefs: 9
- selector: DSPEC-DATA-GOVERNANCE-PATTERN.must[0]
- selector: DSPEC-DATA-GOVERNANCE-PATTERN.must[1]
- selector: DSPEC-DATA-GOVERNANCE-PATTERN.must[2]
- selector: DSPEC-DATA-GOVERNANCE-PATTERN.must[3]

### DSPEC-DB-MIGRATION-MAPPING-COVERAGE

DB migration preservation declarations are covered by mapping witnesses

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.db_model_pattern`
- term: `artifact.generator`
- term: `concept.db_invariant`
- term: `concept.db_mapping`
- term: `concept.db_migration`
- must: `dbMigrationMappingCoversInvariant(migration, mapping, invariant)`
- check: node test/cli.test.mjs#rejects invalid DB migration mapping references [reference]
- check: node test/cli.test.mjs#emits DB model pattern into backend projections [reference]
- check: node test/cli.test.mjs#normalizes DB migration mapping counterexamples to source patterns [reference]
- check: node test/cli.test.mjs#keeps generated DB migration mapping checks load-bearing [reference]
- implementation: model dspec/Schema.pkl#DbMapping
- implementation: code src/cli.mjs#dbMigrationMappedInvariantIds
- implementation: code src/cli.mjs#propertyDbMigrationMappingsCoverInvariants
- implementation: model fixtures/db-model-invalid-mapping-ref.pkl
- implementation: model fixtures/db-model-migration-missing-mapping.pkl

#### Review

- source: model.rules[34]
- coverage: rule
- automatedChecks: 4
- implementationRefs: 5
- selector: DSPEC-DB-MIGRATION-MAPPING-COVERAGE.must[0]

### DSPEC-DB-MIGRATION-MAPPING-WELL-FORMED

DB migration mappings are grounded in the preserve scope and source/target tables

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.db_model_pattern`
- term: `artifact.generator`
- term: `concept.db_invariant`
- term: `concept.db_mapping`
- term: `concept.db_migration`
- must: `dbMigrationMappingInvariantIsPreserved(migration, mapping, invariant)`
- must: `dbMigrationMappingMentionsSourceAndTarget(migration, mapping)`
- check: node test/cli.test.mjs#rejects DB migration mappings outside preserved invariants [reference]
- check: node test/cli.test.mjs#emits DB model pattern into backend projections [reference]
- check: node test/cli.test.mjs#normalizes DB migration mapping expression counterexamples to source mappings [reference]
- check: node test/cli.test.mjs#keeps generated DB migration mapping expression checks load-bearing [reference]
- implementation: model dspec/Schema.pkl#DbMapping
- implementation: code src/cli.mjs#validateDbModel
- implementation: code src/cli.mjs#dbExprMentionsTable
- implementation: code src/cli.mjs#propertyDbMigrationMappingExpressionsMentionTables
- implementation: model fixtures/db-model-invalid-mapping-preserve.pkl
- implementation: model fixtures/db-model-mapping-missing-table-mention.pkl

#### Review

- source: model.rules[35]
- coverage: rule
- automatedChecks: 4
- implementationRefs: 6
- selector: DSPEC-DB-MIGRATION-MAPPING-WELL-FORMED.must[0]
- selector: DSPEC-DB-MIGRATION-MAPPING-WELL-FORMED.must[1]

### DSPEC-DB-MIGRATION-PATTERN

DB migrations are authored as a typed pattern and project preservation declarations to backends

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.db_model_pattern`
- term: `artifact.generator`
- term: `concept.db_invariant`
- term: `concept.db_migration`
- must: `dbMigrationPreservesInvariant(migration, invariant)`
- check: node test/cli.test.mjs#rejects invalid DB migration references [reference]
- check: node test/cli.test.mjs#emits DB model pattern into backend projections [reference]
- check: node test/cli.test.mjs#keeps generated DB migration checks load-bearing [reference]
- check: node test/cli.test.mjs#normalizes DB migration counterexamples to source patterns [reference]
- implementation: model dspec/Schema.pkl#DbMigration
- implementation: model dspec/Schema.pkl#DbMapping
- implementation: code src/cli.mjs#dbMigrationTouchedInvariantIds
- implementation: code src/cli.mjs#propertyDbMigrationsPreserveInvariants
- implementation: model fixtures/db-model-invalid-migration-ref.pkl
- implementation: model fixtures/db-model-migration-missing-preserve.pkl

#### Review

- source: model.rules[33]
- coverage: rule
- automatedChecks: 4
- implementationRefs: 6
- selector: DSPEC-DB-MIGRATION-PATTERN.must[0]

### DSPEC-DB-MODEL-PATTERN

DB schemas, transactions, and invariants are authored as a typed pattern and projected to backends

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.db_model_pattern`
- term: `artifact.generator`
- term: `concept.db_invariant`
- term: `concept.db_transaction`
- must: `dbTransactionPreservesInvariant(transaction, invariant)`
- check: node test/cli.test.mjs#accepts DB model pattern [reference]
- check: node test/cli.test.mjs#emits DB model pattern into backend projections [reference]
- check: node test/cli.test.mjs#keeps generated DB invariant checks load-bearing [reference]
- implementation: model dspec/Schema.pkl#DbModel
- implementation: code src/cli.mjs#validateDbModel
- implementation: code src/cli.mjs#dbProjection
- implementation: model fixtures/db-model.pkl
- implementation: model fixtures/db-model-missing-preserve.pkl

#### Review

- source: model.rules[30]
- coverage: rule
- automatedChecks: 3
- implementationRefs: 5
- selector: DSPEC-DB-MODEL-PATTERN.must[0]

### DSPEC-DB-SCHEMA-IMPORTER

Existing SQL schemas are imported deterministically as typed DB model seeds

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.db_model_pattern`
- term: `artifact.db_schema_importer`
- must: `dbSchemaImportsCreateTables(schema, dbModel)`
- check: node test/cli.test.mjs#imports SQL schema as DB model JSON [reference]
- check: node test/cli.test.mjs#imports SQL schema as a deterministic Pkl fragment [reference]
- implementation: code src/cli.mjs#importDbSchema
- implementation: code src/cli.mjs#emitDbSchemaPkl
- implementation: model fixtures/db-schema.sql

#### Review

- source: model.rules[31]
- coverage: rule
- automatedChecks: 2
- implementationRefs: 3
- selector: DSPEC-DB-SCHEMA-IMPORTER.must[0]

### DSPEC-DOCUMENTED-CLI-EXAMPLES

CLI examples in README/docs/Taskfile are grounded in the public CLI surface

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.command_example`
- term: `artifact.command_registry`
- term: `artifact.dogfood_task`
- term: `artifact.markdown`
- must: `cli.usage.generatedFrom(topLevelCommandRegistry)`
- must: `documentedCliExamples(readme + docs + taskfile).commands subsetOf cli.usage.commands`
- must: `documentedCliExamples(specChange).subcommands subsetOf {compat, scaffold, review}`
- must: `documentedCliExamples.safeSmoke.runs(help)`
- must: `documentedCliExtractor.hasHoldout(fencedDspec + nodeOldpwd + pipe + inlineBackticks)`
- check: node test/cli.test.mjs#defines top-level CLI commands through the command registry [reference]
- check: node test/cli.test.mjs#keeps documented CLI command examples on the live command surface [reference]
- check: node test/cli.test.mjs#smoke-runs documented CLI command examples through help [reference]
- check: node test/cli.test.mjs#keeps documented CLI extractor covered by holdout shapes [reference]
- implementation: code src/cli.mjs#topLevelCommandRegistry
- implementation: code src/cli.mjs#topLevelCommandHelp
- implementation: code src/cli.mjs#usage
- implementation: code src/cli.mjs#specChangeUsage
- implementation: code test/cli.test.mjs#documentedCliInvocations
- implementation: code test/cli.test.mjs#documentedCliHelpSmokeArgs
- implementation: code test/cli.test.mjs#appendFencedDspecInvocations
- implementation: code test/cli.test.mjs#cliUsageCommands
- implementation: code test/cli.test.mjs#specChangeUsageCommands
- implementation: model fixtures/documented-cli-examples-holdout.md
- implementation: model README.md
- implementation: model docs/dogfooding-2026-07-10.md
- implementation: model docs/usability-evaluation.md
- implementation: model docs/semantic-model.md
- implementation: runtime Taskfile.pkl

#### Review

- source: model.rules[67]
- coverage: rule
- automatedChecks: 4
- implementationRefs: 15
- selector: DSPEC-DOCUMENTED-CLI-EXAMPLES.must[0]
- selector: DSPEC-DOCUMENTED-CLI-EXAMPLES.must[1]
- selector: DSPEC-DOCUMENTED-CLI-EXAMPLES.must[2]
- selector: DSPEC-DOCUMENTED-CLI-EXAMPLES.must[3]
- selector: DSPEC-DOCUMENTED-CLI-EXAMPLES.must[4]

### DSPEC-DOGFOOD-TASK

The dogfood task reruns self-spec, Runtime observation loop, and real app model evaluation

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.app_profile`
- term: `artifact.app_profile_scenario`
- term: `artifact.app_profile_suite`
- term: `artifact.coverage_oracle`
- term: `artifact.dogfood_task`
- term: `artifact.domain_coverage_oracle`
- term: `artifact.drift_detector`
- term: `artifact.profile_scaffold_diff`
- term: `artifact.real_app_importer`
- term: `artifact.real_app_model`
- term: `artifact.reconciliation_oracle`
- term: `artifact.reverse_coverage_oracle`
- term: `artifact.runtime_collector_fixture`
- term: `artifact.runtime_evidence_verifier`
- term: `artifact.spec_change_review`
- term: `artifact.spec_change_review_scaffold`
- term: `artifact.spec_reading_eval`
- must: `dogfoodTaskRunsSelfEvaluation(task)`
- check: node test/cli.test.mjs#declares a dogfood task for self-spec evaluation [reference]
- implementation: runtime Taskfile.pkl

#### Review

- source: model.rules[63]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-DOGFOOD-TASK.must[0]

### DSPEC-DOMAIN-COVERAGE-ORACLE

Domain pattern elements are grounded in approved rules through stable ids

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.coverage_oracle`
- term: `artifact.domain_coverage_oracle`
- term: `concept.rule`
- term: `concept.stable_id`
- must: `domainCoverage.elements == tracked(patterns.db + patterns.cloud + patterns.data + patterns.release + patterns.runtime)`
- must: `domainCoverage.uncovered == []`
- check: node test/cli.test.mjs#reports domain model element coverage [reference]
- check: node test/cli.test.mjs#reports uncovered domain model elements as JSON [reference]
- check: node test/cli.test.mjs#keeps domain coverage JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps failing domain coverage JSON report fixture in sync [reference]
- implementation: code src/cli.mjs#domainCoverageReport
- implementation: code src/cli.mjs#domainCoverageElements
- implementation: code src/cli.mjs#domainElementCoveredBy
- implementation: model examples/sample-webapp-2026.pkl
- implementation: model fixtures/domain-coverage-orphan.pkl
- implementation: model fixtures/reports/domain-coverage-sample-webapp.json
- implementation: model fixtures/reports/domain-coverage-orphan.json

#### Review

- source: model.rules[18]
- coverage: rule
- automatedChecks: 4
- implementationRefs: 7
- selector: DSPEC-DOMAIN-COVERAGE-ORACLE.must[0]
- selector: DSPEC-DOMAIN-COVERAGE-ORACLE.must[1]

### DSPEC-DOMAIN-PRESET-PACK

Domain preset packs are provided as authoring layers that expand to the Core IR

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.authoring_shorthand`
- term: `artifact.domain_preset_pack`
- term: `artifact.schema`
- must: `domainPack.expandsToCoreIr`
- must: `domainPack.preservesTypedClauseAst`
- check: node test/cli.test.mjs#accepts domain preset packs [reference]
- check: node test/cli.test.mjs#accepts domain pack contract registry [reference]
- check: node test/cli.test.mjs#rejects domain pack rule helpers without typed AST contract [reference]
- check: node test/cli.test.mjs#detects missing domain pack helper symbols [reference]
- check: node test/cli.test.mjs#uses domain preset packs for the current RBAC spec [reference]
- check: node test/cli.test.mjs#accepts web app domain preset packs [reference]
- implementation: code dspec/Schema.pkl#DomainPack
- implementation: code dspec/Schema.pkl#DomainPackHelper
- implementation: code dspec/domains/Rbac.pkl#actor
- implementation: code dspec/domains/Rbac.pkl#onlyRoleCan
- implementation: code dspec/domains/Tenant.pkl#scope
- implementation: code dspec/domains/Tenant.pkl#noCrossTenantAccess
- implementation: code dspec/domains/WebApp.pkl#route
- implementation: code dspec/domains/WebApp.pkl#routeUsesSchema
- implementation: code dspec/domains/WebApp.pkl#workflowHasGate
- implementation: code src/cli.mjs#validateDomainPacks
- implementation: code src/cli.mjs#validateDomainPackRefs
- implementation: model fixtures/domain-pack-model.pkl
- implementation: model fixtures/webapp-domain-pack-model.pkl
- implementation: model fixtures/domain-pack-contract.pkl
- implementation: model fixtures/domain-pack-contract-broken.pkl
- implementation: model fixtures/domain-pack-contract-missing-symbol.pkl
- implementation: model examples/rbac.pkl

#### Review

- source: model.rules[2]
- coverage: rule
- automatedChecks: 6
- implementationRefs: 17
- selector: DSPEC-DOMAIN-PRESET-PACK.must[0]
- selector: DSPEC-DOMAIN-PRESET-PACK.must[1]

### DSPEC-DRIFT-CHECK-TARGET

CheckTarget entries point to mechanically resolvable references

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.drift_detector`
- term: `concept.verification_target`
- must: `checkTarget.path.exists`
- must: `checkTarget.anchor == null || target.contains(anchor)`
- must: `backendCheckTarget.anchor.resolvesAs(backendSpecificSymbol)`
- check: node test/cli.test.mjs#rejects check targets that do not resolve to test anchors [reference]
- check: node test/cli.test.mjs#resolves backend-aware drift targets [reference]
- check: node test/cli.test.mjs#rejects missing backend-aware drift target symbols [reference]
- implementation: code src/cli.mjs#validateCheckTargets
- implementation: code src/cli.mjs#hasLeanSymbol
- implementation: code src/cli.mjs#hasTlaSymbol
- implementation: code src/cli.mjs#hasAlloySymbol
- implementation: code src/cli.mjs#validateRuntimeCheckTarget
- implementation: model fixtures/backend-aware-drift.pkl
- implementation: model fixtures/backend-aware-drift-invalid.pkl

#### Review

- source: model.rules[12]
- coverage: rule
- automatedChecks: 3
- implementationRefs: 7
- selector: DSPEC-DRIFT-CHECK-TARGET.must[0]
- selector: DSPEC-DRIFT-CHECK-TARGET.must[1]
- selector: DSPEC-DRIFT-CHECK-TARGET.must[2]

### DSPEC-DRIFT-IMPLEMENTATION-REF

implementedBy path and symbol references resolve in the implementation

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.drift_detector`
- term: `concept.verification_target`
- must: `implementedBy.path.exists`
- must: `implementedBy.symbol == null || file.contains(symbolDeclaration)`
- check: node test/cli.test.mjs#detects missing implementation symbols [reference]
- implementation: code src/cli.mjs#validateImplementationRefs

#### Review

- source: model.rules[11]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-DRIFT-IMPLEMENTATION-REF.must[0]
- selector: DSPEC-DRIFT-IMPLEMENTATION-REF.must[1]

### DSPEC-EMIT-FORMAL-BACKENDS

Formal-method backend skeletons are generated deterministically from the spec model

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.formal_backend`
- term: `artifact.generator`
- term: `concept.verification_target`
- must: `emit(alloy|tla|lean, model).deterministic`
- check: node test/cli.test.mjs#emits formal backend skeletons [reference]
- implementation: code src/cli.mjs#emitFormalBackend

#### Review

- source: model.rules[25]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-EMIT-FORMAL-BACKENDS.must[0]

### DSPEC-EMIT-MARKDOWN

A human-readable Markdown document is generated deterministically from the spec model

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.generator`
- term: `artifact.markdown`
- term: `concept.stable_id`
- must: `emit(markdown, model).deterministic`
- check: node test/cli.test.mjs#emits deterministic markdown [reference]
- implementation: code src/cli.mjs#emitMarkdown

#### Review

- source: model.rules[23]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-EMIT-MARKDOWN.must[0]

### DSPEC-EMIT-QUICKCHECK

A QuickCheck-style format with generators and shrinkers is generated deterministically from the spec model

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.generator`
- term: `artifact.quickcheck`
- term: `concept.rule`
- must: `quickcheck.output.includes(generator) && quickcheck.output.includes(shrinker)`
- check: node test/cli.test.mjs#emits deterministic quickcheck with shrink [reference]
- implementation: code src/cli.mjs#emitQuickcheck

#### Review

- source: model.rules[24]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-EMIT-QUICKCHECK.must[0]

### DSPEC-EXPR-AST-PROJECTION

Generators deterministically preserve Clause.ast in QuickCheck, TLA+, and Lean projections

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.formal_backend`
- term: `artifact.generator`
- term: `artifact.quickcheck`
- term: `concept.expr_ast`
- must: `preservesClauseAst(quickcheck, tla, lean)`
- check: node test/cli.test.mjs#emits typed Clause.ast into backend projections [reference]
- implementation: code src/cli.mjs#emitQuickcheck
- implementation: code src/cli.mjs#exprToLean
- implementation: code src/cli.mjs#exprToTla

#### Review

- source: model.rules[29]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 3
- selector: DSPEC-EXPR-AST-PROJECTION.must[0]

### DSPEC-EXPR-OPAQUE

Clause.expr is currently treated as an opaque string, not a typed AST

- kind: non_goal
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `concept.clause_expr`
- mustNot: `cli.parses_clause_expr_semantics`
- check: node test/cli.test.mjs#accepts opaque Clause.expr text [reference]
- implementation: model dspec/Schema.pkl#Clause

#### Review

- source: model.rules[69]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-EXPR-OPAQUE.mustNot[0]

### DSPEC-EXPR-TYPED-AST

Clause.ast is validated as a typed expression AST with per-operator semantics

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.checker`
- term: `concept.clause_expr`
- term: `concept.expr_ast`
- must: `clause.ast == null || validExprAst(clause.ast)`
- must: `acceptsOnlyDeclaredFields(exprAst.operator)`
- must: `model.clauseAstSemanticsVersion == checker.supportedClauseAstSemanticsVersion`
- check: node test/cli.test.mjs#accepts typed Clause.ast [reference]
- check: node test/cli.test.mjs#rejects invalid typed Clause.ast [reference]
- check: node test/cli.test.mjs#rejects expr ast fields outside operator semantics [reference]
- check: node test/cli.test.mjs#rejects unsupported Clause.ast semantics versions [reference]
- check: node test/clause-ast-core.test.mjs#defines Clause.ast semantics version 1.0 [reference]
- check: node test/clause-ast-core.test.mjs#evaluates every Clause.ast 1.0 operator consistently [reference]
- check: node test/clause-ast-core.test.mjs#rejects evaluation with an unsupported semantics version [reference]
- implementation: model dspec/Schema.pkl#ExprAst
- implementation: code src/core/clause-ast.mjs#validateClauseAst
- implementation: code src/core/clause-ast.mjs#evaluateClauseAst
- implementation: code src/core/clause-ast.mjs#CLAUSE_AST_SEMANTICS_VERSION
- implementation: model fixtures/unsupported-ast-semantics.pkl

#### Review

- source: model.rules[28]
- coverage: rule
- automatedChecks: 7
- implementationRefs: 5
- selector: DSPEC-EXPR-TYPED-AST.must[0]
- selector: DSPEC-EXPR-TYPED-AST.must[1]
- selector: DSPEC-EXPR-TYPED-AST.must[2]

### DSPEC-GENERATED-ALLOY-SYNTAX

Generated Alloy specifications have their syntax shape checked and are executed by the analyzer when alloy6 is available

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.formal_backend`
- term: `artifact.generator`
- term: `concept.verification_target`
- must: `validatesGeneratedAlloySyntax(model)`
- must: `(hasTool(alloy6)) -> (executesGeneratedAlloyAnalyzer(model))`
- check: node test/cli.test.mjs#validates generated Alloy syntax [reference]
- check: node test/cli.test.mjs#runs generated Alloy through analyzer when available [reference]
- implementation: code src/cli.mjs#verifyGenerated
- implementation: code src/cli.mjs#validateGeneratedAlloy
- implementation: code src/cli.mjs#verifyGeneratedAlloyWithAnalyzer

#### Review

- source: model.rules[49]
- coverage: rule
- automatedChecks: 2
- implementationRefs: 3
- selector: DSPEC-GENERATED-ALLOY-SYNTAX.must[0]
- selector: DSPEC-GENERATED-ALLOY-SYNTAX.must[1]

### DSPEC-GENERATED-ARTIFACT-FRESHNESS

The generated artifact manifest carries freshness hashes for primary generator outputs

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.formal_backend`
- term: `artifact.generated_manifest`
- term: `artifact.generator`
- term: `artifact.markdown`
- term: `artifact.quickcheck`
- term: `artifact.source_map`
- must: `generatedManifest.hashes(markdown, quickcheck, alloy, tla, tlaCfg, lean, sourceMap)`
- must: `generated/manifest.json == emit(generated-manifest, examples/dspec.pkl)`
- check: node test/cli.test.mjs#emits generated artifact manifest [reference]
- check: node test/cli.test.mjs#keeps generated manifest artifact in sync [reference]
- implementation: code src/cli.mjs#emitGeneratedManifest
- implementation: code src/cli.mjs#generatedArtifactContents
- implementation: code src/cli.mjs#sha256
- implementation: model generated/manifest.json
- implementation: runtime Taskfile.pkl

#### Review

- source: model.rules[60]
- coverage: rule
- automatedChecks: 2
- implementationRefs: 5
- selector: DSPEC-GENERATED-ARTIFACT-FRESHNESS.must[0]
- selector: DSPEC-GENERATED-ARTIFACT-FRESHNESS.must[1]

### DSPEC-GENERATED-CHECKS-LOAD-BEARING

Generated backend checks fail for approved rules without support

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.coverage_oracle`
- term: `artifact.formal_backend`
- term: `artifact.generator`
- must: `(unsupportedApprovedRule(rule)) -> (generatedChecksFail(rule))`
- check: node test/cli.test.mjs#keeps generated backend checks load-bearing [reference]
- implementation: model fixtures/coverage-missing-check.pkl
- implementation: code src/cli.mjs#verifyGeneratedReport

#### Review

- source: model.rules[54]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 2
- selector: DSPEC-GENERATED-CHECKS-LOAD-BEARING.must[0]

### DSPEC-GENERATED-LEAN-COMPILES

Generated Lean specifications are compiled as a CI gate

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.formal_backend`
- term: `artifact.generator`
- term: `concept.verification_target`
- must: `compilesGeneratedLean(model)`
- check: node test/cli.test.mjs#compiles generated Lean output [reference]
- implementation: code src/cli.mjs#verifyGenerated
- implementation: code src/cli.mjs#emitLean

#### Review

- source: model.rules[47]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 2
- selector: DSPEC-GENERATED-LEAN-COMPILES.must[0]

### DSPEC-GENERATED-QUICKCHECK-RUNS

Generated QuickCheck-style JS is executed as a CI gate

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.generator`
- term: `artifact.quickcheck`
- term: `concept.verification_target`
- must: `runsGeneratedQuickcheck(model)`
- check: node test/cli.test.mjs#runs generated QuickCheck output [reference]
- implementation: code src/cli.mjs#verifyGenerated
- implementation: code src/cli.mjs#runGeneratedToolResult

#### Review

- source: model.rules[46]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 2
- selector: DSPEC-GENERATED-QUICKCHECK-RUNS.must[0]

### DSPEC-GENERATED-TLA-SYNTAX

Generated TLA+ specifications have their syntax shape checked and are checked by SANY and TLC when tlasany/tlc are available

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.formal_backend`
- term: `artifact.generator`
- term: `concept.verification_target`
- must: `validatesGeneratedTlaSyntax(model)`
- must: `(hasTool(tlasany)) -> (runsGeneratedTlaSany(model))`
- must: `(hasTool(tlc)) -> (runsGeneratedTlaTlc(model))`
- check: node test/cli.test.mjs#validates generated TLA+ syntax [reference]
- check: node test/cli.test.mjs#runs generated TLA+ through SANY when available [reference]
- check: node test/cli.test.mjs#runs generated TLA+ through TLC when available [reference]
- implementation: code src/cli.mjs#verifyGenerated
- implementation: code src/cli.mjs#validateGeneratedTla
- implementation: code src/cli.mjs#verifyGeneratedTlaWithSany
- implementation: code src/cli.mjs#verifyGeneratedTlaWithTlc
- implementation: code src/cli.mjs#emitTlaConfig

#### Review

- source: model.rules[48]
- coverage: rule
- automatedChecks: 3
- implementationRefs: 5
- selector: DSPEC-GENERATED-TLA-SYNTAX.must[0]
- selector: DSPEC-GENERATED-TLA-SYNTAX.must[1]
- selector: DSPEC-GENERATED-TLA-SYNTAX.must[2]

### DSPEC-I18N-RENDER

render produces natural-language output for the requested locale

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.renderer`
- term: `concept.localized_text`
- when: `command == render && locale.requested`
- must: `output.uses(locale) || output.uses(default)`
- check: node test/cli.test.mjs#renders localized model text [reference]
- implementation: code src/cli.mjs#render

#### Review

- source: model.rules[5]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-I18N-RENDER.when[0]
- selector: DSPEC-I18N-RENDER.must[0]

### DSPEC-I18N-SEMANTIC-DRIFT

The i18n contract detects semantic drift across required locales and glossary labels

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.i18n_contract`
- term: `concept.localized_text`
- term: `concept.term`
- must: `localizedText.labels.cover(requiredLocales)`
- must: `i18n.glossary.labels == vocabulary.term.text.labels`
- check: node test/cli.test.mjs#accepts i18n contract coverage [reference]
- check: node test/cli.test.mjs#rejects missing required localized labels [reference]
- check: node test/cli.test.mjs#rejects i18n glossary label drift [reference]
- implementation: code dspec/Schema.pkl#I18nContract
- implementation: code dspec/Schema.pkl#I18nGlossaryEntry
- implementation: code src/cli.mjs#validateI18nContract
- implementation: code src/cli.mjs#walkLocalizedTexts
- implementation: model fixtures/i18n-contract.pkl
- implementation: model fixtures/i18n-contract-missing-label.pkl
- implementation: model fixtures/i18n-contract-glossary-mismatch.pkl

#### Review

- source: model.rules[6]
- coverage: rule
- automatedChecks: 3
- implementationRefs: 7
- selector: DSPEC-I18N-SEMANTIC-DRIFT.must[0]
- selector: DSPEC-I18N-SEMANTIC-DRIFT.must[1]

### DSPEC-JSON-REPORT-COMPAT-FIXTURES

JSON report compatibility fixtures stay synchronized with CLI output

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.impact_report`
- term: `artifact.json_report`
- term: `artifact.report_fixture`
- term: `artifact.spec_change_review`
- must: `fixtures.reports == cli.jsonReports`
- must: `futureChecker.preserves(reportFixtures)`
- check: node test/cli.test.mjs#keeps check JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps drift JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps coverage JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps failing coverage JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps domain coverage JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps failing domain coverage JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps real app import fixture in sync [reference]
- check: node test/cli.test.mjs#keeps real app reconciliation fixture in sync [reference]
- check: node test/cli.test.mjs#keeps reverse coverage JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps scaffolded app profile diff JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile evaluation JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile scenario evaluation JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps extended app profile evaluation JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile scenario coverage JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile mutation score JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile evaluation Markdown report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile suite JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps app profile suite evaluation JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps scaled app profile JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps impact JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps spec compatibility JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps spec change review JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps approved breaking spec change review JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps missing-evidence spec change review JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps missing-ref spec change review JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps spec reading evaluation JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps spec reading digest refresh JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps spec reading suite JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps spec reading suite coverage JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps metamorphic spec reading JSON report fixture in sync [reference]
- implementation: runtime Taskfile.pkl
- implementation: model fixtures/reports/check-dspec.json
- implementation: model fixtures/reports/drift-dspec.json
- implementation: model fixtures/reports/coverage-dspec.json
- implementation: model fixtures/reports/coverage-missing-check.json
- implementation: model fixtures/reports/domain-coverage-sample-webapp.json
- implementation: model fixtures/reports/domain-coverage-orphan.json
- implementation: model fixtures/reports/import-real-app-sample-webapp.json
- implementation: model fixtures/reports/reconcile-real-app-sample-webapp.json
- implementation: model fixtures/reports/reverse-coverage-sample-webapp.json
- implementation: model fixtures/reports/scaffold-app-profile-diff.json
- implementation: model fixtures/reports/evaluate-app-profile-sample-webapp.json
- implementation: model fixtures/reports/evaluate-app-profile-scenarios.json
- implementation: model fixtures/reports/evaluate-app-profile-extended-scenarios.json
- implementation: model fixtures/reports/evaluate-app-profile-extended-scenarios.md
- implementation: model fixtures/reports/coverage-app-profile-scenarios.json
- implementation: model fixtures/reports/score-app-profile-mutations.json
- implementation: model fixtures/reports/replay-app-profile-changes.json
- implementation: model fixtures/reports/check-app-profile-sample-webapp.json
- implementation: model fixtures/reports/check-app-profile-suite.json
- implementation: model fixtures/reports/evaluate-app-profile-suite.json
- implementation: model fixtures/reports/check-app-profile-scale.json
- implementation: model fixtures/reports/impact.json
- implementation: model fixtures/reports/spec-compat-narrowing.json
- implementation: model fixtures/reports/spec-change-review.json
- implementation: model fixtures/reports/spec-change-review-breaking-approved.json
- implementation: model fixtures/reports/spec-change-review-breaking-missing-evidence.json
- implementation: model fixtures/reports/spec-change-review-breaking-missing-ref.json
- implementation: model fixtures/reports/spec-reading-eval-sample-webapp.json
- implementation: model fixtures/reports/spec-reading-eval-refresh-stale.json
- implementation: model fixtures/reports/spec-reading-eval-suite.json
- implementation: model fixtures/reports/coverage-spec-reading-eval-suite.json
- implementation: model fixtures/reports/metamorphic-spec-reading-eval.json

#### Review

- source: model.rules[52]
- coverage: rule
- automatedChecks: 31
- implementationRefs: 33
- selector: DSPEC-JSON-REPORT-COMPAT-FIXTURES.must[0]
- selector: DSPEC-JSON-REPORT-COMPAT-FIXTURES.must[1]

### DSPEC-LEAN-EQ-SEMANTIC

Lean verifies equality-fragment Clauses through a satisfaction relation and clause theorem

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference, executed
- term: `artifact.assurance_evidence_manifest`
- term: `artifact.formal_backend`
- term: `artifact.source_map`
- term: `concept.clause_backend_support`
- term: `concept.expr_ast`
- term: `concept.rule`
- term: `concept.verification_target`
- must: `ClauseEnv == String -> Option String`
- must: `Satisfies(env, eq(left, right)) == (resolve(env, left) == resolve(env, right))`
- must: `Satisfies(env, neq(left, right)) == (resolve(env, left) != resolve(env, right))`
- must: `Satisfies(env, not(child)) == not(Satisfies(env, child))`
- must: `Satisfies(env, implies(left, right)) == (Satisfies(env, left) -> Satisfies(env, right))`
- must: `semantic(lean, clause) iff operators(clause) subsetOf {eq, neq, not, implies}`
- must: `proved(lean, selector) -> generatedClauseTheorem(selector)`
- must: `clauseTheorem.failed -> evidence.create.failed`
- must: `clauseArtifact.propertyIds intersects clauseBinding.generatedSelectors`
- check: node test/cli.test.mjs#proves Lean eq clauses with clause-scoped evidence [reference, executed]
- assuranceEvidence: executed -> Taskfile.pkl#test
- check: node test/cli.test.mjs#keeps Lean eq semantic proofs load-bearing [reference]
- check: node test/cli.test.mjs#proves composed Lean implication clauses with clause-scoped evidence [reference]
- check: node test/cli.test.mjs#keeps composed Lean implication proofs load-bearing [reference]
- check: node test/assurance-evidence-core.test.mjs#classifies the supported Lean equality fragment as semantic [reference]
- implementation: code src/core/assurance-evidence.mjs#CLAUSE_BACKEND_OPERATOR_SUPPORT
- implementation: code src/cli.mjs#leanSemanticClauseProofs
- implementation: code src/cli.mjs#emitLeanClauseTheorem
- implementation: code src/cli.mjs#emitLean
- implementation: code src/cli.mjs#assuranceEvidenceArtifactDefinitions
- implementation: model fixtures/assurance-formal-lean-eq.pkl
- implementation: model fixtures/assurance-formal-lean-eq-broken.pkl
- implementation: model fixtures/assurance-formal-lean-implies.pkl
- implementation: model fixtures/assurance-formal-lean-implies-broken.pkl

#### Review

- source: model.rules[17]
- coverage: rule
- automatedChecks: 5
- implementationRefs: 9
- selector: DSPEC-LEAN-EQ-SEMANTIC.must[0]
- selector: DSPEC-LEAN-EQ-SEMANTIC.must[1]
- selector: DSPEC-LEAN-EQ-SEMANTIC.must[2]
- selector: DSPEC-LEAN-EQ-SEMANTIC.must[3]
- selector: DSPEC-LEAN-EQ-SEMANTIC.must[4]
- selector: DSPEC-LEAN-EQ-SEMANTIC.must[5]
- selector: DSPEC-LEAN-EQ-SEMANTIC.must[6]
- selector: DSPEC-LEAN-EQ-SEMANTIC.must[7]
- selector: DSPEC-LEAN-EQ-SEMANTIC.must[8]

### DSPEC-MARKDOWN-REVIEW-ARTIFACT

The Markdown review artifact for each locale is deterministically regenerated from the spec model

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.generator`
- term: `artifact.markdown`
- must: `for locale in examples/dspec.pkl.locales: generated/examples/{locale}/dspec.md == emit(markdown, locale, examples/dspec.pkl)`
- must: `emit(markdown).rules.include(source, coverage, selectors, checks, implementations)`
- must: `emit(markdown).reviewSummary.includes(approvedRules + automatedChecks + implementationRefs + domainElements + runtimeEvidenceRecords)`
- check: node test/cli.test.mjs#keeps localized generated markdown review artifacts in sync [reference]
- check: node test/cli.test.mjs#generates markdown for every declared dspec locale [reference]
- check: node test/cli.test.mjs#emits deterministic markdown [reference]
- implementation: code src/cli.mjs#emitMarkdown
- implementation: code src/cli.mjs#markdownReviewSummary
- implementation: code scripts/generate-localized-markdown.mjs#generateLocalizedMarkdown
- implementation: doc generated/examples/ja/dspec.md
- implementation: doc generated/examples/en/dspec.md

#### Review

- source: model.rules[62]
- coverage: rule
- automatedChecks: 3
- implementationRefs: 5
- selector: DSPEC-MARKDOWN-REVIEW-ARTIFACT.must[0]
- selector: DSPEC-MARKDOWN-REVIEW-ARTIFACT.must[1]
- selector: DSPEC-MARKDOWN-REVIEW-ARTIFACT.must[2]

### DSPEC-MBT-BOUNDARY

A future pkl-mbt implementation replaces the checker boundary while preserving schema and fixtures

- kind: transition
- status: review
- priority: 100
- requiredAssurances: reference
- term: `artifact.checker`
- term: `artifact.schema`
- term: `backend.pkl_mbt`
- when: `checker.ported_to_pkl_mbt`
- must: `fixtures.expected_diagnostics_preserved`
- rationale: The Node CLI is a thin prototype boundary. The durable contract should be the Pkl schema plus fixture-level diagnostics.

#### Review

- source: model.rules[70]
- coverage: rule
- automatedChecks: 0
- implementationRefs: 0
- selector: DSPEC-MBT-BOUNDARY.when[0]
- selector: DSPEC-MBT-BOUNDARY.must[0]

### DSPEC-NIX-CI-GATE

CI runs portable fast and Nix formal gates in parallel

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.coverage_oracle`
- term: `artifact.formal_backend`
- term: `artifact.nix_dev_shell`
- must: `githubActions.fast.run(pkf run check:fast).cache(pnpm + pkl + pkfireCas)`
- must: `githubActions.formal.run(nix develop path:$PWD -c pkf run check:formal).cache(nix)`
- must: `githubActions.jobs(fast, formal).parallel && pullRequest.supersededRun.cancelled`
- check: node test/cli.test.mjs#splits fast and formal GitHub Actions gates with caches [reference]
- implementation: runtime .github/workflows/check.yml
- implementation: runtime Taskfile.pkl

#### Review

- source: model.rules[66]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 2
- selector: DSPEC-NIX-CI-GATE.must[0]
- selector: DSPEC-NIX-CI-GATE.must[1]
- selector: DSPEC-NIX-CI-GATE.must[2]

### DSPEC-NIX-FORMAL-TOOLS

The Nix devShell provides dspec runtime and formal backend tools

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.formal_backend`
- term: `artifact.generator`
- term: `artifact.nix_dev_shell`
- must: `devShell.packages.includes(nodejs_24, pnpm, pkl, elan, z3, tlaplus, alloy6)`
- must: `devshellSmoke(strict + requireStorePath).checks(requiredTools)`
- must: `verifyGenerated(requireFormalTools).requires(tlaSany + tlaTlc + alloyAnalyzer)`
- check: node test/cli.test.mjs#declares formal backend tools in Nix devShell [reference]
- check: node test/cli.test.mjs#emits devShell tool smoke reports [reference]
- check: node test/cli.test.mjs#requires formal backend tools when requested [reference]
- implementation: model flake.nix
- implementation: runtime Taskfile.pkl
- implementation: code src/cli.mjs#devshellSmokeReport
- implementation: code src/cli.mjs#assertVerifyGeneratedReport

#### Review

- source: model.rules[26]
- coverage: rule
- automatedChecks: 3
- implementationRefs: 4
- selector: DSPEC-NIX-FORMAL-TOOLS.must[0]
- selector: DSPEC-NIX-FORMAL-TOOLS.must[1]
- selector: DSPEC-NIX-FORMAL-TOOLS.must[2]

### DSPEC-PACKAGE-RELEASE

The v0.1 package declares its public API, compatibility policy, and OIDC release procedure

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.checker`
- term: `artifact.cli`
- term: `artifact.package_release`
- must: `npmPackage.files == {schema + cli + core + readme + license}`
- must: `publish.uses(oidcTrustedPublisher + node24 + npm11) && !publish.uses(longLivedWriteToken)`
- must: `breakingPublicChange -> semverMinorBefore1_0 && changedSemantics -> newClauseAstSemanticsVersion`
- check: node test/release.test.mjs#defines the v0.1 public package boundary [reference]
- check: node test/release.test.mjs#defines explicit release and compatibility policy [reference]
- check: node test/release.test.mjs#publishes through npm OIDC without a long-lived token [reference]
- implementation: model package.json
- implementation: model release-please-config.json
- implementation: model .release-please-manifest.json
- implementation: model .github/workflows/release-please.yml
- implementation: model .github/workflows/publish.yml
- implementation: model docs/versioning.md
- implementation: model docs/releasing.md
- implementation: model LICENSE
- implementation: code src/core/clause-ast.mjs#CLAUSE_AST_SEMANTICS_VERSION

#### Review

- source: model.rules[27]
- coverage: rule
- automatedChecks: 3
- implementationRefs: 9
- selector: DSPEC-PACKAGE-RELEASE.must[0]
- selector: DSPEC-PACKAGE-RELEASE.must[1]
- selector: DSPEC-PACKAGE-RELEASE.must[2]

### DSPEC-REAL-APP-DOGFOOD

The real app model passes check, drift, domain, reconcile, reverse, and profile gates as a dspec specification master

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.app_profile`
- term: `artifact.app_profile_scenario`
- term: `artifact.app_profile_suite`
- term: `artifact.dogfood_task`
- term: `artifact.domain_coverage_oracle`
- term: `artifact.drift_detector`
- term: `artifact.profile_scaffold_diff`
- term: `artifact.real_app_model`
- term: `artifact.reconciliation_oracle`
- term: `artifact.reverse_coverage_oracle`
- term: `concept.verification_target`
- must: `examples/sample-webapp-2026.pkl.check == pass`
- must: `examples/sample-webapp-2026.pkl.drift == pass`
- must: `examples/sample-webapp-2026.pkl.domainCoverage == pass`
- must: `reconcileRealApp(examples/sample-webapp-2026.pkl, importRealApp(sample-webapp-2026)) == pass`
- must: `reverseCoverage(importRealApp(sample-webapp-2026), examples/sample-webapp-2026.pkl) == pass`
- must: `checkAppProfile(fixtures/sample-webapp-profile.pkl) == pass`
- must: `evaluateAppProfile(fixtures/sample-webapp-profile-scenarios.pkl) == pass`
- must: `evaluateAppProfile(fixtures/sample-webapp-profile-extended-scenarios.pkl) == pass`
- must: `coverageAppProfileScenarios(fixtures/sample-webapp-profile-extended-scenarios.pkl) == pass`
- must: `scoreAppProfileMutations(fixtures/sample-webapp-profile-extended-scenarios.pkl).score == 1`
- must: `coverageAppProfileScenarios(fixtures/sample-webapp-profile-route-scenarios.pkl) == pass`
- must: `coverageAppProfileScenarios(fixtures/sample-webapp-profile-route-missing-spec-scenario.pkl) == fail`
- must: `coverageAppProfileScenarios(fixtures/sample-webapp-profile-underdeclared-categories.pkl) == fail`
- must: `coverageAppProfileScenarios(fixtures/sample-webapp-profile-route-ineffective-scenario.pkl) == fail`
- must: `checkAppProfileSuite(fixtures/sample-webapp-profile-suite.pkl) == pass`
- must: `scaffoldAppProfile(--diff, fixtures/sample-webapp-profile.pkl) == pass`
- must: `scaffoldAppProfile(--apply --dry-run, fixtures/sample-webapp-profile.pkl) == pass`
- must: `evaluateAppProfile(--markdown, fixtures/sample-webapp-profile-extended-scenarios.pkl) == pass`
- check: node test/cli.test.mjs#dogfoods a real app model [reference]
- implementation: runtime Taskfile.pkl
- implementation: model examples/sample-webapp-2026.pkl
- implementation: model fixtures/sample-webapp-2026/apps/api/src/app.ts
- implementation: model fixtures/sample-webapp-2026/packages/contracts/src/index.ts
- implementation: model fixtures/sample-webapp-2026/.github/workflows/ci.yml
- implementation: model fixtures/sample-webapp-2026/.github/workflows/weekly-review.yml
- implementation: model fixtures/sample-webapp-2026/flaker.toml
- implementation: model fixtures/reports/import-real-app-sample-webapp.json
- implementation: model fixtures/reports/reconcile-real-app-sample-webapp.json
- implementation: model fixtures/reports/reverse-coverage-sample-webapp.json
- implementation: model fixtures/sample-webapp-profile.pkl
- implementation: model fixtures/sample-webapp-profile-scenarios.pkl
- implementation: model fixtures/sample-webapp-profile-extended-scenarios.pkl
- implementation: model fixtures/sample-webapp-profile-route-scenarios.pkl
- implementation: model fixtures/sample-webapp-profile-route-missing-spec-scenario.pkl
- implementation: model fixtures/sample-webapp-profile-route-ineffective-scenario.pkl
- implementation: model fixtures/sample-webapp-profile-underdeclared-categories.pkl
- implementation: model fixtures/route-only-model.pkl
- implementation: model fixtures/route-only-app/apps/api/src/app.ts
- implementation: model fixtures/sample-webapp-profile-suite.pkl
- implementation: model fixtures/reports/scaffold-app-profile-diff.json
- implementation: model fixtures/reports/evaluate-app-profile-scenarios.json
- implementation: model fixtures/reports/evaluate-app-profile-extended-scenarios.json
- implementation: model fixtures/reports/evaluate-app-profile-extended-scenarios.md
- implementation: model fixtures/reports/coverage-app-profile-scenarios.json
- implementation: model fixtures/reports/score-app-profile-mutations.json
- implementation: model fixtures/reports/evaluate-app-profile-suite.json
- implementation: model fixtures/reports/check-app-profile-sample-webapp.json
- implementation: model fixtures/reports/check-app-profile-suite.json
- implementation: model fixtures/reports/spec-reading-eval-sample-webapp.json
- implementation: model fixtures/reports/spec-reading-eval-refresh-stale.json
- implementation: model fixtures/reports/spec-reading-eval-suite.json
- implementation: model fixtures/reports/coverage-spec-reading-eval-suite.json
- implementation: model fixtures/reports/metamorphic-spec-reading-eval.json

#### Review

- source: model.rules[65]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 34
- selector: DSPEC-REAL-APP-DOGFOOD.must[0]
- selector: DSPEC-REAL-APP-DOGFOOD.must[1]
- selector: DSPEC-REAL-APP-DOGFOOD.must[2]
- selector: DSPEC-REAL-APP-DOGFOOD.must[3]
- selector: DSPEC-REAL-APP-DOGFOOD.must[4]
- selector: DSPEC-REAL-APP-DOGFOOD.must[5]
- selector: DSPEC-REAL-APP-DOGFOOD.must[6]
- selector: DSPEC-REAL-APP-DOGFOOD.must[7]
- selector: DSPEC-REAL-APP-DOGFOOD.must[8]
- selector: DSPEC-REAL-APP-DOGFOOD.must[9]
- selector: DSPEC-REAL-APP-DOGFOOD.must[10]
- selector: DSPEC-REAL-APP-DOGFOOD.must[11]
- selector: DSPEC-REAL-APP-DOGFOOD.must[12]
- selector: DSPEC-REAL-APP-DOGFOOD.must[13]
- selector: DSPEC-REAL-APP-DOGFOOD.must[14]
- selector: DSPEC-REAL-APP-DOGFOOD.must[15]
- selector: DSPEC-REAL-APP-DOGFOOD.must[16]
- selector: DSPEC-REAL-APP-DOGFOOD.must[17]

### DSPEC-REAL-APP-IMPORTER

The real app importer deterministically extracts observed app facts from implementation artifacts

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.json_report`
- term: `artifact.observed_app_facts`
- term: `artifact.real_app_importer`
- term: `artifact.real_app_model`
- must: `importRealApp(root).observes(routes + contracts + workflows + qualityConfig + infrastructure)`
- must: `importRealApp(root).pklFragment.canSeed(patterns)`
- must: `evaluateRealAppImport(goldFacts).precision == 1 && evaluateRealAppImport(goldFacts).recall == 1`
- must: `realAppCore.hasNoFilesystemOrPklProcessDependency && cli.infrastructure == realAppCore.infrastructure`
- check: node test/cli.test.mjs#imports real app artifacts as observed facts [reference]
- check: node test/cli.test.mjs#imports real app artifacts as a Pkl fragment [reference]
- check: node test/cli.test.mjs#imports Cloudflare and Pulumi infrastructure from a second real app holdout [reference]
- check: node test/cli.test.mjs#evaluates real app importer precision and recall against typed gold facts [reference]
- check: node test/cli.test.mjs#imports Terraform plans and Kubernetes manifests as infrastructure facts [reference]
- check: node test/cli.test.mjs#evaluates Terraform and Kubernetes importer coverage [reference]
- check: node test/cli.test.mjs#projects imported IaC into domain patterns without inventing guarantees [reference]
- check: node test/cli.test.mjs#keeps real app import fixture in sync [reference]
- check: node test/real-app-core.test.mjs#normalizes IaC documents without filesystem access [reference]
- check: node test/real-app-core.test.mjs#keeps the core API and CLI infrastructure output identical [reference]
- check: node test/real-app-core.test.mjs#compares normalized app facts with a typed gold set [reference]
- check: node test/real-app-core.test.mjs#projects infrastructure facts conservatively [reference]
- implementation: code src/cli.mjs#importRealApp
- implementation: code src/cli.mjs#parseHonoRoutes
- implementation: code src/cli.mjs#parseWorkflowYaml
- implementation: code src/cli.mjs#importInfrastructure
- implementation: code src/cli.mjs#realAppImportEvaluationReport
- implementation: code src/cli.mjs#emitRealAppPkl
- implementation: code src/core/real-app.mjs#importInfrastructureDocuments
- implementation: code src/core/real-app.mjs#parseWranglerInfrastructure
- implementation: code src/core/real-app.mjs#parsePulumiInfrastructure
- implementation: code src/core/real-app.mjs#parseTerraformPlanInfrastructure
- implementation: code src/core/real-app.mjs#parseKubernetesInfrastructure
- implementation: code src/core/real-app.mjs#evaluateRealAppImport
- implementation: code src/core/real-app.mjs#realAppObservedDomain
- implementation: code dspec/Schema.pkl#RealAppImportEvaluation
- implementation: code dspec/Schema.pkl#RealAppImportFact
- implementation: model fixtures/import-real-app-eval-mnemo.pkl
- implementation: model fixtures/import-real-app-eval-iac.pkl
- implementation: model fixtures/reports/evaluate-real-app-import-mnemo.json
- implementation: model fixtures/reports/evaluate-real-app-import-iac.json
- implementation: model fixtures/reports/import-real-app-sample-webapp.json
- implementation: model fixtures/sample-webapp-2026/apps/api/src/app.ts
- implementation: model fixtures/sample-webapp-2026/packages/contracts/src/index.ts
- implementation: model fixtures/sample-webapp-2026/.github/workflows/ci.yml
- implementation: model fixtures/sample-webapp-2026/flaker.toml
- implementation: model fixtures/sample-webapp-2026/vrt.config.json
- implementation: model docs/dogfooding-2026-07-14-mnemo.md

#### Review

- source: model.rules[19]
- coverage: rule
- automatedChecks: 12
- implementationRefs: 26
- selector: DSPEC-REAL-APP-IMPORTER.must[0]
- selector: DSPEC-REAL-APP-IMPORTER.must[1]
- selector: DSPEC-REAL-APP-IMPORTER.must[2]
- selector: DSPEC-REAL-APP-IMPORTER.must[3]

### DSPEC-REAL-APP-RECONCILIATION

Real app reconciliation detects drift between the authored model and observed app facts

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.drift_detector`
- term: `artifact.failure_suggestion`
- term: `artifact.observed_app_facts`
- term: `artifact.real_app_importer`
- term: `artifact.real_app_model`
- term: `artifact.reconciliation_oracle`
- must: `reconcileRealApp(model, observed).covers(patternElements)`
- must: `missingObservedFact -> report.status == fail`
- must: `missingObservedFact -> suggestion.kind == implementation-missing`
- check: node test/cli.test.mjs#reconciles a real app model with imported facts [reference]
- check: node test/cli.test.mjs#reports real app reconciliation drift [reference]
- check: node test/cli.test.mjs#renders real app drift suggestions for CLI readers [reference]
- check: node test/cli.test.mjs#keeps real app reconciliation fixture in sync [reference]
- implementation: code src/cli.mjs#reconcileRealAppReport
- implementation: code src/core/real-app.mjs#realAppObservedDomain
- implementation: code src/cli.mjs#restoreObservedFactSuggestion
- implementation: code src/cli.mjs#restoreObservedReleaseGateSuggestion
- implementation: code src/cli.mjs#renderReportSuggestions
- implementation: code src/cli.mjs#renderRealAppReconciliationReport
- implementation: model examples/sample-webapp-2026.pkl
- implementation: model fixtures/reports/import-real-app-sample-webapp.json
- implementation: model fixtures/reports/reconcile-real-app-sample-webapp.json

#### Review

- source: model.rules[20]
- coverage: rule
- automatedChecks: 4
- implementationRefs: 9
- selector: DSPEC-REAL-APP-RECONCILIATION.must[0]
- selector: DSPEC-REAL-APP-RECONCILIATION.must[1]
- selector: DSPEC-REAL-APP-RECONCILIATION.must[2]

### DSPEC-REAL-APP-REVERSE-COVERAGE

Reverse coverage checks that observed app facts are represented in the authored model

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.coverage_oracle`
- term: `artifact.failure_suggestion`
- term: `artifact.observed_app_facts`
- term: `artifact.real_app_importer`
- term: `artifact.real_app_model`
- term: `artifact.reverse_coverage_oracle`
- must: `reverseCoverage(observed, model).uncovered == []`
- must: `unmodeledObservedFact -> report.status == fail`
- must: `unmodeledObservedFact -> suggestion.kind == spec-missing`
- check: node test/cli.test.mjs#reports reverse coverage for observed real app facts [reference]
- check: node test/cli.test.mjs#reports unmodeled observed real app facts [reference]
- implementation: code src/cli.mjs#reverseCoverageReport
- implementation: code src/cli.mjs#observedDomainCoverageElements
- implementation: code src/cli.mjs#modelReverseCoverageElements
- implementation: code src/cli.mjs#modelObservedFactSuggestion
- implementation: code src/cli.mjs#renderReportSuggestions
- implementation: model examples/sample-webapp-2026.pkl
- implementation: model fixtures/reports/import-real-app-sample-webapp.json
- implementation: model fixtures/reports/reverse-coverage-sample-webapp.json

#### Review

- source: model.rules[21]
- coverage: rule
- automatedChecks: 2
- implementationRefs: 8
- selector: DSPEC-REAL-APP-REVERSE-COVERAGE.must[0]
- selector: DSPEC-REAL-APP-REVERSE-COVERAGE.must[1]
- selector: DSPEC-REAL-APP-REVERSE-COVERAGE.must[2]

### DSPEC-RELEASE-SAFETY-PATTERN

Release safety is authored as a typed pattern and projects health-gate, rollback, rollback-test, and migration-compatibility checks to backends

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.generator`
- term: `artifact.release_safety_pattern`
- term: `concept.release_environment`
- term: `concept.release_gate`
- term: `concept.release_migration`
- term: `concept.release_rollback`
- term: `concept.release_service`
- term: `concept.release_step`
- must: `releaseProductionStepHasHealthGate(step)`
- must: `releaseTrafficShiftHasRollback(step)`
- must: `releaseRollbackPlanTested(step)`
- must: `releaseMigrationBackwardCompatible(step)`
- check: node test/cli.test.mjs#accepts Release safety pattern [reference]
- check: node test/cli.test.mjs#rejects invalid Release safety references [reference]
- check: node test/cli.test.mjs#emits Release safety pattern into backend projections [reference]
- check: node test/cli.test.mjs#normalizes Release safety counterexamples to source steps [reference]
- check: node test/cli.test.mjs#keeps generated Release safety checks load-bearing [reference]
- implementation: model dspec/Schema.pkl#ReleaseModel
- implementation: code src/cli.mjs#validateReleaseModel
- implementation: code src/cli.mjs#releaseProjection
- implementation: code src/cli.mjs#propertyReleaseProductionStepsHaveHealthGate
- implementation: code src/cli.mjs#propertyReleaseTrafficShiftsHaveRollback
- implementation: code src/cli.mjs#propertyReleaseRollbackPlansAreTested
- implementation: code src/cli.mjs#propertyReleaseMigrationsAreBackwardCompatible
- implementation: model fixtures/release-model.pkl
- implementation: model fixtures/release-model-broken.pkl

#### Review

- source: model.rules[38]
- coverage: rule
- automatedChecks: 5
- implementationRefs: 9
- selector: DSPEC-RELEASE-SAFETY-PATTERN.must[0]
- selector: DSPEC-RELEASE-SAFETY-PATTERN.must[1]
- selector: DSPEC-RELEASE-SAFETY-PATTERN.must[2]
- selector: DSPEC-RELEASE-SAFETY-PATTERN.must[3]

### DSPEC-RUNTIME-COLLECTOR-FIXTURE

Runtime collector fixtures are generated from Runtime safety specs as collectable and verifiable inline provider-payload manifests

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.generator`
- term: `artifact.runtime_collector_fixture`
- term: `artifact.runtime_collector_manifest`
- term: `artifact.runtime_evidence_collector`
- term: `artifact.runtime_evidence_verifier`
- term: `concept.runtime_evidence_collection`
- must: `runtimeCollectorFixtureHasInlinePayloads(runtimeModel)`
- must: `runtimeCollectorFixtureVerifies(runtimeModel)`
- check: node test/cli.test.mjs#emits collectable inline runtime evidence fixture manifests [reference]
- implementation: code src/cli.mjs#runtimeCollectorFixtureManifest
- implementation: code src/cli.mjs#runtimeEvidencePayloadForSource
- implementation: code src/cli.mjs#readRuntimeEvidenceCollectorSource

#### Review

- source: model.rules[45]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 3
- selector: DSPEC-RUNTIME-COLLECTOR-FIXTURE.must[0]
- selector: DSPEC-RUNTIME-COLLECTOR-FIXTURE.must[1]

### DSPEC-RUNTIME-COLLECTOR-MANIFEST

Runtime collector manifests are deterministically generated from Runtime safety specs

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.generator`
- term: `artifact.runtime_collector_manifest`
- term: `artifact.runtime_evidence_collector`
- term: `concept.runtime_alert`
- term: `concept.runtime_dependency`
- term: `concept.runtime_evidence_collection`
- term: `concept.runtime_runbook`
- term: `concept.runtime_slo`
- must: `runtimeCollectorManifestGeneratedFromSpec(runtimeModel)`
- must: `runtimeCollectorManifestHasSourceMap(manifest)`
- check: node test/cli.test.mjs#emits runtime evidence collector manifests from Runtime safety specs [reference]
- check: node test/cli.test.mjs#emits Runtime safety pattern into backend projections [reference]
- implementation: code src/cli.mjs#runtimeCollectorManifest
- implementation: code src/cli.mjs#runtimeCollectorSources
- implementation: code src/cli.mjs#runtimeCollectorFile
- implementation: model fixtures/runtime-model.pkl

#### Review

- source: model.rules[43]
- coverage: rule
- automatedChecks: 2
- implementationRefs: 4
- selector: DSPEC-RUNTIME-COLLECTOR-MANIFEST.must[0]
- selector: DSPEC-RUNTIME-COLLECTOR-MANIFEST.must[1]

### DSPEC-RUNTIME-EVIDENCE-COLLECTOR

The runtime evidence collector reads provider API payloads from a manifest and aggregates them into the importer contract's provider-scoped JSON

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.runtime_evidence_collector`
- term: `artifact.runtime_evidence_importer`
- term: `concept.runtime_alert_policy`
- term: `concept.runtime_dependency_trace`
- term: `concept.runtime_evidence_collection`
- term: `concept.runtime_evidence_import`
- term: `concept.runtime_runbook_execution`
- term: `concept.runtime_telemetry`
- must: `runtimeEvidenceCollectsProviderScopedJson(manifest)`
- must: `collectRuntimeEvidence(httpSource).fetchesProviderPayload`
- must: `runtimeEvidenceCollectorCanEmitPkl(manifest)`
- must: `runtimeEvidenceCollectorRejectsInvalidManifest(manifest)`
- check: node test/cli.test.mjs#collects runtime evidence from provider API payloads [reference]
- check: node test/cli.test.mjs#collects runtime evidence from live HTTP sources [reference]
- check: node test/cli.test.mjs#collects runtime evidence directly as a Pkl fragment [reference]
- check: node test/cli.test.mjs#rejects invalid runtime evidence collector manifests [reference]
- implementation: code src/cli.mjs#collectRuntimeEvidence
- implementation: code src/cli.mjs#readRuntimeEvidenceCollectorSource
- implementation: code src/cli.mjs#fetchRuntimeEvidenceHttpSource
- implementation: code src/cli.mjs#collectorAdapter
- implementation: model fixtures/runtime-evidence-collector.json
- implementation: model fixtures/runtime-evidence-collector-invalid.json

#### Review

- source: model.rules[42]
- coverage: rule
- automatedChecks: 4
- implementationRefs: 6
- selector: DSPEC-RUNTIME-EVIDENCE-COLLECTOR.must[0]
- selector: DSPEC-RUNTIME-EVIDENCE-COLLECTOR.must[1]
- selector: DSPEC-RUNTIME-EVIDENCE-COLLECTOR.must[2]
- selector: DSPEC-RUNTIME-EVIDENCE-COLLECTOR.must[3]

### DSPEC-RUNTIME-EVIDENCE-IMPORTER

The runtime evidence importer normalizes provider-scoped JSON into deterministic Runtime evidence Pkl fragments or JSON

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.runtime_evidence_importer`
- term: `artifact.runtime_evidence_pattern`
- term: `concept.runtime_alert_policy`
- term: `concept.runtime_dependency_trace`
- term: `concept.runtime_evidence_import`
- term: `concept.runtime_runbook_execution`
- term: `concept.runtime_telemetry`
- must: `runtimeEvidenceImportPklDeterministic(providerJson)`
- must: `runtimeEvidenceImportJsonStable(providerJson)`
- must: `runtimeEvidenceImportRejectsInvalidRecords(providerJson)`
- check: node test/cli.test.mjs#imports runtime evidence JSON as a deterministic Pkl fragment [reference]
- check: node test/cli.test.mjs#imports runtime evidence JSON as stable JSON [reference]
- check: node test/cli.test.mjs#rejects invalid runtime evidence imports [reference]
- implementation: code src/cli.mjs#importRuntimeEvidence
- implementation: code src/cli.mjs#normalizeRuntimeEvidenceImport
- implementation: model fixtures/runtime-evidence-import.json
- implementation: model fixtures/runtime-evidence-import-invalid.json

#### Review

- source: model.rules[41]
- coverage: rule
- automatedChecks: 3
- implementationRefs: 4
- selector: DSPEC-RUNTIME-EVIDENCE-IMPORTER.must[0]
- selector: DSPEC-RUNTIME-EVIDENCE-IMPORTER.must[1]
- selector: DSPEC-RUNTIME-EVIDENCE-IMPORTER.must[2]

### DSPEC-RUNTIME-EVIDENCE-PATTERN

Runtime evidence is authored as a typed pattern and projects SLO telemetry, alert-policy, runbook-execution, and dependency-trace drift checks to backends

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.generator`
- term: `artifact.runtime_evidence_pattern`
- term: `concept.runtime_alert`
- term: `concept.runtime_alert_policy`
- term: `concept.runtime_dependency`
- term: `concept.runtime_dependency_trace`
- term: `concept.runtime_runbook`
- term: `concept.runtime_runbook_execution`
- term: `concept.runtime_slo`
- term: `concept.runtime_telemetry`
- must: `runtimeSloHasTelemetry(slo)`
- must: `runtimeTelemetryMeetsSlo(telemetry)`
- must: `runtimePageAlertHasEnabledPolicy(alert)`
- must: `runtimePageAlertHasRunbookExecution(alert)`
- must: `runtimeDependencyTraceWithinTimeout(dependencyTrace)`
- check: node test/cli.test.mjs#rejects invalid Runtime evidence references [reference]
- check: node test/cli.test.mjs#emits Runtime safety pattern into backend projections [reference]
- check: node test/cli.test.mjs#normalizes Runtime safety counterexamples to source records [reference]
- check: node test/cli.test.mjs#keeps generated Runtime safety checks load-bearing [reference]
- implementation: model dspec/Schema.pkl#RuntimeTelemetryWindow
- implementation: model dspec/Schema.pkl#RuntimeAlertPolicy
- implementation: model dspec/Schema.pkl#RuntimeRunbookExecution
- implementation: model dspec/Schema.pkl#RuntimeDependencyTrace
- implementation: code src/cli.mjs#validateRuntimeModel
- implementation: code src/cli.mjs#propertyRuntimeSlosHaveTelemetry
- implementation: code src/cli.mjs#propertyRuntimeTelemetryMeetsSlo
- implementation: code src/cli.mjs#propertyRuntimePageAlertsHaveEnabledPolicy
- implementation: code src/cli.mjs#propertyRuntimePageAlertsHaveExecutedRunbook
- implementation: code src/cli.mjs#propertyRuntimeDependencyTracesWithinTimeout
- implementation: model fixtures/runtime-model.pkl
- implementation: model fixtures/runtime-model-broken.pkl

#### Review

- source: model.rules[40]
- coverage: rule
- automatedChecks: 4
- implementationRefs: 12
- selector: DSPEC-RUNTIME-EVIDENCE-PATTERN.must[0]
- selector: DSPEC-RUNTIME-EVIDENCE-PATTERN.must[1]
- selector: DSPEC-RUNTIME-EVIDENCE-PATTERN.must[2]
- selector: DSPEC-RUNTIME-EVIDENCE-PATTERN.must[3]
- selector: DSPEC-RUNTIME-EVIDENCE-PATTERN.must[4]

### DSPEC-RUNTIME-EVIDENCE-VERIFIER

The runtime evidence verifier detects drift between collector manifest expectations and collected evidence

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.evidence_quality_summary`
- term: `artifact.runtime_collector_manifest`
- term: `artifact.runtime_evidence_collector`
- term: `artifact.runtime_evidence_verifier`
- term: `concept.runtime_alert_policy`
- term: `concept.runtime_dependency_trace`
- term: `concept.runtime_evidence_collection`
- term: `concept.runtime_runbook_execution`
- term: `concept.runtime_telemetry`
- must: `runtimeEvidenceVerifierCoversExpectations(manifest)`
- must: `runtimeEvidenceVerifierReportsDrift(manifest)`
- must: `verifyRuntimeEvidence(staleEvidence).freshWithinDays.reported`
- must: `verifyRuntimeEvidence(json).quality.summarizes(missing + stale + freshnessChecked + score)`
- check: node test/cli.test.mjs#verifies runtime evidence collector expectations [reference]
- check: node test/cli.test.mjs#reports runtime evidence expectation drift as JSON [reference]
- check: node test/cli.test.mjs#reports stale runtime evidence as drift [reference]
- check: node test/cli.test.mjs#reports runtime evidence quality and freshness summary [reference]
- implementation: code src/cli.mjs#verifyRuntimeEvidenceReport
- implementation: code src/cli.mjs#verifyRuntimeEvidenceSource
- implementation: code src/cli.mjs#renderRuntimeEvidenceVerification
- implementation: code src/cli.mjs#checkExpectedFreshness
- implementation: code src/cli.mjs#runtimeEvidenceQualitySummary
- implementation: code src/cli.mjs#runtimeEvidenceObservation
- implementation: model fixtures/runtime-evidence-collector.json
- implementation: model fixtures/runtime-evidence-collector-broken.json
- implementation: model fixtures/runtime-evidence-collector-stale.json

#### Review

- source: model.rules[44]
- coverage: rule
- automatedChecks: 4
- implementationRefs: 9
- selector: DSPEC-RUNTIME-EVIDENCE-VERIFIER.must[0]
- selector: DSPEC-RUNTIME-EVIDENCE-VERIFIER.must[1]
- selector: DSPEC-RUNTIME-EVIDENCE-VERIFIER.must[2]
- selector: DSPEC-RUNTIME-EVIDENCE-VERIFIER.must[3]

### DSPEC-RUNTIME-SAFETY-PATTERN

Runtime safety is authored as a typed pattern and projects SLO page-alert, tested-runbook, dependency-timeout, and retry-idempotency checks to backends

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.generator`
- term: `artifact.runtime_safety_pattern`
- term: `concept.runtime_alert`
- term: `concept.runtime_dependency`
- term: `concept.runtime_runbook`
- term: `concept.runtime_service`
- term: `concept.runtime_signal`
- term: `concept.runtime_slo`
- must: `runtimeCriticalSloHasPageAlert(slo)`
- must: `runtimePageAlertHasTestedRunbook(alert)`
- must: `runtimeDependencyHasTimeout(dependency)`
- must: `runtimeRetryIsIdempotent(dependency)`
- check: node test/cli.test.mjs#accepts Runtime safety pattern [reference]
- check: node test/cli.test.mjs#rejects invalid Runtime safety references [reference]
- check: node test/cli.test.mjs#emits Runtime safety pattern into backend projections [reference]
- check: node test/cli.test.mjs#normalizes Runtime safety counterexamples to source records [reference]
- check: node test/cli.test.mjs#keeps generated Runtime safety checks load-bearing [reference]
- implementation: model dspec/Schema.pkl#RuntimeModel
- implementation: code src/cli.mjs#validateRuntimeModel
- implementation: code src/cli.mjs#runtimeProjection
- implementation: code src/cli.mjs#propertyRuntimeCriticalSlosHavePageAlert
- implementation: code src/cli.mjs#propertyRuntimePageAlertsHaveTestedRunbook
- implementation: code src/cli.mjs#propertyRuntimeDependenciesHaveTimeout
- implementation: code src/cli.mjs#propertyRuntimeRetriesAreIdempotent
- implementation: model fixtures/runtime-model.pkl
- implementation: model fixtures/runtime-model-broken.pkl

#### Review

- source: model.rules[39]
- coverage: rule
- automatedChecks: 5
- implementationRefs: 9
- selector: DSPEC-RUNTIME-SAFETY-PATTERN.must[0]
- selector: DSPEC-RUNTIME-SAFETY-PATTERN.must[1]
- selector: DSPEC-RUNTIME-SAFETY-PATTERN.must[2]
- selector: DSPEC-RUNTIME-SAFETY-PATTERN.must[3]

### DSPEC-SCHEMA-TYPED

Spec models are type-checked by the Pkl schema

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.pkl_model`
- term: `artifact.schema`
- term: `backend.pkl`
- when: `pkl.file.authored`
- must: `pkl.eval(model).ok`
- check: pkl examples/dspec.pkl [reference]
- implementation: model dspec/Schema.pkl

#### Review

- source: model.rules[0]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-SCHEMA-TYPED.when[0]
- selector: DSPEC-SCHEMA-TYPED.must[0]

### DSPEC-SEMANTICS-INFERENTIAL-SUPPORT

dspec semantics is extended as support/inferability rather than truth

- kind: transition
- status: review
- priority: 100
- requiredAssurances: reference
- term: `concept.inferon`
- term: `concept.rule`
- term: `concept.support`
- must: `rule.claim.supported_by(checks + implementedBy + backend_proofs)`
- rationale: Inspired by proof-theoretic semantics: a dspec rule should behave like an inferon whose meaning is given by the base that supports it, not by an uninspected truth value.

#### Review

- source: model.rules[68]
- coverage: rule
- automatedChecks: 0
- implementationRefs: 0
- selector: DSPEC-SEMANTICS-INFERENTIAL-SUPPORT.must[0]

### DSPEC-SOURCE-MAP-GENERATED

Generated artifacts have a source map back to source spec elements

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.generator`
- term: `artifact.source_map`
- term: `concept.rule`
- term: `concept.verification_target`
- must: `emitsSourceMap(model)`
- check: node test/cli.test.mjs#emits source maps for generated artifacts [reference]
- check: node test/cli.test.mjs#keeps generated source map artifact in sync [reference]
- implementation: code src/cli.mjs#emitSourceMapObject
- implementation: code src/cli.mjs#emitSourceMap
- implementation: doc generated/source-map.json

#### Review

- source: model.rules[55]
- coverage: rule
- automatedChecks: 2
- implementationRefs: 3
- selector: DSPEC-SOURCE-MAP-GENERATED.must[0]

### DSPEC-SPEC-CHANGE-REVIEW

Spec change review verifies check, impact, compatibility classification, and coverage gates as one procedure artifact for spec changes

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.breaking_change_policy`
- term: `artifact.compat_report`
- term: `artifact.coverage_oracle`
- term: `artifact.impact_report`
- term: `artifact.json_report`
- term: `artifact.spec_change_review`
- must: `reviewSpecChange(review).runs(checkBefore + checkAfter + impact + compatibility + breakingPolicy + coverageAfter)`
- must: `reviewSpecChange(review).gates(expectedCompatibility + allowedCompatibility)`
- must: `reviewSpecChange(review).breaking -> requires(migrationPlan + deprecationPlan + rolloutPlan + ownerApproval)`
- must: `reviewSpecChange(review).evidence.ref resolves(file + markdownAnchor)`
- must: `reviewSpecChange(review).emits(jsonReport + markdownReview)`
- check: node test/cli.test.mjs#reviews a spec change procedure [reference]
- check: node test/cli.test.mjs#renders a spec change procedure for review [reference]
- check: node test/cli.test.mjs#rejects a spec change procedure when compatibility is not allowed [reference]
- check: node test/cli.test.mjs#requires explicit evidence for approved breaking spec changes [reference]
- check: node test/cli.test.mjs#accepts approved breaking spec changes with required evidence [reference]
- check: node test/cli.test.mjs#rejects breaking spec changes with missing evidence refs [reference]
- check: node test/cli.test.mjs#keeps spec change review JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps approved breaking spec change review JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps missing-evidence spec change review JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps missing-ref spec change review JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#reviews spec changes through spec-change subcommands [reference]
- implementation: code dspec/Schema.pkl#SpecChangeReviewStep
- implementation: code dspec/Schema.pkl#SpecChangeEvidenceKind
- implementation: code dspec/Schema.pkl#SpecChangeReview
- implementation: code dspec/Schema.pkl#SpecChangeEvidence
- implementation: code src/cli.mjs#loadSpecChangeReview
- implementation: code src/cli.mjs#parseSpecChangeReviewArgs
- implementation: code src/cli.mjs#specChangeReviewUsage
- implementation: code src/cli.mjs#runSpecChangeReview
- implementation: code src/cli.mjs#specChangeReviewReport
- implementation: code src/cli.mjs#specChangeBreakingPolicyStep
- implementation: code src/cli.mjs#specChangeEvidenceRefStep
- implementation: code src/cli.mjs#markdownHeadingAnchor
- implementation: code src/cli.mjs#markdownAnchors
- implementation: code src/cli.mjs#renderSpecChangeReviewMarkdownReport
- implementation: code src/cli.mjs#renderSpecChangeReviewReport
- implementation: model fixtures/spec-change-review.pkl
- implementation: model fixtures/spec-change-review-breaking-disallowed.pkl
- implementation: model fixtures/spec-change-review-breaking-approved.pkl
- implementation: model fixtures/spec-change-review-breaking-missing-evidence.pkl
- implementation: model fixtures/spec-change-review-breaking-missing-ref.pkl
- implementation: model fixtures/reports/spec-change-review.json
- implementation: model fixtures/reports/spec-change-review-breaking-approved.json
- implementation: model fixtures/reports/spec-change-review-breaking-missing-evidence.json
- implementation: model fixtures/reports/spec-change-review-breaking-missing-ref.json

#### Review

- source: model.rules[58]
- coverage: rule
- automatedChecks: 11
- implementationRefs: 24
- selector: DSPEC-SPEC-CHANGE-REVIEW.must[0]
- selector: DSPEC-SPEC-CHANGE-REVIEW.must[1]
- selector: DSPEC-SPEC-CHANGE-REVIEW.must[2]
- selector: DSPEC-SPEC-CHANGE-REVIEW.must[3]
- selector: DSPEC-SPEC-CHANGE-REVIEW.must[4]

### DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD

Spec change review scaffold deterministically generates a review Pkl draft from before/after models

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.breaking_change_policy`
- term: `artifact.compat_report`
- term: `artifact.report_fixture`
- term: `artifact.spec_change_review`
- term: `artifact.spec_change_review_scaffold`
- must: `scaffoldSpecChangeReview(before, after).emits(SpecChangeReviewPkl)`
- must: `scaffoldSpecChangeReview(outputPath).writes(PklFile) && importPath.relativeTo(outputPath)`
- must: `scaffoldSpecChangeReview(outputPath).prints(nextReviewCommand)`
- must: `reviewSpecChange(savedReview).independentOf(cwd)`
- must: `scaffoldSpecChangeReview(before, after).fills(expectedCompatibility + allowedCompatibility + requiredSteps)`
- must: `scaffoldSpecChangeReview(breaking).requiresBreakingEvidence && leavesEvidenceEmpty`
- must: `reviewSpecChange(breakingMissingEvidence).suggests(evidencePkl)`
- must: `scaffoldSpecChangeReview.help.documents(output + breakingEvidence)`
- must: `specChangeCommand.group(compat + scaffold + review) && onlyCanonicalCommandNames.exposed`
- must: `removedLegacySpecChangeCommands.rejectWith(unknownCommand)`
- must: `specChangeCommand.help.orders(compat -> scaffold -> review) && subcommands.haveLocalUsage`
- must: `topLevelUsage.lists(specChange.compat -> specChange.scaffold -> specChange.review)`
- must: `fixtures.scaffoldSpecChangeReview == cli.scaffoldSpecChangeReview`
- check: node test/cli.test.mjs#scaffolds spec change review drafts [reference]
- check: node test/cli.test.mjs#scaffolds breaking spec change review drafts with evidence policy [reference]
- check: node test/cli.test.mjs#keeps scaffolded spec change review draft fixture in sync [reference]
- check: node test/cli.test.mjs#writes scaffolded spec change review drafts to an output path [reference]
- check: node test/cli.test.mjs#reports scaffolded spec change review output metadata as JSON [reference]
- check: node test/cli.test.mjs#renders breaking spec change evidence suggestions [reference]
- check: node test/cli.test.mjs#reports breaking spec change evidence suggestions as JSON [reference]
- check: node test/cli.test.mjs#renders scaffold spec change review command help [reference]
- check: node test/cli.test.mjs#scaffolds spec change reviews through spec-change subcommands [reference]
- check: node test/cli.test.mjs#renders spec-change command group help [reference]
- check: node test/cli.test.mjs#renders spec-change in normal workflow order in top-level usage [reference]
- check: node test/cli.test.mjs#renders spec-change subcommand help [reference]
- check: node test/cli.test.mjs#renders spec-change subcommand usage for argument errors [reference]
- check: node test/cli.test.mjs#rejects removed legacy spec-change command names [reference]
- implementation: code src/cli.mjs#parseScaffoldSpecChangeReviewArgs
- implementation: code src/cli.mjs#usage
- implementation: code src/cli.mjs#run
- implementation: code src/cli.mjs#specChangeUsage
- implementation: code src/cli.mjs#runSpecChangeCommand
- implementation: code src/cli.mjs#runSpecChangeScaffold
- implementation: code src/cli.mjs#scaffoldSpecChangeReviewUsage
- implementation: code src/cli.mjs#specChangeReviewScaffoldReport
- implementation: code src/cli.mjs#specChangeReviewDraftId
- implementation: code src/cli.mjs#specChangeReviewExecutionRoot
- implementation: code src/cli.mjs#withWorkingDirectory
- implementation: code src/cli.mjs#defaultAllowedCompatibility
- implementation: code src/cli.mjs#specChangeEvidenceSuggestion
- implementation: code src/cli.mjs#specChangeEvidencePkl
- implementation: code src/cli.mjs#specChangeReviewDraftForOutput
- implementation: code src/cli.mjs#renderSpecChangeReviewDraftPkl
- implementation: code src/cli.mjs#renderSpecChangeEvidencePkl
- implementation: code src/cli.mjs#writeSpecChangeReviewScaffold
- implementation: model fixtures/spec-change-scaffold-narrowing.pkl
- implementation: runtime Taskfile.pkl

#### Review

- source: model.rules[59]
- coverage: rule
- automatedChecks: 14
- implementationRefs: 20
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[0]
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[1]
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[2]
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[3]
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[4]
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[5]
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[6]
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[7]
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[8]
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[9]
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[10]
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[11]
- selector: DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD.must[12]

### DSPEC-SPEC-COMPAT-CLASSIFIER

The spec compatibility classifier classifies before/after specs as compatible, breaking, narrowing, widening, or unknown

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.compat_report`
- term: `artifact.json_report`
- term: `concept.rule`
- term: `concept.term`
- must: `classifySpecCompat(before, after).classification in {compatible, breaking, narrowing, widening, unknown}`
- must: `classifySpecCompat(before, after).decisions.explain(eachChange)`
- must: `removedApprovedRule -> breaking && addedObligation -> narrowing && addedPermission -> widening`
- check: node test/cli.test.mjs#classifies spec compatibility changes [reference]
- check: node test/cli.test.mjs#renders spec compatibility classification for review [reference]
- check: node test/cli.test.mjs#keeps spec compatibility JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#classifies spec compatibility through spec-change subcommands [reference]
- implementation: code dspec/Schema.pkl#SpecCompatibility
- implementation: code src/cli.mjs#parseSpecCompatibilityArgs
- implementation: code src/cli.mjs#specChangeCompatUsage
- implementation: code src/cli.mjs#runSpecCompatibility
- implementation: code src/cli.mjs#specCompatibilityReport
- implementation: code src/cli.mjs#classifyTermChange
- implementation: code src/cli.mjs#classifyRuleChange
- implementation: code src/cli.mjs#domainElementDiff
- implementation: code src/cli.mjs#overallSpecCompatibility
- implementation: code src/cli.mjs#renderSpecCompatibilityMarkdownReport
- implementation: code src/cli.mjs#renderSpecCompatibilityReport
- implementation: model fixtures/compat-before.pkl
- implementation: model fixtures/compat-compatible-after.pkl
- implementation: model fixtures/compat-narrowing-after.pkl
- implementation: model fixtures/compat-widening-after.pkl
- implementation: model fixtures/compat-breaking-after.pkl
- implementation: model fixtures/compat-unknown-after.pkl
- implementation: model fixtures/reports/spec-compat-narrowing.json

#### Review

- source: model.rules[57]
- coverage: rule
- automatedChecks: 4
- implementationRefs: 18
- selector: DSPEC-SPEC-COMPAT-CLASSIFIER.must[0]
- selector: DSPEC-SPEC-COMPAT-CLASSIFIER.must[1]
- selector: DSPEC-SPEC-COMPAT-CLASSIFIER.must[2]

### DSPEC-SPEC-DIFF-IMPACT

Spec diff impact reports map changed terms and rules to affected generated selectors and implementation references

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.impact_report`
- term: `artifact.json_report`
- term: `artifact.source_map`
- term: `concept.rule`
- term: `concept.term`
- term: `concept.verification_target`
- must: `impact.diff.detects(term, rule).added_removed_modified`
- must: `impact.changedTerm.rules -> generatedSelectors + implementationRefs`
- check: node test/cli.test.mjs#emits spec diff impact reports [reference]
- implementation: code src/cli.mjs#parseImpactArgs
- implementation: code src/cli.mjs#impactReport
- implementation: code src/cli.mjs#diffItems
- implementation: code src/cli.mjs#sourceMapEntries
- implementation: model fixtures/impact-before.pkl
- implementation: model fixtures/impact-after.pkl

#### Review

- source: model.rules[56]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 6
- selector: DSPEC-SPEC-DIFF-IMPACT.must[0]
- selector: DSPEC-SPEC-DIFF-IMPACT.must[1]

### DSPEC-SPEC-READING-EVAL

Spec reading eval scores whether claims are readable from the spec as a gold set

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.coverage_oracle`
- term: `artifact.json_report`
- term: `artifact.markdown`
- term: `artifact.real_app_model`
- term: `artifact.spec_reading_eval`
- must: `specReadingEval.cases.label in {entailed, contradicted, not-supported}`
- must: `specReadingEval(entailed + contradicted).evidence resolves(term + rule + clause)`
- must: `specReadingEval.prompt.hides(goldLabels)`
- must: `specReadingEval.prompt.includes(rubric + localeParaphrases)`
- must: `specReadingEval.score(answers).reports(accuracy + perCaseStatus)`
- must: `specReadingEval.score(answers).checks(answerEvidenceResolution + goldOverlap)`
- must: `specReadingEval.goldEvidence.digest.detects(staleRefs)`
- must: `specReadingEval.refreshDigests.dryRunAndApply`
- must: `specReadingEvalSuite.evaluations.aggregate(sample + holdout)`
- must: `specReadingEvalSuite.coverage.requires(labels + evidenceKinds + modelKinds + tags + paraphraseLocales)`
- must: `specReadingEval.metamorphic.preserves(answerOrder + evidenceOrder + rationaleNoise)`
- must: `specReadingEval.metamorphic.rejects(flippedLabel)`
- must: `specReadingEval.prompt.caseIds.notLeak(goldLabels)`
- must: `specReadingEval.paths.resolveRelativeTo(ownerFile)`
- must: `specReadingEval.rubricVersion == cli.rubricVersion`
- must: `specReadingEval.score.writeRun.records(subagentPrompt + scoreReport)`
- must: `specReadingEval.runner.process(stdinPrompt).stdoutAnswers && artifact.records(provider + model + digests + exit + rawOutput + score)`
- must: `specReadingEval.markdownScore.records(subagentRun + goldFixCandidates)`
- check: node test/cli.test.mjs#evaluates spec reading gold sets [reference]
- check: node test/cli.test.mjs#renders spec reading evaluation prompts without gold labels [reference]
- check: node test/cli.test.mjs#renders localized spec reading prompts with paraphrases [reference]
- check: node test/cli.test.mjs#scores spec reading evaluation answers [reference]
- check: node test/cli.test.mjs#scores spec reading answer evidence [reference]
- check: node test/cli.test.mjs#detects stale spec reading gold evidence digests [reference]
- check: node test/cli.test.mjs#refreshes spec reading gold evidence digests [reference]
- check: node test/cli.test.mjs#evaluates spec reading suites with holdout cases [reference]
- check: node test/cli.test.mjs#resolves spec reading eval paths relative to the eval file [reference]
- check: node test/cli.test.mjs#resolves spec reading suite entries relative to the suite file [reference]
- check: node test/cli.test.mjs#reports spec reading suite coverage [reference]
- check: node test/cli.test.mjs#rejects undercovered spec reading suites [reference]
- check: node test/cli.test.mjs#detects spec reading rubric version mismatches [reference]
- check: node test/cli.test.mjs#renders spec reading score reports for subagent runs [reference]
- check: node test/cli.test.mjs#writes spec reading subagent run artifacts [reference]
- check: node test/cli.test.mjs#runs provider-neutral spec reading agents and records reproducible artifacts [reference]
- check: node test/cli.test.mjs#records invalid spec reading agent output as a failing artifact [reference]
- check: node test/cli.test.mjs#keeps provider-neutral spec reading agent artifacts in sync [reference]
- check: node test/cli.test.mjs#runs metamorphic spec reading evaluation [reference]
- check: node test/cli.test.mjs#keeps spec reading evaluation JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps spec reading digest refresh JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps spec reading suite JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps spec reading suite coverage JSON report fixture in sync [reference]
- check: node test/cli.test.mjs#keeps metamorphic spec reading JSON report fixture in sync [reference]
- implementation: code dspec/Schema.pkl#SpecReadingEvaluation
- implementation: code dspec/Schema.pkl#SpecReadingEvaluationSuite
- implementation: code dspec/Schema.pkl#SpecReadingCase
- implementation: code dspec/Schema.pkl#SpecReadingEvidence
- implementation: code dspec/Schema.pkl#SpecReadingAgentRunner
- implementation: code src/cli.mjs#SPEC_READING_RUBRIC
- implementation: code src/cli.mjs#parseSpecReadingEvalArgs
- implementation: code src/cli.mjs#parseSpecReadingEvalSuiteArgs
- implementation: code src/cli.mjs#loadSpecReadingEvaluation
- implementation: code src/cli.mjs#loadSpecReadingEvaluationSuite
- implementation: code src/cli.mjs#specReadingEvalReport
- implementation: code src/cli.mjs#specReadingEvalDigestRefreshReport
- implementation: code src/cli.mjs#specReadingEvalSuiteReport
- implementation: code src/cli.mjs#specReadingEvalSuiteCoverageReport
- implementation: code src/cli.mjs#renderSpecReadingEvalSuiteCoverageReport
- implementation: code src/cli.mjs#specReadingMetamorphicReport
- implementation: code src/cli.mjs#renderSpecReadingMetamorphicReport
- implementation: code src/cli.mjs#specReadingPromptLeakReport
- implementation: code src/cli.mjs#specReadingSuiteEvaluationEntries
- implementation: code src/cli.mjs#specReadingModelFile
- implementation: code src/cli.mjs#resolvePathRelativeToFile
- implementation: code src/cli.mjs#renderSpecReadingEvalPrompt
- implementation: code src/cli.mjs#specReadingEvalScoreReport
- implementation: code src/cli.mjs#loadSpecReadingAgentRunner
- implementation: code src/cli.mjs#specReadingAgentReport
- implementation: code src/cli.mjs#specReadingAgentAnswers
- implementation: code src/cli.mjs#renderSpecReadingEvalScoreMarkdownReport
- implementation: code src/cli.mjs#specReadingEvidenceDigest
- implementation: code src/cli.mjs#specReadingEvidenceOverlap
- implementation: model fixtures/spec-reading-eval-sample-webapp.pkl
- implementation: model fixtures/spec-reading-eval-holdout-runtime.pkl
- implementation: model fixtures/spec-reading-eval-suite.pkl
- implementation: model fixtures/spec-reading-eval-suite-undercovered.pkl
- implementation: model fixtures/spec-reading-eval-stale-digest.pkl
- implementation: model fixtures/spec-reading-eval-rubric-mismatch.pkl
- implementation: model fixtures/spec-reading-eval-answers.json
- implementation: model fixtures/spec-reading-agent-runner.pkl
- implementation: model fixtures/spec-reading-agent-invalid-runner.pkl
- implementation: model fixtures/agents/spec-reading-fixture-agent.mjs
- implementation: model fixtures/agents/spec-reading-invalid-agent.mjs
- implementation: model fixtures/reports/spec-reading-agent-run.json
- implementation: model fixtures/reports/spec-reading-eval-sample-webapp.json
- implementation: model fixtures/reports/spec-reading-eval-refresh-stale.json
- implementation: model fixtures/reports/spec-reading-eval-suite.json
- implementation: model fixtures/reports/coverage-spec-reading-eval-suite.json
- implementation: model fixtures/reports/metamorphic-spec-reading-eval.json
- implementation: model fixtures/reports/spec-reading-eval-stale-digest.json
- implementation: model fixtures/reports/spec-reading-eval-score.md
- implementation: runtime Taskfile.pkl

#### Review

- source: model.rules[64]
- coverage: rule
- automatedChecks: 24
- implementationRefs: 49
- selector: DSPEC-SPEC-READING-EVAL.must[0]
- selector: DSPEC-SPEC-READING-EVAL.must[1]
- selector: DSPEC-SPEC-READING-EVAL.must[2]
- selector: DSPEC-SPEC-READING-EVAL.must[3]
- selector: DSPEC-SPEC-READING-EVAL.must[4]
- selector: DSPEC-SPEC-READING-EVAL.must[5]
- selector: DSPEC-SPEC-READING-EVAL.must[6]
- selector: DSPEC-SPEC-READING-EVAL.must[7]
- selector: DSPEC-SPEC-READING-EVAL.must[8]
- selector: DSPEC-SPEC-READING-EVAL.must[9]
- selector: DSPEC-SPEC-READING-EVAL.must[10]
- selector: DSPEC-SPEC-READING-EVAL.must[11]
- selector: DSPEC-SPEC-READING-EVAL.must[12]
- selector: DSPEC-SPEC-READING-EVAL.must[13]
- selector: DSPEC-SPEC-READING-EVAL.must[14]
- selector: DSPEC-SPEC-READING-EVAL.must[15]
- selector: DSPEC-SPEC-READING-EVAL.must[16]
- selector: DSPEC-SPEC-READING-EVAL.must[17]

### DSPEC-SQL-QUERY-ORACLE

SQL query catalogs are checked against the DB model to detect schema, tenant, and FK drift

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.db_model_pattern`
- term: `artifact.sql_query_oracle`
- must: `query.tablesAndColumns ⊆ patterns.db.tablesAndColumns`
- must: `query.touches(tenantScopedTable) -> query.mentions(tenantColumn)`
- must: `query.joins(fkTable, targetTable) -> query.mentions(fkColumn, targetKey)`
- check: node test/cli.test.mjs#checks SQL query catalog against DB model [reference]
- check: node test/cli.test.mjs#reports SQL query drift as JSON [reference]
- implementation: code src/cli.mjs#checkSqlQueriesReport
- implementation: model fixtures/db-queries.sql
- implementation: model fixtures/db-queries-broken.sql

#### Review

- source: model.rules[32]
- coverage: rule
- automatedChecks: 2
- implementationRefs: 3
- selector: DSPEC-SQL-QUERY-ORACLE.must[0]
- selector: DSPEC-SQL-QUERY-ORACLE.must[1]
- selector: DSPEC-SQL-QUERY-ORACLE.must[2]

### DSPEC-STABLE-IDS

Stable ids are separated from natural-language labels

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `concept.localized_text`
- term: `concept.stable_id`
- must: `id.locale_independent`
- must: `text.labels.by_locale`
- check: node test/cli.test.mjs#keeps stable ids across localized renders [reference]
- implementation: model dspec/Schema.pkl#LocalizedText

#### Review

- source: model.rules[4]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-STABLE-IDS.must[0]
- selector: DSPEC-STABLE-IDS.must[1]

### DSPEC-TOPLEVEL-MODEL

Spec files read by the CLI expose a top-level model

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.cli`
- term: `artifact.pkl_model`
- must: `json.document.model.exists`
- check: node test/cli.test.mjs#rejects files without top-level model [reference]
- implementation: code src/cli.mjs#loadModel

#### Review

- source: model.rules[3]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 1
- selector: DSPEC-TOPLEVEL-MODEL.must[0]

### DSPEC-VERIFY-GENERATED-JSON

verify-generated can emit per-backend verification results as a JSON artifact

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `artifact.generator`
- term: `concept.verification_target`
- must: `emitsVerificationJson(model)`
- check: node test/cli.test.mjs#emits verify-generated JSON artifacts [reference]
- implementation: code src/cli.mjs#verifyGeneratedReport
- implementation: code src/cli.mjs#parseVerifyGeneratedArgs

#### Review

- source: model.rules[50]
- coverage: rule
- automatedChecks: 1
- implementationRefs: 2
- selector: DSPEC-VERIFY-GENERATED-JSON.must[0]

## Decisions

### ADR-SELF-0001

- date: 2026-07-07
- summary: Manage dspec's own specification as a Pkl model
- rationale: Self-modeling turns the prototype into the first regression target for its own language and checker.

### ADR-SELF-0002

- date: 2026-07-07
- summary: Keep Clause.expr as an opaque string until typed AST work
- rationale: This avoids inventing a half-finished expression language before the stable model, i18n, and drift-detection boundaries are validated.
