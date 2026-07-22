---- MODULE DSPEC_SELF ----
EXTENDS Sequences, FiniteSets, Naturals, TLC

ClauseAstSemanticsVersion == "1.0"

Rules == {"DSPEC-APP-PROFILE", "DSPEC-ASSURANCE-EVIDENCE-MANIFEST", "DSPEC-AUTHORING-SHORTHAND", "DSPEC-BACKEND-PROJECTION-OWNERSHIP", "DSPEC-BACKEND-REPORT-COMPAT-FIXTURES", "DSPEC-CHECK-APPROVED-VERIFIED", "DSPEC-CHECK-ASSURANCE", "DSPEC-CHECK-CONTRADICTION", "DSPEC-CHECK-DRIFT-COVERAGE-JSON", "DSPEC-CHECK-DUPLICATES", "DSPEC-CHECK-REFERENCES", "DSPEC-CLOUD-TOPOLOGY-PATTERN", "DSPEC-COUNTEREXAMPLE-NORMALIZED", "DSPEC-COVERAGE-APPROVED-CHECKED", "DSPEC-COVERAGE-CLAUSE-QUALITY", "DSPEC-DAILY-DRIFT-REVIEW", "DSPEC-DATA-GOVERNANCE-PATTERN", "DSPEC-DB-MIGRATION-MAPPING-COVERAGE", "DSPEC-DB-MIGRATION-MAPPING-WELL-FORMED", "DSPEC-DB-MIGRATION-PATTERN", "DSPEC-DB-MODEL-PATTERN", "DSPEC-DB-SCHEMA-IMPORTER", "DSPEC-DOCUMENTED-CLI-EXAMPLES", "DSPEC-DOGFOOD-TASK", "DSPEC-DOMAIN-COVERAGE-ORACLE", "DSPEC-DOMAIN-PRESET-PACK", "DSPEC-DRIFT-CHECK-TARGET", "DSPEC-DRIFT-IMPLEMENTATION-REF", "DSPEC-EMIT-FORMAL-BACKENDS", "DSPEC-EMIT-MARKDOWN", "DSPEC-EMIT-QUICKCHECK", "DSPEC-EXPR-AST-PROJECTION", "DSPEC-EXPR-OPAQUE", "DSPEC-EXPR-TYPED-AST", "DSPEC-FORMAL-SOURCE-OF-TRUTH", "DSPEC-GENERATED-ALLOY-SYNTAX", "DSPEC-GENERATED-ARTIFACT-FRESHNESS", "DSPEC-GENERATED-CHECKS-LOAD-BEARING", "DSPEC-GENERATED-LEAN-COMPILES", "DSPEC-GENERATED-QUICKCHECK-RUNS", "DSPEC-GENERATED-TLA-SYNTAX", "DSPEC-I18N-RENDER", "DSPEC-I18N-SEMANTIC-DRIFT", "DSPEC-IMPLEMENTATION-CONFORMANCE", "DSPEC-INTENT-CLOSED-CONSTRUCTION", "DSPEC-INTENT-GOAL-GRAPH", "DSPEC-INTENT-PROTOCOL-TEST-ORACLE", "DSPEC-JSON-REPORT-COMPAT-FIXTURES", "DSPEC-LEAN-EQ-SEMANTIC", "DSPEC-MARKDOWN-REVIEW-ARTIFACT", "DSPEC-MBT-BOUNDARY", "DSPEC-NIX-CI-GATE", "DSPEC-NIX-FORMAL-TOOLS", "DSPEC-PACKAGE-RELEASE", "DSPEC-PRODUCT-POSITIONING", "DSPEC-REAL-APP-DOGFOOD", "DSPEC-REAL-APP-IMPORTER", "DSPEC-REAL-APP-RECONCILIATION", "DSPEC-REAL-APP-REVERSE-COVERAGE", "DSPEC-RELEASE-SAFETY-PATTERN", "DSPEC-RUNTIME-COLLECTOR-FIXTURE", "DSPEC-RUNTIME-COLLECTOR-MANIFEST", "DSPEC-RUNTIME-EVIDENCE-COLLECTOR", "DSPEC-RUNTIME-EVIDENCE-IMPORTER", "DSPEC-RUNTIME-EVIDENCE-PATTERN", "DSPEC-RUNTIME-EVIDENCE-VERIFIER", "DSPEC-RUNTIME-SAFETY-PATTERN", "DSPEC-SCHEMA-TYPED", "DSPEC-SEMANTICS-INFERENTIAL-SUPPORT", "DSPEC-SOURCE-MAP-GENERATED", "DSPEC-SPEC-CHANGE-REVIEW", "DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD", "DSPEC-SPEC-COMPAT-CLASSIFIER", "DSPEC-SPEC-DIFF-IMPACT", "DSPEC-SPEC-QUERY", "DSPEC-SPEC-READING-EVAL", "DSPEC-SQL-QUERY-ORACLE", "DSPEC-STABLE-IDS", "DSPEC-TOPLEVEL-MODEL", "DSPEC-VERIFY-GENERATED-JSON"}

ActiveApprovedRules == {"DSPEC-APP-PROFILE", "DSPEC-ASSURANCE-EVIDENCE-MANIFEST", "DSPEC-AUTHORING-SHORTHAND", "DSPEC-BACKEND-PROJECTION-OWNERSHIP", "DSPEC-BACKEND-REPORT-COMPAT-FIXTURES", "DSPEC-CHECK-APPROVED-VERIFIED", "DSPEC-CHECK-ASSURANCE", "DSPEC-CHECK-CONTRADICTION", "DSPEC-CHECK-DRIFT-COVERAGE-JSON", "DSPEC-CHECK-DUPLICATES", "DSPEC-CHECK-REFERENCES", "DSPEC-CLOUD-TOPOLOGY-PATTERN", "DSPEC-COUNTEREXAMPLE-NORMALIZED", "DSPEC-COVERAGE-APPROVED-CHECKED", "DSPEC-COVERAGE-CLAUSE-QUALITY", "DSPEC-DAILY-DRIFT-REVIEW", "DSPEC-DATA-GOVERNANCE-PATTERN", "DSPEC-DB-MIGRATION-MAPPING-COVERAGE", "DSPEC-DB-MIGRATION-MAPPING-WELL-FORMED", "DSPEC-DB-MIGRATION-PATTERN", "DSPEC-DB-MODEL-PATTERN", "DSPEC-DB-SCHEMA-IMPORTER", "DSPEC-DOCUMENTED-CLI-EXAMPLES", "DSPEC-DOGFOOD-TASK", "DSPEC-DOMAIN-COVERAGE-ORACLE", "DSPEC-DOMAIN-PRESET-PACK", "DSPEC-DRIFT-CHECK-TARGET", "DSPEC-DRIFT-IMPLEMENTATION-REF", "DSPEC-EMIT-FORMAL-BACKENDS", "DSPEC-EMIT-MARKDOWN", "DSPEC-EMIT-QUICKCHECK", "DSPEC-EXPR-AST-PROJECTION", "DSPEC-EXPR-OPAQUE", "DSPEC-EXPR-TYPED-AST", "DSPEC-FORMAL-SOURCE-OF-TRUTH", "DSPEC-GENERATED-ALLOY-SYNTAX", "DSPEC-GENERATED-ARTIFACT-FRESHNESS", "DSPEC-GENERATED-CHECKS-LOAD-BEARING", "DSPEC-GENERATED-LEAN-COMPILES", "DSPEC-GENERATED-QUICKCHECK-RUNS", "DSPEC-GENERATED-TLA-SYNTAX", "DSPEC-I18N-RENDER", "DSPEC-I18N-SEMANTIC-DRIFT", "DSPEC-IMPLEMENTATION-CONFORMANCE", "DSPEC-INTENT-CLOSED-CONSTRUCTION", "DSPEC-INTENT-GOAL-GRAPH", "DSPEC-INTENT-PROTOCOL-TEST-ORACLE", "DSPEC-JSON-REPORT-COMPAT-FIXTURES", "DSPEC-LEAN-EQ-SEMANTIC", "DSPEC-MARKDOWN-REVIEW-ARTIFACT", "DSPEC-NIX-CI-GATE", "DSPEC-NIX-FORMAL-TOOLS", "DSPEC-PACKAGE-RELEASE", "DSPEC-PRODUCT-POSITIONING", "DSPEC-REAL-APP-DOGFOOD", "DSPEC-REAL-APP-IMPORTER", "DSPEC-REAL-APP-RECONCILIATION", "DSPEC-REAL-APP-REVERSE-COVERAGE", "DSPEC-RELEASE-SAFETY-PATTERN", "DSPEC-RUNTIME-COLLECTOR-FIXTURE", "DSPEC-RUNTIME-COLLECTOR-MANIFEST", "DSPEC-RUNTIME-EVIDENCE-COLLECTOR", "DSPEC-RUNTIME-EVIDENCE-IMPORTER", "DSPEC-RUNTIME-EVIDENCE-PATTERN", "DSPEC-RUNTIME-EVIDENCE-VERIFIER", "DSPEC-RUNTIME-SAFETY-PATTERN", "DSPEC-SCHEMA-TYPED", "DSPEC-SOURCE-MAP-GENERATED", "DSPEC-SPEC-CHANGE-REVIEW", "DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD", "DSPEC-SPEC-COMPAT-CLASSIFIER", "DSPEC-SPEC-DIFF-IMPACT", "DSPEC-SPEC-QUERY", "DSPEC-SPEC-READING-EVAL", "DSPEC-SQL-QUERY-ORACLE", "DSPEC-STABLE-IDS", "DSPEC-TOPLEVEL-MODEL", "DSPEC-VERIFY-GENERATED-JSON"}

ApprovedRules == ActiveApprovedRules

