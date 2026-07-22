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

function transactionJournal(contract) {
  const reads = new Set(contract.reads);
  const writes = new Set(contract.writes);
  const effectIds = new Set(contract.effects);
  const journal = {
    id: contract.id,
    isolation: contract.isolation,
    status: "active",
    reads: [],
    writes: [],
    effects: [],
  };
  const active = () => {
    if (journal.status !== "active") throw new Error(`transaction is already ${journal.status}`);
  };
  return {
    journal,
    context: {
      id: contract.id,
      isolation: contract.isolation,
      read(table) {
        active();
        if (!reads.has(table)) throw new Error(`undeclared transaction read: ${table}`);
        journal.reads.push(table);
      },
      write(table) {
        active();
        if (!writes.has(table)) throw new Error(`undeclared transaction write: ${table}`);
        journal.writes.push(table);
      },
      effect(id, output) {
        active();
        if (!effectIds.has(id)) throw new Error(`undeclared transaction effect: ${id}`);
        journal.effects.push({ id, output });
      },
      commit() {
        active();
        journal.status = "committed";
      },
      rollback() {
        active();
        journal.status = "rolled-back";
      },
    },
  };
}

async function run() {
  const [implementationPath, symbol] = process.argv.slice(2);
  if (!implementationPath || !symbol) throw new Error("implementation path and symbol are required");
  const request = await readRequest();
  const implementation = await import(pathToFileURL(implementationPath).href);
  const adapter = implementation[symbol];
  if (typeof adapter !== "function") {
    throw new Error(`Intent transaction refinement symbol is not a function: ${implementationPath}#${symbol}`);
  }
  const transaction = transactionJournal(request.transaction);
  const output = await adapter(request.input, transaction.context);
  if (transaction.journal.status !== "committed") {
    throw new Error(`transaction must commit, got ${transaction.journal.status}`);
  }
  emit({ status: "pass", output, transaction: transaction.journal });
}

try {
  await run();
} catch (error) {
  emit({ status: "fail", error: failure(error) });
  process.exitCode = 1;
}
