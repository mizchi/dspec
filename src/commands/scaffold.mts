import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { CommandError } from "./error.mjs";
import {
  pklImportPath,
  resolveSchemaModulePath,
  schemaImportFromModel,
} from "./schema-lock.mjs";

type UnknownRecord = Record<string, unknown>;

export type ScaffoldRuleReference = {
  path: string;
  anchor: string;
};

export type ScaffoldRuleOptions = {
  modelFile: string;
  ruleId: string;
  json: boolean;
  force: boolean;
  outputFile: string | null;
  kind: string;
  terms: string[];
  implementation: ScaffoldRuleReference | null;
  test: ScaffoldRuleReference | null;
};

export type ScaffoldRuleDocument = {
  model: unknown;
  schemaImportPath: string;
  source: string;
};

export type ScaffoldRuleWriteReport = {
  path: string;
  bytes: number;
};

type ScaffoldCommandContext = {
  loadModel: (file: string) => unknown;
  modelReport: (model: unknown) => unknown;
  stableJson: (value: unknown) => string;
  write: (value: string) => void;
};

const SCAFFOLD_RULE_KINDS = new Set([
  "decision",
  "invariant",
  "transition",
  "obligation",
  "permission",
  "prohibition",
  "exception",
  "witness",
  "example",
  "non_goal",
  "equivalence",
]);

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pklString(value: unknown): string {
  return JSON.stringify(String(value));
}

function hasHelpFlag(args: readonly string[]): boolean {
  return args[0] === "--help" || args[0] === "-h" || args[0] === "help";
}

export function scaffoldUsage(): string {
  return `usage:
  dspec scaffold rule [--json] [--force] [--output <rule.pkl>] [--kind <kind>] [--term <id>] [--implementation <path#symbol>] [--test <path#anchor>] <model.pkl> <rule-id>

Emit a typed draft Rule fragment. The source model supplies its Schema.pkl import
and vocabulary; the command never edits the source model automatically.

Options:
  --json                           Emit the scaffold report as JSON.
  --force                          Replace an existing output file.
  --output <rule.pkl>              Write the Pkl fragment instead of stdout.
  --kind <kind>                    Rule kind (default: invariant).
  --term <id>                      Refer to an existing vocabulary term; repeatable.
  --implementation <path#symbol>  Add a code implementation reference.
  --test <path#anchor>             Add a linked Node test check target.
`;
}

export function parseScaffoldRuleReference(
  value: string,
  option: string,
): ScaffoldRuleReference {
  const hash = value.indexOf("#");
  const path = hash === -1 ? value : value.slice(0, hash);
  const anchor = hash === -1 ? "" : value.slice(hash + 1);
  if (!path || !anchor) {
    throw new CommandError(`${option} must use path#symbol-or-anchor: ${value}\n`);
  }
  return { path, anchor };
}

export function parseScaffoldRuleArgs(args: readonly string[]): ScaffoldRuleOptions {
  let json = false;
  let force = false;
  let outputFile: string | null = null;
  let kind = "invariant";
  const terms: string[] = [];
  let implementation: ScaffoldRuleReference | null = null;
  let test: ScaffoldRuleReference | null = null;
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--output") {
      outputFile = args[index + 1] ?? "";
      index += 1;
    } else if (arg === "--kind") {
      kind = args[index + 1] ?? "";
      index += 1;
    } else if (arg === "--term") {
      terms.push(args[index + 1] ?? "");
      index += 1;
    } else if (arg === "--implementation") {
      implementation = parseScaffoldRuleReference(
        args[index + 1] ?? "",
        "--implementation",
      );
      index += 1;
    } else if (arg === "--test") {
      test = parseScaffoldRuleReference(args[index + 1] ?? "", "--test");
      index += 1;
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    } else {
      throw new CommandError(scaffoldUsage());
    }
  }

  const [modelFile, ruleId] = positional;
  if (
    positional.length !== 2
    || !modelFile
    || !ruleId
    || !SCAFFOLD_RULE_KINDS.has(kind)
  ) {
    throw new CommandError(scaffoldUsage());
  }
  if (
    !terms.every(Boolean)
    || (outputFile !== null && (!outputFile || outputFile.startsWith("-")))
  ) {
    throw new CommandError(scaffoldUsage());
  }
  return {
    modelFile,
    ruleId,
    json,
    force,
    outputFile,
    kind,
    terms,
    implementation,
    test,
  };
}

