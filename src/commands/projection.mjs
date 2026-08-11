import { CommandError } from "./error.mjs";
const systemNow = () => new Date().toISOString();
function hasHelpFlag(args) {
    return args.includes("--help") || args.includes("-h");
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export function generatedUsage() {
    return `usage:
  dspec generated check [--json] [--root <dir>] <model.pkl>
  dspec generated unlock [--json] [--force] [--root <dir>]
`;
}
export function parseProjectionArgs(args, usageText, { allowGenerationOptions = false } = {}) {
    let file = null;
    let dryRun = false;
    let generatedAt = null;
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
            if (!generatedAt)
                throw new CommandError(usageText);
            if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(generatedAt)) {
                throw new CommandError(`invalid --generated-at: ${generatedAt}`);
            }
            index += 1;
            continue;
        }
        if (arg === "--root") {
            root = args[index + 1] ?? "";
            if (!root)
                throw new CommandError(usageText);
            index += 1;
            continue;
        }
        if (!file) {
            file = arg;
            continue;
        }
        throw new CommandError(`unexpected argument: ${arg}\n${usageText}`);
    }
    if (!file)
        throw new CommandError(usageText);
    return { file, dryRun, generatedAt, json, root };
}
export function parseProjectionUnlockArgs(args, usageText = generatedUsage()) {
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
            if (!root)
                throw new CommandError(usageText);
            index += 1;
            continue;
        }
        throw new CommandError(`unexpected argument: ${arg}\n${usageText}`);
    }
    return { force, json, root };
}
export function runGenerateCommand(args, context) {
    const options = parseProjectionArgs(args, context.generateUsage, { allowGenerationOptions: true });
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
    if (report.status === "fail")
        throw new CommandError(rendered);
    context.write(rendered);
}
export function runGeneratedCommand(args, context) {
    const [subcommand, ...rest] = args;
    if (!subcommand
        || subcommand === "help"
        || subcommand === "--help"
        || subcommand === "-h") {
        context.write(generatedUsage());
        return;
    }
    if (subcommand !== "check" && subcommand !== "unlock") {
        throw new CommandError(`unknown generated subcommand: ${subcommand}\n${generatedUsage()}`);
    }
    if (hasHelpFlag(rest)) {
        context.write(generatedUsage());
        return;
    }
    if (subcommand === "unlock") {
        const options = parseProjectionUnlockArgs(rest);
        let report;
        try {
            report = context.recoverProjectionLock(options.root, { force: options.force });
        }
        catch (error) {
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
        context.write(`ok: recovered Projection generation lock (${report.previous.liveness}, lease ${report.previous.lease.status}${report.forced ? ", forced" : ""})\n`);
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
    if (report.status === "fail")
        throw new CommandError(rendered);
    context.write(rendered);
}
