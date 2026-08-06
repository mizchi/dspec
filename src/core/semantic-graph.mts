import { createHash } from "node:crypto";

import { domainRelationshipGraph } from "./domain.mjs";

export const SEMANTIC_GRAPH_SCHEMA_VERSION = "1.0";
export const SEMANTIC_GRAPH_NAMESPACE = "https://github.com/mizchi/dspec/ontology#";

type RecordValue = Record<string, any>;

export type SemanticEvidenceStatus = "declared" | "observed" | "verified" | "derived";
export type SemanticOrigin = "pkl" | "conformance-report" | "assurance-manifest" | "real-app-reconciliation";

export type SemanticNode = {
  id: string;
  kind: string;
  label: string;
  origin: SemanticOrigin;
  evidenceStatus: SemanticEvidenceStatus;
};

export type SemanticEdge = {
  from: string;
  relation: string;
  to: string;
  origin: SemanticOrigin;
  evidenceStatus: SemanticEvidenceStatus;
};

export type SemanticGraph = {
  schemaVersion: typeof SEMANTIC_GRAPH_SCHEMA_VERSION;
  status: "pass" | "fail";
  model: { id: string | null; version: string | null; locale: string };
  semantics: {
    sourceOfTruth: "pkl";
    evidencePolicy: string;
    relationPolicy: string;
  };
  summary: {
    nodes: number;
    edges: number;
    nodesByKind: Record<string, number>;
    edgesByRelation: Record<string, number>;
  };
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  errors: string[];
};

export type GraphdbBundle = {
  schemaVersion: "1.0";
  files: Record<string, string>;
};

export type GraphdbDocument = {
  graphdbId: string;
  stableId: string;
  title: string;
  tags: string[];
  text: string;
};

export type GraphdbEmbedding = {
  provider: "hash";
  dimensions: number;
  rows: number;
  notesCsv: string;
};

export type SemanticGraphEvidenceSources = {
  conformance?: unknown;
  assurance?: unknown;
  realApp?: unknown;
};

export type SemanticGraphQuery = {
  schemaVersion: "1.0";
  model: SemanticGraph["model"];
  question: string;
  status: "pass";
  classification: "retrieved" | "not-supported";
  retrieval: { provider: "hash"; dimensions: number; limit: number; hops: number };
  matches: {
    stableId: string;
    kind: string;
    label: string;
    origin: SemanticOrigin;
    evidenceStatus: SemanticEvidenceStatus;
    score: number;
    relations: { direction: "outgoing" | "incoming"; relation: string; stableId: string; label: string }[];
  }[];
  evidence: { ref: string; kind: "node" | "edge"; origin: SemanticOrigin; evidenceStatus: SemanticEvidenceStatus }[];
  errors: string[];
};

