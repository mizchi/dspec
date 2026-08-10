#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const quint = join(root, "node_modules", ".bin", "quint");
const directory = mkdtempSync(join(tmpdir(), "dspec-quint-typecheck-"));
const input = join(directory, "model.qnt");

try {
  writeFileSync(input, readFileSync(0, "utf8"));
  const result = spawnSync(quint, ["typecheck", input], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error.message);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
