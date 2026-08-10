#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(root, "src", "cli.mjs");

function usage() {
  return "usage: node scripts/verify-meandb-traceability.mjs [--meandb <command>]\n";
}

function meandbCommand(args) {
  let meandb = process.env.DSPEC_MEANDB ?? process.env.DSPEC_GRAPHDB ?? "meandb";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--meandb" || arg === "--graphdb") {
      const value = args[index + 1];
      index += 1;
      if (!value || value.startsWith("-")) throw new Error(`${arg} requires a command\n${usage()}`);
      meandb = value;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage());
      process.exit(0);
    }
    throw new Error(`unknown option: ${arg}\n${usage()}`);
  }
  return meandb;
}

function run(command, args, label) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} failed (${result.status ?? "unknown"}): ${String(result.stderr ?? result.stdout ?? "").trim()}`);
  return String(result.stdout ?? "");
}

const meandb = meandbCommand(process.argv.slice(2));
const directory = mkdtempSync(join(tmpdir(), "dspec-meandb-traceability-"));

try {
  run(process.execPath, [cli, "graph", "export", "--format", "graphdb", "--output", directory, "examples/dspec.pkl"], "meandb bundle export");
  run(process.execPath, [cli, "graph", "embed", "--dimensions", "16", directory], "meandb embedding projection");
  run(process.execPath, [cli, "graph", "build", "--meandb", meandb, "--k", "4", "--mutual", directory], "meandb build");
  const source = run(
    process.execPath,
    [cli, "graph", "query-dsl", "--meandb", meandb, "--explain", join(directory, "specification.graphdb"), "examples/dspec.traceability.gql"],
    "meandb traceability query",
  );
  const report = JSON.parse(source);

  assert.equal(report.query_version, 1, "meandb must report the supported query contract version");
  assert.ok(Array.isArray(report.rows) && report.rows.length > 0, "self specification must retain rule implementation traceability");
  assert.ok(report.rows.every((entry) => entry.evidence.filter((fact) => fact.type === "edge" && fact.kind === "link").length >= 2), "each result must explain both reified traceability links");
  assert.ok(report.plan?.clauses?.length === 4 && report.plan.edges_scanned > 0, "query execution plan must be present");

  process.stdout.write(`ok: meandb self-traceability query returned ${report.rows.length} explained result(s)\n`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