function list<T = RecordValue>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function byId(left: RecordValue, right: RecordValue): number {
  return String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

function localized(value: unknown, locale: string): string {
  if (typeof value === "string") return value;
  const entry = record(value);
  return String(entry.labels?.[locale] ?? entry.default ?? "");
}

function stableEntries<T extends RecordValue>(entries: unknown): T[] {
  return list<T>(entries).slice().sort(byId);
}

function countBy<T extends RecordValue>(values: readonly T[], property: keyof T): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = String(value[property]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function relationOrder(left: SemanticEdge, right: SemanticEdge): number {
  return `${left.from}\u0000${left.relation}\u0000${left.to}`.localeCompare(`${right.from}\u0000${right.relation}\u0000${right.to}`);
}

function artifactId(reference: RecordValue): string {
  const symbol = reference.symbol ? `#${reference.symbol}` : "";
  return `artifact/${reference.kind ?? "unknown"}/${reference.path ?? "missing"}${symbol}`;
}

function artifactLabel(reference: RecordValue): string {
  const symbol = reference.symbol ? `#${reference.symbol}` : "";
  return `${reference.kind ?? "unknown"} ${reference.path ?? "missing"}${symbol}`;
}

function escapedId(value: unknown): string {
  return encodeURIComponent(String(value ?? "missing"));
}

/**
 * Converts the Pkl model into a typed graph of declarations.  This graph is a
 * derived view, not evidence that code implements a rule.  Adapters can add
 * observed or verified facts later without changing the Pkl source model.
 */
export function semanticGraph(value: unknown, { locale: requestedLocale }: { locale?: string } = {}): SemanticGraph {
  const model = record(value);
  const locale = requestedLocale ?? String(model.primaryLocale ?? "en");
  const nodes = new Map<string, SemanticNode>();
  const edges = new Map<string, SemanticEdge>();
  const errors: string[] = [];
  const addNode = (id: string, kind: string, label: string): string => {
    const existing = nodes.get(id);
    if (!existing || (existing.kind.startsWith("unresolved-") && !kind.startsWith("unresolved-"))) {
      nodes.set(id, { id, kind, label, origin: "pkl", evidenceStatus: "declared" });
    }
    return id;
  };
  const addEdge = (from: string, relation: string, to: string): void => {
    const edge: SemanticEdge = { from, relation, to, origin: "pkl", evidenceStatus: "declared" };
    edges.set(`${from}\u0000${relation}\u0000${to}`, edge);
  };
  const modelId = addNode(`model/${model.id ?? "missing"}`, "model", localized(model.name, locale) || String(model.id ?? "missing"));

  const termById = new Map(stableEntries(model.vocabulary).map((entry) => [String(entry.id), entry]));
  const ruleById = new Map(stableEntries(model.rules).map((entry) => [String(entry.id), entry]));
  const decisionById = new Map(stableEntries(model.decisions).map((entry) => [String(entry.id), entry]));
  const addTerm = (termId: unknown): string => {
    const term = termById.get(String(termId));
    if (term) return addNode(`term/${term.id}`, "term", localized(term.text, locale) || `term ${term.id}`);
    return addNode(`unresolved/term/${escapedId(termId)}`, "unresolved-term", `Unresolved term ${termId ?? "missing"}`);
  };
  const addRule = (ruleId: unknown): string => {
    const rule = ruleById.get(String(ruleId));
    if (rule) return addNode(`rule/${rule.id}`, "rule", localized(rule.text, locale) || `rule ${rule.id}`);
    return addNode(`unresolved/rule/${escapedId(ruleId)}`, "unresolved-rule", `Unresolved rule ${ruleId ?? "missing"}`);
  };
  const addDecision = (decisionId: unknown): string => {
    const decision = decisionById.get(String(decisionId));
    if (decision) return addNode(`decision/${decision.id}`, "decision", localized(decision.summary, locale) || `decision ${decision.id}`);
    return addNode(`unresolved/decision/${escapedId(decisionId)}`, "unresolved-decision", `Unresolved decision ${decisionId ?? "missing"}`);
  };
  const addArtifact = (reference: unknown): string => {
    const entry = record(reference);
    return addNode(artifactId(entry), "artifact", artifactLabel(entry));
  };

  for (const term of stableEntries(model.vocabulary)) {
    const termId = addTerm(term.id);
    addEdge(modelId, "declares-term", termId);
  }
  for (const rule of stableEntries(model.rules)) {
    const ruleId = addRule(rule.id);
    addEdge(modelId, "declares-rule", ruleId);
    for (const termId of list<string>(rule.terms).slice().sort()) addEdge(ruleId, "uses-term", addTerm(termId));
    for (const check of stableEntries(rule.checks)) {
      const checkId = addNode(`check/${check.backend ?? "unknown"}/${escapedId(check.ref)}`, "check", `${check.backend ?? "unknown"} ${check.ref ?? "missing"}`);
      addEdge(ruleId, "has-check", checkId);
    }
    for (const implementation of list<RecordValue>(rule.implementedBy).slice().sort((left, right) => artifactId(left).localeCompare(artifactId(right)))) {
      addEdge(ruleId, "implemented-by", addArtifact(implementation));
    }
  }
  for (const decision of stableEntries(model.decisions)) {
    const decisionId = addDecision(decision.id);
    addEdge(modelId, "declares-decision", decisionId);
    for (const superseded of list<string>(decision.supersedes).slice().sort()) addEdge(decisionId, "supersedes", addDecision(superseded));
  }
  for (const projection of stableEntries(model.projections)) {
    const projectionId = addNode(`projection/${projection.id}`, "projection", `${projection.kind ?? "unknown"} projection ${projection.id}`);
    addEdge(modelId, "declares-projection", projectionId);
    if (projection.output) {
      const outputId = addNode(`artifact/projection-output/${escapedId(projection.output)}`, "artifact", `projection output ${projection.output}`);
      addEdge(projectionId, "writes-artifact", outputId);
    }
    if (projection.provenance) {
      const provenanceId = addNode(`artifact/provenance/${escapedId(projection.provenance)}`, "artifact", `projection provenance ${projection.provenance}`);
      addEdge(projectionId, "records-provenance", provenanceId);
    }
  }

  const domainModel = record(record(model.patterns).domain);
  if (Object.keys(domainModel).length > 0) {
    const graph = domainRelationshipGraph(model) as RecordValue;
    for (const node of list<RecordValue>(graph.nodes)) addNode(String(node.id), String(node.kind), String(node.label));
    for (const edge of list<RecordValue>(graph.edges)) addEdge(String(edge.from), String(edge.relation), String(edge.to));
    errors.push(...list<string>(graph.errors));
  }

  const intent = record(record(model.patterns).intent);
  const capabilityById = new Map(stableEntries(intent.capabilities).map((entry) => [String(entry.id), entry]));
  const outcomeById = new Map(stableEntries(intent.outcomes).map((entry) => [String(entry.id), entry]));
  const processById = new Map(stableEntries(intent.processes).map((entry) => [String(entry.id), entry]));
  const claimById = new Map(stableEntries(intent.claims).map((entry) => [String(entry.id), entry]));
  const refinementById = new Map<string, RecordValue>();
  for (const process of stableEntries(intent.processes)) {
    for (const refinement of stableEntries(process.refinements)) refinementById.set(String(refinement.id), refinement);
  }
  const addCapability = (capabilityId: unknown): string => {
    const capability = capabilityById.get(String(capabilityId));
    if (capability) return addNode(`intent/capability/${capability.id}`, "intent-capability", localized(capability.text, locale) || `capability ${capability.id}`);
    return addNode(`unresolved/intent-capability/${escapedId(capabilityId)}`, "unresolved-intent-capability", `Unresolved capability ${capabilityId ?? "missing"}`);
  };
  const addOutcome = (outcomeId: unknown): string => {
    const outcome = outcomeById.get(String(outcomeId));
    if (outcome) return addNode(`intent/outcome/${outcome.id}`, "intent-outcome", localized(outcome.text, locale) || `outcome ${outcome.id}`);
    return addNode(`unresolved/intent-outcome/${escapedId(outcomeId)}`, "unresolved-intent-outcome", `Unresolved outcome ${outcomeId ?? "missing"}`);
  };
  const addProcess = (processId: unknown): string => {
    const process = processById.get(String(processId));
    if (process) return addNode(`intent/process/${process.id}`, "intent-process", localized(process.text, locale) || `process ${process.id}`);
    return addNode(`unresolved/intent-process/${escapedId(processId)}`, "unresolved-intent-process", `Unresolved process ${processId ?? "missing"}`);
  };
  const addClaim = (claimId: unknown): string => {
    const claim = claimById.get(String(claimId));
    if (claim) return addNode(`intent/claim/${claim.id}`, "intent-claim", localized(claim.text, locale) || `claim ${claim.id}`);
    return addNode(`unresolved/intent-claim/${escapedId(claimId)}`, "unresolved-intent-claim", `Unresolved claim ${claimId ?? "missing"}`);
  };
  const addRefinement = (refinementId: unknown): string => {
    const refinement = refinementById.get(String(refinementId));
    if (refinement) return addNode(`intent/refinement/${refinement.id}`, "intent-refinement", localized(refinement.text, locale) || `refinement ${refinement.id}`);
    return addNode(`unresolved/intent-refinement/${escapedId(refinementId)}`, "unresolved-intent-refinement", `Unresolved refinement ${refinementId ?? "missing"}`);
  };

  for (const capability of stableEntries(intent.capabilities)) {
    const capabilityId = addCapability(capability.id);
    addEdge(modelId, "declares-capability", capabilityId);
  }
  for (const outcome of stableEntries(intent.outcomes)) {
    const outcomeId = addOutcome(outcome.id);
    addEdge(modelId, "declares-outcome", outcomeId);
    if (outcome.state) addEdge(outcomeId, "has-state", addTerm(outcome.state));
    for (const effect of stableEntries(outcome.effects)) {
      const effectId = addNode(`intent/effect/${outcome.id}/${effect.id}`, "intent-effect", localized(effect.text, locale) || `effect ${effect.id}`);
      addEdge(outcomeId, "produces-effect", effectId);
      addEdge(effectId, "uses-capability", addCapability(effect.capability));
    }
  }
  for (const process of stableEntries(intent.processes)) {
    const processId = addProcess(process.id);
    addEdge(modelId, "declares-process", processId);
    if (process.input) addEdge(processId, "accepts-input", addTerm(process.input));
    for (const outcome of list<string>(process.outcomes).slice().sort()) addEdge(processId, "permits-outcome", addOutcome(outcome));
    for (const capability of list<string>(process.requires).slice().sort()) addEdge(processId, "requires-capability", addCapability(capability));
    for (const outcome of list<string>(process.constructs).slice().sort()) addEdge(processId, "constructs-outcome", addOutcome(outcome));
    for (const implementation of list<RecordValue>(process.implementedBy).slice().sort((left, right) => artifactId(left).localeCompare(artifactId(right)))) {
      addEdge(processId, "implemented-by", addArtifact(implementation));
    }
    for (const refinement of stableEntries(process.refinements)) {
      const refinementId = addRefinement(refinement.id);
      addEdge(processId, "has-refinement", refinementId);
      addEdge(refinementId, "refines-implementation", addArtifact(refinement.implementation));
    }
    for (const transition of list<RecordValue>(process.transitions).slice().sort((left, right) => `${left.from}\u0000${left.to}`.localeCompare(`${right.from}\u0000${right.to}`))) {
      const transitionId = addNode(`intent/transition/${process.id}/${escapedId(transition.from)}-${escapedId(transition.to)}`, "intent-transition", `${transition.from} -> ${transition.to}`);
      addEdge(processId, "declares-transition", transitionId);
      addEdge(transitionId, "from-state", addTerm(transition.from));
      addEdge(transitionId, "to-state", addTerm(transition.to));
    }
  }
  for (const authority of stableEntries(intent.constructionAuthorities)) {
    const authorityId = addNode(`intent/construction-authority/${authority.id}`, "intent-construction-authority", localized(authority.text, locale) || `construction authority ${authority.id}`);
    addEdge(modelId, "declares-construction-authority", authorityId);
    addEdge(authorityId, "authorizes-process", addProcess(authority.process));
    addEdge(authorityId, "authorizes-outcome", addOutcome(authority.outcome));
  }
  for (const goal of stableEntries(intent.goals)) {
    const goalId = addNode(`intent/goal/${goal.id}`, "intent-goal", localized(goal.text, locale) || `goal ${goal.id}`);
    addEdge(modelId, "declares-goal", goalId);
    for (const process of list<string>(goal.intents).slice().sort()) addEdge(goalId, "includes-process", addProcess(process));
    for (const claim of list<string>(goal.claims).slice().sort()) addEdge(goalId, "includes-claim", addClaim(claim));
  }
  for (const claim of stableEntries(intent.claims)) {
    const claimId = addClaim(claim.id);
    addEdge(modelId, "declares-claim", claimId);
    for (const process of list<string>(claim.processes).slice().sort()) addEdge(claimId, "claims-process", addProcess(process));
  }
  for (const task of stableEntries(intent.assuranceTasks)) {
    const taskId = addNode(`intent/assurance-task/${task.id}`, "intent-assurance-task", localized(task.text, locale) || `assurance task ${task.id}`);
    addEdge(modelId, "declares-assurance-task", taskId);
    for (const claim of list<string>(task.claims).slice().sort()) addEdge(taskId, "assures-claim", addClaim(claim));
    addEdge(taskId, "targets-artifact", addArtifact(task.target));
  }
  for (const binding of stableEntries(intent.semanticBindings)) {
    const bindingId = addNode(`intent/semantic-binding/${binding.id}`, "intent-semantic-binding", localized(binding.text, locale) || `semantic binding ${binding.id}`);
    addEdge(modelId, "declares-semantic-binding", bindingId);
    for (const claim of list<string>(binding.claims).slice().sort()) addEdge(bindingId, "binds-claim", addClaim(claim));
    addEdge(bindingId, "binds-process", addProcess(binding.process));
    if (binding.refinement) addEdge(bindingId, "binds-refinement", addRefinement(binding.refinement));
    const targetId = addNode(`intent/semantic-target/${escapedId(binding.target)}`, "intent-semantic-target", String(binding.target));
    addEdge(bindingId, "binds-target", targetId);
  }
  for (const scenario of stableEntries(intent.scenarios)) {
    const scenarioId = addNode(`intent/scenario/${scenario.id}`, "intent-scenario", localized(scenario.text, locale) || `scenario ${scenario.id}`);
    addEdge(modelId, "declares-scenario", scenarioId);
    addEdge(scenarioId, "starts-in-state", addTerm(scenario.initialState));
    addEdge(scenarioId, "expects-state", addTerm(scenario.expectedState));
    for (const [index, step] of list<RecordValue>(scenario.steps).entries()) {
      const stepId = addNode(`intent/scenario-step/${scenario.id}/${index}`, "intent-scenario-step", `${step.process} -> ${step.outcome}`);
      addEdge(scenarioId, "includes-step", stepId);
      addEdge(stepId, "runs-process", addProcess(step.process));
      addEdge(stepId, "expects-outcome", addOutcome(step.outcome));
    }
  }
  for (const protocolTest of stableEntries(intent.tests)) {
    const testId = addNode(`intent/protocol-test/${protocolTest.id}`, "intent-protocol-test", localized(protocolTest.text, locale) || `protocol test ${protocolTest.id}`);
    addEdge(modelId, "declares-protocol-test", testId);
    addEdge(testId, "tests-process", addProcess(protocolTest.process));
    addEdge(testId, "tests-refinement", addRefinement(protocolTest.refinement));
    addEdge(testId, "expects-outcome", addOutcome(protocolTest.outcome));
  }

  const sortedNodes = [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id));
  const sortedEdges = [...edges.values()].sort(relationOrder);
  const sortedErrors = [...new Set(errors)].sort();
  return {
    schemaVersion: SEMANTIC_GRAPH_SCHEMA_VERSION,
    status: sortedErrors.length === 0 ? "pass" : "fail",
    model: { id: model.id ? String(model.id) : null, version: model.version ? String(model.version) : null, locale },
    semantics: {
      sourceOfTruth: "pkl",
      evidencePolicy: "A declared edge records source-model intent; it does not establish implementation conformance or a formal proof.",
      relationPolicy: "Relation labels and multiple edges are preserved in JSON and Turtle. GraphDB links are a lossy search projection.",
    },
    summary: {
      nodes: sortedNodes.length,
      edges: sortedEdges.length,
      nodesByKind: countBy(sortedNodes, "kind"),
      edgesByRelation: countBy(sortedEdges, "relation"),
    },
    nodes: sortedNodes,
    edges: sortedEdges,
    errors: sortedErrors,
  };
}

function externalEvidenceStatus(status: unknown): SemanticEvidenceStatus {
  return status === "pass" ? "verified" : "observed";
}

function sourceModel(document: RecordValue): RecordValue {
  return record(document.model ?? record(document.manifest).model);
}

function sourceArtifacts(document: RecordValue): RecordValue[] {
  return stableEntries(document.artifacts ?? record(document.manifest).artifacts);
}

function sourceIdentityErrors(graph: SemanticGraph, document: RecordValue, label: string): string[] {
  const source = sourceModel(document);
  const errors: string[] = [];
  if (source.id && String(source.id) !== graph.model.id) errors.push(`${label} evidence model id mismatch: expected ${graph.model.id ?? "missing"}, got ${source.id}`);
  if (source.version && String(source.version) !== graph.model.version) errors.push(`${label} evidence model version mismatch: expected ${graph.model.version ?? "missing"}, got ${source.version}`);
  return errors;
}

function externalNodeId(scope: string, id: unknown): string {
  return `evidence/${scope}/${escapedId(id)}`;
}

/**
 * Joins independently produced verification reports to a derived graph without
 * changing the status of the Pkl declarations they refer to. This is the
 * boundary between the specification master and observed/verified evidence.
 */
export function semanticGraphWithEvidence(graph: SemanticGraph, sources: SemanticGraphEvidenceSources): SemanticGraph {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = new Map(graph.edges.map((edge) => [`${edge.from}\u0000${edge.relation}\u0000${edge.to}`, edge]));
  const errors = [...graph.errors];
  const modelId = `model/${graph.model.id ?? "missing"}`;
  const addNode = (id: string, kind: string, label: string, origin: SemanticOrigin, evidenceStatus: SemanticEvidenceStatus): string => {
    if (!nodes.has(id)) nodes.set(id, { id, kind, label, origin, evidenceStatus });
    return id;
  };
  const addEdge = (from: string, relation: string, to: string, origin: SemanticOrigin, evidenceStatus: SemanticEvidenceStatus): void => {
    edges.set(`${from}\u0000${relation}\u0000${to}`, { from, relation, to, origin, evidenceStatus });
  };
  const pklDeclaration = (path: unknown): string => addNode(
    `pkl-declaration/${escapedId(path)}`,
    "pkl-declaration",
    `Pkl declaration ${path ?? "missing"}`,
    "pkl",
    "declared",
  );

  if (sources.conformance) {
    const document = record(sources.conformance);
    errors.push(...sourceIdentityErrors(graph, document, "conformance"));
    const reportId = addNode("evidence/conformance/report", "conformance-report", `Conformance report ${document.status ?? "unknown"}`, "conformance-report", externalEvidenceStatus(document.status));
    addEdge(modelId, "has-conformance-report", reportId, "conformance-report", externalEvidenceStatus(document.status));
    for (const target of stableEntries(document.targets)) {
      const targetId = addNode(externalNodeId("conformance", target.id), "conformance-target", `Conformance ${target.id ?? "missing"}: ${target.status ?? "unknown"}`, "conformance-report", externalEvidenceStatus(target.status));
      addEdge(reportId, "contains-conformance-target", targetId, "conformance-report", externalEvidenceStatus(target.status));
      const ruleId = `rule/${target.ruleId ?? "missing"}`;
      if (nodes.has(ruleId)) addEdge(ruleId, "has-conformance-result", targetId, "conformance-report", externalEvidenceStatus(target.status));
      else addEdge(targetId, "tests-unresolved-rule", addNode(`unresolved/rule/${escapedId(target.ruleId)}`, "unresolved-rule", `Unresolved rule ${target.ruleId ?? "missing"}`, "conformance-report", "observed"), "conformance-report", externalEvidenceStatus(target.status));
      for (const testCase of stableEntries(target.cases)) {
        const caseId = addNode(`${targetId}/case/${escapedId(testCase.id)}`, "conformance-case", `Conformance case ${testCase.id ?? "missing"}: ${testCase.status ?? "unknown"}`, "conformance-report", externalEvidenceStatus(testCase.status));
        addEdge(targetId, "contains-conformance-case", caseId, "conformance-report", externalEvidenceStatus(testCase.status));
      }
    }
  }

  if (sources.assurance) {
    const document = record(sources.assurance);
    errors.push(...sourceIdentityErrors(graph, document, "assurance"));
    const reportId = addNode("evidence/assurance/report", "assurance-report", "Assurance evidence manifest", "assurance-manifest", "observed");
    addEdge(modelId, "has-assurance-report", reportId, "assurance-manifest", "observed");
    for (const artifact of sourceArtifacts(document)) {
      const status = externalEvidenceStatus(artifact.result);
      const artifactId = addNode(externalNodeId("assurance", artifact.id), "assurance-artifact", `${artifact.backend ?? "unknown"} ${artifact.id ?? "missing"}: ${artifact.result ?? "unknown"}`, "assurance-manifest", status);
      addEdge(reportId, "contains-assurance-artifact", artifactId, "assurance-manifest", status);
      for (const propertyId of list<string>(artifact.propertyIds).slice().sort()) {
        const property = addNode(`formal-property/${escapedId(propertyId)}`, "formal-property", propertyId, "assurance-manifest", status);
        addEdge(artifactId, "reports-property-result", property, "assurance-manifest", status);
      }
    }
  }

  if (sources.realApp) {
    const document = record(sources.realApp);
    errors.push(...sourceIdentityErrors(graph, document, "real app"));
    const reportId = addNode("evidence/real-app/report", "real-app-reconciliation", `Real app reconciliation ${document.status ?? "unknown"}`, "real-app-reconciliation", "observed");
    addEdge(modelId, "has-real-app-reconciliation", reportId, "real-app-reconciliation", "observed");
    for (const check of stableEntries(document.checks)) {
      const checkId = addNode(
        `evidence/real-app/${escapedId(check.kind)}/${escapedId(check.id)}`,
        "real-app-observation",
        `${check.kind ?? "observed"} ${check.id ?? "missing"}: ${check.status ?? "unknown"}`,
        "real-app-reconciliation",
        "observed",
      );
      addEdge(reportId, "contains-real-app-observation", checkId, "real-app-reconciliation", "observed");
      const declaration = pklDeclaration(check.path);
      addEdge(checkId, "observes-declaration", declaration, "real-app-reconciliation", "observed");
    }
  }

  const sortedNodes = [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id));
  const sortedEdges = [...edges.values()].sort(relationOrder);
  const sortedErrors = [...new Set(errors)].sort();
  return {
    ...graph,
    status: sortedErrors.length === 0 ? "pass" : "fail",
    semantics: {
      ...graph.semantics,
      evidencePolicy: "Pkl declarations remain declared. Imported conformance, assurance, and real-app reports retain their own origin and scope; a pass does not promote a Pkl declaration into a universal proof.",
    },
    summary: {
      nodes: sortedNodes.length,
      edges: sortedEdges.length,
      nodesByKind: countBy(sortedNodes, "kind"),
      edgesByRelation: countBy(sortedEdges, "relation"),
    },
    nodes: sortedNodes,
    edges: sortedEdges,
    errors: sortedErrors,
  };
}