Checks == ("DSPEC-APP-PROFILE" :> <<"test/cli.test.mjs#checks app profiles as a dogfood bundle", "test/cli.test.mjs#checks multiple app profiles as an aggregate bundle", "test/cli.test.mjs#checks app profile suites from a registry", "test/cli.test.mjs#renders app profile reports as markdown", "test/cli.test.mjs#scaffolds app profiles for AI authoring", "test/cli.test.mjs#checks scaffolded app profiles after saving them", "test/cli.test.mjs#diffs scaffolded app profiles against existing profiles", "test/cli.test.mjs#reports scaffolded profile drift as JSON", "test/cli.test.mjs#applies scaffolded app profile updates safely", "test/cli.test.mjs#evaluates app profile false-positive and false-negative guards", "test/cli.test.mjs#evaluates declared app profile scenarios", "test/cli.test.mjs#evaluates extended app profile scenario patterns", "test/cli.test.mjs#renders app profile evaluation reports as markdown", "test/cli.test.mjs#reports app profile scenario coverage", "test/cli.test.mjs#scopes app profile scenario coverage to required categories", "test/cli.test.mjs#rejects missing required app profile scenario category coverage", "test/cli.test.mjs#rejects underdeclared app profile scenario categories inferred from the model and observed app", "test/cli.test.mjs#does not count ineffective app profile scenarios as scenario coverage", "test/cli.test.mjs#scores generated app profile mutations", "test/cli.test.mjs#scores generated app profile mutations for route-only profiles", "test/cli.test.mjs#scores generated app profile mutations on holdout fixtures", "test/cli.test.mjs#keeps generated app profile mutation witnesses stable under metamorphic app changes", "test/cli.test.mjs#replays real app change corpus labels", "test/cli.test.mjs#renders app change replay corpus as markdown", "test/cli.test.mjs#keeps app change replay JSON report fixture in sync", "test/cli.test.mjs#renders app profile mutation scores as markdown", "test/cli.test.mjs#keeps app profile mutation score JSON report fixture in sync", "test/cli.test.mjs#keeps app change replay JSON report fixture in sync", "test/cli.test.mjs#keeps app profile evaluation Markdown report fixture in sync", "test/cli.test.mjs#evaluates app profile suites from a registry", "test/cli.test.mjs#keeps app profile evaluation JSON report fixture in sync", "test/cli.test.mjs#keeps app profile scenario evaluation JSON report fixture in sync", "test/cli.test.mjs#keeps extended app profile evaluation JSON report fixture in sync", "test/cli.test.mjs#keeps app profile scenario coverage JSON report fixture in sync", "test/cli.test.mjs#keeps app profile suite JSON report fixture in sync", "test/cli.test.mjs#keeps app profile suite evaluation JSON report fixture in sync", "test/cli.test.mjs#keeps scaled app profile JSON report fixture in sync", "test/cli.test.mjs#refreshes stale app profile observed facts with --fix", "test/cli.test.mjs#previews stale app profile observed fact refresh with --fix --dry-run", "test/cli.test.mjs#keeps gate suggestions in failing app profile reports", "test/cli.test.mjs#declares an app profile refresh task">>) @@ ("DSPEC-ASSURANCE-EVIDENCE-MANIFEST" :> <<"test/cli.test.mjs#creates and verifies typed assurance evidence manifests", "test/cli.test.mjs#detects and refreshes stale assurance evidence manifests", "test/cli.test.mjs#rejects formal assurance when backend binding is structural only", "test/cli.test.mjs#rejects legacy references as formal assurance evidence">>) @@ ("DSPEC-AUTHORING-SHORTHAND" :> <<"test/cli.test.mjs#accepts shorthand authoring helpers">>) @@ ("DSPEC-BACKEND-PROJECTION-OWNERSHIP" :> <<"test/cli.test.mjs#generates, checks, and repairs every deterministic backend projection kind", "test/projection-core.test.mjs#materializes localized and singleton backend projections with kind-specific emitters", "test/projection-core.test.mjs#rejects incompatible projection matrices and output extensions", "test/cli.test.mjs#keeps generated source map artifact in sync", "test/cli.test.mjs#keeps generated manifest artifact in sync">>) @@ ("DSPEC-BACKEND-REPORT-COMPAT-FIXTURES" :> <<"test/cli.test.mjs#keeps verify-generated JSON report fixture in sync", "test/cli.test.mjs#keeps normalized counterexample JSON report fixture in sync">>) @@ ("DSPEC-CHECK-APPROVED-VERIFIED" :> <<"test/cli.test.mjs#rejects approved rules without verification targets">>) @@ ("DSPEC-CHECK-ASSURANCE" :> <<"test/cli.test.mjs#reports explicit assurance claims", "test/cli.test.mjs#renders assurance claims for human review", "test/cli.test.mjs#rejects missing required assurances", "test/cli.test.mjs#rejects incompatible assurance backends", "test/cli.test.mjs#rejects assurances without evidence", "test/cli.test.mjs#preserves assurance requirements in generated QuickCheck properties", "test/cli.test.mjs#classifies assurance requirement compatibility">>) @@ ("DSPEC-CHECK-CONTRADICTION" :> <<"test/cli.test.mjs#rejects direct must and mustNot contradictions", "test/cli.test.mjs#rejects typed AST must and mustNot contradictions">>) @@ ("DSPEC-CHECK-DRIFT-COVERAGE-JSON" :> <<"test/cli.test.mjs#emits check JSON reports", "test/cli.test.mjs#emits drift JSON reports", "test/cli.test.mjs#emits coverage JSON reports", "test/cli.test.mjs#emits failing coverage JSON reports", "test/cli.test.mjs#reports uncovered domain model elements as JSON", "test/cli.test.mjs#reports real app reconciliation drift", "test/cli.test.mjs#reports unmodeled observed real app facts", "test/cli.test.mjs#checks app profiles as a dogfood bundle">>) @@ ("DSPEC-CHECK-DUPLICATES" :> <<"test/cli.test.mjs#rejects duplicate rule ids">>) @@ ("DSPEC-CHECK-REFERENCES" :> <<"test/cli.test.mjs#rejects unknown term references">>) @@ ("DSPEC-CLOUD-TOPOLOGY-PATTERN" :> <<"test/cli.test.mjs#accepts Cloud topology pattern", "test/cli.test.mjs#rejects invalid Cloud topology references", "test/cli.test.mjs#emits Cloud topology pattern into backend projections", "test/cli.test.mjs#normalizes Cloud topology counterexamples to source flows", "test/cli.test.mjs#keeps generated Cloud topology checks load-bearing">>) @@ ("DSPEC-COUNTEREXAMPLE-NORMALIZED" :> <<"test/cli.test.mjs#normalizes generated counterexamples to source rules", "test/cli.test.mjs#normalizes TLA and Alloy backend witnesses to source records">>) @@ ("DSPEC-COVERAGE-APPROVED-CHECKED" :> <<"test/cli.test.mjs#reports coverage for dspec's self model", "test/cli.test.mjs#rejects approved rules without load-bearing checks in coverage">>) @@ ("DSPEC-COVERAGE-CLAUSE-QUALITY" :> <<"test/cli.test.mjs#reports clause-level coverage", "test/cli.test.mjs#rejects clause-level coverage gaps", "test/cli.test.mjs#rejects invalid clause coverage selectors">>) @@ ("DSPEC-DAILY-DRIFT-REVIEW" :> <<"test/daily-drift-packet.test.mjs#exposes daily packet collection and approved baselines through dspec", "test/daily-drift-packet.test.mjs#requires an explicit approval to establish and then enforce a target baseline", "test/daily-drift-packet.test.mjs#writes typed target reports and declared implementation observations", "test/daily-drift-packet.test.mjs#retains every report when a target's deterministic drift checks fail", "test/daily-drift-packet.test.mjs#runs an application target's implementation observation gate", "test/daily-drift-packet.test.mjs#runs declared runtime evidence as a target observation gate", "test/daily-drift-packet.test.mjs#keeps the daily LLM drift review read-only and artifact-only", "test/daily-drift-review-eval.test.mjs#scores required drift findings, evidence paths, and no-drift restraint">>) @@ ("DSPEC-DATA-GOVERNANCE-PATTERN" :> <<"test/cli.test.mjs#accepts Data governance pattern", "test/cli.test.mjs#rejects invalid Data governance references", "test/cli.test.mjs#emits Data governance pattern into backend projections", "test/cli.test.mjs#normalizes Data governance counterexamples to source records", "test/cli.test.mjs#keeps generated Data governance checks load-bearing">>) @@ ("DSPEC-DB-MIGRATION-MAPPING-COVERAGE" :> <<"test/cli.test.mjs#rejects invalid DB migration mapping references", "test/cli.test.mjs#emits DB model pattern into backend projections", "test/cli.test.mjs#normalizes DB migration mapping counterexamples to source patterns", "test/cli.test.mjs#keeps generated DB migration mapping checks load-bearing">>) @@ ("DSPEC-DB-MIGRATION-MAPPING-WELL-FORMED" :> <<"test/cli.test.mjs#rejects DB migration mappings outside preserved invariants", "test/cli.test.mjs#emits DB model pattern into backend projections", "test/cli.test.mjs#normalizes DB migration mapping expression counterexamples to source mappings", "test/cli.test.mjs#keeps generated DB migration mapping expression checks load-bearing">>) @@ ("DSPEC-DB-MIGRATION-PATTERN" :> <<"test/cli.test.mjs#rejects invalid DB migration references", "test/cli.test.mjs#emits DB model pattern into backend projections", "test/cli.test.mjs#keeps generated DB migration checks load-bearing", "test/cli.test.mjs#normalizes DB migration counterexamples to source patterns">>) @@ ("DSPEC-DB-MODEL-PATTERN" :> <<"test/cli.test.mjs#accepts DB model pattern", "test/cli.test.mjs#emits DB model pattern into backend projections", "test/cli.test.mjs#keeps generated DB invariant checks load-bearing">>) @@ ("DSPEC-DB-SCHEMA-IMPORTER" :> <<"test/cli.test.mjs#imports SQL schema as DB model JSON", "test/cli.test.mjs#imports SQL schema as a deterministic Pkl fragment">>) @@ ("DSPEC-DOCUMENTED-CLI-EXAMPLES" :> <<"test/cli.test.mjs#defines top-level CLI commands through the command registry", "test/cli.test.mjs#keeps documented CLI command examples on the live command surface", "test/cli.test.mjs#smoke-runs documented CLI command examples through help", "test/cli.test.mjs#keeps documented CLI extractor covered by holdout shapes">>) @@ ("DSPEC-DOGFOOD-TASK" :> <<"test/cli.test.mjs#declares a dogfood task for self-spec evaluation">>) @@ ("DSPEC-DOMAIN-COVERAGE-ORACLE" :> <<"test/cli.test.mjs#reports domain model element coverage", "test/cli.test.mjs#reports uncovered domain model elements as JSON", "test/cli.test.mjs#keeps domain coverage JSON report fixture in sync", "test/cli.test.mjs#keeps failing domain coverage JSON report fixture in sync">>) @@ ("DSPEC-DOMAIN-PRESET-PACK" :> <<"test/cli.test.mjs#accepts domain preset packs", "test/cli.test.mjs#accepts domain pack contract registry", "test/cli.test.mjs#rejects domain pack rule helpers without typed AST contract", "test/cli.test.mjs#detects missing domain pack helper symbols", "test/cli.test.mjs#uses domain preset packs for the current RBAC spec", "test/cli.test.mjs#accepts web app domain preset packs">>) @@ ("DSPEC-DRIFT-CHECK-TARGET" :> <<"test/cli.test.mjs#rejects check targets that do not resolve to test anchors", "test/cli.test.mjs#resolves backend-aware drift targets", "test/cli.test.mjs#rejects missing backend-aware drift target symbols">>) @@ ("DSPEC-DRIFT-IMPLEMENTATION-REF" :> <<"test/cli.test.mjs#detects missing implementation symbols">>) @@ ("DSPEC-EMIT-FORMAL-BACKENDS" :> <<"test/cli.test.mjs#emits formal backend skeletons">>) @@ ("DSPEC-EMIT-MARKDOWN" :> <<"test/cli.test.mjs#emits deterministic markdown">>) @@ ("DSPEC-EMIT-QUICKCHECK" :> <<"test/cli.test.mjs#emits deterministic quickcheck with shrink">>) @@ ("DSPEC-EXPR-AST-PROJECTION" :> <<"test/cli.test.mjs#emits typed Clause.ast into backend projections">>) @@ ("DSPEC-EXPR-OPAQUE" :> <<"test/cli.test.mjs#accepts opaque Clause.expr text">>) @@ ("DSPEC-EXPR-TYPED-AST" :> <<"test/cli.test.mjs#accepts typed Clause.ast", "test/cli.test.mjs#rejects invalid typed Clause.ast", "test/cli.test.mjs#rejects expr ast fields outside operator semantics", "test/cli.test.mjs#rejects unsupported Clause.ast semantics versions", "test/clause-ast-core.test.mjs#defines Clause.ast semantics version 1.0", "test/clause-ast-core.test.mjs#evaluates every Clause.ast 1.0 operator consistently", "test/clause-ast-core.test.mjs#rejects evaluation with an unsupported semantics version">>) @@ ("DSPEC-FORMAL-SOURCE-OF-TRUTH" :> <<"test/cli.test.mjs#keeps product positioning and assurance boundaries explicit">>) @@ ("DSPEC-GENERATED-ALLOY-SYNTAX" :> <<"test/cli.test.mjs#validates generated Alloy syntax", "test/cli.test.mjs#runs generated Alloy through analyzer when available">>) @@ ("DSPEC-GENERATED-ARTIFACT-FRESHNESS" :> <<"test/cli.test.mjs#emits generated artifact manifest", "test/cli.test.mjs#keeps generated manifest artifact in sync">>) @@ ("DSPEC-GENERATED-CHECKS-LOAD-BEARING" :> <<"test/cli.test.mjs#keeps generated backend checks load-bearing">>) @@ ("DSPEC-GENERATED-LEAN-COMPILES" :> <<"test/cli.test.mjs#compiles generated Lean output">>) @@ ("DSPEC-GENERATED-QUICKCHECK-RUNS" :> <<"test/cli.test.mjs#runs generated QuickCheck output">>) @@ ("DSPEC-GENERATED-TLA-SYNTAX" :> <<"test/cli.test.mjs#validates generated TLA+ syntax", "test/cli.test.mjs#runs generated TLA+ through SANY when available", "test/cli.test.mjs#runs generated TLA+ through TLC when available">>) @@ ("DSPEC-I18N-RENDER" :> <<"test/cli.test.mjs#renders localized model text">>) @@ ("DSPEC-I18N-SEMANTIC-DRIFT" :> <<"test/cli.test.mjs#accepts i18n contract coverage", "test/cli.test.mjs#rejects missing required localized labels", "test/cli.test.mjs#rejects i18n glossary label drift", "test/translation-lock-core.test.mjs#reports source, translation, and glossary changes independently">>) @@ ("DSPEC-IMPLEMENTATION-CONFORMANCE" :> <<"test/cli.test.mjs#runs typed implementation conformance against Clause.ast reference semantics", "test/cli.test.mjs#reports the smallest declared conformance counterexample">>) @@ ("DSPEC-INTENT-CLOSED-CONSTRUCTION" :> <<"test/cli.test.mjs#emits Intent processes into human and executable projections">>) @@ ("DSPEC-INTENT-GOAL-GRAPH" :> <<"test/cli.test.mjs#organizes natural-language Intent goals into claims, assurance tasks, and implementation bindings">>) @@ ("DSPEC-INTENT-PROTOCOL-TEST-ORACLE" :> <<"test/protocol-tests-core.test.mjs#generates language-independent HTTP and gRPC test vectors from Intent contract cases", "test/protocol-tests-cli.test.mjs#intent test executes a generated HTTP protocol test", "test/protocol-tests-cli.test.mjs#intent test executes a generated gRPC protocol test through the runner contract">>) @@ ("DSPEC-JSON-REPORT-COMPAT-FIXTURES" :> <<"test/cli.test.mjs#keeps check JSON report fixture in sync", "test/cli.test.mjs#keeps drift JSON report fixture in sync", "test/cli.test.mjs#keeps coverage JSON report fixture in sync", "test/cli.test.mjs#keeps failing coverage JSON report fixture in sync", "test/cli.test.mjs#keeps domain coverage JSON report fixture in sync", "test/cli.test.mjs#keeps failing domain coverage JSON report fixture in sync", "test/cli.test.mjs#keeps real app import fixture in sync", "test/cli.test.mjs#keeps real app reconciliation fixture in sync", "test/cli.test.mjs#keeps reverse coverage JSON report fixture in sync", "test/cli.test.mjs#keeps scaffolded app profile diff JSON report fixture in sync", "test/cli.test.mjs#keeps app profile evaluation JSON report fixture in sync", "test/cli.test.mjs#keeps app profile scenario evaluation JSON report fixture in sync", "test/cli.test.mjs#keeps extended app profile evaluation JSON report fixture in sync", "test/cli.test.mjs#keeps app profile scenario coverage JSON report fixture in sync", "test/cli.test.mjs#keeps app profile mutation score JSON report fixture in sync", "test/cli.test.mjs#keeps app profile evaluation Markdown report fixture in sync", "test/cli.test.mjs#keeps app profile JSON report fixture in sync", "test/cli.test.mjs#keeps app profile suite JSON report fixture in sync", "test/cli.test.mjs#keeps app profile suite evaluation JSON report fixture in sync", "test/cli.test.mjs#keeps scaled app profile JSON report fixture in sync", "test/cli.test.mjs#keeps impact JSON report fixture in sync", "test/cli.test.mjs#keeps spec compatibility JSON report fixture in sync", "test/cli.test.mjs#keeps spec change review JSON report fixture in sync", "test/cli.test.mjs#keeps approved breaking spec change review JSON report fixture in sync", "test/cli.test.mjs#keeps missing-evidence spec change review JSON report fixture in sync", "test/cli.test.mjs#keeps missing-ref spec change review JSON report fixture in sync", "test/cli.test.mjs#keeps spec reading evaluation JSON report fixture in sync", "test/cli.test.mjs#keeps spec reading digest refresh JSON report fixture in sync", "test/cli.test.mjs#keeps spec reading suite JSON report fixture in sync", "test/cli.test.mjs#keeps spec reading suite coverage JSON report fixture in sync", "test/cli.test.mjs#keeps metamorphic spec reading JSON report fixture in sync">>) @@ ("DSPEC-LEAN-EQ-SEMANTIC" :> <<"test/cli.test.mjs#proves Lean eq clauses with clause-scoped evidence", "test/cli.test.mjs#keeps Lean eq semantic proofs load-bearing", "test/cli.test.mjs#proves composed Lean implication clauses with clause-scoped evidence", "test/cli.test.mjs#keeps composed Lean implication proofs load-bearing", "test/assurance-evidence-core.test.mjs#classifies the supported Lean equality fragment as semantic">>) @@ ("DSPEC-MARKDOWN-REVIEW-ARTIFACT" :> <<"test/cli.test.mjs#checks dspec's localized projection artifacts", "test/cli.test.mjs#checks sample webapp localized projection artifacts", "test/cli.test.mjs#does not inherit entrypoint projection ownership through model amendments", "test/cli.test.mjs#generates and checks localized projection artifacts", "test/cli.test.mjs#keeps generate projection JSON report fixture in sync", "test/cli.test.mjs#keeps generated check projection JSON report fixture in sync", "test/cli.test.mjs#rejects projection locale matrices without a locale output placeholder", "test/cli.test.mjs#previews Projection generation without writing", "test/cli.test.mjs#rejects invalid Projection generation timestamps as command errors", "test/cli.test.mjs#writes and checks Projection provenance without changing its stable generation time", "test/cli.test.mjs#dogfoods single-locale and monorepo Projection holdouts", "test/projection-core.test.mjs#builds deterministic Projection snapshots and provenance", "test/projection-core.test.mjs#isolates Projection snapshots from renderer mutation", "test/projection-core.test.mjs#plans create, update, remove, and unchanged actions without filesystem access", "test/projection-core.test.mjs#preserves provenance generation time while its deterministic inputs stay current", "test/projection-core.test.mjs#represents generation commands as argv", "test/projection-core.test.mjs#rejects unsafe or colliding provenance contracts", "test/projection-transaction.test.mjs#commits a staged Projection transaction", "test/projection-transaction.test.mjs#rolls back every committed path when a Projection transaction fails", "test/projection-transaction.test.mjs#serializes Projection transactions and releases the lock after failure", "test/projection-transaction.test.mjs#records Projection lock ownership and recovers only stale owners", "test/projection-transaction.test.mjs#protects active foreign Projection leases and recovers expired leases", "test/projection-transaction.test.mjs#renews Projection leases while staging and committing", "test/cli.test.mjs#recovers stale Projection generation locks without overriding live owners", "test/cli.test.mjs#emits deterministic markdown">>) @@ ("DSPEC-NIX-CI-GATE" :> <<"test/cli.test.mjs#splits fast and formal GitHub Actions gates with caches">>) @@ ("DSPEC-NIX-FORMAL-TOOLS" :> <<"test/cli.test.mjs#declares formal backend tools in Nix devShell", "test/cli.test.mjs#emits devShell tool smoke reports", "test/cli.test.mjs#requires formal backend tools when requested">>) @@ ("DSPEC-PACKAGE-RELEASE" :> <<"test/release.test.mjs#defines the v0.1 public package boundary", "test/release.test.mjs#defines explicit release and compatibility policy", "test/release.test.mjs#publishes through npm OIDC without a long-lived token">>) @@ ("DSPEC-PRODUCT-POSITIONING" :> <<"test/cli.test.mjs#keeps product positioning and assurance boundaries explicit">>) @@ ("DSPEC-REAL-APP-DOGFOOD" :> <<"test/cli.test.mjs#dogfoods a real app model">>) @@ ("DSPEC-REAL-APP-IMPORTER" :> <<"test/cli.test.mjs#imports real app artifacts as observed facts", "test/cli.test.mjs#imports real app artifacts as a Pkl fragment", "test/cli.test.mjs#imports Cloudflare and Pulumi infrastructure from a second real app holdout", "test/cli.test.mjs#evaluates real app importer precision and recall against typed gold facts", "test/cli.test.mjs#imports Terraform plans and Kubernetes manifests as infrastructure facts", "test/cli.test.mjs#evaluates Terraform and Kubernetes importer coverage", "test/cli.test.mjs#projects imported IaC into domain patterns without inventing guarantees", "test/cli.test.mjs#keeps real app import fixture in sync", "test/real-app-core.test.mjs#normalizes IaC documents without filesystem access", "test/real-app-core.test.mjs#keeps the core API and CLI infrastructure output identical", "test/real-app-core.test.mjs#compares normalized app facts with a typed gold set", "test/real-app-core.test.mjs#projects infrastructure facts conservatively">>) @@ ("DSPEC-REAL-APP-RECONCILIATION" :> <<"test/cli.test.mjs#reconciles a real app model with imported facts", "test/cli.test.mjs#reports real app reconciliation drift", "test/cli.test.mjs#renders real app drift suggestions for CLI readers", "test/cli.test.mjs#keeps real app reconciliation fixture in sync">>) @@ ("DSPEC-REAL-APP-REVERSE-COVERAGE" :> <<"test/cli.test.mjs#reports reverse coverage for observed real app facts", "test/cli.test.mjs#reports unmodeled observed real app facts">>) @@ ("DSPEC-RELEASE-SAFETY-PATTERN" :> <<"test/cli.test.mjs#accepts Release safety pattern", "test/cli.test.mjs#rejects invalid Release safety references", "test/cli.test.mjs#emits Release safety pattern into backend projections", "test/cli.test.mjs#normalizes Release safety counterexamples to source steps", "test/cli.test.mjs#keeps generated Release safety checks load-bearing">>) @@ ("DSPEC-RUNTIME-COLLECTOR-FIXTURE" :> <<"test/cli.test.mjs#emits collectable inline runtime evidence fixture manifests">>) @@ ("DSPEC-RUNTIME-COLLECTOR-MANIFEST" :> <<"test/cli.test.mjs#emits runtime evidence collector manifests from Runtime safety specs", "test/cli.test.mjs#emits Runtime safety pattern into backend projections">>) @@ ("DSPEC-RUNTIME-EVIDENCE-COLLECTOR" :> <<"test/cli.test.mjs#collects runtime evidence from provider API payloads", "test/cli.test.mjs#collects runtime evidence from live HTTP sources", "test/cli.test.mjs#collects runtime evidence directly as a Pkl fragment", "test/cli.test.mjs#rejects invalid runtime evidence collector manifests">>) @@ ("DSPEC-RUNTIME-EVIDENCE-IMPORTER" :> <<"test/cli.test.mjs#imports runtime evidence JSON as a deterministic Pkl fragment", "test/cli.test.mjs#imports runtime evidence JSON as stable JSON", "test/cli.test.mjs#rejects invalid runtime evidence imports">>) @@ ("DSPEC-RUNTIME-EVIDENCE-PATTERN" :> <<"test/cli.test.mjs#rejects invalid Runtime evidence references", "test/cli.test.mjs#emits Runtime safety pattern into backend projections", "test/cli.test.mjs#normalizes Runtime safety counterexamples to source records", "test/cli.test.mjs#keeps generated Runtime safety checks load-bearing">>) @@ ("DSPEC-RUNTIME-EVIDENCE-VERIFIER" :> <<"test/cli.test.mjs#verifies runtime evidence collector expectations", "test/cli.test.mjs#reports runtime evidence expectation drift as JSON", "test/cli.test.mjs#reports stale runtime evidence as drift", "test/cli.test.mjs#reports runtime evidence quality and freshness summary">>) @@ ("DSPEC-RUNTIME-SAFETY-PATTERN" :> <<"test/cli.test.mjs#accepts Runtime safety pattern", "test/cli.test.mjs#rejects invalid Runtime safety references", "test/cli.test.mjs#emits Runtime safety pattern into backend projections", "test/cli.test.mjs#normalizes Runtime safety counterexamples to source records", "test/cli.test.mjs#keeps generated Runtime safety checks load-bearing">>) @@ ("DSPEC-SCHEMA-TYPED" :> <<"examples/dspec.pkl">>) @@ ("DSPEC-SOURCE-MAP-GENERATED" :> <<"test/cli.test.mjs#emits source maps for generated artifacts", "test/cli.test.mjs#keeps generated source map artifact in sync">>) @@ ("DSPEC-SPEC-CHANGE-REVIEW" :> <<"test/cli.test.mjs#reviews a spec change procedure", "test/cli.test.mjs#renders a spec change procedure for review", "test/cli.test.mjs#rejects a spec change procedure when compatibility is not allowed", "test/cli.test.mjs#requires explicit evidence for approved breaking spec changes", "test/cli.test.mjs#accepts approved breaking spec changes with required evidence", "test/cli.test.mjs#rejects breaking spec changes with missing evidence refs", "test/cli.test.mjs#keeps spec change review JSON report fixture in sync", "test/cli.test.mjs#keeps approved breaking spec change review JSON report fixture in sync", "test/cli.test.mjs#keeps missing-evidence spec change review JSON report fixture in sync", "test/cli.test.mjs#keeps missing-ref spec change review JSON report fixture in sync", "test/cli.test.mjs#reviews spec changes through spec-change subcommands">>) @@ ("DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD" :> <<"test/cli.test.mjs#scaffolds spec change review drafts", "test/cli.test.mjs#scaffolds breaking spec change review drafts with evidence policy", "test/cli.test.mjs#keeps scaffolded spec change review draft fixture in sync", "test/cli.test.mjs#writes scaffolded spec change review drafts to an output path", "test/cli.test.mjs#reports scaffolded spec change review output metadata as JSON", "test/cli.test.mjs#renders breaking spec change evidence suggestions", "test/cli.test.mjs#reports breaking spec change evidence suggestions as JSON", "test/cli.test.mjs#renders scaffold spec change review command help", "test/cli.test.mjs#scaffolds spec change reviews through spec-change subcommands", "test/cli.test.mjs#renders spec-change command group help", "test/cli.test.mjs#renders spec-change in normal workflow order in top-level usage", "test/cli.test.mjs#renders spec-change subcommand help", "test/cli.test.mjs#renders spec-change subcommand usage for argument errors", "test/cli.test.mjs#rejects removed legacy spec-change command names">>) @@ ("DSPEC-SPEC-COMPAT-CLASSIFIER" :> <<"test/cli.test.mjs#classifies spec compatibility changes", "test/cli.test.mjs#renders spec compatibility classification for review", "test/cli.test.mjs#keeps spec compatibility JSON report fixture in sync", "test/cli.test.mjs#classifies spec compatibility through spec-change subcommands">>) @@ ("DSPEC-SPEC-DIFF-IMPACT" :> <<"test/cli.test.mjs#emits spec diff impact reports", "test/cli.test.mjs#reports removed and regenerated artifacts for projection path changes", "test/cli.test.mjs#reports portable projection actions through spec-change review">>) @@ ("DSPEC-SPEC-QUERY" :> <<"test/cli.test.mjs#queries localized claims and verifies an evidence-grounded answer", "test/cli.test.mjs#keeps unsupported query evidence from being accepted as an answer">>) @@ ("DSPEC-SPEC-READING-EVAL" :> <<"test/cli.test.mjs#evaluates spec reading gold sets", "test/cli.test.mjs#renders spec reading evaluation prompts without gold labels", "test/cli.test.mjs#renders localized spec reading prompts with paraphrases", "test/cli.test.mjs#scores spec reading evaluation answers", "test/cli.test.mjs#scores spec reading answer evidence", "test/cli.test.mjs#detects stale spec reading gold evidence digests", "test/cli.test.mjs#refreshes spec reading gold evidence digests", "test/cli.test.mjs#evaluates spec reading suites with holdout cases", "test/cli.test.mjs#resolves spec reading eval paths relative to the eval file", "test/cli.test.mjs#resolves spec reading suite entries relative to the suite file", "test/cli.test.mjs#reports spec reading suite coverage", "test/cli.test.mjs#rejects undercovered spec reading suites", "test/cli.test.mjs#detects spec reading rubric version mismatches", "test/cli.test.mjs#renders spec reading score reports for subagent runs", "test/cli.test.mjs#writes spec reading subagent run artifacts", "test/cli.test.mjs#runs provider-neutral spec reading agents and records reproducible artifacts", "test/cli.test.mjs#records invalid spec reading agent output as a failing artifact", "test/cli.test.mjs#keeps provider-neutral spec reading agent artifacts in sync", "test/cli.test.mjs#runs metamorphic spec reading evaluation", "test/cli.test.mjs#keeps spec reading evaluation JSON report fixture in sync", "test/cli.test.mjs#keeps spec reading digest refresh JSON report fixture in sync", "test/cli.test.mjs#keeps spec reading suite JSON report fixture in sync", "test/cli.test.mjs#keeps spec reading suite coverage JSON report fixture in sync", "test/cli.test.mjs#keeps metamorphic spec reading JSON report fixture in sync">>) @@ ("DSPEC-SQL-QUERY-ORACLE" :> <<"test/cli.test.mjs#checks SQL query catalog against DB model", "test/cli.test.mjs#reports SQL query drift as JSON">>) @@ ("DSPEC-STABLE-IDS" :> <<"test/cli.test.mjs#keeps stable ids across localized renders">>) @@ ("DSPEC-TOPLEVEL-MODEL" :> <<"test/cli.test.mjs#rejects files without top-level model">>) @@ ("DSPEC-VERIFY-GENERATED-JSON" :> <<"test/cli.test.mjs#emits verify-generated JSON artifacts">>)

