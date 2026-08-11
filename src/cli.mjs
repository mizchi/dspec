#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CLAUSE_AST_SEMANTICS_VERSION,
  validateClauseAst,
} from "./core/clause-ast.mjs";
import {
  DbSchemaImportError,
  emitDbSchemaPkl,
  importDbSchema,
  normalizeSqlIdentifier,
  splitSqlList,
  splitSqlTopLevel,
  stripSqlComments,
} from "./core/db-schema-import.mjs";
import {
  dbColumnIds,
  dbColumnRefParts,
  dbInvariantMap,
  dbInvariants,
  dbMigrations,
  dbPattern,
  dbTableMap,
  dbTables,
  dbTransactions,
  validateDbModel,
} from "./core/db-model-validation.mjs";
import {
  cloudFlows,
  cloudNodes,
  cloudPattern,
  cloudPolicies,
  cloudZones,
  validateCloudModel,
} from "./core/cloud-model-validation.mjs";
import {
  dataFlows,
  dataPattern,
  dataPlacements,
  dataPolicies,
  dataSets,
  dataStores,
  validateDataModel,
} from "./core/data-model-validation.mjs";
import {
  releaseEnvironments,
  releaseGates,
  releaseMigrations,
  releasePattern,
  releaseRollbacks,
  releaseServices,
  releaseSteps,
  validateReleaseModel,
} from "./core/release-model-validation.mjs";
import {
  runtimeAlertPolicies,
  runtimeAlerts,
  runtimeDependencies,
  runtimeDependencyTraces,
  runtimeIntentExecutions,
  runtimePattern,
  runtimeRunbookExecutions,
  runtimeRunbooks,
  runtimeServices,
  runtimeSignals,
  runtimeSlos,
  runtimeTelemetry,
  validateRuntimeModel,
} from "./core/runtime-model-validation.mjs";
import { quintServerEndpoint, quintVerifyArgs, renderQuintModel } from "./core/quint.mjs";
import {
  conformanceReport,
  validateConformanceModel,
} from "./core/conformance.mjs";
import {
  querySpec,
  renderSpecQueryMarkdown,
  verifySpecAnswer,
} from "./core/spec-query.mjs";
import {
  ASSURANCE_EVIDENCE_SCHEMA_VERSION,
  assuranceDigest,
  assuranceEvidenceSnapshot,
  clauseBackendSupport,
  expressionOperators,
  verifyAssuranceEvidenceManifest,
} from "./core/assurance-evidence.mjs";
import {
  executeIntentRefinements,
  exerciseIntentExecutionPolicies,
  intentScenarioCorpusReport,
  intentTraceCoverage,
  intentTraceMutationReport,
  intentTraceSchema,
  verifyIntentTraces,
} from "./core/intent.mjs";
import {
  protocolTestPlan,
  validateProtocolTests,
} from "./core/protocol-tests.mjs";
import {
  domainRelationshipGraph,
  renderDomainRelationshipMermaid,
  validateDomainModel,
} from "./core/domain.mjs";
import {
  topLevelCommand as registryTopLevelCommand,
  topLevelCommandHelp as registryTopLevelCommandHelp,
  topLevelCommandRegistry as registryTopLevelCommandRegistry,
  usage as registryUsage,
} from "./commands/registry.mjs";
import { runDomainCommand as runDomainCommandModule } from "./commands/domain.mjs";
import { runGraphCommand as runGraphCommandModule } from "./commands/graph.mjs";
import { runDailyDriftCommand } from "./commands/daily-drift.mjs";
import { appProfileObservedFixtureStep as appProfileObservedFixtureStepModule } from "./commands/app-profile-observed-fixture.mjs";
import {
  parseAppProfileArgs as parseAppProfileArgsModule,
  parseAppProfileSuiteArgs as parseAppProfileSuiteArgsModule,
  parseEvaluateAppProfileArgs as parseEvaluateAppProfileArgsModule,
  parseScaffoldAppProfileArgs as parseScaffoldAppProfileArgsModule,
} from "./commands/app-profile-options.mjs";
import {
  renderScaffoldAppProfileDiffReport as renderScaffoldAppProfileDiffReportModule,
  scaffoldAppProfile as scaffoldAppProfileModule,
  scaffoldAppProfileApplyReport as scaffoldAppProfileApplyReportModule,
  scaffoldAppProfileDiffReport as scaffoldAppProfileDiffReportModule,
  scaffoldAppProfileDocument as scaffoldAppProfileDocumentModule,
} from "./commands/app-profile-scaffold.mjs";
import {
  renderAppChangeReplayMarkdownReport as renderAppChangeReplayMarkdownReportModule,
  renderAppChangeReplayReport as renderAppChangeReplayReportModule,
  renderAppProfileEvaluationMarkdownReport as renderAppProfileEvaluationMarkdownReportModule,
  renderAppProfileEvaluationReport as renderAppProfileEvaluationReportModule,
  renderAppProfileMarkdownReport as renderAppProfileMarkdownReportModule,
  renderAppProfileMutationScoreMarkdownReport as renderAppProfileMutationScoreMarkdownReportModule,
  renderAppProfileMutationScoreReport as renderAppProfileMutationScoreReportModule,
  renderAppProfileReport as renderAppProfileReportModule,
  renderAppProfileScenarioCoverageMarkdownReport as renderAppProfileScenarioCoverageMarkdownReportModule,
} from "./commands/app-profile-render.mjs";
import {
  renderIntentCoverageMarkdown as renderIntentCoverageMarkdownModule,
  renderIntentMutationMarkdown as renderIntentMutationMarkdownModule,
  renderIntentScenarioCorpusMarkdown as renderIntentScenarioCorpusMarkdownModule,
  renderIntentTraceMarkdown as renderIntentTraceMarkdownModule,
} from "./commands/intent-render.mjs";
import {
  persistIntentReport,
  writeIntentAnalysisReport as writeIntentAnalysisReportModule,
  writeIntentCommandReport as writeIntentCommandReportModule,
} from "./commands/intent-output.mjs";
import {
  DEFAULT_APP_PROFILE_GATES,
  appProfileCommandReport as appProfileCommandReportModule,
  appProfileGateSet as appProfileGateSetModule,
  appProfileImportStep as appProfileImportStepModule,
  appProfileReport as appProfileReportModule,
  appProfileSuiteReport as appProfileSuiteReportModule,
  appProfilesCommandReport as appProfilesCommandReportModule,
  appProfilesReport as appProfilesReportModule,
  appProfileStep as appProfileStepModule,
} from "./core/app-profile-report.mjs";
import { CommandError } from "./commands/error.mjs";
import {
  intentUsage as intentUsageModule,
  parseIntentAccessArgs as parseIntentAccessArgsModule,
  parseIntentBindingArgs as parseIntentBindingArgsModule,
  parseIntentGraphArgs as parseIntentGraphArgsModule,
  parseIntentProtocolTestArgs as parseIntentProtocolTestArgsModule,
  parseIntentTraceArgs as parseIntentTraceArgsModule,
} from "./commands/intent-options.mjs";
import {
  domainTraceabilityReport,
  renderDomainTraceabilityMarkdown,
} from "./core/traceability.mjs";
import { normalizeCounterexample } from "./core/counterexample.mjs";
import {
  verifyBehaviorImplementation,
  verifyBehaviorModel,
} from "./core/behavior.mjs";
import { verifyAlloyBehaviorModel, verifyAlloyBehaviorWithAnalyzer } from "./core/alloy-behavior.mjs";
import { verifyTetrisAlloyImplementation, verifyTetrisAlloyModel, verifyTetrisAlloyMutationWithAnalyzer, verifyTetrisAlloyWithAnalyzer } from "./core/tetris-alloy.mjs";
import { verifyTetrisLineClearAlloyModel, verifyTetrisLineClearAlloyWithAnalyzer } from "./core/tetris-line-clear-alloy.mjs";
import {
  RealAppCoreError,
  diffRealAppImportFacts,
  evaluateRealAppImport,
  importInfrastructureDocuments,
  infrastructureBindingId,
  infrastructureCloudNodeKind,
  infrastructureDataStore,
  infrastructureDependencyKind,
  infrastructureService,
  realAppImportFacts,
  realAppObservedDomain,
} from "./core/real-app.mjs";
import {
  externalHoldoutCorpusReport,
  externalHoldoutMutationReport,
  normalizeRealAppImportFacts,
  renderExternalHoldoutCorpusMarkdown,
} from "./core/external-holdouts.mjs";
import {
  createProjectionSnapshot,
  planProjectionChanges,
  projectionGenerateArgv,
  projectionPlanReport,
  projectionProvenanceDocument,
  projectionStableJson,
  validateProjectionContracts,
} from "./core/projection.mjs";
import {
  createTraceLock,
  traceCheck,
  traceSnapshot,
} from "./core/trace-lock.mjs";
import {
  createTranslationLock,
  translationCheck,
  translationSnapshot,
} from "./core/translation-lock.mjs";
import { applyProjectionTransaction, recoverProjectionLock } from "./projection-filesystem.mjs";
import { PklAdapterError, evaluatePklJson } from "./adapters/pkl.mjs";

// Compatibility anchors for rules that trace the public CLI contract to this
// executable. The registry itself is deliberately independent of the process
// entrypoint so command metadata can be tested without spawning the CLI.
function topLevelCommandRegistry() {
  return registryTopLevelCommandRegistry();
}

function topLevelCommand(name) {
  return registryTopLevelCommand(name);
}

function usage() {
  return registryUsage();
}

function topLevelCommandHelp(command) {
  return registryTopLevelCommandHelp(command);
}

function specChangeUsage() {
  return `usage:
  dspec spec-change compat [--json|--markdown] <before.pkl> <after.pkl>
  dspec spec-change scaffold [--json|--pkl] [--id <id>] [--output <review.pkl>] <before.pkl> <after.pkl>
  dspec spec-change review [--json|--markdown] <review.pkl>

Typical flow:
  dspec spec-change compat --json before.pkl after.pkl
  dspec spec-change scaffold --output review.pkl before.pkl after.pkl
  dspec spec-change review --json review.pkl
`;
}

function evidenceUsage() {
  return `usage:
  dspec evidence create [--json] [--output <manifest.json>] [--executed-at <iso>] [--intent-report <exercise.json>] [--require-formal-tools] <model.pkl>
  dspec evidence verify [--json] <model.pkl> <manifest.json>
  dspec evidence refresh [--json] [--executed-at <iso>] [--intent-report <exercise.json>] [--require-formal-tools] <model.pkl> <manifest.json>
`;
}

function generatedUsage() {
  return `usage:
  dspec generated check [--json] [--root <dir>] <model.pkl>
  dspec generated unlock [--json] [--force] [--root <dir>]
`;
}

function initUsage() {
  return `usage:
  dspec init [--json] [--force] [--output <model.pkl>] [--lock <lock.json>] [model.pkl]

Create a minimal Pkl model that imports this dspec package's Schema.pkl.

Options:
  --json                Emit the creation report as JSON.
  --force               Replace an existing output file.
  --output <model.pkl>  Select the output file (default: dspec.pkl).
  --lock <lock.json>    Select the schema lock file (default: <model>.lock.json).
`;
}

function lockUsage() {
  return `usage:
  dspec lock [--json] [--force] [--output <lock.json>] <model.pkl>

Record the imported Schema.pkl module graph and package metadata in a lock file.

Options:
  --json               Emit the lock report as JSON.
  --force              Replace an existing lock file.
  --output <lock.json> Select the lock file (default: <model>.lock.json).
`;
}

function traceUsage() {
  return `usage:
  dspec trace reconcile [--json] [--output <trace.lock.json>] <model.pkl>
  dspec trace check [--json] [--gate] [--diff] [--lock <trace.lock.json>] <model.pkl>

Materialize and compare a reviewed hash lock for Rule.id, its specification
content, and explicitly declared implementation/test/check references.

reconcile is the explicit approval step that replaces the trace lock.
check reports drift without failing by default; add --gate for CI or a hook.
--diff limits the gate to links whose source path is changed in the Git worktree.
coverage (uncovered, impl-only, test-only, verified) is reported separately
from hash drift.
`;
}

function translationUsage() {
  return `usage:
  dspec translation reconcile [--json] [--output <translation.lock.json>] <model.pkl>
  dspec translation check [--json] [--gate] [--lock <translation.lock.json>] <model.pkl>

Materialize and compare a reviewed source-to-translation lock for LocalizedText.

The model primaryLocale is the source language. i18n.requiredLocales selects
targets; when it is empty, every declared non-primary locale is a target.
reconcile is the explicit review step that replaces the translation lock.
check reports stale source/translation or terminology changes; add --gate for CI.
It detects freshness and required labels, not semantic equivalence of languages.
`;
}

function scaffoldUsage() {
  return `usage:
  dspec scaffold rule [--json] [--force] [--output <rule.pkl>] [--kind <kind>] [--term <id>] [--implementation <path#symbol>] [--test <path#anchor>] <model.pkl> <rule-id>

Emit a typed draft Rule fragment. The source model supplies its Schema.pkl import
and vocabulary; the command never edits the source model automatically.

Options:
  --json                           Emit the scaffold report as JSON.
  --force                          Replace an existing output file.
  --output <rule.pkl>              Write the Pkl fragment instead of stdout.
  --kind <kind>                    Rule kind (default: invariant).
  --term <id>                      Refer to an existing vocabulary term; repeatable.
  --implementation <path#symbol>  Add a code implementation reference.
  --test <path#anchor>             Add a linked Node test check target.
`;
}

function explainUsage() {
  return `usage:
  dspec explain [--json|--markdown] [--lock <lock.json>] [--require-lock] <model.pkl>

Run the verification gates and normalize failures into source-linked diagnostics.
`;
}

function traceabilityUsage() {
  return `usage:
  dspec traceability [--json|--markdown] [--gate] [--execute-formal-tools|--require-executed-formal-tools] <model.pkl>

Execute declared behavior and reference Alloy formalization targets, then
report the bidirectional Rule → formal action → Command/Event →
checker-evidence graph. --execute-formal-tools additionally runs Alloy 6 when
available; --require-executed-formal-tools makes unavailable or failed formal
tools fail the traceability result.
Without --gate, uncovered declarations produce status=attention but do not
fail the command. --gate makes every missing link or failed evidence result a
CI failure.
`;
}

function formalMutationUsage() {
  return `usage:
  dspec formal-mutation [--json] [--require-formal-tools] <alloy-model.pkl>

Execute the mutation suite declared by a supported formal model. A mutation
passes only when the original assertion has an Alloy counterexample. The first
supported model is dspec.TetrisAlloy.
`;
}

function runDomainCommand(args) {
  return runDomainCommandModule(args, {
    fail(message) {
      throw new CommandError(message);
    },
    loadModel,
    stableJson,
    validate,
    write(value) {
      process.stdout.write(value);
    },
  });
}

function runGraphCommand(args) {
  return runGraphCommandModule(args, {
    fail(message) {
      throw new CommandError(message);
    },
    loadModel,
    stableJson,
    validate,
    write(value) {
      process.stdout.write(value);
    },
  });
}

function specChangeCompatUsage() {
  return `usage:
  dspec spec-change compat [--json|--markdown] <before.pkl> <after.pkl>

Compare before/after spec models and classify the compatibility change.

Options:
  --json      Emit the compatibility report as JSON.
  --markdown  Emit a human-readable Markdown review report.
`;
}

function runDailyDrift(args) {
  return runDailyDriftCommand(args, {
    write(value) {
      process.stdout.write(value);
    },
    writeError(value) {
      process.stderr.write(value);
    },
    setExitCode(status) {
      process.exitCode = status;
    },
  });
}

const INTENT_FUNCTION_RUNNER = fileURLToPath(new URL("./adapters/intent-function-runner.mjs", import.meta.url));
const INTENT_TRANSACTION_RUNNER = fileURLToPath(new URL("./adapters/intent-transaction-runner.mjs", import.meta.url));

function intentAccessPolicyDecision(model, processId, subjectId) {
  const policies = intentAccessPolicies(intentPattern(model))
    .filter((policy) => policy.process === processId && policy.subject === subjectId)
    .slice()
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  return policies[0] ?? null;
}

function semanticBindingRecord(binding) {
  return {
    kind: binding.kind,
    target: binding.target,
    value: binding.value ?? null,
  };
}

function semanticBindingKey(binding) {
  const record = semanticBindingRecord(binding);
  return `${record.kind}\u0000${record.target}\u0000${record.value ?? ""}`;
}

function intentSemanticBindingReport(model, document) {
  const errors = validate(model);
  const observed = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    errors.push("invalid semantic binding observation document");
  } else {
    if (document.schemaVersion !== "1.0") {
      errors.push(`unsupported semantic binding schema version: ${document.schemaVersion ?? "missing"}`);
    }
    if (document.model?.id !== model.id) {
      errors.push(`semantic binding model id mismatch: expected ${model.id}, got ${document.model?.id ?? "missing"}`);
    }
    if (document.model?.version !== model.version) {
      errors.push(`semantic binding model version mismatch: expected ${model.version}, got ${document.model?.version ?? "missing"}`);
    }
    if (!Array.isArray(document.bindings)) {
      errors.push("semantic binding observation document bindings must be an array");
    } else {
      for (const [index, binding] of document.bindings.entries()) {
        if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
          errors.push(`invalid observed semantic binding at index ${index}`);
          continue;
        }
        if (typeof binding.kind !== "string" || binding.kind.length === 0) {
          errors.push(`observed semantic binding ${index} missing kind`);
          continue;
        }
        if (typeof binding.target !== "string" || binding.target.length === 0) {
          errors.push(`observed semantic binding ${index} missing target`);
          continue;
        }
        if (binding.value !== null && binding.value !== undefined && typeof binding.value !== "string") {
          errors.push(`observed semantic binding ${index} invalid value`);
          continue;
        }
        observed.push({ kind: binding.kind, target: binding.target, value: binding.value ?? null });
      }
    }
  }

  const expected = intentSemanticBindings(intentPattern(model)).slice().sort(byId);
  const expectedByKey = new Map(expected.map((binding) => [semanticBindingKey(binding), binding]));
  const observedKeys = new Set();
  for (const binding of observed) {
    const key = semanticBindingKey(binding);
    if (observedKeys.has(key)) errors.push(`duplicate observed semantic binding: ${binding.kind} ${binding.target}`);
    observedKeys.add(key);
  }
  const missing = expected.filter((binding) => binding.required !== false && !observedKeys.has(semanticBindingKey(binding)));
  const unmodeled = observed
    .filter((binding) => !expectedByKey.has(semanticBindingKey(binding)))
    .sort((left, right) => semanticBindingKey(left).localeCompare(semanticBindingKey(right)));
  for (const binding of missing) errors.push(`missing required semantic binding: ${binding.id}`);
  for (const binding of unmodeled) errors.push(`unmodeled observed semantic binding: ${binding.kind} ${binding.target}`);

  const matched = expected.filter((binding) => observedKeys.has(semanticBindingKey(binding))).length;
  return {
    model: { id: model.id, version: model.version },
    status: errors.length === 0 ? "pass" : "fail",
    summary: {
      matched,
      missing: missing.length,
      observed: observed.length,
      required: expected.filter((binding) => binding.required !== false).length,
      unmodeled: unmodeled.length,
    },
    missing: missing.map((binding) => ({ id: binding.id, ...semanticBindingRecord(binding) })),
    unmodeled,
    errors,
  };
}

function renderIntentSemanticBindingMarkdown(report) {
  const lines = [
    `# Intent Semantic Bindings ${report.model.id}`,
    "",
    `- status: \`${report.status}\``,
    `- matched: \`${report.summary.matched}/${report.summary.required}\` required bindings`,
  ];
  if (report.missing.length > 0) {
    lines.push("", "## Missing", "");
    for (const binding of report.missing) lines.push(`- ${binding.id}: ${binding.kind} ${binding.target}${binding.value === null ? "" : ` = ${binding.value}`}`);
  }
  if (report.unmodeled.length > 0) {
    lines.push("", "## Unmodeled", "");
    for (const binding of report.unmodeled) lines.push(`- ${binding.kind} ${binding.target}${binding.value === null ? "" : ` = ${binding.value}`}`);
  }
  if (report.errors.length > 0) {
    lines.push("", "## Errors", "");
    for (const error of report.errors) lines.push(`- ${error}`);
  }
  return `${lines.join("\n")}\n`;
}

function intentClaimTaskCoverage(intent) {
  const covered = new Map();
  for (const task of intentAssuranceTasks(intent)) {
    for (const claimId of list(task.claims)) {
      covered.set(claimId, [...(covered.get(claimId) ?? []), task.id]);
    }
  }
  return covered;
}

function intentClaimBindingCoverage(intent) {
  const covered = new Map();
  for (const binding of intentSemanticBindings(intent)) {
    for (const claimId of list(binding.claims)) {
      covered.set(claimId, [...(covered.get(claimId) ?? []), binding.id]);
    }
  }
  return covered;
}

function intentGraphReport(model) {
  const errors = validate(model);
  const intent = intentPattern(model);
  const goals = intentGoals(intent).slice().sort(byId);
  const claims = intentClaims(intent).slice().sort(byId);
  const tasks = intentAssuranceTasks(intent).slice().sort(byId);
  const bindings = intentSemanticBindings(intent).slice().sort(byId);
  const taskCoverage = intentClaimTaskCoverage(intent);
  const bindingCoverage = intentClaimBindingCoverage(intent);
  const implementationCoveredClaims = claims.filter((claim) => claim.requiredImplementationBinding === false || bindingCoverage.has(claim.id));

  return {
    model: { id: model.id, version: model.version },
    status: errors.length === 0 ? "pass" : "fail",
    summary: {
      bindings: bindings.length,
      claims: claims.length,
      formalTasks: tasks.filter((task) => task.kind === "formal-model").length,
      goals: goals.length,
      implementationCoveredClaims: implementationCoveredClaims.length,
      intents: new Set(goals.flatMap((goal) => list(goal.intents))).size,
      taskCoveredClaims: claims.filter((claim) => taskCoverage.has(claim.id)).length,
      tasks: tasks.length,
    },
    goals: goals.map((goal) => ({
      id: goal.id,
      priority: goal.priority,
      intents: list(goal.intents).slice().sort(),
      claims: list(goal.claims).slice().sort(),
      nonGoals: list(goal.nonGoals).length,
    })),
    claims: claims.map((claim) => ({
      id: claim.id,
      kind: claim.kind,
      processes: list(claim.processes).slice().sort(),
      requiredImplementationBinding: claim.requiredImplementationBinding !== false,
      tasks: list(taskCoverage.get(claim.id)).slice().sort(),
      bindings: list(bindingCoverage.get(claim.id)).slice().sort(),
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      claims: list(task.claims).slice().sort(),
      kind: task.kind,
      backend: task.backend,
      assurance: task.assurance,
      target: { kind: task.target.kind, path: task.target.path, symbol: task.target.symbol ?? null },
      assumptions: list(task.assumptions).slice().sort(),
    })),
    bindings: bindings.map((binding) => ({
      id: binding.id,
      claims: list(binding.claims).slice().sort(),
      kind: binding.kind,
      process: binding.process,
      refinement: binding.refinement ?? null,
      target: binding.target,
      value: binding.value ?? null,
    })),
    ...(errors.length > 0 ? { errors } : {}),
  };
}

function renderIntentGraphMarkdown(report, model, locale) {
  const intent = intentPattern(model);
  const goalsById = new Map(intentGoals(intent).map((goal) => [goal.id, goal]));
  const claimsById = new Map(intentClaims(intent).map((claim) => [claim.id, claim]));
  const tasksById = new Map(intentAssuranceTasks(intent).map((task) => [task.id, task]));
  const lines = [
    `# Intent Goal Graph ${report.model.id}`,
    "",
    `- status: \`${report.status}\``,
    `- goals: \`${report.summary.goals}\``,
    `- claims: \`${report.summary.claims}\``,
    `- tasks: \`${report.summary.tasks}\``,
    `- bindings: \`${report.summary.bindings}\``,
  ];
  for (const goal of report.goals) {
    const source = goalsById.get(goal.id);
    lines.push("", `### Goal ${goal.id}`, "");
    if (source?.text) lines.push(text(source.text, locale), "");
    lines.push(`- intents: ${goal.intents.map((id) => `\`${id}\``).join(", ") || "none"}`, `- claims: ${goal.claims.map((id) => `\`${id}\``).join(", ") || "none"}`);
    for (const nonGoal of list(source?.nonGoals)) lines.push(`- non-goal: ${text(nonGoal, locale)}`);
  }
  for (const claim of report.claims) {
    const source = claimsById.get(claim.id);
    lines.push("", `### Claim ${claim.id}`, "");
    if (source?.text) lines.push(text(source.text, locale), "");
    lines.push(`- kind: \`${claim.kind}\``, `- processes: ${claim.processes.map((id) => `\`${id}\``).join(", ") || "none"}`, `- tasks: ${claim.tasks.map((id) => `\`${id}\``).join(", ") || "none"}`, `- bindings: ${claim.bindings.map((id) => `\`${id}\``).join(", ") || "none"}`, `- implementation binding required: \`${claim.requiredImplementationBinding}\``);
  }
  for (const task of report.tasks) {
    const source = tasksById.get(task.id);
    lines.push("", `### Assurance Task ${task.id}`, "");
    if (source?.text) lines.push(text(source.text, locale), "");
    lines.push(`- kind: \`${task.kind}\``, `- backend: \`${task.backend}\``, `- assurance: \`${task.assurance}\``, `- claims: ${task.claims.map((id) => `\`${id}\``).join(", ") || "none"}`, `- target: \`${task.target.kind} ${task.target.path}${task.target.symbol ? `#${task.target.symbol}` : ""}\``);
    for (const assumption of task.assumptions) lines.push(`- assumption: ${assumption}`);
  }
  if (report.errors?.length > 0) lines.push("", "## Errors", "", ...report.errors.map((error) => `- ${error}`));
  return `${lines.join("\n")}\n`;
}

function appendIntentGoalGraphMarkdown(lines, intent, locale) {
  for (const goal of intentGoals(intent).sort(byId)) {
    lines.push(`### Goal ${goal.id}`);
    lines.push("");
    lines.push(text(goal.text, locale));
    lines.push("");
    lines.push(`- priority: \`${goal.priority}\``);
    for (const processId of list(goal.intents).sort()) {
      lines.push(`- intent: \`${processId}\``);
    }
    for (const claimId of list(goal.claims).sort()) {
      lines.push(`- claim: \`${claimId}\``);
    }
    for (const nonGoal of list(goal.nonGoals)) {
      lines.push(`- non-goal: ${text(nonGoal, locale)}`);
    }
    lines.push("");
  }

  for (const claim of intentClaims(intent).sort(byId)) {
    lines.push(`### Claim ${claim.id}`);
    lines.push("");
    lines.push(text(claim.text, locale));
    lines.push("");
    lines.push(`- kind: \`${claim.kind}\``);
    for (const processId of list(claim.processes).sort()) {
      lines.push(`- process: \`${processId}\``);
    }
    lines.push(`- implementation binding required: \`${claim.requiredImplementationBinding !== false}\``);
    lines.push("");
  }

  for (const task of intentAssuranceTasks(intent).sort(byId)) {
    lines.push(`### Assurance Task ${task.id}`);
    lines.push("");
    lines.push(text(task.text, locale));
    lines.push("");
    lines.push(`- kind: \`${task.kind}\``);
    lines.push(`- backend: \`${task.backend}\``);
    lines.push(`- assurance: \`${task.assurance}\``);
    for (const claimId of list(task.claims).sort()) {
      lines.push(`- claim: \`${claimId}\``);
    }
    const symbol = task.target.symbol ? `#${task.target.symbol}` : "";
    lines.push(`- target: ${task.target.kind} ${task.target.path}${symbol}`);
    for (const assumption of list(task.assumptions)) {
      lines.push(`- assumption: ${assumption}`);
    }
    lines.push("");
  }
}

function intentOutputContext() {
  return {
    stableJson,
    digest: assuranceDigest,
    write(value) {
      process.stdout.write(value);
    },
  };
}

function intentTraceVerificationReport(model, traceDocument) {
  return verifyIntentTraces(model, traceDocument, {
    staticErrors: validate(model),
    refinementErrors: validateDrift(model).errors,
  });
}

function attachIntentTraceDocumentEvidence(report, model, traceFile) {
  report.evidence.document = {
    path: traceFile,
    digest: assuranceDigest(readFileSync(resolve(traceFile), "utf8")),
    modelDigest: assuranceDigest(model),
  };
  return report;
}

function generatedProtocolTraceReport(model, plan) {
  const report = intentTraceVerificationReport(model, plan.traceDocument);
  report.evidence.document = {
    kind: "generated-protocol-test-plan",
    digest: assuranceDigest(plan.traceDocument),
    planDigest: assuranceDigest(plan),
    modelDigest: assuranceDigest(model),
  };
  report.evidence.assumptions = [
    ...report.evidence.assumptions,
    "protocol test traces are generated from reviewed finite IntentProtocolTest cases; they do not prove behavior outside those cases",
  ];
  return report;
}

function intentImplementationPath(modelFile, implementation) {
  const candidates = [
    resolve(implementation.path),
    resolve(dirname(resolve(modelFile)), implementation.path),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function nodePermissionReadRoots(modelFile, implementationPath) {
  return [...new Set([
    resolve(process.cwd()),
    dirname(resolve(modelFile)),
    dirname(implementationPath),
  ])].sort();
}

function intentInvocationTimeoutMs(context, fallbackTimeoutMs) {
  const declared = context?.process?.execution?.timeoutMs;
  return Number.isInteger(declared) && declared > 0 ? declared : fallbackTimeoutMs;
}

function invokeIntentChild(args, request, timeoutMs, label) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ["pipe", "ignore", "pipe", "pipe"],
    });
    let settled = false;
    let timedOut = false;
    let stderr = "";
    let raw = "";
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const reportStream = child.stdio[3];
    reportStream.setEncoding("utf8");
    reportStream.on("data", (chunk) => { raw += chunk; });
    child.on("error", (error) => settle(() => rejectPromise(error)));
    child.on("close", () => settle(() => {
      if (timedOut) {
        rejectPromise(new Error(`execution timed out after ${timeoutMs}ms`));
        return;
      }
      let report;
      try {
        report = JSON.parse(raw.trim());
      } catch {
        rejectPromise(new Error(`${label} produced no valid report${stderr.trim() ? `: ${stderr.trim()}` : ""}`));
        return;
      }
      if (report.status !== "pass") {
        rejectPromise(new Error(report.error ?? `${label} failed`));
        return;
      }
      resolvePromise(report);
    }));
    child.stdin.end(JSON.stringify(request));
  });
}

function invokeExternalJson(command, args, request, timeoutMs, label) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let settled = false;
    let timedOut = false;
    let stdout = "";
    let stderr = "";
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => settle(() => rejectPromise(error)));
    child.on("close", (code) => settle(() => {
      if (timedOut) {
        rejectPromise(new Error(`${label} timed out after ${timeoutMs}ms`));
        return;
      }
      if (code !== 0) {
        rejectPromise(new Error(`${label} exited with status ${code}${stderr.trim() ? `: ${stderr.trim()}` : ""}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout.trim()));
      } catch {
        rejectPromise(new Error(`${label} produced no valid JSON response${stderr.trim() ? `: ${stderr.trim()}` : ""}`));
      }
    }));
    child.stdin.end(JSON.stringify(request));
  });
}

function intentRefinementInvoker(modelFile, { timeoutMs, httpBaseUrl, grpcRunner = null }) {
  const implementations = new Map();
  const registerImplementation = (refinement, adapter, details = {}) => {
    const implementation = refinement.implementation;
    const path = intentImplementationPath(modelFile, implementation);
    const implementationKey = `${refinement.id}\u0000${adapter}\u0000${path}\u0000${implementation.symbol}`;
    if (!implementations.has(implementationKey)) {
      implementations.set(implementationKey, {
        refinement: refinement.id,
        adapter,
        kind: implementation.kind,
        path: implementation.path,
        symbol: implementation.symbol,
        digest: existsSync(path) ? fileDigest(path) : null,
        ...details,
      });
    }
    return path;
  };
  const invokeFunction = async (refinement, input, context) => {
    const implementation = refinement.implementation;
    if (!implementation || !["code", "test"].includes(implementation.kind)) {
      throw new Error(`Intent function refinement must use a code or test reference: ${refinement.id}`);
    }
    const path = registerImplementation(refinement, "node-permission-child-process");
    const readRoots = nodePermissionReadRoots(modelFile, path);
    const report = await invokeIntentChild(
      [
        "--permission",
        ...readRoots.map((root) => `--allow-fs-read=${root}`),
        INTENT_FUNCTION_RUNNER,
        path,
        implementation.symbol,
      ],
      { input },
      intentInvocationTimeoutMs(context, timeoutMs),
      "isolated runner",
    );
    return report.output;
  };
  const invokeHttpRoute = async (refinement, input, context) => {
    const implementation = refinement.implementation;
    const endpoint = refinement.http;
    if (!implementation || !endpoint) throw new Error(`Intent HTTP refinement requires implementation and http endpoint: ${refinement.id}`);
    if (!httpBaseUrl) throw new Error(`HTTP route execution requires --http-base-url: ${refinement.id}`);
    const path = registerImplementation(refinement, "http-fetch", {
      endpoint: {
        method: endpoint.method,
        path: endpoint.path,
        expectedStatus: endpoint.expectedStatus,
      },
    });
    if (!existsSync(path)) throw new Error(`Intent HTTP refinement implementation is missing: ${implementation.path}`);
    const url = new URL(endpoint.path, httpBaseUrl);
    let body = input === undefined ? null : JSON.stringify(input);
    if (endpoint.method === "GET") {
      for (const [key, value] of Object.entries(input && typeof input === "object" && !Array.isArray(input) ? input : {}).sort(([left], [right]) => left.localeCompare(right))) {
        if (value !== null && value !== undefined) url.searchParams.append(key, String(value));
      }
      body = null;
    }
    const controller = new AbortController();
    const invocationTimeoutMs = intentInvocationTimeoutMs(context, timeoutMs);
    const timer = setTimeout(() => controller.abort(), invocationTimeoutMs);
    let response;
    try {
      response = await fetch(url, {
        method: endpoint.method,
        headers: body === null ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
        ...(body === null ? {} : { body }),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`HTTP request timed out after ${invocationTimeoutMs}ms`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
    const expectedStatus = context?.expectedTransport?.expectedStatus ?? endpoint.expectedStatus;
    if (response.status !== expectedStatus) {
      throw new Error(`HTTP ${endpoint.method} ${endpoint.path} expected status ${expectedStatus}, got ${response.status}`);
    }
    const responseBody = await response.text();
    if (responseBody.length === 0) return null;
    try {
      return JSON.parse(responseBody);
    } catch {
      throw new Error(`HTTP ${endpoint.method} ${endpoint.path} returned invalid JSON`);
    }
  };
  const invokeGrpcMethod = async (refinement, input, context) => {
    const implementation = refinement.implementation;
    const endpoint = refinement.grpc;
    if (!implementation || !endpoint) throw new Error(`Intent gRPC refinement requires implementation and grpc endpoint: ${refinement.id}`);
    if (!grpcRunner) throw new Error(`gRPC method execution requires --grpc-runner: ${refinement.id}`);
    const runnerPath = resolve(grpcRunner);
    if (!existsSync(runnerPath)) throw new Error(`gRPC runner is missing: ${grpcRunner}`);
    const sourcePath = registerImplementation(refinement, "grpc-external-runner", {
      endpoint: {
        method: endpoint.method,
        expectedCode: endpoint.expectedCode,
      },
      runner: grpcRunner,
    });
    if (!existsSync(sourcePath)) throw new Error(`Intent gRPC refinement implementation is missing: ${implementation.path}`);
    const invocationTimeoutMs = intentInvocationTimeoutMs(context, timeoutMs);
    const isNodeScript = /\.(?:[cm]?js)$/i.test(runnerPath);
    const response = await invokeExternalJson(
      isNodeScript ? process.execPath : runnerPath,
      isNodeScript ? [runnerPath] : [],
      {
        protocol: "dspec-grpc-runner-v1",
        method: endpoint.method,
        input,
        timeoutMs: invocationTimeoutMs,
      },
      invocationTimeoutMs,
      "gRPC runner",
    );
    if (!response || typeof response !== "object" || Array.isArray(response)) {
      throw new Error("gRPC runner returned an invalid response record");
    }
    const expectedCode = context?.expectedTransport?.expectedCode ?? endpoint.expectedCode;
    if (response.code !== expectedCode) {
      throw new Error(`gRPC ${endpoint.method} expected code ${expectedCode}, got ${response.code ?? "missing"}`);
    }
    if (!("output" in response)) throw new Error(`gRPC ${endpoint.method} response is missing output`);
    return response.output;
  };
  const invokeTransaction = async (refinement, input, context) => {
    const implementation = refinement.implementation;
    const endpoint = refinement.transaction;
    if (!implementation || !["code", "test"].includes(implementation.kind)) {
      throw new Error(`Intent transaction refinement must use a code or test reference: ${refinement.id}`);
    }
    if (!endpoint) throw new Error(`Intent transaction refinement requires transaction endpoint: ${refinement.id}`);
    const dbTransaction = dbTransactions(dbPattern(context?.model)).find((candidate) => candidate.id === endpoint.dbTransaction);
    if (!dbTransaction) throw new Error(`Intent transaction refinement references unknown DB transaction: ${endpoint.dbTransaction}`);
    const path = registerImplementation(refinement, "node-transaction-journal-child-process", {
      transaction: {
        dbTransaction: endpoint.dbTransaction,
        isolation: endpoint.isolation,
      },
    });
    const readRoots = nodePermissionReadRoots(modelFile, path);
    const report = await invokeIntentChild(
      [
        "--permission",
        ...readRoots.map((root) => `--allow-fs-read=${root}`),
        INTENT_TRANSACTION_RUNNER,
        path,
        implementation.symbol,
      ],
      {
        input,
        transaction: {
          id: dbTransaction.id,
          isolation: endpoint.isolation,
          reads: list(dbTransaction.reads),
          writes: list(dbTransaction.writes),
          effects: list(context?.outcome?.effects).map((effect) => effect.id),
        },
      },
      intentInvocationTimeoutMs(context, timeoutMs),
      "transaction runner",
    );
    return {
      __dspecIntentExecution: true,
      output: report.output,
      effects: report.transaction?.effects ?? [],
      transaction: report.transaction ?? null,
    };
  };
  const invoke = async (refinement, input, context) => {
    if (refinement.kind === "function") return invokeFunction(refinement, input, context);
    if (refinement.kind === "http-route") return invokeHttpRoute(refinement, input, context);
    if (refinement.kind === "grpc-method") return invokeGrpcMethod(refinement, input, context);
    if (refinement.kind === "transaction") return invokeTransaction(refinement, input, context);
    throw new Error(`Intent refinement cannot be exercised: ${refinement.id} (${refinement.kind})`);
  };
  return {
    invoke,
    evidence() {
      const records = [...implementations.values()].sort((left, right) => left.refinement.localeCompare(right.refinement));
      const adapters = [...new Set(records.map((record) => record.adapter))].sort();
      const runner = adapters.length === 1 ? adapters[0] ?? "none" : "mixed";
      return {
        runner,
        invocation: "per-case",
        timeoutMs,
        node: process.version,
        ...(adapters.some((adapter) => ["node-permission-child-process", "node-transaction-journal-child-process"].includes(adapter)) ? {
          permissions: {
            fsRead: "model-and-implementation-roots",
            fsWrite: false,
            childProcess: false,
            worker: false,
            network: "not-enforced",
          },
        } : {}),
        implementations: records,
      };
    },
  };
}

async function runIntentCommand(args) {
  const [subcommand, ...rest] = args;
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    process.stdout.write(intentUsageModule());
    return;
  }
  if (subcommand === "schema") {
    if (rest.length !== 1 || rest[0].startsWith("-")) throw new CommandError(intentUsageModule());
    process.stdout.write(stableJson(intentTraceSchema(loadModel(rest[0]))));
    return;
  }
  if (subcommand === "generate-tests") {
    const options = parseIntentProtocolTestArgsModule(rest, subcommand);
    const model = loadModel(options.modelFile);
    const plan = protocolTestPlan(model);
    const modelErrors = validate(model);
    const errors = [...new Set([...modelErrors, ...plan.errors])].sort();
    const report = {
      ...plan,
      status: errors.length === 0 ? "pass" : "fail",
      errors,
    };
    if (options.outputFile) report.output = persistIntentReport(options.outputFile, report, intentOutputContext());
    if (options.json) process.stdout.write(stableJson(report));
    else process.stdout.write(`ok: ${model.id} protocol test plan (${plan.summary.cases} cases)\n`);
    if (report.status === "fail") throw new CommandError("intent protocol test generation failed\n");
    return;
  }
  if (subcommand === "test") {
    const options = parseIntentProtocolTestArgsModule(rest, subcommand);
    const model = loadModel(options.modelFile);
    const plan = protocolTestPlan(model);
    const traceReport = generatedProtocolTraceReport(model, plan);
    const runner = intentRefinementInvoker(options.modelFile, options);
    const preconditionErrors = plan.summary.cases === 0 ? ["protocol test plan has no cases"] : [];
    const exercise = traceReport.status === "pass" && plan.status === "pass" && preconditionErrors.length === 0
      ? await executeIntentRefinements(model, plan.traceDocument, runner.invoke)
      : {
        status: "skip",
        summary: { executedRefinements: 0 },
        executions: [],
        errors: [],
        reason: preconditionErrors[0] ?? "protocol test plan validation failed",
      };
    const errors = [...new Set([...traceReport.errors, ...plan.errors, ...preconditionErrors, ...exercise.errors])].sort();
    const report = {
      ...traceReport,
      executedAt: new Date().toISOString(),
      status: errors.length === 0 ? "pass" : "fail",
      summary: { ...traceReport.summary, ...plan.summary, executedRefinements: exercise.summary.executedRefinements },
      protocolTestPlan: {
        schemaVersion: plan.protocolTestPlanSchemaVersion,
        summary: plan.summary,
        operations: plan.operations,
        errors: plan.errors,
      },
      executions: exercise.executions,
      evidence: {
        ...traceReport.evidence,
        assumptions: [
          ...traceReport.evidence.assumptions,
          "the selected HTTP endpoint or gRPC runner is trusted to represent the target test or staging deployment",
        ],
        execution: runner.evidence(),
        checks: [
          ...traceReport.evidence.checks,
          {
            id: "intent-generated-protocol-plan",
            scope: "protocol-test-plan",
            status: plan.status === "pass" && preconditionErrors.length === 0 ? "pass" : "fail",
            errors: [...plan.errors, ...preconditionErrors],
          },
          {
            id: "intent-executed-refinement",
            scope: "refinement-execution",
            status: exercise.status,
            errors: exercise.errors,
            ...(exercise.reason ? { reason: exercise.reason } : {}),
          },
        ],
      },
      errors,
    };
    writeIntentCommandReportModule(report, options, renderIntentTraceMarkdownModule, `ok: ${model.id} generated protocol tests (${exercise.summary.executedRefinements}/${plan.summary.cases} cases)\n`, intentOutputContext());
    return;
  }
  if (subcommand === "access") {
    const options = parseIntentAccessArgsModule(rest);
    const model = loadModel(options.modelFile);
    const errors = validate(model);
    const intentProcess = intentProcesses(intentPattern(model)).find((candidate) => candidate.id === options.process);
    const subject = list(model.vocabulary).find((candidate) => candidate.id === options.subject);
    if (!intentProcess) errors.push(`unknown intent access process: ${options.process}`);
    if (!subject || !["actor", "role"].includes(subject.kind)) {
      errors.push(`intent access subject must be an actor or role: ${options.subject}`);
    }
    const policy = intentProcess && subject ? intentAccessPolicyDecision(model, options.process, options.subject) : null;
    const report = {
      decision: policy?.decision ?? "unspecified",
      model: { id: model.id, version: model.version },
      policy: policy
        ? { id: policy.id, overrides: list(policy.overrides).slice().sort(), priority: policy.priority }
        : null,
      process: options.process,
      status: errors.length === 0 ? "pass" : "fail",
      subject: options.subject,
      ...(errors.length > 0 ? { errors } : {}),
    };
    if (options.json) process.stdout.write(stableJson(report));
    else process.stdout.write(`ok: ${model.id} intent access ${options.process} ${options.subject} -> ${report.decision}\n`);
    if (errors.length > 0) throw new CommandError("intent access resolution failed\n");
    return;
  }
  if (subcommand === "bindings") {
    const options = parseIntentBindingArgsModule(rest);
    const model = loadModel(options.modelFile);
    const report = intentSemanticBindingReport(model, readJsonFile(options.observedFile, "semantic binding observation document"));
    if (options.json) process.stdout.write(stableJson(report));
    else if (options.markdown) process.stdout.write(renderIntentSemanticBindingMarkdown(report));
    else process.stdout.write(report.status === "pass" ? `ok: ${model.id} semantic bindings (${report.summary.matched}/${report.summary.required})\n` : renderIntentSemanticBindingMarkdown(report));
    if (report.status === "fail") throw new CommandError("intent semantic binding drift detected\n");
    return;
  }
  if (subcommand === "graph") {
    const options = parseIntentGraphArgsModule(rest);
    const model = loadModel(options.modelFile);
    const report = intentGraphReport(model);
    const locale = options.locale ?? model.primaryLocale;
    if (options.json) process.stdout.write(stableJson(report));
    else if (options.markdown) process.stdout.write(renderIntentGraphMarkdown(report, model, locale));
    else process.stdout.write(report.status === "pass"
      ? `ok: ${report.model.id} intent graph (${report.summary.goals} goals, ${report.summary.claims} claims)\n`
      : renderIntentGraphMarkdown(report, model, locale));
    if (report.status === "fail") throw new CommandError("intent goal graph validation failed\n");
    return;
  }
  if (!["verify", "exercise", "corpus", "coverage", "mutation"].includes(subcommand)) throw new CommandError(`unknown intent subcommand: ${subcommand}\n${intentUsageModule()}`);
  const options = parseIntentTraceArgsModule(rest, subcommand);
  const model = loadModel(options.modelFile);
  const traceDocument = readJsonFile(options.traceFile, "intent trace document");
  const traceReport = attachIntentTraceDocumentEvidence(intentTraceVerificationReport(model, traceDocument), model, options.traceFile);
  if (subcommand === "verify") {
    writeIntentCommandReportModule(traceReport, options, renderIntentTraceMarkdownModule, `ok: ${model.id} intent traces (${traceReport.summary.traces} traces, ${traceReport.summary.steps} steps)\n`, intentOutputContext());
    return;
  }
  const verificationOptions = {
    staticErrors: validate(model),
    refinementErrors: validateDrift(model).errors,
  };
  if (subcommand === "corpus") {
    const report = intentScenarioCorpusReport(model, traceDocument, verificationOptions);
    report.document = traceReport.evidence.document;
    writeIntentAnalysisReportModule(report, options, renderIntentScenarioCorpusMarkdownModule, `ok: ${model.id} intent scenario corpus (${report.summary.covered}/${report.summary.required} required scenarios)\n`, intentOutputContext());
    return;
  }
  if (subcommand === "coverage") {
    const report = intentTraceCoverage(model, traceDocument, verificationOptions);
    report.document = traceReport.evidence.document;
    writeIntentAnalysisReportModule(report, options, renderIntentCoverageMarkdownModule, `ok: ${model.id} intent trace coverage (${report.summary.covered}/${report.summary.targets} targets)\n`, intentOutputContext());
    return;
  }
  if (subcommand === "mutation") {
    const report = intentTraceMutationReport(model, traceDocument, verificationOptions);
    report.document = traceReport.evidence.document;
    writeIntentAnalysisReportModule(report, options, renderIntentMutationMarkdownModule, `ok: ${model.id} intent trace mutations (${report.detected}/${report.generated} detected)\n`, intentOutputContext());
    return;
  }
  const runner = intentRefinementInvoker(options.modelFile, options);
  const exercise = traceReport.status === "pass"
    ? await executeIntentRefinements(model, traceDocument, runner.invoke)
    : { status: "skip", summary: { executedRefinements: 0 }, executions: [], errors: [], reason: "intent trace verification failed" };
  const executionPolicy = options.policy
    ? (traceReport.status === "pass" && exercise.status === "pass"
      ? await exerciseIntentExecutionPolicies(model, traceDocument, runner.invoke)
      : {
        status: "skip",
        summary: { policies: 0, replays: 0 },
        observations: [],
        errors: [],
        reason: exercise.status === "fail" ? "refinement execution failed" : "intent trace verification failed",
      })
    : null;
  const errors = [...traceReport.errors, ...exercise.errors, ...list(executionPolicy?.errors)];
  const report = {
    ...traceReport,
    executedAt: new Date().toISOString(),
    status: errors.length === 0 ? "pass" : "fail",
    summary: { ...traceReport.summary, executedRefinements: exercise.summary.executedRefinements },
    executions: exercise.executions,
    ...(executionPolicy ? { executionPolicy } : {}),
    evidence: {
      ...traceReport.evidence,
      ...(executionPolicy ? {
        assumptions: [
          ...traceReport.evidence.assumptions,
          "Execution-policy replay records client-side pressure and finite output/effect consistency; it does not prove an implementation's internal queue, distributed idempotency store, DB isolation, or deployed capacity.",
        ],
      } : {}),
      execution: runner.evidence(),
      checks: [
        ...traceReport.evidence.checks,
        {
          id: "intent-executed-refinement",
          scope: "refinement-execution",
          status: exercise.status,
          errors: exercise.errors,
          ...(exercise.reason ? { reason: exercise.reason } : {}),
        },
        ...(executionPolicy ? [{
          id: "intent-execution-policy-observation",
          scope: "execution-policy",
          status: executionPolicy.status,
          errors: executionPolicy.errors,
          ...(executionPolicy.reason ? { reason: executionPolicy.reason } : {}),
        }] : []),
      ],
    },
    errors,
  };
  writeIntentCommandReportModule(report, options, renderIntentTraceMarkdownModule, `ok: ${model.id} intent refinement exercise (${exercise.summary.executedRefinements} cases)\n`, intentOutputContext());
}

function specChangeReviewUsage() {
  return `usage:
  dspec spec-change review [--json|--markdown] <review.pkl>

Run a typed SpecChangeReview Pkl plan as one spec-change gate.

Options:
  --json      Emit the review report as JSON.
  --markdown  Emit a human-readable Markdown review report.
`;
}

function scaffoldSpecChangeReviewUsage() {
  return `usage:
  dspec spec-change scaffold [--json|--pkl] [--id <id>] [--output <review.pkl>] <before.pkl> <after.pkl>

Generate a typed SpecChangeReview Pkl draft from before/after models.

Options:
  --json                 Emit the scaffold report as JSON.
  --pkl                  Emit the Pkl draft. This is the default without --output.
  --id <id>              Override the generated review id.
  --output <review.pkl>  Write the draft to a file. Schema and model paths are resolved relative to this destination.

Examples:
  dspec spec-change scaffold fixtures/compat-before.pkl fixtures/compat-narrowing-after.pkl
  dspec spec-change scaffold --output fixtures/my-review.pkl fixtures/before.pkl fixtures/after.pkl
  dspec spec-change scaffold --json fixtures/compat-before.pkl fixtures/compat-breaking-after.pkl

For breaking changes, the draft declares the default breaking evidence policy
and leaves evidence empty so spec-change review can force migration,
deprecation, rollout, and owner-approval evidence before approval.
`;
}

function evalPklJson(file) {
  try {
    return evaluatePklJson(file);
  } catch (error) {
    if (error instanceof PklAdapterError) {
      throw new CommandError(error.message, error.status);
    }
    throw error;
  }
}

function loadModel(file) {
  const document = evalPklJson(file);
  if (!document || typeof document !== "object" || !document.model) {
    throw new CommandError(`missing top-level model: ${file}`);
  }
  return { ...document.model, projections: list(document.projections) };
}

function loadTraceDocument(file) {
  const document = evalPklJson(file);
  if (!document || typeof document !== "object" || !document.model) {
    throw new CommandError(`missing top-level model: ${file}`);
  }
  return { ...document, model: { ...document.model, projections: list(document.projections) } };
}

function loadAppProfile(file) {
  const document = evalPklJson(file);
  if (!document || typeof document !== "object" || !document.profile) {
    throw new CommandError(`missing top-level profile: ${file}`);
  }
  return document.profile;
}

function loadAppProfileSuite(file) {
  const document = evalPklJson(file);
  if (!document || typeof document !== "object" || !document.suite) {
    throw new CommandError(`missing top-level suite: ${file}`);
  }
  return document.suite;
}

function loadAppProfileChangeReplayCorpus(file) {
  const document = evalPklJson(file);
  if (!document || typeof document !== "object" || !document.corpus) {
    throw new CommandError(`missing top-level corpus: ${file}`);
  }
  return document.corpus;
}

function loadRealAppImportEvaluation(file) {
  const document = evalPklJson(file);
  if (!document || typeof document !== "object" || !document.realAppImportEval) {
    throw new CommandError(`missing top-level realAppImportEval: ${file}`);
  }
  return document.realAppImportEval;
}

function loadExternalRealAppImportCorpus(file) {
  const document = evalPklJson(file);
  if (!document || typeof document !== "object" || !document.externalHoldoutImportCorpus) {
    throw new CommandError(`missing top-level externalHoldoutImportCorpus: ${file}`);
  }
  return document.externalHoldoutImportCorpus;
}

function loadSpecChangeReview(file) {
  const document = evalPklJson(file);
  if (!document || typeof document !== "object" || !document.review) {
    throw new CommandError(`missing top-level review: ${file}`);
  }
  return document.review;
}

function loadSpecReadingEvaluation(file) {
  const document = evalPklJson(file);
  if (!document || typeof document !== "object" || !document.specReadingEval) {
    throw new CommandError(`missing top-level specReadingEval: ${file}`);
  }
  return document.specReadingEval;
}

function loadSpecReadingEvaluationSuite(file) {
  const document = evalPklJson(file);
  if (!document || typeof document !== "object" || !document.specReadingEvalSuite) {
    throw new CommandError(`missing top-level specReadingEvalSuite: ${file}`);
  }
  return document.specReadingEvalSuite;
}

function loadSpecReadingAgentRunner(file) {
  const document = evalPklJson(file);
  if (!document || typeof document !== "object" || !document.specReadingAgentRunner) {
    throw new CommandError(`missing top-level specReadingAgentRunner: ${file}`);
  }
  return document.specReadingAgentRunner;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, locale) {
  if (!value) return "";
  return value.labels?.[locale] ?? value.default ?? "";
}

function byId(left, right) {
  return left.id.localeCompare(right.id);
}

function sortedTerms(model) {
  return [...list(model.vocabulary)].sort(byId);
}

function sortedRules(model) {
  return [...list(model.rules)].sort(byId);
}

function sortedDecisions(model) {
  return [...list(model.decisions)].sort((left, right) => {
    const date = String(left.date).localeCompare(String(right.date));
    return date === 0 ? String(left.id).localeCompare(String(right.id)) : date;
  });
}

function stableObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableObject);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

function stableJson(value) {
  return `${JSON.stringify(stableObject(value), null, 2)}\n`;
}

function sha256Digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function fileDigest(path) {
  return sha256Digest(readFileSync(resolve(path)));
}

function readJsonFile(path, label) {
  try {
    return JSON.parse(readTextFile(path));
  } catch (error) {
    throw new CommandError(`failed to parse ${label}: ${path}: ${error.message}`);
  }
}

function automatedCheckTargets(rule) {
  return list(rule.checks).filter((target) => target.backend !== "manual" && target.backend !== "runtime");
}

const CHECK_ASSURANCE_KINDS = ["reference", "executed", "mutation-tested", "bounded", "proved"];

const CHECK_ASSURANCE_BACKENDS = {
  executed: ["node", "pkl", "lean", "alloy", "quint", "rego", "cue", "playwright", "runtime"],
  "mutation-tested": ["node", "playwright"],
  bounded: ["alloy", "quint"],
  proved: ["lean"],
};

function checkTargetAssurances(target) {
  const declared = list(target.assurances);
  return [...new Set(declared.length > 0 ? declared : ["reference"])];
}

function ruleRequiredAssurances(rule) {
  const required = list(rule.requiredAssurances);
  return [...new Set(required.length > 0 ? required : ["reference"])];
}

function clauseForSelector(rule, selector) {
  const match = /^(when|must|mustNot)\[([0-9]+)\]$/.exec(selector);
  if (!match) return null;
  return list(rule[match[1]])[Number(match[2])] ?? null;
}

function leanClauseTheoremName(ruleId, selector) {
  const normalizedSelector = sanitizeIdentifier(selector).replace(/_+$/, "");
  return `clause_${sanitizeIdentifier(ruleId)}_${normalizedSelector}`;
}

function leanClauseArtifactId(ruleId, selector) {
  return `lean-clause-${ruleId}-${selector.replace(/[^A-Za-z0-9]+/g, "-").replace(/-+$/, "")}`;
}

function leanSemanticClauseProofs(model) {
  const proofs = new Map();
  for (const rule of sortedRules(model).filter((candidate) => candidate.reviewStatus === "approved" && !candidate.deprecated)) {
    for (const target of list(rule.checks)) {
      if (target.backend !== "lean" || !checkTargetAssurances(target).includes("proved")) continue;
      for (const selector of list(target.covers)) {
        const match = /^(must|mustNot)\[([0-9]+)\]$/.exec(selector);
        const clause = clauseForSelector(rule, selector);
        if (!match || !clause?.ast) continue;
        if (clauseBackendSupport("lean", expressionOperators(clause.ast)) !== "semantic") continue;
        const theorem = leanClauseTheoremName(rule.id, selector);
        proofs.set(`${rule.id}:${selector}`, {
          rule,
          selector,
          field: match[1],
          index: Number(match[2]),
          clause,
          theorem,
          artifactId: leanClauseArtifactId(rule.id, selector),
          generatedSelector: `lean.theorem.${theorem}`,
        });
      }
    }
  }
  return [...proofs.values()];
}

function validateCheckTargetAssuranceDeclarations(errors, model, rule, { requireFormalEvidence = false } = {}) {
  for (const target of list(rule.checks)) {
    const assurances = checkTargetAssurances(target);
    const assuranceSet = new Set(assurances);
    const evidence = target.assuranceEvidence ?? {};

    if (!assuranceSet.has("reference")) {
      errors.push(`check target assurance must include reference: ${rule.id} -> ${target.ref}`);
    }

    for (const kind of assurances) {
      const allowedBackends = CHECK_ASSURANCE_BACKENDS[kind];
      if (allowedBackends && !allowedBackends.includes(target.backend)) {
        errors.push(
          `incompatible check assurance: ${rule.id} -> ${kind} requires ${allowedBackends.join("/")} backend, got ${target.backend}`,
        );
      }
      if (kind !== "reference" && !evidence[kind]) {
        errors.push(`missing check assurance evidence: ${rule.id} -> ${kind}`);
      }
      if (requireFormalEvidence && (kind === "bounded" || kind === "proved")) {
        if (list(target.covers).length === 0) {
          errors.push(`formal assurance requires clause selectors: ${rule.id} -> ${kind} ${target.backend}`);
        }
        for (const selector of list(target.covers)) {
          const clause = clauseForSelector(rule, selector);
          if (!clause?.ast) {
            errors.push(`formal assurance requires typed Clause.ast: ${rule.id} -> ${kind} ${target.backend} ${selector}`);
            continue;
          }
          const support = clauseBackendSupport(target.backend, expressionOperators(clause.ast));
          if (support !== "semantic") {
            errors.push(
              `formal assurance requires semantic Clause.ast support: ${rule.id} -> ${kind} ${target.backend} ${selector} (${support})`,
            );
          }
        }
        const evidenceRef = evidence[kind];
        if (evidenceRef) {
          const { path, anchor } = splitRef(evidenceRef);
          if (anchor || !path.endsWith(".json")) {
            errors.push(`formal assurance requires evidence manifest: ${rule.id} -> ${kind} ${evidenceRef}`);
          } else if (!existsSync(resolve(path))) {
            errors.push(`missing formal assurance evidence manifest: ${rule.id} -> ${kind} ${evidenceRef}`);
          } else {
            let manifest;
            try {
              manifest = readJsonFile(path, "assurance evidence manifest");
            } catch (error) {
              errors.push(`invalid formal assurance evidence manifest: ${rule.id} -> ${kind}: ${error.message}`);
              continue;
            }
            const report = assuranceEvidenceVerificationReport(model, manifest);
            for (const error of report.errors) {
              errors.push(`invalid formal assurance evidence manifest: ${rule.id} -> ${kind}: ${error}`);
            }
            for (const selector of list(target.covers)) {
              const binding = list(report.manifest?.clauseBindings).find(
                (entry) => entry?.ruleId === rule.id && entry.selector === selector,
              );
              const backendBinding = list(binding?.backends).find((entry) => entry?.backend === target.backend);
              if (!backendBinding || backendBinding.support !== "semantic" || list(backendBinding.generatedSelectors).length === 0) {
                errors.push(`formal assurance lacks semantic manifest binding: ${rule.id} -> ${kind} ${target.backend} ${selector}`);
                continue;
              }
              const generatedSelectors = new Set(backendBinding.generatedSelectors);
              const artifact = list(report.manifest?.artifacts).find(
                (entry) => entry?.backend === target.backend
                  && entry.scope === "clause"
                  && entry.result === "pass"
                  && list(entry.propertyIds).some((propertyId) => generatedSelectors.has(propertyId)),
              );
              if (!artifact) {
                errors.push(`formal assurance lacks passing clause artifact: ${rule.id} -> ${kind} ${target.backend} ${selector}`);
              }
            }
          }
        }
      }
    }

    for (const kind of Object.keys(evidence)) {
      if (!assuranceSet.has(kind)) {
        errors.push(`undeclared check assurance evidence: ${rule.id} -> ${kind}`);
      }
    }
  }
}

function assuranceSummary(model) {
  const rules = activeApprovedRules(model);
  const targets = rules.flatMap(automatedCheckTargets);
  const byKind = Object.fromEntries(CHECK_ASSURANCE_KINDS.map((kind) => [kind, 0]));
  const requirements = Object.fromEntries(CHECK_ASSURANCE_KINDS.map((kind) => [kind, 0]));

  for (const target of targets) {
    for (const kind of new Set(checkTargetAssurances(target))) {
      byKind[kind] += 1;
    }
  }

  let satisfied = 0;
  for (const rule of rules) {
    const ruleTargets = automatedCheckTargets(rule);
    const available = new Set(ruleTargets.flatMap(checkTargetAssurances));
    const required = [...new Set(ruleRequiredAssurances(rule))];
    for (const kind of required) requirements[kind] += 1;
    if (ruleTargets.length > 0 && required.every((kind) => available.has(kind))) {
      satisfied += 1;
    }
  }

  return {
    kinds: CHECK_ASSURANCE_KINDS,
    rules: { satisfied, total: rules.length },
    targets: { total: targets.length, byKind },
    requirements,
  };
}

function clauseExpr(clause) {
  return clause.ast ? exprToText(clause.ast) : clause.expr;
}

function exprAstKey(ast) {
  if (!ast) return null;
  const args = list(ast.args).join(",");
  const children = list(ast.children).map(exprAstKey).join(",");
  if (ast.op === "atom") return `atom:${ast.name}(${args})`;
  if (ast.op === "eq" || ast.op === "neq") return `${ast.op}(${args})`;
  if (ast.op === "not") return `not(${children})`;
  if (ast.op === "and" || ast.op === "or") return `${ast.op}(${children})`;
  if (ast.op === "implies") return `implies(${children})`;
  if (ast.op === "exists" || ast.op === "forall") return `${ast.op}:${ast.name}(${children})`;
  return JSON.stringify(stableObject(ast));
}

function clauseIdentity(clause) {
  return clause.ast ? exprAstKey(clause.ast) : clause.expr;
}

function checkUnique(errors, label, items) {
  const seen = new Set();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) {
      errors.push(`duplicate ${label}: ${item.id}`);
    }
    seen.add(item.id);
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readTextFile(path) {
  return readFileSync(resolve(path), "utf8");
}

function resolvePathRelativeToFile(ownerFile, targetPath) {
  if (!ownerFile || isAbsolute(targetPath)) return targetPath;
  return resolve(dirname(resolve(ownerFile)), targetPath);
}

function splitRef(ref) {
  const index = ref.indexOf("#");
  if (index === -1) {
    return { path: ref, anchor: null };
  }
  return {
    path: ref.slice(0, index),
    anchor: ref.slice(index + 1),
  };
}

function hasSymbol(content, symbol) {
  const escaped = escapeRegex(symbol);
  return new RegExp(`\\b(function|class|typealias|const|let|var)\\s+${escaped}\\b`).test(content);
}

function hasModuleSymbol(path, symbol, seen = new Set()) {
  const absolutePath = resolve(path);
  if (seen.has(absolutePath) || !existsSync(absolutePath)) return false;
  seen.add(absolutePath);
  const content = readFileSync(absolutePath, "utf8");
  if (hasSymbol(content, symbol)) return true;
  const baseModule = content.match(/^\s*(?:amends|extends)\s+"([^"]+)"/m)?.[1];
  return baseModule ? hasModuleSymbol(resolve(dirname(absolutePath), baseModule), symbol, seen) : false;
}

function hasNodeTestAnchor(content, anchor) {
  const escaped = escapeRegex(anchor);
  return new RegExp(`\\b(it|test|describe)\\(\\s*["'\`]${escaped}["'\`]`).test(content);
}

function hasLeanSymbol(content, symbol) {
  const escaped = escapeRegex(symbol);
  return new RegExp(`\\b(theorem|lemma|def|abbrev|inductive|structure|class|axiom)\\s+${escaped}\\b`).test(content);
}

function hasQuintSymbol(content, symbol) {
  const escaped = escapeRegex(symbol);
  return new RegExp(`\\b(?:pure\\s+)?(?:val|def|action|run|temporal)\\s+${escaped}\\b`).test(content);
}

function hasAlloySymbol(content, symbol) {
  const escaped = escapeRegex(symbol);
  return new RegExp(`\\b(sig|fact|assert|pred|fun|check)\\s+${escaped}\\b`).test(content);
}

function activeApprovedRules(model) {
  return list(model.rules).filter((rule) => rule.reviewStatus === "approved" && !rule.deprecated);
}

function validateExprAst(errors, context, ast) {
  errors.push(...validateClauseAst(ast, { context }));
}

function validateClauseAsts(errors, rule, fieldName) {
  list(rule[fieldName]).forEach((clause, index) => {
    validateExprAst(errors, `${rule.id} ${fieldName}[${index}]`, clause.ast);
  });
}

function domainPattern(model) {
  return model.patterns?.domain ?? null;
}

function intentPattern(model) {
  return model.patterns?.intent ?? null;
}

function projections(model) {
  return list(model.projections);
}

function validateProjections(errors, model) {
  errors.push(...validateProjectionContracts(model));
}

function domainPacks(model) {
  return list(model.domainPacks);
}

function i18nContract(model) {
  return model.i18n ?? { requiredLocales: [], glossary: [] };
}

function isLocalizedText(value) {
  return Boolean(value)
    && typeof value === "object"
    && typeof value.default === "string"
    && value.labels
    && typeof value.labels === "object"
    && !Array.isArray(value.labels);
}

function walkLocalizedTexts(value, path, visit, seen = new Set()) {
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (isLocalizedText(value)) {
    visit(value, path);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((child, index) => walkLocalizedTexts(child, `${path}[${index}]`, visit, seen));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    walkLocalizedTexts(child, `${path}.${key}`, visit, seen);
  }
}

function intentCapabilities(intent) {
  return list(intent?.capabilities);
}

function intentOutcomes(intent) {
  return list(intent?.outcomes);
}

function intentProcesses(intent) {
  return list(intent?.processes);
}

function constructionAuthorities(intent) {
  return list(intent?.constructionAuthorities);
}

function intentAccessPolicies(intent) {
  return list(intent?.accessPolicies);
}

function intentGoals(intent) {
  return list(intent?.goals);
}

function intentClaims(intent) {
  return list(intent?.claims);
}

function intentAssuranceTasks(intent) {
  return list(intent?.assuranceTasks);
}

function intentSemanticBindings(intent) {
  return list(intent?.semanticBindings);
}

function intentScenarios(intent) {
  return list(intent?.scenarios);
}

function intentRefinements(process) {
  return list(process?.refinements);
}

function checkUniqueIdentifiers(errors, label, identifiers) {
  const seen = new Set();
  for (const identifier of identifiers) {
    if (seen.has(identifier)) {
      errors.push(`duplicate ${label}: ${identifier}`);
    }
    seen.add(identifier);
  }
}

function intentAllowedValueMatchesType(field, value) {
  if (field.type === "string") return true;
  if (field.type === "integer") return /^-?\d+$/.test(value);
  if (field.type === "boolean") return value === "true" || value === "false";
  return /^[a-zA-Z0-9][a-zA-Z0-9_.\-/]*$/.test(value);
}

function validateIntentDataContract(errors, owner, contract) {
  if (!contract) return;
  const fields = list(contract.fields);
  checkUnique(errors, `intent contract field id in ${owner}`, fields);
  for (const field of fields) {
    checkUniqueIdentifiers(errors, `intent contract allowed value in ${owner}.${field.id}`, list(field.allowedValues));
    if ((field.minimum !== null && field.minimum !== undefined) || (field.maximum !== null && field.maximum !== undefined)) {
      if (field.type !== "integer") {
        errors.push(`intent contract range requires integer field: ${owner}.${field.id}`);
      }
      if (field.minimum !== null && field.minimum !== undefined && field.maximum !== null && field.maximum !== undefined && field.minimum > field.maximum) {
        errors.push(`intent contract minimum exceeds maximum: ${owner}.${field.id}`);
      }
    }
    if (field.pattern) {
      if (!["string", "identifier"].includes(field.type)) {
        errors.push(`intent contract pattern requires string field: ${owner}.${field.id}`);
      }
      try {
        new RegExp(field.pattern);
      } catch {
        errors.push(`invalid intent contract pattern: ${owner}.${field.id}`);
      }
    }
    for (const value of list(field.allowedValues)) {
      if (!intentAllowedValueMatchesType(field, value)) {
        errors.push(`intent contract allowed value has wrong type: ${owner}.${field.id} -> ${value}`);
      }
    }
  }
  list(contract.clauses).forEach((clause, index) => {
    validateExprAst(errors, `${owner} clauses[${index}]`, clause.ast);
  });
}

function validateIntentFieldBindings(errors, owner, contract, bindings) {
  const fields = new Map(list(contract?.fields).map((field) => [field.id, field]));
  const contractFields = list(bindings).map((binding) => binding.contractField);
  const implementationFields = list(bindings).map((binding) => binding.implementationField);
  checkUniqueIdentifiers(errors, `intent refinement contract field in ${owner}`, contractFields);
  checkUniqueIdentifiers(errors, `intent refinement implementation field in ${owner}`, implementationFields);
  for (const binding of list(bindings)) {
    if (!fields.has(binding.contractField)) {
      errors.push(`unknown intent refinement contract field: ${owner} -> ${binding.contractField}`);
    }
  }
  for (const field of fields.values()) {
    if (field.required !== false && !contractFields.includes(field.id)) {
      errors.push(`intent refinement missing required field binding: ${owner} -> ${field.id}`);
    }
  }
}

function validateIntentModel(errors, model) {
  const intent = intentPattern(model);
  if (!intent) return;

  const capabilities = intentCapabilities(intent);
  const outcomes = intentOutcomes(intent);
  const processes = intentProcesses(intent);
  const authorities = constructionAuthorities(intent);
  const accessPolicies = intentAccessPolicies(intent);
  const goals = intentGoals(intent);
  const claims = intentClaims(intent);
  const assuranceTasks = intentAssuranceTasks(intent);
  const semanticBindings = intentSemanticBindings(intent);
  const scenarios = intentScenarios(intent);
  checkUnique(errors, "intent capability id", capabilities);
  checkUnique(errors, "intent outcome id", outcomes);
  checkUnique(errors, "intent process id", processes);
  checkUnique(errors, "construction authority id", authorities);
  checkUnique(errors, "intent access policy id", accessPolicies);
  checkUnique(errors, "intent goal id", goals);
  checkUnique(errors, "intent claim id", claims);
  checkUnique(errors, "intent assurance task id", assuranceTasks);
  checkUnique(errors, "intent semantic binding id", semanticBindings);
  checkUnique(errors, "intent scenario id", scenarios);

  const stateIds = new Set(list(model.vocabulary).filter((term) => term.kind === "state").map((term) => term.id));
  const capabilityIds = new Set(capabilities.map((capability) => capability.id));
  const dbTransactionIds = new Set(dbTransactions(dbPattern(model)).map((transaction) => transaction.id));
  const outcomesById = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const processesById = new Map(processes.map((process) => [process.id, process]));
  const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
  const vocabularyById = new Map(list(model.vocabulary).map((term) => [term.id, term]));
  const outcomeStates = new Set();
  const refinementIds = new Set();

  for (const outcome of outcomes) {
    if (!stateIds.has(outcome.state)) {
      errors.push(`unknown intent outcome state: ${outcome.id} -> ${outcome.state}`);
    }
    if (outcomeStates.has(outcome.state)) {
      errors.push(`duplicate intent outcome state: ${outcome.state}`);
    }
    outcomeStates.add(outcome.state);
    validateIntentDataContract(errors, `${outcome.id} output`, outcome.outputContract);
    const effects = list(outcome.effects);
    checkUnique(errors, `intent outcome effect id in ${outcome.id}`, effects);
    for (const effect of effects) {
      if (!capabilityIds.has(effect.capability)) {
        errors.push(`unknown intent outcome effect capability: ${outcome.id}.${effect.id} -> ${effect.capability}`);
      }
      validateIntentDataContract(errors, `${outcome.id} effect ${effect.id} output`, effect.outputContract);
    }
  }

  const accessPoliciesById = new Map(accessPolicies.map((policy) => [policy.id, policy]));
  const accessPolicyPriorities = new Map();
  for (const policy of accessPolicies) {
    if (!processesById.has(policy.process)) {
      errors.push(`unknown intent access policy process: ${policy.id} -> ${policy.process}`);
    }
    const subject = vocabularyById.get(policy.subject);
    if (!subject || !["actor", "role"].includes(subject.kind)) {
      errors.push(`intent access policy subject must be an actor or role: ${policy.id} -> ${policy.subject}`);
    }
    checkUniqueIdentifiers(errors, `intent access policy override in ${policy.id}`, list(policy.overrides));
    const priorityKey = `${policy.process}\u0000${policy.subject}\u0000${policy.priority}`;
    accessPolicyPriorities.set(priorityKey, [...(accessPolicyPriorities.get(priorityKey) ?? []), policy]);
  }

  const claimGoals = new Map();
  for (const goal of goals) {
    const goalIntents = list(goal.intents);
    const goalClaims = list(goal.claims);
    checkUniqueIdentifiers(errors, `intent goal process in ${goal.id}`, goalIntents);
    checkUniqueIdentifiers(errors, `intent goal claim in ${goal.id}`, goalClaims);
    if (goalIntents.length === 0) errors.push(`intent goal has no processes: ${goal.id}`);
    if (goalClaims.length === 0) errors.push(`intent goal has no claims: ${goal.id}`);
    for (const processId of goalIntents) {
      if (!processesById.has(processId)) {
        errors.push(`unknown intent goal process: ${goal.id} -> ${processId}`);
      }
    }
    for (const claimId of goalClaims) {
      if (!claimsById.has(claimId)) {
        errors.push(`unknown intent goal claim: ${goal.id} -> ${claimId}`);
        continue;
      }
      claimGoals.set(claimId, [...(claimGoals.get(claimId) ?? []), goal]);
    }
  }

  const taskCoveredClaimIds = new Set();
  for (const claim of claims) {
    const claimProcesses = list(claim.processes);
    checkUniqueIdentifiers(errors, `intent claim process in ${claim.id}`, claimProcesses);
    if (claimProcesses.length === 0) errors.push(`intent claim has no processes: ${claim.id}`);
    for (const processId of claimProcesses) {
      if (!processesById.has(processId)) {
        errors.push(`unknown intent claim process: ${claim.id} -> ${processId}`);
      }
    }
    const parents = list(claimGoals.get(claim.id));
    if (parents.length === 0) {
      errors.push(`intent claim has no goal: ${claim.id}`);
    }
    if (parents.length > 1) {
      errors.push(`intent claim belongs to multiple goals: ${claim.id}`);
    }
    for (const goal of parents) {
      for (const processId of claimProcesses) {
        if (!list(goal.intents).includes(processId)) {
          errors.push(`intent claim process is outside goal intent: ${claim.id} -> ${processId}`);
        }
      }
    }
  }

  for (const task of assuranceTasks) {
    const taskClaims = list(task.claims);
    checkUniqueIdentifiers(errors, `intent assurance task claim in ${task.id}`, taskClaims);
    if (taskClaims.length === 0) errors.push(`intent assurance task has no claims: ${task.id}`);
    for (const claimId of taskClaims) {
      if (!claimsById.has(claimId)) {
        errors.push(`unknown intent assurance task claim: ${task.id} -> ${claimId}`);
      } else {
        taskCoveredClaimIds.add(claimId);
      }
    }
    if (task.kind === "property-test") {
      if (!["node", "playwright"].includes(task.backend)) {
        errors.push(`intent property-test task requires node or playwright backend: ${task.id}`);
      }
      if (!["executed", "mutation-tested"].includes(task.assurance)) {
        errors.push(`intent property-test task requires executed or mutation-tested assurance: ${task.id}`);
      }
    }
    if (task.kind === "formal-model") {
      if (!["lean", "alloy", "quint"].includes(task.backend)) {
        errors.push(`intent formal-model task requires lean, alloy, or quint backend: ${task.id}`);
      }
      if (!(["model", "proof"].includes(task.target.kind))) {
        errors.push(`intent formal-model task requires a model or proof target: ${task.id}`);
      }
      const expectedAssurance = task.backend === "lean" ? "proved" : "bounded";
      if (task.assurance !== expectedAssurance) {
        errors.push(`intent formal-model task assurance mismatch: ${task.id} -> ${task.backend} requires ${expectedAssurance}`);
      }
    }
    if (task.kind === "runtime-observation") {
      if (task.backend !== "runtime" || task.assurance !== "executed" || task.target.kind !== "runtime") {
        errors.push(`intent runtime-observation task requires runtime executed evidence: ${task.id}`);
      }
    }
    if (task.kind === "manual-review") {
      if (task.backend !== "manual" || task.assurance !== "reference") {
        errors.push(`intent manual-review task requires manual reference assurance: ${task.id}`);
      }
    }
  }
  for (const claim of claims) {
    if (!taskCoveredClaimIds.has(claim.id)) {
      errors.push(`intent claim has no assurance task: ${claim.id}`);
    }
  }

  const bindingCoveredClaimIds = new Set();
  const semanticBindingKeys = new Set();
  const cloudNodeIds = new Set(cloudNodes(cloudPattern(model)).map((node) => node.id));
  for (const binding of semanticBindings) {
    const bindingClaims = list(binding.claims);
    checkUniqueIdentifiers(errors, `intent semantic binding claim in ${binding.id}`, bindingClaims);
    for (const claimId of bindingClaims) {
      const claim = claimsById.get(claimId);
      if (!claim) {
        errors.push(`unknown intent semantic binding claim: ${binding.id} -> ${claimId}`);
      } else {
        bindingCoveredClaimIds.add(claimId);
        if (!list(claim.processes).includes(binding.process)) {
          errors.push(`intent semantic binding process is outside claim: ${binding.id} -> ${claimId}`);
        }
      }
    }
    const process = processesById.get(binding.process);
    if (!process) {
      errors.push(`unknown intent semantic binding process: ${binding.id} -> ${binding.process}`);
      continue;
    }
    const refinement = binding.refinement
      ? intentRefinements(process).find((candidate) => candidate.id === binding.refinement)
      : null;
    if (binding.refinement && !refinement) {
      errors.push(`unknown intent semantic binding refinement: ${binding.id} -> ${binding.refinement}`);
    }
    const key = `${binding.kind}\u0000${binding.target}\u0000${binding.value ?? ""}`;
    if (semanticBindingKeys.has(key)) {
      errors.push(`duplicate intent semantic binding target: ${binding.kind} ${binding.target}`);
    }
    semanticBindingKeys.add(key);
    if (binding.kind === "http-route") {
      if (!binding.refinement || !refinement || refinement.kind !== "http-route" || !refinement.http) {
        errors.push(`intent semantic HTTP binding requires an HTTP refinement: ${binding.id}`);
      } else {
        const expectedTarget = `${refinement.http.method} ${refinement.http.path}`;
        if (binding.target !== expectedTarget) {
          errors.push(`intent semantic HTTP binding target mismatch: ${binding.id} expected ${expectedTarget}, got ${binding.target}`);
        }
      }
    }
    if (binding.kind === "db-transaction") {
      if (!binding.refinement || !refinement || refinement.kind !== "transaction" || !refinement.transaction) {
        errors.push(`intent semantic DB binding requires a transaction refinement: ${binding.id}`);
      } else if (binding.target !== refinement.transaction.dbTransaction) {
        errors.push(`intent semantic DB binding target mismatch: ${binding.id} expected ${refinement.transaction.dbTransaction}, got ${binding.target}`);
      }
    }
    if (binding.kind === "cloud-resource" && !cloudNodeIds.has(binding.target)) {
      errors.push(`unknown intent semantic cloud resource: ${binding.id} -> ${binding.target}`);
    }
    if (binding.kind === "otel-attribute" && (binding.value === null || binding.value === undefined || binding.value.length === 0)) {
      errors.push(`intent semantic OTel attribute requires a value: ${binding.id}`);
    }
  }
  for (const claim of claims) {
    if (claim.requiredImplementationBinding !== false && !bindingCoveredClaimIds.has(claim.id)) {
      errors.push(`intent claim has no implementation binding: ${claim.id}`);
    }
  }
  for (const [priorityKey, policies] of accessPolicyPriorities) {
    if (policies.length < 2) continue;
    const [process, subject, priority] = priorityKey.split("\u0000");
    errors.push(`ambiguous intent access policy precedence: ${process} -> ${subject} at priority ${priority}`);
  }
  for (const policy of accessPolicies) {
    for (const overriddenId of list(policy.overrides)) {
      const overridden = accessPoliciesById.get(overriddenId);
      if (!overridden) {
        errors.push(`unknown intent access policy override: ${policy.id} -> ${overriddenId}`);
        continue;
      }
      if (overridden.id === policy.id) {
        errors.push(`intent access policy cannot override itself: ${policy.id}`);
      }
      if (overridden.process !== policy.process || overridden.subject !== policy.subject) {
        errors.push(`intent access policy override target differs in process or subject: ${policy.id} -> ${overridden.id}`);
      }
      if (policy.priority <= overridden.priority) {
        errors.push(`intent access policy override must have higher priority: ${policy.id} -> ${overridden.id}`);
      }
    }
  }

  for (const process of processes) {
    if (!stateIds.has(process.input)) {
      errors.push(`unknown intent process input state: ${process.id} -> ${process.input}`);
    }
    validateIntentDataContract(errors, `${process.id} input`, process.inputContract);
    const execution = process.execution;
    if (execution && (!Number.isInteger(execution.maxInFlight) || execution.maxInFlight < 1)) {
      errors.push(`intent execution maxInFlight must be a positive integer: ${process.id}`);
    }
    if (execution?.timeoutSteps !== null && execution?.timeoutSteps !== undefined
      && (!Number.isInteger(execution.timeoutSteps) || execution.timeoutSteps < 1)) {
      errors.push(`intent execution timeoutSteps must be a positive integer: ${process.id}`);
    }
    if (execution?.timeoutMs !== null && execution?.timeoutMs !== undefined
      && (!Number.isInteger(execution.timeoutMs) || execution.timeoutMs < 1)) {
      errors.push(`intent execution timeoutMs must be a positive integer: ${process.id}`);
    }
    if (execution?.idempotencyKey) {
      const idempotencyField = list(process.inputContract?.fields)
        .find((field) => field.id === execution.idempotencyKey);
      if (!idempotencyField) {
        errors.push(`intent execution idempotency key is not an input field: ${process.id} -> ${execution.idempotencyKey}`);
      } else if (idempotencyField.required === false) {
        errors.push(`intent execution idempotency key must be required: ${process.id} -> ${execution.idempotencyKey}`);
      } else if (!["identifier", "string"].includes(idempotencyField.type)) {
        errors.push(`intent execution idempotency key must have identifier or string type: ${process.id} -> ${execution.idempotencyKey}`);
      }
    }

    const declaredOutcomes = list(process.outcomes);
    const constructedOutcomes = list(process.constructs);
    const requiredCapabilities = list(process.requires);
    const effectCapabilities = list(process.effects);
    checkUniqueIdentifiers(errors, `intent process outcome in ${process.id}`, declaredOutcomes);
    checkUniqueIdentifiers(errors, `intent process construct in ${process.id}`, constructedOutcomes);
    checkUniqueIdentifiers(errors, `intent process required capability in ${process.id}`, requiredCapabilities);
    checkUniqueIdentifiers(errors, `intent process effect capability in ${process.id}`, effectCapabilities);

    if (declaredOutcomes.length === 0) {
      errors.push(`intent process has no outcomes: ${process.id}`);
    }

    for (const outcomeId of declaredOutcomes) {
      if (!outcomesById.has(outcomeId)) {
        errors.push(`unknown intent process outcome: ${process.id} -> ${outcomeId}`);
      }
    }
    for (const outcomeId of constructedOutcomes) {
      if (!outcomesById.has(outcomeId)) {
        errors.push(`unknown intent process constructed outcome: ${process.id} -> ${outcomeId}`);
      } else if (!declaredOutcomes.includes(outcomeId)) {
        errors.push(`intent process constructs undeclared outcome: ${process.id} -> ${outcomeId}`);
      }
    }
    for (const outcomeId of declaredOutcomes) {
      if (!constructedOutcomes.includes(outcomeId)) {
        errors.push(`intent process outcome has no construction path: ${process.id} -> ${outcomeId}`);
      }
    }
    for (const capabilityId of requiredCapabilities) {
      if (!capabilityIds.has(capabilityId)) {
        errors.push(`unknown intent process required capability: ${process.id} -> ${capabilityId}`);
      }
    }
    for (const capabilityId of effectCapabilities) {
      if (!capabilityIds.has(capabilityId)) {
        errors.push(`unknown intent process effect capability: ${process.id} -> ${capabilityId}`);
      }
    }
    for (const outcomeId of declaredOutcomes) {
      const outcome = outcomesById.get(outcomeId);
      for (const effect of list(outcome?.effects)) {
        if (!effectCapabilities.includes(effect.capability)) {
          errors.push(`intent process effect capability is not declared for outcome effect: ${process.id}.${outcomeId}.${effect.id} -> ${effect.capability}`);
        }
      }
    }

    const outcomeStateIds = new Set(
      declaredOutcomes.map((outcomeId) => outcomesById.get(outcomeId)?.state).filter((stateId) => stateId),
    );
    const transitionedStates = new Set();
    for (const transition of list(process.transitions)) {
      if (!stateIds.has(transition.from)) {
        errors.push(`unknown intent process transition source state: ${process.id} -> ${transition.from}`);
      }
      if (!stateIds.has(transition.to)) {
        errors.push(`unknown intent process transition target state: ${process.id} -> ${transition.to}`);
      }
      if (transition.from !== process.input) {
        errors.push(`intent process transition source differs from input: ${process.id} -> ${transition.from}`);
      }
      if (!outcomeStateIds.has(transition.to)) {
        errors.push(`intent process transition target is not an outcome: ${process.id} -> ${transition.to}`);
      }
      transitionedStates.add(transition.to);
    }
    for (const outcomeId of declaredOutcomes) {
      const outcome = outcomesById.get(outcomeId);
      if (outcome && !transitionedStates.has(outcome.state)) {
        errors.push(`intent process outcome has no transition: ${process.id} -> ${outcomeId}`);
      }
    }

    const refinements = intentRefinements(process);
    checkUnique(errors, `intent refinement id in ${process.id}`, refinements);
    for (const refinement of refinements) {
      if (refinementIds.has(refinement.id)) {
        errors.push(`duplicate intent refinement id: ${refinement.id}`);
      }
      refinementIds.add(refinement.id);
      if (refinement.kind === "http-route" && !refinement.http) {
        errors.push(`intent HTTP refinement requires endpoint: ${process.id}.${refinement.id}`);
      }
      if (refinement.kind !== "http-route" && refinement.http) {
        errors.push(`intent refinement HTTP endpoint requires http-route kind: ${process.id}.${refinement.id}`);
      }
      if (refinement.kind === "grpc-method" && !refinement.grpc) {
        errors.push(`intent gRPC refinement requires endpoint: ${process.id}.${refinement.id}`);
      }
      if (refinement.kind !== "grpc-method" && refinement.grpc) {
        errors.push(`intent refinement gRPC endpoint requires grpc-method kind: ${process.id}.${refinement.id}`);
      }
      if (refinement.kind === "transaction" && !refinement.transaction) {
        errors.push(`intent transaction refinement requires endpoint: ${process.id}.${refinement.id}`);
      }
      if (refinement.kind !== "transaction" && refinement.transaction) {
        errors.push(`intent refinement transaction endpoint requires transaction kind: ${process.id}.${refinement.id}`);
      }
      if (refinement.transaction && !dbTransactionIds.has(refinement.transaction.dbTransaction)) {
        errors.push(`unknown intent transaction refinement DB transaction: ${process.id}.${refinement.id} -> ${refinement.transaction.dbTransaction}`);
      }
      validateIntentFieldBindings(errors, `${process.id}.${refinement.id} input`, process.inputContract, refinement.inputBindings);
      const bindingsByOutcome = new Map();
      checkUniqueIdentifiers(errors, `intent refinement outcome binding in ${process.id}.${refinement.id}`, list(refinement.outcomeBindings).map((binding) => binding.outcome));
      for (const binding of list(refinement.outcomeBindings)) {
        if (!declaredOutcomes.includes(binding.outcome)) {
          errors.push(`unknown intent refinement outcome: ${process.id}.${refinement.id} -> ${binding.outcome}`);
          continue;
        }
        bindingsByOutcome.set(binding.outcome, binding);
        const outcome = outcomesById.get(binding.outcome);
        validateIntentFieldBindings(errors, `${process.id}.${refinement.id} outcome ${binding.outcome}`, outcome?.outputContract, binding.fields);
        const outcomeEffects = list(outcome?.effects);
        const effectBindings = list(binding.effectBindings);
        checkUniqueIdentifiers(errors, `intent refinement effect binding in ${process.id}.${refinement.id} outcome ${binding.outcome}`, effectBindings.map((effectBinding) => effectBinding.effect));
        const effectBindingsById = new Map();
        for (const effectBinding of effectBindings) {
          const effect = outcomeEffects.find((candidate) => candidate.id === effectBinding.effect);
          if (!effect) {
            errors.push(`unknown intent refinement outcome effect: ${process.id}.${refinement.id}.${binding.outcome} -> ${effectBinding.effect}`);
            continue;
          }
          effectBindingsById.set(effect.id, effectBinding);
          validateIntentFieldBindings(errors, `${process.id}.${refinement.id} outcome ${binding.outcome} effect ${effect.id}`, effect.outputContract, effectBinding.fields);
        }
        for (const effect of outcomeEffects) {
          if (list(effect.outputContract?.fields).some((field) => field.required !== false) && !effectBindingsById.has(effect.id)) {
            errors.push(`intent refinement missing effect binding: ${process.id}.${refinement.id}.${binding.outcome} -> ${effect.id}`);
          }
        }
      }
      for (const outcomeId of declaredOutcomes) {
        const outcome = outcomesById.get(outcomeId);
        if (list(outcome?.outputContract?.fields).some((field) => field.required !== false) && !bindingsByOutcome.has(outcomeId)) {
          errors.push(`intent refinement missing outcome binding: ${process.id}.${refinement.id} -> ${outcomeId}`);
        }
      }
    }
  }

  const authorityPairs = new Set();
  const authorityPairsByOutcome = new Map();
  for (const authority of authorities) {
    const process = processesById.get(authority.process);
    const outcome = outcomesById.get(authority.outcome);
    if (!process) {
      errors.push(`unknown construction authority process: ${authority.id} -> ${authority.process}`);
    }
    if (!outcome) {
      errors.push(`unknown construction authority outcome: ${authority.id} -> ${authority.outcome}`);
    }
    const pair = `${authority.process}\u0000${authority.outcome}`;
    if (authorityPairs.has(pair)) {
      errors.push(`duplicate construction authority: ${authority.process} -> ${authority.outcome}`);
    }
    authorityPairs.add(pair);
    if (process && outcome && !list(process.constructs).includes(outcome.id)) {
      errors.push(`construction authority is not declared by process: ${authority.id} -> ${authority.outcome}`);
    }
    if (outcome) {
      authorityPairsByOutcome.set(outcome.id, (authorityPairsByOutcome.get(outcome.id) ?? 0) + 1);
    }
  }

  for (const process of processes) {
    for (const outcomeId of list(process.constructs)) {
      if (!authorityPairs.has(`${process.id}\u0000${outcomeId}`)) {
        errors.push(`intent process construction has no authority: ${process.id} -> ${outcomeId}`);
      }
    }
  }
  for (const outcome of outcomes) {
    if (!authorityPairsByOutcome.has(outcome.id)) {
      errors.push(`intent outcome has no construction authority: ${outcome.id}`);
    }
  }

  for (const scenario of scenarios) {
    if (!stateIds.has(scenario.initialState)) {
      errors.push(`unknown intent scenario initial state: ${scenario.id} -> ${scenario.initialState}`);
    }
    if (!stateIds.has(scenario.expectedState)) {
      errors.push(`unknown intent scenario expected state: ${scenario.id} -> ${scenario.expectedState}`);
    }
    const steps = list(scenario.steps);
    if (steps.length === 0) {
      errors.push(`intent scenario has no steps: ${scenario.id}`);
      continue;
    }

    let currentState = scenario.initialState;
    for (const [index, step] of steps.entries()) {
      const process = processesById.get(step.process);
      const outcome = outcomesById.get(step.outcome);
      const context = `${scenario.id}[${index}]`;
      if (!process) {
        errors.push(`unknown intent scenario process: ${context} -> ${step.process}`);
      }
      if (!outcome) {
        errors.push(`unknown intent scenario outcome: ${context} -> ${step.outcome}`);
      }
      if (!process || !outcome) continue;
      if (process.input !== currentState) {
        errors.push(`intent scenario input state mismatch: ${context} expected ${currentState}, process accepts ${process.input}`);
      }
      if (!list(process.outcomes).includes(outcome.id)) {
        errors.push(`intent scenario outcome is not declared by process: ${context} -> ${outcome.id}`);
      }
      currentState = outcome.state;
    }
    if (currentState !== scenario.expectedState) {
      errors.push(`intent scenario expected state mismatch: ${scenario.id} expected ${scenario.expectedState}, actual ${currentState}`);
    }
  }
}

function validateDomainPacks(errors, model) {
  const packs = domainPacks(model);
  checkUnique(errors, "domain pack id", packs);

  for (const pack of packs) {
    const helperIds = new Set();
    for (const helper of list(pack.helpers)) {
      if (helperIds.has(helper.id)) {
        errors.push(`duplicate domain pack helper id: ${pack.id}.${helper.id}`);
      }
      helperIds.add(helper.id);

      if (helper.returns === "rule" && !helper.emitsTypedAst) {
        errors.push(`domain pack rule helper must emit typed ast: ${pack.id}.${helper.id}`);
      }
      if (helper.emitsTypedAst && list(helper.predicates).length === 0) {
        errors.push(`domain pack typed ast helper has no predicates: ${pack.id}.${helper.id}`);
      }
    }
  }
}

function validateI18nContract(errors, model) {
  const locales = new Set(list(model.locales));
  const contract = i18nContract(model);
  const requiredLocales = list(contract.requiredLocales);

  for (const locale of requiredLocales) {
    if (!locales.has(locale)) {
      errors.push(`i18n required locale is not listed in locales: ${locale}`);
    }
  }

  if (requiredLocales.length > 0) {
    walkLocalizedTexts(model, "model", (localized, path) => {
      for (const locale of requiredLocales) {
        if (!Object.hasOwn(localized.labels ?? {}, locale)) {
          errors.push(`missing localized label: ${path}.labels.${locale}`);
        }
      }
    });
  }

  const termsById = new Map(list(model.vocabulary).map((term) => [term.id, term]));
  const glossaryTerms = new Set();
  for (const entry of list(contract.glossary)) {
    if (glossaryTerms.has(entry.term)) {
      errors.push(`duplicate i18n glossary term: ${entry.term}`);
    }
    glossaryTerms.add(entry.term);

    const term = termsById.get(entry.term);
    if (!term) {
      errors.push(`unknown i18n glossary term: ${entry.term}`);
      continue;
    }

    for (const [locale, expected] of Object.entries(entry.labels ?? {})) {
      if (!locales.has(locale)) {
        errors.push(`i18n glossary locale is not listed in locales: ${entry.term}.${locale}`);
      }

      const actual = term.text?.labels?.[locale] ?? null;
      if (actual !== expected) {
        errors.push(
          `i18n glossary label mismatch: ${entry.term}.${locale} expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`,
        );
      }
    }
  }
}

function ruleClauseSelectors(rule) {
  const selectors = [];
  for (const field of ["when", "must", "mustNot"]) {
    list(rule[field]).forEach((_clause, index) => {
      selectors.push(`${field}[${index}]`);
    });
  }
  return selectors;
}

function validateCheckTargetCoverageSelectors(errors, rule) {
  const known = new Set(ruleClauseSelectors(rule));
  for (const target of list(rule.checks)) {
    for (const selector of list(target.covers)) {
      if (!known.has(selector)) {
        errors.push(`unknown check target covered clause: ${rule.id} -> ${selector}`);
      }
    }
  }
}

function validate(model, { requireFormalEvidence = false } = {}) {
  const errors = [];
  const terms = list(model.vocabulary);
  const rules = list(model.rules);
  const decisions = list(model.decisions);

  checkUnique(errors, "term id", terms);
  checkUnique(errors, "rule id", rules);
  checkUnique(errors, "decision id", decisions);

  const termIds = new Set(terms.map((term) => term.id));
  const ruleIds = new Set(rules.map((rule) => rule.id));
  const locales = new Set(list(model.locales));

  if (model.clauseAstSemanticsVersion !== CLAUSE_AST_SEMANTICS_VERSION) {
    errors.push(`unsupported Clause.ast semantics version: ${model.clauseAstSemanticsVersion}`);
  }

  if (!locales.has(model.primaryLocale)) {
    errors.push(`primary locale is not listed in locales: ${model.primaryLocale}`);
  }

  for (const term of terms) {
    for (const valueId of list(term.values)) {
      if (!termIds.has(valueId)) {
        errors.push(`unknown term value reference: ${term.id} -> ${valueId}`);
      }
    }
    for (const supersededId of list(term.supersedes)) {
      if (!termIds.has(supersededId)) {
        errors.push(`unknown superseded term reference: ${term.id} -> ${supersededId}`);
      }
    }
  }

  for (const rule of rules) {
    for (const termId of list(rule.terms)) {
      if (!termIds.has(termId)) {
        errors.push(`unknown term reference: ${rule.id} -> ${termId}`);
      }
    }
    for (const exceptionId of list(rule.exceptions)) {
      if (!ruleIds.has(exceptionId)) {
        errors.push(`unknown exception reference: ${rule.id} -> ${exceptionId}`);
      }
    }

    const must = new Set(list(rule.must).map(clauseIdentity));
    for (const clause of list(rule.mustNot)) {
      const identity = clauseIdentity(clause);
      if (must.has(identity)) {
        errors.push(`rule has both must and mustNot: ${rule.id} -> ${identity}`);
      }
    }

    validateClauseAsts(errors, rule, "when");
    validateClauseAsts(errors, rule, "must");
    validateClauseAsts(errors, rule, "mustNot");
    validateCheckTargetCoverageSelectors(errors, rule);
    validateCheckTargetAssuranceDeclarations(errors, model, rule, { requireFormalEvidence });

    const verificationCount = list(rule.checks).length + list(rule.implementedBy).length;
    if (rule.reviewStatus === "approved" && !rule.deprecated && verificationCount === 0) {
      errors.push(`approved rule has no verification target: ${rule.id}`);
    }
  }

  errors.push(...validateDbModel(model));
  errors.push(...validateCloudModel(model));
  errors.push(...validateDataModel(model));
  errors.push(...validateReleaseModel(model));
  errors.push(...validateRuntimeModel(model));
  errors.push(...validateDomainModel(model));
  validateIntentModel(errors, model);
  if (list(intentPattern(model)?.tests).length > 0) errors.push(...validateProtocolTests(model));
  validateDomainPacks(errors, model);
  validateI18nContract(errors, model);
  validateProjections(errors, model);
  errors.push(...validateConformanceModel(model));

  return errors;
}

function validateDomainPackRefs(model) {
  const errors = [];
  let count = 0;

  for (const pack of domainPacks(model)) {
    count += 1;
    const path = pack.path;
    if (!existsSync(resolve(path))) {
      errors.push(`missing domain pack path: ${pack.id} -> ${path}`);
      continue;
    }

    const content = readTextFile(path);
    for (const helper of list(pack.helpers)) {
      count += 1;
      if (!hasSymbol(content, helper.symbol)) {
        errors.push(`missing domain pack helper symbol: ${pack.id}.${helper.id} -> ${path}#${helper.symbol}`);
      }
    }
  }

  return { errors, count };
}

function validateImplementationRefs(model) {
  const errors = [];
  let count = 0;

  const validateReferences = (owner, refs, labels) => {
    for (const ref of list(refs)) {
      count += 1;
      if (!existsSync(resolve(ref.path))) {
        errors.push(`missing ${labels.path}: ${owner} -> ${ref.path}`);
        continue;
      }
      if (!ref.symbol) {
        continue;
      }
      if (!hasModuleSymbol(ref.path, ref.symbol)) {
        errors.push(`missing ${labels.symbol}: ${owner} -> ${ref.path}#${ref.symbol}`);
      }
    }
  };

  for (const rule of list(model.rules)) {
    validateReferences(rule.id, rule.implementedBy, {
      path: "implementation path",
      symbol: "implementation symbol",
    });
  }
  const intent = intentPattern(model);
  for (const process of intentProcesses(intent)) {
    validateReferences(process.id, process.implementedBy, {
      path: "intent process implementation path",
      symbol: "intent process implementation symbol",
    });
    for (const refinement of intentRefinements(process)) {
      validateReferences(`${process.id}.${refinement.id}`, [refinement.implementation], {
        path: "intent refinement implementation path",
        symbol: "intent refinement implementation symbol",
      });
    }
  }
  for (const task of intentAssuranceTasks(intent)) {
    validateReferences(task.id, [task.target], {
      path: "intent assurance task target path",
      symbol: "intent assurance task target symbol",
    });
  }
  const domain = domainPattern(model);
  for (const formalization of list(domain?.formalizations)) {
    validateReferences(formalization.id, [formalization.target], {
      path: "domain formalization target path",
      symbol: "domain formalization target symbol",
    });
  }

  return { errors, count };
}

function validateRuntimeCheckTarget(rule, target, path, anchor) {
  if (!anchor) {
    return [];
  }
  try {
    const manifest = readJsonFile(path, "runtime check target manifest");
    const sources = list(manifest?.sources);
    const found = sources.some((source) => {
      const id = source?.expects?.id;
      return id === anchor || `${source?.provider ?? ""}.${source?.kind ?? ""}.${id ?? ""}` === anchor || source?.path === anchor;
    });
    return found ? [] : [`missing runtime check target source: ${rule.id} -> ${target.ref}`];
  } catch (error) {
    return [`invalid runtime check target manifest: ${rule.id} -> ${target.ref}: ${error.message}`];
  }
}

function validateCheckTargetRef(rule, target) {
  const { path, anchor } = splitRef(target.ref);

  if (target.backend === "manual") {
    return [`manual check target is not machine-verifiable: ${rule.id} -> ${target.ref}`];
  }

  if (target.backend === "lean" && path === "generated:lean") {
    const generatedTheorems = list(target.covers).map((selector) => leanClauseTheoremName(rule.id, selector));
    return anchor && generatedTheorems.includes(anchor)
      ? []
      : [`missing generated lean check target symbol: ${rule.id} -> ${target.ref}`];
  }

  if (!existsSync(resolve(path))) {
    return [`missing check target path: ${rule.id} -> ${target.ref}`];
  }

  if (target.backend === "pkl") {
    const result = spawnSync("pkl", ["eval", path], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      return [`pkl check target failed: ${rule.id} -> ${target.ref}`];
    }
    return [];
  }

  if (target.backend === "runtime") {
    return validateRuntimeCheckTarget(rule, target, path, anchor);
  }

  if (target.backend === "node") {
    if (!anchor) {
      return [`missing check target anchor: ${rule.id} -> ${target.ref}`];
    }
    const content = readTextFile(path);
    if (!hasNodeTestAnchor(content, anchor)) {
      return [`missing check target anchor: ${rule.id} -> ${target.ref}`];
    }
    return [];
  }

  if (target.backend === "playwright") {
    if (!anchor) {
      return [`missing playwright check target anchor: ${rule.id} -> ${target.ref}`];
    }
    const content = readTextFile(path);
    return hasNodeTestAnchor(content, anchor) ? [] : [`missing playwright check target anchor: ${rule.id} -> ${target.ref}`];
  }

  if (target.backend === "lean") {
    if (!anchor) {
      return [`missing lean check target symbol: ${rule.id} -> ${target.ref}`];
    }
    const content = readTextFile(path);
    return hasLeanSymbol(content, anchor) ? [] : [`missing lean check target symbol: ${rule.id} -> ${target.ref}`];
  }

  if (target.backend === "quint") {
    if (!anchor) {
      return [`missing quint check target symbol: ${rule.id} -> ${target.ref}`];
    }
    const content = readTextFile(path);
    return hasQuintSymbol(content, anchor) ? [] : [`missing quint check target symbol: ${rule.id} -> ${target.ref}`];
  }

  if (target.backend === "alloy") {
    if (!anchor) {
      return [`missing alloy check target symbol: ${rule.id} -> ${target.ref}`];
    }
    const content = readTextFile(path);
    return hasAlloySymbol(content, anchor) ? [] : [`missing alloy check target symbol: ${rule.id} -> ${target.ref}`];
  }

  if (anchor) {
    const content = readTextFile(path);
    if (!content.includes(anchor)) {
      return [`missing check target anchor: ${rule.id} -> ${target.ref}`];
    }
  }

  return [];
}

function validateCheckTarget(rule, target, { allowMissingFormalEvidence = false } = {}) {
  const errors = validateCheckTargetRef(rule, target);
  for (const [kind, evidenceRef] of Object.entries(target.assuranceEvidence ?? {})) {
    const { path, anchor } = splitRef(evidenceRef);
    if (!existsSync(resolve(path))) {
      if (allowMissingFormalEvidence && (kind === "bounded" || kind === "proved") && !anchor && path.endsWith(".json")) {
        continue;
      }
      errors.push(`missing check assurance evidence path: ${rule.id} -> ${kind} ${evidenceRef}`);
      continue;
    }
    if (anchor && !readTextFile(path).includes(anchor)) {
      errors.push(`missing check assurance evidence anchor: ${rule.id} -> ${kind} ${evidenceRef}`);
    }
  }
  return errors;
}

function validateCheckTargets(model, rules = list(model.rules), options = {}) {
  const errors = [];
  let count = 0;

  for (const rule of rules) {
    for (const target of list(rule.checks)) {
      count += 1 + Object.keys(target.assuranceEvidence ?? {}).length;
      errors.push(...validateCheckTarget(rule, target, options));
    }
  }

  return { errors, count };
}

function validateDrift(model, options = {}) {
  const modelErrors = validate(model);
  if (modelErrors.length > 0) {
    return { errors: modelErrors, count: 0 };
  }

  const implementations = validateImplementationRefs(model);
  const checks = validateCheckTargets(model, list(model.rules), options);
  const packs = validateDomainPackRefs(model);
  return {
    errors: [...implementations.errors, ...checks.errors, ...packs.errors],
    count: implementations.count + checks.count + packs.count,
  };
}

function validateCoverage(model, options = {}) {
  const drift = validateDrift(model, options);
  if (drift.errors.length > 0) {
    return {
      errors: drift.errors,
      covered: 0,
      total: activeApprovedRules(model).length,
    };
  }

  const errors = [];
  const approved = activeApprovedRules(model);
  let covered = 0;

  for (const rule of approved) {
    const targets = list(rule.checks).filter((target) => target.backend !== "manual" && target.backend !== "runtime");
    if (targets.length === 0) {
      errors.push(`approved rule has no automated check target: ${rule.id}`);
      continue;
    }
    const availableAssurances = new Set(targets.flatMap(checkTargetAssurances));
    const missingAssurances = [...new Set(ruleRequiredAssurances(rule))]
      .filter((kind) => !availableAssurances.has(kind));
    if (missingAssurances.length > 0) {
      for (const kind of missingAssurances) {
        errors.push(`approved rule is missing required assurance: ${rule.id} -> ${kind}`);
      }
      continue;
    }
    if (rule.coverage === "clause") {
      const required = ruleClauseSelectors(rule);
      const coveredClauses = new Set(targets.flatMap((target) => list(target.covers)));
      const missing = required.filter((selector) => !coveredClauses.has(selector));
      if (missing.length > 0) {
        for (const selector of missing) {
          errors.push(`approved rule has uncovered clause: ${rule.id} -> ${selector}`);
        }
        continue;
      }
    }
    covered += 1;
  }

  return {
    errors,
    covered,
    total: approved.length,
  };
}

function parseRenderArgs(args) {
  let locale = null;
  let file = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--locale") {
      locale = args[index + 1];
      index += 1;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  if (!file) {
    throw new CommandError(usage());
  }

  return { file, locale };
}

function parseInitArgs(args) {
  let force = false;
  let json = false;
  let outputFile = "dspec.pkl";
  let lockFile = null;
  let outputSpecified = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") {
      force = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--output") {
      outputFile = args[index + 1] ?? "";
      outputSpecified = true;
      index += 1;
    } else if (arg === "--lock") {
      lockFile = args[index + 1] ?? "";
      index += 1;
    } else if (!arg.startsWith("-") && !outputSpecified) {
      outputFile = arg;
      outputSpecified = true;
    } else {
      throw new CommandError(initUsage());
    }
  }
  if (!outputFile || outputFile.startsWith("-")) throw new CommandError(initUsage());
  if (lockFile !== null && (!lockFile || lockFile.startsWith("-"))) throw new CommandError(initUsage());
  return { force, json, outputFile, lockFile };
}

function parseLockArgs(args) {
  let force = false;
  let json = false;
  let outputFile = null;
  let file = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") {
      force = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--output") {
      outputFile = args[index + 1] ?? "";
      index += 1;
    } else if (!arg.startsWith("-") && !file) {
      file = arg;
    } else {
      throw new CommandError(lockUsage());
    }
  }

  if (!file || (outputFile !== null && (!outputFile || outputFile.startsWith("-")))) {
    throw new CommandError(lockUsage());
  }
  return { file, force, json, outputFile };
}

function parseVerifyArgs(args) {
  let file = null;
  let json = false;
  let lockFile = null;
  let requireLock = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--lock") {
      lockFile = args[index + 1] ?? "";
      index += 1;
    } else if (arg === "--require-lock") {
      requireLock = true;
    } else if (!arg.startsWith("-") && !file) {
      file = arg;
    } else {
      throw new CommandError("usage: dspec verify [--json] [--lock <lock.json>] [--require-lock] <model.pkl>\n");
    }
  }
  if (!file || (lockFile !== null && (!lockFile || lockFile.startsWith("-")))) {
    throw new CommandError("usage: dspec verify [--json] [--lock <lock.json>] [--require-lock] <model.pkl>\n");
  }
  return { file, json, lockFile, requireLock };
}

function parseExplainArgs(args) {
  let file = null;
  let json = false;
  let markdown = false;
  let lockFile = null;
  let requireLock = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--markdown") {
      markdown = true;
    } else if (arg === "--lock") {
      lockFile = args[index + 1] ?? "";
      index += 1;
    } else if (arg === "--require-lock") {
      requireLock = true;
    } else if (!arg.startsWith("-") && !file) {
      file = arg;
    } else {
      throw new CommandError(explainUsage());
    }
  }
  if (!file || (json && markdown) || (lockFile !== null && (!lockFile || lockFile.startsWith("-")))) {
    throw new CommandError(explainUsage());
  }
  return { file, json, markdown, lockFile, requireLock };
}

const SCAFFOLD_RULE_KINDS = new Set([
  "decision",
  "invariant",
  "transition",
  "obligation",
  "permission",
  "prohibition",
  "exception",
  "witness",
  "example",
  "non_goal",
  "equivalence",
]);

function parseScaffoldRuleReference(value, option) {
  const { path, anchor } = splitRef(value);
  if (!path || !anchor) {
    throw new CommandError(`${option} must use path#symbol-or-anchor: ${value}\n`);
  }
  return { path, anchor };
}

function parseScaffoldRuleArgs(args) {
  let json = false;
  let force = false;
  let outputFile = null;
  let kind = "invariant";
  const terms = [];
  let implementation = null;
  let test = null;
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--output") {
      outputFile = args[index + 1] ?? "";
      index += 1;
    } else if (arg === "--kind") {
      kind = args[index + 1] ?? "";
      index += 1;
    } else if (arg === "--term") {
      terms.push(args[index + 1] ?? "");
      index += 1;
    } else if (arg === "--implementation") {
      implementation = parseScaffoldRuleReference(args[index + 1] ?? "", "--implementation");
      index += 1;
    } else if (arg === "--test") {
      test = parseScaffoldRuleReference(args[index + 1] ?? "", "--test");
      index += 1;
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    } else {
      throw new CommandError(scaffoldUsage());
    }
  }

  const [modelFile, ruleId] = positional;
  if (positional.length !== 2 || !modelFile || !ruleId || !SCAFFOLD_RULE_KINDS.has(kind)) {
    throw new CommandError(scaffoldUsage());
  }
  if (!terms.every(Boolean) || (outputFile !== null && (!outputFile || outputFile.startsWith("-")))) {
    throw new CommandError(scaffoldUsage());
  }
  return { modelFile, ruleId, json, force, outputFile, kind, terms, implementation, test };
}

function parseConformanceArgs(args) {
  let json = false;
  let markdown = false;
  let file = null;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }
  if (!file || (json && markdown)) throw new CommandError(usage());
  return { file, json, markdown };
}

function parseTraceabilityArgs(args) {
  let json = false;
  let markdown = false;
  let gate = false;
  let executeFormalTools = false;
  let requireExecutedFormalTools = false;
  let file = null;
  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    if (arg === "--gate") {
      gate = true;
      continue;
    }
    if (arg === "--execute-formal-tools") {
      executeFormalTools = true;
      continue;
    }
    if (arg === "--require-executed-formal-tools") {
      executeFormalTools = true;
      requireExecutedFormalTools = true;
      continue;
    }
    if (!file && !arg.startsWith("-")) {
      file = arg;
      continue;
    }
    throw new CommandError(traceabilityUsage());
  }
  if (!file || (json && markdown)) throw new CommandError(traceabilityUsage());
  return { file, json, markdown, gate, executeFormalTools, requireExecutedFormalTools };
}

function parseFormalMutationArgs(args) {
  let json = false;
  let requireFormalTools = false;
  let file = null;
  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--require-formal-tools") {
      requireFormalTools = true;
      continue;
    }
    if (!file && !arg.startsWith("-")) {
      file = arg;
      continue;
    }
    throw new CommandError(formalMutationUsage());
  }
  if (!file) throw new CommandError(formalMutationUsage());
  return { file, json, requireFormalTools };
}

function traceabilityCounterexample(formalization, kind, check, witness) {
  if (!witness) return null;
  return normalizeCounterexample({
    ...witness,
    source: { kind, check, rule: formalization.rule, formalization: formalization.id },
  });
}

function behaviorTraceabilityEvidence(formalization, document, reference, grounding) {
  const boundedChecks = list(reference.boundedReachability?.checks).map((check) => ({
    id: check.id,
    status: check.status,
    assurance: check.assurance,
    counterexample: check.status === "fail"
      ? traceabilityCounterexample(formalization, "behavior-bounded", check.id, check.witness)
      : null,
  }));
  const temporalChecks = list(reference.temporal?.checks).map((check) => ({
    id: check.id,
    status: check.status,
    assurance: check.assurance,
    counterexample: traceabilityCounterexample(
      formalization,
      "temporal",
      check.id,
      check.witness ?? (check.violation ? { path: [], trace: list(check.trace), violation: check.violation } : null),
    ),
  }));
  return {
    formalization: formalization.id,
    status: reference.status === "pass" && grounding.status === "pass" ? "pass" : "fail",
    actions: list(document.behavior?.actions).map((action) => action.id),
    checks: [...boundedChecks, ...temporalChecks],
    counterexamples: [traceabilityCounterexample(
      formalization,
      "implementation",
      "implementation-grounding",
      grounding.counterexample,
    )].filter(Boolean),
    errors: [...list(reference.errors), ...list(grounding.errors)],
  };
}

function alloyToolExecution(analyzer, { requested, command }) {
  if (!requested) {
    return {
      engine: "alloy6",
      command,
      version: null,
      requested: false,
      status: "not-requested",
      reason: null,
    };
  }
  const version = spawnSync(command, ["version"], { encoding: "utf8" });
  return {
    engine: "alloy6",
    command,
    version: version.status === 0 ? version.stdout.trim() || null : null,
    requested: true,
    status: analyzer.status,
    reason: analyzer.reason ?? null,
  };
}

function alloyTraceabilityEvidence(formalization, reference, analyzer, {
  actions,
  requested,
  required,
  command,
}) {
  const execution = alloyToolExecution(analyzer, { requested, command });
  const analyzerAvailable = execution.status === "pass" || execution.status === "fail";
  const checks = analyzerAvailable ? list(analyzer.checks) : list(reference.checks);
  const toolFailed = execution.status === "fail" || (required && execution.status !== "pass");
  const status = reference.status === "pass" && !toolFailed ? "pass" : "fail";
  const errors = [
    ...list(reference.errors),
    ...list(analyzer?.errors),
    ...(required && execution.status !== "pass"
      ? [`formal tool execution is required but ${execution.engine} is ${execution.status}: ${execution.reason ?? "no executed evidence"}`]
      : []),
  ];
  return {
    formalization: formalization.id,
    status,
    execution,
    actions,
    checks: checks.map((check) => ({
      id: check.id,
      status: check.status,
      assurance: check.assurance,
      counterexample: check.status === "fail"
        ? traceabilityCounterexample(formalization, "alloy", check.id, check.counterexample ?? check.witness)
        : null,
    })),
    counterexamples: [],
    errors,
  };
}

function alloyBehaviorTraceabilityEvidence(formalization, document, reference, analyzer, options) {
  const evidence = alloyTraceabilityEvidence(formalization, reference, analyzer, { actions: [], ...options });
  return {
    // The initial reservation DSL has generated action names, rather than an
    // action catalog. Keep this empty so an explicit mapping cannot silently
    // claim it was executed.
    ...evidence,
  };
}

function normalizedTetrisGroundingCounterexample(counterexample, formalization) {
  if (!counterexample) return null;
  const state = {
    board: `${counterexample.board.width}x${counterexample.board.height}`,
    locked: counterexample.locked.map(([x, y]) => `(${x},${y})`).join(", "),
    "expected spawn-open": counterexample.expected?.spawnOpen ?? null,
    "actual spawn-open": counterexample.actual?.spawnOpen ?? null,
  };
  return traceabilityCounterexample(formalization, "implementation", counterexample.check ?? "implementation-grounding", {
    state,
    expected: counterexample.expected ?? null,
    actual: counterexample.actual ?? null,
    violation: { index: 0, state },
  });
}

function tetrisAlloyTraceabilityEvidence(formalization, reference, analyzer, grounding, options) {
  const evidence = alloyTraceabilityEvidence(formalization, reference, analyzer, {
    actions: ["rotate", "rejectRotation", "translateLeft", "rejectTranslateLeft", "startGameAtSpawn", "blockedSpawnGameOver", "stutter"],
    ...options,
  });
  if (!grounding || grounding.status === "skip") return evidence;
  const groundingCheck = {
    id: grounding.check,
    status: grounding.status,
    assurance: grounding.assurance,
    counterexample: grounding.status === "fail" ? normalizedTetrisGroundingCounterexample(grounding.counterexample, formalization) : null,
  };
  return {
    ...evidence,
    status: evidence.status === "pass" && grounding.status === "pass" ? "pass" : "fail",
    checks: [...evidence.checks, groundingCheck],
    errors: [...evidence.errors, ...list(grounding.errors)],
  };
}

function tetrisLineClearAlloyTraceabilityEvidence(formalization, reference, analyzer, options) {
  return alloyTraceabilityEvidence(formalization, reference, analyzer, {
    actions: ["clearFullRows", "stutter"],
    ...options,
  });
}

async function formalizationEvidence(model, {
  executeFormalTools = false,
  requireExecutedFormalTools = false,
  alloyCommand = process.env.ALLOY6_COMMAND ?? "alloy6",
} = {}) {
  const cache = new Map();
  const analyzerCache = new Map();
  const groundingCache = new Map();
  const entries = [];
  for (const formalization of list(domainPattern(model)?.formalizations)) {
    const path = formalization.target?.path;
    if (!path) {
      entries.push({
        formalization: formalization.id,
        status: "fail",
        actions: [],
        checks: [],
        counterexamples: [],
        errors: [`formalization target path is missing: ${formalization.id}`],
      });
      continue;
    }
    let document;
    try {
      if (!cache.has(path)) cache.set(path, evalPklJson(path));
      document = cache.get(path);
      if (formalization.kind === "behavior") {
        const reference = verifyBehaviorModel(document);
        const grounding = await verifyBehaviorImplementation(document, { projectRoot: process.cwd() });
        entries.push(behaviorTraceabilityEvidence(formalization, document, reference, grounding));
      } else if (formalization.kind === "alloy-behavior") {
        const options = {
          requested: executeFormalTools,
          required: requireExecutedFormalTools,
          command: alloyCommand,
        };
        if (document.tetrisAlloy) {
          if (executeFormalTools && !analyzerCache.has(path)) {
            analyzerCache.set(path, verifyTetrisAlloyWithAnalyzer(document, { command: alloyCommand }));
          }
          if (!groundingCache.has(path)) {
            groundingCache.set(path, await verifyTetrisAlloyImplementation(document, { projectRoot: process.cwd() }));
          }
          entries.push(tetrisAlloyTraceabilityEvidence(formalization, verifyTetrisAlloyModel(document), analyzerCache.get(path) ?? null, groundingCache.get(path), options));
        } else if (document.tetrisLineClearAlloy) {
          if (executeFormalTools && !analyzerCache.has(path)) {
            analyzerCache.set(path, verifyTetrisLineClearAlloyWithAnalyzer(document, { command: alloyCommand }));
          }
          entries.push(tetrisLineClearAlloyTraceabilityEvidence(formalization, verifyTetrisLineClearAlloyModel(document), analyzerCache.get(path) ?? null, options));
        } else {
          if (executeFormalTools && !analyzerCache.has(path)) {
            analyzerCache.set(path, verifyAlloyBehaviorWithAnalyzer(document, { command: alloyCommand }));
          }
          entries.push(alloyBehaviorTraceabilityEvidence(formalization, document, verifyAlloyBehaviorModel(document), analyzerCache.get(path) ?? null, options));
        }
      } else {
        entries.push({
          formalization: formalization.id,
          status: "unexecuted",
          actions: [],
          checks: [],
          counterexamples: [],
          errors: [`no traceability runner for formalization kind: ${formalization.kind}`],
        });
      }
    } catch (error) {
      entries.push({
        formalization: formalization.id,
        status: "fail",
        actions: [],
        checks: [],
        counterexamples: [],
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }
  return entries;
}

function parseQueryArgs(args) {
  let json = false;
  let markdown = false;
  let locale = null;
  let answerFile = null;
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    if (arg === "--locale") {
      locale = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--answer") {
      answerFile = args[index + 1];
      index += 1;
      continue;
    }
    positional.push(arg);
  }

  const [file, kind, id, selector, ...extra] = positional;
  if (!file || !kind || !id || extra.length > 0 || (kind === "clause" && !selector) || (kind !== "clause" && selector) || (json && markdown)) {
    throw new CommandError(usage());
  }
  return { file, kind, id, selector: selector ?? null, locale, answerFile, json, markdown };
}

function parseEmitArgs(args) {
  const [target, ...rest] = args;
  if (!target) {
    throw new CommandError(usage());
  }
  const parsed = parseRenderArgs(rest);
  return { target, ...parsed };
}

function parseVerifyGeneratedArgs(args) {
  let json = false;
  let requireFormalTools = false;
  let skipQuintVerify = false;
  let file = null;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--require-formal-tools") {
      requireFormalTools = true;
      continue;
    }
    if (arg === "--skip-quint-verify") {
      skipQuintVerify = true;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  if (!file || (requireFormalTools && skipQuintVerify)) {
    throw new CommandError(usage());
  }
  return { file, json, requireFormalTools, skipQuintVerify };
}

function parseEvidenceCreateArgs(args) {
  let json = false;
  let outputFile = null;
  let executedAt = null;
  let requireFormalTools = false;
  const intentReportFiles = [];
  const files = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--require-formal-tools") {
      requireFormalTools = true;
      continue;
    }
    if (arg === "--output") {
      outputFile = args[index + 1];
      index += 1;
      if (!outputFile) throw new CommandError("--output requires a manifest path\n");
      continue;
    }
    if (arg === "--executed-at") {
      executedAt = args[index + 1];
      index += 1;
      if (!executedAt) throw new CommandError("--executed-at requires an ISO timestamp\n");
      continue;
    }
    if (arg === "--intent-report") {
      const reportFile = args[index + 1];
      index += 1;
      if (!reportFile) throw new CommandError("--intent-report requires an Intent exercise report path\n");
      intentReportFiles.push(reportFile);
      continue;
    }
    files.push(arg);
  }
  if (files.length !== 1) throw new CommandError(evidenceUsage());
  return {
    modelFile: files[0],
    json,
    outputFile,
    executedAt: executedAt ?? new Date().toISOString(),
    requireFormalTools,
    intentReportFiles,
  };
}

function parseEvidenceVerifyArgs(args) {
  let json = false;
  const files = [];
  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    files.push(arg);
  }
  if (files.length !== 2) throw new CommandError(evidenceUsage());
  return { modelFile: files[0], manifestFile: files[1], json };
}

function parseEvidenceRefreshArgs(args) {
  let json = false;
  let executedAt = null;
  let requireFormalTools = false;
  const intentReportFiles = [];
  const files = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--require-formal-tools") {
      requireFormalTools = true;
      continue;
    }
    if (arg === "--executed-at") {
      executedAt = args[index + 1];
      index += 1;
      if (!executedAt) throw new CommandError("--executed-at requires an ISO timestamp\n");
      continue;
    }
    if (arg === "--intent-report") {
      const reportFile = args[index + 1];
      index += 1;
      if (!reportFile) throw new CommandError("--intent-report requires an Intent exercise report path\n");
      intentReportFiles.push(reportFile);
      continue;
    }
    files.push(arg);
  }
  if (files.length !== 2) throw new CommandError(evidenceUsage());
  return {
    modelFile: files[0],
    manifestFile: files[1],
    json,
    executedAt: executedAt ?? new Date().toISOString(),
    requireFormalTools,
    intentReportFiles,
  };
}

function parseDevshellSmokeArgs(args) {
  let json = false;
  let strict = false;
  let requireStorePath = false;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--strict") {
      strict = true;
      continue;
    }
    if (arg === "--require-store-path") {
      requireStorePath = true;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  return { json, strict, requireStorePath };
}

function parseJsonReportArgs(args) {
  let json = false;
  let file = null;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  if (!file) {
    throw new CommandError(usage());
  }
  return { file, json };
}

function parseTraceArgs(args) {
  const [operation, ...rest] = args;
  if (!operation || !["reconcile", "check"].includes(operation)) {
    throw new CommandError(traceUsage());
  }
  let json = false;
  let gate = false;
  let diff = false;
  let output = null;
  let lock = null;
  let file = null;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--gate" && operation === "check") {
      gate = true;
      continue;
    }
    if (arg === "--diff" && operation === "check") {
      diff = true;
      continue;
    }
    if (arg === "--output" && operation === "reconcile") {
      output = rest[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--lock" && operation === "check") {
      lock = rest[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(traceUsage());
  }
  if (!file || !file.endsWith(".pkl") || (output !== null && !output) || (lock !== null && !lock)) {
    throw new CommandError(traceUsage());
  }
  return { operation, file, json, gate, diff, output, lock };
}

function parseTranslationArgs(args) {
  const [operation, ...rest] = args;
  if (!operation || !["reconcile", "check"].includes(operation)) {
    throw new CommandError(translationUsage());
  }
  let json = false;
  let gate = false;
  let output = null;
  let lock = null;
  let file = null;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--gate" && operation === "check") {
      gate = true;
      continue;
    }
    if (arg === "--output" && operation === "reconcile") {
      output = rest[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--lock" && operation === "check") {
      lock = rest[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(translationUsage());
  }
  if (!file || !file.endsWith(".pkl") || (output !== null && !output) || (lock !== null && !lock)) {
    throw new CommandError(translationUsage());
  }
  return { operation, file, json, gate, output, lock };
}

function parseExternalHoldoutArgs(args) {
  let json = false;
  let markdown = false;
  let file = null;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(usage());
  }

  if (!file || (json && markdown)) {
    throw new CommandError(usage());
  }
  return { file, json, markdown };
}

function parseProjectionArgs(args, usageText = usage(), { allowGenerationOptions = false } = {}) {
  let file = null;
  let dryRun = false;
  let generatedAt = null;
  let json = false;
  let root = ".";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--dry-run" && allowGenerationOptions) {
      dryRun = true;
      continue;
    }
    if (arg === "--generated-at" && allowGenerationOptions) {
      generatedAt = args[index + 1];
      if (!generatedAt) throw new CommandError(usageText);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(generatedAt)) {
        throw new CommandError(`invalid --generated-at: ${generatedAt}`);
      }
      index += 1;
      continue;
    }
    if (arg === "--root") {
      root = args[index + 1];
      if (!root) throw new CommandError(usageText);
      index += 1;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}\n${usageText}`);
  }

  if (!file) throw new CommandError(usageText);
  return { file, dryRun, generatedAt, json, root };
}

function parseProjectionUnlockArgs(args, usageText = generatedUsage()) {
  let force = false;
  let json = false;
  let root = ".";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--root") {
      root = args[index + 1];
      if (!root) throw new CommandError(usageText);
      index += 1;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}\n${usageText}`);
  }
  return { force, json, root };
}

function parseImpactArgs(args) {
  let json = false;
  const files = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    files.push(arg);
  }

  if (files.length !== 2) {
    throw new CommandError(usage());
  }
  return { beforeFile: files[0], afterFile: files[1], json };
}

function parseSpecCompatibilityArgs(args, usageText = usage()) {
  let json = false;
  let markdown = false;
  const files = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    files.push(arg);
  }

  if (files.length !== 2 || (json && markdown)) {
    throw new CommandError(usageText);
  }
  return { beforeFile: files[0], afterFile: files[1], json, markdown };
}

function parseSpecChangeReviewArgs(args, usageText = usage()) {
  let json = false;
  let markdown = false;
  const files = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    files.push(arg);
  }

  if (files.length !== 1 || (json && markdown)) {
    throw new CommandError(usageText);
  }
  return { file: files[0], json, markdown };
}

function parseSpecReadingEvalArgs(args) {
  let json = false;
  let markdown = false;
  let prompt = false;
  let scoreFile = null;
  let runnerFile = null;
  let locale = null;
  let refreshDigests = false;
  let apply = false;
  let writeRunFile = null;
  const files = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    if (arg === "--prompt") {
      prompt = true;
      continue;
    }
    if (arg === "--refresh-digests") {
      refreshDigests = true;
      continue;
    }
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--score") {
      scoreFile = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--runner") {
      runnerFile = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--write-run") {
      writeRunFile = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--locale") {
      locale = args[index + 1];
      index += 1;
      continue;
    }
    files.push(arg);
  }

  if (
    files.length !== 1 ||
    [json, markdown, prompt].filter(Boolean).length > 1 ||
    (prompt && (scoreFile || runnerFile)) ||
    (prompt && refreshDigests) ||
    (refreshDigests && (scoreFile || runnerFile)) ||
    (scoreFile && runnerFile) ||
    (apply && !refreshDigests) ||
    (writeRunFile && !scoreFile && !runnerFile) ||
    (!scoreFile && args.includes("--score")) ||
    (!runnerFile && args.includes("--runner")) ||
    (!writeRunFile && args.includes("--write-run")) ||
    (!locale && args.includes("--locale"))
  ) {
    throw new CommandError(usage());
  }
  return { file: files[0], json, markdown, prompt, scoreFile, runnerFile, locale, refreshDigests, apply, writeRunFile };
}

function parseSpecReadingEvalSuiteArgs(args) {
  let json = false;
  let markdown = false;
  let file = null;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  if (!file || (json && markdown)) {
    throw new CommandError(usage());
  }
  return { file, json, markdown };
}

function parseSpecReadingMetamorphicArgs(args) {
  let json = false;
  let markdown = false;
  let locale = null;
  let file = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    if (arg === "--locale") {
      locale = args[index + 1];
      index += 1;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  if (!file || (json && markdown) || (!locale && args.includes("--locale"))) {
    throw new CommandError(usage());
  }
  return { file, json, markdown, locale };
}

function parseScaffoldSpecChangeReviewArgs(args, usageText = usage()) {
  let id = null;
  let json = false;
  let pkl = false;
  let outputFile = null;
  const files = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--pkl") {
      pkl = true;
      continue;
    }
    if (arg === "--id") {
      id = args[index + 1];
      index += 1;
      if (!id) throw new CommandError("--id requires a review id\n");
      continue;
    }
    if (arg === "--output") {
      outputFile = args[index + 1];
      index += 1;
      if (!outputFile) throw new CommandError("--output requires a review path\n");
      continue;
    }
    files.push(arg);
  }

  if (files.length !== 2 || (json && pkl)) {
    throw new CommandError(usageText);
  }
  return { beforeFile: files[0], afterFile: files[1], id, json, outputFile };
}

function parseVerifyRuntimeEvidenceArgs(args) {
  let json = false;
  let file = null;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  if (!file) {
    throw new CommandError(usage());
  }
  return { file, json };
}

function parseNormalizeCounterexampleArgs(args) {
  let json = false;
  let locale = null;
  let file = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--locale") {
      locale = args[index + 1];
      index += 1;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  if (!file) {
    throw new CommandError(usage());
  }
  return { file, json, locale };
}

function parseImportRuntimeEvidenceArgs(args) {
  let json = false;
  let file = null;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  if (!file) {
    throw new CommandError(usage());
  }
  return { file, json };
}

function parseImportDbSchemaArgs(args) {
  let json = false;
  let file = null;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  if (!file) {
    throw new CommandError(usage());
  }
  return { file, json };
}

function parseCheckSqlQueriesArgs(args) {
  let json = false;
  const files = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    files.push(arg);
  }

  if (files.length !== 2) {
    throw new CommandError(usage());
  }
  return { modelFile: files[0], queryFile: files[1], json };
}

function parseImportRealAppArgs(args) {
  let json = false;
  let pkl = false;
  let root = null;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--pkl") {
      pkl = true;
      continue;
    }
    if (!root) {
      root = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  if (!root || (json && pkl)) {
    throw new CommandError(usage());
  }
  return { root, json: json || !pkl, pkl };
}

function parseReconcileRealAppArgs(args) {
  let json = false;
  const files = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    files.push(arg);
  }

  if (files.length !== 2) {
    throw new CommandError(usage());
  }
  return { modelFile: files[0], observedFile: files[1], json };
}

function parseAppProfileArgs(args) {
  return parseAppProfileArgsModule(args, usage());
}

function parseAppProfileSuiteArgs(args) {
  return parseAppProfileSuiteArgsModule(args, usage());
}

function parseScaffoldAppProfileArgs(args) {
  return parseScaffoldAppProfileArgsModule(args, usage());
}

function parseEvaluateAppProfileArgs(args) {
  return parseEvaluateAppProfileArgsModule(args, usage());
}

function parseEvaluateAppProfileSuiteArgs(args) {
  return parseEvaluateAppProfileArgs(args);
}

function parseCollectRuntimeEvidenceArgs(args) {
  let pkl = false;
  let file = null;

  for (const arg of args) {
    if (arg === "--pkl") {
      pkl = true;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  if (!file) {
    throw new CommandError(usage());
  }
  return { file, pkl };
}

function importDbSchemaFile(file, { json = false } = {}) {
  try {
    const db = importDbSchema(readTextFile(file));
    return json ? stableJson({ db }) : emitDbSchemaPkl(db);
  } catch (error) {
    if (error instanceof DbSchemaImportError) throw new CommandError(error.message);
    throw error;
  }
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function appRootFile(root, path) {
  return join(resolve(root), path);
}

function readOptionalText(root, path) {
  const file = appRootFile(root, path);
  return existsSync(file) ? readTextFile(file) : "";
}

function readOptionalJson(root, path) {
  const file = appRootFile(root, path);
  return existsSync(file) ? readJsonFile(file, path) : null;
}

function appRootId(root) {
  const pkg = readOptionalJson(root, "package.json");
  if (pkg?.name) return pkg.name;
  const normalized = resolve(root).replace(/\/+$/, "");
  return normalized.split("/").pop() || "app";
}

function parseHonoRoutes(source) {
  const routes = [];
  const pattern = /\bapp\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    const path = match[2];
    if (!path.startsWith("/api/")) continue;
    routes.push({
      method: match[1].toUpperCase(),
      path,
      source: "apps/api/src/app.ts",
    });
  }
  return routes.sort((left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method));
}

function parseZodSchemas(source) {
  return sortedUnique([...source.matchAll(/\bexport\s+const\s+([A-Za-z0-9_]+Schema)\s*=/g)].map((match) => match[1]));
}

function workflowStepGate(stepName, command = "") {
  const text = `${stepName}\n${command}`.toLowerCase();
  if (/\btypecheck\b/.test(text)) return "typecheck";
  if (/\bunit\b/.test(text) || /\bpnpm test\b/.test(text)) return "unit";
  if (/\be2e\b/.test(text) || /\bplaywright\b/.test(text)) return "e2e";
  if (/\bvrt\b/.test(text)) return "vrt";
  if (/\bflaker\b/.test(text)) return "flaker";
  return null;
}

function parseWorkflowYaml(source, path) {
  const id = source.match(/^name:\s*["']?([^"'\n]+)["']?/m)?.[1]?.trim() ?? path.replace(/^.*\/|\.ya?ml$/g, "");
  const jobs = [];
  const jobBlock = source.match(/^jobs:\s*\n([\s\S]*)/m)?.[1] ?? "";
  for (const match of jobBlock.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)) {
    jobs.push(match[1]);
  }

  const steps = [];
  let current = null;
  for (const line of source.split(/\r?\n/)) {
    const name = line.match(/^\s*-\s+name:\s*["']?(.+?)["']?\s*$/);
    if (name) {
      current = { name: name[1], run: "" };
      steps.push(current);
      continue;
    }
    const run = line.match(/^\s*run:\s*(.+?)\s*$/);
    if (run && current) {
      current.run = run[1];
    }
  }

  const gates = sortedUnique(steps.map((step) => workflowStepGate(step.name, step.run)));
  const repositories = sortedUnique([...source.matchAll(/repository:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/g)].map((match) => match[1]));
  const artifacts = sortedUnique([...source.matchAll(/name:\s*([A-Za-z0-9_.-]*artifacts?)/gi)].map((match) => match[1]));
  return {
    id,
    path,
    jobs: sortedUnique(jobs),
    steps: steps.map((step) => step.name).sort(),
    gates,
    repositories,
    artifacts,
  };
}

function parseTomlTableIds(source, prefix) {
  return sortedUnique([...source.matchAll(new RegExp(`^\\[${escapeRegex(prefix)}\\.([^\\]]+)\\]`, "gm"))].map((match) => match[1]));
}

function parseTomlString(source, key) {
  return source.match(new RegExp(`^${escapeRegex(key)}\\s*=\\s*"([^"]*)"`, "m"))?.[1] ?? null;
}

function portablePath(path) {
  return path.replaceAll("\\", "/");
}

function walkAppFiles(root, { skip = new Set([".git", "node_modules", ".direnv", ".mooncakes", "dist", "coverage"]) } = {}) {
  const absoluteRoot = resolve(root);
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        files.push(portablePath(relative(absoluteRoot, absolute)));
      }
    }
  };
  visit(absoluteRoot);
  return files.sort();
}

function importInfrastructure(root) {
  const documents = walkAppFiles(root).map((path) => ({ path, source: readOptionalText(root, path) }));
  try {
    return importInfrastructureDocuments(documents);
  } catch (error) {
    if (error instanceof RealAppCoreError) throw new CommandError(error.message);
    throw error;
  }
}

function importRealApp(root) {
  const appTs = readOptionalText(root, "apps/api/src/app.ts");
  const contractsTs = readOptionalText(root, "packages/contracts/src/index.ts");
  const ci = readOptionalText(root, ".github/workflows/ci.yml");
  const weekly = readOptionalText(root, ".github/workflows/weekly-review.yml");
  const flaker = readOptionalText(root, "flaker.toml");
  const vrt = readOptionalJson(root, "vrt.config.json") ?? {};
  const packageJson = readOptionalJson(root, "package.json") ?? {};

  const workflows = [
    ci ? parseWorkflowYaml(ci, ".github/workflows/ci.yml") : null,
    weekly ? parseWorkflowYaml(weekly, ".github/workflows/weekly-review.yml") : null,
  ].filter(Boolean).sort(byId);

  const schemas = parseZodSchemas(contractsTs);
  const routes = parseHonoRoutes(appTs);
  const scripts = Object.keys(packageJson.scripts ?? {}).sort();
  const infrastructure = importInfrastructure(root);
  return {
    id: appRootId(root),
    root: String(root).replace(/\/+$/, ""),
    routes,
    contracts: {
      path: existsSync(appRootFile(root, "packages/contracts/src/index.ts")) ? "packages/contracts/src/index.ts" : null,
      schemas,
    },
    workflows,
    infrastructure,
    quality: {
      flaker: {
        path: existsSync(appRootFile(root, "flaker.toml")) ? "flaker.toml" : null,
        repo: flaker ? `${parseTomlString(flaker, "owner") ?? ""}/${parseTomlString(flaker, "name") ?? ""}`.replace(/^\/|\/$/g, "") : null,
        storage: parseTomlString(flaker, "path"),
        profiles: parseTomlTableIds(flaker, "profile"),
      },
      vrt: {
        path: existsSync(appRootFile(root, "vrt.config.json")) ? "vrt.config.json" : null,
        routes: list(vrt.routes).slice().sort(),
        outputDir: vrt.outputDir ?? null,
        threshold: vrt.threshold ?? null,
      },
    },
    scripts,
  };
}

function realAppImportEvaluationAppRoot(evaluation, file) {
  if (isAbsolute(evaluation.appRoot)) return evaluation.appRoot;
  const relativeToEvaluation = resolvePathRelativeToFile(file, evaluation.appRoot);
  if (existsSync(relativeToEvaluation)) return relativeToEvaluation;
  return resolve(evaluation.appRoot);
}

function realAppImportEvaluationReport(evaluation, file) {
  const app = importRealApp(realAppImportEvaluationAppRoot(evaluation, file));
  return evaluateRealAppImport(evaluation, app);
}

function renderRealAppImportEvaluationReport(report) {
  if (report.status === "pass") {
    return `ok: ${report.evaluation.id} real app import precision ${report.summary.precision} recall ${report.summary.recall}\n`;
  }
  return `${report.errors.join("\n")}\n`;
}

function externalHoldoutPath(ownerFile, path) {
  if (isAbsolute(path)) return path;
  const fromOwner = resolvePathRelativeToFile(ownerFile, path);
  if (existsSync(fromOwner)) return fromOwner;
  return resolve(path);
}

function externalRealAppImportHoldoutReport(holdout, corpusFile) {
  const evaluationFile = externalHoldoutPath(corpusFile, holdout.evaluationPath);
  const evaluation = loadRealAppImportEvaluation(evaluationFile);
  const appRoot = realAppImportEvaluationAppRoot(evaluation, evaluationFile);
  const app = importRealApp(appRoot);
  const evaluationReport = evaluateRealAppImport(evaluation, app);
  return {
    holdout: {
      id: holdout.id,
      sourceRepository: holdout.sourceRepository,
      sourceRevision: holdout.sourceRevision,
      capturedOn: holdout.capturedOn,
      estimatedAuthoringMinutes: holdout.estimatedAuthoringMinutes,
      manualMappings: list(holdout.manualMappings),
      exclusions: list(holdout.exclusions),
    },
    authoredIntent: {
      evaluationPath: holdout.evaluationPath,
      facts: normalizeRealAppImportFacts(list(evaluation.expectedFacts)),
    },
    observedImplementation: {
      appRoot: evaluation.appRoot,
      facts: realAppImportFacts(app),
    },
    evaluation: evaluationReport,
  };
}

function externalRealAppImportMutationReport(mutation, corpusFile) {
  const beforeApp = importRealApp(externalHoldoutPath(corpusFile, mutation.beforeAppRoot));
  const afterApp = importRealApp(externalHoldoutPath(corpusFile, mutation.afterAppRoot));
  const delta = diffRealAppImportFacts(realAppImportFacts(beforeApp), realAppImportFacts(afterApp));
  return externalHoldoutMutationReport({
    id: mutation.id,
    sourceRepository: mutation.sourceRepository,
    sourceBeforeRevision: mutation.sourceBeforeRevision,
    sourceAfterRevision: mutation.sourceAfterRevision,
    beforeAppRoot: mutation.beforeAppRoot,
    afterAppRoot: mutation.afterAppRoot,
    expectedAddedFacts: list(mutation.expectedAddedFacts),
    expectedRemovedFacts: list(mutation.expectedRemovedFacts),
    addedFacts: delta.added,
    removedFacts: delta.removed,
  });
}

function externalRealAppImportCorpusReport(corpus, corpusFile) {
  const holdouts = list(corpus.holdouts).map((holdout) => externalRealAppImportHoldoutReport(holdout, corpusFile));
  const mutations = list(corpus.mutations).map((mutation) => externalRealAppImportMutationReport(mutation, corpusFile));
  return externalHoldoutCorpusReport({
    id: corpus.id,
    holdouts,
    mutations,
  });
}

function emitPklRecord(lines, indent, className, fields) {
  lines.push(`${indent}new d.${className} {`);
  for (const [field, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      pushPklListing(lines, `${indent}  `, field, value);
    } else {
      pushPklField(lines, `${indent}  `, field, value);
    }
  }
  lines.push(`${indent}}`);
}

function emitRealAppPkl(app) {
  const domain = realAppObservedDomain(app);
  const infrastructureResources = list(app.infrastructure?.resources);
  const infrastructureById = new Map(infrastructureResources.map((resource) => [resource.id, resource]));
  const infrastructureBindings = new Map(
    infrastructureResources
      .filter((resource) => resource.owner)
      .map((resource) => [infrastructureBindingId(resource), resource]),
  );
  const lines = ["patterns = new d.PatternCatalog {", "  cloud = new d.CloudModel {"];
  lines.push("    zones {");
  emitPklRecord(lines, "      ", "CloudZone", { id: "public", exposure: "public" });
  emitPklRecord(lines, "      ", "CloudZone", { id: "private", exposure: "private" });
  emitPklRecord(lines, "      ", "CloudZone", { id: "ci", exposure: "private" });
  lines.push("    }");
  lines.push("    nodes {");
  const nodeKind = { "public-client": "internet", dashboard: "service", api: "service", contracts: "service", "github-actions": "service", flaker: "service", vrt: "service" };
  const nodeZone = { "public-client": "public", dashboard: "public", api: "private", contracts: "private", "github-actions": "ci", flaker: "ci", vrt: "ci" };
  for (const id of domain.cloud.nodes) {
    const resource = infrastructureById.get(id);
    emitPklRecord(lines, "      ", "CloudNode", {
      id,
      kind: resource ? infrastructureCloudNodeKind(resource) : nodeKind[id] ?? "service",
      zone: nodeZone[id] ?? "private",
    });
  }
  lines.push("    }");
  lines.push("    flows {");
  const flowDefaults = {
    "public-to-dashboard": { from: "public-client", to: "dashboard", action: "request" },
    "dashboard-to-api": { from: "dashboard", to: "api", action: "request" },
    "api-to-contracts": { from: "api", to: "contracts", action: "validate" },
    "github-actions-to-flaker": { from: "github-actions", to: "flaker", action: "run" },
    "github-actions-to-vrt": { from: "github-actions", to: "vrt", action: "snapshot" },
  };
  for (const id of domain.cloud.flows) {
    const resource = infrastructureBindings.get(id);
    const fields = resource
      ? { from: resource.owner, to: resource.id, action: "bind" }
      : flowDefaults[id];
    emitPklRecord(lines, "      ", "CloudFlow", { id, ...fields });
  }
  lines.push("    }", "  }", "  data = new d.DataModel {", "    policies {");
  emitPklRecord(lines, "      ", "DataPolicy", { id: "public-policy", classification: "public", maxRetentionDays: 365 });
  emitPklRecord(lines, "      ", "DataPolicy", { id: "operational-policy", classification: "internal", maxRetentionDays: 90 });
  lines.push("    }", "    datasets {");
  const datasetClass = { "dashboard-snapshot": "public", incident: "internal", "service-detail": "internal" };
  for (const id of domain.data.datasets) emitPklRecord(lines, "      ", "DataSet", { id, classification: datasetClass[id] ?? "internal", retentionDays: id === "dashboard-snapshot" ? 30 : 90 });
  lines.push("    }", "    stores {");
  for (const id of domain.data.stores) {
    const resource = infrastructureById.get(id);
    emitPklRecord(lines, "      ", "DataStore", {
      id,
      region: resource?.environment ?? "local",
      encrypted: resource ? false : true,
      deletionSupported: resource ? false : true,
    });
  }
  lines.push("    }", "    flows {");
  const dataFlowDefaults = {
    "api-to-dashboard-data": { dataset: "dashboard-snapshot", from: "api-memory", to: "dashboard-cache", purpose: "operator-dashboard" },
    "ci-to-flaker-data": { dataset: "incident", from: "github-actions-artifacts", to: "flaker-duckdb", purpose: "quality-signal", legalBasis: "operational-need" },
  };
  for (const id of domain.data.flows) emitPklRecord(lines, "      ", "DataFlow", { id, ...dataFlowDefaults[id] });
  lines.push("    }", "  }", "  release = new d.ReleaseModel {", "    services {");
  for (const id of domain.release.services) emitPklRecord(lines, "      ", "ReleaseService", { id, critical: !infrastructureById.has(id) });
  lines.push("    }", "    environments {");
  for (const id of domain.release.environments) {
    emitPklRecord(lines, "      ", "ReleaseEnvironment", { id, production: id === "production" || id.endsWith("/production") });
  }
  lines.push("    }", "    gates {");
  for (const id of domain.release.gates) emitPklRecord(lines, "      ", "ReleaseGate", { id, kind: "test" });
  lines.push("    }", "  }", "  runtime = new d.RuntimeModel {", "    services {");
  for (const id of domain.runtime.services) emitPklRecord(lines, "      ", "RuntimeService", { id, critical: !infrastructureById.has(id) });
  lines.push("    }", "    dependencies {");
  for (const id of domain.runtime.dependencies) {
    const resource = infrastructureBindings.get(id);
    emitPklRecord(lines, "      ", "RuntimeDependency", resource
      ? {
          id,
          service: resource.owner,
          target: resource.id,
          kind: infrastructureDependencyKind(resource),
          retryable: false,
          idempotent: false,
        }
      : { id, service: "dashboard", target: "api", kind: "http", timeoutMs: 2000, retryable: true, idempotent: true });
  }
  lines.push("    }", "  }", "}");
  return `${lines.join("\n")}\n`;
}

function importRealAppFile(root, { json = true, pkl = false } = {}) {
  const app = importRealApp(root);
  if (pkl) return emitRealAppPkl(app);
  return json ? stableJson({ app }) : stableJson({ app });
}

function observedSet(domain, path) {
  let current = domain;
  for (const key of path) current = current?.[key];
  return new Set(list(current));
}

function restoreObservedFactSuggestion(kind, id, path, extra = {}) {
  return {
    kind: "implementation-missing",
    action: "restore-observed-fact",
    message: `Restore ${kind} "${id}" in the implementation, or update the spec at ${path} if it was intentionally removed.`,
    path,
    ...extra,
  };
}

function restoreObservedReleaseGateSuggestion(stepId, gate, path) {
  return restoreObservedFactSuggestion("release gate", gate, path, {
    message: `Restore release gate "${gate}" on release step "${stepId}", or update the spec at ${path} if the gate is intentionally gone.`,
    step: stepId,
    observedPath: `observed.app.workflows.${stepId}.gates`,
  });
}

function modelObservedFactSuggestion(element) {
  return {
    kind: "spec-missing",
    action: "model-observed-fact",
    message: `Model observed ${element.kind} "${element.id}" at ${element.path}, or remove the implementation fact if it is unintended.`,
    path: element.path,
    candidates: list(element.candidates),
  };
}

function renderReportSuggestions(suggestions) {
  return list(suggestions).map((suggestion) => `suggestion: ${suggestion.message}`);
}

function pushExpectedPresence(errors, checks, suggestions, observed, kind, id, path) {
  const pass = observed.has(id);
  const suggestion = pass ? null : restoreObservedFactSuggestion(kind, id, path);
  checks.push({ id, kind, path, status: pass ? "pass" : "fail", ...(suggestion ? { suggestion } : {}) });
  if (!pass) {
    errors.push(`missing observed ${kind}: ${id}`);
    suggestions.push(suggestion);
  }
}

function reconcileRealAppReport(model, observedDocument) {
  const errors = validate(model);
  const app = observedDocument?.app ?? observedDocument;
  const domain = observedDocument?.domain ?? (app ? realAppObservedDomain(app) : null);
  const checks = [];
  const suggestions = [];
  if (!domain) {
    errors.push("missing observed real app facts");
  }

  if (domain) {
    const cloud = cloudPattern(model);
    if (cloud) {
      const nodes = observedSet(domain, ["cloud", "nodes"]);
      cloudNodes(cloud).forEach((node, index) => pushExpectedPresence(errors, checks, suggestions, nodes, "cloud node", node.id, `model.patterns.cloud.nodes[${index}]`));
      const flows = observedSet(domain, ["cloud", "flows"]);
      cloudFlows(cloud).forEach((flow, index) => pushExpectedPresence(errors, checks, suggestions, flows, "cloud flow", flow.id, `model.patterns.cloud.flows[${index}]`));
    }

    const data = dataPattern(model);
    if (data) {
      const datasets = observedSet(domain, ["data", "datasets"]);
      dataSets(data).forEach((dataset, index) => pushExpectedPresence(errors, checks, suggestions, datasets, "data dataset", dataset.id, `model.patterns.data.datasets[${index}]`));
      const stores = observedSet(domain, ["data", "stores"]);
      dataStores(data).forEach((store, index) => pushExpectedPresence(errors, checks, suggestions, stores, "data store", store.id, `model.patterns.data.stores[${index}]`));
      const flows = observedSet(domain, ["data", "flows"]);
      dataFlows(data).forEach((flow, index) => pushExpectedPresence(errors, checks, suggestions, flows, "data flow", flow.id, `model.patterns.data.flows[${index}]`));
    }

    const release = releasePattern(model);
    if (release) {
      const services = observedSet(domain, ["release", "services"]);
      releaseServices(release).forEach((service, index) => pushExpectedPresence(errors, checks, suggestions, services, "release service", service.id, `model.patterns.release.services[${index}]`));
      const gates = observedSet(domain, ["release", "gates"]);
      releaseGates(release).forEach((gate, index) => pushExpectedPresence(errors, checks, suggestions, gates, "release gate", gate.id, `model.patterns.release.gates[${index}]`));
      const workflows = new Map(list(app.workflows).map((workflow) => [workflow.id, new Set(list(workflow.gates))]));
      releaseSteps(release).forEach((step, index) => {
        const workflowGates = workflows.get(step.id);
        const stepPass = Boolean(workflowGates);
        const stepPath = `model.patterns.release.steps[${index}]`;
        const stepSuggestion = stepPass ? null : restoreObservedFactSuggestion("release step", step.id, stepPath);
        checks.push({ id: step.id, kind: "release step", path: stepPath, status: stepPass ? "pass" : "fail", ...(stepSuggestion ? { suggestion: stepSuggestion } : {}) });
        if (!stepPass) {
          errors.push(`missing observed release step: ${step.id}`);
          suggestions.push(stepSuggestion);
        }
        for (const gate of list(step.gates)) {
          const pass = Boolean(workflowGates?.has(gate));
          const gatePath = `model.patterns.release.steps[${index}].gates`;
          const suggestion = pass ? null : restoreObservedReleaseGateSuggestion(step.id, gate, gatePath);
          checks.push({ id: `${step.id}.${gate}`, kind: "release step gate", path: gatePath, status: pass ? "pass" : "fail", ...(suggestion ? { suggestion } : {}) });
          if (!pass) {
            errors.push(`missing observed release gate: ${step.id} -> ${gate}`);
            suggestions.push(suggestion);
          }
        }
      });
    }

    const runtime = runtimePattern(model);
    if (runtime) {
      const services = observedSet(domain, ["runtime", "services"]);
      runtimeServices(runtime).forEach((service, index) => pushExpectedPresence(errors, checks, suggestions, services, "runtime service", service.id, `model.patterns.runtime.services[${index}]`));
      const dependencies = observedSet(domain, ["runtime", "dependencies"]);
      runtimeDependencies(runtime).forEach((dependency, index) => pushExpectedPresence(errors, checks, suggestions, dependencies, "runtime dependency", dependency.id, `model.patterns.runtime.dependencies[${index}]`));
      const slos = observedSet(domain, ["runtime", "slos"]);
      runtimeSlos(runtime).forEach((slo, index) => pushExpectedPresence(errors, checks, suggestions, slos, "runtime slo", slo.id, `model.patterns.runtime.slos[${index}]`));
    }
  }

  const covered = checks.filter((check) => check.status === "pass").length;
  return {
    model: modelReport(model),
    observed: app ? { id: app.id } : null,
    status: reportStatus(errors),
    covered,
    total: checks.length,
    checks,
    ...(suggestions.length > 0 ? { suggestions } : {}),
    errors,
  };
}

function renderRealAppReconciliationReport(report) {
  if (report.status === "pass") {
    return `ok: ${report.model.id} real app reconciliation (${report.covered}/${report.total} facts)\n`;
  }
  return `${[...report.errors, ...renderReportSuggestions(report.suggestions)].join("\n")}\n`;
}

function modelReverseCoverageElements(model) {
  const elements = domainCoverageElements(model);
  const release = releasePattern(model);
  if (release) {
    releaseGates(release).forEach((gate, index) => {
      elements.push(domainCoverageElement("release.gate", gate.id, `model.patterns.release.gates[${index}]`));
    });
  }
  return elements.sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`));
}

function observedDomainCoverageElements(domain) {
  const elements = [];
  const pushMany = (kind, ids, path) => {
    list(ids).forEach((id, index) => {
      elements.push(domainCoverageElement(kind, id, `${path}[${index}]`));
    });
  };
  pushMany("cloud.node", domain?.cloud?.nodes, "observed.domain.cloud.nodes");
  pushMany("cloud.flow", domain?.cloud?.flows, "observed.domain.cloud.flows");
  pushMany("data.dataset", domain?.data?.datasets, "observed.domain.data.datasets");
  pushMany("data.store", domain?.data?.stores, "observed.domain.data.stores");
  pushMany("data.flow", domain?.data?.flows, "observed.domain.data.flows");
  pushMany("release.service", domain?.release?.services, "observed.domain.release.services");
  pushMany("release.gate", domain?.release?.gates, "observed.domain.release.gates");
  pushMany("release.step", domain?.release?.steps, "observed.domain.release.steps");
  pushMany("runtime.service", domain?.runtime?.services, "observed.domain.runtime.services");
  pushMany("runtime.dependency", domain?.runtime?.dependencies, "observed.domain.runtime.dependencies");
  pushMany("runtime.slo", domain?.runtime?.slos, "observed.domain.runtime.slos");
  return elements.sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`));
}

function reverseCoverageReport(model, observedDocument) {
  const errors = validate(model);
  const app = observedDocument?.app ?? observedDocument;
  const domain = observedDocument?.domain ?? (app ? realAppObservedDomain(app) : null);
  if (!domain) {
    errors.push("missing observed real app facts");
  }

  const modelKeys = new Set(modelReverseCoverageElements(model).map((element) => `${element.kind}:${element.id}`));
  const elements = domain ? observedDomainCoverageElements(domain).map((element) => ({
    ...element,
    coveredByModel: modelKeys.has(`${element.kind}:${element.id}`),
  })) : [];
  const uncovered = elements.filter((element) => !element.coveredByModel);
  for (const element of uncovered) {
    element.suggestion = modelObservedFactSuggestion(element);
  }
  errors.push(...uncovered.map((element) => `unmodeled observed fact: ${element.kind} ${element.id} at ${element.path}`));
  const suggestions = uncovered.map((element) => element.suggestion);

  return {
    model: modelReport(model),
    observed: app ? { id: app.id } : null,
    status: reportStatus(errors),
    covered: elements.length - uncovered.length,
    total: elements.length,
    elements,
    uncovered,
    ...(suggestions.length > 0 ? { suggestions } : {}),
    errors,
  };
}

function renderReverseCoverageReport(report) {
  if (report.status === "pass") {
    return `ok: ${report.model.id} reverse coverage (${report.covered}/${report.total} observed facts)\n`;
  }
  return `${[...report.errors, ...renderReportSuggestions(report.suggestions)].join("\n")}\n`;
}

function appProfileGateSet(profile) {
  return appProfileGateSetModule(profile);
}

function appProfileStep(id, report, extra = {}) {
  return appProfileStepModule(id, report, extra);
}

function appProfileImportStep(app) {
  return appProfileImportStepModule(app);
}

function appProfileObservedFixtureStep(profile, importedDocument, { dryRun = false, fix = false } = {}) {
  return appProfileObservedFixtureStepModule(profile, importedDocument, { dryRun, fix }, {
    stableJson,
    exists: existsSync,
    resolve,
    read: (path) => readFileSync(path, "utf8"),
    write: writeFileSync,
  });
}

function appProfileReportContext() {
  return {
    loadModel,
    importRealApp,
    checkReport,
    driftReport,
    domainCoverageReport,
    reconcileRealAppReport,
    reverseCoverageReport,
    observedFixtureStep: appProfileObservedFixtureStep,
    loadAppProfile,
    reportStatus,
    sortedUnique,
  };
}

function appProfileReport(profile, options = {}) {
  return appProfileReportModule(profile, options, appProfileReportContext());
}

function appProfilesReport(reports) {
  return appProfilesReportModule(reports, appProfileReportContext());
}

function appProfilesCommandReport(files, options = {}) {
  return appProfilesCommandReportModule(files, options, appProfileReportContext());
}

function appProfileCommandReport(files, options = {}) {
  return appProfileCommandReportModule(files, options, appProfileReportContext());
}

function appProfileSuiteReport(suite, options = {}) {
  return appProfileSuiteReportModule(suite, options, appProfileReportContext());
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function renderAppProfileMarkdownReport(report) {
  return renderAppProfileMarkdownReportModule(report);
}

function renderAppProfileReport(report) {
  return renderAppProfileReportModule(report);
}

function scaffoldAppProfileDocument({ modelFile, appRoot, observedFacts = null, gates = [] } = {}) {
  return scaffoldAppProfileDocumentModule({ modelFile, appRoot, observedFacts, gates }, appProfileScaffoldContext());
}

function appProfileScaffoldContext() {
  return {
    appRootId,
    resolve,
    write: writeFileSync,
  };
}

function pklImportPath(fromFile, targetFile) {
  const raw = relative(dirname(resolve(fromFile)), resolve(targetFile)).replace(/\\/g, "/");
  return raw.startsWith(".") ? raw : `./${raw}`;
}

function initializedModelId(outputFile) {
  const normalized = basename(outputFile, ".pkl")
    .replace(/[^A-Za-z0-9_.\-/]+/g, "-")
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  return normalized || "dspec-model";
}

function installedSchemaPath(outputFile) {
  let directory = dirname(resolve(outputFile));
  while (true) {
    const candidate = join(directory, "node_modules", "@mizchi", "dspec", "dspec", "Schema.pkl");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "dspec", "Schema.pkl");
}

function renderInitializedModel({ id, schemaImportPath }) {
  return `import ${pklString(schemaImportPath)} as d

model: d.Model = new {
  id = ${pklString(id)}
  name = d.text("仕様", "Specification")
  version = "0.1.0"
  primaryLocale = "en"
  locales { "en" }
}
`;
}

function defaultSchemaLockPath(modelFile) {
  const extension = ".pkl";
  const base = modelFile.endsWith(extension) ? modelFile.slice(0, -extension.length) : modelFile;
  return `${base}.lock.json`;
}

function defaultTraceLockPath(modelFile) {
  const extension = ".pkl";
  const base = modelFile.endsWith(extension) ? modelFile.slice(0, -extension.length) : modelFile;
  return `${base}.trace.lock.json`;
}

function defaultTranslationLockPath(modelFile) {
  const extension = ".pkl";
  const base = modelFile.endsWith(extension) ? modelFile.slice(0, -extension.length) : modelFile;
  return `${base}.translation.lock.json`;
}

function relativeWorktreePath(path) {
  return relative(process.cwd(), resolve(path)).replaceAll("\\", "/");
}

function changedWorktreePaths() {
  const tracked = spawnSync("git", ["diff", "--name-only", "HEAD"], { encoding: "utf8" });
  if (tracked.status !== 0) return { paths: new Set(), error: tracked.stderr || "git diff failed" };
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" });
  if (untracked.status !== 0) return { paths: new Set(), error: untracked.stderr || "git ls-files failed" };
  return {
    paths: new Set(`${tracked.stdout}\n${untracked.stdout}`.split("\n").map((path) => path.trim()).filter(Boolean)),
    error: null,
  };
}

function traceKeyPath(key) {
  const separator = String(key).indexOf(":");
  if (separator < 0) return null;
  const pathAndSymbol = String(key).slice(separator + 1);
  return pathAndSymbol.split("#", 1)[0];
}

function scopeTraceReportToDiff(report, modelFile) {
  const changed = changedWorktreePaths();
  if (changed.error) {
    return {
      ...report,
      status: "fail",
      errors: [...report.errors, `trace diff scope failed: ${changed.error.trim()}`],
      scope: { kind: "diff", changedPaths: [] },
    };
  }
  const modelPath = relativeWorktreePath(modelFile);
  const drift = report.drift.filter((entry) => {
    if (entry.kind.startsWith("rule-")) return changed.paths.has(modelPath);
    const sourcePath = traceKeyPath(entry.key);
    return sourcePath !== null && changed.paths.has(sourcePath);
  });
  return {
    ...report,
    status: report.errors.length === 0 && drift.length === 0 ? "pass" : "fail",
    drift,
    scope: { kind: "diff", changedPaths: [...changed.paths].sort() },
  };
}

function renderTraceReport(report) {
  if (report.status === "pass") {
    return `ok: ${report.model.id} trace (${report.scope?.kind ?? "all"}, ${report.coverage.filter((entry) => entry.status === "verified").length}/${report.coverage.length} verified)\n`;
  }
  const lines = ["trace drift:"];
  for (const entry of report.drift) {
    lines.push(`  ${entry.kind}: ${entry.rule} -> ${entry.key}`);
  }
  for (const error of report.errors) lines.push(`  error: ${error}`);
  return `${lines.join("\n")}\n`;
}

function runTrace(args) {
  if (hasHelpFlag(args)) {
    process.stdout.write(traceUsage());
    return;
  }
  const options = parseTraceArgs(args);
  const document = loadTraceDocument(options.file);
  if (options.operation === "reconcile") {
    const snapshot = traceSnapshot(document);
    if (snapshot.status === "fail") throw new CommandError(`${snapshot.errors.join("\n")}\n`);
    const lock = createTraceLock(snapshot);
    const output = resolve(options.output ?? defaultTraceLockPath(options.file));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, stableJson(lock));
    const report = { status: "pass", model: snapshot.model, lock: { path: output, rules: lock.rules.length, digest: sha256Digest(stableJson(lock)) } };
    if (options.json) {
      process.stdout.write(stableJson(report));
      return;
    }
    process.stdout.write(`ok: reconciled trace ${report.lock.path} (${report.lock.rules} rules)\n`);
    return;
  }

  const lockPath = resolve(options.lock ?? defaultTraceLockPath(options.file));
  if (!existsSync(lockPath)) {
    throw new CommandError(`trace lock not found: ${lockPath}; run dspec trace reconcile ${options.file}\n`);
  }
  let report = traceCheck(document, readJsonFile(lockPath, "trace lock"));
  if (options.diff) report = scopeTraceReportToDiff(report, options.file);
  else report = { ...report, scope: { kind: "all", changedPaths: [] } };
  if (options.json) process.stdout.write(stableJson(report));
  else process.stdout.write(renderTraceReport(report));
  if (options.gate && report.status === "fail") {
    throw new CommandError("trace gate failed\n");
  }
}

function renderTranslationReport(report) {
  if (report.status === "pass") {
    return `ok: ${report.model.id} translations (${report.entries.length} bindings)\n`;
  }
  const lines = ["translation drift:"];
  for (const entry of report.drift) lines.push(`  ${entry.kind}: ${entry.key}`);
  for (const error of report.errors) lines.push(`  error: ${error}`);
  return `${lines.join("\n")}\n`;
}

function runTranslation(args) {
  if (hasHelpFlag(args)) {
    process.stdout.write(translationUsage());
    return;
  }
  const options = parseTranslationArgs(args);
  const document = loadTraceDocument(options.file);
  if (options.operation === "reconcile") {
    const snapshot = translationSnapshot(document);
    if (snapshot.status === "fail") throw new CommandError(`${snapshot.errors.join("\n")}\n`);
    const lock = createTranslationLock(snapshot);
    const output = resolve(options.output ?? defaultTranslationLockPath(options.file));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, stableJson(lock));
    const report = {
      status: "pass",
      model: snapshot.model,
      lock: { path: output, bindings: lock.entries.length, digest: sha256Digest(stableJson(lock)) },
    };
    if (options.json) {
      process.stdout.write(stableJson(report));
      return;
    }
    process.stdout.write(`ok: reconciled translations ${report.lock.path} (${report.lock.bindings} bindings)\n`);
    return;
  }

  const lockPath = resolve(options.lock ?? defaultTranslationLockPath(options.file));
  if (!existsSync(lockPath)) {
    throw new CommandError(`translation lock not found: ${lockPath}; run dspec translation reconcile ${options.file}\n`);
  }
  const report = translationCheck(document, readJsonFile(lockPath, "translation lock"));
  if (options.json) process.stdout.write(stableJson(report));
  else process.stdout.write(renderTranslationReport(report));
  if (options.gate && report.status === "fail") {
    throw new CommandError("translation gate failed\n");
  }
}

function schemaImportFromModel(modelFile) {
  const source = readTextFile(modelFile);
  const importPath = source.match(/^\s*import\s+"([^"\n]*Schema\.pkl)"\s+as\s+[A-Za-z_][A-Za-z0-9_]*\s*$/m)?.[1];
  if (!importPath) {
    throw new CommandError(`model does not import a Schema.pkl module: ${modelFile}\n`);
  }
  return importPath;
}

function enclosingPklProject(modelFile) {
  let directory = dirname(resolve(modelFile));
  while (true) {
    const projectFile = join(directory, "PklProject");
    if (existsSync(projectFile)) return projectFile;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function localPklDependencyRoot(modelFile, alias) {
  const projectFile = enclosingPklProject(modelFile);
  if (!projectFile) return null;
  const projectSource = readFileSync(projectFile, "utf8");
  const declaration = projectSource.match(new RegExp(`\\["${escapeRegex(alias)}"\\]\\s*=\\s*import\\("([^"\\n]+)"\\)`));
  if (!declaration) return null;
  const dependencyProject = resolve(dirname(projectFile), declaration[1]);
  return dirname(dependencyProject);
}

function resolveSchemaModulePath(modelFile, importPath) {
  if (!importPath.startsWith("@")) return resolvePathRelativeToFile(modelFile, importPath);
  const match = importPath.match(/^@([^/]+)\/(.+)$/);
  if (!match) throw new CommandError(`unsupported schema import: ${importPath}\n`);
  const dependencyRoot = localPklDependencyRoot(modelFile, match[1]);
  if (!dependencyRoot) {
    throw new CommandError(`schema lock requires a local Pkl dependency: ${importPath}\n`);
  }
  return resolve(dependencyRoot, match[2]);
}

function schemaModuleFiles(schemaFile, seen = new Set()) {
  const absolutePath = resolve(schemaFile);
  if (seen.has(absolutePath)) return [];
  seen.add(absolutePath);
  if (!existsSync(absolutePath)) {
    throw new CommandError(`schema module does not exist: ${absolutePath}\n`);
  }
  const source = readFileSync(absolutePath, "utf8");
  const inherited = Array.from(source.matchAll(/^\s*(?:amends|extends)\s+"([^"\n]+)"/gm), (match) => match[1])
    .filter((path) => !path.includes(":"));
  return [absolutePath, ...inherited.flatMap((path) => schemaModuleFiles(resolve(dirname(absolutePath), path), seen))];
}

function schemaPackage(schemaFile) {
  let directory = dirname(resolve(schemaFile));
  while (true) {
    const manifestPath = join(directory, "package.json");
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        if (typeof manifest.name === "string" && typeof manifest.version === "string") {
          return { name: manifest.name, version: manifest.version };
        }
      } catch {
        // A malformed package manifest does not prevent file-level schema locking.
      }
    }
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function schemaLockDocument(modelFile, lockFile) {
  const importPath = schemaImportFromModel(modelFile);
  const schemaFile = resolveSchemaModulePath(modelFile, importPath);
  const modules = schemaModuleFiles(schemaFile);
  const files = [modules[0], ...modules.slice(1).sort()]
    .map((path) => ({ path: pklImportPath(lockFile, path), digest: fileDigest(path) }));
  return {
    schemaLockVersion: 1,
    model: {
      schemaImportPath: importPath,
    },
    schema: {
      rootPath: pklImportPath(lockFile, schemaFile),
      files,
      package: schemaPackage(schemaFile),
    },
  };
}

function writeSchemaLock({ modelFile, lockFile, force = false }) {
  const outputPath = resolve(lockFile);
  if (existsSync(outputPath) && !force) {
    throw new CommandError(`refusing to overwrite existing schema lock: ${lockFile}; use --force\n`);
  }
  const document = schemaLockDocument(modelFile, outputPath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, stableJson(document));
  return {
    path: lockFile,
    files: document.schema.files.length,
    package: document.schema.package,
  };
}

function schemaLockReport(modelFile, { lockFile = null, requireLock = false } = {}) {
  const selectedLockFile = lockFile ?? defaultSchemaLockPath(modelFile);
  const lockPath = resolve(selectedLockFile);
  const explicitlyRequested = lockFile !== null;
  if (!existsSync(lockPath)) {
    const errors = requireLock || explicitlyRequested ? [`schema lock not found: ${selectedLockFile}`] : [];
    return {
      status: errors.length > 0 ? "fail" : "skip",
      configured: false,
      path: selectedLockFile,
      reason: "schema lock not found",
      errors,
    };
  }

  let lock;
  try {
    lock = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch (error) {
    const errors = [`failed to parse schema lock: ${selectedLockFile}: ${error.message}`];
    return { status: "fail", configured: true, path: selectedLockFile, errors };
  }

  const errors = [];
  if (lock.schemaLockVersion !== 1) errors.push(`unsupported schema lock version: ${lock.schemaLockVersion ?? "missing"}`);
  let importPath = null;
  try {
    importPath = schemaImportFromModel(modelFile);
  } catch (error) {
    errors.push(error.message.trim());
  }
  if (importPath !== null && lock.model?.schemaImportPath !== importPath) {
    errors.push(`schema import changed: lock has ${lock.model?.schemaImportPath ?? "missing"}, model has ${importPath}`);
  }

  let schemaFile = null;
  if (importPath !== null) {
    try {
      schemaFile = resolveSchemaModulePath(modelFile, importPath);
    } catch (error) {
      errors.push(error.message.trim());
    }
  }
  const expectedRootPath = schemaFile === null ? null : pklImportPath(lockPath, schemaFile);
  if (expectedRootPath !== null && lock.schema?.rootPath !== expectedRootPath) {
    errors.push(`schema root changed: lock has ${lock.schema?.rootPath ?? "missing"}, model resolves ${expectedRootPath}`);
  }
  const files = Array.isArray(lock.schema?.files) ? lock.schema.files : [];
  if (files.length === 0) errors.push("schema lock has no module files");
  for (const entry of files) {
    if (!entry || typeof entry.path !== "string" || typeof entry.digest !== "string") {
      errors.push("schema lock has an invalid module file entry");
      continue;
    }
    const path = resolvePathRelativeToFile(lockPath, entry.path);
    if (!existsSync(path)) {
      errors.push(`schema module missing: ${entry.path}`);
      continue;
    }
    const digest = fileDigest(path);
    if (digest !== entry.digest) errors.push(`schema module digest changed: ${entry.path}`);
  }
  const currentPackage = schemaFile === null || !existsSync(schemaFile) ? null : schemaPackage(schemaFile);
  if (JSON.stringify(lock.schema?.package ?? null) !== JSON.stringify(currentPackage)) {
    errors.push("schema package metadata changed");
  }

  return {
    status: reportStatus(errors),
    configured: true,
    path: selectedLockFile,
    files: files.length,
    package: lock.schema?.package ?? null,
    errors,
  };
}

function initializeModel({ outputFile, lockFile = null, force = false }) {
  const outputPath = resolve(outputFile);
  const selectedLockFile = lockFile ?? defaultSchemaLockPath(outputFile);
  const lockPath = resolve(selectedLockFile);
  if (existsSync(outputPath) && !force) {
    throw new CommandError(`refusing to overwrite existing model: ${outputFile}; use --force\n`);
  }
  if (existsSync(lockPath) && !force) {
    throw new CommandError(`refusing to overwrite existing schema lock: ${selectedLockFile}; use --force\n`);
  }
  const schemaImportPath = pklImportPath(outputPath, installedSchemaPath(outputPath));
  const id = initializedModelId(outputPath);
  const rendered = renderInitializedModel({ id, schemaImportPath });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rendered);
  const lock = writeSchemaLock({ modelFile: outputPath, lockFile: selectedLockFile, force: true });
  return {
    path: outputFile,
    schemaImportPath,
    bytes: Buffer.byteLength(rendered, "utf8"),
    lock,
  };
}

function scaffoldRuleDocument({ modelFile, outputFile = null, ruleId, kind, terms, implementation, test }) {
  const model = loadModel(modelFile);
  const vocabulary = new Set(list(model.vocabulary).map((term) => term.id));
  for (const term of terms) {
    if (!vocabulary.has(term)) throw new CommandError(`unknown vocabulary term: ${term}\n`);
  }
  const modelSchemaImport = schemaImportFromModel(modelFile);
  const schemaFile = resolveSchemaModulePath(modelFile, modelSchemaImport);
  const schemaImportPath = outputFile ? pklImportPath(outputFile, schemaFile) : modelSchemaImport;
  const lines = [
    `import ${pklString(schemaImportPath)} as d`,
    "",
    "rule: d.Rule = new {",
    `  id = ${pklString(ruleId)}`,
    `  kind = ${pklString(kind)}`,
    `  text = d.text(${pklString(`${ruleId} を満たす`)}, ${pklString(`${ruleId} holds`)})`,
  ];
  if (terms.length > 0) {
    lines.push("  terms {");
    for (const term of terms) lines.push(`    ${pklString(term)}`);
    lines.push("  }");
  }
  lines.push('  reviewStatus = "draft"');
  if (test) {
    lines.push("  checks {", `    d.nodeCheck(${pklString(`${test.path}#${test.anchor}`)})`, "  }");
  }
  if (implementation) {
    lines.push(
      "  implementedBy {",
      `    d.codeRef(${pklString(implementation.path)}, ${pklString(implementation.anchor)})`,
      "  }",
    );
  }
  lines.push("}");
  return {
    model: modelReport(model),
    schemaImportPath,
    source: `${lines.join("\n")}\n`,
  };
}

function writeScaffoldedRule(outputFile, source, force = false) {
  const path = resolve(outputFile);
  if (existsSync(path) && !force) {
    throw new CommandError(`refusing to overwrite existing rule scaffold: ${outputFile}; use --force\n`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return { path: outputFile, bytes: Buffer.byteLength(source, "utf8") };
}

function runScaffoldCommand(args) {
  const [subcommand, ...rest] = args;
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    process.stdout.write(scaffoldUsage());
    return;
  }
  if (subcommand !== "rule") {
    throw new CommandError(`unknown scaffold subcommand: ${subcommand}\n${scaffoldUsage()}`);
  }
  if (hasHelpFlag(rest)) {
    process.stdout.write(scaffoldUsage());
    return;
  }
  const options = parseScaffoldRuleArgs(rest);
  const scaffold = scaffoldRuleDocument(options);
  const output = options.outputFile ? writeScaffoldedRule(options.outputFile, scaffold.source, options.force) : null;
  const report = {
    status: "pass",
    model: scaffold.model,
    rule: { id: options.ruleId, kind: options.kind, terms: options.terms },
    output,
    ...(options.json || output ? { source: scaffold.source } : {}),
  };
  if (options.json) {
    process.stdout.write(stableJson(report));
    return;
  }
  if (output) {
    process.stdout.write(`ok: wrote draft rule scaffold ${output.path}\n`);
    return;
  }
  process.stdout.write(scaffold.source);
}

function scaffoldAppProfile(args = {}) {
  return scaffoldAppProfileModule(args, appProfileScaffoldContext());
}

function scaffoldAppProfileDiffReport(currentProfile, scaffoldedProfile) {
  return scaffoldAppProfileDiffReportModule(currentProfile, scaffoldedProfile);
}

function scaffoldAppProfileApplyReport(applyFile, currentProfile, scaffoldedProfile, rendered, { dryRun = false } = {}) {
  return scaffoldAppProfileApplyReportModule(
    applyFile,
    currentProfile,
    scaffoldedProfile,
    rendered,
    { dryRun },
    appProfileScaffoldContext(),
  );
}

function renderScaffoldAppProfileDiffReport(report) {
  return renderScaffoldAppProfileDiffReportModule(report);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function firstObservedReleaseGate(model, app) {
  const workflows = new Map(list(app.workflows).map((workflow) => [workflow.id, new Set(list(workflow.gates))]));
  for (const step of releaseSteps(releasePattern(model))) {
    const workflowGates = workflows.get(step.id);
    for (const gate of list(step.gates)) {
      if (workflowGates?.has(gate)) {
        return { stepId: step.id, gate };
      }
    }
  }
  return null;
}

function unmodeledReleaseGateId(model) {
  const release = releasePattern(model);
  const known = new Set(releaseGates(release).map((gate) => gate.id));
  let candidate = "security";
  let suffix = 2;
  while (known.has(candidate)) {
    candidate = `security-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

const DEFAULT_APP_PROFILE_SCENARIOS = [
  { id: "baseline-no-drift", kind: "baseline-no-drift" },
  { id: "remove-required-release-gate", kind: "remove-release-gate" },
  { id: "add-unmodeled-release-gate", kind: "add-observed-release-gate" },
];

function scenarioStatus(pass) {
  return pass ? "pass" : "fail";
}

function appProfileScenarios(profile) {
  const scenarios = list(profile.scenarios);
  return scenarios.length > 0 ? scenarios : DEFAULT_APP_PROFILE_SCENARIOS;
}

function appProfileScenarioExpected(scenario) {
  if (scenario.expected) return scenario.expected;
  return scenario.kind === "baseline-no-drift" ? "pass" : "fail";
}

function appProfileScenarioGuard(scenario) {
  return appProfileScenarioExpected(scenario) === "pass" ? "false-positive" : "false-negative";
}

function appProfileEvaluationScenario(scenario, report, pass, extra = {}) {
  return {
    id: scenario.id,
    kind: scenario.kind,
    guard: appProfileScenarioGuard(scenario),
    expected: appProfileScenarioExpected(scenario),
    actual: report.status,
    status: scenarioStatus(pass),
    errors: list(report.errors),
    ...extra,
  };
}

function appProfileSkippedScenario(scenario, message, extra = {}) {
  return {
    id: scenario.id,
    kind: scenario.kind,
    guard: appProfileScenarioGuard(scenario),
    expected: appProfileScenarioExpected(scenario),
    actual: "skip",
    status: "fail",
    errors: [message],
    ...extra,
  };
}

function appProfileScenarioPass(report, scenario, requiredSuggestionKind = null) {
  const expected = appProfileScenarioExpected(scenario);
  if (report.status !== expected) return false;
  if (expected !== "fail" || !requiredSuggestionKind) return true;
  return list(report.suggestions)[0]?.kind === requiredSuggestionKind;
}

function evaluateBaselineAppProfileScenario(profile, scenario) {
  const baseline = appProfileReport(profile);
  return appProfileEvaluationScenario(
    scenario,
    baseline,
    appProfileScenarioPass(baseline, scenario),
    { checks: baseline.total },
  );
}

function appProfileReleaseGateTarget(scenario, model, app) {
  if (scenario.step && scenario.gate) {
    return { stepId: scenario.step, gate: scenario.gate };
  }
  return firstObservedReleaseGate(model, app);
}

function evaluateRemoveReleaseGateScenario(model, app, scenario) {
  const target = appProfileReleaseGateTarget(scenario, model, app);
  if (target) {
    const workflow = list(app.workflows).find((candidate) => candidate.id === target.stepId);
    if (!workflow) {
      return appProfileSkippedScenario(
        scenario,
        `observed workflow not found for release gate removal: ${target.stepId}`,
        { mutation: { step: target.stepId, removedGate: target.gate } },
      );
    }
    if (!list(workflow.gates).includes(target.gate)) {
      return appProfileSkippedScenario(
        scenario,
        `observed release gate not found for removal: ${target.stepId} -> ${target.gate}`,
        { mutation: { step: target.stepId, removedGate: target.gate } },
      );
    }
    const missingGateApp = cloneJson(app);
    missingGateApp.workflows = list(missingGateApp.workflows).map((workflow) =>
      workflow.id === target.stepId ? { ...workflow, gates: list(workflow.gates).filter((gate) => gate !== target.gate) } : workflow,
    );
    const report = reconcileRealAppReport(model, { app: missingGateApp });
    const detectedSuggestionKind = list(report.suggestions)[0]?.kind ?? null;
    return appProfileEvaluationScenario(
      scenario,
      report,
      appProfileScenarioPass(report, scenario, "implementation-missing"),
      { mutation: { step: target.stepId, removedGate: target.gate }, detectedSuggestionKind },
    );
  }
  return appProfileSkippedScenario(
    scenario,
    "no observed release gate available for false-negative injection",
  );
}

function modelClauseExpressions(model) {
  return sortedRules(model).flatMap((rule) =>
    [...list(rule.when), ...list(rule.must), ...list(rule.mustNot)]
      .map((clause) => clause.expr)
      .filter(Boolean)
  );
}

function modelClauseMatches(model, pattern) {
  const values = [];
  for (const expr of modelClauseExpressions(model)) {
    for (const match of expr.matchAll(pattern)) values.push(match[1]);
  }
  return sortedUnique(values);
}

function modelRouteCandidates(model) {
  return modelClauseMatches(model, /\broute\((\/api\/[^)\s]+)\)/g);
}

function modelContractSchemaCandidates(model) {
  return modelClauseMatches(model, /\bcontractSchema\(([A-Za-z0-9_]+Schema)\)/g);
}

function firstObservedModelRoute(model, app) {
  const observed = new Set(list(app.routes).map((route) => route.path));
  return modelRouteCandidates(model).find((route) => observed.has(route)) ?? null;
}

function firstObservedModelContractSchema(model, app) {
  const observed = new Set(list(app.contracts?.schemas));
  return modelContractSchemaCandidates(model).find((schema) => observed.has(schema)) ?? null;
}

function firstObservedModelWorkflow(model, app) {
  const observed = new Set(list(app.workflows).map((workflow) => workflow.id));
  return releaseSteps(releasePattern(model)).map((step) => step.id).sort().find((workflow) => observed.has(workflow)) ?? null;
}

function appProfileScenarioWorkflow(scenario, model, app) {
  const workflows = list(app.workflows);
  if (scenario.workflow) {
    return workflows.find((workflow) => workflow.id === scenario.workflow) ?? null;
  }
  const modeled = firstObservedModelWorkflow(model, app);
  if (modeled) {
    return workflows.find((workflow) => workflow.id === modeled) ?? null;
  }
  return workflows[0] ?? null;
}

function firstAppRoute(app) {
  return list(app.routes)[0]?.path ?? null;
}

function firstContractSchema(app) {
  return list(app.contracts?.schemas)[0] ?? null;
}

function firstDetectableContractSchema(model, app) {
  for (const schema of list(app.contracts?.schemas)) {
    const mutatedApp = cloneJson(app);
    mutatedApp.contracts = {
      ...mutatedApp.contracts,
      schemas: list(mutatedApp.contracts?.schemas).filter((candidate) => candidate !== schema),
    };
    const report = reconcileRealAppReport(model, { app: mutatedApp });
    if (report.status === "fail" && list(report.suggestions)[0]?.kind === "implementation-missing") {
      return schema;
    }
  }
  return firstContractSchema(app);
}

function appFactSuggestion(kind, id, suggestionKind) {
  if (suggestionKind === "implementation-missing") {
    return {
      kind: suggestionKind,
      action: "restore-observed-fact",
      message: `Restore observed ${kind} "${id}", or update the spec if it was intentionally removed.`,
    };
  }
  return {
    kind: suggestionKind,
    action: "model-observed-fact",
    message: `Model observed ${kind} "${id}", or remove the implementation fact if it is unintended.`,
  };
}

function appFactScenarioReport({ kind, id, present, suggestionKind }) {
  const pass = suggestionKind === "implementation-missing" ? present : !present;
  const suggestion = pass ? null : appFactSuggestion(kind, id, suggestionKind);
  return {
    status: pass ? "pass" : "fail",
    errors: pass ? [] : [suggestionKind === "implementation-missing" ? `missing observed ${kind}: ${id}` : `unmodeled observed ${kind}: ${id}`],
    ...(suggestion ? { suggestions: [suggestion] } : {}),
  };
}

function evaluateRemoveRouteScenario(model, app, scenario) {
  const route = scenario.route ?? firstObservedModelRoute(model, app) ?? firstAppRoute(app);
  if (!route) {
    return appProfileSkippedScenario(scenario, "no observed route available for removal");
  }
  const mutatedApp = cloneJson(app);
  mutatedApp.routes = list(mutatedApp.routes).filter((candidate) => candidate.path !== route);
  const present = list(mutatedApp.routes).some((candidate) => candidate.path === route);
  const report = appFactScenarioReport({ kind: "route", id: route, present, suggestionKind: "implementation-missing" });
  const detectedSuggestionKind = list(report.suggestions)[0]?.kind ?? null;
  return appProfileEvaluationScenario(
    scenario,
    report,
    appProfileScenarioPass(report, scenario, "implementation-missing"),
    { mutation: { removedRoute: route }, detectedSuggestionKind },
  );
}

function evaluateAddObservedRouteScenario(app, scenario) {
  const route = scenario.route ?? "/api/admin";
  const known = list(app.routes).some((candidate) => candidate.path === route);
  const report = appFactScenarioReport({ kind: "route", id: route, present: !known, suggestionKind: "spec-missing" });
  const detectedSuggestionKind = list(report.suggestions)[0]?.kind ?? null;
  return appProfileEvaluationScenario(
    scenario,
    report,
    appProfileScenarioPass(report, scenario, "spec-missing"),
    { mutation: { addedRoute: route }, detectedSuggestionKind },
  );
}

function evaluateRemoveContractSchemaScenario(model, app, scenario) {
  const schema = scenario.schema ?? firstObservedModelContractSchema(model, app) ?? firstDetectableContractSchema(model, app);
  if (!schema) {
    return appProfileSkippedScenario(scenario, "no observed contract schema available for removal");
  }
  const mutatedApp = cloneJson(app);
  mutatedApp.contracts = {
    ...mutatedApp.contracts,
    schemas: list(mutatedApp.contracts?.schemas).filter((candidate) => candidate !== schema),
  };
  let report = reconcileRealAppReport(model, { app: mutatedApp });
  if (report.status === "pass") {
    const present = list(mutatedApp.contracts?.schemas).includes(schema);
    report = appFactScenarioReport({ kind: "contract schema", id: schema, present, suggestionKind: "implementation-missing" });
  }
  const detectedSuggestionKind = list(report.suggestions)[0]?.kind ?? null;
  return appProfileEvaluationScenario(
    scenario,
    report,
    appProfileScenarioPass(report, scenario, "implementation-missing"),
    { mutation: { removedSchema: schema }, detectedSuggestionKind },
  );
}

function evaluateAddObservedContractSchemaScenario(app, scenario) {
  const schema = scenario.schema ?? "auditLogSchema";
  const known = list(app.contracts?.schemas).includes(schema);
  const report = appFactScenarioReport({ kind: "contract schema", id: schema, present: !known, suggestionKind: "spec-missing" });
  const detectedSuggestionKind = list(report.suggestions)[0]?.kind ?? null;
  return appProfileEvaluationScenario(
    scenario,
    report,
    appProfileScenarioPass(report, scenario, "spec-missing"),
    { mutation: { addedSchema: schema }, detectedSuggestionKind },
  );
}

function evaluateRemoveWorkflowScenario(model, app, scenario) {
  const workflow = scenario.workflow ?? firstObservedModelWorkflow(model, app) ?? list(app.workflows)[0]?.id;
  if (!workflow) {
    return appProfileSkippedScenario(scenario, "no observed workflow available for removal");
  }
  const mutatedApp = cloneJson(app);
  mutatedApp.workflows = list(mutatedApp.workflows).filter((candidate) => candidate.id !== workflow);
  const report = reconcileRealAppReport(model, { app: mutatedApp });
  const detectedSuggestionKind = list(report.suggestions)[0]?.kind ?? null;
  return appProfileEvaluationScenario(
    scenario,
    report,
    appProfileScenarioPass(report, scenario, "implementation-missing"),
    { mutation: { removedWorkflow: workflow }, detectedSuggestionKind },
  );
}

function evaluateAddObservedWorkflowScenario(model, app, scenario) {
  const workflow = scenario.workflow ?? "nightly";
  const mutatedApp = cloneJson(app);
  if (!list(mutatedApp.workflows).some((candidate) => candidate.id === workflow)) {
    mutatedApp.workflows = [
      ...list(mutatedApp.workflows),
      { id: workflow, path: `.github/workflows/${workflow}.yml`, gates: [], steps: [], jobs: [], repositories: [], artifacts: [] },
    ];
  }
  const report = reverseCoverageReport(model, { app: mutatedApp });
  const detectedSuggestionKind = list(report.suggestions)[0]?.kind ?? null;
  return appProfileEvaluationScenario(
    scenario,
    report,
    appProfileScenarioPass(report, scenario, "spec-missing"),
    { mutation: { addedWorkflow: workflow }, detectedSuggestionKind },
  );
}

function mutateObservedDomainList(app, path, id, operation) {
  const domain = realAppObservedDomain(app);
  let target = domain;
  for (const key of path.slice(0, -1)) target = target[key];
  const leaf = path[path.length - 1];
  target[leaf] = operation === "remove"
    ? list(target[leaf]).filter((candidate) => candidate !== id)
    : sortedUnique([...list(target[leaf]), id]);
  return domain;
}

function firstObservedDomainId(app, path) {
  let current = realAppObservedDomain(app);
  for (const key of path) current = current?.[key];
  return list(current)[0] ?? null;
}

function evaluateRemoveObservedDomainScenario(model, app, scenario, { field, path, mutationField }) {
  const id = scenario[field] ?? firstObservedDomainId(app, path);
  if (!id) {
    return appProfileSkippedScenario(scenario, `no observed ${field} available for removal`);
  }
  const domain = mutateObservedDomainList(app, path, id, "remove");
  const report = reconcileRealAppReport(model, { app, domain });
  const detectedSuggestionKind = list(report.suggestions)[0]?.kind ?? null;
  return appProfileEvaluationScenario(
    scenario,
    report,
    appProfileScenarioPass(report, scenario, "implementation-missing"),
    { mutation: { [mutationField]: id }, detectedSuggestionKind },
  );
}

function evaluateAddObservedDomainScenario(model, app, scenario, { field, path, mutationField, fallback }) {
  const id = scenario[field] ?? fallback;
  const domain = mutateObservedDomainList(app, path, id, "add");
  const report = reverseCoverageReport(model, { app, domain });
  const detectedSuggestionKind = list(report.suggestions)[0]?.kind ?? null;
  return appProfileEvaluationScenario(
    scenario,
    report,
    appProfileScenarioPass(report, scenario, "spec-missing"),
    { mutation: { [mutationField]: id }, detectedSuggestionKind },
  );
}

function evaluateAddObservedReleaseGateScenario(model, app, scenario) {
  const extraGate = scenario.gate ?? unmodeledReleaseGateId(model);
  const workflow = appProfileScenarioWorkflow(scenario, model, app);
  if (workflow) {
    const extraGateApp = cloneJson(app);
    extraGateApp.workflows = list(extraGateApp.workflows).map((candidate) =>
      candidate.id === workflow.id ? { ...candidate, gates: sortedUnique([...list(candidate.gates), extraGate]) } : candidate,
    );
    const report = reverseCoverageReport(model, { app: extraGateApp });
    const detectedSuggestionKind = list(report.suggestions)[0]?.kind ?? null;
    return appProfileEvaluationScenario(
      scenario,
      report,
      appProfileScenarioPass(report, scenario, "spec-missing"),
      { mutation: { workflow: workflow.id, addedGate: extraGate }, detectedSuggestionKind },
    );
  }
  return appProfileSkippedScenario(
    scenario,
    "no workflow available for false-negative injection",
    { mutation: { workflow: scenario.workflow ?? null, addedGate: extraGate } },
  );
}

function evaluateAppProfileScenario(profile, model, app, scenario) {
  if (scenario.kind === "baseline-no-drift") {
    return evaluateBaselineAppProfileScenario(profile, scenario);
  }
  if (scenario.kind === "remove-release-gate") {
    return evaluateRemoveReleaseGateScenario(model, app, scenario);
  }
  if (scenario.kind === "add-observed-release-gate") {
    return evaluateAddObservedReleaseGateScenario(model, app, scenario);
  }
  if (scenario.kind === "remove-route") {
    return evaluateRemoveRouteScenario(model, app, scenario);
  }
  if (scenario.kind === "add-observed-route") {
    return evaluateAddObservedRouteScenario(app, scenario);
  }
  if (scenario.kind === "remove-contract-schema") {
    return evaluateRemoveContractSchemaScenario(model, app, scenario);
  }
  if (scenario.kind === "add-observed-contract-schema") {
    return evaluateAddObservedContractSchemaScenario(app, scenario);
  }
  if (scenario.kind === "remove-workflow") {
    return evaluateRemoveWorkflowScenario(model, app, scenario);
  }
  if (scenario.kind === "add-observed-workflow") {
    return evaluateAddObservedWorkflowScenario(model, app, scenario);
  }
  if (scenario.kind === "remove-data-store") {
    return evaluateRemoveObservedDomainScenario(model, app, scenario, {
      field: "store",
      path: ["data", "stores"],
      mutationField: "removedStore",
    });
  }
  if (scenario.kind === "add-observed-data-store") {
    return evaluateAddObservedDomainScenario(model, app, scenario, {
      field: "store",
      path: ["data", "stores"],
      mutationField: "addedStore",
      fallback: "audit-log",
    });
  }
  if (scenario.kind === "remove-runtime-dependency") {
    return evaluateRemoveObservedDomainScenario(model, app, scenario, {
      field: "dependency",
      path: ["runtime", "dependencies"],
      mutationField: "removedDependency",
    });
  }
  if (scenario.kind === "add-observed-runtime-dependency") {
    return evaluateAddObservedDomainScenario(model, app, scenario, {
      field: "dependency",
      path: ["runtime", "dependencies"],
      mutationField: "addedDependency",
      fallback: "worker-to-api",
    });
  }
  return appProfileSkippedScenario(scenario, `unsupported app profile scenario kind: ${scenario.kind}`);
}

function appProfileEvaluationReport(profile) {
  const model = loadModel(profile.modelPath);
  const app = importRealApp(profile.appRoot);
  const scenarios = appProfileScenarios(profile).map((scenario) =>
    evaluateAppProfileScenario(profile, model, app, scenario)
  );

  const errors = scenarios
    .filter((scenario) => scenario.status !== "pass")
    .flatMap((scenario) => scenario.errors.length > 0 ? scenario.errors.map((error) => `${scenario.id}: ${error}`) : [`${scenario.id}: expected ${scenario.expected}, actual ${scenario.actual}`]);
  return {
    profile: {
      id: profile.id,
      modelPath: profile.modelPath,
      appRoot: profile.appRoot,
      observedFacts: profile.observedFacts ?? null,
    },
    status: reportStatus(errors),
    passed: scenarios.filter((scenario) => scenario.status === "pass").length,
    total: scenarios.length,
    scenarios,
    errors,
  };
}

function appProfileEvaluationSuiteReport(suite) {
  const evaluations = list(suite.profiles).map((file) => appProfileEvaluationReport(loadAppProfile(file)));
  const errors = evaluations.flatMap((report) =>
    report.errors.map((error) => `${report.profile.id}: ${error}`)
  );
  return {
    suite: {
      id: suite.id,
      profiles: list(suite.profiles),
    },
    status: reportStatus(errors),
    passed: evaluations.filter((report) => report.status === "pass").length,
    total: evaluations.length,
    evaluations,
    errors,
  };
}

function scenarioSuggestionKind(scenario) {
  if (scenario.kind === "baseline-no-drift") return null;
  if (scenario.kind.startsWith("remove-")) return "implementation-missing";
  if (scenario.kind.startsWith("add-observed-")) return "spec-missing";
  return null;
}

const APP_PROFILE_SCENARIO_CATEGORIES = [
  "release-gate",
  "route",
  "contract-schema",
  "workflow",
  "data-store",
  "runtime-dependency",
];

function scenarioCategory(scenario) {
  if (scenario.kind === "remove-release-gate" || scenario.kind === "add-observed-release-gate") {
    return "release-gate";
  }
  if (scenario.kind === "remove-route" || scenario.kind === "add-observed-route") {
    return "route";
  }
  if (scenario.kind === "remove-contract-schema" || scenario.kind === "add-observed-contract-schema") {
    return "contract-schema";
  }
  if (scenario.kind === "remove-workflow" || scenario.kind === "add-observed-workflow") {
    return "workflow";
  }
  if (scenario.kind === "remove-data-store" || scenario.kind === "add-observed-data-store") {
    return "data-store";
  }
  if (scenario.kind === "remove-runtime-dependency" || scenario.kind === "add-observed-runtime-dependency") {
    return "runtime-dependency";
  }
  return null;
}

function scenarioCoverageGates(scenario, profile) {
  if (scenario.kind === "baseline-no-drift") return [...appProfileGateSet(profile)];
  const suggestionKind = scenarioSuggestionKind(scenario);
  if (suggestionKind === "implementation-missing") return ["reconcile-real-app"];
  if (suggestionKind === "spec-missing") return ["reverse-coverage"];
  return [];
}

function appProfileScenarioMatchesCoverageRequirement(profile, scenario, requirement) {
  if (scenario.status !== "pass") return false;
  if (appProfileScenarioGuard(scenario) !== requirement.guard) return false;
  if (requirement.suggestionKind && scenario.detectedSuggestionKind !== requirement.suggestionKind) return false;
  if (requirement.scope === "category") {
    return scenarioCategory(scenario) === requirement.category;
  }
  return scenarioCoverageGates(scenario, profile).includes(requirement.gate);
}

function appProfileOrderedScenarioCategories(categories) {
  const set = new Set(list(categories));
  return APP_PROFILE_SCENARIO_CATEGORIES.filter((category) => set.has(category));
}

function hasAny(...collections) {
  return collections.some((collection) => list(collection).length > 0);
}

function modelHasDataStoreScenarioCategory(model) {
  const data = dataPattern(model);
  return hasAny(dataSets(data), dataStores(data), dataPlacements(data), dataFlows(data));
}

function modelHasReleaseGateScenarioCategory(model) {
  const release = releasePattern(model);
  return hasAny(releaseGates(release)) || releaseSteps(release).some((step) => list(step.gates).length > 0);
}

function modelHasWorkflowScenarioCategory(model) {
  return hasAny(releaseSteps(releasePattern(model)));
}

function modelHasRuntimeDependencyScenarioCategory(model) {
  return hasAny(runtimeDependencies(runtimePattern(model)));
}

function appProfileInferredScenarioCategories(model, app) {
  const categories = [];
  if (hasAny(app?.routes)) categories.push("route");
  if (hasAny(app?.contracts?.schemas)) categories.push("contract-schema");
  if (list(app?.workflows).some((workflow) => list(workflow.gates).length > 0) || modelHasReleaseGateScenarioCategory(model)) {
    categories.push("release-gate");
  }
  if (hasAny(app?.workflows) || modelHasWorkflowScenarioCategory(model)) categories.push("workflow");
  if (modelHasDataStoreScenarioCategory(model)) categories.push("data-store");
  if (modelHasRuntimeDependencyScenarioCategory(model)) categories.push("runtime-dependency");
  return appProfileOrderedScenarioCategories(categories);
}

function appProfileRequiredScenarioCategories(profile, inferredCategories = []) {
  const declared = appProfileOrderedScenarioCategories(profile.requiredScenarioCategories);
  if (declared.length > 0) return declared;
  return inferredCategories.length > 0 ? inferredCategories : APP_PROFILE_SCENARIO_CATEGORIES;
}

function appProfileScenarioCategoryDeclarationErrors(profile, inferredCategories) {
  const declared = appProfileOrderedScenarioCategories(profile.requiredScenarioCategories);
  if (declared.length === 0) return [];
  const declaredSet = new Set(declared);
  return inferredCategories
    .filter((category) => !declaredSet.has(category))
    .map((category) => `missing inferred app profile scenario category: ${category}`);
}

function appProfileScenarioCoverageRequirement(profile, scenarios, requirement) {
  const scenarioIds = scenarios
    .filter((scenario) => appProfileScenarioMatchesCoverageRequirement(profile, scenario, requirement))
    .map((scenario) => scenario.id);
  return {
    ...requirement,
    status: scenarioIds.length > 0 ? "pass" : "fail",
    scenarios: scenarioIds,
  };
}

function appProfileScenarioCoverageReport(profile) {
  const model = loadModel(profile.modelPath);
  const app = importRealApp(profile.appRoot);
  const gates = [...appProfileGateSet(profile)];
  const scenarios = appProfileScenarios(profile).map((scenario) =>
    evaluateAppProfileScenario(profile, model, app, scenario)
  );
  const inferredCategories = appProfileInferredScenarioCategories(model, app);
  const declaredCategories = appProfileOrderedScenarioCategories(profile.requiredScenarioCategories);
  const requiredCategories = appProfileRequiredScenarioCategories(profile, inferredCategories);
  const gateRequirements = gates.flatMap((gate) => {
    const entries = [{ scope: "gate", gate, guard: "false-positive", suggestionKind: null }];
    if (gate === "reconcile-real-app") {
      entries.push({ scope: "gate", gate, guard: "false-negative", suggestionKind: "implementation-missing" });
    }
    if (gate === "reverse-coverage") {
      entries.push({ scope: "gate", gate, guard: "false-negative", suggestionKind: "spec-missing" });
    }
    return entries;
  });
  const categoryRequirements = requiredCategories.flatMap((category) => [
    { scope: "category", category, guard: "false-negative", suggestionKind: "implementation-missing" },
    { scope: "category", category, guard: "false-negative", suggestionKind: "spec-missing" },
  ]);
  const requirements = [...gateRequirements, ...categoryRequirements]
    .map((requirement) => appProfileScenarioCoverageRequirement(profile, scenarios, requirement));
  const coverageErrors = requirements
    .filter((requirement) => requirement.status !== "pass")
    .map((requirement) => {
      const target = requirement.scope === "category" ? `category ${requirement.category}` : `gate ${requirement.gate}`;
      return `missing app profile scenario coverage: ${target} ${requirement.guard}${requirement.suggestionKind ? ` ${requirement.suggestionKind}` : ""}`;
    });
  const errors = [
    ...appProfileScenarioCategoryDeclarationErrors(profile, inferredCategories),
    ...coverageErrors,
  ];
  return {
    profile: {
      id: profile.id,
      modelPath: profile.modelPath,
      appRoot: profile.appRoot,
      observedFacts: profile.observedFacts ?? null,
    },
    inferredCategories,
    declaredCategories,
    requiredCategories,
    status: reportStatus(errors),
    covered: requirements.filter((requirement) => requirement.status === "pass").length,
    total: requirements.length,
    requirements,
    scenarios,
    errors,
  };
}

const APP_PROFILE_MUTATION_SCENARIO_KINDS = {
  "release-gate": {
    "implementation-missing": "remove-release-gate",
    "spec-missing": "add-observed-release-gate",
  },
  route: {
    "implementation-missing": "remove-route",
    "spec-missing": "add-observed-route",
  },
  "contract-schema": {
    "implementation-missing": "remove-contract-schema",
    "spec-missing": "add-observed-contract-schema",
  },
  workflow: {
    "implementation-missing": "remove-workflow",
    "spec-missing": "add-observed-workflow",
  },
  "data-store": {
    "implementation-missing": "remove-data-store",
    "spec-missing": "add-observed-data-store",
  },
  "runtime-dependency": {
    "implementation-missing": "remove-runtime-dependency",
    "spec-missing": "add-observed-runtime-dependency",
  },
};

function appProfileGeneratedMutationScenario(category, suggestionKind) {
  const kind = APP_PROFILE_MUTATION_SCENARIO_KINDS[category]?.[suggestionKind];
  return {
    id: `${category}-${suggestionKind}`,
    kind,
    expected: "fail",
  };
}

function appProfileGeneratedMutationScenarios(categories) {
  return categories.flatMap((category) => [
    { category, suggestionKind: "implementation-missing", scenario: appProfileGeneratedMutationScenario(category, "implementation-missing") },
    { category, suggestionKind: "spec-missing", scenario: appProfileGeneratedMutationScenario(category, "spec-missing") },
  ]);
}

function appProfileScenarioShrinkFields(scenario) {
  return ["route", "schema", "step", "workflow", "gate", "store", "dependency"]
    .filter((field) => scenario[field] !== undefined && scenario[field] !== null)
    .sort();
}

function appProfileScenarioShrinks(scenario) {
  const fields = appProfileScenarioShrinkFields(scenario);
  const shrinks = [{ kind: scenario.kind }];
  for (const field of fields) {
    shrinks.push({ kind: scenario.kind, [field]: scenario[field] });
  }
  return shrinks;
}

function appProfileMutationScoreEntry(profile, model, app, generated) {
  const evaluated = evaluateAppProfileScenario(profile, model, app, generated.scenario);
  return {
    id: evaluated.id,
    category: generated.category,
    suggestionKind: generated.suggestionKind,
    kind: evaluated.kind,
    guard: evaluated.guard,
    expected: evaluated.expected,
    actual: evaluated.actual,
    status: evaluated.status,
    detectedSuggestionKind: evaluated.detectedSuggestionKind ?? null,
    mutation: evaluated.mutation ?? null,
    shrinks: appProfileScenarioShrinks(generated.scenario),
    errors: list(evaluated.errors),
  };
}

function appProfileMutationScoreReport(profile) {
  const model = loadModel(profile.modelPath);
  const app = importRealApp(profile.appRoot);
  const inferredCategories = appProfileInferredScenarioCategories(model, app);
  const declaredCategories = appProfileOrderedScenarioCategories(profile.requiredScenarioCategories);
  const categories = appProfileRequiredScenarioCategories(profile, inferredCategories);
  const mutations = appProfileGeneratedMutationScenarios(categories)
    .map((generated) => appProfileMutationScoreEntry(profile, model, app, generated));
  const detected = mutations.filter((mutation) => mutation.status === "pass").length;
  const missed = mutations.length - detected;
  const mutationErrors = mutations
    .filter((mutation) => mutation.status !== "pass")
    .flatMap((mutation) => mutation.errors.length > 0
      ? mutation.errors.map((error) => `${mutation.id}: ${error}`)
      : [`${mutation.id}: expected ${mutation.expected}, actual ${mutation.actual}`]);
  const errors = [
    ...appProfileScenarioCategoryDeclarationErrors(profile, inferredCategories),
    ...mutationErrors,
  ];
  return {
    profile: {
      id: profile.id,
      modelPath: profile.modelPath,
      appRoot: profile.appRoot,
      observedFacts: profile.observedFacts ?? null,
    },
    inferredCategories,
    declaredCategories,
    categories,
    status: reportStatus(errors),
    generated: mutations.length,
    detected,
    missed,
    score: mutations.length === 0 ? 1 : detected / mutations.length,
    mutations,
    errors,
  };
}

function appSurfaceFacts(app) {
  return [
    ...list(app.routes).map((route) => ({ kind: "route", id: route.path })),
    ...list(app.contracts?.schemas).map((schema) => ({ kind: "contract-schema", id: schema })),
    ...list(app.workflows).map((workflow) => ({ kind: "workflow", id: workflow.id })),
  ]
    .filter((fact) => fact.id)
    .sort((left, right) => appSurfaceFactKey(left).localeCompare(appSurfaceFactKey(right)));
}

function modelWorkflowCandidates(model) {
  return sortedUnique([
    ...releaseSteps(releasePattern(model)).map((step) => step.id),
    ...modelClauseMatches(model, /\breleaseStep\(([A-Za-z0-9_.-]+)\)/g),
  ]);
}

function modelSurfaceFacts(model) {
  return [
    ...modelRouteCandidates(model).map((id) => ({ kind: "route", id })),
    ...modelContractSchemaCandidates(model).map((id) => ({ kind: "contract-schema", id })),
    ...modelWorkflowCandidates(model).map((id) => ({ kind: "workflow", id })),
  ]
    .filter((fact) => fact.id)
    .sort((left, right) => appSurfaceFactKey(left).localeCompare(appSurfaceFactKey(right)));
}

function appSurfaceFactKey(fact) {
  return `${fact.kind}:${fact.id}`;
}

function appSurfaceFactMap(facts) {
  return new Map(facts.map((fact) => [appSurfaceFactKey(fact), fact]));
}

function appSurfaceFactChange(kind, fact, modeled) {
  let suggestionKind = "ignored";
  if (kind === "removed" && modeled) suggestionKind = "implementation-missing";
  if (kind === "added" && !modeled) suggestionKind = "spec-missing";
  return {
    change: kind,
    kind: fact.kind,
    id: fact.id,
    modeled,
    suggestionKind,
  };
}

function appChangeReplayChanges(model, beforeApp, afterApp) {
  const before = appSurfaceFactMap(appSurfaceFacts(beforeApp));
  const after = appSurfaceFactMap(appSurfaceFacts(afterApp));
  const modeled = new Set(modelSurfaceFacts(model).map(appSurfaceFactKey));
  const changes = [];
  for (const [key, fact] of before) {
    if (!after.has(key)) {
      changes.push(appSurfaceFactChange("removed", fact, modeled.has(key)));
    }
  }
  for (const [key, fact] of after) {
    if (!before.has(key)) {
      changes.push(appSurfaceFactChange("added", fact, modeled.has(key)));
    }
  }
  return changes.sort((left, right) =>
    `${left.kind}:${left.id}:${left.change}`.localeCompare(`${right.kind}:${right.id}:${right.change}`)
  );
}

function appChangeReplayActualDrift(changes) {
  const detected = sortedUnique(changes
    .map((change) => change.suggestionKind)
    .filter((kind) => kind === "implementation-missing" || kind === "spec-missing"));
  if (detected.length === 0) return "no-drift";
  if (detected.length === 1) return detected[0];
  return "mixed";
}

function appChangeReplayBaselineErrors(model, beforeApp) {
  const before = new Set(appSurfaceFacts(beforeApp).map(appSurfaceFactKey));
  return modelSurfaceFacts(model)
    .filter((fact) => !before.has(appSurfaceFactKey(fact)))
    .map((fact) => `before app is missing modeled ${fact.kind}: ${fact.id}`);
}

function appChangeReplayCaseReport(entry) {
  const model = loadModel(entry.modelPath);
  const beforeApp = importRealApp(entry.beforeAppRoot);
  const afterApp = importRealApp(entry.afterAppRoot);
  const changes = appChangeReplayChanges(model, beforeApp, afterApp);
  const actual = appChangeReplayActualDrift(changes);
  const baselineErrors = appChangeReplayBaselineErrors(model, beforeApp);
  const expected = entry.expected ?? "no-drift";
  const mismatchErrors = actual === expected ? [] : [`expected ${expected}, actual ${actual}`];
  const errors = [...baselineErrors, ...mismatchErrors];
  return {
    id: entry.id,
    modelPath: entry.modelPath,
    beforeAppRoot: entry.beforeAppRoot,
    afterAppRoot: entry.afterAppRoot,
    expected,
    actual,
    status: reportStatus(errors),
    changes,
    errors,
  };
}

function appChangeReplayCorpusReport(corpus) {
  const cases = list(corpus.cases).map(appChangeReplayCaseReport);
  const errors = cases.flatMap((entry) => entry.errors.map((error) => `${entry.id}: ${error}`));
  return {
    corpus: {
      id: corpus.id,
    },
    status: reportStatus(errors),
    passed: cases.filter((entry) => entry.status === "pass").length,
    total: cases.length,
    cases,
    errors,
  };
}

function renderAppChangeReplayMarkdownReport(report) {
  return renderAppChangeReplayMarkdownReportModule(report);
}

function renderAppChangeReplayReport(report) {
  return renderAppChangeReplayReportModule(report);
}

function specReadingExpectationKey(expected) {
  return expected === "not-supported" ? "notSupported" : expected;
}

const SPEC_READING_RUBRIC_VERSION = "spec-reading-rubric-v1";
const SPEC_READING_RUBRIC = [
  {
    label: "entailed",
    description: "Use when the claim follows from explicit terms, rules, clauses, values, or closed-world lists in the spec.",
  },
  {
    label: "contradicted",
    description: "Use when an explicit value differs, a rule forbids the claim, or a closed modeled list excludes the claim.",
  },
  {
    label: "not-supported",
    description: "Use when a nearby concept exists but the required value, actor, owner, condition, or relationship is not stated.",
  },
];

function renderSpecReadingRubricLines() {
  return [
    "## Rubric",
    "",
    ...SPEC_READING_RUBRIC.map((entry) => `- \`${entry.label}\`: ${entry.description}`),
    "",
    "Boundary rule: if an explicit value differs, choose `contradicted`; do not choose `not-supported`.",
  ];
}

function specReadingLocalizedTextDigest(value) {
  if (!value) return null;
  return {
    default: value.default ?? "",
    labels: stableObject(value.labels ?? {}),
  };
}

function specReadingClauseDigest(clause) {
  return {
    expr: clauseExpr(clause),
    text: specReadingLocalizedTextDigest(clause.text),
  };
}

function specReadingEvidenceTarget(model, ref, locale = null) {
  if (ref.startsWith("term:")) {
    const id = ref.slice("term:".length);
    const term = list(model.vocabulary).find((entry) => entry.id === id);
    if (!term) return { errors: [`missing evidence term: ${id}`], target: null };
    return {
      errors: [],
      target: {
        ref,
        kind: "term",
        id,
        keys: [`term:${id}`],
        text: text(term.text, locale),
        digest: {
          id,
          kind: term.kind ?? null,
          text: specReadingLocalizedTextDigest(term.text),
          aliases: stableObject(term.aliases ?? {}),
          values: list(term.values),
        },
      },
    };
  }
  if (ref.startsWith("rule:")) {
    const id = ref.slice("rule:".length);
    const rule = list(model.rules).find((entry) => entry.id === id);
    if (!rule) return { errors: [`missing evidence rule: ${id}`], target: null };
    return {
      errors: [],
      target: {
        ref,
        kind: "rule",
        id,
        keys: [`rule:${id}`],
        text: text(rule.text, locale),
        digest: {
          id,
          kind: rule.kind ?? null,
          text: specReadingLocalizedTextDigest(rule.text),
          terms: list(rule.terms),
          when: list(rule.when).map(specReadingClauseDigest),
          must: list(rule.must).map(specReadingClauseDigest),
          mustNot: list(rule.mustNot).map(specReadingClauseDigest),
        },
      },
    };
  }
  if (ref.startsWith("decision:")) {
    const id = ref.slice("decision:".length);
    const decision = list(model.decisions).find((entry) => entry.id === id);
    if (!decision) return { errors: [`missing evidence decision: ${id}`], target: null };
    return {
      errors: [],
      target: {
        ref,
        kind: "decision",
        id,
        keys: [`decision:${id}`],
        text: text(decision.title ?? decision.text, locale),
        digest: stableObject(decision),
      },
    };
  }
  const clause = ref.match(/^clause:(.+)#(when|must|mustNot)\[([0-9]+)\]$/);
  if (clause) {
    const [, ruleId, field, indexText] = clause;
    const rule = list(model.rules).find((entry) => entry.id === ruleId);
    if (!rule) return { errors: [`missing evidence rule: ${ruleId}`], target: null };
    const index = Number(indexText);
    const clauseEntry = list(rule[field])[index];
    if (!clauseEntry) return { errors: [`missing evidence clause: ${ruleId}#${field}[${index}]`], target: null };
    return {
      errors: [],
      target: {
        ref,
        kind: "clause",
        id: `${ruleId}#${field}[${index}]`,
        keys: [ref, `rule:${ruleId}`],
        text: text(clauseEntry.text, locale) || clauseExpr(clauseEntry),
        digest: {
          ruleId,
          field,
          index,
          clause: specReadingClauseDigest(clauseEntry),
        },
      },
    };
  }
  return { errors: [`unsupported evidence ref: ${ref}`], target: null };
}

function specReadingEvidenceErrors(model, ref) {
  return specReadingEvidenceTarget(model, ref).errors;
}

function specReadingEvidenceTargets(model, refs, locale = null) {
  return refs.map((ref) => specReadingEvidenceTarget(model, ref, locale));
}

function specReadingEvidenceDigest(model, refs) {
  const records = specReadingEvidenceTargets(model, refs).map((entry) => entry.target?.digest ?? { ref: null, errors: entry.errors });
  return `sha256:${createHash("sha256").update(stableJson(records)).digest("hex").slice(0, 16)}`;
}

function specReadingEvidenceKeys(model, refs) {
  return new Set(specReadingEvidenceTargets(model, refs).flatMap((entry) => list(entry.target?.keys)));
}

function specReadingEvidenceOverlap(model, goldRefs, answerRefs) {
  const goldKeys = specReadingEvidenceKeys(model, goldRefs);
  const answerKeys = specReadingEvidenceKeys(model, answerRefs);
  return [...answerKeys].filter((key) => goldKeys.has(key)).sort();
}

function incrementCount(counts, key, amount = 1) {
  counts.set(key, (counts.get(key) ?? 0) + amount);
}

function countObject(counts) {
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function specReadingParaphrases(entry, locale) {
  return list(entry.paraphrases?.[locale]);
}

function specReadingModelFile(evaluation, evaluationFile = null) {
  return resolvePathRelativeToFile(evaluationFile, evaluation.modelPath);
}

function specReadingSuiteEvaluationEntries(suite, options = {}) {
  return list(suite.evaluations).map((file) => {
    const resolvedFile = resolvePathRelativeToFile(options.file, file);
    const evaluation = loadSpecReadingEvaluation(resolvedFile);
    return {
      file,
      resolvedFile,
      evaluation,
      modelFile: specReadingModelFile(evaluation, resolvedFile),
    };
  });
}

function specReadingEvalCaseReport(model, evaluation, entry, locale) {
  const evidenceRefs = list(entry.evidence).map((evidence) => evidence.ref);
  const evidenceErrors = evidenceRefs.flatMap((ref) => specReadingEvidenceErrors(model, ref));
  const actualDigest = specReadingEvidenceDigest(model, evidenceRefs);
  const digestErrors = entry.evidenceDigest && entry.evidenceDigest !== actualDigest
    ? [`stale evidence digest: expected ${entry.evidenceDigest}, actual ${actualDigest}`]
    : [];
  const supportErrors = entry.expected === "not-supported"
    ? (evidenceRefs.length > 0 ? ["not-supported cases must not carry evidence refs"] : [])
    : (evidenceRefs.length === 0 ? [`${entry.expected} cases require at least one evidence ref`] : []);
  const errors = [...supportErrors, ...evidenceErrors, ...digestErrors];
  return {
    id: entry.id,
    claim: text(entry.claim, locale),
    paraphrases: specReadingParaphrases(entry, locale),
    expected: entry.expected,
    evidence: evidenceRefs,
    goldEvidenceDigest: {
      expected: entry.evidenceDigest ?? null,
      actual: actualDigest,
      status: reportStatus([...evidenceErrors, ...digestErrors]),
    },
    status: reportStatus(errors),
    errors,
  };
}

function specReadingEvalInfo(evaluation, locale, options = {}) {
  const modelFile = options.modelFile ?? evaluation.modelPath;
  const evalDigest = options.file ? fileDigest(options.file) : null;
  const modelDigest = modelFile ? fileDigest(modelFile) : null;
  const info = {
    id: evaluation.id,
    modelPath: evaluation.modelPath,
    locale,
    rubricVersion: evaluation.rubricVersion ?? null,
    digest: evalDigest,
    modelDigest,
  };
  return {
    ...info,
    inputDigest: sha256Digest(stableJson({
      digest: evalDigest,
      modelDigest,
      rubricVersion: info.rubricVersion,
    })),
  };
}

function specReadingEvalReport(evaluation, options = {}) {
  const modelFile = options.modelFile ?? evaluation.modelPath;
  const model = loadModel(modelFile);
  const locale = options.locale ?? evaluation.locale ?? null;
  const cases = list(evaluation.cases).map((entry) => specReadingEvalCaseReport(model, evaluation, entry, locale));
  const expectedRubricVersion = evaluation.rubricVersion ?? SPEC_READING_RUBRIC_VERSION;
  const rubricErrors = expectedRubricVersion === SPEC_READING_RUBRIC_VERSION
    ? []
    : [`rubric version mismatch: expected ${SPEC_READING_RUBRIC_VERSION}, actual ${expectedRubricVersion}`];
  const errors = [
    ...rubricErrors,
    ...cases.flatMap((entry) => entry.errors.map((error) => `${entry.id}: ${error}`)),
  ];
  const summary = {
    cases: cases.length,
    entailed: cases.filter((entry) => entry.expected === "entailed").length,
    contradicted: cases.filter((entry) => entry.expected === "contradicted").length,
    notSupported: cases.filter((entry) => entry.expected === "not-supported").length,
  };
  return {
    status: reportStatus(errors),
    eval: specReadingEvalInfo(evaluation, locale, { ...options, modelFile }),
    rubric: {
      version: SPEC_READING_RUBRIC_VERSION,
      labels: SPEC_READING_RUBRIC,
    },
    i18n: {
      locale,
      casesWithParaphrases: cases.filter((entry) => entry.paraphrases.length > 0).length,
    },
    summary,
    cases,
    errors,
  };
}

function specReadingEvalDigestRefreshCase(model, entry) {
  const evidence = list(entry.evidence).map((evidenceEntry) => evidenceEntry.ref);
  const evidenceErrors = evidence.flatMap((ref) => specReadingEvidenceErrors(model, ref));
  const actual = specReadingEvidenceDigest(model, evidence);
  const expected = entry.evidenceDigest ?? null;
  const stale = expected !== actual;
  return {
    id: entry.id,
    evidence,
    expected,
    actual,
    stale,
    status: reportStatus(evidenceErrors),
    errors: evidenceErrors,
  };
}

function applySpecReadingEvidenceDigestUpdates(source, updates) {
  let updatedSource = source;
  const errors = [];

  for (const update of updates) {
    const id = escapeRegex(update.id);
    if (update.expected) {
      const pattern = new RegExp(`(id\\s*=\\s*"${id}"[\\s\\S]*?evidenceDigest\\s*=\\s*)"${escapeRegex(update.expected)}"`);
      if (!pattern.test(updatedSource)) {
        errors.push(`cannot update evidence digest line for case: ${update.id}`);
        continue;
      }
      updatedSource = updatedSource.replace(pattern, `$1"${update.actual}"`);
      continue;
    }

    const pattern = new RegExp(`(id\\s*=\\s*"${id}"[\\s\\S]*?)(\\n\\s*expected\\s*=\\s*"[^"]+"\\n)`);
    if (!pattern.test(updatedSource)) {
      errors.push(`cannot insert evidence digest line for case: ${update.id}`);
      continue;
    }
    updatedSource = updatedSource.replace(pattern, (_match, prefix, expectedLine) => {
      const indent = expectedLine.match(/\n(\s*)expected\s*=/)?.[1] ?? "      ";
      return `${prefix}${expectedLine}${indent}evidenceDigest = "${update.actual}"\n`;
    });
  }

  return { source: updatedSource, errors };
}

function specReadingEvalDigestRefreshReport(evaluation, file, options = {}) {
  const modelFile = options.modelFile ?? evaluation.modelPath;
  const model = loadModel(modelFile);
  const locale = options.locale ?? evaluation.locale ?? null;
  const cases = list(evaluation.cases).map((entry) => specReadingEvalDigestRefreshCase(model, entry));
  const updates = cases
    .filter((entry) => entry.stale)
    .map(({ id, evidence, expected, actual }) => ({ id, evidence, expected, actual }));
  const applyErrors = [];

  if (options.apply && updates.length > 0) {
    const applied = applySpecReadingEvidenceDigestUpdates(readTextFile(file), updates);
    applyErrors.push(...applied.errors);
    if (applyErrors.length === 0) {
      writeFileSync(resolve(file), applied.source);
    }
  }

  const errors = [
    ...cases.flatMap((entry) => entry.errors.map((error) => `${entry.id}: ${error}`)),
    ...applyErrors,
  ];
  return {
    status: reportStatus(errors),
    eval: specReadingEvalInfo(evaluation, locale, { ...options, file, modelFile }),
    apply: Boolean(options.apply),
    updated: updates.length,
    total: cases.length,
    updates,
    cases,
    errors,
  };
}

function renderSpecReadingEvalDigestRefreshMarkdownReport(report) {
  const lines = [
    `# Spec Reading Digest Refresh ${report.eval.id}`,
    "",
    `- status: \`${report.status}\``,
    `- apply: \`${report.apply}\``,
    `- updated: \`${report.updated}/${report.total}\``,
    "",
    "| Case | Expected | Actual | Stale | Status | Errors |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const entry of report.cases) {
    lines.push(`| ${markdownCell(entry.id)} | ${markdownCell(entry.expected ?? "")} | ${markdownCell(entry.actual)} | ${markdownCell(String(entry.stale))} | ${markdownCell(entry.status)} | ${markdownCell(entry.errors.join("<br>"))} |`);
  }
  return `${lines.join("\n")}\n`;
}

function renderSpecReadingEvalDigestRefreshReport(report) {
  if (report.status === "pass") {
    const verb = report.updated === 0 ? "no stale digests" : `${report.apply ? "refreshed" : "would refresh"} ${report.updated}/${report.total} digests`;
    return `ok: ${report.eval.id} spec reading digest refresh (${verb})\n`;
  }
  return `${report.errors.join("\n")}\n`;
}

function specReadingEvalSuiteReport(suite, options = {}) {
  const evaluations = specReadingSuiteEvaluationEntries(suite, options).map((entry) => ({
    file: entry.file,
    report: specReadingEvalReport(entry.evaluation, { file: entry.resolvedFile, modelFile: entry.modelFile }),
  }));
  const errors = evaluations.flatMap((entry) => entry.report.errors.map((error) => `${entry.file}: ${error}`));
  const summary = {
    evaluations: evaluations.length,
    cases: evaluations.reduce((total, entry) => total + entry.report.summary.cases, 0),
    entailed: evaluations.reduce((total, entry) => total + entry.report.summary.entailed, 0),
    contradicted: evaluations.reduce((total, entry) => total + entry.report.summary.contradicted, 0),
    notSupported: evaluations.reduce((total, entry) => total + entry.report.summary.notSupported, 0),
  };
  return {
    status: reportStatus(errors),
    suite: {
      id: suite.id,
      digest: options.file ? fileDigest(options.file) : null,
      inputDigest: sha256Digest(stableJson({
        digest: options.file ? fileDigest(options.file) : null,
        evaluations: evaluations.map((entry) => entry.report.eval.inputDigest),
      })),
    },
    summary,
    passed: evaluations.filter((entry) => entry.report.status === "pass").length,
    total: evaluations.length,
    evaluations: evaluations.map((entry) => ({
      file: entry.file,
      status: entry.report.status,
      eval: entry.report.eval,
      summary: entry.report.summary,
      errors: entry.report.errors,
    })),
    errors,
  };
}

function renderSpecReadingEvalSuiteMarkdownReport(report) {
  const lines = [
    `# Spec Reading Evaluation Suite ${report.suite.id}`,
    "",
    `- status: \`${report.status}\``,
    `- evaluations: \`${report.summary.evaluations}\``,
    `- cases: \`${report.summary.cases}\``,
    "",
    "| Evaluation | File | Status | Cases | Errors |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const entry of report.evaluations) {
    lines.push(`| ${markdownCell(entry.eval.id)} | ${markdownCell(entry.file)} | ${markdownCell(entry.status)} | ${markdownCell(String(entry.summary.cases))} | ${markdownCell(entry.errors.join("<br>"))} |`);
  }
  return `${lines.join("\n")}\n`;
}

function renderSpecReadingEvalSuiteReport(report) {
  if (report.status === "pass") {
    return `ok: ${report.suite.id} spec reading eval suite (${report.passed}/${report.total} evaluations, ${report.summary.cases} cases)\n`;
  }
  return `${report.errors.join("\n")}\n`;
}

function specReadingModelKinds(model) {
  const kinds = [];
  if (hasAny(cloudZones(cloudPattern(model)), cloudNodes(cloudPattern(model)), cloudFlows(cloudPattern(model)), cloudPolicies(cloudPattern(model)))) {
    kinds.push("cloud");
  }
  if (hasAny(dataPolicies(dataPattern(model)), dataSets(dataPattern(model)), dataStores(dataPattern(model)), dataPlacements(dataPattern(model)), dataFlows(dataPattern(model)))) {
    kinds.push("data");
  }
  if (hasAny(releaseServices(releasePattern(model)), releaseEnvironments(releasePattern(model)), releaseGates(releasePattern(model)), releaseRollbacks(releasePattern(model)), releaseMigrations(releasePattern(model)), releaseSteps(releasePattern(model)))) {
    kinds.push("release");
  }
  if (hasAny(runtimeServices(runtimePattern(model)), runtimeDependencies(runtimePattern(model)), runtimeSignals(runtimePattern(model)), runtimeRunbooks(runtimePattern(model)), runtimeAlerts(runtimePattern(model)), runtimeSlos(runtimePattern(model)), runtimeTelemetry(runtimePattern(model)), runtimeAlertPolicies(runtimePattern(model)), runtimeRunbookExecutions(runtimePattern(model)), runtimeDependencyTraces(runtimePattern(model)))) {
    kinds.push("runtime");
  }
  if (hasAny(dbTables(dbPattern(model)), dbInvariants(dbPattern(model)), dbTransactions(dbPattern(model)), dbMigrations(dbPattern(model)))) {
    kinds.push("db");
  }
  return kinds.sort();
}

function specReadingCoverageRequirement(kind, id, required, actual) {
  const status = actual >= required ? "pass" : "fail";
  return {
    kind,
    id,
    required,
    actual,
    status,
    errors: status === "pass" ? [] : [`missing spec reading suite coverage: ${kind}${id ? ` ${id}` : ""} expected ${required}, actual ${actual}`],
  };
}

function specReadingEvalSuiteCoverageReport(suite, options = {}) {
  const suiteReport = specReadingEvalSuiteReport(suite, options);
  const evaluations = specReadingSuiteEvaluationEntries(suite, options);
  const labelCounts = new Map();
  const evidenceKindCounts = new Map();
  const modelKindCounts = new Map();
  const tagCounts = new Map();
  const paraphraseLocaleCounts = new Map();
  let cases = 0;

  for (const entry of evaluations) {
    const model = loadModel(entry.modelFile);
    for (const kind of specReadingModelKinds(model)) {
      incrementCount(modelKindCounts, kind);
    }
    for (const caseEntry of list(entry.evaluation.cases)) {
      cases += 1;
      incrementCount(labelCounts, caseEntry.expected);
      for (const tag of list(caseEntry.tags)) {
        incrementCount(tagCounts, tag);
      }
      for (const [locale, paraphrases] of Object.entries(caseEntry.paraphrases ?? {})) {
        if (list(paraphrases).length > 0) incrementCount(paraphraseLocaleCounts, locale);
      }
      const refs = list(caseEntry.evidence).map((evidence) => evidence.ref);
      for (const target of specReadingEvidenceTargets(model, refs)) {
        if (target.target?.kind) incrementCount(evidenceKindCounts, target.target.kind);
      }
    }
  }

  const requirements = [
    specReadingCoverageRequirement("minEvaluations", "", suite.minEvaluations ?? 1, evaluations.length),
    specReadingCoverageRequirement("minCases", "", suite.minCases ?? 1, cases),
    ...list(suite.requiredLabels).map((label) => specReadingCoverageRequirement("label", label, 1, labelCounts.get(label) ?? 0)),
    ...list(suite.requiredEvidenceKinds).map((kind) => specReadingCoverageRequirement("evidenceKind", kind, 1, evidenceKindCounts.get(kind) ?? 0)),
    ...list(suite.requiredModelKinds).map((kind) => specReadingCoverageRequirement("modelKind", kind, 1, modelKindCounts.get(kind) ?? 0)),
    ...list(suite.requiredTags).map((tag) => specReadingCoverageRequirement("tag", tag, 1, tagCounts.get(tag) ?? 0)),
    ...list(suite.requiredParaphraseLocales).map((locale) => specReadingCoverageRequirement("paraphraseLocale", locale, 1, paraphraseLocaleCounts.get(locale) ?? 0)),
  ];
  const errors = [
    ...suiteReport.errors,
    ...requirements.flatMap((requirement) => requirement.errors),
  ];
  return {
    status: reportStatus(errors),
    suite: suiteReport.suite,
    coverage: {
      evaluations: evaluations.length,
      cases,
      labels: countObject(labelCounts),
      evidenceKinds: countObject(evidenceKindCounts),
      modelKinds: countObject(modelKindCounts),
      tags: countObject(tagCounts),
      paraphraseLocales: countObject(paraphraseLocaleCounts),
    },
    requirements,
    errors,
  };
}

function renderSpecReadingEvalSuiteCoverageMarkdownReport(report) {
  const lines = [
    `# Spec Reading Suite Coverage ${report.suite.id}`,
    "",
    `- status: \`${report.status}\``,
    `- evaluations: \`${report.coverage.evaluations}\``,
    `- cases: \`${report.coverage.cases}\``,
    "",
    "| Requirement | Target | Required | Actual | Status | Errors |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const requirement of report.requirements) {
    lines.push(`| ${markdownCell(requirement.kind)} | ${markdownCell(requirement.id)} | ${markdownCell(String(requirement.required))} | ${markdownCell(String(requirement.actual))} | ${markdownCell(requirement.status)} | ${markdownCell(requirement.errors.join("<br>"))} |`);
  }
  return `${lines.join("\n")}\n`;
}

function renderSpecReadingEvalSuiteCoverageReport(report) {
  if (report.status === "pass") {
    return `ok: ${report.suite.id} spec reading suite coverage (${report.requirements.length}/${report.requirements.length} requirements)\n`;
  }
  return `${report.errors.join("\n")}\n`;
}

function renderSpecReadingEvalMarkdownReport(report) {
  if (report.score) return renderSpecReadingEvalScoreMarkdownReport(report);
  const lines = [
    `# Spec Reading Evaluation ${report.eval.id}`,
    "",
    `- status: \`${report.status}\``,
    `- modelPath: \`${report.eval.modelPath}\``,
    `- locale: \`${report.eval.locale ?? "default"}\``,
    `- cases: \`${report.summary.cases}\``,
    "",
    "| Case | Claim | Expected | Status | Evidence | Digest | Errors |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const entry of report.cases) {
    lines.push(`| ${markdownCell(entry.id)} | ${markdownCell(entry.claim)} | ${markdownCell(entry.expected)} | ${markdownCell(entry.status)} | ${markdownCell(entry.evidence.join("<br>"))} | ${markdownCell(entry.goldEvidenceDigest.actual)} | ${markdownCell(entry.errors.join("<br>"))} |`);
  }
  return `${lines.join("\n")}\n`;
}

function renderSpecReadingEvalPrompt(evaluation, options = {}) {
  const locale = options.locale ?? evaluation.locale ?? null;
  const lines = [
    `# Spec Reading Evaluation ${evaluation.id}`,
    "",
    `modelPath: \`${evaluation.modelPath}\``,
    `locale: \`${locale ?? "default"}\``,
    "",
    "Read the spec model and classify each claim.",
    "Allowed labels: `entailed`, `contradicted`, `not-supported`",
    "",
    ...renderSpecReadingRubricLines(),
    "",
    "Return JSON in this shape:",
    "",
    "```json",
    "{\"answers\":[{\"id\":\"case-id\",\"label\":\"entailed\",\"evidence\":[\"rule:RULE-ID\"],\"rationale\":\"short reason\"}]}",
    "```",
    "",
    "## Claims",
  ];
  for (const entry of list(evaluation.cases)) {
    lines.push("", `### ${entry.id}`, "", text(entry.claim, locale));
    const paraphrases = specReadingParaphrases(entry, locale);
    if (paraphrases.length > 0) {
      lines.push("", "Paraphrases:");
      for (const paraphrase of paraphrases) lines.push(`- ${paraphrase}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function specReadingAnswersById(file) {
  const document = readJsonFile(file, "spec reading evaluation answers");
  return new Map(list(document.answers).map((entry) => [entry.id, entry]));
}

function specReadingEvalScoreReportFromAnswers(evaluation, answers, answersFile, options = {}) {
  const base = specReadingEvalReport(evaluation, options);
  const model = loadModel(options.modelFile ?? evaluation.modelPath);
  const cases = base.cases.map((entry) => {
    const answer = answers.get(entry.id);
    const actual = answer?.label ?? answer?.answer ?? answer?.actual ?? null;
    const answerEvidence = list(answer?.evidence);
    const answerEvidenceErrors = answerEvidence.flatMap((ref) => specReadingEvidenceErrors(model, ref));
    const answerEvidenceOverlap = specReadingEvidenceOverlap(model, entry.evidence, answerEvidence);
    const requiresEvidence = entry.expected !== "not-supported";
    const answerErrors = [];
    if (!answer) answerErrors.push("missing answer");
    if (answer && !["entailed", "contradicted", "not-supported"].includes(actual)) {
      answerErrors.push(`invalid answer label: ${actual}`);
    }
    if (actual && actual !== entry.expected) {
      answerErrors.push(`expected ${entry.expected}, actual ${actual}`);
    }
    if (answer && requiresEvidence && answerEvidence.length === 0) {
      answerErrors.push(`answer evidence required for ${entry.expected}`);
    }
    if (answer && requiresEvidence && answerEvidence.length > 0 && answerEvidenceOverlap.length === 0 && answerEvidenceErrors.length === 0) {
      answerErrors.push("answer evidence does not overlap gold evidence");
    }
    const errors = [...entry.errors, ...answerErrors, ...answerEvidenceErrors];
    const labelStatus = reportStatus(answerErrors.filter((error) => error.startsWith("expected ") || error.startsWith("invalid answer") || error === "missing answer"));
    const evidenceStatus = reportStatus([
      ...answerEvidenceErrors,
      ...(answer && requiresEvidence && answerEvidence.length === 0 ? [`answer evidence required for ${entry.expected}`] : []),
      ...(answer && requiresEvidence && answerEvidence.length > 0 && answerEvidenceOverlap.length === 0 && answerEvidenceErrors.length === 0 ? ["answer evidence does not overlap gold evidence"] : []),
    ]);
    return {
      ...entry,
      actual,
      answerEvidence,
      answerEvidenceOverlap,
      answerEvidenceStatus: evidenceStatus,
      labelStatus,
      answerRationale: answer?.rationale ?? null,
      status: reportStatus(errors),
      errors,
    };
  });
  const extraAnswers = [...answers.keys()].filter((id) => !cases.some((entry) => entry.id === id));
  const errors = [
    ...cases.flatMap((entry) => entry.errors.map((error) => `${entry.id}: ${error}`)),
    ...extraAnswers.map((id) => `unexpected answer: ${id}`),
  ];
  const correct = cases.filter((entry) => entry.status === "pass").length;
  const goldFixCandidates = cases
    .filter((entry) => entry.actual && entry.actual !== entry.expected && entry.answerEvidenceStatus === "pass")
    .map((entry) => ({
      id: entry.id,
      expected: entry.expected,
      actual: entry.actual,
      answerEvidence: entry.answerEvidence,
      answerRationale: entry.answerRationale,
    }));
  return {
    ...base,
    status: reportStatus(errors),
    score: {
      accuracy: cases.length === 0 ? 0 : correct / cases.length,
      correct,
      total: cases.length,
    },
    evidenceScore: {
      correct: cases.filter((entry) => entry.answerEvidenceStatus === "pass").length,
      total: cases.length,
    },
    subagentRun: {
      answersFile,
      answerCount: answers.size,
      missingAnswers: cases.filter((entry) => entry.actual === null).map((entry) => entry.id),
      unexpectedAnswers: extraAnswers,
      prompt: renderSpecReadingEvalPrompt(evaluation, options),
      goldFixCandidates,
    },
    cases,
    errors,
  };
}

function specReadingEvalScoreReport(evaluation, answersFile, options = {}) {
  return specReadingEvalScoreReportFromAnswers(evaluation, specReadingAnswersById(answersFile), answersFile, options);
}

function specReadingAgentAnswers(stdout) {
  try {
    const document = JSON.parse(stdout);
    if (!Array.isArray(document?.answers)) {
      return { answers: new Map(), errors: ["agent stdout must contain an answers array"] };
    }
    const answers = new Map();
    const errors = [];
    for (const answer of document.answers) {
      if (!answer?.id) {
        errors.push("agent answer is missing id");
        continue;
      }
      if (answers.has(answer.id)) errors.push(`duplicate agent answer: ${answer.id}`);
      answers.set(answer.id, answer);
    }
    return { answers, errors };
  } catch (error) {
    return { answers: new Map(), errors: [`failed to parse agent stdout: ${error.message}`] };
  }
}

function specReadingAgentReport(evaluation, runner, runnerFile, options = {}) {
  const command = list(runner.command);
  const prompt = renderSpecReadingEvalPrompt(evaluation, options);
  const executionErrors = [];
  let result = { status: null, signal: null, stdout: "", stderr: "" };
  if (command.length === 0) {
    executionErrors.push("spec reading agent runner command must not be empty");
  } else {
    result = spawnSync(command[0], command.slice(1), {
      cwd: dirname(resolve(runnerFile)),
      input: prompt,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: runner.timeoutMs,
    });
    if (result.error) executionErrors.push(`spec reading agent process failed: ${result.error.message}`);
    if (result.status !== 0) executionErrors.push(`spec reading agent exited with status ${result.status ?? "unknown"}`);
  }

  const rawStdout = result.stdout ?? "";
  const rawStderr = result.stderr ?? "";
  const parsed = specReadingAgentAnswers(rawStdout);
  const report = specReadingEvalScoreReportFromAnswers(
    evaluation,
    parsed.answers,
    `runner:${runner.id}`,
    options,
  );
  const agentErrors = [...executionErrors, ...parsed.errors];
  const errors = [...report.errors, ...agentErrors];
  const runnerIdentity = { id: runner.id, provider: runner.provider, model: runner.model };
  return {
    ...report,
    status: reportStatus(errors),
    agentRun: {
      contractVersion: "spec-reading-agent-process-v1",
      runner: runnerIdentity,
      runnerDigest: sha256Digest(stableJson({ ...runnerIdentity, command, timeoutMs: runner.timeoutMs })),
      command,
      timeoutMs: runner.timeoutMs,
      promptDigest: sha256Digest(prompt),
      answerDigest: sha256Digest(rawStdout),
      exitCode: result.status ?? null,
      signal: result.signal ?? null,
      rawStdout,
      rawStderr,
    },
    errors,
  };
}

function specReadingGoldAnswers(evaluation) {
  return list(evaluation.cases).map((entry) => ({
    id: entry.id,
    label: entry.expected,
    evidence: list(entry.evidence).map((evidence) => evidence.ref),
    rationale: "gold oracle",
  }));
}

function specReadingAnswerMap(answers) {
  return new Map(answers.map((answer) => [answer.id, answer]));
}

function specReadingMetamorphicVariantReport(evaluation, id, answers, options = {}) {
  const report = specReadingEvalScoreReportFromAnswers(evaluation, specReadingAnswerMap(answers), id, options);
  return {
    id,
    status: report.status,
    score: report.score,
    evidenceScore: report.evidenceScore,
    errors: report.errors,
  };
}

function flipSpecReadingLabel(label) {
  if (label === "entailed") return "not-supported";
  if (label === "not-supported") return "entailed";
  return "entailed";
}

function specReadingPromptLeakReport(evaluation, id, locale) {
  const prompt = renderSpecReadingEvalPrompt(evaluation, { locale });
  const leaks = list(evaluation.cases).filter((entry) => {
    const pattern = new RegExp(`${escapeRegex(entry.id)}[\\s\\S]{0,160}${escapeRegex(entry.expected)}`);
    return pattern.test(prompt);
  }).map((entry) => entry.id);
  return {
    id,
    locale: locale ?? evaluation.locale ?? null,
    status: leaks.length === 0 ? "pass" : "fail",
    leaks,
    errors: leaks.map((caseId) => `prompt leaks gold label near case: ${caseId}`),
  };
}

function specReadingMetamorphicReport(evaluation, options = {}) {
  const locale = options.locale ?? evaluation.locale ?? null;
  const gold = specReadingGoldAnswers(evaluation);
  const variants = [
    specReadingMetamorphicVariantReport(evaluation, "gold-order", gold, options),
    specReadingMetamorphicVariantReport(evaluation, "reversed-answer-order", [...gold].reverse(), options),
    specReadingMetamorphicVariantReport(
      evaluation,
      "reversed-evidence-order",
      gold.map((answer) => ({ ...answer, evidence: [...list(answer.evidence)].reverse() })),
      options,
    ),
    specReadingMetamorphicVariantReport(
      evaluation,
      "noisy-rationale",
      gold.map((answer) => ({ ...answer, rationale: `${answer.rationale}; unrelated implementation note ignored` })),
      options,
    ),
  ];
  const negativeAnswers = gold.map((answer, index) =>
    index === 0 ? { ...answer, label: flipSpecReadingLabel(answer.label), rationale: "intentionally wrong label" } : answer
  );
  const negativeScore = specReadingEvalScoreReportFromAnswers(
    evaluation,
    specReadingAnswerMap(negativeAnswers),
    "negative-control-flipped-label",
    options,
  );
  const negativeControls = [{
    id: "flipped-label",
    status: negativeScore.status === "fail" ? "pass" : "fail",
    expectedFailure: true,
    score: negativeScore.score,
    errors: negativeScore.status === "fail" ? [] : ["negative control unexpectedly passed"],
  }];
  const promptChecks = [
    specReadingPromptLeakReport(evaluation, "prompt-default", locale),
    specReadingPromptLeakReport(evaluation, "prompt-en", "en"),
  ];
  const errors = [
    ...variants.flatMap((variant) => variant.status === "pass" ? [] : variant.errors.map((error) => `${variant.id}: ${error}`)),
    ...negativeControls.flatMap((control) => control.errors.map((error) => `${control.id}: ${error}`)),
    ...promptChecks.flatMap((check) => check.errors.map((error) => `${check.id}: ${error}`)),
  ];
  return {
    status: reportStatus(errors),
    eval: specReadingEvalInfo(evaluation, locale, options),
    variants,
    negativeControls,
    promptChecks,
    errors,
  };
}

function renderSpecReadingMetamorphicMarkdownReport(report) {
  const lines = [
    `# Spec Reading Metamorphic ${report.eval.id}`,
    "",
    `- status: \`${report.status}\``,
    "",
    "| Kind | Id | Status | Score | Errors |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const variant of report.variants) {
    lines.push(`| variant | ${markdownCell(variant.id)} | ${markdownCell(variant.status)} | ${markdownCell(`${variant.score.correct}/${variant.score.total}`)} | ${markdownCell(variant.errors.join("<br>"))} |`);
  }
  for (const control of report.negativeControls) {
    lines.push(`| negative | ${markdownCell(control.id)} | ${markdownCell(control.status)} | ${markdownCell(`${control.score.correct}/${control.score.total}`)} | ${markdownCell(control.errors.join("<br>"))} |`);
  }
  for (const check of report.promptChecks) {
    lines.push(`| prompt | ${markdownCell(check.id)} | ${markdownCell(check.status)} | ${markdownCell(check.locale ?? "")} | ${markdownCell(check.errors.join("<br>"))} |`);
  }
  return `${lines.join("\n")}\n`;
}

function renderSpecReadingMetamorphicReport(report) {
  if (report.status === "pass") {
    return `ok: ${report.eval.id} spec reading metamorphic (${report.variants.length} variants, ${report.negativeControls.length} negative controls)\n`;
  }
  return `${report.errors.join("\n")}\n`;
}

function renderSpecReadingEvalScoreMarkdownReport(report) {
  const lines = [
    `# Spec Reading Evaluation ${report.eval.id}`,
    "",
    `- status: \`${report.status}\``,
    `- modelPath: \`${report.eval.modelPath}\``,
    `- locale: \`${report.eval.locale ?? "default"}\``,
    `- score: \`${report.score.correct}/${report.score.total}\``,
    `- evidence score: \`${report.evidenceScore.correct}/${report.evidenceScore.total}\``,
    `- gold fix candidates: \`${report.subagentRun.goldFixCandidates.length}\``,
    "",
    "## Subagent Run",
    "",
    `- answersFile: \`${report.subagentRun.answersFile}\``,
    `- answerCount: \`${report.subagentRun.answerCount}\``,
    `- missingAnswers: \`${report.subagentRun.missingAnswers.length}\``,
    `- unexpectedAnswers: \`${report.subagentRun.unexpectedAnswers.length}\``,
    "",
    "| Case | Expected | Actual | Label | Evidence | Status |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const entry of report.cases) {
    const evidence = [
      `gold: ${entry.evidence.join("<br>")}`,
      `answer: ${entry.answerEvidence.join("<br>")}`,
      `overlap: ${entry.answerEvidenceOverlap.join("<br>")}`,
    ].join("<br>");
    lines.push(`| ${markdownCell(entry.id)} | ${markdownCell(entry.expected)} | ${markdownCell(entry.actual ?? "")} | ${markdownCell(entry.labelStatus)} | ${markdownCell(evidence)} | ${markdownCell(entry.status)} |`);
  }
  if (report.subagentRun.goldFixCandidates.length > 0) {
    lines.push("", "## Gold Fix Candidates", "");
    for (const candidate of report.subagentRun.goldFixCandidates) {
      lines.push(`- ${candidate.id}: expected \`${candidate.expected}\`, actual \`${candidate.actual}\``);
    }
  }
  return `${lines.join("\n")}\n`;
}

function renderSpecReadingEvalReport(report) {
  if (report.score) {
    if (report.status === "pass") {
      return `ok: ${report.eval.id} spec reading score ${report.score.correct}/${report.score.total}\n`;
    }
    return `${report.errors.join("\n")}\n`;
  }
  if (report.status === "pass") {
    return `ok: ${report.eval.id} spec reading eval (${report.summary.cases} cases)\n`;
  }
  return `${report.errors.join("\n")}\n`;
}

function renderAppProfileEvaluationMarkdownReport(report) {
  return renderAppProfileEvaluationMarkdownReportModule(report);
}

function renderAppProfileScenarioCoverageMarkdownReport(report) {
  return renderAppProfileScenarioCoverageMarkdownReportModule(report);
}

function renderAppProfileMutationScoreMarkdownReport(report) {
  return renderAppProfileMutationScoreMarkdownReportModule(report);
}

function renderAppProfileEvaluationReport(report) {
  return renderAppProfileEvaluationReportModule(report);
}

function renderAppProfileMutationScoreReport(report) {
  return renderAppProfileMutationScoreReportModule(report);
}

function sqlQueryName(chunk, index) {
  const match = chunk.match(/--\s*name:\s*([A-Za-z0-9_.-]+)/i);
  return match ? match[1] : `query[${index}]`;
}

function parseSqlQueryCatalog(sql) {
  return splitSqlTopLevel(sql, ";")
    .map((chunk, index) => {
      const statement = stripSqlComments(chunk).trim();
      if (statement.length === 0) return null;
      const operation = statement.match(/^\s*([A-Za-z]+)/)?.[1]?.toLowerCase() ?? "unknown";
      return {
        id: sqlQueryName(chunk, index),
        index,
        operation,
        statement,
      };
    })
    .filter(Boolean);
}

function sqlIdentifierPattern() {
  return "[A-Za-z_][A-Za-z0-9_$]*|`[^`]+`|\"[^\"]+\"|\\[[^\\]]+\\]";
}

function sqlAliasStopKeyword(value) {
  return /^(where|join|left|right|inner|outer|full|cross|on|using|group|order|limit|offset|returning|set|values)$/i.test(value);
}

function normalizeSqlStatementText(statement) {
  return statement.replace(/\s+/g, " ").trim();
}

function addSqlQueryTable(tables, table, alias, source) {
  if (!table) return;
  const cleanTable = normalizeSqlIdentifier(table);
  const cleanAlias = alias && !sqlAliasStopKeyword(alias) ? normalizeSqlIdentifier(alias) : cleanTable;
  const key = `${cleanTable}:${cleanAlias}`;
  if (tables.some((entry) => entry.key === key)) return;
  tables.push({ alias: cleanAlias, key, source, table: cleanTable });
}

function sqlQueryTables(query) {
  const statement = normalizeSqlStatementText(query.statement);
  const identifier = sqlIdentifierPattern();
  const tables = [];
  const scans = [
    { source: "from", pattern: new RegExp(`\\bfrom\\s+(${identifier})(?:\\s+(?:as\\s+)?(${identifier}))?`, "gi") },
    { source: "join", pattern: new RegExp(`\\bjoin\\s+(${identifier})(?:\\s+(?:as\\s+)?(${identifier}))?`, "gi") },
    { source: "update", pattern: new RegExp(`\\bupdate\\s+(${identifier})(?:\\s+(?:as\\s+)?(${identifier}))?`, "gi") },
    { source: "insert", pattern: new RegExp(`\\binsert\\s+into\\s+(${identifier})(?:\\s+(?:as\\s+)?(${identifier}))?`, "gi") },
    { source: "delete", pattern: new RegExp(`\\bdelete\\s+from\\s+(${identifier})(?:\\s+(?:as\\s+)?(${identifier}))?`, "gi") },
  ];
  for (const scan of scans) {
    for (const match of statement.matchAll(scan.pattern)) {
      addSqlQueryTable(tables, match[1], match[2], scan.source);
    }
  }
  return tables;
}

function sqlDbColumnMap(table) {
  return new Map(list(table.columns).map((column) => [column.id, column]));
}

function sqlDbContext(db) {
  const tables = dbTableMap(db);
  const columnsByTable = new Map(dbTables(db).map((table) => [table.id, sqlDbColumnMap(table)]));
  return { columnsByTable, tables };
}

function sqlQueryAliasMap(entries) {
  const aliases = new Map();
  for (const entry of entries) {
    aliases.set(entry.table, entry.table);
    aliases.set(entry.alias, entry.table);
  }
  return aliases;
}

function sqlSelectList(statement) {
  const match = statement.match(/\bselect\s+([\s\S]+?)\s+\bfrom\b/i);
  return match ? splitSqlList(match[1]) : [];
}

function sqlInsertColumns(statement) {
  const identifier = sqlIdentifierPattern();
  const match = statement.match(new RegExp(`\\binsert\\s+into\\s+(${identifier})\\s*\\(([^)]+)\\)`, "i"));
  if (!match) return [];
  return splitSqlList(match[2]).map(normalizeSqlIdentifier);
}

function sqlHasQualifiedColumn(statement, aliases, tableId, columnId) {
  for (const [alias, table] of aliases.entries()) {
    if (table !== tableId) continue;
    const escapedAlias = escapeRegex(alias);
    const escapedColumn = escapeRegex(columnId);
    if (new RegExp(`\\b${escapedAlias}\\s*\\.\\s*${escapedColumn}\\b`, "i").test(statement)) {
      return true;
    }
  }
  return false;
}

function sqlHasTenantFilter(statement, aliases, entries, table, tenantColumn) {
  if (sqlHasQualifiedColumn(statement, aliases, table.id, tenantColumn)) return true;
  if (entries.length === 1) {
    return new RegExp(`\\b${escapeRegex(tenantColumn)}\\b`, "i").test(statement);
  }
  return false;
}

function sqlError(query, property, message, details = {}) {
  return { query: query.id, property, message, ...details };
}

function validateSqlQueryUnknownRefs(query, db, context, entries, aliases) {
  const errors = [];
  for (const entry of entries) {
    if (!context.tables.has(entry.table)) {
      errors.push(sqlError(query, "sql-unknown-table", `query references unknown table: ${entry.table}`, { table: entry.table }));
    }
  }

  for (const match of query.statement.matchAll(/\b([A-Za-z_][A-Za-z0-9_$]*)\s*\.\s*([A-Za-z_][A-Za-z0-9_$]*)\b/g)) {
    const qualifier = match[1];
    const columnId = match[2];
    const tableId = aliases.get(qualifier);
    if (!tableId) continue;
    const columns = context.columnsByTable.get(tableId);
    if (!columns?.has(columnId)) {
      errors.push(
        sqlError(query, "sql-unknown-column", `query references unknown column: ${qualifier}.${columnId}`, {
          column: `${qualifier}.${columnId}`,
          table: tableId,
        }),
      );
    }
  }

  const insertColumns = sqlInsertColumns(query.statement);
  if (query.operation === "insert" && entries.length > 0) {
    const table = context.tables.get(entries[0].table);
    const columns = table ? context.columnsByTable.get(table.id) : null;
    for (const columnId of insertColumns) {
      if (columns && !columns.has(columnId)) {
        errors.push(sqlError(query, "sql-unknown-column", `query inserts unknown column: ${entries[0].table}.${columnId}`, { column: `${entries[0].table}.${columnId}`, table: entries[0].table }));
      }
    }
  }

  return errors;
}

function validateSqlQuerySelectStar(query) {
  if (query.operation !== "select") return [];
  return sqlSelectList(query.statement)
    .filter((item) => item.trim() === "*" || /\.\s*\*$/.test(item.trim()))
    .map((item) => sqlError(query, "sql-select-star", `query uses SELECT star: ${item.trim()}`));
}

function validateSqlQueryFkJoins(query, db, context, entries, aliases) {
  if (entries.length < 2) return [];
  const tableIds = new Set(entries.map((entry) => entry.table));
  const errors = [];
  const seen = new Set();
  for (const entry of entries) {
    const table = context.tables.get(entry.table);
    if (!table) continue;
    for (const column of list(table.columns)) {
      if (!column.references) continue;
      const ref = dbColumnRefParts(column.references);
      if (!ref || !tableIds.has(ref.tableId)) continue;
      const hasSource = sqlHasQualifiedColumn(query.statement, aliases, table.id, column.id);
      const hasTarget = sqlHasQualifiedColumn(query.statement, aliases, ref.tableId, ref.columnId);
      if (hasSource && hasTarget) continue;
      const key = `${query.id}:${table.id}.${column.id}->${ref.tableId}.${ref.columnId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push(
        sqlError(query, "sql-missing-fk-join", `query joins ${table.id} and ${ref.tableId} without referencing ${table.id}.${column.id} -> ${ref.tableId}.${ref.columnId}`, {
          column: `${table.id}.${column.id}`,
          references: `${ref.tableId}.${ref.columnId}`,
          table: table.id,
        }),
      );
    }
  }
  return errors;
}

function validateSqlQueryTenantFilters(query, db, context, entries, aliases) {
  const errors = [];
  if (query.operation === "insert") {
    const columns = new Set(sqlInsertColumns(query.statement));
    for (const entry of entries) {
      const table = context.tables.get(entry.table);
      if (table?.tenantColumn && !columns.has(table.tenantColumn)) {
        errors.push(sqlError(query, "sql-insert-missing-tenant-column", `insert into tenant-scoped table ${table.id} omits ${table.tenantColumn}`, { column: `${table.id}.${table.tenantColumn}`, table: table.id }));
      }
    }
    return errors;
  }

  for (const entry of entries) {
    const table = context.tables.get(entry.table);
    if (!table?.tenantColumn) continue;
    if (!sqlHasTenantFilter(query.statement, aliases, entries, table, table.tenantColumn)) {
      errors.push(sqlError(query, "sql-missing-tenant-filter", `query touching tenant-scoped table ${table.id} does not mention ${table.tenantColumn}`, { column: `${table.id}.${table.tenantColumn}`, table: table.id }));
    }
  }
  return errors;
}

function validateSqlQuery(query, db, context) {
  const entries = sqlQueryTables(query);
  const aliases = sqlQueryAliasMap(entries);
  return [
    ...validateSqlQuerySelectStar(query),
    ...validateSqlQueryUnknownRefs(query, db, context, entries, aliases),
    ...validateSqlQueryFkJoins(query, db, context, entries, aliases),
    ...validateSqlQueryTenantFilters(query, db, context, entries, aliases),
  ];
}

function checkSqlQueriesReport(model, sql) {
  const db = dbPattern(model);
  if (!db) {
    return {
      errors: [{ message: "model has no patterns.db", property: "sql-missing-db-model", query: null }],
      model: { id: model.id, version: model.version },
      queries: 0,
      status: "fail",
    };
  }

  const queries = parseSqlQueryCatalog(sql);
  const context = sqlDbContext(db);
  const errors = queries.flatMap((query) => validateSqlQuery(query, db, context));
  return {
    errors,
    model: { id: model.id, version: model.version },
    queries: queries.length,
    status: errors.length > 0 ? "fail" : "pass",
  };
}

function renderSqlQueryReport(report) {
  if (report.status === "pass") {
    return `ok: ${report.model.id} sql queries (${report.queries} queries)\n`;
  }
  return `${report.errors.map((error) => `${error.query ?? "(model)"}: ${error.property}: ${error.message}`).join("\n")}\n`;
}

function providerList(document, provider, field) {
  return list(document?.[provider]?.[field]);
}

function requiredImportString(errors, path, record, field) {
  const value = record?.[field];
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`runtime evidence import ${path} missing required field: ${field}`);
    return "";
  }
  return value;
}

function optionalImportString(errors, path, record, field) {
  const value = record?.[field];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`runtime evidence import ${path} invalid string field: ${field}`);
    return null;
  }
  return value;
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function optionalImportIsoDate(errors, path, record, field) {
  const value = optionalImportString(errors, path, record, field);
  if (value && !isIsoDate(value)) {
    errors.push(`runtime evidence import ${path} invalid ISO date field: ${field}`);
  }
  return value;
}

function optionalImportBoolean(errors, path, record, field, fallback) {
  const value = record?.[field];
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "boolean") {
    errors.push(`runtime evidence import ${path} invalid boolean field: ${field}`);
    return fallback;
  }
  return value;
}

function requiredImportEnum(errors, path, record, field, allowed) {
  const value = requiredImportString(errors, path, record, field);
  if (value && !allowed.includes(value)) {
    errors.push(`runtime evidence import ${path} invalid ${field}: ${value}`);
  }
  return value;
}

function optionalImportInt(errors, path, record, field, { min = null, max = null } = {}) {
  const value = record?.[field];
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value)) {
    errors.push(`runtime evidence import ${path} invalid integer field: ${field}`);
    return null;
  }
  if (min !== null && value < min) {
    errors.push(`runtime evidence import ${path} ${field} below range: ${value}`);
  }
  if (max !== null && value > max) {
    errors.push(`runtime evidence import ${path} ${field} out of range: ${value}`);
  }
  return value;
}

function normalizeRuntimeEvidenceImport(document) {
  const errors = [];
  const telemetry = providerList(document, "prometheus", "telemetry").map((record, index) => {
    const path = `prometheus.telemetry[${index}]`;
    return {
      id: requiredImportString(errors, path, record, "id"),
      observedPercent: optionalImportInt(errors, path, record, "observedPercent", { min: 0, max: 100 }),
      service: requiredImportString(errors, path, record, "service"),
      signal: requiredImportString(errors, path, record, "signal"),
      observedAt: optionalImportIsoDate(errors, path, record, "observedAt"),
      slo: optionalImportString(errors, path, record, "slo"),
      source: optionalImportString(errors, path, record, "source"),
    };
  });
  const alertPolicies = providerList(document, "pagerduty", "alertPolicies").map((record, index) => {
    const path = `pagerduty.alertPolicies[${index}]`;
    return {
      alert: requiredImportString(errors, path, record, "alert"),
      enabled: optionalImportBoolean(errors, path, record, "enabled", true),
      id: requiredImportString(errors, path, record, "id"),
      observedAt: optionalImportIsoDate(errors, path, record, "observedAt"),
      source: optionalImportString(errors, path, record, "source"),
    };
  });
  const runbookExecutions = providerList(document, "incident", "runbookExecutions").map((record, index) => {
    const path = `incident.runbookExecutions[${index}]`;
    return {
      executedAt: optionalImportIsoDate(errors, path, record, "executedAt"),
      id: requiredImportString(errors, path, record, "id"),
      runbook: requiredImportString(errors, path, record, "runbook"),
      source: optionalImportString(errors, path, record, "source"),
      status: requiredImportEnum(errors, path, record, "status", ["pass", "fail"]),
    };
  });
  const dependencyTraces = providerList(document, "otel", "dependencyTraces").map((record, index) => {
    const path = `otel.dependencyTraces[${index}]`;
    return {
      dependency: requiredImportString(errors, path, record, "dependency"),
      id: requiredImportString(errors, path, record, "id"),
      idempotencyKeyObserved: optionalImportBoolean(errors, path, record, "idempotencyKeyObserved", false),
      observedAt: optionalImportIsoDate(errors, path, record, "observedAt"),
      observedLatencyMs: optionalImportInt(errors, path, record, "observedLatencyMs", { min: 0 }),
      source: optionalImportString(errors, path, record, "source"),
      timedOut: optionalImportBoolean(errors, path, record, "timedOut", false),
    };
  });
  const intentExecutions = providerList(document, "otel", "intentExecutions").map((record, index) => {
    const path = `otel.intentExecutions[${index}]`;
    return {
      duplicateSuppressed: optionalImportBoolean(errors, path, record, "duplicateSuppressed", false),
      id: requiredImportString(errors, path, record, "id"),
      idempotencyKeyObserved: optionalImportBoolean(errors, path, record, "idempotencyKeyObserved", false),
      maxInFlightObserved: optionalImportInt(errors, path, record, "maxInFlightObserved", { min: 0 }),
      observedAt: optionalImportIsoDate(errors, path, record, "observedAt"),
      observedLatencyMs: optionalImportInt(errors, path, record, "observedLatencyMs", { min: 0 }),
      process: requiredImportString(errors, path, record, "process"),
      refinement: requiredImportString(errors, path, record, "refinement"),
      source: optionalImportString(errors, path, record, "source"),
      timedOut: optionalImportBoolean(errors, path, record, "timedOut", false),
    };
  });

  if (errors.length > 0) {
    throw new CommandError(`${errors.join("\n")}\n`);
  }

  return {
    alertPolicies: alertPolicies.sort(byId),
    dependencyTraces: dependencyTraces.sort(byId),
    intentExecutions: intentExecutions.sort(byId),
    runbookExecutions: runbookExecutions.sort(byId),
    telemetry: telemetry.sort(byId),
  };
}

function pklString(value) {
  return JSON.stringify(String(value));
}

function pushPklListing(lines, indent, field, values) {
  if (!values || values.length === 0) return;
  lines.push(`${indent}${field} {`);
  for (const value of values) {
    lines.push(`${indent}  ${pklString(value)}`);
  }
  lines.push(`${indent}}`);
}

function pushPklField(lines, indent, field, value) {
  if (value === null || value === undefined) return;
  if (typeof value === "boolean" || typeof value === "number") {
    lines.push(`${indent}${field} = ${value}`);
    return;
  }
  lines.push(`${indent}${field} = ${pklString(value)}`);
}

function pushPklRecord(lines, className, record, fields) {
  lines.push(`    new d.${className} {`);
  for (const field of fields) {
    pushPklField(lines, "      ", field, record[field]);
  }
  lines.push("    }");
}

function emitRuntimeEvidencePkl(evidence) {
  const lines = [];
  if (evidence.telemetry.length > 0) {
    lines.push("telemetry {");
    for (const record of evidence.telemetry) {
      pushPklRecord(lines, "RuntimeTelemetryWindow", record, ["id", "service", "signal", "slo", "observedPercent", "observedAt", "source"]);
    }
    lines.push("}");
  }
  if (evidence.alertPolicies.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("alertPolicies {");
    for (const record of evidence.alertPolicies) {
      pushPklRecord(lines, "RuntimeAlertPolicy", record, ["id", "alert", "enabled", "observedAt", "source"]);
    }
    lines.push("}");
  }
  if (evidence.runbookExecutions.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("runbookExecutions {");
    for (const record of evidence.runbookExecutions) {
      pushPklRecord(lines, "RuntimeRunbookExecution", record, ["id", "runbook", "status", "executedAt", "source"]);
    }
    lines.push("}");
  }
  if (evidence.dependencyTraces.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("dependencyTraces {");
    for (const record of evidence.dependencyTraces) {
      pushPklRecord(lines, "RuntimeDependencyTrace", record, ["id", "dependency", "observedLatencyMs", "timedOut", "idempotencyKeyObserved", "observedAt", "source"]);
    }
    lines.push("}");
  }
  if (evidence.intentExecutions.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("intentExecutions {");
    for (const record of evidence.intentExecutions) {
      pushPklRecord(lines, "RuntimeIntentExecution", record, ["id", "process", "refinement", "observedLatencyMs", "maxInFlightObserved", "timedOut", "idempotencyKeyObserved", "duplicateSuppressed", "observedAt", "source"]);
    }
    lines.push("}");
  }
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

function importRuntimeEvidence(document, { json = false } = {}) {
  const evidence = normalizeRuntimeEvidenceImport(document);
  return json ? stableJson({ runtimeEvidence: evidence }) : emitRuntimeEvidencePkl(evidence);
}

function numericValue(value) {
  if (Array.isArray(value)) {
    return numericValue(value[value.length - 1]);
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ratioToPercent(value) {
  const number = numericValue(value);
  if (number === null) return null;
  return Math.round(number <= 1 ? number * 100 : number);
}

function coerceIsoDate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    if (isIsoDate(value)) return value;
    const match = value.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (match) return match[1];
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString().slice(0, 10);
  }
  return null;
}

function collectPrometheusTelemetry(payload) {
  return list(payload?.data?.result).map((entry, index) => {
    const metric = entry?.metric ?? {};
    const id = metric.evidence_id ?? metric.id ?? `prometheus-telemetry-${index}`;
    return {
      id,
      observedAt: coerceIsoDate(metric.observed_at ?? metric.observedAt ?? (Array.isArray(entry?.value) ? entry.value[0] : null)),
      observedPercent: ratioToPercent(entry?.value),
      service: metric.service,
      signal: metric.signal,
      slo: metric.slo ?? null,
      source: metric.source ?? `prometheus:${metric.__name__ ?? id}`,
    };
  });
}

function collectPagerDutyAlertPolicies(payload) {
  return list(payload?.alert_policies ?? payload?.alertPolicies ?? payload?.policies).map((policy, index) => {
    const id = policy?.id ?? `pagerduty-alert-policy-${index}`;
    return {
      alert: policy?.alert,
      enabled: policy?.enabled ?? true,
      id,
      observedAt: coerceIsoDate(policy?.observed_at ?? policy?.observedAt ?? policy?.updated_at ?? policy?.updatedAt ?? null),
      source: policy?.source ?? policy?.html_url ?? `pagerduty:${id}`,
    };
  });
}

function collectIncidentRunbookExecutions(payload) {
  return list(payload?.runbook_executions ?? payload?.runbookExecutions).map((execution, index) => {
    const id = execution?.id ?? `runbook-execution-${index}`;
    return {
      executedAt: execution?.executed_at ?? execution?.executedAt ?? null,
      id,
      runbook: execution?.runbook,
      source: execution?.source ?? `incident:${id}`,
      status: execution?.status,
    };
  });
}

function collectOtelDependencyTraces(payload) {
  return list(payload?.spans).map((span, index) => {
    const attributes = span?.attributes ?? {};
    const id = span?.span_id ?? span?.spanId ?? span?.id ?? `otel-dependency-trace-${index}`;
    const durationMs = span?.duration_ms ?? span?.durationMs ?? (span?.duration_nano !== undefined ? Math.round(Number(span.duration_nano) / 1000000) : null);
    return {
      dependency: attributes["dspec.dependency"] ?? attributes["peer.service"] ?? span?.name,
      id,
      idempotencyKeyObserved: Boolean(attributes["http.request.header.idempotency-key.present"] ?? attributes["idempotency_key_present"] ?? false),
      observedAt: coerceIsoDate(span?.observed_at ?? span?.observedAt ?? span?.start_time ?? span?.startTime ?? null),
      observedLatencyMs: durationMs,
      source: span?.source ?? `otel:${span?.trace_id ?? span?.traceId ?? id}`,
      timedOut: Boolean(attributes["timeout"] ?? attributes["timeout.observed"] ?? span?.status?.code === "TIMEOUT"),
    };
  });
}

function collectOtelIntentExecutions(payload) {
  return list(payload?.spans).map((span, index) => {
    const attributes = span?.attributes ?? {};
    const id = span?.span_id ?? span?.spanId ?? span?.id ?? `otel-intent-execution-${index}`;
    const durationMs = span?.duration_ms ?? span?.durationMs ?? (span?.duration_nano !== undefined ? Math.round(Number(span.duration_nano) / 1000000) : null);
    const maxInFlightObserved = numericValue(attributes["dspec.execution.max_in_flight"] ?? attributes["dspec.execution.maxInFlight"]);
    return {
      duplicateSuppressed: Boolean(attributes["dspec.execution.duplicate_suppressed"] ?? attributes["dspec.execution.duplicateSuppressed"] ?? false),
      id,
      idempotencyKeyObserved: Boolean(attributes["http.request.header.idempotency-key.present"] ?? attributes["idempotency_key_present"] ?? false),
      maxInFlightObserved: Number.isInteger(maxInFlightObserved) ? maxInFlightObserved : null,
      observedAt: coerceIsoDate(span?.observed_at ?? span?.observedAt ?? span?.start_time ?? span?.startTime ?? null),
      observedLatencyMs: durationMs,
      process: attributes["dspec.intent.process"] ?? attributes["intent.process"] ?? null,
      refinement: attributes["dspec.intent.refinement"] ?? attributes["intent.refinement"] ?? null,
      source: span?.source ?? `otel:${span?.trace_id ?? span?.traceId ?? id}`,
      timedOut: Boolean(attributes["timeout"] ?? attributes["timeout.observed"] ?? span?.status?.code === "TIMEOUT"),
    };
  });
}

function collectorAdapter(provider, kind) {
  if (provider === "prometheus" && kind === "telemetry") return collectPrometheusTelemetry;
  if (provider === "pagerduty" && kind === "alertPolicies") return collectPagerDutyAlertPolicies;
  if (provider === "incident" && kind === "runbookExecutions") return collectIncidentRunbookExecutions;
  if (provider === "otel" && kind === "dependencyTraces") return collectOtelDependencyTraces;
  if (provider === "otel" && kind === "intentExecutions") return collectOtelIntentExecutions;
  return null;
}

async function fetchRuntimeEvidenceHttpSource(source, index) {
  const url = String(source.url ?? "");
  if (!url) {
    throw new CommandError(`runtime evidence collector source[${index}] missing url\n`);
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new CommandError(`runtime evidence collector source[${index}] invalid url: ${url}\n`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CommandError(`runtime evidence collector source[${index}] unsupported url protocol: ${parsed.protocol}\n`);
  }
  const timeoutMs = Number.isInteger(source.timeoutMs) ? source.timeoutMs : 10000;
  const headers = source.headers && typeof source.headers === "object" ? source.headers : {};
  let response;
  try {
    response = await fetch(parsed, {
      headers,
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new CommandError(`runtime evidence collector source[${index}] http fetch failed: ${error.message}\n`);
  }
  if (!response.ok) {
    throw new CommandError(`runtime evidence collector source[${index}] http status ${response.status}: ${url}\n`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new CommandError(`runtime evidence collector source[${index}] invalid JSON response: ${error.message}\n`);
  }
}

async function readRuntimeEvidenceCollectorSource(source, baseDir, index) {
  if (source?.source === "inline") {
    if (!source.payload || typeof source.payload !== "object") {
      throw new CommandError(`runtime evidence collector source[${index}] missing inline payload\n`);
    }
    return source.payload;
  }
  if (source?.source === "file") {
    const sourcePath = String(source.path ?? "");
    if (!sourcePath) {
      throw new CommandError(`runtime evidence collector source[${index}] missing path\n`);
    }
    const fullPath = isAbsolute(sourcePath) ? sourcePath : resolve(baseDir, sourcePath);
    return readJsonFile(fullPath, "runtime evidence collector source");
  }
  if (source?.source === "http") {
    return fetchRuntimeEvidenceHttpSource(source, index);
  }
  throw new CommandError(`runtime evidence collector source[${index}] unsupported source: ${source?.source ?? ""}\n`);
}

async function collectRuntimeEvidence(manifest, baseDir = process.cwd()) {
  const errors = [];
  const collected = {
    incident: { runbookExecutions: [] },
    otel: { dependencyTraces: [], intentExecutions: [] },
    pagerduty: { alertPolicies: [] },
    prometheus: { telemetry: [] },
  };

  for (const [index, source] of list(manifest?.sources).entries()) {
    const provider = source?.provider;
    const kind = source?.kind;
    const adapter = collectorAdapter(provider, kind);
    if (!adapter) {
      errors.push(`runtime evidence collector source[${index}] unsupported provider/kind: ${provider ?? ""}/${kind ?? ""}`);
      continue;
    }
    const payload = await readRuntimeEvidenceCollectorSource(source, baseDir, index);
    collected[provider][kind].push(...adapter(payload));
  }

  if (errors.length > 0) {
    throw new CommandError(`${errors.join("\n")}\n`);
  }

  normalizeRuntimeEvidenceImport(collected);
  collected.incident.runbookExecutions.sort(byId);
  collected.otel.dependencyTraces.sort(byId);
  collected.otel.intentExecutions.sort(byId);
  collected.pagerduty.alertPolicies.sort(byId);
  collected.prometheus.telemetry.sort(byId);
  return collected;
}

function runtimeCollectorFile(provider, id) {
  return `runtime-collector/${provider}-${sanitizeIdentifier(id)}.json`;
}

function runtimeSignalForSlo(runtime, slo) {
  return runtimeSignals(runtime)
    .filter((signal) => signal.service === slo.service && signal.indicator === slo.indicator)
    .sort(byId)[0] ?? null;
}

function runtimeCollectorSources(model) {
  const runtime = runtimePattern(model);
  const intent = intentPattern(model);
  if (!runtime && !intent) return [];

  const sources = [];
  const runbookById = new Map(runtimeRunbooks(runtime).map((runbook) => [runbook.id, runbook]));
  const emittedRunbooks = new Set();

  runtimeSlos(runtime)
    .slice()
    .sort(byId)
    .forEach((slo) => {
      const signal = runtimeSignalForSlo(runtime, slo);
      const sloIndex = runtimeSlos(runtime).findIndex((candidate) => candidate.id === slo.id);
      const id = slo.window ? `${slo.id}-${slo.window}` : `${slo.id}-telemetry`;
      sources.push({
        expects: {
          id,
          observedPercentAtLeast: slo.targetPercent,
          service: slo.service,
          signal: signal?.id ?? null,
          slo: slo.id,
        },
        kind: "telemetry",
        path: runtimeCollectorFile("prometheus", id),
        provider: "prometheus",
        query: {
          indicator: slo.indicator,
          service: slo.service,
          signal: signal?.id ?? null,
          slo: slo.id,
          targetPercent: slo.targetPercent,
          window: slo.window ?? null,
        },
        source: "file",
        sourceMap: runtimeSloSource(slo, sloIndex),
      });
    });

  runtimeAlerts(runtime)
    .slice()
    .sort(byId)
    .filter((alert) => alert.severity === "page")
    .forEach((alert) => {
      const alertIndex = runtimeAlerts(runtime).findIndex((candidate) => candidate.id === alert.id);
      const policyId = `${alert.id}-policy`;
      sources.push({
        expects: {
          alert: alert.id,
          enabled: true,
          id: policyId,
        },
        kind: "alertPolicies",
        path: runtimeCollectorFile("pagerduty", policyId),
        provider: "pagerduty",
        query: {
          alert: alert.id,
          service: alert.service,
          severity: alert.severity,
          signal: alert.signal,
        },
        source: "file",
        sourceMap: runtimeAlertSource(alert, alertIndex),
      });

      if (alert.runbook && !emittedRunbooks.has(alert.runbook)) {
        emittedRunbooks.add(alert.runbook);
        const runbook = runbookById.get(alert.runbook);
        const runbookIndex = runtimeRunbooks(runtime).findIndex((candidate) => candidate.id === alert.runbook);
        const executionId = `${alert.runbook}-execution`;
        sources.push({
          expects: {
            id: executionId,
            runbook: alert.runbook,
            status: "pass",
          },
          kind: "runbookExecutions",
          path: runtimeCollectorFile("incident", executionId),
          provider: "incident",
          query: {
            alert: alert.id,
            runbook: alert.runbook,
            service: runbook?.service ?? alert.service,
            status: "pass",
          },
          source: "file",
          sourceMap: runbook ? runtimeRunbookSource(runbook, runbookIndex) : runtimeAlertSource(alert, alertIndex),
        });
      }
    });

  runtimeDependencies(runtime)
    .slice()
    .sort(byId)
    .forEach((dependency) => {
      const dependencyIndex = runtimeDependencies(runtime).findIndex((candidate) => candidate.id === dependency.id);
      const traceId = `${dependency.id}-trace`;
      sources.push({
        expects: {
          dependency: dependency.id,
          id: traceId,
          idempotencyKeyObserved: Boolean(dependency.retryable && dependency.idempotent),
          observedLatencyMsAtMost: dependency.timeoutMs ?? null,
          timedOut: false,
        },
        kind: "dependencyTraces",
        path: runtimeCollectorFile("otel", traceId),
        provider: "otel",
        query: {
          dependency: dependency.id,
          kind: dependency.kind,
          service: dependency.service,
          target: dependency.target,
          timeoutMs: dependency.timeoutMs ?? null,
        },
        source: "file",
        sourceMap: runtimeDependencySource(dependency, dependencyIndex),
      });
    });

  intentProcesses(intent)
    .slice()
    .sort(byId)
    .filter((process) => process.execution)
    .forEach((process) => {
      const processIndex = intentProcesses(intent).findIndex((candidate) => candidate.id === process.id);
      const policy = process.execution;
      intentRefinements(process)
        .slice()
        .sort(byId)
        .forEach((refinement) => {
          const executionId = `${process.id}-${refinement.id}-execution`;
          sources.push({
            expects: {
              duplicateSuppressed: Boolean(policy.idempotencyKey),
              id: executionId,
              idempotencyKeyObserved: Boolean(policy.idempotencyKey),
              maxInFlightObservedAtMost: policy.maxInFlight,
              observedLatencyMsAtMost: policy.timeoutMs ?? null,
              process: process.id,
              refinement: refinement.id,
              timedOut: false,
            },
            kind: "intentExecutions",
            path: runtimeCollectorFile("otel", executionId),
            provider: "otel",
            query: {
              process: process.id,
              refinement: refinement.id,
              requiredAttributes: {
                "dspec.execution.duplicate_suppressed": Boolean(policy.idempotencyKey),
                "dspec.execution.max_in_flight": policy.maxInFlight,
                "dspec.intent.process": process.id,
                "dspec.intent.refinement": refinement.id,
                "http.request.header.idempotency-key.present": Boolean(policy.idempotencyKey),
              },
              timeoutMs: policy.timeoutMs ?? null,
            },
            source: "file",
            sourceMap: intentExecutionPolicySource(process, processIndex),
          });
        });
    });

  return sources.sort((left, right) => {
    const provider = left.provider.localeCompare(right.provider);
    if (provider !== 0) return provider;
    const kind = left.kind.localeCompare(right.kind);
    if (kind !== 0) return kind;
    return String(left.expects.id).localeCompare(String(right.expects.id));
  });
}

function runtimeCollectorManifest(model) {
  return {
    modelId: model.id,
    sources: runtimeCollectorSources(model),
  };
}

function runtimeMetricName(source) {
  const id = source.query?.indicator ?? source.expects?.slo ?? source.expects?.id ?? "runtime";
  return `${sanitizeIdentifier(id)}_ratio`;
}

function runtimeEvidencePayloadForSource(source) {
  const expects = source.expects ?? {};
  if (source.provider === "prometheus" && source.kind === "telemetry") {
    const observedPercent = expects.observedPercentAtLeast ?? source.query?.targetPercent ?? 100;
    return {
      data: {
        result: [
          {
            metric: {
              __name__: runtimeMetricName(source),
              evidence_id: expects.id,
              service: expects.service,
              signal: expects.signal,
              slo: expects.slo ?? null,
            },
            value: [0, String(observedPercent / 100)],
          },
        ],
        resultType: "vector",
      },
      status: "success",
    };
  }
  if (source.provider === "pagerduty" && source.kind === "alertPolicies") {
    return {
      alert_policies: [
        {
          alert: expects.alert,
          enabled: expects.enabled ?? true,
          html_url: `generated:pagerduty:${expects.id ?? expects.alert}`,
          id: expects.id,
        },
      ],
    };
  }
  if (source.provider === "incident" && source.kind === "runbookExecutions") {
    return {
      runbook_executions: [
        {
          executed_at: "1970-01-01",
          id: expects.id,
          runbook: expects.runbook,
          source: `generated:incident:${expects.id ?? expects.runbook}`,
          status: expects.status ?? "pass",
        },
      ],
    };
  }
  if (source.provider === "otel" && source.kind === "dependencyTraces") {
    const timedOut = expects.timedOut ?? false;
    return {
      spans: [
        {
          attributes: {
            "dspec.dependency": expects.dependency,
            "http.request.header.idempotency-key.present": expects.idempotencyKeyObserved ?? false,
            ...(timedOut ? { timeout: true } : {}),
          },
          duration_ms: expects.observedLatencyMsAtMost ?? 0,
          name: expects.dependency,
          span_id: expects.id,
          status: {
            code: timedOut ? "TIMEOUT" : "OK",
          },
        },
      ],
    };
  }
  if (source.provider === "otel" && source.kind === "intentExecutions") {
    const timedOut = expects.timedOut ?? false;
    return {
      spans: [
        {
          attributes: {
            "dspec.execution.duplicate_suppressed": expects.duplicateSuppressed ?? false,
            "dspec.execution.max_in_flight": expects.maxInFlightObservedAtMost ?? 0,
            "dspec.intent.process": expects.process,
            "dspec.intent.refinement": expects.refinement,
            "http.request.header.idempotency-key.present": expects.idempotencyKeyObserved ?? false,
            ...(timedOut ? { timeout: true } : {}),
          },
          duration_ms: expects.observedLatencyMsAtMost ?? 0,
          name: expects.refinement,
          span_id: expects.id,
          status: { code: timedOut ? "TIMEOUT" : "OK" },
        },
      ],
    };
  }
  return {};
}

function runtimeCollectorFixtureManifest(model) {
  return {
    modelId: model.id,
    sources: runtimeCollectorSources(model).map((source) => ({
      ...source,
      payload: runtimeEvidencePayloadForSource(source),
      source: "inline",
    })),
  };
}

function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function runtimeEvidenceRecordsForSource(evidence, source) {
  if (source.provider === "prometheus" && source.kind === "telemetry") return evidence.telemetry;
  if (source.provider === "pagerduty" && source.kind === "alertPolicies") return evidence.alertPolicies;
  if (source.provider === "incident" && source.kind === "runbookExecutions") return evidence.runbookExecutions;
  if (source.provider === "otel" && source.kind === "dependencyTraces") return evidence.dependencyTraces;
  if (source.provider === "otel" && source.kind === "intentExecutions") return evidence.intentExecutions;
  return [];
}

function runtimeEvidenceRecordKind(source) {
  if (source.provider === "prometheus" && source.kind === "telemetry") return "telemetry";
  if (source.provider === "pagerduty" && source.kind === "alertPolicies") return "alertPolicy";
  if (source.provider === "incident" && source.kind === "runbookExecutions") return "runbookExecution";
  if (source.provider === "otel" && source.kind === "dependencyTraces") return "dependencyTrace";
  if (source.provider === "otel" && source.kind === "intentExecutions") return "intentExecution";
  return "runtimeEvidence";
}

function runtimeEvidenceSourceKey(source) {
  return [
    source.provider ?? "",
    source.kind ?? "",
    source.expects?.id ?? "",
    source.path ?? "",
  ].join("/");
}

function findRuntimeEvidenceRecord(records, expects) {
  if (expects.id) {
    return records.find((record) => record.id === expects.id) ?? null;
  }
  const identifyingFields = ["service", "signal", "slo", "alert", "runbook", "dependency"];
  return records.find((record) =>
    identifyingFields.every((field) => !hasOwn(expects, field) || record[field] === expects[field])
  ) ?? null;
}

function expectationFailure(source, property, expected, observed) {
  return {
    expected,
    id: source.expects?.id ?? null,
    kind: source.kind,
    observed,
    property,
    provider: source.provider,
    sourceMap: source.sourceMap ?? null,
  };
}

function checkExpectedEqual(failures, source, record, field, property) {
  const expects = source.expects ?? {};
  if (!hasOwn(expects, field)) return;
  if (record[field] !== expects[field]) {
    failures.push(expectationFailure(source, property, expects[field], record[field] ?? null));
  }
}

function checkExpectedAtLeast(failures, source, record, field, property) {
  const expected = source.expects?.[field];
  if (expected === null || expected === undefined) return;
  const observed = record.observedPercent ?? null;
  if (observed === null || observed < expected) {
    failures.push(expectationFailure(source, property, expected, observed));
  }
}

function checkExpectedAtMost(failures, source, record, expectedField, observedField, property) {
  const expected = source.expects?.[expectedField];
  if (expected === null || expected === undefined) return;
  const observed = record[observedField] ?? null;
  if (observed === null || observed > expected) {
    failures.push(expectationFailure(source, property, expected, observed));
  }
}

function addDaysIso(date, deltaDays) {
  if (!isIsoDate(date)) return null;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed + deltaDays * 86400000).toISOString().slice(0, 10);
}

function checkExpectedFreshness(failures, source, record, kind) {
  const freshWithinDays = source.expects?.freshWithinDays;
  if (freshWithinDays === null || freshWithinDays === undefined) return;
  const asOf = source.expects?.asOf;
  const observed = record.observedAt ?? record.executedAt ?? null;
  const earliest = Number.isInteger(freshWithinDays) && isIsoDate(asOf) ? addDaysIso(asOf, -freshWithinDays) : null;
  const expected = { asOf: asOf ?? null, earliest, freshWithinDays };
  if (!earliest || !isIsoDate(observed) || observed < earliest || observed > asOf) {
    failures.push(expectationFailure(source, `${kind}.freshWithinDays`, expected, observed));
  }
}

function runtimeEvidenceObservedAt(record) {
  return record?.observedAt ?? record?.executedAt ?? null;
}

function runtimeEvidenceFreshness(source, record) {
  const freshWithinDays = source.expects?.freshWithinDays;
  if (freshWithinDays === null || freshWithinDays === undefined) {
    return {
      asOf: null,
      checked: false,
      earliest: null,
      freshWithinDays: null,
      status: "unchecked",
    };
  }

  const asOf = source.expects?.asOf ?? null;
  const observed = runtimeEvidenceObservedAt(record);
  const earliest = Number.isInteger(freshWithinDays) && isIsoDate(asOf) ? addDaysIso(asOf, -freshWithinDays) : null;
  const stale = !record || !earliest || !isIsoDate(observed) || observed < earliest || observed > asOf;
  return {
    asOf,
    checked: true,
    earliest,
    freshWithinDays,
    status: stale ? "stale" : "fresh",
  };
}

function runtimeEvidenceObservation(source, evidence, failures) {
  const records = runtimeEvidenceRecordsForSource(evidence, source);
  const record = findRuntimeEvidenceRecord(records, source.expects ?? {});
  const expectedId = source.expects?.id ?? null;
  return {
    freshness: runtimeEvidenceFreshness(source, record),
    id: expectedId ?? record?.id ?? null,
    kind: source.kind,
    observedAt: runtimeEvidenceObservedAt(record),
    path: source.path ?? null,
    present: Boolean(record),
    provider: source.provider,
    sourceMap: source.sourceMap ?? null,
    status: failures.length === 0 ? "pass" : "fail",
  };
}

function runtimeEvidenceQualitySummary(observations, passed, total) {
  return {
    failed: total - passed,
    freshnessChecked: observations.filter((observation) => observation.freshness.checked).length,
    missing: observations.filter((observation) => !observation.present).length,
    passed,
    score: total === 0 ? 100 : Math.round((passed / total) * 100),
    sourceMapped: observations.filter((observation) => Boolean(observation.sourceMap)).length,
    stale: observations.filter((observation) => observation.freshness.status === "stale").length,
    total,
  };
}

function verifyRuntimeEvidenceSource(source, evidence) {
  const failures = [];
  const kind = runtimeEvidenceRecordKind(source);
  const records = runtimeEvidenceRecordsForSource(evidence, source);
  const record = findRuntimeEvidenceRecord(records, source.expects ?? {});
  if (!record) {
    failures.push(expectationFailure(source, `${kind}.exists`, true, false));
    return failures;
  }

  if (kind === "telemetry") {
    checkExpectedEqual(failures, source, record, "service", "telemetry.service");
    checkExpectedEqual(failures, source, record, "signal", "telemetry.signal");
    checkExpectedEqual(failures, source, record, "slo", "telemetry.slo");
    checkExpectedAtLeast(failures, source, record, "observedPercentAtLeast", "telemetry.observedPercentAtLeast");
  } else if (kind === "alertPolicy") {
    checkExpectedEqual(failures, source, record, "alert", "alertPolicy.alert");
    checkExpectedEqual(failures, source, record, "enabled", "alertPolicy.enabled");
  } else if (kind === "runbookExecution") {
    checkExpectedEqual(failures, source, record, "runbook", "runbookExecution.runbook");
    checkExpectedEqual(failures, source, record, "status", "runbookExecution.status");
  } else if (kind === "dependencyTrace") {
    checkExpectedEqual(failures, source, record, "dependency", "dependencyTrace.dependency");
    checkExpectedAtMost(failures, source, record, "observedLatencyMsAtMost", "observedLatencyMs", "dependencyTrace.observedLatencyMsAtMost");
    checkExpectedEqual(failures, source, record, "timedOut", "dependencyTrace.timedOut");
    checkExpectedEqual(failures, source, record, "idempotencyKeyObserved", "dependencyTrace.idempotencyKeyObserved");
  } else if (kind === "intentExecution") {
    checkExpectedEqual(failures, source, record, "process", "intentExecution.process");
    checkExpectedEqual(failures, source, record, "refinement", "intentExecution.refinement");
    checkExpectedAtMost(failures, source, record, "maxInFlightObservedAtMost", "maxInFlightObserved", "intentExecution.maxInFlightObservedAtMost");
    checkExpectedEqual(failures, source, record, "timedOut", "intentExecution.timedOut");
    checkExpectedEqual(failures, source, record, "idempotencyKeyObserved", "intentExecution.idempotencyKeyObserved");
    checkExpectedEqual(failures, source, record, "duplicateSuppressed", "intentExecution.duplicateSuppressed");
    checkExpectedAtMost(failures, source, record, "observedLatencyMsAtMost", "observedLatencyMs", "intentExecution.observedLatencyMsAtMost");
  }
  checkExpectedFreshness(failures, source, record, kind);

  return failures;
}

async function verifyRuntimeEvidenceReport(manifest, baseDir = process.cwd()) {
  const collected = await collectRuntimeEvidence(manifest, baseDir);
  const evidence = normalizeRuntimeEvidenceImport(collected);
  const sources = list(manifest?.sources)
    .filter((source) => source?.expects)
    .slice()
    .sort((left, right) => runtimeEvidenceSourceKey(left).localeCompare(runtimeEvidenceSourceKey(right)));
  const failures = [];
  const observations = [];
  let passed = 0;

  for (const source of sources) {
    const sourceFailures = verifyRuntimeEvidenceSource(source, evidence);
    failures.push(...sourceFailures);
    observations.push(runtimeEvidenceObservation(source, evidence, sourceFailures));
    if (sourceFailures.length === 0) {
      passed += 1;
    }
  }

  return {
    evidence: observations,
    failures,
    passed,
    quality: runtimeEvidenceQualitySummary(observations, passed, sources.length),
    status: failures.length > 0 ? "fail" : "pass",
    total: sources.length,
  };
}

function renderRuntimeEvidenceVerification(report) {
  if (report.status === "pass") {
    return `ok: runtime evidence expectations (${report.passed}/${report.total})\n`;
  }
  const lines = [`runtime evidence expectation drift (${report.passed}/${report.total})`];
  for (const failure of report.failures) {
    lines.push(`${failure.provider}.${failure.kind}.${failure.id ?? "unknown"} ${failure.property}: expected ${JSON.stringify(failure.expected)}, observed ${JSON.stringify(failure.observed)}`);
  }
  return `${lines.join("\n")}\n`;
}

function exprToText(ast) {
  if (!ast) return "";
  const children = list(ast.children);
  const args = list(ast.args);
  if (ast.op === "atom") {
    return args.length > 0 ? `${ast.name}(${args.join(", ")})` : String(ast.name);
  }
  if (ast.op === "eq") return `${args[0]} == ${args[1]}`;
  if (ast.op === "neq") return `${args[0]} != ${args[1]}`;
  if (ast.op === "not") return `not (${exprToText(children[0])})`;
  if (ast.op === "and") return children.map(exprToText).join(" && ");
  if (ast.op === "or") return children.map(exprToText).join(" || ");
  if (ast.op === "implies") return `(${exprToText(children[0])}) -> (${exprToText(children[1])})`;
  if (ast.op === "exists") return `exists ${ast.name}. ${exprToText(children[0])}`;
  if (ast.op === "forall") return `forall ${ast.name}. ${exprToText(children[0])}`;
  return JSON.stringify(ast);
}

function exprAstProjection(ast) {
  if (!ast) return null;
  return {
    op: ast.op,
    name: ast.name ?? null,
    args: list(ast.args),
    children: list(ast.children).map(exprAstProjection),
  };
}

function clauseProjection(clause) {
  return {
    expr: clause.expr,
    astSemanticsVersion: clause.ast ? CLAUSE_AST_SEMANTICS_VERSION : null,
    ast: exprAstProjection(clause.ast),
  };
}

function ruleClauses(rule) {
  return [...list(rule.when), ...list(rule.must), ...list(rule.mustNot)];
}

function exprToLean(ast, fallback) {
  if (!ast) return `Expr.opaque ${JSON.stringify(fallback)}`;
  const children = list(ast.children);
  const args = `[${list(ast.args).map((arg) => JSON.stringify(arg)).join(", ")}]`;
  if (ast.op === "atom") return `Expr.atom ${JSON.stringify(ast.name)} ${args}`;
  if (ast.op === "eq") return `Expr.eq ${JSON.stringify(list(ast.args)[0])} ${JSON.stringify(list(ast.args)[1])}`;
  if (ast.op === "neq") return `Expr.neq ${JSON.stringify(list(ast.args)[0])} ${JSON.stringify(list(ast.args)[1])}`;
  if (ast.op === "not") return `Expr.not (${exprToLean(children[0], "")})`;
  if (ast.op === "and") return `Expr.conj [${children.map((child) => exprToLean(child, "")).join(", ")}]`;
  if (ast.op === "or") return `Expr.disj [${children.map((child) => exprToLean(child, "")).join(", ")}]`;
  if (ast.op === "implies") return `Expr.impl (${exprToLean(children[0], "")}) (${exprToLean(children[1], "")})`;
  if (ast.op === "exists") return `Expr.exists_ ${JSON.stringify(ast.name)} (${exprToLean(children[0], "")})`;
  if (ast.op === "forall") return `Expr.forall_ ${JSON.stringify(ast.name)} (${exprToLean(children[0], "")})`;
  return `Expr.opaque ${JSON.stringify(fallback)}`;
}

function ruleClauseExprs(rule) {
  return ruleClauses(rule).map((clause) => exprToLean(clause.ast, clause.expr));
}

function emitLeanClauseTheorem(proof) {
  const satisfaction = `Satisfies env (${exprToLean(proof.clause.ast, proof.clause.expr)})`;
  const proposition = proof.field === "mustNot" ? `¬ ${satisfaction}` : satisfaction;
  return `theorem ${proof.theorem} : ∀ env : ClauseEnv, ${proposition} := by
  intro env
  simp [Satisfies]`;
}

function modelSource() {
  return { kind: "model", path: "model" };
}

function projectionSource(projection, index) {
  return { kind: "projection", projectionId: projection.id, path: `projections[${index}]` };
}

function ruleSource(rule, ruleIndex) {
  return { kind: "rule", ruleId: rule.id, path: `model.rules[${ruleIndex}]` };
}

function clauseSource(rule, ruleIndex, field, index) {
  return {
    kind: "clause",
    ruleId: rule.id,
    field,
    index,
    path: `model.rules[${ruleIndex}].${field}[${index}]`,
  };
}

function checkTargetSource(rule, ruleIndex, index) {
  return {
    kind: "checkTarget",
    ruleId: rule.id,
    index,
    path: `model.rules[${ruleIndex}].checks[${index}]`,
  };
}

function implementationSource(rule, ruleIndex, index) {
  return {
    kind: "implementationRef",
    ruleId: rule.id,
    index,
    path: `model.rules[${ruleIndex}].implementedBy[${index}]`,
  };
}

function dbTableSource(table, index) {
  return { kind: "dbTable", tableId: table.id, path: `model.patterns.db.tables[${index}]` };
}

function dbColumnSource(table, tableIndex, column, columnIndex) {
  return {
    kind: "dbColumn",
    tableId: table.id,
    columnId: column.id,
    path: `model.patterns.db.tables[${tableIndex}].columns[${columnIndex}]`,
  };
}

function dbInvariantSource(invariant, index) {
  return { kind: "dbInvariant", invariantId: invariant.id, path: `model.patterns.db.invariants[${index}]` };
}

function dbTransactionSource(transaction, index) {
  return { kind: "dbTransaction", transactionId: transaction.id, path: `model.patterns.db.transactions[${index}]` };
}

function dbMigrationSource(migration, index) {
  return { kind: "dbMigration", migrationId: migration.id, path: `model.patterns.db.migrations[${index}]` };
}

function dbMappingSource(migration, migrationIndex, mapping, mappingIndex) {
  return {
    kind: "dbMapping",
    migrationId: migration.id,
    mappingId: mapping.id,
    path: `model.patterns.db.migrations[${migrationIndex}].mappings[${mappingIndex}]`,
  };
}

function cloudZoneSource(zone, index) {
  return { kind: "cloudZone", zoneId: zone.id, path: `model.patterns.cloud.zones[${index}]` };
}

function cloudNodeSource(node, index) {
  return { kind: "cloudNode", nodeId: node.id, path: `model.patterns.cloud.nodes[${index}]` };
}

function cloudFlowSource(flow, index) {
  return { kind: "cloudFlow", flowId: flow.id, path: `model.patterns.cloud.flows[${index}]` };
}

function cloudPolicySource(policy, index) {
  return { kind: "cloudPolicy", policyId: policy.id, path: `model.patterns.cloud.policies[${index}]` };
}

function dataPolicySource(policy, index) {
  return { kind: "dataPolicy", policyId: policy.id, path: `model.patterns.data.policies[${index}]` };
}

function dataSetSource(dataset, index) {
  return { kind: "dataSet", datasetId: dataset.id, path: `model.patterns.data.datasets[${index}]` };
}

function dataStoreSource(store, index) {
  return { kind: "dataStore", storeId: store.id, path: `model.patterns.data.stores[${index}]` };
}

function dataPlacementSource(placement, index) {
  return { kind: "dataPlacement", placementId: placement.id, path: `model.patterns.data.placements[${index}]` };
}

function dataFlowSource(flow, index) {
  return { kind: "dataFlow", flowId: flow.id, path: `model.patterns.data.flows[${index}]` };
}

function releaseServiceSource(service, index) {
  return { kind: "releaseService", serviceId: service.id, path: `model.patterns.release.services[${index}]` };
}

function releaseEnvironmentSource(environment, index) {
  return { kind: "releaseEnvironment", environmentId: environment.id, path: `model.patterns.release.environments[${index}]` };
}

function releaseGateSource(gate, index) {
  return { kind: "releaseGate", gateId: gate.id, path: `model.patterns.release.gates[${index}]` };
}

function releaseRollbackSource(rollback, index) {
  return { kind: "releaseRollback", rollbackId: rollback.id, path: `model.patterns.release.rollbacks[${index}]` };
}

function releaseMigrationSource(migration, index) {
  return { kind: "releaseMigration", migrationId: migration.id, path: `model.patterns.release.migrations[${index}]` };
}

function releaseStepSource(step, index) {
  return { kind: "releaseStep", stepId: step.id, path: `model.patterns.release.steps[${index}]` };
}

function runtimeServiceSource(service, index) {
  return { kind: "runtimeService", serviceId: service.id, path: `model.patterns.runtime.services[${index}]` };
}

function runtimeDependencySource(dependency, index) {
  return { kind: "runtimeDependency", dependencyId: dependency.id, path: `model.patterns.runtime.dependencies[${index}]` };
}

function runtimeSignalSource(signal, index) {
  return { kind: "runtimeSignal", signalId: signal.id, path: `model.patterns.runtime.signals[${index}]` };
}

function runtimeRunbookSource(runbook, index) {
  return { kind: "runtimeRunbook", runbookId: runbook.id, path: `model.patterns.runtime.runbooks[${index}]` };
}

function runtimeAlertSource(alert, index) {
  return { kind: "runtimeAlert", alertId: alert.id, path: `model.patterns.runtime.alerts[${index}]` };
}

function runtimeSloSource(slo, index) {
  return { kind: "runtimeSlo", sloId: slo.id, path: `model.patterns.runtime.slos[${index}]` };
}

function runtimeTelemetrySource(window, index) {
  return { kind: "runtimeTelemetry", telemetryId: window.id, path: `model.patterns.runtime.telemetry[${index}]` };
}

function runtimeAlertPolicySource(policy, index) {
  return { kind: "runtimeAlertPolicy", policyId: policy.id, path: `model.patterns.runtime.alertPolicies[${index}]` };
}

function runtimeRunbookExecutionSource(execution, index) {
  return { kind: "runtimeRunbookExecution", executionId: execution.id, path: `model.patterns.runtime.runbookExecutions[${index}]` };
}

function runtimeDependencyTraceSource(trace, index) {
  return { kind: "runtimeDependencyTrace", traceId: trace.id, path: `model.patterns.runtime.dependencyTraces[${index}]` };
}

function runtimeIntentExecutionSource(execution, index) {
  return { kind: "runtimeIntentExecution", executionId: execution.id, path: `model.patterns.runtime.intentExecutions[${index}]` };
}

function intentCapabilitySource(capability, index) {
  return { kind: "intentCapability", capabilityId: capability.id, path: `model.patterns.intent.capabilities[${index}]` };
}

function intentOutcomeSource(outcome, index) {
  return { kind: "intentOutcome", outcomeId: outcome.id, path: `model.patterns.intent.outcomes[${index}]` };
}

function intentProcessSource(process, index) {
  return { kind: "intentProcess", processId: process.id, path: `model.patterns.intent.processes[${index}]` };
}

function constructionAuthoritySource(authority, index) {
  return { kind: "constructionAuthority", authorityId: authority.id, path: `model.patterns.intent.constructionAuthorities[${index}]` };
}

function intentAccessPolicySource(policy, index) {
  return { kind: "intentAccessPolicy", policyId: policy.id, path: `model.patterns.intent.accessPolicies[${index}]` };
}

function intentGoalSource(goal, index) {
  return { kind: "intentGoal", goalId: goal.id, path: `model.patterns.intent.goals[${index}]` };
}

function intentClaimSource(claim, index) {
  return { kind: "intentClaim", claimId: claim.id, path: `model.patterns.intent.claims[${index}]` };
}

function intentAssuranceTaskSource(task, index) {
  return { kind: "intentAssuranceTask", taskId: task.id, path: `model.patterns.intent.assuranceTasks[${index}]` };
}

function intentSemanticBindingSource(binding, index) {
  return { kind: "intentSemanticBinding", bindingId: binding.id, path: `model.patterns.intent.semanticBindings[${index}]` };
}

function intentScenarioSource(scenario, index) {
  return { kind: "intentScenario", scenarioId: scenario.id, path: `model.patterns.intent.scenarios[${index}]` };
}

function intentInputFieldSource(process, processIndex, field, fieldIndex) {
  return {
    kind: "intentInputField",
    processId: process.id,
    fieldId: field.id,
    path: `model.patterns.intent.processes[${processIndex}].inputContract.fields[${fieldIndex}]`,
  };
}

function intentOutputFieldSource(outcome, outcomeIndex, field, fieldIndex) {
  return {
    kind: "intentOutputField",
    outcomeId: outcome.id,
    fieldId: field.id,
    path: `model.patterns.intent.outcomes[${outcomeIndex}].outputContract.fields[${fieldIndex}]`,
  };
}

function intentEffectSource(outcome, outcomeIndex, effect, effectIndex) {
  return {
    kind: "intentEffect",
    outcomeId: outcome.id,
    effectId: effect.id,
    path: `model.patterns.intent.outcomes[${outcomeIndex}].effects[${effectIndex}]`,
  };
}

function intentRefinementSource(process, processIndex, refinement, refinementIndex) {
  return {
    kind: "intentRefinement",
    processId: process.id,
    refinementId: refinement.id,
    path: `model.patterns.intent.processes[${processIndex}].refinements[${refinementIndex}]`,
  };
}

function intentExecutionPolicySource(process, processIndex) {
  return {
    kind: "intentExecutionPolicy",
    processId: process.id,
    path: `model.patterns.intent.processes[${processIndex}].execution`,
  };
}

function domainDeclarationSource(collection, declaration, index) {
  return {
    kind: "domainDeclaration",
    declarationKind: collection,
    declarationId: declaration.id,
    path: `model.patterns.domain.${collection}[${index}]`,
  };
}

function domainFieldSource(collection, declaration, declarationIndex, field, fieldIndex) {
  return {
    kind: "domainField",
    declarationKind: collection,
    declarationId: declaration.id,
    fieldId: field.id,
    path: `model.patterns.domain.${collection}[${declarationIndex}].fields[${fieldIndex}]`,
  };
}

function generatedEntry(generated, source, extra = {}) {
  return { generated, source, ...extra };
}

function addRuleSourceEntries(artifact, entries, generatedPrefix, rule, ruleIndex) {
  entries.push(generatedEntry(`${artifact}.rule.${rule.id}`, ruleSource(rule, ruleIndex)));

  for (const [field, clauses] of [
    ["when", list(rule.when)],
    ["must", list(rule.must)],
    ["mustNot", list(rule.mustNot)],
  ]) {
    clauses.forEach((_clause, index) => {
      entries.push(generatedEntry(`${generatedPrefix}.${rule.id}.${field}[${index}]`, clauseSource(rule, ruleIndex, field, index)));
    });
  }

  list(rule.checks).forEach((_target, index) => {
    entries.push(generatedEntry(`${generatedPrefix}.${rule.id}.checks[${index}]`, checkTargetSource(rule, ruleIndex, index)));
  });

  list(rule.implementedBy).forEach((_ref, index) => {
    entries.push(generatedEntry(`${generatedPrefix}.${rule.id}.implementedBy[${index}]`, implementationSource(rule, ruleIndex, index)));
  });
}

function sourceMapContext(model) {
  const originalRuleIndex = new Map(list(model.rules).map((rule, index) => [rule.id, index]));
  const rules = sortedRules(model);
  const activeApproved = rules.filter((rule) => rule.reviewStatus === "approved" && !rule.deprecated);
  return { originalRuleIndex, rules, activeApproved };
}

function emitSourceMapObject(model, requestedLocale) {
  const locale = requestedLocale ?? model.primaryLocale;
  const { originalRuleIndex, rules, activeApproved } = sourceMapContext(model);
  const artifacts = {
    markdown: [generatedEntry("markdown.model", modelSource(), { locale })],
    quickcheck: [generatedEntry("quickcheck.modelId", modelSource())],
    alloy: [generatedEntry("alloy.module", modelSource())],
    quint: [generatedEntry("quint.module", modelSource())],
    lean: [generatedEntry("lean.namespace", modelSource())],
    sourceMap: [generatedEntry("sourceMap.document", modelSource(), { locale })],
    generatedManifest: [generatedEntry("generatedManifest.document", modelSource(), { locale })],
    runtimeCollector: [generatedEntry("runtimeCollector.manifest", modelSource())],
  };

  for (const term of sortedTerms(model)) {
    artifacts.markdown.push(generatedEntry(`markdown.term.${term.id}`, { kind: "term", termId: term.id, path: `model.vocabulary[${list(model.vocabulary).findIndex((candidate) => candidate.id === term.id)}]` }));
  }

  for (const projection of projections(model).slice().sort(byId)) {
    const index = projections(model).findIndex((candidate) => candidate.id === projection.id);
    const artifactKind = {
      markdown: "markdown",
      quickcheck: "quickcheck",
      lean: "lean",
      alloy: "alloy",
      quint: "quint",
      "source-map": "sourceMap",
      "generated-manifest": "generatedManifest",
    }[projection.kind];
    if (artifactKind) {
      artifacts[artifactKind].push(
        generatedEntry(`${artifactKind}.projection.${projection.id}`, projectionSource(projection, index), { locale }),
      );
    }
  }

  const domain = domainPattern(model);
  if (domain) {
    artifacts.markdown.push(generatedEntry("markdown.domain.relationships", {
      kind: "domainRelationshipGraph",
      path: "model.patterns.domain",
    }));
    for (const collection of ["enums", "valueObjects", "entities", "aggregates", "commands", "events", "invariants", "formalizations"]) {
      const declarations = list(domain[collection]);
      for (const declaration of declarations.slice().sort(byId)) {
        const declarationIndex = declarations.findIndex((candidate) => candidate.id === declaration.id);
        const source = domainDeclarationSource(collection, declaration, declarationIndex);
        artifacts.markdown.push(generatedEntry(`markdown.domain.${collection}.${declaration.id}`, source));
        if (!Object.hasOwn(declaration, "fields")) continue;
        for (const field of list(declaration.fields).slice().sort(byId)) {
          const fieldIndex = list(declaration.fields).findIndex((candidate) => candidate.id === field.id);
          artifacts.markdown.push(generatedEntry(
            `markdown.domain.${collection}.${declaration.id}.fields.${field.id}`,
            domainFieldSource(collection, declaration, declarationIndex, field, fieldIndex),
          ));
        }
      }
    }
  }

  const db = dbPattern(model);
  if (db) {
    dbTables(db)
      .slice()
      .sort(byId)
      .forEach((table) => {
        const tableIndex = dbTables(db).findIndex((candidate) => candidate.id === table.id);
        const source = dbTableSource(table, tableIndex);
        artifacts.markdown.push(generatedEntry(`markdown.db.table.${table.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.db.tables.${table.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${dbName("DBT", table.id)}`, source));
        list(table.columns)
          .slice()
          .sort(byId)
          .forEach((column) => {
            const columnIndex = list(table.columns).findIndex((candidate) => candidate.id === column.id);
            artifacts.markdown.push(generatedEntry(`markdown.db.table.${table.id}.columns.${column.id}`, dbColumnSource(table, tableIndex, column, columnIndex)));
          });
      });
    dbInvariants(db)
      .slice()
      .sort(byId)
      .forEach((invariant) => {
        const invariantIndex = dbInvariants(db).findIndex((candidate) => candidate.id === invariant.id);
        const source = dbInvariantSource(invariant, invariantIndex);
        artifacts.markdown.push(generatedEntry(`markdown.db.invariants.${invariant.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.db.invariants.${invariant.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${dbName("DBI", invariant.id)}`, source));
      });
    dbTransactions(db)
      .slice()
      .sort(byId)
      .forEach((transaction) => {
        const transactionIndex = dbTransactions(db).findIndex((candidate) => candidate.id === transaction.id);
        const source = dbTransactionSource(transaction, transactionIndex);
        artifacts.markdown.push(generatedEntry(`markdown.db.transactions.${transaction.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.db.transactions.${transaction.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${dbName("DBTX", transaction.id)}`, source));
      });
    dbMigrations(db)
      .slice()
      .sort(byId)
      .forEach((migration) => {
        const migrationIndex = dbMigrations(db).findIndex((candidate) => candidate.id === migration.id);
        const source = dbMigrationSource(migration, migrationIndex);
        artifacts.markdown.push(generatedEntry(`markdown.db.migrations.${migration.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.db.migrations.${migration.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${dbName("DBM", migration.id)}`, source));
        list(migration.mappings)
          .slice()
          .sort(byId)
          .forEach((mapping) => {
            const mappingIndex = list(migration.mappings).findIndex((candidate) => candidate.id === mapping.id);
            const mappingSource = dbMappingSource(migration, migrationIndex, mapping, mappingIndex);
            const mappingGenerated = `db.migrations.${migration.id}.mappings.${mapping.id}`;
            artifacts.markdown.push(generatedEntry(`markdown.${mappingGenerated}`, mappingSource));
            artifacts.quickcheck.push(generatedEntry(`quickcheck.${mappingGenerated}`, mappingSource));
            artifacts.alloy.push(generatedEntry(`alloy.sig.${dbMappingName(migration, mapping)}`, mappingSource));
          });
      });
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyDbTransactionsPreserveInvariants", { kind: "dbPolicy", path: "model.patterns.db.transactions" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyDbMigrationsPreserveInvariants", { kind: "dbPolicy", path: "model.patterns.db.migrations" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyDbMigrationMappingsCoverInvariants", { kind: "dbPolicy", path: "model.patterns.db.migrations" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyDbMigrationMappingExpressionsMentionTables", { kind: "dbPolicy", path: "model.patterns.db.migrations" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.DbTransactionsPreserveInvariants", { kind: "dbPolicy", path: "model.patterns.db.transactions" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.DbMigrationsPreserveInvariants", { kind: "dbPolicy", path: "model.patterns.db.migrations" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.DbMigrationMappingsCoverInvariants", { kind: "dbPolicy", path: "model.patterns.db.migrations" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.DbMigrationMappingExpressionsMentionTables", { kind: "dbPolicy", path: "model.patterns.db.migrations" }));
  }

  const cloud = cloudPattern(model);
  if (cloud) {
    cloudZones(cloud)
      .slice()
      .sort(byId)
      .forEach((zone) => {
        const zoneIndex = cloudZones(cloud).findIndex((candidate) => candidate.id === zone.id);
        const source = cloudZoneSource(zone, zoneIndex);
        artifacts.markdown.push(generatedEntry(`markdown.cloud.zones.${zone.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.cloud.zones.${zone.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${cloudName("CZ", zone.id)}`, source));
      });
    cloudNodes(cloud)
      .slice()
      .sort(byId)
      .forEach((node) => {
        const nodeIndex = cloudNodes(cloud).findIndex((candidate) => candidate.id === node.id);
        const source = cloudNodeSource(node, nodeIndex);
        artifacts.markdown.push(generatedEntry(`markdown.cloud.nodes.${node.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.cloud.nodes.${node.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${cloudName("CN", node.id)}`, source));
      });
    cloudFlows(cloud)
      .slice()
      .sort(byId)
      .forEach((flow) => {
        const flowIndex = cloudFlows(cloud).findIndex((candidate) => candidate.id === flow.id);
        const source = cloudFlowSource(flow, flowIndex);
        artifacts.markdown.push(generatedEntry(`markdown.cloud.flows.${flow.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.cloud.flows.${flow.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${cloudName("CF", flow.id)}`, source));
      });
    cloudPolicies(cloud)
      .slice()
      .sort(byId)
      .forEach((policy) => {
        const policyIndex = cloudPolicies(cloud).findIndex((candidate) => candidate.id === policy.id);
        const source = cloudPolicySource(policy, policyIndex);
        artifacts.markdown.push(generatedEntry(`markdown.cloud.policies.${policy.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.cloud.policies.${policy.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${cloudName("CP", policy.id)}`, source));
      });
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyCloudPublicIngressBlocked", { kind: "cloudPolicy", path: "model.patterns.cloud.flows" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyCloudResourceAccessHasPolicy", { kind: "cloudPolicy", path: "model.patterns.cloud.flows" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyCloudTenantFlowsPropagateTenant", { kind: "cloudPolicy", path: "model.patterns.cloud.flows" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyCloudQueuePublishesHaveIdempotencyKey", { kind: "cloudPolicy", path: "model.patterns.cloud.flows" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.CloudPublicIngressBlocked", { kind: "cloudPolicy", path: "model.patterns.cloud.flows" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.CloudResourceAccessHasPolicy", { kind: "cloudPolicy", path: "model.patterns.cloud.flows" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.CloudTenantFlowsPropagateTenant", { kind: "cloudPolicy", path: "model.patterns.cloud.flows" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.CloudQueuePublishesHaveIdempotencyKey", { kind: "cloudPolicy", path: "model.patterns.cloud.flows" }));
  }

  const data = dataPattern(model);
  if (data) {
    dataPolicies(data)
      .slice()
      .sort(byId)
      .forEach((policy) => {
        const policyIndex = dataPolicies(data).findIndex((candidate) => candidate.id === policy.id);
        const source = dataPolicySource(policy, policyIndex);
        artifacts.markdown.push(generatedEntry(`markdown.data.policies.${policy.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.data.policies.${policy.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${dataName("DPOL", policy.id)}`, source));
      });
    dataSets(data)
      .slice()
      .sort(byId)
      .forEach((dataset) => {
        const datasetIndex = dataSets(data).findIndex((candidate) => candidate.id === dataset.id);
        const source = dataSetSource(dataset, datasetIndex);
        artifacts.markdown.push(generatedEntry(`markdown.data.datasets.${dataset.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.data.datasets.${dataset.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${dataName("DS", dataset.id)}`, source));
      });
    dataStores(data)
      .slice()
      .sort(byId)
      .forEach((store) => {
        const storeIndex = dataStores(data).findIndex((candidate) => candidate.id === store.id);
        const source = dataStoreSource(store, storeIndex);
        artifacts.markdown.push(generatedEntry(`markdown.data.stores.${store.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.data.stores.${store.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${dataName("DSTORE", store.id)}`, source));
      });
    dataPlacements(data)
      .slice()
      .sort(byId)
      .forEach((placement) => {
        const placementIndex = dataPlacements(data).findIndex((candidate) => candidate.id === placement.id);
        const source = dataPlacementSource(placement, placementIndex);
        artifacts.markdown.push(generatedEntry(`markdown.data.placements.${placement.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.data.placements.${placement.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${dataName("DPL", placement.id)}`, source));
      });
    dataFlows(data)
      .slice()
      .sort(byId)
      .forEach((flow) => {
        const flowIndex = dataFlows(data).findIndex((candidate) => candidate.id === flow.id);
        const source = dataFlowSource(flow, flowIndex);
        artifacts.markdown.push(generatedEntry(`markdown.data.flows.${flow.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.data.flows.${flow.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${dataName("DF", flow.id)}`, source));
      });
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyDataSensitivePlacementsEncrypted", { kind: "dataPolicy", path: "model.patterns.data.placements" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyDataPersonalPlacementsSupportDeletion", { kind: "dataPolicy", path: "model.patterns.data.placements" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyDataCrossRegionFlowsHaveLegalBasis", { kind: "dataPolicy", path: "model.patterns.data.flows" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyDataRetentionWithinPolicy", { kind: "dataPolicy", path: "model.patterns.data.datasets" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.DataSensitivePlacementsEncrypted", { kind: "dataPolicy", path: "model.patterns.data.placements" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.DataPersonalPlacementsSupportDeletion", { kind: "dataPolicy", path: "model.patterns.data.placements" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.DataCrossRegionFlowsHaveLegalBasis", { kind: "dataPolicy", path: "model.patterns.data.flows" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.DataRetentionWithinPolicy", { kind: "dataPolicy", path: "model.patterns.data.datasets" }));
  }

  const release = releasePattern(model);
  if (release) {
    releaseServices(release)
      .slice()
      .sort(byId)
      .forEach((service) => {
        const serviceIndex = releaseServices(release).findIndex((candidate) => candidate.id === service.id);
        const source = releaseServiceSource(service, serviceIndex);
        artifacts.markdown.push(generatedEntry(`markdown.release.services.${service.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.release.services.${service.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${releaseName("RSVC", service.id)}`, source));
      });
    releaseEnvironments(release)
      .slice()
      .sort(byId)
      .forEach((environment) => {
        const environmentIndex = releaseEnvironments(release).findIndex((candidate) => candidate.id === environment.id);
        const source = releaseEnvironmentSource(environment, environmentIndex);
        artifacts.markdown.push(generatedEntry(`markdown.release.environments.${environment.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.release.environments.${environment.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${releaseName("RENV", environment.id)}`, source));
      });
    releaseGates(release)
      .slice()
      .sort(byId)
      .forEach((gate) => {
        const gateIndex = releaseGates(release).findIndex((candidate) => candidate.id === gate.id);
        const source = releaseGateSource(gate, gateIndex);
        artifacts.markdown.push(generatedEntry(`markdown.release.gates.${gate.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.release.gates.${gate.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${releaseName("RG", gate.id)}`, source));
      });
    releaseRollbacks(release)
      .slice()
      .sort(byId)
      .forEach((rollback) => {
        const rollbackIndex = releaseRollbacks(release).findIndex((candidate) => candidate.id === rollback.id);
        const source = releaseRollbackSource(rollback, rollbackIndex);
        artifacts.markdown.push(generatedEntry(`markdown.release.rollbacks.${rollback.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.release.rollbacks.${rollback.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${releaseName("RR", rollback.id)}`, source));
      });
    releaseMigrations(release)
      .slice()
      .sort(byId)
      .forEach((migration) => {
        const migrationIndex = releaseMigrations(release).findIndex((candidate) => candidate.id === migration.id);
        const source = releaseMigrationSource(migration, migrationIndex);
        artifacts.markdown.push(generatedEntry(`markdown.release.migrations.${migration.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.release.migrations.${migration.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${releaseName("RM", migration.id)}`, source));
      });
    releaseSteps(release)
      .slice()
      .sort(byId)
      .forEach((step) => {
        const stepIndex = releaseSteps(release).findIndex((candidate) => candidate.id === step.id);
        const source = releaseStepSource(step, stepIndex);
        artifacts.markdown.push(generatedEntry(`markdown.release.steps.${step.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.release.steps.${step.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${releaseName("RS", step.id)}`, source));
      });
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyReleaseProductionStepsHaveHealthGate", { kind: "releasePolicy", path: "model.patterns.release.steps" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyReleaseTrafficShiftsHaveRollback", { kind: "releasePolicy", path: "model.patterns.release.steps" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyReleaseRollbackPlansAreTested", { kind: "releasePolicy", path: "model.patterns.release.steps" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyReleaseMigrationsAreBackwardCompatible", { kind: "releasePolicy", path: "model.patterns.release.steps" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.ReleaseProductionStepsHaveHealthGate", { kind: "releasePolicy", path: "model.patterns.release.steps" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.ReleaseTrafficShiftsHaveRollback", { kind: "releasePolicy", path: "model.patterns.release.steps" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.ReleaseRollbackPlansAreTested", { kind: "releasePolicy", path: "model.patterns.release.steps" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.ReleaseMigrationsAreBackwardCompatible", { kind: "releasePolicy", path: "model.patterns.release.steps" }));
  }

  const runtime = runtimePattern(model);
  if (runtime) {
    runtimeServices(runtime)
      .slice()
      .sort(byId)
      .forEach((service) => {
        const serviceIndex = runtimeServices(runtime).findIndex((candidate) => candidate.id === service.id);
        const source = runtimeServiceSource(service, serviceIndex);
        artifacts.markdown.push(generatedEntry(`markdown.runtime.services.${service.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.runtime.services.${service.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${runtimeName("RTSVC", service.id)}`, source));
      });
    runtimeDependencies(runtime)
      .slice()
      .sort(byId)
      .forEach((dependency) => {
        const dependencyIndex = runtimeDependencies(runtime).findIndex((candidate) => candidate.id === dependency.id);
        const source = runtimeDependencySource(dependency, dependencyIndex);
        artifacts.markdown.push(generatedEntry(`markdown.runtime.dependencies.${dependency.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.runtime.dependencies.${dependency.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${runtimeName("RDEP", dependency.id)}`, source));
      });
    runtimeSignals(runtime)
      .slice()
      .sort(byId)
      .forEach((signal) => {
        const signalIndex = runtimeSignals(runtime).findIndex((candidate) => candidate.id === signal.id);
        const source = runtimeSignalSource(signal, signalIndex);
        artifacts.markdown.push(generatedEntry(`markdown.runtime.signals.${signal.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.runtime.signals.${signal.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${runtimeName("RSIG", signal.id)}`, source));
      });
    runtimeRunbooks(runtime)
      .slice()
      .sort(byId)
      .forEach((runbook) => {
        const runbookIndex = runtimeRunbooks(runtime).findIndex((candidate) => candidate.id === runbook.id);
        const source = runtimeRunbookSource(runbook, runbookIndex);
        artifacts.markdown.push(generatedEntry(`markdown.runtime.runbooks.${runbook.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.runtime.runbooks.${runbook.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${runtimeName("RRB", runbook.id)}`, source));
      });
    runtimeAlerts(runtime)
      .slice()
      .sort(byId)
      .forEach((alert) => {
        const alertIndex = runtimeAlerts(runtime).findIndex((candidate) => candidate.id === alert.id);
        const source = runtimeAlertSource(alert, alertIndex);
        artifacts.markdown.push(generatedEntry(`markdown.runtime.alerts.${alert.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.runtime.alerts.${alert.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${runtimeName("RALERT", alert.id)}`, source));
      });
    runtimeSlos(runtime)
      .slice()
      .sort(byId)
      .forEach((slo) => {
        const sloIndex = runtimeSlos(runtime).findIndex((candidate) => candidate.id === slo.id);
        const source = runtimeSloSource(slo, sloIndex);
        artifacts.markdown.push(generatedEntry(`markdown.runtime.slos.${slo.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.runtime.slos.${slo.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${runtimeName("RSLO", slo.id)}`, source));
      });
    runtimeTelemetry(runtime)
      .slice()
      .sort(byId)
      .forEach((window) => {
        const windowIndex = runtimeTelemetry(runtime).findIndex((candidate) => candidate.id === window.id);
        const source = runtimeTelemetrySource(window, windowIndex);
        artifacts.markdown.push(generatedEntry(`markdown.runtime.telemetry.${window.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.runtime.telemetry.${window.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${runtimeName("RTELEM", window.id)}`, source));
      });
    runtimeAlertPolicies(runtime)
      .slice()
      .sort(byId)
      .forEach((policy) => {
        const policyIndex = runtimeAlertPolicies(runtime).findIndex((candidate) => candidate.id === policy.id);
        const source = runtimeAlertPolicySource(policy, policyIndex);
        artifacts.markdown.push(generatedEntry(`markdown.runtime.alertPolicies.${policy.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.runtime.alertPolicies.${policy.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${runtimeName("RPOL", policy.id)}`, source));
      });
    runtimeRunbookExecutions(runtime)
      .slice()
      .sort(byId)
      .forEach((execution) => {
        const executionIndex = runtimeRunbookExecutions(runtime).findIndex((candidate) => candidate.id === execution.id);
        const source = runtimeRunbookExecutionSource(execution, executionIndex);
        artifacts.markdown.push(generatedEntry(`markdown.runtime.runbookExecutions.${execution.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.runtime.runbookExecutions.${execution.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${runtimeName("REXEC", execution.id)}`, source));
      });
    runtimeDependencyTraces(runtime)
      .slice()
      .sort(byId)
      .forEach((trace) => {
        const traceIndex = runtimeDependencyTraces(runtime).findIndex((candidate) => candidate.id === trace.id);
        const source = runtimeDependencyTraceSource(trace, traceIndex);
        artifacts.markdown.push(generatedEntry(`markdown.runtime.dependencyTraces.${trace.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.runtime.dependencyTraces.${trace.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${runtimeName("RTR", trace.id)}`, source));
      });
    runtimeIntentExecutions(runtime)
      .slice()
      .sort(byId)
      .forEach((execution) => {
        const executionIndex = runtimeIntentExecutions(runtime).findIndex((candidate) => candidate.id === execution.id);
        const source = runtimeIntentExecutionSource(execution, executionIndex);
        artifacts.markdown.push(generatedEntry(`markdown.runtime.intentExecutions.${execution.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.runtime.intentExecutions.${execution.id}`, source));
      });
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyRuntimeCriticalSlosHavePageAlert", { kind: "runtimePolicy", path: "model.patterns.runtime.slos" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyRuntimePageAlertsHaveTestedRunbook", { kind: "runtimePolicy", path: "model.patterns.runtime.alerts" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyRuntimeDependenciesHaveTimeout", { kind: "runtimePolicy", path: "model.patterns.runtime.dependencies" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyRuntimeRetriesAreIdempotent", { kind: "runtimePolicy", path: "model.patterns.runtime.dependencies" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyRuntimeSlosHaveTelemetry", { kind: "runtimePolicy", path: "model.patterns.runtime.slos" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyRuntimeTelemetryMeetsSlo", { kind: "runtimePolicy", path: "model.patterns.runtime.telemetry" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyRuntimePageAlertsHaveEnabledPolicy", { kind: "runtimePolicy", path: "model.patterns.runtime.alerts" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyRuntimePageAlertsHaveExecutedRunbook", { kind: "runtimePolicy", path: "model.patterns.runtime.alerts" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyRuntimeDependencyTracesWithinTimeout", { kind: "runtimePolicy", path: "model.patterns.runtime.dependencyTraces" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.RuntimeCriticalSlosHavePageAlert", { kind: "runtimePolicy", path: "model.patterns.runtime.slos" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.RuntimePageAlertsHaveTestedRunbook", { kind: "runtimePolicy", path: "model.patterns.runtime.alerts" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.RuntimeDependenciesHaveTimeout", { kind: "runtimePolicy", path: "model.patterns.runtime.dependencies" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.RuntimeRetriesAreIdempotent", { kind: "runtimePolicy", path: "model.patterns.runtime.dependencies" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.RuntimeSlosHaveTelemetry", { kind: "runtimePolicy", path: "model.patterns.runtime.slos" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.RuntimeTelemetryMeetsSlo", { kind: "runtimePolicy", path: "model.patterns.runtime.telemetry" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.RuntimePageAlertsHaveEnabledPolicy", { kind: "runtimePolicy", path: "model.patterns.runtime.alerts" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.RuntimePageAlertsHaveExecutedRunbook", { kind: "runtimePolicy", path: "model.patterns.runtime.alerts" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.RuntimeDependencyTracesWithinTimeout", { kind: "runtimePolicy", path: "model.patterns.runtime.dependencyTraces" }));
  }
  for (const source of runtimeCollectorSources(model)) {
    artifacts.runtimeCollector.push(
      generatedEntry(`runtimeCollector.sources.${source.provider}.${source.kind}.${source.expects.id}`, source.sourceMap),
    );
  }

  const intent = intentPattern(model);
  if (intent) {
    intentCapabilities(intent)
      .slice()
      .sort(byId)
      .forEach((capability) => {
        const capabilityIndex = intentCapabilities(intent).findIndex((candidate) => candidate.id === capability.id);
        const source = intentCapabilitySource(capability, capabilityIndex);
        artifacts.markdown.push(generatedEntry(`markdown.intent.capabilities.${capability.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.capabilities.${capability.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${intentName("IC", capability.id)}`, source));
      });
    intentOutcomes(intent)
      .slice()
      .sort(byId)
      .forEach((outcome) => {
        const outcomeIndex = intentOutcomes(intent).findIndex((candidate) => candidate.id === outcome.id);
        const source = intentOutcomeSource(outcome, outcomeIndex);
        artifacts.markdown.push(generatedEntry(`markdown.intent.outcomes.${outcome.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.outcomes.${outcome.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${intentName("IO", outcome.id)}`, source));
        list(outcome.outputContract?.fields)
          .slice()
          .sort(byId)
          .forEach((field) => {
            const fieldIndex = list(outcome.outputContract?.fields).findIndex((candidate) => candidate.id === field.id);
            const fieldSource = intentOutputFieldSource(outcome, outcomeIndex, field, fieldIndex);
            artifacts.markdown.push(generatedEntry(`markdown.intent.outcomes.${outcome.id}.output.fields.${field.id}`, fieldSource));
            artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.outcomes.${outcome.id}.output.fields.${field.id}`, fieldSource));
          });
        list(outcome.effects)
          .slice()
          .sort(byId)
          .forEach((effect) => {
            const effectIndex = list(outcome.effects).findIndex((candidate) => candidate.id === effect.id);
            const effectSource = intentEffectSource(outcome, outcomeIndex, effect, effectIndex);
            artifacts.markdown.push(generatedEntry(`markdown.intent.outcomes.${outcome.id}.effects.${effect.id}`, effectSource));
            artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.outcomes.${outcome.id}.effects.${effect.id}`, effectSource));
          });
      });
    intentProcesses(intent)
      .slice()
      .sort(byId)
      .forEach((process) => {
        const processIndex = intentProcesses(intent).findIndex((candidate) => candidate.id === process.id);
        const source = intentProcessSource(process, processIndex);
        artifacts.markdown.push(generatedEntry(`markdown.intent.processes.${process.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.processes.${process.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${intentName("IP", process.id)}`, source));
        if (process.execution) {
          const executionSource = intentExecutionPolicySource(process, processIndex);
          artifacts.markdown.push(generatedEntry(`markdown.intent.processes.${process.id}.execution`, executionSource));
          artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.processes.${process.id}.execution`, executionSource));
        }
        list(process.inputContract?.fields)
          .slice()
          .sort(byId)
          .forEach((field) => {
            const fieldIndex = list(process.inputContract?.fields).findIndex((candidate) => candidate.id === field.id);
            const fieldSource = intentInputFieldSource(process, processIndex, field, fieldIndex);
            artifacts.markdown.push(generatedEntry(`markdown.intent.processes.${process.id}.input.fields.${field.id}`, fieldSource));
            artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.processes.${process.id}.input.fields.${field.id}`, fieldSource));
          });
        intentRefinements(process)
          .slice()
          .sort(byId)
          .forEach((refinement) => {
            const refinementIndex = intentRefinements(process).findIndex((candidate) => candidate.id === refinement.id);
            const refinementSource = intentRefinementSource(process, processIndex, refinement, refinementIndex);
            artifacts.markdown.push(generatedEntry(`markdown.intent.processes.${process.id}.refinements.${refinement.id}`, refinementSource));
            artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.processes.${process.id}.refinements.${refinement.id}`, refinementSource));
          });
      });
    constructionAuthorities(intent)
      .slice()
      .sort(byId)
      .forEach((authority) => {
        const authorityIndex = constructionAuthorities(intent).findIndex((candidate) => candidate.id === authority.id);
        const source = constructionAuthoritySource(authority, authorityIndex);
        artifacts.markdown.push(generatedEntry(`markdown.intent.constructionAuthorities.${authority.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.constructionAuthorities.${authority.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${intentName("ICA", authority.id)}`, source));
      });
    intentAccessPolicies(intent)
      .slice()
      .sort(byId)
      .forEach((policy) => {
        const policyIndex = intentAccessPolicies(intent).findIndex((candidate) => candidate.id === policy.id);
        const source = intentAccessPolicySource(policy, policyIndex);
        artifacts.markdown.push(generatedEntry(`markdown.intent.accessPolicies.${policy.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.accessPolicies.${policy.id}`, source));
      });
    intentGoals(intent)
      .slice()
      .sort(byId)
      .forEach((goal) => {
        const goalIndex = intentGoals(intent).findIndex((candidate) => candidate.id === goal.id);
        const source = intentGoalSource(goal, goalIndex);
        artifacts.markdown.push(generatedEntry(`markdown.intent.goals.${goal.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.goals.${goal.id}`, source));
      });
    intentClaims(intent)
      .slice()
      .sort(byId)
      .forEach((claim) => {
        const claimIndex = intentClaims(intent).findIndex((candidate) => candidate.id === claim.id);
        const source = intentClaimSource(claim, claimIndex);
        artifacts.markdown.push(generatedEntry(`markdown.intent.claims.${claim.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.claims.${claim.id}`, source));
      });
    intentAssuranceTasks(intent)
      .slice()
      .sort(byId)
      .forEach((task) => {
        const taskIndex = intentAssuranceTasks(intent).findIndex((candidate) => candidate.id === task.id);
        const source = intentAssuranceTaskSource(task, taskIndex);
        artifacts.markdown.push(generatedEntry(`markdown.intent.assuranceTasks.${task.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.assuranceTasks.${task.id}`, source));
      });
    intentSemanticBindings(intent)
      .slice()
      .sort(byId)
      .forEach((binding) => {
        const bindingIndex = intentSemanticBindings(intent).findIndex((candidate) => candidate.id === binding.id);
        const source = intentSemanticBindingSource(binding, bindingIndex);
        artifacts.markdown.push(generatedEntry(`markdown.intent.semanticBindings.${binding.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.semanticBindings.${binding.id}`, source));
      });
    intentScenarios(intent)
      .slice()
      .sort(byId)
      .forEach((scenario) => {
        const scenarioIndex = intentScenarios(intent).findIndex((candidate) => candidate.id === scenario.id);
        const source = intentScenarioSource(scenario, scenarioIndex);
        artifacts.markdown.push(generatedEntry(`markdown.intent.scenarios.${scenario.id}`, source));
        artifacts.quickcheck.push(generatedEntry(`quickcheck.intent.scenarios.${scenario.id}`, source));
        artifacts.alloy.push(generatedEntry(`alloy.sig.${intentName("ISC", scenario.id)}`, source));
      });
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyIntentProcessConstructionIsAuthorized", { kind: "intentPolicy", path: "model.patterns.intent.processes" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyIntentScenarioTraceIsContinuous", { kind: "intentPolicy", path: "model.patterns.intent.scenarios" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyIntentProcessRefinementBindingsAreComplete", { kind: "intentPolicy", path: "model.patterns.intent.processes" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyIntentOutcomeEffectBindingsAreComplete", { kind: "intentPolicy", path: "model.patterns.intent.outcomes" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyIntentAccessPolicyOverridesHaveHigherPriority", { kind: "intentPolicy", path: "model.patterns.intent.accessPolicies" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyIntentAccessPoliciesResolveDeterministically", { kind: "intentPolicy", path: "model.patterns.intent.accessPolicies" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyIntentSemanticBindingsAreWellFormed", { kind: "intentPolicy", path: "model.patterns.intent.semanticBindings" }));
    artifacts.quickcheck.push(generatedEntry("quickcheck.propertyIntentClaimGraphIsComplete", { kind: "intentPolicy", path: "model.patterns.intent" }));
    artifacts.alloy.push(generatedEntry("alloy.assert.IntentProcessConstructionIsAuthorized", { kind: "intentPolicy", path: "model.patterns.intent.processes" }));
    intentProcesses(intent)
      .filter((process) => process.execution)
      .forEach((process) => {
        const processIndex = intentProcesses(intent).findIndex((candidate) => candidate.id === process.id);
        artifacts.quint.push(generatedEntry(
          `quint.intentProcessMaxInFlight[${process.id}]`,
          intentExecutionPolicySource(process, processIndex),
        ));
      });
    for (const generated of [
      "quint.intentConcurrencyBounded",
      "quint.intentIdempotencyKeysAreExclusive",
      "quint.intentTimeoutsBounded",
    ]) {
      artifacts.quint.push(generatedEntry(generated, { kind: "intentPolicy", path: "model.patterns.intent.processes" }));
    }
  }

  rules.forEach((rule, sortedRuleIndex) => {
    const ruleIndex = originalRuleIndex.get(rule.id);
    addRuleSourceEntries("markdown", artifacts.markdown, "markdown.rule", rule, ruleIndex);
    addRuleSourceEntries("quickcheck", artifacts.quickcheck, "quickcheck.rules", rule, ruleIndex);

    artifacts.alloy.push(generatedEntry(`alloy.sig.R_${sanitizeIdentifier(rule.id)}`, ruleSource(rule, ruleIndex), { sortedRuleIndex }));
    list(rule.checks).forEach((_target, checkIndex) => {
      artifacts.alloy.push(generatedEntry(`alloy.sig.C_${sortedRuleIndex}_${checkIndex}`, checkTargetSource(rule, ruleIndex, checkIndex), { sortedRuleIndex }));
    });
  });

  activeApproved.forEach((rule) => {
    const ruleIndex = originalRuleIndex.get(rule.id);
    artifacts.quickcheck.push(generatedEntry(`quickcheck.approvedRuleIds.${rule.id}`, ruleSource(rule, ruleIndex)));
    artifacts.quint.push(generatedEntry(`quint.activeApprovedRules.${rule.id}`, ruleSource(rule, ruleIndex)));
    artifacts.quint.push(generatedEntry(`quint.checks[${rule.id}]`, ruleSource(rule, ruleIndex)));
    artifacts.quint.push(generatedEntry(`quint.ruleClauses[${rule.id}]`, ruleSource(rule, ruleIndex)));
    artifacts.lean.push(generatedEntry(`lean.RuleId.${sanitizeIdentifier(rule.id)}`, ruleSource(rule, ruleIndex)));
    artifacts.lean.push(generatedEntry(`lean.checks.${sanitizeIdentifier(rule.id)}`, ruleSource(rule, ruleIndex)));
    artifacts.lean.push(generatedEntry(`lean.clauseExprs.${sanitizeIdentifier(rule.id)}`, ruleSource(rule, ruleIndex)));

    list(rule.checks).forEach((_target, index) => {
      artifacts.quint.push(generatedEntry(`quint.checks[${rule.id}][${index}]`, checkTargetSource(rule, ruleIndex, index)));
      artifacts.lean.push(generatedEntry(`lean.checks.${sanitizeIdentifier(rule.id)}[${index}]`, checkTargetSource(rule, ruleIndex, index)));
    });

    for (const [field, clauses] of [
      ["when", list(rule.when)],
      ["must", list(rule.must)],
      ["mustNot", list(rule.mustNot)],
    ]) {
      clauses.forEach((_clause, index) => {
        artifacts.quint.push(generatedEntry(`quint.ruleClauses[${rule.id}].${field}[${index}]`, clauseSource(rule, ruleIndex, field, index)));
        artifacts.lean.push(generatedEntry(`lean.clauseExprs.${sanitizeIdentifier(rule.id)}.${field}[${index}]`, clauseSource(rule, ruleIndex, field, index)));
      });
    }
  });

  for (const proof of leanSemanticClauseProofs(model)) {
    const ruleIndex = originalRuleIndex.get(proof.rule.id);
    artifacts.lean.push(
      generatedEntry(
        proof.generatedSelector,
        clauseSource(proof.rule, ruleIndex, proof.field, proof.index),
      ),
    );
  }

  for (const generated of [
    "quickcheck.propertyApprovedRulesHaveAutomatedChecks",
    "quickcheck.propertyApprovedRulesHaveRequiredAssurances",
    "alloy.assert.ApprovedRulesHaveChecks",
    "alloy.assert.ActiveApprovedRulesHaveAutomatedSupport",
    "quint.coverageInvariant",
    "quint.workflowInvariant",
    "lean.AutomatedSupport",
    "lean.CoverageInvariant",
    "lean.theorem.coverage_invariant",
  ]) {
    const artifact = generated.split(".")[0];
    artifacts[artifact].push(generatedEntry(generated, { kind: "coveragePolicy", path: "model.rules" }));
  }

  return {
    model: {
      id: model.id,
      version: model.version,
    },
    locale,
    artifacts,
  };
}

function emitSourceMap(model, requestedLocale) {
  return stableJson(emitSourceMapObject(model, requestedLocale));
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function generatedArtifactContents(model, requestedLocale) {
  return {
    alloy: emitAlloy(model),
    lean: emitLean(model),
    markdown: emitMarkdown(model, requestedLocale),
    quickcheck: emitQuickcheck(model),
    sourceMap: emitSourceMap(model, requestedLocale),
    quint: renderQuintModel(model),
  };
}

function emitGeneratedManifest(model, requestedLocale) {
  const contents = generatedArtifactContents(model, requestedLocale);
  const artifacts = Object.fromEntries(
    Object.entries(contents).map(([name, content]) => [
      name,
      {
        bytes: Buffer.byteLength(content, "utf8"),
        sha256: sha256(content),
      },
    ]),
  );
  return stableJson({
    artifacts,
    locale: requestedLocale,
    model: {
      id: model.id,
      version: model.version,
    },
  });
}

function sourceMapIndex(sourceMap) {
  const byGenerated = new Map();
  for (const [artifact, entries] of Object.entries(sourceMap.artifacts ?? {})) {
    for (const entry of list(entries)) {
      byGenerated.set(entry.generated, { artifact, ...entry });
    }
  }
  return byGenerated;
}

function counterexampleArtifactPrefix(backend) {
  if (backend === "quickcheck") return "quickcheck.";
  if (backend === "lean") return "lean.";
  if (backend.startsWith("quint")) return "quint.";
  if (backend.startsWith("alloy")) return "alloy.";
  return null;
}

function generatedSelectorMentioned(message, generated) {
  if (message.includes(generated)) return true;
  const tail = generated.slice(generated.lastIndexOf(".") + 1);
  if (tail && message.includes(tail)) return true;
  const bracket = generated.match(/\[([^\]]+)\]/);
  return Boolean(bracket && (message.includes(`[${bracket[1]}]`) || message.includes(bracket[1])));
}

function generatedSelectorsInText(sourceByGenerated, backend, message) {
  const prefix = counterexampleArtifactPrefix(backend);
  if (!prefix) return [];
  const matches = [];
  for (const [generated, entry] of sourceByGenerated.entries()) {
    if (!generated.startsWith(prefix)) continue;
    if (!generatedSelectorMentioned(message, generated)) continue;
    matches.push({ generated, source: entry.source });
  }
  const concrete = matches.filter((entry) => !String(entry.source?.kind ?? "").endsWith("Policy"));
  return (concrete.length > 0 ? concrete : matches).sort((left, right) => left.generated.localeCompare(right.generated));
}

function sourceMapEntries(sourceMap) {
  const entries = [];
  for (const [artifact, artifactEntries] of Object.entries(sourceMap.artifacts ?? {})) {
    for (const entry of list(artifactEntries)) {
      entries.push({ artifact, generated: entry.generated, source: entry.source });
    }
  }
  return entries.sort((left, right) => {
    const artifact = left.artifact.localeCompare(right.artifact);
    return artifact === 0 ? left.generated.localeCompare(right.generated) : artifact;
  });
}

function diffItems(beforeItems, afterItems) {
  const beforeById = new Map(list(beforeItems).map((item) => [item.id, item]));
  const afterById = new Map(list(afterItems).map((item) => [item.id, item]));
  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort();
  const changes = [];

  for (const id of ids) {
    const before = beforeById.get(id);
    const after = afterById.get(id);
    if (!before) {
      changes.push({ id, change: "added" });
    } else if (!after) {
      changes.push({ id, change: "removed" });
    } else if (stableJson(before) !== stableJson(after)) {
      changes.push({ id, change: "modified" });
    }
  }

  return changes;
}

function ruleById(model, ruleId) {
  return list(model.rules).find((rule) => rule.id === ruleId) ?? null;
}

function termAffectedRuleIds(...modelsAndTerm) {
  const termId = modelsAndTerm.pop();
  const ids = new Set();
  for (const model of modelsAndTerm) {
    for (const rule of list(model.rules)) {
      if (list(rule.terms).includes(termId)) {
        ids.add(rule.id);
      }
    }
  }
  return [...ids].sort();
}

function ruleImplementationRefs(...rules) {
  const refs = new Map();
  for (const rule of rules) {
    if (!rule) continue;
    for (const ref of list(rule.implementedBy)) {
      refs.set(stableJson(ref), ref);
    }
  }
  return [...refs.values()].sort((left, right) => {
    const path = String(left.path).localeCompare(String(right.path));
    if (path !== 0) return path;
    const symbol = String(left.symbol ?? "").localeCompare(String(right.symbol ?? ""));
    if (symbol !== 0) return symbol;
    return String(left.kind).localeCompare(String(right.kind));
  });
}

function generatedForSource(sourceMap, predicate) {
  return sourceMapEntries(sourceMap).filter((entry) => predicate(entry.source));
}

function generatedForRuleIds(sourceMap, ruleIds) {
  const ids = new Set(ruleIds);
  return generatedForSource(sourceMap, (source) => ids.has(source?.ruleId));
}

function generatedForTermId(sourceMap, termId) {
  return generatedForSource(sourceMap, (source) => source?.termId === termId);
}

function sourceModelForChange(change, beforeModel, afterModel) {
  return change.change === "removed" ? beforeModel : afterModel;
}

function sourceMapForChange(change, beforeSourceMap, afterSourceMap) {
  return change.change === "removed" ? beforeSourceMap : afterSourceMap;
}

function ruleIndex(model, rule) {
  return list(model.rules).findIndex((candidate) => candidate.id === rule.id);
}

function ruleInfo(rule, locale) {
  return {
    id: rule.id,
    kind: rule.kind,
    status: rule.reviewStatus,
    text: text(rule.text, locale),
  };
}

function ruleMaps(model) {
  const byId = new Map();
  const bySanitized = new Map();
  for (const rule of list(model.rules)) {
    byId.set(rule.id, rule);
    const sanitized = sanitizeIdentifier(rule.id);
    if (!bySanitized.has(sanitized)) {
      bySanitized.set(sanitized, []);
    }
    bySanitized.get(sanitized).push(rule);
  }
  return { byId, bySanitized };
}

function ruleIdsInText(model, message) {
  const { bySanitized } = ruleMaps(model);
  const found = new Set();
  for (const rule of list(model.rules)) {
    if (message.includes(rule.id)) {
      found.add(rule.id);
    }
  }
  for (const [sanitized, rules] of bySanitized.entries()) {
    if (message.includes(sanitized) && rules.length === 1) {
      found.add(rules[0].id);
    }
  }
  return [...found].sort();
}

function generatedSelectorForRule(backend, rule) {
  if (backend === "quickcheck") return `quickcheck.approvedRuleIds.${rule.id}`;
  if (backend === "lean") return `lean.RuleId.${sanitizeIdentifier(rule.id)}`;
  if (backend.startsWith("quint")) return `quint.checks[${rule.id}]`;
  if (backend.startsWith("alloy")) return `alloy.sig.R_${sanitizeIdentifier(rule.id)}`;
  return `generated.rule.${rule.id}`;
}

function generatedSelectorForPolicy(backend, property = "approved-rules-have-automated-checks") {
  if (property === "approved-rules-have-required-assurances") {
    if (backend === "quickcheck") return "quickcheck.propertyApprovedRulesHaveRequiredAssurances";
    return null;
  }
  if (property === "db-transaction-preserves-invariants") {
    if (backend === "quickcheck") return "quickcheck.propertyDbTransactionsPreserveInvariants";
    if (backend.startsWith("quint")) return "quint.DbInvariantPreserved";
    if (backend.startsWith("alloy")) return "alloy.assert.DbTransactionsPreserveInvariants";
  }
  if (property === "db-migration-preserves-invariants") {
    if (backend === "quickcheck") return "quickcheck.propertyDbMigrationsPreserveInvariants";
    if (backend.startsWith("quint")) return "quint.DbMigrationPreserved";
    if (backend.startsWith("alloy")) return "alloy.assert.DbMigrationsPreserveInvariants";
  }
  if (property === "db-migration-mappings-cover-invariants") {
    if (backend === "quickcheck") return "quickcheck.propertyDbMigrationMappingsCoverInvariants";
    if (backend.startsWith("quint")) return "quint.DbMigrationMappingCovered";
    if (backend.startsWith("alloy")) return "alloy.assert.DbMigrationMappingsCoverInvariants";
  }
  if (property === "db-migration-mapping-expressions-mention-tables") {
    if (backend === "quickcheck") return "quickcheck.propertyDbMigrationMappingExpressionsMentionTables";
    if (backend.startsWith("quint")) return "quint.DbMigrationMappingRefsMentionTables";
    if (backend.startsWith("alloy")) return "alloy.assert.DbMigrationMappingExpressionsMentionTables";
  }
  if (property === "cloud-public-ingress-blocked") {
    if (backend === "quickcheck") return "quickcheck.propertyCloudPublicIngressBlocked";
    if (backend.startsWith("quint")) return "quint.CloudPublicIngressBlocked";
    if (backend.startsWith("alloy")) return "alloy.assert.CloudPublicIngressBlocked";
  }
  if (property === "cloud-resource-access-has-policy") {
    if (backend === "quickcheck") return "quickcheck.propertyCloudResourceAccessHasPolicy";
    if (backend.startsWith("quint")) return "quint.CloudResourceAccessHasPolicy";
    if (backend.startsWith("alloy")) return "alloy.assert.CloudResourceAccessHasPolicy";
  }
  if (property === "cloud-tenant-flow-propagates-tenant") {
    if (backend === "quickcheck") return "quickcheck.propertyCloudTenantFlowsPropagateTenant";
    if (backend.startsWith("quint")) return "quint.CloudTenantFlowsPropagateTenant";
    if (backend.startsWith("alloy")) return "alloy.assert.CloudTenantFlowsPropagateTenant";
  }
  if (property === "cloud-queue-publish-has-idempotency-key") {
    if (backend === "quickcheck") return "quickcheck.propertyCloudQueuePublishesHaveIdempotencyKey";
    if (backend.startsWith("quint")) return "quint.CloudQueuePublishesHaveIdempotencyKey";
    if (backend.startsWith("alloy")) return "alloy.assert.CloudQueuePublishesHaveIdempotencyKey";
  }
  if (property === "data-sensitive-placement-encrypted") {
    if (backend === "quickcheck") return "quickcheck.propertyDataSensitivePlacementsEncrypted";
    if (backend.startsWith("quint")) return "quint.DataSensitivePlacementsEncrypted";
    if (backend.startsWith("alloy")) return "alloy.assert.DataSensitivePlacementsEncrypted";
  }
  if (property === "data-personal-placement-supports-deletion") {
    if (backend === "quickcheck") return "quickcheck.propertyDataPersonalPlacementsSupportDeletion";
    if (backend.startsWith("quint")) return "quint.DataPersonalPlacementsSupportDeletion";
    if (backend.startsWith("alloy")) return "alloy.assert.DataPersonalPlacementsSupportDeletion";
  }
  if (property === "data-cross-region-flow-has-legal-basis") {
    if (backend === "quickcheck") return "quickcheck.propertyDataCrossRegionFlowsHaveLegalBasis";
    if (backend.startsWith("quint")) return "quint.DataCrossRegionFlowsHaveLegalBasis";
    if (backend.startsWith("alloy")) return "alloy.assert.DataCrossRegionFlowsHaveLegalBasis";
  }
  if (property === "data-retention-within-policy") {
    if (backend === "quickcheck") return "quickcheck.propertyDataRetentionWithinPolicy";
    if (backend.startsWith("quint")) return "quint.DataRetentionWithinPolicy";
    if (backend.startsWith("alloy")) return "alloy.assert.DataRetentionWithinPolicy";
  }
  if (property === "release-production-step-has-health-gate") {
    if (backend === "quickcheck") return "quickcheck.propertyReleaseProductionStepsHaveHealthGate";
    if (backend.startsWith("quint")) return "quint.ReleaseProductionStepsHaveHealthGate";
    if (backend.startsWith("alloy")) return "alloy.assert.ReleaseProductionStepsHaveHealthGate";
  }
  if (property === "release-traffic-shift-has-rollback") {
    if (backend === "quickcheck") return "quickcheck.propertyReleaseTrafficShiftsHaveRollback";
    if (backend.startsWith("quint")) return "quint.ReleaseTrafficShiftsHaveRollback";
    if (backend.startsWith("alloy")) return "alloy.assert.ReleaseTrafficShiftsHaveRollback";
  }
  if (property === "release-rollback-plan-tested") {
    if (backend === "quickcheck") return "quickcheck.propertyReleaseRollbackPlansAreTested";
    if (backend.startsWith("quint")) return "quint.ReleaseRollbackPlansAreTested";
    if (backend.startsWith("alloy")) return "alloy.assert.ReleaseRollbackPlansAreTested";
  }
  if (property === "release-migration-backward-compatible") {
    if (backend === "quickcheck") return "quickcheck.propertyReleaseMigrationsAreBackwardCompatible";
    if (backend.startsWith("quint")) return "quint.ReleaseMigrationsAreBackwardCompatible";
    if (backend.startsWith("alloy")) return "alloy.assert.ReleaseMigrationsAreBackwardCompatible";
  }
  if (property === "runtime-critical-slo-has-page-alert") {
    if (backend === "quickcheck") return "quickcheck.propertyRuntimeCriticalSlosHavePageAlert";
    if (backend.startsWith("quint")) return "quint.RuntimeCriticalSlosHavePageAlert";
    if (backend.startsWith("alloy")) return "alloy.assert.RuntimeCriticalSlosHavePageAlert";
  }
  if (property === "runtime-page-alert-has-tested-runbook") {
    if (backend === "quickcheck") return "quickcheck.propertyRuntimePageAlertsHaveTestedRunbook";
    if (backend.startsWith("quint")) return "quint.RuntimePageAlertsHaveTestedRunbook";
    if (backend.startsWith("alloy")) return "alloy.assert.RuntimePageAlertsHaveTestedRunbook";
  }
  if (property === "runtime-dependency-has-timeout") {
    if (backend === "quickcheck") return "quickcheck.propertyRuntimeDependenciesHaveTimeout";
    if (backend.startsWith("quint")) return "quint.RuntimeDependenciesHaveTimeout";
    if (backend.startsWith("alloy")) return "alloy.assert.RuntimeDependenciesHaveTimeout";
  }
  if (property === "runtime-retry-is-idempotent") {
    if (backend === "quickcheck") return "quickcheck.propertyRuntimeRetriesAreIdempotent";
    if (backend.startsWith("quint")) return "quint.RuntimeRetriesAreIdempotent";
    if (backend.startsWith("alloy")) return "alloy.assert.RuntimeRetriesAreIdempotent";
  }
  if (property === "runtime-slo-has-telemetry") {
    if (backend === "quickcheck") return "quickcheck.propertyRuntimeSlosHaveTelemetry";
    if (backend.startsWith("quint")) return "quint.RuntimeSlosHaveTelemetry";
    if (backend.startsWith("alloy")) return "alloy.assert.RuntimeSlosHaveTelemetry";
  }
  if (property === "runtime-telemetry-meets-slo") {
    if (backend === "quickcheck") return "quickcheck.propertyRuntimeTelemetryMeetsSlo";
    if (backend.startsWith("quint")) return "quint.RuntimeTelemetryMeetsSlo";
    if (backend.startsWith("alloy")) return "alloy.assert.RuntimeTelemetryMeetsSlo";
  }
  if (property === "runtime-page-alert-has-enabled-policy") {
    if (backend === "quickcheck") return "quickcheck.propertyRuntimePageAlertsHaveEnabledPolicy";
    if (backend.startsWith("quint")) return "quint.RuntimePageAlertsHaveEnabledPolicy";
    if (backend.startsWith("alloy")) return "alloy.assert.RuntimePageAlertsHaveEnabledPolicy";
  }
  if (property === "runtime-page-alert-has-runbook-execution") {
    if (backend === "quickcheck") return "quickcheck.propertyRuntimePageAlertsHaveExecutedRunbook";
    if (backend.startsWith("quint")) return "quint.RuntimePageAlertsHaveExecutedRunbook";
    if (backend.startsWith("alloy")) return "alloy.assert.RuntimePageAlertsHaveExecutedRunbook";
  }
  if (property === "runtime-dependency-trace-within-timeout") {
    if (backend === "quickcheck") return "quickcheck.propertyRuntimeDependencyTracesWithinTimeout";
    if (backend.startsWith("quint")) return "quint.RuntimeDependencyTracesWithinTimeout";
    if (backend.startsWith("alloy")) return "alloy.assert.RuntimeDependencyTracesWithinTimeout";
  }
  if (backend === "quickcheck") return "quickcheck.propertyApprovedRulesHaveAutomatedChecks";
  if (backend === "lean") return "lean.CoverageInvariant";
  if (backend.startsWith("quint")) return "quint.CoverageInvariant";
  if (backend.startsWith("alloy")) return "alloy.assert.ApprovedRulesHaveChecks";
  return null;
}

function inferCounterexampleProperty(backend, message) {
  if (message.includes("approved-rules-have-required-assurances")) return "approved-rules-have-required-assurances";
  if (message.includes("approved-rules-have-automated-checks")) return "approved-rules-have-automated-checks";
  if (message.includes("db-transaction-preserves-invariants") || message.includes("DbInvariantPreserved") || message.includes("DbTransactionsPreserveInvariants")) {
    return "db-transaction-preserves-invariants";
  }
  if (message.includes("db-migration-preserves-invariants") || message.includes("DbMigrationPreserved") || message.includes("DbMigrationsPreserveInvariants")) {
    return "db-migration-preserves-invariants";
  }
  if (message.includes("db-migration-mappings-cover-invariants") || message.includes("DbMigrationMappingCovered") || message.includes("DbMigrationMappingsCoverInvariants")) {
    return "db-migration-mappings-cover-invariants";
  }
  if (message.includes("db-migration-mapping-expressions-mention-tables") || message.includes("DbMigrationMappingRefsMentionTables") || message.includes("DbMigrationMappingExpressionsMentionTables")) {
    return "db-migration-mapping-expressions-mention-tables";
  }
  if (message.includes("cloud-public-ingress-blocked") || message.includes("CloudPublicIngressBlocked")) return "cloud-public-ingress-blocked";
  if (message.includes("cloud-resource-access-has-policy") || message.includes("CloudResourceAccessHasPolicy")) return "cloud-resource-access-has-policy";
  if (message.includes("cloud-tenant-flow-propagates-tenant") || message.includes("CloudTenantFlowsPropagateTenant")) return "cloud-tenant-flow-propagates-tenant";
  if (message.includes("cloud-queue-publish-has-idempotency-key") || message.includes("CloudQueuePublishesHaveIdempotencyKey")) return "cloud-queue-publish-has-idempotency-key";
  if (message.includes("data-sensitive-placement-encrypted") || message.includes("DataSensitivePlacementsEncrypted")) return "data-sensitive-placement-encrypted";
  if (message.includes("data-personal-placement-supports-deletion") || message.includes("DataPersonalPlacementsSupportDeletion")) return "data-personal-placement-supports-deletion";
  if (message.includes("data-cross-region-flow-has-legal-basis") || message.includes("DataCrossRegionFlowsHaveLegalBasis")) return "data-cross-region-flow-has-legal-basis";
  if (message.includes("data-retention-within-policy") || message.includes("DataRetentionWithinPolicy")) return "data-retention-within-policy";
  if (message.includes("release-production-step-has-health-gate") || message.includes("ReleaseProductionStepsHaveHealthGate")) return "release-production-step-has-health-gate";
  if (message.includes("release-traffic-shift-has-rollback") || message.includes("ReleaseTrafficShiftsHaveRollback")) return "release-traffic-shift-has-rollback";
  if (message.includes("release-rollback-plan-tested") || message.includes("ReleaseRollbackPlansAreTested")) return "release-rollback-plan-tested";
  if (message.includes("release-migration-backward-compatible") || message.includes("ReleaseMigrationsAreBackwardCompatible")) return "release-migration-backward-compatible";
  if (message.includes("runtime-critical-slo-has-page-alert") || message.includes("RuntimeCriticalSlosHavePageAlert")) return "runtime-critical-slo-has-page-alert";
  if (message.includes("runtime-page-alert-has-tested-runbook") || message.includes("RuntimePageAlertsHaveTestedRunbook")) return "runtime-page-alert-has-tested-runbook";
  if (message.includes("runtime-dependency-has-timeout") || message.includes("RuntimeDependenciesHaveTimeout")) return "runtime-dependency-has-timeout";
  if (message.includes("runtime-retry-is-idempotent") || message.includes("RuntimeRetriesAreIdempotent")) return "runtime-retry-is-idempotent";
  if (message.includes("runtime-slo-has-telemetry") || message.includes("RuntimeSlosHaveTelemetry")) return "runtime-slo-has-telemetry";
  if (message.includes("runtime-telemetry-meets-slo") || message.includes("RuntimeTelemetryMeetsSlo")) return "runtime-telemetry-meets-slo";
  if (message.includes("runtime-page-alert-has-enabled-policy") || message.includes("RuntimePageAlertsHaveEnabledPolicy")) return "runtime-page-alert-has-enabled-policy";
  if (message.includes("runtime-page-alert-has-runbook-execution") || message.includes("RuntimePageAlertsHaveExecutedRunbook")) return "runtime-page-alert-has-runbook-execution";
  if (message.includes("runtime-dependency-trace-within-timeout") || message.includes("RuntimeDependencyTracesWithinTimeout")) return "runtime-dependency-trace-within-timeout";
  if (message.includes("AutomatedSupport") || message.includes("CoverageInvariant") || message.includes("ApprovedRulesHaveChecks")) {
    return "approved-rules-have-automated-checks";
  }
  if (message.includes("WorkflowInvariant")) return "workflow-invariant";
  return `${backend}-failure`;
}

function counterexampleMessage(property) {
  if (property === "approved-rules-have-required-assurances") {
    return "approved rule lacks a required assurance kind";
  }
  if (property === "approved-rules-have-automated-checks") {
    return "approved rule lacks automated check support";
  }
  if (property === "workflow-invariant") {
    return "generated workflow invariant was violated";
  }
  if (property === "db-transaction-preserves-invariants") {
    return "database transaction does not declare preservation of a touched invariant";
  }
  if (property === "db-migration-preserves-invariants") {
    return "database migration does not declare preservation of a touched invariant";
  }
  if (property === "db-migration-mappings-cover-invariants") {
    return "database migration does not provide a mapping witness for a preserved invariant";
  }
  if (property === "db-migration-mapping-expressions-mention-tables") {
    return "database migration mapping expression does not mention source and target tables";
  }
  if (property === "cloud-public-ingress-blocked") {
    return "public ingress can directly reach a sensitive cloud resource";
  }
  if (property === "cloud-resource-access-has-policy") {
    return "cloud flow to a sensitive resource lacks an explicit policy";
  }
  if (property === "cloud-tenant-flow-propagates-tenant") {
    return "cloud flow touching tenant-scoped nodes does not propagate tenant scope";
  }
  if (property === "cloud-queue-publish-has-idempotency-key") {
    return "cloud queue publish flow lacks an idempotency key";
  }
  if (property === "data-sensitive-placement-encrypted") {
    return "sensitive data placement is stored without encryption";
  }
  if (property === "data-personal-placement-supports-deletion") {
    return "personal data placement uses a store without deletion support";
  }
  if (property === "data-cross-region-flow-has-legal-basis") {
    return "cross-region personal data flow lacks a legal basis";
  }
  if (property === "data-retention-within-policy") {
    return "data retention exceeds the policy for its classification";
  }
  if (property === "release-production-step-has-health-gate") {
    return "production release step lacks a health gate";
  }
  if (property === "release-traffic-shift-has-rollback") {
    return "production traffic shift lacks a rollback plan";
  }
  if (property === "release-rollback-plan-tested") {
    return "release step references an untested rollback plan";
  }
  if (property === "release-migration-backward-compatible") {
    return "production release step uses a non-backward-compatible migration";
  }
  if (property === "runtime-critical-slo-has-page-alert") {
    return "critical service SLO lacks a page alert";
  }
  if (property === "runtime-page-alert-has-tested-runbook") {
    return "page alert lacks a tested runbook";
  }
  if (property === "runtime-dependency-has-timeout") {
    return "runtime dependency lacks a positive timeout";
  }
  if (property === "runtime-retry-is-idempotent") {
    return "retryable runtime dependency is not marked idempotent";
  }
  if (property === "runtime-slo-has-telemetry") {
    return "runtime SLO lacks imported telemetry evidence";
  }
  if (property === "runtime-telemetry-meets-slo") {
    return "imported telemetry is below the declared SLO target";
  }
  if (property === "runtime-page-alert-has-enabled-policy") {
    return "page alert lacks an enabled imported alert policy";
  }
  if (property === "runtime-page-alert-has-runbook-execution") {
    return "page alert runbook lacks a passing execution record";
  }
  if (property === "runtime-dependency-trace-within-timeout") {
    return "imported dependency trace exceeds the declared timeout";
  }
  return "generated backend reported a counterexample";
}

function unsupportedApprovedRules(model) {
  return activeApprovedRules(model).filter((rule) => automatedCheckTargets(rule).length === 0);
}

function sourceForGenerated(model, sourceByGenerated, generated, rule) {
  const mapped = sourceByGenerated.get(generated);
  if (mapped) {
    return mapped.source;
  }
  if (rule) {
    return ruleSource(rule, ruleIndex(model, rule));
  }
  return { kind: "generated", path: generated ?? "generated" };
}

function normalizedCounterexample(model, sourceByGenerated, locale, backend, rule, generated, property, evidence = {}) {
  return {
    backend,
    property,
    generated,
    source: sourceForGenerated(model, sourceByGenerated, generated, rule),
    rule: rule ? ruleInfo(rule, locale) : null,
    message: counterexampleMessage(property),
    evidence,
  };
}

function sanitizeGeneratedBackendMessage(message) {
  const tempRoot = tmpdir().replace(/\/$/, "");
  const roots = new Set([tempRoot]);
  try {
    roots.add(realpathSync(tempRoot).replace(/\/$/, ""));
  } catch {
    // The non-realpath temp directory is still enough for normal Node output.
  }
  if (tempRoot.startsWith("/var/")) {
    roots.add(`/private${tempRoot}`);
  }

  let sanitized = String(message);
  for (const root of roots) {
    sanitized = sanitized.replace(new RegExp(`${escapeRegex(root)}/dspec-generated-[^/\\s:"]+/`, "g"), "<generated>/");
    sanitized = sanitized.replace(new RegExp(`${escapeRegex(root)}/`, "g"), "<tmp>/");
  }
  return sanitized;
}

function parseQuickcheckFailures(message) {
  try {
    const parsed = JSON.parse(message);
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === "object") : [];
  } catch {
    return [];
  }
}

function normalizeQuickcheckCounterexamples(model, sourceByGenerated, locale, backend) {
  const failures = parseQuickcheckFailures(backend.message ?? "");
  const { byId } = ruleMaps(model);
  const counterexamples = failures.flatMap((failure) => {
    if (failure.property === "db-transaction-preserves-invariants") {
      const generated = `quickcheck.db.transactions.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "db-migration-preserves-invariants") {
      const generated = `quickcheck.db.migrations.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "db-migration-mappings-cover-invariants") {
      const generated = `quickcheck.db.migrations.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "db-migration-mapping-expressions-mention-tables") {
      const generated = `quickcheck.db.migrations.${failure.value}.mappings.${failure.mapping}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (String(failure.property ?? "").startsWith("cloud-")) {
      const generated = `quickcheck.cloud.flows.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "data-sensitive-placement-encrypted" || failure.property === "data-personal-placement-supports-deletion") {
      const generated = `quickcheck.data.placements.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "data-cross-region-flow-has-legal-basis") {
      const generated = `quickcheck.data.flows.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "data-retention-within-policy") {
      const generated = `quickcheck.data.datasets.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (String(failure.property ?? "").startsWith("release-")) {
      const generated = `quickcheck.release.steps.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "runtime-critical-slo-has-page-alert") {
      const generated = `quickcheck.runtime.slos.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "runtime-page-alert-has-tested-runbook") {
      const generated = `quickcheck.runtime.alerts.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "runtime-dependency-has-timeout" || failure.property === "runtime-retry-is-idempotent") {
      const generated = `quickcheck.runtime.dependencies.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "runtime-slo-has-telemetry") {
      const generated = `quickcheck.runtime.slos.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "runtime-telemetry-meets-slo") {
      const generated = `quickcheck.runtime.telemetry.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "runtime-page-alert-has-enabled-policy" || failure.property === "runtime-page-alert-has-runbook-execution") {
      const generated = `quickcheck.runtime.alerts.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    if (failure.property === "runtime-dependency-trace-within-timeout") {
      const generated = `quickcheck.runtime.dependencyTraces.${failure.value}`;
      return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", null, generated, failure.property, failure)];
    }
    const rule = byId.get(String(failure.value));
    if (!rule) return [];
    const property = String(failure.property ?? "quickcheck-failure");
    const generated = generatedSelectorForRule("quickcheck", rule);
    return [normalizedCounterexample(model, sourceByGenerated, locale, "quickcheck", rule, generated, property, failure)];
  });
  return counterexamples.length > 0
    ? counterexamples
    : normalizeTextCounterexamples(model, sourceByGenerated, locale, "quickcheck", backend);
}

function normalizeTextCounterexamples(model, sourceByGenerated, locale, backendName, backend) {
  const message = sanitizeGeneratedBackendMessage(backend.message ?? "");
  const { byId } = ruleMaps(model);
  const property = inferCounterexampleProperty(backendName, message);
  const ruleIds = ruleIdsInText(model, message);
  if (ruleIds.length > 0) {
    return ruleIds.map((ruleId) => {
      const rule = byId.get(ruleId);
      const generated = generatedSelectorForRule(backendName, rule);
      return normalizedCounterexample(model, sourceByGenerated, locale, backendName, rule, generated, property, { message });
    });
  }

  const unsupported = unsupportedApprovedRules(model);
  const isCoverageSupportFailure =
    property === "approved-rules-have-automated-checks" ||
    ((backendName === "alloyAnalyzer" || backendName === "quintVerify") && unsupported.length > 0);
  if (isCoverageSupportFailure) {
    if (unsupported.length > 0) {
      return unsupported.map((rule) => {
        const generated = generatedSelectorForRule(backendName, rule);
        return normalizedCounterexample(model, sourceByGenerated, locale, backendName, rule, generated, "approved-rules-have-automated-checks", { message });
      });
    }
  }

  const generatedMatches = generatedSelectorsInText(sourceByGenerated, backendName, message);
  if (generatedMatches.length > 0) {
    return generatedMatches.map((match) =>
      normalizedCounterexample(model, sourceByGenerated, locale, backendName, null, match.generated, property, { message })
    );
  }

  const generated = generatedSelectorForPolicy(backendName, property);
  return [normalizedCounterexample(model, sourceByGenerated, locale, backendName, null, generated, property, { message })];
}

function normalizeCounterexamples(model, report, requestedLocale) {
  const locale = requestedLocale ?? model.primaryLocale;
  const sourceByGenerated = sourceMapIndex(emitSourceMapObject(model, locale));
  const counterexamples = [];

  for (const [backendName, backend] of Object.entries(report.backends ?? {})) {
    if (backend.status !== "fail") continue;
    if (backendName === "quickcheck") {
      counterexamples.push(...normalizeQuickcheckCounterexamples(model, sourceByGenerated, locale, backend));
      continue;
    }
    counterexamples.push(...normalizeTextCounterexamples(model, sourceByGenerated, locale, backendName, backend));
  }

  return {
    model: report.model,
    status: report.status === "fail" ? "fail" : "pass",
    locale,
    counterexamples,
  };
}

function renderCounterexampleReport(report) {
  if (report.status === "pass") {
    return `ok: ${report.model.id} no generated counterexamples\n`;
  }

  const lines = [`counterexamples: ${report.model.id}`, ""];
  for (const counterexample of report.counterexamples) {
    const rule = counterexample.rule ? `${counterexample.rule.id}: ${counterexample.rule.text}` : "(no source rule)";
    lines.push(`- backend: ${counterexample.backend}`);
    lines.push(`  generated: ${counterexample.generated ?? "(unmapped)"}`);
    lines.push(`  source: ${counterexample.source.path}`);
    lines.push(`  rule: ${rule}`);
    lines.push(`  message: ${counterexample.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function appendDomainModelMarkdown(lines, model, locale) {
  const domain = domainPattern(model);
  if (!domain) return;

  const renderText = (entry) => {
    if (!entry.text) return;
    lines.push(text(entry.text, locale));
    lines.push("");
  };
  const renderFields = (fields) => {
    for (const field of list(fields).slice().sort(byId)) {
      const target = field.target ? ` -> \`${field.target}\`` : "";
      const collection = field.collection ? "[]" : "";
      const required = field.required === false ? " optional" : " required";
      lines.push(`- field: \`${field.id}\` ${field.type}${target}${collection}${required}`);
      if (field.text) lines.push(`  - description: ${text(field.text, locale)}`);
    }
  };
  const renderTarget = (target) => {
    if (!target) return;
    const symbol = target.symbol ? `#${target.symbol}` : "";
    lines.push(`- target: ${target.kind} ${target.path}${symbol}`);
  };

  lines.push("## Domain Model", "");
  for (const entry of list(domain.enums).slice().sort(byId)) {
    lines.push(`### Enum ${entry.id}`, "");
    renderText(entry);
    lines.push(`- values: ${list(entry.values).map((value) => `\`${value}\``).join(", ")}`, "");
  }
  for (const entry of list(domain.valueObjects).slice().sort(byId)) {
    lines.push(`### Value Object ${entry.id}`, "");
    renderText(entry);
    renderFields(entry.fields);
    lines.push("");
  }
  for (const entry of list(domain.entities).slice().sort(byId)) {
    lines.push(`### Entity ${entry.id}`, "");
    renderText(entry);
    lines.push(`- identity: \`${entry.identity}\``);
    renderFields(entry.fields);
    lines.push("");
  }
  for (const entry of list(domain.aggregates).slice().sort(byId)) {
    lines.push(`### Aggregate ${entry.id}`, "");
    renderText(entry);
    lines.push(`- root: \`${entry.root}\``);
    for (const member of list(entry.members).slice().sort()) lines.push(`- member: \`${member}\``);
    lines.push("");
  }
  for (const entry of list(domain.commands).slice().sort(byId)) {
    lines.push(`### Command ${entry.id}`, "");
    renderText(entry);
    lines.push(`- aggregate: \`${entry.aggregate}\``);
    renderFields(entry.fields);
    lines.push("");
  }
  for (const entry of list(domain.events).slice().sort(byId)) {
    lines.push(`### Event ${entry.id}`, "");
    renderText(entry);
    lines.push(`- aggregate: \`${entry.aggregate}\``);
    renderFields(entry.fields);
    lines.push("");
  }
  for (const entry of list(domain.invariants).slice().sort(byId)) {
    lines.push(`### Domain Invariant ${entry.id}`, "");
    renderText(entry);
    if (entry.aggregate) lines.push(`- aggregate: \`${entry.aggregate}\``);
    lines.push(`- rule: \`${entry.rule}\``, "");
  }
  for (const entry of list(domain.formalizations).slice().sort(byId)) {
    lines.push(`### Domain Formalization ${entry.id}`, "");
    renderText(entry);
    lines.push(`- rule: \`${entry.rule}\``);
    lines.push(`- kind: \`${entry.kind}\``);
    lines.push(`- assurance: \`${entry.assurance}\``);
    renderTarget(entry.target);
    for (const assumption of list(entry.assumptions)) lines.push(`- assumption: ${assumption}`);
    for (const mapping of list(entry.actionMappings).slice().sort((left, right) => String(left.action).localeCompare(String(right.action)))) {
      const command = mapping.command ? `command: \`${mapping.command}\`` : null;
      const events = list(mapping.events).length > 0 ? `events: ${list(mapping.events).slice().sort().map((event) => `\`${event}\``).join(", ")}` : null;
      lines.push(`- action: ${[`\`${mapping.action}\``, command, events].filter(Boolean).join(" → ")}`);
    }
    for (const check of list(entry.checks).slice().sort()) lines.push(`- expected check: \`${check}\``);
    lines.push("");
  }
}

function appendDomainRelationshipMarkdown(lines, model) {
  if (!domainPattern(model)) return;
  const graph = domainRelationshipGraph(model);
  lines.push("## Specification Relationships", "");
  lines.push(`- nodes: \`${graph.summary.nodes}\``);
  lines.push(`- relationships: \`${graph.summary.edges}\``);
  lines.push(`- status: \`${graph.status}\``, "");
  if (graph.errors.length > 0) {
    lines.push("### Validation errors", "");
    for (const error of graph.errors) lines.push(`- ${error}`);
    lines.push("");
  }
  lines.push("### Relationship ledger", "", "| From | Relation | To |", "| --- | --- | --- |");
  for (const edge of graph.edges) lines.push(`| \`${edge.from}\` | \`${edge.relation}\` | \`${edge.to}\` |`);
  lines.push("", "### Diagram", "", "```mermaid", renderDomainRelationshipMermaid(graph).trimEnd(), "```", "");
}

function render(model, requestedLocale) {
  const locale = requestedLocale ?? model.primaryLocale;
  const lines = [
    `# ${text(model.name, locale)}`,
    "",
    `model: ${model.id}@${model.version}`,
    `locale: ${locale}`,
    "",
    "## Vocabulary",
  ];

  for (const term of list(model.vocabulary)) {
    lines.push(`- [${term.kind}] ${term.id}: ${text(term.text, locale)}`);
  }

  lines.push("", "## Rules");
  for (const rule of list(model.rules)) {
    lines.push(`- [${rule.kind}] ${rule.id}: ${text(rule.text, locale)}`);
    for (const clause of list(rule.when)) {
      lines.push(`  - when: ${clauseExpr(clause)}`);
    }
    for (const clause of list(rule.must)) {
      lines.push(`  - must: ${clauseExpr(clause)}`);
    }
    for (const clause of list(rule.mustNot)) {
      lines.push(`  - mustNot: ${clauseExpr(clause)}`);
    }
    for (const exceptionId of list(rule.exceptions)) {
      lines.push(`  - except: ${exceptionId}`);
    }
  }

  appendDomainModelMarkdown(lines, model, locale);
  appendDomainRelationshipMarkdown(lines, model);

  const intent = intentPattern(model);
  if (intent) {
    const renderIntentContract = (label, contract) => {
      if (!contract) return;
      for (const field of list(contract.fields).slice().sort(byId)) {
        const details = [field.type, field.required !== false ? "required" : "optional"];
        if (field.minimum !== null && field.minimum !== undefined) details.push(`minimum ${field.minimum}`);
        if (field.maximum !== null && field.maximum !== undefined) details.push(`maximum ${field.maximum}`);
        if (list(field.allowedValues).length > 0) details.push(`allowed ${list(field.allowedValues).slice().sort().join("|")}`);
        if (field.pattern) details.push(`pattern ${field.pattern}`);
        lines.push(`- ${label} field: \`${field.id}\` (${details.join(", ")})`);
      }
      for (const clause of list(contract.clauses)) {
        lines.push(`- ${label} constraint: ${clauseExpr(clause)}`);
      }
    };
    lines.push("## Intent Model", "");
    for (const capability of intentCapabilities(intent).sort(byId)) {
      lines.push(`### Capability ${capability.id}`);
      lines.push("");
      lines.push(text(capability.text, locale));
      lines.push("");
      lines.push(`- kind: \`${capability.kind}\``);
      lines.push("");
    }
    for (const outcome of intentOutcomes(intent).sort(byId)) {
      lines.push(`### Outcome ${outcome.id}`);
      lines.push("");
      lines.push(text(outcome.text, locale));
      lines.push("");
      lines.push(`- state: \`${outcome.state}\``);
      renderIntentContract("output", outcome.outputContract);
      for (const effect of list(outcome.effects).slice().sort(byId)) {
        lines.push(`- effect: \`${effect.id}\` (${effect.required !== false ? "required" : "optional"}, capability \`${effect.capability}\`)`);
        if (effect.text) lines.push(`  - description: ${text(effect.text, locale)}`);
        renderIntentContract(`effect ${effect.id} output`, effect.outputContract);
      }
      lines.push("");
    }
    for (const process of intentProcesses(intent).sort(byId)) {
      lines.push(`### Process ${process.id}`);
      lines.push("");
      lines.push(text(process.text, locale));
      lines.push("");
      lines.push(`- input: \`${process.input}\``);
      renderIntentContract("input", process.inputContract);
      if (process.execution) {
        lines.push(`- execution maxInFlight: \`${process.execution.maxInFlight}\``);
        if (process.execution.idempotencyKey) lines.push(`- execution idempotency key: \`${process.execution.idempotencyKey}\``);
        if (process.execution.timeoutSteps !== null && process.execution.timeoutSteps !== undefined) {
          lines.push(`- execution timeout steps: \`${process.execution.timeoutSteps}\``);
        }
        if (process.execution.timeoutMs !== null && process.execution.timeoutMs !== undefined) {
          lines.push(`- execution timeout ms: \`${process.execution.timeoutMs}\``);
        }
      }
      for (const outcomeId of list(process.outcomes).sort()) {
        lines.push(`- outcome: \`${outcomeId}\``);
      }
      for (const capabilityId of list(process.requires).sort()) {
        lines.push(`- requires: \`${capabilityId}\``);
      }
      for (const capabilityId of list(process.effects).sort()) {
        lines.push(`- effects: \`${capabilityId}\``);
      }
      for (const outcomeId of list(process.constructs).sort()) {
        lines.push(`- constructs: \`${outcomeId}\``);
      }
      for (const transition of list(process.transitions).slice().sort((left, right) => `${left.from}\u0000${left.to}`.localeCompare(`${right.from}\u0000${right.to}`))) {
        lines.push(`- transition: \`${transition.from}\` -> \`${transition.to}\``);
      }
      for (const ref of list(process.implementedBy)) {
        const symbol = ref.symbol ? `#${ref.symbol}` : "";
        lines.push(`- implementation: ${ref.kind} ${ref.path}${symbol}`);
      }
      lines.push("");
    }
    for (const authority of constructionAuthorities(intent).sort(byId)) {
      lines.push(`### Construction Authority ${authority.id}`);
      lines.push("");
      if (authority.text) {
        lines.push(text(authority.text, locale));
        lines.push("");
      }
      lines.push(`- process: \`${authority.process}\``);
      lines.push(`- outcome: \`${authority.outcome}\``);
      lines.push("");
    }
    for (const policy of intentAccessPolicies(intent).sort(byId)) {
      lines.push(`### Access Policy ${policy.id}`);
      lines.push("");
      if (policy.text) {
        lines.push(text(policy.text, locale));
        lines.push("");
      }
      lines.push(`- process: \`${policy.process}\``);
      lines.push(`- subject: \`${policy.subject}\``);
      lines.push(`- decision: \`${policy.decision}\``);
      lines.push(`- priority: \`${policy.priority}\``);
      for (const overriddenId of list(policy.overrides).sort()) {
        lines.push(`- overrides: \`${overriddenId}\``);
      }
      lines.push("");
    }
    appendIntentGoalGraphMarkdown(lines, intent, locale);
    for (const binding of intentSemanticBindings(intent).sort(byId)) {
      lines.push(`### Semantic Binding ${binding.id}`);
      lines.push("");
      if (binding.text) {
        lines.push(text(binding.text, locale));
        lines.push("");
      }
      lines.push(`- process: \`${binding.process}\``);
      if (binding.refinement) lines.push(`- refinement: \`${binding.refinement}\``);
      for (const claimId of list(binding.claims).sort()) lines.push(`- claim: \`${claimId}\``);
      lines.push(`- kind: \`${binding.kind}\``);
      lines.push(`- target: \`${binding.target}\``);
      if (binding.value !== null && binding.value !== undefined) lines.push(`- value: \`${binding.value}\``);
      lines.push(`- required: \`${binding.required !== false}\``);
      lines.push("");
    }
    for (const scenario of intentScenarios(intent).sort(byId)) {
      lines.push(`### Scenario ${scenario.id}`);
      lines.push("");
      lines.push(text(scenario.text, locale));
      lines.push("");
      lines.push(`- kind: \`${scenario.kind}\``);
      lines.push(`- required: \`${scenario.required !== false}\``);
      lines.push(`- initialState: \`${scenario.initialState}\``);
      for (const [index, step] of list(scenario.steps).entries()) {
        lines.push(`- step[${index}]: \`${step.process}\` -> \`${step.outcome}\``);
      }
      lines.push(`- expectedState: \`${scenario.expectedState}\``);
      lines.push("");
    }
  }

  if (list(model.decisions).length > 0) {
    lines.push("", "## Decisions");
    for (const decision of list(model.decisions)) {
      lines.push(`- ${decision.date} ${decision.id}: ${text(decision.summary, locale)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function runtimeEvidenceRecordCount(model) {
  const runtime = runtimePattern(model);
  if (!runtime) return 0;
  return runtimeTelemetry(runtime).length
    + runtimeAlertPolicies(runtime).length
    + runtimeRunbookExecutions(runtime).length
    + runtimeDependencyTraces(runtime).length
    + runtimeIntentExecutions(runtime).length;
}

function markdownReviewSummary(model) {
  const assurance = assuranceSummary(model);
  return {
    approvedRules: activeApprovedRules(model).length,
    automatedCheckTargets: sortedRules(model).reduce((count, rule) => count + automatedCheckTargets(rule).length, 0),
    implementationRefs: sortedRules(model).reduce((count, rule) => count + list(rule.implementedBy).length, 0),
    projections: projections(model).length,
    domainElements: domainCoverageElements(model).length,
    runtimeEvidenceRecords: runtimeEvidenceRecordCount(model),
    assuranceTargets: assurance.targets.byKind,
  };
}

function emitMarkdown(model, requestedLocale) {
  const locale = requestedLocale ?? model.primaryLocale;
  const reviewSummary = markdownReviewSummary(model);
  const lines = [
    `# ${text(model.name, locale)}`,
    "",
    `- model: \`${model.id}\``,
    `- version: \`${model.version}\``,
    `- locale: \`${locale}\``,
    "",
    "## Review Summary",
    "",
    `- approvedRules: \`${reviewSummary.approvedRules}\``,
    `- automatedCheckTargets: \`${reviewSummary.automatedCheckTargets}\``,
    `- implementationRefs: \`${reviewSummary.implementationRefs}\``,
    `- projections: \`${reviewSummary.projections}\``,
    `- domainElements: \`${reviewSummary.domainElements}\``,
    `- runtimeEvidenceRecords: \`${reviewSummary.runtimeEvidenceRecords}\``,
    `- assuranceTargets: \`${CHECK_ASSURANCE_KINDS.map((kind) => `${kind}=${reviewSummary.assuranceTargets[kind]}`).join(", ")}\``,
    "",
  ];

  if (projections(model).length > 0) {
    lines.push("## Projections", "");
    for (const projection of projections(model).slice().sort(byId)) {
      lines.push(`### ${projection.id}`);
      lines.push("");
      lines.push(`- kind: \`${projection.kind}\``);
      lines.push(`- source: \`${projection.source}\``);
      lines.push(`- matrix: \`${projection.matrix}\``);
      lines.push(`- output: \`${projection.output}\``);
      lines.push(`- freshness: \`${projection.freshness}\``);
      lines.push("");
    }
  }

  lines.push("## Vocabulary", "");

  for (const term of sortedTerms(model)) {
    lines.push(`- \`${term.id}\` (${term.kind}): ${text(term.text, locale)}`);
  }

  lines.push("", "## Rules", "");
  for (const rule of sortedRules(model)) {
    lines.push(`### ${rule.id}`);
    lines.push("");
    lines.push(text(rule.text, locale));
    lines.push("");
    lines.push(`- kind: ${rule.kind}`);
    lines.push(`- status: ${rule.reviewStatus}`);
    lines.push(`- priority: ${rule.priority}`);
    lines.push(`- requiredAssurances: ${ruleRequiredAssurances(rule).join(", ")}`);
    for (const termId of list(rule.terms).sort()) {
      lines.push(`- term: \`${termId}\``);
    }
    for (const clause of list(rule.when)) {
      lines.push(`- when: \`${clauseExpr(clause)}\``);
    }
    for (const clause of list(rule.must)) {
      lines.push(`- must: \`${clauseExpr(clause)}\``);
    }
    for (const clause of list(rule.mustNot)) {
      lines.push(`- mustNot: \`${clauseExpr(clause)}\``);
    }
    for (const target of list(rule.checks)) {
      lines.push(`- check: ${target.backend} ${target.ref} [${checkTargetAssurances(target).join(", ")}]`);
      for (const kind of CHECK_ASSURANCE_KINDS) {
        const evidenceRef = target.assuranceEvidence?.[kind];
        if (evidenceRef) lines.push(`- assuranceEvidence: ${kind} -> ${evidenceRef}`);
      }
    }
    for (const ref of list(rule.implementedBy)) {
      const symbol = ref.symbol ? `#${ref.symbol}` : "";
      lines.push(`- implementation: ${ref.kind} ${ref.path}${symbol}`);
    }
    if (rule.rationale) {
      lines.push(`- rationale: ${rule.rationale}`);
    }
    lines.push("", "#### Review", "");
    lines.push(`- source: ${ruleSource(rule, ruleIndex(model, rule)).path}`);
    lines.push(`- coverage: ${rule.coverage}`);
    lines.push(`- automatedChecks: ${automatedCheckTargets(rule).length}`);
    lines.push(`- implementationRefs: ${list(rule.implementedBy).length}`);
    for (const selector of ruleClauseSelectors(rule)) {
      lines.push(`- selector: ${rule.id}.${selector}`);
    }
    for (const target of list(rule.checks)) {
      const covers = list(target.covers);
      if (covers.length > 0) {
        lines.push(`- covers: ${target.backend} ${target.ref} -> ${covers.join(", ")}`);
      }
    }
    lines.push("");
  }

  appendDomainModelMarkdown(lines, model, locale);
  appendDomainRelationshipMarkdown(lines, model);

  const db = dbPattern(model);
  if (db) {
    lines.push("## Database Model", "");
    for (const table of dbTables(db).sort(byId)) {
      lines.push(`### Table ${table.id}`);
      lines.push("");
      if (table.text) {
        lines.push(text(table.text, locale));
        lines.push("");
      }
      for (const column of list(table.columns).sort(byId)) {
        const nullable = column.nullable ? " nullable" : "";
        const unique = column.unique ? " unique" : "";
        const references = column.references ? ` references \`${column.references}\`` : "";
        lines.push(`- column: \`${column.id}\` ${column.type}${nullable}${unique}${references}`);
      }
      for (const columnId of list(table.primaryKey)) {
        lines.push(`- primaryKey: \`${columnId}\``);
      }
      if (table.tenantColumn) {
        lines.push(`- tenantColumn: \`${table.tenantColumn}\``);
      }
      lines.push("");
    }
    for (const invariant of dbInvariants(db).sort(byId)) {
      lines.push(`### DB Invariant ${invariant.id}`);
      lines.push("");
      lines.push(text(invariant.text, locale));
      lines.push("");
      lines.push(`- expr: \`${invariant.expr}\``);
      for (const tableId of list(invariant.tables).sort()) {
        lines.push(`- table: \`${tableId}\``);
      }
      lines.push("");
    }
    for (const transaction of dbTransactions(db).sort(byId)) {
      lines.push(`### Transaction ${transaction.id}`);
      lines.push("");
      lines.push(text(transaction.text, locale));
      lines.push("");
      for (const tableId of list(transaction.reads).sort()) {
        lines.push(`- reads: \`${tableId}\``);
      }
      for (const tableId of list(transaction.writes).sort()) {
        lines.push(`- writes: \`${tableId}\``);
      }
      for (const invariantId of list(transaction.preserves).sort()) {
        lines.push(`- preserves: \`${invariantId}\``);
      }
      if (transaction.idempotencyKey) {
        lines.push(`- idempotencyKey: \`${transaction.idempotencyKey}\``);
      }
      lines.push("");
    }
    for (const migration of dbMigrations(db).sort(byId)) {
      lines.push(`### Migration ${migration.id}`);
      lines.push("");
      lines.push(text(migration.text, locale));
      lines.push("");
      for (const tableId of list(migration.fromTables).sort()) {
        lines.push(`- from: \`${tableId}\``);
      }
      for (const tableId of list(migration.toTables).sort()) {
        lines.push(`- to: \`${tableId}\``);
      }
      for (const invariantId of list(migration.preserves).sort()) {
        lines.push(`- preserves: \`${invariantId}\``);
      }
      for (const mapping of list(migration.mappings).sort(byId)) {
        const mappingText = mapping.text ? ` ${text(mapping.text, locale)}` : "";
        lines.push(`- mapping: \`${mapping.id}\`${mappingText}`);
        lines.push(`  - source: \`${mapping.sourceExpr}\``);
        lines.push(`  - target: \`${mapping.targetExpr}\``);
        for (const invariantId of list(mapping.invariants).sort()) {
          lines.push(`  - invariant: \`${invariantId}\``);
        }
      }
      lines.push("");
    }
  }

  const cloud = cloudPattern(model);
  if (cloud) {
    lines.push("## Cloud Topology", "");
    for (const zone of cloudZones(cloud).sort(byId)) {
      lines.push(`### Cloud Zone ${zone.id}`);
      lines.push("");
      if (zone.text) {
        lines.push(text(zone.text, locale));
        lines.push("");
      }
      lines.push(`- exposure: \`${zone.exposure}\``);
      lines.push("");
    }
    for (const node of cloudNodes(cloud).sort(byId)) {
      lines.push(`### Cloud Node ${node.id}`);
      lines.push("");
      if (node.text) {
        lines.push(text(node.text, locale));
        lines.push("");
      }
      lines.push(`- kind: \`${node.kind}\``);
      lines.push(`- zone: \`${node.zone}\``);
      lines.push(`- tenantScoped: \`${Boolean(node.tenantScoped)}\``);
      lines.push("");
    }
    for (const flow of cloudFlows(cloud).sort(byId)) {
      lines.push(`### Cloud Flow ${flow.id}`);
      lines.push("");
      if (flow.text) {
        lines.push(text(flow.text, locale));
        lines.push("");
      }
      lines.push(`- from: \`${flow.from}\``);
      lines.push(`- to: \`${flow.to}\``);
      lines.push(`- action: \`${flow.action}\``);
      lines.push(`- tenantPropagated: \`${Boolean(flow.tenantPropagated)}\``);
      if (flow.idempotencyKey) {
        lines.push(`- idempotencyKey: \`${flow.idempotencyKey}\``);
      }
      lines.push("");
    }
    for (const policy of cloudPolicies(cloud).sort(byId)) {
      lines.push(`### Cloud Policy ${policy.id}`);
      lines.push("");
      lines.push(`- principal: \`${policy.principal}\``);
      lines.push(`- resource: \`${policy.resource}\``);
      for (const action of list(policy.actions).sort()) {
        lines.push(`- action: \`${action}\``);
      }
      lines.push("");
    }
  }

  const data = dataPattern(model);
  if (data) {
    lines.push("## Data Governance", "");
    for (const policy of dataPolicies(data).sort(byId)) {
      lines.push(`### Data Policy ${policy.id}`);
      lines.push("");
      lines.push(`- classification: \`${policy.classification}\``);
      if (policy.maxRetentionDays !== null && policy.maxRetentionDays !== undefined) {
        lines.push(`- maxRetentionDays: \`${policy.maxRetentionDays}\``);
      }
      lines.push("");
    }
    for (const dataset of dataSets(data).sort(byId)) {
      lines.push(`### Data Set ${dataset.id}`);
      lines.push("");
      if (dataset.text) {
        lines.push(text(dataset.text, locale));
        lines.push("");
      }
      lines.push(`- classification: \`${dataset.classification}\``);
      if (dataset.residency) {
        lines.push(`- residency: \`${dataset.residency}\``);
      }
      if (dataset.retentionDays !== null && dataset.retentionDays !== undefined) {
        lines.push(`- retentionDays: \`${dataset.retentionDays}\``);
      }
      lines.push("");
    }
    for (const store of dataStores(data).sort(byId)) {
      lines.push(`### Data Store ${store.id}`);
      lines.push("");
      if (store.text) {
        lines.push(text(store.text, locale));
        lines.push("");
      }
      lines.push(`- region: \`${store.region}\``);
      lines.push(`- encrypted: \`${Boolean(store.encrypted)}\``);
      lines.push(`- deletionSupported: \`${Boolean(store.deletionSupported)}\``);
      lines.push("");
    }
    for (const placement of dataPlacements(data).sort(byId)) {
      lines.push(`### Data Placement ${placement.id}`);
      lines.push("");
      lines.push(`- dataset: \`${placement.dataset}\``);
      lines.push(`- store: \`${placement.store}\``);
      lines.push("");
    }
    for (const flow of dataFlows(data).sort(byId)) {
      lines.push(`### Data Flow ${flow.id}`);
      lines.push("");
      lines.push(`- dataset: \`${flow.dataset}\``);
      lines.push(`- from: \`${flow.from}\``);
      lines.push(`- to: \`${flow.to}\``);
      lines.push(`- purpose: \`${flow.purpose}\``);
      if (flow.legalBasis) {
        lines.push(`- legalBasis: \`${flow.legalBasis}\``);
      }
      lines.push("");
    }
  }

  const release = releasePattern(model);
  if (release) {
    lines.push("## Release Safety", "");
    for (const service of releaseServices(release).sort(byId)) {
      lines.push(`### Release Service ${service.id}`);
      lines.push("");
      if (service.text) {
        lines.push(text(service.text, locale));
        lines.push("");
      }
      lines.push(`- critical: \`${Boolean(service.critical)}\``);
      lines.push("");
    }
    for (const environment of releaseEnvironments(release).sort(byId)) {
      lines.push(`### Release Environment ${environment.id}`);
      lines.push("");
      if (environment.text) {
        lines.push(text(environment.text, locale));
        lines.push("");
      }
      lines.push(`- production: \`${Boolean(environment.production)}\``);
      lines.push("");
    }
    for (const gate of releaseGates(release).sort(byId)) {
      lines.push(`### Release Gate ${gate.id}`);
      lines.push("");
      if (gate.text) {
        lines.push(text(gate.text, locale));
        lines.push("");
      }
      lines.push(`- kind: \`${gate.kind}\``);
      lines.push("");
    }
    for (const rollback of releaseRollbacks(release).sort(byId)) {
      lines.push(`### Release Rollback ${rollback.id}`);
      lines.push("");
      if (rollback.text) {
        lines.push(text(rollback.text, locale));
        lines.push("");
      }
      lines.push(`- service: \`${rollback.service}\``);
      lines.push(`- tested: \`${Boolean(rollback.tested)}\``);
      lines.push("");
    }
    for (const migration of releaseMigrations(release).sort(byId)) {
      lines.push(`### Release Migration ${migration.id}`);
      lines.push("");
      if (migration.text) {
        lines.push(text(migration.text, locale));
        lines.push("");
      }
      lines.push(`- service: \`${migration.service}\``);
      lines.push(`- backwardsCompatible: \`${Boolean(migration.backwardsCompatible)}\``);
      lines.push("");
    }
    for (const step of releaseSteps(release).sort(byId)) {
      lines.push(`### Release Step ${step.id}`);
      lines.push("");
      if (step.text) {
        lines.push(text(step.text, locale));
        lines.push("");
      }
      lines.push(`- service: \`${step.service}\``);
      lines.push(`- environment: \`${step.environment}\``);
      lines.push(`- strategy: \`${step.strategy}\``);
      lines.push(`- trafficPercent: \`${step.trafficPercent}\``);
      if (step.rollback) {
        lines.push(`- rollback: \`${step.rollback}\``);
      }
      if (step.migration) {
        lines.push(`- migration: \`${step.migration}\``);
      }
      for (const gateId of list(step.gates).sort()) {
        lines.push(`- gate: \`${gateId}\``);
      }
      lines.push("");
    }
  }

  const runtime = runtimePattern(model);
  if (runtime) {
    lines.push("## Runtime Safety", "");
    for (const service of runtimeServices(runtime).sort(byId)) {
      lines.push(`### Runtime Service ${service.id}`);
      lines.push("");
      if (service.text) {
        lines.push(text(service.text, locale));
        lines.push("");
      }
      lines.push(`- critical: \`${Boolean(service.critical)}\``);
      lines.push("");
    }
    for (const dependency of runtimeDependencies(runtime).sort(byId)) {
      lines.push(`### Runtime Dependency ${dependency.id}`);
      lines.push("");
      if (dependency.text) {
        lines.push(text(dependency.text, locale));
        lines.push("");
      }
      lines.push(`- service: \`${dependency.service}\``);
      lines.push(`- target: \`${dependency.target}\``);
      lines.push(`- kind: \`${dependency.kind}\``);
      if (dependency.timeoutMs !== null && dependency.timeoutMs !== undefined) {
        lines.push(`- timeoutMs: \`${dependency.timeoutMs}\``);
      }
      lines.push(`- retryable: \`${Boolean(dependency.retryable)}\``);
      lines.push(`- idempotent: \`${Boolean(dependency.idempotent)}\``);
      lines.push("");
    }
    for (const signal of runtimeSignals(runtime).sort(byId)) {
      lines.push(`### Runtime Signal ${signal.id}`);
      lines.push("");
      if (signal.text) {
        lines.push(text(signal.text, locale));
        lines.push("");
      }
      lines.push(`- service: \`${signal.service}\``);
      lines.push(`- kind: \`${signal.kind}\``);
      lines.push(`- indicator: \`${signal.indicator}\``);
      lines.push("");
    }
    for (const runbook of runtimeRunbooks(runtime).sort(byId)) {
      lines.push(`### Runtime Runbook ${runbook.id}`);
      lines.push("");
      if (runbook.text) {
        lines.push(text(runbook.text, locale));
        lines.push("");
      }
      lines.push(`- service: \`${runbook.service}\``);
      lines.push(`- tested: \`${Boolean(runbook.tested)}\``);
      lines.push("");
    }
    for (const alert of runtimeAlerts(runtime).sort(byId)) {
      lines.push(`### Runtime Alert ${alert.id}`);
      lines.push("");
      if (alert.text) {
        lines.push(text(alert.text, locale));
        lines.push("");
      }
      lines.push(`- service: \`${alert.service}\``);
      lines.push(`- signal: \`${alert.signal}\``);
      lines.push(`- severity: \`${alert.severity}\``);
      if (alert.runbook) {
        lines.push(`- runbook: \`${alert.runbook}\``);
      }
      lines.push("");
    }
    for (const slo of runtimeSlos(runtime).sort(byId)) {
      lines.push(`### Runtime SLO ${slo.id}`);
      lines.push("");
      if (slo.text) {
        lines.push(text(slo.text, locale));
        lines.push("");
      }
      lines.push(`- service: \`${slo.service}\``);
      lines.push(`- indicator: \`${slo.indicator}\``);
      lines.push(`- targetPercent: \`${slo.targetPercent}\``);
      if (slo.window) {
        lines.push(`- window: \`${slo.window}\``);
      }
      lines.push("");
    }
    for (const window of runtimeTelemetry(runtime).sort(byId)) {
      lines.push(`### Runtime Telemetry ${window.id}`);
      lines.push("");
      if (window.text) {
        lines.push(text(window.text, locale));
        lines.push("");
      }
      lines.push(`- service: \`${window.service}\``);
      lines.push(`- signal: \`${window.signal}\``);
      if (window.slo) {
        lines.push(`- slo: \`${window.slo}\``);
      }
      if (window.observedPercent !== null && window.observedPercent !== undefined) {
        lines.push(`- observedPercent: \`${window.observedPercent}\``);
      }
      if (window.source) {
        lines.push(`- source: \`${window.source}\``);
      }
      lines.push("");
    }
    for (const policy of runtimeAlertPolicies(runtime).sort(byId)) {
      lines.push(`### Runtime Alert Policy ${policy.id}`);
      lines.push("");
      if (policy.text) {
        lines.push(text(policy.text, locale));
        lines.push("");
      }
      lines.push(`- alert: \`${policy.alert}\``);
      lines.push(`- enabled: \`${Boolean(policy.enabled)}\``);
      if (policy.source) {
        lines.push(`- source: \`${policy.source}\``);
      }
      lines.push("");
    }
    for (const execution of runtimeRunbookExecutions(runtime).sort(byId)) {
      lines.push(`### Runtime Runbook Execution ${execution.id}`);
      lines.push("");
      if (execution.text) {
        lines.push(text(execution.text, locale));
        lines.push("");
      }
      lines.push(`- runbook: \`${execution.runbook}\``);
      lines.push(`- status: \`${execution.status}\``);
      if (execution.executedAt) {
        lines.push(`- executedAt: \`${execution.executedAt}\``);
      }
      if (execution.source) {
        lines.push(`- source: \`${execution.source}\``);
      }
      lines.push("");
    }
    for (const trace of runtimeDependencyTraces(runtime).sort(byId)) {
      lines.push(`### Runtime Dependency Trace ${trace.id}`);
      lines.push("");
      if (trace.text) {
        lines.push(text(trace.text, locale));
        lines.push("");
      }
      lines.push(`- dependency: \`${trace.dependency}\``);
      if (trace.observedLatencyMs !== null && trace.observedLatencyMs !== undefined) {
        lines.push(`- observedLatencyMs: \`${trace.observedLatencyMs}\``);
      }
      lines.push(`- timedOut: \`${Boolean(trace.timedOut)}\``);
      lines.push(`- idempotencyKeyObserved: \`${Boolean(trace.idempotencyKeyObserved)}\``);
      if (trace.source) {
        lines.push(`- source: \`${trace.source}\``);
      }
      lines.push("");
    }
    for (const execution of runtimeIntentExecutions(runtime).sort(byId)) {
      lines.push(`### Runtime Intent Execution ${execution.id}`);
      lines.push("");
      if (execution.text) {
        lines.push(text(execution.text, locale));
        lines.push("");
      }
      lines.push(`- process: \`${execution.process}\``);
      lines.push(`- refinement: \`${execution.refinement}\``);
      if (execution.observedLatencyMs !== null && execution.observedLatencyMs !== undefined) {
        lines.push(`- observedLatencyMs: \`${execution.observedLatencyMs}\``);
      }
      if (execution.maxInFlightObserved !== null && execution.maxInFlightObserved !== undefined) {
        lines.push(`- maxInFlightObserved: \`${execution.maxInFlightObserved}\``);
      }
      lines.push(`- timedOut: \`${Boolean(execution.timedOut)}\``);
      lines.push(`- idempotencyKeyObserved: \`${Boolean(execution.idempotencyKeyObserved)}\``);
      lines.push(`- duplicateSuppressed: \`${Boolean(execution.duplicateSuppressed)}\``);
      if (execution.source) lines.push(`- source: \`${execution.source}\``);
      lines.push("");
    }
  }

  const intent = intentPattern(model);
  if (intent) {
    const renderIntentContract = (label, contract) => {
      if (!contract) return;
      for (const field of list(contract.fields).slice().sort(byId)) {
        const details = [field.type, field.required !== false ? "required" : "optional"];
        if (field.minimum !== null && field.minimum !== undefined) details.push(`minimum ${field.minimum}`);
        if (field.maximum !== null && field.maximum !== undefined) details.push(`maximum ${field.maximum}`);
        if (list(field.allowedValues).length > 0) details.push(`allowed ${list(field.allowedValues).slice().sort().join("|")}`);
        if (field.pattern) details.push(`pattern ${field.pattern}`);
        lines.push(`- ${label} field: \`${field.id}\` (${details.join(", ")})`);
      }
      for (const clause of list(contract.clauses)) {
        lines.push(`- ${label} constraint: ${clauseExpr(clause)}`);
      }
    };
    lines.push("## Intent Model", "");
    for (const capability of intentCapabilities(intent).sort(byId)) {
      lines.push(`### Capability ${capability.id}`);
      lines.push("");
      lines.push(text(capability.text, locale));
      lines.push("");
      lines.push(`- kind: \`${capability.kind}\``);
      lines.push("");
    }
    for (const outcome of intentOutcomes(intent).sort(byId)) {
      lines.push(`### Outcome ${outcome.id}`);
      lines.push("");
      lines.push(text(outcome.text, locale));
      lines.push("");
      lines.push(`- state: \`${outcome.state}\``);
      renderIntentContract("output", outcome.outputContract);
      for (const effect of list(outcome.effects).slice().sort(byId)) {
        lines.push(`- effect: \`${effect.id}\` (${effect.required !== false ? "required" : "optional"}, capability \`${effect.capability}\`)`);
        if (effect.text) lines.push(`  - description: ${text(effect.text, locale)}`);
        renderIntentContract(`effect ${effect.id} output`, effect.outputContract);
      }
      lines.push("");
    }
    for (const process of intentProcesses(intent).sort(byId)) {
      lines.push(`### Process ${process.id}`);
      lines.push("");
      lines.push(text(process.text, locale));
      lines.push("");
      lines.push(`- input: \`${process.input}\``);
      renderIntentContract("input", process.inputContract);
      if (process.execution) {
        lines.push(`- execution maxInFlight: \`${process.execution.maxInFlight}\``);
        if (process.execution.idempotencyKey) lines.push(`- execution idempotency key: \`${process.execution.idempotencyKey}\``);
        if (process.execution.timeoutSteps !== null && process.execution.timeoutSteps !== undefined) {
          lines.push(`- execution timeout steps: \`${process.execution.timeoutSteps}\``);
        }
        if (process.execution.timeoutMs !== null && process.execution.timeoutMs !== undefined) {
          lines.push(`- execution timeout ms: \`${process.execution.timeoutMs}\``);
        }
      }
      for (const outcomeId of list(process.outcomes).sort()) {
        lines.push(`- outcome: \`${outcomeId}\``);
      }
      for (const capabilityId of list(process.requires).sort()) {
        lines.push(`- requires: \`${capabilityId}\``);
      }
      for (const capabilityId of list(process.effects).sort()) {
        lines.push(`- effects: \`${capabilityId}\``);
      }
      for (const outcomeId of list(process.constructs).sort()) {
        lines.push(`- constructs: \`${outcomeId}\``);
      }
      for (const transition of list(process.transitions).slice().sort((left, right) => `${left.from}\u0000${left.to}`.localeCompare(`${right.from}\u0000${right.to}`))) {
        lines.push(`- transition: \`${transition.from}\` -> \`${transition.to}\``);
      }
      for (const refinement of intentRefinements(process).slice().sort(byId)) {
        const symbol = refinement.implementation.symbol ? `#${refinement.implementation.symbol}` : "";
        lines.push(`- refinement: \`${refinement.id}\` (${refinement.kind})`);
        lines.push(`  - implementation: ${refinement.implementation.kind} ${refinement.implementation.path}${symbol}`);
        if (refinement.http) {
          lines.push(`  - http: ${refinement.http.method} ${refinement.http.path} (expected status ${refinement.http.expectedStatus})`);
        }
        if (refinement.transaction) {
          lines.push(`  - transaction: \`${refinement.transaction.dbTransaction}\` (isolation ${refinement.transaction.isolation})`);
        }
        for (const binding of list(refinement.inputBindings).slice().sort((left, right) => left.contractField.localeCompare(right.contractField))) {
          lines.push(`  - input binding: \`${binding.contractField}\` -> \`${binding.implementationField}\``);
        }
        for (const output of list(refinement.outcomeBindings).slice().sort((left, right) => left.outcome.localeCompare(right.outcome))) {
          for (const binding of list(output.fields).slice().sort((left, right) => left.contractField.localeCompare(right.contractField))) {
            lines.push(`  - output binding ${output.outcome}: \`${binding.contractField}\` -> \`${binding.implementationField}\``);
          }
          for (const effect of list(output.effectBindings).slice().sort((left, right) => left.effect.localeCompare(right.effect))) {
            for (const binding of list(effect.fields).slice().sort((left, right) => left.contractField.localeCompare(right.contractField))) {
              lines.push(`  - effect binding ${output.outcome}/${effect.effect}: \`${binding.contractField}\` -> \`${binding.implementationField}\``);
            }
          }
        }
      }
      lines.push("");
    }
    for (const authority of constructionAuthorities(intent).sort(byId)) {
      lines.push(`### Construction Authority ${authority.id}`);
      lines.push("");
      if (authority.text) {
        lines.push(text(authority.text, locale));
        lines.push("");
      }
      lines.push(`- process: \`${authority.process}\``);
      lines.push(`- outcome: \`${authority.outcome}\``);
      lines.push("");
    }
    for (const policy of intentAccessPolicies(intent).sort(byId)) {
      lines.push(`### Access Policy ${policy.id}`);
      lines.push("");
      if (policy.text) {
        lines.push(text(policy.text, locale));
        lines.push("");
      }
      lines.push(`- process: \`${policy.process}\``);
      lines.push(`- subject: \`${policy.subject}\``);
      lines.push(`- decision: \`${policy.decision}\``);
      lines.push(`- priority: \`${policy.priority}\``);
      for (const overriddenId of list(policy.overrides).sort()) {
        lines.push(`- overrides: \`${overriddenId}\``);
      }
      lines.push("");
    }
    appendIntentGoalGraphMarkdown(lines, intent, locale);
    for (const binding of intentSemanticBindings(intent).sort(byId)) {
      lines.push(`### Semantic Binding ${binding.id}`);
      lines.push("");
      if (binding.text) {
        lines.push(text(binding.text, locale));
        lines.push("");
      }
      lines.push(`- process: \`${binding.process}\``);
      if (binding.refinement) lines.push(`- refinement: \`${binding.refinement}\``);
      for (const claimId of list(binding.claims).sort()) lines.push(`- claim: \`${claimId}\``);
      lines.push(`- kind: \`${binding.kind}\``);
      lines.push(`- target: \`${binding.target}\``);
      if (binding.value !== null && binding.value !== undefined) lines.push(`- value: \`${binding.value}\``);
      lines.push(`- required: \`${binding.required !== false}\``);
      lines.push("");
    }
    for (const scenario of intentScenarios(intent).sort(byId)) {
      lines.push(`### Scenario ${scenario.id}`);
      lines.push("");
      lines.push(text(scenario.text, locale));
      lines.push("");
      lines.push(`- kind: \`${scenario.kind}\``);
      lines.push(`- required: \`${scenario.required !== false}\``);
      lines.push(`- initialState: \`${scenario.initialState}\``);
      for (const [index, step] of list(scenario.steps).entries()) {
        lines.push(`- step[${index}]: \`${step.process}\` -> \`${step.outcome}\``);
      }
      lines.push(`- expectedState: \`${scenario.expectedState}\``);
      lines.push("");
    }
  }

  lines.push("## Decisions", "");
  for (const decision of sortedDecisions(model)) {
    lines.push(`### ${decision.id}`);
    lines.push("");
    lines.push(`- date: ${decision.date}`);
    lines.push(`- summary: ${text(decision.summary, locale)}`);
    if (decision.rationale) {
      lines.push(`- rationale: ${decision.rationale}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function normalizedGeneratedPath(path) {
  return path.replaceAll("\\", "/");
}

function walkGeneratedFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkGeneratedFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function projectionPathMatcher(projection) {
  if (projection.matrix === "single") {
    return new RegExp(`^${escapeRegex(projection.output)}$`);
  }
  const [prefix, suffix] = projection.output.split("{locale}");
  return new RegExp(`^${escapeRegex(prefix)}([^/]+)${escapeRegex(suffix)}$`);
}

function projectionScanRoot(root, projection) {
  const prefix = projection.output.split("{locale}")[0];
  const slash = prefix.lastIndexOf("/");
  const relativeRoot = slash === -1 ? "." : prefix.slice(0, slash) || ".";
  return resolve(root, relativeRoot);
}

function projectionActualPaths(root, projection) {
  const matcher = projectionPathMatcher(projection);
  return walkGeneratedFiles(projectionScanRoot(root, projection))
    .map((path) => normalizedGeneratedPath(relative(resolve(root), path)))
    .filter((path) => matcher.test(path))
    .sort();
}

function projectionSnapshot(model) {
  return createProjectionSnapshot(model, {
    renderProjection(sourceModel, projection, locale) {
      switch (projection.kind) {
        case "markdown": return emitMarkdown(sourceModel, locale);
        case "quickcheck": return emitQuickcheck(sourceModel);
        case "lean": return emitLean(sourceModel);
        case "alloy": return emitAlloy(sourceModel);
        case "quint": return renderQuintModel(sourceModel);
        case "source-map": return emitSourceMap(sourceModel, sourceModel.primaryLocale);
        case "generated-manifest": return emitGeneratedManifest(sourceModel, sourceModel.primaryLocale);
        default: throw new Error(`unsupported projection renderer: ${projection.kind}`);
      }
    },
  });
}

function projectionObservations(snapshot, { root = process.cwd() } = {}) {
  const observations = [];
  for (const projection of snapshot.projections) {
    const expected = new Set(projection.artifacts.map((artifact) => artifact.path));
    const matcher = projectionPathMatcher(projection);
    for (const path of projectionActualPaths(root, projection)) {
      const matched = matcher.exec(path);
      observations.push({
        content: readFileSync(resolve(root, path), "utf8"),
        kind: "artifact",
        locale: projection.matrix === "locales" ? matched?.[1] ?? null : null,
        path,
        projectionId: projection.id,
        unexpected: !expected.has(path),
      });
    }
    if (existsSync(resolve(root, projection.provenancePath))) {
      observations.push({
        content: readFileSync(resolve(root, projection.provenancePath), "utf8"),
        kind: "provenance",
        path: projection.provenancePath,
        projectionId: projection.id,
      });
    }
  }
  return observations;
}

function projectionChangePlan(model, { generatedAt = new Date().toISOString(), root = process.cwd() } = {}) {
  const snapshot = projectionSnapshot(model);
  return planProjectionChanges(snapshot, projectionObservations(snapshot, { root }), { generatedAt });
}

function generatedProjectionReport(model, { generatedAt = new Date().toISOString(), root = process.cwd() } = {}) {
  const validationErrors = validate(model);
  if (validationErrors.length > 0) {
    return {
      model: modelReport(model),
      status: "fail",
      summary: {
        projections: projections(model).length,
        artifacts: 0,
        missing: 0,
        stale: 0,
        unexpected: 0,
        provenance: 0,
        provenanceMissing: 0,
        provenanceStale: 0,
      },
      projections: [],
      errors: validationErrors,
    };
  }

  const plan = projectionChangePlan(model, { generatedAt, root });
  const errors = [];
  let missing = 0;
  let stale = 0;
  let unexpected = 0;
  let provenanceMissing = 0;
  let provenanceStale = 0;
  const projectionReports = plan.projections.map((projection) => {
    const projectionActions = plan.actions.filter((action) => action.projectionId === projection.id);
    const artifactActions = projectionActions.filter((action) => action.kind === "artifact");
    const artifacts = projection.artifacts.map((artifact) => {
      const action = artifactActions.find((candidate) => candidate.path === artifact.path);
      if (action.action === "create") {
        missing += 1;
        errors.push(`missing generated artifact: ${projection.id} -> ${artifact.path}`);
        return { bytes: artifact.bytes, digest: artifact.digest, locale: artifact.locale, path: artifact.path, status: "missing" };
      }
      if (action.action === "update") {
        stale += 1;
        errors.push(`stale generated artifact: ${projection.id} -> ${artifact.path}`);
        return { bytes: artifact.bytes, digest: artifact.digest, locale: artifact.locale, path: artifact.path, status: "stale" };
      }
      return { bytes: artifact.bytes, digest: artifact.digest, locale: artifact.locale, path: artifact.path, status: "current" };
    });
    const unexpectedPaths = artifactActions.filter((action) => action.action === "remove").map((action) => action.path);
    for (const path of unexpectedPaths) {
      unexpected += 1;
      errors.push(`unexpected generated artifact: ${projection.id} -> ${path}`);
    }
    const provenanceAction = projectionActions.find((action) => action.kind === "provenance");
    const provenanceDocument = provenanceAction.desiredContent ? JSON.parse(provenanceAction.desiredContent) : null;
    let provenanceStatus = "current";
    if (provenanceAction.action === "create") {
      provenanceStatus = "missing";
      provenanceMissing += 1;
      errors.push(`missing projection provenance: ${projection.id} -> ${projection.provenancePath}`);
    } else if (provenanceAction.action === "update") {
      provenanceStatus = "stale";
      provenanceStale += 1;
      errors.push(`stale projection provenance: ${projection.id} -> ${projection.provenancePath}`);
    }
    return {
      id: projection.id,
      kind: projection.kind,
      source: projection.source,
      matrix: projection.matrix,
      output: projection.output,
      provenance: {
        digest: provenanceAction.afterDigest,
        generatedAt: provenanceDocument?.generatedAt ?? null,
        path: projection.provenancePath,
        schemaVersion: provenanceDocument?.schemaVersion ?? null,
        status: provenanceStatus,
      },
      freshness: projection.freshness,
      artifacts,
      unexpected: unexpectedPaths,
    };
  });

  return {
    model: modelReport(model),
    status: reportStatus(errors),
    summary: {
      projections: projectionReports.length,
      artifacts: projectionReports.reduce((count, projection) => count + projection.artifacts.length, 0),
      missing,
      stale,
      unexpected,
      provenance: projectionReports.length,
      provenanceMissing,
      provenanceStale,
    },
    projections: projectionReports,
    errors,
  };
}

function pruneEmptyGeneratedDirectories(root) {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyGeneratedDirectories(join(root, entry.name));
  }
  if (readdirSync(root).length === 0) rmSync(root, { recursive: true });
}

function generateProjectionArtifacts(
  model,
  {
    dryRun = false,
    generatedAt = new Date().toISOString(),
    root = process.cwd(),
  } = {},
) {
  const validationErrors = validate(model);
  if (validationErrors.length > 0) {
    return {
      changed: 0,
      dryRun,
      emitter: null,
      errors: validationErrors,
      model: modelReport(model),
      plan: [],
      projections: [],
      provenance: [],
      status: "fail",
      summary: { projections: projections(model).length, artifacts: 0, changed: 0, actions: { create: 0, remove: 0, unchanged: 0, update: 0 } },
      transaction: { status: dryRun ? "preview" : "not-started", writes: 0, removes: 0 },
    };
  }

  const plan = projectionChangePlan(model, { generatedAt, root });
  const projected = projectionPlanReport(plan);
  const transaction = dryRun
    ? {
        status: "preview",
        writes: plan.actions.filter((action) => ["create", "update"].includes(action.action)).length,
        removes: plan.actions.filter((action) => action.action === "remove").length,
      }
    : applyProjectionTransaction(plan.actions, { root });

  if (!dryRun) {
    for (const projection of plan.projections) {
      const scanRoot = projectionScanRoot(root, projection);
      if (!existsSync(scanRoot)) continue;
      for (const entry of readdirSync(scanRoot, { withFileTypes: true })) {
        if (entry.isDirectory()) pruneEmptyGeneratedDirectories(join(scanRoot, entry.name));
      }
    }
  }

  const verification = dryRun ? { status: "pass", errors: [] } : generatedProjectionReport(model, { generatedAt, root });
  return {
    changed: plan.summary.changed,
    dryRun,
    emitter: projected.emitter,
    errors: verification.errors,
    model: modelReport(model),
    plan: projected.actions,
    projections: projected.projections,
    provenance: projected.provenance,
    status: verification.status,
    summary: projected.summary,
    transaction,
  };
}

function renderGeneratedProjectionReport(report, action) {
  if (report.status === "fail") return `${report.errors.join("\n")}\n`;
  if (action === "generate") {
    if (report.dryRun) {
      return `ok: ${report.model.id} generation plan (${report.changed} changes, no files written)\n`;
    }
    const projectionLabel = report.summary.projections === 1 ? "projection" : "projections";
    return `ok: ${report.model.id} generated ${report.summary.artifacts} artifacts from ${report.summary.projections} ${projectionLabel} (${report.changed} changed)\n`;
  }
  return `ok: ${report.model.id} generated artifacts (${report.summary.artifacts} current)\n`;
}

function dbProjection(model) {
  const db = dbPattern(model);
  if (!db) {
    return {
      tables: [],
      invariants: [],
      transactions: [],
      migrations: [],
    };
  }
  return {
    tables: dbTables(db)
      .slice()
      .sort(byId)
      .map((table) => ({
        id: table.id,
        columns: list(table.columns)
          .slice()
          .sort(byId)
          .map((column) => ({
            id: column.id,
            type: column.type,
            nullable: Boolean(column.nullable),
            unique: Boolean(column.unique),
            references: column.references ?? null,
          })),
        primaryKey: list(table.primaryKey),
        tenantColumn: table.tenantColumn ?? null,
      })),
    invariants: dbInvariants(db)
      .slice()
      .sort(byId)
      .map((invariant) => ({
        id: invariant.id,
        expr: invariant.expr,
        tables: list(invariant.tables).slice().sort(),
      })),
    transactions: dbTransactions(db)
      .slice()
      .sort(byId)
      .map((transaction) => ({
        id: transaction.id,
        reads: list(transaction.reads).slice().sort(),
        writes: list(transaction.writes).slice().sort(),
        preserves: list(transaction.preserves).slice().sort(),
        idempotencyKey: transaction.idempotencyKey ?? null,
      })),
    migrations: dbMigrations(db)
      .slice()
      .sort(byId)
      .map((migration) => ({
        id: migration.id,
        fromTables: list(migration.fromTables).slice().sort(),
        toTables: list(migration.toTables).slice().sort(),
        preserves: list(migration.preserves).slice().sort(),
        mappings: list(migration.mappings)
          .slice()
          .sort(byId)
          .map((mapping) => ({
            id: mapping.id,
            sourceExpr: mapping.sourceExpr,
            targetExpr: mapping.targetExpr,
            invariants: list(mapping.invariants).slice().sort(),
          })),
      })),
  };
}

function cloudProjection(model) {
  const cloud = cloudPattern(model);
  if (!cloud) {
    return {
      zones: [],
      nodes: [],
      flows: [],
      policies: [],
    };
  }
  return {
    zones: cloudZones(cloud)
      .slice()
      .sort(byId)
      .map((zone) => ({
        id: zone.id,
        exposure: zone.exposure,
      })),
    nodes: cloudNodes(cloud)
      .slice()
      .sort(byId)
      .map((node) => ({
        id: node.id,
        kind: node.kind,
        zone: node.zone,
        tenantScoped: Boolean(node.tenantScoped),
      })),
    flows: cloudFlows(cloud)
      .slice()
      .sort(byId)
      .map((flow) => ({
        id: flow.id,
        from: flow.from,
        to: flow.to,
        action: flow.action,
        tenantPropagated: Boolean(flow.tenantPropagated),
        idempotencyKey: flow.idempotencyKey ?? null,
      })),
    policies: cloudPolicies(cloud)
      .slice()
      .sort(byId)
      .map((policy) => ({
        id: policy.id,
        principal: policy.principal,
        resource: policy.resource,
        actions: list(policy.actions).slice().sort(),
      })),
  };
}

function dataProjection(model) {
  const data = dataPattern(model);
  if (!data) {
    return {
      policies: [],
      datasets: [],
      stores: [],
      placements: [],
      flows: [],
    };
  }
  return {
    policies: dataPolicies(data)
      .slice()
      .sort(byId)
      .map((policy) => ({
        id: policy.id,
        classification: policy.classification,
        maxRetentionDays: policy.maxRetentionDays ?? null,
      })),
    datasets: dataSets(data)
      .slice()
      .sort(byId)
      .map((dataset) => ({
        id: dataset.id,
        classification: dataset.classification,
        residency: dataset.residency ?? null,
        retentionDays: dataset.retentionDays ?? null,
      })),
    stores: dataStores(data)
      .slice()
      .sort(byId)
      .map((store) => ({
        id: store.id,
        region: store.region,
        encrypted: Boolean(store.encrypted),
        deletionSupported: Boolean(store.deletionSupported),
      })),
    placements: dataPlacements(data)
      .slice()
      .sort(byId)
      .map((placement) => ({
        id: placement.id,
        dataset: placement.dataset,
        store: placement.store,
      })),
    flows: dataFlows(data)
      .slice()
      .sort(byId)
      .map((flow) => ({
        id: flow.id,
        dataset: flow.dataset,
        from: flow.from,
        to: flow.to,
        purpose: flow.purpose,
        legalBasis: flow.legalBasis ?? null,
      })),
  };
}

function releaseProjection(model) {
  const release = releasePattern(model);
  if (!release) {
    return {
      services: [],
      environments: [],
      gates: [],
      rollbacks: [],
      migrations: [],
      steps: [],
    };
  }
  return {
    services: releaseServices(release)
      .slice()
      .sort(byId)
      .map((service) => ({
        id: service.id,
        critical: Boolean(service.critical),
      })),
    environments: releaseEnvironments(release)
      .slice()
      .sort(byId)
      .map((environment) => ({
        id: environment.id,
        production: Boolean(environment.production),
      })),
    gates: releaseGates(release)
      .slice()
      .sort(byId)
      .map((gate) => ({
        id: gate.id,
        kind: gate.kind,
      })),
    rollbacks: releaseRollbacks(release)
      .slice()
      .sort(byId)
      .map((rollback) => ({
        id: rollback.id,
        service: rollback.service,
        tested: Boolean(rollback.tested),
      })),
    migrations: releaseMigrations(release)
      .slice()
      .sort(byId)
      .map((migration) => ({
        id: migration.id,
        service: migration.service,
        backwardsCompatible: Boolean(migration.backwardsCompatible),
      })),
    steps: releaseSteps(release)
      .slice()
      .sort(byId)
      .map((step) => ({
        id: step.id,
        service: step.service,
        environment: step.environment,
        strategy: step.strategy,
        trafficPercent: step.trafficPercent,
        gates: list(step.gates).slice().sort(),
        rollback: step.rollback ?? null,
        migration: step.migration ?? null,
      })),
  };
}

function runtimeProjection(model) {
  const runtime = runtimePattern(model);
  if (!runtime) {
    return {
      services: [],
      dependencies: [],
      signals: [],
      runbooks: [],
      alerts: [],
      slos: [],
      telemetry: [],
      alertPolicies: [],
      runbookExecutions: [],
      dependencyTraces: [],
      intentExecutions: [],
    };
  }
  return {
    services: runtimeServices(runtime)
      .slice()
      .sort(byId)
      .map((service) => ({
        id: service.id,
        critical: Boolean(service.critical),
      })),
    dependencies: runtimeDependencies(runtime)
      .slice()
      .sort(byId)
      .map((dependency) => ({
        id: dependency.id,
        service: dependency.service,
        target: dependency.target,
        kind: dependency.kind,
        timeoutMs: dependency.timeoutMs ?? null,
        retryable: Boolean(dependency.retryable),
        idempotent: Boolean(dependency.idempotent),
      })),
    signals: runtimeSignals(runtime)
      .slice()
      .sort(byId)
      .map((signal) => ({
        id: signal.id,
        service: signal.service,
        kind: signal.kind,
        indicator: signal.indicator,
      })),
    runbooks: runtimeRunbooks(runtime)
      .slice()
      .sort(byId)
      .map((runbook) => ({
        id: runbook.id,
        service: runbook.service,
        tested: Boolean(runbook.tested),
      })),
    alerts: runtimeAlerts(runtime)
      .slice()
      .sort(byId)
      .map((alert) => ({
        id: alert.id,
        service: alert.service,
        signal: alert.signal,
        severity: alert.severity,
        runbook: alert.runbook ?? null,
      })),
    slos: runtimeSlos(runtime)
      .slice()
      .sort(byId)
      .map((slo) => ({
        id: slo.id,
        service: slo.service,
        indicator: slo.indicator,
        targetPercent: slo.targetPercent,
        window: slo.window ?? null,
      })),
    telemetry: runtimeTelemetry(runtime)
      .slice()
      .sort(byId)
      .map((window) => ({
        id: window.id,
        service: window.service,
        signal: window.signal,
        slo: window.slo ?? null,
        observedPercent: window.observedPercent ?? null,
        source: window.source ?? null,
      })),
    alertPolicies: runtimeAlertPolicies(runtime)
      .slice()
      .sort(byId)
      .map((policy) => ({
        id: policy.id,
        alert: policy.alert,
        enabled: Boolean(policy.enabled),
        source: policy.source ?? null,
      })),
    runbookExecutions: runtimeRunbookExecutions(runtime)
      .slice()
      .sort(byId)
      .map((execution) => ({
        id: execution.id,
        runbook: execution.runbook,
        status: execution.status,
        executedAt: execution.executedAt ?? null,
        source: execution.source ?? null,
      })),
    dependencyTraces: runtimeDependencyTraces(runtime)
      .slice()
      .sort(byId)
      .map((trace) => ({
        id: trace.id,
        dependency: trace.dependency,
        observedLatencyMs: trace.observedLatencyMs ?? null,
        timedOut: Boolean(trace.timedOut),
        idempotencyKeyObserved: Boolean(trace.idempotencyKeyObserved),
        source: trace.source ?? null,
      })),
    intentExecutions: runtimeIntentExecutions(runtime)
      .slice()
      .sort(byId)
      .map((execution) => ({
        id: execution.id,
        process: execution.process,
        refinement: execution.refinement,
        observedLatencyMs: execution.observedLatencyMs ?? null,
        maxInFlightObserved: execution.maxInFlightObserved ?? null,
        timedOut: Boolean(execution.timedOut),
        idempotencyKeyObserved: Boolean(execution.idempotencyKeyObserved),
        duplicateSuppressed: Boolean(execution.duplicateSuppressed),
        source: execution.source ?? null,
      })),
  };
}

function intentContractProjection(contract) {
  if (!contract) return null;
  return {
    fields: list(contract.fields)
      .slice()
      .sort(byId)
      .map((field) => ({
        id: field.id,
        type: field.type,
        required: field.required !== false,
        allowedValues: list(field.allowedValues).slice().sort(),
        minimum: field.minimum ?? null,
        maximum: field.maximum ?? null,
        pattern: field.pattern ?? null,
      })),
    clauses: list(contract.clauses).map(clauseProjection),
  };
}

function intentRefinementProjection(refinement) {
  return {
    id: refinement.id,
    kind: refinement.kind,
    implementation: {
      kind: refinement.implementation.kind,
      path: refinement.implementation.path,
      symbol: refinement.implementation.symbol ?? null,
    },
    http: refinement.http
      ? {
        method: refinement.http.method,
        path: refinement.http.path,
        expectedStatus: refinement.http.expectedStatus,
      }
      : null,
    transaction: refinement.transaction
      ? {
        dbTransaction: refinement.transaction.dbTransaction,
        isolation: refinement.transaction.isolation,
      }
      : null,
    inputBindings: list(refinement.inputBindings)
      .map((binding) => ({ contractField: binding.contractField, implementationField: binding.implementationField }))
      .sort((left, right) => left.contractField.localeCompare(right.contractField)),
    outcomeBindings: list(refinement.outcomeBindings)
      .map((binding) => ({
        outcome: binding.outcome,
        fields: list(binding.fields)
          .map((field) => ({ contractField: field.contractField, implementationField: field.implementationField }))
          .sort((left, right) => left.contractField.localeCompare(right.contractField)),
        effectBindings: list(binding.effectBindings)
          .map((effect) => ({
            effect: effect.effect,
            fields: list(effect.fields)
              .map((field) => ({ contractField: field.contractField, implementationField: field.implementationField }))
              .sort((left, right) => left.contractField.localeCompare(right.contractField)),
          }))
          .sort((left, right) => left.effect.localeCompare(right.effect)),
      }))
      .sort((left, right) => left.outcome.localeCompare(right.outcome)),
  };
}

function intentProjection(model) {
  const intent = intentPattern(model);
  if (!intent) {
    return {
      capabilities: [],
      outcomes: [],
      processes: [],
      constructionAuthorities: [],
      accessPolicies: [],
      goals: [],
      claims: [],
      assuranceTasks: [],
      semanticBindings: [],
      scenarios: [],
    };
  }
  return {
    capabilities: intentCapabilities(intent)
      .slice()
      .sort(byId)
      .map((capability) => ({ id: capability.id, kind: capability.kind })),
    outcomes: intentOutcomes(intent)
      .slice()
      .sort(byId)
      .map((outcome) => ({
        id: outcome.id,
        state: outcome.state,
        outputContract: intentContractProjection(outcome.outputContract),
        effects: list(outcome.effects)
          .slice()
          .sort(byId)
          .map((effect) => ({
            id: effect.id,
            capability: effect.capability,
            required: effect.required !== false,
            outputContract: intentContractProjection(effect.outputContract),
          })),
      })),
    processes: intentProcesses(intent)
      .slice()
      .sort(byId)
      .map((process) => ({
        id: process.id,
        input: process.input,
        inputContract: intentContractProjection(process.inputContract),
        outcomes: list(process.outcomes).slice().sort(),
        requires: list(process.requires).slice().sort(),
        effects: list(process.effects).slice().sort(),
        constructs: list(process.constructs).slice().sort(),
        execution: process.execution
          ? {
            maxInFlight: process.execution.maxInFlight,
            idempotencyKey: process.execution.idempotencyKey ?? null,
            timeoutSteps: process.execution.timeoutSteps ?? null,
            timeoutMs: process.execution.timeoutMs ?? null,
          }
          : null,
        transitions: list(process.transitions)
          .map((transition) => ({ from: transition.from, to: transition.to }))
          .sort((left, right) => `${left.from}\u0000${left.to}`.localeCompare(`${right.from}\u0000${right.to}`)),
        refinements: intentRefinements(process).slice().sort(byId).map(intentRefinementProjection),
      })),
    constructionAuthorities: constructionAuthorities(intent)
      .slice()
      .sort(byId)
      .map((authority) => ({ id: authority.id, process: authority.process, outcome: authority.outcome })),
    accessPolicies: intentAccessPolicies(intent)
      .slice()
      .sort(byId)
      .map((policy) => ({
        id: policy.id,
        process: policy.process,
        subject: policy.subject,
        decision: policy.decision,
        priority: policy.priority,
        overrides: list(policy.overrides).slice().sort(),
      })),
    goals: intentGoals(intent)
      .slice()
      .sort(byId)
      .map((goal) => ({
        id: goal.id,
        priority: goal.priority,
        intents: list(goal.intents).slice().sort(),
        claims: list(goal.claims).slice().sort(),
        nonGoals: list(goal.nonGoals).length,
      })),
    claims: intentClaims(intent)
      .slice()
      .sort(byId)
      .map((claim) => ({
        id: claim.id,
        kind: claim.kind,
        processes: list(claim.processes).slice().sort(),
        requiredImplementationBinding: claim.requiredImplementationBinding !== false,
      })),
    assuranceTasks: intentAssuranceTasks(intent)
      .slice()
      .sort(byId)
      .map((task) => ({
        id: task.id,
        claims: list(task.claims).slice().sort(),
        kind: task.kind,
        backend: task.backend,
        assurance: task.assurance,
        target: { kind: task.target.kind, path: task.target.path, symbol: task.target.symbol ?? null },
        assumptions: list(task.assumptions).slice().sort(),
      })),
    semanticBindings: intentSemanticBindings(intent)
      .slice()
      .sort(byId)
      .map((binding) => ({
        id: binding.id,
        claims: list(binding.claims).slice().sort(),
        process: binding.process,
        refinement: binding.refinement ?? null,
        kind: binding.kind,
        target: binding.target,
        value: binding.value ?? null,
        required: binding.required !== false,
      })),
    scenarios: intentScenarios(intent)
      .slice()
      .sort(byId)
      .map((scenario) => ({
        id: scenario.id,
        kind: scenario.kind,
        required: scenario.required !== false,
        initialState: scenario.initialState,
        steps: list(scenario.steps).map((step) => ({ process: step.process, outcome: step.outcome })),
        expectedState: scenario.expectedState,
      })),
  };
}

function ruleProjection(rule) {
  return {
    id: rule.id,
    kind: rule.kind,
    status: rule.reviewStatus,
    requiredAssurances: ruleRequiredAssurances(rule),
    checks: list(rule.checks).map((target) => ({
      backend: target.backend,
      ref: target.ref,
      automated: target.backend !== "manual" && target.backend !== "runtime",
      assurances: checkTargetAssurances(target),
      assuranceEvidence: Object.fromEntries(
        Object.entries(target.assuranceEvidence ?? {}).sort(([left], [right]) => left.localeCompare(right)),
      ),
    })),
    terms: list(rule.terms).slice().sort(),
    when: list(rule.when).map(clauseProjection),
    must: list(rule.must).map(clauseProjection),
    mustNot: list(rule.mustNot).map(clauseProjection),
  };
}

function emitQuickcheck(model) {
  const rules = sortedRules(model).map(ruleProjection);
  const approved = sortedRules(model)
    .filter((rule) => rule.reviewStatus === "approved" && !rule.deprecated)
    .map((rule) => rule.id);

  return `// Generated by dspec. Do not edit by hand.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const modelId = ${JSON.stringify(model.id)};
export const clauseAstSemanticsVersion = ${JSON.stringify(model.clauseAstSemanticsVersion)};
export const rules = ${JSON.stringify(rules, null, 2)};
export const approvedRuleIds = ${JSON.stringify(approved, null, 2)};
export const dbModel = ${JSON.stringify(dbProjection(model), null, 2)};
export const cloudModel = ${JSON.stringify(cloudProjection(model), null, 2)};
export const dataModel = ${JSON.stringify(dataProjection(model), null, 2)};
export const releaseModel = ${JSON.stringify(releaseProjection(model), null, 2)};
export const runtimeModel = ${JSON.stringify(runtimeProjection(model), null, 2)};
export const intentModel = ${JSON.stringify(intentProjection(model), null, 2)};

export function* generateRuleIds() {
  for (const rule of rules) yield rule.id;
}

export function* generateApprovedRuleIds() {
  for (const ruleId of approvedRuleIds) yield ruleId;
}

export function shrinkRuleId(ruleId) {
  const index = approvedRuleIds.indexOf(ruleId);
  if (index <= 0) return [];
  return approvedRuleIds.slice(0, index);
}

export function propertyApprovedRulesHaveAutomatedChecks(ruleId) {
  const rule = rules.find((candidate) => candidate.id === ruleId);
  return Boolean(rule && rule.status === "approved" && rule.checks.some((check) => check.automated));
}

export function propertyApprovedRulesHaveRequiredAssurances(ruleId) {
  const rule = rules.find((candidate) => candidate.id === ruleId);
  if (!rule || rule.status !== "approved") return false;
  const available = new Set(
    rule.checks
      .filter((check) => check.automated)
      .flatMap((check) => check.assurances),
  );
  return rule.requiredAssurances.every((assurance) => available.has(assurance));
}

export function* generateDbTransactions() {
  for (const transaction of dbModel.transactions) yield transaction;
}

export function* generateDbMigrations() {
  for (const migration of dbModel.migrations) yield migration;
}

export function* generateDbMigrationMappings() {
  for (const migration of dbModel.migrations) {
    for (const mapping of migration.mappings) {
      yield { migration, mapping };
    }
  }
}

export function dbTouchedInvariants(transaction) {
  return dbModel.invariants.filter((invariant) => invariant.tables.some((table) => transaction.writes.includes(table)));
}

export function propertyDbTransactionsPreserveInvariants(transaction) {
  if (!transaction) return true;
  return dbTouchedInvariants(transaction).every((invariant) => transaction.preserves.includes(invariant.id));
}

export function dbMigrationTouchedInvariants(migration) {
  const touchedTables = new Set([...migration.fromTables, ...migration.toTables]);
  return dbModel.invariants.filter((invariant) => invariant.tables.some((table) => touchedTables.has(table)));
}

export function propertyDbMigrationsPreserveInvariants(migration) {
  if (!migration) return true;
  return dbMigrationTouchedInvariants(migration).every((invariant) => migration.preserves.includes(invariant.id));
}

export function dbMigrationMappedInvariantIds(migration) {
  return new Set(migration.mappings.flatMap((mapping) => mapping.invariants));
}

export function propertyDbMigrationMappingsCoverInvariants(migration) {
  if (!migration) return true;
  const mapped = dbMigrationMappedInvariantIds(migration);
  return migration.preserves.every((invariantId) => mapped.has(invariantId));
}

export function exprMentionsTable(expr, tableId) {
  const value = String(expr);
  return value.includes(\`\${tableId}.\`) || value.split(/[^A-Za-z0-9_./-]+/).includes(tableId);
}

export function propertyDbMigrationMappingExpressionsMentionTables(entry) {
  if (!entry) return true;
  return entry.migration.fromTables.some((tableId) => exprMentionsTable(entry.mapping.sourceExpr, tableId)) &&
    entry.migration.toTables.some((tableId) => exprMentionsTable(entry.mapping.targetExpr, tableId));
}

export function* generateCloudFlows() {
  for (const flow of cloudModel.flows) yield flow;
}

export function cloudNode(id) {
  return cloudModel.nodes.find((node) => node.id === id) ?? null;
}

export function cloudPolicyAllows(flow) {
  return cloudModel.policies.some((policy) =>
    policy.principal === flow.from &&
    policy.resource === flow.to &&
    policy.actions.includes(flow.action)
  );
}

export function isCloudSensitiveResource(node) {
  return Boolean(node && ["database", "queue", "bucket", "secret", "cache"].includes(node.kind));
}

export function propertyCloudPublicIngressBlocked(flow) {
  const source = cloudNode(flow.from);
  const target = cloudNode(flow.to);
  return !(source?.kind === "internet" && isCloudSensitiveResource(target));
}

export function propertyCloudResourceAccessHasPolicy(flow) {
  const target = cloudNode(flow.to);
  return !isCloudSensitiveResource(target) || cloudPolicyAllows(flow);
}

export function propertyCloudTenantFlowsPropagateTenant(flow) {
  const source = cloudNode(flow.from);
  const target = cloudNode(flow.to);
  return !(source?.tenantScoped || target?.tenantScoped) || Boolean(flow.tenantPropagated);
}

export function propertyCloudQueuePublishesHaveIdempotencyKey(flow) {
  const target = cloudNode(flow.to);
  return target?.kind !== "queue" || Boolean(flow.idempotencyKey);
}

export function* generateDataPlacements() {
  for (const placement of dataModel.placements) yield placement;
}

export function* generateDataFlows() {
  for (const flow of dataModel.flows) yield flow;
}

export function* generateDataSets() {
  for (const dataset of dataModel.datasets) yield dataset;
}

export function dataSet(id) {
  return dataModel.datasets.find((dataset) => dataset.id === id) ?? null;
}

export function dataStore(id) {
  return dataModel.stores.find((store) => store.id === id) ?? null;
}

export function dataPolicyFor(dataset) {
  return dataModel.policies.find((policy) => policy.classification === dataset?.classification) ?? null;
}

export function isSensitiveDataSet(dataset) {
  return Boolean(dataset && ["personal", "confidential", "secret"].includes(dataset.classification));
}

export function isPersonalDataSet(dataset) {
  return dataset?.classification === "personal";
}

export function propertyDataSensitivePlacementsEncrypted(placement) {
  const dataset = dataSet(placement.dataset);
  const store = dataStore(placement.store);
  return !isSensitiveDataSet(dataset) || Boolean(store?.encrypted);
}

export function propertyDataPersonalPlacementsSupportDeletion(placement) {
  const dataset = dataSet(placement.dataset);
  const store = dataStore(placement.store);
  return !isPersonalDataSet(dataset) || Boolean(store?.deletionSupported);
}

export function propertyDataCrossRegionFlowsHaveLegalBasis(flow) {
  const dataset = dataSet(flow.dataset);
  const source = dataStore(flow.from);
  const target = dataStore(flow.to);
  return !isPersonalDataSet(dataset) || source?.region === target?.region || Boolean(flow.legalBasis);
}

export function propertyDataRetentionWithinPolicy(dataset) {
  const policy = dataPolicyFor(dataset);
  if (!dataset || dataset.retentionDays === null || dataset.retentionDays === undefined) return true;
  if (!policy || policy.maxRetentionDays === null || policy.maxRetentionDays === undefined) return true;
  return dataset.retentionDays <= policy.maxRetentionDays;
}

export function* generateReleaseSteps() {
  for (const step of releaseModel.steps) yield step;
}

export function releaseEnvironment(id) {
  return releaseModel.environments.find((environment) => environment.id === id) ?? null;
}

export function releaseGate(id) {
  return releaseModel.gates.find((gate) => gate.id === id) ?? null;
}

export function releaseRollback(id) {
  return releaseModel.rollbacks.find((rollback) => rollback.id === id) ?? null;
}

export function releaseMigration(id) {
  return releaseModel.migrations.find((migration) => migration.id === id) ?? null;
}

export function isReleaseProductionStep(step) {
  return Boolean(releaseEnvironment(step.environment)?.production);
}

export function hasReleaseHealthGate(step) {
  return step.gates.some((gateId) => releaseGate(gateId)?.kind === "health");
}

export function isReleaseTrafficShift(step) {
  return isReleaseProductionStep(step) && step.trafficPercent > 0;
}

export function propertyReleaseProductionStepsHaveHealthGate(step) {
  return !isReleaseProductionStep(step) || hasReleaseHealthGate(step);
}

export function propertyReleaseTrafficShiftsHaveRollback(step) {
  return !isReleaseTrafficShift(step) || Boolean(step.rollback);
}

export function propertyReleaseRollbackPlansAreTested(step) {
  if (!step.rollback) return true;
  return Boolean(releaseRollback(step.rollback)?.tested);
}

export function propertyReleaseMigrationsAreBackwardCompatible(step) {
  if (!isReleaseProductionStep(step) || !step.migration) return true;
  return Boolean(releaseMigration(step.migration)?.backwardsCompatible);
}

export function* generateRuntimeSlos() {
  for (const slo of runtimeModel.slos) yield slo;
}

export function* generateRuntimeAlerts() {
  for (const alert of runtimeModel.alerts) yield alert;
}

export function* generateRuntimeDependencies() {
  for (const dependency of runtimeModel.dependencies) yield dependency;
}

export function* generateRuntimeTelemetry() {
  for (const window of runtimeModel.telemetry) yield window;
}

export function* generateRuntimeDependencyTraces() {
  for (const trace of runtimeModel.dependencyTraces) yield trace;
}

export function runtimeService(id) {
  return runtimeModel.services.find((service) => service.id === id) ?? null;
}

export function runtimeSlo(id) {
  return runtimeModel.slos.find((slo) => slo.id === id) ?? null;
}

export function runtimeDependency(id) {
  return runtimeModel.dependencies.find((dependency) => dependency.id === id) ?? null;
}

export function runtimeSignal(id) {
  return runtimeModel.signals.find((signal) => signal.id === id) ?? null;
}

export function runtimeRunbook(id) {
  return runtimeModel.runbooks.find((runbook) => runbook.id === id) ?? null;
}

export function runtimeTelemetryForSlo(slo) {
  return runtimeModel.telemetry.filter((window) => {
    const signal = runtimeSignal(window.signal);
    return window.service === slo.service &&
      window.slo === slo.id &&
      signal?.service === slo.service &&
      signal?.indicator === slo.indicator;
  });
}

export function runtimeEnabledPolicyForAlert(alert) {
  return runtimeModel.alertPolicies.some((policy) => policy.alert === alert.id && policy.enabled);
}

export function runtimePassedExecutionForRunbook(runbookId) {
  return runtimeModel.runbookExecutions.some((execution) => execution.runbook === runbookId && execution.status === "pass");
}

export function runtimePageAlertsForSlo(slo) {
  return runtimeModel.alerts.filter((alert) => {
    const signal = runtimeSignal(alert.signal);
    return alert.service === slo.service &&
      alert.severity === "page" &&
      signal?.service === slo.service &&
      signal?.indicator === slo.indicator;
  });
}

export function propertyRuntimeCriticalSlosHavePageAlert(slo) {
  return !runtimeService(slo.service)?.critical || runtimePageAlertsForSlo(slo).length > 0;
}

export function propertyRuntimePageAlertsHaveTestedRunbook(alert) {
  if (alert.severity !== "page") return true;
  return Boolean(alert.runbook && runtimeRunbook(alert.runbook)?.tested);
}

export function propertyRuntimeDependenciesHaveTimeout(dependency) {
  return dependency.timeoutMs !== null && dependency.timeoutMs !== undefined && dependency.timeoutMs > 0;
}

export function propertyRuntimeRetriesAreIdempotent(dependency) {
  return !dependency.retryable || Boolean(dependency.idempotent);
}

export function propertyRuntimeSlosHaveTelemetry(slo) {
  return runtimeTelemetryForSlo(slo).length > 0;
}

export function propertyRuntimeTelemetryMeetsSlo(window) {
  const slo = runtimeSlo(window.slo);
  if (!slo || window.observedPercent === null || window.observedPercent === undefined) return false;
  return window.observedPercent >= slo.targetPercent;
}

export function propertyRuntimePageAlertsHaveEnabledPolicy(alert) {
  if (alert.severity !== "page") return true;
  return runtimeEnabledPolicyForAlert(alert);
}

export function propertyRuntimePageAlertsHaveExecutedRunbook(alert) {
  if (alert.severity !== "page") return true;
  return Boolean(alert.runbook && runtimePassedExecutionForRunbook(alert.runbook));
}

export function propertyRuntimeDependencyTracesWithinTimeout(trace) {
  const dependency = runtimeDependency(trace.dependency);
  if (!dependency || dependency.timeoutMs === null || dependency.timeoutMs === undefined) return false;
  if (trace.timedOut) return false;
  if (trace.observedLatencyMs === null || trace.observedLatencyMs === undefined) return true;
  return trace.observedLatencyMs <= dependency.timeoutMs;
}

export function* generateIntentProcesses() {
  for (const process of intentModel.processes) yield process;
}

export function* generateIntentAccessPolicies() {
  for (const policy of intentModel.accessPolicies) yield policy;
}

export function* generateIntentScenarios() {
  for (const scenario of intentModel.scenarios) yield scenario;
}

export function shrinkIntentProcessId(processId) {
  const index = intentModel.processes.findIndex((process) => process.id === processId);
  if (index <= 0) return [];
  return intentModel.processes.slice(0, index).map((process) => process.id);
}

export function shrinkIntentScenarioId(scenarioId) {
  const index = intentModel.scenarios.findIndex((scenario) => scenario.id === scenarioId);
  if (index <= 0) return [];
  return intentModel.scenarios.slice(0, index).map((scenario) => scenario.id);
}

export function intentOutcome(id) {
  return intentModel.outcomes.find((outcome) => outcome.id === id) ?? null;
}

export function propertyIntentProcessConstructionIsAuthorized(process) {
  if (!process) return true;
  return process.outcomes.every((outcomeId) =>
    process.constructs.includes(outcomeId) &&
    intentModel.constructionAuthorities.some((authority) => authority.process === process.id && authority.outcome === outcomeId)
  );
}

export function propertyIntentAccessPolicyOverridesHaveHigherPriority(policy) {
  if (!policy) return true;
  return policy.overrides.every((overriddenId) => {
    const overridden = intentModel.accessPolicies.find((candidate) => candidate.id === overriddenId);
    return Boolean(overridden) &&
      overridden.id !== policy.id &&
      overridden.process === policy.process &&
      overridden.subject === policy.subject &&
      policy.priority > overridden.priority;
  });
}

export function propertyIntentAccessPoliciesResolveDeterministically() {
  const priorities = new Set();
  for (const policy of intentModel.accessPolicies) {
    const key = [policy.process, policy.subject, policy.priority].join("\\u0000");
    if (priorities.has(key)) return false;
    priorities.add(key);
  }
  return true;
}

export function propertyIntentSemanticBindingsAreWellFormed() {
  const targets = new Set();
  return intentModel.semanticBindings.every((binding) => {
    if (!binding.process || !binding.kind || !binding.target) return false;
    if (binding.kind === "otel-attribute" && !binding.value) return false;
    const key = [binding.kind, binding.target, binding.value ?? ""].join("\\u0000");
    if (targets.has(key)) return false;
    targets.add(key);
    return true;
  });
}

export function propertyIntentClaimGraphIsComplete() {
  const claims = new Map(intentModel.claims.map((claim) => [claim.id, claim]));
  const parentCounts = new Map();
  const taskClaims = new Set(intentModel.assuranceTasks.flatMap((task) => task.claims));
  const bindingClaims = new Set(intentModel.semanticBindings.flatMap((binding) => binding.claims));
  for (const goal of intentModel.goals) {
    if (goal.intents.length === 0 || goal.claims.length === 0) return false;
    for (const processId of goal.intents) {
      if (!intentModel.processes.some((process) => process.id === processId)) return false;
    }
    for (const claimId of goal.claims) {
      if (!claims.has(claimId)) return false;
      parentCounts.set(claimId, (parentCounts.get(claimId) ?? 0) + 1);
    }
  }
  return intentModel.claims.every((claim) =>
    parentCounts.get(claim.id) === 1 &&
    claim.processes.length > 0 &&
    claim.processes.every((processId) => intentModel.processes.some((process) => process.id === processId)) &&
    taskClaims.has(claim.id) &&
    (!claim.requiredImplementationBinding || bindingClaims.has(claim.id))
  ) && intentModel.assuranceTasks.every((task) =>
    task.claims.length > 0 && task.claims.every((claimId) => claims.has(claimId))
  );
}

export function propertyIntentScenarioTraceIsContinuous(scenario) {
  if (!scenario) return true;
  let currentState = scenario.initialState;
  for (const step of scenario.steps) {
    const process = intentModel.processes.find((candidate) => candidate.id === step.process);
    const outcome = intentOutcome(step.outcome);
    if (!process || !outcome || process.input !== currentState || !process.outcomes.includes(outcome.id)) return false;
    if (!process.transitions.some((transition) => transition.from === currentState && transition.to === outcome.state)) return false;
    currentState = outcome.state;
  }
  return currentState === scenario.expectedState;
}

export function intentRequiredContractFieldIds(contract) {
  return (contract?.fields ?? []).filter((field) => field.required).map((field) => field.id);
}

export function propertyIntentProcessRefinementBindingsAreComplete(process) {
  if (!process) return true;
  const requiredInputFields = intentRequiredContractFieldIds(process.inputContract);
  return process.refinements.every((refinement) => {
    const inputBound = new Set(refinement.inputBindings.map((binding) => binding.contractField));
    if (!requiredInputFields.every((fieldId) => inputBound.has(fieldId))) return false;
    return process.outcomes.every((outcomeId) => {
      const outcome = intentOutcome(outcomeId);
      const binding = refinement.outcomeBindings.find((candidate) => candidate.outcome === outcomeId);
      const requiredOutputFields = intentRequiredContractFieldIds(outcome?.outputContract);
      if (requiredOutputFields.length === 0) return true;
      const outputBound = new Set(binding?.fields?.map((field) => field.contractField) ?? []);
      return requiredOutputFields.every((fieldId) => outputBound.has(fieldId));
    });
  });
}

export function propertyIntentOutcomeEffectBindingsAreComplete(process) {
  if (!process) return true;
  return process.refinements.every((refinement) => process.outcomes.every((outcomeId) => {
    const outcome = intentOutcome(outcomeId);
    const binding = refinement.outcomeBindings.find((candidate) => candidate.outcome === outcomeId);
    return (outcome?.effects ?? []).every((effect) => {
      const requiredFields = intentRequiredContractFieldIds(effect.outputContract);
      if (requiredFields.length === 0) return true;
      const effectBinding = binding?.effectBindings?.find((candidate) => candidate.effect === effect.id);
      const fields = new Set(effectBinding?.fields?.map((field) => field.contractField) ?? []);
      return requiredFields.every((fieldId) => fields.has(fieldId));
    });
  }));
}

export function checkAllProperties() {
  const failures = [];
  for (const ruleId of generateApprovedRuleIds()) {
    const hasAutomatedChecks = propertyApprovedRulesHaveAutomatedChecks(ruleId);
    if (!hasAutomatedChecks) {
      failures.push({ property: "approved-rules-have-automated-checks", value: ruleId, shrinks: shrinkRuleId(ruleId) });
    } else if (!propertyApprovedRulesHaveRequiredAssurances(ruleId)) {
      failures.push({ property: "approved-rules-have-required-assurances", value: ruleId, shrinks: shrinkRuleId(ruleId) });
    }
  }
  for (const transaction of generateDbTransactions()) {
    for (const invariant of dbTouchedInvariants(transaction)) {
      if (!transaction.preserves.includes(invariant.id)) {
        failures.push({ property: "db-transaction-preserves-invariants", value: transaction.id, invariant: invariant.id, shrinks: [] });
      }
    }
  }
  for (const migration of generateDbMigrations()) {
    for (const invariant of dbMigrationTouchedInvariants(migration)) {
      if (!migration.preserves.includes(invariant.id)) {
        failures.push({ property: "db-migration-preserves-invariants", value: migration.id, invariant: invariant.id, shrinks: [] });
      }
    }
    const mapped = dbMigrationMappedInvariantIds(migration);
    for (const invariantId of migration.preserves) {
      if (!mapped.has(invariantId)) {
        failures.push({ property: "db-migration-mappings-cover-invariants", value: migration.id, invariant: invariantId, shrinks: [] });
      }
    }
    for (const mapping of migration.mappings) {
      const sourceMentions = migration.fromTables.filter((tableId) => exprMentionsTable(mapping.sourceExpr, tableId));
      const targetMentions = migration.toTables.filter((tableId) => exprMentionsTable(mapping.targetExpr, tableId));
      if (sourceMentions.length === 0 || targetMentions.length === 0) {
        failures.push({
          property: "db-migration-mapping-expressions-mention-tables",
          value: migration.id,
          mapping: mapping.id,
          sourceExpr: mapping.sourceExpr,
          targetExpr: mapping.targetExpr,
          sourceTables: migration.fromTables,
          targetTables: migration.toTables,
          sourceMentions,
          targetMentions,
          shrinks: [],
        });
      }
    }
  }
  for (const flow of generateCloudFlows()) {
    if (!propertyCloudPublicIngressBlocked(flow)) {
      failures.push({ property: "cloud-public-ingress-blocked", value: flow.id, from: flow.from, to: flow.to, shrinks: [] });
    }
    if (!propertyCloudResourceAccessHasPolicy(flow)) {
      failures.push({ property: "cloud-resource-access-has-policy", value: flow.id, from: flow.from, to: flow.to, action: flow.action, shrinks: [] });
    }
    if (!propertyCloudTenantFlowsPropagateTenant(flow)) {
      failures.push({ property: "cloud-tenant-flow-propagates-tenant", value: flow.id, from: flow.from, to: flow.to, shrinks: [] });
    }
    if (!propertyCloudQueuePublishesHaveIdempotencyKey(flow)) {
      failures.push({ property: "cloud-queue-publish-has-idempotency-key", value: flow.id, from: flow.from, to: flow.to, shrinks: [] });
    }
  }
  for (const placement of generateDataPlacements()) {
    if (!propertyDataSensitivePlacementsEncrypted(placement)) {
      failures.push({ property: "data-sensitive-placement-encrypted", value: placement.id, dataset: placement.dataset, store: placement.store, shrinks: [] });
    }
    if (!propertyDataPersonalPlacementsSupportDeletion(placement)) {
      failures.push({ property: "data-personal-placement-supports-deletion", value: placement.id, dataset: placement.dataset, store: placement.store, shrinks: [] });
    }
  }
  for (const flow of generateDataFlows()) {
    if (!propertyDataCrossRegionFlowsHaveLegalBasis(flow)) {
      failures.push({ property: "data-cross-region-flow-has-legal-basis", value: flow.id, dataset: flow.dataset, from: flow.from, to: flow.to, purpose: flow.purpose, shrinks: [] });
    }
  }
  for (const dataset of generateDataSets()) {
    if (!propertyDataRetentionWithinPolicy(dataset)) {
      const policy = dataPolicyFor(dataset);
      failures.push({ property: "data-retention-within-policy", value: dataset.id, classification: dataset.classification, retentionDays: dataset.retentionDays, maxRetentionDays: policy?.maxRetentionDays ?? null, shrinks: [] });
    }
  }
  for (const step of generateReleaseSteps()) {
    if (!propertyReleaseProductionStepsHaveHealthGate(step)) {
      failures.push({ property: "release-production-step-has-health-gate", value: step.id, service: step.service, environment: step.environment, gates: step.gates, shrinks: [] });
    }
    if (!propertyReleaseTrafficShiftsHaveRollback(step)) {
      failures.push({ property: "release-traffic-shift-has-rollback", value: step.id, service: step.service, environment: step.environment, trafficPercent: step.trafficPercent, shrinks: [] });
    }
    if (!propertyReleaseRollbackPlansAreTested(step)) {
      failures.push({ property: "release-rollback-plan-tested", value: step.id, service: step.service, rollback: step.rollback, shrinks: [] });
    }
    if (!propertyReleaseMigrationsAreBackwardCompatible(step)) {
      failures.push({ property: "release-migration-backward-compatible", value: step.id, service: step.service, migration: step.migration, shrinks: [] });
    }
  }
  for (const slo of generateRuntimeSlos()) {
    if (!propertyRuntimeCriticalSlosHavePageAlert(slo)) {
      failures.push({ property: "runtime-critical-slo-has-page-alert", value: slo.id, service: slo.service, indicator: slo.indicator, shrinks: [] });
    }
    if (!propertyRuntimeSlosHaveTelemetry(slo)) {
      failures.push({ property: "runtime-slo-has-telemetry", value: slo.id, service: slo.service, indicator: slo.indicator, shrinks: [] });
    }
  }
  for (const alert of generateRuntimeAlerts()) {
    if (!propertyRuntimePageAlertsHaveTestedRunbook(alert)) {
      failures.push({ property: "runtime-page-alert-has-tested-runbook", value: alert.id, service: alert.service, signal: alert.signal, runbook: alert.runbook, shrinks: [] });
    }
    if (!propertyRuntimePageAlertsHaveEnabledPolicy(alert)) {
      failures.push({ property: "runtime-page-alert-has-enabled-policy", value: alert.id, service: alert.service, signal: alert.signal, severity: alert.severity, shrinks: [] });
    }
    if (!propertyRuntimePageAlertsHaveExecutedRunbook(alert)) {
      failures.push({ property: "runtime-page-alert-has-runbook-execution", value: alert.id, service: alert.service, signal: alert.signal, runbook: alert.runbook, shrinks: [] });
    }
  }
  for (const dependency of generateRuntimeDependencies()) {
    if (!propertyRuntimeDependenciesHaveTimeout(dependency)) {
      failures.push({ property: "runtime-dependency-has-timeout", value: dependency.id, service: dependency.service, target: dependency.target, shrinks: [] });
    }
    if (!propertyRuntimeRetriesAreIdempotent(dependency)) {
      failures.push({ property: "runtime-retry-is-idempotent", value: dependency.id, service: dependency.service, target: dependency.target, shrinks: [] });
    }
  }
  for (const window of generateRuntimeTelemetry()) {
    if (!propertyRuntimeTelemetryMeetsSlo(window)) {
      const slo = runtimeSlo(window.slo);
      failures.push({ property: "runtime-telemetry-meets-slo", value: window.id, service: window.service, signal: window.signal, slo: window.slo, observedPercent: window.observedPercent, targetPercent: slo?.targetPercent ?? null, shrinks: [] });
    }
  }
  for (const trace of generateRuntimeDependencyTraces()) {
    if (!propertyRuntimeDependencyTracesWithinTimeout(trace)) {
      const dependency = runtimeDependency(trace.dependency);
      failures.push({ property: "runtime-dependency-trace-within-timeout", value: trace.id, dependency: trace.dependency, observedLatencyMs: trace.observedLatencyMs, timedOut: trace.timedOut, timeoutMs: dependency?.timeoutMs ?? null, shrinks: [] });
    }
  }
  for (const process of generateIntentProcesses()) {
    if (!propertyIntentProcessConstructionIsAuthorized(process)) {
      failures.push({ property: "intent-process-construction-is-authorized", value: process.id, constructs: process.constructs, shrinks: shrinkIntentProcessId(process.id) });
    }
  }
  for (const policy of generateIntentAccessPolicies()) {
    if (!propertyIntentAccessPolicyOverridesHaveHigherPriority(policy)) {
      failures.push({ property: "intent-access-policy-overrides-have-higher-priority", value: policy.id, overrides: policy.overrides, shrinks: [] });
    }
  }
  if (!propertyIntentAccessPoliciesResolveDeterministically()) {
    failures.push({ property: "intent-access-policies-resolve-deterministically", value: intentModel.accessPolicies.map((policy) => policy.id), shrinks: [] });
  }
  if (!propertyIntentSemanticBindingsAreWellFormed()) {
    failures.push({ property: "intent-semantic-bindings-are-well-formed", value: intentModel.semanticBindings.map((binding) => binding.id), shrinks: [] });
  }
  if (!propertyIntentClaimGraphIsComplete()) {
    failures.push({ property: "intent-claim-graph-is-complete", value: intentModel.claims.map((claim) => claim.id), shrinks: [] });
  }
  for (const process of generateIntentProcesses()) {
    if (!propertyIntentOutcomeEffectBindingsAreComplete(process)) {
      failures.push({ property: "intent-outcome-effect-bindings-are-complete", value: process.id, shrinks: shrinkIntentProcessId(process.id) });
    }
  }
  for (const scenario of generateIntentScenarios()) {
    if (!propertyIntentScenarioTraceIsContinuous(scenario)) {
      failures.push({ property: "intent-scenario-trace-is-continuous", value: scenario.id, steps: scenario.steps, shrinks: shrinkIntentScenarioId(scenario.id) });
    }
  }
  for (const process of generateIntentProcesses()) {
    if (!propertyIntentProcessRefinementBindingsAreComplete(process)) {
      failures.push({ property: "intent-process-refinement-bindings-are-complete", value: process.id, shrinks: shrinkIntentProcessId(process.id) });
    }
  }
  return failures;
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  const failures = checkAllProperties();
  if (failures.length > 0) {
    console.error(JSON.stringify(failures, null, 2));
    process.exit(1);
  }
  console.log(\`ok: \${modelId} quickcheck (\${approvedRuleIds.length} approved rules)\`);
}
`;
}

function sanitizeIdentifier(value) {
  return String(value).replace(/[^A-Za-z0-9_]/g, "_").replace(/^([0-9])/, "_$1");
}

function dbName(prefix, id) {
  return `${prefix}_${sanitizeIdentifier(id)}`;
}

function dbMappingId(migration, mapping) {
  return `${migration.id}/${mapping.id}`;
}

function dbMappingName(migration, mapping) {
  return dbName("DBMAP", `${migration.id}_${mapping.id}`);
}

function cloudName(prefix, id) {
  return `${prefix}_${sanitizeIdentifier(id)}`;
}

function dataName(prefix, id) {
  return `${prefix}_${sanitizeIdentifier(id)}`;
}

function releaseName(prefix, id) {
  return `${prefix}_${sanitizeIdentifier(id)}`;
}

function runtimeName(prefix, id) {
  return `${prefix}_${sanitizeIdentifier(id)}`;
}

function intentName(prefix, id) {
  return `${prefix}_${sanitizeIdentifier(id)}`;
}

function dbTouchedInvariantIds(db, transaction) {
  const writes = new Set(list(transaction.writes));
  return dbInvariants(db)
    .filter((invariant) => list(invariant.tables).some((tableId) => writes.has(tableId)))
    .map((invariant) => invariant.id)
    .sort();
}

function dbMigrationTouchedInvariantIds(db, migration) {
  const touched = new Set([...list(migration.fromTables), ...list(migration.toTables)]);
  return dbInvariants(db)
    .filter((invariant) => list(invariant.tables).some((tableId) => touched.has(tableId)))
    .map((invariant) => invariant.id)
    .sort();
}

function dbMigrationMappedInvariantIds(migration) {
  return [
    ...new Set(
      list(migration.mappings).flatMap((mapping) => list(mapping.invariants)),
    ),
  ].sort();
}

function dbExprMentionsTable(expr, tableId) {
  const value = String(expr);
  return value.includes(`${tableId}.`) || value.split(/[^A-Za-z0-9_./-]+/).includes(tableId);
}

function dbMappingMentionedSourceTableIds(migration, mapping) {
  return list(migration.fromTables).filter((tableId) => dbExprMentionsTable(mapping.sourceExpr, tableId)).sort();
}

function dbMappingMentionedTargetTableIds(migration, mapping) {
  return list(migration.toTables).filter((tableId) => dbExprMentionsTable(mapping.targetExpr, tableId)).sort();
}

function cloudNodeMap(cloud) {
  return new Map(cloudNodes(cloud).map((node) => [node.id, node]));
}

function cloudSensitiveKinds() {
  return new Set(["database", "queue", "bucket", "secret", "cache"]);
}

function isCloudSensitiveNode(node) {
  return Boolean(node && cloudSensitiveKinds().has(node.kind));
}

function cloudPublicIngressNodeIds(cloud) {
  return cloudNodes(cloud)
    .filter((node) => node.kind === "internet")
    .map((node) => node.id)
    .sort();
}

function cloudSensitiveNodeIds(cloud) {
  return cloudNodes(cloud)
    .filter(isCloudSensitiveNode)
    .map((node) => node.id)
    .sort();
}

function cloudPolicyAllowsFlow(cloud, flow) {
  return cloudPolicies(cloud).some(
    (policy) =>
      policy.principal === flow.from &&
      policy.resource === flow.to &&
      list(policy.actions).includes(flow.action),
  );
}

function cloudFlowTarget(cloud, flow) {
  return cloudNodeMap(cloud).get(flow.to) ?? null;
}

function cloudRequiresPolicyFlowIds(cloud) {
  return cloudFlows(cloud)
    .filter((flow) => isCloudSensitiveNode(cloudFlowTarget(cloud, flow)))
    .map((flow) => flow.id)
    .sort();
}

function cloudAllowedByPolicyFlowIds(cloud) {
  return cloudFlows(cloud)
    .filter((flow) => cloudPolicyAllowsFlow(cloud, flow))
    .map((flow) => flow.id)
    .sort();
}

function cloudTenantScopedNodeIds(cloud) {
  return cloudNodes(cloud)
    .filter((node) => Boolean(node.tenantScoped))
    .map((node) => node.id)
    .sort();
}

function cloudTenantPropagatedFlowIds(cloud) {
  return cloudFlows(cloud)
    .filter((flow) => Boolean(flow.tenantPropagated))
    .map((flow) => flow.id)
    .sort();
}

function cloudQueuePublishFlowIds(cloud) {
  const nodes = cloudNodeMap(cloud);
  return cloudFlows(cloud)
    .filter((flow) => nodes.get(flow.to)?.kind === "queue")
    .map((flow) => flow.id)
    .sort();
}

function cloudIdempotentFlowIds(cloud) {
  return cloudFlows(cloud)
    .filter((flow) => Boolean(flow.idempotencyKey))
    .map((flow) => flow.id)
    .sort();
}

function dataSetMap(data) {
  return new Map(dataSets(data).map((dataset) => [dataset.id, dataset]));
}

function dataStoreMap(data) {
  return new Map(dataStores(data).map((store) => [store.id, store]));
}

function dataPolicyMap(data) {
  return new Map(dataPolicies(data).map((policy) => [policy.classification, policy]));
}

function dataSensitiveClassifications() {
  return new Set(["personal", "confidential", "secret"]);
}

function isSensitiveDataSetRecord(dataset) {
  return Boolean(dataset && dataSensitiveClassifications().has(dataset.classification));
}

function isPersonalDataSetRecord(dataset) {
  return dataset?.classification === "personal";
}

function dataSensitivePlacementIds(data) {
  const datasets = dataSetMap(data);
  return dataPlacements(data)
    .filter((placement) => isSensitiveDataSetRecord(datasets.get(placement.dataset)))
    .map((placement) => placement.id)
    .sort();
}

function dataEncryptedPlacementIds(data) {
  const stores = dataStoreMap(data);
  return dataPlacements(data)
    .filter((placement) => Boolean(stores.get(placement.store)?.encrypted))
    .map((placement) => placement.id)
    .sort();
}

function dataPersonalPlacementIds(data) {
  const datasets = dataSetMap(data);
  return dataPlacements(data)
    .filter((placement) => isPersonalDataSetRecord(datasets.get(placement.dataset)))
    .map((placement) => placement.id)
    .sort();
}

function dataDeletionSupportedPlacementIds(data) {
  const stores = dataStoreMap(data);
  return dataPlacements(data)
    .filter((placement) => Boolean(stores.get(placement.store)?.deletionSupported))
    .map((placement) => placement.id)
    .sort();
}

function dataCrossRegionFlowIds(data) {
  const datasets = dataSetMap(data);
  const stores = dataStoreMap(data);
  return dataFlows(data)
    .filter((flow) => {
      const source = stores.get(flow.from);
      const target = stores.get(flow.to);
      return isPersonalDataSetRecord(datasets.get(flow.dataset)) && source && target && source.region !== target.region;
    })
    .map((flow) => flow.id)
    .sort();
}

function dataLegalBasisFlowIds(data) {
  return dataFlows(data)
    .filter((flow) => Boolean(flow.legalBasis))
    .map((flow) => flow.id)
    .sort();
}

function dataRetentionScopedDataSetIds(data) {
  const policies = dataPolicyMap(data);
  return dataSets(data)
    .filter((dataset) => {
      const policy = policies.get(dataset.classification);
      return dataset.retentionDays !== null && dataset.retentionDays !== undefined && policy?.maxRetentionDays !== null && policy?.maxRetentionDays !== undefined;
    })
    .map((dataset) => dataset.id)
    .sort();
}

function dataRetentionCompliantDataSetIds(data) {
  const policies = dataPolicyMap(data);
  return dataSets(data)
    .filter((dataset) => {
      const policy = policies.get(dataset.classification);
      if (dataset.retentionDays === null || dataset.retentionDays === undefined) return false;
      if (!policy || policy.maxRetentionDays === null || policy.maxRetentionDays === undefined) return false;
      return dataset.retentionDays <= policy.maxRetentionDays;
    })
    .map((dataset) => dataset.id)
    .sort();
}

function releaseEnvironmentMap(release) {
  return new Map(releaseEnvironments(release).map((environment) => [environment.id, environment]));
}

function releaseGateMap(release) {
  return new Map(releaseGates(release).map((gate) => [gate.id, gate]));
}

function releaseRollbackMap(release) {
  return new Map(releaseRollbacks(release).map((rollback) => [rollback.id, rollback]));
}

function releaseMigrationMap(release) {
  return new Map(releaseMigrations(release).map((migration) => [migration.id, migration]));
}

function isReleaseProductionStepRecord(release, step) {
  return Boolean(releaseEnvironmentMap(release).get(step.environment)?.production);
}

function releaseProductionStepIds(release) {
  return releaseSteps(release)
    .filter((step) => isReleaseProductionStepRecord(release, step))
    .map((step) => step.id)
    .sort();
}

function releaseHealthGatedStepIds(release) {
  const gates = releaseGateMap(release);
  return releaseSteps(release)
    .filter((step) => list(step.gates).some((gateId) => gates.get(gateId)?.kind === "health"))
    .map((step) => step.id)
    .sort();
}

function releaseTrafficShiftStepIds(release) {
  return releaseSteps(release)
    .filter((step) => isReleaseProductionStepRecord(release, step) && step.trafficPercent > 0)
    .map((step) => step.id)
    .sort();
}

function releaseRollbackPlannedStepIds(release) {
  return releaseSteps(release)
    .filter((step) => Boolean(step.rollback))
    .map((step) => step.id)
    .sort();
}

function releaseRollbackTestedStepIds(release) {
  const rollbacks = releaseRollbackMap(release);
  return releaseSteps(release)
    .filter((step) => step.rollback && Boolean(rollbacks.get(step.rollback)?.tested))
    .map((step) => step.id)
    .sort();
}

function releaseMigrationScopedStepIds(release) {
  return releaseSteps(release)
    .filter((step) => isReleaseProductionStepRecord(release, step) && Boolean(step.migration))
    .map((step) => step.id)
    .sort();
}

function releaseMigrationCompatibleStepIds(release) {
  const migrations = releaseMigrationMap(release);
  return releaseSteps(release)
    .filter((step) => step.migration && Boolean(migrations.get(step.migration)?.backwardsCompatible))
    .map((step) => step.id)
    .sort();
}

function runtimeServiceMap(runtime) {
  return new Map(runtimeServices(runtime).map((service) => [service.id, service]));
}

function runtimeSignalMap(runtime) {
  return new Map(runtimeSignals(runtime).map((signal) => [signal.id, signal]));
}

function runtimeRunbookMap(runtime) {
  return new Map(runtimeRunbooks(runtime).map((runbook) => [runbook.id, runbook]));
}

function runtimeCriticalSloIds(runtime) {
  const services = runtimeServiceMap(runtime);
  return runtimeSlos(runtime)
    .filter((slo) => Boolean(services.get(slo.service)?.critical))
    .map((slo) => slo.id)
    .sort();
}

function runtimePageAlertedSloIds(runtime) {
  const signals = runtimeSignalMap(runtime);
  return runtimeSlos(runtime)
    .filter((slo) =>
      runtimeAlerts(runtime).some((alert) => {
        const signal = signals.get(alert.signal);
        return alert.service === slo.service &&
          alert.severity === "page" &&
          signal?.service === slo.service &&
          signal?.indicator === slo.indicator;
      }),
    )
    .map((slo) => slo.id)
    .sort();
}

function runtimePageAlertIds(runtime) {
  return runtimeAlerts(runtime)
    .filter((alert) => alert.severity === "page")
    .map((alert) => alert.id)
    .sort();
}

function runtimeTestedRunbookAlertIds(runtime) {
  const runbooks = runtimeRunbookMap(runtime);
  return runtimeAlerts(runtime)
    .filter((alert) => alert.runbook && Boolean(runbooks.get(alert.runbook)?.tested))
    .map((alert) => alert.id)
    .sort();
}

function runtimeDependencyIds(runtime) {
  return runtimeDependencies(runtime)
    .map((dependency) => dependency.id)
    .sort();
}

function runtimeTimeoutDependencyIds(runtime) {
  return runtimeDependencies(runtime)
    .filter((dependency) => dependency.timeoutMs !== null && dependency.timeoutMs !== undefined && dependency.timeoutMs > 0)
    .map((dependency) => dependency.id)
    .sort();
}

function runtimeRetryDependencyIds(runtime) {
  return runtimeDependencies(runtime)
    .filter((dependency) => Boolean(dependency.retryable))
    .map((dependency) => dependency.id)
    .sort();
}

function runtimeIdempotentDependencyIds(runtime) {
  return runtimeDependencies(runtime)
    .filter((dependency) => Boolean(dependency.idempotent))
    .map((dependency) => dependency.id)
    .sort();
}

function runtimeSloMap(runtime) {
  return new Map(runtimeSlos(runtime).map((slo) => [slo.id, slo]));
}

function runtimeDependencyMap(runtime) {
  return new Map(runtimeDependencies(runtime).map((dependency) => [dependency.id, dependency]));
}

function runtimeTelemetrySloIds(runtime) {
  const signals = runtimeSignalMap(runtime);
  const slos = runtimeSloMap(runtime);
  return runtimeTelemetry(runtime)
    .filter((window) => {
      const signal = signals.get(window.signal);
      const slo = slos.get(window.slo);
      return Boolean(slo && signal && window.service === slo.service && signal.service === slo.service && signal.indicator === slo.indicator);
    })
    .map((window) => window.slo)
    .sort();
}

function runtimePassingTelemetryIds(runtime) {
  const slos = runtimeSloMap(runtime);
  return runtimeTelemetry(runtime)
    .filter((window) => {
      const slo = slos.get(window.slo);
      return Boolean(slo && window.observedPercent !== null && window.observedPercent !== undefined && window.observedPercent >= slo.targetPercent);
    })
    .map((window) => window.id)
    .sort();
}

function runtimeEnabledPolicyAlertIds(runtime) {
  return runtimeAlertPolicies(runtime)
    .filter((policy) => Boolean(policy.enabled))
    .map((policy) => policy.alert)
    .sort();
}

function runtimePassedRunbookIds(runtime) {
  return new Set(runtimeRunbookExecutions(runtime).filter((execution) => execution.status === "pass").map((execution) => execution.runbook));
}

function runtimeExecutedRunbookAlertIds(runtime) {
  const passedRunbooks = runtimePassedRunbookIds(runtime);
  return runtimeAlerts(runtime)
    .filter((alert) => alert.runbook && passedRunbooks.has(alert.runbook))
    .map((alert) => alert.id)
    .sort();
}

function runtimeTimeoutCompliantTraceIds(runtime) {
  const dependencies = runtimeDependencyMap(runtime);
  return runtimeDependencyTraces(runtime)
    .filter((trace) => {
      const dependency = dependencies.get(trace.dependency);
      if (!dependency || dependency.timeoutMs === null || dependency.timeoutMs === undefined) return false;
      if (trace.timedOut) return false;
      return trace.observedLatencyMs === null || trace.observedLatencyMs === undefined || trace.observedLatencyMs <= dependency.timeoutMs;
    })
    .map((trace) => trace.id)
    .sort();
}


function emitAlloy(model) {
  const rules = sortedRules(model);
  const lines = [
    `module ${sanitizeIdentifier(model.id)}`,
    "",
    "abstract sig Rule {}",
    "abstract sig ActiveApprovedRule extends Rule {}",
    "abstract sig DeprecatedRule extends Rule {}",
    "abstract sig CheckTarget {}",
    "abstract sig AutomatedCheckTarget extends CheckTarget {}",
    "abstract sig ManualCheckTarget extends CheckTarget {}",
    "",
  ];

  for (const rule of rules) {
    const parent = rule.reviewStatus === "approved" && !rule.deprecated ? "ActiveApprovedRule" : rule.deprecated ? "DeprecatedRule" : "Rule";
    lines.push(`one sig R_${sanitizeIdentifier(rule.id)} extends ${parent} {}`);
  }
  const activeRuleNames = rules
    .filter((rule) => rule.reviewStatus === "approved" && !rule.deprecated)
    .map((rule) => `R_${sanitizeIdentifier(rule.id)}`);
  const deprecatedRuleNames = rules
    .filter((rule) => rule.deprecated)
    .map((rule) => `R_${sanitizeIdentifier(rule.id)}`);
  // Alloy treats an abstract signature with no subsignatures as a set that may
  // still contain atoms. Make the generated classification exact so models
  // with zero approved rules do not invent an ActiveApprovedRule witness.
  lines.push("", "fact GeneratedRuleClasses {");
  lines.push(`  ActiveApprovedRule = ${activeRuleNames.length > 0 ? activeRuleNames.join(" + ") : "none"}`);
  lines.push(`  DeprecatedRule = ${deprecatedRuleNames.length > 0 ? deprecatedRuleNames.join(" + ") : "none"}`);
  lines.push("}");
  lines.push("");
  rules.forEach((rule, index) => {
    for (const [target, targetIndex] of list(rule.checks).map((candidate, idx) => [candidate, idx])) {
      const parent = target.backend === "manual" || target.backend === "runtime" ? "ManualCheckTarget" : "AutomatedCheckTarget";
      lines.push(`one sig C_${index}_${targetIndex} extends ${parent} {}`);
    }
  });

  const db = dbPattern(model);
  if (db) {
    lines.push(
      "",
      "abstract sig DbTable {}",
      "abstract sig DbInvariant {}",
      "abstract sig DbTransaction {}",
      "abstract sig DbMigration {}",
      "abstract sig DbMapping {}",
      "one sig DbModel {",
      "  dbTables: set DbTable,",
      "  dbInvariants: set DbInvariant,",
      "  dbTransactions: set DbTransaction,",
      "  dbMigrations: set DbMigration,",
      "  dbMappings: set DbMapping,",
      "  dbWrites: DbTransaction -> set DbTable,",
      "  dbPreserves: DbTransaction -> set DbInvariant,",
      "  dbTouches: DbTransaction -> set DbInvariant,",
      "  dbMigrationPreserves: DbMigration -> set DbInvariant,",
      "  dbMigrationTouches: DbMigration -> set DbInvariant,",
      "  dbMigrationMappings: DbMigration -> set DbMapping,",
      "  dbMappingCovers: DbMapping -> set DbInvariant,",
      "  dbMigrationSources: DbMigration -> set DbTable,",
      "  dbMigrationTargets: DbMigration -> set DbTable,",
      "  dbMappingMentionsSource: DbMapping -> set DbTable,",
      "  dbMappingMentionsTarget: DbMapping -> set DbTable",
      "}",
    );
    for (const table of dbTables(db).sort(byId)) {
      lines.push(`one sig ${dbName("DBT", table.id)} extends DbTable {}`);
    }
    for (const invariant of dbInvariants(db).sort(byId)) {
      lines.push(`one sig ${dbName("DBI", invariant.id)} extends DbInvariant {}`);
    }
    for (const transaction of dbTransactions(db).sort(byId)) {
      lines.push(`one sig ${dbName("DBTX", transaction.id)} extends DbTransaction {}`);
    }
    for (const migration of dbMigrations(db).sort(byId)) {
      lines.push(`one sig ${dbName("DBM", migration.id)} extends DbMigration {}`);
      for (const mapping of list(migration.mappings).sort(byId)) {
        lines.push(`one sig ${dbMappingName(migration, mapping)} extends DbMapping {}`);
      }
    }
    lines.push("", "fact GeneratedDbModel {");
    const tableSet = dbTables(db).map((table) => dbName("DBT", table.id));
    const invariantSet = dbInvariants(db).map((invariant) => dbName("DBI", invariant.id));
    const transactionSet = dbTransactions(db).map((transaction) => dbName("DBTX", transaction.id));
    const migrationSet = dbMigrations(db).map((migration) => dbName("DBM", migration.id));
    const mappingSet = dbMigrations(db).flatMap((migration) => list(migration.mappings).map((mapping) => dbMappingName(migration, mapping)));
    lines.push(`  DbModel.dbTables = ${tableSet.length > 0 ? tableSet.join(" + ") : "none"}`);
    lines.push(`  DbModel.dbInvariants = ${invariantSet.length > 0 ? invariantSet.join(" + ") : "none"}`);
    lines.push(`  DbModel.dbTransactions = ${transactionSet.length > 0 ? transactionSet.join(" + ") : "none"}`);
    lines.push(`  DbModel.dbMigrations = ${migrationSet.length > 0 ? migrationSet.join(" + ") : "none"}`);
    lines.push(`  DbModel.dbMappings = ${mappingSet.length > 0 ? mappingSet.join(" + ") : "none"}`);
    const writePairs = [];
    const preservePairs = [];
    const touchPairs = [];
    const migrationPreservePairs = [];
    const migrationTouchPairs = [];
    const migrationMappingPairs = [];
    const mappingCoverPairs = [];
    const migrationSourcePairs = [];
    const migrationTargetPairs = [];
    const mappingMentionSourcePairs = [];
    const mappingMentionTargetPairs = [];
    for (const transaction of dbTransactions(db)) {
      for (const tableId of list(transaction.writes)) {
        writePairs.push(`${dbName("DBTX", transaction.id)} -> ${dbName("DBT", tableId)}`);
      }
      for (const invariantId of list(transaction.preserves)) {
        preservePairs.push(`${dbName("DBTX", transaction.id)} -> ${dbName("DBI", invariantId)}`);
      }
      for (const invariantId of dbTouchedInvariantIds(db, transaction)) {
        touchPairs.push(`${dbName("DBTX", transaction.id)} -> ${dbName("DBI", invariantId)}`);
      }
    }
    for (const migration of dbMigrations(db)) {
      for (const tableId of list(migration.fromTables)) {
        migrationSourcePairs.push(`${dbName("DBM", migration.id)} -> ${dbName("DBT", tableId)}`);
      }
      for (const tableId of list(migration.toTables)) {
        migrationTargetPairs.push(`${dbName("DBM", migration.id)} -> ${dbName("DBT", tableId)}`);
      }
      for (const invariantId of list(migration.preserves)) {
        migrationPreservePairs.push(`${dbName("DBM", migration.id)} -> ${dbName("DBI", invariantId)}`);
      }
      for (const invariantId of dbMigrationTouchedInvariantIds(db, migration)) {
        migrationTouchPairs.push(`${dbName("DBM", migration.id)} -> ${dbName("DBI", invariantId)}`);
      }
      for (const mapping of list(migration.mappings)) {
        migrationMappingPairs.push(`${dbName("DBM", migration.id)} -> ${dbMappingName(migration, mapping)}`);
        for (const invariantId of list(mapping.invariants)) {
          mappingCoverPairs.push(`${dbMappingName(migration, mapping)} -> ${dbName("DBI", invariantId)}`);
        }
        for (const tableId of dbMappingMentionedSourceTableIds(migration, mapping)) {
          mappingMentionSourcePairs.push(`${dbMappingName(migration, mapping)} -> ${dbName("DBT", tableId)}`);
        }
        for (const tableId of dbMappingMentionedTargetTableIds(migration, mapping)) {
          mappingMentionTargetPairs.push(`${dbMappingName(migration, mapping)} -> ${dbName("DBT", tableId)}`);
        }
      }
    }
    const relationOrEmpty = (pairs) => pairs.length > 0 ? pairs.join(" + ") : "none -> none";
    lines.push(`  DbModel.dbWrites = ${relationOrEmpty(writePairs)}`);
    lines.push(`  DbModel.dbPreserves = ${relationOrEmpty(preservePairs)}`);
    lines.push(`  DbModel.dbTouches = ${relationOrEmpty(touchPairs)}`);
    lines.push(`  DbModel.dbMigrationPreserves = ${relationOrEmpty(migrationPreservePairs)}`);
    lines.push(`  DbModel.dbMigrationTouches = ${relationOrEmpty(migrationTouchPairs)}`);
    lines.push(`  DbModel.dbMigrationMappings = ${relationOrEmpty(migrationMappingPairs)}`);
    lines.push(`  DbModel.dbMappingCovers = ${relationOrEmpty(mappingCoverPairs)}`);
    lines.push(`  DbModel.dbMigrationSources = ${relationOrEmpty(migrationSourcePairs)}`);
    lines.push(`  DbModel.dbMigrationTargets = ${relationOrEmpty(migrationTargetPairs)}`);
    lines.push(`  DbModel.dbMappingMentionsSource = ${relationOrEmpty(mappingMentionSourcePairs)}`);
    lines.push(`  DbModel.dbMappingMentionsTarget = ${relationOrEmpty(mappingMentionTargetPairs)}`);
    lines.push("}", "", "assert DbTransactionsPreserveInvariants {");
    lines.push("  all tx: DbModel.dbTransactions | DbModel.dbTouches[tx] in DbModel.dbPreserves[tx]");
    lines.push("}", "check DbTransactionsPreserveInvariants");
    lines.push("", "assert DbMigrationsPreserveInvariants {");
    lines.push("  all migration: DbModel.dbMigrations | DbModel.dbMigrationTouches[migration] in DbModel.dbMigrationPreserves[migration]");
    lines.push("}", "check DbMigrationsPreserveInvariants");
    lines.push("", "assert DbMigrationMappingsCoverInvariants {");
    lines.push("  all migration: DbModel.dbMigrations | DbModel.dbMigrationPreserves[migration] in DbModel.dbMappingCovers[DbModel.dbMigrationMappings[migration]]");
    lines.push("}", "check DbMigrationMappingsCoverInvariants");
    lines.push("", "assert DbMigrationMappingExpressionsMentionTables {");
    lines.push("  all migration: DbModel.dbMigrations, mapping: DbModel.dbMigrationMappings[migration] |");
    lines.push("    some DbModel.dbMappingMentionsSource[mapping] & DbModel.dbMigrationSources[migration] and");
    lines.push("    some DbModel.dbMappingMentionsTarget[mapping] & DbModel.dbMigrationTargets[migration]");
    lines.push("}", "check DbMigrationMappingExpressionsMentionTables");
  }

  const cloud = cloudPattern(model);
  if (cloud) {
    lines.push(
      "",
      "abstract sig CloudNode {}",
      "abstract sig CloudFlow {}",
      "abstract sig CloudPolicy {}",
      "one sig CloudModel {",
      "  cloudNodes: set CloudNode,",
      "  cloudFlows: set CloudFlow,",
      "  cloudPolicies: set CloudPolicy,",
      "  cloudPublicIngress: set CloudNode,",
      "  cloudSensitiveResources: set CloudNode,",
      "  cloudFlowFrom: CloudFlow -> one CloudNode,",
      "  cloudFlowTo: CloudFlow -> one CloudNode,",
      "  cloudRequiresPolicy: set CloudFlow,",
      "  cloudAllowedByPolicy: set CloudFlow,",
      "  cloudTenantScopedNodes: set CloudNode,",
      "  cloudTenantPropagatedFlows: set CloudFlow,",
      "  cloudQueuePublishes: set CloudFlow,",
      "  cloudIdempotentFlows: set CloudFlow",
      "}",
    );
    for (const node of cloudNodes(cloud).sort(byId)) {
      lines.push(`one sig ${cloudName("CN", node.id)} extends CloudNode {}`);
    }
    for (const flow of cloudFlows(cloud).sort(byId)) {
      lines.push(`one sig ${cloudName("CF", flow.id)} extends CloudFlow {}`);
    }
    for (const policy of cloudPolicies(cloud).sort(byId)) {
      lines.push(`one sig ${cloudName("CP", policy.id)} extends CloudPolicy {}`);
    }

    const nodeSet = cloudNodes(cloud).map((node) => cloudName("CN", node.id));
    const flowSet = cloudFlows(cloud).map((flow) => cloudName("CF", flow.id));
    const policySet = cloudPolicies(cloud).map((policy) => cloudName("CP", policy.id));
    const flowFromPairs = cloudFlows(cloud).map((flow) => `${cloudName("CF", flow.id)} -> ${cloudName("CN", flow.from)}`);
    const flowToPairs = cloudFlows(cloud).map((flow) => `${cloudName("CF", flow.id)} -> ${cloudName("CN", flow.to)}`);
    const publicIngress = cloudPublicIngressNodeIds(cloud).map((nodeId) => cloudName("CN", nodeId));
    const sensitive = cloudSensitiveNodeIds(cloud).map((nodeId) => cloudName("CN", nodeId));
    const requiresPolicy = cloudRequiresPolicyFlowIds(cloud).map((flowId) => cloudName("CF", flowId));
    const allowedByPolicy = cloudAllowedByPolicyFlowIds(cloud).map((flowId) => cloudName("CF", flowId));
    const tenantScoped = cloudTenantScopedNodeIds(cloud).map((nodeId) => cloudName("CN", nodeId));
    const tenantPropagated = cloudTenantPropagatedFlowIds(cloud).map((flowId) => cloudName("CF", flowId));
    const queuePublishes = cloudQueuePublishFlowIds(cloud).map((flowId) => cloudName("CF", flowId));
    const idempotent = cloudIdempotentFlowIds(cloud).map((flowId) => cloudName("CF", flowId));

    lines.push("", "fact GeneratedCloudModel {");
    lines.push(`  CloudModel.cloudNodes = ${nodeSet.length > 0 ? nodeSet.join(" + ") : "none"}`);
    lines.push(`  CloudModel.cloudFlows = ${flowSet.length > 0 ? flowSet.join(" + ") : "none"}`);
    lines.push(`  CloudModel.cloudPolicies = ${policySet.length > 0 ? policySet.join(" + ") : "none"}`);
    const cloudRelationOrEmpty = (pairs) => pairs.length > 0 ? pairs.join(" + ") : "none -> none";
    lines.push(`  CloudModel.cloudFlowFrom = ${cloudRelationOrEmpty(flowFromPairs)}`);
    lines.push(`  CloudModel.cloudFlowTo = ${cloudRelationOrEmpty(flowToPairs)}`);
    lines.push(`  CloudModel.cloudPublicIngress = ${publicIngress.length > 0 ? publicIngress.join(" + ") : "none"}`);
    lines.push(`  CloudModel.cloudSensitiveResources = ${sensitive.length > 0 ? sensitive.join(" + ") : "none"}`);
    lines.push(`  CloudModel.cloudRequiresPolicy = ${requiresPolicy.length > 0 ? requiresPolicy.join(" + ") : "none"}`);
    lines.push(`  CloudModel.cloudAllowedByPolicy = ${allowedByPolicy.length > 0 ? allowedByPolicy.join(" + ") : "none"}`);
    lines.push(`  CloudModel.cloudTenantScopedNodes = ${tenantScoped.length > 0 ? tenantScoped.join(" + ") : "none"}`);
    lines.push(`  CloudModel.cloudTenantPropagatedFlows = ${tenantPropagated.length > 0 ? tenantPropagated.join(" + ") : "none"}`);
    lines.push(`  CloudModel.cloudQueuePublishes = ${queuePublishes.length > 0 ? queuePublishes.join(" + ") : "none"}`);
    lines.push(`  CloudModel.cloudIdempotentFlows = ${idempotent.length > 0 ? idempotent.join(" + ") : "none"}`);
    lines.push("}", "", "assert CloudPublicIngressBlocked {");
    lines.push("  all flow: CloudModel.cloudFlows | CloudModel.cloudFlowFrom[flow] in CloudModel.cloudPublicIngress implies CloudModel.cloudFlowTo[flow] not in CloudModel.cloudSensitiveResources");
    lines.push("}", "check CloudPublicIngressBlocked");
    lines.push("", "assert CloudResourceAccessHasPolicy {");
    lines.push("  CloudModel.cloudRequiresPolicy in CloudModel.cloudAllowedByPolicy");
    lines.push("}", "check CloudResourceAccessHasPolicy");
    lines.push("", "assert CloudTenantFlowsPropagateTenant {");
    lines.push("  all flow: CloudModel.cloudFlows | some ((CloudModel.cloudFlowFrom[flow] + CloudModel.cloudFlowTo[flow]) & CloudModel.cloudTenantScopedNodes) implies flow in CloudModel.cloudTenantPropagatedFlows");
    lines.push("}", "check CloudTenantFlowsPropagateTenant");
    lines.push("", "assert CloudQueuePublishesHaveIdempotencyKey {");
    lines.push("  CloudModel.cloudQueuePublishes in CloudModel.cloudIdempotentFlows");
    lines.push("}", "check CloudQueuePublishesHaveIdempotencyKey");
  }

  const data = dataPattern(model);
  if (data) {
    lines.push(
      "",
      "abstract sig DataPolicy {}",
      "abstract sig DataSet {}",
      "abstract sig DataStore {}",
      "abstract sig DataPlacement {}",
      "abstract sig DataFlow {}",
      "one sig DataModel {",
      "  dataPolicies: set DataPolicy,",
      "  dataSets: set DataSet,",
      "  dataStores: set DataStore,",
      "  dataPlacements: set DataPlacement,",
      "  dataFlows: set DataFlow,",
      "  dataSensitivePlacements: set DataPlacement,",
      "  dataEncryptedPlacements: set DataPlacement,",
      "  dataPersonalPlacements: set DataPlacement,",
      "  dataDeletionSupportedPlacements: set DataPlacement,",
      "  dataCrossRegionFlows: set DataFlow,",
      "  dataLegalBasisFlows: set DataFlow,",
      "  dataRetentionScopedSets: set DataSet,",
      "  dataRetentionCompliantSets: set DataSet",
      "}",
    );
    for (const policy of dataPolicies(data).sort(byId)) {
      lines.push(`one sig ${dataName("DPOL", policy.id)} extends DataPolicy {}`);
    }
    for (const dataset of dataSets(data).sort(byId)) {
      lines.push(`one sig ${dataName("DS", dataset.id)} extends DataSet {}`);
    }
    for (const store of dataStores(data).sort(byId)) {
      lines.push(`one sig ${dataName("DSTORE", store.id)} extends DataStore {}`);
    }
    for (const placement of dataPlacements(data).sort(byId)) {
      lines.push(`one sig ${dataName("DPL", placement.id)} extends DataPlacement {}`);
    }
    for (const flow of dataFlows(data).sort(byId)) {
      lines.push(`one sig ${dataName("DF", flow.id)} extends DataFlow {}`);
    }

    const policySet = dataPolicies(data).map((policy) => dataName("DPOL", policy.id));
    const datasetSet = dataSets(data).map((dataset) => dataName("DS", dataset.id));
    const storeSet = dataStores(data).map((store) => dataName("DSTORE", store.id));
    const placementSet = dataPlacements(data).map((placement) => dataName("DPL", placement.id));
    const flowSet = dataFlows(data).map((flow) => dataName("DF", flow.id));
    const sensitivePlacements = dataSensitivePlacementIds(data).map((id) => dataName("DPL", id));
    const encryptedPlacements = dataEncryptedPlacementIds(data).map((id) => dataName("DPL", id));
    const personalPlacements = dataPersonalPlacementIds(data).map((id) => dataName("DPL", id));
    const deletionPlacements = dataDeletionSupportedPlacementIds(data).map((id) => dataName("DPL", id));
    const crossRegionFlows = dataCrossRegionFlowIds(data).map((id) => dataName("DF", id));
    const legalBasisFlows = dataLegalBasisFlowIds(data).map((id) => dataName("DF", id));
    const retentionScoped = dataRetentionScopedDataSetIds(data).map((id) => dataName("DS", id));
    const retentionCompliant = dataRetentionCompliantDataSetIds(data).map((id) => dataName("DS", id));

    lines.push("", "fact GeneratedDataModel {");
    lines.push(`  DataModel.dataPolicies = ${policySet.length > 0 ? policySet.join(" + ") : "none"}`);
    lines.push(`  DataModel.dataSets = ${datasetSet.length > 0 ? datasetSet.join(" + ") : "none"}`);
    lines.push(`  DataModel.dataStores = ${storeSet.length > 0 ? storeSet.join(" + ") : "none"}`);
    lines.push(`  DataModel.dataPlacements = ${placementSet.length > 0 ? placementSet.join(" + ") : "none"}`);
    lines.push(`  DataModel.dataFlows = ${flowSet.length > 0 ? flowSet.join(" + ") : "none"}`);
    lines.push(`  DataModel.dataSensitivePlacements = ${sensitivePlacements.length > 0 ? sensitivePlacements.join(" + ") : "none"}`);
    lines.push(`  DataModel.dataEncryptedPlacements = ${encryptedPlacements.length > 0 ? encryptedPlacements.join(" + ") : "none"}`);
    lines.push(`  DataModel.dataPersonalPlacements = ${personalPlacements.length > 0 ? personalPlacements.join(" + ") : "none"}`);
    lines.push(`  DataModel.dataDeletionSupportedPlacements = ${deletionPlacements.length > 0 ? deletionPlacements.join(" + ") : "none"}`);
    lines.push(`  DataModel.dataCrossRegionFlows = ${crossRegionFlows.length > 0 ? crossRegionFlows.join(" + ") : "none"}`);
    lines.push(`  DataModel.dataLegalBasisFlows = ${legalBasisFlows.length > 0 ? legalBasisFlows.join(" + ") : "none"}`);
    lines.push(`  DataModel.dataRetentionScopedSets = ${retentionScoped.length > 0 ? retentionScoped.join(" + ") : "none"}`);
    lines.push(`  DataModel.dataRetentionCompliantSets = ${retentionCompliant.length > 0 ? retentionCompliant.join(" + ") : "none"}`);
    lines.push("}", "", "assert DataSensitivePlacementsEncrypted {");
    lines.push("  DataModel.dataSensitivePlacements in DataModel.dataEncryptedPlacements");
    lines.push("}", "check DataSensitivePlacementsEncrypted");
    lines.push("", "assert DataPersonalPlacementsSupportDeletion {");
    lines.push("  DataModel.dataPersonalPlacements in DataModel.dataDeletionSupportedPlacements");
    lines.push("}", "check DataPersonalPlacementsSupportDeletion");
    lines.push("", "assert DataCrossRegionFlowsHaveLegalBasis {");
    lines.push("  DataModel.dataCrossRegionFlows in DataModel.dataLegalBasisFlows");
    lines.push("}", "check DataCrossRegionFlowsHaveLegalBasis");
    lines.push("", "assert DataRetentionWithinPolicy {");
    lines.push("  DataModel.dataRetentionScopedSets in DataModel.dataRetentionCompliantSets");
    lines.push("}", "check DataRetentionWithinPolicy");
  }

  const release = releasePattern(model);
  if (release) {
    lines.push(
      "",
      "abstract sig ReleaseService {}",
      "abstract sig ReleaseEnvironment {}",
      "abstract sig ReleaseGate {}",
      "abstract sig ReleaseRollback {}",
      "abstract sig ReleaseMigration {}",
      "abstract sig ReleaseStep {}",
      "one sig ReleaseModel {",
      "  releaseServices: set ReleaseService,",
      "  releaseEnvironments: set ReleaseEnvironment,",
      "  releaseGates: set ReleaseGate,",
      "  releaseRollbacks: set ReleaseRollback,",
      "  releaseMigrations: set ReleaseMigration,",
      "  releaseSteps: set ReleaseStep,",
      "  releaseProductionSteps: set ReleaseStep,",
      "  releaseHealthGatedSteps: set ReleaseStep,",
      "  releaseTrafficShiftSteps: set ReleaseStep,",
      "  releaseRollbackPlannedSteps: set ReleaseStep,",
      "  releaseRollbackTestedSteps: set ReleaseStep,",
      "  releaseMigrationScopedSteps: set ReleaseStep,",
      "  releaseMigrationCompatibleSteps: set ReleaseStep",
      "}",
    );
    for (const service of releaseServices(release).sort(byId)) {
      lines.push(`one sig ${releaseName("RSVC", service.id)} extends ReleaseService {}`);
    }
    for (const environment of releaseEnvironments(release).sort(byId)) {
      lines.push(`one sig ${releaseName("RENV", environment.id)} extends ReleaseEnvironment {}`);
    }
    for (const gate of releaseGates(release).sort(byId)) {
      lines.push(`one sig ${releaseName("RG", gate.id)} extends ReleaseGate {}`);
    }
    for (const rollback of releaseRollbacks(release).sort(byId)) {
      lines.push(`one sig ${releaseName("RR", rollback.id)} extends ReleaseRollback {}`);
    }
    for (const migration of releaseMigrations(release).sort(byId)) {
      lines.push(`one sig ${releaseName("RM", migration.id)} extends ReleaseMigration {}`);
    }
    for (const step of releaseSteps(release).sort(byId)) {
      lines.push(`one sig ${releaseName("RS", step.id)} extends ReleaseStep {}`);
    }

    const serviceSet = releaseServices(release).map((service) => releaseName("RSVC", service.id));
    const environmentSet = releaseEnvironments(release).map((environment) => releaseName("RENV", environment.id));
    const gateSet = releaseGates(release).map((gate) => releaseName("RG", gate.id));
    const rollbackSet = releaseRollbacks(release).map((rollback) => releaseName("RR", rollback.id));
    const migrationSet = releaseMigrations(release).map((migration) => releaseName("RM", migration.id));
    const stepSet = releaseSteps(release).map((step) => releaseName("RS", step.id));
    const productionSteps = releaseProductionStepIds(release).map((id) => releaseName("RS", id));
    const healthGatedSteps = releaseHealthGatedStepIds(release).map((id) => releaseName("RS", id));
    const trafficShiftSteps = releaseTrafficShiftStepIds(release).map((id) => releaseName("RS", id));
    const rollbackPlannedSteps = releaseRollbackPlannedStepIds(release).map((id) => releaseName("RS", id));
    const rollbackTestedSteps = releaseRollbackTestedStepIds(release).map((id) => releaseName("RS", id));
    const migrationScopedSteps = releaseMigrationScopedStepIds(release).map((id) => releaseName("RS", id));
    const migrationCompatibleSteps = releaseMigrationCompatibleStepIds(release).map((id) => releaseName("RS", id));

    lines.push("", "fact GeneratedReleaseModel {");
    lines.push(`  ReleaseModel.releaseServices = ${serviceSet.length > 0 ? serviceSet.join(" + ") : "none"}`);
    lines.push(`  ReleaseModel.releaseEnvironments = ${environmentSet.length > 0 ? environmentSet.join(" + ") : "none"}`);
    lines.push(`  ReleaseModel.releaseGates = ${gateSet.length > 0 ? gateSet.join(" + ") : "none"}`);
    lines.push(`  ReleaseModel.releaseRollbacks = ${rollbackSet.length > 0 ? rollbackSet.join(" + ") : "none"}`);
    lines.push(`  ReleaseModel.releaseMigrations = ${migrationSet.length > 0 ? migrationSet.join(" + ") : "none"}`);
    lines.push(`  ReleaseModel.releaseSteps = ${stepSet.length > 0 ? stepSet.join(" + ") : "none"}`);
    lines.push(`  ReleaseModel.releaseProductionSteps = ${productionSteps.length > 0 ? productionSteps.join(" + ") : "none"}`);
    lines.push(`  ReleaseModel.releaseHealthGatedSteps = ${healthGatedSteps.length > 0 ? healthGatedSteps.join(" + ") : "none"}`);
    lines.push(`  ReleaseModel.releaseTrafficShiftSteps = ${trafficShiftSteps.length > 0 ? trafficShiftSteps.join(" + ") : "none"}`);
    lines.push(`  ReleaseModel.releaseRollbackPlannedSteps = ${rollbackPlannedSteps.length > 0 ? rollbackPlannedSteps.join(" + ") : "none"}`);
    lines.push(`  ReleaseModel.releaseRollbackTestedSteps = ${rollbackTestedSteps.length > 0 ? rollbackTestedSteps.join(" + ") : "none"}`);
    lines.push(`  ReleaseModel.releaseMigrationScopedSteps = ${migrationScopedSteps.length > 0 ? migrationScopedSteps.join(" + ") : "none"}`);
    lines.push(`  ReleaseModel.releaseMigrationCompatibleSteps = ${migrationCompatibleSteps.length > 0 ? migrationCompatibleSteps.join(" + ") : "none"}`);
    lines.push("}", "", "assert ReleaseProductionStepsHaveHealthGate {");
    lines.push("  ReleaseModel.releaseProductionSteps in ReleaseModel.releaseHealthGatedSteps");
    lines.push("}", "check ReleaseProductionStepsHaveHealthGate");
    lines.push("", "assert ReleaseTrafficShiftsHaveRollback {");
    lines.push("  ReleaseModel.releaseTrafficShiftSteps in ReleaseModel.releaseRollbackPlannedSteps");
    lines.push("}", "check ReleaseTrafficShiftsHaveRollback");
    lines.push("", "assert ReleaseRollbackPlansAreTested {");
    lines.push("  ReleaseModel.releaseRollbackPlannedSteps in ReleaseModel.releaseRollbackTestedSteps");
    lines.push("}", "check ReleaseRollbackPlansAreTested");
    lines.push("", "assert ReleaseMigrationsAreBackwardCompatible {");
    lines.push("  ReleaseModel.releaseMigrationScopedSteps in ReleaseModel.releaseMigrationCompatibleSteps");
    lines.push("}", "check ReleaseMigrationsAreBackwardCompatible");
  }

  const runtime = runtimePattern(model);
  if (runtime) {
    lines.push(
      "",
      "abstract sig RuntimeService {}",
      "abstract sig RuntimeDependency {}",
      "abstract sig RuntimeSignal {}",
      "abstract sig RuntimeRunbook {}",
      "abstract sig RuntimeAlert {}",
      "abstract sig RuntimeSlo {}",
      "abstract sig RuntimeTelemetry {}",
      "abstract sig RuntimeAlertPolicy {}",
      "abstract sig RuntimeRunbookExecution {}",
      "abstract sig RuntimeDependencyTrace {}",
      "one sig RuntimeModel {",
      "  runtimeServices: set RuntimeService,",
      "  runtimeDependencies: set RuntimeDependency,",
      "  runtimeSignals: set RuntimeSignal,",
      "  runtimeRunbooks: set RuntimeRunbook,",
      "  runtimeAlerts: set RuntimeAlert,",
      "  runtimeSlos: set RuntimeSlo,",
      "  runtimeTelemetry: set RuntimeTelemetry,",
      "  runtimeAlertPolicies: set RuntimeAlertPolicy,",
      "  runtimeRunbookExecutions: set RuntimeRunbookExecution,",
      "  runtimeDependencyTraces: set RuntimeDependencyTrace,",
      "  runtimeCriticalSlos: set RuntimeSlo,",
      "  runtimePageAlertedSlos: set RuntimeSlo,",
      "  runtimePageAlerts: set RuntimeAlert,",
      "  runtimeTestedRunbookAlerts: set RuntimeAlert,",
      "  runtimeTimeoutDependencies: set RuntimeDependency,",
      "  runtimeRetryDependencies: set RuntimeDependency,",
      "  runtimeIdempotentDependencies: set RuntimeDependency,",
      "  runtimeTelemetrySlos: set RuntimeSlo,",
      "  runtimePassingTelemetry: set RuntimeTelemetry,",
      "  runtimeEnabledPolicyAlerts: set RuntimeAlert,",
      "  runtimeExecutedRunbookAlerts: set RuntimeAlert,",
      "  runtimeTimeoutCompliantTraces: set RuntimeDependencyTrace",
      "}",
    );
    for (const service of runtimeServices(runtime).sort(byId)) {
      lines.push(`one sig ${runtimeName("RTSVC", service.id)} extends RuntimeService {}`);
    }
    for (const dependency of runtimeDependencies(runtime).sort(byId)) {
      lines.push(`one sig ${runtimeName("RDEP", dependency.id)} extends RuntimeDependency {}`);
    }
    for (const signal of runtimeSignals(runtime).sort(byId)) {
      lines.push(`one sig ${runtimeName("RSIG", signal.id)} extends RuntimeSignal {}`);
    }
    for (const runbook of runtimeRunbooks(runtime).sort(byId)) {
      lines.push(`one sig ${runtimeName("RRB", runbook.id)} extends RuntimeRunbook {}`);
    }
    for (const alert of runtimeAlerts(runtime).sort(byId)) {
      lines.push(`one sig ${runtimeName("RALERT", alert.id)} extends RuntimeAlert {}`);
    }
    for (const slo of runtimeSlos(runtime).sort(byId)) {
      lines.push(`one sig ${runtimeName("RSLO", slo.id)} extends RuntimeSlo {}`);
    }
    for (const window of runtimeTelemetry(runtime).sort(byId)) {
      lines.push(`one sig ${runtimeName("RTELEM", window.id)} extends RuntimeTelemetry {}`);
    }
    for (const policy of runtimeAlertPolicies(runtime).sort(byId)) {
      lines.push(`one sig ${runtimeName("RPOL", policy.id)} extends RuntimeAlertPolicy {}`);
    }
    for (const execution of runtimeRunbookExecutions(runtime).sort(byId)) {
      lines.push(`one sig ${runtimeName("REXEC", execution.id)} extends RuntimeRunbookExecution {}`);
    }
    for (const trace of runtimeDependencyTraces(runtime).sort(byId)) {
      lines.push(`one sig ${runtimeName("RTR", trace.id)} extends RuntimeDependencyTrace {}`);
    }

    const serviceSet = runtimeServices(runtime).map((service) => runtimeName("RTSVC", service.id));
    const dependencySet = runtimeDependencies(runtime).map((dependency) => runtimeName("RDEP", dependency.id));
    const signalSet = runtimeSignals(runtime).map((signal) => runtimeName("RSIG", signal.id));
    const runbookSet = runtimeRunbooks(runtime).map((runbook) => runtimeName("RRB", runbook.id));
    const alertSet = runtimeAlerts(runtime).map((alert) => runtimeName("RALERT", alert.id));
    const sloSet = runtimeSlos(runtime).map((slo) => runtimeName("RSLO", slo.id));
    const telemetrySet = runtimeTelemetry(runtime).map((window) => runtimeName("RTELEM", window.id));
    const alertPolicySet = runtimeAlertPolicies(runtime).map((policy) => runtimeName("RPOL", policy.id));
    const runbookExecutionSet = runtimeRunbookExecutions(runtime).map((execution) => runtimeName("REXEC", execution.id));
    const dependencyTraceSet = runtimeDependencyTraces(runtime).map((trace) => runtimeName("RTR", trace.id));
    const criticalSlos = runtimeCriticalSloIds(runtime).map((id) => runtimeName("RSLO", id));
    const pageAlertedSlos = runtimePageAlertedSloIds(runtime).map((id) => runtimeName("RSLO", id));
    const pageAlerts = runtimePageAlertIds(runtime).map((id) => runtimeName("RALERT", id));
    const testedRunbookAlerts = runtimeTestedRunbookAlertIds(runtime).map((id) => runtimeName("RALERT", id));
    const timeoutDependencies = runtimeTimeoutDependencyIds(runtime).map((id) => runtimeName("RDEP", id));
    const retryDependencies = runtimeRetryDependencyIds(runtime).map((id) => runtimeName("RDEP", id));
    const idempotentDependencies = runtimeIdempotentDependencyIds(runtime).map((id) => runtimeName("RDEP", id));
    const telemetrySlos = runtimeTelemetrySloIds(runtime).map((id) => runtimeName("RSLO", id));
    const passingTelemetry = runtimePassingTelemetryIds(runtime).map((id) => runtimeName("RTELEM", id));
    const enabledPolicyAlerts = runtimeEnabledPolicyAlertIds(runtime).map((id) => runtimeName("RALERT", id));
    const executedRunbookAlerts = runtimeExecutedRunbookAlertIds(runtime).map((id) => runtimeName("RALERT", id));
    const timeoutCompliantTraces = runtimeTimeoutCompliantTraceIds(runtime).map((id) => runtimeName("RTR", id));

    lines.push("", "fact GeneratedRuntimeModel {");
    lines.push(`  RuntimeModel.runtimeServices = ${serviceSet.length > 0 ? serviceSet.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeDependencies = ${dependencySet.length > 0 ? dependencySet.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeSignals = ${signalSet.length > 0 ? signalSet.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeRunbooks = ${runbookSet.length > 0 ? runbookSet.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeAlerts = ${alertSet.length > 0 ? alertSet.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeSlos = ${sloSet.length > 0 ? sloSet.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeTelemetry = ${telemetrySet.length > 0 ? telemetrySet.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeAlertPolicies = ${alertPolicySet.length > 0 ? alertPolicySet.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeRunbookExecutions = ${runbookExecutionSet.length > 0 ? runbookExecutionSet.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeDependencyTraces = ${dependencyTraceSet.length > 0 ? dependencyTraceSet.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeCriticalSlos = ${criticalSlos.length > 0 ? criticalSlos.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimePageAlertedSlos = ${pageAlertedSlos.length > 0 ? pageAlertedSlos.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimePageAlerts = ${pageAlerts.length > 0 ? pageAlerts.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeTestedRunbookAlerts = ${testedRunbookAlerts.length > 0 ? testedRunbookAlerts.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeTimeoutDependencies = ${timeoutDependencies.length > 0 ? timeoutDependencies.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeRetryDependencies = ${retryDependencies.length > 0 ? retryDependencies.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeIdempotentDependencies = ${idempotentDependencies.length > 0 ? idempotentDependencies.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeTelemetrySlos = ${telemetrySlos.length > 0 ? telemetrySlos.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimePassingTelemetry = ${passingTelemetry.length > 0 ? passingTelemetry.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeEnabledPolicyAlerts = ${enabledPolicyAlerts.length > 0 ? enabledPolicyAlerts.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeExecutedRunbookAlerts = ${executedRunbookAlerts.length > 0 ? executedRunbookAlerts.join(" + ") : "none"}`);
    lines.push(`  RuntimeModel.runtimeTimeoutCompliantTraces = ${timeoutCompliantTraces.length > 0 ? timeoutCompliantTraces.join(" + ") : "none"}`);
    lines.push("}", "", "assert RuntimeCriticalSlosHavePageAlert {");
    lines.push("  RuntimeModel.runtimeCriticalSlos in RuntimeModel.runtimePageAlertedSlos");
    lines.push("}", "check RuntimeCriticalSlosHavePageAlert");
    lines.push("", "assert RuntimePageAlertsHaveTestedRunbook {");
    lines.push("  RuntimeModel.runtimePageAlerts in RuntimeModel.runtimeTestedRunbookAlerts");
    lines.push("}", "check RuntimePageAlertsHaveTestedRunbook");
    lines.push("", "assert RuntimeDependenciesHaveTimeout {");
    lines.push("  RuntimeModel.runtimeDependencies in RuntimeModel.runtimeTimeoutDependencies");
    lines.push("}", "check RuntimeDependenciesHaveTimeout");
    lines.push("", "assert RuntimeRetriesAreIdempotent {");
    lines.push("  RuntimeModel.runtimeRetryDependencies in RuntimeModel.runtimeIdempotentDependencies");
    lines.push("}", "check RuntimeRetriesAreIdempotent");
    lines.push("", "assert RuntimeSlosHaveTelemetry {");
    lines.push("  RuntimeModel.runtimeSlos in RuntimeModel.runtimeTelemetrySlos");
    lines.push("}", "check RuntimeSlosHaveTelemetry");
    lines.push("", "assert RuntimeTelemetryMeetsSlo {");
    lines.push("  RuntimeModel.runtimeTelemetry in RuntimeModel.runtimePassingTelemetry");
    lines.push("}", "check RuntimeTelemetryMeetsSlo");
    lines.push("", "assert RuntimePageAlertsHaveEnabledPolicy {");
    lines.push("  RuntimeModel.runtimePageAlerts in RuntimeModel.runtimeEnabledPolicyAlerts");
    lines.push("}", "check RuntimePageAlertsHaveEnabledPolicy");
    lines.push("", "assert RuntimePageAlertsHaveExecutedRunbook {");
    lines.push("  RuntimeModel.runtimePageAlerts in RuntimeModel.runtimeExecutedRunbookAlerts");
    lines.push("}", "check RuntimePageAlertsHaveExecutedRunbook");
    lines.push("", "assert RuntimeDependencyTracesWithinTimeout {");
    lines.push("  RuntimeModel.runtimeDependencyTraces in RuntimeModel.runtimeTimeoutCompliantTraces");
    lines.push("}", "check RuntimeDependencyTracesWithinTimeout");
  }

  const intent = intentPattern(model);
  if (intent) {
    lines.push(
      "",
      "abstract sig IntentCapability {}",
      "abstract sig IntentOutcome {}",
      "abstract sig IntentProcess {}",
      "abstract sig ConstructionAuthority {}",
      "abstract sig IntentScenario {}",
      "one sig IntentModel {",
      "  intentCapabilities: set IntentCapability,",
      "  intentOutcomes: set IntentOutcome,",
      "  intentProcesses: set IntentProcess,",
      "  constructionAuthorities: set ConstructionAuthority,",
      "  intentScenarios: set IntentScenario,",
      "  processOutcomes: IntentProcess -> set IntentOutcome,",
      "  processConstructs: IntentProcess -> set IntentOutcome,",
      "  authorisedConstruction: IntentProcess -> IntentOutcome",
      "}",
    );
    for (const capability of intentCapabilities(intent).sort(byId)) {
      lines.push(`one sig ${intentName("IC", capability.id)} extends IntentCapability {}`);
    }
    for (const outcome of intentOutcomes(intent).sort(byId)) {
      lines.push(`one sig ${intentName("IO", outcome.id)} extends IntentOutcome {}`);
    }
    for (const process of intentProcesses(intent).sort(byId)) {
      lines.push(`one sig ${intentName("IP", process.id)} extends IntentProcess {}`);
    }
    for (const authority of constructionAuthorities(intent).sort(byId)) {
      lines.push(`one sig ${intentName("ICA", authority.id)} extends ConstructionAuthority {}`);
    }
    for (const scenario of intentScenarios(intent).sort(byId)) {
      lines.push(`one sig ${intentName("ISC", scenario.id)} extends IntentScenario {}`);
    }

    const capabilitySet = intentCapabilities(intent).map((capability) => intentName("IC", capability.id));
    const outcomeSet = intentOutcomes(intent).map((outcome) => intentName("IO", outcome.id));
    const processSet = intentProcesses(intent).map((process) => intentName("IP", process.id));
    const authoritySet = constructionAuthorities(intent).map((authority) => intentName("ICA", authority.id));
    const scenarioSet = intentScenarios(intent).map((scenario) => intentName("ISC", scenario.id));
    const processOutcomePairs = intentProcesses(intent).flatMap((process) =>
      list(process.outcomes).map((outcomeId) => `${intentName("IP", process.id)} -> ${intentName("IO", outcomeId)}`),
    );
    const processConstructPairs = intentProcesses(intent).flatMap((process) =>
      list(process.constructs).map((outcomeId) => `${intentName("IP", process.id)} -> ${intentName("IO", outcomeId)}`),
    );
    const authorisedConstructionPairs = constructionAuthorities(intent).map(
      (authority) => `${intentName("IP", authority.process)} -> ${intentName("IO", authority.outcome)}`,
    );

    lines.push("", "fact GeneratedIntentModel {");
    lines.push(`  IntentModel.intentCapabilities = ${capabilitySet.length > 0 ? capabilitySet.join(" + ") : "none"}`);
    lines.push(`  IntentModel.intentOutcomes = ${outcomeSet.length > 0 ? outcomeSet.join(" + ") : "none"}`);
    lines.push(`  IntentModel.intentProcesses = ${processSet.length > 0 ? processSet.join(" + ") : "none"}`);
    lines.push(`  IntentModel.constructionAuthorities = ${authoritySet.length > 0 ? authoritySet.join(" + ") : "none"}`);
    lines.push(`  IntentModel.intentScenarios = ${scenarioSet.length > 0 ? scenarioSet.join(" + ") : "none"}`);
    lines.push(`  IntentModel.processOutcomes = ${processOutcomePairs.length > 0 ? processOutcomePairs.join(" + ") : "none"}`);
    lines.push(`  IntentModel.processConstructs = ${processConstructPairs.length > 0 ? processConstructPairs.join(" + ") : "none"}`);
    lines.push(`  IntentModel.authorisedConstruction = ${authorisedConstructionPairs.length > 0 ? authorisedConstructionPairs.join(" + ") : "none"}`);
    lines.push("}", "", "assert IntentProcessConstructionIsAuthorized {");
    lines.push("  IntentModel.processOutcomes = IntentModel.processConstructs");
    lines.push("  IntentModel.processConstructs in IntentModel.authorisedConstruction");
    lines.push("}", "check IntentProcessConstructionIsAuthorized");
  }

  lines.push("", "one sig Model { checks: Rule -> set CheckTarget }", "", "fact GeneratedChecks {");
  const pairs = [];
  rules.forEach((rule, index) => {
    list(rule.checks).forEach((_target, targetIndex) => {
      pairs.push(`R_${sanitizeIdentifier(rule.id)} -> C_${index}_${targetIndex}`);
    });
  });
  lines.push(`  Model.checks = ${pairs.length > 0 ? pairs.join(" + ") : "none -> CheckTarget"}`);
  lines.push("}", "", "assert ApprovedRulesHaveChecks {");
  lines.push("  all r: ActiveApprovedRule | some Model.checks[r] & AutomatedCheckTarget");
  lines.push("}", "", "assert ActiveApprovedRulesHaveAutomatedSupport {");
  lines.push("  all r: ActiveApprovedRule | some Model.checks[r] & AutomatedCheckTarget");
  lines.push("}", "", "assert DeprecatedRulesExcludedFromActive {");
  lines.push("  no ActiveApprovedRule & DeprecatedRule");
  lines.push("}", "", "check ApprovedRulesHaveChecks");
  lines.push("check ActiveApprovedRulesHaveAutomatedSupport");
  lines.push("check DeprecatedRulesExcludedFromActive");
  return `${lines.join("\n")}\n`;
}

function emitLean(model) {
  const approved = sortedRules(model).filter((rule) => rule.reviewStatus === "approved" && !rule.deprecated);
  const constructors = approved.length > 0 ? approved.map((rule) => `  | ${sanitizeIdentifier(rule.id)}`).join("\n") : "  | none";
  const listValues = approved.map((rule) => `RuleId.${sanitizeIdentifier(rule.id)}`).join(", ");
  const checks = approved.length > 0
    ? approved
      .map((rule) => `  | RuleId.${sanitizeIdentifier(rule.id)} => [${automatedCheckTargets(rule).map((target) => JSON.stringify(target.ref)).join(", ")}]`)
      .join("\n")
    : "  | .none => []";
  const clauses = approved.length > 0
    ? approved
      .map((rule) => `  | RuleId.${sanitizeIdentifier(rule.id)} => [${ruleClauseExprs(rule).join(", ")}]`)
      .join("\n")
    : "  | .none => []";
  const coverageProof = approved.length > 0
    ? "  intro r h\n  cases r <;> decide"
    : "  intro r h\n  simp_all [approvedRules]";
  const clauseTheorems = leanSemanticClauseProofs(model).map(emitLeanClauseTheorem).join("\n\n");
  return `namespace DSpec.Generated

def clauseAstSemanticsVersion : String := ${JSON.stringify(model.clauseAstSemanticsVersion)}

inductive Expr where
  | opaque : String -> Expr
  | atom : String -> List String -> Expr
  | eq : String -> String -> Expr
  | neq : String -> String -> Expr
  | not : Expr -> Expr
  | conj : List Expr -> Expr
  | disj : List Expr -> Expr
  | impl : Expr -> Expr -> Expr
  | exists_ : String -> Expr -> Expr
  | forall_ : String -> Expr -> Expr
deriving Repr

abbrev ClauseEnv := String -> Option String

def resolveClauseValue (env : ClauseEnv) (name : String) : String :=
  (env name).getD name

def Satisfies (env : ClauseEnv) : Expr -> Prop
  | .eq left right => resolveClauseValue env left = resolveClauseValue env right
  | .neq left right => resolveClauseValue env left ≠ resolveClauseValue env right
  | .not child => ¬ Satisfies env child
  | .impl left right => Satisfies env left -> Satisfies env right
  | _ => False

inductive RuleId where
${constructors}
deriving DecidableEq, Repr

def approvedRules : List RuleId := [${listValues}]

def clauseExprs : RuleId -> List Expr
${clauses}

def checks : RuleId -> List String
${checks}

${clauseTheorems}

def AutomatedSupport (r : RuleId) : Bool := decide ((checks r).length > 0)

def CoverageInvariant : Prop :=
  forall r, r ∈ approvedRules -> AutomatedSupport r = true

theorem coverage_invariant : CoverageInvariant := by
${coverageProof}

theorem approved_rules_have_checks : forall r, r ∈ approvedRules -> (checks r).length > 0 := by
${coverageProof}

end DSpec.Generated
`;
}

function emitFormalBackend(target, model) {
  if (target === "alloy") return emitAlloy(model);
  if (target === "quint") return renderQuintModel(model);
  if (target === "lean") return emitLean(model);
  throw new CommandError(`unknown emit target: ${target}`);
}

function runGeneratedToolResult(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.status !== 0) {
    return {
      status: "fail",
      exitCode: result.status ?? 1,
      message: stderr || stdout || `${command} ${args.join(" ")} failed`,
    };
  }
  return {
    status: "pass",
    exitCode: 0,
    message: stdout.trim() || stderr.trim() || undefined,
  };
}

function commandPath(command) {
  if (command === "quint" && existsSync(resolve("node_modules/.bin/quint"))) {
    return resolve("node_modules/.bin/quint");
  }
  const result = spawnSync("which", [command], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function hasTool(command) {
  return commandPath(command) !== null;
}

const DEVSHELL_REQUIRED_TOOLS = [
  { name: "node", args: ["--version"], pattern: /^v24\./, managedByNix: true },
  { name: "pnpm", args: ["--version"], managedByNix: true },
  { name: "pkl", args: ["--version"], managedByNix: true },
  { name: "pkf", args: ["--version"], managedByNix: false },
  { name: "lean", args: ["--version"], managedByNix: true },
  { name: "z3", args: ["--version"], managedByNix: true },
  { name: "quint", args: ["--version"], managedByNix: false },
  { name: "java", args: ["-version"], managedByNix: true },
  { name: "alloy6", args: ["--help"], managedByNix: true, allowNonzeroVersion: true },
];

function devshellToolReport(tool, options = {}) {
  const path = commandPath(tool.name);
  const errors = [];
  let version = null;
  let versionExitCode = null;
  if (!path) {
    errors.push(`missing tool: ${tool.name}`);
  } else {
    if (options.requireStorePath && tool.managedByNix && !path.startsWith("/nix/store/")) {
      errors.push(`tool is not from /nix/store: ${tool.name} -> ${path}`);
    }
    if (tool.args.length > 0) {
      const result = spawnSync(path, tool.args, { encoding: "utf8" });
      versionExitCode = result.status ?? 1;
      version = (result.stdout || result.stderr || "").split("\n")[0].trim();
      if (result.status !== 0 && !tool.allowNonzeroVersion) {
        errors.push(`version command failed: ${tool.name} ${tool.args.join(" ")}`);
      }
      if (tool.pattern && !tool.pattern.test(version)) {
        errors.push(`unexpected ${tool.name} version: ${version}`);
      }
    }
  }
  return {
    name: tool.name,
    path,
    version,
    versionExitCode,
    managedByNix: tool.managedByNix,
    fromNixStore: path ? path.startsWith("/nix/store/") : false,
    status: reportStatus(errors),
    errors,
  };
}

function devshellSmokeReport(options = {}) {
  const tools = DEVSHELL_REQUIRED_TOOLS.map((tool) => devshellToolReport(tool, options));
  const errors = tools.flatMap((tool) => tool.errors);
  const formalTools = ["lean", "z3", "quint", "java", "alloy6"];
  return {
    status: reportStatus(errors),
    nodeMajor: tools.find((tool) => tool.name === "node")?.version ?? null,
    requireStorePath: Boolean(options.requireStorePath),
    tools,
    summary: {
      required: tools.length,
      present: tools.filter((tool) => tool.path).length,
      formalRequired: formalTools.length,
      formalPresent: tools.filter((tool) => formalTools.includes(tool.name) && tool.path).length,
      nixStoreManaged: tools.filter((tool) => tool.managedByNix && tool.fromNixStore).length,
    },
    errors,
  };
}

function renderDevshellSmokeReport(report) {
  if (report.status === "pass") {
    return `ok: devshell smoke (${report.summary.present}/${report.summary.required} tools)\n`;
  }
  return `${report.errors.join("\n")}\n`;
}

function delimiterErrors(source, label, pairs) {
  const stack = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    for (const [open, close] of pairs) {
      if (source.startsWith(open, index)) {
        stack.push({ open, close });
        index += open.length - 1;
        break;
      }
      if (source.startsWith(close, index)) {
        const last = stack.pop();
        if (!last || last.close !== close) {
          return [`unbalanced ${label} delimiters: ${close}`];
        }
        index += close.length - 1;
        break;
      }
    }
  }

  if (inString) return [`unbalanced ${label} string literal`];
  if (stack.length > 0) {
    return [`unbalanced ${label} delimiters: ${stack.map((entry) => entry.open).join(" ")}`];
  }
  return [];
}

function validateGeneratedAlloy(source) {
  const errors = [];
  if (!/^module [A-Za-z_][A-Za-z0-9_]*\n/.test(source)) {
    errors.push("missing Alloy module header");
  }
  for (const declaration of [
    "abstract sig Rule",
    "abstract sig ActiveApprovedRule",
    "abstract sig AutomatedCheckTarget",
    "abstract sig CheckTarget",
    "one sig Model",
    "fact GeneratedChecks",
    "assert ApprovedRulesHaveChecks",
    "assert ActiveApprovedRulesHaveAutomatedSupport",
    "check ApprovedRulesHaveChecks",
  ]) {
    if (!source.includes(declaration)) {
      errors.push(`missing Alloy declaration: ${declaration}`);
    }
  }
  if (source.includes("undefined") || source.includes("[object Object]")) {
    errors.push("generated Alloy contains non-rendered JavaScript value");
  }
  if (delimiterErrors(source, "Alloy", [["{", "}"], ["(", ")"], ["[", "]"]]).length > 0) {
    errors.push("unbalanced Alloy braces");
  }
  const sigNames = [...source.matchAll(/\b(?:one\s+)?sig\s+([A-Za-z_][A-Za-z0-9_]*)\b/g)].map((match) => match[1]);
  if (sigNames.length !== new Set(sigNames).size) {
    errors.push("duplicate Alloy sig name");
  }
  return errors;
}

function passBackend(extra = {}) {
  return { status: "pass", ...extra };
}

function failBackend(message, extra = {}) {
  return { status: "fail", message, ...extra };
}

function skipBackend(reason) {
  return { status: "skip", reason };
}

function syntaxBackend(source, validate) {
  const errors = validate(source);
  return errors.length > 0 ? failBackend(errors.join("\n")) : passBackend();
}

function runOptionalToolBackend(command, args, unavailableReason, toolAvailable = hasTool) {
  if (!toolAvailable(command)) return skipBackend(unavailableReason);
  return runGeneratedToolResult(command, args);
}

const LOCAL_QUINT_COMMAND = resolve(dirname(fileURLToPath(import.meta.url)), "../node_modules/.bin/quint");

function quintCommand() {
  return existsSync(LOCAL_QUINT_COMMAND) ? LOCAL_QUINT_COMMAND : "quint";
}

function hasQuintTool(toolAvailable) {
  return existsSync(LOCAL_QUINT_COMMAND) || toolAvailable("quint");
}

function hasWorkingJava(toolAvailable) {
  if (!toolAvailable("java")) return false;
  if (toolAvailable !== hasTool) return true;
  return spawnSync("java", ["-version"], { encoding: "utf8" }).status === 0;
}

function verifyGeneratedQuintTypecheck(quintPath, toolAvailable) {
  if (!hasQuintTool(toolAvailable)) return skipBackend("quint not installed");
  return runGeneratedToolResult(quintCommand(), ["typecheck", quintPath]);
}

function verifyGeneratedQuintModel(quintPath, toolAvailable) {
  if (!hasQuintTool(toolAvailable)) return skipBackend("quint not installed");
  if (!hasWorkingJava(toolAvailable)) return skipBackend("working Java runtime not found (required by Quint verify)");
  const serverEndpoint = quintServerEndpoint({
    configured: process.env.DSPEC_QUINT_SERVER_ENDPOINT,
    pid: process.pid,
  });
  return runGeneratedToolResult(quintCommand(), quintVerifyArgs(quintPath, { serverEndpoint }));
}

function verifyGeneratedAlloyWithAnalyzer(alloyPath, outputPath, toolAvailable) {
  if (!toolAvailable("alloy6")) return skipBackend("alloy6 not found on PATH");
  const commands = runGeneratedToolResult("alloy6", ["commands", alloyPath]);
  if (commands.status !== "pass") return commands;
  // Alloy's CLI exits successfully when a `check` finds a counterexample. Use
  // its JSON receipt instead of treating a zero process status as a proof.
  const execution = runGeneratedToolResult("alloy6", ["exec", "-q", "-t", "json", "-o", outputPath, "-f", alloyPath]);
  if (execution.status !== "pass") return execution;
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(join(outputPath, "receipt.json"), "utf8"));
  } catch (error) {
    return failBackend(`Alloy execution did not produce a readable receipt: ${error.message}`);
  }
  const counterexamples = Object.values(receipt.commands ?? {})
    .filter((command) => command?.type === "check" && list(command.solution).length > 0)
    .map((command) => command.name ?? "unknown")
    .sort();
  if (counterexamples.length > 0) {
    return failBackend(`Alloy checks found counterexamples: ${counterexamples.join(", ")}`);
  }
  return execution;
}

function verifyGeneratedReport(model, options = {}) {
  const toolAvailable = options.toolAvailable ?? hasTool;
  const dir = mkdtempSync(join(tmpdir(), "dspec-generated-"));
  const backends = {};
  try {
    const quickcheckPath = join(dir, "quickcheck.mjs");
    writeFileSync(quickcheckPath, emitQuickcheck(model));
    backends.quickcheck = runGeneratedToolResult(process.execPath, [quickcheckPath]);

    const leanPath = join(dir, "model.lean");
    writeFileSync(leanPath, emitLean(model));
    backends.lean = runOptionalToolBackend("lean", [leanPath], "lean not found on PATH", toolAvailable);

    const quintSource = renderQuintModel(model);
    const alloySource = emitAlloy(model);
    backends.alloySyntax = syntaxBackend(alloySource, validateGeneratedAlloy);

    const quintPath = join(dir, "model.qnt");
    writeFileSync(quintPath, quintSource);
    backends.quintTypecheck = verifyGeneratedQuintTypecheck(quintPath, toolAvailable);
    backends.quintVerify = options.skipQuintVerify
      ? skipBackend("disabled by --skip-quint-verify")
      : verifyGeneratedQuintModel(quintPath, toolAvailable);

    const alloyPath = join(dir, "model.als");
    const outputPath = join(dir, "alloy-out");
    writeFileSync(alloyPath, alloySource);
    backends.alloyAnalyzer = verifyGeneratedAlloyWithAnalyzer(alloyPath, outputPath, toolAvailable);

    const failed = Object.values(backends).some((backend) => backend.status === "fail");
    return {
      model: {
        id: model.id,
        version: model.version,
      },
      status: failed ? "fail" : "pass",
      backends,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assuranceArtifactSources(model) {
  const sources = {
    alloy: emitAlloy(model),
    lean: emitLean(model),
    quickcheck: emitQuickcheck(model),
    quint: renderQuintModel(model),
  };
  for (const proof of leanSemanticClauseProofs(model)) {
    sources[proof.artifactId] = sources.lean;
  }
  return sources;
}

function assuranceArtifactResults(verification) {
  return {
    alloy: verification.backends.alloyAnalyzer,
    lean: verification.backends.lean,
    quickcheck: verification.backends.quickcheck,
    quint: verification.backends.quintVerify,
  };
}

function assuranceEvidenceExpected(model, verification = verifyGeneratedReport(model)) {
  const sourceMap = emitSourceMapObject(model, model.primaryLocale);
  const snapshot = assuranceEvidenceSnapshot(model, sourceMap, assuranceArtifactSources(model));
  const results = assuranceArtifactResults(verification);
  return {
    ...snapshot,
    artifactDefinitions: Object.fromEntries(
      assuranceEvidenceArtifactDefinitions(model).map((definition) => [
        definition.id,
        { ...definition, result: results[definition.backend].status },
      ]),
    ),
  };
}

function commandVersion(command, args) {
  if (!hasTool(command)) return null;
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 10000 });
  if (result.error || result.status !== 0) return null;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  return output.split("\n").map((line) => line.trim()).find(Boolean) ?? null;
}

function currentAssuranceToolVersions() {
  return {
    node: process.version,
    lean: commandVersion("lean", ["--version"]),
    quint: commandVersion(quintCommand(), ["--version"]),
    alloy6: commandVersion("alloy6", ["version"]),
  };
}

function assuranceEvidenceArtifactDefinitions(model) {
  const generatorArtifacts = [
    {
      id: "alloy",
      backend: "alloy",
      tool: "alloy6",
      scope: "generator",
      propertyIds: ["alloy.assert.ApprovedRulesHaveChecks", "alloy.assert.ActiveApprovedRulesHaveAutomatedSupport"],
      bounds: { command: "check ApprovedRulesHaveChecks" },
    },
    {
      id: "lean",
      backend: "lean",
      tool: "lean",
      scope: "generator",
      propertyIds: ["lean.theorem.coverage_invariant"],
      theorem: "coverage_invariant",
      bounds: {},
    },
    {
      id: "quickcheck",
      backend: "quickcheck",
      tool: "node",
      scope: "generator",
      propertyIds: [
        "quickcheck.propertyApprovedRulesHaveAutomatedChecks",
        "quickcheck.propertyApprovedRulesHaveRequiredAssurances",
      ],
      bounds: {},
    },
    {
      id: "quint",
      backend: "quint",
      tool: "quint",
      scope: "generator",
      propertyIds: [
        "quint.coverageInvariant",
        "quint.workflowInvariant",
        "quint.intentConcurrencyBounded",
        "quint.intentIdempotencyKeysAreExclusive",
        "quint.intentTimeoutsBounded",
      ],
      bounds: { maxSteps: 10, backend: "tlc" },
    },
  ];
  const clauseArtifacts = leanSemanticClauseProofs(model).map((proof) => ({
    id: proof.artifactId,
    backend: "lean",
    tool: "lean",
    scope: "clause",
    propertyIds: [proof.generatedSelector],
    theorem: proof.theorem,
    bounds: {},
  }));
  return [...generatorArtifacts, ...clauseArtifacts];
}

function assuranceEvidenceArtifacts(model, verification, expected, toolVersions) {
  const results = assuranceArtifactResults(verification);
  const definitions = assuranceEvidenceArtifactDefinitions(model);
  return definitions.map((definition) => ({
    id: definition.id,
    backend: definition.backend,
    scope: definition.scope,
    propertyIds: definition.propertyIds,
    digest: expected.artifactDigests[definition.id],
    result: results[definition.backend].status,
    tool: {
      name: definition.tool,
      version: toolVersions[definition.tool],
    },
    theorem: definition.theorem ?? null,
    bounds: definition.bounds,
  }));
}

function validIsoTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value);
}

function intentExerciseEvidenceEntry(model, reportFile) {
  const report = readJsonFile(reportFile, "Intent exercise report");
  const entry = {
    report: { path: reportFile, digest: fileDigest(reportFile) },
    status: report.status,
    executedAt: report.executedAt ?? null,
    model: report.model ?? null,
    modelDigest: report.evidence?.document?.modelDigest ?? null,
    trace: {
      path: report.evidence?.document?.path ?? null,
      digest: report.evidence?.document?.digest ?? null,
    },
    execution: report.evidence?.execution ?? null,
    executionPolicy: report.executionPolicy?.status === "skip" ? null : report.executionPolicy ?? null,
    summary: report.summary ?? null,
    observations: list(report.traces).map((trace) => ({ id: trace?.id ?? null, observedAt: trace?.observedAt ?? null })),
  };
  const errors = verifyIntentExerciseEvidenceEntry(model, entry);
  if (errors.length > 0) throw new CommandError(`invalid Intent exercise evidence:\n${errors.join("\n")}\n`);
  return entry;
}

function intentExerciseEvidenceEntries(model, reportFiles) {
  const entries = [];
  const seen = new Set();
  for (const reportFile of list(reportFiles)) {
    const entry = intentExerciseEvidenceEntry(model, reportFile);
    if (seen.has(entry.report.path)) throw new CommandError(`duplicate Intent exercise evidence report: ${entry.report.path}\n`);
    seen.add(entry.report.path);
    entries.push(entry);
  }
  return entries.sort((left, right) => left.report.path.localeCompare(right.report.path));
}

function currentIntentEvidenceFileDigest(path, label, errors) {
  if (typeof path !== "string" || path.length === 0) {
    errors.push(`missing Intent ${label} path`);
    return null;
  }
  if (!existsSync(resolve(path))) {
    errors.push(`missing Intent ${label}: ${path}`);
    return null;
  }
  return fileDigest(path);
}

function verifyIntentExecutionPolicyEvidence(model, policyEvidence) {
  const errors = [];
  if (!policyEvidence) return errors;
  const declared = intentProcesses(intentPattern(model))
    .filter((process) => process.execution)
    .slice()
    .sort(byId);
  if (policyEvidence.status !== "pass") errors.push("Intent execution policy evidence did not pass");
  if (policyEvidence.summary?.policies !== declared.length) {
    errors.push(`stale Intent execution policy count: expected ${declared.length}, got ${policyEvidence.summary?.policies ?? "missing"}`);
  }
  const expectedReplays = declared.reduce((count, process) => count + process.execution.maxInFlight + 1, 0);
  if (policyEvidence.summary?.replays !== expectedReplays) {
    errors.push(`stale Intent execution policy replay count: expected ${expectedReplays}, got ${policyEvidence.summary?.replays ?? "missing"}`);
  }
  const observations = list(policyEvidence.observations);
  if (observations.length !== declared.length) {
    errors.push(`stale Intent execution policy observations: expected ${declared.length}, got ${observations.length}`);
  }
  const byProcess = new Map(observations.map((observation) => [observation?.process, observation]));
  for (const process of declared) {
    const observation = byProcess.get(process.id);
    if (!observation) {
      errors.push(`missing Intent execution policy observation: ${process.id}`);
      continue;
    }
    const execution = process.execution;
    if (observation.status !== "pass") errors.push(`failed Intent execution policy observation: ${process.id}`);
    if (observation.pressure?.scope !== "client-scheduled") errors.push(`invalid Intent execution policy observation scope: ${process.id}`);
    if (observation.pressure?.maxInFlight !== execution.maxInFlight) {
      errors.push(`stale Intent execution maxInFlight: ${process.id}`);
    }
    if (observation.pressure?.maxObservedInFlight !== execution.maxInFlight) {
      errors.push(`incomplete Intent execution client pressure: ${process.id}`);
    }
    if (observation.pressure?.replayCount !== execution.maxInFlight + 1) {
      errors.push(`stale Intent execution replay count: ${process.id}`);
    }
    if (observation.timeout?.timeoutSteps !== (execution.timeoutSteps ?? null)) {
      errors.push(`stale Intent execution timeoutSteps: ${process.id}`);
    }
    if (observation.timeout?.timeoutMs !== (execution.timeoutMs ?? null)) {
      errors.push(`stale Intent execution timeoutMs: ${process.id}`);
    }
    if (execution.idempotencyKey) {
      if (observation.idempotency?.contractField !== execution.idempotencyKey || observation.idempotency?.replayedSameKey !== true) {
        errors.push(`stale Intent execution idempotency observation: ${process.id}`);
      }
    } else if (observation.idempotency !== null) {
      errors.push(`unexpected Intent execution idempotency observation: ${process.id}`);
    }
    if (observation.result?.outputMatchesObserved !== true) errors.push(`failed Intent execution output observation: ${process.id}`);
    if (observation.result?.effectsMatchObserved === false) errors.push(`failed Intent execution effect observation: ${process.id}`);
    if (list(observation.invocations).length !== execution.maxInFlight + 1) {
      errors.push(`incomplete Intent execution invocations: ${process.id}`);
    }
  }
  return errors;
}

function verifyIntentExerciseEvidenceEntry(model, entry) {
  const errors = [];
  if (!entry || typeof entry !== "object") return ["invalid Intent exercise evidence entry"];
  if (entry.status !== "pass") errors.push(`Intent exercise evidence did not pass: ${entry.report?.path ?? "missing"}`);
  if (!validIsoTimestamp(entry.executedAt)) errors.push(`invalid Intent exercise evidence executedAt: ${entry.report?.path ?? "missing"}`);
  if (entry.model?.id !== model.id) errors.push(`stale Intent exercise model id: expected ${model.id}, got ${entry.model?.id ?? "missing"}`);
  if (entry.model?.version !== model.version) errors.push(`stale Intent exercise model version: expected ${model.version}, got ${entry.model?.version ?? "missing"}`);
  if (entry.modelDigest !== assuranceDigest(model)) errors.push(`stale Intent exercise model digest: ${entry.report?.path ?? "missing"}`);

  const reportDigest = currentIntentEvidenceFileDigest(entry.report?.path, "exercise report", errors);
  if (reportDigest && entry.report?.digest !== reportDigest) errors.push(`stale Intent exercise evidence report digest: ${entry.report.path}`);
  const traceDigest = currentIntentEvidenceFileDigest(entry.trace?.path, "trace evidence", errors);
  if (traceDigest && entry.trace?.digest !== traceDigest) errors.push(`stale Intent trace evidence digest: ${entry.trace.path}`);

  const execution = entry.execution;
  if (!["node-permission-child-process", "node-transaction-journal-child-process", "http-fetch", "mixed"].includes(execution?.runner)) errors.push(`invalid Intent exercise runner: ${execution?.runner ?? "missing"}`);
  if (execution?.invocation !== "per-case") errors.push(`invalid Intent exercise invocation policy: ${execution?.invocation ?? "missing"}`);
  if (!Number.isInteger(execution?.timeoutMs) || execution.timeoutMs <= 0) errors.push("invalid Intent exercise timeout policy");
  if (["node-permission-child-process", "node-transaction-journal-child-process", "mixed"].includes(execution?.runner)
    && (execution?.permissions?.fsWrite !== false || execution?.permissions?.childProcess !== false || execution?.permissions?.worker !== false)) {
    errors.push("invalid Intent exercise permission policy");
  }
  const implementations = list(execution?.implementations);
  if (implementations.length === 0) errors.push("Intent exercise evidence has no implementation digest");
  for (const implementation of implementations) {
    const digest = currentIntentEvidenceFileDigest(implementation?.path, "implementation", errors);
    if (digest && implementation.digest !== digest) {
      errors.push(`stale Intent implementation digest: ${implementation.path}`);
    }
  }
  errors.push(...verifyIntentExecutionPolicyEvidence(model, entry.executionPolicy));
  return errors;
}

function createAssuranceEvidenceManifest(model, options = {}) {
  const executedAt = options.executedAt ?? new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(executedAt)) {
    throw new CommandError(`invalid --executed-at timestamp: ${executedAt}\n`);
  }
  const verification = verifyGeneratedReport(model);
  assertVerifyGeneratedReport(verification, { requireFormalTools: options.requireFormalTools });
  const expected = assuranceEvidenceExpected(model, verification);
  const toolVersions = currentAssuranceToolVersions();
  const intentExercises = intentExerciseEvidenceEntries(model, options.intentReportFiles);
  return {
    schemaVersion: ASSURANCE_EVIDENCE_SCHEMA_VERSION,
    executedAt,
    model: expected.model,
    sourceMapDigest: expected.sourceMapDigest,
    artifacts: assuranceEvidenceArtifacts(model, verification, expected, toolVersions),
    clauseBindings: expected.clauseBindings,
    ...(intentExercises.length > 0 ? { intentExercises } : {}),
  };
}

function assuranceEvidenceVerificationReport(model, manifest) {
  const expected = assuranceEvidenceExpected(model);
  const verification = verifyAssuranceEvidenceManifest(manifest, expected, currentAssuranceToolVersions());
  const intentExercises = list(manifest?.intentExercises);
  const intentErrors = intentExercises.flatMap((entry) => verifyIntentExerciseEvidenceEntry(model, entry));
  const errors = [...verification.errors, ...intentErrors];
  const summary = {
    artifacts: list(manifest?.artifacts).length,
    clauseBindings: list(manifest?.clauseBindings).length,
  };
  if (intentExercises.length > 0) summary.intentExercises = intentExercises.length;
  return {
    model: { id: model.id, version: model.version },
    manifest,
    status: errors.length === 0 ? "pass" : "fail",
    summary,
    errors,
    warnings: verification.warnings,
  };
}

function writeAssuranceEvidenceManifest(path, manifest) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, stableJson(manifest));
  return {
    path,
    bytes: Buffer.byteLength(stableJson(manifest), "utf8"),
    digest: assuranceDigest(manifest),
  };
}

function backendFailureMessage(report) {
  for (const [name, backend] of Object.entries(report.backends)) {
    if (backend.status === "fail") {
      return `${name}: ${backend.message ?? "failed"}`;
    }
  }
  return null;
}

function formalToolSkipFailures(report) {
  return [
    ["lean", "lean"],
    ["quintTypecheck", "quint"],
    ["quintVerify", "quint + java"],
    ["alloyAnalyzer", "alloy6"],
  ].flatMap(([backend, tool]) => (
    report.backends[backend]?.status === "skip"
      ? [`required formal backend skipped: ${backend} (${tool})`]
      : []
  ));
}

function assertVerifyGeneratedReport(report, options = {}) {
  const failure = backendFailureMessage(report);
  if (failure) {
    throw new CommandError(`generated verification failed:\n${failure}\n`);
  }
  if (options.requireFormalTools) {
    const skipped = formalToolSkipFailures(report);
    if (skipped.length > 0) {
      throw new CommandError(`required formal tool verification failed:\n${skipped.join("\n")}\n`);
    }
  }
}

function verifyGenerated(model, options = {}) {
  const report = verifyGeneratedReport(model, options);
  assertVerifyGeneratedReport(report, options);

  const lines = [
    `ok: ${model.id} generated quickcheck`,
    `ok: ${model.id} generated quint`,
    `ok: ${model.id} generated alloy syntax`,
  ];
  if (report.backends.lean.status === "pass") {
    lines.push(`ok: ${model.id} generated lean`);
  }
  if (report.backends.quintTypecheck.status === "pass") {
    lines.push(`ok: ${model.id} generated quint typecheck`);
  }
  if (report.backends.quintVerify.status === "pass") {
    lines.push(`ok: ${model.id} generated quint verify`);
  }
  if (report.backends.alloyAnalyzer.status === "pass") {
    lines.push(`ok: ${model.id} generated alloy exec`);
  }
  if (options.requireFormalTools) {
    lines.push(`ok: ${model.id} required formal tools`);
  }
  return `${lines.join("\n")}\n`;
}

function modelReport(model) {
  return {
    id: model.id,
    version: model.version,
  };
}

function reportStatus(errors) {
  return errors.length > 0 ? "fail" : "pass";
}

function checkReport(model) {
  const errors = validate(model, { requireFormalEvidence: true });
  return {
    model: modelReport(model),
    status: reportStatus(errors),
    summary: {
      terms: list(model.vocabulary).length,
      rules: list(model.rules).length,
      decisions: list(model.decisions).length,
      projections: projections(model).length,
    },
    assurance: assuranceSummary(model),
    errors,
  };
}

function driftReport(model) {
  const drift = validateDrift(model);
  return {
    model: modelReport(model),
    status: reportStatus(drift.errors),
    references: drift.count,
    assurance: assuranceSummary(model),
    errors: drift.errors,
  };
}

function coverageReport(model) {
  const coverage = validateCoverage(model);
  return {
    model: modelReport(model),
    status: reportStatus(coverage.errors),
    covered: coverage.covered,
    total: coverage.total,
    assurance: assuranceSummary(model),
    errors: coverage.errors,
  };
}

function verifyReport(model, options = {}) {
  const check = checkReport(model);
  const drift = driftReport(model);
  const coverage = coverageReport(model);
  const schemaLock = options.modelFile
    ? schemaLockReport(options.modelFile, options)
    : { status: "skip", reason: "no schema lock configured", errors: [] };
  const reports = [
    ["check", check],
    ["drift", drift],
    ["coverage", coverage],
    ["schema lock", schemaLock],
  ];
  const errors = reports.flatMap(([name, report]) => report.errors.map((error) => `${name}: ${error}`));

  return {
    model: modelReport(model),
    status: reportStatus(errors),
    summary: {
      passed: reports.filter(([, report]) => report.status === "pass").length,
      total: reports.filter(([, report]) => report.status !== "skip").length,
    },
    check,
    drift,
    coverage,
    schemaLock,
    errors,
  };
}

function diagnosticRuleId(message) {
  const clause = message.match(/:\s*([A-Za-z0-9_.-]+)\s+(?:when|must|mustNot)\[\d+\]/);
  if (clause) return clause[1];
  const reference = message.match(/:\s*([A-Za-z0-9_.-]+)\s*->/);
  return reference?.[1] ?? null;
}

function diagnosticCode(phase, message) {
  if (message.startsWith("invalid expr ast:")) return "invalid-clause-ast";
  if (message.startsWith("missing implementation path:")) return "implementation-path-missing";
  if (message.startsWith("missing implementation symbol:")) return "implementation-symbol-missing";
  if (message.startsWith("missing check target path:")) return "check-target-path-missing";
  if (message.startsWith("missing check target anchor:")) return "check-target-anchor-missing";
  if (message.startsWith("approved rule has no automated check target:")) return "approved-rule-missing-automated-check";
  if (message.startsWith("approved rule is missing required assurance:")) return "approved-rule-missing-assurance";
  if (message.startsWith("approved rule has uncovered clause:")) return "approved-rule-uncovered-clause";
  if (message.startsWith("schema lock not found:")) return "schema-lock-missing";
  if (message.startsWith("schema module digest changed:")) return "schema-module-digest-changed";
  if (message.startsWith("schema module missing:")) return "schema-module-missing";
  if (message.startsWith("schema import changed:")) return "schema-import-changed";
  if (message.startsWith("schema root changed:")) return "schema-root-changed";
  if (message.startsWith("schema package metadata changed")) return "schema-package-metadata-changed";
  return `${phase}-verification-failure`;
}

function diagnosticSuggestion(code, modelFile) {
  if (code === "invalid-clause-ast") return "correct the Clause.ast operator shape for this rule";
  if (code === "implementation-path-missing") return "restore the implementation path or update Rule.implementedBy";
  if (code === "implementation-symbol-missing") return "restore the implementation symbol or update Rule.implementedBy";
  if (code === "check-target-path-missing") return "restore the test file or update Rule.checks";
  if (code === "check-target-anchor-missing") return "restore the named test anchor or update Rule.checks";
  if (code === "approved-rule-missing-automated-check") return "add an automated check target before approving this rule";
  if (code === "approved-rule-missing-assurance") return "add a check target with the required assurance evidence";
  if (code === "approved-rule-uncovered-clause") return "add the missing clause selector to CheckTarget.covers";
  if (code.startsWith("schema-")) return `review the schema change, then run dspec lock --force ${modelFile}`;
  return "update the model or linked implementation so this verification gate passes";
}

function diagnosticSource(modelFile, ruleId, phase) {
  if (phase === "schema-lock") return null;
  if (!ruleId) return { path: modelFile, line: null };
  try {
    const source = readTextFile(modelFile);
    const match = new RegExp(`\\bid\\s*=\\s*"${escapeRegex(ruleId)}"`).exec(source);
    return {
      path: modelFile,
      line: match ? source.slice(0, match.index).split("\n").length : null,
    };
  } catch {
    return { path: modelFile, line: null };
  }
}

function explainReport(model, options) {
  const verification = verifyReport(model, options);
  const phases = [
    ["check", verification.check],
    ["drift", verification.drift],
    ["coverage", verification.coverage],
    ["schema-lock", verification.schemaLock],
  ];
  const seen = new Set();
  const diagnostics = [];
  for (const [phase, phaseReport] of phases) {
    for (const message of phaseReport.errors) {
      if (seen.has(message)) continue;
      seen.add(message);
      const ruleId = diagnosticRuleId(message);
      const code = diagnosticCode(phase, message);
      diagnostics.push({
        id: `${phase}:${code}:${ruleId ?? "model"}`,
        phase,
        code,
        severity: "error",
        ruleId,
        message,
        source: diagnosticSource(options.modelFile, ruleId, phase),
        suggestion: diagnosticSuggestion(code, options.modelFile),
      });
    }
  }
  return {
    status: verification.status,
    model: verification.model,
    summary: {
      diagnostics: diagnostics.length,
      errors: verification.errors.length,
      gates: verification.summary,
    },
    diagnostics,
    errors: verification.errors,
  };
}

function renderExplainMarkdown(report) {
  const lines = [
    `# Verification Diagnostics: ${report.model.id}`,
    "",
    `- status: \`${report.status}\``,
    `- diagnostics: \`${report.summary.diagnostics}\``,
    "",
    "| Phase | Code | Rule | Source | Message | Suggestion |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const diagnostic of report.diagnostics) {
    const source = diagnostic.source
      ? `${diagnostic.source.path}${diagnostic.source.line === null ? "" : `:${diagnostic.source.line}`}`
      : "";
    lines.push(`| ${markdownCell(diagnostic.phase)} | ${markdownCell(diagnostic.code)} | ${markdownCell(diagnostic.ruleId ?? "")} | ${markdownCell(source)} | ${markdownCell(diagnostic.message)} | ${markdownCell(diagnostic.suggestion)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function domainCoverageCandidateIds(kind, id) {
  const candidates = [];
  const push = (...values) => {
    for (const value of values) {
      if (value && !candidates.includes(value)) candidates.push(value);
    }
  };
  push(`${kind}.${id}`);
  if (kind === "db.table") push(`table.${id}`, `db.table.${id}`);
  if (kind === "db.invariant") push(`invariant.${id}`, `db.invariant.${id}`);
  if (kind === "db.transaction") push(`transaction.${id}`, `db.transaction.${id}`);
  if (kind === "db.migration") push(`migration.${id}`, `db.migration.${id}`);
  if (kind === "cloud.node") push(`node.${id}`, `cloud.node.${id}`);
  if (kind === "cloud.flow") push(`flow.${id}`, `cloud.flow.${id}`);
  if (kind === "data.dataset") push(`data.${id}`, `dataset.${id}`, `data.dataset.${id}`);
  if (kind === "data.store") push(`store.${id}`, `data.store.${id}`);
  if (kind === "data.flow") push(`flow.${id}`, `data.flow.${id}`);
  if (kind === "release.service") push(`service.${id}`, `release.service.${id}`);
  if (kind === "release.step") push(`release.step.${id}`, `step.${id}`);
  if (kind === "runtime.service") push(`service.${id}`, `runtime.service.${id}`);
  if (kind === "runtime.dependency") push(`dependency.${id}`, `runtime.dependency.${id}`);
  if (kind === "runtime.slo") push(`slo.${id}`, `runtime.slo.${id}`);
  if (kind === "intent.capability") push(id, `capability.${id}`, `intent.capability.${id}`);
  if (kind === "intent.outcome") push(id, `outcome.${id}`, `intent.outcome.${id}`);
  if (kind === "intent.process") push(id, `process.${id}`, `intent.process.${id}`);
  if (kind === "intent.constructionAuthority") push(id, `constructionAuthority.${id}`, `intent.constructionAuthority.${id}`);
  if (kind === "intent.scenario") push(id, `scenario.${id}`, `intent.scenario.${id}`);
  if (kind === "intent.inputField") push(id, `input.${id}`, `intent.inputField.${id}`);
  if (kind === "intent.outputField") push(id, `output.${id}`, `intent.outputField.${id}`);
  if (kind === "intent.effect") push(id, `effect.${id}`, `intent.effect.${id}`);
  if (kind === "intent.refinement") push(id, `refinement.${id}`, `intent.refinement.${id}`);
  if (kind === "intent.executionPolicy") push(`execution.${id}`, `intent.execution.${id}`);
  if (kind === "domain.enum") push(id, `enum.${id}`, `domain.enum.${id}`);
  if (kind === "domain.valueObject") push(id, `valueObject.${id}`, `domain.valueObject.${id}`);
  if (kind === "domain.entity") push(id, `entity.${id}`, `domain.entity.${id}`);
  if (kind === "domain.aggregate") push(id, `aggregate.${id}`, `domain.aggregate.${id}`);
  if (kind === "domain.command") push(id, `command.${id}`, `domain.command.${id}`);
  if (kind === "domain.event") push(id, `event.${id}`, `domain.event.${id}`);
  if (kind === "domain.invariant") push(id, `invariant.${id}`, `domain.invariant.${id}`);
  if (kind === "domain.formalization") push(id, `formalization.${id}`, `domain.formalization.${id}`);
  if (kind === "domain.field") push(id, `field.${id}`, `domain.field.${id}`);
  return candidates.sort();
}

function domainCoverageElement(kind, id, path) {
  return {
    id,
    kind,
    path,
    candidates: domainCoverageCandidateIds(kind, id),
  };
}

function domainCoverageElements(model) {
  const elements = [];
  const db = dbPattern(model);
  if (db) {
    dbTables(db).forEach((table, index) => elements.push(domainCoverageElement("db.table", table.id, `model.patterns.db.tables[${index}]`)));
    dbInvariants(db).forEach((invariant, index) => elements.push(domainCoverageElement("db.invariant", invariant.id, `model.patterns.db.invariants[${index}]`)));
    dbTransactions(db).forEach((transaction, index) => elements.push(domainCoverageElement("db.transaction", transaction.id, `model.patterns.db.transactions[${index}]`)));
    dbMigrations(db).forEach((migration, index) => elements.push(domainCoverageElement("db.migration", migration.id, `model.patterns.db.migrations[${index}]`)));
  }

  const cloud = cloudPattern(model);
  if (cloud) {
    cloudNodes(cloud).forEach((node, index) => elements.push(domainCoverageElement("cloud.node", node.id, `model.patterns.cloud.nodes[${index}]`)));
    cloudFlows(cloud).forEach((flow, index) => elements.push(domainCoverageElement("cloud.flow", flow.id, `model.patterns.cloud.flows[${index}]`)));
  }

  const data = dataPattern(model);
  if (data) {
    dataSets(data).forEach((dataset, index) => elements.push(domainCoverageElement("data.dataset", dataset.id, `model.patterns.data.datasets[${index}]`)));
    dataStores(data).forEach((store, index) => elements.push(domainCoverageElement("data.store", store.id, `model.patterns.data.stores[${index}]`)));
    dataFlows(data).forEach((flow, index) => elements.push(domainCoverageElement("data.flow", flow.id, `model.patterns.data.flows[${index}]`)));
  }

  const release = releasePattern(model);
  if (release) {
    releaseServices(release).forEach((service, index) => elements.push(domainCoverageElement("release.service", service.id, `model.patterns.release.services[${index}]`)));
    releaseSteps(release).forEach((step, index) => elements.push(domainCoverageElement("release.step", step.id, `model.patterns.release.steps[${index}]`)));
  }

  const runtime = runtimePattern(model);
  if (runtime) {
    runtimeServices(runtime).forEach((service, index) => elements.push(domainCoverageElement("runtime.service", service.id, `model.patterns.runtime.services[${index}]`)));
    runtimeDependencies(runtime).forEach((dependency, index) => elements.push(domainCoverageElement("runtime.dependency", dependency.id, `model.patterns.runtime.dependencies[${index}]`)));
    runtimeSlos(runtime).forEach((slo, index) => elements.push(domainCoverageElement("runtime.slo", slo.id, `model.patterns.runtime.slos[${index}]`)));
  }

  const domain = domainPattern(model);
  if (domain) {
    list(domain.enums).forEach((entry, index) => elements.push(domainCoverageElement("domain.enum", entry.id, `model.patterns.domain.enums[${index}]`)));
    list(domain.valueObjects).forEach((entry, index) => {
      elements.push(domainCoverageElement("domain.valueObject", entry.id, `model.patterns.domain.valueObjects[${index}]`));
      list(entry.fields).forEach((field, fieldIndex) => elements.push(domainCoverageElement("domain.field", `valueObject/${entry.id}/${field.id}`, `model.patterns.domain.valueObjects[${index}].fields[${fieldIndex}]`)));
    });
    list(domain.entities).forEach((entry, index) => {
      elements.push(domainCoverageElement("domain.entity", entry.id, `model.patterns.domain.entities[${index}]`));
      list(entry.fields).forEach((field, fieldIndex) => elements.push(domainCoverageElement("domain.field", `entity/${entry.id}/${field.id}`, `model.patterns.domain.entities[${index}].fields[${fieldIndex}]`)));
    });
    list(domain.aggregates).forEach((entry, index) => elements.push(domainCoverageElement("domain.aggregate", entry.id, `model.patterns.domain.aggregates[${index}]`)));
    list(domain.commands).forEach((entry, index) => {
      elements.push(domainCoverageElement("domain.command", entry.id, `model.patterns.domain.commands[${index}]`));
      list(entry.fields).forEach((field, fieldIndex) => elements.push(domainCoverageElement("domain.field", `command/${entry.id}/${field.id}`, `model.patterns.domain.commands[${index}].fields[${fieldIndex}]`)));
    });
    list(domain.events).forEach((entry, index) => {
      elements.push(domainCoverageElement("domain.event", entry.id, `model.patterns.domain.events[${index}]`));
      list(entry.fields).forEach((field, fieldIndex) => elements.push(domainCoverageElement("domain.field", `event/${entry.id}/${field.id}`, `model.patterns.domain.events[${index}].fields[${fieldIndex}]`)));
    });
    list(domain.invariants).forEach((entry, index) => elements.push(domainCoverageElement("domain.invariant", entry.id, `model.patterns.domain.invariants[${index}]`)));
    list(domain.formalizations).forEach((entry, index) => elements.push(domainCoverageElement("domain.formalization", entry.id, `model.patterns.domain.formalizations[${index}]`)));
  }

  const intent = intentPattern(model);
  if (intent) {
    intentCapabilities(intent).forEach((capability, index) => elements.push(domainCoverageElement("intent.capability", capability.id, `model.patterns.intent.capabilities[${index}]`)));
    intentOutcomes(intent).forEach((outcome, index) => elements.push(domainCoverageElement("intent.outcome", outcome.id, `model.patterns.intent.outcomes[${index}]`)));
    intentProcesses(intent).forEach((process, index) => elements.push(domainCoverageElement("intent.process", process.id, `model.patterns.intent.processes[${index}]`)));
    intentProcesses(intent).forEach((process, processIndex) => {
      list(process.inputContract?.fields).forEach((field, fieldIndex) => {
        elements.push(domainCoverageElement("intent.inputField", `${process.id}/input/${field.id}`, `model.patterns.intent.processes[${processIndex}].inputContract.fields[${fieldIndex}]`));
      });
      intentRefinements(process).forEach((refinement, refinementIndex) => {
        elements.push(domainCoverageElement("intent.refinement", `${process.id}/${refinement.id}`, `model.patterns.intent.processes[${processIndex}].refinements[${refinementIndex}]`));
      });
      if (process.execution) {
        elements.push(domainCoverageElement("intent.executionPolicy", process.id, `model.patterns.intent.processes[${processIndex}].execution`));
      }
    });
    intentOutcomes(intent).forEach((outcome, outcomeIndex) => {
      list(outcome.outputContract?.fields).forEach((field, fieldIndex) => {
        elements.push(domainCoverageElement("intent.outputField", `${outcome.id}/output/${field.id}`, `model.patterns.intent.outcomes[${outcomeIndex}].outputContract.fields[${fieldIndex}]`));
      });
      list(outcome.effects).forEach((effect, effectIndex) => {
        elements.push(domainCoverageElement("intent.effect", `${outcome.id}/effect/${effect.id}`, `model.patterns.intent.outcomes[${outcomeIndex}].effects[${effectIndex}]`));
      });
    });
    constructionAuthorities(intent).forEach((authority, index) => elements.push(domainCoverageElement("intent.constructionAuthority", authority.id, `model.patterns.intent.constructionAuthorities[${index}]`)));
    intentGoals(intent).forEach((goal, index) => elements.push(domainCoverageElement("intent.goal", goal.id, `model.patterns.intent.goals[${index}]`)));
    intentClaims(intent).forEach((claim, index) => elements.push(domainCoverageElement("intent.claim", claim.id, `model.patterns.intent.claims[${index}]`)));
    intentAssuranceTasks(intent).forEach((task, index) => elements.push(domainCoverageElement("intent.assuranceTask", task.id, `model.patterns.intent.assuranceTasks[${index}]`)));
    intentScenarios(intent).forEach((scenario, index) => elements.push(domainCoverageElement("intent.scenario", scenario.id, `model.patterns.intent.scenarios[${index}]`)));
  }

  return elements.sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`));
}

function ruleCoverageCorpus(rule) {
  const values = [
    rule.id,
    rule.text?.default,
    ...Object.values(rule.text?.labels ?? {}),
    ...list(rule.terms),
    ...list(rule.when).map(clauseExpr),
    ...list(rule.must).map(clauseExpr),
    ...list(rule.mustNot).map(clauseExpr),
    ...list(rule.checks).flatMap((target) => [target.backend, target.ref, ...list(target.covers)]),
    ...list(rule.implementedBy).flatMap((ref) => [ref.kind, ref.path, ref.symbol]),
  ];
  return values.filter((value) => typeof value === "string").join("\n");
}

function candidateInCorpus(candidate, corpus) {
  const escaped = escapeRegex(candidate);
  return new RegExp(`(^|[^A-Za-z0-9_.$-])${escaped}([^A-Za-z0-9_.$-]|$)`).test(corpus);
}

function domainElementCoveredBy(element, rules) {
  const coveredBy = [];
  for (const rule of rules) {
    const terms = new Set(list(rule.terms));
    const term = element.candidates.find((candidate) => terms.has(candidate));
    if (term) {
      coveredBy.push({ rule: rule.id, via: `term:${term}` });
      continue;
    }
    const corpus = ruleCoverageCorpus(rule);
    const mention = element.candidates.find((candidate) => candidateInCorpus(candidate, corpus));
    if (mention) {
      coveredBy.push({ rule: rule.id, via: `mention:${mention}` });
    }
  }
  return coveredBy;
}

function domainCoverageReport(model) {
  const validationErrors = validate(model);
  if (validationErrors.length > 0) {
    return {
      model: modelReport(model),
      status: "fail",
      covered: 0,
      total: 0,
      elements: [],
      uncovered: [],
      errors: validationErrors,
    };
  }

  const rules = activeApprovedRules(model);
  const elements = domainCoverageElements(model).map((element) => ({
    ...element,
    coveredBy: domainElementCoveredBy(element, rules),
  }));
  const uncovered = elements.filter((element) => element.coveredBy.length === 0);
  const errors = uncovered.map((element) => `uncovered domain element: ${element.kind} ${element.id} at ${element.path}`);
  return {
    model: modelReport(model),
    status: reportStatus(errors),
    covered: elements.length - uncovered.length,
    total: elements.length,
    elements,
    uncovered,
    errors,
  };
}

function renderDomainCoverageReport(report) {
  if (report.status === "pass") {
    return `ok: ${report.model.id} domain coverage (${report.covered}/${report.total} elements)\n`;
  }
  return `${report.errors.join("\n")}\n`;
}

function projectionMaterializations(model) {
  const snapshot = projectionSnapshot(model);
  return snapshot.projections.flatMap((projection) => [
    ...projection.artifacts.map((artifact) => ({
      content: artifact.content,
      kind: projection.kind,
      locale: artifact.locale,
      path: artifact.path,
      projectionId: projection.id,
      projectionKind: projection.kind,
    })),
    {
      content: projectionStableJson(
        projectionProvenanceDocument(snapshot, projection, "1970-01-01T00:00:00.000Z"),
      ),
      kind: "provenance",
      locale: null,
      path: projection.provenancePath,
      projectionId: projection.id,
      projectionKind: projection.kind,
    },
  ]);
}

function shellQuoteArg(arg) {
  return /^[A-Za-z0-9_./:=+-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", `'"'"'`)}'`;
}

function renderArgv(argv) {
  return argv.map(shellQuoteArg).join(" ");
}

function projectionImpactReport(beforeModel, afterModel, afterFile) {
  const beforeArtifacts = new Map(projectionMaterializations(beforeModel).map((artifact) => [artifact.path, artifact]));
  const afterArtifacts = new Map(projectionMaterializations(afterModel).map((artifact) => [artifact.path, artifact]));
  const artifacts = [];

  for (const artifact of beforeArtifacts.values()) {
    if (!afterArtifacts.has(artifact.path)) {
      const { content: _content, ...entry } = artifact;
      artifacts.push({ action: "remove", ...entry });
    }
  }
  for (const artifact of afterArtifacts.values()) {
    const before = beforeArtifacts.get(artifact.path);
    if (!before || before.content !== artifact.content) {
      const { content: _content, ...entry } = artifact;
      artifacts.push({ action: "regenerate", ...entry });
    }
  }

  artifacts.sort((left, right) => left.path.localeCompare(right.path) || left.action.localeCompare(right.action));
  const regenerateArgv = artifacts.some((artifact) => artifact.action === "regenerate") && afterFile
    ? projectionGenerateArgv(afterFile)
    : null;
  return {
    artifacts,
    regenerateArgv,
    regenerateCommand: regenerateArgv ? renderArgv(regenerateArgv) : null,
  };
}

function domainImpactItems(model, collection) {
  return list(model?.patterns?.domain?.[collection]);
}

function normalizedImplementationRef(reference) {
  if (!reference) return null;
  return {
    kind: reference.kind,
    path: reference.path,
    symbol: reference.symbol ?? null,
  };
}

function impactContext(change, beforeModel, afterModel, beforeSourceMap, afterSourceMap) {
  return {
    sourceModel: sourceModelForChange(change, beforeModel, afterModel),
    sourceMap: sourceMapForChange(change, beforeSourceMap, afterSourceMap),
  };
}

function sortedChecks(entry) {
  return list(entry?.checks).slice().sort();
}

function reverificationForChecks(checks) {
  return ["traceability", ...checks.map((check) => `check:${check}`)];
}

function sortedImplementationRefs(references) {
  return references
    .filter(Boolean)
    .map(normalizedImplementationRef)
    .sort((left, right) => `${left.kind}\u0000${left.path}\u0000${left.symbol ?? ""}`.localeCompare(`${right.kind}\u0000${right.path}\u0000${right.symbol ?? ""}`));
}

function formalizationImpact(change, beforeModel, afterModel, beforeSourceMap, afterSourceMap) {
  const { sourceModel, sourceMap } = impactContext(change, beforeModel, afterModel, beforeSourceMap, afterSourceMap);
  const formalization = domainImpactItems(sourceModel, "formalizations").find((entry) => entry.id === change.id) ?? null;
  const affectedRules = formalization?.rule ? [formalization.rule] : [];
  const checks = sortedChecks(formalization);
  return {
    kind: "formalization",
    id: change.id,
    change: change.change,
    affectedRules,
    generated: generatedForRuleIds(sourceMap, affectedRules),
    implementationRefs: sortedImplementationRefs([formalization?.target]),
    checks,
    reverification: reverificationForChecks(checks),
  };
}

function refinementImpact(change, beforeModel, afterModel, beforeSourceMap, afterSourceMap) {
  const { sourceModel, sourceMap } = impactContext(change, beforeModel, afterModel, beforeSourceMap, afterSourceMap);
  const refinement = domainImpactItems(sourceModel, "refinements").find((entry) => entry.id === change.id) ?? null;
  const formalizations = new Map(domainImpactItems(sourceModel, "formalizations").map((entry) => [entry.id, entry]));
  const source = formalizations.get(refinement?.sourceFormalization) ?? null;
  const target = formalizations.get(refinement?.targetFormalization) ?? null;
  const affectedRules = [...new Set([source?.rule, target?.rule, ...list(refinement?.preserves)].filter(Boolean))].sort();
  const checks = sortedChecks(refinement);
  const implementationRefs = sortedImplementationRefs([source?.target, target?.target]);
  return {
    kind: "refinement",
    id: change.id,
    change: change.change,
    affectedRules,
    generated: generatedForRuleIds(sourceMap, affectedRules),
    implementationRefs,
    checks,
    reverification: reverificationForChecks(checks),
  };
}

function impactReport(beforeModel, afterModel, { afterFile = null } = {}) {
  const beforeErrors = validate(beforeModel).map((error) => `before: ${error}`);
  const afterErrors = validate(afterModel).map((error) => `after: ${error}`);
  const errors = [...beforeErrors, ...afterErrors];
  const model = {
    before: modelReport(beforeModel),
    after: modelReport(afterModel),
  };

  if (errors.length > 0) {
    return {
      changed: { projections: [], terms: [], rules: [], formalizations: [], refinements: [] },
      errors,
      impacts: [],
      model,
      projectionImpact: { artifacts: [], regenerateArgv: null, regenerateCommand: null },
      status: "fail",
    };
  }

  const beforeSourceMap = emitSourceMapObject(beforeModel, beforeModel.primaryLocale);
  const afterSourceMap = emitSourceMapObject(afterModel, afterModel.primaryLocale);
  const changed = {
    projections: diffItems(projections(beforeModel), projections(afterModel)),
    terms: diffItems(beforeModel.vocabulary, afterModel.vocabulary),
    rules: diffItems(beforeModel.rules, afterModel.rules),
    formalizations: diffItems(domainImpactItems(beforeModel, "formalizations"), domainImpactItems(afterModel, "formalizations")),
    refinements: diffItems(domainImpactItems(beforeModel, "refinements"), domainImpactItems(afterModel, "refinements")),
  };
  const impacts = [];

  for (const change of changed.terms) {
    const sourceModel = sourceModelForChange(change, beforeModel, afterModel);
    const sourceMap = sourceMapForChange(change, beforeSourceMap, afterSourceMap);
    const affectedRules = termAffectedRuleIds(beforeModel, afterModel, change.id);
    const affectedRuleObjects = affectedRules.map((ruleId) => ruleById(sourceModel, ruleId) ?? ruleById(beforeModel, ruleId) ?? ruleById(afterModel, ruleId));
    const generated = [
      ...generatedForTermId(sourceMap, change.id),
      ...generatedForRuleIds(sourceMap, affectedRules),
    ];
    impacts.push({
      kind: "term",
      id: change.id,
      change: change.change,
      affectedRules,
      generated,
      implementationRefs: ruleImplementationRefs(...affectedRuleObjects),
    });
  }

  for (const change of changed.rules) {
    const sourceModel = sourceModelForChange(change, beforeModel, afterModel);
    const sourceMap = sourceMapForChange(change, beforeSourceMap, afterSourceMap);
    const rule = ruleById(sourceModel, change.id);
    impacts.push({
      kind: "rule",
      id: change.id,
      change: change.change,
      affectedRules: [change.id],
      generated: generatedForRuleIds(sourceMap, [change.id]),
      implementationRefs: ruleImplementationRefs(rule),
    });
  }

  for (const change of changed.formalizations) {
    impacts.push(formalizationImpact(change, beforeModel, afterModel, beforeSourceMap, afterSourceMap));
  }

  for (const change of changed.refinements) {
    impacts.push(refinementImpact(change, beforeModel, afterModel, beforeSourceMap, afterSourceMap));
  }

  impacts.sort((left, right) => `${left.kind}\u0000${left.id}`.localeCompare(`${right.kind}\u0000${right.id}`));

  return {
    changed,
    errors: [],
    impacts,
    model,
    projectionImpact: projectionImpactReport(beforeModel, afterModel, afterFile),
    status: "pass",
  };
}

function renderImpactReport(report) {
  if (report.status === "fail") {
    return `spec impact failed\n${report.errors.join("\n")}\n`;
  }
  const changeCount = report.changed.projections.length
    + report.changed.terms.length
    + report.changed.rules.length
    + report.changed.formalizations.length
    + report.changed.refinements.length;
  const lines = [`ok: spec impact (${changeCount} changes)`];
  for (const impact of report.impacts) {
    lines.push(`- ${impact.kind} ${impact.id} ${impact.change}`);
    if (impact.affectedRules.length > 0) {
      lines.push(`  affected rules: ${impact.affectedRules.join(", ")}`);
    }
    if (impact.generated.length > 0) {
      lines.push(`  generated selectors: ${impact.generated.map((entry) => entry.generated).join(", ")}`);
    }
    if (impact.implementationRefs.length > 0) {
      lines.push(`  implementation refs: ${impact.implementationRefs.map((ref) => `${ref.path}${ref.symbol ? `#${ref.symbol}` : ""}`).join(", ")}`);
    }
    if (impact.reverification?.length > 0) {
      lines.push(`  reverify: ${impact.reverification.join(", ")}`);
    }
  }
  for (const artifact of report.projectionImpact.artifacts) {
    lines.push(`- generated artifact ${artifact.action}: ${artifact.path}`);
  }
  if (report.projectionImpact.regenerateCommand) {
    lines.push(`- regenerate: ${report.projectionImpact.regenerateCommand}`);
  }
  return `${lines.join("\n")}\n`;
}

function itemById(items) {
  return new Map(list(items).map((item) => [item.id, item]));
}

function activeRule(rule) {
  return Boolean(rule && rule.reviewStatus === "approved" && !rule.deprecated);
}

function rulePolicyDirection(rule) {
  if (!activeRule(rule)) return "compatible";
  if (rule.kind === "permission" || rule.kind === "exception") return "widening";
  if (
    rule.kind === "prohibition" ||
    rule.kind === "obligation" ||
    rule.kind === "invariant" ||
    rule.kind === "transition"
  ) {
    return "narrowing";
  }
  if (rule.kind === "example" || rule.kind === "witness" || rule.kind === "non_goal" || rule.kind === "decision") {
    return "compatible";
  }
  return "unknown";
}

function decision(change, classification, reason, extra = {}) {
  return {
    change,
    classification,
    reason,
    ...extra,
  };
}

function termSemanticSignature(term) {
  return stableJson({
    kind: term.kind,
    values: list(term.values),
    world: term.world ?? "open",
    supersedes: list(term.supersedes),
  });
}

function clauseSet(rule, field) {
  return new Set(list(rule?.[field]).map(clauseIdentity));
}

function setDifference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

function ruleTextualSignature(rule) {
  return stableJson({
    checks: list(rule.checks),
    implementedBy: list(rule.implementedBy),
    priority: rule.priority,
    rationale: rule.rationale ?? null,
    text: rule.text ?? null,
  });
}

function classifyModifiedApprovedRule(before, after) {
  if (before.kind !== after.kind) {
    return decision(`rule:${after.id}:modified`, "unknown", "approved rule kind changed");
  }
  const beforeClauses = {
    when: clauseSet(before, "when"),
    must: clauseSet(before, "must"),
    mustNot: clauseSet(before, "mustNot"),
  };
  const afterClauses = {
    when: clauseSet(after, "when"),
    must: clauseSet(after, "must"),
    mustNot: clauseSet(after, "mustNot"),
  };
  const added = [
    ...setDifference(afterClauses.when, beforeClauses.when).map((expr) => `when:${expr}`),
    ...setDifference(afterClauses.must, beforeClauses.must).map((expr) => `must:${expr}`),
    ...setDifference(afterClauses.mustNot, beforeClauses.mustNot).map((expr) => `mustNot:${expr}`),
  ];
  const removed = [
    ...setDifference(beforeClauses.when, afterClauses.when).map((expr) => `when:${expr}`),
    ...setDifference(beforeClauses.must, afterClauses.must).map((expr) => `must:${expr}`),
    ...setDifference(beforeClauses.mustNot, afterClauses.mustNot).map((expr) => `mustNot:${expr}`),
  ];
  if (added.length > 0 && removed.length > 0) {
    return decision(`rule:${after.id}:modified`, "unknown", "approved rule clauses were both added and removed", { added, removed });
  }
  if (added.length > 0) {
    return decision(`rule:${after.id}:modified`, "narrowing", "approved rule gained clauses", { added, removed });
  }
  if (removed.length > 0) {
    return decision(`rule:${after.id}:modified`, "widening", "approved rule lost clauses", { added, removed });
  }
  const addedAssurances = setDifference(
    new Set(ruleRequiredAssurances(after)),
    new Set(ruleRequiredAssurances(before)),
  );
  const removedAssurances = setDifference(
    new Set(ruleRequiredAssurances(before)),
    new Set(ruleRequiredAssurances(after)),
  );
  if (addedAssurances.length > 0 && removedAssurances.length > 0) {
    return decision(
      `rule:${after.id}:modified`,
      "unknown",
      "approved rule assurance requirements were both added and removed",
      { addedAssurances, removedAssurances },
    );
  }
  if (addedAssurances.length > 0) {
    return decision(
      `rule:${after.id}:modified`,
      "narrowing",
      "approved rule gained assurance requirements",
      { addedAssurances, removedAssurances },
    );
  }
  if (removedAssurances.length > 0) {
    return decision(
      `rule:${after.id}:modified`,
      "widening",
      "approved rule lost assurance requirements",
      { addedAssurances, removedAssurances },
    );
  }
  if (ruleTextualSignature(before) !== ruleTextualSignature(after)) {
    return decision(`rule:${after.id}:modified`, "compatible", "approved rule support metadata or text changed without changing clauses");
  }
  return decision(`rule:${after.id}:modified`, "compatible", "approved rule is semantically unchanged");
}

function classifyTermChange(change, beforeModel, afterModel) {
  const before = itemById(beforeModel.vocabulary).get(change.id);
  const after = itemById(afterModel.vocabulary).get(change.id);
  if (change.change === "added") {
    return decision(`term:${change.id}:added`, "compatible", "new vocabulary term does not constrain existing behavior");
  }
  if (change.change === "removed") {
    const affected = termAffectedRuleIds(beforeModel, change.id);
    return decision(
      `term:${change.id}:removed`,
      affected.length > 0 ? "breaking" : "compatible",
      affected.length > 0 ? "removed term is referenced by rules" : "removed term was not referenced by rules",
      { affectedRules: affected },
    );
  }
  if (termSemanticSignature(before) === termSemanticSignature(after)) {
    return decision(`term:${change.id}:modified`, "compatible", "term label or aliases changed without changing semantic fields");
  }
  return decision(`term:${change.id}:modified`, "unknown", "term semantic fields changed");
}

function classifyRuleChange(change, beforeModel, afterModel) {
  const before = ruleById(beforeModel, change.id);
  const after = ruleById(afterModel, change.id);
  if (change.change === "added") {
    const classification = rulePolicyDirection(after);
    return decision(`rule:${change.id}:added`, classification, `added ${activeRule(after) ? "approved" : "inactive"} ${after.kind} rule`);
  }
  if (change.change === "removed") {
    return decision(
      `rule:${change.id}:removed`,
      activeRule(before) ? "breaking" : "compatible",
      activeRule(before) ? "approved rule id was removed" : "inactive rule was removed",
    );
  }
  if (activeRule(before) && !activeRule(after)) {
    return decision(`rule:${change.id}:modified`, "breaking", "approved rule became inactive");
  }
  if (!activeRule(before) && activeRule(after)) {
    const classification = rulePolicyDirection(after);
    return decision(`rule:${change.id}:modified`, classification, `inactive rule became approved ${after.kind} rule`);
  }
  if (!activeRule(before) && !activeRule(after)) {
    return decision(`rule:${change.id}:modified`, "compatible", "inactive rule changed");
  }
  return classifyModifiedApprovedRule(before, after);
}

function domainElementKey(element) {
  return `${element.kind}:${element.id}`;
}

function classifyDomainElementChange(change) {
  if (change.change === "added") {
    return decision(`domain:${change.id}:added`, "narrowing", "new domain element requires additional implementation evidence", { domain: change.kind });
  }
  if (change.change === "removed") {
    return decision(`domain:${change.id}:removed`, "breaking", "domain element id was removed", { domain: change.kind });
  }
  return decision(`domain:${change.id}:modified`, "unknown", "domain element changed");
}

function domainElementDiff(beforeModel, afterModel) {
  const before = new Map(domainCoverageElements(beforeModel).map((element) => [domainElementKey(element), element]));
  const after = new Map(domainCoverageElements(afterModel).map((element) => [domainElementKey(element), element]));
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changes = [];
  for (const key of keys) {
    const beforeElement = before.get(key);
    const afterElement = after.get(key);
    if (!beforeElement) {
      changes.push({ id: afterElement.id, kind: afterElement.kind, change: "added" });
    } else if (!afterElement) {
      changes.push({ id: beforeElement.id, kind: beforeElement.kind, change: "removed" });
    } else if (stableJson(beforeElement) !== stableJson(afterElement)) {
      changes.push({ id: afterElement.id, kind: afterElement.kind, change: "modified" });
    }
  }
  return changes;
}

function intentFieldSemanticSignature(field) {
  return stableJson({
    type: field.type,
    required: field.required !== false,
    allowedValues: list(field.allowedValues),
    minimum: field.minimum ?? null,
    maximum: field.maximum ?? null,
    pattern: field.pattern ?? null,
  });
}

function intentEffectSemanticSignature(effect) {
  return stableJson({
    capability: effect.capability,
    required: effect.required !== false,
    outputContract: intentContractProjection(effect.outputContract),
  });
}

function intentExecutionPolicySignature(execution) {
  if (!execution) return null;
  return stableJson({
    maxInFlight: execution.maxInFlight,
    idempotencyKey: execution.idempotencyKey ?? null,
    timeoutSteps: execution.timeoutSteps ?? null,
    timeoutMs: execution.timeoutMs ?? null,
  });
}

function intentContractFieldMap(contract) {
  return new Map(list(contract?.fields).map((field) => [field.id, field]));
}

function intentProcessCompatibilityDecision(before, after) {
  if (!before) {
    return decision(`intent-process:${after.id}:added`, "narrowing", "new Intent Process requires implementation and trace evidence", {
      reverification: ["drift", "intent verify"],
    });
  }
  if (!after) {
    return decision(`intent-process:${before.id}:removed`, "breaking", "Intent Process id was removed", {
      reverification: ["impact", "intent verify"],
    });
  }
  if (stableJson(before) === stableJson(after)) return null;

  const beforeOutcomes = new Set(list(before.outcomes));
  const afterOutcomes = new Set(list(after.outcomes));
  const removedOutcomes = setDifference(beforeOutcomes, afterOutcomes);
  const addedOutcomes = setDifference(afterOutcomes, beforeOutcomes);
  if (removedOutcomes.length > 0) {
    return decision(`intent-process:${after.id}:modified`, "breaking", "Intent Process removed declared outcomes", {
      removedOutcomes,
      addedOutcomes,
      reverification: ["impact", "intent verify"],
    });
  }

  const beforeFields = intentContractFieldMap(before.inputContract);
  const afterFields = intentContractFieldMap(after.inputContract);
  const addedRequiredFields = [...afterFields.values()]
    .filter((field) => field.required !== false && !beforeFields.has(field.id))
    .map((field) => field.id)
    .sort();
  const removedRequiredFields = [...beforeFields.values()]
    .filter((field) => field.required !== false && !afterFields.has(field.id))
    .map((field) => field.id)
    .sort();
  const modifiedFields = [...beforeFields.keys()]
    .filter((id) => afterFields.has(id) && intentFieldSemanticSignature(beforeFields.get(id)) !== intentFieldSemanticSignature(afterFields.get(id)))
    .sort();
  if (addedRequiredFields.length > 0 && removedRequiredFields.length > 0) {
    return decision(`intent-process:${after.id}:modified`, "unknown", "Intent Process both added and removed required input fields", {
      addedRequiredFields,
      removedRequiredFields,
      reverification: ["intent verify"],
    });
  }
  if (addedRequiredFields.length > 0) {
    return decision(`intent-process:${after.id}:modified`, "narrowing", "Intent Process gained required input fields", {
      addedRequiredFields,
      reverification: ["drift", "intent verify"],
    });
  }
  if (removedRequiredFields.length > 0) {
    return decision(`intent-process:${after.id}:modified`, "widening", "Intent Process lost required input fields", {
      removedRequiredFields,
      reverification: ["intent verify"],
    });
  }
  if (modifiedFields.length > 0) {
    return decision(`intent-process:${after.id}:modified`, "unknown", "Intent Process changed existing input field constraints", {
      modifiedFields,
      reverification: ["intent verify"],
    });
  }
  if (addedOutcomes.length > 0) {
    return decision(`intent-process:${after.id}:modified`, "widening", "Intent Process gained declared outcomes", {
      addedOutcomes,
      reverification: ["intent verify"],
    });
  }
  if (intentExecutionPolicySignature(before.execution) !== intentExecutionPolicySignature(after.execution)) {
    const beforeExecution = before.execution ?? null;
    const afterExecution = after.execution ?? null;
    const classifications = [];
    if (!beforeExecution && afterExecution) classifications.push("narrowing");
    if (beforeExecution && !afterExecution) classifications.push("widening");
    if (beforeExecution && afterExecution) {
      if (afterExecution.maxInFlight < beforeExecution.maxInFlight) classifications.push("narrowing");
      if (afterExecution.maxInFlight > beforeExecution.maxInFlight) classifications.push("widening");
      if (beforeExecution.idempotencyKey !== afterExecution.idempotencyKey) {
        if (!beforeExecution.idempotencyKey) classifications.push("narrowing");
        else if (!afterExecution.idempotencyKey) classifications.push("widening");
        else classifications.push("unknown");
      }
      if (beforeExecution.timeoutSteps !== afterExecution.timeoutSteps) {
        if (beforeExecution.timeoutSteps === null || beforeExecution.timeoutSteps === undefined) classifications.push("narrowing");
        else if (afterExecution.timeoutSteps === null || afterExecution.timeoutSteps === undefined) classifications.push("widening");
        else classifications.push(afterExecution.timeoutSteps < beforeExecution.timeoutSteps ? "narrowing" : "widening");
      }
      if (beforeExecution.timeoutMs !== afterExecution.timeoutMs) {
        if (beforeExecution.timeoutMs === null || beforeExecution.timeoutMs === undefined) classifications.push("narrowing");
        else if (afterExecution.timeoutMs === null || afterExecution.timeoutMs === undefined) classifications.push("widening");
        else classifications.push(afterExecution.timeoutMs < beforeExecution.timeoutMs ? "narrowing" : "widening");
      }
    }
    const distinct = new Set(classifications);
    const classification = distinct.size > 1 || distinct.has("unknown") ? "unknown" : classifications[0] ?? "unknown";
    return decision(
      `intent-process:${after.id}:modified`,
      classification,
      classification === "unknown"
        ? "Intent Process changed execution policy in both tightening and relaxing directions"
        : `Intent Process ${classification === "narrowing" ? "tightened" : "relaxed"} execution policy`,
      {
        before: beforeExecution,
        after: afterExecution,
        reverification: ["verify-generated", "intent verify", "intent exercise"],
      },
    );
  }
  return decision(`intent-process:${after.id}:modified`, "compatible", "Intent Process support metadata or refinement mapping changed", {
    reverification: ["drift", "intent verify"],
  });
}

function intentCompatibilityDecisions(beforeModel, afterModel) {
  const beforeProcesses = new Map(intentProcesses(intentPattern(beforeModel)).map((process) => [process.id, process]));
  const afterProcesses = new Map(intentProcesses(intentPattern(afterModel)).map((process) => [process.id, process]));
  const ids = [...new Set([...beforeProcesses.keys(), ...afterProcesses.keys()])].sort();
  const processDecisions = ids
    .map((id) => intentProcessCompatibilityDecision(beforeProcesses.get(id), afterProcesses.get(id)))
    .filter((entry) => entry !== null);
  const beforeOutcomes = new Map(intentOutcomes(intentPattern(beforeModel)).map((outcome) => [outcome.id, outcome]));
  const afterOutcomes = new Map(intentOutcomes(intentPattern(afterModel)).map((outcome) => [outcome.id, outcome]));
  const outcomeIds = [...new Set([...beforeOutcomes.keys(), ...afterOutcomes.keys()])].sort();
  const outcomeDecisions = outcomeIds.flatMap((id) => {
    const before = beforeOutcomes.get(id);
    const after = afterOutcomes.get(id);
    if (!before) return [decision(`intent-outcome:${id}:added`, "widening", "Intent Outcome id was added", { reverification: ["intent verify"] })];
    if (!after) return [decision(`intent-outcome:${id}:removed`, "breaking", "Intent Outcome id was removed", { reverification: ["impact", "intent verify"] })];
    if (stableJson(before) === stableJson(after)) return [];
    const beforeEffects = new Map(list(before.effects).map((effect) => [effect.id, effect]));
    const afterEffects = new Map(list(after.effects).map((effect) => [effect.id, effect]));
    const addedRequiredEffects = [...afterEffects.values()]
      .filter((effect) => effect.required !== false && !beforeEffects.has(effect.id))
      .map((effect) => effect.id)
      .sort();
    const removedRequiredEffects = [...beforeEffects.values()]
      .filter((effect) => effect.required !== false && !afterEffects.has(effect.id))
      .map((effect) => effect.id)
      .sort();
    const modifiedEffects = [...beforeEffects.keys()]
      .filter((effectId) => afterEffects.has(effectId) && intentEffectSemanticSignature(beforeEffects.get(effectId)) !== intentEffectSemanticSignature(afterEffects.get(effectId)))
      .sort();
    if (addedRequiredEffects.length > 0 && removedRequiredEffects.length > 0) {
      return [decision(`intent-outcome:${id}:modified`, "unknown", "Intent Outcome both added and removed required effects", { addedRequiredEffects, removedRequiredEffects, reverification: ["intent verify", "intent exercise"] })];
    }
    if (addedRequiredEffects.length > 0) {
      return [decision(`intent-outcome:${id}:modified`, "narrowing", "Intent Outcome gained required effects", { addedRequiredEffects, reverification: ["intent verify", "intent exercise"] })];
    }
    if (removedRequiredEffects.length > 0) {
      return [decision(`intent-outcome:${id}:modified`, "widening", "Intent Outcome lost required effects", { removedRequiredEffects, reverification: ["intent verify"] })];
    }
    if (modifiedEffects.length > 0) {
      return [decision(`intent-outcome:${id}:modified`, "unknown", "Intent Outcome changed effect postconditions", { modifiedEffects, reverification: ["intent verify", "intent exercise"] })];
    }
    const beforeFields = intentContractFieldMap(before.outputContract);
    const afterFields = intentContractFieldMap(after.outputContract);
    const addedRequiredFields = [...afterFields.values()]
      .filter((field) => field.required !== false && !beforeFields.has(field.id))
      .map((field) => field.id)
      .sort();
    const removedRequiredFields = [...beforeFields.values()]
      .filter((field) => field.required !== false && !afterFields.has(field.id))
      .map((field) => field.id)
      .sort();
    if (addedRequiredFields.length > 0) {
      return [decision(`intent-outcome:${id}:modified`, "narrowing", "Intent Outcome gained required output fields", { addedRequiredFields, reverification: ["intent verify"] })];
    }
    if (removedRequiredFields.length > 0) {
      return [decision(`intent-outcome:${id}:modified`, "widening", "Intent Outcome lost required output fields", { removedRequiredFields, reverification: ["intent verify"] })];
    }
    return [decision(`intent-outcome:${id}:modified`, "unknown", "Intent Outcome changed state or output constraints", { reverification: ["intent verify"] })];
  });
  return [...processDecisions, ...outcomeDecisions];
}

function overallSpecCompatibility(decisions) {
  const classes = new Set(decisions.map((entry) => entry.classification));
  if (classes.has("breaking")) return "breaking";
  if (classes.has("unknown")) return "unknown";
  if (classes.has("narrowing") && classes.has("widening")) return "unknown";
  if (classes.has("narrowing")) return "narrowing";
  if (classes.has("widening")) return "widening";
  return "compatible";
}

function specCompatibilityReport(beforeModel, afterModel) {
  const beforeErrors = validate(beforeModel).map((error) => `before: ${error}`);
  const afterErrors = validate(afterModel).map((error) => `after: ${error}`);
  const errors = [...beforeErrors, ...afterErrors];
  const model = {
    before: modelReport(beforeModel),
    after: modelReport(afterModel),
  };
  if (errors.length > 0) {
    return {
      model,
      status: "fail",
      classification: "unknown",
      decisions: [],
      summary: { compatible: 0, narrowing: 0, widening: 0, breaking: 0, unknown: 0 },
      errors,
    };
  }

  const changed = {
    terms: diffItems(beforeModel.vocabulary, afterModel.vocabulary),
    rules: diffItems(beforeModel.rules, afterModel.rules),
    domain: domainElementDiff(beforeModel, afterModel),
  };
  const decisions = [
    ...changed.terms.map((change) => classifyTermChange(change, beforeModel, afterModel)),
    ...changed.rules.map((change) => classifyRuleChange(change, beforeModel, afterModel)),
    ...changed.domain.filter((change) => !change.kind.startsWith("intent.")).map(classifyDomainElementChange),
    ...intentCompatibilityDecisions(beforeModel, afterModel),
  ];
  const summary = { compatible: 0, narrowing: 0, widening: 0, breaking: 0, unknown: 0 };
  for (const entry of decisions) summary[entry.classification] += 1;
  return {
    model,
    status: "pass",
    classification: overallSpecCompatibility(decisions),
    changed,
    decisions,
    summary,
    errors: [],
  };
}

function renderSpecCompatibilityMarkdownReport(report) {
  const lines = [
    `# Spec Compatibility ${report.model.after.id}`,
    "",
    `- status: \`${report.status}\``,
    `- classification: \`${report.classification}\``,
    `- before: \`${report.model.before.id}@${report.model.before.version}\``,
    `- after: \`${report.model.after.id}@${report.model.after.version}\``,
    "",
    "| Change | Classification | Reason |",
    "| --- | --- | --- |",
  ];
  for (const entry of report.decisions) {
    lines.push(`| ${markdownCell(entry.change)} | ${markdownCell(entry.classification)} | ${markdownCell(entry.reason)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function renderSpecCompatibilityReport(report) {
  if (report.status === "fail") {
    return `spec compatibility failed\n${report.errors.join("\n")}\n`;
  }
  return `ok: spec compatibility ${report.classification} (${report.decisions.length} decisions)\n`;
}

const DEFAULT_SPEC_CHANGE_REVIEW_STEPS = [
  "check-before",
  "check-after",
  "impact",
  "compatibility",
  "breaking-policy",
  "evidence-ref",
  "coverage-after",
];

const DEFAULT_BREAKING_CHANGE_EVIDENCE = [
  "migration-plan",
  "deprecation-plan",
  "rollout-plan",
  "owner-approval",
];

function resolveReviewModelPath(reviewFile, modelPath) {
  if (isAbsolute(modelPath)) return modelPath;
  if (existsSync(modelPath)) return resolve(modelPath);
  return resolve(dirname(resolve(reviewFile)), modelPath);
}

function findAncestorContaining(startDir, relativePath) {
  let current = resolve(startDir);
  while (true) {
    if (existsSync(join(current, relativePath))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function specChangeReviewExecutionRoot(modelPaths) {
  for (const modelPath of modelPaths) {
    const fromSchema = findAncestorContaining(dirname(resolve(modelPath)), "dspec/Schema.pkl");
    if (fromSchema) return fromSchema;
    const fromPackage = findAncestorContaining(dirname(resolve(modelPath)), "package.json");
    if (fromPackage) return fromPackage;
  }
  return process.cwd();
}

function withWorkingDirectory(dir, fn) {
  const previous = process.cwd();
  if (resolve(previous) === resolve(dir)) return fn();
  process.chdir(dir);
  try {
    return fn();
  } finally {
    process.chdir(previous);
  }
}

function specChangeReviewSteps(review) {
  const steps = list(review.requiredSteps);
  return steps.length > 0 ? steps : DEFAULT_SPEC_CHANGE_REVIEW_STEPS;
}

function stepReport(id, status, summary, errors, extra = {}) {
  return {
    id,
    status,
    summary,
    errors,
    ...extra,
  };
}

function specChangeCheckStep(id, report) {
  return stepReport(
    id,
    report.status,
    `${report.model.id}@${report.model.version}: ${report.summary.terms} terms, ${report.summary.rules} rules`,
    report.errors,
    { model: report.model },
  );
}

function specChangeImpactStep(report) {
  const changes = list(report.changed.projections).length + list(report.changed.terms).length + list(report.changed.rules).length;
  return stepReport(
    "impact",
    report.status,
    `${changes} changes, ${list(report.impacts).length} impacts`,
    report.errors,
    {
      changes,
      impacts: list(report.impacts).length,
      projectionArtifacts: list(report.projectionImpact?.artifacts).length,
      regenerateArgv: report.projectionImpact?.regenerateArgv ?? null,
      regenerateCommand: report.projectionImpact?.regenerateCommand ?? null,
    },
  );
}

function specChangeCompatibilityStep(report, review) {
  const errors = [...report.errors];
  const allowed = list(review.allowedCompatibility);
  if (review.expectedCompatibility && report.classification !== review.expectedCompatibility) {
    errors.push(`expected compatibility ${review.expectedCompatibility}, actual ${report.classification}`);
  }
  if (allowed.length > 0 && !allowed.includes(report.classification)) {
    errors.push(`compatibility ${report.classification} is not allowed (allowed: ${allowed.join(", ")})`);
  }
  return stepReport(
    "compatibility",
    reportStatus(errors),
    `${report.classification}: ${list(report.decisions).length} decisions`,
    errors,
    {
      classification: report.classification,
      decisions: list(report.decisions).length,
    },
  );
}

function specChangeCoverageStep(report) {
  return stepReport(
    "coverage-after",
    report.status,
    `${report.covered}/${report.total} approved rules`,
    report.errors,
    {
      covered: report.covered,
      total: report.total,
    },
  );
}

function specChangeEvidenceRef(review, kind) {
  return `docs/${review.id}.md#${kind}`;
}

function specChangeEvidencePkl(kind, ref) {
  return [
    "new {",
    `  kind = ${pklString(kind)}`,
    `  ref = ${pklString(ref)}`,
    "}",
  ].join("\n");
}

function specChangeEvidenceSuggestion(review, kind) {
  const ref = specChangeEvidenceRef(review, kind);
  return {
    kind,
    ref,
    pkl: specChangeEvidencePkl(kind, ref),
  };
}

function specChangeBreakingPolicyStep(compatibility, review) {
  const requiredEvidence = list(review.breakingRequires);
  const effectiveRequired = requiredEvidence.length > 0 ? requiredEvidence : DEFAULT_BREAKING_CHANGE_EVIDENCE;
  const presentEvidence = [...new Set(list(review.evidence).map((entry) => entry.kind).filter(Boolean))].sort();
  const missingEvidence = compatibility.classification === "breaking"
    ? effectiveRequired.filter((kind) => !presentEvidence.includes(kind)).sort()
    : [];
  const errors = missingEvidence.length > 0
    ? [`missing breaking change evidence: ${missingEvidence.join(", ")}`]
    : [];
  const summary = compatibility.classification === "breaking"
    ? `breaking evidence ${effectiveRequired.length - missingEvidence.length}/${effectiveRequired.length}`
    : "not breaking";
  const extra = {
    requiredEvidence: effectiveRequired,
    presentEvidence,
    missingEvidence,
  };
  if (missingEvidence.length > 0) {
    extra.suggestedEvidence = missingEvidence.map((kind) => specChangeEvidenceSuggestion(review, kind));
  }

  return stepReport(
    "breaking-policy",
    reportStatus(errors),
    summary,
    errors,
    extra,
  );
}

function markdownHeadingAnchor(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function markdownAnchors(content) {
  const anchors = new Set();
  for (const line of content.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) anchors.add(markdownHeadingAnchor(match[2]));
  }
  return anchors;
}

function specChangeEvidenceRefStep(review, reviewFile) {
  const refs = [];
  const errors = [];

  for (const evidence of list(review.evidence)) {
    const rawRef = evidence.ref ?? "";
    const { path, anchor } = splitRef(rawRef);
    const resolvedPath = resolveReviewModelPath(reviewFile, path);
    const entry = {
      kind: evidence.kind,
      ref: rawRef,
      path,
      anchor: anchor ?? null,
      status: "pass",
    };

    if (!path) {
      entry.status = "fail";
      entry.reason = "missing evidence path";
      errors.push(`missing evidence path: ${rawRef}`);
      refs.push(entry);
      continue;
    }
    if (!existsSync(resolvedPath)) {
      entry.status = "fail";
      entry.reason = "missing evidence file";
      errors.push(`missing evidence file: ${rawRef}`);
      refs.push(entry);
      continue;
    }
    if (path.endsWith(".md")) {
      if (!anchor) {
        entry.status = "fail";
        entry.reason = "missing markdown evidence anchor";
        errors.push(`missing markdown evidence anchor: ${rawRef}`);
        refs.push(entry);
        continue;
      }
      const anchors = markdownAnchors(readTextFile(resolvedPath));
      if (!anchors.has(anchor)) {
        entry.status = "fail";
        entry.reason = "missing markdown evidence anchor";
        errors.push(`missing markdown evidence anchor: ${rawRef}`);
      }
    }
    refs.push(entry);
  }

  const passed = refs.filter((entry) => entry.status === "pass").length;
  return stepReport(
    "evidence-ref",
    reportStatus(errors),
    `${passed}/${refs.length} evidence refs`,
    errors,
    { refs },
  );
}

function specChangeReviewReport(review, reviewFile) {
  const beforeFile = resolveReviewModelPath(reviewFile, review.beforeModelPath);
  const afterFile = resolveReviewModelPath(reviewFile, review.afterModelPath);
  const executionRoot = specChangeReviewExecutionRoot([beforeFile, afterFile]);
  return withWorkingDirectory(executionRoot, () => {
    const beforeModel = loadModel(beforeFile);
    const afterModel = loadModel(afterFile);
    const checkBefore = checkReport(beforeModel);
    const checkAfter = checkReport(afterModel);
    const impactAfterFile = normalizedGeneratedPath(relative(executionRoot, afterFile));
    const impact = impactReport(beforeModel, afterModel, { afterFile: impactAfterFile });
    const compatibility = specCompatibilityReport(beforeModel, afterModel);
    const coverageAfter = coverageReport(afterModel);
    const availableSteps = new Map([
      ["check-before", specChangeCheckStep("check-before", checkBefore)],
      ["check-after", specChangeCheckStep("check-after", checkAfter)],
      ["impact", specChangeImpactStep(impact)],
      ["compatibility", specChangeCompatibilityStep(compatibility, review)],
      ["breaking-policy", specChangeBreakingPolicyStep(compatibility, review)],
      ["evidence-ref", specChangeEvidenceRefStep(review, reviewFile)],
      ["coverage-after", specChangeCoverageStep(coverageAfter)],
    ]);
    const requiredSteps = specChangeReviewSteps(review);
    const steps = requiredSteps.map((id) => availableSteps.get(id) ?? stepReport(id, "fail", "unknown review step", [
      `unknown spec change review step: ${id}`,
    ]));
    const errors = steps.flatMap((step) => list(step.errors).map((error) => `${step.id}: ${error}`));

    return {
      review: {
        id: review.id,
        beforeModelPath: review.beforeModelPath,
        afterModelPath: review.afterModelPath,
        expectedCompatibility: review.expectedCompatibility ?? null,
        allowedCompatibility: list(review.allowedCompatibility),
        breakingRequires: list(review.breakingRequires),
        evidence: list(review.evidence),
        requiredSteps,
      },
      model: {
        before: modelReport(beforeModel),
        after: modelReport(afterModel),
      },
      status: reportStatus(errors),
      classification: compatibility.classification,
      passed: steps.filter((step) => step.status === "pass").length,
      total: steps.length,
      steps,
      errors,
    };
  });
}

function renderSpecChangeReviewMarkdownReport(report) {
  const suggestedEvidence = report.steps.flatMap((step) => list(step.suggestedEvidence));
  const lines = [
    `# Spec Change Review ${report.review.id}`,
    "",
    `- status: \`${report.status}\``,
    `- classification: \`${report.classification}\``,
    `- before: \`${report.model.before.id}@${report.model.before.version}\``,
    `- after: \`${report.model.after.id}@${report.model.after.version}\``,
    `- expected compatibility: \`${report.review.expectedCompatibility ?? "none"}\``,
    `- allowed compatibility: \`${report.review.allowedCompatibility.join(", ") || "any"}\``,
    `- breaking evidence: \`${report.review.breakingRequires.join(", ") || "default"}\``,
    "",
    "| Step | Status | Summary | Errors |",
    "| --- | --- | --- | --- |",
  ];
  for (const step of report.steps) {
    lines.push(
      `| ${markdownCell(step.id)} | ${markdownCell(step.status)} | ${markdownCell(step.summary)} | ${markdownCell(list(step.errors).join("<br>"))} |`,
    );
  }
  if (suggestedEvidence.length > 0) {
    lines.push("", "## Suggested Evidence", "", "```pkl", "evidence {");
    for (const evidence of suggestedEvidence) {
      lines.push(...evidence.pkl.split("\n").map((line) => `  ${line}`));
    }
    lines.push("}", "```");
  }
  return `${lines.join("\n")}\n`;
}

function renderSpecChangeReviewReport(report) {
  if (report.status === "fail") {
    const suggestedEvidence = report.steps.flatMap((step) => list(step.suggestedEvidence));
    const lines = ["spec change review failed", ...report.errors];
    if (suggestedEvidence.length > 0) {
      lines.push("", "suggested evidence entries:");
      for (const evidence of suggestedEvidence) {
        lines.push(...evidence.pkl.split("\n").map((line) => `  ${line}`));
      }
    }
    return `${lines.join("\n")}\n`;
  }
  return `ok: ${report.review.id} spec change review ${report.classification} (${report.passed}/${report.total} steps)\n`;
}

function specChangeReviewDraftId(beforeModel, afterModel) {
  const raw = `${afterModel.id}-${beforeModel.version}-to-${afterModel.version}`;
  const normalized = raw.replace(/[^a-zA-Z0-9_.\-/]+/g, "-").replace(/^-+/, "");
  if (/^[a-zA-Z0-9]/.test(normalized)) return normalized;
  return `spec-change-review-${normalized || "draft"}`;
}

function defaultAllowedCompatibility(classification) {
  if (classification === "narrowing") return ["compatible", "narrowing"];
  if (classification === "widening") return ["compatible", "widening"];
  return [classification];
}

function specChangeReviewScaffoldReport({ beforeFile, afterFile, beforeModel, afterModel, id = null }) {
  const compatibility = specCompatibilityReport(beforeModel, afterModel);
  const draft = {
    id: id ?? specChangeReviewDraftId(beforeModel, afterModel),
    beforeModelPath: beforeFile,
    afterModelPath: afterFile,
    expectedCompatibility: compatibility.classification,
    allowedCompatibility: defaultAllowedCompatibility(compatibility.classification),
    requiredSteps: DEFAULT_SPEC_CHANGE_REVIEW_STEPS,
    breakingRequires: compatibility.classification === "breaking" ? DEFAULT_BREAKING_CHANGE_EVIDENCE : [],
    evidence: [],
  };

  return {
    status: compatibility.status,
    classification: compatibility.classification,
    model: compatibility.model,
    draft,
    errors: compatibility.errors,
  };
}

function renderSpecChangeEvidencePkl(lines, evidence) {
  lines.push("    new {");
  lines.push(`      kind = ${pklString(evidence.kind)}`);
  lines.push(`      ref = ${pklString(evidence.ref)}`);
  lines.push("    }");
}

function renderSpecChangeReviewDraftPkl(draft, { schemaImportPath = "../dspec/Schema.pkl" } = {}) {
  const lines = [
    `import ${pklString(schemaImportPath)} as d`,
    "",
    "review: d.SpecChangeReview = new {",
    `  id = ${pklString(draft.id)}`,
    `  beforeModelPath = ${pklString(draft.beforeModelPath)}`,
    `  afterModelPath = ${pklString(draft.afterModelPath)}`,
    `  expectedCompatibility = ${pklString(draft.expectedCompatibility)}`,
  ];
  pushPklListing(lines, "  ", "allowedCompatibility", draft.allowedCompatibility);
  pushPklListing(lines, "  ", "requiredSteps", draft.requiredSteps);
  pushPklListing(lines, "  ", "breakingRequires", draft.breakingRequires);
  if (list(draft.breakingRequires).length > 0 || list(draft.evidence).length > 0) {
    lines.push("  evidence {");
    if (list(draft.evidence).length === 0 && list(draft.breakingRequires).length > 0) {
      lines.push("    // Add evidence entries before approving breaking changes, for example:");
      for (const evidence of list(draft.breakingRequires).map((kind) => specChangeEvidenceSuggestion(draft, kind))) {
        for (const line of evidence.pkl.split("\n")) {
          lines.push(`    // ${line}`);
        }
      }
    }
    for (const evidence of list(draft.evidence)) {
      renderSpecChangeEvidencePkl(lines, evidence);
    }
    lines.push("  }");
  }
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function specChangeReviewDraftForOutput(draft, outputFile) {
  return {
    ...draft,
    beforeModelPath: pklImportPath(outputFile, draft.beforeModelPath),
    afterModelPath: pklImportPath(outputFile, draft.afterModelPath),
  };
}

function writeSpecChangeReviewScaffold(outputFile, draft) {
  const schemaImportPath = pklImportPath(outputFile, "dspec/Schema.pkl");
  const rendered = renderSpecChangeReviewDraftPkl(draft, { schemaImportPath });
  mkdirSync(dirname(resolve(outputFile)), { recursive: true });
  writeFileSync(outputFile, rendered);
  return {
    path: outputFile,
    schemaImportPath,
    bytes: Buffer.byteLength(rendered, "utf8"),
  };
}

function assertReportOk(report) {
  if (report.errors.length > 0) {
    throw new CommandError(`${report.errors.join("\n")}\n`);
  }
}

function hasHelpFlag(args) {
  return args.includes("--help") || args.includes("-h");
}

function runSpecCompatibility(args, { usageText = usage() } = {}) {
  if (hasHelpFlag(args)) {
    process.stdout.write(usageText);
    return;
  }
  const { beforeFile, afterFile, json, markdown } = parseSpecCompatibilityArgs(args, usageText);
  const beforeModel = loadModel(beforeFile);
  const afterModel = loadModel(afterFile);
  const report = specCompatibilityReport(beforeModel, afterModel);
  if (json) {
    process.stdout.write(stableJson(report));
    assertReportOk(report);
    return;
  }
  if (markdown) {
    process.stdout.write(renderSpecCompatibilityMarkdownReport(report));
    assertReportOk(report);
    return;
  }
  process.stdout.write(renderSpecCompatibilityReport(report));
  assertReportOk(report);
}

function runSpecChangeReview(args, { usageText = usage() } = {}) {
  if (hasHelpFlag(args)) {
    process.stdout.write(usageText);
    return;
  }
  const { file, json, markdown } = parseSpecChangeReviewArgs(args, usageText);
  const review = loadSpecChangeReview(file);
  const report = specChangeReviewReport(review, file);
  if (json) {
    process.stdout.write(stableJson(report));
    assertReportOk(report);
    return;
  }
  if (markdown) {
    const rendered = renderSpecChangeReviewMarkdownReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }
  const rendered = renderSpecChangeReviewReport(report);
  if (report.status === "fail") {
    throw new CommandError(rendered);
  }
  process.stdout.write(rendered);
}

function runSpecChangeScaffold(args, { usageText = scaffoldSpecChangeReviewUsage() } = {}) {
  if (hasHelpFlag(args)) {
    process.stdout.write(usageText);
    return;
  }
  const { beforeFile, afterFile, id, json, outputFile } = parseScaffoldSpecChangeReviewArgs(args, usageText);
  const beforeModel = loadModel(beforeFile);
  const afterModel = loadModel(afterFile);
  const report = specChangeReviewScaffoldReport({ beforeFile, afterFile, beforeModel, afterModel, id });
  if (outputFile) {
    assertReportOk(report);
    const outputDraft = specChangeReviewDraftForOutput(report.draft, outputFile);
    const output = writeSpecChangeReviewScaffold(outputFile, outputDraft);
    const outputReport = { ...report, draft: outputDraft, output };
    if (json) {
      process.stdout.write(stableJson(outputReport));
      return;
    }
    process.stdout.write(`ok: wrote spec change review scaffold ${output.path}\n`);
    process.stdout.write(`next: dspec spec-change review --json ${output.path}\n`);
    return;
  }
  if (json) {
    process.stdout.write(stableJson(report));
    assertReportOk(report);
    return;
  }
  assertReportOk(report);
  process.stdout.write(renderSpecChangeReviewDraftPkl(report.draft));
}

function runSpecChangeCommand(args) {
  const [subcommand, ...rest] = args;
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    process.stdout.write(specChangeUsage());
    return;
  }
  if (subcommand === "compat") {
    runSpecCompatibility(rest, { usageText: specChangeCompatUsage() });
    return;
  }
  if (subcommand === "review") {
    runSpecChangeReview(rest, { usageText: specChangeReviewUsage() });
    return;
  }
  if (subcommand === "scaffold") {
    runSpecChangeScaffold(rest, { usageText: scaffoldSpecChangeReviewUsage() });
    return;
  }
  throw new CommandError(`unknown spec-change subcommand: ${subcommand}\n${specChangeUsage()}`);
}

function assertModelCoverage(model) {
  const coverage = validateCoverage(model, { allowMissingFormalEvidence: true });
  if (coverage.errors.length > 0) {
    throw new CommandError(`${coverage.errors.join("\n")}\n`);
  }
}

function runEvidenceCreate(args) {
  const options = parseEvidenceCreateArgs(args);
  const model = loadModel(options.modelFile);
  assertModelCoverage(model);
  const manifest = createAssuranceEvidenceManifest(model, options);
  const output = options.outputFile ? writeAssuranceEvidenceManifest(options.outputFile, manifest) : null;
  if (options.json) {
    process.stdout.write(stableJson({ status: "pass", model: modelReport(model), output, manifest }));
    return;
  }
  if (output) {
    process.stdout.write(`ok: wrote assurance evidence manifest ${output.path}\n`);
    return;
  }
  process.stdout.write(stableJson(manifest));
}

function runEvidenceVerify(args) {
  const options = parseEvidenceVerifyArgs(args);
  const model = loadModel(options.modelFile);
  const manifest = readJsonFile(options.manifestFile, "assurance evidence manifest");
  const report = assuranceEvidenceVerificationReport(model, manifest);
  if (options.json) {
    process.stdout.write(stableJson(report));
    assertReportOk(report);
    return;
  }
  assertReportOk(report);
  process.stdout.write(`ok: ${model.id} assurance evidence (${report.summary.artifacts} artifacts, ${report.summary.clauseBindings} clause bindings)\n`);
}

function runEvidenceRefresh(args) {
  const options = parseEvidenceRefreshArgs(args);
  const model = loadModel(options.modelFile);
  assertModelCoverage(model);
  const beforeManifest = existsSync(resolve(options.manifestFile))
    ? readJsonFile(options.manifestFile, "assurance evidence manifest")
    : null;
  const before = beforeManifest ? assuranceDigest(stableJson(beforeManifest)) : null;
  const intentReportFiles = options.intentReportFiles.length > 0
    ? options.intentReportFiles
    : list(beforeManifest?.intentExercises).map((entry) => entry?.report?.path).filter(Boolean);
  const manifest = createAssuranceEvidenceManifest(model, { ...options, intentReportFiles });
  const output = writeAssuranceEvidenceManifest(options.manifestFile, manifest);
  const report = {
    status: "pass",
    model: modelReport(model),
    changed: before !== assuranceDigest(stableJson(manifest)),
    output,
    manifest,
  };
  if (options.json) {
    process.stdout.write(stableJson(report));
    return;
  }
  process.stdout.write(`ok: refreshed assurance evidence manifest ${output.path}\n`);
}

function runEvidenceCommand(args) {
  const [subcommand, ...rest] = args;
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    process.stdout.write(evidenceUsage());
    return;
  }
  if (subcommand === "create") {
    runEvidenceCreate(rest);
    return;
  }
  if (subcommand === "verify") {
    runEvidenceVerify(rest);
    return;
  }
  if (subcommand === "refresh") {
    runEvidenceRefresh(rest);
    return;
  }
  throw new CommandError(`unknown evidence subcommand: ${subcommand}\n${evidenceUsage()}`);
}

function runGenerateCommand(args) {
  const options = parseProjectionArgs(
    args,
    topLevelCommandHelp(topLevelCommand("generate")),
    { allowGenerationOptions: true },
  );
  const model = loadModel(options.file);
  const report = generateProjectionArtifacts(model, {
    dryRun: options.dryRun,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    root: options.root,
  });
  if (options.json) {
    process.stdout.write(stableJson(report));
    assertReportOk(report);
    return;
  }
  const rendered = renderGeneratedProjectionReport(report, "generate");
  if (report.status === "fail") throw new CommandError(rendered);
  process.stdout.write(rendered);
}

function runGeneratedCommand(args) {
  const [subcommand, ...rest] = args;
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    process.stdout.write(generatedUsage());
    return;
  }
  if (!["check", "unlock"].includes(subcommand)) {
    throw new CommandError(`unknown generated subcommand: ${subcommand}\n${generatedUsage()}`);
  }
  if (hasHelpFlag(rest)) {
    process.stdout.write(generatedUsage());
    return;
  }
  if (subcommand === "unlock") {
    const options = parseProjectionUnlockArgs(rest);
    let report;
    try {
      report = recoverProjectionLock(options.root, { force: options.force });
    } catch (error) {
      throw new CommandError(`${error.message}\n`);
    }
    if (options.json) {
      process.stdout.write(stableJson(report));
      return;
    }
    if (report.status === "absent") {
      process.stdout.write("ok: no Projection generation lock\n");
      return;
    }
    process.stdout.write(
      `ok: recovered Projection generation lock (${report.previous.liveness}, lease ${report.previous.lease.status}${report.forced ? ", forced" : ""})\n`,
    );
    return;
  }
  const options = parseProjectionArgs(rest, generatedUsage());
  const model = loadModel(options.file);
  const report = generatedProjectionReport(model, { root: options.root });
  if (options.json) {
    process.stdout.write(stableJson(report));
    assertReportOk(report);
    return;
  }
  const rendered = renderGeneratedProjectionReport(report, "check");
  if (report.status === "fail") throw new CommandError(rendered);
  process.stdout.write(rendered);
}

function emit(target, model, locale) {
  if (target === "markdown") return emitMarkdown(model, locale);
  if (target === "json") return stableJson({ model });
  if (target === "quickcheck") return emitQuickcheck(model);
  if (target === "source-map") return emitSourceMap(model, locale);
  if (target === "generated-manifest") return emitGeneratedManifest(model, locale);
  if (target === "runtime-collector") return stableJson(runtimeCollectorManifest(model));
  if (target === "runtime-collector-fixture") return stableJson(runtimeCollectorFixtureManifest(model));
  return emitFormalBackend(target, model);
}

function renderConformanceReport(report) {
  if (report.status === "fail") {
    const failures = report.targets
      .filter((target) => target.counterexample)
      .map((target) => `${target.id}: ${target.counterexample.caseId}`);
    return `conformance failed\n${[...report.errors, ...failures].join("\n")}\n`;
  }
  return `ok: ${report.model.id} conformance (${report.summary.passed}/${report.summary.targets} targets, ${report.summary.passedCases}/${report.summary.cases} cases)\n`;
}

function renderConformanceMarkdownReport(report) {
  const lines = [
    `# Conformance ${report.model.id}`,
    "",
    `- status: \`${report.status}\``,
    `- targets: \`${report.summary.passed}/${report.summary.targets}\``,
    `- cases: \`${report.summary.passedCases}/${report.summary.cases}\``,
    "",
    "| Target | Rule | Selector | Status | Counterexample |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const target of report.targets) {
    lines.push(`| ${target.id} | ${target.ruleId} | ${target.selector} | ${target.status} | ${target.counterexample?.caseId ?? ""} |`);
  }
  if (report.errors.length > 0) {
    lines.push("", "## Errors", "");
    for (const error of report.errors) lines.push(`- ${error}`);
  }
  return `${lines.join("\n")}\n`;
}

function implementationConformanceInvoker(modelFile) {
  const modules = new Map();
  return async (target, input) => {
    const implementation = target.implementation;
    if (!implementation || !["code", "test"].includes(implementation.kind)) {
      throw new Error(`conformance implementation must be a code or test reference: ${target.id}`);
    }
    const path = resolve(dirname(resolve(modelFile)), implementation.path);
    let module = modules.get(path);
    if (!module) {
      module = await import(pathToFileURL(path).href);
      modules.set(path, module);
    }
    const adapter = module[implementation.symbol];
    if (typeof adapter !== "function") {
      throw new Error(`conformance implementation symbol is not a function: ${implementation.path}#${implementation.symbol}`);
    }
    return adapter(input);
  };
}

function queryAnswerReport(query, answer) {
  const verification = verifySpecAnswer(query, answer);
  const errors = [...query.errors, ...verification.errors];
  return {
    ...query,
    status: errors.length === 0 ? "pass" : "fail",
    answer: verification,
    errors,
  };
}

async function run(argv) {
  const [command, ...args] = argv;

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(usage());
    return;
  }

  const commandSpec = topLevelCommand(command);
  if (!commandSpec) {
    throw new CommandError(`unknown command: ${command}\n${usage()}`);
  }

  if (command === "init" && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) {
    process.stdout.write(initUsage());
    return;
  }

  if (command === "lock" && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) {
    process.stdout.write(lockUsage());
    return;
  }

  if (command === "explain" && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) {
    process.stdout.write(explainUsage());
    return;
  }

  if (!["spec-change", "evidence", "generated", "scaffold", "domain", "graph", "intent", "daily-drift", "trace", "translation"].includes(command) && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) {
    process.stdout.write(topLevelCommandHelp(commandSpec));
    return;
  }

  if (command === "init") {
    const { outputFile, lockFile, force, json } = parseInitArgs(args);
    const output = initializeModel({ outputFile, lockFile, force });
    const report = { status: "pass", model: { id: initializedModelId(outputFile), version: "0.1.0" }, output };
    if (json) {
      process.stdout.write(stableJson(report));
      return;
    }
    process.stdout.write(`ok: wrote model ${output.path}\n`);
    process.stdout.write(`ok: wrote schema lock ${output.lock.path}\n`);
    process.stdout.write(`next: dspec verify ${output.path}\n`);
    return;
  }

  if (command === "lock") {
    const { file, outputFile, force, json } = parseLockArgs(args);
    const model = loadModel(file);
    const selectedLockFile = outputFile ?? defaultSchemaLockPath(file);
    const lock = writeSchemaLock({ modelFile: file, lockFile: selectedLockFile, force });
    const report = { status: "pass", model: modelReport(model), lock };
    if (json) {
      process.stdout.write(stableJson(report));
      return;
    }
    process.stdout.write(`ok: wrote schema lock ${lock.path} (${lock.files} modules)\n`);
    return;
  }

  if (command === "trace") {
    runTrace(args);
    return;
  }

  if (command === "translation") {
    runTranslation(args);
    return;
  }

  if (command === "scaffold") {
    runScaffoldCommand(args);
    return;
  }

  if (command === "daily-drift") {
    runDailyDrift(args);
    return;
  }

  if (command === "domain") {
    runDomainCommand(args);
    return;
  }

  if (command === "graph") {
    runGraphCommand(args);
    return;
  }

  if (command === "explain") {
    const { file, json, markdown, lockFile, requireLock } = parseExplainArgs(args);
    const model = loadModel(file);
    const report = explainReport(model, { modelFile: file, lockFile, requireLock });
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderExplainMarkdown(report));
      assertReportOk(report);
      return;
    }
    if (report.status === "pass") {
      process.stdout.write(`ok: ${model.id} explain (0 diagnostics)\n`);
      return;
    }
    process.stdout.write(`${report.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join("\n")}\n`);
    assertReportOk(report);
    return;
  }

  if (command === "conformance") {
    const { file, json, markdown } = parseConformanceArgs(args);
    const model = loadModel(file);
    const report = await conformanceReport(model, { invoke: implementationConformanceInvoker(file) });
    if (json) {
      process.stdout.write(stableJson(report));
      if (report.status === "fail") throw new CommandError("conformance failed\n");
      return;
    }
    if (markdown) {
      const rendered = renderConformanceMarkdownReport(report);
      if (report.status === "fail") throw new CommandError(rendered);
      process.stdout.write(rendered);
      return;
    }
    const rendered = renderConformanceReport(report);
    if (report.status === "fail") throw new CommandError(rendered);
    process.stdout.write(rendered);
    return;
  }

  if (command === "traceability") {
    const { file, json, markdown, gate, executeFormalTools, requireExecutedFormalTools } = parseTraceabilityArgs(args);
    const model = loadModel(file);
    const errors = validate(model);
    if (errors.length > 0) {
      throw new CommandError(`${errors.join("\n")}\n`);
    }

    const report = domainTraceabilityReport(model, await formalizationEvidence(model, {
      executeFormalTools,
      requireExecutedFormalTools,
    }));
    if (json) {
      process.stdout.write(stableJson(report));
    } else if (markdown) {
      process.stdout.write(renderDomainTraceabilityMarkdown(report, { locale: model.primaryLocale }));
    } else {
      process.stdout.write(
        `ok: ${model.id} traceability (${report.status}; ${report.summary.anomalies} gaps)\n`,
      );
    }

    if (report.status === "fail" || (gate && report.status !== "pass")) {
      throw new CommandError(
        `traceability ${report.status}: ${report.summary.anomalies} gaps\n`,
      );
    }
    return;
  }

  if (command === "formal-mutation") {
    const { file, json, requireFormalTools } = parseFormalMutationArgs(args);
    const document = evalPklJson(file);
    if (!document.tetrisAlloy) throw new CommandError(`formal mutation is not supported for this model: ${file}\n`);
    const report = verifyTetrisAlloyMutationWithAnalyzer(document, {
      command: process.env.ALLOY6_COMMAND ?? "alloy6",
    });
    if (json) {
      process.stdout.write(stableJson(report));
    } else if (report.status === "pass") {
      process.stdout.write(`ok: ${document.tetrisAlloy.id} formal mutations (${report.mutations.length}/${report.mutations.length} detected)\n`);
    } else if (report.status === "skip") {
      process.stdout.write(`skipped: ${document.tetrisAlloy.id} formal mutations (${report.reason})\n`);
    } else {
      process.stdout.write(`formal mutation failed: ${report.errors.join("; ")}\n`);
    }
    if (report.status === "fail" || (requireFormalTools && report.status !== "pass")) {
      throw new CommandError(`formal mutation ${report.status}: ${report.errors?.join("; ") ?? report.reason ?? "formal tool unavailable"}\n`);
    }
    return;
  }

  if (command === "query") {
    const options = parseQueryArgs(args);
    const model = loadModel(options.file);
    let report = querySpec(model, { kind: options.kind, id: options.id, selector: options.selector }, { locale: options.locale });
    if (options.answerFile) {
      report = queryAnswerReport(report, readJsonFile(options.answerFile, "spec query answer"));
    }
    if (options.json) {
      process.stdout.write(stableJson(report));
      if (report.status === "fail") throw new CommandError("spec query failed\n");
      return;
    }
    if (options.markdown) {
      const rendered = renderSpecQueryMarkdown(report, report.answer ?? null);
      if (report.status === "fail") throw new CommandError(rendered);
      process.stdout.write(rendered);
      return;
    }
    if (report.status === "fail") throw new CommandError(`spec query failed\n${report.errors.join("\n")}\n`);
    process.stdout.write(`${report.classification}: ${options.kind}:${options.id}${options.selector ? `#${options.selector}` : ""}\n`);
    return;
  }

  if (command === "check") {
    const { file, json } = parseJsonReportArgs(args);
    const model = loadModel(file);
    const report = checkReport(model);
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    assertReportOk(report);
    process.stdout.write(`ok: ${model.id} (${list(model.vocabulary).length} terms, ${list(model.rules).length} rules)\n`);
    return;
  }

  if (command === "verify") {
    const { file, json, lockFile, requireLock } = parseVerifyArgs(args);
    const model = loadModel(file);
    const report = verifyReport(model, { modelFile: file, lockFile, requireLock });
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    assertReportOk(report);
    const lockStatus = report.schemaLock.status === "skip" ? "schema lock skipped" : `schema lock ${report.schemaLock.status}`;
    process.stdout.write(`ok: ${model.id} verify (${report.summary.passed}/${report.summary.total} gates, ${lockStatus})\n`);
    return;
  }

  if (command === "drift") {
    const { file, json } = parseJsonReportArgs(args);
    const model = loadModel(file);
    const report = driftReport(model);
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    assertReportOk(report);
    process.stdout.write(`ok: ${model.id} drift (${report.references} references)\n`);
    return;
  }

  if (command === "coverage") {
    const { file, json } = parseJsonReportArgs(args);
    const model = loadModel(file);
    const report = coverageReport(model);
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    assertReportOk(report);
    process.stdout.write(`ok: ${model.id} coverage (${report.covered}/${report.total} approved rules)\n`);
    return;
  }

  if (command === "domain-coverage") {
    const { file, json } = parseJsonReportArgs(args);
    const model = loadModel(file);
    const report = domainCoverageReport(model);
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    assertReportOk(report);
    process.stdout.write(renderDomainCoverageReport(report));
    return;
  }

  if (command === "impact") {
    const { beforeFile, afterFile, json } = parseImpactArgs(args);
    const beforeModel = loadModel(beforeFile);
    const afterModel = loadModel(afterFile);
    const report = impactReport(beforeModel, afterModel, { afterFile });
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    process.stdout.write(renderImpactReport(report));
    assertReportOk(report);
    return;
  }

  if (command === "spec-change") {
    runSpecChangeCommand(args);
    return;
  }

  if (command === "evidence") {
    runEvidenceCommand(args);
    return;
  }

  if (command === "intent") {
    await runIntentCommand(args);
    return;
  }

  if (command === "generate") {
    runGenerateCommand(args);
    return;
  }

  if (command === "generated") {
    runGeneratedCommand(args);
    return;
  }

  if (command === "emit") {
    const { target, file, locale } = parseEmitArgs(args);
    const model = loadModel(file);
    const coverage = validateCoverage(model);
    if (coverage.errors.length > 0) {
      throw new CommandError(`${coverage.errors.join("\n")}\n`);
    }
    process.stdout.write(emit(target, model, locale));
    return;
  }

  if (command === "verify-generated") {
    const { file, json, requireFormalTools, skipQuintVerify } = parseVerifyGeneratedArgs(args);
    const model = loadModel(file);
    const coverage = validateCoverage(model);
    if (coverage.errors.length > 0) {
      throw new CommandError(`${coverage.errors.join("\n")}\n`);
    }
    const options = { requireFormalTools, skipQuintVerify };
    const report = verifyGeneratedReport(model, options);
    if (json) {
      process.stdout.write(stableJson(report));
      assertVerifyGeneratedReport(report, options);
      return;
    }
    assertVerifyGeneratedReport(report, options);
    process.stdout.write(verifyGenerated(model, options));
    return;
  }

  if (command === "devshell-smoke") {
    const { json, strict, requireStorePath } = parseDevshellSmokeArgs(args);
    const report = devshellSmokeReport({ requireStorePath });
    if (json) {
      process.stdout.write(stableJson(report));
      if (strict && report.status === "fail") {
        throw new CommandError(`devshell smoke failed:\n${report.errors.join("\n")}\n`);
      }
      return;
    }
    const rendered = renderDevshellSmokeReport(report);
    if (strict && report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "normalize-counterexamples") {
    const { file, json, locale } = parseNormalizeCounterexampleArgs(args);
    const model = loadModel(file);
    const errors = validate(model);
    if (errors.length > 0) {
      throw new CommandError(`${errors.join("\n")}\n`);
    }
    const report = normalizeCounterexamples(model, verifyGeneratedReport(model), locale);
    process.stdout.write(json ? stableJson(report) : renderCounterexampleReport(report));
    if (report.status === "fail") {
      throw new CommandError(`normalized counterexamples found: ${report.counterexamples.length}\n`);
    }
    return;
  }

  if (command === "import-db-schema") {
    const { file, json } = parseImportDbSchemaArgs(args);
    process.stdout.write(importDbSchemaFile(file, { json }));
    return;
  }

  if (command === "check-sql-queries") {
    const { modelFile, queryFile, json } = parseCheckSqlQueriesArgs(args);
    const model = loadModel(modelFile);
    const report = checkSqlQueriesReport(model, readTextFile(queryFile));
    if (json) {
      process.stdout.write(stableJson(report));
      if (report.status === "fail") {
        throw new CommandError(`sql query drift: ${report.errors.length}\n`);
      }
      return;
    }
    const rendered = renderSqlQueryReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "import-real-app") {
    const { root, json, pkl } = parseImportRealAppArgs(args);
    process.stdout.write(importRealAppFile(root, { json, pkl }));
    return;
  }

  if (command === "evaluate-real-app-import") {
    const { file, json } = parseJsonReportArgs(args);
    const report = realAppImportEvaluationReport(loadRealAppImportEvaluation(file), file);
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderRealAppImportEvaluationReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "evaluate-external-holdouts") {
    const { file, json, markdown } = parseExternalHoldoutArgs(args);
    const report = externalRealAppImportCorpusReport(loadExternalRealAppImportCorpus(file), file);
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderExternalHoldoutCorpusMarkdown(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderExternalRealAppImportCorpusMarkdown(report);
    if (report.status === "fail") throw new CommandError(rendered);
    process.stdout.write(rendered);
    return;
  }

  if (command === "reconcile-real-app") {
    const { modelFile, observedFile, json } = parseReconcileRealAppArgs(args);
    const model = loadModel(modelFile);
    const observed = readJsonFile(observedFile, "real app observed facts");
    const report = reconcileRealAppReport(model, observed);
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderRealAppReconciliationReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "reverse-coverage") {
    const { modelFile, observedFile, json } = parseReconcileRealAppArgs(args);
    const model = loadModel(modelFile);
    const observed = readJsonFile(observedFile, "real app observed facts");
    const report = reverseCoverageReport(model, observed);
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderReverseCoverageReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "check-app-profile") {
    const { files, dryRun, fix, json, markdown } = parseAppProfileArgs(args);
    const report = appProfileCommandReport(files, { dryRun, fix });
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderAppProfileMarkdownReport(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderAppProfileReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "check-app-profile-suite") {
    const { file, dryRun, fix, json, markdown } = parseAppProfileSuiteArgs(args);
    const report = appProfileSuiteReport(loadAppProfileSuite(file), { dryRun, fix });
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderAppProfileMarkdownReport(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderAppProfileReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "scaffold-app-profile") {
    const parsed = parseScaffoldAppProfileArgs(args);
    if (parsed.diffFile) {
      const report = scaffoldAppProfileDiffReport(
        loadAppProfile(parsed.diffFile),
        scaffoldAppProfileDocument(parsed),
      );
      if (parsed.json) {
        process.stdout.write(stableJson(report));
        assertReportOk(report);
        return;
      }
      const rendered = renderScaffoldAppProfileDiffReport(report);
      if (report.status === "fail") {
        throw new CommandError(rendered);
      }
      process.stdout.write(rendered);
      return;
    }
    if (parsed.applyFile) {
      const scaffoldedProfile = scaffoldAppProfileDocument(parsed);
      const renderedProfile = scaffoldAppProfile({
        ...parsed,
        schemaImportPath: pklImportPath(parsed.applyFile, "dspec/Schema.pkl"),
      });
      const report = scaffoldAppProfileApplyReport(
        parsed.applyFile,
        loadAppProfile(parsed.applyFile),
        scaffoldedProfile,
        renderedProfile,
        { dryRun: parsed.dryRun },
      );
      if (parsed.json) {
        process.stdout.write(stableJson(report));
        assertReportOk(report);
        return;
      }
      const rendered = renderScaffoldAppProfileDiffReport(report);
      if (report.status === "fail") {
        throw new CommandError(rendered);
      }
      process.stdout.write(rendered);
      return;
    }
    process.stdout.write(scaffoldAppProfile(parsed));
    return;
  }

  if (command === "evaluate-app-profile") {
    const { file, json, markdown } = parseEvaluateAppProfileArgs(args);
    const report = appProfileEvaluationReport(loadAppProfile(file));
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderAppProfileEvaluationMarkdownReport(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderAppProfileEvaluationReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "evaluate-app-profile-suite") {
    const { file, json, markdown } = parseEvaluateAppProfileSuiteArgs(args);
    const report = appProfileEvaluationSuiteReport(loadAppProfileSuite(file));
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderAppProfileEvaluationMarkdownReport(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderAppProfileEvaluationReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "coverage-app-profile-scenarios") {
    const { file, json, markdown } = parseEvaluateAppProfileArgs(args);
    const report = appProfileScenarioCoverageReport(loadAppProfile(file));
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderAppProfileScenarioCoverageMarkdownReport(report));
      assertReportOk(report);
      return;
    }
    if (report.status === "fail") {
      throw new CommandError(`${report.errors.join("\n")}\n`);
    }
    process.stdout.write(`ok: ${report.profile.id} app profile scenario coverage (${report.covered}/${report.total} requirements)\n`);
    return;
  }

  if (command === "score-app-profile-mutations") {
    const { file, json, markdown } = parseEvaluateAppProfileArgs(args);
    const report = appProfileMutationScoreReport(loadAppProfile(file));
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderAppProfileMutationScoreMarkdownReport(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderAppProfileMutationScoreReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "replay-app-profile-changes") {
    const { file, json, markdown } = parseEvaluateAppProfileArgs(args);
    const report = appChangeReplayCorpusReport(loadAppProfileChangeReplayCorpus(file));
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderAppChangeReplayMarkdownReport(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderAppChangeReplayReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "spec-reading-eval") {
    const { file, json, markdown, prompt, scoreFile, runnerFile, locale, refreshDigests, apply, writeRunFile } = parseSpecReadingEvalArgs(args);
    const evaluation = loadSpecReadingEvaluation(file);
    const modelFile = specReadingModelFile(evaluation, file);
    if (prompt) {
      process.stdout.write(renderSpecReadingEvalPrompt(evaluation, { locale }));
      return;
    }
    if (refreshDigests) {
      const report = specReadingEvalDigestRefreshReport(evaluation, file, { apply, locale, modelFile });
      if (json) {
        process.stdout.write(stableJson(report));
        assertReportOk(report);
        return;
      }
      if (markdown) {
        process.stdout.write(renderSpecReadingEvalDigestRefreshMarkdownReport(report));
        assertReportOk(report);
        return;
      }
      const rendered = renderSpecReadingEvalDigestRefreshReport(report);
      if (report.status === "fail") {
        throw new CommandError(rendered);
      }
      process.stdout.write(rendered);
      return;
    }
    const report = runnerFile
      ? specReadingAgentReport(
          evaluation,
          loadSpecReadingAgentRunner(runnerFile),
          runnerFile,
          { locale, file, modelFile },
        )
      : scoreFile
        ? specReadingEvalScoreReport(evaluation, scoreFile, { locale, file, modelFile })
        : specReadingEvalReport(evaluation, { locale, file, modelFile });
    if (writeRunFile) {
      mkdirSync(dirname(resolve(writeRunFile)), { recursive: true });
      writeFileSync(resolve(writeRunFile), stableJson(report));
    }
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderSpecReadingEvalMarkdownReport(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderSpecReadingEvalReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "spec-reading-eval-suite") {
    const { file, json, markdown } = parseSpecReadingEvalSuiteArgs(args);
    const report = specReadingEvalSuiteReport(loadSpecReadingEvaluationSuite(file), { file });
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderSpecReadingEvalSuiteMarkdownReport(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderSpecReadingEvalSuiteReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "coverage-spec-reading-eval-suite") {
    const { file, json, markdown } = parseSpecReadingEvalSuiteArgs(args);
    const report = specReadingEvalSuiteCoverageReport(loadSpecReadingEvaluationSuite(file), { file });
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderSpecReadingEvalSuiteCoverageMarkdownReport(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderSpecReadingEvalSuiteCoverageReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "metamorphic-spec-reading-eval") {
    const { file, json, markdown, locale } = parseSpecReadingMetamorphicArgs(args);
    const evaluation = loadSpecReadingEvaluation(file);
    const report = specReadingMetamorphicReport(evaluation, { file, locale, modelFile: specReadingModelFile(evaluation, file) });
    if (json) {
      process.stdout.write(stableJson(report));
      assertReportOk(report);
      return;
    }
    if (markdown) {
      process.stdout.write(renderSpecReadingMetamorphicMarkdownReport(report));
      assertReportOk(report);
      return;
    }
    const rendered = renderSpecReadingMetamorphicReport(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "import-runtime-evidence") {
    const { file, json } = parseImportRuntimeEvidenceArgs(args);
    const document = readJsonFile(file, "runtime evidence import");
    process.stdout.write(importRuntimeEvidence(document, { json }));
    return;
  }

  if (command === "collect-runtime-evidence") {
    const { file, pkl } = parseCollectRuntimeEvidenceArgs(args);
    const manifest = readJsonFile(file, "runtime evidence collector manifest");
    const collected = await collectRuntimeEvidence(manifest, dirname(resolve(file)));
    process.stdout.write(pkl ? importRuntimeEvidence(collected) : stableJson(collected));
    return;
  }

  if (command === "verify-runtime-evidence") {
    const { file, json } = parseVerifyRuntimeEvidenceArgs(args);
    const manifest = readJsonFile(file, "runtime evidence collector manifest");
    const report = await verifyRuntimeEvidenceReport(manifest, dirname(resolve(file)));
    if (json) {
      process.stdout.write(stableJson(report));
      if (report.status === "fail") {
        throw new CommandError(`runtime evidence expectation drift: ${report.failures.length}\n`);
      }
      return;
    }
    const rendered = renderRuntimeEvidenceVerification(report);
    if (report.status === "fail") {
      throw new CommandError(rendered);
    }
    process.stdout.write(rendered);
    return;
  }

  if (command === "render") {
    const { file, locale } = parseRenderArgs(args);
    const model = loadModel(file);
    const errors = validate(model);
    if (errors.length > 0) {
      throw new CommandError(`${errors.join("\n")}\n`);
    }
    process.stdout.write(render(model, locale));
    return;
  }

  throw new CommandError(`registered command has no dispatcher: ${command}\n`);
}

const cliModulePath = fileURLToPath(import.meta.url);

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(cliModulePath)) {
  try {
    await run(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CommandError) {
      process.stderr.write(error.message.endsWith("\n") ? error.message : `${error.message}\n`);
      process.exit(error.status);
    }
    throw error;
  }
}

export {
  checkSqlQueriesReport,
  domainCoverageReport,
  generateProjectionArtifacts,
  generatedProjectionReport,
  normalizeCounterexamples,
  topLevelCommandRegistry,
  validateGeneratedAlloy,
  verifyGenerated,
  verifyGeneratedReport,
};
