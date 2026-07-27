import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function usage() {
  return "usage: node scripts/evaluate-daily-drift-review.mjs --json <suite.json> <answers.json>\n";
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`failed to read ${label}: ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseArgs(args) {
  if (args.length !== 3 || args[0] !== "--json" || args[1].startsWith("-") || args[2].startsWith("-")) {
    throw new Error(usage());
  }
  return { answers: args[2], suite: args[1] };
}

function parseFindings(markdown) {
  if (typeof markdown !== "string") return { errors: ["review must be Markdown text"], findings: [] };
  const match = markdown.match(/## Machine Findings\s*```json\s*([\s\S]*?)\s*```/m);
  if (!match) return { errors: ["review has no Machine Findings JSON block"], findings: [] };
  try {
    const document = JSON.parse(match[1]);
    if (document.schemaVersion !== "1.0" || !Array.isArray(document.findings)) {
      return { errors: ["Machine Findings must use schemaVersion 1.0 and findings array"], findings: [] };
    }
    const errors = [];
    const findings = [];
    for (const [index, finding] of document.findings.entries()) {
      if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
        errors.push(`finding ${index} is not an object`);
        continue;
      }
      if (typeof finding.id !== "string" || finding.id.length === 0) errors.push(`finding ${index} has no id`);
      if (typeof finding.classification !== "string" || finding.classification.length === 0) errors.push(`finding ${index} has no classification`);
      if (!Array.isArray(finding.evidence) || finding.evidence.some((path) => typeof path !== "string" || path.length === 0)) {
        errors.push(`finding ${index} has invalid evidence`);
      }
      if (errors.length === 0 || finding.id) findings.push(finding);
    }
    return { errors, findings };
  } catch (error) {
    return { errors: [`Machine Findings JSON is invalid: ${error instanceof Error ? error.message : String(error)}`], findings: [] };
  }
}

function scoreCase(expectedCase, answer) {
  const parsed = parseFindings(answer?.review);
  const expected = expectedCase.expectedFindings ?? [];
  const expectedById = new Map(expected.map((finding) => [finding.id, finding]));
  const actualById = new Map();
  const duplicateFindingIds = [];
  for (const finding of parsed.findings) {
    if (actualById.has(finding.id)) duplicateFindingIds.push(finding.id);
    actualById.set(finding.id, finding);
  }
  const missingFindingIds = [];
  const wrongClassifications = [];
  const missingEvidence = [];
  for (const expectedFinding of expected) {
    const actual = actualById.get(expectedFinding.id);
    if (!actual) {
      missingFindingIds.push(expectedFinding.id);
      continue;
    }
    if (actual.classification !== expectedFinding.classification) {
      wrongClassifications.push({ actual: actual.classification, expected: expectedFinding.classification, id: expectedFinding.id });
    }
    const actualEvidence = new Set(actual.evidence);
    for (const evidence of expectedFinding.evidence) {
      if (!actualEvidence.has(evidence)) missingEvidence.push({ evidence, id: expectedFinding.id });
    }
  }
  const unexpectedFindingIds = [...actualById.keys()].filter((id) => !expectedById.has(id)).sort();
  const errors = [...parsed.errors];
  if (!answer) errors.push("missing answer for case");
  if (duplicateFindingIds.length > 0) errors.push(`duplicate finding ids: ${duplicateFindingIds.join(", ")}`);
  if (missingFindingIds.length > 0) errors.push(`missing findings: ${missingFindingIds.join(", ")}`);
  if (wrongClassifications.length > 0) errors.push("wrong finding classifications");
  if (missingEvidence.length > 0) errors.push("missing finding evidence");
  if (unexpectedFindingIds.length > 0) errors.push(`unexpected findings: ${unexpectedFindingIds.join(", ")}`);
  return {
    errors,
    id: expectedCase.id,
    missingEvidence,
    missingFindingIds,
    status: errors.length === 0 ? "pass" : "fail",
    unexpectedFindingIds,
    wrongClassifications,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const suitePath = resolve(root, options.suite);
  const answersPath = resolve(root, options.answers);
  const suite = readJson(suitePath, "daily drift review suite");
  const answers = readJson(answersPath, "daily drift review answers");
  if (suite.schemaVersion !== "1.0" || !Array.isArray(suite.cases)) throw new Error("daily drift review suite must use schemaVersion 1.0 and cases array");
  if (answers.schemaVersion !== "1.0" || !Array.isArray(answers.answers)) throw new Error("daily drift review answers must use schemaVersion 1.0 and answers array");
  const answersByCase = new Map(answers.answers.map((answer) => [answer.caseId, answer]));
  const cases = suite.cases.map((expectedCase) => scoreCase(expectedCase, answersByCase.get(expectedCase.id)));
  const failed = cases.filter((entry) => entry.status === "fail");
  const report = {
    cases,
    status: failed.length === 0 ? "pass" : "fail",
    suite: { id: suite.id ?? null, path: relative(root, suitePath) },
    summary: { failed: failed.length, passed: cases.length - failed.length, total: cases.length },
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failed.length > 0) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(error instanceof Error ? `${error.message}\n` : `${String(error)}\n`);
  process.exitCode = 2;
}
