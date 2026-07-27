import { writeSync } from "node:fs";
import { pathToFileURL } from "node:url";

function failure(error) {
  return error instanceof Error && error.message ? error.message : String(error);
}

function emit(report) {
  writeSync(3, `${JSON.stringify(report)}\n`);
}

async function readRequest() {
  let source = "";
  for await (const chunk of process.stdin) source += chunk;
  return JSON.parse(source);
}

async function run() {
  const [implementationPath, symbol] = process.argv.slice(2);
  if (!implementationPath || !symbol) throw new Error("implementation path and symbol are required");
  const request = await readRequest();
  const implementation = await import(pathToFileURL(implementationPath).href);
  const adapter = implementation[symbol];
  if (typeof adapter !== "function") {
    throw new Error(`Intent function refinement symbol is not a function: ${implementationPath}#${symbol}`);
  }
  const output = await adapter(request.input);
  emit({ status: "pass", output });
}

try {
  await run();
} catch (error) {
  emit({ status: "fail", error: failure(error) });
  process.exitCode = 1;
}
