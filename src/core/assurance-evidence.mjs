import { createHash } from "node:crypto";

export const ASSURANCE_EVIDENCE_SCHEMA_VERSION = "1.0";
export const CLAUSE_EVIDENCE_BACKENDS = ["alloy", "lean", "quickcheck", "tla"];
export const CLAUSE_AST_OPERATORS = ["and", "atom", "eq", "exists", "forall", "implies", "neq", "not", "or"];

export const CLAUSE_BACKEND_OPERATOR_SUPPORT = Object.freeze({
  alloy: Object.freeze(Object.fromEntries(CLAUSE_AST_OPERATORS.map((operator) => [operator, "unmapped"]))),
  lean: Object.freeze({
    ...Object.fromEntries(CLAUSE_AST_OPERATORS.map((operator) => [operator, "structural"])),
    eq: "semantic",
    implies: "semantic",
    neq: "semantic",
    not: "semantic",
  }),
  quickcheck: Object.freeze(Object.fromEntries(CLAUSE_AST_OPERATORS.map((operator) => [operator, "structural"]))),
  tla: Object.freeze(Object.fromEntries(CLAUSE_AST_OPERATORS.map((operator) => [operator, "textual"]))),
});

function list(value) {
  return Array.isArray(value) ? value : [];
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

export function assuranceDigest(value) {
  const content = typeof value === "string" ? value : `${JSON.stringify(stableObject(value), null, 2)}\n`;
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function clauseBackendSupport(backend, operators = CLAUSE_AST_OPERATORS) {
  const rank = { unmapped: 0, textual: 1, structural: 2, semantic: 3 };
  const matrix = CLAUSE_BACKEND_OPERATOR_SUPPORT[backend];
  if (!matrix) return "unmapped";
  return list(operators).reduce((support, operator) => {
    const candidate = matrix[operator] ?? "unmapped";
    return rank[candidate] < rank[support] ? candidate : support;
  }, "semantic");
}

export function expressionOperators(ast) {
  if (!ast) return [];
  const operators = new Set([ast.op]);
  for (const child of list(ast.children)) {
    for (const operator of expressionOperators(child)) operators.add(operator);
  }
  return [...operators].sort();
}

function clauseRecords(model) {
  const records = [];
  for (const [ruleIndex, rule] of list(model.rules).entries()) {
    for (const field of ["when", "must", "mustNot"]) {
      for (const [index, clause] of list(rule[field]).entries()) {
        if (!clause.ast) continue;
        records.push({
          ruleId: rule.id,
          selector: `${field}[${index}]`,
          path: `model.rules[${ruleIndex}].${field}[${index}]`,
          ast: clause.ast,
        });
      }
    }
  }
  return records.sort((left, right) => {
    const rule = left.ruleId.localeCompare(right.ruleId);
    return rule === 0 ? left.selector.localeCompare(right.selector) : rule;
  });
}

export function assuranceClauseBindings(model, sourceMap) {
  return clauseRecords(model).map((record) => {
    const operators = expressionOperators(record.ast);
    return {
      ruleId: record.ruleId,
      selector: record.selector,
      astDigest: assuranceDigest(record.ast),
      operators,
      backends: CLAUSE_EVIDENCE_BACKENDS.map((backend) => ({
        backend,
        support: clauseBackendSupport(backend, operators),
        generatedSelectors: list(sourceMap?.artifacts?.[backend])
          .filter((entry) => entry?.source?.path === record.path)
          .map((entry) => entry.generated)
          .sort(),
      })),
    };
  });
}

export function assuranceEvidenceSnapshot(model, sourceMap, artifactSources) {
  return {
    model: {
      id: model.id,
      version: model.version,
      digest: assuranceDigest(model),
    },
    sourceMapDigest: assuranceDigest(sourceMap),
    artifactDigests: Object.fromEntries(
      Object.entries(artifactSources)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, source]) => [id, assuranceDigest(source)]),
    ),
    clauseBindings: assuranceClauseBindings(model, sourceMap),
  };
}

function sameValue(left, right) {
  return assuranceDigest(left) === assuranceDigest(right);
}

