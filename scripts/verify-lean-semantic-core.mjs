#!/usr/bin/env node

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import { verifyLeanSemanticCore } from "../src/core/lean-semantic-core.mjs";

const [modelPath] = process.argv.slice(2);
if (!modelPath) {
  process.stderr.write("usage: node scripts/verify-lean-semantic-core.mjs <model.pkl>\n");
  process.exitCode = 64;
} else {
  const report = verifyLeanSemanticCore(evaluatePklJson(modelPath));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === "pass" ? 0 : 1;
}
