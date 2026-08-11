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
export function domainPacks(model) {
    return list(record(model)?.domainPacks);
}
export function validateDomainPacks(model) {
    const errors = [];
    const packs = domainPacks(model);
    checkUnique(errors, "domain pack id", packs);
    for (const pack of packs) {
        const helperIds = new Set();
        for (const helper of list(pack.helpers)) {
            if (helperIds.has(helper.id)) {
                errors.push(`duplicate domain pack helper id: ${pack.id}.${helper.id}`);
            }
            helperIds.add(helper.id);
            if (helper.returns === "rule" && !helper.emitsTypedAst) {
                errors.push(`domain pack rule helper must emit typed ast: ${pack.id}.${helper.id}`);
            }
            if (helper.emitsTypedAst && list(helper.predicates).length === 0) {
                errors.push(`domain pack typed ast helper has no predicates: ${pack.id}.${helper.id}`);
            }
        }
    }
    return errors;
}
