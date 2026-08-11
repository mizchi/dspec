import { CommandError } from "./error.mjs";

type UnknownRecord = Record<string, unknown>;
type Now = () => string;

export type EvidenceCreateOptions = {
  modelFile: string;
  json: boolean;
  outputFile: string | null;
  executedAt: string;
  requireFormalTools: boolean;
  intentReportFiles: string[];
};

export type EvidenceVerifyOptions = {
  modelFile: string;
  manifestFile: string;
  json: boolean;
};

export type EvidenceRefreshOptions = {
  modelFile: string;
  manifestFile: string;
  json: boolean;
  executedAt: string;
  requireFormalTools: boolean;
  intentReportFiles: string[];
};

type EvidenceWriteReport = {
  path: string;
  bytes: number;
  digest: string;
};

type EvidenceVerificationReport = UnknownRecord & {
  status: string;
  summary: {
    artifacts: number;
    clauseBindings: number;
  };
  errors: string[];
};

export type EvidenceCommandContext = {
  now?: Now;
  loadModel: (file: string) => unknown;
  assertModelCoverage: (model: unknown) => void;
  createAssuranceEvidenceManifest: (
    model: unknown,
    options: EvidenceCreateOptions | EvidenceRefreshOptions,
  ) => unknown;
  writeAssuranceEvidenceManifest: (
    path: string,
    manifest: unknown,
  ) => EvidenceWriteReport;
  readJsonFile: (file: string, label: string) => unknown;
  assuranceEvidenceVerificationReport: (
    model: unknown,
    manifest: unknown,
  ) => EvidenceVerificationReport;
  assertReportOk: (report: EvidenceVerificationReport) => void;
  assuranceDigest: (value: unknown) => string;
  stableJson: (value: unknown) => string;
  modelReport: (model: unknown) => unknown;
  manifestExists: (file: string) => boolean;
  write: (value: string) => void;
};

const systemNow: Now = () => new Date().toISOString();

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function modelId(model: unknown): unknown {
  return record(model)?.id;
}

export function evidenceUsage(): string {
  return `usage:
  dspec evidence create [--json] [--output <manifest.json>] [--executed-at <iso>] [--intent-report <exercise.json>] [--require-formal-tools] <model.pkl>
  dspec evidence verify [--json] <model.pkl> <manifest.json>
  dspec evidence refresh [--json] [--executed-at <iso>] [--intent-report <exercise.json>] [--require-formal-tools] <model.pkl> <manifest.json>
`;
}

export function parseEvidenceCreateArgs(
  args: readonly string[],
  now: Now = systemNow,
): EvidenceCreateOptions {
  let json = false;
  let outputFile: string | null = null;
  let executedAt: string | null = null;
  let requireFormalTools = false;
  const intentReportFiles: string[] = [];
  const files: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--require-formal-tools") {
      requireFormalTools = true;
      continue;
    }
    if (arg === "--output") {
      outputFile = args[index + 1] ?? null;
      index += 1;
      if (!outputFile) throw new CommandError("--output requires a manifest path\n");
      continue;
    }
    if (arg === "--executed-at") {
      executedAt = args[index + 1] ?? null;
      index += 1;
      if (!executedAt) {
        throw new CommandError("--executed-at requires an ISO timestamp\n");
      }
      continue;
    }
    if (arg === "--intent-report") {
      const reportFile = args[index + 1];
      index += 1;
      if (!reportFile) {
        throw new CommandError(
          "--intent-report requires an Intent exercise report path\n",
        );
      }
      intentReportFiles.push(reportFile);
      continue;
    }
    files.push(arg);
  }
  if (files.length !== 1) throw new CommandError(evidenceUsage());
  return {
    modelFile: files[0],
    json,
    outputFile,
    executedAt: executedAt ?? now(),
    requireFormalTools,
    intentReportFiles,
  };
}

export function parseEvidenceVerifyArgs(
  args: readonly string[],
): EvidenceVerifyOptions {
  let json = false;
  const files: string[] = [];
  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    files.push(arg);
  }
  if (files.length !== 2) throw new CommandError(evidenceUsage());
  return { modelFile: files[0], manifestFile: files[1], json };
}