RuleClauses == ("DSPEC-APP-PROFILE" :> <<"scaffoldAppProfile(modelPath, appRoot).emits(AppProfile)", "scaffoldAppProfile(...).roundTrips(checkAppProfile)", "checkAppProfile(profile).runs(check + drift + domainCoverage + import + reconcile + reverseCoverage)", "checkAppProfile(profiles).aggregates(profileReports)", "checkAppProfile(scaleFixture).preserves(aggregateReportShape)", "checkAppProfileSuite(suite).loads(profileRegistry)", "observedFacts.fixture == importRealApp(appRoot)", "checkAppProfile(--fix, profile).refreshes(observedFacts)", "checkAppProfile(--fix --dry-run, profile).wouldFix(observedFacts)", "checkAppProfile(profile).preserves(gate.suggestions)", "checkAppProfile(--markdown, profile).renders(reviewTable)", "scaffoldAppProfile(--diff, profile).reports(scaffoldDrift)", "scaffoldAppProfile(--apply --dry-run, profile).previews(scaffoldDrift)", "scaffoldAppProfile(--apply, profile).writes(AppProfile)", "evaluateAppProfile(profile).checks(falsePositive + falseNegative)", "evaluateAppProfile(profile.scenarios).usesDeclaredScenarioDsl", "evaluateAppProfile(profile.scenarios).covers(releaseGate + route + schema + workflow + dataStore + runtimeDependency)", "evaluateAppProfile(--markdown, profile).renders(scenarioReviewTable + suggestionKind + mutation)", "coverageAppProfileScenarios(profile).requires(gateCoverage + categoryCoverage)", "coverageAppProfileScenarios(profile).countsOnly(evaluateAppProfileScenario.status == pass)", "profile.requiredScenarioCategories.scopes(categoryCoverage) && includes(inferredScenarioCategories)", "scoreAppProfileMutations(profile).generates(requiredScenarioCategories x suggestionKinds)", "scoreAppProfileMutations(profile).score == detected / generated && includes(shrinks)", "scoreAppProfileMutations(holdoutProfiles).guardsAgainst(sampleOverfit)", "scoreAppProfileMutations(profile).witnesses.stableUnder(orderPermutation + unrelatedObservedFacts)", "replayAppProfileChanges(corpus).matches(expectedDriftLabels)", "evaluateAppProfileSuite(suite).aggregates(profileEvaluations)">>) @@ ("DSPEC-ASSURANCE-EVIDENCE-MANIFEST" :> <<"evidence.create binds (modelDigest + sourceMapDigest + artifactDigest + toolVersion + result + executedAt)", "evidence.verify rejects stale(modelDigest || artifactDigest || toolVersion || result || clauseBindings)", "evidence.refresh == create(currentModel, currentTools)", "clauseBinding.support in {unmapped, textual, structural, semantic}", "formalAssurance -> selectors.nonEmpty && clauses.ast.nonEmpty && support == semantic && artifact.scope == clause && artifact.result == pass", "artifact.scope == generator -> assurance notIn {bounded, proved}">>) @@ ("DSPEC-AUTHORING-SHORTHAND" :> <<"shorthand.constructs.sameTypedRecords">>) @@ ("DSPEC-BACKEND-PROJECTION-OWNERSHIP" :> <<"projection.kind in {quickcheck, lean, alloy, tla, tla-cfg, source-map, generated-manifest} -> projection.matrix == single", "generatedCheck(projection) detects missing + stale + unexpected owned artifacts without writing", "impact(before, after).projectionArtifacts includes projectionKind + path + action for all materialized projections", "assuranceEvidenceManifest is execution evidence and is created or verified outside static projection generation">>) @@ ("DSPEC-BACKEND-REPORT-COMPAT-FIXTURES" :> <<"verifyGenerated.fixture == stableProjection(verifyGenerated.json)", "normalizeCounterexamples.fixture == stableProjection(normalizeCounterexamples.json)">>) @@ ("DSPEC-CHECK-APPROVED-VERIFIED" :> <<"rule.reviewStatus == approved && !rule.deprecated", "rule.checks.size + rule.implementedBy.size > 0">>) @@ ("DSPEC-CHECK-ASSURANCE" :> <<"check.assurances subsetOf {reference, executed, mutation-tested, bounded, proved}", "check.assurances - {reference} subsetOf check.assuranceEvidence.keys", "proved -> backend == lean && bounded -> backend in {tla, alloy}", "rule.requiredAssurances subsetOf union(rule.automatedChecks.assurances)", "reports.assurance == summary(activeApprovedRules.checks.assurances)", "generated.quickcheck.rules preserves (requiredAssurances + checks.assurances + assuranceEvidence)", "added(requiredAssurances) -> narrowing && removed(requiredAssurances) -> widening", "normalize(assuranceFailure).source.ruleId == failedRule.id">>) @@ ("DSPEC-CHECK-CONTRADICTION" :> <<"same_clause_identity.in(must).and(mustNot)">>) @@ ("DSPEC-CHECK-DRIFT-COVERAGE-JSON" :> <<"report.status in {pass, fail}", "report.errors.explainsFailingChecks">>) @@ ("DSPEC-CHECK-DUPLICATES" :> <<"duplicate_id.accepted">>) @@ ("DSPEC-CHECK-REFERENCES" :> <<"rule.terms.all(termIds.has)", "rule.exceptions.all(ruleIds.has)">>) @@ ("DSPEC-CLOUD-TOPOLOGY-PATTERN" :> <<"cloudPublicIngressBlocked(flow)", "cloudResourceAccessHasPolicy(flow)", "cloudTenantFlowPropagatesTenant(flow)", "cloudQueuePublishHasIdempotencyKey(flow)">>) @@ ("DSPEC-COUNTEREXAMPLE-NORMALIZED" :> <<"normalizesCounterexample(report, source-map)", "normalizeCounterexamples(tlaOrAlloyWitness).uses(source-map.generatedSelector)">>) @@ ("DSPEC-COVERAGE-APPROVED-CHECKED" :> <<"rule.reviewStatus == approved && !rule.deprecated", "rule.checks.exists(check => check.backend != manual && check.backend != runtime)">>) @@ ("DSPEC-COVERAGE-CLAUSE-QUALITY" :> <<"rule.coverage == clause", "rule.clauses.all(selector => automatedChecks.covers(selector))", "check.covers.all(selector => rule.clauses.has(selector))">>) @@ ("DSPEC-DAILY-DRIFT-REVIEW" :> <<"dailyDriftPacket.targets == manifest.targets; applicationTarget -> observed(appProfile|intentBindings|intentExercise); runtimeTarget -> observed(runtimeEvidence)", "dailyLlmReview == readOnly(packet) -> candidate(change|query); candidate != authoritativeChange", "dailyDriftPacket.reviewProjection == render(target.locales)", "dailyDriftBaseline == explicitApproval(targetModel + intentGraph + specChangeReview); targetChange -> review", "dailyLlmReview.evaluation == seeded(intentFormal + implementation + i18n + noDrift)", "dailyDriftWorkflow.schedule == cron && packetArtifact == retained && llmJob == packetOnly", "dailyDrift.elements == {goal.daily-drift-review, claim.daily-drift-review, assurance.daily-drift-review-property}">>) @@ ("DSPEC-DATA-GOVERNANCE-PATTERN" :> <<"dataSensitivePlacementEncrypted(placement)", "dataPersonalPlacementSupportsDeletion(placement)", "dataCrossRegionFlowHasLegalBasis(flow)", "dataRetentionWithinPolicy(dataset)">>) @@ ("DSPEC-DB-MIGRATION-MAPPING-COVERAGE" :> <<"dbMigrationMappingCoversInvariant(migration, mapping, invariant)">>) @@ ("DSPEC-DB-MIGRATION-MAPPING-WELL-FORMED" :> <<"dbMigrationMappingInvariantIsPreserved(migration, mapping, invariant)", "dbMigrationMappingMentionsSourceAndTarget(migration, mapping)">>) @@ ("DSPEC-DB-MIGRATION-PATTERN" :> <<"dbMigrationPreservesInvariant(migration, invariant)">>) @@ ("DSPEC-DB-MODEL-PATTERN" :> <<"dbTransactionPreservesInvariant(transaction, invariant)">>) @@ ("DSPEC-DB-SCHEMA-IMPORTER" :> <<"dbSchemaImportsCreateTables(schema, dbModel)">>) @@ ("DSPEC-DOCUMENTED-CLI-EXAMPLES" :> <<"cli.usage.generatedFrom(topLevelCommandRegistry)", "documentedCliExamples(readme + docs + taskfile).commands subsetOf cli.usage.commands", "documentedCliExamples(specChange).subcommands subsetOf {compat, scaffold, review}", "documentedCliExamples.safeSmoke.runs(help)", "documentedCliExtractor.hasHoldout(fencedDspec + nodeOldpwd + pipe + inlineBackticks)">>) @@ ("DSPEC-DOGFOOD-TASK" :> <<"dogfoodTaskRunsSelfEvaluation(task)">>) @@ ("DSPEC-DOMAIN-COVERAGE-ORACLE" :> <<"domainCoverage.elements == tracked(patterns.db + patterns.cloud + patterns.data + patterns.release + patterns.runtime)", "domainCoverage.uncovered == []">>) @@ ("DSPEC-DOMAIN-PRESET-PACK" :> <<"domainPack.expandsToCoreIr", "domainPack.preservesTypedClauseAst">>) @@ ("DSPEC-DRIFT-CHECK-TARGET" :> <<"checkTarget.path.exists", "checkTarget.anchor == null || target.contains(anchor)", "backendCheckTarget.anchor.resolvesAs(backendSpecificSymbol)">>) @@ ("DSPEC-DRIFT-IMPLEMENTATION-REF" :> <<"implementedBy.path.exists", "implementedBy.symbol == null || file.contains(symbolDeclaration)">>) @@ ("DSPEC-EMIT-FORMAL-BACKENDS" :> <<"emit(alloy|tla|lean, model).deterministic">>) @@ ("DSPEC-EMIT-MARKDOWN" :> <<"emit(markdown, model).deterministic">>) @@ ("DSPEC-EMIT-QUICKCHECK" :> <<"quickcheck.output.includes(generator) && quickcheck.output.includes(shrinker)">>) @@ ("DSPEC-EXPR-AST-PROJECTION" :> <<"preservesClauseAst(quickcheck, tla, lean)">>) @@ ("DSPEC-EXPR-OPAQUE" :> <<"cli.parses_clause_expr_semantics">>) @@ ("DSPEC-EXPR-TYPED-AST" :> <<"clause.ast == null || validExprAst(clause.ast)", "acceptsOnlyDeclaredFields(exprAst.operator)", "model.clauseAstSemanticsVersion == checker.supportedClauseAstSemanticsVersion">>) @@ ("DSPEC-FORMAL-SOURCE-OF-TRUTH" :> <<"normativeMeaning == formalModel; localizedText == projection(formalModel)", "formalModel -> derive(markdown + quickcheck + formalBackend); implementation -> passes(declaredOracle)", "llm(changeRequest|question) -> candidate(formalModelEdit|structuredQuery) -> validate + review + evidence", "formalSource.elements == {goal.formal-source-of-truth, claim.formal-source-of-truth, assurance.formal-source-of-truth-property, assurance.formal-source-of-truth-lean, binding.formal-source-of-truth}">>) @@ ("DSPEC-GENERATED-ALLOY-SYNTAX" :> <<"validatesGeneratedAlloySyntax(model)", "(hasTool(alloy6)) -> (executesGeneratedAlloyAnalyzer(model))">>) @@ ("DSPEC-GENERATED-ARTIFACT-FRESHNESS" :> <<"generatedManifest.hashes(markdown, quickcheck, alloy, tla, tlaCfg, lean, sourceMap)", "generated/manifest.json == emit(generated-manifest, examples/dspec.pkl)">>) @@ ("DSPEC-GENERATED-CHECKS-LOAD-BEARING" :> <<"(unsupportedApprovedRule(rule)) -> (generatedChecksFail(rule))">>) @@ ("DSPEC-GENERATED-LEAN-COMPILES" :> <<"compilesGeneratedLean(model)">>) @@ ("DSPEC-GENERATED-QUICKCHECK-RUNS" :> <<"runsGeneratedQuickcheck(model)">>) @@ ("DSPEC-GENERATED-TLA-SYNTAX" :> <<"validatesGeneratedTlaSyntax(model)", "(hasTool(tlasany)) -> (runsGeneratedTlaSany(model))", "(hasTool(tlc)) -> (runsGeneratedTlaTlc(model))">>) @@ ("DSPEC-I18N-RENDER" :> <<"command == render && locale.requested", "output.uses(locale) || output.uses(default)">>) @@ ("DSPEC-I18N-SEMANTIC-DRIFT" :> <<"localizedText.labels.cover(requiredLocales)", "i18n.glossary.labels == vocabulary.term.text.labels", "translationLock.sourceHash == localizedText.primaryLocale.currentHash">>) @@ ("DSPEC-IMPLEMENTATION-CONFORMANCE" :> <<"conformanceMatchesReference(target, input)", "conformance.failure.shrinksTo(declaredFailingCase)", "conformance.pass -> executedEvidence && conformance.pass != arbitraryImplementationProof">>) @@ ("DSPEC-INTENT-CLOSED-CONSTRUCTION" :> <<"intent.process.outcomes == intent.process.constructs subsetOf constructionAuthority", "intent.scenario.trace follows process.input and process.transition", "intent.elements == {capability.pkl.typecheck, capability.dspec.validate, outcome.intent-model-accepted, outcome.intent-model-accepted/output/validationReport, intent.validate-model, intent.validate-model/input/modelId, intent.validate-model/input/modelVersion, intent.validate-model/intent.validate-model-cli, intent.validate-model-accepts, intent-model-acceptance}">>) @@ ("DSPEC-INTENT-GOAL-GRAPH" :> <<"intent.goal.claims -> intent.claim.processes + assuranceTask + semanticBinding", "intent.goalGraph.elements == {goal.intent-model-validation, claim.intent-model-validation, assurance.intent-model-validation-property, assurance.intent-model-validation-alloy, binding.intent-model-validation}">>) @@ ("DSPEC-INTENT-PROTOCOL-TEST-ORACLE" :> <<"intent.protocolTest.canonicalFields decodedAndBoundTo refinement.implementationFields", "intent.protocolTest.generatedTrace executedWith selectedTransport expectedStatusOrGrpcCode">>) @@ ("DSPEC-JSON-REPORT-COMPAT-FIXTURES" :> <<"fixtures.reports == cli.jsonReports", "futureChecker.preserves(reportFixtures)">>) @@ ("DSPEC-LEAN-EQ-SEMANTIC" :> <<"ClauseEnv == String -> Option String", "Satisfies(env, eq(left, right)) == (resolve(env, left) == resolve(env, right))", "Satisfies(env, neq(left, right)) == (resolve(env, left) != resolve(env, right))", "Satisfies(env, not(child)) == not(Satisfies(env, child))", "Satisfies(env, implies(left, right)) == (Satisfies(env, left) -> Satisfies(env, right))", "semantic(lean, clause) iff operators(clause) subsetOf {eq, neq, not, implies}", "proved(lean, selector) -> generatedClauseTheorem(selector)", "clauseTheorem.failed -> evidence.create.failed", "clauseArtifact.propertyIds intersects clauseBinding.generatedSelectors">>) @@ ("DSPEC-MARKDOWN-REVIEW-ARTIFACT" :> <<"projection(self-markdown).artifacts == locales.map(locale -> generated/examples/{locale}/dspec.md)", "derive(entrypoint.model).projections == []", "emit(markdown).rules.include(source, coverage, selectors, checks, implementations)", "emit(markdown).reviewSummary.includes(approvedRules + automatedChecks + implementationRefs + projections + domainElements + runtimeEvidenceRecords)", "plan(projection, observedState) -> {create, update, remove, unchanged} without filesystem mutation", "generate(dryRun).writes == 0 && generate(plan).argv is List<String>", "provenance == modelDigest + projectionId + emitterVersion + stableGeneratedAt + artifactDigests", "transaction.failure -> rollback(allCommittedPaths)", "concurrent(generate(root), generate(root)) -> atMostOneCommitter && failure.releases(lock(root))", "lockOwner == {pid, hostname, acquiredAt, heartbeatAt, leaseMs, token}", "unlock(lock) requires dead(owner) || expired(lease) || force", "transaction(stage|commit) -> renew(lock.lease)">>) @@ ("DSPEC-NIX-CI-GATE" :> <<"githubActions.fast.run(pkf run check:fast).cache(pnpm + pkl + pkfireCas)", "githubActions.formal.run(nix develop path:$PWD -c pkf run check:formal).cache(nix)", "githubActions.jobs(fast, formal).parallel && pullRequest.supersededRun.cancelled">>) @@ ("DSPEC-NIX-FORMAL-TOOLS" :> <<"devShell.packages.includes(nodejs_24, pnpm, pkl, elan, z3, tlaplus, alloy6)", "devshellSmoke(strict + requireStorePath).checks(requiredTools)", "verifyGenerated(requireFormalTools).requires(tlaSany + tlaTlc + alloyAnalyzer)">>) @@ ("DSPEC-PACKAGE-RELEASE" :> <<"npmPackage.files == {schema + cli + core + readme + license}", "publish.uses(oidcTrustedPublisher + node24 + npm11) && !publish.uses(longLivedWriteToken)", "breakingPublicChange -> semverMinorBefore1_0 && changedSemantics -> newClauseAstSemanticsVersion">>) @@ ("DSPEC-PRODUCT-POSITIONING" :> <<"primaryValue == reconcile(authoredModel, observedFacts) + reverseCoverage + domainCoverage", "executableSpecification == deterministic(check + projection + reconciliation + evidence)", "proved(selector) -> semanticBackendSupport(selector) && scope(selector) == selectedClause", "importerPass != deploymentOrProductionReachabilityProof", "importerCoverage == declaredAdapters">>) @@ ("DSPEC-REAL-APP-DOGFOOD" :> <<"examples/sample-webapp-2026.pkl.check == pass", "examples/sample-webapp-2026.pkl.drift == pass", "examples/sample-webapp-2026.pkl.domainCoverage == pass", "reconcileRealApp(examples/sample-webapp-2026.pkl, importRealApp(sample-webapp-2026)) == pass", "reverseCoverage(importRealApp(sample-webapp-2026), examples/sample-webapp-2026.pkl) == pass", "checkAppProfile(fixtures/sample-webapp-profile.pkl) == pass", "evaluateAppProfile(fixtures/sample-webapp-profile-scenarios.pkl) == pass", "evaluateAppProfile(fixtures/sample-webapp-profile-extended-scenarios.pkl) == pass", "coverageAppProfileScenarios(fixtures/sample-webapp-profile-extended-scenarios.pkl) == pass", "scoreAppProfileMutations(fixtures/sample-webapp-profile-extended-scenarios.pkl).score == 1", "coverageAppProfileScenarios(fixtures/sample-webapp-profile-route-scenarios.pkl) == pass", "coverageAppProfileScenarios(fixtures/sample-webapp-profile-route-missing-spec-scenario.pkl) == fail", "coverageAppProfileScenarios(fixtures/sample-webapp-profile-underdeclared-categories.pkl) == fail", "coverageAppProfileScenarios(fixtures/sample-webapp-profile-route-ineffective-scenario.pkl) == fail", "checkAppProfileSuite(fixtures/sample-webapp-profile-suite.pkl) == pass", "scaffoldAppProfile(--diff, fixtures/sample-webapp-profile.pkl) == pass", "scaffoldAppProfile(--apply --dry-run, fixtures/sample-webapp-profile.pkl) == pass", "evaluateAppProfile(--markdown, fixtures/sample-webapp-profile-extended-scenarios.pkl) == pass">>) @@ ("DSPEC-REAL-APP-IMPORTER" :> <<"importRealApp(root).observes(routes + contracts + workflows + qualityConfig + infrastructure)", "importRealApp(root).pklFragment.canSeed(patterns)", "evaluateRealAppImport(goldFacts).precision == 1 && evaluateRealAppImport(goldFacts).recall == 1", "realAppCore.hasNoFilesystemOrPklProcessDependency && cli.infrastructure == realAppCore.infrastructure">>) @@ ("DSPEC-REAL-APP-RECONCILIATION" :> <<"reconcileRealApp(model, observed).covers(patternElements)", "missingObservedFact -> report.status == fail", "missingObservedFact -> suggestion.kind == implementation-missing">>) @@ ("DSPEC-REAL-APP-REVERSE-COVERAGE" :> <<"reverseCoverage(observed, model).uncovered == []", "unmodeledObservedFact -> report.status == fail", "unmodeledObservedFact -> suggestion.kind == spec-missing">>) @@ ("DSPEC-RELEASE-SAFETY-PATTERN" :> <<"releaseProductionStepHasHealthGate(step)", "releaseTrafficShiftHasRollback(step)", "releaseRollbackPlanTested(step)", "releaseMigrationBackwardCompatible(step)">>) @@ ("DSPEC-RUNTIME-COLLECTOR-FIXTURE" :> <<"runtimeCollectorFixtureHasInlinePayloads(runtimeModel)", "runtimeCollectorFixtureVerifies(runtimeModel)">>) @@ ("DSPEC-RUNTIME-COLLECTOR-MANIFEST" :> <<"runtimeCollectorManifestGeneratedFromSpec(runtimeModel)", "runtimeCollectorManifestHasSourceMap(manifest)">>) @@ ("DSPEC-RUNTIME-EVIDENCE-COLLECTOR" :> <<"runtimeEvidenceCollectsProviderScopedJson(manifest)", "collectRuntimeEvidence(httpSource).fetchesProviderPayload", "runtimeEvidenceCollectorCanEmitPkl(manifest)", "runtimeEvidenceCollectorRejectsInvalidManifest(manifest)">>) @@ ("DSPEC-RUNTIME-EVIDENCE-IMPORTER" :> <<"runtimeEvidenceImportPklDeterministic(providerJson)", "runtimeEvidenceImportJsonStable(providerJson)", "runtimeEvidenceImportRejectsInvalidRecords(providerJson)">>) @@ ("DSPEC-RUNTIME-EVIDENCE-PATTERN" :> <<"runtimeSloHasTelemetry(slo)", "runtimeTelemetryMeetsSlo(telemetry)", "runtimePageAlertHasEnabledPolicy(alert)", "runtimePageAlertHasRunbookExecution(alert)", "runtimeDependencyTraceWithinTimeout(dependencyTrace)">>) @@ ("DSPEC-RUNTIME-EVIDENCE-VERIFIER" :> <<"runtimeEvidenceVerifierCoversExpectations(manifest)", "runtimeEvidenceVerifierReportsDrift(manifest)", "verifyRuntimeEvidence(staleEvidence).freshWithinDays.reported", "verifyRuntimeEvidence(json).quality.summarizes(missing + stale + freshnessChecked + score)">>) @@ ("DSPEC-RUNTIME-SAFETY-PATTERN" :> <<"runtimeCriticalSloHasPageAlert(slo)", "runtimePageAlertHasTestedRunbook(alert)", "runtimeDependencyHasTimeout(dependency)", "runtimeRetryIsIdempotent(dependency)">>) @@ ("DSPEC-SCHEMA-TYPED" :> <<"pkl.file.authored", "pkl.eval(model).ok">>) @@ ("DSPEC-SOURCE-MAP-GENERATED" :> <<"emitsSourceMap(model)">>) @@ ("DSPEC-SPEC-CHANGE-REVIEW" :> <<"reviewSpecChange(review).runs(checkBefore + checkAfter + impact + compatibility + breakingPolicy + coverageAfter)", "reviewSpecChange(review).gates(expectedCompatibility + allowedCompatibility)", "reviewSpecChange(review).breaking -> requires(migrationPlan + deprecationPlan + rolloutPlan + ownerApproval)", "reviewSpecChange(review).evidence.ref resolves(file + markdownAnchor)", "reviewSpecChange(review).emits(jsonReport + markdownReview)">>) @@ ("DSPEC-SPEC-CHANGE-REVIEW-SCAFFOLD" :> <<"scaffoldSpecChangeReview(before, after).emits(SpecChangeReviewPkl)", "scaffoldSpecChangeReview(outputPath).writes(PklFile) && importPath.relativeTo(outputPath)", "scaffoldSpecChangeReview(outputPath).prints(nextReviewCommand)", "reviewSpecChange(savedReview).independentOf(cwd)", "scaffoldSpecChangeReview(before, after).fills(expectedCompatibility + allowedCompatibility + requiredSteps)", "scaffoldSpecChangeReview(breaking).requiresBreakingEvidence && leavesEvidenceEmpty", "reviewSpecChange(breakingMissingEvidence).suggests(evidencePkl)", "scaffoldSpecChangeReview.help.documents(output + breakingEvidence)", "specChangeCommand.group(compat + scaffold + review) && onlyCanonicalCommandNames.exposed", "removedLegacySpecChangeCommands.rejectWith(unknownCommand)", "specChangeCommand.help.orders(compat -> scaffold -> review) && subcommands.haveLocalUsage", "topLevelUsage.lists(specChange.compat -> specChange.scaffold -> specChange.review)", "fixtures.scaffoldSpecChangeReview == cli.scaffoldSpecChangeReview">>) @@ ("DSPEC-SPEC-COMPAT-CLASSIFIER" :> <<"classifySpecCompat(before, after).classification in {compatible, breaking, narrowing, widening, unknown}", "classifySpecCompat(before, after).decisions.explain(eachChange)", "removedApprovedRule -> breaking && addedObligation -> narrowing && addedPermission -> widening">>) @@ ("DSPEC-SPEC-DIFF-IMPACT" :> <<"impact.diff.detects(term, rule).added_removed_modified", "impact.changedTerm.rules -> generatedSelectors + implementationRefs", "impact.projections -> changed + artifacts(action, path, locale) + regenerateCommand">>) @@ ("DSPEC-SPEC-QUERY" :> <<"query(rule|term|evidence|impact|clause, id).returns(localizedResult + resolvedEvidence)", "query(clause.mustNot).classification == contradicted && query(missing).classification == not-supported", "query.answer.classificationAndEvidence.mustMatch(deterministicQueryResult)">>) @@ ("DSPEC-SPEC-READING-EVAL" :> <<"specReadingEval.cases.label in {entailed, contradicted, not-supported}", "specReadingEval(entailed + contradicted).evidence resolves(term + rule + clause)", "specReadingEval.prompt.hides(goldLabels)", "specReadingEval.prompt.includes(rubric + localeParaphrases)", "specReadingEval.score(answers).reports(accuracy + perCaseStatus)", "specReadingEval.score(answers).checks(answerEvidenceResolution + goldOverlap)", "specReadingEval.goldEvidence.digest.detects(staleRefs)", "specReadingEval.refreshDigests.dryRunAndApply", "specReadingEvalSuite.evaluations.aggregate(sample + holdout)", "specReadingEvalSuite.coverage.requires(labels + evidenceKinds + modelKinds + tags + paraphraseLocales)", "specReadingEval.metamorphic.preserves(answerOrder + evidenceOrder + rationaleNoise)", "specReadingEval.metamorphic.rejects(flippedLabel)", "specReadingEval.prompt.caseIds.notLeak(goldLabels)", "specReadingEval.paths.resolveRelativeTo(ownerFile)", "specReadingEval.rubricVersion == cli.rubricVersion", "specReadingEval.score.writeRun.records(subagentPrompt + scoreReport)", "specReadingEval.runner.process(stdinPrompt).stdoutAnswers && artifact.records(provider + model + digests + exit + rawOutput + score)", "specReadingEval.markdownScore.records(subagentRun + goldFixCandidates)">>) @@ ("DSPEC-SQL-QUERY-ORACLE" :> <<"query.tablesAndColumns ⊆ patterns.db.tablesAndColumns", "query.touches(tenantScopedTable) -> query.mentions(tenantColumn)", "query.joins(fkTable, targetTable) -> query.mentions(fkColumn, targetKey)">>) @@ ("DSPEC-STABLE-IDS" :> <<"id.locale_independent", "text.labels.by_locale">>) @@ ("DSPEC-TOPLEVEL-MODEL" :> <<"json.document.model.exists">>) @@ ("DSPEC-VERIFY-GENERATED-JSON" :> <<"emitsVerificationJson(model)">>)

