import { CommandError } from "./error.mjs";

type UnknownRecord = Record<string, unknown>;

type CommandReport = UnknownRecord & {
  status: string;
  errors: string[];
};

type ScaffoldReport = CommandReport & {
  draft: UnknownRecord;
};

type ScaffoldOutput = {
  path: string;
  schemaImportPath: string;
  bytes: number;
};

export type SpecCompatibilityOptions = {
  beforeFile: string;
  afterFile: string;
  json: boolean;
  markdown: boolean;
};

export type SpecChangeReviewOptions = {
  file: string;
  json: boolean;
  markdown: boolean;
};

export type ScaffoldSpecChangeReviewOptions = {
  beforeFile: string;
  afterFile: string;
  id: string | null;
  json: boolean;
  outputFile: string | null;
};

export type SpecChangeCommandContext = {
  loadModel: (file: string) => unknown;
  specCompatibilityReport: (beforeModel: unknown, afterModel: unknown) => CommandReport;
  renderSpecCompatibilityMarkdownReport: (report: CommandReport) => string;
  renderSpecCompatibilityReport: (report: CommandReport) => string;
  loadSpecChangeReview: (file: string) => unknown;
  specChangeReviewReport: (review: unknown, file: string) => CommandReport;
  renderSpecChangeReviewMarkdownReport: (report: CommandReport) => string;
  renderSpecChangeReviewReport: (report: CommandReport) => string;
  specChangeReviewScaffoldReport: (options: {
    beforeFile: string;
    afterFile: string;
    beforeModel: unknown;
    afterModel: unknown;
    id: string | null;
  }) => ScaffoldReport;
  specChangeReviewDraftForOutput: (
    draft: UnknownRecord,
    outputFile: string,
  ) => UnknownRecord;
  writeSpecChangeReviewScaffold: (
    outputFile: string,
    draft: UnknownRecord,
  ) => ScaffoldOutput;
  renderSpecChangeReviewDraftPkl: (draft: UnknownRecord) => string;
  assertReportOk: (report: CommandReport) => void;
  stableJson: (value: unknown) => string;
  write: (value: string) => void;
};

function hasHelpFlag(args: readonly string[]): boolean {
  return args.includes("--help") || args.includes("-h");
}

export function specChangeUsage(): string {
  return `usage:
  dspec spec-change compat [--json|--markdown] <before.pkl> <after.pkl>
  dspec spec-change scaffold [--json|--pkl] [--id <id>] [--output <review.pkl>] <before.pkl> <after.pkl>
  dspec spec-change review [--json|--markdown] <review.pkl>

Typical flow:
  dspec spec-change compat --json before.pkl after.pkl
  dspec spec-change scaffold --output review.pkl before.pkl after.pkl
  dspec spec-change review --json review.pkl
`;
}

export function specChangeCompatUsage(): string {
  return `usage:
  dspec spec-change compat [--json|--markdown] <before.pkl> <after.pkl>

Compare before/after spec models and classify the compatibility change.

Options:
  --json      Emit the compatibility report as JSON.
  --markdown  Emit a human-readable Markdown review report.
`;
}

export function specChangeReviewUsage(): string {
  return `usage:
  dspec spec-change review [--json|--markdown] <review.pkl>

Run a typed SpecChangeReview Pkl plan as one spec-change gate.

Options:
  --json      Emit the review report as JSON.
  --markdown  Emit a human-readable Markdown review report.
`;
}

export function scaffoldSpecChangeReviewUsage(): string {
  return `usage:
  dspec spec-change scaffold [--json|--pkl] [--id <id>] [--output <review.pkl>] <before.pkl> <after.pkl>

Generate a typed SpecChangeReview Pkl draft from before/after models.

Options:
  --json                 Emit the scaffold report as JSON.
  --pkl                  Emit the Pkl draft. This is the default without --output.
  --id <id>              Override the generated review id.
  --output <review.pkl>  Write the draft to a file. Schema and model paths are resolved relative to this destination.

Examples:
  dspec spec-change scaffold fixtures/compat-before.pkl fixtures/compat-narrowing-after.pkl
  dspec spec-change scaffold --output fixtures/my-review.pkl fixtures/before.pkl fixtures/after.pkl
  dspec spec-change scaffold --json fixtures/compat-before.pkl fixtures/compat-breaking-after.pkl

For breaking changes, the draft declares the default breaking evidence policy
and leaves evidence empty so spec-change review can force migration,
deprecation, rollout, and owner-approval evidence before approval.
`;
}

export function parseSpecCompatibilityArgs(
  args: readonly string[],
  usageText: string,
): SpecCompatibilityOptions {
  let json = false;
  let markdown = false;
  const files: string[] = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    files.push(arg);
  }

  if (files.length !== 2 || (json && markdown)) {
    throw new CommandError(usageText);
  }
  return { beforeFile: files[0], afterFile: files[1], json, markdown };
}

export function parseSpecChangeReviewArgs(
  args: readonly string[],
  usageText: string,
): SpecChangeReviewOptions {
  let json = false;
  let markdown = false;
  const files: string[] = [];

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    files.push(arg);
  }

  if (files.length !== 1 || (json && markdown)) {
    throw new CommandError(usageText);
  }
  return { file: files[0], json, markdown };
}