function turtleLiteral(value: unknown): string {
  return JSON.stringify(String(value ?? ""));
}

function turtleNode(id: string): string {
  return `<urn:dspec:node:${encodeURIComponent(id)}>`;
}

/** Render the complete labelled graph as portable RDF/Turtle. */
export function renderSemanticGraphTurtle(graph: SemanticGraph): string {
  const lines = [
    `@prefix dspec: <${SEMANTIC_GRAPH_NAMESPACE}> .`,
    "",
  ];
  for (const node of graph.nodes) {
    lines.push(`${turtleNode(node.id)} a dspec:${node.kind} ;`);
    lines.push(`  dspec:stable-id ${turtleLiteral(node.id)} ;`);
    lines.push(`  dspec:label ${turtleLiteral(node.label)} ;`);
    lines.push(`  dspec:origin ${turtleLiteral(node.origin)} ;`);
    lines.push(`  dspec:evidence-status ${turtleLiteral(node.evidenceStatus)} .`);
    lines.push("");
  }
  for (const edge of graph.edges) {
    lines.push(`${turtleNode(edge.from)} dspec:${edge.relation} ${turtleNode(edge.to)} .`);
  }
  return `${lines.join("\n")}\n`;
}

function graphdbId(stableId: string): string {
  const hex = createHash("sha256").update(stableId).digest("hex").slice(0, 16);
  return BigInt(`0x${hex}`).toString();
}