export function parseEvidenceRefreshArgs(
  args: readonly string[],
  now: Now = systemNow,
): EvidenceRefreshOptions {
  let json = false;
  let executedAt: string | null = null;
  let requireFormalTools = false;
  const intentReportFiles: string[] = [];
  const files: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--require-formal-tools") {
      requireFormalTools = true;
      continue;
    }
    if (arg === "--executed-at") {
      executedAt = args[index + 1] ?? null;
      index += 1;
      if (!executedAt) {
        throw new CommandError("--executed-at requires an ISO timestamp\n");
      }
      continue;
    }
    if (arg === "--intent-report") {
      const reportFile = args[index + 1];
      index += 1;
      if (!reportFile) {
        throw new CommandError(
          "--intent-report requires an Intent exercise report path\n",
        );
      }
      intentReportFiles.push(reportFile);
      continue;
    }
    files.push(arg);
  }
  if (files.length !== 2) throw new CommandError(evidenceUsage());
  return {
    modelFile: files[0],
    manifestFile: files[1],
    json,
    executedAt: executedAt ?? now(),
    requireFormalTools,
    intentReportFiles,
  };
}

function inheritedIntentReportFiles(manifest: unknown): string[] {
  return list(record(manifest)?.intentExercises)
    .map((entry) => record(record(entry)?.report)?.path)
    .filter((path): path is string => typeof path === "string" && path.length > 0);
}

export function runEvidenceCreate(
  args: readonly string[],
  context: EvidenceCommandContext,
): void {
  const options = parseEvidenceCreateArgs(args, context.now ?? systemNow);
  const model = context.loadModel(options.modelFile);
  context.assertModelCoverage(model);
  const manifest = context.createAssuranceEvidenceManifest(model, options);
  const output = options.outputFile
    ? context.writeAssuranceEvidenceManifest(options.outputFile, manifest)
    : null;
  if (options.json) {
    context.write(context.stableJson({
      status: "pass",
      model: context.modelReport(model),
      output,
      manifest,
    }));
    return;
  }
  if (output) {
    context.write(`ok: wrote assurance evidence manifest ${output.path}\n`);
    return;
  }
  context.write(context.stableJson(manifest));
}

export function runEvidenceVerify(
  args: readonly string[],
  context: EvidenceCommandContext,
): void {
  const options = parseEvidenceVerifyArgs(args);
  const model = context.loadModel(options.modelFile);
  const manifest = context.readJsonFile(
    options.manifestFile,
    "assurance evidence manifest",
  );
  const report = context.assuranceEvidenceVerificationReport(model, manifest);
  if (options.json) {
    context.write(context.stableJson(report));
    context.assertReportOk(report);
    return;
  }
  context.assertReportOk(report);
  context.write(
    `ok: ${modelId(model)} assurance evidence (${report.summary.artifacts} artifacts, ${report.summary.clauseBindings} clause bindings)\n`,
  );
}

export function runEvidenceRefresh(
  args: readonly string[],
  context: EvidenceCommandContext,
): void {
  const options = parseEvidenceRefreshArgs(args, context.now ?? systemNow);
  const model = context.loadModel(options.modelFile);
  context.assertModelCoverage(model);
  const beforeManifest = context.manifestExists(options.manifestFile)
    ? context.readJsonFile(options.manifestFile, "assurance evidence manifest")
    : null;
  const before = beforeManifest
    ? context.assuranceDigest(context.stableJson(beforeManifest))
    : null;
  const intentReportFiles = options.intentReportFiles.length > 0
    ? options.intentReportFiles
    : inheritedIntentReportFiles(beforeManifest);
  const manifest = context.createAssuranceEvidenceManifest(model, {
    ...options,
    intentReportFiles,
  });
  const output = context.writeAssuranceEvidenceManifest(
    options.manifestFile,
    manifest,
  );
  const report = {
    status: "pass",
    model: context.modelReport(model),
    changed: before !== context.assuranceDigest(context.stableJson(manifest)),
    output,
    manifest,
  };
  if (options.json) {
    context.write(context.stableJson(report));
    return;
  }
  context.write(`ok: refreshed assurance evidence manifest ${output.path}\n`);
}

export function runEvidenceCommand(
  args: readonly string[],
  context: EvidenceCommandContext,
): void {
  const [subcommand, ...rest] = args;
  if (
    !subcommand
    || subcommand === "help"
    || subcommand === "--help"
    || subcommand === "-h"
  ) {
    context.write(evidenceUsage());
    return;
  }
  if (subcommand === "create") {
    runEvidenceCreate(rest, context);
    return;
  }
  if (subcommand === "verify") {
    runEvidenceVerify(rest, context);
    return;
  }
  if (subcommand === "refresh") {
    runEvidenceRefresh(rest, context);
    return;
  }
  throw new CommandError(
    `unknown evidence subcommand: ${subcommand}\n${evidenceUsage()}`,
  );
}