export function parseScaffoldSpecChangeReviewArgs(
  args: readonly string[],
  usageText: string,
): ScaffoldSpecChangeReviewOptions {
  let id: string | null = null;
  let json = false;
  let pkl = false;
  let outputFile: string | null = null;
  const files: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--pkl") {
      pkl = true;
      continue;
    }
    if (arg === "--id") {
      id = args[index + 1] ?? null;
      index += 1;
      if (!id) throw new CommandError("--id requires a review id\n");
      continue;
    }
    if (arg === "--output") {
      outputFile = args[index + 1] ?? null;
      index += 1;
      if (!outputFile) throw new CommandError("--output requires a review path\n");
      continue;
    }
    files.push(arg);
  }

  if (files.length !== 2 || (json && pkl)) {
    throw new CommandError(usageText);
  }
  return { beforeFile: files[0], afterFile: files[1], id, json, outputFile };
}

export function runSpecCompatibility(
  args: readonly string[],
  context: SpecChangeCommandContext,
  { usageText = specChangeCompatUsage() }: { usageText?: string } = {},
): void {
  if (hasHelpFlag(args)) {
    context.write(usageText);
    return;
  }
  const { beforeFile, afterFile, json, markdown } = parseSpecCompatibilityArgs(
    args,
    usageText,
  );
  const beforeModel = context.loadModel(beforeFile);
  const afterModel = context.loadModel(afterFile);
  const report = context.specCompatibilityReport(beforeModel, afterModel);
  if (json) {
    context.write(context.stableJson(report));
    context.assertReportOk(report);
    return;
  }
  if (markdown) {
    context.write(context.renderSpecCompatibilityMarkdownReport(report));
    context.assertReportOk(report);
    return;
  }
  context.write(context.renderSpecCompatibilityReport(report));
  context.assertReportOk(report);
}

export function runSpecChangeReview(
  args: readonly string[],
  context: SpecChangeCommandContext,
  { usageText = specChangeReviewUsage() }: { usageText?: string } = {},
): void {
  if (hasHelpFlag(args)) {
    context.write(usageText);
    return;
  }
  const { file, json, markdown } = parseSpecChangeReviewArgs(args, usageText);
  const review = context.loadSpecChangeReview(file);
  const report = context.specChangeReviewReport(review, file);
  if (json) {
    context.write(context.stableJson(report));
    context.assertReportOk(report);
    return;
  }
  if (markdown) {
    const rendered = context.renderSpecChangeReviewMarkdownReport(report);
    if (report.status === "fail") throw new CommandError(rendered);
    context.write(rendered);
    return;
  }
  const rendered = context.renderSpecChangeReviewReport(report);
  if (report.status === "fail") throw new CommandError(rendered);
  context.write(rendered);
}

export function runSpecChangeScaffold(
  args: readonly string[],
  context: SpecChangeCommandContext,
  { usageText = scaffoldSpecChangeReviewUsage() }: { usageText?: string } = {},
): void {
  if (hasHelpFlag(args)) {
    context.write(usageText);
    return;
  }
  const { beforeFile, afterFile, id, json, outputFile } =
    parseScaffoldSpecChangeReviewArgs(args, usageText);
  const beforeModel = context.loadModel(beforeFile);
  const afterModel = context.loadModel(afterFile);
  const report = context.specChangeReviewScaffoldReport({
    beforeFile,
    afterFile,
    beforeModel,
    afterModel,
    id,
  });
  if (outputFile) {
    context.assertReportOk(report);
    const outputDraft = context.specChangeReviewDraftForOutput(
      report.draft,
      outputFile,
    );
    const output = context.writeSpecChangeReviewScaffold(outputFile, outputDraft);
    const outputReport = { ...report, draft: outputDraft, output };
    if (json) {
      context.write(context.stableJson(outputReport));
      return;
    }
    context.write(`ok: wrote spec change review scaffold ${output.path}\n`);
    context.write(`next: dspec spec-change review --json ${output.path}\n`);
    return;
  }
  if (json) {
    context.write(context.stableJson(report));
    context.assertReportOk(report);
    return;
  }
  context.assertReportOk(report);
  context.write(context.renderSpecChangeReviewDraftPkl(report.draft));
}

export function runSpecChangeCommand(
  args: readonly string[],
  context: SpecChangeCommandContext,
): void {
  const [subcommand, ...rest] = args;
  if (
    !subcommand
    || subcommand === "help"
    || subcommand === "--help"
    || subcommand === "-h"
  ) {
    context.write(specChangeUsage());
    return;
  }
  if (subcommand === "compat") {
    runSpecCompatibility(rest, context);
    return;
  }
  if (subcommand === "review") {
    runSpecChangeReview(rest, context);
    return;
  }
  if (subcommand === "scaffold") {
    runSpecChangeScaffold(rest, context);
    return;
  }
  throw new CommandError(
    `unknown spec-change subcommand: ${subcommand}\n${specChangeUsage()}`,
  );
}
