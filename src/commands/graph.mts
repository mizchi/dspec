import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  embedGraphdbDocuments,
  graphdbBundle,
  querySemanticGraph,
  renderSemanticGraphQueryMarkdown,
  renderSemanticGraphTurtle,
  semanticGraph,
  semanticGraphWithEvidence,
  type SemanticGraph,
  type SemanticGraphEvidenceSources,
} from "../core/semantic-graph.mjs";

type Fail = (message: string) => never;
type GraphFormat = "json" | "turtle" | "graphdb";

type GraphOptions = {
  format: GraphFormat;
  locale: string | null;
  output: string | null;
  modelFile: string;
};

type GraphContext = {
  fail: Fail;
  loadModel: (file: string) => any;
  stableJson: (value: unknown) => string;
  validate: (model: any) => string[];
  write: (value: string) => void;
};

export function graphUsage(): string {
  return `usage:
  dspec graph export [--format json|turtle|graphdb] [--locale <locale>] [--conformance <report.json>] [--assurance <manifest.json>] [--real-app <reconciliation.json>] [--output <file-or-directory>] <model.pkl>
  dspec graph embed [--dimensions <n>] [--input <documents.jsonl>] [--output <notes.csv>] <graphdb-bundle-directory>
  dspec graph build [--meandb <command>] [--metric cosine|dot|l2] [--k <n>] [--mutual] [--min-weight <0..1>] [--output <file.graphdb>] [--dry-run] <graphdb-bundle-directory>
  dspec graph query-dsl [--meandb <command>] [--explain] <specification.graphdb> <query.gql>
  dspec graph query [--json|--markdown] [--locale <locale>] [--dimensions <n>] [--limit <n>] [--hops <n>] [--conformance <report.json>] [--assurance <manifest.json>] [--real-app <reconciliation.json>] <model.pkl> <question...>

Export the Pkl model as an evidence-aware semantic graph. JSON and Turtle
preserve stable IDs and labelled relations. The graphdb format writes a bundle
for mizchi/meandb's graph CLI: documents to embed, u64 ID mapping, explicit
links, metadata, and the lossless JSON/Turtle sidecars. The embed command creates a
deterministic lexical baseline; replace notes.csv for a model-specific embedding.
Imported reports retain their own evidence origin and never promote a Pkl
declaration into a proof.
`;
}

export function parseGraphArgs(
  args: readonly string[],
  { fail = (message: string): never => { throw new Error(message); } }: { fail?: Fail } = {},
): GraphOptions {
  let format: GraphFormat = "json";
  let locale: string | null = null;
  let output: string | null = null;
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--format") {
      const value = args[index + 1] ?? "";
      index += 1;
      if (value !== "json" && value !== "turtle" && value !== "graphdb") fail(`unknown graph format: ${value || "missing"}\n${graphUsage()}`);
      format = value as GraphFormat;
      continue;
    }
    if (arg === "--locale") {
      locale = args[index + 1] ?? null;
      index += 1;
      if (!locale || locale.startsWith("-")) fail(`graph export requires a locale\n${graphUsage()}`);
      continue;
    }
    if (arg === "--output") {
      output = args[index + 1] ?? null;
      index += 1;
      if (!output || output.startsWith("-")) fail(`graph export requires an output path\n${graphUsage()}`);
      continue;
    }
    if (arg.startsWith("-")) fail(`unknown graph export option: ${arg}\n${graphUsage()}`);
    positional.push(arg);
  }
  if (positional.length !== 1) fail(graphUsage());
  if (format === "graphdb" && !output) fail(`graphdb export requires --output <directory>\n${graphUsage()}`);
  return { format, locale, output, modelFile: positional[0] };
}

function writeFile(path: string, source: string): { path: string; bytes: number } {
  writeFileSync(path, source);
  return { path, bytes: Buffer.byteLength(source, "utf8") };
}