DbTables == {}

DbInvariants == {}

DbTransactions == {}

DbPreserves == [tx \in DbTransactions |-> {}]

DbTouches == [tx \in DbTransactions |-> {}]

DbMigrations == {}

DbMigrationPreserves == [migration \in DbMigrations |-> {}]

DbMigrationTouches == [migration \in DbMigrations |-> {}]

DbMigrationMappings == [migration \in DbMigrations |-> {}]

DbMappings == {}

DbMappingCovers == [mapping \in DbMappings |-> {}]

DbMigrationMappingCoverage ==
  [migration \in DbMigrations |-> UNION { DbMappingCovers[mapping] : mapping \in DbMigrationMappings[migration] }]

DbMigrationSources == [migration \in DbMigrations |-> {}]

DbMigrationTargets == [migration \in DbMigrations |-> {}]

DbMappingMentionsSource == [mapping \in DbMappings |-> {}]

DbMappingMentionsTarget == [mapping \in DbMappings |-> {}]

CloudNodes == {}

CloudFlows == {}

CloudPublicIngress == {}

CloudSensitiveResources == {}

CloudFlowFrom == [flow \in CloudFlows |-> ""]

CloudFlowTo == [flow \in CloudFlows |-> ""]

CloudRequiresPolicy == {}

CloudAllowedByPolicy == {}

