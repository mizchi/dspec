import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CommandError } from "./error.mjs";
import {
  defaultSchemaLockPath,
  pklImportPath,
  type SchemaLockWriteReport,
  writeSchemaLock,
} from "./schema-lock.mjs";

export type InitOptions = {
  force: boolean;
  json: boolean;
  outputFile: string;
  lockFile: string | null;
};

export type InitializeModelReport = {
  path: string;
  schemaImportPath: string;
  bytes: number;
  lock: SchemaLockWriteReport;
};

type InitCommandContext = {
  stableJson: (value: unknown) => string;
  write: (value: string) => void;
};

export function initUsage(): string {
  return `usage:
  dspec init [--json] [--force] [--output <model.pkl>] [--lock <lock.json>] [model.pkl]

Create a minimal Pkl model that imports this dspec package's Schema.pkl.

Options:
  --json                Emit the creation report as JSON.
  --force               Replace an existing output file.
  --output <model.pkl>  Select the output file (default: dspec.pkl).
  --lock <lock.json>    Select the schema lock file (default: <model>.lock.json).
`;
}

export function parseInitArgs(args: readonly string[]): InitOptions {
  let force = false;
  let json = false;
  let outputFile = "dspec.pkl";
  let lockFile: string | null = null;
  let outputSpecified = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") {
      force = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--output") {
      outputFile = args[index + 1] ?? "";
      outputSpecified = true;
      index += 1;
    } else if (arg === "--lock") {
      lockFile = args[index + 1] ?? "";
      index += 1;
    } else if (!arg.startsWith("-") && !outputSpecified) {
      outputFile = arg;
      outputSpecified = true;
    } else {
      throw new CommandError(initUsage());
    }
  }
  if (!outputFile || outputFile.startsWith("-")) throw new CommandError(initUsage());
  if (lockFile !== null && (!lockFile || lockFile.startsWith("-"))) {
    throw new CommandError(initUsage());
  }
  return { force, json, outputFile, lockFile };
}

export function initializedModelId(outputFile: string): string {
  const normalized = basename(outputFile, ".pkl")
    .replace(/[^A-Za-z0-9_.\-/]+/g, "-")
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  return normalized || "dspec-model";
}

function installedSchemaPath(outputFile: string): string {
  let directory = dirname(resolve(outputFile));
  while (true) {
    const candidate = join(
      directory,
      "node_modules",
      "@mizchi",
      "dspec",
      "dspec",
      "Schema.pkl",
    );
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return fileURLToPath(new URL("../../dspec/Schema.pkl", import.meta.url));
}

function pklString(value: unknown): string {
  return JSON.stringify(String(value));
}

export function renderInitializedModel({
  id,
  schemaImportPath,
}: {
  id: string;
  schemaImportPath: string;
}): string {
  return `import ${pklString(schemaImportPath)} as d

model: d.Model = new {
  id = ${pklString(id)}
  name = d.text("仕様", "Specification")
  version = "0.1.0"
  primaryLocale = "en"
  locales { "en" }
}
`;
}

export function initializeModel({
  outputFile,
  lockFile = null,
  force = false,
}: {
  outputFile: string;
  lockFile?: string | null;
  force?: boolean;
}): InitializeModelReport {
  const outputPath = resolve(outputFile);
  const selectedLockFile = lockFile ?? defaultSchemaLockPath(outputFile);
  const lockPath = resolve(selectedLockFile);
  if (existsSync(outputPath) && !force) {
    throw new CommandError(`refusing to overwrite existing model: ${outputFile}; use --force\n`);
  }
  if (existsSync(lockPath) && !force) {
    throw new CommandError(
      `refusing to overwrite existing schema lock: ${selectedLockFile}; use --force\n`,
    );
  }
  const schemaImportPath = pklImportPath(outputPath, installedSchemaPath(outputPath));
  const id = initializedModelId(outputPath);
  const rendered = renderInitializedModel({ id, schemaImportPath });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rendered);
  const lock = writeSchemaLock({
    modelFile: outputPath,
    lockFile: selectedLockFile,
    force: true,
  });
  return {
    path: outputFile,
    schemaImportPath,
    bytes: Buffer.byteLength(rendered, "utf8"),
    lock,
  };
}

function hasHelpFlag(args: readonly string[]): boolean {
  return args[0] === "--help" || args[0] === "-h" || args[0] === "help";
}

export function runInitCommand(args: readonly string[], context: InitCommandContext): void {
  if (hasHelpFlag(args)) {
    context.write(initUsage());
    return;
  }
  const { outputFile, lockFile, force, json } = parseInitArgs(args);
  const output = initializeModel({ outputFile, lockFile, force });
  const report = {
    status: "pass",
    model: { id: initializedModelId(outputFile), version: "0.1.0" },
    output,
  };
  if (json) {
    context.write(context.stableJson(report));
    return;
  }
  context.write(`ok: wrote model ${output.path}\n`);
  context.write(`ok: wrote schema lock ${output.lock.path}\n`);
  context.write(`next: dspec verify ${output.path}\n`);
}
