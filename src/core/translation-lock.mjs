import { createHash } from "node:crypto";

export const TRANSLATION_LOCK_SCHEMA_VERSION = "1.0";

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

function byId(left, right) {
  return String(left.id).localeCompare(String(right.id));
}

function isLocalizedText(value) {
  return Boolean(value)
    && typeof value === "object"
    && typeof value.default === "string"
    && value.labels
    && typeof value.labels === "object"
    && !Array.isArray(value.labels);
}

function collectNestedLocalizedTexts(value, path, entries, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (isLocalizedText(value)) {
    entries.push({ key: path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      const selector = child && typeof child === "object" && typeof child.id === "string"
        ? child.id
        : index;
      collectNestedLocalizedTexts(child, `${path}[${selector}]`, entries, seen);
    });
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    collectNestedLocalizedTexts(child, `${path}.${key}`, entries, seen);
  }
}

function collectLocalizedTexts(model) {
  const entries = [];
  const add = (key, text) => {
    if (isLocalizedText(text)) entries.push({ key, text });
  };

  add("model.name", model.name);
  for (const term of [...list(model.vocabulary)].sort(byId)) {
    add(`term:${term.id}.text`, term.text);
  }
  for (const rule of [...list(model.rules)].sort(byId)) {
    add(`rule:${rule.id}.text`, rule.text);
    for (const field of ["when", "must", "mustNot"]) {
      list(rule[field]).forEach((clause, index) => add(`rule:${rule.id}.${field}[${index}].text`, clause.text));
    }
  }
  for (const decision of [...list(model.decisions)].sort(byId)) {
    add(`decision:${decision.id}.summary`, decision.summary);
  }

  // Pattern catalogs are intentionally open-ended. Preserve any localized
  // text beneath them without inventing schema-specific translation rules.
  collectNestedLocalizedTexts(model.patterns, "model.patterns", entries);
  collectNestedLocalizedTexts(model.conformance, "model.conformance", entries);

  return entries.sort((left, right) => left.key.localeCompare(right.key));
}

function translationLocales(model, errors) {
  const primaryLocale = model?.primaryLocale ?? null;
  if (!primaryLocale) errors.push("translation primary locale is missing");
  const declared = [...new Set(list(model?.locales).map(String))].sort();
  if (primaryLocale && !declared.includes(primaryLocale)) {
    errors.push(`translation primary locale is not declared: ${primaryLocale}`);
  }
  const required = [...new Set(list(model?.i18n?.requiredLocales).map(String))].sort();
  for (const locale of required) {
    if (!declared.includes(locale)) errors.push(`translation required locale is not declared: ${locale}`);
  }
  return {
    primaryLocale,
    targetLocales: (required.length > 0 ? required : declared).filter((locale) => locale !== primaryLocale),
  };
}

function translationEntries(model, primaryLocale, targetLocales, errors) {
  const entries = [];
  for (const { key, text } of collectLocalizedTexts(model)) {
    const source = text.labels?.[primaryLocale] ?? text.default;
    for (const locale of targetLocales) {
      if (!Object.hasOwn(text.labels ?? {}, locale)) {
        errors.push(`translation target is missing: ${key}#${locale}`);
        continue;
      }
      entries.push({
        key: `${key}#${locale}`,
        sourceHash: digest(source),
        translationHash: digest(text.labels[locale]),
      });
    }
  }
  return entries.sort((left, right) => left.key.localeCompare(right.key));
}

function glossary(model) {
  return list(model?.i18n?.glossary).map((entry) => ({
    term: entry.term,
    labels: entry.labels ?? {},
  })).sort((left, right) => String(left.term).localeCompare(String(right.term)));
}

/**
 * Materialize explicit locale bindings. The source language is the model's
 * primaryLocale; the targets are requiredLocales or declared non-primary
 * locales. This checks freshness, not semantic equivalence between languages.
 */
export function translationSnapshot(document) {
  const errors = [];
  const model = document?.model;
  if (!model?.id) errors.push("translation model id is missing");
  const { primaryLocale, targetLocales } = translationLocales(model, errors);
  const entries = model
    ? translationEntries(model, primaryLocale, targetLocales, errors)
    : [];
  return {
    translationSchemaVersion: TRANSLATION_LOCK_SCHEMA_VERSION,
    status: errors.length === 0 ? "pass" : "fail",
    model: {
      id: model?.id ?? null,
      version: model?.version ?? null,
      primaryLocale,
      targetLocales,
    },
    targetLocales,
    entries,
    terminologyHash: digest(stableJson(glossary(model))),
    errors,
  };
}

export function createTranslationLock(snapshot) {
  if (snapshot.status !== "pass") {
    throw new Error(`cannot reconcile invalid translation snapshot: ${snapshot.errors.join("; ")}`);
  }
  return {
    translationLockSchemaVersion: TRANSLATION_LOCK_SCHEMA_VERSION,
    model: snapshot.model,
    entries: snapshot.entries,
    terminologyHash: snapshot.terminologyHash,
  };
}

function entriesByKey(entries) {
  return new Map(list(entries).map((entry) => [entry.key, entry]));
}

/**
 * Compare reviewed translation bindings with their current source and target
 * text. A passing result means the reviewed bindings are current; it is not a
 * machine proof that the two natural-language texts have equal meaning.
 */
export function translationCheck(document, lock) {
  const snapshot = translationSnapshot(document);
  const errors = [...snapshot.errors];
  if (lock?.translationLockSchemaVersion !== TRANSLATION_LOCK_SCHEMA_VERSION) {
    errors.push(`unsupported translation lock schema version: ${lock?.translationLockSchemaVersion ?? "missing"}`);
  }
  if (lock?.model?.id && lock.model.id !== snapshot.model.id) {
    errors.push(`translation lock model id mismatch: ${lock.model.id} != ${snapshot.model.id}`);
  }

  const drift = [];
  const previous = entriesByKey(lock?.entries);
  const current = entriesByKey(snapshot.entries);
  for (const [key, entry] of current) {
    const prior = previous.get(key);
    if (!prior) {
      drift.push({ kind: "translation-linked", key });
      continue;
    }
    if (prior.sourceHash !== entry.sourceHash) drift.push({ kind: "source-content", key });
    if (prior.translationHash !== entry.translationHash) drift.push({ kind: "translation-content", key });
  }
  for (const key of previous.keys()) {
    if (!current.has(key)) drift.push({ kind: "translation-unlinked", key });
  }
  if (lock?.terminologyHash !== snapshot.terminologyHash) {
    drift.push({ kind: "terminology-content", key: "i18n.glossary" });
  }

  const order = new Map([
    ["source-content", 0],
    ["translation-content", 1],
    ["translation-linked", 2],
    ["translation-unlinked", 3],
    ["terminology-content", 4],
  ]);
  const orderedDrift = drift.sort((left, right) => (
    (order.get(left.kind) ?? 99) - (order.get(right.kind) ?? 99)
      || left.key.localeCompare(right.key)
  ));
  return {
    translationSchemaVersion: TRANSLATION_LOCK_SCHEMA_VERSION,
    status: errors.length === 0 && orderedDrift.length === 0 ? "pass" : "fail",
    model: snapshot.model,
    drift: orderedDrift,
    entries: snapshot.entries,
    errors,
  };
}
