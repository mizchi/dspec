import { validateClauseAst } from "./clause-ast.mjs";
function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function list(value) {
    return Array.isArray(value) ? value : [];
}
function checkUnique(errors, label, items) {
    const seen = new Set();
    for (const item of items) {
        if (!item?.id)
            continue;
        if (seen.has(item.id))
            errors.push(`duplicate ${label}: ${item.id}`);
        seen.add(item.id);
    }
}
function checkUniqueIdentifiers(errors, label, identifiers) {
    const seen = new Set();
    for (const identifier of identifiers) {
        if (seen.has(identifier))
            errors.push(`duplicate ${label}: ${identifier}`);
        seen.add(identifier);
    }
}
export function intentAllowedValueMatchesType(field, value) {
    const fieldType = record(field)?.type;
    if (fieldType === "string")
        return true;
    if (fieldType === "integer")
        return /^-?\d+$/.test(String(value));
    if (fieldType === "boolean")
        return value === "true" || value === "false";
    return /^[a-zA-Z0-9][a-zA-Z0-9_.\-/]*$/.test(String(value));
}
export function validateIntentDataContract(owner, contract) {
    const errors = [];
    if (!contract)
        return errors;
    const contractRecord = record(contract);
    const fields = list(contractRecord?.fields);
    checkUnique(errors, `intent contract field id in ${owner}`, fields);
    for (const field of fields) {
        const allowedValues = list(field.allowedValues);
        checkUniqueIdentifiers(errors, `intent contract allowed value in ${owner}.${field.id}`, allowedValues);
        if ((field.minimum !== null && field.minimum !== undefined)
            || (field.maximum !== null && field.maximum !== undefined)) {
            if (field.type !== "integer") {
                errors.push(`intent contract range requires integer field: ${owner}.${field.id}`);
            }
            if (field.minimum !== null && field.minimum !== undefined
                && field.maximum !== null && field.maximum !== undefined
                && field.minimum > field.maximum) {
                errors.push(`intent contract minimum exceeds maximum: ${owner}.${field.id}`);
            }
        }
        if (field.pattern) {
            if (!["string", "identifier"].includes(field.type ?? "")) {
                errors.push(`intent contract pattern requires string field: ${owner}.${field.id}`);
            }
            try {
                new RegExp(field.pattern);
            }
            catch {
                errors.push(`invalid intent contract pattern: ${owner}.${field.id}`);
            }
        }
        for (const value of allowedValues) {
            if (!intentAllowedValueMatchesType(field, value)) {
                errors.push(`intent contract allowed value has wrong type: ${owner}.${field.id} -> ${value}`);
            }
        }
    }
    list(contractRecord?.clauses).forEach((clause, index) => {
        errors.push(...validateClauseAst(clause.ast, { context: `${owner} clauses[${index}]` }));
    });
    return errors;
}
export function validateIntentFieldBindings(owner, contract, bindings) {
    const errors = [];
    const contractRecord = record(contract);
    const fields = new Map(list(contractRecord?.fields).map((field) => [field.id, field]));
    const bindingItems = list(bindings);
    const contractFields = bindingItems.map((binding) => binding.contractField);
    const implementationFields = bindingItems.map((binding) => binding.implementationField);
    checkUniqueIdentifiers(errors, `intent refinement contract field in ${owner}`, contractFields);
    checkUniqueIdentifiers(errors, `intent refinement implementation field in ${owner}`, implementationFields);
    for (const binding of bindingItems) {
        if (!fields.has(binding.contractField)) {
            errors.push(`unknown intent refinement contract field: ${owner} -> ${binding.contractField}`);
        }
    }
    for (const field of fields.values()) {
        if (field.required !== false && !contractFields.includes(field.id)) {
            errors.push(`intent refinement missing required field binding: ${owner} -> ${field.id}`);
        }
    }
    return errors;
}
