#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const check = args[0] === "--check";
const values = check ? args.slice(1) : args;
const [modelPath, outputPath] = values;

function insideProject(path) {
  const fromRoot = relative(process.cwd(), path);
  return fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !fromRoot.startsWith(".."));
}

if (!modelPath || !outputPath || values.length !== 2) {
  process.stderr.write("usage: node scripts/generate-traceability-report.mjs [--check] <model.pkl> <output.md>\n");
  process.exitCode = 64;
} else {
  const output = resolve(process.cwd(), outputPath);
  if (!insideProject(output)) {
    process.stderr.write(`output path escapes project root: ${outputPath}\n`);
    process.exitCode = 64;
  } else {
    const result = spawnSync(process.execPath, ["src/cli.mjs", "traceability", "--markdown", modelPath], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    if (result.status !== 0) {
      process.stderr.write(result.stderr || result.stdout || `traceability exited ${result.status}\n`);
      process.exitCode = result.status ?? 1;
    } else if (check) {
      if (!existsSync(output) || readFileSync(output, "utf8") !== result.stdout) {
        process.stderr.write(`generated traceability report drift: ${outputPath}\n`);
        process.exitCode = 1;
      }
    } else {
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, result.stdout, "utf8");
      process.stdout.write(`${outputPath}\n`);
    }
  }
}