CloudTenantScopedNodes == {}

CloudTenantPropagatedFlows == {}

CloudQueuePublishes == {}

CloudIdempotentFlows == {}

DataSets == {}

DataStores == {}

DataPlacements == {}

DataFlows == {}

DataSensitivePlacements == {}

DataEncryptedPlacements == {}

DataPersonalPlacements == {}

DataDeletionSupportedPlacements == {}

DataCrossRegionFlows == {}

DataLegalBasisFlows == {}

DataRetentionScopedSets == {}

DataRetentionCompliantSets == {}

ReleaseServices == {}

ReleaseEnvironments == {}

ReleaseGates == {}

ReleaseRollbacks == {}

ReleaseMigrations == {}

ReleaseSteps == {}

ReleaseProductionSteps == {}

ReleaseHealthGatedSteps == {}

ReleaseTrafficShiftSteps == {}

ReleaseRollbackPlannedSteps == {}

ReleaseRollbackTestedSteps == {}

ReleaseMigrationScopedSteps == {}

ReleaseMigrationCompatibleSteps == {}

RuntimeServices == {}

RuntimeDependencies == {}

RuntimeSignals == {}

RuntimeRunbooks == {}

RuntimeAlerts == {}

RuntimeSlos == {}

RuntimeTelemetry == {}

