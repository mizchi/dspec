import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export class PklAdapterError extends Error {
  constructor(message, status = 1) {
    super(message);
    this.status = status;
  }
}

function enclosingPklProject(file) {
  let directory = dirname(resolve(file));
  while (true) {
    if (existsSync(join(directory, "PklProject"))) return directory;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

export function evaluatePklJson(file, { command = "pkl", projectDir = enclosingPklProject(file) } = {}) {
  const args = ["eval", "-f", "json"];
  if (projectDir) args.push("--project-dir", projectDir);
  args.push(file);
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new PklAdapterError(result.stderr || result.stdout || `pkl eval failed: ${file}`, result.status ?? 1);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new PklAdapterError(`failed to parse pkl json output for ${file}: ${error.message}`);
  }
}
