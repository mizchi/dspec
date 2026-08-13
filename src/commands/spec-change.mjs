import { CommandError } from "./error.mjs";
function hasHelpFlag(args) {
    return args.includes("--help") || args.includes("-h");
}
export function specChangeUsage() {
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
export function specChangeCompatUsage() {
    return `usage:
  dspec spec-change compat [--json|--markdown] <before.pkl> <after.pkl>

Compare before/after spec models and classify the compatibility change.

Options:
  --json      Emit the compatibility report as JSON.
  --markdown  Emit a human-readable Markdown review report.
`;
}
export function specChangeReviewUsage() {
    return `usage:
  dspec spec-change review [--json|--markdown] <review.pkl>

Run a typed SpecChangeReview Pkl plan as one spec-change gate.

Options:
  --json      Emit the review report as JSON.
  --markdown  Emit a human-readable Markdown review report.
`;
}
export function scaffoldSpecChangeReviewUsage() {
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
export function parseSpecCompatibilityArgs(args, usageText) {
    let json = false;
    let markdown = false;
    const files = [];
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
export function parseSpecChangeReviewArgs(args, usageText) {
    let json = false;
    let markdown = false;
    const files = [];
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
export function parseScaffoldSpecChangeReviewArgs(args, usageText) {
    let id = null;
    let json = false;
    let pkl = false;
    let outputFile = null;
    const files = [];
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
            if (!id)
                throw new CommandError("--id requires a review id\n");
            continue;
        }
        if (arg === "--output") {
            outputFile = args[index + 1] ?? null;
            index += 1;
            if (!outputFile)
                throw new CommandError("--output requires a review path\n");
            continue;
        }
        files.push(arg);
    }
    if (files.length !== 2 || (json && pkl)) {
        throw new CommandError(usageText);
    }
    return { beforeFile: files[0], afterFile: files[1], id, json, outputFile };
}
export function runSpecCompatibility(args, context, { usageText = specChangeCompatUsage() } = {}) {
    if (hasHelpFlag(args)) {
        context.write(usageText);
        return;
    }
    const { beforeFile, afterFile, json, markdown } = parseSpecCompatibilityArgs(args, usageText);
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
export function runSpecChangeReview(args, context, { usageText = specChangeReviewUsage() } = {}) {
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
        if (report.status === "fail")
            throw new CommandError(rendered);
        context.write(rendered);
        return;
    }
    const rendered = context.renderSpecChangeReviewReport(report);
    if (report.status === "fail")
        throw new CommandError(rendered);
    context.write(rendered);
}
export function runSpecChangeScaffold(args, context, { usageText = scaffoldSpecChangeReviewUsage() } = {}) {
    if (hasHelpFlag(args)) {
        context.write(usageText);
        return;
    }
    const { beforeFile, afterFile, id, json, outputFile } = parseScaffoldSpecChangeReviewArgs(args, usageText);
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
        const outputDraft = context.specChangeReviewDraftForOutput(report.draft, outputFile);
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
export function runSpecChangeCommand(args, context) {
    const [subcommand, ...rest] = args;
    if (!subcommand
        || subcommand === "help"
        || subcommand === "--help"
        || subcommand === "-h") {
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
    throw new CommandError(`unknown spec-change subcommand: ${subcommand}\n${specChangeUsage()}`);
}
