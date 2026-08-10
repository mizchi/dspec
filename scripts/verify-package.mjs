import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = mkdtempSync(join(tmpdir(), "dspec-package-"));
const packageVersion = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")).version;

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

try {
  const packed = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", temporaryRoot], repositoryRoot));
  const tarball = join(temporaryRoot, packed[0].filename);
  const consumerRoot = join(temporaryRoot, "consumer");
  mkdirSync(consumerRoot);
  writeFileSync(join(consumerRoot, "package.json"), JSON.stringify({ private: true, type: "module" }));
  run("npm", ["install", "--ignore-scripts", "--no-package-lock", tarball], consumerRoot);
  const dspec = join(consumerRoot, "node_modules", ".bin", "dspec");
  const packageRoot = join(consumerRoot, "node_modules", "@mizchi", "dspec");
  for (const source of ["examples/dspec.pkl", "examples/dspec.traceability.gql"]) {
    if (!existsSync(join(packageRoot, source))) throw new Error(`published package is missing self-traceability source: ${source}`);
  }
  run(dspec, ["--help"], consumerRoot);
  run(process.execPath, [
    "--input-type=module",
    "--eval",
    "import { externalHoldoutCorpusReport } from '@mizchi/dspec'; import { normalizeRealAppImportFacts } from '@mizchi/dspec/external-holdouts'; if (typeof externalHoldoutCorpusReport !== 'function' || normalizeRealAppImportFacts([]).length !== 0) process.exit(1);",
  ], consumerRoot);
  const initialized = JSON.parse(run(dspec, ["init", "--json", "--output", "starter.pkl"], consumerRoot));
  if (initialized.output.schemaImportPath !== "./node_modules/@mizchi/dspec/dspec/Schema.pkl") {
    throw new Error(`consumer init selected unexpected schema import: ${initialized.output.schemaImportPath}`);
  }
  const starterReport = JSON.parse(run(dspec, ["verify", "--json", "--require-lock", "starter.pkl"], consumerRoot));
  if (starterReport.status !== "pass") throw new Error(`initialized consumer verify failed: ${JSON.stringify(starterReport)}`);
  const pklPackageRoot = join(temporaryRoot, "pkl-package");
  run("pkl", ["project", "package", "--skip-publish-check", "--output-path", pklPackageRoot, "node_modules/@mizchi/dspec"], consumerRoot);
  if (!existsSync(join(pklPackageRoot, `dspec@${packageVersion}.zip`))) {
    throw new Error("consumer package is missing the Pkl package archive");
  }
  writeFileSync(join(consumerRoot, "consumer.mjs"), `export function canAccess(request) {
  return request.authenticated === true;
}
`);
  writeFileSync(join(consumerRoot, "consumer.test.mjs"), `import assert from "node:assert/strict";
import test from "node:test";
import { canAccess } from "./consumer.mjs";

test("authenticated requests require auth", () => {
  assert.equal(canAccess({ authenticated: true }), true);
  assert.equal(canAccess({ authenticated: false }), false);
});
`);
  writeFileSync(join(consumerRoot, "consumer-smoke.pkl"), `import "${initialized.output.schemaImportPath}" as d

model: d.Model = new {
  id = "consumer-smoke"
  name = new d.LocalizedText { default = "Consumer package smoke" }
  version = "0.1.0"
  primaryLocale = "en"
  locales { "en" }
  vocabulary {
    d.term("request.authenticated", "state", "認証済みリクエスト", "authenticated request")
  }
  rules {
    new d.Rule {
      id = "CONSUMER-ACCESS"
      kind = "obligation"
      text = d.text("認証済みリクエストだけを許可する", "allow only authenticated requests")
      terms { "request.authenticated" }
      must {
        d.clause("request.authenticated == true", "認証済みでなければならない", "request must be authenticated")
      }
      reviewStatus = "approved"
      checks {
        d.nodeCheck("consumer.test.mjs#authenticated requests require auth")
      }
      implementedBy {
        d.codeRef("consumer.mjs", "canAccess")
      }
    }
  }
}
`);
  run(dspec, ["lock", "--json", "consumer-smoke.pkl"], consumerRoot);
  const reportOutput = run(dspec, ["verify", "--json", "--require-lock", "consumer-smoke.pkl"], consumerRoot);
  if (!reportOutput.trim()) throw new Error("consumer verify returned no JSON report");
  const report = JSON.parse(reportOutput);
  if (report.status !== "pass") throw new Error(`consumer verify failed: ${JSON.stringify(report)}`);
  writeFileSync(join(consumerRoot, "consumer-daily-drift.pkl"), `import "./node_modules/@mizchi/dspec/dspec/DailyDrift.pkl" as daily

manifest: daily.Manifest = new {
  id = "consumer-daily-drift"
  targets {
    new daily.Target {
      id = "consumer-spec"
      kind = "tooling-self"
      modelPath = "consumer-smoke.pkl"
      coreGates { "check" }
      locales { "en" }
    }
  }
}
`);
  const dailyPacket = JSON.parse(run(dspec, ["daily-drift", "collect", "--output", ".dspec/daily-drift", "consumer-daily-drift.pkl"], consumerRoot));
  if (dailyPacket.status !== "pass") throw new Error(`consumer daily drift failed: ${JSON.stringify(dailyPacket)}`);
  if (!existsSync(join(consumerRoot, ".dspec", "daily-drift", "skill", "SKILL.md"))) {
    throw new Error("consumer daily drift packet is missing its review skill");
  }
  writeFileSync(join(consumerRoot, "consumer.mjs"), "export const allowRequest = () => true;\n");
  const brokenDrift = spawnSync(dspec, ["verify", "--json", "--require-lock", "consumer-smoke.pkl"], {
    cwd: consumerRoot,
    encoding: "utf8",
  });
  if (brokenDrift.status === 0 || !brokenDrift.stderr.includes("missing implementation symbol")) {
    throw new Error(`consumer verify mutation was not detected\n${brokenDrift.stdout}\n${brokenDrift.stderr}`);
  }
  process.stdout.write("ok: @mizchi/dspec clean package smoke\n");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
