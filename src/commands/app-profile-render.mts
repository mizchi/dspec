function list<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function markdownCell(value: unknown): string {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function stableObject(value: any): any {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

function renderAppProfileChecksMarkdown(checks: any[]): string[] {
  const lines = [
    "| Gate | Status | Errors |",
    "| --- | --- | --- |",
  ];
  for (const check of checks) {
    lines.push(`| ${markdownCell(check.id)} | ${markdownCell(check.status)} | ${markdownCell(list(check.errors).join("<br>"))} |`);
  }
  return lines;
}

function renderSingleAppProfileMarkdown(report: any, level = 1): string[] {
  const prefix = "#".repeat(level);
  const lines = [
    `${prefix} App Profile ${report.profile.id}`,
    "",
    `- modelPath: \`${report.profile.modelPath}\``,
    `- appRoot: \`${report.profile.appRoot}\``,
    `- status: \`${report.status}\``,
    "",
    ...renderAppProfileChecksMarkdown(report.checks),
  ];
  if (list(report.wouldFix).length > 0) {
    lines.push("", `${"#".repeat(level + 1)} Would Fix`, "", ...list<string>(report.wouldFix).map((path) => `- \`${path}\``));
  }
  if (list(report.fixed).length > 0) {
    lines.push("", `${"#".repeat(level + 1)} Fixed`, "", ...list<string>(report.fixed).map((path) => `- \`${path}\``));
  }
  return lines;
}

export function renderAppProfileMarkdownReport(report: any): string {
  if (!Array.isArray(report.profiles)) {
    return `${renderSingleAppProfileMarkdown(report).join("\n")}\n`;
  }
  const lines = [
    "# App Profiles",
    "",
    `- status: \`${report.status}\``,
    `- passed: \`${report.passed}/${report.total}\``,
    "",
    "| Profile | Status | Checks | Errors |",
    "| --- | --- | --- | --- |",
  ];
  for (const entry of report.profiles) {
    lines.push(`| ${markdownCell(entry.profile.id)} | ${markdownCell(entry.status)} | ${markdownCell(`${entry.passed}/${entry.total}`)} | ${markdownCell(list(entry.errors).join("<br>"))} |`);
  }
  for (const entry of report.profiles) {
    lines.push("", ...renderSingleAppProfileMarkdown(entry, 2));
  }
  return `${lines.join("\n")}\n`;
}

export function renderAppProfileReport(report: any): string {
  if (Array.isArray(report.profiles)) {
    if (report.status === "pass") {
      return `ok: app profiles (${report.passed}/${report.total} profiles)\n`;
    }
    const wouldFix = list<string>(report.wouldFix).map((path) => `would fix: ${path}`);
    return `${[...report.errors, ...wouldFix].join("\n")}\n`;
  }
  if (report.status === "pass") {
    return `ok: ${report.profile.id} app profile (${report.passed}/${report.total} checks)\n`;
  }
  const wouldFix = list<string>(report.wouldFix).map((path) => `would fix: ${path}`);
  return `${[...report.errors, ...wouldFix].join("\n")}\n`;
}

export function renderAppChangeReplayMarkdownReport(report: any): string {
  const lines = [
    `# App Change Replay Corpus ${report.corpus.id}`,
    "",
    `- status: \`${report.status}\``,
    `- passed: \`${report.passed}/${report.total}\``,
    "",
    "| Case | Expected | Actual | Status | Changes | Errors |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const entry of report.cases) {
    const changes = entry.changes
      .filter((change: any) => change.suggestionKind !== "ignored")
      .map((change: any) => `${change.change} ${change.kind} ${change.id} -> ${change.suggestionKind}`)
      .join("<br>");
    lines.push(`| ${markdownCell(entry.id)} | ${markdownCell(entry.expected)} | ${markdownCell(entry.actual)} | ${markdownCell(entry.status)} | ${markdownCell(changes)} | ${markdownCell(entry.errors.join("<br>"))} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderAppChangeReplayReport(report: any): string {
  if (report.status === "pass") {
    return `ok: ${report.corpus.id} app change replay (${report.passed}/${report.total} cases)\n`;
  }
  return `${report.errors.join("\n")}\n`;
}

function renderAppProfileEvaluationMarkdownScenarios(scenarios: any[]): string[] {
  const lines = [
    "| Scenario | Kind | Guard | Expected | Actual | Status | Suggestion Kind | Mutation | Errors |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const scenario of scenarios) {
    const mutation = scenario.mutation ? JSON.stringify(stableObject(scenario.mutation)) : "";
    lines.push(`| ${markdownCell(scenario.id)} | ${markdownCell(scenario.kind)} | ${markdownCell(scenario.guard)} | ${markdownCell(scenario.expected)} | ${markdownCell(scenario.actual)} | ${markdownCell(scenario.status)} | ${markdownCell(scenario.detectedSuggestionKind ?? "")} | ${markdownCell(mutation)} | ${markdownCell(list(scenario.errors).join("<br>"))} |`);
  }
  return lines;
}

function renderSingleAppProfileEvaluationMarkdown(report: any, level = 1): string[] {
  const prefix = "#".repeat(level);
  return [
    `${prefix} App Profile Evaluation ${report.profile.id}`,
    "",
    `- modelPath: \`${report.profile.modelPath}\``,
    `- appRoot: \`${report.profile.appRoot}\``,
    `- status: \`${report.status}\``,
    `- passed: \`${report.passed}/${report.total}\``,
    "",
    ...renderAppProfileEvaluationMarkdownScenarios(report.scenarios),
  ];
}

export function renderAppProfileEvaluationMarkdownReport(report: any): string {
  if (!Array.isArray(report.evaluations)) {
    return `${renderSingleAppProfileEvaluationMarkdown(report).join("\n")}\n`;
  }
  const lines = [
    `# App Profile Suite Evaluation ${report.suite.id}`,
    "",
    `- status: \`${report.status}\``,
    `- passed: \`${report.passed}/${report.total}\``,
    "",
    "| Profile | Status | Scenarios | Errors |",
    "| --- | --- | --- | --- |",
  ];
  for (const entry of report.evaluations) {
    lines.push(`| ${markdownCell(entry.profile.id)} | ${markdownCell(entry.status)} | ${markdownCell(`${entry.passed}/${entry.total}`)} | ${markdownCell(list(entry.errors).join("<br>"))} |`);
  }
  for (const entry of report.evaluations) {
    lines.push("", ...renderSingleAppProfileEvaluationMarkdown(entry, 2));
  }
  return `${lines.join("\n")}\n`;
}

export function renderAppProfileScenarioCoverageMarkdownReport(report: any): string {
  const lines = [
    `# App Profile Scenario Coverage ${report.profile.id}`,
    "",
    `- status: \`${report.status}\``,
    `- covered: \`${report.covered}/${report.total}\``,
    `- inferredCategories: \`${list(report.inferredCategories).join(", ") || "none"}\``,
    `- requiredCategories: \`${list(report.requiredCategories).join(", ") || "none"}\``,
    "",
    "| Scope | Gate | Category | Guard | Suggestion Kind | Status | Scenarios |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const requirement of report.requirements) {
    lines.push(`| ${markdownCell(requirement.scope)} | ${markdownCell(requirement.gate ?? "")} | ${markdownCell(requirement.category ?? "")} | ${markdownCell(requirement.guard)} | ${markdownCell(requirement.suggestionKind ?? "")} | ${markdownCell(requirement.status)} | ${markdownCell(list(requirement.scenarios).join(", "))} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderAppProfileMutationScoreMarkdownReport(report: any): string {
  const lines = [
    `# App Profile Mutation Score ${report.profile.id}`,
    "",
    `- status: \`${report.status}\``,
    `- score: \`${report.score}\``,
    `- detected: \`${report.detected}/${report.generated}\``,
    `- categories: \`${list(report.categories).join(", ") || "none"}\``,
    "",
    "| Mutation | Category | Suggestion Kind | Actual | Status | Payload | Shrinks | Errors |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const mutation of report.mutations) {
    const payload = mutation.mutation ? JSON.stringify(stableObject(mutation.mutation)) : "";
    const shrinks = JSON.stringify(stableObject(mutation.shrinks));
    lines.push(`| ${markdownCell(mutation.id)} | ${markdownCell(mutation.category)} | ${markdownCell(mutation.suggestionKind)} | ${markdownCell(mutation.actual)} | ${markdownCell(mutation.status)} | ${markdownCell(payload)} | ${markdownCell(shrinks)} | ${markdownCell(list(mutation.errors).join("<br>"))} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderAppProfileEvaluationReport(report: any): string {
  if (Array.isArray(report.evaluations)) {
    if (report.status === "pass") {
      return `ok: ${report.suite.id} app profile suite evaluation (${report.passed}/${report.total} profiles)\n`;
    }
    return `${report.errors.join("\n")}\n`;
  }
  if (report.status === "pass") {
    return `ok: ${report.profile.id} app profile evaluation (${report.passed}/${report.total} scenarios)\n`;
  }
  return `${report.errors.join("\n")}\n`;
}

export function renderAppProfileMutationScoreReport(report: any): string {
  if (report.status === "pass") {
    return `ok: ${report.profile.id} app profile mutation score ${report.score} (${report.detected}/${report.generated} detected)\n`;
  }
  return `${report.errors.join("\n")}\n`;
}
