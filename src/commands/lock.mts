import { CommandError } from "./error.mjs";
import { defaultSchemaLockPath, writeSchemaLock } from "./schema-lock.mjs";

export type LockOptions = {
  file: string;
  force: boolean;
  json: boolean;
  outputFile: string | null;
};

type LockCommandContext = {
  loadModel: (file: string) => unknown;
  modelReport: (model: unknown) => unknown;
  stableJson: (value: unknown) => string;
  write: (value: string) => void;
};

export function lockUsage(): string {
  return `usage:
  dspec lock [--json] [--force] [--output <lock.json>] <model.pkl>

Record the imported Schema.pkl module graph and package metadata in a lock file.

Options:
  --json               Emit the lock report as JSON.
  --force              Replace an existing lock file.
  --output <lock.json> Select the lock file (default: <model>.lock.json).
`;
}

export function parseLockArgs(args: readonly string[]): LockOptions {
  let force = false;
  let json = false;
  let outputFile: string | null = null;
  let file: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") {
      force = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--output") {
      outputFile = args[index + 1] ?? "";
      index += 1;
    } else if (!arg.startsWith("-") && !file) {
      file = arg;
    } else {
      throw new CommandError(lockUsage());
    }
  }

  if (!file || (outputFile !== null && (!outputFile || outputFile.startsWith("-")))) {
    throw new CommandError(lockUsage());
  }
  return { file, force, json, outputFile };
}

function hasHelpFlag(args: readonly string[]): boolean {
  return args[0] === "--help" || args[0] === "-h" || args[0] === "help";
}

export function runLockCommand(args: readonly string[], context: LockCommandContext): void {
  if (hasHelpFlag(args)) {
    context.write(lockUsage());
    return;
  }
  const { file, outputFile, force, json } = parseLockArgs(args);
  const model = context.loadModel(file);
  const selectedLockFile = outputFile ?? defaultSchemaLockPath(file);
  const lock = writeSchemaLock({ modelFile: file, lockFile: selectedLockFile, force });
  const report = { status: "pass", model: context.modelReport(model), lock };
  if (json) {
    context.write(context.stableJson(report));
    return;
  }
  context.write(`ok: wrote schema lock ${lock.path} (${lock.files} modules)\n`);
}
