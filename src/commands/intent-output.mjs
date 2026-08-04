import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { CommandError } from "./error.mjs";
export function persistIntentReport(path, report, { stableJson, digest }) {
    const content = stableJson(report);
    mkdirSync(dirname(resolve(path)), { recursive: true });
    writeFileSync(path, content);
    return { path, bytes: Buffer.byteLength(content, "utf8"), digest: digest(content) };
}
export function writeIntentAnalysisReport(report, options, render, successMessage, context) {
    if (options.outputFile)
        report.output = persistIntentReport(options.outputFile, report, context);
    if (options.json) {
        context.write(context.stableJson(report));
        if (report.status === "fail")
            throw new CommandError("intent trace analysis failed\n");
        return;
    }
    const markdown = render(report);
    if (options.markdown) {
        context.write(markdown);
        if (report.status === "fail")
            throw new CommandError("intent trace analysis failed\n");
        return;
    }
    if (report.status === "fail")
        throw new CommandError(markdown);
    context.write(successMessage);
}
export function writeIntentCommandReport(report, options, render, successMessage, context) {
    if (options.outputFile)
        report.output = persistIntentReport(options.outputFile, report, context);
    if (options.json) {
        context.write(context.stableJson(report));
        if (report.status === "fail")
            throw new CommandError("intent trace verification failed\n");
        return;
    }
    const markdown = render(report);
    if (options.markdown) {
        context.write(markdown);
        if (report.status === "fail")
            throw new CommandError("intent trace verification failed\n");
        return;
    }
    if (report.status === "fail")
        throw new CommandError(markdown);
    context.write(successMessage);
}
