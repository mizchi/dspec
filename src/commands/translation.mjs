import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createTranslationLock, translationCheck, translationSnapshot, } from "../core/translation-lock.mjs";
import { CommandError } from "./error.mjs";
export function translationUsage() {
    return `usage:
  dspec translation reconcile [--json] [--output <translation.lock.json>] <model.pkl>
  dspec translation check [--json] [--gate] [--lock <translation.lock.json>] <model.pkl>

Materialize and compare a reviewed source-to-translation lock for LocalizedText.

The model primaryLocale is the source language. i18n.requiredLocales selects
targets; when it is empty, every declared non-primary locale is a target.
reconcile is the explicit review step that replaces the translation lock.
check reports stale source/translation or terminology changes; add --gate for CI.
It detects freshness and required labels, not semantic equivalence of languages.
`;
}
export function parseTranslationArgs(args) {
    const [operationValue, ...rest] = args;
    if (operationValue !== "reconcile" && operationValue !== "check") {
        throw new CommandError(translationUsage());
    }
    const operation = operationValue;
    let json = false;
    let gate = false;
    let output = null;
    let lock = null;
    let file = null;
    for (let index = 0; index < rest.length; index += 1) {
        const arg = rest[index];
        if (arg === "--json") {
            json = true;
            continue;
        }
        if (arg === "--gate" && operation === "check") {
            gate = true;
            continue;
        }
        if (arg === "--output" && operation === "reconcile") {
            output = rest[index + 1] ?? "";
            index += 1;
            continue;
        }
        if (arg === "--lock" && operation === "check") {
            lock = rest[index + 1] ?? "";
            index += 1;
            continue;
        }
        if (!file) {
            file = arg;
            continue;
        }
        throw new CommandError(translationUsage());
    }
    if (!file || !file.endsWith(".pkl") || (output !== null && !output) || (lock !== null && !lock)) {
        throw new CommandError(translationUsage());
    }
    return { operation, file, json, gate, output, lock };
}
export function defaultTranslationLockPath(modelFile) {
    const extension = ".pkl";
    const base = modelFile.endsWith(extension)
        ? modelFile.slice(0, -extension.length)
        : modelFile;
    return `${base}.translation.lock.json`;
}
export function renderTranslationReport(report) {
    if (report.status === "pass") {
        return `ok: ${report.model.id} translations (${report.entries.length} bindings)\n`;
    }
    const lines = ["translation drift:"];
    for (const entry of report.drift)
        lines.push(`  ${entry.kind}: ${entry.key}`);
    for (const error of report.errors)
        lines.push(`  error: ${error}`);
    return `${lines.join("\n")}\n`;
}
function hasHelpFlag(args) {
    return args.some((arg) => arg === "--help" || arg === "-h" || arg === "help");
}
export function runTranslationCommand(args, context) {
    if (hasHelpFlag(args)) {
        context.write(translationUsage());
        return;
    }
    const options = parseTranslationArgs(args);
    const document = context.loadTraceDocument(options.file);
    if (options.operation === "reconcile") {
        const snapshot = translationSnapshot(document);
        if (snapshot.status === "fail")
            throw new CommandError(`${snapshot.errors.join("\n")}\n`);
        const lock = createTranslationLock(snapshot);
        const output = resolve(options.output ?? defaultTranslationLockPath(options.file));
        mkdirSync(dirname(output), { recursive: true });
        writeFileSync(output, context.stableJson(lock));
        const report = {
            status: "pass",
            model: snapshot.model,
            lock: {
                path: output,
                bindings: lock.entries.length,
                digest: context.sha256Digest(context.stableJson(lock)),
            },
        };
        if (options.json) {
            context.write(context.stableJson(report));
            return;
        }
        context.write(`ok: reconciled translations ${report.lock.path} (${report.lock.bindings} bindings)\n`);
        return;
    }
    const lockPath = resolve(options.lock ?? defaultTranslationLockPath(options.file));
    if (!existsSync(lockPath)) {
        throw new CommandError(`translation lock not found: ${lockPath}; run dspec translation reconcile ${options.file}\n`);
    }
    const report = translationCheck(document, context.readJsonFile(lockPath, "translation lock"));
    if (options.json)
        context.write(context.stableJson(report));
    else
        context.write(renderTranslationReport(report));
    if (options.gate && report.status === "fail") {
        throw new CommandError("translation gate failed\n");
    }
}