function graphdbTags(node: SemanticNode): string[] {
  return [node.kind, `origin:${node.origin}`, `evidence:${node.evidenceStatus}`]
    .map((tag) => tag.replaceAll("\t", " ").replaceAll(",", "_"));
}

function graphdbDocument(node: SemanticNode, graph: SemanticGraph): string {
  const outgoing = graph.edges
    .filter((edge) => edge.from === node.id)
    .map((edge) => `${edge.relation}: ${edge.to}`);
  return [
    node.label,
    `stable id: ${node.id}`,
    `kind: ${node.kind}`,
    `evidence: ${node.evidenceStatus}`,
    ...(outgoing.length > 0 ? ["declared relations:", ...outgoing] : []),
  ].join("\n");
}

function graphdbDocuments(graph: SemanticGraph, ids: Map<string, string>): GraphdbDocument[] {
  return graph.nodes.map((node) => ({
    graphdbId: ids.get(node.id) ?? graphdbId(node.id),
    stableId: node.id,
    title: node.label,
    tags: graphdbTags(node),
    text: graphdbDocument(node, graph),
  }));
}

type GraphdbRelationNode = {
  node: SemanticNode;
  edge: SemanticEdge;
};

function graphdbRelationStableId(edge: SemanticEdge): string {
  const identity = [edge.from, edge.relation, edge.to, edge.origin, edge.evidenceStatus].join("\u0000");
  return "relation/" + createHash("sha256").update(identity).digest("hex");
}

