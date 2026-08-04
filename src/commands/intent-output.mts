import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { CommandError } from "./error.mjs";

type Report = { status: string; output?: unknown; [key: string]: any };
type Options = { json: boolean; markdown: boolean; outputFile?: string | null };
type OutputContext = {
  stableJson: (value: unknown) => string;
  digest: (value: string) => string;
  write: (value: string) => void;
};

export function persistIntentReport(path: string, report: Report, { stableJson, digest }: OutputContext): { path: string; bytes: number; digest: string } {
  const content = stableJson(report);
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, content);
  return { path, bytes: Buffer.byteLength(content, "utf8"), digest: digest(content) };
}

export function writeIntentAnalysisReport(
  report: Report,
  options: Options,
  render: (report: Report) => string,
  successMessage: string,
  context: OutputContext,
): void {
  if (options.outputFile) report.output = persistIntentReport(options.outputFile, report, context);
  if (options.json) {
    context.write(context.stableJson(report));
    if (report.status === "fail") throw new CommandError("intent trace analysis failed\n");
    return;
  }
  const markdown = render(report);
  if (options.markdown) {
    context.write(markdown);
    if (report.status === "fail") throw new CommandError("intent trace analysis failed\n");
    return;
  }
  if (report.status === "fail") throw new CommandError(markdown);
  context.write(successMessage);
}

export function writeIntentCommandReport(
  report: Report,
  options: Options,
  render: (report: Report) => string,
  successMessage: string,
  context: OutputContext,
): void {
  if (options.outputFile) report.output = persistIntentReport(options.outputFile, report, context);
  if (options.json) {
    context.write(context.stableJson(report));
    if (report.status === "fail") throw new CommandError("intent trace verification failed\n");
    return;
  }
  const markdown = render(report);
  if (options.markdown) {
    context.write(markdown);
    if (report.status === "fail") throw new CommandError("intent trace verification failed\n");
    return;
  }
  if (report.status === "fail") throw new CommandError(markdown);
  context.write(successMessage);
}
