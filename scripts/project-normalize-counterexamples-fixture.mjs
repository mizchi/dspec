#!/usr/bin/env node

import { readFileSync } from "node:fs";

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

function stableJson(value) {
  return `${JSON.stringify(stableObject(value), null, 2)}\n`;
}

export function normalizeCounterexamplesFixtureProjection(report) {
  const stableBackends = new Set(["quickcheck", "lean"]);
  return {
    model: report.model,
    status: report.status,
    locale: report.locale,
    counterexamples: (report.counterexamples ?? []).filter((entry) => stableBackends.has(entry.backend)),
  };
}

if (process.argv[1] === import.meta.filename) {
  const report = JSON.parse(readFileSync(0, "utf8"));
  process.stdout.write(stableJson(normalizeCounterexamplesFixtureProjection(report)));
}