export function scaffoldRuleDocument(
  {
    modelFile,
    outputFile = null,
    ruleId,
    kind,
    terms,
    implementation,
    test,
  }: ScaffoldRuleOptions,
  context: Pick<ScaffoldCommandContext, "loadModel" | "modelReport">,
): ScaffoldRuleDocument {
  const model = context.loadModel(modelFile);
  const modelObject = record(model);
  const vocabulary = new Set(
    list(modelObject?.vocabulary)
      .map((term) => record(term)?.id)
      .filter((id): id is string => typeof id === "string"),
  );
  for (const term of terms) {
    if (!vocabulary.has(term)) {
      throw new CommandError(`unknown vocabulary term: ${term}\n`);
    }
  }
  const modelSchemaImport = schemaImportFromModel(modelFile);
  const schemaFile = resolveSchemaModulePath(modelFile, modelSchemaImport);
  const schemaImportPath = outputFile
    ? pklImportPath(outputFile, schemaFile)
    : modelSchemaImport;
  const lines = [
    `import ${pklString(schemaImportPath)} as d`,
    "",
    "rule: d.Rule = new {",
    `  id = ${pklString(ruleId)}`,
    `  kind = ${pklString(kind)}`,
    `  text = d.text(${pklString(`${ruleId} を満たす`)}, ${pklString(`${ruleId} holds`)})`,
  ];
  if (terms.length > 0) {
    lines.push("  terms {");
    for (const term of terms) lines.push(`    ${pklString(term)}`);
    lines.push("  }");
  }
  lines.push('  reviewStatus = "draft"');
  if (test) {
    lines.push(
      "  checks {",
      `    d.nodeCheck(${pklString(`${test.path}#${test.anchor}`)})`,
      "  }",
    );
  }
  if (implementation) {
    lines.push(
      "  implementedBy {",
      `    d.codeRef(${pklString(implementation.path)}, ${pklString(implementation.anchor)})`,
      "  }",
    );
  }
  lines.push("}");
  return {
    model: context.modelReport(model),
    schemaImportPath,
    source: `${lines.join("\n")}\n`,
  };
}

export function writeScaffoldedRule(
  outputFile: string,
  source: string,
  force = false,
): ScaffoldRuleWriteReport {
  const path = resolve(outputFile);
  if (existsSync(path) && !force) {
    throw new CommandError(
      `refusing to overwrite existing rule scaffold: ${outputFile}; use --force\n`,
    );
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return { path: outputFile, bytes: Buffer.byteLength(source, "utf8") };
}

export function runScaffoldCommand(
  args: readonly string[],
  context: ScaffoldCommandContext,
): void {
  const [subcommand, ...rest] = args;
  if (
    !subcommand
    || subcommand === "help"
    || subcommand === "--help"
    || subcommand === "-h"
  ) {
    context.write(scaffoldUsage());
    return;
  }
  if (subcommand !== "rule") {
    throw new CommandError(`unknown scaffold subcommand: ${subcommand}\n${scaffoldUsage()}`);
  }
  if (hasHelpFlag(rest)) {
    context.write(scaffoldUsage());
    return;
  }
  const options = parseScaffoldRuleArgs(rest);
  const scaffold = scaffoldRuleDocument(options, context);
  const output = options.outputFile
    ? writeScaffoldedRule(options.outputFile, scaffold.source, options.force)
    : null;
  const report = {
    status: "pass",
    model: scaffold.model,
    rule: { id: options.ruleId, kind: options.kind, terms: options.terms },
    output,
    ...(options.json || output ? { source: scaffold.source } : {}),
  };
  if (options.json) {
    context.write(context.stableJson(report));
    return;
  }
  if (output) {
    context.write(`ok: wrote draft rule scaffold ${output.path}\n`);
    return;
  }
  context.write(scaffold.source);
}
