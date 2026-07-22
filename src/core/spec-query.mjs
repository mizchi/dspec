export const SPEC_QUERY_SCHEMA_VERSION = "1.0";

const QUERY_KINDS = new Set(["rule", "term", "evidence", "impact", "clause"]);

function list(value) {
  return Array.isArray(value) ? value : [];
}

function byId(left, right) {
  return String(left.id).localeCompare(String(right.id));
}

function localizedText(value, locale, fallbackLocale) {
  return value?.labels?.[locale] ?? value?.labels?.[fallbackLocale] ?? value?.default ?? "";
}

function clauseForSelector(rule, selector) {
  const match = /^(when|must|mustNot)\[([0-9]+)\]$/.exec(selector ?? "");
  if (!match) return null;
  return { field: match[1], index: Number(match[2]), clause: list(rule[match[1]])[Number(match[2])] ?? null };
}

function clauseEntries(rule, locale, fallbackLocale) {
  return ["when", "must", "mustNot"].flatMap((field) =>
    list(rule[field]).map((clause, index) => ({
      selector: `${field}[${index}]`,
      expr: clause.expr,
      text: localizedText(clause.text, locale, fallbackLocale),
      ast: clause.ast ?? null,
    })),
  );
}

function evidenceEntry(ref, kind, detail = {}) {
  return { ref, kind, ...detail };
}

function ruleEvidence(rule) {
  return [
    evidenceEntry(`rule:${rule.id}`, "rule", { id: rule.id }),
    ...["when", "must", "mustNot"].flatMap((field) =>
      list(rule[field]).map((_, index) => evidenceEntry(`clause:${rule.id}#${field}[${index}]`, "clause", { id: rule.id, selector: `${field}[${index}]` })),
    ),
    ...list(rule.checks).map((check, index) => evidenceEntry(`check:${rule.id}#${index}`, "check", { id: rule.id, backend: check.backend, target: check.ref })),
    ...list(rule.implementedBy).map((implementation, index) =>
      evidenceEntry(`implementation:${rule.id}#${index}`, "implementation", {
        id: rule.id,
        path: implementation.path,
        symbol: implementation.symbol ?? null,
      }),
    ),
  ];
}

function publicRule(rule, locale, fallbackLocale) {
  return {
    id: rule.id,
    kind: rule.kind,
    text: localizedText(rule.text, locale, fallbackLocale),
    terms: [...list(rule.terms)].sort(),
    reviewStatus: rule.reviewStatus,
    priority: rule.priority,
    deprecated: Boolean(rule.deprecated),
    exceptions: [...list(rule.exceptions)].sort(),
    clauses: clauseEntries(rule, locale, fallbackLocale),
  };
}

function success(model, request, classification, result, evidence) {
  return {
    schemaVersion: SPEC_QUERY_SCHEMA_VERSION,
    model: { id: model.id, version: model.version },
    request,
    status: "pass",
    classification,
    result,
    evidence,
    errors: [],
  };
}

function unsupported(model, request) {
  return success(model, request, "not-supported", null, []);
}

function failure(model, request, errors) {
  return {
    schemaVersion: SPEC_QUERY_SCHEMA_VERSION,
    model: { id: model?.id ?? null, version: model?.version ?? null },
    request,
    status: "fail",
    classification: null,
    result: null,
    evidence: [],
    errors,
  };
}

