import { validateIntentDataContract, } from "./intent-data-contract-validation.mjs";
function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function list(value) {
    return Array.isArray(value) ? value : [];
}
function checkUniqueIdentifiers(errors, label, identifiers) {
    const seen = new Set();
    for (const identifier of identifiers) {
        if (seen.has(identifier))
            errors.push(`duplicate ${label}: ${identifier}`);
        seen.add(identifier);
    }
}
export function intentProcesses(intent) {
    return list(record(intent)?.processes);
}
export function validateIntentProcess(processValue, vocabularyValue, capabilitiesValue, outcomesValue) {
    const errors = [];
    const process = processValue;
    const vocabulary = list(vocabularyValue);
    const capabilities = list(capabilitiesValue);
    const outcomes = list(outcomesValue);
    const stateIds = new Set(vocabulary.filter((term) => term.kind === "state").map((term) => term.id));
    const capabilityIds = new Set(capabilities.map((capability) => capability.id));
    const outcomesById = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
    if (!stateIds.has(process.input)) {
        errors.push(`unknown intent process input state: ${process.id} -> ${process.input}`);
    }
    errors.push(...validateIntentDataContract(`${process.id} input`, process.inputContract));
    const execution = process.execution;
    if (execution && (!Number.isInteger(execution.maxInFlight) || execution.maxInFlight < 1)) {
        errors.push(`intent execution maxInFlight must be a positive integer: ${process.id}`);
    }
    if (execution?.timeoutSteps !== null
        && execution?.timeoutSteps !== undefined
        && (!Number.isInteger(execution.timeoutSteps) || execution.timeoutSteps < 1)) {
        errors.push(`intent execution timeoutSteps must be a positive integer: ${process.id}`);
    }
    if (execution?.timeoutMs !== null
        && execution?.timeoutMs !== undefined
        && (!Number.isInteger(execution.timeoutMs) || execution.timeoutMs < 1)) {
        errors.push(`intent execution timeoutMs must be a positive integer: ${process.id}`);
    }
    if (execution?.idempotencyKey) {
        const idempotencyField = list(process.inputContract?.fields)
            .find((field) => field.id === execution.idempotencyKey);
        if (!idempotencyField) {
            errors.push(`intent execution idempotency key is not an input field: ${process.id} -> ${execution.idempotencyKey}`);
        }
        else if (idempotencyField.required === false) {
            errors.push(`intent execution idempotency key must be required: ${process.id} -> ${execution.idempotencyKey}`);
        }
        else if (!["identifier", "string"].includes(idempotencyField.type ?? "")) {
            errors.push(`intent execution idempotency key must have identifier or string type: ${process.id} -> ${execution.idempotencyKey}`);
        }
    }
    const declaredOutcomes = list(process.outcomes);
    const constructedOutcomes = list(process.constructs);
    const requiredCapabilities = list(process.requires);
    const effectCapabilities = list(process.effects);
    checkUniqueIdentifiers(errors, `intent process outcome in ${process.id}`, declaredOutcomes);
    checkUniqueIdentifiers(errors, `intent process construct in ${process.id}`, constructedOutcomes);
    checkUniqueIdentifiers(errors, `intent process required capability in ${process.id}`, requiredCapabilities);
    checkUniqueIdentifiers(errors, `intent process effect capability in ${process.id}`, effectCapabilities);
    if (declaredOutcomes.length === 0) {
        errors.push(`intent process has no outcomes: ${process.id}`);
    }
    for (const outcomeId of declaredOutcomes) {
        if (!outcomesById.has(outcomeId)) {
            errors.push(`unknown intent process outcome: ${process.id} -> ${outcomeId}`);
        }
    }
    for (const outcomeId of constructedOutcomes) {
        if (!outcomesById.has(outcomeId)) {
            errors.push(`unknown intent process constructed outcome: ${process.id} -> ${outcomeId}`);
        }
        else if (!declaredOutcomes.includes(outcomeId)) {
            errors.push(`intent process constructs undeclared outcome: ${process.id} -> ${outcomeId}`);
        }
    }
    for (const outcomeId of declaredOutcomes) {
        if (!constructedOutcomes.includes(outcomeId)) {
            errors.push(`intent process outcome has no construction path: ${process.id} -> ${outcomeId}`);
        }
    }
    for (const capabilityId of requiredCapabilities) {
        if (!capabilityIds.has(capabilityId)) {
            errors.push(`unknown intent process required capability: ${process.id} -> ${capabilityId}`);
        }
    }
    for (const capabilityId of effectCapabilities) {
        if (!capabilityIds.has(capabilityId)) {
            errors.push(`unknown intent process effect capability: ${process.id} -> ${capabilityId}`);
        }
    }
    for (const outcomeId of declaredOutcomes) {
        const outcome = outcomesById.get(outcomeId);
        for (const effect of list(outcome?.effects)) {
            if (!effectCapabilities.includes(effect.capability)) {
                errors.push(`intent process effect capability is not declared for outcome effect: ${process.id}.${outcomeId}.${effect.id} -> ${effect.capability}`);
            }
        }
    }
    const outcomeStateIds = new Set(declaredOutcomes
        .map((outcomeId) => outcomesById.get(outcomeId)?.state)
        .filter((stateId) => Boolean(stateId)));
    const transitionedStates = new Set();
    for (const transition of list(process.transitions)) {
        if (!stateIds.has(transition.from)) {
            errors.push(`unknown intent process transition source state: ${process.id} -> ${transition.from}`);
        }
        if (!stateIds.has(transition.to)) {
            errors.push(`unknown intent process transition target state: ${process.id} -> ${transition.to}`);
        }
        if (transition.from !== process.input) {
            errors.push(`intent process transition source differs from input: ${process.id} -> ${transition.from}`);
        }
        if (!outcomeStateIds.has(transition.to)) {
            errors.push(`intent process transition target is not an outcome: ${process.id} -> ${transition.to}`);
        }
        transitionedStates.add(transition.to);
    }
    for (const outcomeId of declaredOutcomes) {
        const outcome = outcomesById.get(outcomeId);
        if (outcome && !transitionedStates.has(outcome.state)) {
            errors.push(`intent process outcome has no transition: ${process.id} -> ${outcomeId}`);
        }
    }
    return errors;
}
