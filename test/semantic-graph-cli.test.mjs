import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(root, "src", "cli.mjs");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
}

test("exports a semantic graph as JSON, Turtle, and a GraphDB-ready bundle", () => {
  const directory = mkdtempSync(join(tmpdir(), "dspec-semantic-graph-"));
  const turtle = join(directory, "tetris.ttl");
  const graphdb = join(directory, "tetris.graphdb-input");
  try {
    const json = run(["graph", "export", "examples/tetris.pkl"]);
    assert.equal(json.status, 0, json.stderr);
    assert.equal(JSON.parse(json.stdout).schemaVersion, "1.0");

    const turtleResult = run(["graph", "export", "--format", "turtle", "--output", turtle, "examples/tetris.pkl"]);
    assert.equal(turtleResult.status, 0, turtleResult.stderr);
    assert.match(readFileSync(turtle, "utf8"), /@prefix dspec:/);

    const graphdbResult = run(["graph", "export", "--format", "graphdb", "--output", graphdb, "examples/tetris.pkl"]);
    assert.equal(graphdbResult.status, 0, graphdbResult.stderr);
    for (const file of ["semantic-graph.json", "semantic-graph.ttl", "links.csv", "meta.tsv", "documents.jsonl", "id-map.json", "README.md"]) {
      assert.ok(existsSync(join(graphdb, file)), `missing ${file}`);
    }
    assert.match(readFileSync(join(graphdb, "README.md"), "utf8"), /meandb build-graph notes\.csv/);

    const embedded = run(["graph", "embed", "--dimensions", "16", graphdb]);
    assert.equal(embedded.status, 0, embedded.stderr);
    assert.match(readFileSync(join(graphdb, "notes.csv"), "utf8"), /^\d+,-?0\.\d{8}/m);

    const build = run(["graph", "build", "--dry-run", graphdb]);
    assert.equal(build.status, 0, build.stderr);
    assert.deepEqual(JSON.parse(build.stdout).argv.slice(0, 2), ["build-graph", join(graphdb, "notes.csv")]);

    const graphdbMock = join(directory, "graphdb-mock.mjs");
    writeFileSync(graphdbMock, "#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs';\nconst [command, , output] = process.argv.slice(2);\nif (command !== 'build-graph') process.exit(2);\nwriteFileSync(output, 'GRAPHDB-MOCK');\n");
    chmodSync(graphdbMock, 0o755);
    const built = run(["graph", "build", "--meandb", graphdbMock, graphdb]);
    assert.equal(built.status, 0, built.stderr);
    assert.equal(readFileSync(join(graphdb, "specification.graphdb"), "utf8"), "GRAPHDB-MOCK");

    const queryFile = join(directory, "traceability.gql");
    writeFileSync(queryFile, "FIND rule, relation, artifact\nWHERE rule -[link]-> relation\n  AND relation.tag = \"relation:implemented-by\"\n  AND relation -[link]-> artifact\nLIMIT 3\n");
    const graphdbQueryMock = join(directory, "graphdb-query-mock.mjs");
    writeFileSync(graphdbQueryMock, "#!/usr/bin/env node\nconst [command, graph, query, explain] = process.argv.slice(2);\nif (command !== 'query-dsl' || !graph.endsWith('specification.graphdb') || !query.endsWith('traceability.gql') || explain !== '--explain') process.exit(2);\nprocess.stdout.write(JSON.stringify({ query_version: 1, rows: [], plan: { clauses: [], edges_scanned: 0, peak_intermediate_rows: 0 } }) + '\\n');\n");
    chmodSync(graphdbQueryMock, 0o755);
    const graphdbQuery = run(["graph", "query-dsl", "--meandb", graphdbQueryMock, "--explain", join(graphdb, "specification.graphdb"), queryFile]);
    assert.equal(graphdbQuery.status, 0, graphdbQuery.stderr);
    assert.deepEqual(JSON.parse(graphdbQuery.stdout), {
      query_version: 1,
      rows: [],
      plan: { clauses: [], edges_scanned: 0, peak_intermediate_rows: 0 },
    });

    const question = run(["graph", "query", "--json", "examples/tetris.pkl", "Tetris game rules"]);
    assert.equal(question.status, 0, question.stderr);
    assert.equal(JSON.parse(question.stdout).classification, "retrieved");

    const source = JSON.parse(run(["graph", "export", "examples/tetris.pkl"]).stdout);
    const conformance = join(directory, "conformance.json");
    const assurance = join(directory, "assurance.json");
    const realApp = join(directory, "real-app.json");
    writeFileSync(conformance, JSON.stringify({
      model: source.model,
      status: "pass",
      targets: [],
    }));
    writeFileSync(assurance, JSON.stringify({
      model: source.model,
      artifacts: [{ id: "lean", backend: "lean", result: "pass", propertyIds: ["lean.theorem.coverage"] }],
    }));
    writeFileSync(realApp, JSON.stringify({
      model: source.model,
      status: "pass",
      checks: [{ id: "game-route", kind: "route", path: "model.patterns.api.routes[0]", status: "pass" }],
    }));
    const withEvidence = run(["graph", "export", "--conformance", conformance, "--assurance", assurance, "--real-app", realApp, "examples/tetris.pkl"]);
    assert.equal(withEvidence.status, 0, withEvidence.stderr);
    const evidenceGraph = JSON.parse(withEvidence.stdout);
    assert.ok(evidenceGraph.nodes.some((node) => node.id === "evidence/conformance/report"));
    assert.ok(evidenceGraph.nodes.some((node) => node.origin === "assurance-manifest"));
    assert.ok(evidenceGraph.nodes.some((node) => node.origin === "real-app-reconciliation"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