function writeGraphdbBundle(directory: string, graph: SemanticGraph, stableJson: (value: unknown) => string): { directory: string; files: { path: string; bytes: number }[] } {
  const target = resolve(directory);
  mkdirSync(target, { recursive: true });
  const bundle = graphdbBundle(graph);
  const files = Object.entries(bundle.files)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, source]) => writeFile(resolve(target, name), source));
  // Keep the CLI output intentionally independent from object insertion order.
  void stableJson;
  return { directory: target, files };
}

function parsePositiveInteger(value: string | undefined, label: string, fail: Fail, minimum = 1, maximum = 8192): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) fail(`invalid ${label}: ${value ?? "missing"}\n${graphUsage()}`);
  return parsed;
}

function parseRatio(value: string | undefined, label: string, fail: Fail): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) fail(`invalid ${label}: ${value ?? "missing"}\n${graphUsage()}`);
  return parsed;
}

function parseGraphEvidenceOptions(args: readonly string[], fail: Fail): { args: string[]; evidence: SemanticGraphEvidenceSources } {
  const output: string[] = [];
  const evidence: SemanticGraphEvidenceSources = {};
  const flags: Record<string, keyof SemanticGraphEvidenceSources> = {
    "--conformance": "conformance",
    "--assurance": "assurance",
    "--real-app": "realApp",
  };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const property = flags[flag];
    if (!property) {
      output.push(flag);
      continue;
    }
    const path = args[index + 1];
    index += 1;
    if (!path || path.startsWith("-")) fail(`${flag} requires a JSON file\n${graphUsage()}`);
    try {
      evidence[property] = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      fail(`failed to read ${flag} ${path}: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
  return { args: output, evidence };
}

function graphReport(model: unknown, locale: string | null, evidence: SemanticGraphEvidenceSources, context: GraphContext): SemanticGraph {
  let graph = semanticGraph(model, { ...(locale ? { locale } : {}) });
  if (Object.keys(evidence).length > 0) graph = semanticGraphWithEvidence(graph, evidence);
  const errors = [...new Set([...context.validate(model), ...graph.errors])].sort();
  return { ...graph, status: errors.length === 0 ? "pass" : "fail", errors };
}

function parseGraphEmbedArgs(args: readonly string[], fail: Fail): { directory: string; input: string | null; output: string | null; dimensions: number } {
  let input: string | null = null;
  let output: string | null = null;
  let dimensions = 256;
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--input" || arg === "--output") {
      const path = args[index + 1];
      index += 1;
      if (!path || path.startsWith("-")) fail(`${arg} requires a path\n${graphUsage()}`);
      if (arg === "--input") input = path;
      else output = path;
      continue;
    }
    if (arg === "--dimensions") {
      dimensions = parsePositiveInteger(args[index + 1], "embedding dimensions", fail, 2);
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) fail(`unknown graph embed option: ${arg}\n${graphUsage()}`);
    positional.push(arg);
  }
  if (positional.length !== 1) fail(graphUsage());
  return { directory: resolve(positional[0]), input, output, dimensions };
}

function readJsonLines(path: string, fail: Fail): unknown[] {
  try {
    return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return fail(`invalid JSONL at ${path}:${index + 1}: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    });
  } catch (error) {
    return fail(`failed to read GraphDB documents ${path}: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}

function parseGraphBuildArgs(args: readonly string[], fail: Fail): { directory: string; meandb: string; output: string | null; metric: "cosine" | "dot" | "l2"; k: number; mutual: boolean; minWeight: number | null; dryRun: boolean } {
  let meandb = "meandb";
  let output: string | null = null;
  let metric: "cosine" | "dot" | "l2" = "cosine";
  let k = 8;
  let mutual = false;
  let minWeight: number | null = null;
  let dryRun = false;
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--meandb" || arg === "--graphdb" || arg === "--output") {
      const value = args[index + 1];
      index += 1;
      if (!value || value.startsWith("-")) fail(`${arg} requires a value\n${graphUsage()}`);
      if (arg === "--meandb" || arg === "--graphdb") meandb = value;
      else output = value;
      continue;
    }
    if (arg === "--metric") {
      const value = args[index + 1];
      index += 1;
      if (value !== "cosine" && value !== "dot" && value !== "l2") fail(`invalid GraphDB metric: ${value ?? "missing"}\n${graphUsage()}`);
      metric = value;
      continue;
    }
    if (arg === "--k") {
      k = parsePositiveInteger(args[index + 1], "GraphDB k", fail, 1, 1024);
      index += 1;
      continue;
    }
    if (arg === "--min-weight") {
      minWeight = parseRatio(args[index + 1], "GraphDB min weight", fail);
      index += 1;
      continue;
    }
    if (arg === "--mutual") {
      mutual = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("-")) fail(`unknown graph build option: ${arg}\n${graphUsage()}`);
    positional.push(arg);
  }
  if (positional.length !== 1) fail(graphUsage());
  return { directory: resolve(positional[0]), meandb, output, metric, k, mutual, minWeight, dryRun };
}

export function parseMeandbQueryArgs(
  args: readonly string[],
  { fail = (message: string): never => { throw new Error(message); } }: { fail?: Fail } = {},
): { meandb: string; explain: boolean; graph: string; query: string } {
  let meandb = "meandb";
  let explain = false;
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--meandb" || arg === "--graphdb") {
      const value = args[index + 1];
      index += 1;
      if (!value || value.startsWith("-")) fail(`${arg} requires a command\n${graphUsage()}`);
      meandb = value;
      continue;
    }
    if (arg === "--explain") {
      explain = true;
      continue;
    }
    if (arg.startsWith("-")) fail(`unknown GraphDB query option: ${arg}\n${graphUsage()}`);
    positional.push(arg);
  }
  if (positional.length !== 2) fail(graphUsage());
  return { meandb, explain, graph: positional[0], query: positional[1] };
}

/** @deprecated Use {@link parseMeandbQueryArgs}. */
export const parseGraphdbQueryArgs = parseMeandbQueryArgs;

function parseGraphQueryArgs(args: readonly string[], fail: Fail): { modelFile: string; question: string; locale: string | null; dimensions: number; limit: number; hops: number; json: boolean; markdown: boolean } {
  let locale: string | null = null;
  let dimensions = 256;
  let limit = 5;
  let hops = 1;
  let json = false;
  let markdown = false;
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    if (arg === "--locale") {
      locale = args[index + 1] ?? null;
      index += 1;
      if (!locale || locale.startsWith("-")) fail(`graph query requires a locale\n${graphUsage()}`);
      continue;
    }
    if (arg === "--dimensions" || arg === "--limit" || arg === "--hops") {
      const label = arg === "--dimensions" ? "query dimensions" : arg === "--limit" ? "query limit" : "query hops";
      const minimum = arg === "--hops" ? 0 : arg === "--dimensions" ? 2 : 1;
      const maximum = arg === "--hops" ? 3 : arg === "--limit" ? 50 : 8192;
      const value = parsePositiveInteger(args[index + 1], label, fail, minimum, maximum);
      index += 1;
      if (arg === "--dimensions") dimensions = value;
      else if (arg === "--limit") limit = value;
      else hops = value;
      continue;
    }
    if (arg.startsWith("-")) fail(`unknown graph query option: ${arg}\n${graphUsage()}`);
    positional.push(arg);
  }
  if (json && markdown || positional.length < 2) fail(graphUsage());
  return { modelFile: positional[0], question: positional.slice(1).join(" "), locale, dimensions, limit, hops, json, markdown };
}

export function runGraphCommand(args: readonly string[], { fail, loadModel, stableJson, validate, write }: GraphContext): void {
  const [subcommand, ...rest] = args;
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    write(graphUsage());
    return;
  }

  if (subcommand === "embed") {
    const options = parseGraphEmbedArgs(rest, fail);
    const input = resolve(options.input ?? join(options.directory, "documents.jsonl"));
    const output = resolve(options.output ?? join(options.directory, "notes.csv"));
    const embedded = embedGraphdbDocuments(readJsonLines(input, fail), { dimensions: options.dimensions });
    const file = writeFile(output, embedded.notesCsv);
    write(stableJson({ status: "pass", bundleDirectory: options.directory, input, output: file, provider: embedded.provider, dimensions: embedded.dimensions, rows: embedded.rows }));
    return;
  }

  if (subcommand === "build") {
    const options = parseGraphBuildArgs(rest, fail);
    for (const filename of ["notes.csv", "links.csv", "meta.tsv"]) {
      if (!existsSync(join(options.directory, filename))) fail(`GraphDB bundle is missing ${filename}: ${options.directory}\n`);
    }
    const output = options.output ? resolve(options.output) : join(options.directory, "specification.graphdb");
    const argv = ["build-graph", join(options.directory, "notes.csv"), output, "--metric", options.metric, "--k", String(options.k), "--links", join(options.directory, "links.csv"), "--meta", join(options.directory, "meta.tsv")];
    if (options.mutual) argv.push("--mutual");
    if (options.minWeight !== null) argv.push("--min-weight", String(options.minWeight));
    const report = { status: "pass", meandb: options.meandb, bundleDirectory: options.directory, output, argv, dryRun: options.dryRun };
    if (options.dryRun) {
      write(stableJson(report));
      return;
    }
    const result = spawnSync(options.meandb, argv, { encoding: "utf8" });
    if (result.error) fail(`failed to run meandb command ${options.meandb}: ${result.error.message}\n`);
    if (result.status !== 0) fail(`meandb build failed (${result.status ?? "unknown"}): ${String(result.stderr ?? result.stdout ?? "").trim()}\n`);
    write(stableJson(report));
    return;
  }

  if (subcommand === "query-dsl") {
    const options = parseMeandbQueryArgs(rest, { fail });
    const graph = resolve(options.graph);
    const query = resolve(options.query);
    if (!existsSync(graph)) fail(`GraphDB database does not exist: ${graph}\n`);
    if (!existsSync(query)) fail(`GraphDB query file does not exist: ${query}\n`);
    const argv = ["query-dsl", graph, query];
    if (options.explain) argv.push("--explain");
    const result = spawnSync(options.meandb, argv, { encoding: "utf8" });
    if (result.error) fail(`failed to run meandb command ${options.meandb}: ${result.error.message}\n`);
    if (result.status !== 0) fail(`meandb query failed (${result.status ?? "unknown"}): ${String(result.stderr ?? result.stdout ?? "").trim()}\n`);
    write(String(result.stdout ?? ""));
    return;
  }

  const extracted = parseGraphEvidenceOptions(rest, fail);
  if (subcommand === "export") {
    const options = parseGraphArgs(extracted.args, { fail });
    const report = graphReport(loadModel(options.modelFile), options.locale, extracted.evidence, { fail, loadModel, stableJson, validate, write });
    if (options.format === "graphdb") {
      const output = writeGraphdbBundle(options.output!, report, stableJson);
      write(stableJson({ status: report.status, model: report.model, format: options.format, output }));
    } else {
      const source = options.format === "json" ? stableJson(report) : renderSemanticGraphTurtle(report);
      if (options.output) write(stableJson({ status: report.status, model: report.model, format: options.format, output: writeFile(resolve(options.output), source) }));
      else write(source);
    }
    if (report.status === "fail") fail("semantic graph export failed\n");
    return;
  }

  if (subcommand === "query") {
    const options = parseGraphQueryArgs(extracted.args, fail);
    const graph = graphReport(loadModel(options.modelFile), options.locale, extracted.evidence, { fail, loadModel, stableJson, validate, write });
    if (graph.status === "fail") fail(`semantic graph query failed\n${graph.errors.join("\n")}\n`);
    const report = querySemanticGraph(graph, options.question, { dimensions: options.dimensions, limit: options.limit, hops: options.hops });
    if (options.json) write(stableJson(report));
    else write(renderSemanticGraphQueryMarkdown(report));
    return;
  }

  fail(`unknown graph subcommand: ${subcommand}\n${graphUsage()}`);
}