RuntimeAlertPolicies == {}

RuntimeRunbookExecutions == {}

RuntimeDependencyTraces == {}

RuntimeCriticalSlos == {}

RuntimePageAlertedSlos == {}

RuntimePageAlerts == {}

RuntimeTestedRunbookAlerts == {}

RuntimeTimeoutDependencies == {}

RuntimeRetryDependencies == {}

RuntimeIdempotentDependencies == {}

RuntimeTelemetrySlos == {}

RuntimePassingTelemetry == {}

RuntimeEnabledPolicyAlerts == {}

RuntimeExecutedRunbookAlerts == {}

RuntimeTimeoutCompliantTraces == {}

IntentCapabilities == {"capability.dspec.validate", "capability.pkl.typecheck"}

IntentOutcomes == {"outcome.intent-model-accepted"}

IntentProcesses == {"intent.validate-model"}

IntentOutcomeState == ("outcome.intent-model-accepted" :> "state.intent-model-accepted")

IntentProcessInput == ("intent.validate-model" :> "state.intent-model-authored")

IntentProcessOutcomes == ("intent.validate-model" :> {"outcome.intent-model-accepted"})

IntentProcessConstructs == ("intent.validate-model" :> {"outcome.intent-model-accepted"})

IntentProcessTransitions == ("intent.validate-model" :> {<<"state.intent-model-authored", "state.intent-model-accepted">>})