function graphdbRelationTags(edge: SemanticEdge): string[] {
  return [
    "relation",
    "relation:" + edge.relation,
    "origin:" + edge.origin,
    "evidence:" + edge.evidenceStatus,
  ].map((tag) => tag.replaceAll("\t", " ").replaceAll(",", "_"));
}

function graphdbRelationNodes(graph: SemanticGraph): GraphdbRelationNode[] {
  return graph.edges.map((edge) => ({
    node: {
      id: graphdbRelationStableId(edge),
      kind: "relation",
      label: edge.relation,
      origin: edge.origin,
      evidenceStatus: edge.evidenceStatus,
    },
    edge,
  }));
}

function graphdbRelationDocument(
  relation: GraphdbRelationNode,
  graph: SemanticGraph,
  ids: Map<string, string>,
): GraphdbDocument {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const { edge, node } = relation;
  return {
    graphdbId: ids.get(node.id) ?? graphdbId(node.id),
    stableId: node.id,
    title: edge.relation,
    tags: graphdbRelationTags(edge),
    text: [
      "relation: " + edge.relation,
      "source: " + edge.from + " (" + (byId.get(edge.from)?.label ?? edge.from) + ")",
      "target: " + edge.to + " (" + (byId.get(edge.to)?.label ?? edge.to) + ")",
      "origin: " + edge.origin,
      "evidence: " + edge.evidenceStatus,
    ].join("\n"),
  };
}

