function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function list(value) {
    return Array.isArray(value) ? value : [];
}
export function i18nContract(modelValue) {
    const contract = record(record(modelValue)?.i18n);
    return contract
        ? contract
        : { requiredLocales: [], glossary: [] };
}
function isLocalizedText(value) {
    const candidate = record(value);
    return candidate !== null
        && typeof candidate.default === "string"
        && record(candidate.labels) !== null;
}
export function walkLocalizedTexts(value, path, visit, seen = new Set()) {
    if (value === null || typeof value !== "object")
        return;
    if (seen.has(value))
        return;
    seen.add(value);
    if (isLocalizedText(value)) {
        visit(value, path);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((child, index) => walkLocalizedTexts(child, `${path}[${index}]`, visit, seen));
        return;
    }
    for (const [key, child] of Object.entries(value)) {
        walkLocalizedTexts(child, `${path}.${key}`, visit, seen);
    }
}
export function validateI18nContract(modelValue) {
    const errors = [];
    const model = record(modelValue);
    const locales = new Set(list(model?.locales));
    const contract = i18nContract(model);
    const requiredLocales = list(contract.requiredLocales);
    for (const locale of requiredLocales) {
        if (!locales.has(locale)) {
            errors.push(`i18n required locale is not listed in locales: ${locale}`);
        }
    }
    if (requiredLocales.length > 0) {
        walkLocalizedTexts(model, "model", (localized, path) => {
            for (const locale of requiredLocales) {
                if (!Object.hasOwn(localized.labels, locale)) {
                    errors.push(`missing localized label: ${path}.labels.${locale}`);
                }
            }
        });
    }
    const termsById = new Map(list(model?.vocabulary).map((term) => [term.id, term]));
    const glossaryTerms = new Set();
    for (const entry of list(contract.glossary)) {
        if (glossaryTerms.has(entry.term)) {
            errors.push(`duplicate i18n glossary term: ${entry.term}`);
        }
        glossaryTerms.add(entry.term);
        const term = termsById.get(entry.term);
        if (!term) {
            errors.push(`unknown i18n glossary term: ${entry.term}`);
            continue;
        }
        for (const [locale, expected] of Object.entries(entry.labels ?? {})) {
            if (!locales.has(locale)) {
                errors.push(`i18n glossary locale is not listed in locales: ${entry.term}.${locale}`);
            }
            const actual = term.text?.labels?.[locale] ?? null;
            if (actual !== expected) {
                errors.push(`i18n glossary label mismatch: ${entry.term}.${locale} expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`);
            }
        }
    }
    return errors;
}
