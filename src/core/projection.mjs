import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";

export const PROJECTION_PROVENANCE_SCHEMA_VERSION = "1.0";
export const MARKDOWN_PROJECTION_EMITTER = Object.freeze({
  name: "dspec/markdown",
  version: "1.0",
});

function list(value) {
  return Array.isArray(value) ? value : [];
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

export function projectionStableJson(value) {
  return `${JSON.stringify(stableObject(value), null, 2)}\n`;
}

export function projectionDigest(value) {
  const content = typeof value === "string" ? value : projectionStableJson(value);
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function isSafeProjectionPath(path) {
  return typeof path === "string"
    && path.length > 0
    && !isAbsolute(path)
    && !path.split(/[\\/]/).includes("..");
}

export function projectionOutputPath(projection, locale) {
  return projection.output.replace("{locale}", locale);
}

function projectionPathErrors(projection, field, path, extension) {
  const errors = [];
  if (!isSafeProjectionPath(path)) {
    errors.push(`projection ${field} must stay under the generation root: ${projection.id} -> ${path}`);
    return errors;
  }
  if (path.includes("{") || path.includes("}")) {
    errors.push(`projection ${field} has unsupported placeholder: ${projection.id} -> ${path}`);
  }
  if (!path.endsWith(extension)) {
    errors.push(`projection ${field} must end with ${extension}: ${projection.id} -> ${path}`);
  }
  return errors;
}

export function validateProjectionContracts(model) {
  const errors = [];
  const declared = list(model?.projections);
  const ids = new Set();
  const outputs = new Map();

  for (const projection of declared) {
    if (ids.has(projection.id)) errors.push(`duplicate projection id: ${projection.id}`);
    ids.add(projection.id);

    const output = typeof projection.output === "string" ? projection.output : "";
    const localePlaceholders = [...output.matchAll(/\{locale\}/g)].length;
    if (localePlaceholders !== 1) {
      errors.push(`projection output must contain exactly one {locale}: ${projection.id}`);
    } else {
      const remaining = output.replace("{locale}", "").match(/\{[^}]+\}/g) ?? [];
      if (remaining.length > 0) {
        errors.push(`projection output has unsupported placeholder: ${projection.id} -> ${remaining.join(", ")}`);
      }
    }
    if (!isSafeProjectionPath(output)) {
      errors.push(`projection output must stay under the generation root: ${projection.id} -> ${projection.output}`);
    }
    if (projection.kind === "markdown" && !output.endsWith(".md")) {
      errors.push(`markdown projection output must end with .md: ${projection.id} -> ${projection.output}`);
    }

    for (const locale of localePlaceholders === 1 ? list(model?.locales) : []) {
      const path = projectionOutputPath(projection, locale);
      const owner = outputs.get(path);
      if (owner) errors.push(`projection output collision: ${projection.id} -> ${path} (already owned by ${owner})`);
      else outputs.set(path, projection.id);
    }

    errors.push(...projectionPathErrors(projection, "provenance", projection.provenance, ".json"));
    const provenanceOwner = outputs.get(projection.provenance);
    if (provenanceOwner) {
      errors.push(`projection output collision: ${projection.id} -> ${projection.provenance} (already owned by ${provenanceOwner})`);
    } else {
      outputs.set(projection.provenance, projection.id);
    }
  }

  return errors;
}

export function createProjectionSnapshot(model, { renderMarkdown }) {
  const errors = validateProjectionContracts(model);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  if (typeof renderMarkdown !== "function") throw new TypeError("renderMarkdown must be a function");

  const modelRecord = {
    id: model.id,
    version: model.version,
    digest: projectionDigest(model),
  };
  const projections = list(model.projections)
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((projection) => ({
      id: projection.id,
      kind: projection.kind,
      source: projection.source,
      matrix: projection.matrix,
      output: projection.output,
      provenancePath: projection.provenance,
      freshness: projection.freshness,
      artifacts: list(model.locales)
        .slice()
        .sort()
        .map((locale) => {
          const content = renderMarkdown(structuredClone(model), locale);
          return {
            bytes: Buffer.byteLength(content, "utf8"),
            content,
            digest: projectionDigest(content),
            kind: "artifact",
            locale,
            path: projectionOutputPath(projection, locale),
            projectionId: projection.id,
          };
        }),
    }));

  return {
    emitter: { ...MARKDOWN_PROJECTION_EMITTER },
    model: modelRecord,
    projections,
  };
}

function validGeneratedAt(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value);
}

export function projectionProvenanceDocument(snapshot, projection, generatedAt) {
  if (!validGeneratedAt(generatedAt)) throw new TypeError(`invalid projection generatedAt: ${generatedAt}`);
  return {
    schemaVersion: PROJECTION_PROVENANCE_SCHEMA_VERSION,
    generatedAt,
    emitter: snapshot.emitter,
    model: snapshot.model,
    projection: {
      id: projection.id,
      kind: projection.kind,
      source: projection.source,
      matrix: projection.matrix,
      output: projection.output,
      provenance: projection.provenancePath,
      freshness: projection.freshness,
    },
    artifacts: projection.artifacts.map(({ bytes, digest, locale, path }) => ({ bytes, digest, locale, path })),
  };
}