IntentAuthorisedConstruction == {<<"intent.validate-model", "outcome.intent-model-accepted">>}

IntentExecutionProcesses == {}

IntentIdempotentProcesses == {}

IntentTimedProcesses == {}

IntentProcessMaxInFlight == [process \in IntentExecutionProcesses |-> 1]

IntentProcessTimeoutSteps == [process \in IntentTimedProcesses |-> 1]

IntentExecutionKeySpace == 1..1

IntentScenarios == {"intent-model-acceptance"}

IntentScenarioInitialState == ("intent-model-acceptance" :> "state.intent-model-authored")

IntentScenarioExpectedState == ("intent-model-acceptance" :> "state.intent-model-accepted")

IntentScenarioSteps == ("intent-model-acceptance" :> <<<<"intent.validate-model", "outcome.intent-model-accepted">>>>)

RuleWorkflowState == {"approved", "verified", "deprecated", "uncovered"}

VARIABLES selectedRule, ruleState, support, intentInFlight, intentActiveKeys, intentElapsed

vars == <<selectedRule, ruleState, support, intentInFlight, intentActiveKeys, intentElapsed>>

Init ==
  /\ selectedRule \in ActiveApprovedRules
  /\ ruleState = "approved"
  /\ support = Checks[selectedRule]
  /\ intentInFlight = [process \in IntentExecutionProcesses |-> 0]
  /\ intentActiveKeys = [process \in IntentExecutionProcesses |-> {}]
  /\ intentElapsed = [process \in IntentExecutionProcesses |-> 0]

