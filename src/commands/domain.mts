import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { assuranceDigest } from "../core/assurance-evidence.mjs";
import {
  domainCodegenIr,
  domainRelationshipGraph,
  renderDomainRelationshipMarkdown,
  renderDomainRelationshipMermaid,
  renderDomainTypescript,
} from "../core/domain.mjs";

type Fail = (message: string) => never;

type DomainOptions = {
  json: boolean;
  markdown: boolean;
  mermaid: boolean;
  language: string | null;
  outputFile: string | null;
  modelFile: string;
};

type CliDomainContext = {
  fail: Fail;
  loadModel: (file: string) => any;
  stableJson: (value: unknown) => string;
  validate: (model: any) => string[];
  write: (value: string) => void;
};

export function domainUsage() {
  return `usage:
  dspec domain ir [--json] <model.pkl>
  dspec domain generate --language typescript [--json] [--output <file.ts>] <model.pkl>
  dspec domain relationships [--json|--markdown|--mermaid] [--output <file>] <model.pkl>

Compile Entity, Value Object, Aggregate, Command, Domain Event, Invariant, and
Formalization declarations to a language-neutral IR. The built-in TypeScript
renderer emits domain-layer types, ports, event payloads, and deliberately
incomplete constructor stubs. Other language generators consume the IR rather
than reinterpreting the Pkl domain model. relationships renders the declared
links among DDD declarations, normative Rules, checks, implementation evidence,
and formalization artifacts as JSON, Markdown, or Mermaid.
`;
}

export function parseDomainArgs(
  args: readonly string[],
  subcommand: string,
  { fail = (message: string): never => { throw new Error(message); } }: { fail?: Fail } = {},
): DomainOptions {
  let json = false;
  let markdown = false;
  let mermaid = false;
  let language = null;
  let outputFile = null;
  const positional = [];
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
    if (arg === "--mermaid") {
      mermaid = true;
      continue;
    }
    if (arg === "--language") {
      language = args[index + 1] ?? null;
      index += 1;
      if (!language || language.startsWith("-")) fail(`domain generate requires a language\n${domainUsage()}`);
      continue;
    }
    if (arg === "--output") {
      outputFile = args[index + 1] ?? null;
      index += 1;
      if (!outputFile || outputFile.startsWith("-")) fail(`domain generate requires an output path\n${domainUsage()}`);
      continue;
    }
    if (arg.startsWith("-")) fail(`unknown domain ${subcommand} option: ${arg}\n${domainUsage()}`);
    positional.push(arg);
  }
  if (positional.length !== 1) fail(domainUsage());
  if (Number(json) + Number(markdown) + Number(mermaid) > 1) fail(`domain ${subcommand} accepts one output format\n${domainUsage()}`);
  if (subcommand === "ir" && (language || outputFile || markdown || mermaid)) fail(`domain ir does not accept --language, --output, --markdown, or --mermaid\n${domainUsage()}`);
  if (subcommand === "generate" && language !== "typescript") {
    fail(`unsupported built-in domain language: ${language ?? "missing"}; use domain ir for an external renderer\n${domainUsage()}`);
  }
  if (subcommand === "generate" && (markdown || mermaid)) fail(`domain generate does not accept --markdown or --mermaid\n${domainUsage()}`);
  if (subcommand === "relationships" && language) fail(`domain relationships does not accept --language\n${domainUsage()}`);
  return { json, markdown, mermaid, language, outputFile, modelFile: positional[0] };
}

function writeGeneratedSource(path: string, source: string): { path: string; bytes: number; digest: string } {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, source);
  return { path, bytes: Buffer.byteLength(source, "utf8"), digest: assuranceDigest(source) };
}

export function runDomainCommand(args: readonly string[], { fail, loadModel, stableJson, validate, write }: CliDomainContext): void {
  const [subcommand, ...rest] = args;
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    write(domainUsage());
    return;
  }
  if (!new Set(["ir", "generate", "relationships"]).has(subcommand)) {
    fail(`unknown domain subcommand: ${subcommand}\n${domainUsage()}`);
  }
  const options = parseDomainArgs(rest, subcommand, { fail });
  const model = loadModel(options.modelFile);
  if (subcommand === "relationships") {
    const graph = domainRelationshipGraph(model);
    const errors = [...new Set([...validate(model), ...graph.errors])].sort();
    const report = { ...graph, status: errors.length === 0 ? "pass" : "fail", errors };
    const source = options.json
      ? stableJson(report)
      : options.mermaid
        ? renderDomainRelationshipMermaid(report)
        : renderDomainRelationshipMarkdown(report);
    const output = options.outputFile ? writeGeneratedSource(options.outputFile, source) : null;
    if (options.json && output) write(stableJson({ ...report, output }));
    else if (output) write(`ok: ${model.id} generated domain relationship document ${output.path}\n`);
    else write(source);
    if (report.status === "fail") fail("domain relationship generation failed\n");
    return;
  }

  const ir = domainCodegenIr(model);
  const errors = [...new Set([...validate(model), ...ir.errors])].sort();
  const report = { ...ir, status: errors.length === 0 ? "pass" : "fail", errors };
  if (subcommand === "ir") {
    write(stableJson(report));
    if (report.status === "fail") fail("domain IR generation failed\n");
    return;
  }
  if (report.status === "fail") {
    if (options.json) write(stableJson(report));
    fail("domain code generation failed\n");
  }
  const source = renderDomainTypescript(model);
  const output = options.outputFile ? writeGeneratedSource(options.outputFile, source) : null;
  const generated = {
    ...report,
    language: options.language,
    sourceDigest: assuranceDigest(source),
    ...(output ? { output } : {}),
  };
  if (options.json) {
    write(stableJson(generated));
    return;
  }
  if (!output) {
    write(source);
    return;
  }
  write(`ok: ${model.id} generated ${options.language} domain scaffold ${output.path}\n`);
}
