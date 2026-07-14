#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { emitMarkdown } from "../src/cli.mjs";

function loadModel(file) {
  const result = spawnSync("pkl", ["eval", "-f", "json", file], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `pkl eval failed: ${file}`);
  }
  const document = JSON.parse(result.stdout);
  return document.model ?? document;
}

function modelLocales(model) {
  const locales = [...new Set(model.locales ?? [])].toSorted();
  if (locales.length === 0) throw new Error("model.locales must declare at least one locale");
  for (const locale of locales) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(locale)) {
      throw new Error(`locale cannot be used as a directory name: ${locale}`);
    }
  }
  return locales;
}

function expectedArtifacts(modelFile, outputRoot) {
  const model = loadModel(modelFile);
  const name = basename(modelFile, extname(modelFile));
  return modelLocales(model).map((locale) => ({
    content: emitMarkdown(model, locale),
    locale,
    path: join(outputRoot, locale, `${name}.md`),
  }));
}

export function generateLocalizedMarkdown(modelFile, outputRoot) {
  const artifacts = expectedArtifacts(modelFile, outputRoot);
  const parent = dirname(outputRoot);
  mkdirSync(parent, { recursive: true });
  const staging = mkdtempSync(join(parent, `.${basename(outputRoot)}-`));
  try {
    for (const artifact of artifacts) {
      const path = join(staging, artifact.locale, basename(artifact.path));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, artifact.content);
    }
    rmSync(outputRoot, { recursive: true, force: true });
    renameSync(staging, outputRoot);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return artifacts.map((artifact) => artifact.path);
}

export function checkLocalizedMarkdown(modelFile, outputRoot) {
  const artifacts = expectedArtifacts(modelFile, outputRoot);
  const expectedLocales = artifacts.map((artifact) => artifact.locale);
  const actualLocales = existsSync(outputRoot) ? readdirSync(outputRoot).toSorted() : [];
  const errors = [];
  if (JSON.stringify(actualLocales) !== JSON.stringify(expectedLocales)) {
    errors.push(`locale directories differ: expected ${expectedLocales.join(", ")}; found ${actualLocales.join(", ") || "none"}`);
  }
  for (const artifact of artifacts) {
    if (!existsSync(artifact.path)) {
      errors.push(`missing localized Markdown: ${artifact.path}`);
    } else if (readFileSync(artifact.path, "utf8") !== artifact.content) {
      errors.push(`stale localized Markdown: ${artifact.path}`);
    }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const check = args[0] === "--check";
  if (check) args.shift();
  const modelFile = resolve(args[0] ?? "examples/dspec.pkl");
  const outputRoot = resolve(args[1] ?? "generated/examples");
  try {
    if (check) {
      const errors = checkLocalizedMarkdown(modelFile, outputRoot);
      if (errors.length > 0) {
        process.stderr.write(`${errors.join("\n")}\n`);
        process.exitCode = 1;
      }
    } else {
      generateLocalizedMarkdown(modelFile, outputRoot);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