export function querySpec(model, request, { locale = null } = {}) {
  const normalizedRequest = {
    kind: request?.kind ?? null,
    id: request?.id ?? null,
    selector: request?.selector ?? null,
  };
  if (!model?.id || !model?.version) return failure(model, normalizedRequest, ["query model id and version are required"]);
  if (!QUERY_KINDS.has(normalizedRequest.kind)) return failure(model, normalizedRequest, [`unsupported query kind: ${normalizedRequest.kind}`]);
  if (!normalizedRequest.id) return failure(model, normalizedRequest, "query id is required");

  const fallbackLocale = model.primaryLocale;
  const selectedLocale = locale ?? fallbackLocale;
  const rules = list(model.rules).sort(byId);
  const terms = list(model.vocabulary).sort(byId);
  const rule = rules.find((candidate) => candidate.id === normalizedRequest.id);
  const term = terms.find((candidate) => candidate.id === normalizedRequest.id);

  if (normalizedRequest.kind === "rule") {
    if (!rule) return unsupported(model, normalizedRequest);
    return success(model, normalizedRequest, "entailed", publicRule(rule, selectedLocale, fallbackLocale), ruleEvidence(rule));
  }

  if (normalizedRequest.kind === "term") {
    if (!term) return unsupported(model, normalizedRequest);
    const relatedRules = rules.filter((candidate) => list(candidate.terms).includes(term.id));
    return success(
      model,
      normalizedRequest,
      "entailed",
      {
        id: term.id,
        kind: term.kind,
        text: localizedText(term.text, selectedLocale, fallbackLocale),
        aliases: [...list(term.aliases)].sort(),
        rules: relatedRules.map((candidate) => ({ id: candidate.id, text: localizedText(candidate.text, selectedLocale, fallbackLocale) })),
      },
      [
        evidenceEntry(`term:${term.id}`, "term", { id: term.id }),
        ...relatedRules.map((candidate) => evidenceEntry(`rule:${candidate.id}`, "rule", { id: candidate.id })),
      ],
    );
  }

  if (normalizedRequest.kind === "evidence") {
    if (!rule) return unsupported(model, normalizedRequest);
    return success(model, normalizedRequest, "entailed", { id: rule.id, evidence: ruleEvidence(rule) }, ruleEvidence(rule));
  }

  if (normalizedRequest.kind === "clause") {
    if (!rule) return unsupported(model, normalizedRequest);
    const entry = clauseForSelector(rule, normalizedRequest.selector);
    if (!entry?.clause) return unsupported(model, normalizedRequest);
    const classification = entry.field === "mustNot" ? "contradicted" : "entailed";
    return success(
      model,
      normalizedRequest,
      classification,
      {
        rule: { id: rule.id, text: localizedText(rule.text, selectedLocale, fallbackLocale) },
        selector: normalizedRequest.selector,
        expr: entry.clause.expr,
        text: localizedText(entry.clause.text, selectedLocale, fallbackLocale),
        ast: entry.clause.ast ?? null,
      },
      [
        evidenceEntry(`rule:${rule.id}`, "rule", { id: rule.id }),
        evidenceEntry(`clause:${rule.id}#${normalizedRequest.selector}`, "clause", { id: rule.id, selector: normalizedRequest.selector }),
      ],
    );
  }

  const impactTerms = term ? [term.id] : rule ? [...list(rule.terms)] : [];
  if (impactTerms.length === 0) return unsupported(model, normalizedRequest);
  const impactedRules = rules.filter((candidate) => list(candidate.terms).some((id) => impactTerms.includes(id)));
  return success(
    model,
    normalizedRequest,
    "entailed",
    {
      target: term
        ? { kind: "term", id: term.id, text: localizedText(term.text, selectedLocale, fallbackLocale) }
        : { kind: "rule", id: rule.id, text: localizedText(rule.text, selectedLocale, fallbackLocale) },
      terms: impactTerms.sort(),
      rules: impactedRules.map((candidate) => ({ id: candidate.id, text: localizedText(candidate.text, selectedLocale, fallbackLocale) })),
    },
    [
      ...(term ? [evidenceEntry(`term:${term.id}`, "term", { id: term.id })] : [evidenceEntry(`rule:${rule.id}`, "rule", { id: rule.id })]),
      ...impactedRules.map((candidate) => evidenceEntry(`rule:${candidate.id}`, "rule", { id: candidate.id })),
    ],
  );
}

export function verifySpecAnswer(query, answer) {
  const errors = [];
  if (!query || query.status !== "pass") errors.push("query report must pass before verifying an answer");
  if (!answer || typeof answer !== "object") errors.push("answer must be an object");
  if (answer?.classification !== query?.classification) {
    errors.push(`answer classification mismatch: expected ${query?.classification ?? "none"}, got ${answer?.classification ?? "missing"}`);
  }
  const available = new Set(list(query?.evidence).map((entry) => entry.ref));
  for (const ref of list(answer?.evidence)) {
    if (!available.has(ref)) errors.push(`answer evidence does not resolve in query result: ${ref}`);
  }
  return {
    status: errors.length === 0 ? "pass" : "fail",
    classification: query?.classification ?? null,
    evidence: list(answer?.evidence),
    errors,
  };
}

export function renderSpecQueryMarkdown(report, answer = null) {
  const lines = [
    `# DSpec Query ${report.request.kind}:${report.request.id}`,
    "",
    `- status: \`${report.status}\``,
    `- classification: \`${report.classification ?? "none"}\``,
    `- model: \`${report.model.id ?? "unknown"}@${report.model.version ?? "unknown"}\``,
  ];
  if (report.request.selector) lines.push(`- selector: \`${report.request.selector}\``);
  if (report.result) lines.push("", "## Result", "", "```json", JSON.stringify(report.result, null, 2), "```");
  lines.push("", "## Evidence", "");
  for (const entry of report.evidence) lines.push(`- \`${entry.ref}\` (${entry.kind})`);
  if (report.evidence.length === 0) lines.push("- none");
  if (answer) {
    lines.push("", "## Answer Verification", "", `- status: \`${answer.status}\``);
    for (const error of answer.errors) lines.push(`- error: ${error}`);
  }
  if (report.errors.length > 0) {
    lines.push("", "## Errors", "");
    for (const error of report.errors) lines.push(`- ${error}`);
  }
  return `${lines.join("\n")}\n`;
}
