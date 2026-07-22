#!/usr/bin/env node

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import {
  verifyFormalLinks,
  verifyFormalLinksWithTools,
} from "../src/core/formal-links.mjs";

const args = process.argv.slice(2);
const requireTools = args.includes("--require-tools");
const values = args.filter((arg) => arg !== "--require-tools");

if (values.length !== 1) {
  process.stderr.write("usage: node scripts/verify-formal-links.mjs [--require-tools] <model.pkl>\n");
  process.exitCode = 64;
} else {
  const [modelPath] = values;
  const document = evaluatePklJson(modelPath);
  const reference = verifyFormalLinks(document);
  const tools = verifyFormalLinksWithTools(document);
  const toolsRequiredFailure = requireTools && tools.status !== "pass";
  const report = {
    schemaVersion: "1.0",
    model: reference.model,
    status: reference.status === "pass" && tools.status !== "fail" && !toolsRequiredFailure ? "pass" : "fail",
    reference,
    tools,
    errors: [
      ...reference.errors,
      ...tools.errors,
      ...(toolsRequiredFailure && tools.status === "skip" ? ["required formal tools were not available"] : []),
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === "pass" ? 0 : 1;
}
