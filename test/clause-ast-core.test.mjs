import assert from "node:assert/strict";
import test from "node:test";

import {
  CLAUSE_AST_SEMANTICS_VERSION,
  evaluateClauseAst,
  validateClauseAst,
} from "../src/core/clause-ast.mjs";

const atom = (name, ...args) => ({ op: "atom", name, args, children: [] });
const node = (op, children) => ({ op, name: null, args: [], children });

const interpretation = {
  domain: ["alice", "bob"],
  atom(name, args) {
    return name === "admin" && args[0] === "alice";
  },
};

test("defines Clause.ast semantics version 1.0", () => {
  assert.equal(CLAUSE_AST_SEMANTICS_VERSION, "1.0");
});

test("evaluates every Clause.ast 1.0 operator consistently", () => {
  const cases = [
    [atom("admin", "alice"), true],
    [{ op: "eq", name: null, args: ["x", "alice"], children: [] }, true],
    [{ op: "neq", name: null, args: ["x", "bob"], children: [] }, true],
    [node("not", [atom("admin", "bob")]), true],
    [node("and", [atom("admin", "alice"), node("not", [atom("admin", "bob")])]), true],
    [node("or", [atom("admin", "bob"), atom("admin", "alice")]), true],
    [node("implies", [atom("admin", "bob"), atom("admin", "alice")]), true],
    [{ op: "exists", name: "x", args: [], children: [atom("admin", "x")] }, true],
    [{ op: "forall", name: "x", args: [], children: [node("or", [atom("admin", "x"), node("not", [atom("admin", "x")])])] }, true],
  ];

  for (const [ast, expected] of cases) {
    assert.deepEqual(validateClauseAst(ast), []);
    assert.equal(evaluateClauseAst(ast, interpretation, { x: "alice" }), expected, ast.op);
  }
});

test("rejects evaluation with an unsupported semantics version", () => {
  assert.throws(
    () => evaluateClauseAst(atom("admin", "alice"), interpretation, {}, { version: "2.0" }),
    /unsupported Clause\.ast semantics version: 2\.0/,
  );
});
