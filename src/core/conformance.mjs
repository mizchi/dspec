import { CLAUSE_AST_SEMANTICS_VERSION, evaluateClauseAst, validateClauseAst } from "./clause-ast.mjs";

export const CONFORMANCE_REPORT_SCHEMA_VERSION = "1.0";

function list(value) {
  return Array.isArray(value) ? value : [];
}

function sortedEntries(value) {
  return Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right));
}

function clauseForSelector(rule, selector) {
  const match = /^(when|must|mustNot)\[([0-9]+)\]$/.exec(selector ?? "");
  if (!match) return null;
  return list(rule?.[match[1]])[Number(match[2])] ?? null;
}

function atomKey(name, args) {
  return JSON.stringify([name, args]);
}

function normalizedInput(testCase) {
  const bindings = Object.fromEntries(sortedEntries(testCase.bindings));
  const atoms = list(testCase.atoms)
    .map((atom) => ({
      name: atom.name,
      args: list(atom.args),
      value: Boolean(atom.value),
    }))
    .sort((left, right) => atomKey(left.name, left.args).localeCompare(atomKey(right.name, right.args)));
  return {
    bindings,
    atoms,
    domain: [...list(testCase.domain)].sort(),
  };
}

function inputInterpretation(input) {
  const values = new Map(input.atoms.map((atom) => [atomKey(atom.name, atom.args), atom.value]));
  return {
    domain: input.domain,
    atom(name, args) {
      return values.get(atomKey(name, args)) ?? false;
    },
  };
}

function errorReport(model, errors) {
  return {
    schemaVersion: CONFORMANCE_REPORT_SCHEMA_VERSION,
    model: { id: model?.id ?? null, version: model?.version ?? null },
    status: "fail",
    summary: { targets: 0, passed: 0, failed: 0, cases: 0, passedCases: 0, failedCases: 0 },
    targets: [],
    errors,
  };
}

export function validateConformanceModel(model) {
  const errors = [];
  const rules = new Map(list(model?.rules).map((rule) => [rule.id, rule]));
  const targetIds = new Set();

  for (const target of list(model?.conformance?.targets)) {
    if (!target?.id) {
      errors.push("conformance target id is required");
      continue;
    }
    if (targetIds.has(target.id)) errors.push(`duplicate conformance target id: ${target.id}`);
    targetIds.add(target.id);

    const rule = rules.get(target.rule);
    if (!rule) {
      errors.push(`unknown conformance target rule: ${target.id} -> ${target.rule}`);
      continue;
    }
    const clause = clauseForSelector(rule, target.selector);
    if (!clause) {
      errors.push(`unknown conformance target selector: ${target.id} -> ${target.rule}#${target.selector}`);
      continue;
    }
    if (!clause.ast) {
      errors.push(`conformance target requires typed Clause.ast: ${target.id} -> ${target.rule}#${target.selector}`);
      continue;
    }
    errors.push(...validateClauseAst(clause.ast, { context: `conformance ${target.id}` }));
    if (!target.implementation?.path || !target.implementation?.symbol) {
      errors.push(`conformance target implementation path and symbol are required: ${target.id}`);
    }

    const caseIds = new Set();
    const cases = list(target.cases);
    if (cases.length === 0) errors.push(`conformance target has no cases: ${target.id}`);
    for (const testCase of cases) {
      if (!testCase?.id) {
        errors.push(`conformance case id is required: ${target.id}`);
        continue;
      }
      if (caseIds.has(testCase.id)) errors.push(`duplicate conformance case id: ${target.id}.${testCase.id}`);
      caseIds.add(testCase.id);
      const atoms = new Set();
      for (const atom of list(testCase.atoms)) {
        if (!atom?.name) {
          errors.push(`conformance atom name is required: ${target.id}.${testCase.id}`);
          continue;
        }
        const key = atomKey(atom.name, list(atom.args));
        if (atoms.has(key)) errors.push(`duplicate conformance atom: ${target.id}.${testCase.id}.${atom.name}`);
        atoms.add(key);
      }
    }
    for (const testCase of cases) {
      if (testCase?.shrinksTo && !caseIds.has(testCase.shrinksTo)) {
        errors.push(`unknown conformance shrink target: ${target.id}.${testCase.id} -> ${testCase.shrinksTo}`);
      }
      if (testCase?.shrinksTo === testCase?.id) {
        errors.push(`conformance case cannot shrink to itself: ${target.id}.${testCase.id}`);
      }
    }
  }

  return errors;
}

