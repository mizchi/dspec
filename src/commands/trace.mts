import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import {
  createTraceLock,
  traceCheck,
  traceSnapshot,
} from "../core/trace-lock.mjs";
import type { TraceCheckReport } from "../core/trace-lock.mjs";
import { CommandError } from "./error.mjs";

type TraceOperation = "check" | "reconcile";

export type TraceOptions = {
  operation: TraceOperation;
  file: string;
  json: boolean;
  gate: boolean;
  diff: boolean;
  output: string | null;
  lock: string | null;
};

export type TraceReport = TraceCheckReport & {
  scope?: {
    kind: string;
    changedPaths: string[];
  };
};

type TraceCommandContext = {
  loadTraceDocument: (file: string) => unknown;
  readJsonFile: (path: string, label: string) => unknown;
  sha256Digest: (value: string) => string;
  stableJson: (value: unknown) => string;
  write: (value: string) => void;
};

type ChangedWorktreePaths = {
  paths: Set<string>;
  error: string | null;
};

export function traceUsage(): string {
  return `usage:
  dspec trace reconcile [--json] [--output <trace.lock.json>] <model.pkl>
  dspec trace check [--json] [--gate] [--diff] [--lock <trace.lock.json>] <model.pkl>

Materialize and compare a reviewed hash lock for Rule.id, its specification
content, and explicitly declared implementation/test/check references.

reconcile is the explicit approval step that replaces the trace lock.
check reports drift without failing by default; add --gate for CI or a hook.
--diff limits the gate to links whose source path is changed in the Git worktree.
coverage (uncovered, impl-only, test-only, verified) is reported separately
from hash drift.
`;
}

export function parseTraceArgs(args: readonly string[]): TraceOptions {
  const [operationValue, ...rest] = args;
  if (operationValue !== "reconcile" && operationValue !== "check") {
    throw new CommandError(traceUsage());
  }
  const operation: TraceOperation = operationValue;
  let json = false;
  let gate = false;
  let diff = false;
  let output: string | null = null;
  let lock: string | null = null;
  let file: string | null = null;
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
    if (arg === "--diff" && operation === "check") {
      diff = true;
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
    throw new CommandError(traceUsage());
  }
  if (!file || !file.endsWith(".pkl") || (output !== null && !output) || (lock !== null && !lock)) {
    throw new CommandError(traceUsage());
  }
  return { operation, file, json, gate, diff, output, lock };
}

export function defaultTraceLockPath(modelFile: string): string {
  const extension = ".pkl";
  const base = modelFile.endsWith(extension)
    ? modelFile.slice(0, -extension.length)
    : modelFile;
  return `${base}.trace.lock.json`;
}

function relativeWorktreePath(path: string): string {
  return relative(process.cwd(), resolve(path)).replaceAll("\\", "/");
}

function changedWorktreePaths(): ChangedWorktreePaths {
  const tracked = spawnSync("git", ["diff", "--name-only", "HEAD"], { encoding: "utf8" });
  if (tracked.status !== 0) {
    return { paths: new Set(), error: tracked.stderr || "git diff failed" };
  }
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], {
    encoding: "utf8",
  });
  if (untracked.status !== 0) {
    return { paths: new Set(), error: untracked.stderr || "git ls-files failed" };
  }
  return {
    paths: new Set(
      `${tracked.stdout}\n${untracked.stdout}`
        .split("\n")
        .map((path) => path.trim())
        .filter(Boolean),
    ),
    error: null,
  };
}

function traceKeyPath(key: unknown): string | null {
  const separator = String(key).indexOf(":");
  if (separator < 0) return null;
  const pathAndSymbol = String(key).slice(separator + 1);
  return pathAndSymbol.split("#", 1)[0] ?? null;
}

export function scopeTraceReportToChangedPaths(
  report: TraceReport,
  modelPath: string,
  changedPaths: ReadonlySet<string>,
): TraceReport {
  const drift = report.drift.filter((entry) => {
    if (entry.kind.startsWith("rule-")) return changedPaths.has(modelPath);
    const sourcePath = traceKeyPath(entry.key);
    return sourcePath !== null && changedPaths.has(sourcePath);
  });
  return {
    ...report,
    status: report.errors.length === 0 && drift.length === 0 ? "pass" : "fail",
    drift,
    scope: { kind: "diff", changedPaths: [...changedPaths].sort() },
  };
}

function scopeTraceReportToDiff(report: TraceReport, modelFile: string): TraceReport {
  const changed = changedWorktreePaths();
  if (changed.error) {
    return {
      ...report,
      status: "fail",
      errors: [...report.errors, `trace diff scope failed: ${changed.error.trim()}`],
      scope: { kind: "diff", changedPaths: [] },
    };
  }
  return scopeTraceReportToChangedPaths(
    report,
    relativeWorktreePath(modelFile),
    changed.paths,
  );
}

export function renderTraceReport(report: TraceReport): string {
  if (report.status === "pass") {
    const verified = report.coverage.filter((entry) => entry.status === "verified").length;
    return `ok: ${report.model.id} trace (${report.scope?.kind ?? "all"}, ${verified}/${report.coverage.length} verified)\n`;
  }
  const lines = ["trace drift:"];
  for (const entry of report.drift) {
    lines.push(`  ${entry.kind}: ${entry.rule} -> ${entry.key}`);
  }
  for (const error of report.errors) lines.push(`  error: ${error}`);
  return `${lines.join("\n")}\n`;
}

function hasHelpFlag(args: readonly string[]): boolean {
  return args.some((arg) => arg === "--help" || arg === "-h" || arg === "help");
}

export function runTraceCommand(args: readonly string[], context: TraceCommandContext): void {
  if (hasHelpFlag(args)) {
    context.write(traceUsage());
    return;
  }
  const options = parseTraceArgs(args);
  const document = context.loadTraceDocument(options.file);
  if (options.operation === "reconcile") {
    const snapshot = traceSnapshot(document);
    if (snapshot.status === "fail") throw new CommandError(`${snapshot.errors.join("\n")}\n`);
    const lock = createTraceLock(snapshot);
    const output = resolve(options.output ?? defaultTraceLockPath(options.file));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, context.stableJson(lock));
    const report = {
      status: "pass",
      model: snapshot.model,
      lock: {
        path: output,
        rules: lock.rules.length,
        digest: context.sha256Digest(context.stableJson(lock)),
      },
    };
    if (options.json) {
      context.write(context.stableJson(report));
      return;
    }
    context.write(`ok: reconciled trace ${report.lock.path} (${report.lock.rules} rules)\n`);
    return;
  }

  const lockPath = resolve(options.lock ?? defaultTraceLockPath(options.file));
  if (!existsSync(lockPath)) {
    throw new CommandError(
      `trace lock not found: ${lockPath}; run dspec trace reconcile ${options.file}\n`,
    );
  }
  let report: TraceReport = traceCheck(
    document,
    context.readJsonFile(lockPath, "trace lock"),
  );
  if (options.diff) report = scopeTraceReportToDiff(report, options.file);
  else report = { ...report, scope: { kind: "all", changedPaths: [] } };
  if (options.json) context.write(context.stableJson(report));
  else context.write(renderTraceReport(report));
  if (options.gate && report.status === "fail") {
    throw new CommandError("trace gate failed\n");
  }
}
