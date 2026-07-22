import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suitePath = process.argv[2] ?? "fixtures/checker-conformance-suite.json";
const suite = JSON.parse(readFileSync(resolve(repositoryRoot, suitePath), "utf8"));

assert.equal(suite.contractVersion, "dspec-checker-conformance-v1");
assert.ok(Array.isArray(suite.cases) && suite.cases.length > 0, "conformance suite must declare cases");

for (const entry of suite.cases) {
  const result = spawnSync(process.execPath, ["src/cli.mjs", ...entry.argv], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${entry.id} failed\n${result.stderr}`);
  const expected = JSON.parse(readFileSync(resolve(repositoryRoot, entry.expectedReport), "utf8"));
  const actual = JSON.parse(result.stdout);
  assert.deepEqual(actual, expected, `${entry.id} report differs from ${entry.expectedReport}`);
  process.stdout.write(`ok: ${entry.id}\n`);
}
