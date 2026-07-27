import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const TRACE_LOCK_SCHEMA_VERSION = "1.0";

function list(value) {
  return Array.isArray(value) ? value : [];
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function stableJson(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitRef(ref) {
  const index = String(ref ?? "").indexOf("#");
  return index < 0
    ? { path: String(ref ?? ""), symbol: null }
    : { path: String(ref).slice(0, index), symbol: String(ref).slice(index + 1) };
}

function ruleContract(rule) {
  return {
    id: rule.id,
    kind: rule.kind,
    text: rule.text ?? null,
    terms: list(rule.terms),
    when: list(rule.when),
    must: list(rule.must),
    mustNot: list(rule.mustNot),
    exceptions: list(rule.exceptions),
    priority: rule.priority ?? 100,
    deprecated: Boolean(rule.deprecated),
  };
}

function lineBounds(source, index) {
  const start = source.lastIndexOf("\n", index - 1) + 1;
  const endIndex = source.indexOf("\n", index);
  return { start, end: endIndex < 0 ? source.length : endIndex + 1 };
}

function balancedBlockEnd(source, start) {
  const open = source.indexOf("{", start);
  if (open < 0) return null;
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return null;
}

function symbolText(source, symbol) {
  if (!symbol) return null;
  const escaped = escapeRegex(symbol);
  const declaration = new RegExp(`^.*\\b(?:function|class|const|let|var|theorem|lemma|def|abbrev|inductive|structure)\\s+${escaped}\\b.*$`, "m").exec(source);
  const quoted = new RegExp("[\"'`]" + escaped + "[\"'`]").exec(source);
  const raw = new RegExp(`\\b${escaped}\\b`).exec(source);
  const match = declaration ?? quoted ?? raw;
  if (!match || match.index === undefined) return null;
  const bounds = lineBounds(source, match.index);
  const blockEnd = balancedBlockEnd(source, bounds.start);
  return source.slice(bounds.start, blockEnd ?? bounds.end);
}

function hashReference({ owner, kind, path, symbol, virtual }, projectRoot, errors) {
  const key = `${kind}:${path}${symbol ? `#${symbol}` : ""}`;
  if (virtual) {
    return { key, contentHash: digest(stableJson(virtual)), hashScope: "declaration" };
  }
  if (!path || path.startsWith("generated:")) {
    errors.push(`trace source is missing: ${owner} -> ${path || "<missing>"}${symbol ? `#${symbol}` : ""}`);
    return null;
  }
  const absolutePath = resolve(projectRoot, path);
  if (!existsSync(absolutePath)) {
    errors.push(`trace source is missing: ${owner} -> ${path}${symbol ? `#${symbol}` : ""}`);
    return null;
  }
  const source = readFileSync(absolutePath, "utf8");
  const selected = symbolText(source, symbol);
  return {
    key,
    contentHash: digest(selected ?? source),
    hashScope: selected ? "symbol-text" : "file",
  };
}

function sortEntries(entries) {
  return entries.filter(Boolean).sort((left, right) => left.key.localeCompare(right.key));
}

function coverageStatus(implementations, tests, checks) {
  if (implementations > 0 && (tests > 0 || checks > 0)) return "verified";
  if (implementations > 0) return "impl-only";
  if (tests > 0 || checks > 0) return "test-only";
  return "uncovered";
}

function traceRule(rule, projectRoot, errors) {
  const implementations = [];
  const tests = [];
  for (const reference of list(rule.implementedBy)) {
    const category = reference.kind === "test" ? "test" : "implementation";
    const entry = hashReference({
      owner: rule.id,
      kind: reference.kind,
      path: reference.path,
      symbol: reference.symbol ?? null,
    }, projectRoot, errors);
    if (category === "test") tests.push(entry);
    else implementations.push(entry);
  }
  const checks = list(rule.checks).map((target) => {
    const { path, symbol } = splitRef(target.ref);
    const virtual = path.startsWith("generated:")
      ? { backend: target.backend, ref: target.ref, covers: list(target.covers), mode: target.mode ?? "linked" }
      : null;
    return hashReference({
      owner: rule.id,
      kind: target.backend,
      path,
      symbol,
      virtual,
    }, projectRoot, errors);
  });
  return {
    id: rule.id,
    contentHash: digest(stableJson(ruleContract(rule))),
    implementations: sortEntries(implementations),
    tests: sortEntries(tests),
    checks: sortEntries(checks),
  };
}

/**
 * Create the deterministic trace graph which corresponds to the current Pkl
 * specification and its explicitly declared implementation/test/check edges.
 * It does not infer a semantic proof from matching hashes.
 */
export function traceSnapshot(document, { projectRoot = process.cwd() } = {}) {
  const errors = [];
  const model = document?.model;
  if (!model?.id) errors.push("trace model id is missing");
  const ids = new Set();
  const rules = list(model?.rules).map((rule) => {
    if (!rule?.id) {
      errors.push("trace rule id is missing");
    } else if (ids.has(rule.id)) {
      errors.push(`duplicate trace rule id: ${rule.id}`);
    }
    ids.add(rule?.id);
    return traceRule(rule ?? {}, projectRoot, errors);
  }).sort((left, right) => left.id.localeCompare(right.id));
  const coverage = rules.map((rule) => ({
    id: rule.id,
    status: coverageStatus(rule.implementations.length, rule.tests.length, rule.checks.length),
    implementations: rule.implementations.length,
    tests: rule.tests.length,
    checks: rule.checks.length,
  }));
  return {
    traceSchemaVersion: TRACE_LOCK_SCHEMA_VERSION,
    status: errors.length === 0 ? "pass" : "fail",
    model: { id: model?.id ?? null, version: model?.version ?? null },
    rules,
    coverage,
    errors,
  };
}

/**
 * Freeze a reviewed trace snapshot. There is deliberately no timestamp: the
 * lock is byte-stable for an unchanged reviewed state.
 */
export function createTraceLock(snapshot) {
  if (snapshot.status !== "pass") {
    throw new Error(`cannot reconcile invalid trace snapshot: ${snapshot.errors.join("; ")}`);
  }
  return {
    traceLockSchemaVersion: TRACE_LOCK_SCHEMA_VERSION,
    model: snapshot.model,
    rules: snapshot.rules,
  };
}

function entriesByKey(entries) {
  return new Map(list(entries).map((entry) => [entry.key, entry]));
}

function compareReferences(drift, ruleId, category, previous, current) {
  const previousByKey = entriesByKey(previous);
  const currentByKey = entriesByKey(current);
  for (const [key, entry] of currentByKey) {
    const prior = previousByKey.get(key);
    if (!prior) {
      drift.push({ kind: "reference-linked", rule: ruleId, category, key });
    } else if (prior.contentHash !== entry.contentHash || prior.hashScope !== entry.hashScope) {
      drift.push({ kind: "reference-content", rule: ruleId, category, key });
    }
  }
  for (const key of previousByKey.keys()) {
    if (!currentByKey.has(key)) drift.push({ kind: "reference-unlinked", rule: ruleId, category, key });
  }
}

/**
 * Compare a declared trace lock with the current snapshot. `drift` means a
 * reviewed spec/evidence relation changed; `coverage` remains a separate axis.
 */
export function traceCheck(document, lock, { projectRoot = process.cwd() } = {}) {
  const snapshot = traceSnapshot(document, { projectRoot });
  const errors = [...snapshot.errors];
  if (lock?.traceLockSchemaVersion !== TRACE_LOCK_SCHEMA_VERSION) {
    errors.push(`unsupported trace lock schema version: ${lock?.traceLockSchemaVersion ?? "missing"}`);
  }
  const drift = [];
  const previousById = new Map(list(lock?.rules).map((rule) => [rule.id, rule]));
  const currentById = new Map(snapshot.rules.map((rule) => [rule.id, rule]));
  for (const [id, rule] of currentById) {
    const previous = previousById.get(id);
    if (!previous) {
      drift.push({ kind: "rule-linked", rule: id, key: id });
      continue;
    }
    if (previous.contentHash !== rule.contentHash) drift.push({ kind: "rule-content", rule: id, key: id });
    compareReferences(drift, id, "implementation", previous.implementations, rule.implementations);
    compareReferences(drift, id, "test", previous.tests, rule.tests);
    compareReferences(drift, id, "check", previous.checks, rule.checks);
  }
  for (const id of previousById.keys()) {
    if (!currentById.has(id)) drift.push({ kind: "rule-unlinked", rule: id, key: id });
  }
  const driftOrder = new Map([
    ["rule-content", 0],
    ["rule-linked", 1],
    ["rule-unlinked", 2],
    ["reference-content", 3],
    ["reference-linked", 4],
    ["reference-unlinked", 5],
  ]);
  const orderedDrift = drift.sort((left, right) => (
    left.rule.localeCompare(right.rule)
      || (driftOrder.get(left.kind) ?? 99) - (driftOrder.get(right.kind) ?? 99)
      || left.key.localeCompare(right.key)
  ));
  return {
    traceSchemaVersion: TRACE_LOCK_SCHEMA_VERSION,
    model: snapshot.model,
    status: errors.length === 0 && orderedDrift.length === 0 ? "pass" : "fail",
    drift: orderedDrift,
    coverage: snapshot.coverage,
    errors,
  };
}