MarkVerified ==
  /\ ruleState = "approved"
  /\ Len(support) > 0
  /\ ruleState' = "verified"
  /\ UNCHANGED <<selectedRule, support, intentInFlight, intentActiveKeys, intentElapsed>>

DetectUncovered ==
  /\ ruleState = "approved"
  /\ Len(support) = 0
  /\ ruleState' = "uncovered"
  /\ UNCHANGED <<selectedRule, support, intentInFlight, intentActiveKeys, intentElapsed>>

Deprecate ==
  /\ ruleState = "approved"
  /\ ruleState' = "deprecated"
  /\ UNCHANGED <<selectedRule, support, intentInFlight, intentActiveKeys, intentElapsed>>

IntentStart(process, key) ==
  /\ process \in IntentExecutionProcesses
  /\ key \in IntentExecutionKeySpace
  /\ intentInFlight[process] < IntentProcessMaxInFlight[process]
  /\ (process \notin IntentIdempotentProcesses \/ key \notin intentActiveKeys[process])
  /\ intentInFlight' = [intentInFlight EXCEPT ![process] = @ + 1]
  /\ intentActiveKeys' =
    IF process \in IntentIdempotentProcesses
      THEN [intentActiveKeys EXCEPT ![process] = @ \cup {key}]
      ELSE intentActiveKeys
  /\ intentElapsed' =
    IF intentInFlight[process] = 0
      THEN [intentElapsed EXCEPT ![process] = 0]
      ELSE intentElapsed
  /\ UNCHANGED <<selectedRule, ruleState, support>>

IntentStartAny ==
  \E process \in IntentExecutionProcesses :
    \E key \in IntentExecutionKeySpace :
      IntentStart(process, key)

IntentComplete(process, key) ==
  /\ process \in IntentExecutionProcesses
  /\ key \in IntentExecutionKeySpace
  /\ intentInFlight[process] > 0
  /\ (process \notin IntentIdempotentProcesses \/ key \in intentActiveKeys[process])
  /\ intentInFlight' = [intentInFlight EXCEPT ![process] = @ - 1]
  /\ intentActiveKeys' =
    IF process \in IntentIdempotentProcesses
      THEN [intentActiveKeys EXCEPT ![process] = @ \ {key}]
      ELSE intentActiveKeys
  /\ intentElapsed' =
    IF intentInFlight[process] = 1
      THEN [intentElapsed EXCEPT ![process] = 0]
      ELSE intentElapsed
  /\ UNCHANGED <<selectedRule, ruleState, support>>

IntentCompleteAny ==
  \E process \in IntentExecutionProcesses :
    \E key \in IntentExecutionKeySpace :
      IntentComplete(process, key)

IntentTick(process) ==
  /\ process \in IntentTimedProcesses
  /\ intentInFlight[process] > 0
  /\ intentElapsed[process] < IntentProcessTimeoutSteps[process]
  /\ intentElapsed' = [intentElapsed EXCEPT ![process] = @ + 1]
  /\ UNCHANGED <<selectedRule, ruleState, support, intentInFlight, intentActiveKeys>>

IntentTickAny ==
  \E process \in IntentTimedProcesses : IntentTick(process)

IntentExpire(process) ==
  /\ process \in IntentTimedProcesses
  /\ intentInFlight[process] > 0
  /\ intentElapsed[process] = IntentProcessTimeoutSteps[process]
  /\ intentInFlight' = [intentInFlight EXCEPT ![process] = 0]
  /\ intentActiveKeys' = [intentActiveKeys EXCEPT ![process] = {}]
  /\ intentElapsed' = [intentElapsed EXCEPT ![process] = 0]
  /\ UNCHANGED <<selectedRule, ruleState, support>>

IntentExpireAny ==
  \E process \in IntentTimedProcesses : IntentExpire(process)

Next ==
  MarkVerified \/ DetectUncovered \/ Deprecate \/ IntentStartAny \/ IntentCompleteAny \/ IntentTickAny \/ IntentExpireAny \/ UNCHANGED vars

Spec == Init /\ [][Next]_vars

CoverageInvariant ==
  \A r \in ActiveApprovedRules : Len(Checks[r]) > 0

WorkflowInvariant ==
  ruleState \in RuleWorkflowState /\ ruleState # "uncovered"

DbInvariantPreserved ==
  \A tx \in DbTransactions : DbTouches[tx] \subseteq DbPreserves[tx]

DbMigrationPreserved ==
  \A migration \in DbMigrations : DbMigrationTouches[migration] \subseteq DbMigrationPreserves[migration]

DbMigrationMappingCovered ==
  \A migration \in DbMigrations : DbMigrationPreserves[migration] \subseteq DbMigrationMappingCoverage[migration]

DbMigrationMappingRefsMentionTables ==
  \A migration \in DbMigrations :
    \A mapping \in DbMigrationMappings[migration] :
      /\ DbMappingMentionsSource[mapping] \cap DbMigrationSources[migration] # {}
      /\ DbMappingMentionsTarget[mapping] \cap DbMigrationTargets[migration] # {}

CloudPublicIngressBlocked ==
  \A flow \in CloudFlows :
    CloudFlowFrom[flow] \in CloudPublicIngress => CloudFlowTo[flow] \notin CloudSensitiveResources

CloudResourceAccessHasPolicy ==
  CloudRequiresPolicy \subseteq CloudAllowedByPolicy

CloudTenantFlowsPropagateTenant ==
  \A flow \in CloudFlows :
    (CloudFlowFrom[flow] \in CloudTenantScopedNodes \/ CloudFlowTo[flow] \in CloudTenantScopedNodes)
      => flow \in CloudTenantPropagatedFlows

CloudQueuePublishesHaveIdempotencyKey ==
  CloudQueuePublishes \subseteq CloudIdempotentFlows

DataSensitivePlacementsEncrypted ==
  DataSensitivePlacements \subseteq DataEncryptedPlacements

DataPersonalPlacementsSupportDeletion ==
  DataPersonalPlacements \subseteq DataDeletionSupportedPlacements

DataCrossRegionFlowsHaveLegalBasis ==
  DataCrossRegionFlows \subseteq DataLegalBasisFlows

DataRetentionWithinPolicy ==
  DataRetentionScopedSets \subseteq DataRetentionCompliantSets

ReleaseProductionStepsHaveHealthGate ==
  ReleaseProductionSteps \subseteq ReleaseHealthGatedSteps

ReleaseTrafficShiftsHaveRollback ==
  ReleaseTrafficShiftSteps \subseteq ReleaseRollbackPlannedSteps

ReleaseRollbackPlansAreTested ==
  ReleaseRollbackPlannedSteps \subseteq ReleaseRollbackTestedSteps

ReleaseMigrationsAreBackwardCompatible ==
  ReleaseMigrationScopedSteps \subseteq ReleaseMigrationCompatibleSteps

RuntimeCriticalSlosHavePageAlert ==
  RuntimeCriticalSlos \subseteq RuntimePageAlertedSlos

RuntimePageAlertsHaveTestedRunbook ==
  RuntimePageAlerts \subseteq RuntimeTestedRunbookAlerts

RuntimeDependenciesHaveTimeout ==
  RuntimeDependencies \subseteq RuntimeTimeoutDependencies

RuntimeRetriesAreIdempotent ==
  RuntimeRetryDependencies \subseteq RuntimeIdempotentDependencies

RuntimeSlosHaveTelemetry ==
  RuntimeSlos \subseteq RuntimeTelemetrySlos

RuntimeTelemetryMeetsSlo ==
  RuntimeTelemetry \subseteq RuntimePassingTelemetry

RuntimePageAlertsHaveEnabledPolicy ==
  RuntimePageAlerts \subseteq RuntimeEnabledPolicyAlerts

RuntimePageAlertsHaveExecutedRunbook ==
  RuntimePageAlerts \subseteq RuntimeExecutedRunbookAlerts

RuntimeDependencyTracesWithinTimeout ==
  RuntimeDependencyTraces \subseteq RuntimeTimeoutCompliantTraces

IntentExecutionTypeInvariant ==
  /\ intentInFlight \in [IntentExecutionProcesses -> Nat]
  /\ intentActiveKeys \in [IntentExecutionProcesses -> SUBSET IntentExecutionKeySpace]
  /\ intentElapsed \in [IntentExecutionProcesses -> Nat]

IntentConcurrencyBounded ==
  \A process \in IntentExecutionProcesses :
    intentInFlight[process] <= IntentProcessMaxInFlight[process]

IntentIdempotencyKeysAreExclusive ==
  \A process \in IntentIdempotentProcesses :
    Cardinality(intentActiveKeys[process]) = intentInFlight[process]

IntentTimeoutsBounded ==
  \A process \in IntentTimedProcesses :
    intentElapsed[process] <= IntentProcessTimeoutSteps[process]

IntentProcessConstructionIsAuthorized ==
  \A process \in IntentProcesses :
    /\ IntentProcessOutcomes[process] = IntentProcessConstructs[process]
    /\ \A outcome \in IntentProcessConstructs[process] :
      <<process, outcome>> \in IntentAuthorisedConstruction

IntentScenarioStepInputState(scenario, index) ==
  IF index = 1
    THEN IntentScenarioInitialState[scenario]
    ELSE IntentOutcomeState[IntentScenarioSteps[scenario][index - 1][2]]

IntentScenarioStepIsContinuous(scenario, index) ==
  LET step == IntentScenarioSteps[scenario][index] IN
    /\ step[1] \in IntentProcesses
    /\ step[2] \in IntentOutcomes
    /\ IntentProcessInput[step[1]] = IntentScenarioStepInputState(scenario, index)
    /\ step[2] \in IntentProcessOutcomes[step[1]]
    /\ <<IntentScenarioStepInputState(scenario, index), IntentOutcomeState[step[2]]>> \in IntentProcessTransitions[step[1]]

IntentScenarioTraceIsContinuous ==
  \A scenario \in IntentScenarios :
    /\ Len(IntentScenarioSteps[scenario]) > 0
    /\ \A index \in 1..Len(IntentScenarioSteps[scenario]) :
      IntentScenarioStepIsContinuous(scenario, index)
    /\ IntentOutcomeState[IntentScenarioSteps[scenario][Len(IntentScenarioSteps[scenario])][2]] = IntentScenarioExpectedState[scenario]

====
