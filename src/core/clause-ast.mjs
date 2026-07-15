export const CLAUSE_AST_SEMANTICS_VERSION = "1.0";

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function validateClauseAst(ast, { context = "Clause.ast" } = {}) {
  if (!ast) return [];
  const errors = [];
  const children = list(ast.children);
  const args = list(ast.args);
  const hasName = ast.name !== null && ast.name !== undefined;
  const fail = (message) => errors.push(`invalid expr ast: ${context} ${message}`);
  const rejectName = () => {
    if (hasName) fail(`${ast.op} does not accept name`);
  };
  const rejectArgs = () => {
    if (args.length > 0) fail(`${ast.op} does not accept args`);
  };
  const rejectChildren = () => {
    if (children.length > 0) fail(`${ast.op} does not accept children`);
  };

  if (ast.op === "atom") {
    if (!hasName) fail("atom expects name");
    rejectChildren();
  } else if (ast.op === "eq" || ast.op === "neq") {
    rejectName();
    rejectChildren();
    if (args.length !== 2) fail(`${ast.op} expects exactly 2 args`);
  } else if (ast.op === "not") {
    rejectName();
    rejectArgs();
    if (children.length !== 1) fail("not expects exactly 1 child");
  } else if (ast.op === "and" || ast.op === "or") {
    rejectName();
    rejectArgs();
    if (children.length === 0) fail(`${ast.op} expects at least 1 child`);
  } else if (ast.op === "implies") {
    rejectName();
    rejectArgs();
    if (children.length !== 2) fail("implies expects exactly 2 children");
  } else if (ast.op === "exists" || ast.op === "forall") {
    if (!hasName) fail(`${ast.op} expects bound variable name`);
    rejectArgs();
    if (children.length !== 1) fail(`${ast.op} expects exactly 1 child`);
  } else {
    fail(`unknown operator: ${ast.op}`);
  }

  children.forEach((child, index) => {
    errors.push(...validateClauseAst(child, { context: `${context}.${ast.op}[${index}]` }));
  });
  return errors;
}

function bindingValue(value, bindings) {
  return Object.prototype.hasOwnProperty.call(bindings, value) ? bindings[value] : value;
}

export function evaluateClauseAst(
  ast,
  interpretation,
  bindings = {},
  { version = CLAUSE_AST_SEMANTICS_VERSION } = {},
) {
  if (version !== CLAUSE_AST_SEMANTICS_VERSION) {
    throw new Error(`unsupported Clause.ast semantics version: ${version}`);
  }
  const errors = validateClauseAst(ast);
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const evaluate = (node, environment) => {
    const children = list(node.children);
    const args = list(node.args).map((arg) => bindingValue(arg, environment));
    if (node.op === "atom") return Boolean(interpretation.atom(node.name, args, environment));
    if (node.op === "eq") return Object.is(args[0], args[1]);
    if (node.op === "neq") return !Object.is(args[0], args[1]);
    if (node.op === "not") return !evaluate(children[0], environment);
    if (node.op === "and") return children.every((child) => evaluate(child, environment));
    if (node.op === "or") return children.some((child) => evaluate(child, environment));
    if (node.op === "implies") return !evaluate(children[0], environment) || evaluate(children[1], environment);
    const domain = list(interpretation.domain);
    const quantified = (value) => evaluate(children[0], { ...environment, [node.name]: value });
    if (node.op === "exists") return domain.some(quantified);
    if (node.op === "forall") return domain.every(quantified);
    return false;
  };

  return evaluate(ast, { ...bindings });
}
