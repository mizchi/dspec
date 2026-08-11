import { CommandError } from "./error.mjs";

type UnknownRecord = Record<string, unknown>;
type Now = () => string;

export type ProjectionOptions = {
  file: string;
  dryRun: boolean;
  generatedAt: string | null;
  json: boolean;
  root: string;
};

export type ProjectionUnlockOptions = {
  force: boolean;
  json: boolean;
  root: string;
};

type ProjectionReport = UnknownRecord & {
  status: string;
  errors: string[];
};

type ProjectionLockReport = {
  status: string;
  forced?: boolean;
  previous: {
    liveness: string;
    lease: {
      status: string;
    };
  };
};

export type ProjectionCommandContext = {
  generateUsage: string;
  now?: Now;
  loadModel: (file: string) => unknown;
  generateProjectionArtifacts: (
    model: unknown,
    options: {
      dryRun: boolean;
      generatedAt: string;
      root: string;
    },
  ) => ProjectionReport;
  generatedProjectionReport: (
    model: unknown,
    options: { root: string },
  ) => ProjectionReport;
  recoverProjectionLock: (
    root: string,
    options: { force: boolean },
  ) => ProjectionLockReport;
  renderGeneratedProjectionReport: (
    report: ProjectionReport,
    action: "generate" | "check",
  ) => string;
  assertReportOk: (report: ProjectionReport) => void;
  stableJson: (value: unknown) => string;
  write: (value: string) => void;
};

const systemNow: Now = () => new Date().toISOString();

function hasHelpFlag(args: readonly string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function generatedUsage(): string {
  return `usage:
  dspec generated check [--json] [--root <dir>] <model.pkl>
  dspec generated unlock [--json] [--force] [--root <dir>]
`;
}

export function parseProjectionArgs(
  args: readonly string[],
  usageText: string,
  { allowGenerationOptions = false }: { allowGenerationOptions?: boolean } = {},
): ProjectionOptions {
  let file: string | null = null;
  let dryRun = false;
  let generatedAt: string | null = null;
  let json = false;
  let root = ".";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--dry-run" && allowGenerationOptions) {
      dryRun = true;
      continue;
    }
    if (arg === "--generated-at" && allowGenerationOptions) {
      generatedAt = args[index + 1] ?? null;
      if (!generatedAt) throw new CommandError(usageText);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(generatedAt)) {
        throw new CommandError(`invalid --generated-at: ${generatedAt}`);
      }
      index += 1;
      continue;
    }
    if (arg === "--root") {
      root = args[index + 1] ?? "";
      if (!root) throw new CommandError(usageText);
      index += 1;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}\n${usageText}`);
  }

  if (!file) throw new CommandError(usageText);
  return { file, dryRun, generatedAt, json, root };
}

export function parseProjectionUnlockArgs(
  args: readonly string[],
  usageText = generatedUsage(),
): ProjectionUnlockOptions {
  let force = false;
  let json = false;
  let root = ".";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--root") {
      root = args[index + 1] ?? "";
      if (!root) throw new CommandError(usageText);
      index += 1;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}\n${usageText}`);
  }
  return { force, json, root };
}

export function runGenerateCommand(
  args: readonly string[],
  context: ProjectionCommandContext,
): void {
  const options = parseProjectionArgs(
    args,
    context.generateUsage,
    { allowGenerationOptions: true },
  );
  const model = context.loadModel(options.file);
  const report = context.generateProjectionArtifacts(model, {
    dryRun: options.dryRun,
    generatedAt: options.generatedAt ?? (context.now ?? systemNow)(),
    root: options.root,
  });
  if (options.json) {
    context.write(context.stableJson(report));
    context.assertReportOk(report);
    return;
  }
  const rendered = context.renderGeneratedProjectionReport(report, "generate");
  if (report.status === "fail") throw new CommandError(rendered);
  context.write(rendered);
}

export function runGeneratedCommand(
  args: readonly string[],
  context: ProjectionCommandContext,
): void {
  const [subcommand, ...rest] = args;
  if (
    !subcommand
    || subcommand === "help"
    || subcommand === "--help"
    || subcommand === "-h"
  ) {
    context.write(generatedUsage());
    return;
  }
  if (subcommand !== "check" && subcommand !== "unlock") {
    throw new CommandError(
      `unknown generated subcommand: ${subcommand}\n${generatedUsage()}`,
    );
  }
  if (hasHelpFlag(rest)) {
    context.write(generatedUsage());
    return;
  }
  if (subcommand === "unlock") {
    const options = parseProjectionUnlockArgs(rest);
    let report: ProjectionLockReport;
    try {
      report = context.recoverProjectionLock(
        options.root,
        { force: options.force },
      );
    } catch (error) {
      throw new CommandError(`${errorMessage(error)}\n`);
    }
    if (options.json) {
      context.write(context.stableJson(report));
      return;
    }
    if (report.status === "absent") {
      context.write("ok: no Projection generation lock\n");
      return;
    }
    context.write(
      `ok: recovered Projection generation lock (${report.previous.liveness}, lease ${report.previous.lease.status}${report.forced ? ", forced" : ""})\n`,
    );
    return;
  }
  const options = parseProjectionArgs(rest, generatedUsage());
  const model = context.loadModel(options.file);
  const report = context.generatedProjectionReport(model, { root: options.root });
  if (options.json) {
    context.write(context.stableJson(report));
    context.assertReportOk(report);
    return;
  }
  const rendered = context.renderGeneratedProjectionReport(report, "check");
  if (report.status === "fail") throw new CommandError(rendered);
  context.write(rendered);
}