function hashTokens(value: string): string[] {
  const normalized = value.normalize("NFKC").toLocaleLowerCase();
  const tokens: string[] = [];
  let word = "";
  const flush = (): void => {
    if (word) tokens.push(word);
    word = "";
  };
  for (const character of normalized) {
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character)) {
      flush();
      tokens.push(character);
    } else if (/[\p{L}\p{N}_-]/u.test(character)) {
      word += character;
    } else {
      flush();
    }
  }
  flush();
  return tokens;
}

function hashVector(value: string, dimensions: number): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of hashTokens(value)) {
    const digest = createHash("sha256").update(token).digest();
    const hash = digest.readUInt32BE(0);
    const index = hash % dimensions;
    vector[index] += (hash & 0x80000000) === 0 ? 1 : -1;
  }
  const magnitude = Math.hypot(...vector);
  return magnitude === 0 ? vector : vector.map((entry) => entry / magnitude);
}

function csvVector(vector: readonly number[]): string {
  return vector.map((entry) => {
    const rounded = Number(entry.toFixed(8));
    return Object.is(rounded, -0) ? "0.00000000" : rounded.toFixed(8);
  }).join(",");
}

function graphdbDocumentRecord(value: unknown): GraphdbDocument {
  const document = record(value);
  if (!/^\d+$/.test(String(document.graphdbId ?? ""))) throw new Error(`invalid GraphDB document id: ${document.graphdbId ?? "missing"}`);
  if (typeof document.text !== "string") throw new Error(`invalid GraphDB document text: ${document.graphdbId}`);
  return {
    graphdbId: String(document.graphdbId),
    stableId: String(document.stableId ?? ""),
    title: String(document.title ?? ""),
    tags: list<string>(document.tags).map(String),
    text: document.text,
  };
}