function actionRecord({ action, afterContent, beforeContent, kind, locale = null, path, projectionId, reason }) {
  return {
    action,
    afterBytes: afterContent === null ? null : Buffer.byteLength(afterContent, "utf8"),
    afterDigest: afterContent === null ? null : projectionDigest(afterContent),
    beforeBytes: beforeContent === null ? null : Buffer.byteLength(beforeContent, "utf8"),
    beforeDigest: beforeContent === null ? null : projectionDigest(beforeContent),
    desiredContent: afterContent,
    kind,
    locale,
    path,
    projectionId,
    reason,
  };
}

function provenanceAction(snapshot, projection, observed, generatedAt) {
  let preservedGeneratedAt = null;
  if (observed) {
    try {
      const document = JSON.parse(observed.content);
      if (validGeneratedAt(document.generatedAt)) preservedGeneratedAt = document.generatedAt;
    } catch {
      preservedGeneratedAt = null;
    }
  }
  const preservedContent = preservedGeneratedAt
    ? projectionStableJson(projectionProvenanceDocument(snapshot, projection, preservedGeneratedAt))
    : null;
  if (observed && preservedContent === observed.content) {
    return actionRecord({
      action: "unchanged",
      afterContent: preservedContent,
      beforeContent: observed.content,
      kind: "provenance",
      path: projection.provenancePath,
      projectionId: projection.id,
      reason: "current",
    });
  }

  const desiredContent = projectionStableJson(projectionProvenanceDocument(snapshot, projection, generatedAt));
  return actionRecord({
    action: observed ? "update" : "create",
    afterContent: desiredContent,
    beforeContent: observed?.content ?? null,
    kind: "provenance",
    path: projection.provenancePath,
    projectionId: projection.id,
    reason: observed ? "provenance-drift" : "missing-provenance",
  });
}

export function planProjectionChanges(snapshot, observations = [], { generatedAt = new Date().toISOString() } = {}) {
  if (!validGeneratedAt(generatedAt)) throw new TypeError(`invalid projection generatedAt: ${generatedAt}`);
  const observedByPath = new Map();
  for (const observed of list(observations)) {
    if (observedByPath.has(observed.path)) throw new Error(`duplicate observed projection path: ${observed.path}`);
    observedByPath.set(observed.path, observed);
  }

  const actions = [];
  const expectedPaths = new Set();
  for (const projection of snapshot.projections) {
    for (const artifact of projection.artifacts) {
      expectedPaths.add(artifact.path);
      const observed = observedByPath.get(artifact.path);
      actions.push(actionRecord({
        action: !observed ? "create" : observed.content === artifact.content ? "unchanged" : "update",
        afterContent: artifact.content,
        beforeContent: observed?.content ?? null,
        kind: "artifact",
        locale: artifact.locale,
        path: artifact.path,
        projectionId: projection.id,
        reason: !observed ? "missing" : observed.content === artifact.content ? "current" : "content-drift",
      }));
    }
    expectedPaths.add(projection.provenancePath);
    actions.push(provenanceAction(snapshot, projection, observedByPath.get(projection.provenancePath), generatedAt));
  }

  for (const observed of observedByPath.values()) {
    if (!observed.unexpected || expectedPaths.has(observed.path)) continue;
    actions.push(actionRecord({
      action: "remove",
      afterContent: null,
      beforeContent: observed.content,
      kind: observed.kind ?? "artifact",
      locale: observed.locale ?? null,
      path: observed.path,
      projectionId: observed.projectionId,
      reason: "unexpected",
    }));
  }

  actions.sort((left, right) => left.path.localeCompare(right.path) || left.action.localeCompare(right.action));
  const counts = Object.fromEntries(["create", "update", "remove", "unchanged"].map((action) => [
    action,
    actions.filter((entry) => entry.action === action).length,
  ]));
  return {
    ...snapshot,
    actions,
    summary: {
      actions: actions.length,
      changed: counts.create + counts.update + counts.remove,
      ...counts,
    },
  };
}

export function projectionPlanReport(plan) {
  const actions = plan.actions.map(({ desiredContent: _desiredContent, ...action }) => action);
  return {
    model: plan.model,
    emitter: plan.emitter,
    actions,
    projections: plan.projections.map((projection) => ({
      id: projection.id,
      kind: projection.kind,
      source: projection.source,
      matrix: projection.matrix,
      output: projection.output,
      provenance: projection.provenancePath,
      freshness: projection.freshness,
      artifacts: projection.artifacts.map(({ bytes, digest, locale, path }) => ({ bytes, digest, locale, path })),
    })),
    provenance: plan.actions
      .filter((action) => action.kind === "provenance" && action.desiredContent)
      .map((action) => {
        const document = JSON.parse(action.desiredContent);
        return {
          projectionId: action.projectionId,
          path: action.path,
          schemaVersion: document.schemaVersion,
          generatedAt: document.generatedAt,
          modelDigest: document.model.digest,
          emitter: document.emitter,
        };
      }),
    summary: {
      projections: plan.projections.length,
      artifacts: plan.projections.reduce((count, projection) => count + projection.artifacts.length, 0),
      changed: plan.summary.changed,
      actions: {
        create: plan.summary.create,
        remove: plan.summary.remove,
        unchanged: plan.summary.unchanged,
        update: plan.summary.update,
      },
    },
  };
}

export function projectionGenerateArgv(file, { dryRun = false, generatedAt = null, root = null } = {}) {
  const argv = ["dspec", "generate"];
  if (dryRun) argv.push("--dry-run");
  if (generatedAt) argv.push("--generated-at", generatedAt);
  if (root) argv.push("--root", root);
  argv.push(file);
  return argv;
}