function selectCounterexample(cases) {
  const failed = cases.filter((entry) => entry.status === "fail");
  if (failed.length === 0) return null;
  const byId = new Map(cases.map((entry) => [entry.id, entry]));
  const seen = new Set();
  let selected = failed[0];
  while (selected.shrinksTo) {
    if (seen.has(selected.id)) break;
    seen.add(selected.id);
    const smaller = byId.get(selected.shrinksTo);
    if (!smaller || smaller.status !== "fail") break;
    selected = smaller;
  }
  return {
    caseId: selected.id,
    input: selected.input,
    expected: selected.expected,
    actual: selected.actual,
    error: selected.error,
  };
}

export async function conformanceReport(model, { invoke } = {}) {
  const errors = validateConformanceModel(model);
  if (typeof invoke !== "function") errors.push("conformance invoke function is required");
  if (errors.length > 0) return errorReport(model, errors);

  const rules = new Map(list(model.rules).map((rule) => [rule.id, rule]));
  const targets = [];
  const reportErrors = [];

  for (const target of list(model.conformance?.targets)) {
    const rule = rules.get(target.rule);
    const clause = clauseForSelector(rule, target.selector);
    const cases = [];
    for (const testCase of list(target.cases)) {
      const input = normalizedInput(testCase);
      let expected;
      let actual = null;
      let error = null;
      try {
        expected = evaluateClauseAst(
          clause.ast,
          inputInterpretation(input),
          input.bindings,
          { version: model.clauseAstSemanticsVersion ?? CLAUSE_AST_SEMANTICS_VERSION },
        );
        actual = await invoke(target, input);
        if (typeof actual !== "boolean") {
          throw new Error(`implementation adapter returned ${typeof actual}, expected boolean`);
        }
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      }
      const status = error === null && actual === expected ? "pass" : "fail";
      if (status === "fail" && error) reportErrors.push(`conformance ${target.id}.${testCase.id}: ${error}`);
      cases.push({
        id: testCase.id,
        status,
        input,
        expected: expected ?? null,
        actual,
        error,
        shrinksTo: testCase.shrinksTo ?? null,
      });
    }
    const counterexample = selectCounterexample(cases);
    if (counterexample && !counterexample.error) {
      reportErrors.push(
        `conformance mismatch: ${target.id}.${counterexample.caseId} expected ${counterexample.expected}, got ${counterexample.actual}`,
      );
    }
    targets.push({
      id: target.id,
      ruleId: target.rule,
      selector: target.selector,
      implementation: {
        path: target.implementation.path,
        symbol: target.implementation.symbol,
      },
      status: counterexample ? "fail" : "pass",
      cases,
      counterexample,
    });
  }

  const passed = targets.filter((target) => target.status === "pass").length;
  const cases = targets.flatMap((target) => target.cases);
  const passedCases = cases.filter((entry) => entry.status === "pass").length;
  return {
    schemaVersion: CONFORMANCE_REPORT_SCHEMA_VERSION,
    model: { id: model.id, version: model.version },
    status: reportErrors.length > 0 || passed !== targets.length ? "fail" : "pass",
    summary: {
      targets: targets.length,
      passed,
      failed: targets.length - passed,
      cases: cases.length,
      passedCases,
      failedCases: cases.length - passedCases,
    },
    targets,
    errors: reportErrors,
  };
}
