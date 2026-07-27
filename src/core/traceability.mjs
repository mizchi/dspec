export const DOMAIN_TRACEABILITY_SCHEMA_VERSION = "1.0";

function list(value) {
  return Array.isArray(value) ? value : [];
}

function domain(model) {
  const value = model?.patterns?.domain;
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function byId(left, right) {
  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
}

function localText(value, locale) {
  if (!value || typeof value !== "object") return null;
  return value.labels?.[locale] ?? value.default ?? null;
}

function evidenceByFormalization(entries) {
  return new Map(list(entries).filter((entry) => entry?.formalization).map((entry) => [entry.formalization, entry]));
}

function checkCounterexamples(evidence, checkIds = null) {
  const declared = list(evidence?.counterexamples);
  const fromChecks = list(evidence?.checks).filter((check) => !checkIds || checkIds.has(check.id)).flatMap((check) => check?.counterexample
    ? [{ ...check.counterexample, check: check.id, assurance: check.assurance ?? null }]
    : []);
  return [...declared, ...fromChecks];
}

function actionMappingStatus(mapping, evidence) {
  if (!evidence) return "unexecuted";
  return list(evidence.actions).includes(mapping.action) ? "grounded" : "missing-action-evidence";
}

function tracePathLine(step, mappings) {
  const mapping = mappings.find((candidate) => candidate.action === step.id);
  if (!mapping) return step.id;
  const command = mapping.command ? `command: ${mapping.command}` : null;
  const events = mapping.events.length > 0 ? `event: ${mapping.events.join(", ")}` : null;
  return [step.id, command, events].filter(Boolean).join(" → ");
}

function stateLine(state) {
  return Object.entries(state ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([field, value]) => `${field}=${value}`)
    .join(", ");
}

/**
 * Builds a bidirectional, reviewable derivation ledger. The report deliberately
 * distinguishes missing coverage (`attention`) from a failed executed check
 * (`fail`): absence of evidence is a review queue, not a false proof claim.
 */
export function domainTraceabilityReport(model, evidenceEntries = []) {
  const catalog = domain(model) ?? {};
  const rules = list(model?.rules).slice().sort(byId);
  const scopedRules = rules.filter((rule) => rule.kind !== "non_goal");
  const commands = list(catalog.commands).slice().sort(byId);
  const events = list(catalog.events).slice().sort(byId);
  const formalizations = list(catalog.formalizations).slice().sort(byId);
  const refinements = list(catalog.refinements).slice().sort(byId);
  const evidence = evidenceByFormalization(evidenceEntries);
  const ruleLinks = new Map();
  const commandLinks = new Map();
  const eventLinks = new Map();
  const anomalies = [];

  const normalizedFormalizations = formalizations.map((formalization) => {
    const item = evidence.get(formalization.id) ?? null;
    const mappings = list(formalization.actionMappings).map((mapping) => ({
      action: mapping.action,
      command: mapping.command ?? null,
      events: list(mapping.events).slice().sort(),
      status: actionMappingStatus(mapping, item),
    })).sort((left, right) => left.action.localeCompare(right.action));
    const allChecks = list(item?.checks).map((check) => ({
      id: check.id,
      status: check.status,
      assurance: check.assurance ?? null,
      counterexample: check.counterexample ?? null,
    })).sort(byId);
    const declaredCheckIds = list(formalization.checks).slice().sort();
    const declaredCheckSet = new Set(declaredCheckIds);
    const observedChecks = new Set(allChecks.map((check) => check.id));
    // A single model may discharge several rules. Each formalization exposes
    // only the checks it explicitly declares, so its Markdown section remains
    // a readable contract rather than an accidental dump of sibling checks.
    const checks = allChecks.filter((check) => declaredCheckSet.has(check.id));

    ruleLinks.set(formalization.rule, [...(ruleLinks.get(formalization.rule) ?? []), formalization.id]);
    for (const mapping of mappings) {
      if (mapping.command) commandLinks.set(mapping.command, [...(commandLinks.get(mapping.command) ?? []), formalization.id]);
      for (const event of mapping.events) eventLinks.set(event, [...(eventLinks.get(event) ?? []), formalization.id]);
      if (mapping.status !== "grounded") {
        anomalies.push({
          kind: "missing-action-evidence",
          id: `${formalization.id}/${mapping.action}`,
          message: `formal action is not present in executed evidence: ${formalization.id} -> ${mapping.action}`,
        });
      }
    }
    if (!item) {
      anomalies.push({
        kind: "missing-formalization-evidence",
        id: formalization.id,
        message: `formalization has no executed evidence: ${formalization.id}`,
      });
    }
    for (const checkId of declaredCheckIds) {
      if (!observedChecks.has(checkId)) {
        anomalies.push({
          kind: "missing-declared-check",
          id: `${formalization.id}/${checkId}`,
          message: `declared formal check has no result: ${formalization.id} -> ${checkId}`,
        });
      }
    }
    return {
      id: formalization.id,
      rule: formalization.rule,
      kind: formalization.kind,
      assurance: formalization.assurance,
      target: formalization.target ?? null,
      assumptions: list(formalization.assumptions).slice(),
      mappings,
      declaredChecks: declaredCheckIds,
      evidence: item
        ? {
          status: item.status,
          execution: item.execution ?? null,
          actions: list(item.actions).slice().sort(),
          checks,
          counterexamples: checkCounterexamples(item, declaredCheckSet),
          errors: list(item.errors).slice(),
        }
        : null,
    };
  });

  const formalizationById = new Map(normalizedFormalizations.map((formalization) => [formalization.id, formalization]));
  const normalizedRefinements = refinements.map((refinement) => {
    const source = formalizationById.get(refinement.sourceFormalization) ?? null;
    const target = formalizationById.get(refinement.targetFormalization) ?? null;
    const declaredCheckIds = list(refinement.checks).slice().sort();
    const targetChecks = new Map(list(target?.evidence?.checks).map((check) => [check.id, check]));
    const checks = declaredCheckIds.map((checkId) => {
      const check = targetChecks.get(checkId) ?? null;
      return check
        ? { id: check.id, status: check.status, assurance: check.assurance ?? null }
        : { id: checkId, status: "missing", assurance: null };
    });
    if (!source) {
      anomalies.push({
        kind: "missing-refinement-source",
        id: refinement.id,
        message: `refinement source formalization is missing: ${refinement.id} -> ${refinement.sourceFormalization ?? "missing"}`,
      });
    }
    if (!target) {
      anomalies.push({
        kind: "missing-refinement-target",
        id: refinement.id,
        message: `refinement target formalization is missing: ${refinement.id} -> ${refinement.targetFormalization ?? "missing"}`,
      });
    }
    if (source && source.evidence?.status !== "pass") {
      anomalies.push({
        kind: "missing-refinement-source-evidence",
        id: refinement.id,
        message: `refinement source has no passing evidence: ${refinement.id} -> ${refinement.sourceFormalization}`,
      });
    }
    if (target && target.evidence?.status !== "pass") {
      anomalies.push({
        kind: "missing-refinement-target-evidence",
        id: refinement.id,
        message: `refinement target has no passing evidence: ${refinement.id} -> ${refinement.targetFormalization}`,
      });
    }
    for (const check of checks) {
      if (check.status === "missing") {
        anomalies.push({
          kind: "missing-refinement-check",
          id: `${refinement.id}/${check.id}`,
          message: `refinement check has no target result: ${refinement.id} -> ${check.id}`,
        });
      }
    }
    const hasFailure = checks.some((check) => check.status === "fail")
      || source?.evidence?.status === "fail"
      || target?.evidence?.status === "fail";
    const ready = source?.evidence?.status === "pass"
      && target?.evidence?.status === "pass"
      && checks.length > 0
      && checks.every((check) => check.status === "pass");
    return {
      id: refinement.id,
      kind: refinement.kind,
      sourceFormalization: refinement.sourceFormalization,
      targetFormalization: refinement.targetFormalization,
      sourceCondition: refinement.sourceCondition,
      targetCondition: refinement.targetCondition,
      assumptions: list(refinement.assumptions).slice(),
      checks,
      status: hasFailure ? "fail" : ready ? "pass" : "unexecuted",
    };
  });

  for (const rule of scopedRules) {
    if (!ruleLinks.has(rule.id)) {
      anomalies.push({
        kind: "uncovered-rule",
        id: rule.id,
        message: `rule has no declared formalization: ${rule.id}`,
      });
    }
  }
  for (const command of commands) {
    if (!commandLinks.has(command.id)) {
      anomalies.push({
        kind: "uncovered-command",
        id: command.id,
        message: `domain command has no formal action mapping: ${command.id}`,
      });
    }
  }
  for (const event of events) {
    if (!eventLinks.has(event.id)) {
      anomalies.push({
        kind: "uncovered-event",
        id: event.id,
        message: `domain event has no formal action mapping: ${event.id}`,
      });
    }
  }

  const failedFormalizations = normalizedFormalizations.filter((formalization) => formalization.evidence?.status === "fail"
    || formalization.evidence?.checks.some((check) => check.status === "fail"));
  const failedRefinements = normalizedRefinements.filter((refinement) => refinement.status === "fail");
  const sortedAnomalies = anomalies.sort((left, right) => `${left.kind}\u0000${left.id}`.localeCompare(`${right.kind}\u0000${right.id}`));
  return {
    schemaVersion: DOMAIN_TRACEABILITY_SCHEMA_VERSION,
    status: failedFormalizations.length > 0 || failedRefinements.length > 0 ? "fail" : sortedAnomalies.length > 0 ? "attention" : "pass",
    model: { id: model?.id ?? null, version: model?.version ?? null },
    summary: {
      formalizations: normalizedFormalizations.length,
      passedFormalizations: normalizedFormalizations.filter((formalization) => formalization.evidence?.status === "pass").length,
      refinements: normalizedRefinements.length,
      passedRefinements: normalizedRefinements.filter((refinement) => refinement.status === "pass").length,
      rules: scopedRules.length,
      excludedRules: rules.length - scopedRules.length,
      coveredRules: scopedRules.filter((rule) => ruleLinks.has(rule.id)).length,
      commands: commands.length,
      coveredCommands: commands.filter((command) => commandLinks.has(command.id)).length,
      events: events.length,
      coveredEvents: events.filter((event) => eventLinks.has(event.id)).length,
      anomalies: sortedAnomalies.length,
    },
    rules: rules.map((rule) => ({ id: rule.id, kind: rule.kind ?? null, text: rule.text ?? null, formalizations: list(ruleLinks.get(rule.id)).slice().sort() })),
    commands: commands.map((command) => ({ id: command.id, formalizations: list(commandLinks.get(command.id)).slice().sort() })),
    events: events.map((event) => ({ id: event.id, formalizations: list(eventLinks.get(event.id)).slice().sort() })),
    formalizations: normalizedFormalizations,
    refinements: normalizedRefinements,
    anomalies: sortedAnomalies,
  };
}

/** Render declared assumptions and machine witnesses without upgrading either to a proof. */
export function renderDomainTraceabilityMarkdown(report, { locale = "en" } = {}) {
  const ruleById = new Map(list(report.rules).map((rule) => [rule.id, rule]));
  const lines = [
    `# Traceability ${report.model.id ?? "unknown"}`,
    "",
    `- status: \`${report.status}\``,
    `- formalizations: \`${report.summary.formalizations}\` (passed: \`${report.summary.passedFormalizations}\`)`,
    `- refinements: \`${report.summary.passedRefinements}/${report.summary.refinements}\` substantiated`,
    `- rules: \`${report.summary.coveredRules}/${report.summary.rules}\` covered${report.summary.excludedRules > 0 ? ` (excluded: \`${report.summary.excludedRules}\`)` : ""}`,
    `- commands: \`${report.summary.coveredCommands}/${report.summary.commands}\` grounded`,
    `- events: \`${report.summary.coveredEvents}/${report.summary.events}\` grounded`,
    "",
  ];
  if (report.anomalies.length > 0) {
    lines.push("## Review queue", "");
    for (const anomaly of report.anomalies) lines.push(`- [${anomaly.kind}] ${anomaly.message}`);
    lines.push("");
  }
  if (report.refinements.length > 0) {
    lines.push("## Refinements", "");
    for (const refinement of report.refinements) {
      lines.push(`### ${refinement.id}`, "");
      lines.push(`- kind: \`${refinement.kind}\`; evidence: \`${refinement.status}\``);
      lines.push(`- abstract: \`${refinement.sourceFormalization}\` — ${refinement.sourceCondition}`);
      lines.push(`- concrete: \`${refinement.targetFormalization}\` — ${refinement.targetCondition}`);
      for (const assumption of refinement.assumptions) lines.push(`- assumption: ${assumption}`);
      for (const check of refinement.checks) lines.push(`- check: \`${check.id}\` — \`${check.status}\` (${check.assurance ?? "unknown"})`);
      lines.push("");
    }
  }
  lines.push("## Formalizations", "");
  for (const [index, formalization] of report.formalizations.entries()) {
    const rule = ruleById.get(formalization.rule);
    lines.push(`### ${formalization.id}`, "");
    lines.push(`- rule: \`${formalization.rule}\`${localText(rule?.text, locale) ? ` — ${localText(rule.text, locale)}` : ""}`);
    lines.push(`- kind: \`${formalization.kind}\`; assurance: \`${formalization.assurance}\``);
    if (formalization.target) lines.push(`- target: \`${formalization.target.kind} ${formalization.target.path}${formalization.target.symbol ? `#${formalization.target.symbol}` : ""}\``);
    lines.push(`- evidence: \`${formalization.evidence?.status ?? "unexecuted"}\``);
    if (formalization.evidence?.execution) {
      const execution = formalization.evidence.execution;
      lines.push(`- formal tool: \`${execution.engine}\` — \`${execution.status}\`${execution.version ? ` (version: \`${execution.version}\`)` : ""}`);
      if (execution.reason) lines.push(`- formal tool detail: ${execution.reason}`);
    }
    for (const assumption of formalization.assumptions) lines.push(`- assumption: ${assumption}`);
    for (const mapping of formalization.mappings) {
      const command = mapping.command ? `command: ${mapping.command}` : null;
      const events = mapping.events.length > 0 ? `event: ${mapping.events.join(", ")}` : null;
      lines.push(`- mapping: ${[mapping.action, command, events].filter(Boolean).join(" → ")} (\`${mapping.status}\`)`);
    }
    for (const check of formalization.evidence?.checks ?? []) {
      lines.push(`- check: \`${check.id}\` — \`${check.status}\` (${check.assurance ?? "unknown"})`);
    }
    for (const error of formalization.evidence?.errors ?? []) lines.push(`- evidence error: ${error}`);
    for (const counterexample of formalization.evidence?.counterexamples ?? []) {
      lines.push("", `#### Counterexample ${counterexample.check ?? "witness"}`, "");
      const trace = list(counterexample.trace);
      const path = list(counterexample.path);
      if (path.length > 0) lines.push(`- action trace: ${path.map((step) => tracePathLine(step, formalization.mappings)).join(" → ")}`);
      trace.forEach((state, index) => lines.push(`- 状態 ${index}: ${stateLine(state)}`));
      if (counterexample.violation?.index !== undefined) lines.push(`- 違反位置: ${counterexample.violation.index}`);
    }
    if (index < report.formalizations.length - 1) lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
