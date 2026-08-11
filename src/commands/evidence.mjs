import { CommandError } from "./error.mjs";
const systemNow = () => new Date().toISOString();
function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function list(value) {
    return Array.isArray(value) ? value : [];
}
function modelId(model) {
    return record(model)?.id;
}
export function evidenceUsage() {
    return `usage:
  dspec evidence create [--json] [--output <manifest.json>] [--executed-at <iso>] [--intent-report <exercise.json>] [--require-formal-tools] <model.pkl>
  dspec evidence verify [--json] <model.pkl> <manifest.json>
  dspec evidence refresh [--json] [--executed-at <iso>] [--intent-report <exercise.json>] [--require-formal-tools] <model.pkl> <manifest.json>
`;
}
export function parseEvidenceCreateArgs(args, now = systemNow) {
    let json = false;
    let outputFile = null;
    let executedAt = null;
    let requireFormalTools = false;
    const intentReportFiles = [];
    const files = [];
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
            if (!outputFile)
                throw new CommandError("--output requires a manifest path\n");
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
                throw new CommandError("--intent-report requires an Intent exercise report path\n");
            }
            intentReportFiles.push(reportFile);
            continue;
        }
        files.push(arg);
    }
    if (files.length !== 1)
        throw new CommandError(evidenceUsage());
    return {
        modelFile: files[0],
        json,
        outputFile,
        executedAt: executedAt ?? now(),
        requireFormalTools,
        intentReportFiles,
    };
}
export function parseEvidenceVerifyArgs(args) {
    let json = false;
    const files = [];
    for (const arg of args) {
        if (arg === "--json") {
            json = true;
            continue;
        }
        files.push(arg);
    }
    if (files.length !== 2)
        throw new CommandError(evidenceUsage());
    return { modelFile: files[0], manifestFile: files[1], json };
}
export function parseEvidenceRefreshArgs(args, now = systemNow) {
    let json = false;
    let executedAt = null;
    let requireFormalTools = false;
    const intentReportFiles = [];
    const files = [];
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
                throw new CommandError("--intent-report requires an Intent exercise report path\n");
            }
            intentReportFiles.push(reportFile);
            continue;
        }
        files.push(arg);
    }
    if (files.length !== 2)
        throw new CommandError(evidenceUsage());
    return {
        modelFile: files[0],
        manifestFile: files[1],
        json,
        executedAt: executedAt ?? now(),
        requireFormalTools,
        intentReportFiles,
    };
}
function inheritedIntentReportFiles(manifest) {
    return list(record(manifest)?.intentExercises)
        .map((entry) => record(record(entry)?.report)?.path)
        .filter((path) => typeof path === "string" && path.length > 0);
}
export function runEvidenceCreate(args, context) {
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
export function runEvidenceVerify(args, context) {
    const options = parseEvidenceVerifyArgs(args);
    const model = context.loadModel(options.modelFile);
    const manifest = context.readJsonFile(options.manifestFile, "assurance evidence manifest");
    const report = context.assuranceEvidenceVerificationReport(model, manifest);
    if (options.json) {
        context.write(context.stableJson(report));
        context.assertReportOk(report);
        return;
    }
    context.assertReportOk(report);
    context.write(`ok: ${modelId(model)} assurance evidence (${report.summary.artifacts} artifacts, ${report.summary.clauseBindings} clause bindings)\n`);
}
export function runEvidenceRefresh(args, context) {
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
    const output = context.writeAssuranceEvidenceManifest(options.manifestFile, manifest);
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
export function runEvidenceCommand(args, context) {
    const [subcommand, ...rest] = args;
    if (!subcommand
        || subcommand === "help"
        || subcommand === "--help"
        || subcommand === "-h") {
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
    throw new CommandError(`unknown evidence subcommand: ${subcommand}\n${evidenceUsage()}`);
}