export function verifyAssuranceEvidenceManifest(manifest, expected, currentToolVersions = {}) {
  const errors = [];
  const warnings = [];
  if (!manifest || typeof manifest !== "object") {
    return { status: "fail", errors: ["invalid assurance evidence manifest"], warnings };
  }
  if (manifest.schemaVersion !== ASSURANCE_EVIDENCE_SCHEMA_VERSION) {
    errors.push(`unsupported assurance evidence schema version: ${manifest.schemaVersion ?? "missing"}`);
  }
  if (typeof manifest.executedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(manifest.executedAt)) {
    errors.push("invalid assurance evidence executedAt");
  }
  if (manifest.model?.id !== expected.model.id) {
    errors.push(`stale evidence model id: expected ${expected.model.id}, got ${manifest.model?.id ?? "missing"}`);
  }
  if (manifest.model?.version !== expected.model.version) {
    errors.push(`stale evidence model version: expected ${expected.model.version}, got ${manifest.model?.version ?? "missing"}`);
  }
  if (manifest.model?.digest !== expected.model.digest) {
    errors.push(`stale evidence model digest: expected ${expected.model.digest}, got ${manifest.model?.digest ?? "missing"}`);
  }
  if (manifest.sourceMapDigest !== expected.sourceMapDigest) {
    errors.push(`stale evidence source map digest: expected ${expected.sourceMapDigest}, got ${manifest.sourceMapDigest ?? "missing"}`);
  }

  const artifactEntries = list(manifest.artifacts);
  const validArtifacts = artifactEntries.filter((artifact, index) => {
    if (!artifact || typeof artifact !== "object" || typeof artifact.id !== "string" || artifact.id.length === 0) {
      errors.push(`invalid assurance evidence artifact at index ${index}`);
      return false;
    }
    return true;
  });
  const actualArtifacts = new Map(validArtifacts.map((artifact) => [artifact.id, artifact]));
  if (actualArtifacts.size !== validArtifacts.length) {
    errors.push("duplicate assurance evidence artifact id");
  }
  for (const [id, digest] of Object.entries(expected.artifactDigests)) {
    const artifact = actualArtifacts.get(id);
    if (!artifact) {
      errors.push(`missing assurance evidence artifact: ${id}`);
      continue;
    }
    if (artifact.digest !== digest) {
      errors.push(`stale evidence artifact digest: ${id}: expected ${digest}, got ${artifact.digest ?? "missing"}`);
    }
    const definition = expected.artifactDefinitions?.[id];
    if (definition) {
      for (const field of ["backend", "scope", "propertyIds", "theorem", "bounds"]) {
        if (!sameValue(artifact[field] ?? null, definition[field] ?? null)) {
          errors.push(`invalid assurance evidence artifact ${field}: ${id}`);
        }
      }
      if (artifact.tool?.name !== definition.tool) {
        errors.push(`invalid assurance evidence artifact tool: ${id}`);
      }
    }
    if (!new Set(["pass", "fail", "skip"]).has(artifact.result)) {
      errors.push(`invalid assurance evidence result: ${id} -> ${artifact.result ?? "missing"}`);
    }
    const currentVersion = currentToolVersions[artifact.tool?.name];
    if (currentVersion && artifact.tool?.version !== currentVersion) {
      errors.push(`stale evidence tool version: ${artifact.tool?.name ?? "missing"}: expected ${currentVersion}, got ${artifact.tool?.version ?? "missing"}`);
    } else if (artifact.tool?.version && !currentVersion) {
      warnings.push(`assurance evidence tool unavailable: ${artifact.tool.name}`);
    }
    if (definition && currentVersion && artifact.result !== definition.result) {
      errors.push(`invalid assurance evidence artifact result: ${id}: expected ${definition.result}, got ${artifact.result}`);
    }
  }
  for (const id of actualArtifacts.keys()) {
    if (!(id in expected.artifactDigests)) errors.push(`unexpected assurance evidence artifact: ${id}`);
  }
  if (!sameValue(manifest.clauseBindings, expected.clauseBindings)) {
    errors.push("stale assurance evidence clause bindings");
  }

  return {
    status: errors.length > 0 ? "fail" : "pass",
    errors,
    warnings,
  };
}
