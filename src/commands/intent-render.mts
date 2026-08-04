type Mutation = {
  id: string;
  kind: string;
  traceId: string;
  step: string | number;
  actual: string;
  status: string;
  shrinks: unknown;
  errors: unknown;
};

type MutationReport = {
  model: { id: string };
  status: string;
  score: number;
  detected: number;
  generated: number;
  mutations: Mutation[];
  errors: string[];
};

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject((value as Record<string, unknown>)[key])]));
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function renderIntentMutationMarkdown(report: MutationReport): string {
  const lines = [
    `# Intent Trace Mutation Score ${report.model.id}`,
    "",
    `- status: \`${report.status}\``,
    `- score: \`${report.score}\``,
    `- detected: \`${report.detected}/${report.generated}\``,
    "",
    "| Mutation | Kind | Trace | Step | Actual | Status | Shrinks | Errors |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const mutation of report.mutations) {
    lines.push(`| ${mutation.id} | ${mutation.kind} | ${mutation.traceId} | ${mutation.step} | ${mutation.actual} | ${mutation.status} | ${JSON.stringify(stableObject(mutation.shrinks))} | ${list(mutation.errors).join("<br>")} |`);
  }
  if (report.errors.length > 0) {
    lines.push("", "## Errors", "");
    for (const error of report.errors) lines.push(`- ${error}`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderIntentTraceMarkdown(report: any): string {
  const lines = [
    `# Intent Trace Verification ${report.model.id}`, "",
    `- status: \`${report.status}\``, `- model: \`${report.model.id}@${report.model.version}\``,
    `- traces: \`${report.summary.traces}\``, `- steps: \`${report.summary.steps}\``,
    `- refinements: \`${report.summary.refinements}\``, `- contracts: \`${report.summary.contracts}\``, "",
    "## Evidence", "", "| Check | Scope | Status | Errors |", "| --- | --- | --- | --- |",
  ];
  if (typeof report.summary.executedRefinements === "number") lines.splice(7, 0, `- executed refinements: \`${report.summary.executedRefinements}\``);
  for (const check of report.evidence.checks) lines.push(`| ${check.id} | ${check.scope} | ${check.status} | ${check.errors.length} |`);
  lines.push("", "## Traces", "", "| Trace | Source | Steps | Status |", "| --- | --- | --- | --- |");
  for (const trace of report.traces) lines.push(`| ${trace.id ?? ""} | ${trace.source ?? ""} | ${trace.steps} | ${trace.status} |`);
  if (Array.isArray(report.executions)) {
    lines.push("", "## Executions", "", "| Trace | Step | Process | Refinement | Status |", "| --- | --- | --- | --- | --- |");
    for (const execution of report.executions) lines.push(`| ${execution.traceId} | ${execution.step} | ${execution.process} | ${execution.refinement} | ${execution.status} |`);
  }
  if (report.executionPolicy) {
    lines.push("", "## Execution Policy Observation", "");
    if (report.executionPolicy.reason) lines.push(`- reason: ${report.executionPolicy.reason}`);
    lines.push("| Process | Refinement | Replays | Client max in-flight | Status |", "| --- | --- | --- | --- | --- |");
    for (const observation of report.executionPolicy.observations) lines.push(`| ${observation.process} | ${observation.refinement} | ${observation.pressure.replayCount} | ${observation.pressure.maxObservedInFlight} | ${observation.status} |`);
    lines.push("", "Client-side pressure and equal observed responses do not prove an implementation's internal queue, distributed idempotency store, or database isolation.");
  }
  if (report.errors.length > 0) {
    lines.push("", "## Errors", "");
    for (const error of report.errors) lines.push(`- ${error}`);
  }
  lines.push("", "## Assumptions", "");
  for (const assumption of report.evidence.assumptions) lines.push(`- ${assumption}`);
  return `${lines.join("\n")}\n`;
}

export function renderIntentCoverageMarkdown(report: any): string {
  const lines = [
    `# Intent Trace Coverage ${report.model.id}`, "", `- status: \`${report.status}\``, `- model: \`${report.model.id}@${report.model.version}\``,
    `- coverage: \`${report.summary.coverage}\``, `- covered: \`${report.summary.covered}/${report.summary.targets}\``, "",
    "| Kind | Targets | Covered | Uncovered |", "| --- | --- | --- | --- |",
  ];
  for (const entry of report.summary.byKind) lines.push(`| ${entry.kind} | ${entry.targets} | ${entry.covered} | ${entry.uncovered} |`);
  lines.push("", "## Targets", "", "| Kind | Target | Observations |", "| --- | --- | --- |");
  for (const target of report.targets) {
    const observations = target.observations.map((observation: any) => `${observation.traceId}#${observation.step}`).join(", ");
    lines.push(`| ${target.kind} | ${target.id} | ${observations || "uncovered"} |`);
  }
  if (report.errors.length > 0) { lines.push("", "## Errors", ""); for (const error of report.errors) lines.push(`- ${error}`); }
  return `${lines.join("\n")}\n`;
}

export function renderIntentScenarioCorpusMarkdown(report: any): string {
  const lines = [
    `# Intent Scenario Corpus ${report.model.id}`, "", `- status: \`${report.status}\``, `- model: \`${report.model.id}@${report.model.version}\``,
    `- coverage: \`${report.summary.coverage}\``, `- covered: \`${report.summary.covered}/${report.summary.required}\` required scenarios`, "",
    "## Observations", "", "| Scenario | Trace | Status |", "| --- | --- | --- |",
  ];
  for (const observation of report.observations) lines.push(`| ${observation.scenario ?? "unassigned"} | ${observation.trace} | ${observation.status} |`);
  if (report.suggestions.length > 0) {
    lines.push("", "## Suggested Cases", "", "| Scenario | Initial State | Steps | Expected State | Reason |", "| --- | --- | --- | --- | --- |");
    for (const suggestion of report.suggestions) {
      const steps = suggestion.steps.map((step: any) => `${step.process} -> ${step.outcome}`).join("; ");
      lines.push(`| ${suggestion.scenario} | ${suggestion.initialState} | ${steps} | ${suggestion.expectedState} | ${suggestion.reason} |`);
    }
  }
  if (report.errors.length > 0) { lines.push("", "## Errors", ""); for (const error of report.errors) lines.push(`- ${error}`); }
  return `${lines.join("\n")}\n`;
}
