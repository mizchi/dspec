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

function optionalToolStatus(backend) {
  return backend?.status === "fail" ? "fail" : "available-or-skip";
}

export function verifyGeneratedFixtureProjection(report) {
  return {
    model: report.model,
    status: report.status,
    backends: {
      quickcheck: { status: report.backends.quickcheck.status },
      lean: { status: optionalToolStatus(report.backends.lean) },
      tlaSyntax: { status: report.backends.tlaSyntax.status },
      alloySyntax: { status: report.backends.alloySyntax.status },
      tlaSany: { status: optionalToolStatus(report.backends.tlaSany) },
      tlaTlc: { status: optionalToolStatus(report.backends.tlaTlc) },
      alloyAnalyzer: { status: optionalToolStatus(report.backends.alloyAnalyzer) },
    },
  };
}

if (process.argv[1] === import.meta.filename) {
  const report = JSON.parse(readFileSync(0, "utf8"));
  process.stdout.write(stableJson(verifyGeneratedFixtureProjection(report)));
}
