#!/usr/bin/env node

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import {
  verifyAlloyBehaviorModel,
  verifyAlloyBehaviorScopeMatrix,
  verifyAlloyBehaviorWithAnalyzer,
} from "../src/core/alloy-behavior.mjs";

const args = process.argv.slice(2);
const requireAnalyzer = args.includes("--require-analyzer");
const scopeMatrixRequested = args.includes("--scope-matrix");
const values = args.filter((arg) => arg !== "--require-analyzer" && arg !== "--scope-matrix");
const [modelPath] = values;

if (!modelPath || values.length !== 1) {
  process.stderr.write("usage: node scripts/verify-alloy-behavior.mjs [--require-analyzer] [--scope-matrix] <model.pkl>\n");
  process.exitCode = 64;
} else {
  const document = evaluatePklJson(modelPath);
  const reference = verifyAlloyBehaviorModel(document);
  const analyzer = verifyAlloyBehaviorWithAnalyzer(document);
  const scopeMatrix = scopeMatrixRequested ? verifyAlloyBehaviorScopeMatrix(document) : null;
  const analyzerRequiredFailure = requireAnalyzer && analyzer.status !== "pass";
  const scopeMatrixFailure = scopeMatrixRequested && scopeMatrix.status !== "pass";
  const report = {
    schemaVersion: "1.0",
    alloyBehavior: document.alloyBehavior?.id ?? null,
    status: reference.status === "pass" && !analyzerRequiredFailure && analyzer.status !== "fail" && !scopeMatrixFailure ? "pass" : "fail",
    reference,
    analyzer,
    scopeMatrix,
    errors: [
      ...reference.errors,
      ...analyzer.errors,
      ...(analyzerRequiredFailure && analyzer.status === "skip" ? [`required Alloy analyzer skipped: ${analyzer.reason}`] : []),
      ...(scopeMatrix?.errors ?? []),
      ...(scopeMatrixRequested && scopeMatrix?.status === "skip" ? [`required Alloy scope matrix skipped: ${scopeMatrix.reason}`] : []),
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === "pass" ? 0 : 1;
}
