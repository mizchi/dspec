#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import { compileBehaviorModel } from "../src/core/behavior.mjs";

const args = process.argv.slice(2);
const check = args[0] === "--check";
const values = check ? args.slice(1) : args;
const [modelPath, outputPath] = values;

function insideProject(path) {
  const fromRoot = relative(process.cwd(), path);
  return fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !fromRoot.startsWith(".."));
}

if (!modelPath || !outputPath || values.length !== 2) {
  process.stderr.write("usage: node scripts/generate-behavior-transition.mjs [--check] <model.pkl> <output.lean>\n");
  process.exitCode = 64;
} else {
  const output = resolve(process.cwd(), outputPath);
  if (!insideProject(output)) {
    process.stderr.write(`output path escapes project root: ${outputPath}\n`);
    process.exitCode = 64;
  } else {
    const source = compileBehaviorModel(evaluatePklJson(modelPath)).generatedLeanSource;
    if (check) {
      if (!existsSync(output) || readFileSync(output, "utf8") !== source) {
        process.stderr.write(`generated behavior Lean source drift: ${outputPath}\n`);
        process.exitCode = 1;
      }
    } else {
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, source, "utf8");
      process.stdout.write(`${outputPath}\n`);
    }
  }
}
