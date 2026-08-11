type UnknownRecord = Record<string, unknown>;

export type ClauseAst = {
  args?: unknown[];
  children?: ClauseAst[];
  name?: unknown;
  op?: string;
};

export type ClauseAstBindings = Record<string, unknown>;

export type ClauseAstInterpretation = {
  atom: (
    name: unknown,
    args: unknown[],
    environment: ClauseAstBindings,
  ) => unknown;
  domain?: unknown[];
};

export const CLAUSE_AST_SEMANTICS_VERSION = "1.0";

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function validateClauseAst(
  ast: unknown,
  { context = "Clause.ast" }: { context?: string } = {},
): string[] {
  if (!ast) return [];
  const node = (record(ast) ?? {}) as ClauseAst;
  const errors: string[] = [];
  const children = list<ClauseAst>(node.children);
  const args = list<unknown>(node.args);
  const hasName = node.name !== null && node.name !== undefined;
  const fail = (message: string): void => {
    errors.push(`invalid expr ast: ${context} ${message}`);
  };
  const rejectName = (): void => {
    if (hasName) fail(`${node.op} does not accept name`);
  };
  const rejectArgs = (): void => {
    if (args.length > 0) fail(`${node.op} does not accept args`);
  };
  const rejectChildren = (): void => {
    if (children.length > 0) fail(`${node.op} does not accept children`);
  };

  if (node.op === "atom") {
    if (!hasName) fail("atom expects name");
    rejectChildren();
  } else if (node.op === "eq" || node.op === "neq") {
    rejectName();
    rejectChildren();
    if (args.length !== 2) fail(`${node.op} expects exactly 2 args`);
  } else if (node.op === "not") {
    rejectName();
    rejectArgs();
    if (children.length !== 1) fail("not expects exactly 1 child");
  } else if (node.op === "and" || node.op === "or") {
    rejectName();
    rejectArgs();
    if (children.length === 0) fail(`${node.op} expects at least 1 child`);
  } else if (node.op === "implies") {
    rejectName();
    rejectArgs();
    if (children.length !== 2) fail("implies expects exactly 2 children");
  } else if (node.op === "exists" || node.op === "forall") {
    if (!hasName) fail(`${node.op} expects bound variable name`);
    rejectArgs();
    if (children.length !== 1) fail(`${node.op} expects exactly 1 child`);
  } else {
    fail(`unknown operator: ${node.op}`);
  }

  children.forEach((child, index) => {
    errors.push(...validateClauseAst(child, { context: `${context}.${node.op}[${index}]` }));
  });
  return errors;
}

function bindingValue(value: unknown, bindings: ClauseAstBindings): unknown {
  const key = String(value);
  return Object.prototype.hasOwnProperty.call(bindings, key) ? bindings[key] : value;
}

export function evaluateClauseAst(
  ast: ClauseAst,
  interpretation: ClauseAstInterpretation,
  bindings: ClauseAstBindings = {},
  { version = CLAUSE_AST_SEMANTICS_VERSION }: { version?: string } = {},
): boolean {
  if (version !== CLAUSE_AST_SEMANTICS_VERSION) {
    throw new Error(`unsupported Clause.ast semantics version: ${version}`);
  }
  const errors = validateClauseAst(ast);
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const evaluate = (node: ClauseAst, environment: ClauseAstBindings): boolean => {
    const children = list<ClauseAst>(node.children);
    const args = list<unknown>(node.args).map((arg) => bindingValue(arg, environment));
    if (node.op === "atom") return Boolean(interpretation.atom(node.name, args, environment));
    if (node.op === "eq") return Object.is(args[0], args[1]);
    if (node.op === "neq") return !Object.is(args[0], args[1]);
    if (node.op === "not") return !evaluate(children[0], environment);
    if (node.op === "and") return children.every((child) => evaluate(child, environment));
    if (node.op === "or") return children.some((child) => evaluate(child, environment));
    if (node.op === "implies") {
      return !evaluate(children[0], environment) || evaluate(children[1], environment);
    }
    const domain = list<unknown>(interpretation.domain);
    const quantified = (value: unknown): boolean => evaluate(
      children[0],
      { ...environment, [String(node.name)]: value },
    );
    if (node.op === "exists") return domain.some(quantified);
    if (node.op === "forall") return domain.every(quantified);
    return false;
  };

  return evaluate(ast, { ...bindings });
}
