#!/usr/bin/env node

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import { verifyBehaviorImplementation, verifyBehaviorModel } from "../src/core/behavior.mjs";

const [modelPath] = process.argv.slice(2);

if (!modelPath) {
  process.stderr.write("usage: node scripts/verify-behavior.mjs <model.pkl>\n");
  process.exitCode = 64;
} else {
  const document = evaluatePklJson(modelPath);
  const reference = verifyBehaviorModel(document);
  const grounding = await verifyBehaviorImplementation(document);
  const errors = [...reference.errors, ...grounding.errors];
  const report = {
    schemaVersion: "1.0",
    behavior: document.behavior?.id ?? null,
    status: reference.status === "pass" && grounding.status === "pass" ? "pass" : "fail",
    reference,
    grounding,
    errors,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === "pass" ? 0 : 1;
}