/**
 * A deterministic, dependency-free baseline embedder. It is intentionally a
 * lexical feature hash, so callers can replace notes.csv with a model-specific
 * semantic embedding while preserving the same GraphDB IDs.
 */
export function embedGraphdbDocuments(values: readonly unknown[], { dimensions = 256 }: { dimensions?: number } = {}): GraphdbEmbedding {
  if (!Number.isInteger(dimensions) || dimensions < 2 || dimensions > 8192) throw new Error(`invalid embedding dimensions: ${dimensions}`);
  const documents = values.map(graphdbDocumentRecord).sort((left, right) => left.graphdbId.localeCompare(right.graphdbId));
  const ids = new Set<string>();
  for (const document of documents) {
    if (ids.has(document.graphdbId)) throw new Error(`duplicate GraphDB document id: ${document.graphdbId}`);
    ids.add(document.graphdbId);
  }
  return {
    provider: "hash",
    dimensions,
    rows: documents.length,
    notesCsv: `${documents.map((document) => `${document.graphdbId},${csvVector(hashVector(document.text, dimensions))}`).join("\n")}${documents.length > 0 ? "\n" : ""}`,
  };
}

function cosine(left: readonly number[], right: readonly number[]): number {
  return left.reduce((sum, entry, index) => sum + entry * (right[index] ?? 0), 0);
}

/**
 * Performs deterministic retrieval over graph labels and declared relations.
 * It returns source-backed matches rather than attempting an ungrounded answer
 * to a natural-language question.
 */
