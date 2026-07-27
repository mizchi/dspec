#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import { compileTetrisLineClearAlloyModel, validateTetrisLineClearAlloyModel } from "../src/core/tetris-line-clear-alloy.mjs";

const args = process.argv.slice(2);
const check = args[0] === "--check";
const values = check ? args.slice(1) : args;
const [modelPath, outputPath] = values;

function insideProject(path) {
  const fromRoot = relative(process.cwd(), path);
  return fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !fromRoot.startsWith(".."));
}

if (!modelPath || !outputPath || values.length !== 2) {
  process.stderr.write("usage: node scripts/generate-tetris-line-clear-alloy.mjs [--check] <model.pkl> <output.als>\n");
  process.exitCode = 64;
} else {
  const document = evaluatePklJson(modelPath);
  const errors = validateTetrisLineClearAlloyModel(document);
  const output = resolve(process.cwd(), outputPath);
  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n")}\n`);
    process.exitCode = 1;
  } else if (!insideProject(output)) {
    process.stderr.write(`output path escapes project root: ${outputPath}\n`);
    process.exitCode = 64;
  } else {
    const source = compileTetrisLineClearAlloyModel(document).alloySource;
    if (check) {
      if (!existsSync(output) || readFileSync(output, "utf8") !== source) {
        process.stderr.write(`generated Tetris line-clear Alloy source drift: ${outputPath}\n`);
        process.exitCode = 1;
      }
    } else {
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, source, "utf8");
      process.stdout.write(`${outputPath}\n`);
    }
  }
}
