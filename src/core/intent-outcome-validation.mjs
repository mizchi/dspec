import { validateIntentDataContract } from "./intent-data-contract-validation.mjs";
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
export function intentCapabilities(intent) {
    return list(record(intent)?.capabilities);
}
export function intentOutcomes(intent) {
    return list(record(intent)?.outcomes);
}
export function validateIntentOutcomes(vocabularyValue, capabilitiesValue, outcomesValue) {
    const errors = [];
    const vocabulary = list(vocabularyValue);
    const capabilities = list(capabilitiesValue);
    const outcomes = list(outcomesValue);
    const stateIds = new Set(vocabulary.filter((term) => term.kind === "state").map((term) => term.id));
    const capabilityIds = new Set(capabilities.map((capability) => capability.id));
    const outcomeStates = new Set();
    for (const outcome of outcomes) {
        if (!stateIds.has(outcome.state)) {
            errors.push(`unknown intent outcome state: ${outcome.id} -> ${outcome.state}`);
        }
        if (outcomeStates.has(outcome.state)) {
            errors.push(`duplicate intent outcome state: ${outcome.state}`);
        }
        outcomeStates.add(outcome.state);
        errors.push(...validateIntentDataContract(`${outcome.id} output`, outcome.outputContract));
        const effects = list(outcome.effects);
        checkUnique(errors, `intent outcome effect id in ${outcome.id}`, effects);
        for (const effect of effects) {
            if (!capabilityIds.has(effect.capability)) {
                errors.push(`unknown intent outcome effect capability: ${outcome.id}.${effect.id} -> ${effect.capability}`);
            }
            errors.push(...validateIntentDataContract(`${outcome.id} effect ${effect.id} output`, effect.outputContract));
        }
    }
    return errors;
}