export function querySemanticGraph(
  graph: SemanticGraph,
  question: string,
  { dimensions = 256, limit = 5, hops = 1 }: { dimensions?: number; limit?: number; hops?: number } = {},
): SemanticGraphQuery {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error(`invalid graph query limit: ${limit}`);
  if (!Number.isInteger(hops) || hops < 0 || hops > 3) throw new Error(`invalid graph query hops: ${hops}`);
  const query = question.trim();
  const vector = hashVector(query, dimensions);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const ranked = graph.nodes
    .map((node) => ({ node, score: cosine(vector, hashVector(graphdbDocument(node, graph), dimensions)) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.node.id.localeCompare(right.node.id))
    .slice(0, limit);
  const matches = ranked.map(({ node, score }) => {
    const frontier = new Set([node.id]);
    const included = new Set([node.id]);
    for (let depth = 0; depth < hops; depth += 1) {
      const next = new Set<string>();
      for (const edge of graph.edges) {
        if (frontier.has(edge.from)) next.add(edge.to);
        if (frontier.has(edge.to)) next.add(edge.from);
      }
      for (const id of next) included.add(id);
      frontier.clear();
      for (const id of next) frontier.add(id);
    }
    const relations = graph.edges
      .filter((edge) => edge.from === node.id || edge.to === node.id)
      .filter((edge) => included.has(edge.from) && included.has(edge.to))
      .map((edge) => {
        const outgoing = edge.from === node.id;
        const other = outgoing ? edge.to : edge.from;
        return { direction: outgoing ? "outgoing" as const : "incoming" as const, relation: edge.relation, stableId: other, label: byId.get(other)?.label ?? other };
      })
      .sort((left, right) => `${left.direction}\u0000${left.relation}\u0000${left.stableId}`.localeCompare(`${right.direction}\u0000${right.relation}\u0000${right.stableId}`));
    return {
      stableId: node.id,
      kind: node.kind,
      label: node.label,
      origin: node.origin,
      evidenceStatus: node.evidenceStatus,
      score: Number(score.toFixed(8)),
      relations,
    };
  });
  const evidence = [
    ...matches.map((match) => ({ ref: `node:${match.stableId}`, kind: "node" as const, origin: match.origin, evidenceStatus: match.evidenceStatus })),
    ...matches.flatMap((match) => match.relations.map((relation) => {
      const edge = graph.edges.find((entry) => (entry.from === match.stableId && entry.to === relation.stableId || entry.to === match.stableId && entry.from === relation.stableId) && entry.relation === relation.relation);
      return edge ? { ref: `edge:${edge.from}#${edge.relation}->${edge.to}`, kind: "edge" as const, origin: edge.origin, evidenceStatus: edge.evidenceStatus } : null;
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null)),
  ].sort((left, right) => left.ref.localeCompare(right.ref));
  return {
    schemaVersion: "1.0",
    model: graph.model,
    question: query,
    status: "pass",
    classification: matches.length > 0 ? "retrieved" : "not-supported",
    retrieval: { provider: "hash", dimensions, limit, hops },
    matches,
    evidence,
    errors: [],
  };
}

export function renderSemanticGraphQueryMarkdown(report: SemanticGraphQuery): string {
  const lines = [
    "# DSpec semantic graph query",
    "",
    `- question: ${report.question}`,
    `- classification: \`${report.classification}\``,
    `- retrieval: \`${report.retrieval.provider}\` (${report.retrieval.dimensions} dimensions)`,
    "",
    "## Matches",
    "",
  ];
  if (report.matches.length === 0) lines.push("- No source-backed declaration matched this query.");
  for (const match of report.matches) {
    lines.push(`### ${match.label}`, "", `- id: \`${match.stableId}\``, `- kind: \`${match.kind}\``, `- evidence: \`${match.origin}/${match.evidenceStatus}\``, `- score: \`${match.score}\``);
    for (const relation of match.relations) lines.push(`- ${relation.direction}: \`${relation.relation}\` → \`${relation.stableId}\` (${relation.label})`);
    lines.push("");
  }
  lines.push("## Evidence", "");
  if (report.evidence.length === 0) lines.push("- none");
  for (const entry of report.evidence) lines.push(`- \`${entry.ref}\` (${entry.origin}/${entry.evidenceStatus})`);
  lines.push("", "The result is retrieval over declarations and imported evidence; it is not a proof beyond the stated evidence status.", "");
  return lines.join("\n");
}

/**
 * Build files accepted by mizchi/meandb's graph CLI. Relation labels are
 * reified as intermediate nodes so meandb can query them without sidecars.
 * `notes.csv` is deliberately not fabricated: callers must embed the emitted
 * documents with their chosen model and keep the supplied u64 ids.
 */
export function graphdbBundle(graph: SemanticGraph): GraphdbBundle {
  const relationNodes = graphdbRelationNodes(graph);
  const projectionNodes = [...graph.nodes, ...relationNodes.map((relation) => relation.node)];
  const ids = new Map<string, string>();
  const usedIds = new Map<string, string>();
  for (const node of projectionNodes) {
    const id = graphdbId(node.id);
    const collision = usedIds.get(id);
    if (collision && collision !== node.id) throw new Error(`GraphDB id collision: ${collision} and ${node.id}`);
    ids.set(node.id, id);
    usedIds.set(id, node.id);
  }
  const relationIds = new Map(relationNodes.map((relation) => [relation.edge, relation.node.id]));
  const graphdbEdges = [...new Set(graph.edges.flatMap((edge) => {
    const relationId = relationIds.get(edge);
    const from = ids.get(edge.from);
    const to = ids.get(edge.to);
    const relation = relationId ? ids.get(relationId) : undefined;
    if (!relation || !from || !to) throw new Error("GraphDB relation projection lost a node id");
    return [
      from + "," + relation,
      relation + "," + to,
    ];
  }))]
    .sort((left, right) => left.localeCompare(right));
  const idMap = {
    schemaVersion: "1.0",
    backend: "mizchi/meandb",
    nodes: projectionNodes.map((node) => ({ stableId: node.id, graphdbId: ids.get(node.id) })),
  };
  const documents = [
    ...graphdbDocuments(graph, ids),
    ...relationNodes.map((relation) => graphdbRelationDocument(relation, graph, ids)),
  ].map((document) => JSON.stringify(document));
  const relationById = new Map(relationNodes.map((relation) => [relation.node.id, relation]));
  const meta = projectionNodes.map((node) => [
    ids.get(node.id),
    node.label.replaceAll("\t", " ").replaceAll("\n", " "),
    (relationById.get(node.id)
      ? graphdbRelationTags(relationById.get(node.id)!.edge)
      : graphdbTags(node)).join(","),
  ].join("\t"));
  const manifest = {
    schemaVersion: "1.0",
    backend: "mizchi/meandb",
    sourceOfTruth: "semantic-graph.json",
    meandb: {
      embeddings: "notes.csv is generated by embedding documents.jsonl with a caller-selected model; it is not fabricated by dspec.",
      links: "links.csv reifies every declared edge as source -> relation -> target.",
      metadata: "meta.tsv maps meandb u64 ids to labels and tags.",
      build: "meandb build-graph notes.csv specification.graphdb --metric cosine --links links.csv --meta meta.tsv",
    },
    preservation: {
      labelledRelations: "meandb relation nodes plus semantic-graph.json and semantic-graph.ttl",
      stableIdMapping: "id-map.json",
    },
  };
  const readme = [
    "# dspec meandb import bundle",
    "",
    "This directory is derived from a Pkl source model. `semantic-graph.json` and `semantic-graph.ttl` preserve stable IDs and relation labels.",
    "meandb receives reified relation nodes: every declared edge becomes source -> relation -> target. Relation nodes are tagged with their exact relation label.",
    "",
    "1. Embed each `documents.jsonl` record's `text` with your selected embedding model.",
    "2. Write `notes.csv` as `graphdbId,v0,v1,...`, keeping `id-map.json` unchanged.",
    "3. Build the search graph:",
    "",
    "```sh",
    "meandb build-graph notes.csv specification.graphdb --metric cosine --links links.csv --meta meta.tsv",
    "```",
    "",
    "The resulting `.graphdb` is a search/index projection, not the specification master.",
    "",
  ].join("\n");
  return {
    schemaVersion: "1.0",
    files: {
      "semantic-graph.json": `${JSON.stringify(graph, null, 2)}\n`,
      "semantic-graph.ttl": renderSemanticGraphTurtle(graph),
      "links.csv": `# src_id,dst_id\n${graphdbEdges.join("\n")}${graphdbEdges.length > 0 ? "\n" : ""}`,
      "meta.tsv": `# id\ttitle\ttags\n${meta.join("\n")}${meta.length > 0 ? "\n" : ""}`,
      "documents.jsonl": `${documents.join("\n")}\n`,
      "id-map.json": `${JSON.stringify(idMap, null, 2)}\n`,
      "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`,
      "README.md": readme,
    },
  };
}
