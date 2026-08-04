import { CommandError } from "./error.mjs";

export type AppProfileArgs = {
  files: string[];
  fix: boolean;
  dryRun: boolean;
  json: boolean;
  markdown: boolean;
};

export function parseAppProfileArgs(args: string[], usageText: string): AppProfileArgs {
  let dryRun = false;
  let fix = false;
  let json = false;
  let markdown = false;
  const files: string[] = [];

  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--fix") {
      fix = true;
      continue;
    }
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

  if (files.length === 0 || (json && markdown)) {
    throw new CommandError(usageText);
  }
  if (dryRun && !fix) {
    throw new CommandError("--dry-run requires --fix\n");
  }
  return { files, fix, dryRun, json, markdown };
}

export function parseAppProfileSuiteArgs(args: string[], usageText: string): Omit<AppProfileArgs, "files"> & { file: string } {
  const parsed = parseAppProfileArgs(args, usageText);
  if (parsed.files.length !== 1) {
    throw new CommandError(usageText);
  }
  return {
    file: parsed.files[0],
    fix: parsed.fix,
    dryRun: parsed.dryRun,
    json: parsed.json,
    markdown: parsed.markdown,
  };
}

export type ScaffoldAppProfileArgs = {
  modelFile: string;
  appRoot: string;
  observedFacts: string | null;
  gates: string[];
  applyFile: string | null;
  diffFile: string | null;
  dryRun: boolean;
  json: boolean;
};

export function parseScaffoldAppProfileArgs(args: string[], usageText: string): ScaffoldAppProfileArgs {
  let applyFile: string | null = null;
  let diffFile: string | null = null;
  let dryRun = false;
  let json = false;
  let observedFacts: string | null = null;
  const gates: string[] = [];
  const files: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--diff") {
      diffFile = args[index + 1] ?? null;
      index += 1;
      if (!diffFile) throw new CommandError("--diff requires a profile path\n");
      continue;
    }
    if (arg === "--apply") {
      applyFile = args[index + 1] ?? null;
      index += 1;
      if (!applyFile) throw new CommandError("--apply requires a profile path\n");
      continue;
    }
    if (arg === "--observed-facts") {
      observedFacts = args[index + 1] ?? null;
      index += 1;
      if (!observedFacts) throw new CommandError("--observed-facts requires a path\n");
      continue;
    }
    if (arg === "--gate") {
      const gate = args[index + 1] ?? null;
      index += 1;
      if (!gate) throw new CommandError("--gate requires a gate name\n");
      gates.push(gate);
      continue;
    }
    files.push(arg);
  }

  if (files.length !== 2) {
    throw new CommandError(usageText);
  }
  if (diffFile && applyFile) {
    throw new CommandError("--diff and --apply are mutually exclusive\n");
  }
  if (dryRun && !applyFile) {
    throw new CommandError("--dry-run requires --apply for scaffold-app-profile\n");
  }
  if (json && !diffFile && !applyFile) {
    throw new CommandError("--json requires --diff or --apply for scaffold-app-profile\n");
  }
  return { modelFile: files[0], appRoot: files[1], observedFacts, gates, applyFile, diffFile, dryRun, json };
}

export function parseEvaluateAppProfileArgs(args: string[], usageText: string): { file: string; json: boolean; markdown: boolean } {
  let json = false;
  let markdown = false;
  let file: string | null = null;

  for (const arg of args) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--markdown") {
      markdown = true;
      continue;
    }
    if (!file) {
      file = arg;
      continue;
    }
    throw new CommandError(`unexpected argument: ${arg}`);
  }

  if (!file || (json && markdown)) {
    throw new CommandError(usageText);
  }
  return { file, json, markdown };
}
