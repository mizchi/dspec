import { CLAUSE_AST_SEMANTICS_VERSION, validateClauseAst, } from "./clause-ast.mjs";
function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function list(value) {
    return Array.isArray(value) ? value : [];
}
function stableObject(value) {
    if (Array.isArray(value))
        return value.map(stableObject);
    const object = record(value);
    if (!object)
        return value;
    return Object.fromEntries(Object.keys(object).sort().map((key) => [key, stableObject(object[key])]));
}
export function exprAstKey(astValue) {
    if (!astValue)
        return null;
    const ast = (record(astValue) ?? {});
    const args = list(ast.args).join(",");
    const children = list(ast.children).map(exprAstKey).join(",");
    if (ast.op === "atom")
        return `atom:${ast.name}(${args})`;
    if (ast.op === "eq" || ast.op === "neq")
        return `${ast.op}(${args})`;
    if (ast.op === "not")
        return `not(${children})`;
    if (ast.op === "and" || ast.op === "or")
        return `${ast.op}(${children})`;
    if (ast.op === "implies")
        return `implies(${children})`;
    if (ast.op === "exists" || ast.op === "forall")
        return `${ast.op}:${ast.name}(${children})`;
    return JSON.stringify(stableObject(astValue));
}
export function clauseIdentity(clause) {
    return clause.ast ? exprAstKey(clause.ast) : clause.expr;
}
export function checkUnique(errors, label, items) {
    const seen = new Set();
    for (const item of items) {
        if (!item?.id)
            continue;
        if (seen.has(item.id))
            errors.push(`duplicate ${label}: ${item.id}`);
        seen.add(item.id);
    }
}
function validateClauseAsts(rule, fieldName) {
    const errors = [];
    list(rule[fieldName]).forEach((clause, index) => {
        errors.push(...validateClauseAst(clause.ast, {
            context: `${rule.id} ${fieldName}[${index}]`,
        }));
    });
    return errors;
}
export function ruleClauseSelectors(rule) {
    const selectors = [];
    for (const field of ["when", "must", "mustNot"]) {
        list(rule[field]).forEach((_clause, index) => {
            selectors.push(`${field}[${index}]`);
        });
    }
    return selectors;
}
export function validateCheckTargetCoverageSelectors(rule) {
    const errors = [];
    const known = new Set(ruleClauseSelectors(rule));
    for (const target of list(rule.checks)) {
        for (const selector of list(target.covers)) {
            if (!known.has(selector)) {
                errors.push(`unknown check target covered clause: ${rule.id} -> ${selector}`);
            }
        }
    }
    return errors;
}
export function validateModelStructure(modelValue, { validateRuleAfterStructure } = {}) {
    const errors = [];
    const model = record(modelValue) ?? {};
    const terms = list(model.vocabulary);
    const rules = list(model.rules);
    const decisions = list(model.decisions);
    checkUnique(errors, "term id", terms);
    checkUnique(errors, "rule id", rules);
    checkUnique(errors, "decision id", decisions);
    const termIds = new Set(terms.map((term) => term.id));
    const ruleIds = new Set(rules.map((rule) => rule.id));
    const locales = new Set(list(model.locales));
    if (model.clauseAstSemanticsVersion !== CLAUSE_AST_SEMANTICS_VERSION) {
        errors.push(`unsupported Clause.ast semantics version: ${model.clauseAstSemanticsVersion}`);
    }
    if (!locales.has(model.primaryLocale)) {
        errors.push(`primary locale is not listed in locales: ${model.primaryLocale}`);
    }
    for (const term of terms) {
        for (const valueId of list(term.values)) {
            if (!termIds.has(valueId)) {
                errors.push(`unknown term value reference: ${term.id} -> ${valueId}`);
            }
        }
        for (const supersededId of list(term.supersedes)) {
            if (!termIds.has(supersededId)) {
                errors.push(`unknown superseded term reference: ${term.id} -> ${supersededId}`);
            }
        }
    }
    for (const rule of rules) {
        for (const termId of list(rule.terms)) {
            if (!termIds.has(termId)) {
                errors.push(`unknown term reference: ${rule.id} -> ${termId}`);
            }
        }
        for (const exceptionId of list(rule.exceptions)) {
            if (!ruleIds.has(exceptionId)) {
                errors.push(`unknown exception reference: ${rule.id} -> ${exceptionId}`);
            }
        }
        const must = new Set(list(rule.must).map(clauseIdentity));
        for (const clause of list(rule.mustNot)) {
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
