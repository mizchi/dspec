#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluatePklJson } from "../src/adapters/pkl.mjs";
import { renderLeanTransitionSystem } from "../src/core/lean-semantic-core.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arguments_ = process.argv.slice(2);
const check = arguments_[0] === "--check";
const [modelPath] = check ? arguments_.slice(1) : arguments_;

function generatedPath(source) {
  const path = resolve(repositoryRoot, source);
  const pathFromRoot = relative(repositoryRoot, path);
  if (pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== ".." && !pathFromRoot.startsWith(".."))) {
    return path;
  }
  throw new Error(`generated Lean transition source escapes project root: ${source}`);
}

if (!modelPath || arguments_.length !== (check ? 2 : 1)) {
  process.stderr.write("usage: node scripts/generate-lean-transition.mjs [--check] <model.pkl>\n");
  process.exitCode = 64;
} else {
  try {
    const document = evaluatePklJson(modelPath);
    const core = document?.leanCore;
    if (typeof core?.generatedSource !== "string" || !core.generatedSource.endsWith(".lean")) {
      throw new Error("leanCore generatedSource must be a .lean path");
    }
    const output = generatedPath(core.generatedSource);
    const rendered = renderLeanTransitionSystem(core.transitionSystem);
    const current = existsSync(output) ? readFileSync(output, "utf8") : null;
    if (check) {
      if (current !== rendered) {
        throw new Error(`generated Lean transition source drift: ${core.generatedSource}`);
      }
      process.stdout.write(`ok: ${core.generatedSource} is synchronized\n`);
    } else {
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, rendered);
      process.stdout.write(`generated: ${core.generatedSource}\n`);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
