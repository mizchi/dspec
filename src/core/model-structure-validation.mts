import {
  CLAUSE_AST_SEMANTICS_VERSION,
  type ClauseAst,
  validateClauseAst,
} from "./clause-ast.mjs";

type UnknownRecord = Record<string, unknown>;

type Identified = {
  id?: string;
};

type Clause = {
  ast?: ClauseAst | null;
  expr?: string;
};

type CheckTarget = {
  covers?: string[];
};

export type ModelRule = Identified & {
  checks?: CheckTarget[];
  deprecated?: boolean;
  exceptions?: string[];
  implementedBy?: unknown[];
  must?: Clause[];
  mustNot?: Clause[];
  reviewStatus?: string;
  terms?: string[];
  when?: Clause[];
};

export type ModelStructureValidationOptions = {
  validateRuleAfterStructure?: (rule: ModelRule) => readonly string[];
};

type VocabularyTerm = Identified & {
  supersedes?: string[];
  values?: string[];
};

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function stableObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableObject);
  const object = record(value);
  if (!object) return value;
  return Object.fromEntries(
    Object.keys(object).sort().map((key) => [key, stableObject(object[key])]),
  );
}

export function exprAstKey(astValue: unknown): string | null | undefined {
  if (!astValue) return null;
  const ast = (record(astValue) ?? {}) as ClauseAst;
  const args = list<unknown>(ast.args).join(",");
  const children = list<ClauseAst>(ast.children).map(exprAstKey).join(",");
  if (ast.op === "atom") return `atom:${ast.name}(${args})`;
  if (ast.op === "eq" || ast.op === "neq") return `${ast.op}(${args})`;
  if (ast.op === "not") return `not(${children})`;
  if (ast.op === "and" || ast.op === "or") return `${ast.op}(${children})`;
  if (ast.op === "implies") return `implies(${children})`;
  if (ast.op === "exists" || ast.op === "forall") return `${ast.op}:${ast.name}(${children})`;
  return JSON.stringify(stableObject(astValue));
}

export function clauseIdentity(clause: Clause): string | null | undefined {
  return clause.ast ? exprAstKey(clause.ast) : clause.expr;
}

export function checkUnique(
  errors: string[],
  label: string,
  items: readonly Identified[],
): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) errors.push(`duplicate ${label}: ${item.id}`);
    seen.add(item.id);
  }
}

function validateClauseAsts(rule: ModelRule, fieldName: "when" | "must" | "mustNot"): string[] {
  const errors: string[] = [];
  list<Clause>(rule[fieldName]).forEach((clause, index) => {
    errors.push(...validateClauseAst(clause.ast, {
      context: `${rule.id} ${fieldName}[${index}]`,
    }));
  });
  return errors;
}

export function ruleClauseSelectors(rule: ModelRule): string[] {
  const selectors: string[] = [];
  for (const field of ["when", "must", "mustNot"] as const) {
    list<Clause>(rule[field]).forEach((_clause, index) => {
      selectors.push(`${field}[${index}]`);
    });
  }
  return selectors;
}

export function validateCheckTargetCoverageSelectors(rule: ModelRule): string[] {
  const errors: string[] = [];
  const known = new Set(ruleClauseSelectors(rule));
  for (const target of list<CheckTarget>(rule.checks)) {
    for (const selector of list<string>(target.covers)) {
      if (!known.has(selector)) {
        errors.push(`unknown check target covered clause: ${rule.id} -> ${selector}`);
      }
    }
  }
  return errors;
}

export function validateModelStructure(
  modelValue: unknown,
  { validateRuleAfterStructure }: ModelStructureValidationOptions = {},
): string[] {
  const errors: string[] = [];
  const model = record(modelValue) ?? {};
  const terms = list<VocabularyTerm>(model.vocabulary);
  const rules = list<ModelRule>(model.rules);
  const decisions = list<Identified>(model.decisions);

  checkUnique(errors, "term id", terms);
  checkUnique(errors, "rule id", rules);
  checkUnique(errors, "decision id", decisions);

  const termIds = new Set(terms.map((term) => term.id));
  const ruleIds = new Set(rules.map((rule) => rule.id));
  const locales = new Set(list<string>(model.locales));

  if (model.clauseAstSemanticsVersion !== CLAUSE_AST_SEMANTICS_VERSION) {
    errors.push(`unsupported Clause.ast semantics version: ${model.clauseAstSemanticsVersion}`);
  }

  if (!locales.has(model.primaryLocale as string)) {
    errors.push(`primary locale is not listed in locales: ${model.primaryLocale}`);
  }

  for (const term of terms) {
    for (const valueId of list<string>(term.values)) {
      if (!termIds.has(valueId)) {
        errors.push(`unknown term value reference: ${term.id} -> ${valueId}`);
      }
    }
    for (const supersededId of list<string>(term.supersedes)) {
      if (!termIds.has(supersededId)) {
        errors.push(`unknown superseded term reference: ${term.id} -> ${supersededId}`);
      }
    }
  }

  for (const rule of rules) {
    for (const termId of list<string>(rule.terms)) {
      if (!termIds.has(termId)) {
        errors.push(`unknown term reference: ${rule.id} -> ${termId}`);
      }
    }
    for (const exceptionId of list<string>(rule.exceptions)) {
      if (!ruleIds.has(exceptionId)) {
        errors.push(`unknown exception reference: ${rule.id} -> ${exceptionId}`);
      }
    }

    const must = new Set(list<Clause>(rule.must).map(clauseIdentity));
    for (const clause of list<Clause>(rule.mustNot)) {
      const identity = clauseIdentity(clause);
      if (must.has(identity)) {
        errors.push(`rule has both must and mustNot: ${rule.id} -> ${identity}`);
      }
    }

    errors.push(...validateClauseAsts(rule, "when"));
    errors.push(...validateClauseAsts(rule, "must"));
    errors.push(...validateClauseAsts(rule, "mustNot"));
    errors.push(...validateCheckTargetCoverageSelectors(rule));
    errors.push(...(validateRuleAfterStructure?.(rule) ?? []));

    const verificationCount = list(rule.checks).length + list(rule.implementedBy).length;
    if (rule.reviewStatus === "approved" && !rule.deprecated && verificationCount === 0) {
      errors.push(`approved rule has no verification target: ${rule.id}`);
    }
  }

  return errors;
}
